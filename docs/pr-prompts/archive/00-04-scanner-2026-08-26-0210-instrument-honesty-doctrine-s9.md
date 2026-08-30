# Station 04 — Scanner | 2026-08-26 02:10Z–02:15Z

Sweep: **instrument-honesty** (rotation 2 of 4, assigned by `next-sweep.mjs`; previous run
2026-08-25T22:18:14Z). Mandate: take DOCTRINE §9 and prove each trap is still trapped. A trap that
has been fixed upstream and still reads as live is itself drift.

## GROUND

```
UTC            2026-08-26 02:10:18Z
origin/main    8f0377e5            (fetched with +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 8f0377e5     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap **agree** — this run was not restricted to read-only by a version
mismatch. It was read-only anyway, by AUTHORITY.

`status-sweep.ps1` 02:11:08Z: instrument positive controls both `[LIVE]`; 4 open PRs
(#1325 RED, #1323 RED, #1320 green, #1316 green); armed `*-ready.md` = 0; git processes 0;
no index.lock either side; verdict **SAFE TO ACT**. Trunk read as green — **not quoted as a
finding**, per the standing rule that this tool's trunk colour is a coin flip.

## WHAT I MEASURED

Every line below is a probe I ran this run against `8f0377e5`. Commands are in
`C:\po-sup-fix-scripts\scan-0826-instruments{,2,3,4,5}.ps1`.

### §9.1 — the shell

| Claim | Verdict | Evidence |
|---|---|---|
| `$` is stripped from `-Command "..."` | **REPRODUCES, mechanism is wrong** | see Finding 1 |
| Streamed output pauses on `#` lines | **REPRODUCES** | `status-sweep.ps1` paused mid-section 1; resumed on explicit-offset reads to `0 remaining` |
| **PS 5.1 has no inline `if` expression** | 🔴 **REFUTED, both forms** | Finding 2 |
| Blocked commands (`net`,`sc`,`reg`,…) | [CANNOT MEASURE] | not exercised; no probe needed one |

[MEASURED] `PSVER=5.1.26100.9168`. `$xx = if ($true) {"A"} else {"B"}` → `PARSED-OK value=A`.
`"text $(if ($true) {'a'} else {'b'})"` → `PARSED-OK value=text a`. Both forms parse.

### §9.2 — git

| Claim | Verdict | Evidence |
|---|---|---|
| `ls-tree` without `-r` returns ONE line | ✅ **REPRODUCES** | `without -r lines=1` (`docs/pr-prompts`) vs **CONTROL** `with -r lines=407` |
| `git status` blind to gitignored files | ✅ **REPRODUCES** | 3730 files from `ls-files --others --ignored`; sample `docs/pr-prompts/_cleared-2026-08-14/rev-1002-ready.md.usage-limit.log` **invisible** in `git status`. CONTROL: `status --porcelain` returns 70 lines, so the instrument is not simply mute |
| `git fetch origin main` updates FETCH_HEAD only | [CANNOT MEASURE] | degenerate control — origin/main did not move during the run, so before = after = FETCH_HEAD = `8f0377e5`. **Not refuted; not confirmed.** This test is only meaningful when the remote has advanced |
| `git stash` in the clone is a closed loop | ✅ **REPRODUCES** | clone stash count **39**, all `watcher-preflight-autostash`, newest `2026-08-24T15:35:04+10:00`. CONTROL dev tree = 11 |

Nuance on the stash loop: newest stash timestamp **equals the watcher's process start time**. It
grows **per launch, not per job** — so "39 and rising" is only true across restarts. Node has been
up since 08-24 15:35, which is why it has been flat for two days.

[MEASURED] **Board trap is clean:** tracked depth-1 `*-ready.md` on `origin/main` = **0**, measured
with `-r` and a 407-line positive control. (The historical false "0" against a truth of 9 came from
the no-`-r` form; this 0 is real.)

### §9.3 — files and encoding

[MEASURED] Scanned all 10 `docs/pipeline/*.md` byte-wise for `U+00E2 U+20AC …` and `U+FFFD`.
One hit: **`DOCTRINE.md:362`** — and it is **`â€"` used deliberately as the illustrative example
inside §9.3's own sentence** ("Its signature is `U+00E2 U+20AC U+201D` (`â€"` for an em dash)").
Regex positive control on a planted sample returned 1, so the instrument works. **This is a false
positive of my own scanner, not damage** — reported as such in Finding 5.

### §9.4 — GitHub

| Claim | Verdict | Evidence |
|---|---|---|
| `--jq` string has its quotes stripped in transit | 🔴 **DID NOT REPRODUCE** | Finding 1 |
| `gh run list --branch main` can be days stale | [CANNOT REPRODUCE this sample] | returned `headSha=8f0377e5`, the current head, 3/3 success. Agreed with the per-commit read. Intermittent by nature — one agreeing sample refutes nothing |
| GitHub MCP token cannot merge (403) | [CANNOT MEASURE] | would require attempting a write. Not attempted |

[MEASURED] CONTROL `gh pr view 1325 --json labels` + `ConvertFrom-Json` → `labels=[do-not-merge]
count=1`. Then `--jq '.labels[].name'` → `[do-not-merge]`. **Identical and correct.** Note this
also confirms **#1325 carries `do-not-merge`**.

### §9.5 — the pipeline's own instruments

| Claim | Verdict | Evidence |
|---|---|---|
| **`lint-prompt.mjs` REJECTs when `gh` is merely missing** | 🔴 **REFUTED — and inverted** | Finding 3 |
| ADMIT is necessary, not sufficient | ✅ **REPRODUCES, and it just bit us** | Finding 4 |
| `rev-<n>-ready.md` are review jobs, no front matter | [CANNOT MEASURE] | 0 on disk at depth 1 this run; historical instances exist in gitignored `_cleared-*` folders |
| **`STOP-WATCHER-LANE2` present by design** | 🔴 **CANNOT REPRODUCE — the mechanism is gone** | Finding 6 |
| A restart adopts nothing; watcher runs from the CLONE | ✅ **CONFIRMED** | `CMD="…node.exe" --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`, PID 29024, START 08/24/2026 15:35:04 |
| Never count or kill by image name | ✅ **REPRODUCES** | 13 `node.exe` running; exactly **1** matches `pr-watcher[\\/]index\.mjs` (PID 29024) |
| Heartbeat ticks mid-run only | consistent, not independently proven | sweep reported age 577 min with an empty queue |

[MEASURED] **Watcher is genuinely live**, on the sanctioned probe: `.queue-state.json` `ts` FIELD =
`2026-08-26T02:13:07.214Z` — written *during this run*. Clone-ROOT copy absent, as recorded.
Live log = `scripts\pr-watcher\logs\2026-08-24.log` (named for START date), mtime `02:13:07Z`,
185359 bytes. **Dev-tree log dir newest file is `2026-07-08.log`** — now seven weeks dead, and it
still presents as a populated log directory.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No
label changed. No merge. No `/sot/` edit. No push. No commit.

Two writes, both outside the board:
1. This breadcrumb (tracked path, **currently untracked on disk** — Station 00 must commit it).
2. `docs/pipeline/sweep-rotation.json`, advanced via `next-sweep.mjs --advance --utc 2026-08-26T02:10:18Z`.
   **Left uncommitted deliberately** — `next-sweep.mjs` reads the working tree, so the rotation
   turns without a commit, and the dev-tree index is shared with concurrent chats.
3. Scratch `.ps1` probes in `C:\po-sup-fix-scripts\` (not a repo path).

## FINDINGS

### Finding 1 — §9.1 and §9.4 are the SAME trap, and the doc describes the harmless half — S2

DOCTRINE §9.1 says `$` is "STRIPPED … and the command dies with a parser error." §9.4 says a
`--jq` string "has its quotes stripped in transit." Both are the same underlying mechanism, and
both are stated more narrowly than the truth.

[MEASURED] The variable is **not stripped — it is EXPANDED by an outer PowerShell** before the
inner one parses:

- `-Command "… ('HOME=' + $HOME) … ('PID=' + $PID)"` → the error text shows
  `('HOME=' + C:\Users\Marco); … ('PID=' + 39684)`. `39684` **is the wrapper's own PID**.
- `-Command "Write-Host ('innerPID=' + $PID)"` → printed **`innerPID=17776`**, the wrapper's PID,
  **exit 0, no error at all.**

That last line is the finding. The doc promises a parser error; a parser error is the **lucky**
case, and it only happens when the expansion is syntactically invalid (an unquoted path). When the
variable expands to something valid — a number, a word — the command **succeeds and returns the
wrong value silently**. That is precisely the §7 failure mode the doctrine exists to prevent, and
§9.1 currently reads as though it cannot happen.

Corollary, [MEASURED]: `--jq` is **fine** when the command runs from a `.ps1` via `-File`
(control + `--jq` returned identical correct labels). §9.4's `--jq` bullet is not a `gh` property
at all — it is the `-Command` wrapper again. The cure for both is one line: **anything with `$` or
quoted arguments goes in a `.ps1` run with `-File`.**

**DISPATCHED** — to Station 06 / whoever next opens a DOCTRINE PR: merge §9.1 bullet 1 and §9.4
bullet 2 into one entry titled "the `-Command` wrapper expands your variables", lead with the
silent-wrong-value case, and name `-File` as the cure. I did not edit DOCTRINE (not my lane).

### Finding 2 — §9.1 "PS 5.1 has no inline `if`" is FALSE, and was already reported 16 h ago — S3

[MEASURED] PS 5.1.26100.9168. Both the assign form and the interpolated `$( if … )` form parse
and return correct values. The claim is false on both halves.

This was **already measured and reported false by the 2026-08-25 10:10Z Station 04 run**. It is
still in `DOCTRINE.md`. That is the actual finding: the §9 correction channel did not close across
~16 hours and multiple Station 00 runs. A binding document carrying a known-false line teaches
agents to write around a restriction that does not exist.

**ESCALATED** — to Station 00, as a process question, not a status update. Two options, RULE 1
applied:

- **(a) Complete and additive — give §9 a correction lane with an owner.** Any station that
  refutes a §9 bullet stages a one-line DOCTRINE fix prompt in the same run; 00 arms doc-only
  fixes without waiting for a rotation. Solves it immediately (this bullet dies today) and in
  future (every later refutation self-heals), and damages no data entry — it is docs-only, and
  CP-24 already keeps `sot/` out of code PRs.
- **(b) Keep reporting into breadcrumbs and rely on 00 to sweep.** Fails the *future* half of
  RULE 1: it is the status quo, and the status quo just demonstrably failed for 16 hours. Does not
  damage data entry.

### Finding 3 — §9.5's `lint-prompt.mjs` claim is refuted, and the truth is the DANGEROUS direction — S2

DOCTRINE §9.5: *"`lint-prompt.mjs` reports REJECT when `gh` is merely missing. That is the
instrument failing, not the prompt. Check `gh` before believing a REJECT."*

[MEASURED], with a proper positive control — `lint-prompt.mjs` resolves its binary from
`process.env.LINT_GH_BIN || "gh"` (`:659`), so I pointed it at a nonexistent path:

```
BASELINE (gh present)                       -> ADMIT   pr-rates-consumers-s3-persona-export-HOLD.md (size 4)   exit 0
LINT_GH_BIN=C:\nope\gh-does-not-exist.exe   -> ADMIT   pr-rates-consumers-s3-persona-export-HOLD.md (size 4)   exit 0
```

Byte-identical, **exit 0 both times, and it did not even print a warning.** The documented failure
mode is inverted: it does not false-REJECT a good prompt, it **silently ADMITs a prompt whose
gh-backed gates were never evaluated.** An unmeasurable gate reads as a passed gate.

The doctrine's own advice makes this worse — a reader told "check `gh` before believing a REJECT"
will never think to check `gh` before believing an **ADMIT**, which is the case that actually
arms work.

Note this is the second time: memory records the same refutation from 2026-08-25 10:10Z. Same
unclosed channel as Finding 2.

**ESCALATED** — to Station 00, folded into Finding 2's decision. The code fix (make a gh-absent
gate evaluation a loud non-zero, never a silent ADMIT) is a real change to an arming instrument
and is 00's/06's call, not mine. I staged no prompt for it — see WHAT I DID NOT DO.

### Finding 4 — a prompt on the live "ARMABLE NOW" list carries a bare DO-NOT-ARM marker — S2, act before next arming

This is the §9.5 "ADMIT is necessary, not sufficient" trap firing on live board state.

[MEASURED] 61 depth-1 `pr-*.md` prompts; **12** carry `watcher: do-not-arm` or a prose
`DO NOT ARM`. One of those 12 is
**`pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD.md`** — which the previous Station 04
run (2026-08-25 22:10Z) named as one of *"3 HOLDs ARMABLE NOW"*.

```
lint verdict : ADMIT  pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD.md (size 6)  exit 0
body :17     : > **HOLD - do not arm until SLICE-4b (the unified API Keys page) is merged AND verified.**
body :35     : - Do NOT arm while HOLD. Do NOT delete the legacy PlatformConfig / IntegrationCredential DB rows or columns
```

I checked the gate fairly rather than assuming the previous run was wrong. [MEASURED]
`apps/web/src/pages/admin/ApiKeyVaultPanel.tsx` **is on `origin/main`**, so the *merged* half of
the precondition looks satisfied — the previous run's "gate released" reading was defensible. But
the marker says "merged **AND verified**", and I can find **no artifact anywhere that records the
verification**. Meanwhile line 35 is an unconditional prose stop that the linter structurally
cannot see.

Scope check, so this is not a blanket alarm: [MEASURED] the **other two** prompts on that armable
list — `pr-rates-consumers-s3-persona-export-HOLD.md` and
`pr-fv2-maintenance-usage-intervals-HOLD.md` — carry **zero** do-not-arm markers. Only slice4c is
contested. The rest of the list stands.

**ESCALATED** — to Marco via Station 00. The blocking word is "verified", and only Marco knows what
was meant to verify it. The question, not a status update: *"SLICE-4b's page is on main. Did you
verify it? If yes, may slice4c be armed and its two DO-NOT-ARM lines struck? If no, what is the
verification?"* Until answered, **slice4c must not be armed**, whatever lint says.

### Finding 5 — DOCTRINE.md will permanently red-flag any automated encoding gate — S4

[MEASURED] `DOCTRINE.md:362` contains a real `U+00E2 U+20AC …` sequence, because §9.3 quotes
`â€"` deliberately as the example of the damage it is describing. My byte scanner flagged it; the
positive control proved the scanner works. **The file is not damaged.**

Worth recording because the obvious next step from §9.3 is to automate this scan as a gate, and
that gate would fail on the one file nobody may weaken. Whoever writes it must exclude the
documented example (fenced-code or an explicit line allowlist).

**DEFERRED** — real, not now. Becomes urgent the moment someone stages an encoding gate.

### Finding 6 — §9.5 describes a watcher stop-sentinel that no longer exists — S3

DOCTRINE §9.5: *"`STOP-WATCHER-LANE2` has been present BY DESIGN since 2026-08-15 … The real
sentinel is `STOP-WATCHER`, and it cannot stop an already-running watcher."*

[MEASURED], with the instrument controlled:

```
STOP-WATCHER* files, dev tree, recursive -Force     : 0
STOP-WATCHER* files, clone,    recursive -Force     : 0
"STOP-WATCHER" as text, dev scripts/ recursive      : 0
"STOP-WATCHER" as text, clone scripts/ recursive    : 0
CONTROL "stays for Marco" in clone pr-watcher/*.mjs : 1  (index.mjs:2431)
```

The control proves the grep reaches the watcher source. **Neither the sentinel files nor any code
that reads them exists.** §9.5 currently tells a station that a stop mechanism exists and is inert
by design. The live truth is that it does not exist at all — so an agent that creates a
`STOP-WATCHER` file to halt the watcher gets **silence that looks exactly like the documented
"cannot stop a running watcher"**, and may conclude the watcher is unstoppable-but-fine when in
fact nothing is listening.

**DISPATCHED** — to Station 03 (machine-minder owns watcher mechanism) via Station 00: either
restore the sentinel or delete the §9.5 bullet. I did not edit the doc or create any sentinel file.

## WHAT I DID NOT DO

- **Armed, disarmed or staged nothing.** Findings 1/3/6 all imply a code or doc change; all three
  touch DOCTRINE or an arming instrument, which is 00's and 06's lane. I deliberately spent my
  staged-prompt budget on **zero** prompts rather than stage a DOCTRINE edit as Station 04.
- **Did not clear the 39 clone stashes.** Report-only; `stash drop` is 03's, on 00's dispatch, and
  `pop` is forbidden outright.
- **Did not prune the 4 orphaned worktrees** the sweep flagged. Standing instruction records each
  holds an unpushed commit; the sweep's "investigate/prune" advice is overruled until 00 rules.
- **Did not commit** the breadcrumb or `sweep-rotation.json`. The dev-tree index is shared and
  `git status --porcelain` showed 70 dirty lines this run. **Station 00 must `git add` both paths
  with an explicit pathspec.**
- **Did not test** `git fetch origin main` conclusively (degenerate control), the blocked-command
  list, the MCP-403 claim, or `mergeStateStatus: CLEAN` refusal. All marked `[CANNOT MEASURE]`
  above rather than inferred.
- **No live-site pass, no Part 0 audit.** This run's rotation slot was instrument-honesty and the
  station doc says cover ONE sweep completely rather than skim everything.
