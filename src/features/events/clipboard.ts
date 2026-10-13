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
    fragment
      .querySelectorAll(
        "script,style,iframe,object,embed,link,meta,base,svg,math,form,input,button,video,audio,source,track",
      )
      .forEach((node) => node.remove());
    fragment
      .querySelectorAll("img")
      .forEach((node) =>
        node.replaceWith(
          document.createTextNode(node.getAttribute("alt") || "[Image]"),
        ),
      );
    fragment.querySelectorAll("a").forEach((node) => {
      const href = node.getAttribute("href") || "";
      if (!safeNoteUrl(href)) node.removeAttribute("href");
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
        "strong,b,em,i,a,ul,ol,table,h1,h2,h3,h4,h5,h6,blockquote",
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
    return converter.turndown(root);
  } catch {
    return plain;
  }
}
