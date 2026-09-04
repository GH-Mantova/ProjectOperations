# Station 04 — Scanner | 2026-09-04T14:09Z–2026-09-04T14:22Z

## GROUND

```
UTC            2026-09-04T14:09:00Z
origin/main    b31a242a            (fetched, then rev-parse)
dev tree       main @ 69ae2a4e     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE — full authority run, not read-only-on-mismatch.

Not blind: `start_process` on `powershell.exe` returned `2026-09-05T00:09:43.4780188+10:00` /
`LAPTOP-E6NHU4E4` after a keyword `ToolSearch` for `desktop-commander`.

Dev tree HEAD `69ae2a4e` is BEHIND `origin/main` `b31a242a`, so per the preflight I did not trust
working-copy reads on faith. All three binding documents were confirmed identical to `origin/main`
by the sanctioned probe before I read them — `git diff --numstat origin/main -- <path>` returned
EMPTY for `docs/pipeline/stations/04-scanner.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md`. I did not use the piped `hash-object` form (§9.2-E, and
see M10 below where I measured it lying again this run).

SWEEP THIS RUN: **instrument-honesty** (rotation position 2 of 4), assigned by
`node scripts/pipeline/next-sweep.mjs`. Advanced with
`--advance --utc 2026-09-04T14:09:00Z` → `last_index=1`; next run gets `repo-hygiene`.
🔧 **`docs/pipeline/sweep-rotation.json` IS LEFT DIRTY IN THE DEV TREE — Station 00 must commit it.**
I may not commit to the shared dev tree.

## WHAT I MEASURED

Board state, from `scripts/pipeline/status-sweep.ps1` at 14:14:33Z (verdict **CAUTION**, two live
station worktrees — I mutated nothing, so the caution did not bind me):

- [MEASURED] 3 open PRs, all CLEAN and 14/14 green: **#1594**, **#1593**, **#1589**.
- [MEASURED] main CI on `b31a242a`: 4 success / 0 failed / 0 running. Trunk green.
- [MEASURED] watcher node RUNNING pid 20000; wrapper alive (1); armed `*-ready.md` = **0**.
- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` → `CLEAN`, exit **0**, `structure: 4
  checked, 0 malformed`.

### The §9 traps that STILL REPRODUCE, each with its control

Every line below is a probe I ran this run, in `C:\ProjectOperations2` at `b31a242a`.

- [MEASURED] **M1 §9.2 `ls-tree` depth.** `-- docs/pr-prompts/superseded` → **1** line;
  `-- docs/pr-prompts/superseded/` → **82**; `-r` + trailing slash → **288**. POSITIVE CONTROL
  `-- CLAUDE.md` → 1. Trap holds; only the corpus grew (DOCTRINE cites 252 for the `-r` case).
- [MEASURED] **M2 §9.2 `ls-tree` glob is silently zero.** `-- 'docs/pr-prompts/superseded/*.md'`
  → **0** both with and without `-r`. 🔴 POSITIVE CONTROL `-- 'docs/pr-prompts/*.md'` → **0 at
  exit 0**, against a truth of **113** depth-1 entries. The explicit magic form
  `:(glob)docs/pr-prompts/superseded/**/*.md` → exit **128**,
  `fatal: ... pathspec magic not supported by this command: 'glob'`. Trap holds exactly.
- [MEASURED] **M3 §9.2 `check-ignore` silence carries no information.**
  `git check-ignore -v docs/pr-prompts/processed` → exit **1**, output `""`.
  NEGATIVE CONTROL `git check-ignore -v CLAUDE.md` (tracked, genuinely not ignored) → exit **1**,
  output `""` — byte-identical to the opposite truth. The file form
  (`docs/pr-prompts/processed/fix-formfill-submission-sections-already-done.md`) → exit **0**,
  `.gitignore:76`. Trap holds, including the cited `.gitignore` line.
- [MEASURED] **M4 §9.2 `git branch -r` is not authoritative, and `--prune` does not cure it.**
  Immediately after `git fetch origin --prune`: `git branch -r` = **14**,
  `git ls-remote --heads origin` = **6**. Prune worked perfectly — all six `origin/*` heads match the
  remote exactly. The eight extras are `origin/HEAD` plus **seven** hand-made refs no refspec owns:
  `pr/1477`, `pr/1478`, `pr/1483`, `pr/1487`, **`pr/1544`**, **`pr/1571`**, `pr1273`. 🔧 Trap holds
  and has GROWN — DOCTRINE measured five such refs on 2026-09-03; `pr/1544` and `pr/1571` are new.
- [MEASURED] **M5 §9.3 PowerShell `>` writes UTF-16LE.**
  `git show origin/main:docs/pipeline/stations/04-scanner.md > redir.md` → **80566** bytes from a
  **40282**-byte source (exactly 2×), first bytes `FF FE`. POSITIVE CONTROL `Copy-Item` of the same
  file → **40282** bytes, first bytes `2D 2D`. Trap holds.
- [MEASURED] **M6 §9.3 `-SimpleMatch` + `[regex]::Escape()` fails silently.** Dotted needle
  `lint-prompt.mjs` against `DOCTRINE.md`: raw → **8** hits, escaped (`lint-prompt\.mjs`) → **0**,
  exit 0. Dotless control `DOCTRINE`: raw **3**, escaped **3** — the control passes both ways while
  every dotted query silently fails. Exactly the documented signature. Trap holds.
- [MEASURED] **M7 §9.4 `ConvertFrom-Json` count collapse.** On PS **5.1.26100.9168**:
  `@(ConvertFrom-Json '[]').Count` → **1**, `@(ConvertFrom-Json '[4 elements]').Count` → **1**.
  Assign-first: **0** and **4**, correct in both directions. Trap holds on the exact build cited.
- [MEASURED] **M8 §9.4 `gh run list --commit <SHORT>` answers `[]`.** gh **2.90.0**:
  `--commit b31a242a` → `[]` (assigned-then-counted: **0**); `--commit
  b31a242a46f391144b6512450768a6c5001934e7` → **4** runs — `CI=success | Deploy=success |
  Tendering Browser Smoke=success | Push on main=success`. Trap holds, same four job names.
- [MEASURED] **M9 §9.4 `--jq` escaped double quotes.** `--jq ".[] | [(.number|tostring), .title] |
  join(\",\")"` → gh fails LOUDLY: `failed to parse jq expression (line 1, column 45)`,
  `invalid escape sequence "\)"`, the expression arriving as `join(",\)`. The single-quoted form
  works (`--jq '.[] | .number'` → `1594,1593,1589`). Trap holds; it fails loudly, as documented.
- [MEASURED] **M10 §9.2-E piped `hash-object` is unsound in PowerShell.** On
  `docs/pipeline/DOCTRINE.md`: piped form → `cd00c2a4…`; `git rev-parse origin/main:<path>` →
  `5f3a7dad…`; `git hash-object <path>` → `5f3a7dad…`; `git diff --numstat origin/main -- <path>`
  → EMPTY. The two sanctioned forms agree with each other and disagree with the pipe. Trap holds.
- [MEASURED] **M11 §9.5 `foldBlockScalar` landed.** `git grep -c foldBlockScalar
  origin/main -- scripts/pipeline/lint-prompt.mjs` → **2**. NEGATIVE CONTROL
  `zzzNoSuchTokenZzz` → exit 1. Holds.
- [MEASURED] **M12 §9.5 RULE 2's probe still has two homes and the corpse still passes its control.**
  LIVE `C:\ProjectOperations2\docs\pr-prompts\processed` = **1897** logs, newest
  **2026-09-04T13:20:37Z**, `marco.:true` → **609**. DECOY
  `C:\po-watcher\ProjectOperations\docs\pr-prompts\processed` = **21** logs, newest
  **2026-08-17T14:28:09Z** — now **eighteen days** stale — `marco.:true` → **10**. 🔴 The decoy
  still satisfies the mandated positive control (POS=10>0) and would return "no Marco routing" for
  all three of today's open PRs. Trap holds, entirely unchanged, and is still the most dangerous
  one in §9.

### The §9 claims that DID NOT survive this run

- [MEASURED] **M13 — 16 of 17 line-number anchors in §9.5 are wrong.** See F1.
- [MEASURED] **M14 — the arming-log gap is CLOSED.** See F2.
- [MEASURED] **M15 — §9.1's `$`-expansion cause does not reproduce on this path.** See F3.

## WHAT CHANGED

**Nothing on the board.** No merge, no arm, no label, no rename, no push, no PR. Station 04 is
read-only on the board and the sweep verdict was CAUTION.

One file mutated, and it is the one my station doc orders me to mutate and forbids me to commit:

- `docs/pipeline/sweep-rotation.json` — advanced `last_index=0 → 1`,
  `last_run_utc=2026-09-04T14:09:00Z`. **LEFT DIRTY. Station 00 commits it.**

This breadcrumb is untracked in the dev tree until a board PR sweeps it up.

Scratch files were written to `%TEMP%`, never into the repo. I did briefly create
`C:\ProjectOperations2\scan-ground.cmd`, noticed it dirtied the dev tree, and removed it in the same
minute (`Test-Path` → `False`); it never entered the index (`git diff --cached --name-status` EMPTY
before and after).

## FINDINGS

### F1 — S2 · DOCTRINE §9.5's line-number citations have drifted ~90 lines, and the three arming markers are among them

**Every conclusion in §9.5 about `lint-prompt.mjs` is TRUE. Almost every line number pointing at it
is WRONG.** Measured against `origin/main:scripts/pipeline/lint-prompt.mjs` (now 1824 lines):

| §9.5 cites | claims | actually at | at the cited line now |
|---|---|---|---|
| `:728` | `DO_NOT_ARM_COMMENT` | **818** | `try {` |
| `:730` | `DO_NOT_ARM_CAPS` | **820** | `} catch (_) {` |
| `:732` | `ARM_ONLY` | **822** | `}` |
| `:743/:755/:767` | `HUMAN_GATE_PRESENT` reports | **831/843/855** | `}` / blank / `*` |
| `:439-459` | `readFromOriginMain` | **529** (`LINT_GIT_BIN` 530, `return null; // …fail SAFE` 547) | `} catch (err) {` |
| `:492/:563/:826/:865/:903` | the five gate probes | **582/653/916/955/993** | unrelated lines |
| `:1164/:1165` | `LINT_GH_BIN` / `gh pr view` | **1254** / inside `ghFetchPrState` (1246) | `continue;` / `}` |

And in `check-breadcrumb.mjs`: `:98` (the `ls-tree -r` probe) is **still exact** — the one survivor —
while `:160` (`readdirSync` depth-1) is really **207** and `:162` ("matched by basename") is really
**209**. The token `basename` does not occur in that file at all; the mechanism is
`p.slice(p.lastIndexOf('/') + 1)`.

**Verified by symbol, the substance is sound:** exactly **five** call sites of `readFromOriginMain`
(582, 653, 916, 955, 993); `checkFixesPrTargetOpen` exported at 1222 and called at 1618–1619 with
`ghFetchPrState`; the fail-SAFE `return null` at 547. So §9.5's *reasoning* needs no correction.

**Why this is S2 and not cosmetic.** RULE 4's arming detector names "grep the UNION of the three
markers" as its mandatory second instrument, and both DOCTRINE §9.5 and `MEMORY.md` identify those
markers *by line number* (`:728`, `:730`, `:732`). An agent that verifies the detector by reading
those lines finds `try {`, `} catch (_) {` and `}` — no markers — and the available conclusions are
all wrong in the dangerous direction: *the linter does not gate arming*. That reasoning ends in
arming a never-arm prompt, which is the failure RULE 4 exists to prevent. §9.6 applies exactly:
an empty result is not an empty world.

The cure is already written, in this same section: *"A line-number citation into a file outside this
document is invalidated by any edit above it — prefer a symbol name or a fixed comment string as the
anchor."* §9.5 states that rule and then violates it sixteen times. The drift is uniform (~90 lines),
consistent with one insertion above line 439 — so nobody edited a claim; the file simply moved
underneath every claim at once, silently, which is the §7 shape.

RULE 1 — the complete-and-additive fix, which is also the only one that survives the next insertion:
**replace every line-number citation in §9.5 with a symbol or fixed-comment anchor** (`DO_NOT_ARM_CAPS
=`, `function readFromOriginMain`, `LINT_GH_BIN`), and make the same edit in `MEMORY.md`'s RULE 4
detector. Immediate (the numbers become right) and future (they cannot rot again), and it damages no
data entry — it is a documentation edit. The alternative, *renumber to 818/820/822*, fails the
**future** half outright: it is correct only until the next edit above line 818, which is how we got
here. Doing nothing fails both halves.

**Scope note for whoever takes it:** §9.5 sits inside `<!-- CANONICAL-BLOCK: instruments v2 -->`, so
the edit must be followed by `node scripts/pipeline/lint-station.mjs --write-canonical`. That block
is DOCTRINE-only, so the whole change touches **two files, both under `docs/`** —
`docs/pipeline/DOCTRINE.md` and `docs/pipeline/stations/_canonical-blocks.json` (`CANON_FILE =
join(STATION_DIR, '_canonical-blocks.json')`, `lint-station.mjs:22`). It is therefore a genuine
docs-lane change, not Marco's, under `classifyPolicyFiles`.

**DISPATCHED** → Station 00. I am read-only on the board and did not stage this as a prompt: the
edit is inseparable from a canonical-hash re-record, and a prompt that edits the block without
re-recording the hash lands a red `lint-station` on the board. 00 owns canonical-block re-records
and board doc PRs. Handed over: the table above, the symbol anchors to substitute, the two file
paths, and the `--write-canonical` step.

### F2 — S3 · §9.5's "13 arms published nowhere" is REFUTED by its own falsifying probe

DOCTRINE §9.5 states `origin/main:docs/pr-prompts/.arming-log.txt` is **37** lines ending
`2026-09-03T03:40:31Z` against a **50**-line working copy — "13 arms published nowhere" — and then
does the thing every claim in that document should do: it names the probe that would falsify it
("the falsifying probe for this bullet is that two-line-count comparison — re-run it before quoting
either half").

[MEASURED] I re-ran it. `origin/main` = **50** lines; disk = **50** lines; both end on the identical
row `2026-09-04T11:29:24Z  ARMED  pr-lint-gate-path-space  escalates=false  by=Marco@  pid=31616
caller=powershell.exe:19060`. Controls: `git ls-files --error-unmatch` on the log → exit **0**, on a
nonexistent path → exit **1**. **The counts agree. The gap is closed and the headline is dead.**

The tracked-ness half stands (the log is tracked, and carries `by=`/`pid=`/`caller=`, so escalation
**#22's option (A) is built and merged** — it should stop being offered). The underlying defect —
that nothing commits the log *on purpose*, so it stays published-by-luck — is unchanged and still
worth fixing.

This is the healthiest thing I measured all run and it deserves saying plainly: a bullet that
carried its own falsifier got retired in one probe by a station with no memory of it. That is the
pattern F1 is asking for.

**DISPATCHED** → Station 00, to fold into the same §9 doc-reconcile as F1: replace the 37-vs-50
narrative with the closed state, keep the "nothing commits it on purpose" defect, and delete the
"13 arms" figure so it cannot be quoted again.

### F3 — S3 · §9.1's `$`-expansion cause does not reproduce on this session's `start_process` path

§9.1 opens: *"`$` is EXPANDED by the `-Command "..."` layer before PowerShell parses it — `$true`→
`True`, `$PID`→the new process's PID, undefined and `$env:` forms→empty."*

[MEASURED], with the discriminating control the bullet itself names:

- `$CTRL=42; "CTRL-literal-is:$CTRL"` → **`CTRL-literal-is:42`**. Under pre-expansion `$CTRL` is
  undefined at expansion time and this must print empty. It printed 42.
- `"env-user:$env:USERNAME"` → **`env-user:Marco`**. The bullet predicts empty.
- `$true` → `True`; `$PID` → `19756`, equal to the real process id — both non-discriminating, since
  ordinary PowerShell produces the same.

So on **this** path — a scheduled Cowork run, Desktop Commander `start_process`, shell
`powershell.exe` — there is no pre-expansion layer.

🔴 **I am reporting a non-reproduction, NOT a refutation, and the distinction is the whole finding.**
The station doc warns that the scheduled and interactive sessions differ in how tools are exposed;
one environment measuring "no pre-expansion" cannot retire a rule that was measured true elsewhere.
And the prescribed cure — put anything containing `$` in a `.ps1` run with `-File` — costs nothing,
so keeping it is free while retiring it wrongly re-opens a silent-wrong-value class. I followed the
cure for every `$`-bearing probe this run regardless.

RULE 1: the complete-and-additive edit is to **re-scope the bullet to name the invocation path it
was measured on**, and record this run's contrary measurement beside it with its control — additive,
retires nothing, and makes the next station's reading conclusive either way. Deleting the bullet
fails the *"without damaging"* half (it removes a live guard on the strength of one environment);
leaving it unqualified fails the *complete* half (a station that measures what I measured will
conclude §9 is unreliable, and §9's authority is load-bearing).

**DISPATCHED** → Station 00, same §9 doc-reconcile. Before editing, 00 should re-run the `$CTRL=42`
control in its own environment — if 00 reproduces the expansion, the bullet is path-specific and the
edit is a scope note; if 00 also fails to reproduce, it is a retirement and needs the wider check.

### F4 — INFORMATIONAL · twelve §9 traps re-verified live, all still trapped

M1–M12 above. Recorded so a future run can tell "verified today" from "never checked". Two carry
updated state worth noting: the untracked `pr/*` refs behind M4 have grown from five to **seven**,
and the RULE 2 decoy in M12 is now **eighteen days** stale while still passing its positive control.

**ACTIONED** — the verification was the deliverable, and the evidence is in WHAT I MEASURED with the
command and controls for each.

## WHAT I DID NOT DO

- **No board mutation of any kind** — no merge, arm, label, rename, push or PR. Three PRs are open
  (#1594, #1593, #1589), all green, and **all three are Marco's** under §10.1 hand-classification;
  I did not touch them and RULE 2 was never in play for me.
- **Did not commit `sweep-rotation.json`**, though I advanced it. That is 00's, per the authority
  matrix; committing it is the one thing 04 is explicitly forbidden to do here.
- **Did not stage a prompt.** My budget allows two; I used zero. F1's fix is inseparable from a
  canonical-hash re-record, and a prompt that edited the block without it would land red. Report,
  don't half-fix.
- **Did not run Part 0, Part 1 or the live-site pass.** The rotation assigned
  `instrument-honesty` and the station doc is explicit that one named sweep covered completely
  beats a shallow pass over everything. Next run takes `repo-hygiene`.
- **Did not re-derive escalation #23** (the freshness detector's `2×cadence` blindness). I saw its
  mechanism again at `check-breadcrumb.mjs:35` — `A station is SILENT past 2x its cadence` — but it
  is already open with Marco and re-raising it would be noise.
- **Did not touch the two LIVE STATION WORKTREES** (`C:/po-bc-ff`, `C:/po-vg`) or any of the four
  orphans and two registry escapees the sweep listed. Those are Station 03's, and `repo-hygiene`
  next run is the right place for them.
- **Did not clear any `[STALE]` escalation** the sweep flagged in §5, including the six now-dead
  refs in `agent-authored-rule-2-clearance-2026-09-04.md`. Not my lane.
- **Azure / Entra / SharePoint: untouched.** Nothing this run went near them.
