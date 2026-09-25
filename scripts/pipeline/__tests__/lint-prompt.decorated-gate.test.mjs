/**
 * DECORATED_GATE_MARKER - the regression guard for a gate that reads as a gate
 * and holds nothing.
 *
 * WHAT HAPPENED. MEASURED 2026-09-25 at origin/main 99036e3d. Four live prompts
 * carried a decorated marker:
 *
 *   <!-- watcher: do-not-arm | MARCO GATE: arm only after ... -->
 *
 * Not one of them was held by a marker rule. `pr-scopecards-s8b-azure-maps-travel`
 * and `pr-sec-a2-email-codes-and-reset-links` rejected only because the decorated
 * text happened to contain the words "arm only", which Marker 3 catches.
 * `pr-vendor-invoice-ocr` rejected on unrelated prose elsewhere in its body. And a
 * prompt drafted the same day, whose decorated marker read "release this line once
 * he approves it", linted PROMOTE - a human gate that stopped nothing.
 * `arm-prompt.ps1` matched none of the four.
 *
 * The cure is a shape, not a phrase: the bare marker holds the prompt, the reason
 * goes in prose underneath, and rewording the reason can no longer release it.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkHumanGate } from "../lint-prompt.mjs";

const BARE = "<!-- watcher: do-not-arm -->";

test("the bare marker is still a gate", () => {
  const r = checkHumanGate(`# Title\n\n${BARE}\n\nSome body.`);
  assert.equal(r.ok, false);
  assert.equal(r.code, "HUMAN_GATE_PRESENT");
});

test("a decorated marker is REJECTED, with its own code", () => {
  const r = checkHumanGate(
    "# Title\n\n<!-- watcher: do-not-arm | MARCO GATE: waiting on the key -->\n\nBody."
  );
  assert.equal(r.ok, false);
  assert.equal(r.code, "DECORATED_GATE_MARKER");
  assert.match(r.msg, /bare form|<!-- watcher: do-not-arm -->/);
});

test("the decorated form is rejected even when its prose carries no arming words", () => {
  // This is the exact shape that linted PROMOTE on 2026-09-25.
  const r = checkHumanGate(
    "# Title\n\n<!-- watcher: do-not-arm | MARCO GATE: release this line once he approves it. -->\n\nBody."
  );
  assert.equal(r.ok, false);
  assert.equal(r.code, "DECORATED_GATE_MARKER");
});

test("the normalised shape - bare marker plus prose reason - is a gate, not a decoration", () => {
  const r = checkHumanGate(
    `# Title\n\n${BARE}\n\n**GATE.** Waiting on the Geoapify key. Only Marco deletes the marker.\n`
  );
  assert.equal(r.ok, false);
  assert.equal(r.code, "HUMAN_GATE_PRESENT");
});

test("a prompt with no marker at all still passes", () => {
  const r = checkHumanGate("# Title\n\nAn ordinary body with no gate in it.\n");
  assert.equal(r.ok, true);
});

test("the word watcher in ordinary prose is not a marker", () => {
  const r = checkHumanGate(
    "# Title\n\nThe watcher reads this prompt from the board. Nothing here is a gate.\n"
  );
  assert.equal(r.ok, true);
});
