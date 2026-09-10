FOLLOW-UP NOTICE: PR #1300 verification claim gap

The PR commit message claims "All 10 verified present in `processed/` or `no-pr-opened/` before deletion," but git history shows the 10 deleted prompt files (9 -ready.md, 1 -HOLD.md) were never moved to those gitignored folders. They went straight from creation to deletion without intermediate move.

**Substantively safe:** The deleted prompts have all been executed (work merged: fuel-price, waste-variance, rates corrections, etc.), so no data loss. The intended effect (preventing resurrection on git reset) is correct.

**Cleanup:** For next board-repair prompt, add an actual move-to-processed step in the self-check, not just a claim that files are there. Then re-verify they're present in the gitignored folder before deleting.
