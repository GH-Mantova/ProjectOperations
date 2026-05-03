// §5A.1 PR 10 — small relative-time helper for the conversation history
// list. Built tiny on purpose — adding date-fns or moment would be
// disproportionate for this single use case.
//
// "Today, 3:42 PM"     — same calendar day as `now`
// "Yesterday, 4:20 PM" — calendar day = now - 1
// "3 days ago"         — within the last 7 days
// "2 weeks ago"        — within the last 6 weeks
// "Mar 12"             — within the same calendar year, older than 6 weeks
// "Mar 12, 2025"       — different calendar year

export function formatRelativeDate(input: string | Date, now: Date = new Date()): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / (24 * 60 * 60 * 1000)
  );
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });

  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff} days ago`;
  if (dayDiff >= 7 && dayDiff < 42) {
    const weeks = Math.floor(dayDiff / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" })
  });
}

export function truncatePreview(text: string | null | undefined, max = 80): string {
  if (!text) return "(empty)";
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}
