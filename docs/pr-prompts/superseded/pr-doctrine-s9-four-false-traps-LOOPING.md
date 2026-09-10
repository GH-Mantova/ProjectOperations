---
premise: 'grep -q "no inline .if. expression" docs/pipeline/DOCTRINE.md'
premise_means: DOCTRINE section 9 still carries four claims that were measured FALSE, including one whose polarity is inverted in the dangerous direction.
scope:
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/stations/_canonical-blocks.json
done_when: '! grep -q "no inline .if. expression" docs/pipeline/DOCTRINE.md && node scripts/pipeline/lint-station.mjs'
size: 2
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# DOCTRINE section 9 carries four measured-false traps, one of them inverted

Station 04 ran the `instrument-honesty` sweep on 2026-08-26 and re-ran every section 9 claim it
could safely run. Most of them still bite, hard, and must stay. **Four do not**, and one of the four
is wrong in the direction that gets a bad prompt armed.

All measurements below: **[MEASURED] 2026-08-26T22:10Z-22:45Z, origin/main `549537a4`,
git 2.55.0.windows.3, PowerShell 5.1.26100.9168.**

> Two of these four were already measured false by Station 04 at 2026-08-26T02:10Z. They were
> reported and never landed. That is why this prompt exists: the correction needs a PR, not another
> breadcrumb.

## 1. section 9.5 - the lint-prompt claim is INVERTED. Fix this one first.

**Currently says:** *"`lint-prompt.mjs` reports REJECT when `gh` is merely missing. That is the
instrument failing, not the prompt. Check `gh` before believing a REJECT."*

**Measured:** with `gh` removed from `PATH`, `lint-prompt.mjs` does not REJECT. It prints a WARN and
**ADMITs with exit 0** - the identical verdict it gives with `gh` present.

```
gh present   -> ADMIT  pr-524-rates-b-slice2-canonical-HOLD.md  (size 8)   exit 0
gh absent    -> WARN   pr-524-rates-b-slice2-canonical-HOLD.md  could not probe
                       origin/main:docs/approvals/rates-b-slice2-canonical-approved-by-marco.md
                       for file-gate probe; skipping.
                ADMIT  pr-524-rates-b-slice2-canonical-HOLD.md  (size 8)   exit 0
```

The doc warns of a **false REJECT** (annoying, safe). The truth is a **false ADMIT with the
file-gate silently skipped** (quiet, unsafe). `pr-524` is a prompt that DROPS DATABASE TABLES and
its approval gate is exactly the probe that got skipped.

**Replace with:** *"`lint-prompt.mjs` does NOT reject when `gh` is missing - it WARNs `could not
probe ... skipping` and ADMITs with exit 0, so every `origin/main:` file-gate is silently waived.
An ADMIT obtained without `gh` on PATH proves strictly less than an ordinary ADMIT. Confirm `gh`
resolves before believing any ADMIT."*

## 2. section 9.1 - PowerShell 5.1 DOES have an inline `if` expression

**Currently says:** *"PowerShell 5.1 has no inline `if` expression. `$x = if (...) {...}` parses, but
`"text $(if ...)"` does not. Assign first, interpolate second."*

**Measured on 5.1.26100.9168** - both forms work:

```
$assigned = if ($true) { "ASSIGN-OK" } else { "no" }        -> ASSIGN-OK
"interp=$(if ($true) { 'SUBEXPR-OK' } else { 'no' })"       -> interp=SUBEXPR-OK
```

**Delete the bullet.** Keeping a false constraint costs every station a workaround it does not need,
and it discredits the true bullets sitting next to it.

## 3. section 9.2 - a plain `git fetch <remote> <branch>` DOES move the remote-tracking ref

**Currently says:** *"`git fetch origin main` updates `FETCH_HEAD` only and leaves a stale 'behind
by N'. Use `git fetch origin +refs/heads/main:refs/remotes/origin/main`."*

**Measured on git 2.55.0.windows.3.** A second remote was added with the default refspec, so the
configuration matches `origin` exactly:

```
git remote add s04probe <origin url>
refs/remotes/s04probe/main BEFORE plain fetch : []              (absent)
git fetch s04probe main
refs/remotes/s04probe/main AFTER  plain fetch : 549537a407b8... (written)
FETCH_HEAD                                    : 549537a407b8...
git remote remove s04probe                                       (probe cleaned up, verified)
```

Git's **opportunistic remote-tracking update** covers this whenever the remote has a configured
fetch refspec, which `origin` does.

**Replace with:** *"On git 2.55 a plain `git fetch origin main` DOES opportunistically update
`refs/remotes/origin/main`, because `origin` has a configured fetch refspec. The explicit
`+refs/heads/main:refs/remotes/origin/main` form is still the one to write - it is correct on every
git version and does not depend on the remote's config - but a stale `origin/main` after a plain
fetch is no longer the expected failure and should be investigated, not assumed."*

## 4. section 9.4 - the `--jq` trap has the wrong mechanism AND the wrong failure mode

**Currently says:** *"A `--jq` string has its quotes stripped in transit, jq then fails, and the
output prints `labels=[]` - a broken query that reads exactly like 'no labels'."* (Section 7 guard 8
adds the mechanism: *"it re-splits the quoted expression on spaces."*)

**Measured. Spaces are not the problem, and the failure is not silent.**

Works under both `-File` and `-Command`, spaces and all:

```
gh pr view 1343 --json headRefName --jq '.headRefName'   -> feat/ew-2b-allocation-engine-core
gh pr view 1343 --json labels      --jq '.labels'        -> []      (a TRUE empty: #1343 has no labels)
```

Breaks only when the jq expression contains **escaped double quotes**, and it breaks LOUDLY:

```
--jq '[.labels[].name] | join(\",\")'
  -> failed to parse jq expression (line 1, column 25)
         [.labels[].name] | join(,\)
                                 ^  unexpected token ","

--jq 'if .headRefName then \"HAS-BRANCH\" else \"none\" end'
  -> failed to parse jq expression (line 1, column 22)
         if .headRefName then \HAS-BRANCH\ else \none\ end
```

The double-quote characters are removed in transit and the backslashes are left behind. The pipe and
the spaces survived - the parser reached column 25.

**This matters because the doc tells you to fear a SILENT wrong answer.** The real failure is a loud
parse error on stderr. A guard built to catch a silent `labels=[]` is guarding a failure mode that
was not reproducible here.

**Replace with:** *"A `--jq` expression survives the `-Command` layer intact, spaces included. What
does NOT survive is an escaped double quote: `join(\",\")` arrives as `join(,\)` and jq fails LOUDLY
with `failed to parse jq expression`. Keep double quotes out of jq expressions, or use `--json` plus
`ConvertFrom-Json`. Separately, and still true: assign-then-foreach, because piping a JSON array
straight into `Where-Object` collapses it to ONE object."*

## What must NOT change - these were re-measured and still bite

Do not touch these while editing the block; each was reproduced this run with a control:

- `$` in a `-Command "..."` string: `$probe` vanished entirely, parser error. **Still true.**
- `ls-tree` without `-r`: 1 line vs 440 with `-r`; **0** `*-ready.md` vs **167**. **Still true.**
- `git status` blind to gitignored: probe file invisible; `check-ignore -v` named `.gitignore:75`.
- `Get-Content` false mojibake: **45** `a-hat-euro` sequences reported in `DOCTRINE.md` where node
  finds **1** - and that one is line 362, the doc's own deliberate example. 44 false positives.
  ASCII control returned 0.
- `Set-Content` default wrote an em dash as a single CP1252 byte; `Out-File -Encoding utf8` wrote a
  BOM (`EF BB BF`). **Edit docs with node. Still true.**
- Never count by image name: **18** `node.exe`, exactly **1** is the watcher.
- Blocked commands: `reg query ...` was refused by Desktop Commander.
- `STOP-WATCHER-LANE2` present at `C:\po-watcher` only, by design. No `STOP-WATCHER` anywhere.

## How to land it

1. Edit the four bullets **with node** (`readFileSync`/`writeFileSync`, utf8) - not PowerShell.
   Section 9.3 is not optional advice here; `Set-Content` will double-encode the block you are
   editing and `lint-station` will then fail on a hash you did not intend to change.
2. The `instruments v1` block is a **CANONICAL-BLOCK**. `scripts/pipeline/lint-station.mjs` compares
   its sha256 against the `"instruments"` entry in `docs/pipeline/stations/_canonical-blocks.json`
   (line 2). After editing, run
   `node scripts/pipeline/lint-station.mjs --write-canonical` and commit the regenerated JSON.
   **Bump the block to `v2`** in both the open and close markers - the version is part of the
   contract and a silent hash re-record hides the change from every other station.
3. Verify: `node scripts/pipeline/lint-station.mjs` exits 0 across all station docs.
4. `git diff --numstat` must show a change proportional to four bullets. A far larger number means
   the file was re-encoded - stop and re-do it with node.

## Authority

You have STANDING AUTHORITY to finish the work, commit, push and open the PR for this prompt.

## Scope audit

Docs only: `docs/pipeline/DOCTRINE.md` plus the regenerated
`docs/pipeline/stations/_canonical-blocks.json`. No `sot/`, so CP-24 is not engaged. No code, no
migrations, no seed. Nothing outside `docs/pipeline/`.
