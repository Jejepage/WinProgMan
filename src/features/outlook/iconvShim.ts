// Browser replacement for iconv-lite (bundled via the alias in vite.config.ts).
// msgreader only decodes ANSI code pages with it; TextDecoder covers those.
export function decode(bytes: Uint8Array, encoding?: string): string {
  try {
    return new TextDecoder(encoding || "windows-1252").decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function encode(): never {
  throw new Error("Writing Outlook files is not supported.");
}

export default { decode, encode };
