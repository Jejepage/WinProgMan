import { describe, expect, it } from "vitest";
import {
  markdownMeaning,
  roundTripReason,
  sourceOnlyReason,
} from "../src/features/markdown/compatibility";

describe("Markdown transfer compatibility", () => {
  it.each([
    ["emphasis markers", "_one_ and __two__", "*one* and **two**"],
    ["bullet markers", "+ one\n+ two", "- one\n- two"],
    ["ordered delimiters", "1) one\n2) two", "1. one\n2. two"],
    ["heading notation", "Heading\n=======", "# Heading"],
    ["line endings", "one\r\ntwo\r\n\r\nthree", "one\ntwo\n\nthree"],
    ["entities and escapes", "&amp; \\*literal\\*", "& \\*literal\\*"],
    [
      "reference links",
      '[text][ref]\n\n[ref]: https://example.com "Title"',
      '[text](https://example.com "Title")',
    ],
    [
      "reference images",
      '![alt][ref]\n\n[ref]: https://example.com/image.png "Title"',
      '![alt](https://example.com/image.png "Title")',
    ],
    [
      "table spacing and default alignment",
      "| A | B |\n| --- | :--- |\n| 1 | 2 |",
      "A|B\n:---|---\n1|2",
    ],
    [
      "code fences",
      "~~~~js\n\tconst x = '```';\n~~~~",
      "````js\n\tconst x = '```';\n````",
    ],
  ])("allows %s normalization", (_label, source, serialized) => {
    expect(markdownMeaning(source)).toBe(markdownMeaning(serialized));
    expect(roundTripReason(source, serialized)).toBeUndefined();
  });

  it.each([
    ["text removal", "one two", "one"],
    ["format removal", "**bold**", "bold"],
    [
      "link destination change",
      "[x](https://a.example)",
      "[x](https://b.example)",
    ],
    ["image removal", "![alt](https://example.com/a.png)", "alt"],
    ["checkbox state", "- [x] done", "- [ ] done"],
    [
      "table cell removal",
      "| A | B |\n| --- | --- |\n| 1 | 2 |",
      "| A | B |\n| --- | --- |\n| 1 | |",
    ],
    [
      "table alignment change",
      "| A |\n| ---: |\n| 1 |",
      "| A |\n| :--- |\n| 1 |",
    ],
    [
      "code indentation",
      "```js\n\tconst x = 1;\n```",
      "```js\nconst x = 1;\n```",
    ],
    ["code language", "```js\nlet x;\n```", "```ts\nlet x;\n```"],
    ["inline code whitespace", "`a  b`", "`a b`"],
    ["visible linebreak removal", "one\ntwo", "one two"],
    ["paragraph boundary removal", "one\n\ntwo", "one\ntwo"],
    ["ordered starting number", "3. one\n4. two", "1. one\n2. two"],
  ])("rejects %s", (_label, source, serialized) => {
    expect(markdownMeaning(source)).not.toBe(markdownMeaning(serialized));
    expect(roundTripReason(source, serialized)).toMatch(
      /cannot be transferred/,
    );
  });

  it.each([
    "<script>window.unsafe = true</script>",
    '<img src="https://example.com/tracker.png" onerror="alert(1)">',
    "<div>**literal HTML content**</div>",
    "before <b>bold</b> after",
  ])("keeps raw HTML in source mode: %s", (source) => {
    expect(sourceOnlyReason(source)).toMatch(/raw HTML/);
    expect(roundTripReason(source, source)).toMatch(/raw HTML/);
  });

  it("keeps code metadata in source mode even if the text is unchanged", () => {
    const source = '```ts title="example.ts"\nconst x = 1;\n```';
    expect(sourceOnlyReason(source)).toMatch(/metadata/);
    expect(roundTripReason(source, source)).toMatch(/metadata/);
  });

  it("does not mistake escaped HTML or code contents for raw HTML", () => {
    for (const source of [
      "&lt;script&gt;literal&lt;/script&gt;",
      "`<script>literal</script>`",
      "```html\n<script>literal</script>\n```",
    ]) {
      expect(sourceOnlyReason(source)).toBeUndefined();
      expect(roundTripReason(source, source)).toBeUndefined();
    }
  });

  it("resolves reference labels case-insensitively", () => {
    expect(
      roundTripReason(
        "[text][REF]\n\n[ref]: https://example.com",
        "[text](https://example.com)",
      ),
    ).toBeUndefined();
  });

  it("uses the first definition when a reference label is repeated", () => {
    const source =
      "[text][ref]\n\n[ref]: https://first.example\n[ref]: https://second.example";
    expect(
      roundTripReason(source, "[text](https://first.example)"),
    ).toBeUndefined();
    expect(roundTripReason(source, "[text](https://second.example)")).toMatch(
      /cannot be transferred/,
    );
  });

  it("does not ignore trailing blank lines inside an unclosed code fence", () => {
    const source = "```\na\n\n";
    const shortened = "```\na\n";
    expect(markdownMeaning(source)).not.toBe(markdownMeaning(shortened));
    expect(roundTripReason(source, shortened)).toMatch(/cannot be transferred/);
    expect(roundTripReason(source, source)).toBeUndefined();
    expect(
      roundTripReason(source.replace(/\n/g, "\r\n"), source),
    ).toBeUndefined();
  });
});
