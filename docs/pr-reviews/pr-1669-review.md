VERDICT: MERGE

Scope compliance:
- In scope: Re-merge sot/04's generated section against schema.prisma (updated at b7daed3e, PR #1624, 2026-09-05T01:10:29Z) after its header stamp fell behind. Burn down one sot-refs baseline entry (tender-client-notes.controller.ts) via inline sot-ref-allow marker in sot/06 after the target was deleted by eae1c0a8 (#1165, 2026-08-18). Pure SoT + docs mutations, no code.

- Out of scope: None. CP-24 gate confirms (sot/ + docs/ only; not mixed with scripts/, apps/, .github/). Single commit, deterministic re-merge.

Self-verification claims:
- [GREEN] S2 determinism: generator run twice, outputs identical=true (excluding timestamp).
- [GREEN] S3 section-scoped: sha256 of curated MERGED SOURCES region (SOT04-GENERATED:END onward) identical before/after (d5f505615d88a806...).
- [GREEN] S4 no content loss: curated region 1581 lines before, 1581 after.
- [GREEN] S5 scope cap: only sot/ and docs/ touched. No prompt staged.
- [GREEN] S6 post-fix validation: build-relationship-map.mjs --check re-run after edit, exit 0, (293 models, 68 enums, 488 edges).
- [GREEN] S7 one-and-done: no prior sot/ reconcile PR open. Four open PRs at enqueue time are #1662/#1665/#1667/#1668, none reconcile-class.
- [GREEN] Byte-delta assertion: +16 bytes, exactly the added measure name "markupOverride" (edit by function replacer, not string replacement, to avoid DOCTRINE §9.3 trap).
- [GREEN] check-sot-refs.mjs: dangling=0 exempt=20 baselined=1 (was baselined=2), exit 0.
- [GREEN] check-sot-baseline-ratchet.mjs: OK - 2 -> 1 baselined entries, no new pair. Self-test 4 cases passed, exit 0.
- [GREEN] CI: All required checks SUCCESS. Docs-only PR skips API/Web/Data model jobs (expected).
- [GREEN] Mergeable: true. Single commit, clean history.

Risks Marco should know:
- Finding 1 (sot/02 stale roadmap): Ten prior Station 05 breadcrumbs (2026-08-24 through 09-04) have flagged sot/02 §2 "In-PR - open right now" falsely listing #894 and #895 (both MERGED 2026-08-04, 32 days ago). Current live set is #1662/#1665/#1667/#1668. PR body escalates this as a rule-narrowing question for Marco (options a/b/c in the breadcrumb). Not touched in this PR; report-only per Station 05 doctrine. No blocker to merge.

- Finding 2 (registry gap): 32 of 81 API modules absent from sot/01 module registry. Deferred as a spec judgement call, not deterministic drift. Recorded for future triage.

- Finding 3 (transient DO NOT ACT): Status-sweep.ps1 reported DO NOT ACT at 14:11Z due to 2 running git processes; re-measured at 14:13Z and 14:24Z shows 0 processes. Verdict was [LIVE] (true when measured). Documented in breadcrumb as non-issue; no blocker.

- Finding 4 (machine state): C:/po-vg worktree dirty=1, age 1819 min; watcher clone dirty=4. Both dispatched to Station 03. Separate lane; no blocker to merge.

- sot-refs burn-down cleanup: Tender-client-notes.controller.ts was deleted (eae1c0a8, PR #1165, 2026-08-18). Target confirmed absent via git grep on apps/api/src + apps/web/src. Marked retired in sot/06 heading with inline comment + explanatory prose (rows kept as history). Baseline entry deleted with no re-keying required (sot/04 edit is 4 4 lines, sot/06 insertion is below surviving entry at line 2240). Ratchet check passed.

Recommendation: Merge. All safeguards satisfied, CI green, scope clean, no risks unique to this change. The escalation in Finding 1 is a separate Marco decision about sot/02 rule-narrowing and does not block this PR.
