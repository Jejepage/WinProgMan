export function legacyNoteToMarkdown(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+.!|~-])/g, "\\$1")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/:/g, "&#58;")
    .replace(/@/g, "&#64;")
    .replace(/^[ \t]+/gm, (indent) =>
      indent.replace(/ /g, "&#160;").replace(/\t/g, "&#160;&#160;&#160;&#160;"),
    );
}

export type NoteAction =
  | "bold"
  | "italic"
  | "heading"
  | "list"
  | "ordered"
  | "quote"
  | "link"
  | "code";
export function formatNoteSelection(
  value: string,
  start: number,
  end: number,
  action: NoteAction,
) {
  const selected = value.slice(start, end);
  let replacement: string;
  let selectionStart = start;
  let selectionEnd: number;
  if (action === "bold" || action === "italic") {
    const marker = action === "bold" ? "**" : "*";
    const content = selected || "Text";
    replacement = `${marker}${content}${marker}`;
    selectionStart += marker.length;
    selectionEnd = selectionStart + content.length;
  } else if (action === "link") {
    const content = selected || "Link text";
    replacement = `[${content}](https://)`;
    selectionStart += content.length + 3;
    selectionEnd = selectionStart + 8;
  } else if (action === "code") {
    const leading = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const trailing = end < value.length && value[end] !== "\n" ? "\n" : "";
    const content = selected || "Code";
    const fence = "`".repeat(
      Math.max(3, ...(content.match(/`+/g) || []).map((run) => run.length + 1)),
    );
    replacement = `${leading}${fence}\n${content}\n${fence}${trailing}`;
    selectionStart += leading.length + fence.length + 1;
    selectionEnd = selectionStart + content.length;
  } else {
    // Include the complete selected lines so prefixes always start at line boundaries.
    start = value.lastIndexOf("\n", start - 1) + 1;
    const nextBreak = value.indexOf("\n", end);
    end = nextBreak < 0 ? value.length : nextBreak;
    const content = value.slice(start, end) || "Text";
    replacement = content
      .split("\n")
      .map((line, index) => {
        const prefix =
          action === "heading"
            ? "## "
            : action === "list"
              ? "- "
              : action === "ordered"
                ? `${index + 1}. `
                : "> ";
        return prefix + line;
      })
      .join("\n");
    selectionStart = start;
    selectionEnd = start + replacement.length;
  }
  return {
    value: value.slice(0, start) + replacement + value.slice(end),
    selectionStart,
    selectionEnd,
  };
}

export function safeNoteUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
