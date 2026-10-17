import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { legacyNoteToMarkdown, safeNoteUrl } from "./markdown";

export function clipboardToMarkdown(
  plain: string,
  html: string,
  asPlainText = false,
): string {
  if (asPlainText) return legacyNoteToMarkdown(plain);
  if (!html) return plain;
  try {
    // Template contents are inert: pasted resources cannot load while sanitizing.
    const template = document.createElement("template");
    template.innerHTML = html;
    const fragment = template.content;
    const allowedElements = new Set(
      "p,div,span,br,hr,strong,b,em,i,del,s,strike,h1,h2,h3,h4,h5,h6,ul,ol,li,a,blockquote,pre,code,table,thead,tbody,tfoot,tr,th,td".split(
        ",",
      ),
    );
    const discardedElements = new Set(
      "script,style,iframe,object,embed,link,meta,base,svg,math,form,button,textarea,select,option,video,audio,source,track,canvas,template".split(
        ",",
      ),
    );
    // Capture only genuine checkbox state before removing every form control.
    // Markers are created after attribute sanitizing, so pasted attributes cannot
    // impersonate them. Turndown works on a clone, hence an internal DOM marker.
    const taskItems = new Map<Element, boolean>();
    fragment.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      const item = input.closest("li");
      if (item && !taskItems.has(item))
        taskItems.set(item, input.hasAttribute("checked"));
    });
    fragment.querySelectorAll("*").forEach((node) => {
      const tag = node.localName;
      if (tag === "img") {
        node.replaceWith(
          document.createTextNode(node.getAttribute("alt") || "[Image]"),
        );
        return;
      }
      if (tag === "input" || discardedElements.has(tag)) {
        node.remove();
        return;
      }
      if (!allowedElements.has(tag)) {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }
      for (const attribute of Array.from(node.attributes)) {
        const { name, value } = attribute;
        const allowed =
          (tag === "a" && name === "href" && !!safeNoteUrl(value)) ||
          (tag === "a" && name === "title") ||
          (tag === "ol" && name === "start" && /^\d{1,9}$/.test(value)) ||
          ((tag === "td" || tag === "th") &&
            name === "align" &&
            /^(left|center|right)$/.test(value)) ||
          (tag === "code" &&
            name === "class" &&
            /^language-[a-zA-Z0-9_+-]+$/.test(value));
        if (!allowed) node.removeAttribute(name);
      }
    });
    taskItems.forEach((checked, item) => {
      const marker = document.createElement("span");
      marker.setAttribute("data-winprogman-task", checked ? "checked" : "open");
      marker.textContent = checked ? "[x] " : "[ ] ";
      item.prepend(marker);
    });
    // Editors often wrap copied Markdown source in a plain div/pre. Retain its bytes.
    const comparison = fragment.cloneNode(true) as DocumentFragment;
    comparison
      .querySelectorAll("br")
      .forEach((node) => node.replaceWith(document.createTextNode("\n")));
    comparison
      .querySelectorAll("p")
      .forEach((node) => node.append(document.createTextNode("\n\n")));
    comparison
      .querySelectorAll("div")
      .forEach((node) => node.append(document.createTextNode("\n")));
    const textualSource = comparison.textContent?.replace(/\r\n/g, "\n").trim();
    if (
      textualSource === plain.replace(/\r\n/g, "\n").trim() &&
      (!fragment.querySelector("pre,code") ||
        /(^|\n)\s{0,3}(?:#{1,6}\s|[-*+]\s|\d+\.\s|>|```)|\*\*.+\*\*|\[[^\]]+\]\([^)]+\)/.test(
          plain,
        )) &&
      !fragment.querySelector(
        "strong,b,em,i,del,s,strike,a,ul,ol,table,h1,h2,h3,h4,h5,h6,blockquote",
      )
    )
      return plain;
    fragment.querySelectorAll("table").forEach((table) => {
      const first = table.querySelector("tr");
      first?.querySelectorAll("td").forEach((cell) => {
        const header = document.createElement("th");
        header.append(...Array.from(cell.childNodes));
        cell.replaceWith(header);
      });
    });
    const root = document.createElement("div");
    root.append(fragment);
    const converter = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });
    converter.use(gfm);
    converter.addRule("sanitizedTaskMarker", {
      filter: (node) =>
        node.nodeName === "SPAN" && node.hasAttribute("data-winprogman-task"),
      replacement: (_content, node) =>
        (node as HTMLElement).getAttribute("data-winprogman-task") === "checked"
          ? "[x] "
          : "[ ] ",
    });
    return converter.turndown(root);
  } catch {
    return plain;
  }
}
