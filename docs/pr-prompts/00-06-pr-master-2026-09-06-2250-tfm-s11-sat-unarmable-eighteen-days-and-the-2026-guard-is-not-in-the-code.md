# Station 06 — 2026-09-06 22:50Z — TFM-S11 sat unarmable for eighteen days, and the "2026 only" guard is not in the code

## GROUND

`origin/main` = `734ff8c9`. Interactive run, Marco present. Station 06 designs and STAGES; it never
arms and never merges. Marco chose "re-ground it, then stage the fix" over a bare one-line edit.

## WHAT I MEASURED

`pr-tfm-s11-copy-recursive-preserve-HOLD.md` carried **no standing-authority text of any kind** —
`grep -i "standing authority\|Do not ask"` returned nothing. It has therefore returned
`REJECT [MISSING_STANDING_AUTHORITY]` since it was written on 2026-08-19: eighteen days in which it
could not be armed, and nothing surfaced that.

Re-measured against `734ff8c9` before touching it, because the prompt was three weeks stale and
writes into production SharePoint:

| claim | result |
|---|---|
| premise live — `collectLegacyFilesRecursive` absent | **0 occurrences**; the work is not done |
| folder filter still drops folders pre-service | `.filter(item => !item.isFolder)` present in `admin-imports.module.ts` |
| TFM-S10 gate `site: tender.site` on main | **present** — `requires_on_main` satisfied |
| three `scope` paths exist | all three |
| COPY ONLY holds | **no `delete`, `move` or `rename` call** anywhere in `sharepoint-legacy-copy.service.ts` |

After the edit the prompt lints **PROMOTE (size 3)** with `GATE_RELEASED`, exit 0.

## WHAT CHANGED

Nothing in the repository. Staged for Marco to arm: the edited prompt plus this breadcrumb.

The edit adds (a) the verbatim standing-authority sentence the linter requires, (b) a scoping
paragraph stating that it authorises writing code and opening a PR **and nothing else** — the
`do-not-merge` label is still Marco's alone under D34, and COPY ONLY still binds — and (c) a
re-grounding note recording every measurement above, including the negative one below.

## FINDINGS

1. **A prompt can be permanently unarmable and nothing reports it.** TFM-S11 lint-rejected for
   eighteen days. Nothing in the queue surfaces "prompts that can never arm as written" — they are
   only found by linting each one by hand. **ACTIONED** for this prompt; the general gap is real and
   is a candidate for a queue-report slice.

2. **"2026 tenders only" is NOT enforced in code.** Marco's standing rule for this migration is
   COPY ONLY, never move, never delete, 2026 tenders only. Searching
   `apps/api/src/modules/admin-imports/*.ts` for `2026` returns **only a spec fixture path**
   (`"2. Quotes/Quotes 2026"`) and unrelated dated comments — no year guard in the copy service.
   The rule is enforced by which tenders the job is pointed at, not by an assertion. **ESCALATED** —
   stated plainly in the prompt so no implementer assumes a machine check exists. Whether it should
   become one is Marco's call and needs its own brief; it is explicitly out of scope here.

3. **The other three constraints DO hold in code.** No delete, move or rename call exists in the
   service, so COPY ONLY is presently structural rather than merely instructed. **ACTIONED** —
   recorded, so a future reviewer can diff against it.

## WHAT I DID NOT DO

- I did not arm it, and I did not merge anything.
- I did not add a "2026 only" code guard. That is a scope change, and inventing one inside a slice
  about folder recursion is exactly how an unreviewed rule reaches a production-writing job.
- I did not weaken, reword or remove the existing "STOP — escalates: true" block, the COPY ONLY
  rules, or the D34 label rule. The standing-authority text was added beneath them and defers to them.
- I did not touch `sot/`, and I did not run the migration job.
