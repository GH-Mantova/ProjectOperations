---
premise: "git fetch -q origin worktree-agent-aa1a0492c1c384940 && git show origin/worktree-agent-aa1a0492c1c384940:tests/e2e/pr-acceptance/batch4-quotes.spec.ts | grep -q 'name: .Generate Quote., exact: true'"
premise_means: >-
  PR #1875 renamed the Quote tab's export button "Generate Quote" to "Estimate Preview" and the
  download button "Download PDF quote" to "Download estimate preview (PDF)" (QuoteTab.tsx), but
  the PR-acceptance browser suite still clicks the old names at
  tests/e2e/pr-acceptance/batch4-quotes.spec.ts:158, :376, :391, :410, :411. The prompt's scope
  did not include that spec, so the watcher's builder never touched it, and Tendering Browser Smoke
  has been red on EVERY head of the branch (4f1f240b, b74f1e90, 6774e9ec, 0bccbeb9): 2 failed /
  164 passed, both failures in batch4-quotes. The review said MERGE without reading that job.
fixes_pr: 1875
scope:
  - tests/e2e/pr-acceptance/batch4-quotes.spec.ts
done_when: >-
  ! grep -q 'name: "Generate Quote", exact: true' tests/e2e/pr-acceptance/batch4-quotes.spec.ts
  && ! grep -q 'name: "Download PDF quote", exact: true' tests/e2e/pr-acceptance/batch4-quotes.spec.ts
  && grep -q 'name: "Estimate Preview", exact: true' tests/e2e/pr-acceptance/batch4-quotes.spec.ts
  && grep -q 'name: "Download estimate preview (PDF)", exact: true' tests/e2e/pr-acceptance/batch4-quotes.spec.ts
size: 1
gate_allow: none
seed_only: false
escalates: true
backfill: false
module: tendering
---

# Repair PR 1875 - the batch-4 browser suite still looks for the two quote labels the PR renamed

**Do this ON PR #1875's existing branch `worktree-agent-aa1a0492c1c384940`. Do NOT open a new PR.**
The defect is a test the PR's own UI change invalidated. main is green.

## FIRST: re-verify against the CURRENT head

Errors drift, and the watcher rebases this branch after every merge to main. Read the
`tendering-e2e` job log of the **latest** `Tendering Browser Smoke` run on the branch and confirm
the two failures are still the ones below. If they have changed, fix what the log shows and say so.

At the time of writing (run 34743667978, head 0bccbeb9, job 103687539236):

    2 failed
      [chromium] batch4-quotes.spec.ts > view mode: version row shows Edit + actions, no Save/Cancel,
                 no editor strip, no Recalculate      -> expect(locator).toBeVisible() failed, element(s) not found
      [chromium] batch4-quotes.spec.ts > Generate Quote toggles the export panel; PDF + Excel downloads
                 fire; history records both            -> locator.click: Test timeout of 60000ms exceeded
    164 passed (8.8m)

The `CP-26` red is separate: #1875 came from an `escalates: true` prompt, Marco released it in
chat and removed the label; do NOT touch labels, do NOT try to make CP-26 pass.

## What the PR changed that the suite did not follow (QuoteTab.tsx, on the branch)

- header button `Generate Quote` -> `Estimate Preview`
- panel heading `Generate quote` -> `Estimate preview`
- download button `Download PDF quote` -> `Download estimate preview (PDF)`
- toast `PDF quote generated` -> `Estimate preview PDF generated`

The PDF filename is NOT changed - `estimate-export.service.ts:448` still builds
`IS_Quote_<tenderNumber>.pdf` - so the `suggestedFilename()` assertions at :393 and :420 stay as
they are. Verify that line on the current head before you leave those two assertions alone.

## What to change - `tests/e2e/pr-acceptance/batch4-quotes.spec.ts` only

1. `:158`  `getByRole("button", { name: "Generate Quote", exact: true })` -> `name: "Estimate Preview"`.
2. `:376` and `:410` - the same click, same rename.
3. `:391` `name: "Download PDF quote"` -> `name: "Download estimate preview (PDF)"`; `:411` the
   same locator in the `toHaveCount(0)` assertion.
4. The test title at `:370` and the comment at `:157` may say "Estimate Preview" instead of
   "Generate Quote" so the next reader is not misled; the PR-number table in the file header
   (`:15`, `:22`, `:33`) records history and stays as written.

Nothing else. Not the Excel download, not the filenames, not `QuoteTab.tsx`.

## Verify, then push

1. `pnpm exec tsc --noEmit -p tests/e2e` if the suite has its own tsconfig, otherwise
   `pnpm exec playwright test --list tests/e2e/pr-acceptance/batch4-quotes.spec.ts` - the file
   parses and lists its tests.
2. If a seeded API and web are available to you, run the two tests; if not, say so - CI runs them.
3. Commit on the branch with a message that describes the change and does NOT put the words
   fix/fixes/close/closes/resolve/resolves immediately before `#1875`.
4. Push. Do not open a PR - #1875 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1875 is the PR** - push to its branch
`worktree-agent-aa1a0492c1c384940` and do not open another.
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

`escalates: true` is inherited from #1875 - it gates the MERGE, not the RUN.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already repaired` and exit.
- Touch only the file in `scope`.
- Never add or remove a label; never merge.
