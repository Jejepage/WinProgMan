/** Add HTTPS only to unambiguous bare domain addresses; retain browser paths. */
export function normalizeLinkTarget(value: string): string {
  const target = value.trim();
  if (/\s|\\/.test(target) || /^[./~]/.test(target)) return target;
  const host = target.split(/[/?#]/, 1)[0];
  if (
    !host ||
    !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}(?::\d{1,5})?$/i.test(host)
  ) {
    return target;
  }
  try {
    const url = new URL(`https://${target}`);
    return url.hostname && !url.username && !url.password
      ? `https://${target}`
      : target;
  } catch {
    return target;
  }
}

/** Only regular absolute Windows paths are eligible for opening as folders. */
export function folderPath(value: string): string | undefined {
  let path = value.trim();
  if (/^file:/i.test(path)) {
    try {
      const url = new URL(path);
      if (
        url.protocol !== "file:" ||
        url.search ||
        url.hash ||
        url.username ||
        url.password ||
        url.port
      )
        return undefined;
      const decoded = decodeURIComponent(url.pathname);
      path =
        url.hostname && url.hostname !== "localhost"
          ? `\\\\${url.hostname}${decoded.replace(/\//g, "\\")}`
          : decoded.replace(/^\/(?=[a-z]:)/i, "").replace(/\//g, "\\");
    } catch {
      return undefined;
    }
  }
  path = path.replace(/\//g, "\\");
  if (!/^(?:[a-z]:\\|\\\\[^\\]+\\[^\\]+)/i.test(path)) return undefined;
  if (/^\\\\[?.]\\/.test(path) || /[\x00-\x1f<>"|?*]/.test(path))
    return undefined;
  if (path.slice(/^[a-z]:/i.test(path) ? 2 : 0).includes(":")) return undefined;
  if (
    path
      .split("\\")
      .some((part) =>
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  )
    return undefined;
  return path;
}

export type LinkDestination =
  | { kind: "folder"; path: string }
  | { kind: "web" | "sharepoint" | "email" | "phone"; href: string }
  | { kind: "unknown" };

export function classifyLinkTarget(value: string): LinkDestination {
  const path = folderPath(value);
  if (path) return { kind: "folder", path };
  const href = normalizeLinkTarget(value);
  try {
    const url = new URL(href);
    if (url.protocol === "https:" || url.protocol === "http:") {
      if (url.username || url.password) return { kind: "unknown" };
      const host = url.hostname.toLowerCase().replace(/\.$/, "");
      return {
        kind:
          host === "sharepoint.com" || host.endsWith(".sharepoint.com")
            ? "sharepoint"
            : "web",
        href,
      };
    }
    if (url.protocol === "mailto:" && url.pathname)
      return { kind: "email", href };
    if (url.protocol === "tel:" && url.pathname) return { kind: "phone", href };
  } catch {
    /* Unsupported destinations remain visible without becoming links. */
  }
  return { kind: "unknown" };
}
