---
premise: '! grep -q "design_ref" scripts/pipeline/lint-prompt.mjs'
premise_means: >-
  Nothing links a PR to the mock-up it was built from. Marco designs a screen in an artifact,
  asks for the PR, then checks the result against that artifact by memory - and no machine holds
  the pair. Measured 2026-09-03: design_ref appears nowhere on origin/main (the only grep hit is
  an unrelated mix_design_ref seed field), and lint-prompt.mjs rejects unrecognised frontmatter
  with UNKNOWN_KEY, so a convention alone cannot work - the key has to be taught to the linter.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/__tests__/lint-prompt.design-ref.test.mjs
  - docs/pr-prompts/PROMPT-SCHEMA.md
done_when: >-
  grep -q "design_ref" scripts/pipeline/lint-prompt.mjs && grep -q "design_ref" docs/pr-prompts/PROMPT-SCHEMA.md && node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/PROMPT-SCHEMA.md; true
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# VS-S3: a UI prompt must name the design it came from

**Grounded against `origin/main` = `f5c01415`, measured 2026-09-03.**

The workflow this serves, in Marco's words: he designs in an artifact or mock-up, has Station 06
turn it into a PR, then uses that same artifact to check whether the PR landed as he wanted. Today
that link lives only in his head, so a reviewer cannot find the design, and the vision review
(VS-S1) has to judge against whatever prose the PR body happens to contain.

## Do

1. **Add an optional `design_ref` frontmatter key** to `lint-prompt.mjs`'s recognised key set, so
   it stops rejecting it as `UNKNOWN_KEY`. Accept either shape, as a single-line string:
   - an artifact URL - `https://claude.ai/code/artifact/<uuid>`;
   - a repo-relative path under `Claude Design/` - e.g. `Claude Design/proposed/scope-card-v3.html`.
   Reject anything else with a new named code **`DESIGN_REF_MALFORMED`**, and say which of the two
   shapes was expected. A key that silently accepts junk is worse than no key.
2. **Require it when the prompt is UI work.** If any `scope` entry begins `apps/web/`, a missing or
   empty `design_ref` is a rejection with a new named code **`UI_PROMPT_NEEDS_DESIGN_REF`**. The
   message must say what to do: cite the artifact URL or the `Claude Design/` path the screen was
   drawn from.
   **One deliberate exception:** if the prompt also carries `fixes_pr:`, do not require it. A
   fix-forward on a red board must never be blocked for want of a design citation.
3. **Do NOT validate that the target exists.** An artifact URL is not reachable from CI, and a
   `Claude Design/` path is gitignored - `git cat-file` would fail on a file that is genuinely
   there. Shape only. Say so in a comment beside the check, or the next reader will "fix" it into a
   gate that fails on every correct prompt.
4. **Extend `PROMPT-SCHEMA.md`** with a `design_ref` section in the existing style: what it is, the
   two accepted shapes, when it is required, the `fixes_pr` exception, why existence is not checked,
   and the two new rejection codes added to the codes table.
5. **Tests, in the existing spec's style** - accepts both shapes; rejects a malformed value with
   `DESIGN_REF_MALFORMED`; rejects an `apps/web/` prompt with no `design_ref` with
   `UI_PROMPT_NEEDS_DESIGN_REF`; accepts an `apps/web/` prompt that carries `fixes_pr`; and accepts
   a non-web prompt with no `design_ref` at all.

## Do NOT

- Do NOT make `design_ref` mandatory outside `apps/web/`. Most of this queue is pipeline and API
  work with no design to cite, and a key that is usually irrelevant gets filled with noise to pass
  the linter.
- Do NOT fetch the URL, at lint time or ever.
- Do NOT retrofit `design_ref` onto existing prompts in this slice. Every `-HOLD` already in the
  queue would fail the linter at once and the board would stop. Retrofitting is its own decision.
- Do NOT touch `sot/`.

## Verify

- `node scripts/pipeline/lint-prompt.mjs <a prompt with a valid artifact-URL design_ref>` -> ADMIT.
- Same with a `Claude Design/...` path -> ADMIT.
- A malformed value -> REJECT `DESIGN_REF_MALFORMED`.
- A prompt whose scope contains `apps/web/src/...` and no `design_ref` -> REJECT
  `UI_PROMPT_NEEDS_DESIGN_REF`.
- The same prompt plus `fixes_pr: 1234` -> ADMIT.
- **Regression control, and the one that matters most:** re-lint every prompt currently at the root
  of `docs/pr-prompts/` and confirm the ADMIT/REJECT verdict of each is **unchanged** from before
  this slice. Capture the before-list first. A linter change that silently re-verdicts 71 held
  prompts is a board outage.
- **Both existing lint-prompt suites still pass**, unchanged:
  `scripts/pipeline/__tests__/lint-prompt.file-gate-not-released.test.mjs`,
  `scripts/pipeline/__tests__/lint-prompt.human-gate.test.mjs`, and the standalone
  `scripts/pipeline/test-lint-prompt.mjs`. Follow their file-naming convention for the new suite -
  `lint-prompt.<topic>.test.mjs` - rather than inventing a different one.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
