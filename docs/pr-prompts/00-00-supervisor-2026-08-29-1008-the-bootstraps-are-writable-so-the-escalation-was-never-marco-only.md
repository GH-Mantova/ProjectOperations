# Station 00 — Supervisor | 2026-08-29T10:08Z–2026-08-29T10:2xZ

## GROUND

```
UTC            2026-08-29T10:08:52Z
origin/main    d2a0ad4a            (fetched, then rev-parse)
dev tree       main @ 1501d09c     C:\ProjectOperations2   (3 behind — never committed from)
doc version    1                   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (C:\Users\Marco\Claude\Scheduled\00-supervisor\SKILL.md)
```

Versions AGREE — this run was not read-only. **SIGHTED**: Desktop Commander present,
`start_process powershell.exe` returned pid 29464 on the first call.

## WHAT I MEASURED

- **[MEASURED] `origin/main` has not moved since my 08:08Z run.** `git rev-parse --short origin/main`
  → `d2a0ad4a` (#1390, merged 08:28:35Z). No PR merged in the intervening two hours.
- **[MEASURED] Board empty, queue frozen, verdict SAFE.** `status-sweep.ps1` @10:10:01Z:
  OPEN PRs **0** · armed `*-ready.md` **0** (control: `*-HOLD.md` = **84**) · needs-marco 14 ·
  no-pr-opened 107 · failed 41 · in-progress prompts 0 · `index.lock` interactive/clone False/False ·
  git processes 0 · trunk **green** (3/3 recent main runs success) · **VERDICT: SAFE TO ACT**.
- **[MEASURED] Newest `failed/` entry is still 2026-08-28T21:03Z** — byte-identical for a fifth
  consecutive run. The queue has not moved in 13 hours. Every one of the six newest entries reads
  `API Error: 401 OAuth access token has expired.`
- **[MEASURED] The OAuth token is still dead, and nothing is refreshing it.** Read at source from
  `%USERPROFILE%\.claude\.credentials.json`: `expiresAt` = **2026-08-28T16:13:35.984Z**,
  file mtime = **2026-08-28T16:13:26.909Z**. Both **unmoved across six consecutive runs**, now
  **18.0 h** stale against `nowUTC` 2026-08-29T10:10:32Z.
- **[MEASURED] Staged half-arm: NONE.** `git diff --cached --name-status` in the shared dev tree
  returned empty before and after everything I did.
- **[MEASURED] Watcher alive, pid 26364**, wrapper alive, heartbeat 1077 min (stale + empty queue =
  idle, not wedged). Clone `branch=main dirty=35`. 4 orphaned worktrees — all previously measured
  LOCAL-ONLY, unchanged.
- **[MEASURED] `check-breadcrumb.mjs` — the fix from #1390 works.** The dev-tree copy is **9299**
  bytes and the `origin/main` copy is **10715**, so the dev tree still runs the OLD script; I
  extracted the main copy with `git show origin/main:scripts/pipeline/check-breadcrumb.mjs` (node raw
  Buffer, never a PS pipe) and ran that. Result: **93 checked, 0 malformed, 7 skipped as
  pre-contract, CLEAN, exit 0**, and freshness `00 ok · 03 ok · 04 ok · 05 ok`, **no station SILENT**.
  The false `SILENT` it reported against station 00 two runs ago is gone.
- **[MEASURED] Zero orphaned breadcrumbs.** `git ls-tree -r --name-only origin/main -- docs/pr-prompts`
  carries all seven 2026-08-29 breadcrumbs including my own **0608** and **0808**. Nothing to sweep up
  this run.
- **[MEASURED] All five scheduled-task bootstraps still carry BOTH refuted claims, at identical line
  numbers.** `node probe-bootstraps.mjs` over `C:\Users\Marco\Claude\Scheduled\<s>\SKILL.md` for
  `00-supervisor` (5340 B), `02-board-driver` (5337), `03-machine-minder` (5315), `04-scanner` (5276),
  `05-sot-keeper` (5251) — every one LF, zero `U+FFFD`, byte-frozen since 2026-08-24T22:54:22Z:
  - **L25** — *"If this station appears in the scheduled-task listing, it is cloud-fired and
    structurally cannot reach the box."*
  - **L84** — *"Never `docs/qa/` - gitignored at `.gitignore:107`…"*
- **[MEASURED] Claim A was false about THIS RUN, and I can prove it from my own prompt.** My opening
  turn inlines `00-supervisor\SKILL.md` verbatim; station 00 **is** in the scheduled-task listing; and
  `start_process` reached the box on the first call. The instruction that governs step 1 of every
  scheduled run is not merely stale — it is contradicted by the run it was governing.
- **[MEASURED] The repo layer is fully corrected — I nearly filed a false finding to the contrary.**
  Reading `docs/pipeline/STATION-CAPABILITIES.md` from the **dev tree** showed §2 still carrying the
  refuted diagnostic. Re-read from `origin/main`: line 58 reads *"That is REFUTED, in both
  directions"* with the measurements. The dev-tree copy was simply 3 commits behind. **Do not assert
  anything about `main` from the dev tree** (04's 0408 lesson, applied to myself).
- **[MEASURED] The five bootstraps are WRITABLE.** `Get-ChildItem … | Select IsReadOnly` → **False**
  on all five, and Desktop Commander's `allowedDirectories` is `[]` (unrestricted — STATION-CAPABILITIES §3,
  which already records that it reads `C:\Users` and the Scheduled folder).
- **[MEASURED] Positive control on the fix, per DOCTRINE §7 guard 1.**
  `node C:\po-sup-fix-scripts\fix-station-bootstraps.mjs --dry` → all five anchors matched,
  `changed=0 already-clean=0 not-touched=0`, exit **0**, nothing written. The instrument is proven
  able to succeed before anyone believes a failure from it.

## WHAT CHANGED

- **Nothing on the board.** No arm, no disarm, no merge, no label, no queue file moved.
- **Nothing in `C:\Users\Marco\Claude\Scheduled\`.** Read and dry-run only.
- **Authored, outside the repo, in the sanctioned scratch dir:**
  `C:\po-sup-fix-scripts\fix-station-bootstraps.mjs` — the one-command correction for Marco
  (backs each file up to `SKILL.md.bak-<UTC>` before writing, exact-anchor with an ANCHOR-NOT-FOUND
  guard that leaves a non-matching file untouched, idempotent, node raw UTF-8 so no BOM and LF is
  preserved, and a read-back that prints old/new occurrence counts per file). Plus two read-only
  probes, `probe-bootstraps.mjs` and `probe-diagnostic.mjs`.
- **This breadcrumb**, written before its PR was opened so the PR sweeps it up.

## FINDINGS

### F1 — The OAuth token is dead for the 18th hour and nothing is refreshing it. The board is correctly frozen, not healthy and not stalled.

`expiresAt` 2026-08-28T16:13:35.984Z and mtime 16:13:26.909Z are **unmoved across six runs**. Every
recent `failed/` entry is a 401. The execution lane cannot run a prompt, so **ARM NOTHING** — arming
into a dead lane burns the prompt, which is exactly how `pr-crm-s3-account-on-client-create` and
`rev-1386` were destroyed at 21:03Z/20:52Z. Stillness here is a correctly-held brake.

Only Marco can re-authenticate (hard stop: production auth / credentials). **This is the single most
important thing blocking progress, and it is the same one I reported at 08:08Z, 06:08Z, 04:08Z,
02:08Z and 2026-08-28T22:09Z.**

**DISPOSITION: ESCALATED** — see the question in F2's companion; the re-auth itself is unchanged and
already in front of Marco.

### F2 — The "no agent may edit the bootstraps" premise is FALSE. That escalation has been waiting on Marco for a constraint that does not exist.

Station 04 dispatched the five stale bootstraps to Marco (0610Z, and again at 1410Z on 08-28) on the
stated ground that they are *"the governing layer, no agent may edit it."* **Measured: all five are
`IsReadOnly=False` and Desktop Commander is unrestricted.** The barrier is not capability. The only
thing in writing is `STATION-CAPABILITIES.md` §1, which names Marco as who changes that layer *in
practice* and calls the repo doc *"the only layer an agent can change"* — a **capability claim that my
measurement refutes**, not a permission rule.

This matters more than a tidy-up, because **claim A sits in STEP 1 of the bootstrap and therefore
executes BEFORE any repo document is read.** No repo edit can ever neutralise it. #1389 and #1383
corrected every layer that *can* be corrected from the repo; the last stale layer is structurally
out of reach of the mechanism the pipeline has been using.

I did **not** edit them. Editing the instruction layer of all five stations, inside Marco's personal
config directory, on the strength of my own reading, is the shape of LL-38 — and Marco's RULE 3 says
his call goes to him. What I did instead is remove every reason for it to keep waiting: the fix is
one command, backed up, idempotent, self-verifying, and dry-run-proven.

**The question is now one word, and it is not "please transcribe ten edits":**

> **May Station 00 run `node C:\po-sup-fix-scripts\fix-station-bootstraps.mjs` itself?**

**RULE 1 options** — *"solves the issue completely (immediately and future) without damaging existing
and/or future data entry."*

- **(C) — passes BOTH halves. Recommended.** Marco answers **"yes, 00 may edit the five
  `Scheduled\*\SKILL.md` bootstraps to match ratified repo text"**, and that standing grant is
  recorded in `STATION-CAPABILITIES.md` §1 (which is mine to PR). 00 then runs the script this cycle.
  *Complete now* — the two false claims die today. *Complete in future* — the layer stops being
  structurally unreachable, so the next divergence is fixable by the station that finds it instead of
  queueing behind a human paste. *Additive* — text-only, backed up, reversible by one file copy, and
  it touches no data-entry path whatsoever.
- **(A) — Marco runs the one command himself.** `node C:\po-sup-fix-scripts\fix-station-bootstraps.mjs`.
  **Passes the "immediately" half; FAILS "future"** — the layer stays unreachable, so the next stale
  claim waits on him again, and this one has already waited three days across four dispatches.
- **(B) — leave it; keep correcting only the repo.** **FAILS BOTH halves.** Claim A executes before
  the repo doc is read, so it is untouchable from the repo by construction; and it will keep telling
  every scheduled station that a listing entry means structural blindness, which is measurably wrong
  in both directions.

**DISPOSITION: ESCALATED** — one question, three options, complete-and-additive first. Marco.

### F3 — `check-breadcrumb.mjs` is genuinely fixed; the collector channel is clean end to end.

93 breadcrumbs checked, 0 malformed, freshness clean for 00/03/04/05, exit 0 — and every
2026-08-29 breadcrumb including my own 0608 and 0808 is on `origin/main`. The three lies (false
`UNTRACKED`, false `ok`, false `SILENT`) are dead in one place, and the run that landed them (#1390)
read back green. Nothing to re-dispatch.

**DISPOSITION: ACTIONED** — verified by running the `origin/main` copy of the validator and by
`git ls-tree -r origin/main`. The **dev tree still runs the 9299-byte old copy** until it
fast-forwards, so a `--freshness SILENT` from `C:\ProjectOperations2` is the stale script, not a defect.

### F4 — I read a repo doc from the dev tree and was one sentence away from filing a false finding.

`STATION-CAPABILITIES.md` §2 in the dev tree still carries the refuted diagnostic. On `origin/main`
it is corrected. The dev tree is 3 commits behind (`1501d09c` vs `d2a0ad4a`). This is 04's own 0408
lesson — *prove a file's last toucher is an ancestor of the tree HEAD before asserting anything about
`main` from the dev tree* — and I re-derived it the hard way one run later.

**DISPOSITION: ACTIONED** — caught before it left this run, by re-reading from `origin/main`.
Standing correction for every station: **read repo docs with `git show origin/main:<path>`, not from
`C:\ProjectOperations2`, whenever the claim is about `main`.**

### F5 — 03's clone fast-forward is still unowned, and still nobody may do it.

Unchanged and re-confirmed by this run's sweep: clone `branch=main dirty=35`, and the earlier
measurement stands that it is **behind, not diverged** (`rev-list --left-right` = `11 0`,
`merge-base --is-ancestor` exit 0, incoming ∩ dirty = 0, so `--ff-only` would succeed). 00 is barred
absolutely from git in the watcher repo; 03 is report-only. Because a restart adopts nothing, the
guards merged in #1358/#1360 stay **inert** until someone fast-forwards it.

**DISPOSITION: ESCALATED** — unchanged, already in front of Marco; the RULE-1 options are in
`00-00-supervisor-2026-08-29-0208-*.md`. Not re-litigated here.

### F6 — The four `sot/`-adjacent files still show ` M` in the shared dev tree.

`sot/03`, `sot/06`, `docs/qa/sot-refs-baseline.json`, `docs/data-model/metadata-catalog.json`.
A ` M` in a tree shared between concurrent chats is not evidence that anything changed.

**DISPOSITION: DISPATCHED** — to Station 05 (already open from prior runs; not re-dispatched, not
re-raised as new).

## WHAT I DID NOT DO

- **Armed nothing.** The OAuth block stands (F1); armed count stayed 0 → 0. `pr-lint-not-a-prompt-HOLD`
  and every other ADMIT prompt stays unarmed regardless of its gate state.
- **Merged nothing but this breadcrumb's own PR.** OPEN PRs were 0 at sweep time; there was nothing
  to drive.
- **Did not edit `C:\Users\Marco\Claude\Scheduled\*\SKILL.md`** — F2 is his call, and I ran the fix
  `--dry` only.
- **Did not touch the watcher clone**, its git, its 51 stashes, or its 35 ` D` paths; and did not run
  `status-sweep.ps1` §3b ENSURE-UP, which counts launchers rather than wrappers and would start a
  fourth launcher.
- **Did not commit from the shared dev tree.** All repo writes happened in a disposable worktree off
  `origin/main` at `C:\po-wt-00-1008`, torn down after the merge.
- **Did not re-raise** the CP-26 ruleset question, `pr-devtree-sync-ff-only-guard-HOLD` ratification,
  the sot-refs 23-vs-26-vs-28 mismatch, the allocation cascade, or the two invisible armable prompts.
  All open, none new.
- **Did not touch `/sot/`**, production data, or anything Azure / Entra / SharePoint.

---

**This breadcrumb is written BEFORE its PR is opened, so that PR sweeps it up.** Nothing else is
awaiting a sweep this run.
