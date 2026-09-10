VERDICT: MERGE

Scope compliance:
- In scope: Single file change to `scripts/pipeline/status-sweep.ps1` section 3, exactly as specified by the originating prompt (F1 from Station 04's 2026-09-10 gate-liveness sweep).
- Out of scope: None. No changes to `$buildRunning`, `$lockInteractive`, `$lockClone`, `$headless`, or any other section. `$boardBusy` expression remains byte-identical, only the meaning of `$gitProc.Count` changes from unscoped to scoped.

Self-verification claims:
- [PASS] GITPROC_SCOPED_V1 marker present in line 254 comment — grep confirmed exit 0
- [PASS] Control 1 (idle): scoped=0, unscoped=0, verdict unaffected by git gate
- [PASS] Control 2 (negative, unrelated repo): scoped=0, unscoped=1, verdict=SAFE TO ACT (unscoped git did NOT trigger DO NOT ACT)
- [PASS] Control 3 (positive, dev tree): scoped=1, unscoped=1, verdict=DO NOT ACT correctly fires on scoped hit
- [PASS] Section 7 DO NOT ACT message updated to say "a git process is touching our trees" (accurate to new behavior)
- [PASS] No removal of unscoped total — still emitted as [INFO] line (RULE 1: additive, existing signals untouched)

CI status:
- 14 of 15 checks COMPLETED and SUCCESS: all critical tests green (PR gates, pipeline tests, lint, CodeQL, compliance)
- 1 check IN_PROGRESS: tendering-e2e (browser smoke test, not relevant to PowerShell changes)
- mergeStateStatus: BLOCKED (due to e2e still running, not due to test failure)

Risks Marco should know:
- None identified. The change is minimal, isolated, and exactly matches the prompt's specification. Measurement is live (three concrete controls pre-landing) and the gate remains functional (positive control demonstrates DO NOT ACT still fires on real board mutation).
- No migration, schema, seed, or permission code touched. File is in `scripts/`, routing to Marco at merge per DOCTRINE 10.1 is correct and expected.

Recommendation: Merge once tendering-e2e completes (it will not affect this change's correctness; 14/14 relevant tests already green).
