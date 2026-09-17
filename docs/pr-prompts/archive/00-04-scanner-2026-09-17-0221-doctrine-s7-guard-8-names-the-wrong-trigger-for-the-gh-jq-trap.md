# Station 04 — Scanner | 2026-09-17T02:10Z–2026-09-17T02:21Z

## GROUND

```
UTC            2026-09-17T02:10Z
origin/main    b79b2e59            (fetched, then rev-parse)
dev tree       main @ bdc5d05b     C:\ProjectOperations2
doc version    1
bootstrap      1
```

doc version and bootstrap AGREE — run proceeded with full authority.

Read in the DEV TREE. All three binding docs verified identical to `origin/main` by the sound probe
(`git diff --numstat origin/main -- <paths>` → EMPTY for all three), never by a piped hash (§9.1).

Sweep assigned by `node scripts/pipeline/next-sweep.mjs`: **instrument-honesty** (position 2 of 4;
previous run 2026-09-16T18:10:38Z). Not chosen by me.

Device-bridge git guard, last line quoted verbatim [MEASURED]:

```
vm-git-guard installed at /sessions/exciting-bold-euler/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

`status-sweep.ps1` §7 verdict [MEASURED] 2026-09-17T02:14:21Z:
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
(`ready=1 needs-marco=2 blocked=4 broken=0`)

## WHAT I MEASURED

Every probe below was run against **the corpus its own §9 bullet names**, never against §9 itself
(§9.6's closing rule — `instrument-honesty` is the one sweep guaranteed to reach for it).

### Traps that still reproduce exactly as documented — no drift

| # | §9 bullet | Probe | Result | Verdict |
|---|---|---|---|---|
| T1 | 9.2 `ls-tree` depth | `git ls-tree --name-only origin/main -- docs/pr-prompts` vs `…/` vs `-r …/` | **1** · **61** · **1232** | REPRODUCES |
| T2 | 9.2 `ls-tree` has no glob | `-- 'docs/pr-prompts/*.md'` with and without `-r` | **0** and **0**, truth **53** | REPRODUCES |
| T3 | 9.2 `check-ignore` on a dir | dir → exit 1 empty · tracked control `CLAUDE.md` → **exit 1 empty** · file inside → exit 0 `.gitignore:76` | byte-identical opposites | REPRODUCES |
| T4 | 9.3 `Measure-Object -Line` | `scripts/pipeline/lint-prompt.mjs`: node total **2445**, blank **163**, non-blank **2282**; `-Line` → **2282**; `(Get-Content).Count` → **2444** | off by exactly the blank count | REPRODUCES |
| T5 | 9.3 `>` writes UTF-16LE | `git show origin/main:docs/pipeline/SCRIPT-REGISTRY.md > file` → **24108 B, `FF FE`**; true blob **11908 B, `23 20`** | REPRODUCES |
| T6 | 9.3 `SimpleMatch` + `[regex]::Escape()` | `SCRIPT-REGISTRY.md`, needle `lint-prompt.mjs`: raw **3**, escaped **0**, dotless control **37** | REPRODUCES |
| T7 | 9.2 `branch -r` not authoritative | after `fetch --prune`: `branch -r` **40** vs `ls-remote --heads` **16**; 17 `origin/*` (incl. symbolic HEAD), **23** hand-made `pr/N` refs no refspec owns | REPRODUCES, same shape |
| T8 | 9.4 `@(ConvertFrom-Json …).Count` | `@(…'[]')` → **1** (truth 0); `@(…4 elems)` → **1** (truth 4); assign-then-count → **4** | REPRODUCES |
| T9 | 9.1 nested `-Command` expansion | direct → `ROW_A_direct:42`; nested `powershell.exe -NoProfile -Command` → `The string is missing the terminator: ".` | REPRODUCES — 2026-09-14 correction stands verbatim |

`gh run list --branch main --limit 3` (named in the sweep brief) returned three real rows, exit 0.
No lie observed in that form this run. PS `5.1.26100.9444`, `gh version 2.90.0 (2026-04-16)`.

### §9.3 false-mojibake bullet — confirmed, and its own near-miss recorded

The console rendered DOCTRINE's em-dashes as `â€"` throughout this run. The **bytes are clean**
[MEASURED, file-based probe with positive and negative controls]:
`bytes=201130 · U_FFFD=0 · EMDASH(U+2014)=464 · NEG_CTRL_BEL=0 · distinct_nonascii=27`.

The same probe reported `DOUBLEENC_ae=2`. **That is not damage.** Both instances are §9.3's own
bullet quoting the signature as documentation, inside backticks — `DOCTRINE.md:755` and `:760`.
Reporting the raw count would have been §9.6's exact trap. Located before believing it.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced to `last_index=1 last_run_utc=2026-09-17T02:21:13Z`
  via `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-17T02:21:13Z` (exit 0).
  **LEFT DIRTY IN THE DEV TREE ON PURPOSE.** Read back with the sound probe:
  `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2  2`.
  🔴 **Station 00: this file needs committing with the next board PR. 04 may not commit it.**
- This breadcrumb, written to the tracked `docs/pr-prompts/` (untracked until 00 sweeps it up).
- No board mutation. Nothing armed, staged, renamed, moved or deleted. No prompt staged this run.

## FINDINGS

### F1 — DOCTRINE §7 guard 8 names the WRONG TRIGGER for the `gh -q` trap, and the trigger it names produces a FALSE ALL-CLEAR · **S3**

Two sections of DOCTRINE disagree about the same instrument, and **§9.4 is the correct one**.

- `DOCTRINE.md:175` (§7 standing guard 8): *"**Never pass `-q '<jq>'` to `gh` from PS 5.1** — it
  re-splits the quoted expression **on spaces**."*
- `DOCTRINE.md:~897` (§9.4): *"A `--jq` expression **survives the `-Command` layer intact — spaces
  included** — but escaped double quotes DO NOT."*

[MEASURED] 2026-09-17T02:1xZ at `b79b2e59`, PS `5.1.26100.9444`, `gh 2.90.0`, four probes:

| probe | jq | result |
|---|---|---|
| spaces, no embedded quotes | `'.[] \| .number'` | **1989 1987 1986, exit 0 — CORRECT** |
| spaces, no embedded quotes | `'.[] \| select(.number > 0) \| .number'` | **exit 0 — CORRECT** |
| **embedded quotes, NO spaces** | `'.[]\|"PR"+(.number\|tostring)'` | **exit 1 — `function not defined: PR/0`** |
| embedded quotes + spaces | `'.[] \| "PR " + (.number\|tostring)'` | **exit 1 — `unknown argument " + (.number\|tostring)"`** |

**Mechanism: PowerShell strips the inner double quotes** when handing a single-quoted argument to a
native command, so jq receives bare `PR` and reads it as a function name. Spaces are irrelevant —
row 3 has none and still fails; rows 1–2 are full of them and are correct.

🔴 **Why this is a finding and not pedantry.** A station auditing guard 8 as written tests a *spaced*
jq, gets **exit 0 and the right answer**, and concludes the trap is retired. **This run did exactly
that** — the first probe passed cleanly and the trap only appeared when double quotes were
introduced. The stated trigger is the one input that cannot expose the defect.

⚠️ Both failures were **LOUD** (exit 1) in every form measured. A silent wrong value was **not
observed** and is [CANNOT MEASURE] from four probes — do not read this as proof one cannot exist.

⚠️ **Falsifying probe: rows 1 and 3 above.** If row 1 ever fails, guard 8 is right and §9.4 is wrong.

**DISPOSITION: DISPATCHED** — to Station 00, to reconcile `DOCTRINE.md:175` with §9.4 in a
doc-reconcile PR. 04 is read-only on tracked files outside staged prompts and the five ignored
`docs/qa/` entries, so I did not edit it. Suggested replacement for guard 8: *"Keep double quotes
out of `--jq`; spaces are fine. Or take raw `--json` and `ConvertFrom-Json`."*

### F2 — inline `node -e "…\uXXXX…"` silently loses its escapes through the shell; §9 does not name it · **S3**

§9 prescribes node as the cure for PowerShell's encoding traps (§9.3: *"verify with `node`, which
reads UTF-8 correctly"*). **The inline `-e` form of that cure has its own lie**, and I walked into it
live this run before catching it.

[MEASURED] 2026-09-17T02:1xZ, same file, same question, two transports:

| transport | `U_FFFD` | `EMDASH` | truth |
|---|---|---|---|
| `node -e "…(s.match(/\uFFFD/g)\|\|[]).length…"` inline | 0 | **0** | wrong |
| `node C:\Windows\Temp\enc-probe.mjs` (same logic, from a file) | 0 | **464** | right |

The `\u` escapes did not survive the inline argument. **Every reading from the inline form was
plausible, well-formed, exit 0, and worthless** — and `U_FFFD=0` is the *"this file is clean"*
answer, so the broken instrument returned the reassuring result. It was caught only because
`EMDASH=0` contradicted what a direct file read had already rendered, which supplied an accidental
positive control the probe itself lacked.

🔧 **Cure, and it is §9.1's existing cure extended one step:** the rule *"anything containing `$`
goes in a `.ps1` file"* applies to **node's `\u` escapes through `node -e` too**. Put the probe in a
`.mjs` file, and build non-ASCII needles with `String.fromCharCode()` rather than escapes — which is
what the working probe did.

⚠️ **Falsifying probe: the two rows above.** Run both forms over any file with a known em-dash count.
If the inline form ever returns the true count, this is wrong and must be re-measured.

**DISPOSITION: DISPATCHED** — to Station 00, as a proposed §9.3 bullet in the same doc-reconcile PR
as F1. Not staged as a prompt: it is a doc change to a §9 canonical block, which is 00's to land.

### F3 — the nine traps in WHAT I MEASURED are all still live · **no action**

Nine of §9's documented traps were re-probed against their named corpora and **every one reproduced
exactly as written**, including the 2026-09-14 nested-`-Command` correction, which reproduced
verbatim down to its error string. No §9 claim tested this run was found retired or fixed upstream.

**DISPOSITION: ACTIONED** — verification complete, nothing to change. Recorded so the next
instrument-honesty run knows these nine were live at `b79b2e59` and can spend its budget elsewhere.

## WHAT I DID NOT DO

- **Did not edit `DOCTRINE.md`.** F1 and F2 are both corrections to it. 04 is read-only on tracked
  files; §9's canonical block is hash-gated by `lint-station.mjs` and belongs to Station 00.
- **Did not commit `sweep-rotation.json`.** Left dirty by design — the dev tree is on `main` and 04
  may not commit there. Named above for 00.
- **Did not run Part 0, Part 1 or Part 2.** The station doc's one-named-sweep rule governs:
  `next-sweep.mjs` assigned `instrument-honesty` and I covered it completely rather than taking a
  shallow pass over everything. Part 1's GitHub reconciliation and Part 2's live-site patrol are
  untouched this run.
- **Did not stage any prompt.** Budget is 2; I used 0. Both findings are doc corrections to a
  canonical block, which the ADVERSARIAL PROMPT CRITIQUE report-not-run rule keeps out of my hands.
- **Did not probe the `Get-ChildItem -Include` family (§9.1).** Its own bullet records a six-minute
  non-return recursing `node_modules`; not worth the turn budget against a trap already carrying two
  corrections. DEFERRED to a future instrument-honesty rotation.
- **Did not touch Azure, Entra or SharePoint.** Not approached at any point.
