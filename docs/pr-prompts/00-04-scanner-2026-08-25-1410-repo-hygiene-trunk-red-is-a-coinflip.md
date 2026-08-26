# Station 04 — Scanner | 2026-08-25T14:10Z–2026-08-25T14:40Z

## GROUND

```
UTC            2026-08-25T14:10:08Z
origin/main    b968e4f1            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ b968e4f1     C:\ProjectOperations2   (rev-list HEAD..origin/main = 0)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE — full authority run. **NOT BLIND**: Desktop Commander reached the box on the first
call (`start_process` powershell.exe, PID 26972, returned the host clock and `git rev-parse HEAD`).

**Sweep this run: `repo-hygiene`** (rotation position 3 of 4), selected by
`node scripts/pipeline/next-sweep.mjs`, not by choice. Previous run 2026-08-25T10:09:57Z.

---

## WHAT I MEASURED

### 1. The trunk instrument — `status-sweep.ps1` "TRUNK IS RED" is a COIN FLIP

[MEASURED] The 14:10:34Z sweep printed:
`main branch CI (last 3 runs): 1 success / 1 not-success  <-- TRUNK IS RED`

[MEASURED] Authoritative per-commit read of the same head:
`gh api repos/GH-Mantova/ProjectOperations/commits/b968e4f1.../check-runs?per_page=100`
→ `total_count = 12`, `success = 11`, `skipped = 1`, **failures = 0**. **The trunk is GREEN.**

[MEASURED] `status-sweep.ps1:86-88` is `gh run list --branch main --limit 3` substring-counted for
`success` / `failure|cancelled|timed_out`. Re-run standalone **four times, 2 s apart, against an
unchanged `main`**:

| sample | rows | ok | fail | createdAt of the 3 rows | verdict it would print |
|---|---|---|---|---|---|
| 1 | 3 | 1 | 1 | **2026-08-06**T15:41 / 15:41 / 18:14 | **TRUNK IS RED** |
| 2 | 3 | 3 | 0 | 2026-08-25T09:00:36Z ×3 | trunk green |
| 3 | 3 | 3 | 0 | 2026-08-25T09:00:36Z ×3 | trunk green |
| 4 | 3 | 3 | 0 | 2026-08-25T09:00:36Z ×3 | trunk green |

An earlier standalone sample in the same run returned rows dated **2026-08-13**. So three distinct
stale windows — **08-06, 08-13, 08-25** — were observed from the identical command within ~20 minutes.

[INFERRED] This is not the substring arithmetic mis-parsing; the arithmetic is correct for the rows it
is handed. **`gh run list --branch main` non-deterministically returns an arbitrarily old page**, and
the sweep tags the result `[LIVE]`. DOCTRINE §9.4 already says "can be DAYS stale"; what is new is
that it is **not consistently stale** — it flips between a 19-day-old page and the current one, so a
single reading can never be trusted in either direction.

**Correction to the 2026-08-25 10:22Z Station 04 line** which recorded "the false `TRUNK IS RED` did
not reproduce". It reproduces. It did not reproduce that run because that run happened to draw a
current page.

### 2. Board trap — CLEAR, with a positive control

[MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (with `-r`, per §9.2)
→ **406 tracked paths** (positive control: the query is not blind), **102 at depth 1**,
**tracked depth-1 `*-ready.md` = 0.** 🟢

[MEASURED] 167 tracked `*-ready.md` exist at greater depth — 166 under `superseded/**` and one at
`docs/pr-prompts/processed/pr-resolve-732-site-signin-conflict-ready.md`. The watcher globs depth 1
only, so these are inert; they are litter, not a trap.

[MEASURED] gitignore control, `check-ignore --no-index` (the `--no-index` matters — an in-index path
otherwise reads "not ignored"): `pr-zz-control-ready.md` → `.gitignore:75`, exit 0;
`pr-zz-control-HOLD.md` → exit 1. The instrument distinguishes both cases.

### 3. `docs/pr-prompts/no-pr-opened/` IS NOT GITIGNORED — confirmed live

[MEASURED] `.gitignore:75-82` lists `*-ready.md`, `processed/`, `failed/`, `paused/`, `blocked/`,
`awaiting-review/`, `reviewed/`, `needs-marco/`. Read as **bytes with node**: 5044 bytes,
`U+FFFD = 0`, double-encode signature `= 0` (the file is clean UTF-8; the mojibake `Get-Content`
shows at lines 84/87 is the READER, DOCTRINE §9.3 trap 2 — **do not "fix" it**).
`no-pr-opened` is **ABSENT from .gitignore**.

[MEASURED] `git check-ignore --no-index docs/pr-prompts/no-pr-opened/x.md` → **exit 1 (not ignored)**;
the same probe on `processed/` and `failed/` → exit 0. **107 files** sit in `no-pr-opened/` as
permanent `??` noise in every `git status` in the dev tree.

The fix is already written as `docs/pr-prompts/pr-hygiene-gitignore-no-pr-opened-HOLD.md` — which is
itself **untracked**, so `git mv` cannot arm it (see finding H5).

### 4. Worktrees — 4, all prunable, none holding a lock

[MEASURED] `git worktree list --porcelain` + `.git/worktrees/*` inspection:

| worktree | branch | `locked` | `index.lock` | its PR |
|---|---|---|---|---|
| `C:/po-worktrees/sot-d-register` | `docs/sot-05-d-register` | no | no | **#1287 MERGED** 08-20 |
| `C:/po-worktrees/sot-readme-fetch` | `docs/sot-readme-fetch-plain1` | no | no | **#1299 MERGED** 08-24 |
| `C:/po-worktrees/sotk-03-ledger` | `docs/sot-03-merged-pr-ledger-2026-08-24` | no | no | **#1306 MERGED** 08-24 |
| `C:/po-wt-h` | `hygiene` | no | no | **no PR** — content superseded |

[MEASURED] `hygiene` tip `edef9f59` "docs(queue): disarm sor-s9 for splitting, retire three shipped
prompts". Its four changes are all already on `origin/main` and have since moved further:
`pr-sor-s9-register-to-progress-claim-HOLD.md` now lives under `superseded/`. Nothing is lost by
pruning it.

🟢 **No worktree holds a lock and every `gitdir` target exists** — none of the four is the
"orphan lock with no process by construction" hazard. They are disk litter and four stale branch refs.

### 5. Branch hygiene — and an instrument lie I caught on myself

[MEASURED, FIRST PASS — **WRONG**] `git branch -r` gave 43 remote-tracking refs and I computed
**"25 merged-but-not-deleted"**.

[MEASURED, CORRECTED] `git ls-remote --heads origin` (live, authoritative): **26 branches exist on
origin.** The local repo carries **43** remote-tracking refs, so **17 point at branches that were
deleted on origin and never pruned locally**, and **7 live branches have no local tracking ref at
all** (`feat/arm-prompt-serializer`, `feat/crm-backfill-accounts-script`,
`feat/crm-wincount-s1-tender-win-counted`, `feat/e2e-container-trial-slice-1`,
`feat/ew-2a-capacity-service`, `worktree-agent-a02ffb98aa6f4fcce`, `worktree-agent-ae6eefd9604700b45`).

**Live truth, 26 heads = 1 `main` + 7 open-PR heads + 1 merged-not-deleted + 17 no-PR orphans:**

- **merged-but-not-deleted: exactly ONE** — `docs/retire-stale-queue` (**#1145**, merged 2026-08-17).
- **no PR ever, 17**: `docs/backlog-stage-role-dash-site-picker-39c855` (740 ahead, last commit
  2026-07-16) · `docs/scan-2026-07-16-mail-mi-stage` (737) · `docs/stage-role-default-dashboards-slice1`
  (735) · `docs/ui-acceptance-chain` (754) · `feat/align-page-titles-to-nav` (899) ·
  `feat/density-ratetable-migration` (831) · `feat/sso-silent-autologin` (532, **2026-06-15**) ·
  `fix/tenders-settings-visual-consistency` (857) · `fix/user-dashboards-p2002-race` (917) ·
  `fix/directory-remove-workers-tab-flicker` (25) · `fix/public-form-api-origin` (16) ·
  `docs/bid-prioritisation-plan-slice0` (2) · `feat/bp-slice0-plan` (2) ·
  `feat/humane-api-errors-slice-3-field-dockets` (2) · `docs/ratehub-sor-integration-plan` (1) ·
  `feat/crm-2-relationship-intelligence` (1) · `worktree-agent-a65117552a3ddc9fa` (3).

⚠️ **The generalisable trap: `git branch -r` is a CACHE, not the remote.** Any station computing
"merged but not deleted", "orphan branch" or "does this branch still exist" from `branch -r` without
`--prune` will be wrong — here by 25 vs 1, a 25× overstatement. **Use `git ls-remote --heads origin`.**

### 6. Stashes

[MEASURED] watcher clone `C:\po-watcher\ProjectOperations`: **39** — identical to the 10:10Z reading,
**zero growth in 4 h**. Newest is `watcher-preflight-autostash … 2026-08-24T15:35:04+10:00`
(= 08-24T05:35Z), i.e. **~33 h with no new preflight autostash**, consistent with a watcher that has
not restarted. Oldest two are `stash@{37}` / `stash@{38}` (a `feat/sharepoint-folder-mappings` WIP).
[MEASURED] dev tree `C:\ProjectOperations2`: **11 stashes** — not previously recorded anywhere.
[MEASURED] clone dirty = **41**, and the visible head of it is a block of `D docs/pr-reviews/pr-*.md`
deletions — the clone self-syncs, so this blocks nothing.

### 7. HOLD files whose work already shipped — ZERO, and the control passes

[MEASURED] `node scripts/pipeline/lint-prompt.mjs` run over **all 57 depth-1 `*-HOLD.md`**:
`exit 0 (ADMIT) = 55` · `exit 1 = 2` · **`exit 3` (premise dead / already done) = 0**.
[MEASURED] **Positive control**: the same linter on a known-shipped prompt
(`superseded/cleared-2026-08-20-verified-shipped/pr-migration-naming-guard-ready.md`) → **exit 3**.
The instrument can produce a positive, so the zero is real, not blindness. 🟢

### 8. Queue-root census

[MEASURED] `docs/pr-prompts` depth 1: **117 `.md`** = 57 `-HOLD.md` + 51 `00-*` breadcrumbs +
4 suffix-less `pr-*` + 5 other. **Armed (`*-ready.md`) = 0.**
[MEASURED] Non-`.md` at depth 1: `BACKLOG.yaml` (61,514 b), `ESCALATIONS.yaml`,
`.queue-sync-ledger.txt`, `.queue-sync-ledger.txt.bak-2026-08-18` (both untracked).
[MEASURED] Retired-folder volumes: `processed/` **3,432 files**, `no-pr-opened/` **107**, `failed/` **20**.

---

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No
label changed. No branch, worktree or stash removed. No `git fetch --prune`, no commit, no push.

Two files written outside the board:

1. this breadcrumb, at the tracked path `docs/pr-prompts/00-04-scanner-2026-08-25-1410-…md`
   (**untracked until a board PR commits it** — Station 00 must sweep it up);
2. `docs/pipeline/sweep-rotation.json`, advanced with
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-25T14:10:08Z`.

Scratch `.ps1`/`.mjs` probes were written to `C:\po-sup-fix-scripts\` (outside the repo).

---

## FINDINGS

### H1 — `status-sweep.ps1` prints `[LIVE] TRUNK IS RED` from a page that can be 19 days old (S2)

Evidence in §1. Four back-to-back samples of `status-sweep.ps1:86` against an unchanged `main`
produced **RED once and green three times**; the RED sample's rows were dated 2026-08-06. The
authoritative per-commit read says 11 success / 1 skipped / 0 failures.

Blast radius: every station reads section 1 of the sweep, and the report's own header instructs
readers to "report ONLY from `[LIVE]` lines". A false RED tells a supervisor the trunk is broken when
it is not; a false green is the same defect pointing the other way and is worse.

RULE 1 options for the owning station:

- **(a) COMPLETE + ADDITIVE — read CI per-commit.** Replace lines 86-88 with
  `gh api repos/GH-Mantova/ProjectOperations/commits/<origin/main sha>/check-runs`, parsed with
  `ConvertFrom-Json`, counting `conclusion` and treating `skipped`/`neutral` as not-failures; print
  the SHA next to the verdict so the claim carries its own provenance. Passes both halves: it fixes
  the reading now and forever, and touches no data.
- (b) Keep `gh run list` but add `--json headSha,conclusion` and **discard any row whose `headSha`
  is not `origin/main`.** Fails the *complete* half: it makes a stale page produce "no data" rather
  than a wrong verdict, which is better but still cannot report the current trunk when the API hands
  back an old page.
- (c) Downgrade the line from `[LIVE]` to `[STALE]`. Fails the *complete* half outright — it removes
  the lie by removing the measurement.

**DISPATCHED** — to Station 06 (PR Master) to author the fix as a prompt, and to Station 00 to stop
quoting the trunk colour from the sweep until it lands. Station 04 does not edit `scripts/pipeline/`.

### H2 — the breadcrumb channel is 29 files deep and entirely uncommitted (S2)

[MEASURED] `00-*` breadcrumbs on disk at depth 1: **51**. Tracked on `origin/main`: **22**
(positive control: 406 tracked paths under `docs/pr-prompts`). **29 are on disk and not on main** —
every station report from 2026-08-24 0123Z through 2026-08-25 1208Z, including all five prior
Station 04 breadcrumbs and all eight Station 00 breadcrumbs from today.

This is the exact failure `#1300` was supposed to have closed. It has re-opened because **no
scheduled station may create a PR**, so nothing commits them, and a single `git checkout .` /
`git clean` in the dev tree — a command DOCTRINE §9.2 already forbids for a different reason —
would destroy 29 station reports in one stroke.

**ESCALATED** — this is Marco's, because it is an authority question, not a technical one. The
capability matrix gives *Create a PR* to 02 (on dispatch), 05 (doc-reconcile) and 06 (staging), and
**denies it to 00 and 04**. So the only actor that can commit breadcrumbs is one that never runs
unless dispatched.

RULE 1 options:

- **(a) COMPLETE + ADDITIVE — give Station 00 a standing "sweep the breadcrumbs" docs-only PR.**
  00 already collects every breadcrumb each run; let it open one docs-only PR per run containing
  `docs/pr-prompts/00-*.md` plus `docs/pipeline/sweep-rotation.json` and nothing else, merged under
  the existing `tests-docs` policy. Additive (it only adds files), and permanent (the channel closes
  every 2 h). Requires Marco to grant 00 *create a PR, docs-only, `docs/pr-prompts/00-*` pathspec*.
- (b) Have each station commit its own breadcrumb straight to `main` in the dev tree. Fails the
  *without damage* half — it puts the dev tree ahead of `origin/main` under a live watcher and
  violates "never commit directly to main".
- (c) Leave them untracked and rely on project memory. Fails the *complete* half: memory is capped
  (`MEMORY.md` is already near the read limit) and Station 03 has no memory tool at all.

### H3 — the shared index holds a staged rename to a path that no longer exists (S2, live now)

[MEASURED] `git diff --cached --name-status` in `C:\ProjectOperations2`:
`R100  docs/pr-prompts/pr-arm-lock-s1-serialize-arming-HOLD.md → docs/pr-prompts/pr-arm-lock-s1-serialize-arming-ready.md`
[MEASURED] `Test-Path` on **both** endpoints → **False**. The prompt was armed by `git mv` (Station 00,
12:08Z), the watcher consumed it into a gitignored folder, and the rename is still sitting in the
**index shared by every concurrent chat**.

Consequence: the next chat that runs a bare `git commit` in the dev tree ships a rename of a file that
does not exist, into `main`, re-creating a tracked depth-1 `*-ready.md` — **the board trap, arriving by
the back door.** DOCTRINE §9.2 already mandates the pathspec-commit habit; this is the live instance.

[MEASURED] Alongside it, **14 unstaged deletions** of consumed `-HOLD.md` prompts
(`pr-apierr-s12-ci-gate`, `pr-crm-account-backfill`, `pr-crm-direction-richer-surface-reconcile`,
`pr-crm-leads-page-title`, `pr-crm-route-permission-guard`, `pr-crm-triage-archive-entry`,
`pr-crm-wincount-s1-flag-and-guard`, `pr-crm-winrate-display`, `pr-ew-s2a-capacity-service`,
`pr-lessons-folder-s1-restore`, `pr-nopr-s1-dismissed-means-proceed`,
`pr-nopr-s2-hard-failure-bounded-restage`, `pr-pipeline-fold-s1-any-permission`,
`pr-watchdog-heartbeat-during-merge-wait`). **This was 7 on 2026-08-24; it is 14 now — it doubled in
about a day**, tracking the merge rate.

**DISPATCHED** — to Station 00. The safe drain is `git restore --staged <path>` for the rename (it
touches no file on disk), and the 14 deletions belong in the same hygiene PR as H4/H5. Station 04 is
read-only on the board and does not drain another chat's index.

### H4 — `docs/pr-prompts/no-pr-opened/` is missing from `.gitignore`; 107 permanent `??` entries (S3)

Evidence in §3, with a working negative control (`processed/` and `failed/` both return exit 0 from
the same probe). One line — `docs/pr-prompts/no-pr-opened/` after `.gitignore:82` — closes it.
The prompt that does exactly this is already written and blocked by H5.

**DISPATCHED** — to Station 00, folded into the hygiene PR with H3/H5.

### H5 — two staged prompts are UNTRACKED, so `git mv` refuses to arm them (S2, unchanged since 08-25 12:22Z)

[MEASURED] `?? docs/pr-prompts/pr-hygiene-gitignore-no-pr-opened-HOLD.md` and
`?? docs/pr-prompts/pr-watcher-idle-tick-liveness-HOLD.md`. Arming is a `git mv` of a **tracked**
`-HOLD.md`; `git mv` refuses an untracked path, and the `Move-Item` fallback leaves no audit trail
and no way back. **Two authored prompts are therefore unarmable**, and one of them (H4's fix) is
blocking a defect this sweep independently re-confirmed.

This is a **self-blocking loop**: the prompt that fixes the queue's git hygiene cannot be armed
because of the queue's git hygiene.

**DISPATCHED** — to Station 00: `git add` both files inside the same docs-only hygiene PR as H3/H4,
then they become armable by the normal `git mv`. Nothing else is needed.

### H6 — two HOLD prompts are REJECTed by their own now-satisfied ordering gate (S2)

[MEASURED] The only two non-ADMIT results in the 57-HOLD lint sweep:

- `pr-lessons-folder-s2-unfold-sot05-HOLD.md` → exit 1, **`FILE_GATE_DEAD`**:
  `requires_file_on_main: "docs/lessons-learned/README.md"` is already on `origin/main` (it landed
  with **#1305**, 08-24 18:47Z), so the gate can never fail and imposes no ordering.
- `pr-pipeline-fold-s2-merged-page-HOLD.md` → exit 1, **`CLUSTER_DEAD_GATE`**:
  `requires_on_main: "apps/api/src/common/auth/permissions.decorator.ts :: ANY_PERMISSIONS_KEY"` is
  already on `origin/main` (it landed with **#1313**, 08-25 06:46Z).

Both are **successor slices whose predecessor has merged**. The linter is behaving correctly — but
the effect is that a merged predecessor converts its successor from armable to **permanently
REJECTed** until a human removes the now-dead gate key. That is a *systemic* shape, not two isolated
typos: every `requires_on_main` / `requires_file_on_main` chain in the queue acquires this defect the
moment its predecessor lands.

Per the ADVERSARIAL PROMPT CRITIQUE report-not-run rule, **I did not edit either prompt.** The fix in
both cases is to drop the satisfied key (or re-point it at a needle the *next* predecessor
introduces).

**DISPATCHED** — the two prompts to Station 06 to repair; the systemic shape to Station 00 to decide
whether `lint-prompt.mjs` should distinguish "dead gate, predecessor never merged" (a real REJECT)
from "dead gate, predecessor merged" (which is a *promotion* signal, arguably exit 0 with a WARN).

### H7 — worktree and branch litter: 4 prunable worktrees, 1 merged branch, 17 orphan branches (S3)

Evidence in §4 and §5. All four worktrees are lock-free and their work is on `main`; one origin
branch is merged-and-undeleted (`docs/retire-stale-queue`, #1145); seventeen origin branches have
never had a PR, six of them 700–920 commits behind and one dating to 2026-06-15.

Note the ordering hazard: `git worktree remove` for `C:/po-wt-h` must come **before** any attempt to
delete the `hygiene` branch, and no branch on this list may be deleted without re-reading
`ls-remote` immediately first — branch deletion is irreversible and lands in DOCTRINE §5 item 4.

**DEFERRED.** It costs nothing today: no lock, no freeze, no wrong reading follows from it (H5's
`branch -r` lie is the only reading it affected, and that is a *local cache* problem cured by
`git fetch --prune`, not by deleting anything on origin). It becomes urgent the moment (i) a station
needs a fresh worktree name that collides, or (ii) `status-sweep.ps1`'s "orphaned worktrees:
investigate/prune" line causes a station to prune one while another chat is inside it. The safe first
step, which mutates nothing on origin, is **`git fetch --prune origin` in the dev tree** — it
reconciles 17 stale refs and 7 missing ones and repairs every future `branch -r` reading.

**DISPATCHED** — `git fetch --prune origin` to Station 00 (it is not a board mutation and not a
tracked-file write, but it is a git write in a shared tree, which is 00's lane, not mine).
The worktree/branch deletions stay **DEFERRED** pending Marco, since branch deletion is irreversible.

---

## WHAT I DID NOT DO

- **Armed, disarmed, renamed or moved nothing.** Station 04 is read-only on the board.
- **Did not drain the shared index** (H3) even though `git restore --staged` is safe and the fix is
  one command — another chat staged it, and I am not the actor that owns it.
- **Did not run `git fetch --prune`, `git worktree prune`, `git worktree remove`, `git stash drop`,
  or any branch deletion.** Reported instead. Branch deletion is a §5 hard stop.
- **Did not edit `pr-lessons-folder-s2-unfold-sot05-HOLD.md` or
  `pr-pipeline-fold-s2-merged-page-HOLD.md`** (H6) — the ADVERSARIAL PROMPT CRITIQUE section forbids
  the scanner silently repairing a prompt it is critiquing.
- **Did not commit this breadcrumb or `sweep-rotation.json`.** The station doc says to commit them;
  the capability matrix denies Station 04 the ability to open a PR, and committing to `main` in the
  live dev tree under a running watcher is worse than leaving them untracked. **This is a genuine
  contradiction between `docs/pipeline/stations/04-scanner.md` and
  `docs/pipeline/STATION-CAPABILITIES.md` §5, and it is the mechanism behind H2.** Station 00 should
  resolve it in the doc, not in a run.
- **Did not "fix" the mojibake at `.gitignore:84/87`** — measured as clean UTF-8 with node; the
  mangling is `Get-Content`'s (DOCTRINE §9.3 trap 2).
- **Did not touch Azure / Entra / SharePoint, production data, or any merge.** Six open PRs remain
  watcher-routed to Marco; nothing about this run interacts with them.
- **Did not run Part 0 / Part 1 / Part 2 of the legacy station brief.** The AUTHORITY section is
  explicit: ONE named sweep per run, chosen by `next-sweep.mjs`, covered completely. This run was
  `repo-hygiene`. Next rotation position is 4 of 4.
