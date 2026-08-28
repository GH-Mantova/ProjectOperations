# Station 00 — Supervisor | 2026-08-28T04:08Z–04:20Z

**BLIND RUN (no Desktop Commander). Report-only. Nothing was armed, merged, dispatched or committed.**

The headline is not a board fact. It is a retraction: **Station 06 caught this station reporting two
findings and one self-check that it did not have the evidence for, and 06 is right.** The RULE-2
breach count drops from twelve to ten, and breaches 1–10 are now unverified in *both* directions
because the method that produced them cannot tell Marco from an agent.

---

## GROUND

1. **Reach the box: FAILED.** Desktop Commander registered **zero tools** this session. Three
   ToolSearch attempts (`select:` by exact name; `desktop-commander … powershell`; `execute command
   read file …`) all returned no DC tool. Per PREFLIGHT step 1 this is a STOP for every acting verb.
2. **Binding documents: READ** from the local checkout via the workspace mount —
   `docs/pipeline/stations/00-supervisor.md`, and the pipeline scripts named below.
3. **Version parity: OK.** Bootstrap `station_doc_version: 1` == station doc `station_doc_version: 1`
   (`00-supervisor.md:3`). No mismatch, so this run is not read-only *for that reason* — it is
   read-only because there is no shell.
4. **Lane:** ARM / DISPATCH / MERGE. **All three were unavailable this run** — see WHAT I DID NOT DO.

**This was a blind run, not a quiet one.** A healthy quiet board and a blind station produce the same
"no news". I could still read the dev tree and the clone over the workspace mount, so this run is
*partially* sighted: file reads are real, `git` and process liveness were impossible.

---

## WHAT I MEASURED

| # | Claim | Tag | Evidence |
|---|---|---|---|
| 1 | Desktop Commander absent | [MEASURED] | 3 × ToolSearch, zero DC tools returned |
| 2 | Workspace mount alive | [MEASURED] | `ls /mnt/ProjectOperations2/docs/pipeline/stations/` → 6 station docs + `_canonical-blocks.json` |
| 3 | `origin/main` HEAD = `e8dd43f1` "…baseline 26, ratchet CI (#1362)", authored 02:45:59Z | [MEASURED] | `list_commits sha=main perPage=3` |
| 4 | main is **GREEN** | [MEASURED] | `#1362 get_check_runs` → 13 runs, **13 success, 0 failure** (read per-commit, never `status-sweep.ps1`) |
| 5 | **ONE open PR: #1363** `docs(pr-prompts): no-drift guard prompt + Station 06 correction breadcrumb`, opened 04:03:57Z | [MEASURED] | `list_pull_requests state=open` |
| 6 | #1363 checks: 8 success / 5 skipped / **0 failure** | [MEASURED] | `#1363 get_check_runs` |
| 7 | **Watcher ALIVE and mid-job** | [MEASURED] | clone heartbeat `…/po-watcher/ProjectOperations/scripts/pr-watcher/heartbeat.log` tail = `[2026-08-28T04:12:53Z] rev-1363-ready.md elapsed=240s`; now 04:13:41Z ⇒ **48 s gap** |
| 8 | ARMED = **1 → 0 during this run.** It was a **review job, not a slice** | [MEASURED] | 04:09Z: depth-1 `*-ready.md` = `rev-1363-ready.md` only. **Re-measured 04:16Z: ARMED = 0** — consumed at 04:14:15Z. `rev-<n>-ready.md` are review jobs by convention. *The queue is empty.* |
| 8b | #1363 review verdict = **REJECT-AND-REDO (BLOCK-class)** | [MEASURED] | `processed/rev-1363-ready.md.log`: Exit 0, ended 04:14:15Z — "CI fails because the Station 06 breadcrumb … is missing the five required sections … enforced by `check-breadcrumb.mjs`". Escalation stub written to `docs/pr-prompts/needs-marco/pr-1363-review-block.md` |
| 8c | #1363 is **NOT** watcher-routed to Marco | [MEASURED] | `grep -c '"marco":true' processed/rev-1363-ready.md.log` = **0**. It is blocked on its own merits, not by RULE 2 |
| 8d | **This breadcrumb ADMITs** | [MEASURED] | `node scripts/pipeline/check-breadcrumb.mjs` → `ADMIT 00-00-supervisor-2026-08-28-0408-…`, plus the correct `NOTE … is UNTRACKED`. Overall exit 1 (9 pre-existing malformed, composition unchanged) |
| 9 | `sot-refs-s1` arming (`00921aff`) is **CONSUMED** | [INFERRED] | its `-ready.md` is gone from depth 1 and #1362 (its deliverable) merged at 02:45:59Z |
| 10 | HOLD inventory = **56** at depth 1 | [MEASURED] | `find -maxdepth 1 -name 'pr-*HOLD*.md' \| wc -l` |
| 11 | **Baseline carries 26 entries, not 28** | [MEASURED] | `get_file_contents docs/qa/sot-refs-baseline.json@main` — counted 26; zero match `*-ready.md` |
| 12 | **`docs/qa/` is NOT gitignored** — second independent instrument | [MEASURED] | `docs/qa/sot-refs-baseline.json` is a **tracked file on `origin/main`** |
| 13 | **The dev tree is STALE** | [MEASURED] | `docs/qa/sot-refs-baseline.json` absent locally; `grep -c sot-refs .github/workflows/ci.yml` = **0**; `grep -c FILE_GATE_NOT_RELEASED scripts/pipeline/lint-prompt.mjs` = **0**. `lint-prompt.mjs` mtime 2026-08-27 00:11Z (>28 h old) |
| 14 | Claim 13's zeros are real, not a dead instrument | [MEASURED] | **CONTROL:** same file, same grep — `jobs:` = 1, `check-breadcrumb` = 1. The instrument fires |
| 15 | **`lint-prompt.mjs` has NO breadcrumb exemption** | [MEASURED] | `NO_FRONT_MATTER` at `lint-prompt.mjs:1005`; grep for `00-0`/`breadcrumb` path-class → **zero hits** |
| 16 | 06's `auto_merge` evidence for #1361 | **[CANNOT MEASURE]** | The GitHub **MCP wrapper does not expose an `auto_merge` field at all** — `pull_request_read get` returned no such key. Absent ≠ empty. I can neither confirm nor refute it with my tools |

**Instrument corrections earned this run**

- 🔧 The clone heartbeat is at **`scripts/pr-watcher/heartbeat.log`**, *not* `scripts/pipeline/pr-watcher/`.
  My remembered path was wrong and returned "No such file".
- 🔧 **An unbounded `find` over the `po-watcher` mount times out at 120 s.** Time-box it and cap
  `-maxdepth` (depth 4 succeeded in seconds).
- 🔧 **The GitHub MCP `pull_request_read get` silently omits `auto_merge`.** Any RULE-2 reasoning that
  needs that field cannot be done through this connector — it needs `gh api`, i.e. the box.
- 🔴 **A bare `marco` grep on a processed log is a FALSE POSITIVE MACHINE.** On
  `rev-1363-ready.md.log` it "hit" — but the match was the *path* `needs-marco/pr-1363-review-block.md`,
  while `"marco":true` returns **0**. Every BLOCK-class verdict writes a `needs-marco/` stub, so the
  bare grep fires on exactly the population where the answer matters most. **Probe `"marco":true`
  with the quotes, always.** This is very likely a contributor to the inflated breach count in F1.
- 🔧 **`check-breadcrumb.mjs`, not `lint-prompt.mjs`, is the instrument for breadcrumbs** — and it
  ADMITs this one (measurement 8d). See F3: the error was citing the *wrong checker*, not the absence
  of any check.

---

## WHAT CHANGED

**Nothing.** No arm, no disarm, no merge, no label, no dispatch, no commit, no push. The only
filesystem mutation is this breadcrumb.

⚠️ **This breadcrumb lands UNTRACKED.** Staging it needs `git`, and `git` over the device bridge
against the Windows `.git` is an absolute hard stop (0-byte `index.lock`, no owning process, freezes
every station). **Next sighted 00: `git add` this path before arming anything** — an untracked
breadcrumb blocks arming in this lane.

---

## FINDINGS

### F1. 🔴🔴 I retract RULE-2 breaches 11 and 12. My counting method cannot support any of the twelve.

Station 06 (`00-06-pr-master-2026-08-28-0300-corrections-to-00-supervisor-0208.md`) states that #1353
was merged by Marco directly and #1361 by an auto-merge **Marco himself armed** — and that Marco said
so in session at the time.

I could not verify the `auto_merge` record myself (measurement 16 — the MCP connector has no such
field). But I am not entitled to hold the finding on that basis, because **the finding never had
positive evidence either.** My 02:08Z run reasoned "the timeline carries only `merged`+`closed`,
therefore no auto-merge was pre-armed" — that is an argument from an **absent** result on a paginated
endpoint, and 06 has shown a second instrument on the same PR disagreeing. *An empty result is not an
empty world.* Combined with direct human testimony from the person the rule exists to protect, the
correct verdict is: **breaches 11 and 12 are withdrawn. Count = 10.**

The damaging part is 06's finding 2, and it is correct. My own run wrote that `mergedBy=GH-Mantova`
identifies nothing — and then counted breaches with exactly that signal plus the timeline read now
shown to be incomplete. **Breaches 1–10 were produced by that method and are unverified in both
directions.** Some may be real; some may be Marco doing his job. I should not have escalated a rising
count built on a signal I had already documented as blind.

*What would have made me wrong?* If #1361's PR object had carried no `auto_merge` and Marco had not
claimed the merge — neither holds.

**DISPOSITION: ACTIONED** (count corrected 12 → 10; findings 11 and 12 withdrawn) **+ ESCALATED** —
breaches 1–10 need re-deriving against a signal that distinguishes human from agent. **No such signal
exists today.** Until one does, this station should stop reporting a breach count at all.

### F2. 🔴🔴 The dev tree is STALE, and every station lints against it.

`origin/main` has `check-sot-refs` wired into `ci.yml`, the 26-entry baseline, and the guard's
`FILE_GATE_NOT_RELEASED`. **The dev tree at `C:\ProjectOperations2` has none of the three** — with a
passing control proving the greps fire (measurements 13, 14).

The consequence is 04's, confirmed here by a second route: **every ADMIT read out of the dev tree is
unproven**, including HOLDs that drop DB tables (`rates-s11c-drop-legacy-tables`) and touch prod data
(`tenant-mt4-s2-ownership-migration`). A merged instrument fix is inert until the tree receives it.

The cure is a fast-forward of the dev tree with the watcher stopped — **which is exactly the operation
this run cannot perform.** This is the ONE thing most blocking progress right now (Q6).

**DISPOSITION: ESCALATED** — first act of the next sighted 00, before any arming decision.

### F3. 🔴 No breadcrumb can pass `lint-prompt.mjs`. My last run cited the wrong instrument.

`lint-prompt.mjs` treats every file under `docs/pr-prompts/` as a prompt and requires YAML
front-matter; there is no path-class exemption for `00-*` (measurement 15). Breadcrumbs have no
front-matter by convention, so **every breadcrumb REJECTs with `[NO_FRONT_MATTER]`** — including this
one. My 02:08Z run's "breadcrumb written and ADMIT-clean" was therefore a pass I never received.

**Refinement earned this run:** breadcrumbs *do* have a real checker — **`check-breadcrumb.mjs`** —
and I ran it against this file, which **ADMITs** (measurement 8d). So the defect is narrower and more
embarrassing than "no check exists": the station quoted the wrong instrument and never noticed,
because it never ran either one. The rule going forward is simply: **breadcrumbs are validated by
`check-breadcrumb.mjs`, and the claim is only made after the command is run.**

06 is right that this matters more than the correction itself: the station whose job is catching
lying instruments published an unverified pass about itself.

**DISPOSITION: ACTIONED in part** (this run states its checker and shows the command) **+ ESCALATED**
for the durable fix. RULE 1 framing, complete-and-additive first:

- **(A) Make the report contract name `check-breadcrumb.mjs` explicitly, and give `lint-prompt.mjs` a
  path-class that SKIPS `00-*.md` with a "not a prompt — see check-breadcrumb" message.** *Solves it
  now and in future; purely additive — it removes no check and breadcrumbs keep their real validator.*
  **Satisfies both halves of RULE 1. This is the recommendation.**
- **(B) Documentation only — just stop citing `lint-prompt` for breadcrumbs.** Honest and zero-risk,
  but the next station hits the same confusing REJECT and re-learns it by hand: fails the "future"
  half.
- **(C) Give breadcrumbs YAML front-matter so `lint-prompt` passes them.** Makes the original claim
  true, but bends the prompt schema around documents that are not prompts and risks a breadcrumb
  entering the arming queue — **fails the "without damaging future data entry" half. Do not choose
  this.**

### F4. 🟢 The withdrawn-decision consequence is CLOSED. Do not re-litigate it.

My 02:08Z run's sharpest finding — `origin/main` emitting a `::warning::` where a blocking gate should
be — **ended at 02:45:59Z** when #1362 merged (measurement 3). It deletes the non-blocking wrapper,
restores `check-sot-refs` to blocking, and adds a ratchet that permits removals and rejects additions.
The green-main window ran 01:01Z → 02:46Z and is over. Baseline is **26**, not 28 (measurement 11);
the two `*-ready.md` citations were excluded as a path **class**, which is the right call — armed
prompts are consumed by design and would regrow the list every time the queue drains.

The *process* failure 06 names (reversing a recorded decision without reading this station's open
findings) is real and 06 has taken it. Nothing further from me.

**DISPOSITION: ACTIONED — closed.**

### F5. 🟢 `docs/qa/` is NOT gitignored — now confirmed by a second, independent instrument.

`docs/qa/sot-refs-baseline.json` is **tracked on `origin/main`** and CI ran a ratchet against it. The
directory-wide claim in DOCTRINE, `00-supervisor.md` §1b, `STATION-CAPABILITIES` §7 and the report
contract is wrong; `.gitignore` names five files, not the folder. The six-doc correction shipment
(plus re-recording the `lint-station.mjs` hash) stands, and `check-breadcrumb.mjs`'s ±200-char
`gitignor` proximity rule still enforces an exclusion that does not exist.

⚠️ Note the contradiction now sitting in my own instructions: the bootstrap tells me to avoid
`docs/qa/` "gitignored at `.gitignore:107`" — that line is false.

**DISPOSITION: DEFERRED to the next sighted 00** — needs one prompt written and one arm slot.

### F6. 🔴 #1363 must NOT be merged — the verdict landed mid-run: REJECT-AND-REDO (BLOCK).

The review completed at 04:14:15Z while I was writing (measurements 8, 8b). Verdict:
**REJECT-AND-REDO, BLOCK-class** — CI fails because 06's correction breadcrumb uses a narrative
section structure and is missing the five required sections that `check-breadcrumb.mjs` enforces.
An escalation stub is at `docs/pr-prompts/needs-marco/pr-1363-review-block.md`.

The `"marco":true` probe on `processed/rev-1363-ready.md.log` returns **0** — #1363 is *not*
watcher-routed to Marco. It is blocked on its own merits, so RULE 2 is not what stops it. **Green
checks did not save it**, which is the whole argument for never merging on colour alone.

There is a plain irony worth naming rather than enjoying: 06's breadcrumb correctly caught this
station claiming an unearned check, and was itself rejected for failing the breadcrumb contract.
Both corrections are right. **The HOLD prompt in #1363 is well-formed and could ship separately.**

**DISPOSITION: ESCALATED** (stub already filed) — the fix is 06 re-cutting its breadcrumb into the
five-section order. I did not merge, and could not have.

### F7. 🟠 Two instruments disagree about 06's breadcrumb. Unresolved — do not pick a side yet.

The **dev-tree** `check-breadcrumb.mjs` gives `00-06-pr-master-2026-08-28-0300-…` an **ADMIT**
(line 108 of its output, 72 checked / 9 malformed / 7 skipped — and 06's file is not among the 9).
The **CI** run of what should be the same checker **rejected it** for missing sections (measurement 8b).

Reading the file, CI is substantively right — it uses `## 1.`, `## 2.` narrative headings, not the
five required. So the likely cause is **F2, the stale dev tree**: stations are linting against a
checker that is not the one CI runs. That is a hypothesis, not a measurement.

*What would settle it:* diff `scripts/pipeline/check-breadcrumb.mjs` between the dev tree and
`origin/main`, then re-run both against that one file. Per 06's own instrument note, disagreement
between two instruments is **unresolved**, not evidence for either.

**DISPOSITION: DEFERRED to the next sighted 00** — and it is a second concrete cost of F2, which
raises the priority of the fast-forward.

### F8. 🟠 `pr-crm-s2-nav-three-items-tabs` — the merge lane has no PR-existence check.

06 reports the earlier run consumed the prompt without shipping: the watcher logged `opened PR #1251`
and filed it to `processed/`, but #1251 is from 2026-08-19, unrelated, and merged nine days earlier —
while the agent's own output said it opened nothing. The review lane's equivalent defect was fixed by
the guard cluster; **the merge lane's is unfixed.** 04 independently restored the prompt as `-HOLD`.

**DISPOSITION: DEFERRED** — worth a slice ("merge lane asserts the PR it claims to have opened
actually exists and is newer than the prompt"). Needs a prompt written. Note the `git add` on that
path before `git mv` (stale staged `RD` rename).

---

## WHAT I DID NOT DO

- **Did not arm.** Arming is a `git mv` rename of a tracked `-HOLD.md`; `git` was unreachable. The
  next-arm order is unchanged and is carried forward, not lost: the `docs/qa/`-is-not-gitignored doc
  fix · re-arm `crm-s2-nav-three-items-tabs` · `crm-wincount-s3-recompute` and
  `e2e-container-s2-swap-required-job` (both `escalates:true`) · `queue-armed-tracked-detector` ·
  untracked `rates-11b2-resolver-isactive-surface` (`git add` first). **Not** `dns-s5-checker-flip-to-fail`
  — its premise is Marco triaging #1361's 36 warn findings, which has not happened.
- **Did not merge #1363** — review in flight, `marco:true` probe unrunnable, and both merge paths are
  closed to me anyway (`gh` needs the box; the GitHub MCP token 403s on merge).
- **Did not fast-forward the dev tree** (F2) — the fix for the run's biggest blocker is itself a `git`
  operation.
- **Did not run any `git` command over the device bridge** — hard stop, and the stale-`index.lock`
  failure mode is silent under reads.
- **Did not re-run the §3b ENSURE-UP sweep** — retired in practice; `PO Watcher Keepalive` is the real
  restarter and the watcher is demonstrably alive (measurement 7).
- **Did not re-open the time-bomb sweep** (class closed, second sweep already refuted) or the
  `LC_COLLATE` comparison (deferred, needs the box).
- **Did not claim a lint result for this breadcrumb** — per F3, it cannot pass, and this run is not
  going to repeat the error it is retracting.

---

## FOR MARCO — three things, shortest first

1. **Stop trusting my RULE-2 breach count.** It is 10, not 12, and even 1–10 are unverified. Two of
   the twelve were you doing exactly what the rule asks. I will not report a count again until there
   is a signal that tells you apart from an agent.
2. **The dev tree is behind `origin/main` and every station lints against it.** Until it is
   fast-forwarded, any ADMIT verdict — including on prompts that drop tables or touch prod data — is
   unproven. This needs a shell.
3. **Pick an option for F3** (breadcrumbs cannot lint). (A) is the complete-and-additive one.

**And the configuration fact:** this station is cloud-fired and **structurally cannot reach the
Windows box**. That is not something I can work around from here — it is why this run, and the 18:08Z
one before it, could only report. Roughly a quarter of recent runs have been blind.
