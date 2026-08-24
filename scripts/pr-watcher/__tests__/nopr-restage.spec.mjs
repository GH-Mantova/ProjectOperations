// Unit tests for nextRestageName (slice 2: bounded auto-restage for [NO-PR] runs).
//
// These tests cover the pure filename-mapping function only. The orchestrator
// logic (rename, enqueue, writeQuarantineReport) runs inside a large stateful
// closure that requires a live watcher setup — that is not tested here;
// code-review plus the pure-function tests are the assurance strategy.

import assert from "node:assert/strict";
import { test } from "node:test";

import { nextRestageName, NO_PR_RESTAGE } from "../index.mjs";

// --- pr- prefix transitions -------------------------------------------------

test("pr-foo-ready.md (attempt 1) → pr-foo-b-ready.md (attempt 2)", () => {
  assert.equal(nextRestageName("pr-foo-ready.md"), "pr-foo-b-ready.md");
});

test("pr-foo-b-ready.md (attempt 2) → pr-foo-c-ready.md (attempt 3)", () => {
  assert.equal(nextRestageName("pr-foo-b-ready.md"), "pr-foo-c-ready.md");
});

test("pr-foo-c-ready.md (attempt 3) → null (bound exhausted)", () => {
  assert.equal(nextRestageName("pr-foo-c-ready.md"), null);
});

// --- rev- prefix transitions ------------------------------------------------

test("rev-foo-ready.md (attempt 1) → rev-foo-b-ready.md (attempt 2)", () => {
  assert.equal(nextRestageName("rev-foo-ready.md"), "rev-foo-b-ready.md");
});

test("rev-foo-b-ready.md (attempt 2) → rev-foo-c-ready.md (attempt 3)", () => {
  assert.equal(nextRestageName("rev-foo-b-ready.md"), "rev-foo-c-ready.md");
});

test("rev-foo-c-ready.md (attempt 3) → null (bound exhausted)", () => {
  assert.equal(nextRestageName("rev-foo-c-ready.md"), null);
});

// --- Collision convention ---------------------------------------------------
//
// A prompt whose STEM genuinely ends in the letter "b" — e.g.
// "pr-slice-b-ready.md" — IS treated as attempt 2 by this function, because
// the convention is purely positional: any "-b-" immediately before "-ready.md"
// counts as an attempt marker.
//
// Per the documented convention, authors whose base stem ends in "b" or "c"
// MUST add a disambiguating suffix, e.g. "pr-slice-b-alpha-ready.md".
// This test asserts the ACCEPTED behaviour: the collision case maps to
// pr-slice-c-ready.md (attempt 3) and then null — it is treated as already
// being on the restage ladder. The spec comment is the guarantee, not magic.
test("pr-slice-b-ready.md — treated as attempt 2 per documented collision convention", () => {
  // This is the accepted collision case. The convention comment above
  // documents that authors must rename to avoid it.
  assert.equal(nextRestageName("pr-slice-b-ready.md"), "pr-slice-c-ready.md");
});

test("pr-slice-b-alpha-ready.md — disambiguated stem, treated as attempt 1", () => {
  // Adding a disambiguating suffix avoids the collision.
  assert.equal(nextRestageName("pr-slice-b-alpha-ready.md"), "pr-slice-b-alpha-b-ready.md");
});

// --- Negative control: only -b-ready.md / -c-ready.md count ----------------
//
// A prompt whose suffix is "-b-anything.md" (not exactly "-b-ready.md") must
// NOT be treated as an attempt marker.

test("pr-foo-b-anything.md — not an attempt marker (only -b-ready.md counts)", () => {
  // Since the pattern only matches names ending in "-ready.md", a name ending
  // in "-b-anything.md" falls into the base case and gets "-b-" appended
  // before "-ready.md" ... but wait: "pr-foo-b-anything.md" does NOT end in
  // "-ready.md" at all, so no match fires and null is returned.
  assert.equal(nextRestageName("pr-foo-b-anything.md"), null);
});

test("pr-foo-b-something-ready.md — the -b- is not immediately before -ready.md so treated as attempt 1", () => {
  // Here the stem is "pr-foo-b-something", which does NOT match /-b(-ready\.md)$/i
  // (the -b is not the last segment before -ready.md). So it is treated as a
  // fresh attempt-1 base and maps to pr-foo-b-something-b-ready.md.
  assert.equal(
    nextRestageName("pr-foo-b-something-ready.md"),
    "pr-foo-b-something-b-ready.md",
  );
});

// --- Feature flag -----------------------------------------------------------

test("NO_PR_RESTAGE is exported as true (feature flag present)", () => {
  assert.equal(NO_PR_RESTAGE, true);
});
