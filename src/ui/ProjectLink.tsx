import { useState } from "react";
import { Folder, Globe, Link2, Mail, Phone } from "lucide-react";
import type { Link } from "../domain/types";
import { classifyLinkTarget } from "../domain/links";
import { isDesktop } from "../platform/desktop";
import { openLocalFolder } from "../platform/localPaths";
import { ExternalLink } from "./ExternalLink";

function SharePointIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="15" cy="7" r="6" fill="#038387" />
      <circle cx="18" cy="14" r="5" fill="#36c5bd" />
      <circle cx="12" cy="18" r="5" fill="#1a9ba1" />
      <rect x="1" y="5" width="13" height="14" rx="2" fill="#036c70" />
      <path
        d="M10 9.5C7 8 4.5 10 7.5 12s1 4-2 2.5"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/** `compact` shows only icon and label; the target moves into the tooltip. */
export function ProjectLink({
  link,
  compact = false,
}: {
  link: Link;
  compact?: boolean;
}) {
  const destination = classifyLinkTarget(link.target);
  const [error, setError] = useState("");
  const label =
    destination.kind === "folder"
      ? "Folder"
      : destination.kind === "sharepoint"
        ? "SharePoint"
        : destination.kind === "web"
          ? "Website"
          : destination.kind === "email"
            ? "Email"
            : destination.kind === "phone"
              ? "Phone"
              : "Destination";
  const icon =
    destination.kind === "folder" ? (
      <Folder size={16} aria-hidden="true" />
    ) : destination.kind === "sharepoint" ? (
      <SharePointIcon />
    ) : destination.kind === "web" ? (
      <Globe size={16} aria-hidden="true" />
    ) : destination.kind === "email" ? (
      <Mail size={16} aria-hidden="true" />
    ) : destination.kind === "phone" ? (
      <Phone size={16} aria-hidden="true" />
    ) : (
      <Link2 size={16} aria-hidden="true" />
    );
  const content = (
    <>
      {icon}
      <span>{link.label}</span>
      {!compact && <span className="project-resource-type">{label}</span>}
    </>
  );
  return (
    <>
      {destination.kind === "folder" ? (
        isDesktop() ? (
          <button
            type="button"
            className="text-button project-resource"
            title={compact ? link.target : undefined}
            onClick={() => {
              setError("");
              void openLocalFolder(destination.path).catch(() =>
                setError(
                  "Unable to open folder. Check that it exists and is accessible.",
                ),
              );
            }}
          >
            {content}
          </button>
        ) : (
          <>
            <span
              className="project-resource"
              title={
                compact
                  ? `${link.target} · Open folder links in the Windows app.`
                  : undefined
              }
            >
              {content}
            </span>
            {!compact && (
              <small className="muted">
                Open folder links in the Windows app.
              </small>
            )}
          </>
        )
      ) : destination.kind === "unknown" ? (
        <span
          className="project-resource"
          title={compact ? link.target : undefined}
        >
          {content}
        </span>
      ) : (
        <span
          className="project-resource"
          title={compact ? link.target : undefined}
        >
          <ExternalLink href={destination.href}>{content}</ExternalLink>
        </span>
      )}
      {error && <small role="status">{error}</small>}
      {!compact && <small>{link.target}</small>}
    </>
  );
}
