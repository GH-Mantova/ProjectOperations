---
premise: '! grep -q requires_on_main scripts/pr-watcher/index.mjs'
premise_means: The intake linter now ACCEPTS `requires_on_main:` (SLICE 1, PR #1184) but the watcher has never heard of it. A prompt declaring that key today parses to nothing, gates on nothing, and dispatches immediately - while its author reads the front-matter and believes it is chained. SLICE 1 shipped a warning about exactly this state; this slice is what retires that warning.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/watcher-frontmatter-deps.test.mjs
  - scripts/pipeline/lint-prompt.mjs
  - docs/pr-prompts/PROMPT-SCHEMA.md
done_when: grep -q requires_on_main scripts/pr-watcher/index.mjs && node --test "scripts/pr-watcher/__tests__/*.mjs" && node scripts/pipeline/test-lint-prompt.mjs && pnpm lint
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# Cluster chaining SLICE 2 - the watcher learns the `requires_on_main` content gate

Implements **SLICE 2** of `docs/plans/cluster-chaining-plan.md` (PR #1161). Read §3 and §4 SLICE 2
before starting. Predecessor SLICE 1 is **already on `main`** - PR #1184, merged
2026-08-18, `origin/main` @ `54559dad`. No dependency key is declared on this prompt because the
predecessor has already landed; declaring a gate that is already satisfied is the `CLUSTER_DEAD_GATE`
anti-pattern SLICE 3 will reject.

## The gap, measured

[MEASURED] against `origin/main` @ `54559dad`:

- `scripts/pipeline/lint-prompt.mjs` contains `requires_on_main` - SLICE 1 landed it.
- `scripts/pr-watcher/index.mjs` contains **zero** occurrences of `requires_on_main`.
- The parser handles `requires_merged` (lines 860, 877) and `requires_file_on_main` (lines 863,
  880); the resolver is `unmetDependencies()` at line 920; the caller is line 1832.

## What to build

**1. Parse `requires_on_main:` in `parseWatcherFrontMatter`.** Accept the same shapes the existing
keys accept - a single inline value AND an indented `-` list. Two value forms:

- `<path>` - the file must exist on `origin/main`. Semantically identical to
  `requires_file_on_main`.
- `<path> :: <fixed-string>` - the string must appear in `git show origin/main:<path>`.

The separator is a literal ` :: ` (space-colon-colon-space). A path containing `::` is not a case
worth supporting; split on the FIRST occurrence and treat the remainder as the needle verbatim,
including any interior colons.

**2. Resolve it in `unmetDependencies()`:**

- Missing file on `origin/main` -> **UNMET**. Not a throw, not a crash, not MET.
- File present, needle absent -> **UNMET**.
- File present, needle present -> **MET**.
- Malformed value (empty path, empty needle after the separator) -> **UNMET plus a warning log
  line**. Never MET. A malformed gate must fail closed - failing open is the exact bug SLICE 1
  existed to prevent.
- Any `git` error -> **UNMET**, consistent with how the existing dependency resolution treats
  `gh`/`git` errors.

**3. FIXED-STRING containment only. No regex.** Do not build a `RegExp` from the value, and do not
introduce a regex quantifier anywhere in this change. `index.mjs` deliberately avoids them
(CodeQL `js/polynomial-redos`), and the needle comes from an untrusted prompt file. Use
`String.prototype.includes`. A test must assert that a value containing regex metacharacters -
e.g. `a.*b` or `(((((` - is matched **literally** and does not throw.

**4. Read the file the same way the rest of the watcher does.** `git show origin/main:<path>`;
capture stdout; do not shell out through a string-interpolated command line.

**5. Retire SLICE 1's warning.** `scripts/pipeline/lint-prompt.mjs` currently warns that
`requires_on_main` is accepted by the linter but not honoured by the watcher. Once this slice is on
main that warning is FALSE, and a stale warning trains authors to ignore warnings. Remove it and
update the test in `scripts/pipeline/test-lint-prompt.mjs` that asserts it. This is the one
cross-file edit in this slice and it is deliberate: the warning and its cause must die in the same
commit, or `main` briefly contains a lie either way.

**6. Document it in `docs/pr-prompts/PROMPT-SCHEMA.md`** - both value forms, the ` :: ` separator,
fixed-string-not-regex stated explicitly, and the fail-closed rule.

## Tests - `scripts/pr-watcher/__tests__/watcher-frontmatter-deps.test.mjs`

Run them with `node --test "scripts/pr-watcher/__tests__/*.mjs"` **with the quotes** - a bare
directory argument silently fails on this Node version (measured: exit 1, 0 tests discovered).
Baseline before you start is 47 passing, 0 failing.

Parser tests can be pure. Resolver tests need `git show` stubbed or a temp repo - prefer extracting
the value-splitting and the MET/UNMET decision into a small pure function you can test directly,
and keep the `git` call at the edge. If you extract a module, it counts against `size`.

Cover, at minimum:

- inline `requires_on_main: path/to/file.mjs` -> parsed, path-only form.
- indented list form with two entries, one of each value form.
- `path :: needle` -> path and needle split correctly; needle keeps interior spaces.
- `path :: a.*b` -> matched literally; a file containing the literal `a.*b` is MET, a file
  containing `aXXb` is **UNMET**. This is the regex-safety test.
- missing file -> UNMET, no throw.
- present file, absent needle -> UNMET.
- present file, present needle -> MET.
- `requires_on_main:` empty, and `path ::` with an empty needle -> UNMET + warning.
- a prompt with NO dependency keys -> behaviour byte-for-byte unchanged. Every prompt in the live
  queue is in this category and none may start deferring.

## Do not

- Do not touch `sot/`. CP-24 hard-fails a PR mixing code and `sot/`.
- Do not change the existing `requires_merged` / `requires_file_on_main` semantics or their exit
  paths. Additive only.
- Do not wire `merge-queue.mjs`, and do not give the watcher any new merge authority. This slice
  gates DISPATCH, nothing else.
- Do not introduce `cluster:` / `cluster_order:` - that is SLICE 3, armed in parallel with this one.
  If you find yourself editing `scripts/pipeline/lint-prompt.mjs` for anything beyond removing the
  SLICE 1 warning, stop: you are in SLICE 3's scope and will collide.

## Verification

    node --test "scripts/pr-watcher/__tests__/*.mjs"
    node scripts/pipeline/test-lint-prompt.mjs
    pnpm lint

Then run `node scripts/pipeline/lint-prompt.mjs` over every file in `docs/pr-prompts/*.md` and paste
the verdict counts before and after. They must be identical.

Note for your report: **no CI workflow runs `scripts/pr-watcher/__tests__/`** [MEASURED - no match
for `pr-watcher`, `__tests__` or `node --test` in `.github/workflows/*.yml`]. Your local run is
currently the only thing that executes these tests. Say so in the PR body rather than implying CI
covered you.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
