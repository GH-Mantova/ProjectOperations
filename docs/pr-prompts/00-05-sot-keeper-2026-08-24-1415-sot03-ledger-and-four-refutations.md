# Station 05 SoT-Keeper — 2026-08-24 14:11–14:20Z

**Base:** `origin/main 74066ae9` · **Sweep verdict:** SAFE TO ACT · **Desktop Commander:** PRESENT
(not a blind run). All facts below are `[MEASURED]` against `origin/main 74066ae9` unless tagged.

## What this PR lands

`sot/03-progress-log.md` — a machine-generated merged-PR ledger for **#496 → #1304 (789 PRs,
2026-07-07 → 2026-08-24)**, plus a TOC row and a corrected `Last updated:` header. Deterministic and
regeneratable; **no curated prose was auto-written**. One file in `sot/`, one breadcrumb in `docs/`
— CP-24 safe (`pr-gates.mjs` codeRe covers `apps/ scripts/ .github/ packages/`, not `docs/`).

## 🔴 Four prior claims REFUTED — do not re-report these as open

1. **`settings-restructure-sot-nav-reconcile` is DISCHARGED, not overdue.** The Station 05 brief says
   its marker `docs/audits/settings-restructure-sot-reconcile.md` is "STILL ABSENT from origin/main".
   It is **present**, landed `e9da7ef4` by **#1298** on 2026-08-24, 84 lines, a real reconcile — not a
   stub. Age at discharge: released 2026-08-15 → landed 2026-08-24 = **9 days**. The brief's
   instruction to "measure the age and report it as a number of days" now has a terminal value.
   `git ls-tree -r --name-only origin/main -- docs/audits/settings-restructure-sot-reconcile.md`
2. **The `sot/01` fetch-URL contradiction is FIXED.** #1298 rewrote `sot/01:105-127` to
   "always append `?plain=1`" with a bare-blob warning at `:1314`. No surviving "use blob URL — raw
   CDN has delays" line.
3. **`sot/README.md` carries the same corrected advice** (`:218-239`), landed by #1299.
4. **D42 is RESCINDED on main** — `sot/05:356` struck through with the #1146/#1149/#1150 evidence,
   plus a resolution note at `:376`.

Positive control for 1–4: `git ls-tree -r --name-only origin/main -- sot/README.md` returned
`sot/README.md`, so the instrument sees tracked files.

## 🔴 Findings for Station 00 / 06 — I arm nothing, these are handoffs

- **DO NOT ARM `pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md` as written.** Its premise is still LIVE
  (`sot/01:362` still reads `2. ESTIMATING`; zero `Comms hub` hits — control: `SECTION 9` matches 5
  lines in the prompt, so the grep is not blind). But it replaces the whole SECTION 9 fenced block,
  and its replacement block at `:109-111` writes a SETTINGS group (`Company | AI Settings | Data
  Model`). Its own line `:126` claims "Group 8 (SETTINGS) is left exactly as-is" — **that was true on
  2026-08-20 and became false on 2026-08-24 when #1298 rewrote exactly that group.** Arming it now
  silently reverts #1298. Fix = re-copy the SETTINGS group from post-#1298 `origin/main` first.
- **`sot/02` §2 is materially false and is CLAIMED.** `sot/02:61` says "In-PR — open right now (2)"
  and lists **#895 / #894**, both merged long ago; live open PRs = **1 (#1305)**. I did **not** edit
  it: `pr-sot-02-reconcile-2026-08-19-HOLD.md` scopes `sot/02` and is a staged actor. Whoever runs
  that prompt should fold §2 in, or §2 needs its own claim.
- **`sot/04` is 8 models behind — and here are the names**, so the next run reconciles instead of
  re-measuring: 284 `### Model:` headers vs 292 `^model` blocks in `apps/api/prisma/schema.prisma`.
  Missing: `ClientShare`, `WorkerShare`, `ContactShare`, `TenderAllocationCandidate`,
  `TenderAllocationRejection`, `EstimatorCapacity`, `AllocationWeightConfig`, `AllocatorDelegate`.
  **Zero orphan headers** (no header without a model), so the drift is purely additive. `sot/04` is
  CLAIMED by `pr-sot-04-bp0a-job-canonical-reconcile-HOLD.md`, so I left it.
- **`docs/lessons-learned/` is still 0 tracked files on main** though `sot/05` cites it. #1305 restores
  it and is **open, routed to Marco — do not merge it** (RULE 2).

## Method notes worth keeping

- 🔴 **PowerShell `git show <ref>:<file>` returns a STRING ARRAY, and `[regex]::Matches` on it joins
  with SPACES, killing every `(?m)^...` anchor.** My first pass reported `sot/04 headers: 0` and
  `schema models: 0` — a false clean read. `-join "\`n"` first. The tell was `0 and 0` where a
  positive control would have shown hundreds.
- ⚠️ A JS regex ending `\|\n` does **not** match a CRLF working tree. My TOC-row insert silently
  no-opped; `git diff --numstat` (835 vs the expected 836) is what caught it, exactly as DOCTRINE says.
- `merged-prs.json` written by PS5 `Out-File -Encoding utf8` carries a **BOM** — strip `^﻿`
  before `JSON.parse`.
