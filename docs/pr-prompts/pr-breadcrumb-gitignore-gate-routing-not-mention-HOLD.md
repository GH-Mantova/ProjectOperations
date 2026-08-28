---
premise: '! grep -q "ROUTING_VERBS" scripts/pipeline/check-breadcrumb.mjs'
premise_means: >-
  The gitignored-sink gate in check-breadcrumb.mjs still fires on any MENTION of docs/qa/qa-findings.md
  or docs/qa/qa-checklist.md whose text lacks the word "gitignor" within a +/-200 character window. It
  has no notion of a routing destination, so a breadcrumb that merely DISCUSSES a gitignored path is
  rejected as if it had reported into one.
scope:
  - scripts/pipeline/check-breadcrumb.mjs
  - scripts/pipeline/__tests__/**
  - docs/pr-prompts/00-04-scanner-2026-08-27-0617-instruction-drift-lint-station-only-sees-backticked-paths.md
done_when: >-
  grep -q "ROUTING_VERBS" scripts/pipeline/check-breadcrumb.mjs && node
  scripts/pipeline/check-breadcrumb.mjs --freshness
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: pipeline-instruments
cluster_order: 1
---

# Breadcrumb gitignore gate: test the ROUTING DESTINATION, not the mention

## The defect, measured

`scripts/pipeline/check-breadcrumb.mjs:80-90` implements "never route findings into a gitignored
channel" as a **literal substring scan with a proximity escape hatch**:

```js
// never route findings into a gitignored channel
for (const bad of ['docs/qa/qa-findings.md', 'docs/qa/qa-checklist.md']) {
  ...
  if (!/gitignor/i.test(text.slice(Math.max(0, i - 200), i + 200))) {
    fails.push(`line ${...}: routes findings to \`${bad}\`, which is gitignored`);
  }
}
```

It fires on **any** occurrence of the path. The only way to pass is to happen to write the word
"gitignor" within 200 characters of it.

**Measured false positive, 2026-08-28 06:2xZ**, on
`docs/pr-prompts/00-04-scanner-2026-08-27-0617-instruction-drift-lint-station-only-sees-backticked-paths.md`:

- Line 158-159 mentions `docs/qa/qa-checklist.md` and says "and it is gitignored (`.gitignore:106`)"
  ~45 characters later. **Passes.**
- Line 162 mentions the same path again — "becomes urgent the first time a scanner runs where
  `docs/qa/qa-checklist.md` is absent" — and the nearest "gitignored" is ~250 characters back, just
  outside the window. **Fails.**

The breadcrumb is *reporting that a station doc has a dead fallback into a gitignored file*. That is
exactly the class of finding the gate exists to encourage, and the gate rejects it. The rejection is
not cosmetic: `check-breadcrumb.mjs` runs in CI, so one such breadcrumb reddens the Pipeline check
board-wide and the report cannot be landed at all.

**Positive control that the gate still works at all:** it correctly ADMITs 71 other breadcrumbs,
several of which mention `docs/qa/` in passing with "gitignored" nearby. The gate is not dead — it is
imprecise.

## Do

1. Replace the proximity window with a **destination test**. A finding is routed into a gitignored
   channel only when the path appears as the object of a routing construction. Introduce a named
   constant `ROUTING_VERBS` (the marker the premise and `done_when` grep for) holding the verb set,
   and require a match within a short lookbehind of the path — e.g.

   ```js
   const ROUTING_VERBS = /(write|writes|written|wrote|report|reports|reported|route|routes|routed|log|logs|logged|append|appends|appended|record|records|recorded|output|outputs|save|saves|saved|put|puts|file|files|filed)\s+(?:it\s+|them\s+|this\s+|findings?\s+|the\s+\w+\s+)?(?:to|into|in|at|under)\s*$/i;
   ```

   applied to the ~80 characters immediately preceding the path occurrence. Keep the check
   case-insensitive and keep scanning every occurrence, not just the first.

2. **Keep the existing escape hatch as an OR, do not remove it.** A line that says the path is
   gitignored still passes even if a routing verb happens to precede it. This is the additive half:
   nothing that passes today may start failing.

3. Fail with the same message shape and the same `line N:` prefix; only the trigger changes.

4. Add unit tests under `scripts/pipeline/__tests__/` covering, at minimum:
   - **must FAIL** — `Findings are written to docs/qa/qa-findings.md.` (routing, no gitignore note)
   - **must FAIL** — `Report it into docs/qa/qa-checklist.md and move on.`
   - **must PASS** — `becomes urgent the first time a scanner runs where docs/qa/qa-checklist.md is absent`
     (the measured false positive above, quoted verbatim from the 0617 breadcrumb)
   - **must PASS** — the existing "…and it is gitignored (`.gitignore:106`)" form (escape hatch intact)

5. Re-run `node scripts/pipeline/check-breadcrumb.mjs --freshness` and confirm it reports
   **0 malformed** with the 0617 breadcrumb present in `docs/pr-prompts/`.

## Do NOT

- Do **not** widen the 200-character window. That relocates the false positive rather than removing
  it, and the next breadcrumb that discusses a gitignored path at length hits it again.
- Do **not** add a per-file opt-out marker or an allow-list of filenames. The gate must stay
  content-driven; an allow-list rots the moment a new breadcrumb is written.
- Do **not** edit the 0617 breadcrumb's prose to dodge the checker. Its text is a factual finding and
  is correct as written; the instrument is what is wrong. Staging it unchanged is how we prove the
  fix.
- Do **not** touch any other check in `check-breadcrumb.mjs` (section order, filename case, front
  matter, freshness). Scope is the gitignored-sink gate only.

## Why this is the complete-and-additive option (RULE 1)

- **Immediate:** the one rejected breadcrumb lands, and CI goes green with it in the tree.
- **Future:** every later report that *discusses* a gitignored path — which is a thing stations are
  supposed to do — stops being punished for it, without loosening the real rule.
- **No data-entry damage:** the gate keeps failing every genuine "I reported into `docs/qa/`" case,
  which is the failure that cost nine days of unread findings. The tests in step 4 pin that.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.
