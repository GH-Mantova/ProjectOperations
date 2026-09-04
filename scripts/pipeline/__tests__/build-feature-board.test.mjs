/**
 * Tests for the feature board generator.
 *
 * Runs with: node --test scripts/pipeline/__tests__/build-feature-board.test.mjs
 * ci.yml runs: node --test "scripts/pipeline/__tests__/*.mjs" on Ubuntu.
 *
 * The tests that matter most are the CONTAINMENT ones. /feature-pipeline.html is
 * served by SWA with no login — an anonymous GET of the sibling /data-model.html
 * returns 200 (measured 2026-09-03). So the public renderer must be incapable of
 * emitting a lint verdict, a prompt filename or an internal item, and it must
 * withhold by DEFAULT rather than on request.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { STAGES, byArea, renderPublic, renderOperator, stageFromVerdict }
  from "../build-feature-board.mjs";

const item = (o) => Object.assign({
  slug: "pr-thing-s1", file: "pr-thing-s1-HOLD.md", stage: "ready", verdict: "ADMIT",
  size: 3, escalates: false, feature: null, area: "Unassigned",
  audience: "internal", note: null,
}, o);

describe("public renderer — containment", () => {
  test("an item with no audience key is withheld (default is internal)", () => {
    const html = renderPublic([item({ feature: "A visible thing" })], "S");
    assert.ok(!html.includes("A visible thing"), html.slice(0, 400));
  });

  test("an item with an audience but no feature title is withheld", () => {
    const html = renderPublic([item({ audience: "everyone", feature: null })], "S");
    assert.ok(!html.includes("pr-thing-s1"), "the slug must never be a fallback label");
  });

  test("an opted-in item with a title is shown", () => {
    const html = renderPublic(
      [item({ audience: "everyone", feature: "Cutting gets its own section", area: "Estimating" })], "S");
    assert.ok(html.includes("Cutting gets its own section"));
    assert.ok(html.includes("Estimating"));
  });

  test("no slug, filename, verdict or size reaches the public page", () => {
    const html = renderPublic([
      item({ audience: "everyone", feature: "Shown", note: "Why it matters" }),
      item({ audience: "internal", feature: "Hidden", verdict: "GATE_NOT_RELEASED" }),
    ], "S");
    for (const leak of ["pr-thing-s1", "-HOLD.md", "GATE_NOT_RELEASED", "ADMIT", "Hidden"]) {
      assert.ok(!html.includes(leak), `public page leaked ${leak}`);
    }
    assert.ok(html.includes("Shown") && html.includes("Why it matters"));
  });

  test("internal-only stages never surface even when the item opted in", () => {
    // 'malformed' is an operator concern: it means the prompt would run and open
    // nothing. Publishing it would tell a user a feature is coming when it cannot.
    const html = renderPublic(
      [item({ audience: "everyone", feature: "Broken thing", stage: "malformed" })], "S");
    assert.ok(!html.includes("Broken thing"));
  });

  test("with nothing published the page says so rather than rendering blank", () => {
    const html = renderPublic([], "S");
    assert.ok(/Nothing is published/i.test(html));
  });

  test("titles and notes are HTML-escaped", () => {
    const html = renderPublic(
      [item({ audience: "everyone", feature: '<script>x</script>', note: 'a & b' })], "S");
    assert.ok(!html.includes("<script>x</script>"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("a &amp; b"));
  });
});

describe("stage derivation", () => {
  test("STALE beats a missing grant — 'already done, bin it' is the better verdict", () => {
    assert.equal(stageFromVerdict({ stale: true, code: "PREMISE_ALREADY_SATISFIED" }), "spent");
  });
  test("a missing grant is its own stage, not 'gated'", () => {
    // The two need opposite actions: a gated prompt waits, a malformed one is edited.
    assert.equal(stageFromVerdict({ ok: false, code: "MISSING_STANDING_AUTHORITY" }), "malformed");
  });
  test("both gate codes map to gated", () => {
    assert.equal(stageFromVerdict({ ok: false, code: "GATE_NOT_RELEASED" }), "gated");
    assert.equal(stageFromVerdict({ ok: false, code: "FILE_GATE_NOT_RELEASED" }), "gated");
  });
  test("a human gate routes to Marco", () => {
    assert.equal(stageFromVerdict({ ok: false, code: "HUMAN_GATE_PRESENT" }), "waiting_on_marco");
  });
  test("ADMIT is ready; an unknown rejection is malformed, not ready", () => {
    assert.equal(stageFromVerdict({ ok: true }), "ready");
    assert.equal(stageFromVerdict({ ok: false, code: "NO_FRONT_MATTER" }), "malformed");
  });
  test("every stage returned is a declared stage", () => {
    const ids = new Set(STAGES.map((s) => s.id));
    for (const c of ["GATE_NOT_RELEASED", "HUMAN_GATE_PRESENT", "MISSING_STANDING_AUTHORITY", "WHATEVER"]) {
      assert.ok(ids.has(stageFromVerdict({ ok: false, code: c })), c);
    }
  });
});

describe("operator renderer — a dead instrument is not a zero", () => {
  test("gh unavailable is reported as CANNOT MEASURE, never as no open PRs", () => {
    const md = renderOperator([item({})], "S", { ok: false, reason: "ENOENT" }, { ok: false, reason: "unset" });
    assert.ok(/CANNOT MEASURE/.test(md));
    assert.ok(/UNAVAILABLE/.test(md));
    assert.ok(!/0 open PR/.test(md));
  });
  test("an API reporting commit=unknown is not rendered as a commit", () => {
    const md = renderOperator([item({})], "S", { ok: true, prs: [] },
      { ok: false, reason: "API reports commit=unknown" });
    assert.ok(md.includes("commit=unknown"));
    assert.ok(!/deployed commit: `unknown`/.test(md));
  });
  test("the operator view DOES carry what the public one must not", () => {
    const md = renderOperator([item({ verdict: "GATE_NOT_RELEASED", stage: "gated" })], "S",
      { ok: true, prs: [] }, { ok: true, commit: "abc1234" });
    assert.ok(md.includes("pr-thing-s1") && md.includes("GATE_NOT_RELEASED"));
  });
});

describe("grouping", () => {
  test("areas are ordered by size and items by stage", () => {
    const groups = byArea([
      item({ area: "Small" }),
      item({ area: "Big", stage: "gated", slug: "b" }),
      item({ area: "Big", stage: "waiting_on_marco", slug: "a" }),
    ]);
    assert.equal(groups[0][0], "Big");
    assert.equal(groups[0][1][0].stage, "waiting_on_marco");
  });
});
