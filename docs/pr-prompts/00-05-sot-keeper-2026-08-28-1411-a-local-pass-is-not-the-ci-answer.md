# Station 05 — SoT Keeper | 2026-08-28T14:11Z–2026-08-28T14:40Z

## GROUND

```
UTC            2026-08-28T14:11:35Z
origin/main    82ba8538            (fetched, then rev-parse)
dev tree       main @ 82ba8538      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/05-sot-keeper.md)
bootstrap      1                    (scheduled-task SKILL.md)
```

Versions agree — this run was NOT read-only. SIGHTED: Desktop Commander reached the box
(`start_process` powershell.exe, PID 33988). Work landed in a disposable worktree
`C:\po-worktrees\sot05-refs-burndown` off `origin/main`; the dev tree was never written to.

## WHAT I MEASURED

- **[MEASURED]** `scripts\pipeline\status-sweep.ps1` @14:12:28Z — verdict **SAFE TO ACT**.
  Instrument positive controls both passed (`gh` saw merged #1376; `node` runs).
  OPEN PRs = 1 (#1377, UNSTABLE, 12 pass / 1 fail). Watcher node RUNNING pid 5444,
  wrapper alive (3), heartbeat age 220 min. armed (`*-ready.md`) = 0. Trunk green
  (main CI last 3 runs: 3 success).
- **[MEASURED]** Audit 1 — `node scripts/data-model/build-relationship-map.mjs --check`
  → `OK: generator ran cleanly against schema.prisma (292 models, 66 enums, 482 edges)`, exit 0.
  Per the station doc this proves the schema PARSES; it is not a drift gate.
- **[MEASURED]** Audit 3 — sot/04 header reads `Models: 292 | Enums: 66 | FK edges: 482 | Domains: 23`
  against the generator's 292/66/482. **No sot/04 drift; no re-merge needed, no reconcile PR for it.**
- **[MEASURED]** Audit 2 — `metadata-catalog.json` parses as valid JSON (678,752 bytes). Not the
  four-sweep invalid-JSON state the station doc warns about.
- **[MEASURED]** Rule Zero cross-check — the job carrying `check-sot-refs`
  (`Pipeline — watcher + linter tests`, `.github/workflows/ci.yml:193`) is **success** on
  `origin/main` @82ba8538. No environment disagreement on the gate's verdict.
- **[MEASURED]** #1377's only non-success check is `PR gates — diff checks (CP-09–13, CP-17,
  CP-22, CP-23)` = FAILURE. Reported as corroboration of Station 00's 1210 finding; not my lane.
- **[MEASURED]** CP-24 read from source, not prose: `scripts/pr-gates/pr-gates.mjs:325`
  `codeRe = /^(?:apps\/|scripts\/|\.github\/|packages\/|package\.json$|pnpm-lock\.yaml$)/`.
  `sot/` + `docs/` ride together legally. This PR is `sot/` + `docs/` only.
- **[MEASURED]** The sot-refs ratchet is `.github/workflows/ci.yml:209` —
  `git diff origin/<base> -- docs/qa/sot-refs-baseline.json | grep '^+.*"missing_path"'`.
  It rejects ADDED entries only; deletions are unconditionally allowed.
- **[MEASURED]** `git ls-files "**/<name>"` for every baselined target: three of the twenty
  live entries name a file that IS tracked, just written module-relative —
  `apps/api/src/modules/tendering/__tests__/scope-update-item-preserve.spec.ts`,
  `apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts`,
  `apps/api/src/modules/email/providers/outlook.provider.ts`.
- **[MEASURED]** sot/03's replacement-character count is **9 before and 9 after** my edit
  (`git show origin/main:sot/03-progress-log.md` vs the worktree file, both decoded with node).
  The known committed U+FFFD damage was neither worsened nor accidentally "repaired".

## WHAT CHANGED

One doc-reconcile PR, opened from a disposable worktree off `origin/main`. Nothing armed,
nothing merged, the dev tree untouched. `git diff --numstat`:

```
14   0   docs/pipeline/stations/05-sot-keeper.md
 1   4   docs/qa/sot-refs-baseline.json
 1   1   sot/03-progress-log.md
 2   2   sot/06-active-specs.md
```

- `sot/03-progress-log.md:5177` — `` `__tests__/scope-update-item-preserve.spec.ts` `` →
  `` `tendering/__tests__/scope-update-item-preserve.spec.ts` ``
- `sot/06-active-specs.md:617` — `` `builders/quote-html.builder.ts` `` →
  `` `pdf-rendering/builders/quote-html.builder.ts` ``
- `sot/06-active-specs.md:618` — `` `providers/outlook.provider.ts` `` →
  `` `email/providers/outlook.provider.ts` ``
- `docs/qa/sot-refs-baseline.json` — those three entries deleted (26 → 23 entries);
  `_readme` hardened with the verification rule below.
- `docs/pipeline/stations/05-sot-keeper.md` — the burn-down section gains the
  `git cat-file -e origin/main:<path>` pre-check. Insert is outside the canonical block:
  `lint-station.mjs` → `ADMIT: all 7 docs clean`, exit 0.

Read-back: in the clean worktree `node scripts/pipeline/check-sot-refs.mjs` now prints
`sot-refs: 23 baselined exemptions remain` / `total=274 dangling=0 exempt=0 baselined=23
excluded=2`, exit 0. `check-lessons.mjs` → `holding=5 regressed=0 broken=0`, exit 0.

## FINDINGS

**F1 — ENVIRONMENT DISAGREEMENT: the burn-down metric reads 20 on a dev box and 26 in CI,
same command, same SHA.** `check-sot-refs.mjs:263` resolves references with `existsSync`
against the **working tree**, not against the git index. **[MEASURED] @82ba8538:** the dev tree
`C:\ProjectOperations2` printed `sot-refs: 20 baselined exemptions remain`; a freshly created
worktree off `origin/main` at the same SHA printed **26**. The six-entry gap is entirely
targets that are gitignored and absent from `origin/main` — proven with
`git cat-file -e origin/main:<path>` (all four returned non-zero) and `git check-ignore -v`:
`docs/data-model/relationship-map.md` (`.gitignore:127`),
`docs/qa/qa-findings.md` (`.gitignore:107`),
`docs/qa/qa-checklist.md` (`.gitignore:106`, gitignored),
`apps/api/scripts/xero-import-report.md` (`.gitignore:85`).
The trap is precise and was one command away from firing this run: the station doc's workflow
says "pick an entry, fix it, delete it, the count must drop." Six entries look **already fixed**
on any dev box. Deleting them turns a baselined exemption into a hard `dangling` failure, and
`check-sot-refs.mjs` is a blocking step in `Pipeline — watcher + linter tests` — it would have
gone red on every open PR. This is DOCTRINE §7's shape exactly: a coherent, confident, wrong
reading of a healthy system, produced by an instrument measuring the wrong surface.
Mitigated in this PR by writing the pre-check into both the baseline `_readme` and the station
doc, so the next run cannot reach the delete step without seeing it.
**DISPOSITION: ACTIONED** (guard landed + verified by `lint-station.mjs` ADMIT and a clean-tree
`check-sot-refs` run at 23).

**F2 — three baseline entries burned down; 23 remain, and most of the rest are not
deterministic.** Of the 20 entries live in a dev tree, only three named a file that exists
under a declared search root. The remainder split into two classes that Station 05 must not
auto-edit: (a) **consolidated-away documents** cited inside historical prose —
`docs/architecture-overview.md`, `docs/module-build-log.md`, `docs/continuation-log.md`,
`docs/Project-History-Sprints-1-to-12.md`, `docs/qa/Master-QA-and-Consolidation-Program-Plan.md`,
`graphify-out/GRAPH_REPORT.md` — where the fix is a prose decision (repoint vs. delete vs. mark
historical) about what the 2026-07-08 consolidation folded them into; and (b) **files that never
existed or were never built** — `tender-scope-drafting.service.ts` (×2),
`quote-pdf.builder.ts`, `tender-client-notes.controller.ts`,
`pr-dashboard-gantt-heatmap-widgets-HOLD.md`, `pr-dashboard-rename-copyfrom-HOLD.md`,
`pr-188-authz-findings.md` — `git ls-files` finds no tracked file and no near match for any of
them, so the sot/ prose is describing planned or abandoned work. Both classes need judgement,
which the AUTHORITY section forbids me from auto-editing.
**DISPOSITION: DEFERRED** — becomes urgent only if the baseline stops shrinking for a week, or
if a reader acts on one of the class-(b) specs believing the file exists. The next tractable
batch is class (b): each one wants a one-line "not built" marker in sot/06, which is a Marco or
Station 06 judgement, not a reconcile.

**F3 — three documents state three different sizes for the same baseline.**
`CLAUDE.md` says it "tracks 26 known-dangling sot/ refs"; `.github/workflows/ci.yml:191` says
"the 28 pre-existing dangling references"; the checker prints 20 or 26 depending on which disk
it runs on (F1). After this PR the entry count is 23. I did not touch either file:
`.github/**` is code under CP-24 and cannot ride with `sot/`, and a bare number in a bootstrap
will be wrong again next week — the durable fix is to cite the file, not a count.
**DISPOSITION: ESCALATED** — for Station 00 to route, with the complete-and-additive option
first: **(a)** replace the number in `CLAUDE.md` and `ci.yml:191` with "the count printed by
`node scripts/pipeline/check-sot-refs.mjs`", so no third copy can drift — additive, damages no
data entry, passes both halves of RULE 1; **(b)** just correct 26→23 and 28→23 — fails the
*future* half, it will be stale at the next burn-down; **(c)** leave it — fails both halves.
Note (a) needs two PRs, because `ci.yml` is code and `CLAUDE.md` is not.

**F4 — `settings-restructure-sot-nav-reconcile` is registered to this station and its gate is
still shut.** The sweep's backlog section lists it under "still blocked (gate not yet
satisfied)" — it opens once SLICE 14 lands and `MapLocationsPage` is on main, and it is marked
STATION 05 ONLY. Recorded so it is not lost between runs.
**DISPOSITION: DEFERRED** — urgent the moment SLICE 14 merges.

## WHAT I DID NOT DO

- **No generator re-merge, no artifact regeneration.** Audit 3 found sot/04's header counts
  identical to the generator's (292/66/482), so the allowlisted auto-fix had nothing to do.
  Regenerating anyway would have churned a gitignored artifact for no gain.
- **Did not delete the six "already resolved" baseline entries.** That is F1; they are alive
  in CI. This is the whole finding.
- **Did not touch `.github/workflows/ci.yml` or `CLAUDE.md`** — see F3. CP-24 forbids the first
  in this PR; the second is a judgement about wording, not deterministic drift.
- **Did not edit sot/03's committed U+FFFD damage** (9 characters, both commits in its history
  carry them — Station 05's 2026-08-27 finding stands). Repairing them means inventing the lost
  characters; that is a judgement call and a separate, reviewable PR.
- **Did not arm, merge, label, or stage a prompt.** Station 05 never does. #1377 stays as it is.
- **Did not write into the dev tree.** Two `R100` arming renames from other chats were sitting
  staged in the shared index (`pr-devtree-sync-ff-only-guard`, `pr-lint-armed-gate-inversion`);
  working in a worktree kept them out of my commit entirely.
