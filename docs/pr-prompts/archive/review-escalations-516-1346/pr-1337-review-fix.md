## PR #1337 flagged FIX-FORWARD — rates-consumers SLICE 3 partial delivery

The agent shipped `rates-export.service.ts` migration (estimatePlantRate → listRates("plant")) with full test coverage and export-format preservation, but left `lookup-rate.handler.ts` unmigrated. Reason: the three fields the handler publishes (plant.fuelRate, waste.loadRate, waste.wasteGroup) are not in ListedRate, and the prompt forbids resolver edits.

**Prompt completion criterion is not met:** The `done_when` grep will fail because 16 prisma calls remain in lookup-rate.handler.ts.

**Blocker file exists:** `docs/pr-prompts/needs-marco/rates-consumers-slice3-blocker.md` (created during the initial blocked attempt) lays out three options:
- A. Widen slice 3 to extend ListedRate.info (adds fuelRate, loadRate, wasteGroup) — ~30 lines, enables full migration.
- B. Drop the three fields from persona schema and export (breaks user contracts).
- C. Defer slice 3 until a micro-slice extends ListedRate.info first.

**Recommendation:** Recommend Option A (extend ListedRate.info in-cluster), accept this PR as partial, and queue a follow-up slice to complete the migration. Alternatively, if those three fields are non-critical (internal LLM tool only, not exported), accept rates-export alone and document the lookup-rate.handler.ts calls as "intentionally left" to close the blocker.

**CI Status:** All checks green except tendering-e2e (stalled for unrelated reasons).
