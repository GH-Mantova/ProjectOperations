## PR #615 — Rebase required before merge

**Problem:** PR #615 (feat(assets): barcode/QR tags + checkout custody chain) is in a DIRTY/CONFLICTING merge state. This is caused by schema drift from recently-merged PRs (#606, #607) that regenerated the data-model docs. pnpm-lock.yaml and docs/data-model/* files need reconciliation.

**Action:** Rebase the PR branch (feat/erp-asset-barcode-checkout) against current main, then force-push. The substantive code changes are clean and will not conflict; only generated files need refresh.

```powershell
git fetch origin
git rebase origin/main
# Resolve any conflicts in pnpm-lock.yaml (keep main's version) and data-model/*.json
# Then:
git push -f origin feat/erp-asset-barcode-checkout
```

**Follow-ups (optional, post-merge):**
1. Add at-least-one-holder validation to CheckoutAssetDto (currently permits all holders to be null, which is permissive).
2. Stage the deferred prompts for AssetReservation and QR image rendering once priorities align.
