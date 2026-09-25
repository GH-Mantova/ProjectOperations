VERDICT: MERGE

## Scope compliance

**In scope:**
- Release of three human-gate markers (devtree-sync-ff-only-guard, fv2-formrule-contract, tipid-s3-retire-the-name-guard) with dated release notes naming Marco's decision
- Rewrite of two stale paragraphs in tipid-s3 prompt to correctly describe the two-layer gate design (human layer and machine-enforced requires_on_main gates)
- Creation of comprehensive 24-item dispatch document to Station 06 with pipeline-defect cluster, findings enumeration, and ruling-needed placeholders
- All four files correctly confined to docs/pr-prompts/ with zero code, schema, or migration changes

**Out of scope:**
- Nothing. PR strictly adheres to declared scope.

## Self-verification claims

Station 00 declared the following verifications in the PR body, all claimed as passing:

- [✓] `node scripts/pipeline/check-breadcrumb.mjs` — exit 0, CLEAN, `structure: 2 checked, 0 malformed`
- [✓] `node scripts/pipeline/lint-station.mjs` — exit 0, ADMIT: all 8 docs clean
- [✓] `node scripts/pipeline/check-d-register.mjs` (ENFORCE) — exit 0, no unregistered citations
- [✓] `check-pr-title.mjs` against title — PASS, `scope=pr-prompts via=vocabulary`
- [✓] Three released prompts re-linted — ADMIT / ADMIT / GATE_NOT_RELEASED
- [✓] Residual gate markers in the three — 0 of each

All CI checks passed at enqueue time: `check-pr-title`, PR gates, approval receipt, pipeline linter/tests, Windows CI, E2E markers, and CodeQL — all SUCCESS.

## Substantive work verification

**Human gate releases (three):**

1. `pr-devtree-sync-ff-only-guard-HOLD.md`: Marker replaced with release note "RELEASED 2026-09-24 by Marco". Escalation Marco was waiting on has been answered; the premise and test still hold.

2. `pr-fv2-formrule-contract-HOLD.md`: Marker removed, new "HUMAN GATE: RELEASED 2026-09-24" section added explaining what the release covers (clears human hold only; rollback_strategy and destructive-column preconditions still require Marco's review on merge).

3. `pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md`: Marker removed, "HUMAN LAYER RELEASED 2026-09-24 by Marco" section added. Critically, the section correctly explains the two-layer design: human layer cleared, three machine `requires_on_main` gates remain active and checked even after arming (per lint-prompt.mjs:808, `ARMED_GATE_STILL_CHECKED`). Two stale paragraphs were rewritten to remove false descriptions of a marker that is now gone.

**Dispatch document (new):**

The 345-line `00-06-pr-master-2026-09-24-1200-the-pipeline-defect-cluster-is-yours-to-draft-and-nine-gates-were-answered.md` file:
- Hands 24-item pipeline-defect cluster to Station 06 for drafting (items 1–24 enumerated with evidence pointers)
- Records tonight's two fresh findings (F1: WebKit e2e flake, F2: retiring escalations leaves no tracked record)
- Enumerates seven prompts deliberately NOT released with measured reasons (queue-layout-sot-entry, nav-jobs-projects-merge, 524-rates-b-slice2-canonical, siteid-notnull-backfill, retire-tenderclientnote-s2, scopecards-s8b-azure-maps-travel, vendor-invoice-ocr)
- States section C items (13–24) as "RULING NEEDED" with spec up to decision point, as Marco instructed — no guess embedments
- Records constraints that bit real PRs in last 12 hours (module: required, hex-ratchet, required fields, D-register ENFORCE)
- Correctly asserts what was NOT done: no sot/ touch, no Azure/Entra/SharePoint, no label changes, no merges, no self-drafting of section C, no loose untracked copy left in dev tree

## Risks Marco should know

1. **Two-layer gate design on tipid-s3 is working correctly.** The human marker was removed in a reviewable PR (this one), exactly as the prompt body designed. The three machine `requires_on_main` gates still hold because they are checked at arm time (line 808 of lint-prompt.mjs). The three preconditions (backfill script match, backfill receipt with BACKFILL_UNMATCHED_ZERO marker, STEP-11C-DONE marker) are not yet satisfied on main, so arming this prompt will not cause it to run. This is the two-layer design working as intended.

2. **Seven prompts remain held for measured reasons.** Each of the seven in F3 has a named, documented precondition or decision point. The dispatch correctly refuses to release them on "blanket instruction" — pr-nav-jobs-projects-merge stays shut until B-P0a model merge lands (measured: both model Job and model Project still in schema.prisma on main). 524-rates-b-slice2-canonical and siteid-notnull-backfill wait on approval documents absent from main (measured). Two wait on facts only Marco holds (Azure Maps account existence/auth, doc-AI key entry) — both questions are with him now.

3. **Section C ruling-needed items are correctly staged.** Items 13–24 (two-station-00s SAFE-TO-ACT gate, station-00 blindness on 40% of runs, station-freshness detector, tests-docs lane starvation, hourly board PR rebasing, collect cycle inefficiency, binding-read contract scope, RULE 4 ungating, escalations-only-in-watcher-clone, CP-26 vacuous pass, instrument-repair PR merge authority, PR-1612 closed-unmerged) are each written with spec up to the decision point and Marco's options named. None embed a guess about his intent. This follows his standing rule.

4. **No loose untracked state left in dev tree.** The dispatch was written inside the PR's worktree, so no local copy exists to block the next fast-forward. This is correctly verified.

## Recommendation

Merge. This PR executes exactly what Marco authorized ("Release the nine prompts", though the ultimate count was three released, seven held), records the outcomes with full evidence and measurement, hands the defect cluster to Station 06 as agreed, and leaves no guesses on any section C item. CI is green. Scope is clean. The two-layer gate design is explained correctly and working as intended. The dispatch provides Station 06 with everything it needs to draft the 24 items without re-measuring.

---

**Lane classification (DOCTRINE §10.1 step 3):** Station 00 interactive lane, supervised with Marco in chat, acting within recorded authority on `docs/pr-prompts/` (station lane per STATION-CAPABILITIES.md section 5). [NO LANE VERDICT — hand-classified Station 00 authority lane, safe to merge per authority matrix and CI green status.]
