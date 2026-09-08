# Station 00 — Supervisor | 2026-09-08T02:09Z–2026-09-08T02:2xZ

## GROUND

```
UTC            2026-09-08T02:10Z   (VM clock, `date -u`; NOT a mount stat — see the timing note)
origin/main    0029fcdf            (GitHub MCP list_commits, main tip; = #1801)
dev tree       main @ 0029fcdf     C:\ProjectOperations2, read from .git/refs/heads/main via the mount
               origin/main tracking ref reads the SAME 0029fcdf — the tree is NOT stale
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not read-only on that account. It was read-only for a
different reason.

**BLIND.** Desktop Commander could not be reached. This is a measured failure, not an unloaded
schema: `ToolSearch` was run three times, with a name query and with two keyword queries
(`start_process powershell`, `interact_with_process read_process_output`), before any device tool was
called. The session then reported the server as **failed to connect**, verbatim:
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`. Per the PREFLIGHT
block that is blindness, and this run stops before acting.

**It did not stop before COLLECTING.** Per `STATION-CAPABILITIES.md` §3, the Cowork mount
`/sessions/<id>/mnt/ProjectOperations2/` IS the live dev tree, so the queue, the breadcrumbs, the
HOLD board and the three binding documents were all readable. So: **blind, read everything readable,
acted on none of it** — the second of §3's two reports, not the first.

**Which tree the binding documents were read in:** the dev tree, through the mount, at
`0029fcdf`, which the tracking ref confirms is `origin/main`. `STATION-CAPABILITIES.md` §3 was read
in full; `00-supervisor.md`'s PREFLIGHT was read in full; DOCTRINE was read in the sections this run
could act on. No `git` was run in any tree and no piped hash was compared, because no `git` may run
here at all.

⚠️ **Timing discipline, §3's mount-clock trap.** Marco's host is UTC+10 and the mount surfaces
host-local file times as UTC, so every `stat` age is ten hours wrong with no error. **Every timestamp
in this breadcrumb comes from file CONTENT, from the GitHub MCP, or from the scheduled-tasks MCP —
not once from a mount `stat`.**

## WHAT I MEASURED

**The board is EMPTY, and the empty is a real one.** [MEASURED] GitHub MCP
`list_pull_requests state=open` → `[]`. **POSITIVE control on the same query shape:**
`state=closed, sort=updated` returned six real PRs (`#1801`, `#1796`, `#1799`, `#1800`, `#1798`,
`#1775`) with their merge times, so the tool can produce a non-empty answer and the open list's `[]`
is an absence rather than a broken query. **Zero open PRs means there is nothing for RULE 2 to
classify this run** — no hand-classification was needed and none was performed.

**Nothing has merged since the previous run's own PR.** `list_commits sha=main` — tip
`0029fcdf`, `#1801`, merged **2026-09-08T01:34:52Z**, which is the 0108 run's board PR. Behind it
`7fd57e37` (`#1796`, 01:23:22Z) and `e453ee8d` (`#1799`, 01:04:00Z). **No commit on `main` is newer
than 01:34:52Z**, so in the 35 minutes before this run started the board did not move at all.

**COLLECT: exactly one breadcrumb in the queue root, and every finding in it already carries a
disposition.** `docs/pr-prompts/00-00-supervisor-2026-09-08-0108-…md`, the 0108 run, read in full
including its 01:5xZ addendum: F1 ACTIONED, F2 ACTIONED, F3 ACTIONED, F4 DEFERRED, F5 DEFERRED,
F6 DEFERRED, F7 ACTIONED (discharged by `#1796` merging), F8 ACTIONED. Nothing was left undisposed
for this run to dispose of. Its two carried-forward items are picked up below as F3 and F4.
No other station has written a breadcrumb into the queue root since.

**Station freshness, from `lastRunAt` rather than from a file age.** scheduled-tasks MCP:
`00` 2026-09-08T02:08:36Z (this run) · `04` **2026-09-08T02:10:15Z** · `03` 2026-09-07T23:01:27Z,
next 23:00Z · `05` 2026-09-07T14:11:15Z, next 14:10Z. Each of `03` and `05` is a daily station inside
its own interval, so **neither is silent and neither is in the started-and-died shape.** `04` is a
different matter — see F6.

**The `tests-docs` lane, measured across the WHOLE HOLD board for the first time.** 39 depth-1
`-HOLD.md` files, `scope:` front-matter parsed on all 39 (**0 unparsed**), each classified against the
three `NESTED_TEST_PATHS` forms and the `migrations/` clause as transcribed and verified at
`e453ee8d` by the 0108 run: **0 of 39 are `tests-docs` eligible.** Classifier controls run in the
same pass: four positive paths all true, three negative paths all false, `migrations/` positive true
and negative false. Depth-1 `*-ready.md` = **0**, so nothing is armed.

## WHAT CHANGED

**Nothing.** No merge, no label, no unlabel, no arm, no disarm, no branch, no PR, no `sot/` edit, no
file moved, no file deleted. One file was created: this breadcrumb.

🔴 **THIS BREADCRUMB IS UNTRACKED AND THIS RUN CANNOT PUBLISH IT.** §3 is explicit that a blind run
cannot open a PR "instead" — the GitHub MCP token is write-403 — so this file sits in
`C:\ProjectOperations2\docs\pr-prompts\` as an untracked working-tree file until a **sighted** run
sweeps it up. Two consequences the next sighted run owns:

1. **Commit this breadcrumb and archive the 0108 one.** The 0108 breadcrumb is tracked on `main`
   (it arrived in `#1801`) and is still sitting in the queue root; its archive move is a `git mv`,
   which a blind run may not perform.
2. **It is exposed to the watcher's preflight stash**, which is `--include-untracked`. If a build
   launches before this file is committed, it goes into the stash with everything else untracked.
   That is a known hazard already carried in the 03 dispatch, and it is named here so that a
   missing 0208 breadcrumb is read as *stashed*, not as *a run that wrote nothing*.

## FINDINGS

### F1 — ESCALATED (already on file, not re-raised) — the blindness recurred, with the same signature and a hard timeout.

`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` already carries
this defect and it is Marco's, so it is **not re-raised**. What this run adds is one clean
datapoint: the failure is a **30 000 ms CONNECT_TIMEOUT on the MCP server itself**, reported by the
session before any tool call, and it took `Prisma-Local` down in the same breath — the same paired
signature the 2026-09-06T01:08Z run recorded. The transport failed; the host was never asked.

**DISPOSITION: ESCALATED** — unchanged, on file, with a fresh measurement attached. It becomes
urgent if a blind run ever coincides with a board that needs a merge; this one did not, because the
board is empty.

### F2 — ACTIONED — the 0108 breadcrumb is collected, and it left nothing hanging.

Read in full, all eight findings disposed by their own run. The two live carry-forwards are F3 and
F4 below. **The archive move is owed to the next sighted run** and is recorded above rather than
performed, because it is a `git mv` in a tree where this run may not run `git`.

**DISPOSITION: ACTIONED** — collected and disposed; the mechanical archive step is handed on.

### F3 — DEFERRED — the `tests-docs` starvation is not a property of the gate-satisfied subset. It is a property of the whole board: 0 of 39.

Five previous runs measured the lane starved over the **gate-satisfied** candidates — 0 of 14 most
recently. That reading always carried an unstated escape: perhaps a gated HOLD would become eligible
once its gate released. **[MEASURED] this run, it would not.** Over **all 39** depth-1 HOLDs,
`scope:`-parsed with zero failures, **not one** is `tests-docs` eligible under the live regexes.

This is a stronger claim than its predecessors and it is stronger *because* the run was blind: it
needs no linter, no `triage-holds.ps1` and no gate evaluation, only the front matter and the three
regexes. Gate-satisfied HOLDs are a subset of all HOLDs, so **0 of 39 bounds 0 of 14 from above and
will keep bounding it whatever the gates do.** Releasing every gate on the board tomorrow would still
produce zero lane-eligible prompts.

**Controls.** Four positive paths (`docs/…`, `tests/…`, `…/__tests__/…`, `….test.ts`) all matched;
three negative paths (`apps/api/src/a.ts`, a `.ps1`, a `migration.sql`) all failed to match; the
`migrations/` clause returned true on a migration path and false on a source path. 0 of 39 files had
an unparsable `scope:`, so the denominator is the real board and not a silent subset — the failure
mode §9.6 warns about, checked and absent.

**DISPOSITION: DEFERRED.** The structural question — that the only lane which merges without Marco
can only ever be fed by prompts nobody writes — is already with Marco
(`needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md`) and is not re-raised. What
this finding changes is the *shape* of the answer: it is not a queue that will drain into the lane
eventually, it is a queue that has no intersection with it. It becomes urgent the moment a
docs-or-tests-only HOLD appears, and it should be armed that same run.

### F4 — DEFERRED — the next arm is identified, staged and correct, and a blind run may not perform it.

The 0108 run corrected `pr-triage-holds-open-pr-duplicate-bucket-HOLD.md` to §10.6's post-correction
rule, landed the correction on `main` in `#1801`, deliberately did **not** arm it, and named it *the
first arming candidate for the next run*. This run is that run. **[MEASURED]** the file is present at
depth-1 in the queue root at `0029fcdf`; the correction is on `main`, so the reason to wait has
expired.

**It was not armed, and the reason is capability, not judgement.** `arm-prompt.ps1` is a `.ps1`, and
§3 forbids a blind run from running any `.ps1` — there is no second transport. Arming by hand with a
`git mv` is doubly forbidden: it is the `git` prohibition, and the station doc names `arm-prompt.ps1`
as the primitive precisely so that a bare rename never happens.

**DISPOSITION: DEFERRED to the next sighted run**, with the arming decision already made and the
prerequisites already satisfied — RULE 4's detector still to be run on the file itself, reading the
`HUMAN_GATE_PRESENT` **code** from `lint-prompt.mjs` rather than a grep hit, which is exactly the
cure `#1801` landed as F1. Note it is a Marco-lane prompt (its sole `scope:` entry is
`scripts/pipeline/triage-holds.ps1`, which no `NESTED_TEST_PATHS` form matches), so arming it
produces a PR that stops at Marco — consistent with F3 and not an argument against arming it.

### F5 — ACTIONED (recorded, stood off) — an empty board is a state worth recording, not a quiet run.

Zero open PRs, with a passing positive control, and no `main` commit newer than 01:34:52Z. There was
no PR to merge, none to classify, none to label and none to stand off. This run's "nothing happened"
is therefore a **measured** nothing, not the indistinguishable no-news a blind run would otherwise
produce — which is the whole reason §3 requires a blind run to COLLECT before it stops.

**DISPOSITION: ACTIONED** — recorded.

### F6 — ESCALATED (already on file, not re-raised) — Station 04 fired at 02:10:15Z, inside this run's window, for the sixth-times-a-day collision that is already Marco's.

[MEASURED] scheduled-tasks MCP: `04-scanner` `lastRunAt` **2026-09-08T02:10:15Z**, roughly 100
seconds after this run's own `02:08:36Z`. Two stations were live on one board at once. The 0-of-4-hours
cron against 00's hourly cron produces this six times a day, which the 2026-09-07T18:08Z breadcrumb
measured and `needs-marco/station-schedule-collision-04-and-05-2026-09-03.md` carries.

**The operational consequence for this run, and it is the only one:** 04's breadcrumb will be written
**after** this collect window closes, so it is not in this report. That is the recurring
"collecting 04's breadcrumb that arrived after the collect window closed" pattern, and it is named
here so the next run collects two, not one. No board mutation was at risk — this run mutates nothing
— but a *sighted* run in this same slot would have had to stand off.

**DISPOSITION: ESCALATED** — unchanged, on file, one more instance recorded.

### F7 — DEFERRED — a run's own blind-or-sighted declaration cannot be counted mechanically, so the blindness RATE is unmeasurable from the breadcrumbs.

This run tried to quantify F1 by counting how many recent Station 00 runs declared themselves blind.
**Two instruments disagreed and the disagreement is the finding.** A loose search for the words
`SIGHTED|BLIND` anywhere in each breadcrumb returned 44 SIGHTED and 7 BLIND — but that search matches
prose *about* blindness, including sentences like "a healthy run, not a quiet blind one", so it
scores a run by what it discussed rather than by what it was. The stricter search, for the bolded
declaration form the station doc's examples use, returned **no declaration at all for roughly half
the runs**, because the form is not mandated and is not uniform.

**No rate is published here.** §7 says the instrument lies, and an unreliable count of a defect
already escalated to Marco would be worse than no count — it would put a number on his desk that
nothing supports. Recorded as unmeasurable, deliberately.

**DISPOSITION: DEFERRED**, with a named and cheap remedy for a sighted run to land: require a
machine-readable declaration line in the breadcrumb contract — one token, checked by
`check-breadcrumb.mjs` alongside the structure check it already runs — after which the rate becomes a
one-line query and F1's escalation gains the evidence it currently lacks. It becomes urgent if Marco
asks how often this happens, because today that question has no defensible answer.

## WHAT I DID NOT DO

- **Did not run `git`** in any tree, through any transport. §9.2's 0-byte `index.lock` freezes every
  station and there is no `git` a blind run is permitted.
- **Did not run any `.ps1`** — no `status-sweep.ps1`, no `bring-up-to-speed.ps1`, no
  `restart-watcher-if-wedged.ps1`, no `smoke-pr.ps1`, no `triage-holds.ps1`, no `arm-prompt.ps1`.
- **Therefore claimed NO liveness, smoke, safe-to-act or merge verdict**, and none appears above.
  In particular **this run makes no claim about the watcher** — not that it is alive, not that it is
  wedged. It was not probed, because the only sanctioned probe is a `.ps1`.
- **Did not arm anything**, though the candidate is identified and ready (F4).
- **Did not merge, label, unlabel, close or update any PR** — there were none open, and the token is
  write-403 in any case.
- **Did not take a single timestamp from a mount `stat`** (§3's UTC+10 trap).
- **Did not present GitHub-side reads as coverage of the box.** The MCP reads above are read-only
  facts about the *board*; nothing about the Windows host, the watcher, the clone or `C:\po-vg` was
  measured this run, and the previous run's readings on those are **not** restated here as if fresh.
- **Did not move or archive the 0108 breadcrumb**, did not edit `/sot/`, and did not touch Azure,
  Entra or SharePoint.
