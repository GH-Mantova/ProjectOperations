# Station 00 — Supervisor | 2026-09-21T01:10Z–2026-09-21T02:0xZ

## GROUND

```
UTC            2026-09-21T01:10:06Z
origin/main    c5744acf              (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 64abcdcd → c5744acf   C:\ProjectOperations2  (4 behind at open; fast-forwarded this run)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **agree**, so this run acted rather than going read-only.

**Preflight, all four steps.** (1) Not blind — Desktop Commander `start_process` shell
`powershell.exe` returned PID 11148 and it carried the whole run. (2) The device-bridge git guard
installed, last line quoted verbatim: *"persistence controls passed: .bashrc byte-identical on
re-run; login shell resolves shim"*. (3) Ground stamped above. (4) Sweep run and its section 7
obtained — see below for why that is worth saying.

**Freshness read from the working copy, not from `git show origin/main:`.** The three binding
documents were confirmed identical to `origin/main` first:
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, which PREFLIGHT step 2 names as the real
answer. No piped hash was compared against anything.

## WHAT I MEASURED

**The sweep completed, and its section 7 verdict was obtained.** `status-sweep.ps1`, captured with
`*>` and decoded `utf16le` from node (§9.3 — the raw capture opens `FF FE` at 150,078 bytes):
`SWEEP COMPLETE 2026-09-21 01:10:07Z`, section 0 both positive controls `[LIVE]`, **no `[BROKEN]`**,
section 7 **`SAFE TO ACT`**. [MEASURED]. ⚠️ The MCP layer's hard 180 s tool-call cap cut the *call*,
not the shell — the previous run's A-2 recorded this as recurring. Guard (2) of §9.1 decided it in
one call: `read_process_output` on PID 11148 returned `MARKER_A`, then `MARKER_B`, then `MARKER_C`
across three polls. **The shell was alive the whole time; only the reader returned early.** No second
shell was started.

**The board is one PR and it is parked by design.** [MEASURED]
`gh pr list --state open` → **1**: `#2017`, `mergeStateStatus BLOCKED`, `labels: [do-not-merge]`.
Its two reds are the CP-26 pair §9.4 describes — one cause, two checks. Read from **column 3** of the
job log (§9.1's tab-column trap), run `35549466790` job `106181399244`, quoted verbatim:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

POSITIVE control, `approval` over the same column-3 projection → **7** of 224 lines. `[LABEL_PRESENT]`
is **parked, not work**. There is no agent-side action behind it.

**Nothing is armable, and I proved it rather than inheriting it.** [MEASURED] `armed (*-ready.md)` =
**0**; `*-HOLD.md` = **27**; each linted individually with `lint-prompt.mjs`, reading the CODE and not
the exit code (§9.5 — a HOLD also exits 1 for `GATE_NOT_RELEASED`):

| verdict | count |
|---|---|
| `ADMIT` | **2** |
| `HUMAN_GATE_PRESENT` | 11 |
| `GATE_NOT_RELEASED` / `FILE_GATE_NOT_RELEASED` | 12 |
| `UI_PROMPT_NEEDS_DESIGN_REF` | 2 |

Both ADMITs are structurally un-armable, for different reasons. `pr-crmvis-s6-bulk-link` is
**#2017's own prompt** — arming it builds a duplicate of an open PR. `pr-queue-layout-sot-entry`
carries `station: '05'` and `scope: sot/02-roadmap-and-status.md`; `sot/` is an absolute stop for
every station but 05.

**And the second one is gated by nothing but an agent reading the body.** [MEASURED] at `c5744acf`:
`sot/` occurs **0** times in `scripts/pipeline/lint-prompt.mjs` and **0** times in
`scripts/pr-watcher/index.mjs`; all **7** occurrences of `station` in the linter are comments or
breadcrumb handling, none reads the `station:` front-matter field. POSITIVE controls `scope` → 78 in
the linter and `classifyPolicyFiles` → 2 in `index.mjs`; NEGATIVE control, a freshly minted needle →
**0** in both. CP-24 blocks a PR *mixing* `sot/` with code; a `sot/`-only PR from Station 01 passes
CI green. **The authority matrix's "Edit `/sot/` — only 05" is enforced at the arming boundary by
judgement alone.** This is reported, not filed: it is the mechanism behind an escalation that already
exists, and a second escalation would split it.

**One label stands between the board and a three-slice chain.** [MEASURED] `#2017` touches
`apps/web/src/pages/crm/AccountLinkPreview.tsx`; that file on `#2017`'s head carries
`CRM_PARITY_BULKLINK_V1` **1** time (POSITIVE control `import` → 6; NEGATIVE control, fresh needle →
0). That is **exactly** the needle `pr-crmvis-s7-comms-inbox-HOLD.md`'s `requires_on_main` gate is
waiting on, and s7's own output `CommsInboxTriage.tsx :: CRM_PARITY_INBOX_V1` is what
`pr-crmvis-s8-comms-threads-HOLD.md` waits on. **#2017 → s7 → s8, released by removing one label.**

**Machinery, all `[LIVE]` from the sweep.** watcher node RUNNING pid 9744 · auto-restart wrapper
alive (1) · heartbeat 11 min (ticks mid-run only; stale + empty queue = idle, not wedged) ·
`git index.lock` dev/clone **False/False** · scoped git processes **0** · no PR touched in the last
2 min. `restart-watcher-if-wedged.ps1` was **not** run and no liveness verdict is claimed beyond the
sweep's own `[LIVE]` lines.

**Freshness crossed against `lastRunAt`, which the breadcrumb instrument cannot do alone.**
`check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0, all four enabled stations `ok`. Scheduled-tasks
MCP, same minute: `00` `lastRunAt 01:08:28Z` · `03` `00:20:35Z` · `04` `00:04:02Z` · `05` `00:04:02Z`
— **four enabled tasks**, `weekly-security-audit` `enabled: false`, which is
`STATION-CAPABILITIES.md` §1's 2026-09-15 correction still holding. Every station's `lastRunAt`
aligns with its newest breadcrumb. **No station is SILENT and none is silently dead.**

## WHAT CHANGED

1. **The dev tree was fast-forwarded `64abcdcd` → `c5744acf`**, which the previous run explicitly
   left for this one. Both documented causes fired, in the documented order.
   - Cause 1, untracked breadcrumbs at paths the FF must create: 03's and 04's. Each proved
     byte-identical to its `origin/main` blob with **unpiped** hashes (`git hash-object <path>` vs
     `git rev-parse origin/main:<path>` — never the piped form, PREFLIGHT step 2) before deletion.
   - ⚠️ **One of the three was TRACKED in HEAD and deleting it was my error**, caught by the
     read-back rather than by foresight: `git diff --numstat` then showed `0 313` for
     `00-00-supervisor-…-0004-….md`. Restored from `git show HEAD:<path>` piped to a node write —
     never `git checkout -- <path>` (§9.2).
   - Cause 2, `sweep-rotation.json`: `git diff --numstat` read **EMPTY** while the FF refused, which
     is the recorded LF/CRLF smudge. Cure applied as written — restore to HEAD from node,
     `git add --renormalize`, `git update-index --refresh`. `--cached` was **EMPTY** after, so the
     content genuinely matched and no `git restore --staged` was needed. ⚠️ `update-index --refresh`
     then reported the restored breadcrumb `needs update` — the *same* smudge on a second file, which
     the recorded cure does not mention. One more `--renormalize` cleared it.
   - **Read back all three ways**, because the first alone passes on a dirty tree:
     `git rev-list --left-right --count HEAD...origin/main` → **`0 0`** ·
     `git diff --numstat` → **EMPTY** · `git diff --cached --name-status` → **EMPTY**.
2. **DOCTRINE §9.5's citation-probe corpus spec corrected**, in this PR — see F-1.
3. **Two live escalations annotated in `needs-marco/`** — see F-2 and F-3. ⚠️ That folder is
   gitignored, so the annotations reach nobody through the repo; they are named here, which is the
   only channel that does.
4. **Six dispositioned breadcrumbs archived** to `docs/pr-prompts/archive/` in this PR.
5. **No merge. No arm. No board mutation of any kind.** The one open PR is Marco's.

## FINDINGS

### F-1 — Station 04's §9.5 correction, DEFERRED on two prior cycles, is landed

04's F2: §9.5's citation probe states its corpus as *"the same nine files (five scheduled-task
bootstraps + four binding docs)"* — a **count**, which is the exact formulation
`STATION-CAPABILITIES.md` §1 carries a red rule against — and its per-document prediction omits
`00-supervisor.md` entirely.

**Re-verified before acting on it (§7.1's re-read rule), row for row, at `c5744acf`:**
`C:\Users\Marco\Claude\Scheduled` holds **11** `SKILL.md`, **4** behind enabled tasks — so "five" is
wrong in *both* directions. `docs/pipeline/stations/` holds **7** docs, not four. `00-supervisor.md`
carries **2** `.gitignore` citations the prediction does not list, and both resolve correctly.

**Why it had to stop being deferred.** The bullet's own falsifying logic reads *"if a NEW raw line
citation ever appears in a station doc, this clause is being ignored rather than being wrong."* A run
that rebuilds the probe over the station docs finds those two unlisted citations and has that
sentence to hand — so it concludes the clause is being ignored and **re-opens closed work**. That is
the precise failure §9.5's own `ANCHOR_PROBE_PER_DOCUMENT_V1` correction exists to remove, one
document short of complete.

**Why it was deferred twice, and why that reason did not survive inspection.** §9.5 sits inside the
hash-gated `instruments v2` canonical block, and the deferral read as *a canonical-block change must
be shipped across all seven station docs in one PR*. **That is true of `station-contract`, which is
byte-identical in every station doc — and false of `instruments`, which lives only in `DOCTRINE.md`
because stations POINT at it rather than copying it.** [MEASURED] `lint-station.mjs` collects
`['instruments']` for DOCTRINE and `['station-contract']` for everything else. So the change is
**DOCTRINE.md plus one recorded hash**, both `docs/`, both inside Station 00's own lane — a
twenty-minute job that had been read as a seven-document ship.

**What landed, and how it was proved.** The correction is **appended** in the document's own house
style rather than rewritten over the 2026-09-15 measurement, which stands as taken. Edited from node
by **concatenation**, never a `String.replace` replacement string (§9.3 — `$` is live in one), and
the byte delta asserted: `204041 → 206579`, **delta 2538 = expected 2538**. `git diff --numstat` →
**`28 0`**, a pure insertion with no line-ending rewrite. `U+FFFD` → 0. The `â€` double-encoding
signature → **2 before my edit and 2 after**, i.e. pre-existing and untouched.

Gate proved in both directions before being trusted: `lint-station.mjs` **REJECT**ed with
*"canonical block `instruments` has been EDITED"* (positive control that the hash gate works), then
after `--write-canonical` re-recorded `instruments v2 4ec846e680a7bed0`, it returned
**`ADMIT: all 8 docs clean`, exit 0**. The new clause names its own falsifying probe and tags its
counts as STATE.

**DISPOSITION: ACTIONED.**

### F-2 — the 77-hour outage escalation sits in front of Marco with a premise Station 03 has measured false, and its recommended option would have missed 63 of the 76 hours

04's F1 was ESCALATED and is on the board in `#2018`. Its load-bearing premise is
*"`LastBootUpTime` … up throughout … So this was neither a power event nor a watcher death"*.
03's F1 refutes it from the Windows event log: a Start-menu **power off** (`User32` 1074) at
2026-09-18T05:52:41Z, **zero** System-log events across the next 63.0 h against a **positive control
of 141** in the 5 h 50 m before, and a `Kernel-Boot` **Id 27 boot type `0x1`** — a Fast Startup
hibernation resume — at 2026-09-20T21:07:05Z. With Fast Startup, `LastBootUpTime` is never updated
across shutdown/resume: it answers *"when did this kernel session first start"*, not *"has this
machine been running since"*. Exit 0, well-formed timestamp, nothing warns. **§7, not §9.6.**

There are **two** outages: window A, the app layer, 76.0 h, cause still `[CANNOT MEASURE]` from a
station; and window B, the **host off**, 63.3 h. They are not the same event — the keepalive logged
21 `RELAUNCHED` rows and the watcher wrote `[review]` lines for 9.8 h *after* A began.

**It changes the answer, not just the write-up.** The in-machine detector on file would have been off
for 63.3 of the 76 hours and would have produced exactly the artefact this incident already produced
— nothing. The complete-and-additive option is an **off-box dead-man's switch**: the keepalive, which
already runs every 10 minutes and already writes a log, pings an external monitor that alerts Marco
on a missed ping. It is the only option that can observe the machine being switched off.

**DISPOSITION: ACTIONED** — 03's measurement, the two-window table, the corrected RULE 1 option set
and the three-line falsifying probe are appended to
`needs-marco/all-stations-disabled-16h-and-the-only-detector-was-disabled-too-2026-09-03.md`
(4294 → 8342 bytes, delta 4048 = expected 4048). No second escalation was filed: the question is the
same one, with the right premise under it. 05's F1 — three missed occurrences and the whole task set
released within 0.7 s — is the same story from a third instrument and is folded in rather than
counted separately.

### F-3 — the dispatch-register escalation now has a fourth instance, and it is days rather than hours

`pr-queue-layout-sot-entry-HOLD.md` — ADMIT, gate satisfied, premise alive, **one document of work** —
was dispatched to Station 05 four times on 2026-09-17. [MEASURED] 05 has run **twice** since
(`lastRunAt` 2026-09-17T14:11:00Z and 2026-09-21T00:04:02Z) and the string `queue-layout` /
`QUEUE_LAYOUT` appears **0** times in **either** breadcrumb. POSITIVE control, `dispatch` in the same
two files → **4** and **2**. NEGATIVE control, a freshly minted needle → **0**. Elapsed: **~3.7 days**.

05's latest run was not idle — it filed five findings of its own. It never saw the hand-over, for the
reason the escalation already states: a dispatch lives only in the breadcrumb of the station that
wrote it. **Station 00 reads everyone; nobody reads Station 00.** Option (c) — *00 re-states each open
dispatch every hour* — is now refuted over two different timescales.

I did not implement option (a) or (b) unilaterally. (a) needs a `status-sweep.ps1` change, outside
00's merge lane; (b) is the option the escalation itself scores as failing the *complete* half, and
choosing between them is Marco's.

**DISPOSITION: ACTIONED** — appended to
`needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md` (8299 → 10664 bytes, delta
2365 = expected 2365), with its own falsifying probe.

### F-4 — 05's F3 dispatch stands, but its premise about Station 03 is already stale

05 reported 03 as *"has not run for four days … next slot another 23 hours away"*, from
`lastRunAt 2026-09-16T23:01:15Z`. **[MEASURED] this run: 03 ran at 2026-09-21T00:20:35Z and filed a
breadcrumb.** 05's reading was taken before 03 fired; `lastRunAt` holds only the most recent run, and
here the most recent run changed under it inside the hour.

The **substance** survives the stale premise, because 03's run spent itself on the outage and touched
neither item. Both are still open and both are 03's alone: `[LIVE]` orphaned worktree
`C:/PR-Master/worktrees/po-vg`, **holding 1 uncommitted file**, age ~16.7 days — *preserve or commit
before pruning; `git worktree remove` will refuse and `--force` would discard it* — and `[LIVE]`
registry escapee `C:\po-worktrees\po-fix-2005`. The first is the subject of
`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`.

**DISPOSITION: DISPATCHED** → **Station 03**, next occurrence `2026-09-21T23:00:45Z`. Handed over:
list `po-vg`'s uncommitted file with `git -C C:/PR-Master/worktrees/po-vg status --porcelain` and
preserve it before any prune; confirm `po-fix-2005` dead before removing it. ⚠️ **This hand-over is
subject to F-3** — it is a dispatch in a Station 00 breadcrumb, which is the channel measured not to
arrive. It is also named in the sweep's own `[LIVE]` section 2 every run, which is the one place 03
will see it without reading me.

### F-5 — the one alarm built to survive every station being off fired twelve times and had no awake reader

05's F4. `Pipeline heartbeat` runs on GitHub's clock precisely so the act that disables the stations
cannot reach it, and it **failed on 12 of its last 12 runs**, continuously from 2026-09-18T20:42:58Z
to 2026-09-20T23:05:57Z, stating its reason exactly: `SILENT: NO station has reported for 77.1h
(threshold 6h)`. No `docs/pipeline/pause.json` existed, so this was not a declared pause. **The alarm
worked perfectly.** `status-sweep.ps1` files it under *"NOT trunk CI on this commit, excluded from the
verdict above"*, beside the Dependabot noise stations are taught to disregard. Scoping it out of the
*trunk verdict* is right; presenting it beside noise is what costs a reader.

The fix — a dedicated `PIPELINE QUIET` line, or surfacing the heartbeat conclusion in section 7 — is
`scripts/pipeline/status-sweep.ps1`, outside Station 00's merge lane. The other half, *who reads the
alarm when every station is off*, is the same question as F-2 and has the same answer: something
off-box.

**DISPOSITION: DEFERRED**, with the trigger named: it becomes urgent at the **next** quiet window,
because the recurrence interval is 18 days and falling and the alarm will fire correctly again into
the same empty room. 🔧 The cheap first step is one line in the sweep, and it belongs in the same PR
as F-2's answer rather than racing it.

### F-6 — 05 refreshed the `sot/02` In-PR table for the third time, and the permanent half is still unstaged

05's F2, ACTIONED by 05 in `#2019`: the table read *"open right now (3)"* against a live board of
**1**, naming two merged PRs and one closed-unmerged, all within 4.5 h of its own snapshot timestamp.
Third consecutive hand-refresh by that station (2026-09-06, 09-17, 09-21). The refresh passes RULE 1's
*immediately* half and fails *future* — on the evidence it rots within days. The complete fix is to
stop hand-maintaining a snapshot of a live board: generate the table, or add a check that fails when a
PR it names is no longer open. That is `scripts/`, outside 05's lane and outside 00's merge lane.

**DISPOSITION: DEFERRED** — not written this run, and I am naming why rather than implying it was
weighed and dropped: this run's slot went to F-1, the fast-forward and the collect, and staging a
`scripts/` prompt whose PR cannot merge without Marco is lower value than the two escalations he is
already holding. 🔧 The next run with slot to spare should stage it as an ordinary `-HOLD.md`; it is
small and self-contained.

### F-7 — ten live modules are absent from the SoT module registry, and the question is Marco's

05's F5, ESCALATED to Marco **via** Station 00, which is this. `sot/01` §13's module registry does not
name ten capabilities that are live in code; CRM is the sharpest case, with `#1986`, `#1998` and
`#2017` all CRM slices merged or open in the last four days and the word absent from the registry.
`sot/01`'s own §17 says *"§13 module registry should always reflect what's on `main`"*, so this is
drift against the file's own standard. It is curated prose requiring judgement about what each module
*does*, which puts it outside deterministic reconcile — so 05 reported rather than wrote.

**The question, verbatim as 05 framed it and with RULE 1 applied:** ten capabilities are live in code
and absent from the SoT module registry — do you want **(a)** Station 05 to add one-line entries per
module derived strictly from each module's existing route and controller names, as a doc-reconcile PR
you review — *complete and additive, invents no business meaning, but puts machine-derived prose into
a curated section* — or **(b)** a development chat to write the business descriptions properly, which
is the only way the entries say what the modules are *for*? **(a) is offered first**: it fails neither
half outright, but it is thinner than (b), and (b) fails the *immediately* half because it waits on a
human writing ten descriptions.

**DISPOSITION: ESCALATED** — Marco. Carried here as a question with options, not a status update.

### F-8 — the whole board is waiting on one label, and it is worth saying what that label costs

Not a defect; the shape of the board, stated because Q6 demands one sentence and this is it.
**Nothing on this board can move without Marco.** `#2017` is parked on `[LABEL_PRESENT]` and only he
removes the label. Of 27 HOLDs, 11 carry a human gate, 12 have an unreleased gate, 2 need a design
reference, and the 2 that ADMIT are un-armable for the structural reasons under WHAT I MEASURED.
`armed` has been **0** since 2026-09-17T19:19:51Z.

**What the label is worth, measured:** removing `do-not-merge` from `#2017` releases
`pr-crmvis-s7-comms-inbox` (its gate is the `CRM_PARITY_BULKLINK_V1` needle `#2017` puts on `main`),
and s7's own output releases `pr-crmvis-s8-comms-threads`. **One label, three slices.**

**DISPOSITION: ESCALATED** — Marco, and deliberately as one line rather than a chase: *`#2017` is
green on everything except the CP-26 pair, which is the label itself; removing it releases a
three-slice CRM chain that is otherwise idle.* Nothing else is needed from him for the board to run.

## WHAT I DID NOT DO

- **Did not touch `#2017`.** `do-not-merge` binds absolutely; only Marco removes it. Never attempted.
- **Did not arm anything.** `armed` opened and closed at **0**, proved by linting all 27 HOLDs
  individually rather than trusting the previous run's summary.
- **Did not file a second escalation for the `sot/`-scoped-prompt gap.** The mechanism is measured and
  recorded under WHAT I MEASURED; the decision it needs is already in front of Marco as F-3's option
  (a), and splitting it across two files is how a question gets lost among 60.
- **Did not implement the dispatch register.** `status-sweep.ps1` is outside 00's merge lane and the
  option is unchosen; building it would be answering Marco's question for him.
- **Did not touch `C:/PR-Master/worktrees/po-vg` or `C:\po-worktrees\po-fix-2005`.** Worktrees are
  03's, `po-vg` holds an uncommitted file, and `--force` would discard it (F-4).
- **Did not run `restart-watcher-if-wedged.ps1`** and claim no liveness verdict beyond the sweep's
  `[LIVE]` lines. The watcher is RUNNING with its wrapper alive and the queue empty, which is
  *correct*, not wedged.
- **Did not run `git` through the VM mount**, did not `git checkout` / `reset --hard` / `stash pop` /
  `clean` anywhere, did not commit on `main`, did not edit `/sot/`, did not write production data,
  did not touch Azure, Entra or SharePoint.
- **Did not read DOCTRINE §10.3–§10.6 in full.** §1–§9.6 and §10.1–§10.2.1 were read this run;
  §10.1 mattered and was read before any lane reasoning. The remainder is declared, not implied.
- **Did not delete anything from `needs-marco/`.** The sweep's section 5 produced no `[STALE]` rows
  this run, so there was nothing to discharge.

### Slot note

Opened `01:10:06Z` against a `nextRunAt` of `02:07:52Z`. Every write this run made outside the
fast-forward was in an isolated worktree with its own index; the dev tree's index was touched only by
the documented FF cure and was read back clean three ways. This is the open escalation
`needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md`,
observed again. 🔧 **The previous run's A-2 named the fix and this run took it:** the sweep was
launched early and its section 7 verdict was in hand before any decision needed it. That worked, and
it is worth keeping.
