import type { CorrespondenceInboundRaw, CorrespondenceInboundParsed } from "./correspondence-adapter.interface";

const REFERENCE_TOKEN_RE = /\[ref:([a-z0-9]{6,})\]/i;

export function buildReferenceKey(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function embedReference(subject: string, referenceKey: string): string {
  if (REFERENCE_TOKEN_RE.test(subject)) return subject;
  return `${subject} [ref:${referenceKey}]`;
}

export function extractReferenceKey(subject: string): string | null {
  const match = subject.match(REFERENCE_TOKEN_RE);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Strip the reference token and any "Re:"/"Fwd:" prefixes for display.
 */
export function cleanSubject(subject: string): string {
  return subject.replace(REFERENCE_TOKEN_RE, "").replace(/\s+/g, " ").trim();
}

export function parseInbound(raw: CorrespondenceInboundRaw): CorrespondenceInboundParsed {
  return { ...raw, referenceKey: extractReferenceKey(raw.subject) };
}
