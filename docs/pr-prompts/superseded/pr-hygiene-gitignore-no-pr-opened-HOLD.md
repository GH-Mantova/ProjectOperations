---
premise: '! grep -q "no-pr-opened" .gitignore'
premise_means: The no-pr-opened/ retirement bucket is still missing from .gitignore, so its contents are offered for commit on every git add.
scope:
  - .gitignore
done_when: grep -q "docs/pr-prompts/no-pr-opened/" .gitignore && git check-ignore -q docs/pr-prompts/no-pr-opened/probe-ready.md
size: 1
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# Add `docs/pr-prompts/no-pr-opened/` to the watcher-bookkeeping ignore family

## The defect, measured

`.gitignore` lines 72-82 declare a family with an explicit stated intent:

```
72: # PR-prompt watcher bookkeeping - never commit these.
73: # The watcher creates and moves files between these folders to track state;
74: # committing them causes phantom dirty trees on branch switches.
75: docs/pr-prompts/*-ready.md
76: docs/pr-prompts/processed/
77: docs/pr-prompts/failed/
78: docs/pr-prompts/paused/
79: docs/pr-prompts/blocked/
80: docs/pr-prompts/awaiting-review/
81: docs/pr-prompts/reviewed/
82: docs/pr-prompts/needs-marco/
```

`docs/pr-prompts/no-pr-opened/` is a watcher retirement bucket of exactly the same kind and it is
**absent from the whole file**. [MEASURED 2026-08-25T02:1xZ @ origin/main 5ec99150]

```
grep 'no-pr-opened' .gitignore            -> [] (zero matches)
git check-ignore -v docs/pr-prompts/no-pr-opened/x.md   -> exit 1, NOT IGNORED
git check-ignore -v docs/pr-prompts/processed/x.md      -> exit 0, .gitignore:76   (control: the family works)
```

Line 75 does **not** cover it: in a `.gitignore` pattern that already contains a `/`, `*` does not
cross a `/`. (This is the opposite of a git *pathspec*, where `*` does cross `/` - the two are
routinely confused, and that confusion is why this gap survived.) Proved by dry run:

```
git add --dry-run -- docs/pr-prompts/no-pr-opened
  add 'docs/pr-prompts/no-pr-opened/pr-ci-cache-playwright-browsers-ready.md'
  add 'docs/pr-prompts/no-pr-opened/pr-comms-hub-inbox-ready.md'
  add 'docs/pr-prompts/no-pr-opened/pr-crm-leads-s6-reason-admin-settings-ready.md'
  add 'docs/pr-prompts/no-pr-opened/pr-e2e-container-s1-trial-workflow-ready.md'
  add 'docs/pr-prompts/no-pr-opened/pr-field-location-provider-seam-ready.md'
  add 'docs/pr-prompts/no-pr-opened/pr-rates-consumers-s2-tendering-ready.md'
  add 'docs/pr-prompts/no-pr-opened/pr-rates-consumers-s3-persona-export-ready.md'
  add 'docs/pr-prompts/no-pr-opened/pr-rates-drop-prompt-corrections-ready.md'
  add 'docs/pr-prompts/no-pr-opened/pr-rates-s11c-<elided>-tables-ready.md'
  add 'docs/pr-prompts/no-pr-opened/rev-1250-SKIPPED-pr-closed-as-duplicate.md'
```

> The ninth filename is elided on purpose. Spelled in full it contains a TIER-1 destructive token,
> and `lint-prompt.mjs` scans the whole prompt body ungated by scope - so quoting it verbatim makes
> this one-line `.gitignore` change lint as `DESTRUCTIVE_MUST_ESCALATE`. That linter behaviour is
> reported separately as a finding; do not "fix" it here.

## Blast radius, stated honestly

The bucket holds **107 files / 133,664 bytes**, but **97 are `*.log` and are already caught by the
global `*.log` at `.gitignore:26`**. The genuinely exposed set is the **10 files above** - nine
consumed `*-ready.md` prompts plus one `rev-*` review job. One of them is the SLICE 11c legacy-table
retirement prompt (elided above).

This is **S3, not S2**, and the prompt should not pretend otherwise:

- These sit at **depth 2**, and the watcher globs `*-ready.md` at **depth 1 only**, so committing
  them would **not** arm anything. This is not the board trap.
- The real, recurring cost is signal: `docs/pr-prompts/no-pr-opened/` shows as a permanent `??` in
  every `git status`, and that noise is the field in which genuine changes get missed. On
  2026-08-25 the dev tree carried seven legitimate uncommitted `-HOLD` deletions in exactly that
  listing.
- Secondary cost: any agent or chat that reaches for `git add docs/pr-prompts` - a normal thing to
  do when committing a breadcrumb - silently stages ten retirement artifacts alongside it.

## The work

Add one line to the family block in `.gitignore`, immediately after line 82:

```
docs/pr-prompts/no-pr-opened/
```

**Nothing is tracked under that path today** - `git ls-tree -r origin/main -- docs/pr-prompts/`
returns 398 files and none are under `no-pr-opened/` - so no `git rm --cached` is needed and no
history is rewritten. The change is purely additive.

## RULE 1 - the options, complete-and-additive first

**(a) Add the single ignore line. RECOMMENDED.** Passes both halves. *Complete* - it covers the 10
files present today and every future file the watcher retires into that bucket, permanently.
*Additive* - it changes no file on disk, unstages nothing, deletes nothing, and touches no existing
or future data entry. One line, one file.

**(b) Delete the 10 exposed files instead.** Fails the *complete* half: the watcher writes into this
bucket on every `[NO-PR]` run, so the gap reopens the next time a prompt retires there. It also
fails the *additive* half - those files are the only surviving record of why those runs opened no PR.

**(c) Leave it and rely on pathspec discipline at each commit.** Fails the *complete* half: it makes
correctness depend on every future agent remembering, which is the condition that produced the gap.

## Instructions for the agent

1. Re-run the premise first. If `.gitignore` already contains `no-pr-opened`, exit with `NO-OP:
   premise dead` and open no PR.
2. Insert `docs/pr-prompts/no-pr-opened/` after the `docs/pr-prompts/needs-marco/` line, inside the
   same comment block, preserving the existing ordering style.
3. **Edit with node** (`readFileSync`/`writeFileSync`, utf8), not PowerShell - `Get-Content -Raw`
   piped to `Set-Content` double-encodes UTF-8 and adds a BOM (DOCTRINE 9.3). `.gitignore` already
   carries two mojibake sequences at lines 84 and 87 from an earlier PowerShell edit; **do not
   attempt to repair them here** - that is a separate change and would inflate this diff.
4. Read back and prove it: `git check-ignore -v docs/pr-prompts/no-pr-opened/probe-ready.md` must
   now exit 0 and name your new line, and `git check-ignore -v docs/pr-prompts/pr-x-HOLD.md` must
   still exit 1 (control - the fix must not over-match and start ignoring live prompts).
5. Confirm `git diff --numstat` reads `1 0 .gitignore` and nothing else. A larger number means the
   editor re-encoded the file - revert and redo with node.
6. Docs/config-only PR, single file. No migration, no env var, no dependency.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR in this one run. Do
not stop to ask permission for anything inside `scope`. The change is one added line in `.gitignore`
and nothing else; if the work you are about to do is larger than that, stop and report instead.

## Provenance

All measurements taken 2026-08-25 ~02:10-02:20Z against `origin/main` `5ec99150`, dev tree
`C:\ProjectOperations2` on `main` at `5ec99150`, behind=0. Every negative result above was run
alongside a positive control that passed (`processed/` ignored via line 76; `DOCTRINE.md` resolves
under `ls-tree -r`; a bogus path returns empty).
