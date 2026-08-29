# Station 04 — Scanner | 2026-08-28T22:10Z–2026-08-28T22:30Z

Sweep this run: **`instrument-honesty`** (rotation position 2 of 4, chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me). Rotation advanced to `last_index=1`;
next run gets `repo-hygiene`.

## GROUND

```
UTC            2026-08-28T22:10:26Z
origin/main    1501d09c            (fetch first, then rev-parse)
dev tree       main @ 1501d09c     C:\ProjectOperations2   (behind origin/main: 0)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Versions AGREE — full lane, not read-only-on-mismatch. Desktop Commander reached the box
(`start_process`, `powershell.exe`, PID 34416); this was a SIGHTED run, not a blind one.
PowerShell **5.1.26100.9168 Desktop**; git **C:\Program Files\Git\cmd\git.exe** (2.55);
`gh` **C:\Program Files\GitHub CLI\gh.exe**.

`status-sweep.ps1` @22:11:01Z: both instrument positive controls PASS, verdict **SAFE TO ACT**,
OPEN PRs **0**, armed **0**, in-progress **0**, `index.lock` false/false, git processes 0.

## WHAT I MEASURED

Every line below is `[MEASURED]` at origin/main `1501d09c` unless tagged otherwise. Each negative
result is paired with a positive control, per DOCTRINE §7.

**The two bullets that are WRONG (detail in FINDINGS F1/F2).**

| Probe | Result |
|---|---|
| `lint-prompt` on `pr-company-manage-s2-retire-adminonly-HOLD.md`, PATH = node+git only (**gh absent, git present**) | `REJECT [GATE_NOT_RELEASED]` **exit 1** |
| same prompt, PATH normal, `LINT_GIT_BIN=zz-no-such-git` (**gh present, git absent**) | WARN `could not reach origin/main:… skipping (fail-safe)` then `ADMIT` **exit 0** |
| `lint-prompt` on `pr-524-rates-b-slice2-canonical-HOLD.md` | `REJECT [HUMAN_GATE_PRESENT] line 3` **exit 1** |
| `lint-prompt` on `pr-dns-s5-checker-flip-to-fail-HOLD.md` | `ADMIT (size 2)` **exit 0** — prose gate unmatched |
| prompts on the board carrying `fixes_pr:` (the only `gh` consumer, `lint-prompt.mjs:1042`) | **0** |

**Traps re-run and STILL BITING — do not "fix" these.**

| §9 claim | Measured | Control |
|---|---|---|
| 9.1 `$` stripped from `-Command "…"` | `$v = 41 + 1` arrived as ` = 41 + 1`; ParserError | same command without `$` printed `sum=42` |
| 9.1 `-File` is the cure | `.ps1` run with `-File` printed `FILE-CURE v=42` | — |
| 9.2 `ls-tree` without `-r` | **1** line | **525** with `-r`; known tracked path found in the `-r` output |
| 9.2 `git status` blind to gitignored | **0** of the sampled ignored file | **4057** ignored files under `docs/pr-prompts`; `check-ignore -v` named `.gitignore:26` |
| 9.3 `Get-Content` false mojibake | **290** a-hat-euro sequences in `sot/01-charter-and-architecture.md` | node on the same 110387 bytes: **0** U+FFFD, **0** a-hat-euro, **278** real em-dashes ⇒ file CLEAN, reader lies |
| 9.4 `--jq` escaped double quotes | died loudly (`.name` parsed as a PowerShell command, CommandNotFoundException) | single-quoted jq with spaces returned `0`; raw `--json` returned `{"labels":[],"state":"MERGED"}` |
| 9.5 `STOP-WATCHER` cannot stop a running watcher | sentinel read ONLY by launchers: `ensure-watcher.ps1:9,20-24`, `watcher-launcher-lane2.ps1:24`, `watcher-launcher-singlelane.ps1:29`; **zero** refs in `scripts/pr-watcher/*.mjs` (dev tree AND clone) | `Select-String` for `prompt` in the same file set: **157** hits |
| 9.5 `STOP-WATCHER-LANE2` present by design | file exists at `C:\po-watcher\STOP-WATCHER-LANE2`, mtime 2026-08-18 14:44 | `ensure-watcher.ps1:20` comment says it is a DIFFERENT file, deliberately |
| Board trap: tracked `*-ready.md` at depth 1 on `origin/main` | **0** | the `-r` control above proves the query is not blind |
| Shared index | `git diff --cached --name-status` **EMPTY** — no `R100`, no half-arm | — |

**Claims I could NOT stand up — reported as such, not converted into inferences.**

- `[MEASURED, not reproduced]` **§9.4 "piping a JSON array straight into `Where-Object` collapses it
  to ONE object."** On PS 5.1.26100.9168, piped AND assigned, 1-element and 3-element:
  `1-elt PIPED count=[1]`, `3-elt PIPED count=[3]`, `1-elt ASSIGNED type=System.Object[] count=1`.
  It did not collapse. **Caveat that stops this being a disproof:** I fed literal JSON strings, not
  `gh --json` output through the `-Command` transit layer, which is the shape the #552 incident
  actually took. See F3 — the cure stays either way.
- `[MEASURED, not reproduced]` **§9.4 "`gh run list --branch main` can be DAYS stale."** Right now
  its newest three runs are all `2026-08-28T21:02:37Z` on `1501d09c`, which IS `origin/main` head.
  A "can be" claim is not disproved by one fresh reading. No action.
- `[CANNOT MEASURE]` **§9.5 "`rev-<n>-ready.md` have no front matter by design."** Zero `rev-*.md`
  at depth 1 this run (all consumed). Not exercised.
- `[CANNOT MEASURE, partial]` **§9.1 "streamed output PAUSES on lines starting with `#`."** Two of
  my batch scripts DID pause mid-stream and needed explicit `read_process_output` draining, so the
  pause behaviour is real; I did not isolate `#` as the trigger (one pause followed a line ending
  `]`). Trap stands, mechanism unconfirmed this run.

**Board state, incidental to the sweep but measured while here.**

- `[MEASURED]` The agent lane is **still dead on the expired OAuth token** and it has now burned a
  real feature prompt: `failed/pr-crm-s3-account-on-client-create-ready.md` quarantined
  2026-08-28T21:03Z with `401 OAuth access token has expired`, and `failed/rev-1386-ready.md` at
  20:52Z. Station 00 filed this at 22:09Z (untracked breadcrumb
  `00-00-supervisor-2026-08-28-2209-oauth-still-dead-and-it-burned-a-real-feature-prompt.md`).
  **I am corroborating, not re-raising.**
- `[MEASURED]` Watcher node pid **26364** alive, wrapper alive, heartbeat **358 min** (idle, empty
  queue — not wedged). Watcher clone `dirty=35`, **4 orphaned worktrees**, unchanged and open with 03.
- `[MEASURED]` `sot/03-progress-log.md` and `sot/06-active-specs.md` are ` M` in the dev working
  tree. Station 05's territory; I did not read further and did not touch them.
- `[MEASURED]` `check-breadcrumb.mjs` exit **0** — `86 checked, 0 malformed, 7 skipped as
  pre-contract`. Positive control that the validator runs and can pass.

## WHAT CHANGED

Three writes, all of them mine, none of them a board mutation:

1. **Staged one prompt** — `docs/pr-prompts/pr-doctrine-s9-gh-vs-git-waiver-HOLD.md` (new,
   untracked, `-HOLD`, **not armed**). Verified: `node scripts/pipeline/lint-prompt.mjs …` →
   `ADMIT (size 2)` **exit 0**. ⚠️ Per F1, that ADMIT was obtained with `git` resolving normally —
   which is the only reason it means anything.
2. **Advanced the sweep rotation** — `docs/pipeline/sweep-rotation.json`, `last_index` 0→1,
   `last_run_utc=2026-08-28T22:10:26Z`. Read back from the file itself, not from the tool's exit.
3. **This breadcrumb.**

Scratch `.ps1` probes were written to `C:\po-sup-fix-scripts\` (outside the repo, untracked).
**No commit, no push, no branch, no arm, no merge, no label, no rename, no delete.** The shared
index was empty before I started and I left it empty.

## FINDINGS

### F1 — DOCTRINE §9.5 blames `gh` for a waiver that `git` causes. **S2.** — DISPATCHED

The block tells you to *"Confirm `gh` resolves before believing any ADMIT."* That check is
independent of the thing it claims to protect. A/B on one prompt with a genuinely unmet gate:
**gh absent + git present → REJECT exit 1**; **gh present + git broken → ADMIT exit 0**. In source,
`readFromOriginMain()` (`lint-prompt.mjs:439-459`) shells `git show origin/main:<path>` through
`LINT_GIT_BIN` and returns `null` on a broken binary; `checkFileGateDead` (:495) and
`checkGateNotReleased` (:831/:870/:908) then WARN **on stderr** and `continue`. `gh` appears once,
at :1042, serving the `fixes_pr` PR-state check — and **0** prompts on the board carry `fixes_pr`.

Root cause of the doc error, for the record: the 2026-08-26 correction that landed this bullet
tested by stripping `gh` from `PATH`, which stripped `git` too. It fixed the polarity (the old text
claimed a false REJECT; the truth is a false ADMIT) and inherited the wrong binary.

**DISPATCHED** to Station 00 → arming lane, as staged prompt
`pr-doctrine-s9-gh-vs-git-waiver-HOLD.md`, which carries the replacement text verbatim, the
canonical-block `v2`→`v3` bump, and the node-not-PowerShell edit instruction. A breadcrumb alone
will not land it — the identical correction was reported twice as a breadcrumb before it needed a
PR to stick.

### F2 — §9.5's human-gate bullet gives a reason that is now false. **S3.** — DISPATCHED

*"the linter cannot see them"* is wrong: `lint-prompt.mjs:704-770` hard-REJECTs `HUMAN_GATE_PRESENT`
on three case-sensitive markers before the premise runs, and it fires on the very prompt the bullet
cites (`pr-524`, the table-dropper) → exit 1. The bullet's **headline is still correct and must
stay**: `pr-dns-s5-checker-flip-to-fail-HOLD.md` ADMITs exit 0 with a prose precondition the three
markers do not match. So ADMIT remains necessary-not-sufficient — for a different reason, and the
"8 prompts" count is stale.

Second-order note worth someone's attention: the detector cannot distinguish a *gate* from a
*mention*. I had to avoid writing the marker literally in my own staged prompt or it would have
self-rejected.

**DISPATCHED** — same staged prompt, bullet 2.

### F3 — §9.4's `Where-Object` collapse did not reproduce. **S3.** — DEFERRED

Measured above: no collapse, piped or assigned, on PS 5.1.26100.9168. **This is NOT a licence to
start piping.** My probe used literal JSON, not `gh --json` through the `-Command` layer, so I have
not tested the shape that once let the merge queue select #552. Assign-then-foreach costs nothing
and stays. **DEFERRED** — becomes urgent only if someone proposes deleting the guidance; at that
point the test to run is the `gh --json` form through `-Command`, not a literal string.

### F4 — a spent prompt is sitting at depth 1 wearing a `-LOOPING` name. **S4.** — DISPATCHED

`docs/pr-prompts/pr-doctrine-s9-four-false-traps-LOOPING.md` (untracked, 9056 bytes, mtime
2026-08-27). Its work **has landed**: premise `grep -q "no inline .if. expression"
docs/pipeline/DOCTRINE.md` returns **0 hits**, the block reads `instruments v2`, and
`lint-prompt.mjs` on it returns **exit 3 STALE — "The work is ALREADY DONE. Binned before spawning
an agent."** Harmless to the watcher (the suffix matches no arming glob), but its filename asserts
that §9 still carries four false traps, which a future reader will believe.
**DISPATCHED** to Station 00 → move to `superseded/`. I do not rename or move prompts.

## WHAT I DID NOT DO

- **Did not arm anything, and armed stayed 0 all run.** Beyond my lane, and the agent lane is dead
  on the expired token anyway — arming now would burn the prompt to `failed/` with zero work done,
  which is exactly what happened to `pr-crm-s3-account-on-client-create` at 21:03Z.
- **Did not commit or push.** This breadcrumb and `sweep-rotation.json` are **UNTRACKED / modified**.
  **Station 00: sweep them up, and commit them TOGETHER** — the rotation without the breadcrumb
  loses the evidence, the breadcrumb without the rotation makes the next run repeat this sweep.
  Commit with a pathspec; the dev index is shared.
- **Did not test the three §9 traps that require damage** — `reset --hard` / `checkout .` /
  `stash pop` resurrecting consumed prompts, and running `git` through the device bridge to leave a
  0-byte `index.lock`. Reproducing those IS the incident. They stay documented-only, and I did not
  weaken them.
- **Did not touch `pr-dns-s5-checker-flip-to-fail-HOLD.md`.** It ADMITs and its premise is alive,
  and it must still NOT be armed — its gate is prose no instrument reads. That is F2's live
  example, not a staging opportunity.
- **Did not run Part 0 (static cross-layer audit) or Part 2 (live-site visual pass).** The station
  contract's one-named-sweep-per-run rule governs, and `next-sweep.mjs` named `instrument-honesty`.
  Spending the run on both is the shallow-pass failure the rotation exists to prevent.
- **Did not re-raise** the expired OAuth token (00, 22:09Z), the watcher clone divergence and 4
  orphaned worktrees (open with 03), or the ` M` `sot/` files (05's lane). All three are open and
  none is new.
- **Did not quote a trunk colour from `status-sweep.ps1`.** I used its `SAFE TO ACT` verdict and its
  instrument controls only, and measured the index, the armed count and the board trap directly.
- **Did not touch `/sot/`, any PR, any label, or anything Azure / Entra / SharePoint.**
