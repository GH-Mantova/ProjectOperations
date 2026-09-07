# Station 00 — Supervisor | 2026-09-07T05:08Z–2026-09-07T05:2xZ

## GROUND

```
UTC            2026-09-07T05:08:46Z
origin/main    21c98545   [MEASURED via GitHub read — NOT via fetch+rev-parse; see below]
dev tree       main @ 5e0e26b2   C:\ProjectOperations2   (five merges behind; I could not fast-forward it)
doc version    1          (station_doc_version, docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1          (station_doc_version in the scheduled-task file)
```

Doc version and bootstrap AGREE. This run was not read-only-restricted on that account.

🔴 **THIS RUN WAS BLIND — the third of the last four.** Per PREFLIGHT step 1 I **loaded first and
declared second**: four `ToolSearch` calls (`desktop-commander` keyword ×2, `start_process powershell
terminal`, and an explicit `select:start_process,interact_with_process,read_process_output,read_file,
write_file,list_directory,search_files,search_code,get_config`) returned **no Desktop Commander tool
of any id**. The session then named the cause itself:
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server ... connection timed out
after 30000ms"`. **That is an unreachable server after a successful load, not an unloaded schema.**
No PowerShell, no `git`, no `gh`, no `status-sweep.ps1`, no `triage-holds.ps1`, no `arm-prompt.ps1`,
no smoke, no merge.

**So this is again the second of the two blind-run reports** named in `STATION-CAPABILITIES.md` §3:
*"I was blind, so I read everything readable and acted on none of it"* — **not** *"I was blind, so I
did nothing."* Everything below GROUND was read through the Cowork workspace mount, which §3 records
as being the live dev tree itself, or from the GitHub MCP with every such reading tagged.

**Device-bridge git guard, installed FIRST, before any VM-side call.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → exit 0. Last line quoted
verbatim: `persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`,
preceded by `vm-git-guard installed at /sessions/determined-wizardly-hopper/.local/bin/git - refuses
mounted paths, allows everything else (both controls passed)`. **INSTALLED. I ran no `git` command
anywhere this run**, against the Windows `.git` or through the mount.

**How the two SHAs above were obtained, since I could not run `git`.** The dev-tree line is read from
the ref file `.git/refs/heads/main` (`5e0e26b2e822ac05dbb7555f6e2fd4d79b88a561`) — a file read, not a
git invocation. `origin/main` is tagged `[MEASURED via GitHub read]` because the tree's own
remote-tracking ref `.git/refs/remotes/origin/main` reads `898ac872` and is **itself three merges
stale**. The live value `21c98545` (#1740, merged 04:24:56Z) comes from the GitHub MCP `list_commits`
and is labelled as such rather than presented as tree coverage.

**Which tree I read the binding documents in, and the freshness I could NOT prove.** The mount of
`C:\ProjectOperations2`, the dev tree — never the watcher clone. 🔴 **I could not satisfy PREFLIGHT
step 2's freshness check** (`git diff --numstat origin/main -- <path>` is a `git` command). I read
`00-supervisor.md` PREFLIGHT + REPORT CONTRACT and `STATION-CAPABILITIES.md` §3 in full from the
working copy at `5e0e26b2`, **unverified against `origin/main`**. Of the five merges I am behind,
`b156352a` (#1757) edits DOCTRINE §10.6 — so my §10.6 is known to be one revision stale, and F1 below
is written from first principles and its own measurements rather than by citing that section.

**Dev-tree integrity, by file read only.** [MEASURED] `.git/HEAD` → `ref: refs/heads/main`. **No**
`index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` or
`sequencer`. [CANNOT MEASURE] the working-tree dirty state — that needs `git status`.

**Every timestamp in this report is taken from log or file CONTENT, or from GitHub — never from a
mount `stat`.** §3 records that the mount's file times are host-local surfaced as UTC and wrong by
the host's +10 h offset, with nothing warning.

## WHAT I MEASURED

**COLLECT — the window is 04:08Z → 05:08Z. It contains no new breadcrumb and one merge.**
[MEASURED] `docs/pr-prompts/` in the dev tree carries four `00-*` breadcrumbs: `…-0108-…`,
`…-0209-…`, `00-04-scanner-…-0211-…` (all three archived by `#1757`, stale duplicates the unmoved
tree still shows, **not mine to collect again**) and my predecessor's **`…-0408-…`**, which I read in
full. **No breadcrumb from 03 / 04 / 05 / 06 arrived in my window.** [MEASURED via GitHub read] one
commit landed on `main` in the window: **`21c98545` — `#1740`, merged 04:24:56Z.**

**My predecessor's dispositions, and what my window does to them.** The 04:08Z run was also blind.
Its F3 (the `#1740` escalation is ANSWERED because a signed receipt reached the branch and CP-26 went
green) is now **overtaken by events: `#1740` has MERGED**, so the escalation is answered *and* spent —
see F2, which is about the one risk that merge did **not** close. Its F1 (three prompts armable for
merged work) is **still open and unchanged** — F3 below, re-measured, not re-raised. Its F2
(`needs-marco/` is gitignored, 36 files on `origin/main`'s four) I re-raise nowhere: it is Marco's
call and it is already written at a tracked path. Its F4 (stale dev tree) has got worse by one merge.

**The board, live.** [MEASURED via GitHub read] `list_pull_requests state=open` → **2 open PRs**.
`#1740` is gone from the list because it merged.

| PR | created | branch | labels | classification |
|---|---|---|---|---|
| `#1746` | 00:23:22Z | `feat/rates-plant-fuel-column` | `do-not-merge` | **MARCO'S** — `migrations/`, and a live `do-not-merge` |
| `#1758` | **05:09:47Z** | `feat/rates-fields-table-from-and-used-in` | none | **MARCO'S** by hand-classification — `apps/web/**`, see below |

**RULE 2 probe — live tree pinned, both controls asserted, fresh needle.** [MEASURED] over
`C:\ProjectOperations2\docs\pr-prompts\processed` (the **LIVE** tree — never the
`C:\po-watcher\…\processed` decoy, whose positive control also passes and which then clears every PR
since 17 August). Pattern written without a quote character: `marco.:true`. Matched on `PR #<n>` in
the log **BODY**, never on the filename.

| probe | result |
|---|---|
| log count | **857** `pr-*.log` |
| POSITIVE control — logs carrying `marco.:true` | **619** of 857 |
| NEGATIVE control — freshly minted needle `zzQx9Sep7T0512NoSuchToken` | **0** |
| newest `Ended:` line (freshness from CONTENT, not `stat`) | `2026-09-07T03:33:52.469Z` |
| `#1746` | **0 logs** → `NO LOG` |
| `#1758` | **0 logs** → `NO LOG` |
| `#999999` | 0 — second negative control |

🔴 **`NO LOG` has three causes and I discriminated between them with a different instrument, as
required.** [MEASURED] `grep -rlE 'opened PR #(1758|1746)'` across the watcher's own launch logs
(`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\`) → **no match for either**. POSITIVE
control on the same instrument: `opened PR #1742` → **present in `2026-09-07.log`**, and the tail of
`opened PR #<n>` lines ends `… #1707, #1740, #1742, #1740`. So neither open PR was watcher-opened,
neither is inside a `policy=tests-docs` waiting window, and both are **second lane**:
`[NO LANE VERDICT — hand-classified]`. `#1746` hand-classifies MARCO'S on `(^|/)migrations/` alone;
`#1758` hand-classifies MARCO'S because `apps/web/src/pages/admin/*.tsx` matches none of the three
tests-docs forms. **Neither is "not routed to Marco".**

**`#1758`'s diff, and it carries its own receipt.** [MEASURED via GitHub read] six files:
`apps/web/src/pages/admin/RatesListsAdminPage.tsx`, `ChargeStepsEditor.tsx`, `ratesListsHelpers.ts`,
two `__tests__/` files, and **`docs/decisions/merge-approvals/1758.md`** — a receipt authored inside
its own PR's diff, which is the shape Marco's 2026-09-07 ruling (*"the lane merges, but writes a
receipt first"*) prescribes for the supervised cloud lane. **Not mine to honour, revert or re-raise
as an attack.**

**Queue census — read the NAMES.** [MEASURED] at 05:1xZ the dev tree holds exactly **one**
`*-ready.md`: **`rev-1758-ready.md`** — a **REVIEW JOB** for the PR the lane just opened, not an arm.
[MEASURED] `.arming-log.txt` last two rows are unchanged from the 04:08Z reading: `ARMED
fix-1740-jest-cannot-parse-puppeteer-25-esm` at **00:20:55Z**, then `RENAMED` at 01:22:59Z.
**Arming has now been at zero for 4.8 h.**

**The watcher, by CONTENT, and with its tree pinned.** [MEASURED] `ensure-watcher.log` →
`watcher alive, pid(s) 31660` every ten minutes from 03:55:05Z through **05:05:05Z** — the **same pid
all night**, so no relaunch and no unclean death in my window. [MEASURED]
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json` →
`{"ts":"2026-09-07T05:10:05.261Z","lane":null,"lanes":2,"armed":0,"owned":0,"deferred":[],"runnable":0,"conflictedPrs":[]}`
— current to the minute. Its `heartbeat.log` newest line is `[2026-09-07T05:13:42.248Z]
rev-1758-ready.md elapsed=60s`, i.e. the watcher is **working the review job right now.**
🔴 **All three are readings, not a verdict.** `restart-watcher-if-wedged.ps1` cannot run blind.
**[CANNOT MEASURE] watcher liveness** in the sanctioned sense; nothing below depends on it.

## WHAT CHANGED

**On the board: nothing. I was blind and I mutated nothing.** No arm, no merge, no label, no rebase,
no PR, no comment, no rename, no `git mv`, no receipt.

**One file written to the dev tree, UNTRACKED and inert:** this breadcrumb. A breadcrumb filename
matches no watcher glob (`READY_PATTERN` is `/^(pr|rev)-.*-ready\.md$/i`), so leaving it in the queue
root arms nothing. 🔴 **I cannot commit it** — a blind run has no `git`, and the GitHub MCP token is
write-403. **Two breadcrumbs now sit uncommitted in the queue root: my predecessor's `…-0408-…` and
this one.** If you are the next sighted run, both are yours to commit — fast-forward the tree first.

## FINDINGS

### F1 — a fourth prompt is now armable for a PR the supervised cloud lane already built, and this one looks like the safest arm on the board

`#1758` (opened 05:09:47Z) marks `apps/web/src/pages/admin/RatesListsAdminPage.tsx` with
`RATE_FIELDS_TABLE_V2`. [MEASURED] `docs/pr-prompts/pr-linefields-s3-fields-table-from-and-used-in-HOLD.md`
is still at depth 1 on **`origin/main`** and in the dev tree, and its front matter reads:

```
premise:  '! grep -q "RATE_FIELDS_TABLE_V2" apps/web/src/pages/admin/RatesListsAdminPage.tsx'
done_when: pnpm build && pnpm lint && grep -q "RATE_FIELDS_TABLE_V2" apps/web/src/pages/admin/RatesListsAdminPage.tsx
size: 5    gate_allow: none    escalates: false
```

NEGATIVE control on the same grep against an unrelated prompt (`pr-tr-s2-reminder-engine-HOLD.md`):
**0 hits**, so the marker match is this prompt's and not an artefact of the query.

**The premise and the PR are the same string, and the premise is still TRUE**, because `#1758` has
not merged. So `lint-prompt.mjs` will ADMIT it, `triage-holds.ps1` cannot see the open PR, and
nothing in the arming path knows the work is already built. 🔴 **And it is the most attractive
candidate on the board**: `gate_allow: none`, `escalates: false`, size 5, a web-only scope — exactly
the profile a run reaches for when arming resumes after 4.8 h at zero. Arming it opens a **second PR
for work `#1758` already carries.**

This is the same defect the 03:08Z run recorded three times over and the 04:08Z run carried forward
as its F1 — **the fourth instance, and the first for this prompt.** The pattern is now stable enough
to name: *the supervised cloud lane builds a prompt's work without consuming the prompt, the premise
dies on MERGE rather than on OPEN, and every station reading `origin/main` in between sees an armable
prompt.* `pr-rates-plant-fuel-column-HOLD.md` stands in exactly this relation to open `#1746` and is
already on the standing do-not-arm list for a different reason (Marco's ruling).

**DISPOSITION: DEFERRED, and DISPATCHED to the next sighted Station 00.** I cannot `git mv` it —
blind. 🔴 **DO NOT ARM `pr-linefields-s3-fields-table-from-and-used-in-HOLD.md` while `#1758` is
open**, and retire it to `docs/pr-prompts/superseded/` when `#1758` merges, in the same board PR that
retires the three from F3. **What makes it urgent is arming, not rot**: the next run that goes looking
for a candidate will find this one in the ADMIT bucket and it will look clean.

### F2 — `#1740` has MERGED, so puppeteer@25.9.0's `node >= 22.12.0` is on `main`, and I re-measured that nothing in this repo pins the App Service Node version

[MEASURED via GitHub read] `#1740` merged **04:24:56Z** as `21c98545`, inside my window. Its own
receipt, `docs/decisions/merge-approvals/1740.md`, records the risk the merge does not close:
puppeteer@25.9.0 declares `engines: node >=22.12.0`, and on Node 20 or 22.0–22.11 **PDF rendering
breaks in production.**

🔴 **I did not quote that claim — I re-measured it, and it holds.** [MEASURED via GitHub read]
`search_code` for `WEBSITE_NODE_DEFAULT_VERSION OR linuxFxVersion` across the whole repository returns
**three files, and not one of them is deploy configuration**: the `1740.md` receipt itself and two
Station breadcrumbs in `docs/pr-prompts/archive/`. **No workflow, no Bicep/ARM, no App Service config
in this repository names a Node version.** `total_count: 3`, `incomplete_results: false`.

**What changed today is the tense.** Until 04:24:56Z this was a risk on an open PR; it is now on
`main` and ships with the next deploy. The finding is filed at
`needs-marco/app-service-node-version-is-pinned-nowhere-and-puppeteer-25-needs-2212-2026-09-07.md`,
which — per my predecessor's F2 — is a **gitignored** path that exists on exactly one machine's disk.
This paragraph is that finding's first appearance at a tracked path, which is the additive half of
the fix its own author recommended.

**DISPOSITION: ESCALATED — Marco's, and nobody else's.** Verifying or setting the App Service runtime
version is behind the **absolute Azure/Entra/SharePoint stop** (§5.1): no agent may check it, let
alone change it. The question, not a status update:

> **The API now requires Node ≥ 22.12 at runtime for PDF rendering. What Node version is the App
> Service actually running, and do you want that pinned in the repo?** RULE 1, complete-and-additive
> first:
>
> - **(a) COMPLETE + ADDITIVE — my recommendation: pin it in the repo AND assert it in CI.** Add an
>   explicit `engines: { node: ">=22.12.0" }` to `apps/api/package.json` and a CI step that fails the
>   build if the declared runtime is lower, so the next dependency with an engine floor is caught by
>   a red check rather than by a blank PDF in production. Damages no existing data entry, and the
>   repo stops being silent about a value production depends on. **I can write this and the runbook;
>   only you can touch the App Service itself.**
> - **(b) Set the App Service Node version and change nothing in the repo.** Fails the *future* half:
>   the pin lives only in the portal, so the next agent re-measures the same silence and the next
>   engine bump is invisible again.
> - **(c) Do nothing — assume the platform is already on a current LTS.** Fails both halves. If it is
>   on Node 20, PDF rendering is already broken and nothing in the pipeline will tell you.

**Severity S1 if the App Service is on Node < 22.12** — that is a live production defect on the next
deploy — and S3 if it is not, in which case (a) is still worth doing cheaply. **I cannot tell which,
and per the hard stop I did not try.**

### F3 — my predecessor's F1 is unchanged: three prompts are still armable on `origin/main` for work that merged hours ago

Re-measured, not re-raised. [MEASURED via GitHub read] `origin/main:docs/pr-prompts/` at depth 1
still carries **`pr-module-provenance-s1-HOLD.md`** (shipped as `#1753`, 03:22:09Z),
**`pr-hygiene-s1-guarded-branch-prune-HOLD.md`** (`#1756`, 03:47:10Z) and
**`pr-triage-holds-spent-behind-a-reject-HOLD.md`** (`#1754`, 04:05:40Z). [MEASURED] all three are
also PRESENT in the dev tree. Nothing has retired them.

**DISPOSITION: DISPATCHED to the next sighted Station 00, unchanged** — one board PR retiring all
three to `docs/pr-prompts/superseded/`, exactly as `#1757` retired thirteen, **and now four with F1's
prompt when `#1758` merges.** 🔴 **Do not arm any of the four.** I add no second escalation file and
open no new thread: this is one finding with one owner, and repeating it is how a dispatch turns into
noise.

### F4 — `.queue-state.json` lives in the WATCHER CLONE, not the dev tree, and my own first probe read that as a missing file

[MEASURED] `ls -a C:\ProjectOperations2\scripts\pr-watcher\` → `.reviewed-prs.json` and
`.watcher-children.json` are present, **`.queue-state.json` is not**, and `find` at depth 4 across the
dev tree returns nothing. My first reading was therefore *"the watcher's state file has disappeared
while the watcher is alive"* — which would have been a real and alarming finding. It is false.
[MEASURED] the file is at
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json`, current to `05:10:05.261Z`,
alongside a `.watcher.lock` the dev tree also does not have. **The watcher runs from the clone and
writes its state there.**

⚠️ **This is the standing PIN-THE-TREE trap in a new place.** My predecessor's report named the file
as `scripts/pr-watcher/.queue-state.json` with no tree, which is unambiguous only to a reader who
already knows the answer; the dev-tree path resolves to *nothing* rather than to a stale decoy, so
here the failure is loud. It will not always be. **Every future reading of `.queue-state.json`,
`heartbeat.log` or `.watcher.lock` must name `C:\po-watcher\ProjectOperations\` explicitly** — those
three are clone-only state, and a `[MEASURED]` line that omits the tree is not reproducible.

**DISPOSITION: ACTIONED** — corrected here, with both readings quoted so the next run does not repeat
my thirty seconds of alarm, and the naming rule stated in a form a station doc can absorb.

### F5 — the dev tree is now FIVE merges behind and its own tracking ref is three merges stale

[MEASURED] `.git/refs/heads/main` = `5e0e26b2`; `.git/refs/remotes/origin/main` = `898ac872`; live
`origin/main` = `21c98545`. Behind by `#1757`, `#1756`, `#1754`, `#1740` — five commits including
`b156352a`. A run that trusted the tree's own tracking ref would be wrong twice over.

The bite is unchanged and now larger: `lint-prompt.mjs` greps `premise:` against the **working tree**,
which still holds the thirteen prompts `#1757` retired, the three in F3, and F1's. **Any triage or
arming decision computed in this tree right now is computed against superseded prompt text.**

**DISPOSITION: DEFERRED.** The cure is `fetch --prune` + `merge --ff-only`, both `git`, both
unavailable blind, and §9.2 forbids reaching for the mount instead. **Already urgent for the next
sighted run: fast-forward BEFORE any triage or arm, and before committing either breadcrumb.**

## WHAT I DID NOT DO

- **Merged nothing, armed nothing, labelled nothing, rebased nothing, renamed nothing.** Blind: no
  `status-sweep.ps1` verdict, therefore no safe-to-act verdict, therefore no board mutation was
  permissible at any moment of this run. `Assert-SmokedOrEscalate` / `Merge-Pr` were not invoked and
  `gh pr merge` was not typed.
- **Did not touch `#1758` or `#1746`.** Both hand-classify **MARCO'S**, both are second lane, and I
  hold no clearance from him in this session. I did not read `#1758`'s receipt as authority for
  anything, and I did not treat the absence of a lane verdict as "not routed to Marco".
- **Did not author any `docs/decisions/merge-approvals/<N>.md`**, at any greenness, for any PR.
- **Did not substitute GitHub reads for host coverage.** I used the GitHub MCP for five specific
  facts — the open-PR list, the last eight commits on `main`, `#1758`'s changed files, the
  `origin/main` prompt-directory listing, and one `search_code` for the Node pin — and every one is
  tagged `[MEASURED via GitHub read]`. `origin/main` is not the tree the watcher globs.
- **Did not claim a liveness verdict.** `.queue-state.json`, `heartbeat.log` and `ensure-watcher.log`
  are content readings, tree-pinned and labelled as such. `restart-watcher-if-wedged.ps1` did not
  run. **[CANNOT MEASURE].**
- **Did not run `git` anywhere** — not against the Windows `.git`, not through the mount. The VM
  guard was installed first and every SHA above came from a ref file or from GitHub, both labelled.
- **Did not run `check-breadcrumb.mjs`**, so I make no `breadcrumb-clean` claim; its `trackedSet`
  comes from `git ls-tree`, which the guard correctly refuses against a mount.
- **Did not re-collect** the three stale breadcrumbs in the queue root — `#1757` archived all three
  and every finding in them is dispositioned.
- **Did not re-raise** my predecessor's `needs-marco/`-is-gitignored escalation (Marco's call, already
  at a tracked path), the CP-26-armed-by-labelling escalation, the `pollForBehindPrs` rebase
  escalation, the hourly-00 cron-collision escalation, or the three-stations-at-once escalation.
  **05 is not a stopped station and is not reported as one.**
- **Did not touch `C:\po-vg`, the watcher clone's git state, `ProjectOperations-lane2`, or any
  worktree.** Station 03's lane on 00's dispatch, and unreachable from here regardless.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** Absolute — which is precisely why F2 is an
  escalation and not a fix.
