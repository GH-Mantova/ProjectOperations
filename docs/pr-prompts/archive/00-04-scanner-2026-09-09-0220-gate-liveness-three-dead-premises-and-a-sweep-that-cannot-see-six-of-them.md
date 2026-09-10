# Station 04 — Scanner | 2026-09-09T02:05Z–2026-09-09T02:25Z

## GROUND

```
UTC            2026-09-09T02:05Z (start) / 02:25Z (end)
origin/main    f482d1a5   (GitHub API, refs/heads/main — NOT git rev-parse; see below)
dev tree       main @ 2279d2d9  C:\ProjectOperations2   (read from .git/refs/heads/main as a FILE)
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE. No read-only downgrade on that account.

🔴 **THIS RUN WAS BLIND.** `ToolSearch` for `desktop-commander` was run FIRST, three times, and the
server never arrived: it moved from "still connecting" to
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): connection timed out after 30000ms`.
The failure is therefore **after** a load attempt, not an unloaded schema — it is blindness, not an
`InputValidationError`. **No PowerShell ran on the Windows host this run.** Per
`STATION-CAPABILITIES.md` §3 ("No second transport", and the 🔴 correction beneath it) this run
COLLECTED through the mount and acted on nothing. This is the "I was blind, so I read everything
readable and acted on none of it" report, not the "I was blind, so I did nothing" one.

⚠️ **Consequences of blindness, stated before any claim below is read.** I could not run
`status-sweep.ps1`, `smoke-pr.ps1`, `restart-watcher-if-wedged.ps1`, or `arm-prompt.ps1`, so this
run claims **no liveness, smoke, safe-to-act or merge verdict**. I could not run `git`, so the four
prescribed freshness commands (`git rev-parse origin/main:<path>`, `git hash-object`,
`git diff --numstat`, `git show origin/main:<path>`) were all unavailable, and I did **not** read
my three binding documents via `git show origin/main:` as the PREFLIGHT requires — I read the
working copies and then proved two of them byte-identical to `main` by blob SHA (below).
`scripts/pipeline/vm-git-guard.sh` was **not installed**: the installer is `bash`, and its own
`-HOLD` prompt on this board records that it exits 1 when run with cwd under a mounted folder and
otherwise self-invokes 1017 times. Per the station doc a failed/skipped install is a FINDING, not a
STOP — recorded as such, and I ran no `git` against the mount in either case.

⚠️ **All eleven mounts were enumerated** (`BLIND_RUN_OTHER_MOUNTS_V1` in STATION-CAPABILITIES §3
told me to, and it is correct — see F1b). Every timestamp below is taken from log **CONTENT** or
from the GitHub API, never from a mount `stat`.

Sweep this run, from `node scripts/pipeline/next-sweep.mjs`: **gate-liveness** (rotation position 1
of 4; previous run 2026-09-08T22:10:46Z).

## WHAT I MEASURED

**[MEASURED] `origin/main` is f482d1a5; the dev tree's ref is one commit behind at 2279d2d9.**
GitHub API `list_commits(sha=main)` → `f482d1a5…` (#1822, 2026-09-08T23:55:03Z). The dev tree's
`.git/refs/heads/main` and `.git/refs/remotes/origin/main`, read as plain files, both hold
`2279d2d91ddd…` (#1821, 20:17:42Z). **`.git/packed-refs` still pins `origin/main` at `66194af6` —
permanently stale, as previously recorded; the loose ref wins and the packed one must never be
quoted.** I could not `fetch`, so the dev tree stays one commit behind for this whole run.

**[MEASURED] #1822's changed files do not intersect any premise or gate path.** `get_files` on
#1822 returns four paths, all under `apps/api/src/modules/admin-imports/` plus
`docs/decisions/merge-approvals/1822.md`. No premise or `requires_*` path in the queue touches
them, so the one-commit gap does not move any verdict below.

**[MEASURED] Board corpus: 38 prompt files on disk at depth 1, 42 on `origin/main`.**
`find docs/pr-prompts -maxdepth 1 -name 'pr-*.md'` → 38 (37 `-HOLD.md`, 1 `-LOOPING.md`,
**0 `-ready.md`**). GitHub `get_file_contents('docs/pr-prompts/')` at `refs/heads/main` → 42
`pr-*.md`. Symmetric difference is **8 files** (F2).

**[MEASURED] 38 premises executed; 36 ALIVE, 2 DEAD on the disk corpus.** Full table in F4.
A third DEAD premise lives only on `main` (F1b) and was invisible to the disk glob.

**[MEASURED] The two disk-corpus DEAD verdicts hold for `origin/main`, proved by blob identity —
two transports, one answer.** For each file I computed the git blob SHA-1 of the LF-normalised
working copy in node and compared it against the blob SHA GitHub reports for `refs/heads/main`:

| path | local lf-sha | main sha | identical |
|---|---|---|---|
| `scripts/pr-watcher/index.mjs` | `a40dd390…` | `a40dd390…` | YES |
| `sot/01-charter-and-architecture.md` | `07e52d77…` | `07e52d77…` | YES |
| `docs/pipeline/STATION-CAPABILITIES.md` | `69f57d4e…` | `69f57d4e…` | YES |
| `.claude/hooks/guard.mjs` | `c405b6e6…` | `c405b6e6…` | YES |

The raw (CRLF) SHA differs from the blob SHA on every one of them — e.g. `index.mjs` raw
`d18d7fa8…` vs blob `a40dd390…`. **Comparing the raw SHA would have read all four files as
divergent from `main`.** This is the same class of error DOCTRINE §9's piped-hash rule names,
arrived at from the other side.

**[MEASURED] All three `requires_merged` gates are released.** #1361 merged 2026-08-28T01:15:21Z,
#1317 merged 2026-08-25T21:50:28Z, #1111 merged 2026-08-14T01:56:06Z (`pull_request_read`,
`merged: true` on each).

**[MEASURED] The board is one open PR, and it is Marco's.** `list_pull_requests(state=open)` → a
single result: **#1823** *"feat(reporting): EA-GATE — key report self-filter to reporting.team
permission"*, head `feat/ea-gate-reporting-team-permission`, opened 2026-09-09T00:05:42Z, labelled
**`do-not-merge`**. Its prompt carries `escalates: true`. **I merged nothing and ran no RULE 2
probe, because I proposed no merge** — I am read-only on the board and this run reaches no merge
question.

**[MEASURED] The watcher was writing to disk during this run.** Newest line in the clone's daily
log, read as CONTENT: `[2026-09-09T02:20:11.820Z] [review] verdict-archive sweep: archived=0 kept=1
skipped=0 tracked=107`, against my own clock reading `2026-09-09T02:20:00Z`. POSITIVE control
`[merge]` → 23 lines; NEGATIVE control, a needle minted this run, → 0. ⚠️ **This is a QUOTATION, not
a liveness verdict** — that distinction is the one STATION-CAPABILITIES §3 draws, and a blind run
may only do the former.

**[MEASURED] The arming log explains five of the six main-only prompts.** `docs/pr-prompts/.arming-log.txt`,
last five entries, all `actor=station-00.cloud-lane-*`: `pr-brandtheme-s1` 09-08T07:11:06Z,
`pr-brandtheme-s0` 11:49:10Z, `pr-rates-consumers-s3` 12:03:40Z, `pr-tfm-s11` 12:29:41Z,
`pr-ea-gate-report-self-filter` 23:43:55Z. Each was armed, built, and its file removed from disk;
**each is still tracked on `main` as `-HOLD.md`** (F3).

**[MEASURED — instrument, not repo] Three of my own probes returned well-formed WRONG answers,
exit 0, nothing warning.** Recorded in F5 because DOCTRINE §7 says they will happen to me and §9.6
says an empty result is not an empty world.

**[CANNOT MEASURE] Whether the dev tree's working copy is dirty.** `git status` needs `git`. Where
it mattered I substituted blob identity against `main` (table above), which is strictly stronger
for those four files and says nothing about the rest.

**[CANNOT MEASURE] Whether any queue prompt is lint-clean.** `lint-prompt.mjs` shells out to
`git show origin/main:<path>` for every gate probe (`:613`), so I could not run it. **No prompt
below may be described as lint-clean on my authority, and I staged none.**

**[CANNOT MEASURE] The premises of five of the six main-only prompts** — I read two of the six from
`main` by API and evaluated them; the other four are inferred from the arming log and merge titles
and are tagged as inferences in F3.

## WHAT CHANGED

**On the board: nothing.** No merge, no arm, no label, no rename, no PR, no `sot/` edit, no
GitHub write of any kind. I am read-only on the board and this run was additionally blind.

**Two files written in the dev tree, both untracked, both for Station 00 to commit:**

1. **This breadcrumb**, at the tracked path
   `docs/pr-prompts/00-04-scanner-2026-09-09-0220-gate-liveness-three-dead-premises-and-a-sweep-that-cannot-see-six-of-them.md`.
   It is **untracked until a board PR commits it** — 00 sweeps it up. A breadcrumb filename matches
   no watcher glob, so leaving it in the queue root arms nothing.
2. **`docs/pipeline/sweep-rotation.json`**, advanced via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-09T02:05:00Z`. **LEFT DIRTY
   DELIBERATELY. Station 00 must commit it** — the authority matrix gives 04 no PR and no board
   mutation, and the dev tree is on `main`, which nobody commits to directly. If this file is not
   committed, the next run repeats gate-liveness and the rotation silently stops.

⚠️ `check-breadcrumb.mjs` was **NOT** run against this file — it is `node`, but I did not run it,
and per the station doc I therefore do **not** claim `breadcrumb-clean`. Someone sighted should.

## FINDINGS

### F1 — Three HOLD premises are DEAD on `origin/main`: finished work still sitting on the board

The sweep's own definition: *"A premise that returns false is finished work still sitting on the
board."* Three of 44 distinct prompts qualify.

**F1a — `pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`.** Premise
`grep -q "^2\. ESTIMATING" sot/01-charter-and-architecture.md` → exit 1. POSITIVE control on the
same file, `grep -c "^## "` → 28, so the file is being read and the pattern anchor works. The
numbered-list form the premise hunts is gone; what remains is `:462  ## SECTION 10 — ESTIMATING
DOMAIN` and a line at `:455` that explicitly describes the pre-NAV-1 sidebar as history. The file
is byte-identical to `main` (blob `07e52d77…`), so this verdict is `origin/main`'s, not the working
copy's. The reconcile has already happened.
**DISPOSITION: DISPATCHED — Station 05.** `sot/` is 05's lane exclusively and my station doc says
anything 05-owned is surfaced to 05, never staged by me. 05 owns deciding whether the prompt is
retired to `superseded/` or its premise re-pointed.

**F1b — `pr-stationcaps-blind-run-names-one-mount-HOLD.md`** — tracked on `main`, **absent from
disk**, and its work has landed. Premise
`grep -c "BLIND_RUN_OTHER_MOUNTS_V1" docs/pipeline/STATION-CAPABILITIES.md | grep -q "^0$"` → exit
1 (DEAD): the marker is present once. Its `done_when` also passes — `verdicts-archive` appears
twice. STATION-CAPABILITIES is byte-identical to `main` (`69f57d4e…`), NEGATIVE control with a
needle minted this run → 0. **I read this prompt's body from `main` by API to get its premise at
all** — it is one of the six in F2.
This one stings: the prompt's own closing argument is that it is `docs/`-only and therefore *"one
of the few pieces of real work on this board that `classifyPolicyFiles` admits without a human."*
It is done, and the board is still counting it.
**DISPOSITION: DISPATCHED — Station 00.** Retire to `superseded/` in a board PR. I may not open one.

**F1c — `pr-watcher-verdict-home-resolver-LOOPING.md`** — on disk only, never tracked on `main`.
Premise `! grep -q "VERDICT_HOME_RESOLVER_V1" scripts/pr-watcher/index.mjs` → exit 1 (DEAD): the
marker is present **6 times** on `main` (blob `a40dd390…` identical), NEGATIVE control 0. This
matches the already-discharged clone-FF dispatch, which measured `VERDICT_HOME_RESOLVER`→6. The
work shipped; the file is litter. It is `-LOOPING.md`, so it matches no watcher glob and arms
nothing — this is hygiene, not a hazard.
**DISPOSITION: DISPATCHED — Station 00.** Delete or retire in a board PR. No agent bulk-deletes.

### F2 — The gate-liveness sweep cannot see six of the prompts it is defined over

**The sweep brief says "against `origin/main` at a named SHA". The board's prompt files are
globbed from DISK. Those two corpora disagree by eight files, and nothing reconciles them.**

- **On `main`, absent from disk (6)** — invisible to any disk-globbing sweep, including this one
  until I listed `main` by API: `pr-brandtheme-s0-token-foundation`, `pr-brandtheme-s1-apply-the-saved-scheme`,
  `pr-ea-gate-report-self-filter`, `pr-rates-consumers-s3-persona-export`,
  `pr-stationcaps-blind-run-names-one-mount`, `pr-tfm-s11-copy-recursive-preserve` (all `-HOLD.md`).
- **On disk, absent from `main` (2)** — invisible to any `main`-only sweep:
  `pr-vmgitguard-selftest-and-recursion-HOLD.md`, `pr-watcher-verdict-home-resolver-LOOPING.md`.

The cost is not theoretical, and it lands in both directions:

1. **A dead premise hid in the gap.** F1b is one of the six. A disk-only sweep reports it as
   nonexistent; a `main`-only sweep reports it as a live HOLD. Neither reports the truth.
2. **A live prerequisite hid in the gap.** `pr-ea-gate-report-self-filter` is the sole releaser of
   the `reporting.team` needle that gates BOTH `pr-ea-s2a-dashboard-preset-seed` and
   `pr-ea-s2b-dashboard-filter-surface` — two prompts that ARE on disk and that my sweep correctly
   reports as gate-blocked. Disk-based triage sees two blocked prompts and no reason for the block.
3. **`pr-vmgitguard-selftest-and-recursion-HOLD.md` is the mirror hazard, and it is LF-terminated
   while all 37 of its neighbours are CRLF** — the signature of a file authored from the Linux side
   by a blind run and never committed. Its premise is ALIVE and it is gate-satisfied, so it is
   armable **on this machine only**; no clone, no CI and no other station can see it. That is the
   already-recorded "a dev tree can be AHEAD of `main` in a way only it knows about" trap, with a
   named instance.

⚠️ **Falsifying probe for anyone who doubts this:** list `docs/pr-prompts/` at depth 1 on
`origin/main` and on disk and diff the two name sets. If they are equal, this finding is wrong.
Today: 42 vs 38, difference 8.

**DISPOSITION: DISPATCHED — Station 00.** The fix is a repo change I may not make: either the
gate-liveness brief in `docs/pipeline/sweep-rotation.json` names the union of both corpora
explicitly, or `04-scanner.md` does. **RULE 1 read on the options, complete-and-additive first:**
**(a) make the sweep's corpus the UNION of disk and `origin/main`, and require the run to report the
symmetric difference as a finding whenever it is non-empty.** Complete — it closes both directions
at once and cannot silently shrink again; additive — it only widens what is read, changes no
existing verdict, and touches no data. **(b) glob `main` only.** Fails the "complete" half: it goes
blind to the two disk-only files, one of which is armable-on-one-machine. **(c) leave it and rely on
F3 being fixed so the corpora converge.** Fails both halves: it is a promise rather than a
mechanism, and F3 has already been carried as UNSTAGED across several runs.

### F3 — Five prompts consumed by arming yesterday are still tracked on `main` as `-HOLD.md`

This is the "an armed prompt whose PR does not delete it stays armable forever" defect, carried in
memory as UNSTAGED. **This run has the exact evidence, from three instruments that agree.**

| prompt | armed (`.arming-log.txt`, UTC) | on disk | on `main` | work landed |
|---|---|---|---|---|
| `pr-brandtheme-s1-apply-the-saved-scheme` | 09-08T07:11:06Z | absent | `-HOLD.md` | [INFERRED] gate `brand-scheme.ts :: applyBrandScheme` now RELEASED |
| `pr-brandtheme-s0-token-foundation` | 09-08T11:49:10Z | absent | `-HOLD.md` | [MEASURED] #1820 merged 20:02:55Z |
| `pr-rates-consumers-s3-persona-export` | 09-08T12:03:40Z | absent | `-HOLD.md` | [MEASURED] #1821 merged 20:17:42Z |
| `pr-tfm-s11-copy-recursive-preserve` | 09-08T12:29:41Z | absent | `-HOLD.md` | [MEASURED] #1822 merged 23:55:03Z |
| `pr-ea-gate-report-self-filter` | 09-08T23:43:55Z | absent | `-HOLD.md` | [MEASURED] #1823 OPEN, `do-not-merge` |

The mechanism, stated plainly: **arming renames `-HOLD.md`→`-ready.md` in the working tree only;
the watcher then retires the consumed file into a gitignored folder; neither the rename nor the
removal is ever committed. `main`'s `-HOLD.md` survives every one of those steps.** Any
`git checkout` / `reset --hard` / `stash pop` / `clean` in the dev tree restores all five as live
HOLDs — four of them describing work that is already on `main`. That is THE BOARD TRAP, and it is
loaded with five rounds right now.

⚠️ These are `-HOLD.md`, not `-ready.md`, so a restore would **not** immediately re-arm executed
work — it would re-stock the queue with spent prompts and inflate every HOLD count 00 triages
against. The `-ready.md` variant of this trap is the dangerous one; today, `find -maxdepth 1 -name
'*-ready.md'` returns **0**, so it is not loaded.

**DISPOSITION: DISPATCHED — Station 00.** One board PR deletes or retires the four spent files
(`s0`, `s1`, `rates-consumers-s3`, `tfm-s11`) and leaves `pr-ea-gate-report-self-filter` alone until
#1823 lands. I may not open a PR and I may not delete a prompt.

### F4 — Gate census: 22 candidates gate-satisfied, and not one can enter the tests-docs lane

Of the 38 prompts on disk: **36 premise-ALIVE, 2 DEAD; 22 have every `requires_*` gate released AND
a live premise; 14 are blocked by at least one open gate.** The 22, by `gate_allow`:
`none` ×17, `migrations` ×4 (`brandtheme-s3`, `company-manage-s1`, `fv2-formrule-contract`,
`fv2-maintenance-usage-intervals`), `env-vars` ×1 (`vendor-invoice-ocr`).

The 14 blocked break down cleanly and correctly — **no dead gate among them**, which is the
sweep's other half and is the answer I was hunting: 5 wait on a `docs/approvals/*-approved-by-marco.md`
file that only Marco creates (`524-rates-b-slice2`, `rates-s11c-drop-legacy-tables`,
`retire-tenderclientnote-s2`, `siteid-notnull-backfill`, `tenant-mt4-s2-ownership-migration`);
the rest wait on a predecessor slice in their own cluster (`brandtheme-s4`←`s3`,
`brandtheme-s6`←`s5`, `company-manage-s2`←`s1`, `ea-s2a`+`ea-s2b`←`ea-gate`,
`fv2-ai-digests`+`fv2-output-channels`←`fv2-ai-import`, `transport-capacity-column-order`←
`rates-column-edit-ui`, `tipid-s3`←two of its three chain steps). **Every gate on this board is
doing its job.**

**The load-bearing number: zero of the 22 is `tests/`-or-`docs/`-only**, so `classifyPolicyFiles`
admits none of them and **every arm available today lands on Marco.** This re-confirms the starved
`tests-docs` lane across another day — and F1b sharpens it: the one docs-only prompt that was
supposed to relieve it is already spent.

**DISPOSITION: DEFERRED.** This is state, not a defect, and arming is 00's on Marco's authority —
I arm nothing. It becomes urgent the moment 00 needs an arm that does not require Marco's hand,
because today there isn't one.

### F5 — Three of my own probes returned well-formed, plausible, WRONG answers at exit 0

DOCTRINE §7 says the instrument lies; this run produced three fresh specimens, and **all three were
caught by controls rather than by the answer looking wrong.** Recording them because each is a
shape a future run will hit.

1. **CRLF ate the front matter.** `awk 'NR==1&&$0!="---"{print "NO-FRONTMATTER"}'` reported
   **36 of 37 HOLDs as having no front matter.** They all have it; they are CRLF, and `---\r` is
   not `---`. The one file that parsed was the one LF file on the board (F2, item 3). A clean,
   confident, catastrophic reading — and it would have been "reported" as a board-wide schema
   collapse. Cure: `tr -d '\r'` before any line-anchored read of a repo file.
2. **My own shell quoting mangled the premises.** A `node -e '…'` one-liner containing a JS
   single-quote literal terminated the surrounding bash string; the quote-stripping silently broke
   and **every YAML-quoted premise ran as `'! test -f …'` → exit 127**, i.e. **26 of 38 prompts read
   as DEAD.** Had I not noticed that the 127s correlated perfectly with YAML quoting, this
   breadcrumb would have announced two dozen phantom dead premises. Cure: script files via quoted
   heredoc, never `-e` with nested quotes.
3. **A line-regex read a YAML list as an empty scalar.** `^requires_on_main:[ \t]*(.*)$` on
   `pr-tipid-s3` matched an empty tail and I recorded **`MALFORMED requires_on_main: EMPTY VALUE`** —
   a defect that does not exist. The key introduces a three-item block list on the following lines.
   Re-run list-aware: three gates, one released, two holding. **Malformed gates on this board: 0.**

The common shape, and the reason all three are worth a station's attention: **none of them errored,
none returned empty, every one produced a well-formed answer of the right type, and §9.6's "an empty
result is not an empty world" therefore never fires.** The only thing that caught them was running a
POSITIVE control alongside every count.
**DISPOSITION: ACTIONED.** All three were corrected before any claim left this run; every number in
this breadcrumb comes from the corrected probe, and each headline count above carries its control.

## WHAT I DID NOT DO

- **Ran nothing on the Windows host.** No `status-sweep.ps1`, no `smoke-pr.ps1`, no
  `restart-watcher-if-wedged.ps1`, no `bring-up-to-speed.ps1`, no `arm-prompt.ps1`. Blind.
- **Ran no `git`, anywhere, against any mount.** DOCTRINE §9.2 — a cut-short call leaves a 0-byte
  `index.lock` with no owning Windows process and freezes every station. I read `.git/refs/*` and
  `.git/packed-refs` as **plain files**, which takes no lock, and did nothing else with `.git`.
- **Did not install `vm-git-guard.sh`** — see GROUND. Reported as a finding-grade omission rather
  than treated as a licence; I ran no `git` regardless.
- **Ran `lint-prompt.mjs` on nothing** (it shells to `git show`), so **I called no prompt
  lint-clean and staged no prompt** — my one staging right needs a lint verdict I could not obtain.
- **Armed, disarmed, renamed, moved and deleted nothing.** Arming is 00's, on Marco's authority.
- **Merged nothing and touched no label.** #1823 is open, `do-not-merge`, `escalates: true`; I
  formed no view on its mergeability and ran no RULE 2 probe because I proposed no merge.
- **Did not touch `sot/`.** F1a is 05's and is dispatched, not fixed.
- **Did not delete the five spent prompts in F3** or the litter in F1c. No agent bulk-deletes; that
  is a board PR, and 04 may not open one.
- **Did not run `check-breadcrumb.mjs`** against this file, so `breadcrumb-clean` is unclaimed.
- **Did not do Part 0 (static cross-layer audit), Part 1 (GitHub reconciliation) or Part 2 (live
  site).** The station doc's ONE-named-sweep rule governs: gate-liveness was the sweep
  `next-sweep.mjs` named, and covering it completely is the instruction. Part 2 additionally needs
  Claude in Chrome against the live site, which no blind scheduled run should start unattended.
- **Two leads left as leads, not dispositioned as findings, because they are 03's open dispatch
  and I could not add to it:** the watcher's daily log is still named `2026-09-07.log` while being
  written on 2026-09-09 (the "name the daily log in UTC" ask), and the clone's
  `.claude/hooks/guard.log` has reached **6,460,602 bytes**, last written 09-09. Both belong to
  Station 03; neither is new.
