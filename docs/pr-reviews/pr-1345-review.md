VERDICT: MERGE

PR #1345 - docs(pipeline): correct four measured-false claims in DOCTRINE section 9
Reviewed 2026-08-27 01:05Z against head 7d0d6df0 (base main 214ff703).

WHO REVIEWED THIS, AND WHY IT IS NOT THE USUAL AGENT
----------------------------------------------------
This review was performed by Station 06 (PR Master), not by the pr-fix-reviewer agent.
rev-1345-ready.md was queued at 00:21:39Z and had NOT been consumed as of 01:05Z (~44 min).
No task of any kind has been consumed since 22:34:01Z - a 2.5 hour gap. Per Station 00's
00:08Z breadcrumb the watcher node died at 00:13:13Z (exit code 1; 98 prior occurrences in
watcher-launch.log) and a Keepalive relaunched it at 00:15:03Z as pid 28328. Marco asked
explicitly that a review happen. It was not going to happen on its own, so I did it.
rev-1345-ready.md remains queued and untouched; if the agent later runs, its verdict should be
reconciled with this one rather than assumed to supersede it.

SCOPE COMPLIANCE - PASS
-----------------------
Originating prompt: pr-doctrine-s9-four-false-traps (now renamed -LOOPING, see PROVENANCE).
  scope:      docs/pipeline/DOCTRINE.md
              docs/pipeline/stations/_canonical-blocks.json
  size 2, gate_allow none, escalates false.

PR touches exactly those two files and nothing else:
  docs/pipeline/DOCTRINE.md                       +18 -12
  docs/pipeline/stations/_canonical-blocks.json    +2  -2
  Total +20 -14, 2 files. No out-of-scope additions.

done_when - PASS (verified on head, not taken from the PR body)
---------------------------------------------------------------
Clause 1: ! grep -q "no inline .if. expression" docs/pipeline/DOCTRINE.md
  MEASURED on head: 0 occurrences. Clause satisfied.
  Sanity floor: DOCTRINE.md is 420 lines with 2 CANONICAL-BLOCK markers, so the file was
  read, not empty.
Clause 2: node scripts/pipeline/lint-station.mjs
  CI green including "Pipeline - watcher + linter tests". lint-station is the job that fails
  when a canonical block is edited without re-recording its hash, so its pass is the real
  check on the v1->v2 bump.

CANONICAL BLOCK - PASS
----------------------
  instruments      v1 -> v2, sha re-recorded as f012f0596e33037c
  station-contract v1, sha 6f31ef829aa6cd41 - UNCHANGED, correctly untouched
  DOCTRINE.md carries 0 remaining "instruments v1" references and 2 "instruments v2"
  (open and close markers both bumped consistently).

CI - PASS
---------
All checks green on head 7d0d6df0. No failing or pending checks at 01:05Z.

THE FOUR CORRECTIONS - assessed individually
--------------------------------------------
1. 9.5 lint-prompt.mjs with gh missing. Polarity inverted from "reports REJECT" to "WARNs and
   ADMITs with exit 0, silently waiving every origin/main file-gate". This is the one that
   mattered. It makes ADMIT weaker, not stronger, and it names the consequence explicitly
   (a prompt that drops database tables can obtain a waived approval gate). Correct direction;
   a safety rail added, not removed.

2. 9.1 PowerShell 5.1 inline if. Bullet deleted as false. Consistent with PS 5.1 semantics -
   subexpression $( ) does accept statements including if.

3. 9.2 plain git fetch origin main. Rewritten: on git 2.55 with a configured fetch refspec
   (which origin has) a plain fetch DOES update refs/remotes/origin/main. Conservative - it
   still recommends the explicit refspec form as the portable one, and only drops the
   "stale origin/main is the expected failure" framing.

4. 9.4 the --jq trap. Rewritten from "quotes stripped on spaces, jq fails, output prints
   labels=[] - reads exactly like no labels" to "the expression survives intact, spaces
   included, but escaped double quotes do NOT; jq fails LOUDLY with failed to parse jq
   expression". CORROBORATED INDEPENDENTLY: Station 06 hit this exact failure at 12:20Z on
   2026-08-26 - gh api ... --jq '"size=\(.size) sha=\(.sha)"' returned
   `failed to parse jq expression (line 1, column 6) ... unexpected token "\\"` - while plain
   --jq .size worked correctly dozens of times across the same session. The OLD text described
   a SILENT failure that did not occur; the new text describes what actually happens. The
   assign-then-foreach guidance is preserved, and Station 00 re-confirmed that array-collapse
   bug independently at 00:08Z.

PROVENANCE - the originating prompt looped. Checked; this PR is not damaged by it.
-----------------------------------------------------------------------------------
pr-doctrine-s9-four-false-traps looped and produced TWO PRs: #1345 and #1346
("...(v2)"). Station 00 closed #1346 as a duplicate at 00:24:44Z and renamed the prompt to
-LOOPING at 00:23Z to stop it. Because a looping run can double-apply edits, I checked this
PR's commit list and net diff specifically:
  df46d88c  docs(pipeline): correct four measured-false claims in DOCTRINE section 9
  7d0d6df0  Merge branch 'main' into docs/doctrine-section-9-corrections
One content commit plus one merge to pick up #1343/#1344. Net diff +18 -12 on DOCTRINE, which
is the size of a four-bullet correction, not a doubled one. No loop damage in this PR.

RISKS MARCO SHOULD KNOW
-----------------------
- This edits station law. Every station reads DOCTRINE section 9. All four changes either
  delete a trap measured false or strengthen a warning; none removes a live safety rail.
- Correction 3 is environment-specific (git 2.55, this dev box). The new wording acknowledges
  that and keeps the portable form as the recommendation, so the risk is contained.
- rev-1346-ready.md is still queued against a PR that was closed at 00:24:44Z. Harmless
  litter, but it will consume a watcher slot if the queue ever drains.

RECOMMENDATION: MERGE. Scope-compliant, done_when satisfied on the head, CI green, canonical
block correctly re-recorded, and the one correction I could test independently matches my own
measured evidence.
