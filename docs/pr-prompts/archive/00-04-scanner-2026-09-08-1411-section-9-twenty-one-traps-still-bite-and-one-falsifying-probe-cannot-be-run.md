# Station 04 — Scanner | 2026-09-08T14:11Z–2026-09-08T14:35Z

## GROUND

```
UTC            2026-09-08T14:11:25Z
origin/main    533604dc            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 533604dc     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions agree, so this run was not read-only-by-mismatch. Not blind: Desktop Commander loaded via
keyword `ToolSearch` (the ids resolved as `mcp__plugin_desktop-commander_desktop-commander__*`),
`start_process` on `powershell.exe` succeeded first call.

VM git guard, last line, quoted as the contract requires:
`vm-git-guard installed at /sessions/kind-dreamy-albattani/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)`.

Binding documents read at `533604dc`. I read them through the VM mount rather than `git show`;
that is sound here only because `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/stations/04-scanner.md docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** —
the working copies are the `origin/main` blobs. (`sweep-rotation.json` was the only path in that
numstat, `2 2`.)

Sweep, per `node scripts/pipeline/next-sweep.mjs`: **instrument-honesty** (rotation position 2 of 4).
`status-sweep.ps1` verdict at 14:14:38Z: **SAFE TO ACT**; watcher node RUNNING pid 31660; 3 open PRs
(#1820, #1821 CLEAN; #1822 RED); `index.lock` False/False; 0 git processes. I mutated nothing on the
board regardless — 04 is read-only there.

## WHAT I MEASURED

Fixtures and scratch scripts live OUTSIDE the repo, in
`C:\Users\Marco\AppData\Local\Temp\s04-instr-20260908\` (`probe1.ps1`, `probe2.ps1`, `probe3.mjs`,
`probe4.ps1`, `probe5.ps1`, `probe6.ps1`). Every PowerShell probe containing `$` was run with
`-File`, per §9.1; the two probes that must go through `-Command` are marked. Fresh needle this run:
`zzS04Sep08NeedleZz` (the two needles memory records as burned were not reused).

**Twenty-one distinct §9 claims re-measured, in twenty-two rows. All twenty-one still bite. [MEASURED] 2026-09-08T14:12Z–14:26Z at
`533604dc`, PS 5.1.26100.9168, git 2.55.0.windows.3, gh 2.90.0.**

| # | §9 claim | probe | reading | truth | verdict |
|---|---|---|---|---|---|
| 1 | 9.1 `$` expanded by the `-Command` layer | `-Command "$CTRL=42; …$true…$env:USERNAME"` | assignment arrives as bare `=42` (parser error), `True`, `Marco` | control is undefined ⇒ must print empty | STILL TRAPPED |
| 1b | 9.1 the cure hides the trap | same script via `-File` | `P8`/`P1` blocks ran with `$` intact, no expansion | — | cure works, bullet stands unqualified |
| 2 | 9.1 `-Include` on a bare directory | fixture `top.log` + `sub\nested.log` + `sub\other.txt` | no `-Recurse`: bare **0**, `dir\*` **1**; with `-Recurse`: **2** and **2** | 2 logs, 1 at depth 1 | STILL TRAPPED, exactly as scoped by the 09-07 correction |
| 3 | 9.1 single-quoted `\\` needle | fixture naming `C:\ProjectOperations2\docs\pipeline\DOCTRINE.md` once | `'C:\\…\\docs'` → **0**; `"C:\…\docs"` → **1**; NEG → 0 | 1 | STILL TRAPPED |
| 4 | 9.1 `gh run view --job --log` is 3 tab columns, col 1 = job name | run `34222559346`, job `102048884639` (`Changed-path filter`) | 172/172 lines tab-separated; raw grep for the job-name token `filter` → **172**; last-column → **1**; POS `Run` → 20; NEG → 0 | 1 real hit | STILL TRAPPED |
| 5 | 9.1 automatic variable as `foreach` target | `-File`, `foreach ($home in @(1,2,3))` | `SessionStateUnauthorizedAccessException`, body never ran; `$okvar` control ran 3× | 3 iterations | STILL TRAPPED — but see finding F1 |
| 6 | 9.2 `ls-tree` returns the level you asked for | `-- docs/pr-prompts/superseded` | **1** line; with `/` **160**; with `-r` **366** | 366 | STILL TRAPPED |
| 7 | 9.2 `ls-tree` has no glob, and `-r` never rescues it | `-- 'docs/pr-prompts/*.md'` | **0** without `-r`, **0** with `-r`; explicit `:(glob)` → `fatal: … pathspec magic not supported` | **55** depth-1 `.md` | STILL TRAPPED (positive control still fails) |
| 8 | 9.2 `check-ignore -v` on a directory is byte-identical to a true negative | dir / file inside / `CLAUDE.md` | dir exit 1 empty · file exit 0 `.gitignore:76:…` · tracked file exit 1 empty | opposite truths | STILL TRAPPED; `git status` also saw **0** gitignored `*-ready.md` |
| 9 | 9.2 `git branch -r` is not the remote | count vs `git ls-remote --heads origin` | **33** vs **12** | 12 | STILL TRAPPED |
| 10 | 9.3 `Measure-Object -Line` drops blank lines | fixture, 5 lines, 2 blank | `.Lines` **3** · `Measure-Object.Count` **5** · `(Get-Content).Count` **5** | 5 | STILL TRAPPED |
| 11 | 9.3 `-SimpleMatch` + `[regex]::Escape()` | fixture holding `reminder-policy.service.ts` | escaped **0** · raw **1** · dotless control **1** | 1 | STILL TRAPPED |
| 12 | 9.3 PowerShell `>` writes UTF-16LE | `'hello doctrine' > file` vs the same text written UTF-8 | first bytes **FF FE**, **34** bytes vs **16** | 16 | STILL TRAPPED |
| 13 | 9.3 `Set-Content -Encoding UTF8` is the double-encoder; plain `Set-Content` is not | em dash U+2014 round-trip | src `E2 80 94` · plain **identical bytes** · `-Encoding UTF8` → `EF BB BF … C3 A2 E2 82 AC E2 80 9D` | em dash | STILL TRAPPED, signature reproduced exactly |
| 14 | 9.3 `String.replace()` reads `$` in the REPLACEMENT | node, replacement ending `…[cm]?[jt]sx?$` + a backtick | expected 253 B, string form **452 B** (**+199 spilled**), function form **253 B**; `old_gone` and `new_present` both **true** on the spilled file | 253 | STILL TRAPPED, and every read-back still passes |
| 15 | 9.4 `@(ConvertFrom-Json …).Count` | `[]` and a 4-element array | inline **1** and **1**; assign-then-count **0** and **4** | 0 and 4 | STILL TRAPPED |
| 16 | 9.4 `gh run list --commit <short>` | `533604dc` vs the 40-char SHA | **0** rows vs **7** rows, both exit 0 | 7 | STILL TRAPPED |
| 17 | 9.4 `merged` is unusable on a list response | `gh api /pulls?state=closed&per_page=10` | `merged` key **defined on 0 of 10**; `merged_at` populated **10 of 10**; POS control single GET `/pulls/1819` → `merged: True` | mixed | STILL TRAPPED, in the ABSENT shape the 09-07 correction predicts for `gh` |
| 18 | 9.5 `checkHumanGate` vs the raw union grep (the fixture, not the board) | five rows rebuilt from the table | prose FLAG/gate · inline-code FLAG/**ok** · fenced FLAG/**ok** · html-comment FLAG/gate · NEG clear/ok | by construction | STILL TRAPPED — the two instruments disagree on exactly the two documented rows |
| 19 | contract v3 / 9.1: a PIPED `hash-object` is unsound in PowerShell | `DOCTRINE.md` at `origin/main` | `rev-parse` **289eb32f** = `hash-object` **289eb32f** = `cmd /c` piped **289eb32f**; PowerShell piped **f2a483d9** | 289eb32f | STILL TRAPPED |
| 20 | 9.3 never compare LENGTHS across the `git show` boundary | `DOCTRINE.md` | bytes on disk **136688** · decoded `.Length` **135204** (−1484 non-ASCII) · CRLF **1751** · blob joined **134936** | one file | STILL TRAPPED — three well-formed numbers, none comparing the same thing |
| 21 | 9.5 STOP-WATCHER is a MECHANISM, and the naive probe false-negatives | `C:\po-watcher` + the four launchers | `STOP-WATCHER-LANE2` present **1090 B** · `STOP-WATCHER` **absent** · naive `STOP-WATCHER*` search inside the repo **0** · launcher hits **3 / 4 / 4 / 3** · NEG needle **0** | as documented | STILL TRAPPED, counts unchanged |

**Two more readings, neither a trap verdict.**

`gh run list --branch main --limit 5` is CURRENT right now: newest row `2026-09-08T13:32:11Z`,
`headSha 533604dc` = `origin/main`, taken at 14:25:59Z. That is a healthy reading of a bullet that
says the query *can* be days stale — it neither confirms nor refutes it (see F4).

`docs/pr-prompts/superseded/pr-doctrine-s9-four-false-traps-LOOPING.md` (9056 B, **untracked**, from
04's 2026-08-26 instrument-honesty sweep) is **SPENT**: its premise
`grep -q "no inline .if. expression" docs/pipeline/DOCTRINE.md` returns **0** on `origin/main`
(POS control `ls-tree` → 5, NEG control fresh needle → 0), and the replacement texts it proposed for
§9.2's plain-fetch bullet and §9.4's `--jq` bullet are the words those bullets carry today. A lead
for the repo-hygiene sweep, not a finding of mine.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced with the timestamp I measured:
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-08T14:25:17Z` →
  `advanced: last_index=1 last_run_utc=2026-09-08T14:25:17Z`, read back with `--status`
  (`last [1] instrument-honesty`, `-> NEXT [2] repo-hygiene`). **LEFT DIRTY in the dev tree, as the
  station contract requires — Station 00 commits it.** See F3: it is now carrying three runs' worth
  of advance, not one.
- This breadcrumb, untracked at `docs/pr-prompts/`.
- Scratch fixtures and probe scripts under `C:\Users\Marco\AppData\Local\Temp\s04-instr-20260908\`
  — outside the repo, so the tree is not dirtied by them.
- Nothing else. No prompt staged, armed, renamed, moved or deleted; no label touched; no merge; no
  commit; no push; no `git` run from the VM side.

## FINDINGS

**F1 — §9.1's falsifying probe for `AUTOMATIC_VARIABLE_ASSIGNMENT_V1` is written in the one form
§9.1 forbids, and run as written it produces a third outcome the bullet does not describe.**
The bullet ends: *"Falsifying probe: `powershell -NoProfile -Command "foreach ($home in @(1,2,3)) {
$home }"` — if it prints `1 2 3`, this bullet is wrong."* [MEASURED] 14:18Z through the device
bridge, verbatim: the `-Command` layer substitutes `$home` **before** PowerShell parses, so what runs
is `foreach (C:\Users\Marco in @(1,2,3)) { C:\Users\Marco }` and the shell answers
`Missing variable name after foreach` + `Unexpected token ')'` — a **ParserError**, not the
`SessionStateUnauthorizedAccessException` that confirms the bullet and not the `1 2 3` that would
refute it. Run correctly (same statement in a `.ps1` via `-File`) the trap reproduces exactly:
exception caught, loop body never ran, `$okvar` control ran three times. So the bullet is TRUE and
its probe is UNRUNNABLE as printed — and the available conclusion from the wrong error ("it errored,
so the bullet holds") is right by accident, which is the shape §7 exists to stop. This is the same
self-swallowing pattern §9.1 already documents one bullet earlier for the `$CTRL=42` control, and the
cure there was to name the invocation; this probe never got the same treatment.
🔧 Fix is one clause: *"run it from a `.ps1` with `-File`; through `-Command` the probe destroys
itself — `$home` arrives pre-expanded and you get a parser error instead of either answer."*
**DISPATCHED** — Station 00, as a §9.1 doc edit (`instruments v2` is DOCTRINE-only, so this costs one
document and one canonical-hash re-record, not seven).

**F2 — §9.5's arming-log falsifying probe FIRES: the publication gap is open again, three arms deep.**
[MEASURED] 14:22Z: `git show origin/main:docs/pr-prompts/.arming-log.txt` → **68** lines, newest row
`2026-09-08T07:11:06Z ARMED pr-brandtheme-s1-apply-the-saved-scheme … actor=station-00.cloud-lane-0708`;
the working copy → **71** lines, newest `2026-09-08T12:29:41Z ARMED pr-tfm-s11-copy-recursive-preserve
escalates=true … actor=station-00.cloud-lane-1230`. Controls as the bullet prescribes:
`git ls-files --error-unmatch` on the log → exit **0**, on a nonexistent path → exit **1**. So three
arms — one of them `escalates=true` — exist only on this machine, the newest for 1 h 56 min at the
time of measurement. Per the bullet, until the counts agree an arm age read from `origin/main` is a
LOWER bound, and any run that arms MUST commit the log in its board PR. The 🟢 "gap is closed" clause
in §9.5 is once again describing a state that has since flipped — by luck, exactly as the same bullet
predicts ("the only commits that have ever carried it were board PRs that happened to sweep it in").
**DISPATCHED** — Station 00: sweep `.arming-log.txt` into the next board PR, and treat the
publication as part of arming rather than as a side effect of collection.

**F3 — the rotation state file is carrying three runs of advance, so 04's sweep record is one crash
away from lying about which sweeps have run.** [MEASURED] 14:12Z–14:26Z:
`git show origin/main:docs/pipeline/sweep-rotation.json` holds `last_index: 2`,
`last_run_utc: 2026-09-08T02:10:37Z`; the working copy held `last_index: 0`,
`last_run_utc: 2026-09-08T10:11:18Z` **before** I ran, and `last_index: 1` after. `git diff --numstat
origin/main -- docs/pipeline/sweep-rotation.json` → `2 2` (a real uncommitted delta, not §9.2's
behind-HEAD illusion — this tree is `0 0` against `origin/main`). The file only ever records the LAST
advance, so the 06:xx and 10:11Z runs' advances are already unrecoverable from `origin/main`; a
machine loss now would replay `gate-liveness` and skip `instruction-drift` with nothing to show it.
Same failure family as F2: a state file that 04 is forbidden to commit and 00 commits only when it
happens to sweep. **DISPATCHED** — Station 00, together with F2 (both are one `git add` in the next
board PR); the durable half is whether 00's collect should assert on these two paths every run rather
than sweeping whatever is dirty.

**F4 — §9.4's `gh run list --branch main` bullet cannot be discharged or refuted by this sweep,
because it is a possibility claim with no falsifying probe — and the rotation brief names it as one
of four queries to run.** [MEASURED] 14:25:59Z: the query returned five rows, newest 53 minutes old,
`headSha` equal to `origin/main`. Under the sweep's own rule ("a trap that has been fixed upstream and
still reads as live is itself drift") a healthy reading is indistinguishable from a retired trap, and
the next run that meets a healthy reading has the same non-answer waiting for it. Every other §9
bullet I ran this sweep either names its falsifying probe or is falsifiable by construction; this one
is not. 🔧 Additive fix, one clause: *"falsifying probe — compare the newest `--branch main` row's
`headSha` against `git rev-parse origin/main` while a run exists on that commit; equal ⇒ the query is
current on this reading, which is not a claim about any other."* That records what a healthy reading
means without retiring the warning. **DISPATCHED** — Station 00, same §9 edit as F1.

## WHAT I DID NOT DO

- **No board action of any kind.** No arm, no stage, no rename, no delete, no label, no merge, no
  commit, no push. 04 is read-only on the board and the sweep needed nothing else.
- **Did not run Part 0 / Part 1 / Part 2** (static cross-layer audit, GitHub reconciliation audit,
  live-site visual patrol). The station contract says take ONE named sweep and cover it completely;
  the rotation named `instrument-honesty`, and covering §9 properly consumed the run.
- **Did not run the destructive-by-definition traps**, and will not: §9.2's `checkout .` /
  `reset --hard` / `stash pop` / `git clean` (they resurrect consumed prompts), and §9.2's
  device-bridge `git` against the Windows `.git` (it leaves the 0-byte `index.lock` that freezes
  every station). Both are documented from real occurrences; reproducing them is the cost the bullet
  exists to avoid. The guard that enforces the second was installed and its output quoted above.
- **Did not test the `git fetch origin main` opportunistic-update bullet** (§9.2). Doing it honestly
  needs a second remote added and removed in the shared dev tree; the tree's index is shared with
  concurrent chats and the reward is low — the bullet already says to write the explicit refspec
  either way, which is what this run's preflight did.
- **Did not test the watcher-log family in §9.5** — `opened PR #<n>` completeness, the
  launcher-transcript-vs-daily-log correction, the `.queue-state.json` freeze probe. Their falsifying
  probes need a build the watchdog killed mid-flight and two samples five minutes apart; no build was
  in flight (heartbeat 44 min old, empty queue). `[CANNOT MEASURE]` this run, not "clean".
- **Did not re-derive §9.5's board-count table for `checkHumanGate`** — the bullet explicitly says the
  board count is not the probe because the PR that landed it repaired the one false positive. I built
  the five-row fixture instead, which is what it asks for.
- **Did not touch `/sot/`, Azure, Entra or SharePoint**, and staged no prompt: F1 and F4 are one
  clause each inside a hash-gated canonical block, which is 00's edit to land, and F2/F3 are a `git
  add` in 00's next board PR — none of the four wants a watcher run.
- **Did not write to any of the five gitignored `docs/qa/` sinks.** This breadcrumb is the report.

Validator, run after this file was complete: `node scripts/pipeline/check-breadcrumb.mjs` →
`ADMIT 00-04-scanner-2026-09-08-1411-section-9-twenty-one-traps-still-bite-and-one-falsifying-probe-cannot-be-run.md`,
`structure: 12 checked, 0 malformed`, `CLEAN`, **exit 0** — with the expected
`NOTE … is UNTRACKED — it reaches nobody until a board PR commits it`. Station 00: this breadcrumb,
`docs/pipeline/sweep-rotation.json` and `docs/pr-prompts/.arming-log.txt` all want the same board PR.
