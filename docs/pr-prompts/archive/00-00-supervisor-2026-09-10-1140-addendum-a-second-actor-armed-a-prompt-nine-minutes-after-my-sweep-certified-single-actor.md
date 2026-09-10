# Station 00 — Supervisor | 2026-09-10T11:55Z–2026-09-10T12:0xZ (ADDENDUM to the 11:40Z run)

## GROUND

```
UTC            2026-09-10T11:58:00Z
origin/main    77e17808            (fetch --prune, then rev-parse)
dev tree       main @ 77e17808     C:\ProjectOperations2   (0 ahead / 0 behind)
doc version    1
bootstrap      1
```

Same run, same station, later measurement. The 11:40Z breadcrumb
(`00-00-supervisor-2026-09-10-1140-three-hourly-occurrences-never-fired-…`) stands unchanged; this
records something that happened **while it was being written** and could not have been in it.

## WHAT I MEASURED

The post-merge fast-forward read back `0 0` against `origin/main` — and `git diff --numstat` was
**not** empty, on two paths that were clean at 11:41:

```
1	0	docs/pr-prompts/.arming-log.txt
0	126	docs/pr-prompts/pr-triage-corpus-suffix-union-HOLD.md
```

**Insertions with ZERO deletions on an append-only file** is the discriminator DOCTRINE names: the
working copy is a strict superset of `main` and something in it has not landed. The line, verbatim:

```
2026-09-10T11:50:44Z  ARMED  pr-triage-corpus-suffix-union  escalates=false
actor=station-00.cowork-audit  by=Marco@LAPTOP-E6NHU4E4  pid=21888  caller=powershell.exe:28128
```

[MEASURED] at `77e17808`:

- **`git status --porcelain` in the dev tree at 11:41:xx returned nine `??` entries and ZERO
  modified.** Both paths above were clean. The arm is stamped **11:50:44Z**. It happened inside my
  run, nine minutes after `status-sweep.ps1` section 3 certified no `index.lock` in either tree, zero
  `git` processes, and no PR touched in two minutes — a verdict that was **true when printed**.
- The armed file's mtime is **07:32:23Z**, 4.3 hours before the arm, because `git mv` preserves
  mtime. The arming log is the only clock that dates an arm, exactly as section 9.5 says.
- The arming actor is **gone**: neither `pid=21888` nor `caller=powershell.exe:28128` is in the
  process table now.
- The watcher has **not built it yet** — no open PR matches the head-branch shape, and the newest
  daily clone log (name-shape filtered first, then newest by mtime: `2026-09-10.log`, mtime
  11:54:52Z) carries **3** `triage-corpus` references against POSITIVE control `[merge]` → 6,
  `opened PR #` → 3, NEGATIVE freshly-minted needle → **0**. So it is queued, not built.
- Board unchanged at 11:5xZ: `#1845`, `#1832`, `#1823`. The three that are Marco's.

## WHAT CHANGED

A second board PR, built in a fresh disposable worktree off `origin/main` at `77e17808`:

1. **`docs/pr-prompts/.arming-log.txt`** — carried into `main` with the second actor's line intact.
   Copied **byte-exact** with node and read back: src 11,312 = dst 11,312, `Buffer.compare` → 0, the
   new line present exactly once, 76 non-blank lines.
   🔴 **I did NOT restore this file to `HEAD`.** The fast-forward cure's step 1 (`git show HEAD:<path>`
   piped to a write) would have silently deleted an append-only audit line and every prescribed
   read-back would still have passed. On the insertions-with-zero-deletions shape, restoring to HEAD
   is a deletion, not a repair.
2. **`docs/pr-prompts/pr-triage-corpus-suffix-union-HOLD.md` retired** — the prompt the arm consumed.
   Left on `main` its premise stays alive, `triage-holds.ps1` keeps listing it under gates-satisfied,
   and the next arming decision can duplicate it. That is the stays-armable-forever defect, and this
   is the one move that closes it for this prompt.
3. **This addendum.**

Nothing else. No merge of anyone's PR, no arm of my own, no `/sot/`, no production data, no Azure.

## FINDINGS

### F1 — A second actor armed a prompt mid-run under a Station-00-shaped actor string, and nothing detected the collision. S2.

`actor=station-00.cowork-audit` is a **new** actor string on this board — the previously recorded
second actor is `actor=marco-delegated`. Both authenticate as Marco's account on Marco's machine, so
nothing downstream can tell either of them from a scheduled Station 00 run.

**Why this is the load-bearing condition and not a curiosity.** The board's single-actor design
rests entirely on condition 3 — *first confirm nothing else is mid-mutation* — and condition 3 is
enforced by nothing but the courtesy of whoever else is running. My sweep answered it correctly and
the answer decayed in nine minutes. This is section 7's `[LIVE]` rule in its most expensive form: a
correct reading of a quantity that is not stable for the length of a run. **The two actors did not
collide today only because the other one touched a file I was not touching.** Had it armed while I
held a staged `.arming-log.txt` — which any arming run does — one of the two arms would have been
silently dropped by the loser's commit.

**And the audit line was published nowhere.** The arming actor did not carry it into a PR. Per the
standing rule, any run that arms must commit the log in its board PR; a second lane does not read
the queue and does not know that rule exists. Until a scheduled run happens to notice the dirty file
and carry it — which is what this addendum is — an arm age read from `origin/main` is a lower bound
and a clone reads a **stale** arm history rather than an obviously absent one, which is the more
dangerous shape because it answers.

**The arm itself was sound and I am not reversing it.** `pr-triage-corpus-suffix-union` lints ADMIT,
its gates are satisfied, it carries no arming marker, and it was on my own gate-satisfied list at
11:5xZ. What it is **not** is free: its `scope:` is `scripts/pipeline/triage-holds.ps1`, outside
`tests|docs`, so `classifyPolicyFiles` will route its PR to Marco and it becomes the **fourth** PR
waiting on him, behind one that has now waited 35.9 hours. That is the arithmetic the 11:40Z
breadcrumb's F3 declined to add to, done by someone else ten minutes later — which is itself the
point: **two actors cannot hold one throughput policy between them.**

**ESCALATED.** Appended to the live filing
`needs-marco/agent-authored-rule-2-clearance-2026-09-04.md`'s neighbour — specifically, this is a new
instance for the standing second-actor question, and the question for Marco is narrow and is his
alone to answer: **is `station-00.cowork-audit` yours?** If it is, the ask is that it carry
`.arming-log.txt` in its own PR the way a scheduled run must, so the audit trail stops depending on
a later run noticing a dirty file. If it is not, that is a different and much larger question and it
starts with the arming path, which needs no credential beyond a shell on this box.

RULE 1 on the options, complete-and-additive first:

- **(a) Make the arming log self-publishing.** Have `arm-prompt.ps1` refuse to complete unless it can
  record the arm somewhere every lane can read — the same commit-or-refuse discipline the merge path
  already has. **Complete:** no lane can arm without publishing, whoever it is, including one that
  has never read this pipeline's documents. **Additive:** it discards no arm and blocks no actor; it
  only refuses to arm *silently*. Cost: a `scripts/` change, outside 00's merge lane.
- (b) Keep having scheduled runs sweep the dirty log. Fails the *future* half — it is what happens
  today, it depends on a run noticing, and the gap closes and re-opens by luck.
- (c) Restrict arming to one actor by convention. Fails both halves: convention is what is already
  failing, and it would discard legitimate work whenever Marco arms something himself.

### F2 — The post-merge fast-forward read `0 0` on a dirty tree, again. S3.

`git rev-list --left-right --count HEAD...origin/main` returned `0 0` — the prescribed read-back,
true, and useless on its own: the tree was at `origin/main` and dirty at the same time. Only the
second and third read-backs (`git diff --numstat`, `git diff --cached --name-status`) saw the two
paths, and only the first of those distinguishes an append from a smudge.

The station doc already records this exact trap and prescribes all three read-backs, which is why it
was caught rather than discovered by the next run. Recorded here as a **positive instance** — the
documented cure working on a cause it was not written for. It was written for a breadcrumb this run
had deleted; today it caught a file **another actor** had appended to.

**ACTIONED** — all three read-backs were run and the non-empty ones were diagnosed by shape
(insertions, zero deletions ⇒ append, not smudge) before anything was touched.

## WHAT I DID NOT DO

- **Did not restore `.arming-log.txt` to `HEAD`.** That is the measured 2026-09-06 trap: on an
  append-only file with a strict-superset diff, the prescribed restore silently deletes another
  actor's line and every read-back still passes. I carried the file forward byte-exact instead.
- **Did not disarm the prompt or rename it.** The arm is sound, its lint is ADMIT and its gates are
  met; reversing another actor's valid work because I did not authorise it is not my call, and it
  would discard work Marco may have asked for.
- **Did not merge, rebase or touch `#1845`, `#1832` or `#1823`.** All three carry a live watcher
  `marco:true` verdict; unlabelled is not a clearance.
- **Did not wait for the watcher to build the arm.** It is queued, not built, and standing by for it
  would push this run further past its slot — which is the 11:40Z breadcrumb's F1 and the one mistake
  this run should least repeat.
- **Did not open a new `needs-marco/` file.** The second-actor question is already live; a second
  filing splits the evidence.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, or production data.**
