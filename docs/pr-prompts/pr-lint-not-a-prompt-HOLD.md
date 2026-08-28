---
premise: '! grep -q "NOT_A_PROMPT" scripts/pipeline/lint-prompt.mjs'
premise_means: >-
  lint-prompt.mjs still answers REJECT [NO_FRONT_MATTER] for station breadcrumbs, telling the reader
  a breadcrumb is a malformed prompt when it is not a prompt at all. 116 breadcrumbs sit in the queue
  carrying that label, and it is what led Station 00 to report a lint pass it never received.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/test-lint-prompt.mjs
  - scripts/pipeline/__tests__/**
done_when: >-
  grep -q "NOT_A_PROMPT" scripts/pipeline/lint-prompt.mjs && node
  scripts/pipeline/test-lint-prompt.mjs
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# `NOT_A_PROMPT` — say the true thing, keep refusing to arm

## The defect

`lint-prompt.mjs` treats every file in `docs/pr-prompts/` as a prompt. Breadcrumbs (`00-*.md`) have
no YAML front matter by convention, so all 116 of them answer:

```
REJECT  00-06-pr-master-2026-08-28-0300-....md  [NO_FRONT_MATTER]
        No YAML front-matter. See docs/pr-prompts/PROMPT-SCHEMA.md.
        Every prompt needs an EXECUTABLE premise, or nothing can tell whether it is stale.
```

That message is false. A breadcrumb is not a prompt missing its front matter; it is a different kind
of document with its own validator, `check-breadcrumb.mjs`, which enforces a five-section report
contract and which runs in CI. The wrong label is not cosmetic — Station 00's 02:08Z run reported
"breadcrumb written and ADMIT-clean" on the strength of the wrong instrument, and its 04:08Z run
retracted that as "a pass I never received".

**The refusal itself is correct and must survive.** `arm-prompt.ps1` lints the file and refuses to
arm on any non-zero exit; that is what stops a breadcrumb entering the arming queue, where
`-ready.md` and `processed/` are both gitignored and the text would never reach git at all.

## Do

Emit a distinct verdict for breadcrumbs, keep the refusal, and stop breadcrumbs from drowning a
board-wide sweep — all three, without changing any exit code that already means something.

1. **Verdict.** For a file whose basename matches `00-*.md`, return the code `NOT_A_PROMPT` instead
   of `NO_FRONT_MATTER`, with a message naming `check-breadcrumb.mjs` as the correct validator. Print
   it in every mode. `NOT_A_PROMPT` is the literal the premise and `done_when` grep for.

2. **Tally.** Add a fifth counter alongside `admitted / promoted / stale / rejected` — breadcrumbs
   are counted there, **not** in `rejected`, and the multi-file summary line reports it.

3. **Exit.** Breadcrumbs contribute to exit 1 **only in single-file mode**:

   ```js
   process.exit(
     stale > 0 && files.length === 1 ? 3
     : (rejected > 0 || (notPrompt > 0 && files.length === 1)) ? 1
     : 0
   );
   ```

   This is not a new convention. The existing line already reserves the strict code for the
   single-file case — `stale > 0 && files.length === 1 ? 3` — because a stale prompt in a sweep is
   tallied rather than turned into an actionable exit. Follow that precedent and say so in a comment.

## Why this shape

Every path that gates arming is single-file, and not by accident — arming is inherently about one
prompt. `arm-prompt.ps1` calls `@($LINT_SCRIPT, $HOLD_ABS)`; `queue-sync.ps1` passes one temp file.
So a breadcrumb still exits 1 there and arming still refuses, **with no second check in another file
that has to be kept in agreement.** Meanwhile `--all` can exit 0 when the real prompts are clean, and
a genuinely broken `pr-*` in the same sweep still drives exit 1, so breadcrumbs can never mask a real
failure.

The alternative — skipping breadcrumbs to exit 0 — was considered and rejected: it makes safety
depend on `arm-prompt.ps1` and `lint-prompt.mjs` staying in agreement across two languages, and this
pipeline's recurring failure is instruments drifting out of agreement.

## Do NOT

- Do **not** make a breadcrumb exit 0 in single-file mode. That is the whole hazard.
- Do **not** introduce a new exit code. `SCRIPT-REGISTRY.md`, `ARMING.md`, `04-scanner.md` and
  `06-pr-master.md` all document 0 / 1 / 3 and must all stay true. In particular do not reuse 3 —
  it means "already done, BIN IT", and binning a breadcrumb is exactly wrong.
- Do **not** widen the path-class beyond `00-*.md`. Exactly one non-breadcrumb file in the queue
  lacks front matter — `pr-settings-home-slice0-DISARMED-premise-dead-2026-08-18.md` — and it must
  keep answering `NO_FRONT_MATTER`.
- Do **not** touch `check-breadcrumb.mjs`. It is already the right instrument and already correct.

## Verification

Add cases to `test-lint-prompt.mjs` (or `__tests__/`) covering:

- **must REJECT** — a single `00-*.md` breadcrumb → exit 1, code `NOT_A_PROMPT`, and **not**
  `NO_FRONT_MATTER`.
- **must REJECT** — the DISARMED `pr-*` file with no front matter → exit 1, still `NO_FRONT_MATTER`.
- **must EXIT 0** — a multi-file sweep of clean `pr-*` prompts plus breadcrumbs, with the breadcrumbs
  listed as `NOT_A_PROMPT` and reported in their own tally bucket.
- **must EXIT 1** — the same sweep with one genuinely broken `pr-*` added, proving breadcrumbs cannot
  mask a real failure.
- **must EXIT 3** — a single stale prompt, unchanged, proving the existing mode-dependency did not
  regress.
- **end to end** — `arm-prompt.ps1` still refuses to arm a breadcrumb.

Then run `node scripts/pipeline/lint-prompt.mjs --all docs/pr-prompts` and confirm it exits 0 with
the breadcrumbs tallied separately.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.
