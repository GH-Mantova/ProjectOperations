---
premise: '! grep -q "NO_PR_RESTAGE" scripts/pr-watcher/index.mjs'
premise_means: The [NO-PR] path still files the prompt to no-pr-opened/ and returns - no retry, no restage, no quarantine report - so a run that did the work but never opened a PR dies silently and the pile grows.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/nopr-restage.spec.mjs
done_when: pnpm lint && grep -q "NO_PR_RESTAGE" scripts/pr-watcher/index.mjs && grep -q "nextRestageName" scripts/pr-watcher/index.mjs && node --test scripts/pr-watcher/__tests__/nopr-restage.spec.mjs
size: 4
gate_allow: none
seed_only: false
escalates: false
requires_on_main: docs/pr-prompts/PROMPT-SCHEMA.md :: DISMISSED_MEANS_PROCEED
---

# NO-PR slice 2: make `[NO-PR]` a hard failure with bounded auto-restage (Mode A)

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: touch **only** the two files in `scope`. That is a scope limit,
**not** a reason to stop before pushing.

**Gate:** slice 1 must be on main — `DISMISSED_MEANS_PROCEED` present in
`docs/pr-prompts/PROMPT-SCHEMA.md`. That ordering is deliberate: restaging a **Mode B** prompt before
the contract is fixed just re-asks the same question, gets dismissed again, and burns one run per
cycle until the bound trips. Do not remove the gate.

## Grounded state on main — READ THESE LINES BEFORE CODING

Line numbers are from `origin/main` at `c1737312`. **Grep for the symbols; do not trust the numbers.**

- **`index.mjs:2214-2235` is the whole defect.** When `extractPrNumber(agentOutput)` returns `null`
  the watcher renames the prompt into `no-pr-opened/`, writes a `.log`, then
  `seen.delete(name); running = false; drain(); return;`. Its own comment says the result is
  *"NOT treated as success"* — **but nothing follows it.** No retry. No restage. No report. No
  surfacing. The run dies quietly and the pile grows. `no-pr-opened/` currently holds **107**.
- **`NO_PR_DIR`** is defined at `index.mjs:75` as `path.join(PROMPT_DIR, "no-pr-opened")`.
- **The retry machinery you must mirror already exists**: `maybeRetryTransient(name, matchText)` at
  `index.mjs:1250`. It reads `retryCounts` (a `Map`), bails when `count >= 1`, and on a match does
  `seen.delete(name); enqueue(name, { source: "transient-retry" });` leaving the file in place.
- 🔴 **`retryCounts` is IN-MEMORY and a watcher restart RESETS IT** — stated in the comment at
  `index.mjs:278`. The watcher has died **four times in three days**. **A bound stored in that Map
  is therefore not a bound at all**, so this slice must NOT use it.
- **`writeQuarantineReport(name, output, prNumber)`** at `index.mjs:1207` writes
  `failed/{name}.report.md` with the last 50 lines of agent output and a `Retries used:` line. It is
  the existing surfacing mechanism — reuse its shape, do not invent a second one.
- **The failure path at `index.mjs:2177-2191`** is the template for "quarantine properly": rename to
  the directory, write the `.log`, write the report, `seen.delete`, then pause or continue.

## Marco's decision (2026-08-20) — implement exactly this, do not re-litigate

**Hard failure + auto-restage, bounded: `b`, then `c`, then `failed/`.**

## What to build

### 1. Derive the attempt from the FILENAME, not from memory

Add an exported pure function — name it **`nextRestageName`** — that maps a prompt filename to the
next attempt, returning `null` when the bound is exhausted:

```
pr-foo-ready.md    -> pr-foo-b-ready.md
pr-foo-b-ready.md  -> pr-foo-c-ready.md
pr-foo-c-ready.md  -> null            (bound exhausted)
```

It must work for the `rev-` prefix too (the watcher's glob is `(pr|rev)-*-ready.md`), and it must
**not** mistake a prompt whose own name ends in `-b` or `-c` for an attempt marker — only the
segment immediately before `-ready.md` counts, and only when the stem already exists. Export it so
the spec can test it directly.

**Why the filename:** it is the only attempt counter that survives a watcher restart, and the
watcher restarts constantly. This is the single most important design decision in the slice.

### 2. Replace the silent `[NO-PR]` bail with a bounded restage

At the `prNumber == null` branch, guarded by a module-level const **`NO_PR_RESTAGE`** (set it to
`true`; the const is also the greppable marker this prompt's `done_when` asserts):

- Compute `nextRestageName(name)`.
- **If it returns a name** — this is an attempt that can still be retried:
  - `rename` the prompt file to the new name **in `docs/pr-prompts/` (it stays armed)**.
  - Write the run's log beside it as `{newName}.log` so the next attempt's evidence is not lost.
  - `log("NO-PR", ...)` naming the old name, the new name, and which attempt this is.
  - `seen.delete(oldName); enqueue(newName, { source: "no-pr-restage" }); running = false; drain(); return;`
- **If it returns `null`** — the bound is exhausted. This is now a **hard failure**, not a quiet
  filing:
  - rename into **`failed/`**, not `no-pr-opened/`, so it lands in the directory the pipeline already
    treats as needing a human;
  - write the `.log` and **call `writeQuarantineReport(...)`** so a `.report.md` exists;
  - `log("FAIL", ...)` stating plainly that three attempts opened no PR;
  - follow the existing failure path's pause/continue behaviour (`AUTO_MERGE && !reviewJob`).

### 3. Do not lose the existing triage signal

The current comment is right that "legitimately no PR needed" is a judgement call. Preserve it: when
the agent's output contains an explicit **`NO-OP:`** line, that is the agent *saying* no PR was
needed. Treat that as a legitimate no-PR outcome — file it to `processed/` with the reason in the
log, and **do not restage it**. Only an unexplained missing PR gets restaged.

### 4. Tests — `scripts/pr-watcher/__tests__/nopr-restage.spec.mjs`

Use `node --test`. Follow the existing spec style in `scripts/pr-watcher/` — read one first.

- `nextRestageName` for each rung: base -> `b`, `b` -> `c`, `c` -> `null`.
- the `rev-` prefix behaves identically.
- a prompt whose stem genuinely ends in `-b` (e.g. `pr-slice-b-ready.md` with no prior attempt) is
  **not** misread as a second attempt — state in a comment which convention you chose and why.
- an output containing `NO-OP:` is not restaged.
- an output with no PR number and no `NO-OP:` **is** restaged.
- **A negative control:** an output that DOES contain a PR URL must not reach this path at all.

## Do NOT

- Do NOT use `retryCounts` for this bound — a restart resets it (`index.mjs:278`).
- Do NOT change `extractPrNumber`, the merge paths, `holdForMarco`, or the transient-retry path.
- Do NOT change the `escalates: true` short-circuit at `index.mjs:2240`.
- Do NOT attempt to recover the 107 prompts already in `no-pr-opened/`. **Marco ruled: wait for
  auto-restage to land, then recover them systematically.** Recovery is a separate, later slice.
- Do NOT touch `sot/` (CP-24) or anything Azure/Entra/SharePoint.

## Guardrails

- One attempt. Never exit silently — say `NO-OP: <reason>` if `NO_PR_RESTAGE` is already on main.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm lint` and the new `node --test` spec must both pass before pushing.
- ⚠️ You are editing the watcher that is **running you**. Your change takes effect only when the
  watcher is restarted from a fast-forwarded clone — do not expect to observe your own fix at
  runtime, and do not restart the watcher yourself.
