# Station 00 — Supervisor | 2026-09-08T05:37Z–2026-09-08T05:5xZ

**Addendum to the 05:09Z run — same run, later measurements.** Named from the measured UTC of its
first measurement, not from a cron slot, per the 04:09Z run's F2. The 05:09Z breadcrumb landed in
`#1812` and is accurate as at 05:37Z; everything below happened after it was written.

## GROUND

```
UTC            2026-09-08T05:37:45Z
origin/main    e4ba60a9            (after #1812 at 1e6e8004 and #1813 at e4ba60a9)
dev tree       main @ e4ba60a9     C:\ProjectOperations2   (0 0 against origin/main, read back)
doc version    1
bootstrap      1
```

## WHAT I MEASURED

**[MEASURED] `#1812` MERGED `05:37:45Z`, squash `1e6e8004`.** All 15 checks SUCCESS or SKIPPED, zero
failures. `Assert-SmokedOrEscalate -Pr 1812` → `True True`, exit 0; `Merge-Pr -Pr 1812` → `True`,
exit 0; read back `state=MERGED`. The review lane produced a verdict for it unaided:
`pr-1812-review.md` was written into the **watcher clone's** `docs/pr-reviews/` at `05:27:40Z` and
reads `VERDICT: MERGE`. It was **absent** from the dev tree and from
`C:\po-watcher\verdicts-archive\` — the three-homes rule earning its keep on a live board.

**[MEASURED] The sweep said DO NOT ACT twice, and both readings were true and both were about
somebody else.** At `05:25:02Z` and `05:28:27Z` section 7 read `DO NOT ACT`. Section 3 named the
cause the second time: `git processes running: 2`, `BUILD IN FLIGHT: rev-1812-ready.md`, and
`remote board activity in last 2 min: #1812 OPEN, #1811 MERGED, #1810 OPEN`. **Marco merged `#1811`
by hand inside that window and removed `#1810`'s label**, so the board went from three
label-parked PRs to one. I waited rather than acting through it. At `05:34:49Z` the verdict was
`CAUTION: 1 LIVE STATION WORKTREE(s) detected — C:/po-wt/board-0508`, **which is my own worktree**;
git processes 0, no locks, no build in flight. That is the documented "a live station worktree can
be YOUR OWN" case, and it is the reading I acted on.

**[MEASURED] Armed exactly one prompt, and it is the docs-only one.**
`arm-prompt.ps1 -Name pr-stationcaps-blind-run-names-one-mount -Actor station-00.sched0509`, exit 0,
audit row `2026-09-08T05:45:21Z ARMED pr-stationcaps-blind-run-names-one-mount escalates=false
actor=station-00.sched0509 by=Marco@LAPTOP-E6NHU4E4 pid=9260 caller=powershell.exe:31900`. Read
back: `armed: 1`, the single file `pr-stationcaps-blind-run-names-one-mount-ready.md`, index clean.

**RULE 4's detector, both instruments, before the arm.** `lint-prompt.mjs` → **ADMIT**. Union grep
over the file for all three markers: `watcher:\s*do-not-arm` case-insensitive → **0**,
`DO NOT ARM` case-**sensitive** → **0**, `Arm ONLY` case-insensitive → **0**; POSITIVE control on a
known-gated prompt (`pr-dns-s5-checker-flip-to-fail-HOLD.md`) → **1**. Body read for a prose gate:
none — I wrote it this run. Duplicate check re-taken **at the moment of the arm** rather than
inherited: no open PR's file list contains `docs/pipeline/STATION-CAPABILITIES.md` (`#1809` → 0,
`#1810` → 0). `armed` was 0 before the call, so this is one at a time.

**[MEASURED] `#1813` MERGED `05:48:22Z`, squash `e4ba60a9`** — one file, `.arming-log.txt`, landing
the arm row. DOCTRINE section 9.5 requires any run that arms to commit that log in its board PR;
the arm happened after `#1812` merged, so it needed a PR of its own. All checks green,
`Assert-SmokedOrEscalate` then `Merge-Pr`, read back MERGED.
⚠️ `gh pr create --body` was used with backticks in the string. The PR was created and the body
landed **with the backticks silently stripped** — content intact, formatting lost. That matches the
standing note; use `--body-file`.

**[MEASURED] Three new prompt files appeared in the dev tree during this run, untracked.**
`pr-ea-gate-report-self-filter-HOLD.md` (8531 B), `pr-ea-s2a-dashboard-preset-seed-HOLD.md`
(7042 B) and `pr-ea-s2b-dashboard-filter-surface-HOLD.md` (8560 B), all three with
`LastWriteTimeUtc` of **2026-09-08T05:18:38–05:18:39Z** — inside this run's window, written by an
actor that is not this run. They are absent from the 05:09Z `git status`. See F3.

## WHAT CHANGED

- `#1812` merged (the 05:09Z collect PR). `#1813` merged (the arming log row).
- `pr-stationcaps-blind-run-names-one-mount` armed. `armed: 0` → `1`.
- Dev tree fast-forwarded `400560d0` → `1e6e8004` → `e4ba60a9`, with all three read-backs passing
  each time: `rev-list --left-right --count HEAD...origin/main` = `0 0`, `git diff --numstat` EMPTY
  except the expected ` D` of the armed prompt's `-HOLD.md`, `git diff --cached --name-status` EMPTY.
- The disposable worktree `C:\po-wt\board-0508` is the only working state left, and it is torn down
  at the end of this run.

## FINDINGS

### F1 — the prescribed restore-to-HEAD cure normalised ONE bare LF, and that single byte refused two fast-forwards

The station doc's cure for a modified tracked file blocking a fast-forward is *"`git show HEAD:<path>`
piped to a write"*. I wrote it through a line-ending normaliser —
`s.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n")` — which is the obvious way to write a text file on
Windows and is wrong.

[MEASURED] on `docs/pr-prompts/.arming-log.txt` at `e4ba60a9`, comparing the HEAD blob against the
file the cure produced, as Buffers on the same side of the boundary:

| | HEAD blob | what the cure wrote |
|---|---|---|
| bytes | **9491** | **9492** |
| `\r\n` occurrences | **65** | **66** |
| `\n` occurrences | 66 | 66 |

**The blob's last line ends in a bare LF and every other line ends CRLF.** The normaliser turned
that final LF into CRLF, added exactly **one byte**, and git then refused
`git merge --ff-only` with *"Your local changes … would be overwritten by merge"* — twice, once on
this file and once on `pr-ea-s2-dashboard-preset-HOLD.md` earlier in the same run.

🔴 **Every instrument the station doc points at reads clean while this is live.**
`git diff --numstat` reported `1  1` — one line changed — which sends the reader looking for a
content difference; `git hash-object` against `git rev-parse origin/main:<path>` disagreed
(`d54c6109` vs `abd55831`) **for a file whose `--numstat` against `origin/main` was EMPTY**, because
the clean filter normalises on hash-object while the blob itself stores CRLF; and
`git add --renormalize` followed by `git restore --staged` — the documented cure for the
`.arming-log.txt` case — left the fast-forward refusing exactly as before. Four probes, four
readings, none of them naming a one-byte line terminator.

🔧 **The cure, and it is one word: write the blob RAW.** `writeFileSync(path, gb("show",
"HEAD:" + path))` with the Buffer untouched — no `toString`, no `replace`, no encoding argument.
[MEASURED] the same run: raw write → 9491 bytes → `git update-index --refresh` clean for that path →
`git merge --ff-only` `Updating 1e6e8004..e4ba60a9` → `0 0`, `--numstat` clean, `--cached` EMPTY.

⚠️ **Falsifying probe: the byte counts above.** Count `\r\n` and `\n` in
`git show HEAD:docs/pr-prompts/.arming-log.txt` as a Buffer. If they are equal, this file no longer
has a mixed terminator and this finding does not reproduce on it — but the rule stands for any file
that does, and the append-only arming log is written a line at a time by a script, which is how it
got that way.

🔧 **This belongs in the station doc's delete-the-disk-copy section**, one clause on the existing
`git show HEAD:<path> piped to a write` sentence: *write the Buffer raw; any line-ending transform
on the way to disk re-creates the blocker the cure exists to remove.* That is `docs/` only.

**DISPOSITION: DEFERRED** — successor named and scoped to `docs/pipeline/stations/00-supervisor.md`,
deliberately not written this run because `armed: 1` and RULE 4 is one at a time. It is the next
`docs/`-only prompt for this board, which is what the 05:09Z F1 said the board is short of.

### F2 — the board is now ONE parked PR, because Marco cleared two by hand mid-run

At 05:09Z: `#1809 · #1810 · #1811`, all three carrying `do-not-merge`. At 05:34Z: `#1811` MERGED by
Marco, `#1810` CLEAN with its label removed, `#1809` still BLOCKED. Both of the cleared ones are
`sot/`-scoped work opened by the supervised cloud lane.

**I did not merge `#1810` and that is deliberate.** Removing the label is not a RULE 2 clearance —
that is settled and standing. The PR carries no watcher verdict (`NO LOG`, hand-classified), it was
opened by the cloud lane rather than by Station 05, and a cloud-lane PR touching `sot/` is outside
that lane's own recorded prohibition, so under section 10.1 it falls through to
`classifyPolicyFiles` and reads MARCO'S. He is hand-driving this board this minute — condition 3 —
and standing off his PRs is the whole content of that condition.

**DISPOSITION: ACTIONED** — measured, classified, untouched.

### F3 — three prompt files were written into the shared dev tree during this run and left untracked

`pr-ea-gate-report-self-filter-HOLD.md`, `pr-ea-s2a-dashboard-preset-seed-HOLD.md` and
`pr-ea-s2b-dashboard-filter-surface-HOLD.md`, all stamped 05:18:38–05:18:39Z, none of them tracked.
Their names say what they are: a split of `pr-ea-s2-dashboard-preset` into a seed slice and a filter
slice, plus a gate-report fix — which is consistent with the amendment to `pr-ea-s2-dashboard-preset`
that this run published in `#1812` twenty minutes earlier.

🔴 **This is the same defect that amendment was, one hour later and three files wider.** A prompt
that exists only as an untracked file in one working tree is invisible to every clone, to CI, to the
code-writer and to `lint-prompt.mjs` running anywhere else — and `git clean` deletes it. The schema
document says so in its opening section, in as many words.

🔧 **I did not commit them, and the reason is timing, not doctrine.** They were written **nine
minutes** before I measured them, by an actor still working; committing a half-written prompt is
worse than leaving it, and `-HOLD` files start nothing while they wait. The correct next act is to
publish them once they have stopped changing — committing a `-HOLD.md` cannot start work — and that
is a decision for whoever is writing them, or for the next run if they are still there and
unchanged.

**DISPOSITION: DEFERRED** — with the trigger named: publish them when their mtime has been stable
for a full cadence, or ask their author. Not a blocker; a countdown.

## WHAT I DID NOT DO

- **Did not merge `#1810` or `#1809`.** F2.
- **Did not commit the three untracked `pr-ea-*` prompts.** F3.
- **Did not arm a second prompt.** RULE 4 is one at a time and `armed` is now 1.
- **Did not write the successor prompt for F1**, for the same reason.
- **Did not archive any breadcrumb**, and did not touch `C:\po-vg`, the watcher, `/sot/`,
  production data, Azure, Entra or SharePoint.
- **Did not run `git` in the watcher clone.** Its `docs/pr-reviews/` was read, nothing more.

**Needle minted and spent:** `zzQq00N20260908T0551`.

---

**Validator.** `node scripts/pipeline/check-breadcrumb.mjs`.
