# Station 00 — Supervisor | 2026-09-21T20:15Z–2026-09-21T20:24Z

> **THIS WAS A BLIND RUN.** Desktop Commander did not connect. No PowerShell shell was ever
> started on the Windows host, so `status-sweep.ps1`, `pipeline-lib.ps1`, `arm-prompt.ps1`,
> `smoke-pr.ps1`, `check-breadcrumb.mjs` and `gh` were all unavailable. **Nothing was armed,
> dispatched, merged, labelled, moved or committed.** COLLECT did not happen.
> A blind run and a healthy quiet run both produce "no news" — this was the blind one.

## GROUND

```
UTC            2026-09-21T20:15:00Z
origin/main    a31e86d5              (GitHub API read — NOT a local fetch; see caveat below)
dev tree       main @ a138460e       C:\ProjectOperations2  (3 commits behind origin/main)
doc version    1                     (station_doc_version, read from the WORKING COPY)
bootstrap      1
```

Doc version and bootstrap **AGREE** (1 == 1). This run is READ-ONLY because of **blindness**,
not because of a version mismatch.

⚠️ **GROUND CAVEAT — the required instrument was unavailable.** PREFLIGHT step 2 requires all
three binding documents be read via `git show origin/main:<path>` **in the dev tree**, and step 3
requires `git fetch` then `git rev-parse`. Both need the PowerShell shell I could not start, and
the VM git guard (correctly) refuses `git` against the mount. So:

- `origin/main a31e86d5` is a **GitHub API read**, not a local rev-parse. Tagged accordingly below.
- `dev tree a138460e` is a **raw file read of `.git/refs/heads/main`**, not `git rev-parse`.
- The three binding documents were read from the **stale working copy**, which is the thing
  PREFLIGHT explicitly forbids. The staleness is quantified and bounded under WHAT I MEASURED —
  it turned out benign for this run, but that is a measurement, not a licence.

## WHAT I MEASURED

**[MEASURED] VM git guard installed — PREFLIGHT step 1 prerequisite, quoted as the contract demands.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → exit 0. Last lines:

```
vm-git-guard installed at /sessions/eloquent-adoring-cray/.local/bin/git - refuses mounted paths
and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

The guard held for the whole run: no `git` was invoked against the mount at any point.

**[MEASURED] Desktop Commander is unreachable — this is blindness, not an unloaded schema.**
The contract's own trap was avoided in the prescribed order:

1. Keyword `ToolSearch` for `desktop-commander` — the environment-agnostic form the doc mandates,
   not a hard-coded `select:` of ids. First call: *"Some MCP servers are still connecting:
   plugin:desktop-commander:desktop-commander. Their tools will become available shortly."*
2. Waited, re-searched. Second call resolved to a terminal state:
   `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
   plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`.

That is a failure **after** the load attempt, on a server that reported itself as connecting and
then timed out — not an `InputValidationError` from a cold call. `start_process` was therefore
never callable. **Per PREFLIGHT step 1, this is a STOP.**

**[MEASURED] Dev tree is 3 commits behind origin/main, and is NOT ahead — no NO-DRIFT violation.**
Read from `.git/refs/*` as files (no git invoked):

```
refs/heads/main            a138460e7cb8520cc4e29933fb8ae4643dd0dd35
refs/remotes/origin/main   b8d3dc1a960925473241df1e4d3711d34625e088
.git/FETCH_HEAD mtime      2026-09-21T19:57:21Z  (~18 min before this run)
```

Cross-referenced against the GitHub commit list for `main`:

| SHA | PR | merged (UTC) | position |
|---|---|---|---|
| `a31e86d5` | #2049 | 20:12:36Z | **origin/main HEAD** |
| `b8d3dc1a` | #2044 | 19:56:08Z | dev tree's `origin/main` tracking ref |
| `a138460e` | #2060 | 19:33:04Z | **dev tree checkout** |

`a138460e` is an **ancestor** on `main`, so local `main` carries nothing absent from origin.
The five-commit drift incident of 2026-08-27 has **not** recurred. This is ordinary lag, and
`pr-devtree-sync-ff-only-guard-HOLD.md` (queued since 2026-08-28) is the standing fix.

**[MEASURED] The stale working copy DID serve me a superseded station doc — and it was benign.**
Exactly the 🔴 hazard at PREFLIGHT step 2. The newest of the three missing commits, **#2049**
(`a31e86d5`, 20:12:36Z — two minutes before this run started), modified
`docs/pipeline/stations/00-supervisor.md`. Its GitHub file stats read **+1 / −1**, and its commit
message states: *"Bump contract_version 1 -> 3 in the front matter of all seven station docs …
Canonical block bodies are untouched."* So the single changed line is `contract_version`, which
the bootstrap does not compare; `station_doc_version` stayed **1**, and the PREFLIGHT body I acted
on is byte-current. **The version match was not the proof — the commit diff was.** Recorded because
the doc's own warning is that a version match can never establish freshness, and here is a live
instance where it didn't have to.

Consequence of the same lag, harmless but worth naming: `pr-lintstation-contract-version-compare-HOLD.md`
is still sitting in the dev-tree queue root, though #2049 already retired it to
`docs/pr-prompts/superseded/`. It will clear on the next pull. **It must not be re-armed.**

**[MEASURED] Station freshness by `lastRunAt` — no station is SILENT.**
`list_scheduled_tasks` (scheduled-tasks MCP), read at 20:16Z:

| station | cadence | lastRunAt | age | read |
|---|---|---|---|---|
| `00-supervisor` | hourly (`5 * * * *`) | 2026-09-21T20:13:58Z | — | **this run** |
| `04-scanner` | 4 h (`0 */4 * * *`) | 2026-09-21T18:09:36Z | 2.1 h | ok |
| `03-machine-minder` | daily (`0 9 * * *`) | 2026-09-21T00:20:35Z | 19.9 h | ok |
| `05-sot-keeper` | daily (`10 0 * * *`) | 2026-09-21T14:10:40Z | 6.1 h | ok |
| `weekly-security-audit` | Mondays | 2026-09-06T21:32:44Z | 14.9 d | **disabled** |

⚠️ This is **one instrument and it cannot name a cause.** `--freshness` was not run (needs
`git ls-tree`, refused by the guard), and `lastRunAt` holds only the most recent occurrence, so it
cannot answer whether an *earlier* one fired. The session-directory scan that would answer it needs
the Windows shell. **Treat this row as "no alarm raised", not as "all stations healthy."**

**[MEASURED] Board state, GitHub-side. THIS IS NOT COVERAGE.** Recorded only so the next sighted
run starts warm; `origin/main` is not the tree the watcher globs, and I am not presenting it as a
sweep. Three PRs open: **#2059** (`fix/sweep-4c-stale-state-summary`), **#2051**
(`feat/ops-m2b-tipping-review`), **#2047** (`feat/role-grant-registry-v1`). Labels were requested
in the field set and **were not returned**, so I know nothing about `do-not-merge` or hold state on
any of them — and I could not have merged regardless, since `Assert-SmokedOrEscalate` and `Merge-Pr`
both need the shell.

**[MEASURED] Queue census (filesystem globs only, stale tree).** Root: 29 `.md` — 19 `-HOLD.md`,
2 `-ready.md`, 2 uncollected breadcrumbs. `needs-marco/` 63 files. `archive/` 638 files.
No `index.lock`. No `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD`, no `rebase-merge`,
`rebase-apply` or `sequencer` — the tree is at rest.

**[MEASURED] Two `-ready.md` is NOT a double-arm — I checked before writing it up as one.**
My first reading of the census was that ARM-ONE-AT-A-TIME had been breached. It has not. The two
files are different lanes:

- `rev-2060-ready.md` — a **review** prompt auto-fired by the PR-watcher for PR #2060, whose only
  output is a verdict file. Not a build arming.
- `pr-scopecards-s5-charge-steps-price-cutting-ready.md` — the one genuine build arming.

Recorded as a corrected instrument reading rather than deleted, because "two ready files" is going
to look like a breach to the next reader too.

**[MEASURED] The one armed build prompt is LIVE and its dependency gate cleared 45 minutes ago.**
`pr-scopecards-s5-charge-steps-price-cutting-ready.md`, armed since 2026-09-16:

- premise `! test -f apps/api/src/modules/rates/charge-step-pricing.service.ts` → file **absent**
  → **premise TRUE, prompt live** (not a consumed leftover).
- `requires_on_main: apps/web/src/pages/tendering/ClientQuotesPanel.tsx :: QUOTE_PUSH_PANEL_V1`
  → marker present, **3 occurrences**. That marker landed on `main` with **#2042** at
  **19:29:44Z**, i.e. four minutes before the checkout this was measured in, and ~45 minutes
  before this run. The gate it had been waiting on since 09-16 is now **satisfied**.
- front matter carries **`escalates: true`** and `gate_allow: migrations`.

**[CANNOT MEASURE]** — all requiring the Windows shell: `status-sweep.ps1` and its section 5
`[STALE]` escalation rows; `check-breadcrumb.mjs --freshness`; `lint-prompt.mjs` on the armed
prompt; CI/check state and labels on #2059 / #2047 / #2051; session-directory occurrence scan;
whether any of the 63 `needs-marco/` files are now PR-dead.

**[CANNOT MEASURE] This breadcrumb is UNVALIDATED.** `check-breadcrumb.mjs` could not be run —
it builds its tracked set with `git ls-tree`, which the guard refuses against the mount, and the
shell that would run it properly is the thing that is missing. **Do not read "breadcrumb-clean"
anywhere in this file, because it is not claimed.** Shape was written to the contract by hand.

## WHAT CHANGED

**Nothing.** No prompt armed or retired, no PR merged or relabelled, no auto-merge enabled, no
file moved, no branch created, no commit, no `sot/` edit, no escalation discharged. The only write
this run performed anywhere is this breadcrumb file itself, left **untracked** in the dev tree at
`C:\ProjectOperations2\docs\pr-prompts\` for `sweep-breadcrumbs.ps1` to batch onto a branch.

## FINDINGS

### F1 — Station 00 ran blind: Desktop Commander timed out, and an hourly station means this is expensive

Desktop Commander reported "still connecting", then `CONNECT_TIMEOUT` after 30 000 ms. Every
PowerShell-side instrument was unavailable, so the station's entire lane — ARM, DRIVE, MERGE,
and COLLECT — was inert for this occurrence. The bootstrap records blindness at roughly 40 % of
recent Station 00 runs with **cause unknown**; this run adds one more data point and, for the
first time, a *specific* failure mode rather than a bare absence: the server was present in the
session, entered a connecting state, and timed out at exactly 30 s. That is a startup-latency
signature, not a missing-configuration one.

Live cost this occurrence: one armed, premise-live prompt whose gate cleared 45 minutes ago sat
unarmed-upon (F2), and two breadcrumbs went uncollected (F4).

**RULE 1 options for Marco — complete-and-additive first:**

1. **Raise the Desktop Commander MCP connect timeout and add a bounded retry in the station
   bootstrap** (e.g. three attempts, 30 s apart, before declaring blindness). *Solves it
   immediately and in future; additive — no existing behaviour removed, no data touched. If the
   30 s timeout is the whole story, this converts ~40 % blind runs into slow-but-sighted ones,
   and a station that still fails all three attempts is genuinely blind and stops as it should.*
   **Passes both halves of RULE 1.**
2. **Instrument only: have the bootstrap log MCP server state and elapsed connect time on every
   run, then re-decide in a week.** *Additive and safe, but fails the "solves it immediately"
   half — it buys diagnosis at the price of another week of ~40 % lost occurrences.*
3. **Accept blindness and lengthen the cadence** so fewer occurrences are wasted. *Fails both
   halves: it does not solve the fault, and it reduces board coverage.* Named only to be rejected.

Option 1 needs a decision on where the timeout is configurable from — which is Marco's call, not
mine, and touches session/app configuration rather than the repo.

**DISPOSITION: ESCALATED** — Marco. Question above with three options, not a status update.

### F2 — `pr-scopecards-s5-charge-steps-price-cutting-ready.md` is armed, live, gate-satisfied, and `escalates: true`

Premise TRUE, `requires_on_main` marker confirmed present on the checkout (3 occurrences), gate
cleared by #2042 at 19:29:44Z. It has been armed and waiting since 09-16 and is now eligible.
It carries `escalates: true`, so under the ACTIVE DRIVE MANDATE it is **opened and driven green
but NOT auto-merged** — it is left for Marco. I could not run `lint-prompt.mjs` against it, and
lint ADMIT is necessary-not-sufficient anyway (DOCTRINE §9.5).

Not urgent in the sense that nothing degrades while it waits; it simply has no owner until a
sighted Station 00 occurrence runs. It becomes urgent if blindness persists across several more
occurrences, because the S-cluster serialises behind it (`cluster_order: 7`).

**Probe for the next sighted run, in order:** re-run `status-sweep.ps1` and confirm SAFE TO ACT →
`lint-prompt.mjs` on the file → re-test the premise (it may have been built in the interim) →
re-confirm `requires_on_main` against a *fetched* `origin/main`, not this stale checkout.

**DISPOSITION: DEFERRED** — to the next sighted Station 00 occurrence, with the probe above.

### F3 — Dev tree is 3 commits behind, and it served this run a superseded copy of its own station doc

Quantified under WHAT I MEASURED: `a138460e` vs `a31e86d5`, with #2049 modifying this very station
doc two minutes before the run began. The staleness was **benign this time** — the diff was a
single front-matter line that the bootstrap does not compare — but that was luck, established
after the fact by reading the commit stats, and it is precisely the failure the 2026-08-29
incident records. No NO-DRIFT violation: local `main` is behind, never ahead.

The standing fix is already queued as `pr-devtree-sync-ff-only-guard-HOLD.md` (since 2026-08-28).
It becomes urgent the moment a station doc changes **substantively** without a
`station_doc_version` bump, since nothing in the current preflight would catch it from a stale
tree — which is the exact scenario the doc's own 🔴 warns about.

Secondary, same cause: `pr-lintstation-contract-version-compare-HOLD.md` still sits in the dev-tree
queue root although #2049 retired it to `superseded/`. **It must not be re-armed**; it will clear
on the next pull.

**DISPOSITION: DEFERRED** — fix already queued; this run adds a dated instance to its evidence.

### F4 — COLLECT did not run; two breadcrumbs remain uncollected

`00-00-supervisor-2026-09-21-1914-…` and `00-04-scanner-2026-09-21-1810-…` are both in the queue
root, uncollected and undispositioned. COLLECT is Station 00's job and nobody else reads
breadcrumbs, so a blind 00 occurrence means those findings simply wait. `--freshness` could not be
run to check for malformed or silent reports either.

Also untouched: the `needs-marco/` queue at **63** files. Section 5 `[STALE]` rows could not be
read (no sweep), so I cannot say how many are PR-dead. The 2026-09-10 measurement found eleven
dead of 57; the queue has grown by six since.

**DISPOSITION: DEFERRED** — to the next sighted occurrence, which should collect all three
breadcrumbs (the two above plus this one) in one pass.

### F5 — `weekly-security-audit` has been disabled for 15 days

`enabled: false`, `lastRunAt 2026-09-06T21:32:44Z`, no `nextRunAt`. Whether this was deliberate is
not something I can determine from the task listing, and I did not have the shell to look further.
Read-only GitHub security baseline audit, so nothing is at risk *right now* from its absence —
it becomes urgent if it was disabled accidentally, because nobody is watching for that.

**DISPOSITION: ESCALATED** — Marco, one question only: was this intentional? If yes, this finding
retires permanently and should be recorded as known so no future station re-raises it. If no,
re-enable it.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for a board sweep.** The PR list and commit history above
  are tagged and fenced as warm-start context, not coverage. `origin/main` is not the tree the
  watcher globs, and no verdict about the board is drawn from them.
- **Did not arm, merge, label, dispatch, move or discharge anything.** Step 1 failed; a blind
  station has no business mutating a board it cannot measure, and every merge path requires
  `Assert-SmokedOrEscalate`, which was unavailable.
- **Did not run `git` against the mount**, by hand or otherwise. The guard was installed first and
  held. `.git/refs/*` were read as plain files instead, which is why the GROUND block names the
  method rather than claiming a `rev-parse`.
- **Did not do 03 / 04 / 05's work** (LL-38) — and could not have dispatched to them either,
  since dispatch travels by breadcrumb and they wake on their own clocks.
- **Did not clear section 5 `[STALE]` escalation rows.** They are mine to clear, but clearing
  requires re-asking each PR individually with `gh` plus a negative control, and `gh` was
  unavailable. Clearing on the tag alone is what produced the ten-day-dead escalations.
- **Did not claim this breadcrumb validates.** `check-breadcrumb.mjs` was not run and
  `breadcrumb-clean` is not asserted anywhere above.
- **Did not touch Azure / Entra / SharePoint, production data, or `sot/`.**
