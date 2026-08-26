# STATION 04 SCANNER — 2026-08-24T02:10Z @ origin/main `ed26083a`

READ-ONLY run. Nothing armed, disarmed, renamed, moved or deleted. No worktree minted
(used `git show origin/main:<path>` throughout).

## REFUTED — stop reporting these three

1. **`*-ready.md` resurrection trap (tracked half) is GONE.** 0 depth-1 tracked `-ready.md` on
   origin/main (was 9). Controls: 396 files tracked under `docs/pr-prompts` with `-r`; the same
   query without `-r` returns exactly 1 line.
2. **Breadcrumbs are now TRACKED** — 22 on disk / 21 tracked (was 20 / 0). Only today's
   machine-minder note is uncommitted.
3. **`settings-restructure-sot-nav-reconcile` is DISCHARGED** — its marker
   `docs/audits/settings-restructure-sot-reconcile.md` is on main (landed with #1298). It now shows
   under "still blocked" only because `check-backlog.mjs` has no DISCHARGED bucket.

Also fixed: `docs/approvals/README.md` is tracked and **5 prompts now consume an approval marker**
(0 markers exist, so all five are correctly held).

## FINDING 1 (highest consequence) — `lint-prompt.mjs` is blind to every human gate

Direct read of the file (44,860 chars): `do-not-arm` **absent**, `DO NOT ARM` **absent**,
`approvals` **absent**.

- **10 of 61 depth-1 HOLD prompts carry a do-not-arm signal; 10 of 10 lint ADMIT** — including
  `pr-rates-s11c-drop-legacy-tables-HOLD.md`, which drops database tables.
- Positive control: 3 unrelated HOLDs with no such signal also lint ADMIT
  (`pr-apierr-s12-ci-gate`, `pr-bp-s2-worth-chasing-view`, `pr-comms-hub-inbox`).
  **ADMIT is necessary, not sufficient.**
- HTML-marker prompts drifted **4 → 1** since 00:10Z — the machine-readable marker is being lost.
- **#1300's new approvals gate is therefore prose-only and mechanically unenforced.**

Needs a **code PR**. Surfaced to Station 00.

## FINDING 2 — GATE-ALLOW arm gap confirmed; real path is `scripts/pr-gates/pr-gates.mjs`

| token | lint-prompt.mjs | pr-gates.mjs |
|---|---|---|
| migrations | 11 | 16 |
| env-vars | **0** | 6 |
| dependencies | **0** | 10 |
| .env.example | **0** | 2 |
| package.json | **0** | 1 |

Control: `GATE-ALLOW` present in both (1 vs 7). Casualty **PR #1296** still fails
`PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)`; its body has 0 GATE-ALLOW lines.
The one-line unblock is **Marco's call under RULE 2**.

## FINDING 3 — instrument failure caught before it shipped

`git show origin/main:prisma/schema.prisma 2>&1` returned the string
`fatal: path 'prisma/schema.prisma' does not exist in 'origin/main'` **as content**, yielding an
empty model set and a false **"284 models stale in sot/04"**. Real path is
**`apps/api/prisma/schema.prisma`**. Assert `^fatal:` after any `git show <ref>:<path>`.

Corrected, sot/04 drift is unchanged: **292 schema vs 284 doc, 8 missing, 0 stale** (purely
additive). Control: `User` on both sides. SLICE 11c not landed — 7 `Estimate*Rate` models remain.

## Still open

- **sot/03 is the largest unowned gap**: max ref #495 vs board #1300 → ~800 PRs unrecorded.
- `docs/qa/qa-findings.md` still gitignored (`.gitignore:107`); control on a tracked file exits 1.
- Armable-invisible suffix-less prompts still exactly **2**.
- **4 orphan worktrees**; `C:/po-worktrees/sot-readme-fetch` is now removable (#1299 merged).

Durable copy in PROJECT MEMORY:
`project_scanner_2026_08_24_0210_surfacing_fixed_lint_blind_schema_path_lie.md`.
