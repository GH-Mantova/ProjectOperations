VERDICT: MERGE

---

**Scope compliance:**
- In scope: Single new HOLD prompt file `docs/pr-prompts/pr-scopecards-s7-one-cutting-total-HOLD.md` (237 lines, docs-only)
- Out of scope: None

**Self-verification claims:**
- N/A — HOLD prompt (not yet armed); self-verification applies only at execution time

**Dependency verification:**
- [MEASURED] Requires S6 marker `CUTTING_ONE_SURFACE_V1` on main
  - `git show c2511054:apps/web/src/pages/tendering/ScopeCuttingSheet.tsx | grep CUTTING_ONE_SURFACE_V1` confirms marker present
  - PR #2071 merged at c2511054, reachable from current main (eb3086fa)
  - Current main is eb3086fa (PR body grounding verified)

**CI status:**
- [MEASURED] All required checks PASS (green)
  - Changed-path filter, CodeQL (actions + javascript-typescript): SUCCESS
  - PR gates (CP-09-13, CP-17, CP-22, CP-23): SUCCESS
  - Approval receipt (CP-26): SUCCESS
  - Pipeline (watcher, linter, arm-prompt tests, E2E markers): SUCCESS
  - API/Web jobs appropriately SKIPPED (docs-only change)
  - Mergeable: true

**File structure:**
- [MEASURED] Prompt follows house style
  - Proper frontmatter: premise, scope, done_when, size, gate_allow, backfill, seed_only, escalates, module, cluster, cluster_order, requires_on_main, design_ref
  - Marked HOLD (status: "not armed")
  - Single commit with Claude co-author tag
  - References S6 carry-overs (sanitiseSawElevation, METHODS_BY_EQUIPMENT, web sheet unchanged)
  - Clear "Build this" implementation section with function signatures, migration strategy, test requirements
  - Proper guardrails in "Do NOT" section

**Risks Marco should know:**
- [INFERRED] Escalates: true in frontmatter — per DOCTRINE §5b, this gates MERGE, not RUN. File location (prompt root, not needs-marco/) correctly signals arming decision is Marco's, not automatic
- [INFERRED] This is a staging PR only. The actual API implementation (cutting-line-pricing.ts, three migrations, five modules touched) will be substantial when armed and executed; Marco reviews that PR

**Recommendation:** Merge as staged HOLD. No code to execute; prompt is properly formatted and dependency (S6 marker) verified present on main.
