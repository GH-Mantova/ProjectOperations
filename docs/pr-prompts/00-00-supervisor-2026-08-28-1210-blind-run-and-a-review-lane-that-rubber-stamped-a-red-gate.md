# Station 00 — Supervisor | 2026-08-28T12:05Z–2026-08-28T12:20Z

> 🔴 **CORRECTION, added 2026-08-28T14:4xZ by Station 00 before this file was ever committed.**
> The central finding below — that the review lane "excused a red gate as a phantom CP-26"
> — is **WITHDRAWN**. CP-26 is not a check *run*; it is a *step* inside the
> `PR gates — diff checks` job, and the job log for #1377
> (`gh run view 33163316790 --job 98822755117 --log`) names it verbatim as the only FAIL:
> `FAIL - CP-26 do-not-merge [PR carries the do-not-merge label ...]`. The reviewer's
> "CI green except expected CP-26" was **accurate**. Read the withdrawal, and what
> replaces it, in `00-00-supervisor-2026-08-28-1409-cp26-is-real-i-withdraw-the-phantom-gate-finding.md`.
> Everything else in this file stands.

## GROUND

```
UTC            2026-08-28T12:10:01Z   (date -u, sandbox)
origin/main    CANNOT MEASURE         (no shell; git is a hard stop through the bridge)
dev tree       READ-ONLY via mount    C:\ProjectOperations2 reachable, contents readable
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                      (station_doc_version in the scheduled-task file)
```

Versions AGREE. **THIS WAS A BLIND RUN, NOT A QUIET ONE.** Desktop Commander never finished
connecting: `start_process` / `interact_with_process` are absent from this session's tool set after
three ToolSearch attempts spanning ~60s (server reported "still connecting" throughout, then dropped
out of the connecting list without ever exposing a tool). This is the ~25 % DC-blind failure mode
already ESCALATED in memory.

**What blind cost me:** no `git` (⇒ **cannot ARM** — arming is a `git mv` of a tracked HOLD), no `gh`
(⇒ **cannot MERGE**; the GitHub MCP token cannot merge either), no `Get-Process` (⇒ **cannot confirm
the watcher pid**), no `check-breadcrumb.mjs --freshness`, no commit of anything.

**What blind did NOT cost me:** the dev tree is mounted and readable. Filesystem claims below are
reads of the *actual tree the watcher globs*, not `origin/main` — they are not the substitution the
bootstrap forbids, and each is tagged with its instrument. **No `git` command was run against the
Windows `.git`.**

## WHAT I MEASURED

- `[MEASURED — mount]` `ls docs/pr-prompts/*-ready.md` → **ARMED = 0** at depth 1.
  Positive control per DOCTRINE §7: the same glob shape for `*-HOLD.md` returned **82**, so the zero
  is a real zero.
- `[MEASURED — mount]` `docs/pr-prompts/processed/` newest entries:
  `pr-lint-armed-gate-inversion-ready.md.log` (10:25Z) and `rev-1377-ready.md.log` (10:32Z).
  **The prompt armed by 00 at ~10:18Z ran to completion and was consumed.** Exit 0 on both.
  ⇒ The `0→1→0` transition since 10:20Z is a normal consumption, not a loop.
- `[MEASURED — mount]` `pr-lint-armed-gate-inversion-ready.md.log` tail:
  `[watcher] merge result for PR #1377: {"ok":false,"marco":true,"reason":"escalates:true — held for
  Marco, labelled do-not-merge"}`
  **Ownership is proven by construction, not inferred:** the same log file also carries
  `Shipped. **PR #1377**`, so the lane that wrote the `marco:true` line is the lane that opened the
  PR. This is *not* the unowned-log defect recorded in `project_rule2_breach_count_root_cause.md`.
- `[MEASURED — API]` `list_pull_requests state=open` → **OPEN = 1: #1377**, label `do-not-merge`,
  head `feat/lint-armed-gate-still-checked` @ `e950ea8e`, updated 10:32:38Z.
- `[MEASURED — API]` `#1377 get_check_runs` → 13 runs. **No check named CP-26 exists** (consistent
  with the 10:09Z ruleset measurement). Twelve green; **one FAILURE:
  `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)`**, completed 10:26:04Z.
- `[MEASURED — API]` **CONTROL:** the same job on merged **#1376** concluded **success**.
  ⇒ The red is specific to #1377, not a chronically-red gate.
- `[CANNOT MEASURE]` *Which* CP the diff-check job failed on. Job logs need `gh`; I am blind.
- `[MEASURED — mount]` COLLECT: the newest station breadcrumbs are `00-04-…-1010-repo-hygiene…` and
  my own `00-00-…-1009-…`. **Nothing postdates 10:10Z ⇒ COLLECT is empty this run.**

## WHAT CHANGED

**Nothing.** No arm, no disarm, no merge, no label, no commit, no push. One new untracked file: this
breadcrumb. I could not commit it — see FINDING 3.

## FINDINGS

### F1 — The review lane issued VERDICT: MERGE on a PR with a genuinely red gate, and blamed the red on a check that does not exist

`rev-1377-ready.md.log` says: *"CI green except expected CP-26 do-not-merge label."* Both halves are
false. **(a)** There is no CP-26 check run on #1377, and the 10:09Z measurement already established
that no CP-26 workflow exists anywhere in `.github/workflows/`. **(b)** CI was not green:
`PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)` **failed**, and the #1376 control proves
that job passes normally.

The reviewer took a real gate failure, mapped it onto a phantom benign check, and cleared the PR.
Note what would have stopped a merge here: `PR gates — diff checks` is **not** one of the four
required checks, and `do-not-merge` has **no machine enforcement**. So an advisory red gate plus a
phantom-attributed MERGE verdict plus an unenforced label means **RULE 2 was the only thing standing
between #1377 and a merge on a red gate.** This is the second independent failure mode found in the
review lane today (the first was the mention-vs-routing false positive, fixed in #1374).

**DISPOSITION: ESCALATED.** Marco — the reviewer needs a check-name allowlist so it can only excuse a
red check it can *name from the API response*, not from its expectations. Options:

1. **Complete + additive (RULE 1 — recommended).** Teach the review lane to fetch
   `get_check_runs` and enumerate every non-success conclusion **by name** into the verdict, and to
   emit `BLOCK` if any named red check is not on an explicit, versioned excuse-list. Passes both
   halves of RULE 1: it fixes this instance *and* every future phantom-check excuse, and it touches
   no data-entry path.
2. **Narrow.** Hard-code "there is no CP-26" into the reviewer prompt. Fails the *future* half —
   the next invented check name walks straight through.
3. **Do nothing.** Fails the immediate half; #1377's red gate is still unexplained.

### F2 — #1377 is watcher-routed to Marco. RULE 2 binds. I did not merge it and no station may.

`{"marco":true, "reason":"escalates:true"}`, ownership proven above. A MERGE verdict does not clear
RULE 2; only Marco does, in chat, for that batch only. Independently, F1 means the PR should not
merge on its merits either until the diff-check failure is explained.

**DISPOSITION: ESCALATED.** Marco: #1377 needs your gate. Do not read the reviewer's "CI green" —
it is wrong. `PR gates — diff checks` is red.

### F3 — I could not commit this breadcrumb, and 04's staged prompt is still uncommitted

04's 1010 run left `pr-lint-frontmatter-block-scalar-collapse-HOLD.md` staged-but-uncommitted for 00
to sweep (it un-rubber-stamps the LL-29 `rollback_strategy` gate, so it should land before any
migration prompt). A blind 00 cannot commit it, and this breadcrumb now joins it as untracked.

**DISPOSITION: DEFERRED.** The next sighted 00 must commit both **with a pathspec** (the dev-tree
index is shared) and must not `git reset`. Becomes urgent if a migration prompt is armed first — the
LL-29 gate is currently passing without reading its input on 13 prompts.

### F4 — Station 00 is blind on a material fraction of scheduled runs

Third recorded DC-blind 00 run. A blind 00 cannot arm, cannot merge, and cannot collect via
`check-breadcrumb --freshness` — the pipeline's only closing channel stops for two hours, silently,
and looks identical to a healthy quiet board.

**DISPOSITION: ESCALATED** (re-raised, previously ESCALATED and still open). Marco: the cheap
mitigation is a liveness line — have the scheduled task write a one-line `blind`/`sighted` marker to
a tracked path on every run, so the gap is visible in the tree rather than only in a chat nobody
reads.

## WHAT I DID NOT DO

- **Did not arm anything.** Impossible without `git mv`, and the next-arm order is unchanged:
  `pr-lint-not-a-prompt-HOLD` is item 2 now that item 1 has shipped as #1377.
- **Did not merge, label, or comment on #1377.** RULE 2 plus a red gate.
- **Did not run any `git` command** against the Windows `.git` through the bridge — hard stop.
- **Did not dispatch 03 (diverged watcher clone) or 05 (sot/03 repair) again.** Both were dispatched
  at 10:09Z and neither has produced a breadcrumb since; re-dispatching a two-hour-old handoff on a
  blind run adds noise, not throughput.
- **Did not fetch #1377's failing job log.** Needs `gh`; I would have been guessing.
