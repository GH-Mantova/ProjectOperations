# Station 00 — Supervisor | 2026-09-07T04:08Z–2026-09-07T04:2xZ

## GROUND

```
UTC            2026-09-07T04:08:54Z
origin/main    3dcd41e0   [MEASURED via GitHub read — NOT via fetch+rev-parse; see below]
dev tree       main @ 5e0e26b2   C:\ProjectOperations2   (four merges behind; I could not fast-forward it)
doc version    1          (station_doc_version, docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1          (station_doc_version in the scheduled-task file)
```

Doc version and bootstrap AGREE. This run was not read-only-restricted on that account.

🔴 **THIS RUN WAS BLIND.** Per PREFLIGHT step 1 I **loaded first and declared second**: three
`ToolSearch` calls (`desktop-commander start_process interact_with_process read_file`, then the
keyword form `desktop-commander`, then `start_process powershell terminal process interact`)
returned **no Desktop Commander tool of any id**. The third returned unrelated tools from other
servers, which is the search working. The session then reported it explicitly:
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server ... connection timed out
after 30000ms"`. **That is an unreachable server after a successful load, not an unloaded schema.**
No PowerShell, no `git`, no `gh`, no `status-sweep.ps1`, no `triage-holds.ps1`, no `arm-prompt.ps1`,
no smoke, no merge.

**So this is the second of the two blind-run reports** named in `STATION-CAPABILITIES.md` §3: *"I was
blind, so I read everything readable and acted on none of it"* — **not** *"I was blind, so I did
nothing."* Everything below GROUND was read through the Cowork workspace mount, which §3 records as
being the live dev tree itself, or from the GitHub MCP with every such reading tagged.

**Device-bridge git guard, installed FIRST, before any VM-side call.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → exit 0. Last line quoted
verbatim: `persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`,
preceded by `vm-git-guard installed at /sessions/peaceful-loving-lamport/.local/bin/git - refuses
mounted paths, allows everything else (both controls passed)`. **INSTALLED. I ran no `git` command
anywhere this run**, against the Windows `.git` or through the mount.

**How the two SHAs above were obtained, since I could not run `git`.** The dev-tree line is read
from the ref file `.git/refs/heads/main` (`5e0e26b2e822ac05dbb7555f6e2fd4d79b88a561`) — a file read,
not a git invocation. `origin/main` is tagged `[MEASURED via GitHub read]` because the tree's own
remote-tracking ref `.git/refs/remotes/origin/main` reads `898ac872` and is **itself stale by two
merges**. The live value `3dcd41e0` (#1754, merged 04:05:40Z) comes from the GitHub MCP and is
labelled as such rather than presented as tree coverage.

**Which tree I read the binding documents in, and the freshness I could NOT prove.** The mount of
`C:\ProjectOperations2`, the dev tree — never the watcher clone. 🔴 **I could not satisfy PREFLIGHT
step 2's freshness check**, which prescribes `git diff --numstat origin/main -- <path>`, because that
is a `git` command. I read `STATION-CAPABILITIES.md` §3 in full, `00-supervisor.md` PREFLIGHT +
REPORT CONTRACT + ESCALATE in full, and `DOCTRINE.md` §5b, from the working copy at `5e0e26b2`,
**unverified against `origin/main`**. Of the four merges I am behind, `b156352a` (#1757) **edits
DOCTRINE §10.6** — so my §10.6 is known to be one revision stale and I cite it nowhere below.

**Dev-tree integrity, by file read only.** [MEASURED] `.git/HEAD` → `ref: refs/heads/main`. **No**
`index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` or
`sequencer`. [CANNOT MEASURE] the working-tree dirty state — that needs `git status`.

**Every timestamp in this report is taken from log or file CONTENT, or from GitHub — never from a
mount `stat`.** §3 records that the mount's file times are host-local surfaced as UTC and are wrong
by the host's +10 h offset, with nothing warning.

## WHAT I MEASURED

**COLLECT — the window is 03:08Z → 04:08Z.** My predecessor is the **03:08Z SIGHTED** run, not the
02:09Z blind one: it merged as `#1757` (`b156352a`, 03:30:49Z) and its breadcrumb is
`docs/pr-prompts/00-00-supervisor-2026-09-07-0308-…md` on `origin/main`, which I read in full.
**No new breadcrumb from 03 / 04 / 05 / 06 has arrived since**, and none of the four merges in my
window carries one — they are `#1753`, `#1756`, `#1754` (supervised cloud lane, each with its own
receipt) and `#1757` (the 03:08Z board PR).

⚠️ **The three breadcrumbs still sitting in the dev tree's queue root are STALE DUPLICATES, not new
work.** `…-0108-…`, `…-0209-…` and `00-04-scanner-…-0211-…` were all committed into `archive/` by
`#1757`; the dev tree simply has not fast-forwarded past that merge. **They are not mine to collect
again** — every finding in all three already carries a disposition. A sighted run's `merge --ff-only`
removes them from the root.

**The 03:08Z run's dispositions, which I re-raise none of.** F1 (`#1756`'s pipe-in-a-refname red)
ACTIONED — and now **CONFIRMED CLOSED**: `#1756` merged 03:47:10Z, so the Windows job went green on
`d960ce9e`. F3 (13 prompts retired to `superseded/`) ACTIONED — confirmed: [MEASURED via GitHub read]
`origin/main:docs/pr-prompts/` at depth 1 no longer carries `pr-verdict-anchor-heading-form-HOLD.md`,
`pr-watcher-idle-tick-liveness-HOLD.md` or the other eleven. F4 (DOCTRINE §10.6 amended) ACTIONED.
F6 (`#1740`/`#1746` are Marco's) ESCALATED — **see F3 below, the escalation has been answered.**
**F2/F5 are the one disposition my window changes, and that is F1 below.**

**The board, live.** [MEASURED via GitHub read] `list_pull_requests state=open` → **2 open PRs**,
down from five at 03:08Z:

| PR | created | branch | classification |
|---|---|---|---|
| `#1746` | 00:23:22Z | `feat/rates-plant-fuel-column` | **MARCO'S** — `migrations/`, `GATE-ALLOW: migrations`, body says *"Opened unarmed. `escalates: true` — this is Marco's merge, not the lane's"* |
| `#1740` | 2026-09-06T23:02:21Z | `deps/puppeteer-25-remove-extract-zip` | **MARCO'S** — live `marco:true`, see the probe |

**RULE 2 probe — live tree pinned, `rev-*` excluded, both controls asserted.** [MEASURED] over
`C:\ProjectOperations2\docs\pr-prompts\processed` (the LIVE tree; **never** the
`C:\po-watcher\…\processed` decoy, whose positive control also passes and which then clears every PR
since 17 August). Pattern written without a quote character: `marco.:true`. Matched on `PR #<n>` in
the log **BODY**, never on the filename.

| PR | `pr-*.log` hits | verdict |
|---|---|---|
| `#1740` | 2 — `pr-deps-s2-puppeteer-…` (`marco:true` **present**) and `pr-fix-1740-…` (absent) | **MARCO'S, at any greenness** |
| `#1746` | 0 | `NO LOG` → `[NO LANE VERDICT — hand-classified]`, and it hand-classifies **MARCO'S** on `(^|/)migrations/` alone |
| `#999999` | 0 | NEGATIVE control |

POSITIVE control: `marco.:true` present in **619** of **857** `pr-*.log`. NEGATIVE control on a
freshly minted needle (`zzQnx7NoSuchTokenSept7`): **0**. **Freshness asserted from log CONTENT, not
`stat`:** newest `Ended:` line is `2026-09-07T02:11:48.083Z`, younger than both open PRs.
⚠️ The 03:08Z run counted **4** logs for `#1740` and I count **2**; the difference is match shape,
not board state, and it does not move the verdict — `marco:true` is present either way. I report my
own count rather than quoting theirs.

**Queue census — read the NAMES, and there are none to read.** [MEASURED] **zero** `*-ready.md` in
`docs/pr-prompts/` (dev tree) **and** zero at depth 1 on `origin/main`. Not five, not one. **Nothing
is armed and nothing is queued for review.** `.arming-log.txt` last entries: `ARMED
fix-1740-jest-cannot-parse-puppeteer-25-esm` at **00:20:55Z**, then one `RENAMED` at 01:22:59Z.
**Arming has been at zero for 3.8 h**, deliberately — the 03:08Z run declined to arm because its
whole ADMIT bucket needed re-triage against a board that changed twice while it read.

**The watcher, by CONTENT.** [MEASURED] `scripts/pr-watcher/.queue-state.json` →
`{"ts":"2026-09-07T04:10:05.851Z","lanes":2,"armed":0,"owned":0,"runnable":0,"conflictedPrs":[]}` —
current to the minute. `ensure-watcher.log` → `watcher alive, pid(s) 31660` every ten minutes from
02:15:04Z through **04:05:03Z**, the **same pid all night**, i.e. no relaunch and no unclean death in
my window. 🔴 **Both are readings, not a verdict.** `restart-watcher-if-wedged.ps1` cannot run blind.
**[CANNOT MEASURE] watcher liveness** in the sanctioned sense; nothing below depends on it.

**A second watcher clone exists and is deliberately stopped — recorded so it is not read as newly
discovered.** [MEASURED] `C:\po-watcher\ProjectOperations-lane2\` carries its own `heartbeat.log`
whose newest CONTENT line is **2026-08-18T06:03:01Z**, twenty days old, and `C:\po-watcher\` holds a
top-level `STOP-WATCHER-LANE2` file. It has no `.queue-state.json` at all. The `"lanes": 2` in lane
1's state file is a **configuration value, not two running watchers**. Coherent and benign at
`armed: 0`. No finding filed.

## WHAT CHANGED

**On the board: nothing. I was blind and I mutated nothing.** No arm, no merge, no label, no rebase,
no PR, no comment, no rename, no `git mv`, no receipt.

**One file written to the dev tree, UNTRACKED and inert:** this breadcrumb. A breadcrumb filename
matches no watcher glob (`READY_PATTERN` is `/^(pr|rev)-.*-ready\.md$/i`), so leaving it in the queue
root arms nothing. 🔴 **I cannot commit it** — a blind run has no `git`, and the GitHub MCP token is
write-403. It sits in the queue root until a sighted Station 00 sweeps it into a board PR. **If you
are that run: it is yours to commit, and fast-forward the tree before you do.**

## FINDINGS

### F1 — the 03:08Z run's F2 predicted these three prompts would retire themselves on merge; all three merged, and all three are still armable on `origin/main`

The 03:08Z run recorded `pr-module-provenance-s1`, `pr-triage-holds-spent-behind-a-reject` and
`pr-hygiene-s1-guarded-branch-prune` as **DO-NOT-ARM-WHILE-OPEN**, on the grounds that the supervised
cloud lane had built all three inside 71 seconds without consuming the prompts, and that *"the premise
dies on MERGE, not on OPEN."* **All three PRs have now merged, inside my window:**

| prompt | PR | merged | its gate, on `origin/main` now |
|---|---|---|---|
| `pr-module-provenance-s1-HOLD.md` | `#1753` | 03:22:09Z | `deriveModule` **PRESENT** in `scripts/pipeline/lint-prompt.mjs` |
| `pr-hygiene-s1-guarded-branch-prune-HOLD.md` | `#1756` | 03:47:10Z | `scripts/branch-prune.ps1` **EXISTS** (read in full) |
| `pr-triage-holds-spent-behind-a-reject-HOLD.md` | `#1754` | 04:05:40Z | `SPENT_BEHIND_A_REJECT_V1` **PRESENT** in `scripts/pipeline/triage-holds.ps1` |

[MEASURED via GitHub read] each marker by `search_code` against `repo:GH-Mantova/ProjectOperations`,
and `branch-prune.ps1` by fetching the file itself. [MEASURED via GitHub read] all three prompt files
are **still at depth 1 in `origin/main:docs/pr-prompts/`** — the directory listing carries them
between `pr-fixlane-s1-…` and `pr-tr-s1-…`.

**So the prediction held in the benign direction and the follow-through has not happened.** The three
are now genuinely SPENT: `triage-holds.ps1` at `3dcd41e0` would bucket them as such and
`lint-prompt.mjs` would exit 3, which is bin-it, not ADMIT. But **until somebody moves them, a clone,
CI, or any station reading `origin/main` sees three armable prompts for work already on `main`** —
the "stays armable forever" defect, arrived at from the ordinary direction this time rather than the
` D`-in-the-dev-tree direction the 03:08Z run's F3 found.

**DISPOSITION: DEFERRED, and DISPATCHED to the next sighted Station 00.** I cannot `git mv` them —
blind. The action is one board PR: retire all three to `docs/pr-prompts/superseded/`, exactly as
`#1757` retired thirteen. **What makes it urgent is not rot but arming**: the next run that goes
looking for an arming candidate will find `pr-triage-holds-spent-behind-a-reject` in the ADMIT bucket
if it triages the dev tree before fast-forwarding, and that is precisely the nomination Station 04
made at 02:11Z and the 03:08Z run had to refuse. 🔴 **Do not arm any of the three.**

### F2 — `needs-marco/` is the doctrine's only real stop, and it is gitignored: 32 of 36 escalations exist on exactly one machine's disk

[MEASURED] `docs/pr-prompts/needs-marco/` in the dev tree holds **36** `.md` files at depth 1 plus ten
`resolved-*` / `discharged` / `_not-escalations` subdirectories. [MEASURED via GitHub read] the same
path on `origin/main` holds **four** files and **no subdirectories at all**:
`agent-authored-rule-2-clearance-2026-09-04.md`, `gitignore-citations-in-the-five-bootstraps-2026-09-06.md`,
`watcher-launcher-chain-unversioned-2026-09-04.md`, `pr-subbie-rate-cards-scope-pricing-HOLD.md`.
The cause is `.gitignore:82` — `docs/pr-prompts/needs-marco/` — one of nine `docs/pr-prompts/` lines
at `.gitignore:75-83`.

**The contradiction is inside one file, 357 lines apart.** `00-supervisor.md:152` names `needs-marco`
among the gitignored sinks and says, in bold: *"If your finding lives only in a gitignored path, you
have not reported it."* `00-supervisor.md:509` says: *"ESCALATE — write to
`docs/pr-prompts/needs-marco/`."* DOCTRINE §5b says: *"To stop something, **MOVE THE FILE** to
`docs/pr-prompts/needs-marco/`. Location is the contract."*

🔧 **Both are right about different functions of one folder, and that is the whole finding.** The
**STOP** works: the watcher globs the dev tree, so a prompt moved there stops, ignored or not. The
**REPORT** does not travel: the note explaining why it stopped, and every escalation that is not a
prompt at all, is invisible to `origin/main`, to CI, to a clone, to the supervised cloud lane, to any
station on another machine, and to every blind run. The doctrine never distinguishes the two, so a
run reads §5b, files its escalation, and records it as escalated.

**The cost is already on the record, twice, without either run naming this cause.** The 03:08Z run
wrote that the review lane's correct diagnosis of `#1756` *"sat unactioned for an hour because nothing
routes a `pr-<N>-review-block.md` to anyone"* — that file is one of the 32. And F3 below turns on
`needs-marco/app-service-node-version-is-pinned-nowhere-and-puppeteer-25-needs-2212-2026-09-07.md`,
a **production** risk on a PR that is about to merge, which likewise exists on one disk only.

**Four files were force-added, so the workaround exists and is undocumented.** Nothing in
`docs/pipeline/` tells a run to `git add -f` its escalation, and three of those four were added by
runs that presumably worked it out for themselves.

⚠️ **An instrument lie of my own, recorded because it nearly cost me the finding in the other
direction.** My first probe — grep `needs-marco` in `docs/pipeline/`, filtered for
`gitignor|untrack`, → **0 hits** — invited the conclusion that this was undocumented and new. It is
documented, at `:152`; grep is line-based and the word `gitignored` sits on the line *above* the one
carrying `needs-marco`. I caught it only by running the same query shape against `qa-findings`, a
case I knew was documented, which returned five hits. **§9.6 in its exact form: an empty result was
not an empty world, and the positive control was the only thing that said so.** What is new here is
not the gitignore line; it is the 36-versus-4 measurement and the stop/report split.

**DISPOSITION: ESCALATED — and deliberately NOT into `needs-marco/`,** which would be filing the
finding into the sink it is about. It is in this breadcrumb, at a tracked path, for the next sighted
run to commit. RULE 1 on the options, complete-and-additive first:

- **(a) COMPLETE + ADDITIVE, my recommendation:** keep `.gitignore:82` exactly as it is — it is what
  makes the folder a working *stop* for prompt files, and changing that would start committing armed
  work — and give the escalation **notes** a tracked home of their own, e.g.
  `docs/decisions/escalations/`, with `needs-marco/` remaining the quarantine for prompt files.
  Both functions keep working, nothing already written is invalidated, and the doctrine gains one
  sentence naming which of the two a given file is. Damages no existing reading or data entry.
- **(b) Negate the ignore for `*.md` that are not prompts.** Fails the *future* half: "not a prompt"
  is not expressible as a glob — `pr-subbie-rate-cards-scope-pricing-HOLD.md`, a genuine prompt, is
  already tracked in there and would stay tracked, and the next naming convention re-opens it.
- **(c) Document the `git add -f` workaround and leave the layout alone.** Fails the *complete* half:
  it depends on every future run remembering, which is the property that produced 32 files on one
  disk.

**This is Marco's call** — it changes where escalations live, which is his inbox. It is **S2, not
S1**: nothing is broken this minute, and the 32 files are all still readable on his machine.

### F3 — `#1740` is now fully green including CP-26, because a signed receipt landed on its branch: the open escalation is ANSWERED

[MEASURED via GitHub read] `#1740`'s 15 check runs at head `d24676fe` are **all `success`**, including
the two that were the standing one-cause-two-reds pair: `Approval receipt (CP-26)` → success
(03:59:27Z) and `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)` → success (03:59:28Z).
`tendering-e2e` → success at 04:12:40Z.

The cause is `docs/decisions/merge-approvals/1740.md`, now present on the PR head. [MEASURED via
GitHub read, fetched in full] its front matter is `pr: 1740`, `approved_by: marco`, `approved_at:
2026-09-07T02:05:00Z`, and its body states that this is **not** a standing-authority receipt: it
records Marco applying `do-not-merge` at 2026-09-06T23:03:01Z, removing it at 23:53:21Z, and
confirming in chat *"1740 it was me removing the label"* followed by *"drive all open prs (except for
1746) to green and merge."*

**That is exactly the RULE 1 complete-and-additive option (a)** the 01:08Z run proposed and the 02:09Z
and 03:08Z runs carried forward: let the supervised cloud lane write the receipt into the branch so
the signature exists and CP-26 goes green, costing nothing new.

🔴 **It does not clear RULE 2 for me, and it does not need to.** `#1740` still carries a live
`marco:true` (probe above). Marco's clearance reaches me only second-hand, quoted inside a file
another agent authored — the shape memory records as **`#1596`, do not honour, do not revert** — and
his 2026-09-07 ruling *"the lane merges, but writes a receipt first"* is scoped to the **supervised
cloud lane only**, which I am not. And it is moot regardless: **I am blind, so there is no
`status-sweep.ps1` verdict, therefore no safe-to-act verdict, therefore no merge was permissible at
any point this run.** I merged nothing and authored no receipt.

**One risk the receipt names is still OPEN and is not closed by that merge**, quoted from it:
puppeteer@25.9.0 declares `engines: node >=22.12.0`, and the App Service runtime Node version is
pinned nowhere in this repo — no `linuxFxVersion`, no `WEBSITE_NODE_DEFAULT_VERSION`. On Node 20 or
22.0–22.11 **PDF rendering breaks in production**. No agent may check Azure (§5.1, absolute). It is
filed at `needs-marco/app-service-node-version-is-pinned-nowhere-and-puppeteer-25-needs-2212-2026-09-07.md`
— **which per F2 exists on exactly one machine's disk.** That is the concrete cost of F2, on a PR that
is one click from production.

**DISPOSITION: the escalation `needs-marco/pr-1740-released-with-no-receipt-2026-09-07.md` is
ANSWERED and can be discharged by the next sighted run** — the receipt it asked for exists and CP-26
is green. I did not move it myself (blind, and moving it is a `git mv`). **I open no second file and
add no confirming note**, the failure mode being one escalation file per run per question. The merge
of `#1740` belongs to whoever holds Marco's chat clearance in the session where he gave it — not to a
blind scheduled run, and not to this lane.

### F4 — the dev tree is four merges behind and no blind run can fast-forward it

[MEASURED] `.git/refs/heads/main` = `5e0e26b2`; `.git/refs/remotes/origin/main` = `898ac872`; live
`origin/main` = `3dcd41e0`. Four merges have landed since the tree last moved: `898ac872` (#1753),
`b156352a` (#1757), `2b72dd1a` (#1756), `3dcd41e0` (#1754). **The tree's own tracking ref is itself
two merges stale**, so a run that trusted it without going to GitHub would be wrong twice over.

This is the STALE DEV TREE trap in its exact standing form, and today it has a specific bite:
`lint-prompt.mjs` greps `premise:` against the **working tree**, and that working tree still holds
the thirteen prompts `#1757` retired **and** the three in F1 — sixteen prompts whose work has shipped.
**Any triage or arming decision computed in this tree right now is computed against superseded prompt
text.**

**DISPOSITION: DEFERRED.** I cannot cure it — the cure is `fetch --prune` + `merge --ff-only`, both
`git`, both unavailable blind, and §9.2 forbids reaching for the mount instead (a cut-short call
leaves a 0-byte `index.lock` with no owning Windows process, which never expires and freezes every
station). **It is already urgent for the next sighted run: fast-forward BEFORE any triage or arm, and
before committing this breadcrumb.**

## WHAT I DID NOT DO

- **Merged nothing, armed nothing, labelled nothing, rebased nothing, renamed nothing.** Blind: no
  `status-sweep.ps1` verdict, therefore no safe-to-act verdict, therefore no board mutation was
  permissible at any moment of this run. `Assert-SmokedOrEscalate` / `Merge-Pr` were not invoked and
  `gh pr merge` was not typed.
- **Did not substitute GitHub reads for host coverage.** I used the GitHub MCP for six specific
  facts — the open-PR list, the last ten commits on `main`, `#1740`'s check runs and its receipt,
  `#1746`'s body, the `origin/main` prompt-directory listing, and three marker searches — and every
  one is tagged `[MEASURED via GitHub read]`. `origin/main` is not the tree the watcher globs and I
  have not presented it as one.
- **Did not author any `docs/decisions/merge-approvals/<N>.md`**, at any greenness, for either open
  PR. Not this lane's to write.
- **Did not claim a liveness verdict.** `.queue-state.json` and `ensure-watcher.log` are content
  readings and are labelled as such. `restart-watcher-if-wedged.ps1` did not run. **[CANNOT MEASURE].**
- **Did not run `git` anywhere** — not against the Windows `.git`, not through the mount. The VM
  guard was installed first and every SHA above came from a ref file or from GitHub, both labelled.
- **Did not run `check-breadcrumb.mjs`**, so I make no `breadcrumb-clean` claim; its `trackedSet`
  comes from `git ls-tree`, which the guard correctly refuses against a mount.
- **Did not re-collect** the three stale breadcrumbs in the dev tree's queue root — `#1757` archived
  all three and every finding in them is dispositioned.
- **Did not re-raise** the 03:08Z run's F1/F3/F4/F6 (all ACTIONED or already escalated), the
  `check-breadcrumb.mjs` CADENCE-map defect, the hourly-00 cron-collision escalation, the
  `pollForBehindPrs` rebase escalation, the CP-26-armed-by-labelling escalation, the `.gitignore`
  line-citation escalation, or the `05 is 14 h old` reading — **05 is not a stopped station and is
  not reported as one.**
- **Did not touch `C:\po-vg`, the watcher clone, `ProjectOperations-lane2`, or any worktree.**
  Station 03's lane on 00's dispatch, and unreachable from here regardless.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** Absolute.
