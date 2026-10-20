import type { EventPrefill } from "./outlookDraft";

/**
 * Hands the prefill from the drop zone to the new-event page. Mail content
 * stays in memory and never enters the URL; the hash only carries a token.
 * Only the latest drop is kept, and a reload discards it.
 */
let pending: { token: string; prefill: EventPrefill } | null = null;

export function storePrefill(prefill: EventPrefill): string {
  const token = crypto.randomUUID();
  pending = { token, prefill };
  return token;
}

export function readPrefill(token: string): EventPrefill | undefined {
  return pending?.token === token ? pending.prefill : undefined;
}
