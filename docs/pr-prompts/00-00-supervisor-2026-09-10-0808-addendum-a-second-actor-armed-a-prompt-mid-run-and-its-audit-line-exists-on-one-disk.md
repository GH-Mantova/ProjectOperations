# Station 00 — Supervisor | 2026-09-10T08:08Z–2026-09-10T10:3xZ (ADDENDUM to the 0808 run)

## GROUND

```
UTC            2026-09-10T10:20:50Z  (addendum; run opened 08:08:07Z)
origin/main    a2fa8e4e            (git fetch origin --prune, then git rev-parse --short)
dev tree       main @ a2fa8e4e     C:\ProjectOperations2   (0 behind, 0 ahead)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Same run, same station, later measurement. The 0808 breadcrumb merged as `#1844` at 09:57:52Z
(merge commit `a2fa8e4e`); everything below was measured **after** it, on the fast-forward, and is
therefore absent from it. This addendum exists because the finding would otherwise reach nobody.

## WHAT I MEASURED

**The fast-forward passed its first read-back and failed its second, which is the trap the station
doc names.** After `#1844` merged:

```
git rev-list --left-right --count HEAD...origin/main   ->  0  0      <- PASSES
git diff --cached --name-status                        ->  EMPTY     <- PASSES
git diff --numstat                                     ->  NOT EMPTY
    1    0    docs/pr-prompts/.arming-log.txt
    0  133    docs/pr-prompts/pr-statussweep-gitproc-scope-to-the-two-repos-HOLD.md
```

**`1 insertion, 0 deletions` on an append-only audit log is the documented signature of a second
actor** — the working copy is a strict superset of `main`, so something in it has not landed. On
that shape the station doc is explicit that restoring to HEAD is a deletion, not a repair. I did
not restore it.

**The second actor, named by the log's own actor field:**

```
2026-09-10T09:12:30Z  ARMED  pr-statussweep-gitproc-scope-to-the-two-repos  escalates=false
                      actor=station-00.cowork-audit  by=Marco@LAPTOP-E6NHU4E4
                      pid=5328  caller=powershell.exe:9648
```

`git show origin/main:docs/pr-prompts/.arming-log.txt` ends at **2026-09-10T00:07:52Z** — the
09:12:30Z line exists on this laptop and nowhere else.

**What the arm produced, measured end to end:**

| probe | reading |
|---|---|
| armed at | `2026-09-10T09:12:30Z` (`.arming-log.txt`) |
| `*-ready.md` on disk now | **0** — consumed |
| `-HOLD.md` on disk now | `Test-Path` → **False** |
| processed log | `pr-statussweep-gitproc-scope-to-the-two-repos-ready.md.log`, 09:38:42Z |
| watcher opened | **`#1845`**, `fix/status-sweep-gitproc-scoped`, createdAt 09:37:57Z |
| watcher node | pid **18228** — unchanged across the whole run |
| `#1845` verdict | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/status-sweep.ps1"}` |
| `#1845` files | **1** — `scripts/pipeline/status-sweep.ps1` |

POSITIVE control: `PR #1845` matches **2** prompt logs; NEGATIVE control `PR #999999` → **0**.

**Sweep re-run before this second mutation:** `SAFE TO ACT` at 10:20:50Z — `index.lock` False /
False, `git processes running: 0`, no PR touched in the last 2 min. My 08:53:12Z sweep, taken 19
minutes before the second actor armed, also read `armed: 0` and SAFE TO ACT. Both readings were
correct when printed.

## WHAT CHANGED

1. **Committed the second actor's arming-log line**, byte-preserved by appending rather than by
   restoring — the local file is a strict superset of `main` by exactly that one line, and
   `git show HEAD:<path>` piped to a write would have silently deleted it.
2. **Retired the consumed prompt** `docs/pr-prompts/pr-statussweep-gitproc-scope-to-the-two-repos-HOLD.md`,
   whose work is already open as `#1845`.
3. **This addendum breadcrumb**, written inside this run's own PR worktree.
4. **Nothing merged that carries a `marco:true` verdict. Nothing armed. No label touched. No `sot/`
   edit. No production data. No Azure / Entra / SharePoint.**

## FINDINGS

### F6 — A second actor armed a prompt 19 minutes after my safe-to-act gate cleared, and the only record of it was one uncommitted line

Condition 3 of BOARD DRIVING — *first confirm nothing else is mid-mutation* — is the load-bearing
one, and it is a **point measurement of a continuous risk**. My 08:53:12Z sweep was correct: 0 git
processes, no lock, `armed: 0`. At 09:12:30Z, `actor=station-00.cowork-audit` (pid 5328) armed a
prompt in the same shared tree. By 09:37:57Z the watcher had built it into `#1845`. None of that was
visible to me until the fast-forward after my own PR merged, and then only as a two-line `--numstat`.

**No collision occurred** — the second actor touched `.arming-log.txt` and one prompt file, my PR
touched DOCTRINE, the canonical blocks and breadcrumbs, and the disjointness is luck rather than
design. This is LL-38's shape without LL-38's cost.

**The durable half is the audit gap, and it is the one already on file.** DOCTRINE §9.5 records that
*nothing commits `.arming-log.txt` on purpose* — the only commits that ever carry it are board PRs
that happen to sweep it in. Measured here: had I not been fast-forwarding at that moment, today's
only arm would have stayed on one laptop while the PR it produced sat on the board, and any clone,
CI job or cloud lane reading `origin/main` would have concluded that nothing was armed after
00:07:52Z. That is a **stale answer, not an absent one**, which §9.5 calls the more dangerous shape.

**DISPOSITION: ACTIONED** for this instance — the line is committed here, so `origin/main`'s arm
history now reaches 09:12:30Z. **The general defect is DEFERRED and unchanged**: nothing commits the
log on purpose, so the gap re-opens on the next arm by any actor that does not also open a board PR.
**What would make it urgent:** an arm whose PR is *not* opened in the same window as a board PR —
then the log's staleness has no accidental cure and the next reader is misled rather than merely
late.

### F7 — The consumed prompt was still tracked on main and re-armable into a duplicate of the PR it had just produced

`#1845` touches exactly **one** file, `scripts/pipeline/status-sweep.ps1`, and does **not** delete
the prompt that produced it. Arming is a working-tree rename of `-HOLD.md` to `-ready.md`; the
`-ready.md` is gitignored, the watcher consumed and removed it, and the tracked `-HOLD.md` on
`origin/main` was never touched by any of it.

So at the moment of measurement `origin/main` held a `-HOLD.md` whose premise
(`! grep -q ... status-sweep.ps1`) is still TRUE until `#1845` merges — meaning `triage-holds.ps1`
would list it as a gate-satisfied candidate and `lint-prompt.mjs` would ADMIT it. Arming it again
opens a second PR for work already open.

This is the **stays-armable-forever** defect, already on file, reached from the arming side rather
than the second-lane side. It is not new; what is new is a live instance sitting on the board
between 09:38Z and now.

**DISPOSITION: ACTIONED** for this instance — the prompt is retired in this PR, so it cannot be
re-armed while `#1845` is open. **The general defect stays DEFERRED**, unstaged, and belongs to the
same family as the queue check my predecessor's F2 staged.

### F8 — The board is now three PRs and all three are Marco's

`#1823`, `#1832` and now `#1845`, each carrying a live, **specific** watcher `marco:true` verdict —
none of them the byte-identical timeout string §10.3 warns about. `armed: 0`. `main` green.

This does not change the 0808 run's F3; it strengthens it. The second actor's arm added a PR to the
board and moved nothing, because the prompt it armed is scoped to `scripts/pipeline/`, which
`classifyPolicyFiles` routes to Marco — exactly as the classification table in the 0808 breadcrumb
predicted for all eleven gate-satisfied HOLDs.

**DISPOSITION: DEFERRED** — same three standing escalations, not re-raised.

## WHAT I DID NOT DO

- **Did not merge `#1845`, `#1832` or `#1823`.** All three carry live, specific watcher `marco:true`
  verdicts. RULE 2 binds and is not cleared by green, by CLEAN, by an absent label, or by a receipt.
- **Did not restore `.arming-log.txt` to HEAD.** On an insertions-with-zero-deletions shape that is a
  silent, unrecoverable deletion of another actor's append-only audit line.
- **Did not `git checkout .`, `reset --hard`, `stash pop` or `git clean`** anywhere.
- **Did not investigate or interfere with `station-00.cowork-audit` (pid 5328).** It is another
  actor's session; naming it is my job, policing it is not.
- **Did not author a merge-approval receipt.** A scheduled run never may.
- **Did not touch `/sot/`**, Azure / Entra / SharePoint, or production data.
- **Did not touch `C:\po-vg`** (still 1 uncommitted file) or the watcher clone beyond reads.
