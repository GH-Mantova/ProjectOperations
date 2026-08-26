// Companion to route-guards.authz.test.ts. That test asserts every route HAS a
// guard; this one asserts the guard is not NARROWER than the API behind it.
//
// Why this exists: the first cut of the /crm route guard gated all ten CRM
// routes on crm.view alone. Two of them serve a wider audience:
//
//   /crm/pipeline  — PIPELINE-FOLD (2026-08-20): /crm/pipeline is now an
//                    unguarded <Navigate replace> to /tenders/pipeline. The
//                    access control lives on /tenders/pipeline (tenders.view).
//                    The API (pipeline-dashboard.controller.ts) still decorates
//                    routes @RequireAnyPermission("tenders.view", "crm.view"),
//                    but the front-end gate moved to the canonical URL.
//   /crm/register  — TendersRegisterPage fetches only the tendering API via
//                    fetchAllPages(); it calls no crm.* endpoint at all.
//
// Gating /crm/register on crm.view alone renders NoAccess for an audience the
// API deliberately admits. RequirePermissions is `perms.some(...)` — OR
// semantics — so listing both codes widens the gate rather than narrowing it.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const appTsx = readFileSync(resolve(here, "../../App.tsx"), "utf8");

/** The perms array on the guard immediately wrapping `routePath`'s element. */
function permsForRoute(routePath: string): string[] {
  const anchor = `path="${routePath}"`;
  const at = appTsx.indexOf(anchor);
  if (at === -1) throw new Error(`route not found in App.tsx: ${routePath}`);

  const guard = /<RequirePermissions perms=\{\[([^\]]*)\]\}>/g;
  guard.lastIndex = at;
  const hit = guard.exec(appTsx);
  if (!hit) throw new Error(`no RequirePermissions guard after ${routePath}`);

  // Refuse to read a guard that belongs to a later route.
  if (appTsx.slice(at + anchor.length, hit.index).includes('path="')) {
    throw new Error(`${routePath} has no guard of its own`);
  }

  return hit[1]
    .split(",")
    .map((code) => code.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** True when routePath's element is a <Navigate> redirect (no guard). */
function isRedirectRoute(routePath: string): boolean {
  const anchor = `path="${routePath}"`;
  const at = appTsx.indexOf(anchor);
  if (at === -1) throw new Error(`route not found in App.tsx: ${routePath}`);
  // The element= value on the same route tag — look for <Navigate
  const routeTag = appTsx.slice(at, appTsx.indexOf("/>", at) + 2);
  return routeTag.includes("<Navigate");
}

describe("CRM route guards match the audience their API admits", () => {
  // pipeline-fold (2026-08-20): /crm/pipeline is now a bare <Navigate replace>
  // redirect to /tenders/pipeline. Access control lives on /tenders/pipeline,
  // gated on tenders.view. These tests are updated to reflect the new shape.
  it("/crm/pipeline is an unguarded redirect (pipeline-fold)", () => {
    expect(isRedirectRoute("/crm/pipeline")).toBe(true);
  });

  it("/crm/register admits tenders.view holders (it calls only the tendering API)", () => {
    expect(permsForRoute("/crm/register")).toContain("tenders.view");
  });

  it("/crm/register admits crm.view holders", () => {
    expect(permsForRoute("/crm/register")).toContain("crm.view");
  });

  // Negative control: proves this test can tell the two cases apart. A
  // genuinely crm.view-only route must NOT be widened — /crm/accounts hits
  // accounts.controller.ts, which is @RequirePermissions("crm.view").
  it("does not widen genuinely crm-only routes (control)", () => {
    const accounts = permsForRoute("/crm/accounts");
    expect(accounts).toContain("crm.view");
    expect(accounts).not.toContain("tenders.view");
  });
});
