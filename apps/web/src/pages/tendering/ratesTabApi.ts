import type { TenderRateEntry, TenderRateSet } from "./RatesTab";

export type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

async function readJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export async function getRateSet(authFetch: AuthFetch, tenderId: string) {
  const res = await authFetch(`/tenders/${tenderId}/rate-set`);
  return readJsonOrThrow<TenderRateSet | null>(res);
}

export async function lockRateSet(authFetch: AuthFetch, tenderId: string) {
  const res = await authFetch(`/tenders/${tenderId}/rate-set/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  return readJsonOrThrow<TenderRateSet | null>(res);
}

export async function unlockRateSet(authFetch: AuthFetch, tenderId: string) {
  const res = await authFetch(`/tenders/${tenderId}/rate-set`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { unlocked: boolean };
}

/**
 * Set an override value on a rate entry, or clear it (pass `null`).
 * The revert control is a call to this function with `null`.
 */
export async function patchRateEntry(
  authFetch: AuthFetch,
  tenderId: string,
  entryId: string,
  overrideValue: number | null
) {
  const res = await authFetch(`/tenders/${tenderId}/rate-set/entries/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrideValue })
  });
  return readJsonOrThrow<TenderRateEntry>(res);
}

/**
 * Which tab is currently selected based on the URL path. Extracted so
 * the tab-routing logic can be unit-tested without mounting the page.
 */
export function tabFromPath(pathname: string): "overview" | "scope" | "rates" | "quote" {
  if (pathname.endsWith("/scope")) return "scope";
  if (pathname.endsWith("/rates")) return "rates";
  if (pathname.endsWith("/quote")) return "quote";
  return "overview";
}
