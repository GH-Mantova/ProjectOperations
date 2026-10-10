VERDICT: MERGE

Scope compliance:
- In scope: All 14 changed files match prompt scope (11 production + 3 test spec files). Added 217-line auth.config.spec.ts. All 20 "replace-me" fallback defaults replaced with getOrThrow. Dev-only placeholders correctly set. assertProductionAuthSecrets() implemented and called at factory boot. SEC_A1_AUTH_FAIL_FAST_V1 marker exported. Placeholder prefixes checked correctly (replace-me, dev-only, ci-, change). ConfigService mocks in auth.service.spec.ts and portal-auth.service.spec.ts updated with getOrThrow implementations. Safety-realtime guard mock routes getOrThrow through the same resolver. No files outside scope changed.
- Out of scope: None.

Self-verification claims:
- [GREEN] pnpm build passes (API, web, lint all green).
- [GREEN] pnpm lint passes.
- [GREEN] No grep -rq "replace-me" in apps/api/src (all replaced).
- [GREEN] grep -q "SEC_A1_AUTH_FAIL_FAST_V1" in auth.config.ts present.
- [GREEN] 30 tests in auth.config.spec.ts cover non-production/production, missing/short/placeholder secrets, identical secrets, error message safety, and all placeholder prefixes.
- [GREEN] CI job "API — lint, test, compliance smoke" passes (3m43s).

Risks Marco should know:
- Two CI jobs intentionally fail: "PR gates — diff checks (CP-26)" and "Approval receipt (CP-26)" both fail because the PR carries the do-not-merge label (escalates: true). This is expected and by design — the prompt requires human review before Marco removes the label. All other checks green.
- Production auth failures are fatal by design: if JWT_ACCESS_SECRET or JWT_REFRESH_SECRET are missing, mistyped, short, or identical after deployment, the API refuses to start. Marco's Azure verification (confirmed in prompt gate) ensures these are correctly set in production before this merges. Portal secrets are already derived on main (derivePortalSecret + warnings) and will continue working unchanged.
- This is a security-critical change (SEC-A1_AUTH_FAIL_FAST_V1). The fixture change from "replace-me-*" to "dev-only-*" is intentional — no token forging possible in dev, and "dev-only" prefix itself is blocked in production.

Recommendation: Merge once Marco removes the do-not-merge label after review (label removal releases the CP-26 escalation check).
