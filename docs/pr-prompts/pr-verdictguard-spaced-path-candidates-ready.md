---
premise: '! grep -q "SPACED_PATH_CANDIDATES_V1" scripts/pr-watcher/verdict-guard.mjs'
premise_means: The verdict guard still truncates every un-backticked path under a top-level directory whose name contains a space, so a reviewer's MERGE verdict that names a `Claude Design/...` file is blocked as citing a phantom file, and the block note sends the next actor after a stale clone instead.
scope:
  - scripts/pr-watcher/verdict-guard.mjs
  - scripts/pr-watcher/__tests__/verdict-guard.spec.mjs
done_when: node --test scripts/pr-watcher/__tests__/verdict-guard.spec.mjs && grep -q "SPACED_PATH_CANDIDATES_V1" scripts/pr-watcher/verdict-guard.mjs
size: 3
gate_allow: none
seed_only: false
escalates: true
module: watcher
---

# verdict-guard: make pass-2 path extraction survive a directory name with a space

**Found by Station 00 (blind) 2026-09-24T09:15Z, dispatched to the next sighted run; staged by
Station 00 at 2026-09-24T10:4xZ.** This prompt only STAGES the work. The PR it produces touches
`scripts/pr-watcher/**`, which is outside `tests|docs`, so `classifyPolicyFiles` routes it to Marco
and `escalates: true` puts `do-not-merge` on it. **Nothing here may be merged by a station.**

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

The PR will carry `do-not-merge` because `escalates: true`. That gates the MERGE, not the RUN
(DOCTRINE §5b) — open the PR, drive it green, and leave the merge for Marco.

## The defect, measured

`PATH_TOKEN_RE` (anchor: `const PATH_TOKEN_RE =` in `scripts/pr-watcher/verdict-guard.mjs`) excludes
whitespace from **both** segments:

```
/[^\s`'"<>()[\]{}|,;]+\/[^\s`'"<>()[\]{}|,;]+\.[a-zA-Z0-9]{1,10}(:\d+(-\d+)?)?/g
```

Against the bare text `Claude Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html` the
match therefore begins at `D`, yielding `Design/proposed/...`. The repo has **no** `Design/`
directory; the real file lives under `Claude Design/`. Pass 1 (the backtick-span pass) carries the
full path, so this fires only when a verdict names such a file **un-backticked** — which is why it
is intermittent rather than constant.

The suffix tolerance in `pathMatches` (anchor: `pf === candidate || pf.endsWith`) cannot rescue it:
the PR's entry is `Claude Design/proposed/...` and the character preceding `Design/` is a **space**,
not a `/`, so `endsWith("/" + candidate)` is false.

**Two occurrences, twenty days apart**, out of 50 `*.guard-block.md` notes:

| note | blocked | cited |
|---|---|---|
| `rev-1573-ready.md.guard-block.md` | 2026-09-04T07:15:04Z (PR #1573) | six paths, all beginning `Design/`, every one mapping to a real `Claude Design/...` file |
| `rev-2157-ready.md.guard-block.md` | 2026-09-24T08:19:09Z (PR #2157) | `Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html` |

Six independent tokens truncated identically is not a stale clone — a stale clone would have to be
missing all six. **Top-level directories containing a space, complete list: `Claude Design`,
`Claude outputs`.**

The hazard class is already known in the same package — `index.mjs` handles it in git argv
(anchor: the comment `reaches git as two arguments`) and `verdict-guard.mjs`'s own pass-1 comment
names `a path with a space is written bare`. Pass 2's token regex is the one place it was not
applied.

## The work — complete and additive (RULE 1)

1. **Add spaced-prefix candidates in pass 2.** Define the known spaced top-level prefixes by reading
   the repo root rather than hard-coding them where practical; on every pass-2 token hit, ALSO offer
   `"<spaced-prefix> " + token` as a candidate. The guard only ever gains candidates, and a candidate
   is only ever accepted when it resolves to a real file in the PR — so this **cannot** weaken the
   guard.
2. **Relax the suffix rule** in `pathMatches` from `endsWith("/" + candidate)` to
   `endsWith("/" + candidate) || endsWith(" " + candidate)`.
3. **Mark it**: put the literal `SPACED_PATH_CANDIDATES_V1` in a comment beside the change, so the
   premise above can die and a later reader can find it.
4. **Correct the block note's diagnosis.** When every unmatched path is a suffix of a real PR file
   modulo a leading space-separated token, say *"a path containing a space was truncated by the
   extractor"* instead of blaming `syncMain()` and prescribing a re-queue. The current note's only
   other escape is *"remove the phantom file references from the verdict"* — i.e. delete the
   reviewer's evidence to satisfy a parser bug, which is exactly the incentive the file's own comment
   warns about.
5. **Test it.** Add a `verdict-guard.spec.mjs` case asserting that a **bare** (un-backticked)
   `Claude Design/x/y.html` in a verdict matches a PR file of that exact path, plus a negative case
   asserting a genuinely absent file is still blocked. The fixture vocabulary `Claude Design` is
   already in that spec file.

**Do NOT** simply widen `PATH_TOKEN_RE` to allow `\s` in the first segment. That would swallow
ordinary prose preceding any path (`see docs/foo.md` would extract `see docs/foo.md`) and turn every
verdict into phantom citations — a strictly worse failure than the one being fixed.

## Falsifying probe

Re-queue `rev-2157` before this lands: it will block again with the identical truncated token. After
it lands, the same re-queue must pass. `docs/pr-prompts/blocked/rev-2157-ready.md.guard-block.md` and
`rev-1573-ready.md.guard-block.md` are both still on disk and are the fixtures.

## Rollback

Single-file revert of `verdict-guard.mjs` plus the spec case. No schema, no migration, no data, no
state. The guard's failure mode on revert is the current one: over-blocking, which is safe.
