VERDICT: MERGE

Scope compliance:

In scope:
- DOCTRINE.md §9.4: one bullet added (19 lines) documenting GitHub MCP `merged: false` trap (finding F2 from blind 04:08Z run)
- _canonical-blocks.json: hash re-recorded per lint-station.mjs requirement for §9 edits
- Breadcrumbs collected and archived: two prior runs (03:08Z, 04:08Z) transitioned to archive/ via RENAME
- This run's breadcrumb file added: new tracked file in PR worktree (270 lines, no loose dev-tree copy)
- Single commit on branch; docs-only (no code, migrations, sot/, labels, arm operations)
- All five changed files match the enqueued file list exactly

Out of scope:
- F1 (gitignore policy): correctly deferred to Marco. PR documents the finding (needs-marco/ is gitignored per .gitignore:82) but does NOT change .gitignore. Three options (a: track it, b: document it, c: track index) are laid out in the breadcrumb for Marco to choose.
- #1690 (CodeQL alert PR): correctly left unmerged. Driven green by a separate commit (b1710653) on that PR's branch, but NOT merged as per "hand-classified Marco's" rule. PR body confirms this.

Self-verification claims:
- [PASS] Dev tree fast-forwarded before anything else (306e4a14 → 3e16855c)
- [PASS] status-sweep.ps1 captured and verified safe
- [PASS] Board state measured (one open PR #1690, was only red, driven green on CodeQL alert)
- [PASS] F1 re-measured with controls (git check-ignore -v exit 0; git ls-files exit 1; positive control CLAUDE.md exit 0)
- [PASS] F2 re-measured (same PR #1685, two endpoints ~90s apart; list response merged:false, get response merged:true)
- [PASS] DOCTRINE §9.4 byte delta asserted (expected 1728 == actual 1728 per breadcrumb)
- [PASS] #1690 NOT merged (explicit in prompt line 252)
- [PASS] No arm/disarm (0 at start, 0 at end)
- [PASS] No .gitignore change (deferred to Marco)
- [PASS] No sot/, C:\po-watcher, or unwanted needs-marco edits

CI status:
- All 13 checks: SUCCESS or SKIPPED (correct for docs-only PR)
- Changed-path filter, CodeQL (2 jobs), Tendering Smoke, PR gates, Approval receipt, watcher+linter, arm-prompt (Windows), E2E restoration, misc skipped
- No failures

Risks Marco should know:

1. **F1 — gitignore policy is open:** The escalation channel (docs/pr-prompts/needs-marco/) is gitignored, making 28 open escalation files invisible to CI and cloud lanes. The prompt documents this discovery but correctly defers the policy fix to Marco (track it, document it, or track an index). This is NOT a bug in the PR — it is correctly handling a policy question Marco must decide.

2. **GitHub MCP trap documented:** The DOCTRINE §9.4 bullet documents a real trap: `list_pull_requests(state=closed)` returns `merged: false` on every entry, including merged PRs, while `pull_request_read(method=get)` returns the correct `merged: true`. The falsifying probe is named in the bullet. Any run relying on the list field will generate phantom "stranded branch" escalations.

3. **#1690 unmerged:** PR #1690 (pr-scopesub-s5-sub-tab-ui, CodeQL HIGH alert on single-pass tag strip) was fixed and driven green but left for Marco review. No smoke run was executed for it (Marco-classified, not this station's lane). Read-back on the CodeQL fix shows PASS; other checks (API, tendering-e2e, Web) were still in-flight when the prompt was written.

Recommendation: Merge. Scope is clean, CI green, no code risk. The two deferred decisions (F1 gitignore policy, #1690 final review) are correctly escalated to Marco without premature closure.
