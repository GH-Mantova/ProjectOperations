# Graphify knowledge-graph setup

> **Graphify is a generated navigation index, NOT source of truth.** The canonical
> Prisma spine remains `sot/04-data-model.md` + `scripts/data-model/build-relationship-map.mjs`
> (deterministic, CI-gated). If Graphify and `sot/04` disagree, `sot/04` wins.

## What was built (Option A, 2026-07-15)

An **AST-only** code knowledge graph over the whole repo. Zero network calls, zero
LLM extraction, zero API keys. Extracted with `graphify` v0.9.13.

- **Nodes:** 13,986
- **Edges:** 40,840
- **Output:** `graphify-out/graph.json` (~19 MB, git-ignored — regenerable)
- **Coverage:** 1,226 code files (TS/JS/PS1/etc.). 91 doc/paper/image files were
  deliberately skipped (`--code-only`). 46 unclassified files (JSON configs, mermaid,
  etc.) were skipped.

## The command that built it

```
graphify extract . --code-only --no-cluster
```

- `--code-only` → local AST only, no API key, skips docs/papers/images.
- `--no-cluster` → no LLM community naming (the community-detection step is the only
  thing that would otherwise call out).

Together these two flags guarantee the run is fully offline and cannot hang on a
backend or exceed a token budget.

## Ignore file

Repo root `.graphifyignore` mirrors `.gitignore`-syntax and excludes build output,
lockfiles, images, coverage reports, the graph's own output folder, and the watcher's
processed/archived/superseded PR-prompt trees (churn without signal).

## Why `graphify-out/` is git-ignored

At 19 MB, `graph.json` is well above the ~5 MB threshold Marco set in the originating
prompt. It is fully regenerable in a few minutes via `graphify update .` (incremental,
uses the on-disk cache in `graphify-out/cache/`). Cost of committing it: a large diff
on every non-trivial code PR. Benefit: none — every developer regenerates locally.

## How to query it

Run these from the repo root (after `graphify update .` if the graph does not exist
locally):

```
graphify query "<natural-language question>"       # semantic-ish lookup
graphify path   "<source symbol>" "<target symbol>"  # shortest path between two nodes
graphify explain "<symbol>"                          # neighborhood of a node
```

Worked examples (real output as of build time):

```
$ graphify path "ClientQuote" "TenderEstimate"
Shortest path (3 hops):
  ClientQuotesPanel() --calls--> useAuth() <--imports-- useTenderEstimate.ts --contains--> TenderEstimate

$ graphify explain "RateResolverService"
Node: RateResolverService
  Source: apps/api/src/modules/rates/rate-resolver.service.ts L49
  Degree: 17
  Connections include: rates.controller.ts (imports), tender-rate-set.service.ts
  (imports), rate-resolver.service.spec.ts (imports), .resolveRate() (method),
  .assertRateParity() (method), .tryRateTable() (method), .tryLegacy() (method),
  .enumerateRateSet() (method), .getCanonicalSource() (method), .resolveReferenceValue()
  (method), Injectable (references), …
```

## How to enrich later (deliberate follow-ups, out of scope for this PR)

The Option-A extract is intentionally shallow so it could ship offline. Two enrichments
are available when Marco wants them:

1. **Semantic doc-linking layer.** Run `/graphify .` interactively inside a Claude Code
   session — it will consume an API budget and add doc→code links, community naming, and
   richer summaries. Do **not** wire this into the watcher or a CI job; it is a
   human-in-the-loop step because it spends real money.

2. **Live Postgres schema.** Run `graphify extract --postgres "<DSN>"`. This introspects
   the running database and adds table/column nodes to the graph. **Never paste the DSN
   into a committed file, a prompt, or a chat log.** Prefer sourcing it from
   `apps/api/.env` at invocation time and letting the shell substitute it, e.g.
   `graphify extract --postgres "$(grep DATABASE_URL apps/api/.env | cut -d= -f2-)"`.

## What was deliberately NOT done in the setup PR

- `graphify install`, `graphify claude install`, `graphify vscode install`. These would
  add a `PreToolUse` hook or edit `CLAUDE.md`, and this repo already has a deny-only
  `PreToolUse` guard hook (#569) that must not be clobbered. Registration is a separate,
  supervised follow-up.
- Any read of `DATABASE_URL` or Postgres extraction (see above).
- Any `--backend` flag (would require an API key or a nested Claude CLI).
- Any CI gate on the graph — it is regenerable, not authoritative.

## Regenerating

```
graphify update .        # incremental — uses graphify-out/cache/
graphify extract . --code-only --no-cluster   # from scratch if the cache is bad
```

If you see the graph disagree with `sot/04-data-model.md`, trust `sot/04` and
regenerate the graph — do not "fix" the graph, and do not edit `sot/04` to match it.
