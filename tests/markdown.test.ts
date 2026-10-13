import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownNote } from "../src/features/events/MarkdownNote";
import {
  formatNoteSelection,
  legacyNoteToMarkdown,
  safeNoteUrl,
} from "../src/features/events/markdown";

describe("Markdown note editing", () => {
  const render = (text: string) =>
    renderToStaticMarkup(createElement(MarkdownNote, { text }));
  it("renders escaped legacy syntax and indentation as visible literal text", () => {
    const output = render(
      legacyNoteToMarkdown(
        "# Titel\n**fett**\n    code\n<script>alert(1)</script>\na@b.de https://example.com",
      ),
    );
    expect(output).toContain("# Titel");
    expect(output).toContain("**fett**");
    expect(output).toContain("\u00a0\u00a0\u00a0\u00a0code");
    expect(output).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(output).not.toMatch(/<(?:h1|strong|pre|script)[ >]/);
  });
  it("shows source HTML harmlessly and never creates images or unsafe links", () => {
    const output = render(
      "<script>alert(1)</script>\n\n![Bild](https://example.com/image.png)\n\n[unsicher](javascript:alert)\n\n[sicher](https://example.com)",
    );
    expect(output).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(output).toContain("Bild");
    expect(output).not.toMatch(/<(?:script|img)[ >]/);
    expect(output).not.toContain('href="javascript:');
    expect(output).toContain('rel="noopener noreferrer"');
  });
  it("wraps GFM tables for horizontal scrolling", () => {
    expect(render("| A | B |\n| --- | --- |\n| 1 | 2 |")).toContain(
      'class="markdown-table"><table>',
    );
  });
  it("keeps surrounding text and selects the content after formatting", () => {
    const result = formatNoteSelection("vor Text nach", 4, 8, "bold");
    expect(result.value).toBe("vor **Text** nach");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe(
      "Text",
    );
  });
  it("formats complete selected lines as an ordered list", () => {
    expect(formatNoteSelection("eins\nzwei\ndrei", 2, 7, "ordered").value).toBe(
      "1. eins\n2. zwei\ndrei",
    );
  });
  it("uses a longer code fence than any pasted code delimiter", () => {
    const code = "```js\nalert(1)\n```";
    const result = formatNoteSelection(code, 0, code.length, "code");
    expect(result.value).toBe("````\n" + code + "\n````");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe(
      code,
    );
  });
  it("escapes legacy Markdown and HTML and preserves visible indentation", () => {
    expect(
      legacyNoteToMarkdown(
        "# Titel\n**fett** <script>&\n    code\na@b.de https://example.com",
      ),
    ).toBe(
      "\\# Titel\n\\*\\*fett\\*\\* &lt;script&gt;&amp;\n&#160;&#160;&#160;&#160;code\na&#64;b\\.de https&#58;//example\\.com",
    );
  });
  it("accepts only explicit safe link protocols", () => {
    expect(safeNoteUrl("https://example.com")).toBe("https://example.com");
    expect(safeNoteUrl("mailto:a@example.com")).toBe("mailto:a@example.com");
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "//example.com",
      "/relative",
      "file:///C:/secret",
    ])
      expect(safeNoteUrl(url)).toBeUndefined();
  });
});
