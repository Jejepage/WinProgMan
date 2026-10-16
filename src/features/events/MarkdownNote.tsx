import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { safeNoteUrl } from "./markdown";
import { ExternalLink } from "../../ui/ExternalLink";

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
              <ExternalLink href={href}>
                {children}
              </ExternalLink>
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
