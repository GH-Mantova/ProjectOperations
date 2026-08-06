// Gate B (pipeline-correctness-gates-plan.md SLICE 1, merged #937): closes
// the #922 class where an admin route ships with NO route-level guard and
// slips past CI (the old e2e only checked the sidebar label, never
// direct-URL authz). This test parses App.tsx, computes each Route's
// ABSOLUTE path by tracking JSX nesting, and asserts that every
// admin/super-rendering route is EITHER wrapped in a recognised guard
// component (AdminOnly / SuperUserOnly / RequirePermissions) OR listed in
// SELF_GUARDED_ROUTES with a comment describing the in-component gate it
// relies on. Fails closed: any unmatched route produces a failure that
// names the offending path.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Routes whose element intentionally has NO route-level AdminOnly /
// SuperUserOnly / RequirePermissions wrapper because the rendered page is
// mixed-audience or self-gates in-component. Each entry must be justified
// in its `reason` field so a future reviewer can weigh the risk before
// extending the list.
const SELF_GUARDED_ROUTES: ReadonlyArray<{ path: string; reason: string }> = [
  {
    // AiSettingsPage: every authenticated user can reach the personal
    // "My Settings" tab; the Company tab and admin controls are gated
    // in-component via canViewAiSettingsPage / canViewCompanyTab.
    path: "/settings/ai",
    reason:
      "Mixed-audience: gated in-component by canViewAiSettingsPage / canViewCompanyTab"
  },
  {
    // AdminCompanyPage self-gates via isAdminUser(user) → <NoAccess/>.
    // Kept off route-level AdminOnly so bookmark URLs render the NoAccess
    // panel in-place instead of redirecting.
    path: "/settings/company",
    reason: "Self-gated in-component via isAdminUser → <NoAccess/>"
  },
  {
    // RatesListsAdminPage self-gates via canAny(rates.manage, lists.manage)
    // and renders <NoAccess required={[...]}/> when neither is held. The
    // sidebar entry (Rates & Lists / Reference data) never links users
    // without those permissions here.
    path: "/settings/reference-data",
    reason:
      "Self-gated in-component via canAny('rates.manage','lists.manage') → <NoAccess/>"
  },
  {
    // EstimateRatesAdminPage self-gates via can(user, 'estimates.admin').
    // Same NoAccess pattern as the other admin-named pages that self-gate.
    path: "/admin/estimate-rates",
    reason: "Self-gated in-component via can('estimates.admin') → <NoAccess/>"
  },
  {
    // JobRolesPage lives in the Workers area (SLICE 15 moved it out of
    // Administration). The sidebar entry is gated on resources.manage and
    // the underlying /job-roles + /competencies API endpoints enforce the
    // permission server-side, so a direct-URL hit yields an empty page and
    // 403s on any write. Kept on the allowlist to document the surface;
    // route-level gate would be an improvement but is not a #922-class
    // security gap because writes are refused server-side.
    path: "/workers/job-roles",
    reason:
      "Sidebar-gated on resources.manage; API-level permission enforcement on all mutations"
  }
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_TSX_PATH = resolve(__dirname, "..", "..", "App.tsx");
const APP_TSX_SOURCE = readFileSync(APP_TSX_PATH, "utf-8");

type ParsedRoute = { path: string; elementBlock: string };

// Walks App.tsx as a JSX token stream, tracking parent <Route> nesting so
// that relative child paths like "administration/users" resolve to their
// absolute form "/settings/administration/users". Only <Route> tags with
// BOTH a path AND an element attribute are surfaced — grouping routes with
// no path (<Route element={<ProtectedRoute/>}>) still push a stack frame so
// closing tags balance, but they aren't checked themselves.
function parseRoutes(source: string): ParsedRoute[] {
  const results: ParsedRoute[] = [];
  const stack: string[] = [];
  const tokenRe = /<Route\b|<\/Route>/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(source))) {
    if (match[0] === "</Route>") {
      stack.pop();
      continue;
    }
    const tagStart = match.index;
    const rest = source.slice(tagStart);
    const tagEnd = findTagEnd(rest);
    if (tagEnd < 0) continue;
    const tag = rest.slice(0, tagEnd + 1);
    const isSelfClose = tag.endsWith("/>");
    const path = extractPathAttr(tag);
    const elementBlock = extractElementBlock(tag);
    const parent = stack[stack.length - 1] ?? "";
    const absolutePath =
      path === null
        ? null
        : path.startsWith("/")
        ? path
        : parent === ""
        ? "/" + path
        : parent.replace(/\/+$/, "") + "/" + path;
    if (absolutePath !== null && elementBlock !== null) {
      results.push({ path: absolutePath, elementBlock });
    }
    if (!isSelfClose) {
      // Grouping routes without a path inherit the current parent frame so
      // nested paths still resolve correctly.
      stack.push(absolutePath ?? parent);
    }
    tokenRe.lastIndex = tagStart + tagEnd + 1;
  }
  return results;
}

// Returns the index (relative to `fromTagStart`) of the `>` that closes the
// opening JSX tag, ignoring `>` characters that appear inside a balanced
// `element={...}` block. Returns -1 if no terminator is found.
function findTagEnd(fromTagStart: string): number {
  let braceDepth = 0;
  for (let i = 0; i < fromTagStart.length; i++) {
    const ch = fromTagStart[i];
    if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    else if (ch === ">" && braceDepth === 0) return i;
  }
  return -1;
}

function extractPathAttr(tag: string): string | null {
  const m = tag.match(/\bpath\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function extractElementBlock(tag: string): string | null {
  const elementIdx = tag.indexOf("element=");
  if (elementIdx < 0) return null;
  const braceStart = tag.indexOf("{", elementIdx);
  if (braceStart < 0) return null;
  let depth = 0;
  for (let i = braceStart; i < tag.length; i++) {
    const ch = tag[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return tag.slice(braceStart, i + 1);
    }
  }
  return null;
}

// Absolute paths whose subtree renders admin/super-user surfaces.
const ADMIN_PATH_PREFIXES = [
  "/settings/administration",
  "/settings/company",
  "/settings/data-model"
];

// Component-name heuristic — any element referencing a page component whose
// name signals an admin/platform/roles-and-permissions surface.
const ADMIN_COMPONENT_RE =
  /\b(Admin|Platform|Users|Roles|Permissions|Audit|DataModel)\w*/;

// The three recognised route-level guard wrappers. Whitespace / newlines
// between `<Guard` and the child are tolerated by the `\b` anchor.
const GUARD_RE = /<(?:AdminOnly|SuperUserOnly|RequirePermissions)\b/;

// A route whose element is nothing but a bookmark redirect renders no page
// component — the destination route is where authz enforcement belongs, so
// we exempt Navigate-only routes from the guard check.
const NAVIGATE_ONLY_RE = /^\{\s*<Navigate\b[^>]*\/>\s*\}$/s;

function isAdminRendering(route: ParsedRoute): boolean {
  if (NAVIGATE_ONLY_RE.test(route.elementBlock)) return false;
  const byPath = ADMIN_PATH_PREFIXES.some((prefix) =>
    route.path === prefix || route.path.startsWith(prefix + "/") || route.path.startsWith(prefix)
  );
  const byComponent = ADMIN_COMPONENT_RE.test(route.elementBlock);
  return byPath || byComponent;
}

function isGuarded(route: ParsedRoute): boolean {
  return GUARD_RE.test(route.elementBlock);
}

function isAllowListed(route: ParsedRoute): boolean {
  return SELF_GUARDED_ROUTES.some((entry) => entry.path === route.path);
}

const ROUTES = parseRoutes(APP_TSX_SOURCE);

describe("Gate B — every admin/super-rendering route has a guard or an allow-listed self-guard", () => {
  it("parsed a non-trivial set of routes from App.tsx", () => {
    // Sanity floor: if the parser silently returns [] (e.g. App.tsx moves
    // or the JSX shape changes), the assertion below becomes vacuous.
    expect(ROUTES.length).toBeGreaterThan(20);
  });

  it("resolves nested paths to their absolute form (spot check)", () => {
    const settingsCompany = ROUTES.find((r) => r.path === "/settings/company");
    expect(settingsCompany, "expected /settings/company to resolve").toBeDefined();
    const adminSystem = ROUTES.find(
      (r) => r.path === "/settings/administration/system"
    );
    expect(adminSystem, "expected /settings/administration/system to resolve").toBeDefined();
  });

  it("every admin/super-rendering route is guarded or on the SELF_GUARDED_ROUTES allowlist", () => {
    const adminRoutes = ROUTES.filter(isAdminRendering);
    const offenders = adminRoutes.filter(
      (route) => !isGuarded(route) && !isAllowListed(route)
    );
    expect(
      offenders.map((r) => r.path),
      `Unguarded admin/super-rendering routes found in App.tsx. Wrap them in <AdminOnly>/<SuperUserOnly>/<RequirePermissions>, or add them to SELF_GUARDED_ROUTES with a reason.`
    ).toEqual([]);
  });

  it("every entry in SELF_GUARDED_ROUTES still exists in App.tsx (allowlist stays honest)", () => {
    const knownPaths = new Set(ROUTES.map((r) => r.path));
    const stale = SELF_GUARDED_ROUTES.filter((entry) => !knownPaths.has(entry.path));
    expect(stale.map((s) => s.path), "SELF_GUARDED_ROUTES contains paths not present in App.tsx").toEqual([]);
  });
});
