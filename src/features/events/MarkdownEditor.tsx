import { useRef, useState, type ClipboardEvent } from "react";
import { MarkdownNote } from "./MarkdownNote";
import { formatNoteSelection, type NoteAction } from "./markdown";
import { clipboardToMarkdown } from "./clipboard";

const tools: [NoteAction, string][] = [
  ["bold", "Bold"],
  ["italic", "Italic"],
  ["heading", "Heading"],
  ["list", "List"],
  ["ordered", "Numbered list"],
  ["quote", "Quote"],
  ["link", "Link"],
  ["code", "Code block"],
];

export function MarkdownEditor({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [plainPaste, setPlainPaste] = useState(false);
  function replace(nextValue: string, start: number, end: number) {
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(start, end);
    });
  }
  function format(action: NoteAction) {
    const element = textarea.current;
    if (!element) return;
    const result = formatNoteSelection(
      value,
      element.selectionStart,
      element.selectionEnd,
      action,
    );
    replace(result.value, result.selectionStart, result.selectionEnd);
  }
  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const plain = event.clipboardData.getData("text/plain");
    const html = event.clipboardData.getData("text/html");
    if (!plain && !html) return;
    event.preventDefault();
    const insertion = clipboardToMarkdown(plain, html, plainPaste);
    const element = event.currentTarget;
    const start = element.selectionStart;
    replace(
      value.slice(0, start) + insertion + value.slice(element.selectionEnd),
      start + insertion.length,
      start + insertion.length,
    );
  }
  return (
    <div className="markdown-editor">
      <label className="field" htmlFor={id}>
        Note text (optional)
      </label>
      <div className="markdown-toolbar" role="group" aria-label="Format note">
        {tools.map(([action, label]) => (
          <button
            key={action}
            type="button"
            className="button secondary"
            disabled={disabled || preview}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => format(action)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="actions">
        <button
          type="button"
          className={`button ${preview ? "secondary" : ""}`}
          aria-pressed={!preview}
          onClick={() => setPreview(false)}
        >
          Markdown
        </button>
        <button
          type="button"
          className={`button ${preview ? "" : "secondary"}`}
          aria-pressed={preview}
          onClick={() => setPreview(true)}
        >
          Preview
        </button>
        <label className="markdown-paste-option">
          <input
            type="checkbox"
            checked={plainPaste}
            onChange={(event) => setPlainPaste(event.target.checked)}
          />{" "}
          Paste as plain text
        </label>
      </div>
      {preview ? (
        <div
          className="markdown-preview"
          role="region"
          aria-label="Note preview"
        >
          {value ? (
            <MarkdownNote text={value} />
          ) : (
            <p className="muted">No note text yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textarea}
          id={id}
          rows={7}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onPaste={paste}
        />
      )}
      <p className="muted">
        Markdown supports formatting, lists and links. Images appear as text.
      </p>
    </div>
  );
}
