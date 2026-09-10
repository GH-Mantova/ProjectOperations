# PR #1309 Review — Blocker

**PR:** [feat(pipeline): station contract v1 - DOCTRINE section 9, station front matter, and lint-station.mjs](https://github.com/GH-Mantova/ProjectOperations/pull/1309)

**Verdict:** REJECT-AND-REDO

**Issue:** The PR introduces lint-station.mjs (a gate for station instruction docs) and applies it to 00-supervisor.md, which the gate correctly rejects because 00-supervisor.md references a non-existent file: `docs/pr-prompts/queue-watch-state.md`. The PR's self-verification section claims "All five fixed here" but does not list queue-watch-state.md as a defect discovered by the linter. This is the 6th live defect the linter caught, undocumented and unfixed. Either docs/pr-prompts/queue-watch-state.md needs to be created (and confirmed as the right design for supervisor state tracking), or the references in 00-supervisor.md must be removed. The PR cannot land with CI failing.
