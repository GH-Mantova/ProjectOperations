// CRM UIFIX S1 (2026-09-01) — regression tests for four defects that all had
// the same shape: a slice built the thing and left the surface the user
// actually reaches untouched.
//
//   1. Win rate rendered at 20000% on RelationshipsPage: a private fmtPct
//      helper multiplied by 100 even though #1322 fixed exactly this bug in
//      the shared formatWinRate helper.
//   2. Two tab bars on Tenders: outer shell advertised "Follow-ups coming in
//      S8" while S8 shipped its own inner tab bar inside TendersRegisterPage.
//   3. Two tab bars on Comms: same shape as Tenders, S10 edition.
//   4. Going cold read two contradictory answers on the same screen.
//
// The web workspace has no jsdom / @testing-library setup (all existing web
// tests are pure logic). We assert what we can without mounting:
//   - the shared TAB descriptors exported by TendersPage / CommsPage,
//   - the outer→inner tab resolution helpers,
//   - the CRM_COLD_V2 mirror on the client,
//   - the going-cold threshold selector options,
//   - and negative regression scans on the RelationshipsPage source text.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { TENDERS_TABS, resolveTendersInnerTab } from "../TendersPage";
import { COMMS_TABS, resolveCommsInnerTab } from "../CommsPage";
import {
  GOING_COLD_THRESHOLD_OPTIONS,
  GOING_COLD_DEFAULT_THRESHOLD
} from "../RelationshipsPage";
import { CRM_COLD_V2 } from "../AccountsListPage";
import { formatWinRate } from "../formatWinRate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRM_DIR = resolve(__dirname, "..");

function readCrmSource(basename: string): string {
  return readFileSync(resolve(CRM_DIR, basename), "utf-8");
}

// ── Defect 1: win rate never gets multiplied a second time ────────────────────

describe("win rate — formatWinRate is the ONE formatter (defect 1)", () => {
  // Test 1 from the spec: assert the CLAMPED behaviour and the absence of the
  // private multiplier that turned 200 into 20000%.
  it("formatWinRate(200) renders as clamped, not 20000%", () => {
    // The stored value is already a percentage (see client-stats.service.ts).
    // The private fmtPct did `${(200 * 100).toFixed(0)}%` and rendered 20000%.
    // formatWinRate clamps at 100.
    const out = formatWinRate(200);
    expect(out).toBe("100.0%+");
    expect(out).not.toContain("20000");
  });

  it("RelationshipsPage.tsx no longer contains a private '* 100' win-rate helper", () => {
    // The regression #1322 already fixed once. If a future refactor
    // reintroduces `num * 100`, the win-rate cell reverts to 20000%.
    // The source-text scan is deliberately blunt: any `* 100` in this page
    // is either a bug or must be justified with an inline exemption comment.
    const src = readCrmSource("RelationshipsPage.tsx");
    expect(src).not.toContain("* 100");
    // And the private helper name is gone — it was the exact vector of the bug.
    expect(src).not.toContain("function fmtPct");
    // Positive: the shared helper is imported.
    expect(src).toContain('from "./formatWinRate"');
    expect(src).toContain("formatWinRate(");
  });
});

// ── Defect 4 (surfaced first as a test): CRM_COLD_V2 default numbers ──────────

describe("CRM_COLD_V2 — one contract for the going-cold threshold (defect 4)", () => {
  // Spec test 4: "Both services report the same threshold default. Assert the
  // number, not the constant name." We can't import the server file from the
  // web test (different tsconfig root), so we pin the number on the web mirror
  // here; the server side is pinned in accounts.service.spec.ts by the same
  // literal — a drift in either fails the corresponding suite.
  it("web CRM_COLD_V2.THRESHOLD_DAYS is 60", () => {
    expect(CRM_COLD_V2.THRESHOLD_DAYS).toBe(60);
  });

  it("web CRM_COLD_V2.NULL_IS_COLD is true (never-contacted is coldest)", () => {
    expect(CRM_COLD_V2.NULL_IS_COLD).toBe(true);
  });

  it("the RelationshipsPage threshold selector defaults to CRM_COLD_V2.THRESHOLD_DAYS", () => {
    // If the tab defaulted to a different value than the KPI tile the two
    // numbers would immediately diverge on first render.
    expect(GOING_COLD_DEFAULT_THRESHOLD).toBe(CRM_COLD_V2.THRESHOLD_DAYS);
    expect(GOING_COLD_DEFAULT_THRESHOLD).toBe(60);
  });

  it("the RelationshipsPage threshold selector offers 30 / 60 / 90", () => {
    expect(GOING_COLD_THRESHOLD_OPTIONS).toEqual([30, 60, 90]);
  });
});

// ── Defect 2: outer Tenders tab bar drives real content, no inner tab bar ─────

describe("TendersPage outer tab bar wires real content (defect 2)", () => {
  // Test 5 (spec): /crm/register?tab=follow-ups renders the real follow-ups
  // view, not an empty state. We assert the ROUTING TABLE the outer page uses.
  it("outer tabs: Register and Follow-ups, in that order", () => {
    expect(TENDERS_TABS.map((t) => t.id)).toEqual(["register", "follow-ups"]);
    expect(TENDERS_TABS.map((t) => t.label)).toEqual(["Register", "Follow-ups"]);
  });

  it("outer 'follow-ups' resolves to TendersRegisterPage inner tab 'followups', not to a stub", () => {
    // The prior TendersPage rendered <FollowUpsEmptyState /> for this branch,
    // which shipped a screen that said "Follow-ups coming in S8" even though
    // S8 was already deployed inside TendersRegisterPage.
    expect(resolveTendersInnerTab("follow-ups")).toBe("followups");
    expect(resolveTendersInnerTab("register")).toBe("register");
  });

  it("TendersPage.tsx no longer defines a FollowUpsEmptyState stub", () => {
    const src = readCrmSource("TendersPage.tsx");
    expect(src).not.toContain("FollowUpsEmptyState");
    expect(src).not.toContain("Follow-ups coming in S8");
  });

  // Test 7 (spec): exactly one element with role="tablist" renders on the
  // Tenders page. Without a DOM we prove it structurally: TendersPage renders
  // the ONLY role="tablist" and TendersRegisterPage does not.
  it("TendersRegisterPage.tsx no longer draws its own role=\"tablist\"", () => {
    // The inner tab bar at line 681 in the old file is gone. If it comes back
    // the "two tab bars on Tenders" defect returns.
    const src = readCrmSource("TendersRegisterPage.tsx");
    expect(src).not.toMatch(/role\s*=\s*["']tablist["']/);
  });

  it("TendersPage.tsx renders exactly one role=\"tablist\" element", () => {
    const src = readCrmSource("TendersPage.tsx");
    const matches = src.match(/role\s*=\s*["']tablist["']/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

// ── Defect 3: outer Comms tab bar drives real content, no inner tab bar ───────

describe("CommsPage outer tab bar wires real content (defect 3)", () => {
  // Test 6 (spec): /crm/comms?tab=threads renders real threads, not an empty
  // state. Same structural assertion as Defect 2.
  it("outer tabs: Inbox, Threads, To-dos, in that order", () => {
    expect(COMMS_TABS.map((t) => t.id)).toEqual(["inbox", "threads", "todos"]);
    expect(COMMS_TABS.map((t) => t.label)).toEqual(["Inbox", "Threads", "To-dos"]);
  });

  it("outer tabs resolve to CommsHubPage inner tabs, not to stubs", () => {
    expect(resolveCommsInnerTab("inbox")).toBe("inbox");
    expect(resolveCommsInnerTab("threads")).toBe("threads");
    expect(resolveCommsInnerTab("todos")).toBe("tasks");
  });

  it("CommsPage.tsx no longer defines ThreadsEmptyState or TodosEmptyState stubs", () => {
    const src = readCrmSource("CommsPage.tsx");
    expect(src).not.toContain("ThreadsEmptyState");
    expect(src).not.toContain("TodosEmptyState");
    expect(src).not.toContain("Threads coming in S10");
    expect(src).not.toContain("To-dos coming in S10");
  });

  // Test 7 (spec) — Comms half.
  it("CommsHubPage.tsx (unanchored inbox) no longer draws its own tab bar", () => {
    const src = readCrmSource("CommsHubPage.tsx");
    // The tell for the old inner tab bar: an inboxTab useState with the same
    // three values. We removed setInboxTab and now read from the prop.
    expect(src).not.toContain("setInboxTab(");
  });

  it("CommsPage.tsx renders exactly one role=\"tablist\" element", () => {
    const src = readCrmSource("CommsPage.tsx");
    const matches = src.match(/role\s*=\s*["']tablist["']/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
