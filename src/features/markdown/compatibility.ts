import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

interface Ast {
  type: string;
  children?: Ast[];
  [key: string]: unknown;
}

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkBreaks);
function tree(source: string): Ast {
  return processor.runSync(processor.parse(source)) as unknown as Ast;
}

/** Conservative gate: unsupported constructs stay editable as source, never discarded. */
export function sourceOnlyReason(source: string): string | undefined {
  return reasonIn(tree(source));
}

function reasonIn(ast: Ast): string | undefined {
  let reason: string | undefined;
  function visit(node: Ast) {
    if (node.type === "html")
      reason =
        "This note contains raw HTML. Use Markdown to preserve it as literal text.";
    if (node.type === "code" && node.meta)
      reason =
        "This code block has extra metadata. Use Markdown to preserve it.";
    node.children?.forEach(visit);
  }
  visit(ast);
  return reason;
}

/** Compare meaning, allowing marker/spacing changes and reference-link expansion. */
export function markdownMeaning(source: string): string {
  return meaningOf(tree(source));
}

function meaningOf(ast: Ast): string {
  const definitions = new Map<string, Ast>();
  function collect(node: Ast) {
    if (
      node.type === "definition" &&
      !definitions.has(String(node.identifier).toLowerCase())
    )
      definitions.set(String(node.identifier).toLowerCase(), node);
    node.children?.forEach(collect);
  }
  collect(ast);
  function normalize(node: Ast): Record<string, unknown> | null {
    if (node.type === "definition") return null;
    const result: Record<string, unknown> = {};
    let input = node;
    if (node.type === "linkReference" || node.type === "imageReference") {
      const definition = definitions.get(String(node.identifier).toLowerCase());
      if (definition)
        input = {
          type: node.type === "linkReference" ? "link" : "image",
          children: node.children,
          alt: node.alt,
          url: definition.url,
          title: definition.title,
        };
    }
    for (const key of Object.keys(input).sort()) {
      if (["position", "data", "spread", "children"].includes(key)) continue;
      let value = input[key];
      if (value === undefined) continue;
      if (["title", "lang", "meta"].includes(key) && !value) continue;
      if (key === "align" && Array.isArray(value))
        value = value.map((v) => v || "left");
      if (key === "value" && typeof value === "string")
        value = value.replace(/\r\n?/g, "\n");
      result[key] = value;
    }
    if (input.children) {
      const children: Record<string, unknown>[] = [];
      for (const child of input.children) {
        const next = normalize(child);
        if (!next) continue;
        const previous = children.at(-1);
        if (next.type === "text" && previous?.type === "text")
          previous.value = String(previous.value) + next.value;
        else children.push(next);
      }
      result.children = children;
    }
    return result;
  }
  return JSON.stringify(normalize(ast));
}

export function inspectMarkdown(source: string) {
  const ast = tree(source);
  return { reason: reasonIn(ast), meaning: meaningOf(ast) };
}

export function roundTripReason(
  source: string,
  serialized: string,
  inspected = inspectMarkdown(source),
): string | undefined {
  // The common case needs no second parse. Do not trim trailing newlines:
  // inside an unclosed code fence they are actual code content.
  if (source.replace(/\r\n?/g, "\n") === serialized.replace(/\r\n?/g, "\n"))
    return inspected.reason;
  return (
    inspected.reason ||
    (inspected.meaning !== markdownMeaning(serialized)
      ? "This note cannot be transferred to formatted editing without changing its content. Continue in Markdown; the source is preserved."
      : undefined)
  );
}
