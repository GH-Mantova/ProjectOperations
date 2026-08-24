# HANDOVER → STATION 06 (PR MASTER) — the three failure modes that gate arming

**Written by:** Station 00 (Supervisor), 2026-08-21T01:15Z
**Measured at:** `origin/main` = `c1737312` (#1293, merged 2026-08-20T19:04:58Z) · **0 open PRs** ·
trunk green 3/3 · dev tree `C:\ProjectOperations2` @ `c211ad62`, 3 behind, **0 armed on disk**
**Sweep verdict at time of writing:** `SAFE TO ACT` (the 14.5 h stale `index.lock` was cleared at
01:09Z — see `00-machine-minder-2026-08-21-0100-stale-index-lock-cleared.md`).

## Marco's ruling, 2026-08-21

Asked whether to resume arming, he chose: **hold. Fix the three failure modes first.**

> Arming now runs work through instruments that are known to discard it — that is how
> `no-pr-opened/` reached its current size.

**The queue stays empty until all three land.** RULE 4's overnight stop remains in force. This is
not a pause for lack of work; it is a deliberate refusal to feed a broken machine.

**LANE RULE (LL-38): the Supervisor does not create these PRs.** This document is the handover.
Station 06 designs and stages; the Supervisor arms, one at a time, only after each lands.

---

## ITEM 1 — the apierr gate bins ~66 files of designed work as "already finished"

**Decided by Marco 2026-08-20. Do not re-litigate; do not hand-correct premises one by one; do not
leave the cluster parked.**

The raw-error-envelope gate reports **0 files** when reality is **25 sites across 17 files**. Cause:
the defect spans two lines and the gate is a single-line regex keyed to the literal identifier
`res`. **All nine `pr-apierr-*-HOLD.md` carry that same regex as their `premise:`** — so arming any
of them lints exit-3 and the prompt is binned as complete.

**The slice:** repoint all nine premises onto Scanner's calibrated replacement,
`outputs/scanner-2026-08-20/check-raw-error-envelope.mjs`, which is already built and **proved in
both directions**. Then the chain arms normally, one slice at a time.

**Do NOT arm `s12-ci-gate`** until the shape-grep across `apps/web/src` prints 0 — it is self-gating
and arming it early only burns a run.

**Gate:** the slice must assert an artifact it produces itself — the nine rewritten `premise:` lines
— not the register that declares them.

---

## ITEM 2 — the STANDING AUTHORITY heading is an imposter in 16 prompts (LL-53)

**Measured cost: two completed agent runs discarded on 2026-08-20 alone.** Both linted ADMIT, both
did the work, both sit in `no-pr-opened/`, and both are still tracked-armed on `main` so a fresh
checkout re-runs and re-kills them:

- `pr-e2e-container-s1-trial-workflow` — **no standing-authority block at all.** It built the whole
  containerised workflow, self-verified against a seven-point spec table (every line ✓), then ended
  *"Want me to commit and push this as the slice-1 PR, or is more work needed first?"*
- `pr-rates-drop-prompt-corrections` — **imposter block:** the heading says STANDING AUTHORITY, the
  body says *"Documentation corrections only. Stop and report rather than widening scope."*
  `done_when` verified green. Never pushed.

**Census, with the counting rule beside the count** (window = 12 lines after the heading; GRANT if
the body matches `/push|open the PR|create the PR|do not ask|without asking/i`):
`total=81 · grant=44 · imposter=16 · no-block=21`. A prior pass on a different window gave
42/16/24 of 82 — different corpus, so it does not refute this one, and **the load-bearing number,
`imposter=16`, is unchanged in both.**

**The repair:** for each of the 16, **append the verbatim PROMPT-SCHEMA grant and KEEP the existing
scope constraint.** The two are not in conflict — "do not widen scope" and "push without asking"
are orthogonal, and conflating them is precisely the bug.

**Second half, already staged:** `pr-lintgate-standing-authority-detector-HOLD.md` — WARN-ONLY by
design. **Do not make it REJECT**: a reject jams 38 of 75 prompts. Note that `lint-prompt.mjs` *is*
an arming gate after all — the watcher never calls it, but `queue-sync.ps1:131` does and honours
the exit code.

**Standing rule that outranks all of this: read the body, never grep the heading.**

---

## ITEM 3 — `[NO-PR]` is a silent success; make it a hard failure with bounded auto-restage

**Decided by Marco 2026-08-20:** hard failure + auto-restage, bounded `b`, then `c`, then `failed/`.

`index.mjs:2218-2230` already *says* `[NO-PR]` is "NOT treated as success" — **but nothing follows
it.** No retry, no surfacing, no restage. The run dies quietly and the pile grows.

**There are two failure modes and the fix must handle both:**

- **Mode A — did the work, then asked.** Logs are 1–2 KB, the work exists and is recoverable.
  Auto-restage alone helps here.
- **Mode B — asked first, was dismissed, stopped.** `pr-comms-hub-inbox` at 09:16Z: asked before
  doing anything, the question was dismissed (headless run, no human), and the agent read the
  dismissal as *stop*. 68 seconds, 465-byte log, **zero work done.**

**Auto-restage alone does NOT fix Mode B** — restaging just asks again, gets dismissed again, and
burns one run per cycle until the retry bound trips. **The contract needs the other half: in a
headless run, a dismissed question means PROCEED ON BEST JUDGEMENT, not halt.** The STANDING
AUTHORITY block already says "there is no human in this run"; the agent read it and asked anyway.

**Recovery of the existing pile is explicitly deferred:** Marco ruled *wait for auto-restage to
land, then recover the discarded runs systematically.* Do not hand-re-arm them now — repeated runs
against an unfixed failure mode is how the pile reached its current size.

---

## ITEM 4 (new, approved 2026-08-21) — harden `status-sweep.ps1` against a stale lock

§3 reports `git index.lock interactive: True` and §7 escalates that to
`DO NOT ACT: a board mutation is in progress`. **The lock never expires**, so one leftover file
freezes every station's verdict permanently. This has now happened **twice in two days**
(2026-08-20, ~242 min; 2026-08-21, 894 min, 0 bytes).

**The fix:** §3 must report the lock's **byte size and age**, and §7 must only escalate to a live
mutation when the lock is recent **and** `GIT_PROCS > 0` **and/or** a mid-operation HEAD
(`MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` / `sequencer`)
exists. A 0-byte lock hours old with no git process is **STALE**, and the sweep should say so in
those words rather than reading it as a mutation.

**Ask of this check what would have made it fail** (LL-48): with the current logic, nothing — the
lock's mere existence is sufficient, which is why it cannot distinguish the two states it exists to
distinguish.

---

## RULE 1 applied to the ordering

Marco's principle: *solve it completely, immediately and in future, without damaging existing or
future data entry.*

All four items are **additive and non-destructive** — they repoint premises, append grant text, add
a retry path, and widen a diagnostic. None deletes a prompt, drops a row, or narrows access.
Ordering is by what unblocks the most: **ITEM 2 and ITEM 3 first** (they are why finished work is
being thrown away), then **ITEM 1** (which unblocks ~66 files of designed work), with **ITEM 4** at
any time — it is independent and touches only the sweep script.

## Board hazards Station 06 must not trip

- **9 `*-ready.md` are TRACKED on `origin/main`; 7 sit in the dev tree as uncommitted deletions.**
  A `git checkout .`, `git reset --hard`, `git stash pop`, or `git clean` **re-arms all 7, and 5 of
  them are dead prompts that have already run.** Park deletions with
  `git stash push -- docs/pr-prompts/`, fast-forward, delete only the `-ready.md` that also exist in
  `processed/`, then **`git stash drop` — never pop.**
- The remaining 2 (`pr-qa-backlog-discharge-fold-key-guard`, `pr-qa-scanner-brief-instrument-corrections`)
  arrived with #1293, are not yet in the dev tree, and are the genuinely-pending pair.
- **Arming is a `git mv` of a tracked `-HOLD.md`, never the creation of a `-ready.md`** —
  `.gitignore:75` swallows the latter silently.
- **The watcher clone `C:\po-watcher\ProjectOperations` is 6 behind and 34 dirty.** Fast-forward the
  clone with the watcher STOPPED before relaunching; a restart alone adopts nothing.
- `pr-deps-clear-high-advisories` is **a premise that cannot die** — `extract-zip@2.0.1` has no
  upstream patch (#1178's own body: *"patched: null — CANNOT FIX"*). It is an unowned accepted HIGH
  advisory (Dependabot #88) and belongs to Marco, not to a prompt. Retire it; do not re-arm it.

---

# ITEM 5 (added 2026-08-21T01:50Z) — the boot sequence's first instruction fetches a 2026-07-08 README

**This is the highest-leverage item in the document, because it corrupts the FIRST action every new
chat takes.**

`sot/README.md:218` says *"Fetch URLs (use blob — raw CDN has delays)"*, and the project
instruction block, `bring-up-to-speed.ps1:62`, `sot/01:105`, and the `supervisor` skill all repeat
it. **On this one file that advice is wrong, and it fails silently.**

## MEASURED — four methods, one disagrees

Same file (`sot/README.md`), same moment, `origin/main` = `c1737312`. Discriminators: the
`Last reorganised:` line, and whether the chat-routing model is present or retired.

| Method | `Last reorganised:` | `CHAT ROUTING` heading | `BOOT SEQUENCE` / `CONCURRENCY RULES` | Verdict |
|---|---|---|---|---|
| `WebFetch` **bare blob** `github.com/.../blob/main/sot/README.md` | **2026-07-08** | **present** | **absent** | ❌ **WRONG — a version ~6 weeks stale** |
| `WebFetch` blob **`?plain=1`** | 2026-07-13 | absent | present | ✅ correct |
| `WebFetch` **raw.githubusercontent.com** | 2026-07-13 | absent | present | ✅ correct |
| GitHub MCP `get_file_contents` @ `refs/heads/main` | 2026-07-13 | absent | present | ✅ correct |

**Reproduced twice** on the bare blob URL, ~50 minutes apart with different prompts — so it is not
`WebFetch`'s 15-minute per-URL cache.

## The control that changed the diagnosis — run it before believing the obvious explanation

My first hypothesis was "GitHub blob pages are a React shell, so the converter gets no body text and
the summarising model invents a plausible old version." **That hypothesis is REFUTED.** A bare-blob
`WebFetch` of `sot/05-decisions-and-lessons.md` returned **correct, current** content — including
the `Decision register — Marco's D<n> series (D1–D55)` section that only landed on 2026-08-20 in
#1287, and which therefore cannot come from any model's prior. It even listed GitHub's own
`Navigation Menu` chrome as a heading, proving the rendered page *is* being read.

**So bare-blob fetching is not broken in general. It is broken on this file.**

`[INFERRED, not measured]` The discriminating variable is that the file is named **`README.md`**.
GitHub renders and caches a directory's README differently from an ordinary blob, and that is the
one file the boot sequence mandates. I cannot see GitHub's cache to prove this, and I am not
claiming it as fact — but the behaviour is reproducible and the correlation is exact.

## The repo already contradicts itself on this

`sot/01-charter-and-architecture.md:105` — *"Key URLs (use blob URL — raw CDN has delays)"*
`sot/01-charter-and-architecture.md:1261` — *"always use the raw URL for reading file contents — the blob URL…"*
Same file, opposite instructions. The second one is right.

## Blast radius — MEASURED (`git grep` at `c1737312`, positive control: 190 files match the repo name)

**3 tracked files carry bare blob URLs; 4 carry the "use blob / raw CDN lags" advice.** Small, and
split cleanly by lane:

- **`docs`/`scripts` class — Station 06 can fix by ordinary PR:**
  `scripts/pipeline/bring-up-to-speed.ps1:62-63`
- **`sot/` class — STATION 05 ONLY, via doc-reconcile PR. Do not touch these from a code PR (CP-24
  hard-fails any PR mixing code and `sot/`):**
  `sot/README.md:218-226` (the whole Fetch URLs block) · `sot/01-charter-and-architecture.md:105-109,
  1212, 1260-1261`
- **Outside the repo, Marco's to change:** the Cowork project-instructions paste block, and the
  `supervisor` skill's line *"web_fetch the blob URL; the raw CDN lags"*.

## The fix — `?plain=1`, not raw

Per RULE 1, the complete-and-additive option: **append `?plain=1` to every `github.com/.../blob/...`
URL.** It keeps the `github.com` host, so the original "raw CDN has delays" concern does not apply
at all; it returns the true file text; and it is a mechanical, one-suffix change to every existing
URL with nothing else altered.

Switching to `raw.githubusercontent.com` also returns the truth and is the correct fallback, but it
re-opens the CDN-delay question the current wording exists to avoid — so it fails the *future* half
of RULE 1 as the primary recommendation.

**And add the belt-and-braces line, which costs nothing:** `bring-up-to-speed.ps1` §C2 already
prints `sot/README.md` **in full from the local checkout**. Any chat that ran the mandated sweep has
already been handed the truthful text and does not need the fetch at all. Say so at the fetch line.

## The generalisable lesson (LL — cite the rule, not a number; the `LL-47…53` band is double-booked)

**A fetch that returns confident, well-formed, plausible content is not evidence that it returned
the right content.** This one had been noted before as "WebFetch returns the retired README" and
recorded as *"only the local checkout is truthful"* — which is **too strong and was never tested**.
Three of the four methods are truthful. Nobody had run the comparison, so the workaround was wider
than the defect and the defect stayed unfixed.

**Test a suspect instrument against a known-current fact, and test at least one control case it
should pass.** The control is what located the defect; the failure alone only proved something was
wrong.

---

# ITEM 6 (added 2026-08-21T04:00Z) — the stale-lock ROOT CAUSE is measured. ITEM 4 alone only treats the symptom.

When ITEM 4 was written the cause was recorded as **unknown**. It is now **[MEASURED]**, and it
changes the fix.

## The mechanism

**Station sessions run `git` against the Windows `.git` directory from their own Linux workspace VM,
through the connected-folder mount — not through Desktop Commander on Windows.** When one of those
git calls is cut short, it leaves a **0-byte `index.lock` and NO Windows process.**

That is why the symptom is so durable:
- *"zero git processes running"* is **always** true, because the process was never on Windows;
- the lock therefore never expires and nothing on the box will ever clean it up;
- `status-sweep.ps1` §7 escalates its mere existence to `DO NOT ACT`, and every station freezes.

Three occurrences, one signature: 2026-08-20 (~242 min), 2026-08-21 01:09Z (894 min), 2026-08-21
03:48Z (95 min).

## The evidence chain, each link measured

1. `get_device_info` lists `C:\ProjectOperations2` in `connectedFolders` — mounted read-write into
   every session VM.
2. From a station VM the lock was directly visible on the mount:
   `-rwx------ … 0 Aug 21 02:13 /sessions/<id>/mnt/ProjectOperations2/.git/index.lock`.
3. Desktop Commander's own tool-call log has a **hard gap 01:48:56Z → 03:35:51Z** — yet inside that
   window `C:\po-sup-fix-scripts\` gained six new `.ps1`/`.txt` files (02:10:36–02:33:01Z) and
   `docs/qa/qa-findings.md` + `qa-checklist.md` were rewritten (02:26Z). **Work reached the disk
   through a channel that is not Desktop Commander.**
4. Session VM `/sessions/dreamy-magical-wright/` has mtime **02:09:58Z** — 20 s before the
   `00 supervisor (local)` fire at **02:10:18Z**. That is the run.
5. `.git/index` was rewritten **02:12:56Z** (a git write that completed). `index.lock` was created
   **02:13:05Z**, nine seconds later, 0 bytes — **lock taken, index content never written.**
6. The same signature exists elsewhere: worktree `po-scan-0CwZSs`, gitdir `/tmp/po-scan-0CwZSs` — a
   Linux path in a destroyed VM — holding its own 0-byte `HEAD.lock` and `index.lock` from
   2026-08-20T22:12:00Z.

**[CANNOT MEASURE]** the exact subcommand, or whether it was cut by the VM's ~45 s command cap or an
interrupted tool call — that session's VM and transcript are gone. Note the session **kept working
until 02:33Z**, so it did not die at 02:13; one git call was cut short and the run carried on unaware.

**Ruled out, all measured:** a Windows-side git leak (0 git processes at three separate checks; zero
Desktop Commander `start_process` calls in the window) · the watcher (**zero** `02:*` lines in
`watcher-launch.log`, last write 01:43Z; its clone has no lock and no mid-op state) · an interrupted
merge/rebase/cherry-pick/bisect/sequencer (all seven markers absent in both trees; reflog stops at
01:40Z, no ref moved at 02:13) · a Windows Scheduled Task · a still-live station session · the
02:50:55Z scanner run (the lock predates it by 38 minutes).

## The fix — both halves, per RULE 1

**(a) PREVENTION — route station git writes through Desktop Commander on the Windows side.** A git
process that runs on Windows is visible in `Get-CimInstance`, dies with a diagnosable exit code, and
leaves a lock that the "is a git process running?" check can actually adjudicate. This is the half
that stops new locks being created. *Solves it for the future.*

**(b) HONEST INSTRUMENT — ITEM 4's sweep hardening.** §7 must stop escalating a provably-orphaned
0-byte lock to `DO NOT ACT`. Report the lock's **size and age**, and escalate only when it is recent
**and** corroborated by a live git process or a mid-op HEAD. *Solves it immediately, and covers the
locks that already exist plus any future channel we have not thought of.*

**Neither half is sufficient alone.** (a) without (b) leaves three orphaned locks already on disk and
still freezes the board on the next unforeseen cause. (b) without (a) leaves the sweep permanently
apologising for a defect nobody fixed, and the locks keep accumulating. **Both are additive — they
change no board state, no prompt, and no data.**

## Also flagged, not actioned

- `.git/worktrees/po-scan-0CwZSs` — registered, **locked**, gitdir pointing into a destroyed VM,
  holding 0-byte `HEAD.lock` + `index.lock`. Same failure class. `prune` will not remove it while
  locked. Needs a decision, not a reflex.
- `.git/objects/maintenance.lock` — 0 bytes, 2026-08-18. Same signature, different lock.

## The lesson

**"No process is holding it" is only evidence when you know where the process would have run.** The
check that made this defect invisible for three occurrences — *"0 git processes, therefore stale but
mysterious"* — was reading the wrong machine. Ask where the writer lives before trusting a
liveness test about it.
