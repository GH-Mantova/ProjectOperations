# Station 05 — SoT Keeper | 2026-08-29T14:12Z–2026-08-29T15:30Z

## GROUND

```
UTC            2026-08-29T14:12:19Z
origin/main    fb3cc64b            (git fetch origin +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 1501d09c     C:\ProjectOperations2   (6 behind origin/main, 0 ahead)
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                   (Scheduled\05-sot-keeper\SKILL.md)
```

Version numbers AGREE, so this run was not forced read-only. **That agreement was misleading — see
F1.** `gh` resolves at `C:\Program Files\GitHub CLI\gh.exe`, so no ADMIT/gate read in this run was
silently waived (DOCTRINE §9.5).

## WHAT I MEASURED

- **[MEASURED] Box reachable.** `start_process` shell `powershell.exe` → PID 21900, PS 5.1.26100.9168.
  Control: `$ctl = 42; "CTRL=$ctl"` printed `CTRL=42`, so `$` is **not** stripped through
  `interact_with_process` (DOCTRINE §9.1 applies to `-Command`, not to this path).
- **[MEASURED] Sweep.** `status-sweep.ps1` @14:15:54Z → section 0 both positive controls pass;
  OPEN PRs **0**; armed **0**; `index.lock` interactive/clone **False/False**; git processes **0**;
  needs-marco 14 / no-pr-opened 107 / failed 41; verdict **SAFE TO ACT**. Re-measured immediately
  before the only mutation (staged empty, lock False, git procs 0, armed 0).
- **[MEASURED] Trunk CI, per-commit, not `--branch main`.**
  `gh api repos/GH-Mantova/ProjectOperations/commits/fb3cc64b/check-runs` → 12 success,
  `PR gates — diff checks` **skipped** (pull_request-only; expected on a push).
- **[MEASURED] Audit 1 — schema parse sanity.** `node scripts/data-model/build-relationship-map.mjs --check`
  → `OK: generator ran cleanly against schema.prisma (292 models, 66 enums, 482 edges)`, exit 0.
  **Rule Zero cross-check:** the matching CI job `Data model — generator sanity (schema.prisma parses
  cleanly)` on `fb3cc64b` = **success**. Local and CI AGREE. No ENVIRONMENT DISAGREEMENT this run.
- **[MEASURED] Audit 2 — catalog validity.** `docs/data-model/metadata-catalog.json` parses:
  `CATALOG_OK bytes=678752 topkeys=4`. The 2026-08 "invalid JSON at ~offset 407816" defect is dead.
- **[MEASURED] Audit 3 — sot/04 drift.** `sot/04-data-model.md:16` reads
  `Models: 292 | Enums: 66 | FK edges: 482 | Domains: 23`; the fresh parse says 292/66/482 and the
  TOC enumerates 23 domains. **No drift.** The generated section did not need re-merging, so no
  regeneration was run and no gitignored artifact was rewritten.
- **[MEASURED] Audit 4 — roadmap drift.** `sot/02-roadmap-and-status.md:61` says
  `## 2. 🔧 In-PR — open right now (2)` and tables **#895** and **#894**. Live: `gh pr view` says
  **both MERGED on 2026-08-04** (04:41Z and 05:09Z) and GitHub reports **0 open PRs**. The section
  self-dates to 2026-08-04 and self-declares that `bring-up-to-speed.ps1`'s `[LIVE]` lines beat it.
- **[MEASURED] Audit 5 — automation health.** Watcher resolved by **command line**, never image name:
  of 11 `node.exe`, exactly one matches `pr-watcher[\\/]index\.mjs` → **pid 26364**, running
  `C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs` (the CLONE). Live schedule read from
  the scheduled-tasks MCP, not from `Scheduled\` folders: 00 (2 h), 03 (daily), 04 (4 h), 05 (daily)
  all enabled; **`weekly-security-audit` is DISABLED, lastRunAt 2026-08-18T08:18Z (11 days)**.
  02 and 06 have no task, which matches STATION-CAPABILITIES §5. Newest `processed/`:
  **2026-08-28T16:13Z**, i.e. 23 h with nothing consumed.
- **[MEASURED] OAuth, at source, 8th consecutive reading.** `C:\Users\Marco\.claude\.credentials.json`
  1649 B, mtime **2026-08-28T16:13:26Z**, `claudeAiOauth.expiresAt` = 1787933615984 =
  **2026-08-28T16:13:35Z**. At 15:11:22Z that is **22 h 58 m expired and the file has not moved**, so
  nothing is refreshing it. Newest `failed/` entries (08-29 07:03Z) carry
  `401 OAuth access token has expired`. **The last processed prompt and the token expiry are the same
  minute** — the queue did not stall, it was correctly braked.
- **[MEASURED] sot-refs, both instruments.** Clean extract of `origin/main` (`git archive -o` then
  `tar -xf`, 2695 files) → `sot-refs: 23 baselined exemptions remain … total=274 dangling=0
  baselined=23`, exit 0. Dev tree at the same SHA → **17**. The 23 is the CI answer.
  **[INFERRED→MEASURED] the 6-entry gap is not mysterious:** `git check-ignore -v` on every baseline
  target shows 8 entries point at gitignored-by-design artifacts, and exactly 6 of those 8 exist on
  this disk. Positive control: `sot/README.md` is present in `git ls-tree -r origin/main` (and `-r`
  was used throughout, per DOCTRINE §9.2).
- **[MEASURED] Burn-down probe.** All 23 baseline targets tested against `origin/main` with a
  basename fallback across the checker's three non-root search paths: **zero** are wrong-prefix
  references to a live file. Not one is mechanically fixable.
- **[MEASURED] Mojibake is the reader, not the files.** PowerShell rendered `—` in `ci.yml` as
  `?"`. Node says `.github/workflows/ci.yml`, `CLAUDE.md` and `sot/02` each have
  **U+FFFD=0, double-encode=0**. Nothing is corrupt. (DOCTRINE §7 lie #2, reproduced and dismissed.)
- **[MEASURED] `sot/03-progress-log.md` still carries 9 U+FFFD on `origin/main`.** Counted on both
  the working copy and main's blob: 9 and 9. Pre-existing, unchanged, and not introduced by anything
  this run did. My restore guard fired on it and was correct to.
- **[CANNOT MEASURE] Audit 6 (model↔migration↔code coherence) and audit 7 (module registry).** Not
  run. The generator's 292-model parse is not a substitute and I am not presenting it as one.

## WHAT CHANGED

1. **Reverted three files in the shared dev tree to `origin/main`** — `sot/03-progress-log.md`,
   `sot/06-active-specs.md`, `docs/qa/sot-refs-baseline.json`. Node raw-Buffer writes from
   `git show origin/main:<path>`, line endings matched to each file, backups first at
   `C:\po-sup-fix-scripts\_sotk-backup-2026-08-29\`. **Never `git checkout`** (DOCTRINE §9.2).
   Read-back: `git diff --numstat -- sot docs/qa/sot-refs-baseline.json` is **EMPTY**; all three
   ` M` rows are gone from `git status --porcelain`. `git diff --cached` empty before and after.
2. **Annotated `docs/qa/sot-refs-baseline.json`'s `_readme`** in the PR worktree with the measured
   structural-exemption census. `1 1` numstat; `entries[]` byte-identical before and after, so the
   CI ratchet has nothing to reject.
3. **Swept up six orphaned Station 05 sweep reports** (2026-08-18/19/20/21/26/27) that had been
   sitting untracked on disk, plus this run's `2026-08-29.md`.
4. Nothing else. No `/sot/` content edit, no arm, no merge, no label, no regeneration.

## FINDINGS

**F1 — The dev tree served me a SUPERSEDED copy of my own binding instructions, and the version
check cannot catch it.**
STEP 2 of my bootstrap sends me to `C:\ProjectOperations2\docs\pipeline\...`. That tree is 6 commits
behind `origin/main`. `git diff --numstat origin/main` on the three documents I read:
`docs/pipeline/stations/05-sot-keeper.md` **3/5** and `docs/pipeline/STATION-CAPABILITIES.md`
**3/10** (DOCTRINE.md identical). The delta is #1389's correction: the copy I read still says *"if
this station appears in the scheduled-task listing, it is cloud-fired and structurally cannot reach
the box"*, while `origin/main` says that is **REFUTED in both directions**. I appear in the listing
**and** reached the box, so acting on the stale copy would have had me file a refuted claim as new.
The `station_doc_version` guard did not fire and **structurally cannot**: #1389 changed content
without bumping the version, and bumping it is explicitly forbidden. **A version match is not a
freshness proof.** Same refuted sentence is at **L25 of my own `Scheduled\05-sot-keeper\SKILL.md`**,
which independently confirms Station 04's 0610 bootstraps finding from inside a bootstrap.
**DISPATCHED** to Station 00 — the durable fix is a one-line preflight instruction change
(*"read your station doc from `git show origin/main:<path>`, never from the dev tree"*), which lives
in the canonical station-contract block and must ship to all six docs together with a re-recorded
`lint-station.mjs` hash. That is 00's lane, not mine, and 00 already holds the bootstrap-paste item.

**F2 — An uncommitted change in the shared dev tree would have vandalised source of truth and
red-lit CI on every PR.**
Found as ` M` on `sot/03-progress-log.md`, `sot/06-active-specs.md` and
`docs/qa/sot-refs-baseline.json`. It truncated three correct code paths in `/sot/` —
`tendering/__tests__/scope-update-item-preserve.spec.ts` → `__tests__/…`,
`pdf-rendering/builders/quote-html.builder.ts` → `builders/…`,
`email/providers/outlook.provider.ts` → `providers/…` — then **added those three now-dangling refs to
the baseline**, which the station doc forbids in terms (*"Never add an entry"*) and which the CI
ratchet rejects outright. It also deleted the TRAP paragraph from the `_readme`. `HEAD` and
`origin/main` are identical for these paths, so the working tree was the only deviation.
**ACTIONED** — reverted to `origin/main` and read back to an empty numstat (WHAT CHANGED 1).
Originals preserved under `C:\po-sup-fix-scripts\_sotk-backup-2026-08-29\`, nothing destroyed.

**F3 — The sot-refs burn-down floor is 8, not 0, and the station doc reads as though it were 0.**
`git check-ignore -v` on all 23 baseline targets: 8 point at artifacts that are **gitignored by
design**, so the `/sot/` reference is CORRECT and no amount of fixing can retire the entry —
`apps/api/scripts/xero-import-report.md` (.gitignore:85, ×2), `docs/data-model/relationship-map.md`
(.gitignore:127), `docs/qa/qa-checklist.md` (.gitignore:106, ×2), `docs/qa/qa-findings.md`
(.gitignore:107), `docs/pr-prompts/needs-marco/pr-188-authz-findings.md` (.gitignore:82),
`graphify-out/GRAPH_REPORT.md` (.gitignore:133). The remaining 15 are real debt, and **none is
mechanically fixable** — every target's basename is absent from `origin/main` entirely, so each needs
a judgement call about a deleted document, which my own AUTHORITY section puts off-limits to
auto-fix. A future Station 05 chasing zero deletes one of the 8 and converts a baselined exemption
into a blocking CI failure on every PR — the exact trap the `_readme` already warns about without
naming which entries.
**ACTIONED** for the immediate half: the eight are now named, with `.gitignore` line numbers, in the
`_readme` (WHAT CHANGED 2). **DISPATCHED** for the durable half: `check-sot-refs.mjs` already prints
an `exempt=` bucket that is permanently 0. Moving these 8 from `baselined` to `exempt` leaves a
baseline of 15 that can honestly reach zero. That edit is `scripts/`, which CP-24 hard-blocks from
mixing with `sot/` and which my S5 scope cap puts outside my lane.

**F4 — `docs/data-model/sweeps/` is a tracked path that nothing ever commits: 6 of 7 reports were
lost.** `git ls-tree -r --name-only origin/main -- docs/data-model/sweeps` returns **one** file
(2026-08-25.md); seven sit on disk and the path is **not** gitignored (control: `docs/data-model`
has 10 tracked files, so the query is not blind). This is the `docs/qa/qa-findings.md` nine-day
swallow in a second shape — not a gitignored sink, just an output the OUTPUT contract tells 05 to
write and never tells anyone to commit.
**ACTIONED** — all six orphans plus today's report are in this PR (WHAT CHANGED 3), and 05's history
is on `main` for the first time.

**F5 — The board is not stalled; it is correctly braked on an expired OAuth token, and only Marco
can clear it.** 23 h expired, unmoving at source, 8th reading. Every agent-lane run since
2026-08-28T16:13Z has 401'd into `failed/`. Armed 0 and OPEN 0 are the brake holding, not health.
**ESCALATED** — already open from prior runs; re-stamped at `fb3cc64b` / 2026-08-29T15:11Z rather
than re-raised as new. Nothing this station can do reaches it.

**F6 — Three documents state three different sot-refs counts, and the measured answer is 23.**
`CLAUDE.md:19` says 26. `.github/workflows/ci.yml` (the comment above the `check-sot-refs` step) says
28. A clean worktree off `origin/main` says **23**. Neither wrong number is functional — the ratchet
diffs the file, it does not read the comment — so this is documentation drift, not a CI risk, which
downgrades a standing escalation to a paperwork item.
**DISPATCHED** to Station 00 with the exact edits: `CLAUDE.md:19` `26 known-dangling` → `23
known-dangling`; `ci.yml` `the 28 pre-existing dangling references` → `the 23 pre-existing dangling
references`. Both files are outside my S5 scope cap (root and `.github/`), so I did not touch them.

**F7 — `sot/02-roadmap-and-status.md` §2 has been stale since five hours after it was written.**
It claims 2 open PRs; #894 and #895 both merged on 2026-08-04, the same day the snapshot was taken.
Live open PRs: 0. The section already carries its own health warning, `CLAUDE.md` says sot/02 lags
reality, and the project instructions say the same, so nothing is being misled today. Refreshing the
table just restarts the clock; removing it in favour of the `bring-up-to-speed.ps1` pointer the
section already names is a curation decision, and "roadmap STATUS semantics" is on my never-auto-fix
list.
**DEFERRED** — becomes urgent the moment anything automated reads §2 as authoritative, or if a
reader is observed quoting it as live. The resolving edit either way is one table in `sot/02`, and
Station 05 is the only station that may make it.

**F8 — `weekly-security-audit` is disabled and has not run in 11 days.** Read from the
scheduled-tasks MCP, which is the only live schedule: `enabled: false`, `lastRunAt`
2026-08-18T08:18:52Z, no `nextRunAt`. Whether that is deliberate parking or an accident is not
derivable from the box.
**DEFERRED** — one question for Marco when something else is going his way; re-enabling a security
audit task is a configuration decision, not drift I should silently correct.

## WHAT I DID NOT DO

- **Did not regenerate the data-model map.** Audit 3 found zero drift (292/66/482/23 on both sides),
  so the AUTO-FIX allowlist had nothing to act on. Regenerating anyway shrinks tracked
  `metadata-catalog.json` and has aborted a slice before.
- **Did not run audits 6 and 7** (model↔migration↔code coherence, module registry). Reported as
  `[CANNOT MEASURE]` above rather than dressed up in the generator's parse count.
- **Did not touch `docs/data-model/metadata-catalog.json`.** It shows ` M` in `git status` but
  `git diff --numstat` against `origin/main` is empty — a pure LF/CRLF stat artifact. Rewriting it
  to CRLF would manufacture a 678 KB diff out of a zero-byte difference. A ` M` is not evidence of a
  change. This retires the third file of the four dispatched to 05 as ` M` in the shared tree.
- **Did not edit `CLAUDE.md`, `.github/workflows/ci.yml`, `scripts/pipeline/check-sot-refs.mjs`, or
  any station doc.** All outside safeguard S5's scope cap; dispatched with exact before/after text so
  00's work is transcription, not re-diagnosis.
- **Did not arm, merge, label, or move anything in the queue.** Not my lane, and the OAuth brake
  stands regardless.
- **Did not clear the four orphaned worktrees or the watcher clone's 35 dirty paths.** Station 03's
  lane; the clone fast-forward is a live ownership escalation and nothing here needed it.
- **Did not delete a single baseline entry.** F3 is the reason: every candidate either is a
  structural exemption or needs a judgement call, and the one thing worse than 23 entries is 22 plus
  a red board.

---

**This breadcrumb ships in its own PR** rather than waiting to be swept, so it cannot be orphaned.
`docs/data-model/sweeps/2026-08-29.md` carries the same run in the sweep-report format the station's
OUTPUT section asks for.
