# Station 05 — SoT Keeper | 2026-10-12 (host date) ~1410Z–~1450Z | see GROUND on the clock

**BLIND: `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`**

No shell was obtained on the Windows host, **and the Linux sandbox mount was unreachable as well** —
`mcp__workspace__bash` never confirmed a command had started, twice. So both transports
`STATION-CAPABILITIES.md` §3 names were down. The run continued on the **third** transport that file
records (`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`): the Cowork native `Read` / `Glob` / `Grep` tools,
which reach `C:\ProjectOperations2` directly. Every PowerShell probe and every `node` probe in this
station's audit is therefore `[CANNOT MEASURE]`, and **no PR was opened** — the GitHub MCP token is
write-403 (DOCTRINE §9.4) and `gh` lives only behind Desktop Commander. **Zero mutations were made
to the board, to `sot/`, or to git.** This run is READ-ONLY by capability, not by choice.

## GROUND

```
UTC            no independent clock was reachable (no host shell, no sandbox). Host/client date 2026-10-12.
origin/main    bf245896   (GitHub refs/heads/main, read via the GitHub MCP — NOT via `git fetch`; no shell)
dev tree       main @ bf245896   C:\ProjectOperations2   (read from .git/HEAD + .git/refs/heads/main as FILES; no git invoked)
doc version    1   (docs/pipeline/stations/05-sot-keeper.md front matter, read from origin/main)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

doc version and bootstrap **agree** (1 = 1). Full authority this run; nothing was forced read-only by
a version mismatch — only by capability.

🟢 **The dev tree is AT `origin/main`, proved without git.** `.git/refs/heads/main` read as a file is
`bf245896c5987ed2d707f9db53250ddc5b5269da`; the GitHub MCP's own resource URI for every file it served
this run is `repo://GH-Mantova/ProjectOperations/sha/bf245896c5987ed2d707f9db53250ddc5b5269da/...`.
Two independent transports, same commit. ⚠️ **This proves the REF, not the worktree**: without
`git status` I cannot exclude uncommitted edits, so every working-copy reading below is qualified
accordingly.

⚠️ **On the clock and the filename.** `05-sot-keeper`'s cron is `10 0 * * *` evaluated in Brisbane
local (UTC+10), so the true UTC instant of this occurrence is ~14:10Z on the preceding UTC day. The
filename follows the convention yesterday's run adopted and stated — **host date plus the UTC clock
minute** — purely for continuity, not because the convention is sound. It is not: it mixes two
clocks in one name. Station 00's `00-00-supervisor-2026-10-11-1314-…` breadcrumb claims to settle
this and I could not read a verdict out of its title alone. **Every elapsed-time figure below is
therefore computed clock-free wherever one was available, and tagged `[INFERRED]` where it was not.**

## WHAT I MEASURED

**Preflight step 1 — reach the box. FAILED, after the load.**
- `ToolSearch` keyword `desktop-commander` — run **three** times, ids never assumed
  (BOOTSTRAP_PREFLIGHT_V1). [MEASURED] first two: *"No matching deferred tools found. Some MCP
  servers are still connecting: … plugin:desktop-commander:desktop-commander"*. Third, after the
  mandated ≥60 s wait (BOOTSTRAP_CONNECT_RETRY_V1): `CONNECT_TIMEOUT … timed out after 30000ms`.
- **No schema was ever loadable**, so this is not the `InputValidationError` false alarm the
  bootstrap warns about. Blindness **after** the load attempt — the real thing.
- [MEASURED] also failed to connect in the same session: `plugin:pdf-viewer:pdf`,
  `plugin:prisma:Prisma-Local`, `plugin:data:definite`, `plugin:engineering:pagerduty`,
  `plugin:finance:bigquery`, `plugin:small-business:xero`, `plugin:small-business:zoom`,
  `plugin:legal:box`, `plugin:productivity:asana`, `plugin:customer-support:hubspot`, and the three
  `small-business` Google servers. [INFERRED] a session-wide / host-wide MCP connection failure, not
  a Station-05 fault — and see F1, where Station 00 has already root-caused it.

**git guard — `[CANNOT MEASURE]`, and the ban was kept anyway.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` could not be run: the sandbox
never confirmed a command had started (`request timed out after 30s … did not confirm the command
started`, attempts 1 and 2). **No installer last line and no exit code can be quoted, and this report
does not invent one.** The guard's purpose was honoured by abstention: **no `git` was executed against
the mount or against the Windows `.git` at any point in this run.** Not once. The two `.git` readings
in GROUND are **file reads**, not git invocations.

**The three binding documents — read from `origin/main`, in full, not from the working copy.**
Read through the GitHub MCP at `refs/heads/main`, which is the sanctioned network fallback (the
station doc's `?plain=1` rule exists because a *rendered* blob can be stale; the MCP returns raw
bytes, so it is the same guarantee or better).

| core file | blob SHA @ refs/heads/main | vs 2026-10-11's reading |
|---|---|---|
| `docs/pipeline/DOCTRINE.md` | `5b71fe52…` | unchanged |
| `docs/pipeline/STATION-CAPABILITIES.md` | `0aec6750…` | unchanged |
| `docs/pipeline/stations/05-sot-keeper.md` | `bae01ee2…` | unchanged |

[INFERRED] yesterday's run proved all three working copies content-identical to these same three
blobs; the blobs have not moved and the ref has not moved, so the working copies are still current.
No REFERENCE section was opened — no core line sent me to one, and I acted on no §9 trap.

⚠️ **This is NOT "substituting GitHub-side reads and presented as coverage."** The prohibition is
about presenting `origin/main` as a reading of *the tree the watcher globs*. Every claim below about
the tree is a native-file-tool read of `C:\ProjectOperations2`; GitHub was used only for the binding
documents and the board, which is what the station doc's own fallback prescribes.

**Primary housekeeping obligation — sot-refs burn-down: nothing to burn, confirmed at today's head.**
- [MEASURED] `docs/qa/sot-refs-baseline.json` → `"entries": []`, `entries.length` = **0**.
  Re-read today rather than carried forward on 10-09's or 10-11's word (§7.1 re-read rule).
- `node scripts/pipeline/check-sot-refs.mjs` → **`[CANNOT MEASURE]`** (no node). No
  `N baselined exemptions remain` line is quoted, and none is inferred.
- **Consequence: there was no burn-down work available this run, with or without a shell.** This is
  the second consecutive day the list has been empty.

**sot/04 drift — the cheap probe PASSES; the probe that actually answers is `[CANNOT MEASURE]`.**
- [MEASURED] `sot/04-data-model.md:14-16` → `Last updated: 2026-10-08 22:42 UTC`,
  `Generated from: apps/api/prisma/schema.prisma (sha256 6021e2814195)`,
  `Models: 299 | Enums: 70 | FK edges: 501 | Domains: 23`.
- [MEASURED] a git-free, node-free substitute for the header-count probe, run directly against the
  schema with `Grep -c`: `^model ` → **299**, `^enum ` → **70**. **Both match sot/04's header.**
  Controls per DOCTRINE §9.6 — POSITIVE: the two counts above are non-zero and specific. NEGATIVE: a
  needle minted this run, `^model ZzzSotKeeperNeedle20261012$` → **0 matches**. So the instrument can
  return zero and did not.
- `FK edges: 501` and `Domains: 23` are **not** checkable this way — both are generator-derived, not
  greppable. `[CANNOT MEASURE]`.
- 🔴 **So "sot/04 is in sync" is NOT claimed today, and the distinction is the station doc's own.**
  Its 2026-09-14 correction measured that the four header counts are **structurally blind to
  field-level drift** — a field added to an existing model moves none of them. The probe that
  answers is a *content* comparison of the generated section against a fresh generation, and that
  needs `node scripts/data-model/build-relationship-map.mjs`. **What is measured today is only:
  no MODEL-level and no ENUM-level drift.** See F4.
- ⚠️ Both readings are of the working copy. The ref is at `origin/main` (GROUND) but I cannot run
  `git status`, so an uncommitted edit at either path would be invisible to me.

**Roadmap drift — PRESENT, unchanged from yesterday, and now 19 days stale.**
- [MEASURED] open PRs via the GitHub MCP: **2**, and they are the same two as 2026-10-11 —
  `#2303` *fix(pipeline): refuse a HOLD whose own PR is already open* (`do-not-merge`, created
  `2026-10-10T02:52:30Z`, updated `2026-10-10T05:01:26Z`) and `#2294` *fix(pipeline): dedupe section
  5 PR crawl and add -SkipSection5 fast switch* (`do-not-merge`, created `2026-10-09T19:33:12Z`,
  updated `2026-10-10T01:25:37Z`). **Neither has been touched since 10-10.**
- [MEASURED] `sot/02-roadmap-and-status.md:61` → `## 2. 🔧 In-PR — open right now (0)`; `:67` →
  **"The board is empty."**, under a snapshot stamped `2026-09-23T14:33Z` @ `7207606e`.
- So the snapshot is wrong about **2 of 2** open PRs. Both carry `do-not-merge`; both were read only.
- S7 (one-and-done): neither open PR is a sot doc-reconcile, and no reconcile branch of this
  station's is open. **No reconcile was pending — and none was opened, for want of a shell.**

**Queue / arming census — partial, and the limitation is named rather than papered over.**
- [MEASURED] `Glob '*-ready.md'` under `docs/pr-prompts` matched **>100 files, every one shown under
  `processed/`** (i.e. consumed). The glob is **recursive and truncates at 100**, so it cannot by
  itself prove depth 1 is empty. [INFERRED, weak] results are mtime-ordered and no depth-1 path
  appeared in the newest 100, which is consistent with yesterday's measured `0 armed` — but it is
  not a census and is not reported as one. **Station 05 may never arm, and this run armed nothing.**

**`ci.yml` still tells every reader the baseline holds 23. Third consecutive day.**
- [MEASURED] `.github/workflows/ci.yml:307-309`, verbatim: `# Blocking since PR sot-refs-s1: the 23`
  `# pre-existing dangling references are` / `# recorded in docs/qa/sot-refs-baseline.json.` —
  against `entries.length` = **0** [MEASURED today]. See F3.

**Automation health, Rule Zero, and audit steps 5–7 — `[CANNOT MEASURE]`, in full.**
- Watcher liveness by PID and command line, `Get-CimInstance`, `Get-ScheduledTask` state and
  `LastTaskResult`, `scripts/pipeline/status-sweep.ps1`, `bring-up-to-speed.ps1`,
  `docs/pr-prompts/processed/` mtimes: all Windows-host probes. **I have no reading on whether the
  watcher is alive.** Per DOCTRINE §3, *"I cannot verify it" is not "it is down"*. This is a hole in
  today's coverage, not a report of a dead watcher.
- `scripts/pipeline/check-breadcrumb.mjs` was **deliberately not run in either form.**
  STATION-CAPABILITIES §3 measures that it shells `git ls-tree` / `git ls-files` and `gh pr list`, so
  a blind run calling it breaks the §9.2 device-bridge git ban it has just promised to keep.
  **Therefore no `--freshness` verdict is claimed and `breadcrumb-clean` is NOT written anywhere in
  this report.** This breadcrumb is **unvalidated**; its structure follows the contract by hand.
- **Rule Zero:** no ENVIRONMENT DISAGREEMENT could be established in either direction. The local
  passes above are real but no corresponding CI check-run conclusion was read on `main` or on either
  open PR, so **no claim of health is made from the local readings alone.** That is the 2026-07-13
  failure mode and it is named here rather than quietly skipped.
- Audit steps 6 (model ↔ migration ↔ code coherence) and 7 (sot/01 module registry): not attempted.
  6 needs node; 7's target was reported structurally absent on 2026-09-17 and nothing has changed it.

**Catch-up check — no day is owed.**
- [MEASURED] `Glob '00-05-*.md'` under `docs/pr-prompts`: the newest 05 breadcrumb is
  `00-05-sot-keeper-2026-10-11-1425-blind-on-the-windows-host-yet-sot04-is-in-sync-and-a-git-free-freshness-proof-worked.md`,
  **at depth 1** (not archived). One cadence back by the filename convention both runs use.
- `check-breadcrumb.mjs --freshness --station 05` → `[CANNOT MEASURE]` (git/gh caller, see above);
  the station doc already records its `ok` verdict is useless at one missed cadence anyway
  (escalation #23).
- [INFERRED] **no missed occurrence, so one unit of work, not two.** And it would have made no
  difference either way: the burn-down list is empty and no reconcile was possible.

## WHAT CHANGED

**Nothing. No PR, no prompt, no label, no merge, no `sot/` edit, no git, no board touch, no
regeneration.** Unlike 2026-10-11, this run did not even regenerate the data-model artifacts — node
was unreachable, so the dev tree's `docs/data-model/` was not written to at all.

The single write this run made anywhere: **this breadcrumb**, to the dev tree at
`docs/pr-prompts/`. **It is untracked** until a board PR commits it — Station 00, please sweep it.
⚠️ And see F2: it joins a pile of about twenty that nothing has swept.

## FINDINGS

### F1 — Third blind 05 run in a row, and this time BOTH named transports were down — but this is the pipeline's already-root-caused host incident, not a new one, and must not be filed as novel.

[MEASURED] Desktop Commander `CONNECT_TIMEOUT` after three loads and the mandated retry, plus
~12 other MCP servers failing to connect in the same session, plus `mcp__workspace__bash` failing to
confirm a command had started twice — so the Plan9 mount was gone as well. Yesterday's run still had
the sandbox for its first ~12 calls; today it was never available, which is a **further** degradation.

🔴 **The cause is already measured and named, by Station 00, from its own breadcrumb titles**
[MEASURED] by `Glob` on `docs/pr-prompts`: `00-00-supervisor-2026-10-11-0815-…the-host-is-thread-exhausted-at-2037-shells-which-is-what-killed-the-watcher-and-blinds-every-station`,
`…-0943-…993-of-1017-shells-share-one-command-line`, and
`…-1023-root-caused-the-shell-storm-to-an-unreaped-watchdog-start-job…`. Today's blindness is
consistent with that in every particular, including the mount loss, which
`00-00-supervisor-2026-10-10-1114-…the-vm-mount-is-gone-too-but-native-file-tools-still-reach-the-tree`
had already measured from the other side. **So the honest contribution of this run is a data point
on a known open incident, not a fourth independent escalation of the same thing** — and re-escalating
it would re-surface work Marco has already been handed, which DOCTRINE §9.5 records as a measured cost.

The cost to this station is specific and not cosmetic: with no `gh`, and with the GitHub MCP unable
to open a PR, **a doc-reconcile PR is structurally impossible on a blind run** — 05's single mutation
capability is entirely downstream of a shell. Nothing needed reconciling today, so **the blindness
cost nothing again**, which is exactly why it is filed loudly: a blind run and a healthy quiet run
produce the same "no news", and three in a row is three days of unbacked quiet.

**DISPATCHED** — to **Station 00**, as one more occurrence of its own open shell-storm incident
(10-11 0815 / 0943 / 1023), with the new datum that the Plan9 mount is now failing too and the
native file tools are the only surviving transport. Nothing here needs Marco that 00 has not already
put to him.

### F2 — About TWENTY breadcrumbs sit UNARCHIVED at depth 1 in the dev tree, so no successful COLLECT has run across any of them — and that pile also blocks the next fast-forward.

[MEASURED] `Glob '00-00-*2026-10-1*.md'` under `docs/pr-prompts` returned **19 Station-00 breadcrumbs
at depth 1** (12 dated 2026-10-10: 0000, 0614, 0716, 0815, 0915, 1114, 1514, 1617, 1705, 1814, 2015,
2114; 7 dated 2026-10-11: 0000, 0114, 0618, 0815, 0943, 1023, 1314) against only 5 of the same window
in `archive/`. [MEASURED] yesterday's 05 breadcrumb is likewise at depth 1. **Station 00 archives on
every collect, so twenty unarchived breadcrumbs is a clock-free proof that no collect has completed
across any of them**, which is the measurement I trust — [INFERRED] the elapsed figure is on the
order of a day, but the host/UTC naming ambiguity in GROUND means I will not put a number on it.

🔴 **Two distinct costs, and the second one is mechanical.** First, §7 of
STATION-CAPABILITIES names COLLECT as *"the only channel that closes"* — twenty uncollected
breadcrumbs is twenty findings with no disposition, mine included. Second, the station contract's own
red warning: **a breadcrumb left in the dev tree BLOCKS the next `git merge --ff-only`** once that
exact path lands on `main`, while `git diff --numstat` and `--cached` both read EMPTY — the documented
PASS reading. Twenty such paths is twenty future fast-forward refusals, and the cure is a per-path
raw-Buffer restore, not a `checkout`.

**ESCALATED** — to Marco. The question, not a status update: *the collect channel has been down long
enough to accumulate ~20 undispositioned breadcrumbs, and the same pile will refuse the next
fast-forward — do you want 00 unblocked first, or the pile drained first?* RULE 1, complete-and-
additive FIRST: **clear the host shell storm (F1) so 00 runs again, and have its first run archive
the whole backlog in one board PR** — solves it now (00 resumes, pile drains, fast-forward unblocked)
and in future (the mechanism that drains it is the ordinary one), and it writes no data and discards
no finding. Alternative A — drain the pile by hand without fixing the host: fails the *future* half;
00 stays down and the pile re-forms within a day. Alternative B — leave it; the next sighted 00 run
catches up: fails the *complete* half, because nothing currently predicts when that run happens, and
every hour adds a breadcrumb and a future ff-only refusal.

### F3 — `ci.yml:307` still tells every reader the sot-refs baseline holds 23 entries. It holds zero. Filed 10-09, re-filed 10-11, still unfixed — third consecutive day, same one-line fix.

[MEASURED] `.github/workflows/ci.yml:307-309` verbatim (quoted above) against `entries.length` = **0**
[MEASURED today at `bf245896`]. Re-verified at today's head per §7.1 rather than carried forward.
This is the **fifth** place this count has rotted — the station doc said 26 when the truth was 14,
`CLAUDE.md`'s `SOT reference baseline:` anchor said the same, and the baseline's own `_readme`
carries a standing prohibition against writing a count in prose. It rots in the **dangerous**
direction: it tells a future 05 run there is debt to burn when there is none, giving it a documented
reason to distrust a true negative — DOCTRINE §7 inverted.

🔴 **05 cannot carry this even with a shell.** `.github/workflows/` is neither `sot/` nor `docs/`, and
CP-24 (`const sotRe = /^sot\//` in `scripts/pr-gates/pr-gates.mjs`) hard-blocks a `sot/`-touching PR
that reaches outside `docs/`. It is out of lane by construction, not by caution.

**DISPATCHED** — to **Station 00**, unchanged from 2026-10-09 F1 and 2026-10-11 F3: a comment-only
edit to `.github/workflows/ci.yml:307` deleting the literal `23` and deferring to `entries.length`.
No gate moves, no code path changes. ⚠️ **That it has survived three dispatches is itself evidence
for F2** — this is what an unclosed collect channel looks like from the dispatching end.

### F4 — On the native-file-tools transport this station loses its only real sot/04 drift probe, and the probe it keeps is one the station doc has already measured as structurally blind.

[MEASURED] `^model ` = 299 and `^enum ` = 70 against sot/04's header `Models: 299 | Enums: 70` — a
pass, with both controls (§9.6). [MEASURED, from the station doc at `origin/main`] its 2026-09-14
correction: the four header counts move only when a MODEL, ENUM, FK EDGE or DOMAIN is added or
removed, and at `ed3e5e42` they agreed exactly while the generated bodies differed by
`AssetMaintenancePlan Fields: 14` vs `19` and `BrandColorScheme Fields: 7` vs `20`. The answering
probe is a content comparison against a fresh generation, which needs node. **So today's reading
licenses exactly one sentence — "no model-level or enum-level drift" — and NOT "sot/04 is in sync",**
and the gap is invisible: every instrument answered a question about counts, correctly, and none was
asked about content (§9.6 does not fire, because nothing was empty).

Worth recording as a capability fact rather than a one-off: `NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`
rescues COLLECT, but it is a *reading* transport, and this station's primary obligation after the
burn-down is a *generated-content comparison*. **A 05 run on that transport is structurally unable to
answer its own main question**, however healthy the tree is.

**DEFERRED** — real, not actionable from inside this run, and the fix is a `scripts/` or contract
change outside 05's lane. What would make it urgent: a schema change that adds or removes **fields
only** while the host is blind, which would leave sot/04 field-stale with this station reporting a
clean count probe on three consecutive days. ⚠️ Cheap mitigation worth 00's consideration: sot/04's
header already records `Generated from: schema.prisma (sha256 6021e2814195)` — a probe comparing that
recorded hash against the live file's hash **would** catch field-level drift, and needs one hash, not
a regeneration. I could not run it (no node, no shell) and so cannot claim it works.

### F5 — Yesterday's recorded open question — "I did not stop at the blindness paragraph; overrule me if that was out of order" — is ANSWERED by STATION-CAPABILITIES §3, and the answer is that the deviation was correct.

The 2026-10-11 breadcrumb's WHAT I DID NOT DO section asked to be overruled: *"if the stop is meant
to be unconditional on Desktop Commander regardless of what else is reachable, say so in the contract
and this run was out of order."* [MEASURED] `docs/pipeline/STATION-CAPABILITIES.md` §3 at
`origin/main` (blob `0aec6750…`) already settles it, in two places:

- `NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`: with Desktop Commander at `CONNECT_TIMEOUT` *and* the Plan9
  share unmounted, the native file tools read the tree and *"are read-WRITE: the same run wrote its
  own breadcrumb to `docs/pr-prompts/` through `Write`, which is how a blind run leaves a report at a
  tracked path even though it cannot open the PR that tracks it."*
- and the governing instruction: *"A blind run therefore reports blindness as loudly as ever, and
  stops before acting — but it COLLECTS first, and says which of the two it did."*

So **"stop" means stop ACTING, not stop READING**, and the prohibition on GitHub-side reads is
specifically about presenting `origin/main` as coverage of the tree. Both runs kept the half the stop
protects: zero mutations.

**ACTIONED** — answered this run by reading the governing clause from `origin/main` and recording it
here, so the next blind 05 run does not re-litigate it. **No document change is needed**: the clause
already says this. ⚠️ What would change that verdict: if Marco intends the stop to be unconditional,
§3 and the station contract disagree with each other today and the contract is the layer to fix.

### F6 — `sot/02`'s In-PR snapshot is wrong about 2 of 2 open PRs, now 19 days old. I again declined to refresh it, on the same merits as 2026-10-11.

[MEASURED] `sot/02:61` `open right now (0)`, `:67` *"The board is empty"*, stamped `2026-09-23T14:33Z`;
the live board is `#2303` and `#2294` [MEASURED today]. [MEASURED, from the file itself] this table
has already been refreshed by this station on 09-06, 09-17, 09-21T00:20Z and 09-21T14:25Z, and its
own §2 note records that the 09-21T00:20Z refresh was wrong **14 hours** later. **A refresh is the
additive half of RULE 1 and fails the future half**, so a fifth one was declined in principle, not
for want of a shell. The complete fix — a generated table, or a CI check that fails when a PR named
there is no longer open — is a `scripts/` change, outside 05's lane and outside what CP-24 lets a
`sot/`-touching PR carry.

**DEFERRED** — carried forward unchanged from 2026-10-11 F2 rather than re-argued. What would make it
urgent: a reader acting on `open right now (0)` to conclude the board is clear. Mitigation that
already exists and should be preferred by every reader: `bring-up-to-speed.ps1`'s `[LIVE]` lines beat
this table, and sot/02 says so in its own §2.

## WHAT I DID NOT DO

- **I did not stop at the blindness paragraph.** Per F5 this is now settled rather than a deviation:
  STATION-CAPABILITIES §3 instructs a blind run to COLLECT and say which of the two it did. **I
  collected, and I acted on nothing.**
- **I did not open a doc-reconcile PR.** Structurally impossible on a blind run (F1), and nothing
  needed one: the burn-down list is empty and no model- or enum-level drift exists.
- **I did not edit `sot/`.** Nothing in it drifted that was mine to fix; F6's refresh was declined on
  the merits, not for want of authority.
- **I did not regenerate the data-model artifacts.** No node. So, unlike 2026-10-11, nothing under
  `docs/data-model/` was written and no CRLF/LF question arises this run.
- **I did not run `git`** — not against the mount, not against the Windows `.git`, not through any
  shim. The `.git/HEAD` and `.git/refs/heads/main` readings in GROUND are **file reads**.
- **I did not run `check-breadcrumb.mjs`** in either form — it is a `git` and `gh` caller
  (STATION-CAPABILITIES §3), so calling it would break the device-bridge git ban. **`breadcrumb-clean`
  is claimed nowhere in this report** and no `--freshness` verdict is quoted.
- **I did not claim any liveness, smoke, safe-to-act or merge verdict.** All four need the host.
- **I did not arm, merge, label, or remove a label.** Both open PRs carry `do-not-merge`; they were
  read only. **I did not clear any lock** — none was measured, because `status-sweep.ps1` is a host probe.
- **I did not compute any age from a mount `stat`** (host-local times surfaced as UTC —
  STATION-CAPABILITIES §3); the mount was unreachable regardless, and GROUND says so.
- **I did not touch Azure, Entra, or SharePoint**, nor read or write any production data.
- **I did not write to any of the five gitignored sinks** under `.gitignore`'s
  `# Overnight-QA scheduled task` comment, and **I did not write a report into the Cowork session's
  `outputs` folder** — the 2026-09-22 blind run's measured failure mode. This file is in the dev tree.
- **I did not re-escalate the blindness as a new incident** (F1), and **I did not re-surface F3 or F6
  to Marco** — both are dispatched or deferred where they already sit.
