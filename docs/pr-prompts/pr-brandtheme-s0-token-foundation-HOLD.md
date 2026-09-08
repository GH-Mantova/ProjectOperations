---
premise: 'test "$(grep -c -- "--surface-page: #17181C" apps/web/src/styles/tokens.css)" = "2"'
premise_means: >-
  The dark palette is still declared TWICE in tokens.css, so every token a later slice adds must be
  written twice and kept in sync by hand. MEASURED 2026-09-08 on origin/main: the file is 379 lines;
  `:root[data-theme="dark"]` opens at :42 and declares 14 custom properties plus `color-scheme: dark`;
  `@media (prefers-color-scheme: dark)` opens at :60 and its `:root:not([data-theme="light"])` block
  repeats all 14 verbatim. `grep -c "prefers-color-scheme: dark"` returns 2 and
  `grep -c -- "--surface-page: #17181C"` returns 2. The premise counts the VALUE, not the media query,
  because the media query must survive this slice - only the duplication dies.
module: settings
design_ref: https://claude.ai/code/artifact/330c3e98-e1ae-4120-899b-66960785a112?org=6662b30d-93fe-4547-a980-49cefee195e7
scope:
  - apps/web/src/styles/tokens.css
done_when: >-
  test "$(grep -c -- "#17181C" apps/web/src/styles/tokens.css)" = "1" && grep -q
  "prefers-color-scheme: dark" apps/web/src/styles/tokens.css && pnpm --filter web build
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Brand & theme S0: declare each dark token once, so the slices after it are not written twice

This is the slice `docs/plans/theme-system-plan.md` SECTION 3 calls **SLICE 1 - Token foundation**,
and SECTION 7 names as *"a genuine prerequisite for S3 and S5"*. It had no prompt until now.

## Read this before anything else: there are TWO things called "slice 1"

`theme-system-plan.md` SECTION 3 has a **SLICE 1 - Token foundation** (this work). SECTION 7's
build chain has an **S1 - the application path**, which is a different slice and already has a
prompt: `pr-brandtheme-s1-apply-the-saved-scheme-HOLD.md`. They are unrelated and touch no common
file. This prompt is numbered **s0** purely so the two names cannot collide in the queue; it is not
a claim about ordering against S1, and neither gates the other.

## The defect, stated plainly

`apps/web/src/styles/tokens.css` declares the dark palette twice:

- `:root[data-theme="dark"]` at **:42** - 14 custom properties plus `color-scheme: dark`
- `@media (prefers-color-scheme: dark) > :root:not([data-theme="light"])` at **:60** - the same 14,
  byte-for-byte

Both blocks are correct and both are needed: the first serves an explicit choice, the second serves
"system" when the OS reports dark. What is wrong is that the **values** live in two places. Every
colour S3 adds and every density token S5 adds would have to be typed twice and kept in step by
hand, forever, with nothing checking that they match.

## What to do

Declare each dark VALUE exactly once and have both selectors reference it. The straightforward
form, and the one this prompt expects:

    :root {
      /* ... existing light tokens, untouched ... */

      /* Dark palette constants. Declared once; applied by the two selectors below.
         These are values, not active tokens - nothing reads them directly. */
      --dark-surface-page: #17181C;
      --dark-surface-card: #22242A;
      /* ... one per dark token ... */
    }

    :root[data-theme="dark"] {
      --surface-page: var(--dark-surface-page);
      --surface-card: var(--dark-surface-card);
      /* ... */
      color-scheme: dark;
    }

    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --surface-page: var(--dark-surface-page);
        --surface-card: var(--dark-surface-card);
        /* ... */
        color-scheme: dark;
      }
    }

The assignment lines still appear twice - CSS has no include and that is unavoidable - but each
**hex literal appears once**, which is the property the plan actually needs and the property
`done_when` asserts. If you find a cleaner form that also leaves each literal declared once and
both selectors working, take it and say so in the PR body.

## Zero visual change. That is the acceptance bar.

Every computed value must be identical before and after, in all three states: explicit light,
explicit dark, and system-with-no-preference under both OS settings. This slice exists to make the
next two slices possible, not to change anything a user can see. **If a colour moves, the slice is
wrong**, however green CI is.

## TRAP 1 - `color-scheme` is not a custom property

`color-scheme: dark` is a real CSS property, not a `--token`. It cannot be hoisted into `:root` as a
constant and referenced with `var()` the way the colours can - putting `color-scheme: dark` on
`:root` would make the whole app report dark to the UA. Leave that one line duplicated in both
selectors. It is the one legitimate repeat, and the PR body should say so rather than leaving a
reviewer to wonder whether it was missed.

## TRAP 2 - the shadows are not colours and the greps will mislead you

Two of the fourteen are shadow strings containing `rgba(0,0,0,0.55)`:

    --shadow-card: 0 1px 3px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.35);
    --shadow-dropdown: 0 6px 20px rgba(0,0,0,0.55);

They hoist exactly like the colours do. Do not skip them because they are not hex - "declared once"
means all fourteen, and a slice that leaves two behind has not removed the sync burden, only most
of it.

## TRAP 3 - do not touch the light block, and do not renumber anything

The `:root` light block at :1-36 is correct. You are ADDING dark constants to it, not editing the
tokens already there. `--brand-primary`, `--brand-accent` and the rest keep their values; S1 of the
build chain overrides those two at runtime and depends on their tokens.css values being the
fallback.

## Deliberately NOT in this slice: the density tokens

SECTION 3's SLICE 1 text also says "add density tokens (spacing, row height, control height)". They
are **not** in this slice. S5 of the SECTION 7 chain is *"Density (compact / comfortable) as tokens
plus a control"*, and splitting the tokens from the control across two prompts means two slices edit
the same region of the same file for one feature. S5 owns density end to end. This is a deliberate
deviation from SECTION 3 and belongs in the PR body as such.

## Verify by looking

Screenshot the shell in explicit light and explicit dark before and after. They must be
indistinguishable. A build passing proves the CSS parses; it does not prove a value survived.

## Findings for Marco - report, do not act

1. **This slice had no prompt for 22 days** while SECTION 7 named it a prerequisite for two other
   slices. It was found on 2026-09-08 by a chain-gap scan, not by the queue.
2. **The hex-baseline ratchet interacts with this slice favourably.** Removing 14 duplicate literals
   lowers `tokens.css`'s count in `docs/qa/hex-baseline.json`, and the ratchet permits a fall. Do not
   hand-edit the baseline; if CI asks for a regenerated baseline, say so in the PR body.

## A note on `module: settings` - it is the nearest true home, not an exact one

MEASURED 2026-09-08: `lint-prompt.mjs` builds its module vocabulary from the directory names under
`apps/api/src/modules/` and `apps/web/src/pages/`, plus the fixed pipeline destinations
(`prisma`, `watcher`, `pipeline`, `ci`, `e2e`, `sot`, `board`, `docs`). **Nothing maps
`apps/web/src/styles/`, `apps/web/src/lib/` or `apps/web/src/components/` to a module**, so a web
slice that touches only those paths derives nothing and REJECTs `MODULE_AMBIGUOUS`.

`settings` is used here because the theme builder and the density control live in Settings, which
makes it the most truthful label the vocabulary offers - not because this slice edits a settings
page. Do not "fix" this by widening `scope` to a settings directory the slice does not touch.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". There is no human in this run. **Finishing the work and then asking for
> permission is indistinguishable from failing** - the work is discarded either way.
