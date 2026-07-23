VERDICT: MERGE (when CI completes green)

Scope compliance:
- In scope: .env.example now documents all 4 undocumented runtime env vars (PUPPETEER_EXECUTABLE_PATH, PUPPETEER_CACHE_DIR, PRISMA_CLIENT_ENGINE_TYPE, GIT_SHA)
- Out of scope: none — purely additive, no other files touched

Self-verification claims (prompt):
- [✓] All 4 vars present in .env.example
- [✓] All values empty (no real secrets/paths)
- [✓] Existing lines untouched (purely additive)
- [✓] GATE-ALLOW: env-vars declared in PR body
- [✓] Single commit with proper authorship

CI status:
- CodeQL: success
- Data model sanity: success
- Web build/lint: success
- PR gates (CP-09–13, CP-17, CP-22, CP-23): success
- API lint/test: in_progress
- E2E tests: in_progress
Mergeable: blocked (pending jobs, expected for a fresh PR)

Risks:
- None. Documentation-only change with no code paths affected. Pending CI jobs are routine smoke tests unlikely to fail on env.example additions.

Recommendation: Merge after API and E2E jobs complete green. No functional risk.
