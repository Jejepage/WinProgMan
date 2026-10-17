import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import type { RichEditor } from "../markdown/crepeAdapter";
import { safeNoteUrl } from "./markdown";
import { ExternalLink } from "../../ui/ExternalLink";

export interface MarkdownEditorHandle {
  read(allowOpenLink?: boolean): string;
}

/** Crepe owns the working document. Reading on Save avoids per-keystroke parent renders. */
export function MarkdownEditor({
  id,
  value,
  disabled,
  ref,
  onDocumentChange,
  label = "Note text (optional)",
  compact = false,
}: {
  id: string;
  value: string;
  disabled: boolean;
  ref?: Ref<MarkdownEditorHandle>;
  onDocumentChange?: () => void;
  label?: string;
  compact?: boolean;
}) {
  const changeRef = useRef(onDocumentChange);
  changeRef.current = onDocumentChange;
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<RichEditor | null>(null);
  const original = useRef(value);
  const modeRef = useRef<"formatted" | "markdown">("formatted");
  const readyRef = useRef(false);
  const plainRef = useRef(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const source = useRef<HTMLTextAreaElement>(null);
  const sourceValue = useRef(value);
  const sourceDirty = useRef(false);
  const [mode, setMode] = useState(modeRef.current);
  const [sourceDisplay, setSourceDisplay] = useState(value);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [link, setLink] = useState<{ href: string; text: string } | null>(null);
  const [linkError, setLinkError] = useState("");
  const linkOpen = useRef(false);
  function changeMode(next: typeof mode) {
    modeRef.current = next;
    setMode(next);
  }
  useImperativeHandle(
    ref,
    () => ({
      read(allowOpenLink = false) {
        if (linkOpen.current && !allowOpenLink)
          throw new Error("Apply or close the link editor before saving.");
        if (modeRef.current === "markdown")
          return sourceDirty.current
            ? (source.current?.value ?? sourceValue.current)
            : sourceValue.current;
        // Before mounting, no formatted editing is possible: Save the untouched source.
        if (!readyRef.current || !editor.current) return sourceValue.current;
        return editor.current.read();
      },
    }),
    [],
  );
  useEffect(() => {
    let cancelled = false;
    let instance: RichEditor | undefined;
    const mount = document.createElement("div");
    host.current!.append(mount);
    void import("../markdown/crepeAdapter")
      .then(async ({ createRichEditor }) => {
        if (cancelled) return;
        const result = await createRichEditor(mount, original.current, {
          id,
          onDocumentChange: () => changeRef.current?.(),
          plainPaste: () => plainRef.current,
          notice: (message) => {
            if (!cancelled) setNotice(message);
          },
          editLink: () => {
            if (!disabledRef.current) {
              linkOpen.current = true;
              setLinkError("");
              setLink(editor.current!.link());
            }
          },
        });
        instance = result.editor;
        if (cancelled) {
          await instance.destroy();
          return;
        }
        editor.current = instance;
        instance.setDisabled(disabledRef.current);
        readyRef.current = true;
        setReady(true);
        if (result.reason) {
          setNotice(result.reason);
          changeMode("markdown");
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setNotice(
          `Formatted editor unavailable. Your source is preserved. ${error instanceof Error ? error.message : ""}`,
        );
        changeMode("markdown");
        readyRef.current = true;
        setReady(true);
      });
    return () => {
      cancelled = true;
      readyRef.current = false;
      editor.current = null;
      if (instance) void instance.destroy();
      mount.remove();
    };
  }, [id]);
  useEffect(() => {
    editor.current?.setDisabled(disabled);
  }, [disabled]);
  useEffect(() => {
    host.current
      ?.querySelector(".ProseMirror")
      ?.setAttribute(
        "aria-label",
        mode === "formatted" ? label : "Inactive formatted editor",
      );
  }, [mode, ready, label]);
  function showSource() {
    if (modeRef.current === "markdown") return;
    try {
      const next = editor.current?.read() ?? sourceValue.current;
      sourceValue.current = next;
      sourceDirty.current = false;
      setSourceDisplay(next);
      changeMode("markdown");
    } catch (error) {
      setNotice(String(error));
    }
  }
  function showFormatted() {
    if (modeRef.current === "formatted" || !editor.current) return;
    const next = sourceDirty.current
      ? (source.current?.value ?? sourceValue.current)
      : sourceValue.current;
    sourceValue.current = next;
    try {
      const changed = next !== editor.current.read();
      const reason = editor.current.load(next);
      if (reason) {
        setNotice(reason);
        return;
      }
      setNotice(
        changed
          ? "Markdown applied. Undo history starts from this version."
          : "",
      );
      changeMode("formatted");
      requestAnimationFrame(() => editor.current?.focus());
    } catch {
      setNotice("Unable to apply Markdown. Your source is preserved.");
    }
  }
  function closeLink() {
    linkOpen.current = false;
    setLink(null);
    requestAnimationFrame(() => editor.current?.focus());
  }
  return (
    <div className="markdown-editor rich-note-editor" aria-busy={!ready}>
      <label
        className="field"
        htmlFor={mode === "markdown" ? `${id}-source` : id}
      >
        {label}
      </label>
      <div
        className="actions editor-modes"
        role="group"
        aria-label="Format note"
      >
        <button
          type="button"
          className={`button ${mode === "formatted" ? "" : "secondary"}`}
          disabled={disabled || !ready || !editor.current || !!link}
          aria-pressed={mode === "formatted"}
          onClick={showFormatted}
        >
          Formatted
        </button>
        <button
          type="button"
          className={`button ${mode === "markdown" ? "" : "secondary"}`}
          disabled={disabled || !ready || !!link}
          aria-pressed={mode === "markdown"}
          onClick={showSource}
        >
          Markdown
        </button>
        <label className="markdown-paste-option">
          <input
            type="checkbox"
            disabled={disabled}
            onChange={(event) => {
              plainRef.current = event.target.checked;
            }}
          />{" "}
          Paste as plain text
        </label>
      </div>
      {!ready && <p role="status">Loading editor…</p>}
      {notice && (
        <p className="editor-notice" role="status">
          {notice}
        </p>
      )}
      <div ref={host} className="crepe-host" hidden={mode !== "formatted"} />
      {mode === "markdown" && (
        <textarea
          ref={source}
          id={`${id}-source`}
          aria-label={label}
          rows={12}
          disabled={disabled}
          defaultValue={sourceDisplay}
          onChange={(event) => {
            sourceDirty.current = true;
            sourceValue.current = event.target.value;
            changeRef.current?.();
          }}
        />
      )}
      {!compact && (
        <p className="muted">
          {mode === "formatted"
            ? "Edit formatted text directly. Ctrl+B / Ctrl+I / Ctrl+K · Ctrl+Z / Ctrl+Y · Ctrl+Shift+V pastes plain text."
            : "Markdown source is saved as entered. Unsupported content stays in this mode; formatting tools are available in Formatted."}{" "}
          Images appear as text. No attachments or uploads.
        </p>
      )}
      {link && (
        <div
          className="note-link-dialog"
          role="dialog"
          aria-label="Edit link"
          aria-modal="false"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeLink();
            }
            if (event.key === "Enter") event.preventDefault();
          }}
        >
          <label className="field">
            Link text
            <input
              autoFocus
              value={link.text}
              onChange={(event) =>
                setLink({ ...link, text: event.target.value })
              }
            />
          </label>
          <label className="field">
            Link destination
            <input
              value={link.href}
              placeholder="https://example.com"
              onChange={(event) =>
                setLink({ ...link, href: event.target.value })
              }
            />
          </label>
          {linkError && <p role="alert">{linkError}</p>}
          <div className="actions">
            <button
              type="button"
              className="button"
              onClick={() => {
                const href = link.href.trim();
                if (!safeNoteUrl(href)) {
                  setLinkError(
                    "Use an explicit https://, http://, mailto: or tel: destination.",
                  );
                  return;
                }
                editor.current?.setLink(href, link.text);
                closeLink();
              }}
            >
              Apply link
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                editor.current?.setLink("", "");
                closeLink();
              }}
            >
              Remove link
            </button>
            {safeNoteUrl(link.href) && (
              <ExternalLink href={link.href}>Open link</ExternalLink>
            )}
            <button
              type="button"
              className="button secondary"
              onClick={closeLink}
            >
              Close link editor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
