VERDICT: MERGE

Scope compliance:
- In scope: Supervisor board documentation (session breadcrumb, findings from #1911/#1913), new hex ratchet rule added to 01-code-writer.md DONE item 6, arming-log.txt sweep (+1 row for geocodify-v2-host arm), retirement of consumed pr-draftpanel-s2 and pr-ratehub-s6b HOLD prompts to superseded/.
- Out of scope: None.

Self-verification claims:
- [green] HEX_RATCHET_IN_DONE_V1 rule documented and visible in diff (01-code-writer.md lines +6–13).
- [green] .arming-log.txt updated with single row from the session (geocodify-v2-host 03:48:28Z).
- [green] Two consumed prompts retired to superseded/ (pr-draftpanel-s2-finish-this-draft-HOLD.md, pr-ratehub-s6b-push-back-ui-HOLD.md).
- [green] Supervisor session breadcrumb created and documents session state, findings (F1–F4), and actions taken.

Risks Marco should know:
- None. Docs-only, self-referential station work. No code, schema, auth, or migration changes. All CI green.

Recommendation: Merge. This is a supervisor session record and an important guardrail (the hex ratchet rule) now codified where code-writers read it.
