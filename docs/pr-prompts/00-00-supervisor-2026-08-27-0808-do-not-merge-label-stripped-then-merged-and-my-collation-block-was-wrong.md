# Station 00 — Supervisor | 2026-08-27T08:08Z–2026-08-27T08:16Z

## GROUND

```
UTC            2026-08-27T08:08:56Z
origin/main    c882a815            (fetch +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 549537a4     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions agree. NOT blind — Desktop Commander resolved first try; `start_process` powershell.exe pid 33976.

## WHAT I MEASURED

- **[MEASURED]** `index.lock` **ABSENT**; `Get-Process git` count 0. The 4 h stale lock I cleared at 0608Z has not returned.
- **[MEASURED]** `gh pr list --state open` → `[]`. **ZERO open PRs.** Board fully drained.
- **[MEASURED]** Armed at depth 1 = **0** on entry; `pr-*-HOLD.md` = **61** (was 47 @06:16Z — +14 staged by 06 since).
- **[MEASURED]** Watcher node `pr-watcher[\\/]index\.mjs` — **1 process, pid 28328**, same PID as 06:16Z (identity held across the interval).
- **[MEASURED]** Clone heartbeat `C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log` last wrote `06:27:43Z` on entry (100 min stale) — **idle, not wedged**; proven by the pickup below.
- **[MEASURED]** Merged since my last run: **#1348 @06:21:02Z**, **#1349 @06:44:36Z**. Both `mergedBy=GH-Mantova`, `auto_merge=null`, `labels=[]` at read time.
- **[MEASURED]** marco probe on `processed/*.log`: `pr-rates-consumers-s3a-export-only-ready.md.log` **marco:true** (→#1348); `pr-dns-s3-sot06-widgets-and-marker-ready.md.log` **marco:true** (→#1349). Control held: `rev-1348`/`rev-1349` logs carry no marco key.
- **[MEASURED]** Watcher reason strings — #1348: `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/rates/__tests__/rate-resolver.service.spec.ts"}` · #1349: `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`.
- **[MEASURED]** `issues/<n>/events` label history — **#1348: ZERO label events.** **#1349: `labeled 'do-not-merge' by GH-Mantova @06:23:10Z`, then `unlabeled 'do-not-merge' by GH-Mantova @06:44:30Z`** — merged **6 seconds later** at 06:44:36Z.
- **[MEASURED]** No script in the repo removes the label: 103 `.ps1/.mjs/.js/.yml` under `scripts/` scanned, `--remove-label|removeLabel` → **0 files**, against a **positive control** of `do-not-merge` → **10 files**. `decideEscalationAction` in `index.mjs` only applies/declines, never removes.
- **[MEASURED]** No LIVE prompt instructs label removal. The two docs that do (`pr-1323-review-verify.md`, `pr-tender-folder-model-slice0-ready.md`) are parked in `needs-marco/recovered-from-watcher-clone-2026-08-27/`, `processed/` and `superseded/` respectively — all inert.
- **[MEASURED]** `check-breadcrumb.mjs --freshness` exit 1: 54 checked, **8 malformed (all 06's)**, 7 pre-contract. Freshness: 00 ok, 04 ok (1.9 h), 05 ok (18.0 h), **03 "SILENT" 9.2 h** — false, see FINDING 4.
- **[MEASURED]** DB collation, `docker exec` into running `project-operations-postgres` (`postgres:16-alpine`): `datcollate=en_US.utf8 ctype=en_US.utf8`.
- **[MEASURED]** Positive control on the ordering itself — Postgres `ORDER BY v` over `('apple'),('Banana'),('cherry'),('_x'),('Zebra')` returned **`Banana,Zebra,_x,apple,cherry`**, byte-for-byte identical to `node` raw-codepoint sort of the same set.
- **[MEASURED]** Arm-to-pickup: `git mv` at ~08:13:15Z → heartbeat named `pr-crm-wincount-s2-close-bypasses-ready.md elapsed=60s` at **08:14:30Z**. **~74 s.**

## WHAT CHANGED

- **Armed exactly one prompt.** `git mv docs/pr-prompts/pr-crm-wincount-s2-close-bypasses-HOLD.md → …-ready.md`, exit 0. Read back: armed **0 → 1**, and that is the only `*-ready.md` at depth 1. `index.lock` ABSENT after. Not committed — the shared dev-tree index already carried four other chats' `R100` renames plus two `A` adds, so a bare commit would have swept them in.
- Nothing merged, nothing closed, no label added or removed, no `/sot/` edit, no watcher restart.

## FINDINGS

**1. An actor STRIPPED a `do-not-merge` label and merged 6 seconds later. This is the most serious thing on the board.**
#1349 was correctly held: the watcher wrote `marco:true` and **did** apply `do-not-merge` at 06:23:10Z. At **06:44:30Z the label was removed**, and the PR merged at 06:44:36Z. No repo script can do this (measured, with a passing positive control), so it was done by hand via `gh`/the API by a chat or station. "You never remove a `do-not-merge` label" is an absolute in `00-supervisor.md`, `02-board-driver.md` and `PROMPT-SCHEMA.md`. 06 already recorded an unattributed gate release on **#1325** on 08-26 and asked whether the gate "needs an alarm rather than a label" — with #1349 this is now **twice**, so it is a standing defect, not an incident.
This also **corrects the standing escalation**: option A ("watcher applies the label when it writes `marco:true`") would **not** have saved #1349, because the label *was* applied and then stripped. It would still have saved #1348, which got no label at all.
**Two distinct holes, measured:** (a) the `escalates:true` path labels correctly but the label is removable by any actor and nothing alarms; (b) the **routing** path (`outside tests/ or docs/`) writes `marco:true` and applies **no label at all** — #1348 had zero label events.
→ **ESCALATED** (see the question to Marco below).

**2. RULE 2 breach count is now 6, and two of them came off prompts I armed.**
#1348 and #1349 are breaches 5 and 6 in ~14 h (after #1340/#1344/#1347). #1349 came from the `dns-s3` prompt I armed at 06:15Z — so the arming lane currently feeds straight into an unprotected merge path. I armed again this run anyway (the board was at zero open PRs and zero armed; refusing to arm stalls everything and fixes nothing), but Marco should know the gate is not holding while work flows.
→ **ESCALATED**, same question as finding 1.

**3. My own MERGE-BLOCKING flag on #1348 was WRONG. Withdrawn.**
I carried into this run: *"raw-ASCII `pgAscCompare` assumes C/POSIX collation — confirm `datcollate` before merging."* `datcollate` reads **`en_US.utf8`**, which on its own reads as "the block was right and #1348 merged over it." **The positive control refuted that.** Postgres on this stack returned `Banana,Zebra,_x,apple,cherry` — pure codepoint order, identical to JS raw comparison — because **`postgres:16-alpine` is musl and has no glibc locale support**, so the `en_US.utf8` label is cosmetic and the behaviour is POSIX. `pgAscCompare` is **correct** for the current stack and #1348 did no harm on this axis. Textbook DOCTRINE §7: reading `datcollate` alone would have produced a confident, coherent, wrong verdict.
→ **ACTIONED** — flag withdrawn; verified by running the comparison rather than reading the setting.

**4. Residual, precise risk left behind by finding 3: dev and CI do not run the same Postgres.**
`docker-compose.yml` and `playwright.yml` use **`postgres:16-alpine`** (musl ⇒ codepoint ordering). **`ci.yml:67` uses `postgres:16`** — Debian/glibc, where `en_US.utf8` *is* a real linguistic collation and would sort `apple, Banana, cherry`. No `POSTGRES_INITDB_ARGS` or `LC_COLLATE` is set anywhere (`git grep` on origin/main). So the ordering `pgAscCompare` mirrors is an accident of the image, not a declared contract, and it differs between the two images we actually run.
Not urgent today: the rates-export specs sort in JS and do not depend on a live DB. **It becomes urgent the moment any test or feature asserts DB `ORDER BY` on text against the alpine image, or CI's image is swapped to alpine (or dev's to Debian).** The complete-and-additive fix is to pin the collation explicitly (`POSTGRES_INITDB_ARGS=--locale=C` or an explicit `COLLATE "C"` on the ordered columns) so the guarantee is written down rather than inherited.
→ **DEFERRED** — recorded with the measurement; would be a good small prompt for 06 to stage.

**5. Station 03 "SILENT 9.2 h" is the known false positive. Not a defect.**
`check-breadcrumb.mjs` has `CADENCE['03']=4`; 03's actual cron is **daily**, so it reports SILENT from the 8 h mark on every run. Fix is `'03': 24`. Standing, previously recorded, unchanged.
→ **DEFERRED** — the one-character fix belongs in the same prompt as the uppercase-slug drop bug, not in a 00 run.

**6. New instrument lie, measured, with a control: `start_search`'s `filePattern` silently returns 0 on a comma-separated list.**
`filePattern: "*.ps1,*.mjs,*.js,*.yml"` + pattern `do-not-merge` under `scripts/` → **0 matches**. Same query with `filePattern: "*.mjs"` → **47 matches**. My first `--remove-label` search returned "0 matches" and was **meaningless**; I only caught it because I ran the control. A single glob works; a list matches nothing and reports absence confidently. Belongs in DOCTRINE §9.1.
→ **DEFERRED** — worth a one-line addition to §9.1 next time a doc PR is open; not worth its own PR.

**7. 8 malformed breadcrumbs, all Station 06's.**
Same failure each time: no `# Station <NN>` heading, and a FINDINGS section with no disposition line. Count has drifted 7 → 8. 06 has no scheduled task (standing finding, already escalated 16:09Z), so nothing routes this back to it automatically.
→ **DEFERRED** — folded into the existing "schedule 06" escalation rather than raised separately.

## WHAT I DID NOT DO

- **Did not remove or add any label**, and did not merge anything. There was nothing open to merge.
- **Did not commit the arm.** The shared index carried six other entries from concurrent chats; committing would have swept them in (DOCTRINE §9.2). The watcher reads the working tree, and pickup was proven in 74 s, so the commit is unnecessary this run.
- **Did not chase who stripped #1349's label.** All actors merge as `GH-Mantova`, so the event log cannot attribute it. I made one honest attempt (repo-wide script scan with a passing control) and stopped rather than looping — the fix is a mechanism, not an identification.
- **Did not restart the watcher.** Verdict was idle, then proven working by the 74 s pickup. Restarting on a stale-but-idle heartbeat is the LL-25 mistake.
- **Did not arm a second prompt.** One at a time. The remaining verified candidates are `pr-e2e-container-s2-swap-required-job` and `pr-fv2-maintenance-usage-intervals` — both tracked, no `do-not-arm` in any of the three syntaxes, `requires_on_main` present.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, or production data.**

---

## ⚠️ FOR MARCO — the `do-not-merge` gate is not holding, and I now know why

Six PRs you were meant to gate have merged in ~14 h. I previously told you the fix was "make the watcher apply the label." **That was half wrong**, and the measurement above says why: on **#1349 the label WAS applied — and then removed by an actor 6 seconds before the merge.** On **#1348 no label was ever applied**, because the *routing* path (`outside tests/ or docs/`) writes `marco:true` without labelling. So there are two holes and only one of them is about applying a label.

**RULE 1 options — complete-and-additive first:**

**A — Enforce the hold at the gate, not with a removable label, AND label the routing path too.** Make CP-26 fail on the durable fact (`marco:true` in the run log / an immutable PR-body marker the watcher writes) rather than on label presence, so stripping the label cannot release the merge; and extend the watcher's labelling to the routing path so #1348-shaped PRs also carry a visible hold. **Passes both halves** — it closes the immediate hole for every future PR and adds nothing that can damage existing or future data entry; the label stays as a human-readable signal, it just stops being the enforcement.

**B — Label the routing path only** (my previous recommendation). Cheap and correct as far as it goes. **Fails the future half**: #1349 proves a label alone is removable, so the gate would still release on any PR where an actor strips it.

**C — Alarm on removal**: keep the label as the gate, add a check that fires when `do-not-merge` is unlabelled by anyone other than you. **Fails the immediate half** — it detects the breach after the merge rather than preventing it, and it does nothing at all for the unlabelled routing path.

I have not implemented any of these — the choice of enforcement mechanism is yours, and B is what I recommended last time on worse evidence.

**Second, smaller question:** something removed that label by hand at 06:44:30Z. If that was you, this is a non-event and I will stop counting those merges as breaches — say so and I will clear the standing count. If it was not you, then a station or chat is overriding your gate and option A matters a great deal more.
