# Station 00 — Supervisor | 2026-08-28T22:08Z–2026-08-28T22:30Z

## GROUND

```
UTC            2026-08-28T22:08:47Z
origin/main    1501d09c            (fetched, then rev-parse)
dev tree       main @ 1501d09c     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. Full-authority run.

## WHAT I MEASURED

**Host reachable.** [MEASURED] `start_process` powershell → `HOST_OK ... 2026-08-28T22:09:01Z`.
Not a blind run.

**The watcher's OAuth credential is STILL EXPIRED. Marco has not re-authed.** [MEASURED]
`ConvertFrom-Json C:\Users\Marco\.claude\.credentials.json`:
`claudeAiOauth.expiresAt = 1787933615984` = **2026-08-28T16:13:35Z**; file `LastWriteTimeUtc` =
**2026-08-28T16:13:26Z**; now 22:09:34Z ⇒ **356 minutes past expiry, file never rewritten.**
The mtime probe named in the 20:09Z breadcrumb worked exactly as designed: same mtime as six hours
ago ⇒ no re-auth has occurred. Cost of the probe: one `ConvertFrom-Json`, no prompt spent.

**The dead lane has now burned a REAL feature prompt, not just review jobs.** [MEASURED]
`docs/pr-prompts/failed/pr-crm-s3-account-on-client-create-ready.md.log`:

```
Started: 2026-08-28T21:03:39.176Z
Ended:   2026-08-28T21:03:55.372Z
Exit:    1
Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.
```

16 seconds, zero tool calls, zero work, prompt consumed into `failed/`. My 20:25Z run left
`armed = 0` and a CLEAN index; a concurrent actor armed this prompt at ~21:03Z while the lane was
known dead. [MEASURED] failed-log census for the expiry signature: **7 logs**, of which five are
today's — `rev-1382` 16:13Z, `rev-1383` 16:14Z, `rev-1384` 16:20Z, `rev-1385` 20:17Z,
`rev-1386` 20:52Z — plus `pr-crm-s3-account-on-client-create` 21:03Z. **ZERO in `processed/`.**
Fatal, not flaky, and still burning: three more since the 18:09Z finding.

**A half-arm was sitting in the shared index again — third occurrence in one day.** [MEASURED]
`git diff --cached --name-status` at 22:09Z:
`R100 docs/pr-prompts/pr-crm-s3-account-on-client-create-HOLD.md -> ...-ready.md`, with
`git status` = `RD` (destination absent from disk) and `depth1_matches = 0`. Triage:
`processed = 0`, `failed = 3`, `no-pr-opened = 0` — i.e. **a NEW triage case the existing rule does
not cover**: not `proc>=2` (consumed, leave) and not `proc=0 + nopr=0` (never ran, restore). It ran
and was burned by the 401, so the prompt's *content* is untouched and still wanted.

**Board is EMPTY and main is green.** [MEASURED] `gh pr list --state open` → `[]`. Three PRs landed
since my 20:25Z reading of `93bd3801`:

```
1501d09c fix(queue): CRM S3 - name the Gate A test file so the crm-build chain can move (#1386)
0a34a384 fix(lint): gate check runs on armed prompts, chain successors are not dead gates (#1377)
6b7e420e docs(pipeline): name check-breadcrumb.mjs, correct docs/qa/ claim (#1383)
```

[MEASURED] `gh pr view`: **#1377 MERGED 20:58Z · #1383 MERGED 20:42Z · #1382 CLOSED · #1385 MERGED
20:16Z · #1386 MERGED 21:02Z.** `gh run list` → `1501d09c completed/success` ×3 plus
`Push on main` success.

**Watcher healthy.** [MEASURED] `restart-watcher-if-wedged.ps1` → `armed prompts waiting: 0`,
`watcher process: ALIVE (pid 26364)`, `restart churn: 0 cycle(s) in 20 min`,
`VERDICT: OK - nothing armed and the watcher is alive.`

**Breadcrumbs: 85 checked, 0 malformed, exit 0; freshness CLEAN, exit 0.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs` and `--freshness`. Station ages: 00 2.0h · 03 47.2h
(cadence 24h) · 04 4.0h · 05 8.0h — all `ok`, but **03 is at 1.97× its cadence and will trip SILENT
within the hour.**

**Four working-tree files show ` M`; only three are real.** [MEASURED] `git hash-object` vs
`git rev-parse origin/main:<path>`:

```
docs/data-model/metadata-catalog.json : IDENTICAL-TO-MAIN   (false alarm, stale index mtime)
docs/qa/sot-refs-baseline.json        : REALLY-DIFFERENT
sot/03-progress-log.md                : REALLY-DIFFERENT
sot/06-active-specs.md                : REALLY-DIFFERENT
```

**My own 20:09Z breadcrumb never reached main.** [MEASURED]
`git cat-file -e origin/main:docs/pr-prompts/00-00-supervisor-2026-08-28-2009-...md` → exit 128,
*"exists on disk, but not in 'origin/main'"*. Every other breadcrumb written since 14:00Z is
ON-MAIN. #1385 swept up the 18:09Z file and merged at 20:16Z — before the 20:09Z run had finished
writing its own.

**My own restore instrument lied, and the read-back caught it.** [MEASURED] `git show HEAD:<path> |
Out-File -Encoding utf8` then a node BOM-strip produced **5113 bytes** and blob
`eae8469e…` ≠ HEAD `7f2afda3…`. PowerShell had added a BOM *and* converted every LF to CRLF. Redone
with `child_process.execFileSync('git',['show',...])` writing the raw Buffer: **5000 bytes**, blob
`7f2afda3…` = HEAD, `match = True`. DOCTRINE §9.3, confirmed again on live bytes.

## WHAT CHANGED

1. **Unstaged the half-arm, path-scoped.** `git restore --staged --
   docs/pr-prompts/pr-crm-s3-account-on-client-create-HOLD.md ...-ready.md`, exit 0.
   Read-back: `git diff --cached --name-status` is **empty**. Wrote, deleted and checked out
   nothing.
2. **Materialised the deleted `-HOLD.md` back onto disk from HEAD**, via node reading
   `git show HEAD:<path>` as raw bytes. Read-back: working-tree blob hash **equals** the HEAD blob
   hash; `git status --short -- <path>` prints nothing. The prompt is inert (a `-HOLD.md` matches no
   watcher glob) and survives for re-arming once the credential is fixed. Nothing was committed —
   the file is unchanged from main.
3. **`armed = 0` before and after.** Nothing was armed this run.
4. Landed this breadcrumb and the orphaned 20:09Z breadcrumb via a board PR (see FINDINGS 5).

## FINDINGS

**1. The watcher's agent lane is still dead on the expired OAuth token, and it is now destroying
real queue work.** Six prompts burned to `failed/` with zero work since 16:13Z, the latest at
21:03Z, one of them a feature prompt in the live CRM S3 chain. The credential file has not been
rewritten since it expired. No agent can fix this — it is an authorization grant.

RULE 1 options for Marco:
- **(A) Re-authenticate the watcher's `claude` CLI on the box** (`claude` login as the account that
  owns `C:\Users\Marco\.claude\.credentials.json`). *Complete* — every quarantined prompt becomes
  re-armable — and *additive*: it writes only a credential, touches no queue file and no data.
  **Recommended.**
- (B) Leave it and keep the board frozen. Fails *complete*: the queue cannot move at all. Additive,
  but the cost is one burned prompt per arm by any chat that has not read this breadcrumb.
- (C) Add a pre-arm credential guard in `lint-prompt.mjs` so an expired token blocks ADMIT. Fails
  *complete* on its own — it prevents the burn but still does not let anything run — though it is a
  good permanent complement to (A), and it is the only half an agent can build.

**DISPOSITION: ESCALATED** (authorization grant — DOCTRINE §5.3; also the second half of the
question, whether (C) should be built now, is Marco's call).

**2. A third half-arm in the shared index in one day, and it exposed a gap in the triage rule.**
The published rule covers `processed >= 2` (consumed → unstage and leave) and
`processed = 0 && no-pr-opened = 0` (never ran → restore). This one was `processed = 0,
failed = 3`: it ran, did zero work, and was burned. Treating it as "consumed" would have left the
tracked `-HOLD.md` deleted, so the next pathspec-less commit by any chat would have **deleted a live
chain prompt from `main`**. The correct handling is the third branch: **unstage, then restore the
HOLD from HEAD.** Cured and read-back-verified this run.

**DISPOSITION: ACTIONED** — index empty, HOLD blob identical to HEAD, `armed = 0`.

**3. My 20:09Z breadcrumb never reached `main`, and `--freshness` cannot see that.** The freshness
check resolved `00` against the local working tree and reported `last 2026-08-28T20:09:00Z … ok` for
a file that is not on `origin/main`. Freshness is therefore **not** evidence that a report was
published — it is evidence that a file exists on the box. Same root cause as the false `UNTRACKED`
verdict already dispatched to 06: the instrument reads the working tree, not the remote.
**Always confirm with `git cat-file -e origin/main:<path>`.**

**DISPOSITION: ACTIONED** (the orphan is landed by this run's PR) **+ DISPATCHED to 06** (fold the
"freshness resolves against the working tree" case into the same fix as the false `UNTRACKED`
report; a station is SILENT if its breadcrumb is not on `main`, not merely if it is absent from
disk).

**4. Three files are modified in the shared dev tree and uncommitted, two of them under `sot/`.**
`sot/03-progress-log.md`, `sot/06-active-specs.md` and `docs/qa/sot-refs-baseline.json` really differ
from `origin/main` (hash-compared, not eyeballed). `sot/` is 05's lane exclusively and CP-24 hard-fails
any PR mixing code and `sot/`, so I did not touch them. Left in place, uncommitted, they are one
pathspec-less commit away from being published by an unrelated PR.

**DISPOSITION: DISPATCHED to 05** — reconcile or discard these three in a doc-reconcile PR at its
next run (14:10Z). Not urgent while every chat commits with a pathspec; urgent the moment one does not.

**5. `docs/data-model/metadata-catalog.json` shows ` M` and is byte-identical to `origin/main`.**
Fourth confirmation of this class. A ` M` in this tree is not evidence of a change.

**DISPOSITION: DEFERRED** — harmless while every actor hash-compares before committing. It would
become urgent if a sweep ever auto-commits on the strength of ` M`.

**6. Station 03 has not filed a breadcrumb since 2026-08-26T23:01Z — 47.2h, 1.97× its cadence.**
Its MCP `lastRunAt` says it ran on 08-27; `origin/main` carries no breadcrumb for 08-27 or 08-28.
This is ran-and-did-not-report, already dispatched at 20:09Z. Its next scheduled run is 23:00Z, and
freshness will flip to SILENT before then.

**DISPOSITION: DISPATCHED to 03** (carried forward) — file a breadcrumb this run, and report why two
runs produced none. 03 also still owns the diverged watcher clone.

**7. The board is empty and green; the two escalations that froze it are resolved.** #1383 merged
and #1382 closed, so the duplicate wording pick is settled without an agent breaching RULE 2. #1377
merged, which **clears the standing override on next-arm item 2** (`pr-lint-not-a-prompt-HOLD` was
held only until #1377 landed; it must be re-linted against `1501d09c` before arming).

**DISPOSITION: DEFERRED** — item 2 is now unblocked on its stated precondition but **must not be
armed while finding 1 stands**; arming it today burns it. Arm it first, after re-lint, once Marco
re-auths.

## WHAT I DID NOT DO

- **Armed nothing.** With the credential expired, an arm is a guaranteed burn. `armed = 0` at start
  and at end.
- **Did not spend a prompt to "prove the lane."** The credential mtime answers it for free; the
  21:03Z burn answers it for real.
- **Did not touch `sot/03-progress-log.md`, `sot/06-active-specs.md` or
  `docs/qa/sot-refs-baseline.json`.** 05's lane; CP-24 forbids mixing them with anything else.
- **Did not merge anything.** Nothing was open.
- **Did not clear or re-arm the burned `pr-crm-s3-account-on-client-create` prompt**, and did not
  delete its `failed/` log. Re-raising it is a decision for after the re-auth, and the log is the
  evidence.
- **Did not run `git checkout`, `reset`, `stash` or `clean` anywhere**, and did not touch
  `C:\po-watcher\ProjectOperations`.
- **Did not restart the watcher.** VERDICT was OK; §3a forbids restarting a healthy process.
