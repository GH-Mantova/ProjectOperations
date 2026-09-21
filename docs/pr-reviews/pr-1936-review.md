VERDICT: MERGE

Scope compliance:
- In scope: All changes are strictly within Station 00's lane (`docs/pipeline/**` and `docs/pr-prompts/**` only). Four files modified/added: DOCTRINE.md (section 9.1 instrument trap clarification), _canonical-blocks.json (hash re-record), new breadcrumb added, previous breadcrumb archived via git mv. No code, no migrations, no board mutations.
- Out of scope: None detected.

Self-verification claims:
- [green] DOCTRINE.md edit by concatenation with byte delta verification: `BEFORE=190960 AFTER=193353 DELTA=2393 EXPECT=2393 OK=true`. New marker `COMMAND_LAYER_EXPANSION_IS_THE_NESTED_FORM_V1` present (1 hit), prior marker intact (1 hit), NEG 0.
- [green] `_canonical-blocks.json` re-recorded: hash changed from `e6aa43878f7ca844` to `89c1d4963993b43b`. Linter reads `ADMIT: all 8 docs clean` after re-record.
- [green] Breadcrumb written inside PR worktree (no loose untracked copy left in dev tree).
- [green] Previous breadcrumb archived by git mv into `docs/pr-prompts/archive/`. All findings dispositioned.
- [green] No board mutations: both open PRs (#1923, #1920) untouched with correct RULE 2 verdicts logged; no labels removed; nothing armed.

Risks Marco should know:
- None identified. All CI checks green (16 total: pipeline tests, linter, gates, CodeQL, Tendering smoke all SUCCESS/SKIPPED as appropriate).

Recommendation: Safe to merge. Station 00 ran as designed, correctly clarified the expansion trap ambiguity, and preserved the prior measurement block verbatim while adding the nested-form test case.
