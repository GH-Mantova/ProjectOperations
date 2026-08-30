---
premise: 'grep -q "reports PHANTOM differences between two BYTE-IDENTICAL files" docs/pipeline/DOCTRINE.md'
premise_means: DOCTRINE section 9 carries two claims that were re-measured FALSE on 2026-08-30 at origin/main 077ea6bc - one (9.5, dns-s5) was cured upstream by #1400 six hours after it was written, and one (9.3, Compare-Object) names the wrong instrument as the cause of a real 100-line phantom diff.
scope:
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/stations/_canonical-blocks.json
done_when: '! grep -q "reports PHANTOM differences between two BYTE-IDENTICAL files" docs/pipeline/DOCTRINE.md && ! grep -q "carries .neither. marker" docs/pipeline/DOCTRINE.md && node scripts/pipeline/lint-station.mjs'
size: 1
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# DOCTRINE section 9 carries two claims that no longer reproduce

Filed by Station 04 (Scanner), sweep `instrument-honesty`, 2026-08-30T06:11Z, at
origin/main `077ea6bc`. Both claims live inside the `instruments v2` CANONICAL-BLOCK, so the
edit MUST re-record `instruments.sha` in `docs/pipeline/stations/_canonical-blocks.json`
(currently `2edc6347fb6ab1b2`) in the SAME commit. `node scripts/pipeline/lint-station.mjs`
must exit 0 afterwards - it exits 0 today (measured, "ADMIT: all 7 docs clean").

This is not a style edit. Section 9 is the pipeline's calibration document. A reader who
checks one of its claims, finds it false, and concludes section 9 is unreliable is the exact
failure section 7 exists to prevent.

---

## CORRECTION 1 - section 9.5, `DOCTRINE.md:440`. REFUTED by #1400.

The line reads:

> `pr-dns-s5-checker-flip-to-fail-HOLD` - which standing guidance says must never be armed -
> carries **neither** marker, so it is invisible to the linter and to any grep built on them.

**That was true when written and stopped being true at 2026-08-30T04:17:19Z**, when #1400
merged and added the marker.

Measured 2026-08-30T06:13Z at `077ea6bc`:

```
git show origin/main:docs/pr-prompts/pr-dns-s5-checker-flip-to-fail-HOLD.md
  -> body matches /watcher:\s*do-not-arm/i  ............ True
  -> body -cmatch "DO NOT ARM" .......................... False
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-dns-s5-checker-flip-to-fail-HOLD.md
  -> REJECT  [HUMAN_GATE_PRESENT]
     HUMAN_GATE_PRESENT: line 2 contains <!-- watcher: do-not-arm --> marker.
  -> exit 1
```

Positive control, same linter, same run: `pr-bp-s2-worth-chasing-view-HOLD.md` returned
`ADMIT` exit 0 - so the linter can still produce a pass and the REJECT is a real reading.

**Replace the sentence** with the cured statement, keeping the general lesson (which is still
true and is the point of the paragraph):

> `pr-dns-s5-checker-flip-to-fail-HOLD` carried **neither** marker until #1400 (2026-08-30)
> put `<!-- watcher: do-not-arm -->` on it; `lint-prompt.mjs` now REJECTs it
> `[HUMAN_GATE_PRESENT]` at exit 1. That door - adding the literal marker - is the cure for
> any future never-arm prompt. The general warning stands: a **prose** human gate matches
> neither regex and is invisible to both the linter and any grep built on them.

**Also refresh the census in the same paragraph** (`DOCTRINE.md:437-438`). It says "over the
61 depth-1 `-HOLD`/`-ready` on `origin/main`" and "`## STANDING AUTHORITY` appears on
**51 of 61**". Re-measured at `077ea6bc`: depth-1 `-HOLD`/`-ready` = **59** (#1400 retired two
to `superseded/`), either-marker = **7** (unchanged, now including dns-s5),
`## STANDING AUTHORITY` = **51 of 59**.

---

## CORRECTION 2 - section 9.3, `DOCTRINE.md:397-403`. The mechanism is misattributed.

The bullet reads:

> **`Compare-Object` reports PHANTOM differences between two BYTE-IDENTICAL files.**
> Measured 2026-08-29 on two 285-line copies of `docs/pipeline/stations/03-machine-minder.md`:
> it returned **100 differences** [...] A line-ending / sync-window artefact, not a real diff.

**The 100 is real and reproducible. The named cause is not.** Compare-Object does not lie on a
byte-identical pair; the two files in the original measurement were not byte-identical, because
one of them had been written by PowerShell's `>` redirection, which in PS 5.1 emits **UTF-16LE**.

Measured 2026-08-30T06:14Z, both halves, at `077ea6bc`:

```
# NEGATIVE CONTROL - genuinely byte-identical pair (Copy-Item):
git hash-object src  = 7771f49fa492fc168dec1339fed114b0d42e607e
git hash-object copy = 7771f49fa492fc168dec1339fed114b0d42e607e   (equal)
bytes                = 20489 / 20489
Compare-Object (Get-Content src) (Get-Content copy)  ->  0 differences

# THE REPRODUCTION - the shape the original measurement actually had:
git show origin/main:docs/pipeline/stations/03-machine-minder.md > dump
bytes                = 40980  (exactly 2x)   first 4 bytes = ff fe 2d 00  (UTF-16LE BOM)
git hash-object dump = c6f0b1fe1c47465301e0961ecd4ad2fe493f015b   (differs)
Compare-Object (Get-Content src) (Get-Content dump)  ->  100 differences
git diff --stat origin/main -- docs/pipeline/stations/03-machine-minder.md  ->  empty
```

285 source lines, 100 reported differences, from a file whose *content* git calls identical.

**Rewrite the bullet** to name the real instrument, and keep the operational advice, which is
still correct:

> 🔴 **PowerShell's `>` redirection writes UTF-16LE in PS 5.1.** `git show <ref>:<path> > file`
> produces a file **twice the size**, starting `FF FE`, that no byte-wise or hash comparison
> will ever match the UTF-8 original - while `git diff` correctly reports no difference.
> Measured 2026-08-30 on `docs/pipeline/stations/03-machine-minder.md`: 20489 bytes -> 40980,
> and `Compare-Object` over the two returned **100 differences** on a 285-line file.
> Compare-Object was NOT the liar here; it returns **0** on a genuinely byte-identical pair
> (measured, same run, Copy-Item control). Same family as the `Set-Content -Encoding UTF8`
> bullet above. **To dump a blob, write it with node (`readFileSync`/`writeFileSync`, utf8) -
> never `>` or `Out-File`. To decide whether two files differ, use `git diff`,
> `git hash-object`, or `Buffer.compare` in node.**

This is the RULE 1 half that matters: as written, the doctrine immunises exactly one command
(`Compare-Object`) against a cause that will equally corrupt a grep, a line count, a hash, or a
node read of any file dumped with `>`. Naming the redirection protects every downstream use.

---

## What is NOT in scope

- Do not touch section 9.1, 9.2 or 9.4. Re-measured this run and confirmed still trapped
  (`$` expansion at the `-Command` layer, `ls-tree` without `-r`, `git status` blind to
  gitignored files, `check-ignore -v` silent on a directory, `git branch -r` over-reporting
  vs `git ls-remote`, `lint-prompt.mjs` fail-open on a broken `LINT_GIT_BIN`).
- Do not touch `pr-doctrine-s9-four-false-traps-LOOPING.md`. Its premise
  (`grep -q "no inline .if. expression"`) is DEAD against current DOCTRINE (measured this run,
  0 matches) and it is untracked and matches no watcher glob. It is correctly defused. This
  prompt does not resurrect it and must not be folded into it.

## Why the premise dies on landing (LL-54)

The premise greps for the literal sentence Correction 2 deletes. Once the bullet is rewritten
the string is gone and the premise evaluates false, permanently. `done_when` additionally
requires Correction 1's literal to be gone AND `lint-station.mjs` to exit 0, so a half-landed
edit (prose changed, canonical hash not re-recorded) does not satisfy it.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and open the PR without asking.
This is a docs-only change to `docs/pipeline/` - it touches no code, no `sot/`, no
migration, no Azure/Entra/SharePoint surface, and no production data. Do not merge it yourself;
the supervisor merges.

Both edits and the `_canonical-blocks.json` hash re-record go in ONE commit - `lint-station.mjs`
fails any commit that changes a canonical block without re-recording its hash, so splitting them
red-fails CI.

Re-verify both premises on the CURRENT head before editing. Correction 1 in particular was true
for six hours and then was not; if a later PR has already made either edit, land only the half
that is still live and say so in the PR body.
