# Station 00 — Supervisor | 2026-08-26T18:11:11Z–2026-08-26T18:20Z

**BLIND RUN — Desktop Commander absent. No PowerShell, no `git`, no `gh`, no `pipeline-lib`.
READ-ONLY throughout. Nothing was armed, merged, dispatched or mutated.**

## GROUND

```
UTC            2026-08-26T18:11:11Z
origin/main    549537a4   [GitHub API read — I could NOT run `git fetch`/`rev-parse`]
dev tree       CANNOT MEASURE — no git access (DOCTRINE §9.2 forbids VM-side git on the Windows .git)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md)
```

Doc version and bootstrap **agree**. The read-only posture is forced by blindness, not by a mismatch.

### What "blind" means this run, precisely

Desktop Commander did not connect. I retried the MCP bring-up three times across ~50s
(memory records DC absence as a retryable per-session race); it never appeared. `start_process` was
never available, so PREFLIGHT step 1 failed and step 4 (`status-sweep.ps1`) could not run at all.

I was **not** blind to the tree. `C:\ProjectOperations2` is mounted read/write to this session, so
every filesystem claim below is against **the actual dev tree the watcher globs** — not `origin/main`,
and not a GitHub-side substitute. Where I used the GitHub API it is tagged as such and is never
offered as tree coverage. I did **not** run `git` through the bridge (DOCTRINE §9.2 — three
index.lock freezes in two days).

**A blind run and a healthy quiet run both produce "no news." This was a blind run.**

## WHAT I MEASURED

| Claim | Evidence | Tag |
|---|---|---|
| Now = 2026-08-26T18:11:11Z | `date -u` | [MEASURED] |
| VM/host local clock is UTC+10 | newest file stamps `2026-08-27 04:00` local vs `18:11Z` | [MEASURED] |
| **0 armed prompts** (depth-1 `*-ready.md`) | `find docs/pr-prompts -maxdepth 1 -name '*-ready.md'` → 0 | [MEASURED] |
| — positive control for that glob | same dir, `*-HOLD.md` → **51** | [MEASURED] |
| No stale `index.lock` | `ls .git/index.lock` → absent; no `MERGE_HEAD`/`REBASE_HEAD`/`CHERRY_PICK_HEAD`/`rebase-*`/`sequencer` | [MEASURED] |
| **1 open PR: #1337**, `mergeable_state: clean`, updated 17:56:18Z | GitHub API `list_pull_requests` + `pull_request_read` | [MEASURED] |
| **#1337 carries ZERO labels** | `pull_request_read` full object — no `labels` key | [MEASURED] |
| **#1337 is `"marco":true`** | `processed/pr-rates-consumers-s3-persona-export-b-ready.md.log` | [MEASURED] |
| — probe discriminates | 1697 logs / 595 carry a merge result / **553 `marco:true` vs 42 bare `{"ok":true}`** | [MEASURED] |
| **#1342 merged 17:54:02Z while labelled `do-not-merge`** | `pull_request_read` → `merged:true`, `labels:["do-not-merge"]`, `merged_by: GH-Mantova` | [MEASURED] |
| main advanced `c63c5504` → **`549537a4`** by that merge | `list_commits main` | [MEASURED] |
| Watcher LIVE at 16:25Z (arm-to-pickup) | `processed/pr-sot-02-reconcile-…ready.md.log` started 16:17:17Z, exit 0 at 16:21:09Z; `rev-1342` 16:23:41→16:25:18Z | [MEASURED, decayed] |
| Watcher liveness **now** | no process access — PID identity, cmdline and Keepalive all unreachable | [CANNOT MEASURE] |
| Dev-tree git state, staged index, clone FF distance | no git access | [CANNOT MEASURE] |
| No new station breadcrumb since my 16:09Z run | newest is my own `…-1609-…` at 16:18Z; nothing from 03/04/05/06 since | [MEASURED] |
| Next 04 sweep = `gate-liveness` | `sweep-rotation.json` `last_index:3` @ 14:11:31Z → advances to 0 | [MEASURED] |
| Marco/06 active 17:54–18:00Z | 2 new `needs-marco/` files (17:59Z, 18:00Z) + `pr-rates-consumers-s3a-export-only-HOLD.md` (17:59Z), all stamped "Filed by Station 06 … at Marco's request" | [MEASURED] |

### The measurement that matters — every routing reason, counted

`grep -ho '"reason":"[^"]*"' processed/*.log | sort | uniq -c | sort -rn`

```
  41  "outside tests/ or docs/: apps/web/src/App.tsx"
  22  "escalates:true — held for Marco, labelled do-not-merge"     <-- the ONLY labelling path
  17  "timeout waiting for green checks + MERGE verdict"
  11  "outside tests/ or docs/: .env.example"
  10  "outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"
  10  "outside tests/ or docs/: .github/workflows/ci.yml"
   9  "outside tests/ or docs/: apps/web/src/components/ShellLayout.tsx"
   8  "outside tests/ or docs/: sot/04-data-model.md"
   … (further "outside tests/ or docs/" variants)
```

**Exactly one reason string mentions a label.** 553 routings wrote `marco:true`; only the 22
`escalates:true` ones were labelled. **531 of 553 Marco-held PRs carried no label at all.**

## WHAT CHANGED

**Nothing.** No arm, no disarm, no merge, no label, no dispatch, no git operation, no file edit
anywhere except this breadcrumb. The board is exactly as I found it.

## FINDINGS

### F1 — The `do-not-merge` label is applied on ONE routing path out of nine. 531 of 553 held PRs were never labelled.

The trap recorded as "a label-only check is wrong on half the board" is now diagnosed and sized. It
is not a sampling artefact and it is not half — it is **96%** of Marco-routed PRs. The watcher labels
only when it refuses for `escalates:true`. Every other refusal — the `outside tests/ or docs/` family,
`timeout waiting for green checks + MERGE verdict`, and any reason string added later — writes
`marco:true` into a **gitignored** `processed/*.log` and leaves GitHub showing an unlabelled,
`mergeable_state: clean` PR with a MERGE verdict on it.

**#1337 is that failure, live, right now:** routed to Marco, zero labels, CLEAN, open since 12:42Z.
Nothing on GitHub says it is held. The only thing standing between it and a merge is a reader who
knows to grep a gitignored log.

**RULE 1 options — complete-and-additive first.**

- **A (recommended — passes both halves).** Apply the `do-not-merge` label on **every** path that
  writes `marco:true`, not just `escalates:true` — i.e. label at the point the refusal is recorded,
  not per-reason. *Complete:* closes all nine current reason strings at once **and** every future one,
  because the label follows the decision rather than the wording. *Additive:* adds a label; removes
  no path, changes no routing logic, rewrites no log, touches no data.
- **B (fails "completely").** Label only the `outside tests/ or docs/` family (the 41-count majority).
  Leaves the 17 `timeout … + MERGE verdict` routings — the most dangerous kind, because they carry an
  explicit MERGE verdict — unlabelled, and any new reason string is unlabelled again on day one.
- **C (fails "immediately and in future").** Change nothing; keep relying on the `processed/*.log`
  probe. No data risk, but it is precisely the state that lets a CLEAN, MERGE-verdicted, unlabelled
  PR sit in front of every reader — human and agent — with no visible hold. It is the standing cause,
  not a mitigation of it.

**DISPOSITION: ESCALATED** — Marco. This supersedes and sizes the 14:09Z escalation of the same
shape; that one asserted the gap, this one measures it (531/553) and names the exact code point
(label at the `marco:true` write, not per reason string).

### F2 — #1342 merged at 17:54:02Z carrying `do-not-merge`. Unattributable — and I am not raising it as a defect.

`merged_by: GH-Mantova`, which every actor merges as, so the merge event carries no attribution by
construction. The standing lesson applies: **an unattributable label/merge event is not evidence of a
defect.** The circumstantial reading is that this was Marco — it is his SoT doc-reconcile, opened
"left unmerged for Marco's review of the rendered diff", the review verdict was MERGE, and he was
demonstrably at the keyboard in the same six-minute window (17:54–18:00Z: three files filed under his
name). Merging it is exactly what reviewing it and approving it looks like.

I say "unattributable" and stop. What I will **not** do is re-raise it as an 06-out-of-lane finding —
that inference is available and it is not supported.

**DISPOSITION: DEFERRED** — becomes urgent only if a `do-not-merge` PR merges in a window where Marco
is provably absent. F1's fix is the durable answer regardless of who merged this one.

### F3 — Station 06 ran at ~17:59Z despite having no scheduled task. The 16:09Z escalation stands, with its workaround now demonstrated.

Both new `needs-marco/` files and the new `pr-rates-consumers-s3a-export-only-HOLD.md` are stamped
*"Filed by Station 06 (PR Master), 2026-08-26, at Marco's request."* So 06's report channel works —
when Marco fires it by hand. It remains true that **06 has no scheduled task**, and therefore that
every autonomous "DISPATCHED to 06" is still a message with no reader. This run adds the missing half
of that finding: the manual path is live and productive, so scheduling 06 is an addition to something
already working, not a rescue of something broken.

**DISPOSITION: ESCALATED** — carried forward to Marco unchanged; option A from 16:09Z (schedule 06 —
complete and additive) is now better supported, not worse.

### F4 — #1337 is CLEAN, unlabelled, and RULE 2 binds. I did not merge it, and no agent should.

Open since 12:42Z, `mergeable_state: clean`, updated 17:56Z, 379/-15 across 2 files, and
`"marco":true` in its processed log. Marco has since **split the slice** — the new
`pr-rates-consumers-s3a-export-only-HOLD.md` says so explicitly and scopes the export half only,
with the persona handler carved out into `needs-marco/rates-consumers-persona-handler-and-11c`. So
#1337's disposition is now a live Marco decision (fix-forward vs supersede-by-3a), not a board
mechanic.

**DISPOSITION: DEFERRED** — blocked on Marco's own in-flight split. No agent action is correct here
until he lands it.

### F5 — Two fresh `needs-marco/` escalations were filed at 17:59Z and 18:00Z, in a gitignored directory.

`rates-consumers-persona-handler-and-11c-2026-08-26.md` (16 direct prisma calls that block slice 11c;
three capability groups) and `CONFLICT-materialdensity-524-vs-11c-2026-08-26.md` (two HOLDs disagree
about dropping `EstimateMaterialDensity`; the 11c side is an irreversible migration). Both are real
and both are Marco's. I flag only that they live under `needs-marco/`, which is gitignored at
`.gitignore:75-82` — the same class of silent channel that swallowed a Station 04 finding for nine
days. They are visible on Marco's disk and invisible to everyone else.

**DISPOSITION: DEFERRED** — content is Marco's call and he authored both. The channel question is a
subset of F1's "the hold lives only in a gitignored file" problem and should be fixed there, once.

### F6 — No stale `index.lock`; no interrupted merge/rebase/cherry-pick state.

Checked by `ls`, not by `git`. `.git/index.lock` absent; no `MERGE_HEAD`, `REBASE_HEAD`,
`CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` or `sequencer`. The tree is not frozen.

**DISPOSITION: ACTIONED** — measured clean; nothing to clear, nothing to dispatch to 03.

## WHAT I DID NOT DO

- **Did not arm.** Arming is a `git mv` of a tracked HOLD, and I had no git. Even with it I would not
  have: 51 HOLDs sit in the queue, watcher liveness is `[CANNOT MEASURE]` right now (last true
  measurement 16:25Z, and DOCTRINE is explicit that `[LIVE]` decays in seconds), and Marco is
  actively restructuring the rates cluster as of 18:00Z. Arming into that is the collision the
  concurrency rules exist to prevent.
- **Did not merge anything.** #1337 is `marco:true` → RULE 2, absolutely. #1342 was already merged
  before this run started.
- **Did not touch the `do-not-merge` label on any PR**, in either direction.
- **Did not run `status-sweep.ps1`, `lint-prompt.mjs`, `check-breadcrumb.mjs --freshness`,
  `smoke-pr.ps1`, or `pipeline-lib`** — all require the Windows shell. **Station-silence detection did
  not run this cycle.** I substituted a direct mtime scan of `docs/pr-prompts/` (no new 03/04/05/06
  breadcrumb since 16:18Z) — that is weaker: it proves nothing was *written*, not that each station
  *ran*.
- **Did not run `git` through the bridge** against the Windows `.git`, at any point, for any read.
- **Did not FF the clone or restart the watcher** — both need a stopped watcher and a shell.
- **Did not re-raise #1325, COMMS-HUB, #1336 or the rates-s3 blocker** — closed, per standing note.

## NOTE FOR THE NEXT 00

This breadcrumb is **untracked** until a board PR commits it. It joins the backlog of untracked
breadcrumbs and unstaged consumed-HOLD deletions in `docs/pr-prompts/` — the tracked-channel
stall first recorded at ~08:07Z. **Do not `git checkout` those ` D` entries; it resurrects consumed
prompts.**

Next Station 04 sweep is **gate-liveness** (`sweep-rotation.json` advances 3 → 0). That sweep is the
one that would tell us how many of the 51 HOLDs are gated on something already merged.
