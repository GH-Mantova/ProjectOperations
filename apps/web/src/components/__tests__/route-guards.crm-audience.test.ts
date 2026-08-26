// Companion to route-guards.authz.test.ts. That test asserts every route HAS a
// guard; this one asserts the guard is not NARROWER than the API behind it.
//
// Why this exists: the first cut of the /crm route guard gated all ten CRM
// routes on crm.view alone. Two of them serve a wider audience:
//
//   /crm/pipeline  — pipeline-dashboard.controller.ts decorates every route
//                    @RequireAnyPermission("tenders.view", "crm.view"), and
//                    pipeline-dashboard.controller.spec.ts explicitly asserts
//                    "allows a user who holds tenders.view (and NOT crm.view)".
//   /crm/register  — TendersRegisterPage fetches only the tendering API via
//                    fetchAllPages(); it calls no crm.* endpoint at all.
//
// Gating those two on crm.view alone renders NoAccess for an audience the API
// deliberately admits. RequirePermissions is `perms.some(...)` — OR semantics —
// so listing both codes widens the gate rather than narrowing it.

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

describe("CRM route guards match the audience their API admits", () => {
  it("/crm/pipeline admits tenders.view holders (the API does)", () => {
    expect(permsForRoute("/crm/pipeline")).toContain("tenders.view");
  });

  it("/crm/register admits tenders.view holders (it calls only the tendering API)", () => {
    expect(permsForRoute("/crm/register")).toContain("tenders.view");
  });

  it("both still admit crm.view holders", () => {
    expect(permsForRoute("/crm/pipeline")).toContain("crm.view");
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
