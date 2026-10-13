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
