---
premise: '! test -f docs/qa/hex-baseline.json'
premise_means: >-
  There is no gate stopping new hard-coded colour literals entering apps/web/src, and the count is
  rising. MEASURED 2026-09-01 with one instrument run against two commits, tracked files only:
  at aaa2213 (2026-08-18) apps/web/src held 3,792 hex literals across 228 files; at origin/main
  (2026-09-01) it holds 4,339 across 248 files. That is +547 literals and +20 files in fourteen
  days, roughly 39 new literals per day. `sot/01` SECTION 5 already mandates "Always use CSS
  variables - never hardcode colour values"; the codebase violates that rule 4,339 times and there
  is no check anywhere in .github/workflows/ci.yml that counts them.
scope:
  - scripts/pipeline/check-hex-ratchet.mjs
  - scripts/pipeline/__tests__/check-hex-ratchet.test.mjs
  - docs/qa/hex-baseline.json
  - .github/workflows/ci.yml
done_when: >-
  node scripts/pipeline/check-hex-ratchet.mjs --self-test && test -f docs/qa/hex-baseline.json &&
  grep -q "check-hex-ratchet" .github/workflows/ci.yml
size: 4
gate_allow: none
seed_only: false
escalates: true
backfill: false
---

# Brand & theme S2: stop the hard-coded colours growing, without a migration campaign

This slice adds one CI gate and one baseline file. It changes no application code and no styling.

## Why a ratchet and not the migration campaign that is already planned

`docs/plans/theme-system-plan.md` is on main and registered as decision **D24** in `sot/05`. It
prescribes SLICES 5-15: replace every hard-coded hex, area by area, ten files at a time, with
before/after screenshots per slice.

**That campaign cannot converge as written.** MEASURED with a single instrument run against both
commits, tracked files only:

| Area | 2026-08-18 (aaa2213) | 2026-09-01 (origin/main) | Change |
|---|---|---|---|
| **total** | **3,792 lit / 228 files** | **4,339 lit / 248 files** | **+547 / +20** |
| pages/crm | 296 lit / 11 files | 624 lit / 19 files | **+328 / +8** |
| pages/tendering | 372 lit / 34 files | 397 lit / 38 files | +25 / +4 |
| pages/forms | 360 lit / 12 files | 380 lit / 14 files | +20 / +2 |
| pages/admin | 258 lit / 16 files | 300 lit / 17 files | +42 / +1 |
| pages/field | 199 lit / 11 files | 199 lit / 11 files | 0 |
| styles.css | 788 lit / 1 file | 788 lit / 1 file | 0 |

Three things follow, and each is measured rather than argued:

1. **The debt grows at ~39 literals a day.** The plan proposes retiring ~3,800 across eleven
   serialised slices, each needing an arming, a build, a review and four screenshots. The board
   merges one PR at a time with `strict_required_status_checks_policy = true`, so every merge puts
   the remaining slices behind. The campaign cannot outrun its own target.

2. **The plan's slice scopes are already stale.** SLICE 12 is written as "CRM (10 files, 267
   literals)". CRM is now 19 files and 624 literals - over the linter's `size > 10` cap, so that
   slice cannot be armed at all without being rewritten and split.

3. **The growth is concentrated exactly where work is happening.** CRM more than doubled in
   fourteen days. `pages/crm`, `pages/tendering` and `pages/admin` are where the CRM and Estimating
   lanes are actively building. A migration slice there would collide head-on with the lane that is
   producing the literals, and the conflict would be resolved by whoever merged last.

Meanwhile `pages/field` moved by exactly zero - the area the plan marked CONDITIONAL and never
armed. Untouched areas do not rot. **The problem is not the backlog; it is the inflow.**

A ratchet costs no migration, cannot conflict with any lane (it adds no line to any file a lane
edits), stops the growth on the day it merges, and lets each lane retire its own debt whenever it
happens to open one of these files. It is the complete and additive fix.

## Mirror the ratchet that already works here

`scripts/pipeline/check-sot-baseline-ratchet.mjs` is the pattern. Read it before writing this one.
It carries two lessons paid for in a rejected PR, and both apply directly:

- **Its key deliberately excludes the volatile field.** The sot ratchet excludes `line`, because
  editing a sot/ file shifts every line below it, and burning an entry down REQUIRES editing sot/.
  Measured on PR #1405: a burn-down taking the baseline 23 -> 13 was REJECTED because one
  byte-identical entry was re-emitted at a different array position. The gate fired hardest on
  exactly the work it existed to encourage.

  **The equivalent trap here is line and column position.** Never key on where a literal sits.
  Key on `path -> count`. Moving a component within a file, reformatting, or extracting a helper
  changes every position and no counts.

- **It self-tests on every invocation, with fail-cases as well as pass-cases**, and exits 2 for a
  broken instrument so a crash is never a silent pass. Do the same. A ratchet that cannot fail is
  decoration, and a ratchet everyone routes around within a month is worse than none.

## The counter - get this right or the gate is noise

Count matches of `#` followed by 3, 4, 6 or 8 hex digits at a word boundary, in tracked
`.ts` / `.tsx` / `.css` files under `apps/web/src`.

MEASURED justifications for each rule, so none of this is guesswork:

- **3/4/6/8 only.** Of 4,339 total matches for `{3,8}` digits, exactly **3** have 5 or 7 digits -
  lengths that cannot be a CSS colour. Restricting to valid colour lengths drops 3 false positives
  and nothing else.
- **Exclude `&#`.** `grep -roE "&#[0-9]+" apps/web/src` returns **12** hits - HTML entities such as
  `&#160;`. A three-digit decimal entity matches the colour pattern. Require that the character
  before `#` is not `&`.
- **Do not exclude comments.** A hex in a comment is a colour someone will copy. Counting it costs
  nothing and keeping the counter simple keeps it trustworthy.
- **Do not exclude `tokens.css`.** It is the one file where hex literals are correct, and its count
  is simply baselined like any other. Special cases are how a gate acquires a hole.

Sanity-check your counter against these MEASURED figures before generating the baseline. If your
run disagrees with these, your counter is wrong - **do not adjust the baseline to match a counter
you have not verified**:

- total, origin/main: **4,339** literals across **248** files
- `pages/crm`: **624** across 19 files
- `apps/web/src/styles.css`: **788** in that one file
- three-digit greys are the bulk of short matches: `#fff` 381, `#666` 77, `#ccc` 54, `#888` 31

## The rule the gate enforces

Given base and head baselines, both maps of `path -> count`:

1. **No file's count may increase.** Report every file that grew, with `before -> after`.
2. **A file absent from the base baseline must have a count of 0.** New files start clean. This is
   the rule that actually turns the curve - without it the +20 new files of the last fortnight
   would all have been waved through.
3. **A file whose count decreased, or which was deleted, is fine.** Removals are always allowed.
4. **The total is not checked.** Per-file is strictly stronger and gives a usable error message.

The baseline file is regenerated by the author of a burn-down PR, in the same PR that removes the
literals - exactly as Station 05 burns down sot refs.

## Self-test cases - fail-cases are the point

Include at minimum, and assert the expected verdict for each:

- unchanged baseline -> **pass**
- a file's count drops 40 -> 12 -> **pass**
- a file is deleted entirely -> **pass**
- a file's count rises 12 -> 13 -> **fail**, naming the file and `12 -> 13`
- a NEW file with count 1 -> **fail**
- a NEW file with count 0 -> **pass**
- baseline JSON that will not parse -> **exit 2**, never exit 0

The four fail-cases are what make this gate real. A self-test with only pass-cases proves nothing;
that is DOCTRINE section 7 guard 1.

## CI wiring - copy the guard, it matters

Add the step next to the sot-refs ratchet at `.github/workflows/ci.yml:208`. Reproduce its base-ref
guard exactly:

    if ! git show "origin/${{ github.base_ref }}:docs/qa/hex-baseline.json" > /dev/null 2>&1; then
      echo "hex-baseline.json is new on this PR - ratchet skipped (creation is allowed)"
      exit 0
    fi

Without it, **this very PR fails its own gate**, because the baseline it creates does not exist on
the base branch. Gate the step on `if: github.event_name == 'pull_request'` for the same reason
the sot-refs step is.

Write the baseline's `_readme` in the style of `docs/qa/sot-refs-baseline.json`: what it is, that
it may only shrink, who burns it down, and the measured date and commit.

## Do not do these things

- **Do not remove a single hex literal in this PR.** Zero application files are in scope. A
  ratchet PR that also migrates cannot be reviewed, and if it conflicts with a lane the gate goes
  down with it.
- **Do not edit `docs/plans/theme-system-plan.md`.** It is the artefact of a registered decision.
- **Do not edit anything under `sot/`.** CP-24 hard-fails any PR mixing code and `sot/`, and
  amending a registered decision is Marco's, not a sub-agent's. See the escalation below.
- **Do not exempt directories.** `drafts/`, `personas/` and `portal/` all carry literals and all get
  baselined like everything else.
- **Do not make the gate warn-only.** `pr-dns-s4-checker-warn-only-HOLD.md` was superseded by
  `pr-dns-s5-checker-flip-to-fail-HOLD.md`, which is still sitting unarmed on the board. A gate
  shipped as a warning is a gate that needs a second arming to become real, and this board has one
  of those waiting already.

## ESCALATED - for Marco, not for the agent building this

**Decision D24 in `sot/05` needs amending, and only Marco can arm that.**

D24 is REGISTERED and points at `docs/plans/theme-system-plan.md:4` - theme sequencing "option C,
token cleanup on the most-used screens first". This slice does not execute that campaign, and the
measurements above say the campaign cannot be executed as written: its CRM slice is 2.3x its
recorded size and over the linter's size cap, and the total it targets grew 14% while it sat
unarmed.

Nothing in `theme-system-plan.md` has shipped in the fifteen days since it was written. Its own
premises still hold verbatim: `grep -c "prefers-color-scheme: dark" tokens.css` returns 2,
`ThemePicker.tsx` does not exist, `data-theme="initial"` is absent, `DensityControl.tsx` does not
exist, and there are no density tokens.

The recommendation is that the plan's SLICE 17 sequencing rule - "must not be armed until every
cleanup slice 5-13 has merged" - is replaced by this ratchet plus opportunistic conversion, so the
picker is not held hostage to a campaign that cannot finish. `theme-system-plan.md` itself already
logs a related open decision: a `sot/01` SECTION 5 doc-reconcile adding the enforcement reference,
"outside the scope of any code-writer agent (CP-24); Marco arms it manually." This ratchet IS that
enforcement. The two reconciles should be armed together.

**This PR does not touch `sot/` and does not assume the amendment.** The gate is correct and useful
whether or not D24 changes; the escalation is so the register does not quietly diverge from what
the repo actually does.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

