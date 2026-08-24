# 04-SCANNER — 2026-08-24 00:30Z — GATE-ALLOW lint covers 1 of 3 arms; PR #1296 is the casualty

SHA true at: `origin/main = c17a8bb6ada686ccba617e4a63e8b314af22448c`
Dev tree HEAD: `c17373121b7330dc48c3cbf114faa3ffa019576d` (1 behind main).

## 1. [MEASURED] `lint-prompt.mjs` guards `migrations` only. `env-vars` and `dependencies` are unguarded.

`scripts/pipeline/lint-prompt.mjs:796-807` — "GATE-ALLOW coherence. 10 PRs failed CP-11 on a
mis-declared or mis-formatted marker." The check tests `scope` against `gate_allow` for
**`migrations` and nothing else**.

Counts in `lint-prompt.mjs`:

| literal | occurrences |
|---|---|
| `migrations` | 11 |
| `env-vars` | **0** |
| `dependencies` | **0** |
| `.env.example` | **0** |
| `package.json` | **0** |

POSITIVE CONTROL — `scripts/pr-gates/pr-gates.mjs` has all three arms, structurally identical:
`allows.has("migrations")` = True, `allows.has("env-vars")` = True, `allows.has("dependencies")` = True.

Consequence:
- prompt touching `prisma/migrations/` with no `gate_allow: migrations` → **REJECTED at arming**.
- prompt touching `.env.example` with no `gate_allow: env-vars` → **ARMED, then CP-12 fails the PR**.
- prompt touching `package.json` with no `gate_allow: dependencies` → same, via CP-13.

## 2. [MEASURED] The casualty: PR #1296, open and red right now.

`gh pr checks 1296` → `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)  fail`.
Job log: `FAIL - CP-12 env-vars [undeclared: FUELPRICE_QLD_BASE_URL, FUELPRICE_QLD_TOKEN,
FUELPRICE_QLD_REGION_LEVEL, FUELPRICE_QLD_REGION_ID, FUELPRICE_QLD_FUEL, FUELPRICE_QLD_BRAND]`.
Every other gate on that job PASSED. The PR body carries **0** `GATE-ALLOW` lines.

The prompt `docs/pr-prompts/processed/pr-qa-env-example-fuelprice-sharepoint-legacy-ready.md`
contains the strings `GATE-ALLOW`, `CP-12`, `env-vars`: **False, False, False**. Its `done_when`
was satisfied locally and the PR still cannot go green.

POSITIVE CONTROL — merged `.env.example` PRs **#986** and **#783** each carry exactly one bare
line `GATE-ALLOW: env-vars` and passed CP-12.

**One-line unblock (Marco's call — the watcher routed #1296 to him, RULE 2):** add the bare line
`GATE-ALLOW: env-vars` at column 0 of the #1296 body. No code change is needed.

## 3. [MEASURED] Second-order: nothing writes the body marker from the frontmatter.

- `scripts/pr-watcher/index.mjs` — mentions `gate_allow`: **False**; mentions `GATE-ALLOW:`: False
  (its only `GATE-ALLOW` hit is a comment about verdict-mirror safety at line 554).
- `.claude/agents/01-code-writer.md` — mentions `GATE-ALLOW:`: True; mentions `gate_allow`: **False**.

So `gate_allow:` frontmatter and the `GATE-ALLOW:` body marker are **two unconnected systems**.
The lint arm asserts the *declaration*, never the *artifact the work produces*. The 14 depth-1
prompts that declare `gate_allow: migrations` are just as exposed to CP-11 as #1296 was to CP-12 —
they are protected only by the code-writer agent remembering its own doc.

Depth-1 `gate_allow` distribution (66 prompts): `none` 51 · `migrations` 14 · `env-vars` 1.

## 4. Suggested prompt (NOT staged — arming and staging are not this station's lane)

Extend the `lint-prompt.mjs` coherence block to `env-vars` (scope matches `^\.env\.example$`) and
`dependencies` (scope matches `package\.json`), mirroring the existing `migrations` arm in both
directions. Gate: `node scripts/pipeline/test-lint-prompt.mjs` gains a case per arm, and a synthetic
prompt with `.env.example` in scope and `gate_allow: none` must REJECT.
Do NOT gate on `check-gate-markers.ps1` — that is a manual after-the-fact diagnostic, not a lint.

---

⚠️ This breadcrumb is written into `docs/pr-prompts/` where **0 of 19** `00-*.md` files are tracked
on `origin/main`. It is therefore invisible to every clean worktree. The same content is in project
memory. Landing these needs a docs PR.
