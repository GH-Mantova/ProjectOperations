# Station 00 — Supervisor | 2026-09-21T22:15Z–2026-09-21T22:5xZ

## GROUND

```
UTC            2026-09-21T22:15:24Z
origin/main    4e0d4087               (git fetch origin +refs/heads/main:... then git rev-parse)
dev tree       main @ 4e0d4087        C:\ProjectOperations2
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                      (scheduled-task SKILL.md, station_doc_version comment)
```

Doc version and bootstrap **AGREE** — no read-only clamp. Desktop Commander connected on the
first call; this run was **sighted**.

**Which tree the binding documents were read in:** the dev tree, `C:\ProjectOperations2`, after
`git fetch origin +refs/heads/main:refs/remotes/origin/main`. PREFLIGHT step 2 requires reading
from `origin/main` rather than the working copy; the working copy was **proved equal to it**
first, by the sanctioned non-piped form:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md`
→ **EMPTY**, with `HEAD == origin/main == 4e0d4087`. No piped `hash-object` comparison was made
(PREFLIGHT step 2's unsoundness note).

## WHAT I MEASURED

**M1 — Desktop Commander reachable. [MEASURED]** `start_process` shell `powershell.exe` returned
`2026-09-22 08:14` local / `main` @ `4e0d4087` on the first call. Tool schemas were loaded via
`ToolSearch` first, per PREFLIGHT step 1.

**M2 — vm-git-guard installer's last line, quoted as the contract requires. [MEASURED]**

```
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/nice-charming-fermat/.local/bin/git - refuses mounted paths
  and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

**It says passed. It is not in effect.** See F1 — and note that I quoted this line in this very
block before measuring it, which is the defect's whole cost.

**M3 — the board. [MEASURED]** `status-sweep.ps1`, generated `2026-09-21 22:15:24Z`, drained to
`0 remaining` across repeated `read_process_output` calls with explicit offsets (§9.1).

| | |
|---|---|
| section 0 controls | `gh CAN reach GitHub (saw merged PR #2064)` · `node runs` — **no `[BROKEN]`** |
| open PRs | **2** |
| `#2059` | `CLEAN`, **15 pass / 0 fail / 0 pending**, labels `[]`, files: `scripts/pipeline/status-sweep.ps1` only |
| `#2061` | `BLOCKED`, labels **`[do-not-merge]`**, head `feat/scopecards-s5-charge-steps-price` |
| main CI on `4e0d4087` | 4 success / 0 failed — **trunk green** |
| watcher | node **RUNNING pid 9744**, wrapper alive (1), heartbeat 12 min |
| armed (`*-ready.md`) | **0** — counted myself, `ls -1 *-ready.md` → none (Q3) |
| depth-1 `-HOLD.md` | 16 |

**M4 — the safe-to-act gate, re-derived from its own sources immediately before acting
(§7: `[LIVE]` expires). [MEASURED]** `index.lock` in `C:\ProjectOperations2\.git` and
`C:\po-watcher\ProjectOperations\.git` → **both absent**; `Get-CimInstance Win32_Process` for
`git.exe` matching `ProjectOperations` → **0**; `git diff --cached --name-status` in the dev tree
→ **EMPTY** before every commit (§9.2 shared-index rule).

**M5 — breadcrumb freshness. [MEASURED]** `node scripts/pipeline/check-breadcrumb.mjs --freshness`
→ `CLEAN`, exit **0**; `structure: 3 checked, 0 malformed`. All five stations `ok`.
⚠️ The `00` row reads `(cadence 2h)` — the known wrong `const CADENCE =` row in
`check-breadcrumb.mjs` (`'00': 2` against a live cron of `5 * * * *`), already recorded in
`STATION-CAPABILITIES.md` §6 and filed for Marco. Not re-filed here. It makes `ok` a weaker
statement about `00` than about any other station.

**M6 — dev tree state. [MEASURED]** `git status --porcelain` → **no tracked modifications at
all**; 17 `??` untracked entries (13 `docs/pr-reviews/pr-*.md` review verdicts the `rev-` job
writes by design, `queue-watch-state.md`, `.queue-sync-ledger.txt`, 04's breadcrumb, and
`Claude Design/docs/index.html`). **`docs/pipeline/sweep-rotation.json` is NOT dirty** — confirming
Station 04's claim that it left the rotation un-advanced (its F3).

**M7 — no `[STALE]` escalation rows this run. [MEASURED]** The station doc's COLLECT step warns of
section-5 rows tagged `[STALE]` that are 00's to clear. Section 5 produced **none** on this run:
every row reads the newer, correct wording — *"cites #N (MERGED) as evidence — not its premise;
does not clear the escalation"* — or *"names no subject PR … section 5 CANNOT decide … read the
file"*. The blanket-tag behaviour that produced the eleven dead rows appears to have been
replaced. **Nothing was discharged this run, because nothing was tagged.**

## WHAT CHANGED

1. **PR #2065 opened** — `fix(pipeline): vm-git-guard self-certifies success while inert in the
   shell every station gets`, branch `fix/vm-git-guard-honest-reachability`, commit `4ffb8439`,
   one file, `81 insertions / 5 deletions`. **Auto-merge NOT enabled** (lane: Marco's — see F1).
   Built in a disposable worktree `C:\po-wt\guard-fix` off `origin/main`, never in a shared tree.
2. **This board PR** — sweeps up Station 04's untracked breadcrumb, archives two dispositioned
   Station 00 breadcrumbs, and lands this report.

**Nothing armed** (0 armed before, 0 after — there was nothing gate-cleared to arm and no prompt
was promoted). **Nothing merged. No label touched. No watcher restarted** (verdict was not
WEDGED/DOWN — node running, wrapper alive, heartbeat 12 min). **No `/sot/` edit. No Azure, Entra
or SharePoint. No production data.**

## FINDINGS

### F1 — the preflight guard every station runs certifies itself `passed` and is inert. Reproduced independently, and half the proposed remedy is impossible

**Severity: S2. Source: Station 04 breadcrumb `…-2026-09-21-2210-BLIND-dc-connect-timeout.md`,
F2 — COLLECTED, reproduced, and fixed.**

04 found it blind at 22:10Z. I reproduced it sighted at 22:2xZ in a **different sandbox**
(`nice-charming-fermat` vs 04's `kind-practical-einstein`), same day:

| probe | result |
|---|---|
| installer's final line | `… (three controls passed)` / `persistence controls passed` |
| `bash -lc 'command -v git'` | `$HOME/.local/bin/git` — the shim |
| `bash -c  'command -v git'` | **`/usr/bin/git`** — the real git |
| `bash -c 'cd $HOME/mnt/ProjectOperations2 && git rev-parse --short origin/main'` | **`4e0d4087`, exit 0 — ALLOWED** |
| same call, `PATH="$HOME/.local/bin:$PATH"` — POSITIVE control | **exit 99 — REFUSED** |

**The mechanism is sharper than "the PATH export isn't sourced".** All three logic controls in the
installer force `PATH="${BIN}:${PATH}"` *on the call they test*, so each proves the shim's **logic**
and none proves its **reachability**. The single reachability control was `bash -lc` — a **login**
shell, the one shape no station is ever given — and it passes while the guard is inert.

🔴 **Two of 04's three proposed remedies are unavailable, and I measured that rather than
assuming it.** 04 recommended *"set `BASH_ENV` … or install the shim somewhere already on the
default `PATH`"*. `/usr/local/bin` and `/usr/local/sbin` are both **non-writable** in this VM, and
`BASH_ENV` cannot be exported from a child process into its caller. **A fix built on either half
would have failed.** Automatic protection is not on the table in this harness.

🔴 **A trap inside the fix, caught by §7 and kept in the file.** My first cut probed with a bare
`bash -c` and reported `ACTIVE` in **three different worlds** — including one where I had deleted
the shim, because the installer recreates it and `ensure_on_path` had already put `BIN` on the
*installer's own* exported PATH, which the child inherited. That is the same lie in a new coat.
The cure is `CALLER_PATH`, captured **before** `ensure_on_path` runs. Post-fix control rows, both
directions, run against the **exact committed bytes** (blob `fec59bb85a675bd999bce7ec5b959a9277a94d54`,
hash matching on both transports):

| caller's PATH | verdict | exit |
|---|---|---|
| ambient — a station's shape | `INSTALLED BUT INERT` | **2** |
| `BIN` on PATH — POSITIVE control | `ACTIVE` | **0** |
| shim logic unchanged (`git status` from inside the mount, shim forced) | REFUSED | **99** |

**No station doc changes are needed** — the canonical PREFLIGHT block already says *"quote the
installer's last line, pass or fail"* and *"a failed install is a FINDING, not a STOP"*. No
canonical-block re-record, no seven-document ship.

**DISPOSITION: ACTIONED** — **PR #2065**, CI **9 pass / 0 fail / 5 pending** at time of writing,
verified by running the committed blob end-to-end in both directions. 🔴 **The merge is Marco's:**
`scripts/pipeline/` is outside `tests|docs`, so `classifyPolicyFiles` refuses it and §10.1 step 2
applies; the step-3 station-lane exception does not cover it, because 00's recorded lane is
`docs/` and a lane outside `tests|docs` needs a CI gate proving its boundary. Auto-merge was
deliberately not enabled.

### F2 — Desktop Commander blindness: 04's sample is real, and this run is the counter-sample

**Severity: S2. Source: Station 04 F1 — COLLECTED.**

04 recorded `CONNECT_TIMEOUT … after 30000ms` at 22:10Z and ran fully blind. **Five minutes
later I connected on the first call.** That is one more confirmation of
`STATION-CAPABILITIES.md` §2's *"blindness is intermittent and its cause is not known"*, with the
two samples closer together than any pair previously recorded.

**This is already on file** as `needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`,
open since 09-01. 04's contribution that is genuinely new is the **quotable error string** —
`CONNECT_TIMEOUT ... after 30000ms` — which points at a handshake cost rather than an absent
server, and which previous samples did not carry. I have **not** opened a second escalation: a
duplicate would split the evidence for one question.

**DISPOSITION: ESCALATED** — to the existing open file, not a new one. The question for Marco is
unchanged and is 04's option 1, which is the RULE 1 complete-and-additive one: **raise the
Desktop Commander MCP connect timeout**, since if the cause is a slow handshake on a cold host
that removes the failure rather than detecting it afterwards, and it risks no data. Option 2
(instrument only) is additive but fails the immediate half. Option 3 (treat blindness as weather)
fails both. The fix touches plugin/MCP configuration, which no station may change.

### F3 — the instruction-drift sweep is unreachable exactly when Desktop Commander is down

**Severity: S3. Source: Station 04 F3 — COLLECTED, and its safety property verified.**

04's due sweep was `instruction-drift`, whose corpus (`C:\Users\Marco\Claude\Scheduled\**`) is
reachable only through the tool that had just failed. 04 left the rotation un-advanced, which is
what makes this self-correcting — and **I verified that rather than taking it on trust**:
`git status --porcelain` in the dev tree shows `docs/pipeline/sweep-rotation.json` **not dirty**
(M6), so the next sighted 04 run gets `instruction-drift` in full.

**DISPOSITION: DEFERRED** — real, not now, and 04's own deferral reasoning is sound. **What would
make it urgent:** two consecutive blind runs landing on `instruction-drift`, or the rotation
stuck at position 4 for more than about a day.

### F4 — `#2059` fixes the stale-state-summary quote the sweep is still making, and it is green and waiting

**Severity: S3. [MEASURED] this run.**

The sweep's section 4C quoted `queue-watch-state.md` dated **08-31 20:26Z** — **three weeks
stale** — as its *"freshest station summary"*, with claims about a four-PR board that no longer
exists. `#2059` (`fix(status-sweep): 4C refuses to quote a state summary older than 3 days`) is
**exactly that fix**, is `CLEAN`, **15 pass / 0 fail**, and carries **no labels**. It touches only
`scripts/pipeline/status-sweep.ps1`.

**DISPOSITION: ESCALATED** — 🔴 **it is Marco's to merge, for the same lane reason as F1**
(`scripts/`, outside `tests|docs`, §10.1 step 2; no watcher verdict names it — it is second-lane).
No action available to this station beyond saying so. It is green, mergeable, and the defect it
removes is one every station currently reads as `[FILE]` evidence.

### F5 — `#2061` is parked by design, not broken

**Severity: none — recorded so the next run stops re-reading it as work. [MEASURED].**

`#2061` reads `BLOCKED` with `11 pass / 2 fail / 2 pending`, which looks like a red board. It
carries **`do-not-merge`**, and DOCTRINE §9.4 records that such a PR **can never be green and
shows as two reds with one cause** — `approval-receipt-check.mjs` returning
`FAIL - CP-26 … [LABEL_PRESENT]`, which runs both as the required check and as a step inside
`PR gates — diff checks`. **Only Marco removes the label.**

**DISPOSITION: DEFERRED** — nothing for an agent to do. Three consecutive collect runs have
previously listed such PRs among "the reds" as though they were work; this line exists so the
next one does not.

### F6 — the `po-vg` worktree still holds 17 days of uncommitted work, and it is still on file

**Severity: S3. [MEASURED] this run, from the sweep.**

`C:/PR-Master/worktrees/po-vg` (`23c91ba9`, `fix/no-rebase-while-checks-run`) — **dirty=1 file,
age 25342 min ≈ 17.6 days**, flagged `HOLDS UNCOMMITTED WORK … PRESERVE OR COMMIT BEFORE
PRUNING`. Separately, one registry escapee: `C:\po-worktrees\po-fix-2005`, `size=0KB`,
`age=6157min`, `.lock=False`.

Already open as `needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`.
**Not re-filed.** I did not touch either, and I did not run `git status` in `po-vg` to enumerate
the file — the sweep's own line already names the safe command and the tree belongs to a lane I
did not open.

**DISPOSITION: DISPATCHED** — to **Station 03 (machine-minder)**, which owns worktrees and local
trees: review `po-fix-2005` and prune if confirmed dead, and preserve-or-commit `po-vg`'s single
dirty file before anything prunes it. ⚠️ 03's authority row is **report-only**, so if this needs
a destructive step it returns to Marco rather than being executed by 03 — that limit is why this
is named here and not assumed handled.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs are Marco's by lane (F4, F5), and the two I opened
  this run are mine to drive, not to self-merge.
- **Did not enable auto-merge on #2065.** Deliberate — `scripts/` is outside `tests|docs` and
  outside 00's recorded `docs/` lane.
- **Did not arm anything.** 0 armed before and after; nothing was gate-cleared and pending. No
  `-HOLD.md` was promoted, so no `.arming-log.txt` line exists for this run and the
  append-only-file FF trap does not apply.
- **Did not restart the watcher.** Verdict was not WEDGED or DOWN: node `pid 9744` running,
  wrapper alive, heartbeat 12 min. `restart-watcher-if-wedged.ps1 -Fix` runs only on
  WEDGED/DOWN, and killing a healthy watcher is worse than the stall it would be fixing.
- **Did not touch `/sot/`** (Station 05's, CP-24), **Azure / Entra / SharePoint** (absolute), or
  **production data**.
- **Did not clear the sweep's `[STALE]` escalation rows** — there were none (M7). Nothing was
  moved to `needs-marco/discharged/`.
- **Did not open a second blindness escalation** (F2) — the existing one would have been split.
- **Did not run `check-breadcrumb.mjs` on this file before writing it**; Station 00 runs it
  against this breadcrumb in the same board PR, and the result is quoted below the fold rather
  than asserted here. **Do not read `breadcrumb-clean` anywhere above** — it does not appear.
- **Did not diagnose any CI failure from a diff.** No CI failure needed diagnosing: trunk is
  green and the only red on the board is `#2061`'s label-caused CP-26 pair.
