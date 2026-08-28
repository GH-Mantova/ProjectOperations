---
premise: '! grep -q "verdict-archive sweep: idle" scripts/pr-watcher/index.mjs'
premise_means: >-
  The verdict-archive sweep still logs NOTHING when the board is empty, so log silence
  cannot be told apart from a dead watcher. Dies the moment an unconditional idle line
  exists in index.mjs.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/**
  - docs/pipeline/DOCTRINE.md
done_when: 'node --check scripts/pr-watcher/index.mjs && node --test "scripts/pr-watcher/__tests__/*.mjs" && grep -q "verdict-archive sweep: idle" scripts/pr-watcher/index.mjs && grep -q "verdict-archive sweep" docs/pipeline/DOCTRINE.md'
size: 3
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# Make an idle board emit a liveness tick instead of silence

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and open the PR.**
Do not stop to ask whether you may proceed. Do not write the change and then ask for
confirmation — finishing the work and then asking permission is indistinguishable from
failing, because the work is discarded either way. If something in this prompt is
genuinely ambiguous, make the smallest reasonable choice, state it in the PR body, and
keep going. The only reasons to stop are the standing hard stops (production data,
Azure / Entra / SharePoint, `/sot/` edits, human identity).

This grant is here deliberately: on 2026-08-20 an agent on `pr-e2e-container-s2`'s
slice 1 wrote its workflow, **asked a question instead of committing**, and the artifact
was lost from all 44 branches. The gate that depended on it could never open. Do not
repeat that.

## The problem

`runArchiveSettledVerdicts()` in `scripts/pr-watcher/index.mjs` ends with a **gated** log:

```js
if (stats.archived + stats.kept + stats.skipped > 0) {
  log("review", `verdict-archive sweep: archived=... kept=... skipped=...`);
}
```

When the board is empty — zero open PRs, zero verdict files — all three counters are `0`
and the sweep prints **nothing at all**. The log therefore goes completely quiet, and a
reader cannot distinguish:

- "the board is empty and the watcher is healthy and idle", from
- "the watcher is dead or frozen".

This is not hypothetical. The board emptied at 2026-08-25T07:01Z and the log went mute
within the same rescan. Two separate write-ups have had to warn readers not to read that
silence as a death.

## The fix — additive, no behaviour change

Give the `else` branch a voice. An idle sweep must say so, on the same cadence, with a
stable greppable marker:

```js
if (stats.archived + stats.kept + stats.skipped > 0) {
  log(
    "review",
    `verdict-archive sweep: archived=${stats.archived} kept=${stats.kept} skipped=${stats.skipped}`,
  );
} else {
  log("review", "verdict-archive sweep: idle - 0 verdict files, watcher alive");
}
```

The exact substring **`verdict-archive sweep: idle`** is load-bearing: the premise and
`done_when` both grep for it, and future liveness probes will too. Do not reword it.

Nothing else about the sweep changes. It stays best-effort, it still swallows its own
errors, and it must still never throw into the caller or stall the rescan loop.

## Also required

1. **A test** in `scripts/pr-watcher/__tests__/` (new file, or extend an existing suite)
   that drives the sweep with an empty reviews directory and asserts the idle line is
   logged exactly once. The existing suites are pure Node with no external deps — keep it
   that way. CI runs them with the load-bearing quoted glob:
   `node --test "scripts/pr-watcher/__tests__/*.mjs"`.

2. **A DOCTRINE entry.** In `docs/pipeline/DOCTRINE.md`, in the section that names the
   specific ways an instrument lies (§9), add the verdict-archive sweep: state that before
   this change its silence was ambiguous, that it now emits
   `verdict-archive sweep: idle` when the board is empty, and that the **authoritative**
   freeze probe remains the `ts` field inside `.queue-state.json` — sampled twice, more
   than five minutes apart, looking for a GAP against `RESCAN_INTERVAL_MS`. A log line
   proves a code path ran; only the GAP catches a freeze.

## Do NOT

- **Do NOT** change `RESCAN_INTERVAL_MS`, the rescan loop, or `writeQueueState()`. The
  queue-state write is already unconditional and is the real liveness probe. This prompt
  makes the *log* honest; it does not touch the probe.
- **Do NOT** promote the log line into a liveness check anywhere in code. It is for humans
  reading the log.
- **Do NOT** touch `docs/qa/` — it is gitignored (`.gitignore:107`) and swallows findings.
- **Do NOT** edit anything under `/sot/`. CI gate CP-24 hard-fails any PR mixing `sot/`
  with `scripts/`, and only Station 05 edits source of truth.
- **Do NOT** "fix" the 16 × `Date.now()` freeze-blind deadlines in `index.mjs` here. That
  is a real defect and a separate slice — mention it in the PR body if you like, but keep
  this diff to the sweep, its test, and the DOCTRINE entry.

## Verification to put in the PR body

- The exact `node --test "scripts/pr-watcher/__tests__/*.mjs"` output, showing your new
  test passing alongside the existing suites.
- Evidence of **both** branches: the counted line still appears when verdicts exist, and
  the idle line appears when they do not. A test that only exercises the new branch does
  not prove you left the old one intact.
