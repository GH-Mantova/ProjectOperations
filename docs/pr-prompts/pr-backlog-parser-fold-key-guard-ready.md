---
premise: '! grep -q "FOLD_KEY_GUARD" scripts/pipeline/check-backlog.mjs'
premise_means: >-
  The BACKLOG.yaml reader still treats any indented "word:" line inside a folded block as a new
  key, so it silently truncates notes and can silently overwrite a real key.
scope:
  - scripts/pipeline/check-backlog.mjs
  - scripts/pipeline/__tests__/**
  - .github/workflows/ci.yml
done_when: >-
  grep -q "FOLD_KEY_GUARD" scripts/pipeline/check-backlog.mjs && grep -q
  "scripts/pipeline/__tests__" .github/workflows/ci.yml && node --test
  "scripts/pipeline/__tests__/*.mjs"
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Fix the BACKLOG.yaml reader that silently eats folded blocks

Registered as backlog item `backlog-parser-swallows-folded-blocks` in PR #1225. Read that entry
first — it has the full write-up.

## The defect

`scripts/pipeline/check-backlog.mjs` uses a deliberately small hand-rolled YAML reader. Inside a
folded (`>`) block it applies this to **every** line:

```js
const kv = line.match(/^\s{4,}([a-z_]+):\s*(.*)$/);
```

Any line indented 4+ spaces whose first token is a bare lowercase word followed by a colon is taken
as a **new key**. The folded block ends there — no warning, no non-zero exit — and everything after
that point is lost from the note.

**Two failure modes. The second is the dangerous one.**

- **Truncation** — an unrecognised word becomes a junk key and the rest of the note vanishes.
- **Overwrite** — the word is one of the *real* key names, so the prose line **replaces that key**.
  A sentence beginning with the word "gate" and a colon would silently replace an item's executable
  gate command. The gate is the only thing standing between a HOLD and being reported READY TO
  STAGE, so this can surface a blocked item as ready.

Reproduced twice on 2026-08-19 while writing a single entry, on the words `cluster` and
`controlled`. **Neither appeared in the checker's own output.** Both were caught only by a
separate scan.

## Do

1. **Guard the key match.** Only treat a line as a new key when the captured name is in the known
   key set for this schema: `id`, `title`, `priority`, `why`, `gate`, `gate_means`, `needs_marco`,
   `marco_note`, `order`. Mark the guard with the literal token **`FOLD_KEY_GUARD`** in a comment
   so the gate and future greps can find it.

2. **Fail loud on anything else that looks like a key inside a folded block.** Print the item id,
   the line number and the offending text, and exit **non-zero**. Do not silently fold it into the
   prose and do not silently drop it — a register that quietly tells you less than it was given is
   worse than one that refuses to load. Use a distinct exit code from the existing ones: the script
   already documents `0` = nothing newly ready and `10` = at least one item READY TO STAGE, so pick
   an unused code and document it in the header comment alongside those.

3. **Keep the known-key list in one place** — a single exported/registered constant the guard and
   any future validator both read. Do not inline the list twice.

4. **Tests** — create `scripts/pipeline/__tests__/backlog-parser.test.mjs` covering, at minimum:
   - a folded block containing the line `cluster: something` is **rejected loudly**, not truncated;
   - a folded block containing `gate: rm -rf /` does **not** replace the item's real `gate`;
   - a well-formed BACKLOG entry still parses with every key intact, including a multi-paragraph
     folded note (guard against over-correcting into a parser that rejects valid input);
   - the real `docs/pr-prompts/BACKLOG.yaml` in the repo parses clean.

5. **Make the tests actually run in CI.** `.github/workflows/ci.yml:173` currently runs only
   `node --test "scripts/pr-watcher/__tests__/*.mjs"`. A new directory is **not** covered. Add
   `scripts/pipeline/__tests__/*.mjs` to that job. **Use the quoted-glob form** — the comment at
   `ci.yml:169-172` records that a bare directory path exits 1, so do not "simplify" it to a
   directory.

## Do NOT

- Do NOT swap in a real YAML library. The reader is deliberately dependency-free; this is a
  correctness fix, not a rewrite.
- Do NOT change `docs/pr-prompts/BACKLOG.yaml` itself. It currently parses clean — verified
  2026-08-19: 40 key-shaped lines, 8 distinct legitimate keys, zero bogus. If your fix makes the
  real file fail, the fix is wrong, not the file.
- Do NOT change any item's `gate`, `priority` or `needs_marco`.
- Do NOT touch `/sot/` or Azure/Entra/SharePoint.

## Verify

- `node scripts/pipeline/check-backlog.mjs` still runs against the real register and still reports
  the same item classification as before the change. **Paste the before and after summary lines
  into the PR body** — they must match.
- `node --test "scripts/pipeline/__tests__/*.mjs"` passes.
- **Prove the guard fires.** Temporarily add a `cluster: x` line inside a folded block in a scratch
  copy, confirm the checker exits non-zero and names the line, then remove it. State the exact
  output in the PR body. A guard only ever observed passing has not been tested. Do not commit the
  scratch change.

## STANDING AUTHORITY

Parser correctness + test + CI wiring only. Stop and report rather than widening scope.
