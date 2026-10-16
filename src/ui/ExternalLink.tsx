import { useState, type ReactNode } from "react";
import { isDesktop, openExternalUrl } from "../platform/desktop";

export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const [error, setError] = useState("");
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          if (!isDesktop()) return;
          event.preventDefault();
          setError("");
          void openExternalUrl(href).catch(() =>
            setError(
              "Unable to open link. Copy the destination and open it manually.",
            ),
          );
        }}
      >
        {children}
      </a>
      {error && <span role="status">{error}</span>}
    </>
  );
}
