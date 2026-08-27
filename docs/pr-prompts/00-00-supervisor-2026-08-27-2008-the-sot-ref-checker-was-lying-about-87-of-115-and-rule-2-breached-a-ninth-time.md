# Station 00 — Supervisor | 2026-08-27T20:08Z–2026-08-27T20:32Z

## GROUND

```
UTC            2026-08-27T20:08:46Z
origin/main    24eef5ba            (fetched with the explicit refspec, then rev-parse)
dev tree       main @ 5560fc24     C:\ProjectOperations2   (6 behind / 5 ahead of origin/main)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. NOT blind — Desktop Commander reached the box on the first
attempt (PowerShell PID 28196). status-sweep verdict: **SAFE TO ACT** at 20:09:08Z.

## WHAT I MEASURED

- **[MEASURED]** Board: exactly ONE open PR. `gh pr list --state open --json number,title,headRefName,mergeStateStatus,isDraft,labels`
  returned only **#1353** (feat/sot-ref-checker-and-ci-wiring, UNSTABLE, labels `[]`).
- **[MEASURED]** Armed prompts: **0**. `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` → count 0.
- **[MEASURED]** Watcher: **ALIVE, pid 28328**, restart churn 0 in 20 min, verdict
  `OK - nothing armed and the watcher is alive` from the sanctioned script (never from `ps`).
- **[MEASURED]** RULE-2 probe over `docs/pr-prompts/processed/*.log` (1720 logs): the `"marco":true`
  marker is present in the logs for **both** #1356 (`pr-crm-lastmile-s1-unblank-todos-and-notes`)
  and **#1353** (`pr-lessons-folder-s3-ref-checker`). RULE 2 binds on both.
- **[MEASURED]** #1356 is **MERGED**, `mergedAt 2026-08-27T19:05:48Z`, merge commit `24eef5ba`.
  Its full issue timeline contains only `merged` and `closed`, both at 19:05:48Z by `GH-Mantova` —
  **no label was ever applied and no `auto_merge_enabled` event exists.** It was a direct merge.
- **[MEASURED]** #1353's only red is `Pipeline — watcher + linter tests`, and the job log's final
  line is `total=274  dangling=115  exempt=0`, exit 1. Every other check, including all four
  required ones (CodeQL, API, Web, tendering-e2e), is green.
- **[MEASURED]** Three sampled "dangling" refs resolve perfectly one directory deeper:
  `apps/api/src/modules/permissions/permissions.controller.ts`,
  `.../workers/workers.controller.ts`, `.../xero/xero.controller.ts` all `git cat-file -e` exit 0
  against origin/main; a deliberately fake control path exits 128. The source line in
  `sot/06-active-specs.md` reads ``### `modules/permissions/permissions.controller.ts` — guards: …``
  — an apps/api/src-relative path, by convention.
- **[MEASURED]** Classified all 115 against candidate roots in a clean worktree off the PR head:
  **68 resolve under apps/api/src, 17 under apps/api/src/modules, 2 under apps/web/src, 28 under
  none.** 87 of 115 (76%) were real files the checker could not see.
- **[MEASURED]** Freshness: `node scripts/pipeline/check-breadcrumb.mjs --freshness` exits 1 —
  9 malformed breadcrumbs (7 of them Station 06's), and it prints `03 … 21.2h ago (cadence 4h) SILENT`.
  **That SILENT line is FALSE.** origin/main's copy of the script reads `'03': 24`; the dev tree's
  copy at line 35 still reads `'03': 4`. At 24h cadence, 21.2h is inside the window.
- **[MEASURED]** The build clone `C:\po-watcher\ProjectOperations` is on `main` at `42a397bd`,
  **2 ahead / 6 behind** its own (stale) origin/main, no MERGE_HEAD, 41 stashes.
  Its two unique commits are a merge commit and `355dfdec docs(pr-reviews): verdict on pr-1339`.
- **[MEASURED, and it refutes a standing memory rule]** The blob for
  `docs/pr-reviews/pr-1339-review.md` is `ea058e94d7f538e1ab2b00a2c52ce667c06628c4` in the clone's
  `355dfdec` **and identical on origin/main**, where it landed in `44b5f3af` (#1340).
- **[MEASURED]** The dev tree's shared index holds two orphan `R100` staged renames, for
  `pr-crm-lastmile-s1-unblank-todos-and-notes` and `pr-guard-s1-verdict-file-list` — both prompts
  already consumed, both PRs (#1356, #1352) already merged.
- **[CANNOT MEASURE]** Which actor merged #1356. Every actor authenticates as `GH-Mantova`; there is
  no audit trail that distinguishes a station, a concurrent chat, or Marco.

## WHAT CHANGED

1. **Pushed a fix to #1353's branch** — `a57818e7..b771dc23` on `feat/sot-ref-checker-and-ci-wiring`,
   built and tested in a disposable worktree (`C:\po-worktrees\sotrefs-00-2008`), never in the dev
   tree and never in the clone. Two files, `+132 −4`, `--numstat` proportional to the intended
   change (no double-encoding blow-up). The sot-ref checker now resolves against an explicit ordered
   SEARCH_ROOTS list — repo root, apps/api/src, apps/api/src/modules, apps/web/src — first hit wins;
   every hit under a non-root prefix is counted and printed under
   `RESOLVED VIA A NON-ROOT SEARCH PATH`, so the search can widen but never silently; and the
   dangling list now names every root that was tried.
   **Read back:** `gh pr view 1353 --json headRefOid` → `b771dc232884d7d407c5c4d3ccbfa646268d942f`.
   **Effect, re-measured in the worktree: dangling 115 → 28**, with `VIA apps/api/src/ = 68`,
   `VIA apps/api/src/modules/ = 17`, `VIA apps/web/src/ = 2`.
2. **Two new tests, a positive and its negative control** — an api-relative reference resolves AND
   the widening is announced; a real file under a deliberately NON-declared root still FAILS and the
   tried roots are named, so SEARCH_ROOTS cannot rot into a blanket pass.
   9/9 in that file, **50/50 across the whole `scripts/pipeline/__tests__` suite**.
3. Nothing else. **No prompt was armed. No PR was merged. No `/sot/` file was touched.**

## FINDINGS

### F1 — RULE 2 was breached a NINTH time, 49 minutes after two stations independently recorded the gate

#1356 carried `"marco":true` in its processed log. Station 00 recorded it as Marco-gated at 18:16Z
and Station 04 recorded it independently at 18:10Z as "RULE 2, DO NOT MERGE". It merged at
**19:05:48Z** anyway, by a direct merge with no label ever applied and no auto-merge event.

The root cause found at 12:08Z still holds and is now the whole story: ruleset "Main" requires only
four status checks and the CP gate job is not one of them, so nothing mechanical stands between a
green PR and the merge button. **This breach adds one fact the earlier eight did not: recording the
gate loudly, twice, in two independent stations, did not prevent it.** The gate is documentary. Every
proposed cure so far has also been documentary.

Options for Marco, complete-and-additive first (RULE 1):

- **(A) Make the gate mechanical.** Add a required status check that fails whenever the PR's prompt
  log carries `"marco":true` and no explicit clearance exists, and add that check to the "Main"
  ruleset's required list. Solves it immediately (a bound PR physically cannot merge) and in future
  (every future routed PR is covered automatically), and damages no data entry — it blocks a merge,
  it writes nothing. **This is the only option that passes both halves.**
- (B) Make the existing CP gate job required. Cheaper, but fails the "completely" half: the routing
  path applies no label at all, so a label-reading gate is blind to roughly half the routed board.
- (C) Keep reporting breaches. Fails both halves — nine data points say it does not work.

**DISPOSITION: ESCALATED.**

### F2 — the sot-ref checker was reporting a healthy document as broken: 87 of 115 "dangling" refs were real files

This is DOCTRINE §7 exactly — a confident, coherent, WRONG verdict about a working system. `sot/`
writes source paths in three deliberate conventions (`sot/06-active-specs.md` relative to
apps/api/src, `sot/04-data-model.md` relative to apps/api/src/modules, plus a couple of web-relative
refs) and the resolver only ever tried the repo root.

Fixed and pushed (see WHAT CHANGED 1–2), with a positive control proving it can still pass and a
negative control proving it can still fail. **DISPOSITION: ACTIONED.**

### F3 — my own 14:08Z escalation on #1353 recommended the wrong thing, and I am withdrawing it

That escalation put "115 unresolved `sot/**` refs" to Marco and recommended **A: land the checker
non-blocking, clean the refs, then make it blocking.** That recommendation was reasoned off the
lying instrument. The real number of genuine dangling refs is **28**, not 115 — a bounded afternoon's
doc work, not a wall. Landing a gate non-blocking that reports 76% false positives would have
installed a check nobody would ever trust, which is the failure DOCTRINE §7 exists to prevent.

**The corrected recommendation: keep #1353 blocking, fix the 28.** No question is being put to Marco;
this is a correction to a question already asked. **DISPOSITION: ACTIONED (withdrawn and corrected).**

### F4 — 28 genuinely dangling references remain in `sot/`, and they are Station 05's lane

After the resolver fix, 28 refs resolve under none of the declared roots. They fall into three
groups: deleted or moved `docs/**` targets (about 14, e.g. an architecture overview, a module build
log, a continuation log, a data-model relationship map); paths that are relative to whichever module
the surrounding prose names, which are prose and not paths (e.g. a builders/ and a providers/ ref in
`sot/06-active-specs.md`); and references to queue files that are gitignored by design and can never
resolve in CI. The full 28-line list with file and line numbers is reproducible in one command:
run the sot-ref checker at the head of #1353.

Only Station 05 may edit `/sot/`. **#1353 cannot go green until these 28 are fixed or allowlisted
with reasons** — the allowlist marker is an inline comment ON the sot line, so even the allowlist
route is 05's. **DISPOSITION: DISPATCHED** — to Station 05 (SoT-keeper), next fire, with the caveat
recorded in F6 that a dispatch has no reader until that station runs.

### F5 — the build clone can now be fast-forwarded safely; the reason it could not is dead

The clone has been un-fast-forwardable because it carried `355dfdec`, recorded in project memory as
a commit that "exists NOWHERE ELSE — PRESERVE it; never `reset --hard` the clone." **That is now
false.** The file's blob is byte-identical on origin/main and landed there in #1340. The clone holds
nothing unique; its 2-ahead is that commit plus a merge commit.

The clone being 6 behind is why I did not arm anything (see WHAT I DID NOT DO). Fast-forwarding it
means stopping the watcher and discarding two commits in a shared tree — a destructive action on a
live system, which is a DOCTRINE §5.4 hard stop. The evidence that it is *safe* is above; the
authorisation is not mine. **DISPOSITION: ESCALATED** — one line from Marco ("FF the clone, nothing
unique is in it") clears it, or Station 03 does it under its own machine authority.

### F6 — the dev tree's FF lag makes every instrument fix inert, and it produced a false alarm this run

#1355 corrected Station 03's cadence from 4h to 24h and merged at 16:31Z. Four hours later the dev
tree's copy of the freshness checker still reads `4`, so it printed `03 … SILENT` for a station that
is comfortably inside its window. Stations read the dev tree; main is not what they execute.

This was already recorded at 18:16Z and has not moved, because closing the gap needs a git write in
a tree whose index is shared with other chats and which carries 5 local commits on `main` that can
never be pushed. Nobody owns it. **What would make it urgent: any instrument fix whose lying window
causes an actor to take a board action** — this run it only caused a false alarm I could refute.
**DISPOSITION: DEFERRED.**

### F7 — nine malformed breadcrumbs, seven of them Station 06's

`check-breadcrumb.mjs --freshness` exits 1 on nine breadcrumbs. Seven are Station 06's and share one
shape: no `# Station <NN>` heading and no disposition line in FINDINGS. One is Station 00's own blind
run at 1009Z, which failed all five sections — the bootstrap's blind path tells the agent to "write
one paragraph and end the run", which produces a report the linter rejects wholesale. Known,
unchanged, and not worth a board mutation this run. **DISPOSITION: DEFERRED.**

## WHAT I DID NOT DO

- **I did not merge #1353.** Its processed log carries `"marco":true`. RULE 2 binds regardless of
  colour, label, or my own opinion of the diff, and only Marco clears it — in chat, for that batch.
  It is also still red, correctly, on the 28 refs in F4.
- **I did not arm anything, deliberately.** Step 4 of the materialise sequence requires the clone
  fast-forwarded before the next arm, and the clone is 6 commits behind main (missing #1350, #1352,
  #1354, #1355, #1356). Arming now would build a slice against stale code. `NO-OP on arming: clone
  not FF'd — see F5.`
- **I did not touch the two orphan `R100` renames** staged in the dev tree's shared index. Both
  prompts are consumed and both PRs merged, so they are harmless residue; `git reset` there is the
  LL-38 collision and `git checkout` there resurrects dead prompts.
- **I did not fast-forward the clone or the dev tree**, for the reasons in F5 and F6.
- **I did not edit any file under `sot/`.** That is Station 05's exclusive lane, which is exactly why
  F4 is a dispatch and not a fix.
- **I did not re-ask the 14:08Z question about #1353.** I withdrew it instead (F3).
