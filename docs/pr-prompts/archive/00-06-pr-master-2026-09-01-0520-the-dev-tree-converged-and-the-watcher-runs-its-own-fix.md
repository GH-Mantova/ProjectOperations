# Station 06 — PR Master | 2026-09-01T03:40Z–2026-09-01T05:25Z

## GROUND

```
UTC            2026-09-01T05:20:17Z
origin/main    b30e166a
dev tree       main @ b30e166a   C:\ProjectOperations2   (CONVERGED this run)
doc version    1
bootstrap      account skill = RETIRED POINTER v1; interactive run, not a scheduled fire
```

Continuation of the 03:30Z run. Marco present throughout. Every act outside Station 06's standing
authority in this run was individually authorised by him and is named as such below.

## WHAT I MEASURED

- **[MEASURED]** The dev tree was 6 behind `origin/main` and `merge --ff-only` REFUSED, naming one
  file: `docs/data-model/metadata-catalog.json`. `git status` called it ` M`, but
  `git diff --quiet` exited **0**, `--numstat` was empty, and the working blob equalled the HEAD
  blob exactly (`c8c4cbbd99cd6640c1c5e6f19400cd62cecf8eab` both sides). Control:
  `sweep-rotation.json` returned exit 1 and `2 2`. **The file was byte-identical to HEAD**; the
  block was a line-ending representation difference, not a content change. After a targeted
  checkout git rewrote it 679192 -> 707329 bytes (CRLF), confirming the mechanism.
- **[MEASURED]** All 7 deleted `-HOLD` entries in the dev tree were accounted for: 2 ARMED
  (`-ready` at the queue root), 5 CONSUMED (in `processed/`), **0 unaccounted**. Controls:
  `processed/` holds 3720 files; a nonsense filename returns 0.
- **[MEASURED]** The watcher clone fast-forwarded ITSELF between 03:43 and 04:14 — `index.mjs` on
  disk carried `syncMainQuietly` **3** (matching `origin/main`) with mtime `2026-09-01T03:43:16Z`,
  while node pid 32916 had been up since `2026-08-31T09:35:33Z`. **The file was fixed; the process
  was not.** No manual clone FF was needed, and the 10-day "who may FF the clone" escalation was
  therefore moot rather than resolved.
- **[MEASURED]** The queue refilled itself three times while waiting for an idle window:
  `rev-1477` at 04:44 (because PR #1477 was opened), `rev-1478` at 05:06 (because the watcher
  opened its own PR #1478). `[review] enqueued review for PR #1477` at `04:44:42` is the log line.
  **Opening a PR arms a job. Nobody armed these.**
- **[MEASURED]** The watcher tolerates a queued file vanishing: `index.mjs:820`
  `if (!existsSync(filePath)) return;`, the comment at `:449` about fs.watch renames, and
  `RESCAN_INTERVAL_MS = 5 * 60 * 1000` at `:104`. Confirmed live — it logged
  `[error] could not read rev-1477-ready.md: ENOENT` and continued without crashing.
- **[MEASURED]** PR titles are agent-invented and ungated: no `gh pr create` anywhere in
  `scripts/pr-watcher/`, no title guidance in `PROMPT-SCHEMA.md`, no title check in `.github/`.
  Across the last 40 merged PRs there are **24 distinct scopes**, six of which mean `crm`.
- **[MEASURED]** Module provenance is derivable from data prompts already carry. Over all 107
  tracked HOLD/ready prompts, ranking `prisma`/`docs`/`board`/`ci`/`e2e`/`sot` as incidental:
  **63** resolve to one product module, 24 stay genuinely ambiguous, 14 are incidental-only, 6
  unresolvable — **72% derivable without asking the author**. Naive derivation (no ranking) gives
  only 43 and was rejected.

## WHAT CHANGED

- **Dev tree CONVERGED** to `origin/main` (`502b6cf3` -> `fd1a8fb5`, later `b30e166a`). Sequence:
  `git update-index --really-refresh` (insufficient), then a **targeted single-path**
  `git checkout -- docs/data-model/metadata-catalog.json`, then `merge --ff-only`. Read-back:
  armed prompts LOST **0**, RESURRECTED **0**. A backup of the discarded file is at
  `C:\po-sup-fix-scripts\quarantine\metadata-catalog.json.devtree-20260901-040846Z.bak`,
  hash-verified against the original before anything was discarded.
- **Watcher node RESTARTED.** Old pid 32916 (up since 2026-08-31T09:35:33Z) -> **new pid 2292**,
  started `2026-09-01T05:18:15Z`, which is AFTER `index.mjs`'s mtime — the point of the exercise.
  Method: the supervisor's own sentinel handshake — `.watchdog-kill.flag` written and read back
  BEFORE `Stop-Process`, so `Resolve-WatcherExitAction` took the `relaunch-watchdog` branch rather
  than risking the `exit-deliberate` branch that caused the 2026-08-18 outage. Downtime **6s**.
  Supervisor log: `Watchdog kill 1 of 4 inside a 20 min window`. Node exit was `raw -1` normalised
  to 1, so the flag was belt-and-braces rather than strictly required — it made the outcome
  guaranteed instead of probable.
- **The restart also recovered the clone's branch.** It had been left on
  `feat/crm-s12-rescope-tr-to-crm`; `start-watcher.ps1`'s preflight auto-checked-out `main`.
- **PR #1475 merged** — retired `pr-statussweep-orphan-worktree-dirs-HOLD.md` by MOVE (git `R100`,
  content byte-unchanged) to `superseded/cleared-2026-09-01-shipped-as-1460/` with a README
  recording the measurement, and corrected F3 of the 03:30Z breadcrumb from ESCALATED to ACTIONED.
- **Another lane's prompt was disarmed and restored.** `pr-cardui-s2-wbs-table-shell` was renamed
  `-ready` -> `-HOLD` and `rev-1477-ready.md` moved intact to a scratch folder, to open the restart
  window; both were restored at 05:20 into the new process. Read-back: 2 armed, byte sizes
  unchanged, paused folder empty. **Marco authorised this explicitly**; it is not 06's act.
- Nothing else. No merge, no label touched, no arm of any prompt for its own sake, no `/sot/`.

## FINDINGS

**F1 — the board trap is about PATHSPEC SCOPE, not about git commands.** `git checkout .`,
`reset --hard`, `stash pop` and `clean` resurrect every consumed `-HOLD` and re-arm dead prompts.
`git checkout -- <one generated file outside docs/pr-prompts/>` cannot resurrect anything. Treating
the whole family as radioactive is why "nobody owns dev-tree convergence" sat open for ten days —
the operation looked categorically unsafe when only one *form* of it is.
**DISPOSITION: ACTIONED** — dev tree converged, procedure recorded here.
**Follow-up for 00:** ownership is still unassigned. I did this on Marco's instruction; nothing
about that made any station permitted to. Drift restarts accumulating from now.

**F2 — the clone healed itself; only the process was stale.** `syncMain()` was reachable after a
successful auto-merge even in the old code, so the drift was self-limiting once merges resumed. The
running code still starves it on Marco-routed and blocked PRs, which is most of the time.
**DISPOSITION: ACTIONED** — pid 2292 now runs the post-#1463 code.

**F3 — the queue generates its own work, so a restart cannot be scheduled.** Three unprompted
refills in one hour; the window only opened because a human froze three chats, and even then the
watcher fed itself. A restart procedure that requires a quiet queue is unreliable by construction.
The fix is a **drain mode** — a flag the watcher reads to finish the current job and stop
dequeuing — so the window arrives deterministically instead of being waited for.
**DISPOSITION: DEFERRED** — becomes urgent the next time the watcher must be restarted, which is
every time `index.mjs` changes. Station 06 (General) intends to design it.

**F4 — an untracked prompt is sitting in the queue.** `pr-crm-uifix-s1-cold-threshold-and-tab-shells-HOLD.md`
is UNTRACKED in git. The NEW watcher reports it at startup (`untracked-ready-prompt count = 1`); the
old process never did. Untracked prompts are invisible to worktree stations, die to `git clean`, and
`start-watcher.ps1` can stash them away when the tracked tree is dirty.
**DISPOSITION: DISPATCHED** — to Station 00 and the CRM PR Master: commit it via a docs-only PR.

**F5 — my own restart script contained a check that proved nothing.** `ToDateTime` threw on the CIM
`CreationDate`, leaving `$oldStart` null, so `running OLD code: True` was comparing against `$null`
— always true. The conclusion was right from independent measurements, but that line was not
evidence. Separately, the same script PRINTED the idle gate without ENFORCING it and would have
proceeded on `IDLE=NO`.
**DISPOSITION: ACTIONED** — both fixed before use; the gate now aborts unless it reads `IDLE=YES`,
and verification uses `Get-Process`. Recorded because a station that quietly fixes its own
instrument teaches nothing.

**F6 — arming authority moved twice in one session and nothing records it.** Marco granted 06 the
arming act while Station 00 was off, then 00 was restarted and the grant was handed back unused —
06 armed nothing. This matters because the arming log writes `by=Marco@` for every actor, and with
three PR Masters plus 00 there are four indistinguishable hands.
**DISPOSITION: ESCALATED** — 06 is designing `module:` provenance (S1 drafted, lints ADMIT size 4)
so the queue carries what the log cannot.

## WHAT I DID NOT DO

- **Merged nothing and removed no `do-not-merge` label.** #1478 carries one and is Marco's.
- **Armed no prompt for its own sake.** The only queue mutations were the authorised disarm and its
  restore. The four `-HOLD` prompts from #1474 remain parked for Station 00.
- **Did not touch the clone's git.** No FF, no stash, no branch operation. The clone's 55 stashes
  are untouched and still a closed loop.
- **Did not restart anything while work was in flight.** The gate refused twice on stale artifacts
  and once on a live build; I waited rather than loosening it, which is the temptation that
  produced the 2026-08-18 outage.
- **Did not touch `/sot/`, `apps/**`, `prisma/**`, or Azure/Entra/SharePoint.**
