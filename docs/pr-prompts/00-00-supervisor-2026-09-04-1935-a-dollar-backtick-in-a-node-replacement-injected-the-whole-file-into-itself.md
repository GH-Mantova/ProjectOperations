# Station 00 — Supervisor | 2026-09-04T19:30Z–2026-09-04T19:5xZ

**ADDENDUM to the 19:08Z run (same station, SAME RUN, later measurement).** The 19:08Z breadcrumb
and its PR `#1604` are already on `main`; this covers one finding made *after* that merge, while
writing project memory. It is not a second run — 00's `lastRunAt` for this cycle is `19:07:55Z`.

## GROUND

```
UTC            2026-09-04T19:30Z
origin/main    b149b9a4            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ b149b9a4     C:\ProjectOperations2   (ff'd 0 0 after #1604)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Versions agree. Work done in a disposable worktree `C:\po-trap-1935` cut from `origin/main`.

---

## WHAT I MEASURED

- [MEASURED] Editing the project-memory index with node, I replaced one line using
  `String.replace(OLD, NEW)` where `NEW` ended `...[cm]?[jt]sx?$` immediately followed by a closing
  backtick — a **regex being quoted as documentation**. JS read `` $` `` as the substitution pattern
  *"insert everything before the match"*. It injected **7,734 bytes** — the entire preceding file —
  into the middle of one line.
- [MEASURED] File went from ~24.9 KB to **33,801 B**; line count 50 → 69. The escalation header, the
  `## SECOND LANES` heading and the whole of open escalation **#23** were silently duplicated.
- [MEASURED] **All three of my read-backs passed**: `old_spec_gone=true`,
  `new_stanza_present=true`, negative control `0`. Every one true; every one worthless.
- [MEASURED] Found only by measuring **byte size**, then per-line byte sizes: two 1698-byte lines,
  then a 17-line 7,124-byte span, byte-identical (`Buffer.compare === 0`, with a negative control on
  an adjacent pair returning `false`).
- [MEASURED] Repaired by **concatenation**, not `replace`: `PRE + HEAD + "$` + backtick + `" + TAIL + SUF`,
  guarded by an abort unless the injected span was byte-identical to `PRE`. Result **26,069 B**,
  50 lines, `title_occurrences=1`, `second_lanes_heading=1`, `rule2_heading=1`, `esc23=1`, NEG `0`.
- [MEASURED] Then compacted to **24,927 B**, after relocating the 18:2xZ and 19:2xZ board stanzas
  **verbatim** into `MEMORY-standing.md` and append-verifying them (two positive needles I did not
  author, negative control 0). Nothing retired, nothing shaved.
- [MEASURED] The doc edit landed here was byte-delta asserted: `AFTER - BEFORE = 1817`,
  `EXPECTED = 1817`, `MATCH=true`; `git diff --numstat` → `19  0`.
- [MEASURED] `lint-station.mjs` → `REJECT: 1 of 8`, reason `canonical block 'instruments' has been
  EDITED (sha 253a73c4…, expected 10124e86…)` — the **only** failure, i.e. no dangling path and no
  encoding fault. After `--write-canonical`: `ADMIT: all 8 docs clean`, exit 0. `station-contract v2`
  hash `2f28f0f2…` is **unchanged**, confirming that block was not touched.

---

## WHAT CHANGED

1. `docs/pipeline/DOCTRINE.md` §9.3 — new bullet recording the trap, its cure, and the byte-delta
   assertion. Inside the `instruments v2` canonical block, deliberately: it is true for every station.
2. `docs/pipeline/stations/_canonical-blocks.json` — `instruments v2` re-recorded to `253a73c4…` via
   `lint-station.mjs --write-canonical`. `instruments v2` is DOCTRINE-only, so this is a two-file
   change, not a seven-doc ship.
3. This addendum breadcrumb.

Nothing else. No prompt armed, no PR merged but my own, no worktree pruned, no branch deleted.

---

## FINDINGS

### F5 — a `$` in a node replacement string injected 7.7 KB of a file into itself, and every read-back said it worked — S2

DOCTRINE §9.3 already says *"EDIT DOCS AND PROMPTS WITH NODE, not PowerShell"*, and that advice is
right — PowerShell's double-encoder and `>`-redirection traps are worse. But the cure has a trap of
its own that §9.3 did not name: **in `String.replace(pattern, replacement)` the replacement STRING is
not literal.** `$&`, `` $` ``, `$'`, `$1` and `$$` are all live in it.

The way you meet this is not exotic. It is **quoting a regex as documentation** — exactly what a
pipeline that writes about its own instruments does constantly. My replacement text ended
`[cm]?[jt]sx?$` and the next character was the backtick closing the markdown code span.

The severity is S2 rather than S3 because of *how it hid*. This is **§9.6 inverted**: not an empty
result read as an empty world, but a **fuller** result read as a correct one. Absence-checks
(`old_gone`) and presence-checks (`new_present`) are both blind to it by construction — neither asks
*"is anything ELSE now in the file?"* — and it landed in the project-memory index, which
`STATION-CAPABILITIES.md` §7 calls *"the only channel that reliably survives"*, duplicating an open
escalation inside it. Had I not measured the byte count, the next run would have read a memory index
with #23 twice and 7.7 KB of noise, and would have had no way to tell it was damage.

**DISPOSITION: ACTIONED.** Repaired by concatenation with a byte-identity guard (evidence above), and
the rule landed in DOCTRINE §9.3 with the canonical hash re-recorded, so every station gets it and no
future edit to that block can drop it silently. The cure is unconditional — **pass a function
replacer, or concatenate** — and it is paired with the assertion that actually catches this class:
**`after_bytes - before_bytes` must equal the size of the change you intended.** Verified on this very
PR: `DELTA=1817 EXPECTED=1817 MATCH=true`.

---

## WHAT I DID NOT DO

- **Did not re-open or amend `#1604`.** It is merged and its content is correct; this is a separate,
  later finding and it gets its own PR rather than a rewritten history.
- **Did not touch `station-contract v2`.** Only `instruments v2` needed re-recording, and its hash is
  quoted above as evidence the other block is untouched.
- **Did not audit other files for the same damage.** The trap requires a `$` in a *replacement string*
  passed to `replace()`; this run is the only place I used that form. A sweep of the repo for
  `.replace(` with a `$` in the replacement is worth doing and is **not** urgent — recorded here as a
  lead for Station 04's `instrument-honesty` sweep rather than dressed up as a finding I measured.
- **Merged none of the three open PRs.** All three remain Marco's; RULE 2 binds. Unchanged from the
  19:08Z breadcrumb.
