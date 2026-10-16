import { CrepeBuilder } from "@milkdown/crepe/builder";
import { topBar } from "@milkdown/crepe/feature/top-bar";
import { listItem } from "@milkdown/crepe/feature/list-item";
import { table } from "@milkdown/crepe/feature/table";
import { cursor } from "@milkdown/crepe/feature/cursor";
import { placeholder } from "@milkdown/crepe/feature/placeholder";
import { codeMirror } from "@milkdown/crepe/feature/code-mirror";
import {
  commandsCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  parserCtx,
} from "@milkdown/kit/core";
import { uploadConfig, uploadPlugin } from "@milkdown/kit/plugin/upload";
import { undoCommand, redoCommand } from "@milkdown/kit/plugin/history";
import { listener } from "@milkdown/kit/plugin/listener";
import { LanguageDescription } from "@codemirror/language";
import {
  hardbreakSchema,
  imageSchema,
  linkSchema,
  remarkPreserveEmptyLinePlugin,
} from "@milkdown/kit/preset/commonmark";
import { insertTableCommand, setAlignCommand } from "@milkdown/kit/preset/gfm";
import { Slice, type Node as ProseNode } from "@milkdown/kit/prose/model";
import { TextSelection } from "@milkdown/kit/prose/state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
} from "@milkdown/kit/prose/tables";
import { liftListItem, wrapInList } from "@milkdown/kit/prose/schema-list";
import { setBlockType } from "@milkdown/kit/prose/commands";
import { clipboardToMarkdown } from "../events/clipboard";
import { legacyNoteToMarkdown, safeNoteUrl } from "../events/markdown";
import {
  inspectMarkdown,
  roundTripReason,
  sourceOnlyReason,
} from "./compatibility";

import "@milkdown/crepe/theme/common/prosemirror.css";
import "@milkdown/crepe/theme/common/reset.css";
import "@milkdown/crepe/theme/common/top-bar.css";
import "@milkdown/crepe/theme/common/table.css";
import "@milkdown/crepe/theme/common/list-item.css";
import "@milkdown/crepe/theme/common/code-mirror.css";
import "@milkdown/crepe/theme/common/cursor.css";
import "@milkdown/crepe/theme/common/placeholder.css";
import "@milkdown/crepe/theme/frame.css";
import "./editor.css";

export interface RichEditor {
  read(): string;
  load(source: string): string | undefined;
  setDisabled(disabled: boolean): void;
  destroy(): Promise<void>;
  focus(): void;
  link(): { href: string; text: string };
  setLink(href: string, text: string): void;
  openLink(): string | undefined;
}

const labels: Record<string, string> = {
  bold: "Bold",
  italic: "Italic",
  strikethrough: "Strikethrough",
  code: "Inline code",
  "bullet-list": "Bullet list",
  "ordered-list": "Numbered list",
  "task-list": "Checkbox list",
  link: "Link",
  table: "Table",
  "code-block": "Code block",
  quote: "Quote",
  hr: "Horizontal rule",
};

export async function createRichEditor(
  root: HTMLElement,
  source: string,
  options: {
    id: string;
    plainPaste: () => boolean;
    notice: (message: string) => void;
    editLink: () => void;
  },
): Promise<{ editor: RichEditor; reason?: string }> {
  const inspected = inspectMarkdown(source);
  const initialReason = inspected.reason;
  let origin = source;
  let baseline: ProseNode;
  const builder = new CrepeBuilder({
    root,
    defaultValue: initialReason ? "" : source,
  });
  builder
    .addFeature(listItem)
    .addFeature(table)
    .addFeature(cursor)
    .addFeature(placeholder, { text: "Write a note…", mode: "doc" })
    .addFeature(codeMirror, {
      languages: [
        LanguageDescription.of({
          name: "JavaScript",
          alias: ["js"],
          load: () =>
            import("@codemirror/lang-javascript").then((m) => m.javascript()),
        }),
        LanguageDescription.of({
          name: "TypeScript",
          alias: ["ts"],
          load: () =>
            import("@codemirror/lang-javascript").then((m) =>
              m.javascript({ typescript: true }),
            ),
        }),
        LanguageDescription.of({
          name: "JSON",
          alias: ["json"],
          load: () => import("@codemirror/lang-json").then((m) => m.json()),
        }),
        LanguageDescription.of({
          name: "Python",
          alias: ["py"],
          load: () => import("@codemirror/lang-python").then((m) => m.python()),
        }),
      ],
      previewOnlyByDefault: false,
    });
  builder.addFeature(topBar, {
    buildTopBar(groups) {
      for (const group of groups.build()) {
        for (const item of group.items) {
          if (!labels[item.key]) continue;
          const label = labels[item.key];
          item.icon = `<span aria-hidden="true">${item.icon}</span><span class="sr-only">${label}</span>`;
        }
      }
      const list = groups.getGroup("list").group.items;
      for (const item of list) {
        item.onRun = (ctx) => {
          const view = ctx.get(editorViewCtx);
          if (view.state.selection.$from.depth === 0) {
            view.dispatch(
              view.state.tr.setSelection(
                TextSelection.between(
                  view.state.doc.resolve(view.state.selection.from),
                  view.state.doc.resolve(view.state.selection.to),
                ),
              ),
            );
          }
          const task = item.key === "task-list";
          const type =
            view.state.schema.nodes[
              item.key === "ordered-list" ? "ordered_list" : "bullet_list"
            ];
          const { $from } = view.state.selection;
          let listDepth = 0;
          for (let depth = $from.depth; depth > 0; depth--) {
            if (
              ["bullet_list", "ordered_list"].includes(
                $from.node(depth).type.name,
              )
            ) {
              listDepth = depth;
              break;
            }
          }
          if (
            listDepth &&
            $from.node(listDepth).type === type &&
            Boolean($from.node(listDepth + 1)?.attrs.checked != null) === task
          ) {
            liftListItem(view.state.schema.nodes.list_item)(
              view.state,
              view.dispatch,
            );
            view.focus();
            return;
          }
          let listTransaction = view.state.tr;
          if (listDepth)
            listTransaction.setNodeMarkup($from.before(listDepth), type);
          else {
            setBlockType(view.state.schema.nodes.paragraph)(
              view.state,
              view.dispatch,
            );
            wrapInList(type)(view.state, view.dispatch);
            listTransaction = view.state.tr;
          }
          {
            const tr = listTransaction;
            const { from, to } = view.state.selection;
            const attrs = (node: ProseNode) => ({
              ...node.attrs,
              checked: task ? (node.attrs.checked ?? false) : null,
              listType: item.key === "ordered-list" ? "ordered" : "bullet",
            });
            view.state.doc.nodesBetween(
              Math.max(0, from - 1),
              to,
              (node, pos) => {
                if (node.type.name === "list_item")
                  tr.setNodeMarkup(pos, undefined, attrs(node));
              },
            );
            // The cursor can sit inside an existing list item outside nodesBetween's range.
            for (
              let depth = view.state.selection.$from.depth;
              depth > 0;
              depth--
            ) {
              const node = view.state.selection.$from.node(depth);
              if (node.type.name === "list_item")
                tr.setNodeMarkup(
                  view.state.selection.$from.before(depth),
                  undefined,
                  attrs(node),
                );
            }
            view.dispatch(tr);
          }
          view.focus();
        };
      }
      const link = groups
        .getGroup("insert")
        .group.items.find((item) => item.key === "link");
      if (link) link.onRun = () => options.editLink();
      const tableItem = groups
        .getGroup("insert")
        .group.items.find((item) => item.key === "table");
      if (tableItem)
        tableItem.onRun = (ctx) => {
          ctx.get(commandsCtx).call(insertTableCommand.key, { row: 3, col: 3 });
          ctx.get(editorViewCtx).focus();
        };
      groups
        .addGroup("history", "History")
        .addItem("undo", {
          icon: '<span aria-hidden="true">↶</span><span class="sr-only">Undo</span>',
          active: () => false,
          onRun: (ctx: Ctx) => {
            ctx.get(commandsCtx).call(undoCommand.key);
            ctx.get(editorViewCtx).focus();
          },
        })
        .addItem("redo", {
          icon: '<span aria-hidden="true">↷</span><span class="sr-only">Redo</span>',
          active: () => false,
          onRun: (ctx: Ctx) => {
            ctx.get(commandsCtx).call(redoCommand.key);
            ctx.get(editorViewCtx).focus();
          },
        });
      groups
        .addGroup("table-actions", "Table actions")
        .addItem("table-actions", {
          icon: "",
          active: () => false,
          selector: {
            activeLabel: () => "Table actions",
            options: Object.entries({
              "Row above": addRowBefore,
              "Row below": addRowAfter,
              "Column left": addColumnBefore,
              "Column right": addColumnAfter,
              "Delete row": deleteRow,
              "Delete column": deleteColumn,
              "Delete table": deleteTable,
            })
              .map(([label, command]) => ({
                label,
                onSelect: (ctx: Ctx) => {
                  const view = ctx.get(editorViewCtx);
                  if (isInTable(view.state)) command(view.state, view.dispatch);
                  view.focus();
                },
              }))
              .concat(
                (["left", "center", "right"] as const).map((alignment) => ({
                  label: `Align ${alignment}`,
                  onSelect: (ctx: Ctx) => {
                    ctx.get(commandsCtx).call(setAlignCommand.key, alignment);
                    ctx.get(editorViewCtx).focus();
                  },
                })),
              ),
          },
        });
    },
  });
  // Disable every file upload path, including the base builder's blob-URL fallback.
  await builder.editor.remove(uploadPlugin);
  // No Markdown subscribers: avoid the base listener's initial full serialization.
  await builder.editor.remove(listener);
  // Empty paragraphs use ordinary Markdown blank lines, never generated raw HTML placeholders.
  await builder.editor.remove(remarkPreserveEmptyLinePlugin);
  await builder.editor.remove(imageSchema);
  builder.editor.use(
    imageSchema.extendSchema((previous) => (ctx) => ({
      ...previous(ctx),
      toDOM: (node) => [
        "span",
        {
          "data-image-placeholder": "true",
          contenteditable: "false",
          class: "note-image-placeholder",
        },
        node.attrs.alt || "[Image]",
      ],
    })),
  );
  await builder.editor.remove(hardbreakSchema);
  builder.editor.use(
    hardbreakSchema.extendSchema((previous) => (ctx) => ({
      ...previous(ctx),
      toDOM: () => ["br"],
    })),
  );
  await builder.editor.remove(linkSchema);
  builder.editor.use(
    linkSchema.extendSchema((previous) => (ctx) => ({
      ...previous(ctx),
      toDOM: (mark) => [
        "a",
        {
          href: safeNoteUrl(mark.attrs.href) || undefined,
          title: mark.attrs.title || undefined,
          rel: "noopener noreferrer",
        },
      ],
    })),
  );
  builder.editor.config((ctx: Ctx) => {
    ctx.update(uploadConfig.key, (previous) => ({
      ...previous,
      uploader: async () => [],
    }));
    ctx.update(editorViewOptionsCtx, (previous) => ({
      ...previous,
      attributes: {
        id: options.id,
        role: "textbox",
        "aria-label": "Note text (optional)",
        "aria-multiline": "true",
        spellcheck: "true",
      },
      handlePaste(view, event) {
        const data = event.clipboardData;
        if (!view.editable) return true;
        if (!data) return false;
        if (data.files.length) {
          event.preventDefault();
          options.notice(
            "Images and file attachments are not supported. Paste text instead.",
          );
          return true;
        }
        event.preventDefault();
        const plain = data.getData("text/plain");
        if (view.state.selection.$from.parent.type.spec.code) {
          view.dispatch(view.state.tr.insertText(plain));
          return true;
        }
        const asPlain = options.plainPaste();
        const markdown = asPlain
          ? legacyNoteToMarkdown(plain)
          : clipboardToMarkdown(plain, data.getData("text/html"));
        const reason = sourceOnlyReason(markdown);
        // Raw HTML source pasted into rich text is literal, not executable HTML.
        const doc = ctx.get(parserCtx)(
          reason ? legacyNoteToMarkdown(plain || markdown) : markdown,
        );
        if (doc)
          view.dispatch(
            view.state.tr
              .replaceSelection(Slice.maxOpen(doc.content))
              .scrollIntoView(),
          );
        return true;
      },
      handleDOMEvents: {
        ...previous.handleDOMEvents,
        drop(_view, event) {
          if (event.dataTransfer?.files.length) {
            event.preventDefault();
            options.notice("Images and file attachments are not supported.");
            return true;
          }
          return false;
        },
        click(view, event) {
          const anchor = (event.target as Element).closest("a");
          if (anchor) {
            event.preventDefault();
            const position = view.posAtDOM(anchor, 0);
            view.dispatch(
              view.state.tr.setSelection(
                TextSelection.near(view.state.doc.resolve(position)),
              ),
            );
            options.editLink();
            return true;
          }
          return false;
        },
      },
      handleKeyDown(view, event) {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "k"
        ) {
          event.preventDefault();
          options.editLink();
          return true;
        }
        // Shift is not carried on every ClipboardEvent; remember it until this paste finishes.
        if (
          (event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          event.key.toLowerCase() === "v"
        ) {
          plainShortcut = true;
          window.setTimeout(() => {
            plainShortcut = false;
          }, 1000);
        }
        return previous.handleKeyDown?.(view, event) || false;
      },
    }));
  });
  let plainShortcut = false;
  const originalPlain = options.plainPaste;
  options.plainPaste = () => plainShortcut || originalPlain();
  try {
    await builder.create();
  } catch (error) {
    await builder.destroy().catch(() => {});
    throw error;
  }
  const view = builder.editor.action((ctx) => ctx.get(editorViewCtx));
  // Milkdown's generic class collides with WinProgMan's full-page form styles.
  view.dom.classList.remove("editor");
  baseline = view.state.doc;
  const reason =
    initialReason || roundTripReason(source, builder.getMarkdown(), inspected);
  let blocked = reason;
  function linkRange() {
    let { from, to } = view.state.selection;
    if (from === to) {
      const resolved = view.state.selection.$from;
      let offset = resolved.start();
      const leaves: {
        start: number;
        end: number;
        mark: import("@milkdown/kit/prose/model").Mark | undefined;
      }[] = [];
      resolved.parent.forEach((node) => {
        leaves.push({
          start: offset,
          end: offset + node.nodeSize,
          mark: node.marks.find((mark) => mark.type.name === "link"),
        });
        offset += node.nodeSize;
      });
      let index = leaves.findIndex(
        (leaf) => leaf.start <= from && leaf.end > from && leaf.mark,
      );
      if (index < 0)
        index = leaves.findIndex((leaf) => leaf.end === from && leaf.mark);
      const mark = leaves[index]?.mark;
      if (mark) {
        let first = index,
          last = index;
        while (first > 0 && leaves[first - 1].mark?.eq(mark)) first--;
        while (last + 1 < leaves.length && leaves[last + 1].mark?.eq(mark))
          last++;
        from = leaves[first].start;
        to = leaves[last].end;
      }
    }
    return { from, to };
  }
  function currentLink() {
    const { state } = view;
    const { from, to } = linkRange();
    const mark =
      state.doc
        .resolve(from)
        .nodeAfter?.marks.find((mark) => mark.type.name === "link") ||
      state.selection.$from.marks().find((mark) => mark.type.name === "link");
    return {
      href: String(mark?.attrs.href || ""),
      text: state.doc.textBetween(from, to, " "),
    };
  }
  const observer = new MutationObserver(() => {
    root
      .querySelectorAll<HTMLButtonElement>(".top-bar-item")
      .forEach((button) => {
        const label = button.querySelector(".sr-only")?.textContent || "";
        const pressed = String(button.classList.contains("active"));
        if (button.getAttribute("aria-pressed") !== pressed)
          button.setAttribute("aria-pressed", pressed);
        if (button.title !== label) button.title = label;
      });
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  // Crepe's TopBar currently handles pointerdown only. Add equivalent keyboard activation.
  function toolbarKeyboard(event: KeyboardEvent) {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      ".milkdown-top-bar button",
    );
    if (!button || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    button.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
  }
  root.addEventListener("keydown", toolbarKeyboard);
  return {
    reason,
    editor: {
      read: () =>
        view.state.doc.eq(baseline) ? origin : builder.getMarkdown(),
      load(next) {
        const current = view.state.doc.eq(baseline)
          ? origin
          : builder.getMarkdown();
        if (next === current) return blocked;
        const nextInspection = inspectMarkdown(next);
        if (nextInspection.reason) return nextInspection.reason;
        const doc = builder.editor.action((ctx) => ctx.get(parserCtx)(next));
        if (!doc) return "Unable to read Markdown. The source is preserved.";
        // Validate on a detached document before replacing the working state/history.
        const serialized = builder.editor.action(asyncSerialize(doc));
        const problem = roundTripReason(next, serialized, nextInspection);
        if (problem) return problem;
        const newState = view.state
          .constructor as typeof import("@milkdown/kit/prose/state").EditorState;
        view.updateState(
          newState.create({
            schema: view.state.schema,
            plugins: view.state.plugins,
            doc,
          }),
        );
        // Let the trailing-block plugin finish before recording the unchanged
        // baseline; scaffold paragraphs are not user edits.
        view.dispatch(view.state.tr.setMeta("addToHistory", false));
        origin = next;
        baseline = view.state.doc;
        blocked = undefined;
        return undefined;
      },
      setDisabled: (disabled) => {
        builder.setReadonly(disabled);
      },
      focus: () => view.focus(),
      link: currentLink,
      openLink: () => safeNoteUrl(currentLink().href),
      setLink(href, text) {
        const { state } = view;
        const { from, to } = linkRange();
        const tr = state.tr;
        const replacement =
          text || (from === to ? href : state.doc.textBetween(from, to, " "));
        if (!href) tr.removeMark(from, to, state.schema.marks.link);
        else if (
          from !== to &&
          replacement === state.doc.textBetween(from, to, " ")
        ) {
          tr.removeMark(from, to, state.schema.marks.link).addMark(
            from,
            to,
            state.schema.marks.link.create({ href, title: null }),
          );
        } else {
          if (from !== state.selection.from || to !== state.selection.to)
            tr.setSelection(TextSelection.create(tr.doc, from, to));
          const marks = state.doc
            .resolve(from)
            .marks()
            .filter((mark) => mark.type.name !== "link");
          tr.replaceSelectionWith(
            state.schema.text(replacement, [
              ...marks,
              state.schema.marks.link.create({ href, title: null }),
            ]),
            false,
          );
        }
        view.dispatch(tr.scrollIntoView());
        view.focus();
      },
      async destroy() {
        observer.disconnect();
        root.removeEventListener("keydown", toolbarKeyboard);
        await builder.destroy();
      },
    },
  };
}

import { serializerCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
function asyncSerialize(doc: ProseNode) {
  return (ctx: Ctx) => ctx.get(serializerCtx)(doc);
}
