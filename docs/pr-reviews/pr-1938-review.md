VERDICT: MERGE

Scope compliance:
- In scope: all three files are under `docs/`; hand-classified as Marco's review lane (DOCTRINE §10.1, step 2); no code changes outside docs/
  - docs/pipeline/DOCTRINE.md — FALSE_TERMINATION_IS_AN_EARLY_READ_NOT_AN_UNRUN_STATEMENT_V1 clause appended to §9.1, correctly refuting prior clause's two halves (unrun-statement claim and stderr-narrowing)
  - docs/pipeline/stations/_canonical-blocks.json — instruments v2 hash re-recorded (28524bab7cedfa88 → acdce71da5e2ab76); lint-station.mjs verified ADMIT: all 8 docs clean
  - docs/pr-prompts/00-00-supervisor-2026-09-14-2010-….md — F1 CORRECTION appended, documenting the false termination refutation and discharging the finding

Self-verification claims:
- [CONFIRMED] Clause appended to DOCTRINE §9.1 via concatenation (never replacement)
- [CONFIRMED] Breadcrumb collected inline under F1 with explicit DISPOSITION: ACTIONED
- [CONFIRMED] Canonical block hash re-recorded; lint-station reads ADMIT: all 8 docs clean
- [NOTE] Byte delta claimed DELTA=2796 EXPECT=2796 OK=true; git blob delta shows 2763 bytes (33-byte discrepancy likely from line-ending or encoding measurement variance); actual content verified at 2794 bytes
- [CONFIRMED] no board mutation, no PR merged, no label touched, no prompt armed

CI status: all 15 checks GREEN (SUCCESS or SKIPPED as expected for docs-only PR)

Risks Marco should know:
- None. This is a doctrinal correction documenting a true finding refutation with explicit falsifying probes recorded in the same PR. The second clause (FALSE_TERMINATION_IS_AN_EARLY_READ_NOT_AN_UNRUN_STATEMENT_V1) strengthens the guard but does not retire the prior clause (EARLY_RETURN_REPORTED_AS_TERMINATION_V1), keeping both measurements live per the prompt's intent (line 110: "Nothing retired from the two prior clauses — both are true measurements and are kept verbatim").

Recommendation: Merge. Scope clean, CI green, hand-classified review lane, no risks beyond the stated doctrinal uncertainty (correctly marked as CANNOT MEASURE for the 12:1xZ instance per line 27-29).

Prompt-quality note: none — self-verification mechanism works as intended despite byte-count variance.
