PR #1205 (TFM-S7: copy precondition) — clarify "Do NOT merge" note

The PR body says "Do NOT merge per D42" but D42 (tender-folder-model plan, section 6) applies only to **the plan PR** (SLICE 0, #1196), not to code artifact PRs. TFM-S7 itself is a code artifact PR that gates TFM-S8 per the slice dependency chain (section 6.7 of the plan). The note appears to be copy-pasted and should be removed or corrected before merge. Marco: verify intent and delete or clarify the line before merging.
