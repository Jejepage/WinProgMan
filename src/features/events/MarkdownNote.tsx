import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { safeNoteUrl } from "./markdown";

export function MarkdownNote({ text }: { text: string }) {
  return (
    <div className="markdown-note">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={(url) => safeNoteUrl(url) || ""}
        components={{
          table: ({ children }) => (
            <div className="markdown-table">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) =>
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: ({ alt }) => <span>{alt || "[Image]"}</span>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
