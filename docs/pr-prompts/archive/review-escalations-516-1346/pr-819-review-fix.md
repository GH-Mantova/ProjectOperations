# PR 819 — Migration naming fix required

**Action:** Rename migration file before merge.

**Why:** Migration uses bare `YYYYMMDD_feat_description` format, but all migrations from PR #797 onwards use timestamped `YYYYMMDDHHMMSS_*` format for correct alphabetical sort order when multiple migrations land on the same day. Current name will sort incorrectly against any future timestamped 20260731 migrations.

**Mechanical fix:**
```bash
mv apps/api/prisma/migrations/20260731_feat_tip_recommendation_log \
   apps/api/prisma/migrations/20260731120000_feat_tip_recommendation_log
```

Then amend the commit (no re-fire needed — code is correct, only naming).

**Context:** The originating prompt `pr-ops-m2-tip-finder-HOLD.md` specifies `YYYYMMDD_*` per charter §6, but chart rule predates the 20260706+ timestamp convention. Consider updating charter to codify the timestamp requirement, or updating prompt template to say "match existing YYYYMMDDHHMMSS pattern."

Feature ships correct. All functional tests in scope. Waiting on API compliance smoke + e2e to finish before Marco merges.
