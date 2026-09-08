---
premise: 'grep -q "token cleanup on the most-used screens first" sot/05-decisions-and-lessons.md'
premise_means: >-
  D24 in sot/05 still records theme sequencing as "option C - token cleanup on the most-used screens
  first", and docs/plans/theme-system-plan.md SECTION 5 still gates SLICE 17 (the entire visible
  theme surface) behind cleanup SLICES 5-13. MEASURED 2026-09-01 on origin/main at 755255ab:
  sot/05-decisions-and-lessons.md:290 carries that row, and the plan has shipped NOTHING in the
  fifteen days since it was written - grep -c "prefers-color-scheme: dark" tokens.css returns 2
  (SLICE 1 undone), ThemePicker.tsx absent (SLICE 2), data-theme="initial" absent (SLICE 3),
  DensityControl.tsx absent (SLICE 4). Over those same fifteen days the hex-literal count the plan
  exists to retire GREW from 3,792 across 228 files to 4,339 across 248 files. Marco confirmed on
  2026-09-01 that he wants the whole approved theme-builder mockup built; as written, the register
  gates that work behind a campaign that is losing ground.
scope:
  - sot/05-decisions-and-lessons.md
  - docs/plans/theme-system-plan.md
done_when: >-
  pnpm lint && ! grep -q "token cleanup on the most-used screens first"
  sot/05-decisions-and-lessons.md && grep -q "amended 2026-09-01"
  sot/05-decisions-and-lessons.md && grep -q "hex-baseline ratchet"
  docs/plans/theme-system-plan.md && [ "$(grep -vc $'\r$' sot/05-decisions-and-lessons.md)" = "0" ]
  && [ "$(grep -vc $'\r$' docs/plans/theme-system-plan.md)" = "0" ]
size: 2
gate_allow: none
seed_only: false
escalates: true
backfill: false
---

# Doc-reconcile D24: theme sequencing is gated on the ratchet, not on a cleanup campaign

Branch: `docs/sot-05-d24-theme-sequencing-2026-09-01`. New PR.
**SoT governance doc - Marco reviews the rendered diff. Do NOT auto-merge.**

## Standing rule

A doc-reconcile PR touches **only** `sot/` and `docs/`. Nothing else. CP-24 (`sot-purity`) enforces
this - RE-VERIFIED today at `scripts/pr-gates/pr-gates.mjs:327`:

    const codeRe = /^(?:apps\/|scripts\/|\.github\/|packages\/|package\.json$|pnpm-lock\.yaml$)/;

`docs/` is **not** in that pattern, so `sot/` + `docs/` in one PR is permitted. **This PR touches
exactly two files and no others.** No code, no scripts, no workflows, no schema.

## Why this PR exists

Marco asked on 2026-09-01 for the whole approved theme-builder mockup to be built. The register as
written blocks that, and the block is not a judgement call - it is a sequencing rule that has been
overtaken by measurement.

`docs/plans/theme-system-plan.md` SECTION 5 says SLICE 17 - which mounts the theme picker, the
density control and the per-user override, i.e. the entire surface Marco approved - "must not be
armed until every non-conditional cleanup slice (SLICES 5-13) has merged to main". Those slices
retire roughly 3,800 hard-coded hex literals, ten files at a time, each with four screenshots.

MEASURED on origin/main at 755255ab, one instrument run against two commits, tracked files only:

| Area | 2026-08-18 (aaa2213) | 2026-09-01 (755255ab) | Change |
|---|---|---|---|
| **total** | **3,792 literals / 228 files** | **4,339 literals / 248 files** | **+547 / +20** |
| pages/crm | 296 / 11 | 624 / 19 | **+328 / +8** |
| pages/tendering | 372 / 34 | 397 / 38 | +25 / +4 |
| pages/forms | 360 / 12 | 380 / 14 | +20 / +2 |
| pages/admin | 258 / 16 | 300 / 17 | +42 / +1 |
| pages/field | 199 / 11 | 199 / 11 | 0 |

Three consequences, each measured rather than argued:

1. The debt grows about **39 literals a day** while the campaign sits unarmed. The board merges one
   PR at a time under `strict_required_status_checks_policy = true`.
2. **SLICE 12 can no longer be armed at all.** It is written as "CRM (10 files, 267 literals)". CRM
   is now 19 files and 624 literals, over the prompt linter's `size > 10` cap.
3. The growth is concentrated in `pages/crm`, `pages/tendering` and `pages/admin` - the areas the
   CRM and Estimating lanes are actively building in. `pages/field`, the area marked CONDITIONAL
   and never armed, moved by exactly zero. **Untouched areas do not rot; the problem is the inflow,
   not the backlog.**

The plan's own SECTION 6 already logs the fix as an open decision: a `sot/01` SECTION 5
doc-reconcile adding a lint rule to enforce "never hardcode colour values", noted as "outside the
scope of any code-writer agent (CP-24); Marco arms it manually." The hex-baseline ratchet staged as
`pr-brandtheme-s2-hex-ratchet` IS that enforcement.

## Target SoT file(s)

- `sot/05-decisions-and-lessons.md` - the **D24 row** in the decisions table (line 290 on
  755255ab; locate it by its D24 cell, not by line number).
- `docs/plans/theme-system-plan.md` - SECTION 5 replaced, a status banner added to SECTION 3, and
  a new SECTION 7 recording the chain that replaces SLICES 5-17.

## TRAP - both files are CRLF, and a naive replace will match ZERO times

MEASURED 2026-09-01 on origin/main at 755255ab:

    sot/05-decisions-and-lessons.md    788 CRLF lines, 0 LF-only lines
    docs/plans/theme-system-plan.md    339 CRLF lines, 0 LF-only lines

Every line in both files ends `\r\n`. A multi-line search string written with `\n` endings - which
is what you get from pasting the "current text" blocks below into a Python or node replace - will
match **nothing**, silently, and the edit will appear to succeed while changing zero bytes. I hit
exactly this while verifying the anchors for this prompt: a `grep` with a `$` anchor returned 0
matches on a line that is present.

Two rules, both mandatory:

1. **Match line-ending agnostically.** Anchor on a single distinctive substring within one line -
   for the D24 row, the literal `| D24 |` - then replace that whole line. Do not build a multi-line
   search string.
2. **Preserve CRLF on write.** If you read, modify and rewrite either file, the output must still be
   100% CRLF. Re-check after writing:
   `grep -vc $'\r$' <file>` must still return **0** - that is, no line may end without a CR. That
   is the property, and it does not go stale if another station edits the file before this prompt is
   armed; a fixed line count would. `done_when` asserts it for both files. A one-row change that
   produces a 788-line diff means you converted the file to LF - revert and redo it.

This is DOCTRINE section 9.3 territory. Verify the counts before you commit, not after CI complains.

## Content to update - 1 of 3: the D24 row

**Find this row** (matched by the `| D24 |` cell - do not rely on the line number):

    | D24 | 1.2.1 | Theme sequencing **option C** — token cleanup on the most-used screens first | REGISTERED | `docs/plans/theme-system-plan.md:4` |

**Replace it in full with:**

    | D24 | 1.2.1 | Theme sequencing **amended 2026-09-01**: the visible theme surface is gated on the **hex-baseline ratchet**, not on a token-cleanup campaign. Cleanup is opportunistic - each lane retires the literals in files it already touches. Supersedes "option C". | REGISTERED | `docs/plans/theme-system-plan.md:4` |

Keep the em-dash characters as they appear in the surrounding rows; the table already uses `—`.
Do not renumber D24, do not add a D-row, and do not touch any other row in that table.

## Content to update - 2 of 3: SECTION 5 of the plan

**Replace SECTION 5 in full.** Current text:

    ## 5. Sequencing Rule

    **SLICE 17 must not be armed until every non-conditional cleanup slice (SLICES 5–13) has merged to
    main.** The field slices (14–15) are conditional and do not block SLICE 17 if Marco confirms field
    is out of scope. SLICE 16 must also be merged before SLICE 17 is armed.

**New text:**

    ## 5. Sequencing Rule — AMENDED 2026-09-01

    **Superseded:** the original rule gated SLICE 17 behind cleanup SLICES 5–13. That rule is
    withdrawn. It was written when the literal count was 3,792; by 2026-09-01 it was 4,339, and
    SLICE 12's scope had outgrown the prompt linter's ten-file cap. A campaign that loses ground
    while it waits cannot be a precondition for the work it is blocking.

    **In force from 2026-09-01:** the visible theme surface is gated on the **hex-baseline ratchet**
    (`docs/qa/hex-baseline.json` + `scripts/pipeline/check-hex-ratchet.mjs`) being live in CI. The
    ratchet permits a file's hex count to fall or hold and rejects any increase, and requires new
    files to start at zero. Token cleanup then happens opportunistically: a lane converts the
    literals in a file it is already editing, and the baseline shrinks as a side effect of ordinary
    work.

    SLICES 5–15 are retained below as a **record of measured debt, not as a work queue.** They are
    not to be armed as written; their file lists and counts are stale.

## Content to update - 3 of 3: banner + new SECTION 7

**Insert immediately after the `## 3. Slice List (dependency order)` heading:**

    > **STATUS 2026-09-01.** SLICES 1–4 remain valid and unshipped. SLICES 5–15 are SUPERSEDED by
    > the hex-baseline ratchet — see SECTION 5 — and are kept only as a record of measured debt.
    > SLICES 16–17 are superseded by the S1–S6 chain in SECTION 7.

**Append a new SECTION 7 at the end of the file:**

    ---

    ## 7. The build chain in force from 2026-09-01

    Marco approved `erp-theme-builder-mockup.pdf` on 2026-09-01 and confirmed he wants all of it
    built. This chain replaces SLICES 16–17.

    | Slice | What it does | Schema? | Gate |
    |---|---|---|---|
    | **S1** | The application path: a saved scheme reaches the screen as CSS variables. Two colours (`--brand-primary`, `--brand-accent`), one unprivileged read route. | no | none |
    | **S2** | The hex-baseline ratchet. | no | none |
    | **S3** | Widen `BrandColorScheme` to the mockup's full palette — sidebar, cards, text, five status colours. | **YES — migration** | **Marco merges** |
    | **S4** | Named presets (Harbour, Graphite) as seeded `BrandColorScheme` rows. | seed only | S3 |
    | **S5** | Density (compact / comfortable) as tokens plus a control. | no | SLICE 1 |
    | **S6** | Live preview, contrast-ratio badges, per-user override in `localStorage`. | no | S3, S5 |

    **Only S3 carries a migration.** The per-user override in S6 is stored in `localStorage`
    alongside the existing `projectops.theme` key, so it needs no table: there is no general
    per-user preference store in the schema today (`NotificationPreference` is the only per-user
    preference model, and it is channel-specific).

    **SLICE 1 of this plan is a genuine prerequisite for S3 and S5.** MEASURED 2026-09-01:
    `tokens.css` declares 14 dark-mode tokens in `:root[data-theme="dark"]` and duplicates all 14
    inside the `@media (prefers-color-scheme: dark)` fallback. Until that duplication is collapsed,
    every token S3 and S5 add must be written twice and kept in sync by hand.

    Presets are seeded rows rather than `[data-theme="..."]` CSS blocks — the approved mockup is a
    *builder*, so a preset the company cannot then edit would contradict it. This supersedes
    SLICE 3's and SLICE 16's `[data-theme]` approach.

## Gates

`pnpm lint`. No schema, no migration, no seed, no app code, no workflow.

CP-24 will PASS: only `sot/` and `docs/` are touched.

## Do NOT auto-merge

SoT governance change. **Marco reviews the rendered diff and merges.** The watcher must open this
PR and leave it unmerged.

## Do not do these things

- **Do not touch `docs/qa/hex-baseline.json`, `scripts/`, or `.github/`.** The ratchet itself ships
  in `pr-brandtheme-s2-hex-ratchet`; this PR only records the decision. Touching `scripts/` or
  `.github/` here trips CP-24 and hard-fails the PR.
- **Do not delete SLICES 5–15 from the plan.** They are the measured record of the debt. Marking
  them superseded is the whole point; erasing them loses the evidence.
- **Do not edit any other D-row in `sot/05`.** D5 ("Colour/density themes, not layouts") stays
  exactly as it is - it is still true and is not in question.
- **Do not renumber the slices.** Downstream prompts and breadcrumbs cite "SLICE 1" and "SLICE 17"
  by number.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.
