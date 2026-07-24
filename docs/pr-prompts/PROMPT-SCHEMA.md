# Prompt schema — every prompt must pass the lint before an agent sees it

Enforced by `scripts/pipeline/lint-prompt.mjs`. **A prompt that fails the lint never reaches an agent.**

---

## ⛔ A PROMPT IS NOT REAL UNTIL IT IS COMMITTED TO `origin/main`

**Staging a prompt = committing the `*-ready.md` / `*-HOLD.md` file to `origin/main` via a
docs-only PR. A prompt that exists only as an untracked file in a working tree is NOT staged.**

Why (confirmed 2026-07-15, a full Cowork session's worth of prompts nearly lost this way):

- **The stations run in a fresh worktree off `origin/main`.** `04-scanner`, the code-writer
  agents, `05-sot-keeper` — they see ONLY what is committed. An untracked prompt in someone's
  local tree is **invisible** to them. (04 literally reported it could not stage already-decided
  items because "their bodies live in untracked HOLD files, invisible to agents.")
- **`git clean` deletes untracked files** — it has wiped the queue before
  (`docs/`-class working files are not safe just because they're in the right folder).
- The watcher *may* dispatch a loose untracked `-ready.md` from the real tree, but that is the
  only reader that can, it's fragile, and nothing else in the pipeline knows the prompt exists.

**Rule for anyone (human or agent) who authors or stages a prompt:**
1. Write the `pr-*.md` file with valid front-matter (this schema).
2. **Commit it to `origin/main` in a docs-only PR** (only `docs/**` — never mix code or `sot/`,
   or CP-24 fails). The PR body can be one line: "stage prompt(s) for the queue."
3. Only after that merge is the prompt real, durable, and visible to every station.

A staged-but-uncommitted prompt is a TODO, not a queue entry. If you cannot push to `main`
yourself (e.g. Cowork/sandbox — GitHub MCP writes 403), hand the exact file list + commit to
whoever can, and say plainly that the prompt is not queued until it lands.

---

## ⛔ IF A PROMPT TOUCHES `schema.prisma`, IT MUST REGENERATE THE DATA-MODEL MAP

Any prompt whose `scope` includes `apps/api/prisma/schema.prisma` MUST instruct the agent to run
`node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
`docs/data-model/relationship-map.json` + `relationship-map.md` + `metadata-catalog.json`, and MUST
add `docs/data-model/**` to `scope`. The CI **data-model drift check**
(`build-relationship-map.mjs --check`) hard-fails a schema change that leaves the generated map
stale — it sank #593 (integration-keys). The map is `docs/`-class, so committing it alongside the
code is CP-24-safe. The agent opens the PR and exits before CI runs, so it will NOT see the red
check and fix-forward on its own — the prompt must make the regen part of the work up front.

**Two more things a schema/service PR must do up front (both sank #595):**
1. **Declare `GATE-ALLOW: migrations`** as a bare line at column 0 of the PR body — CP-11 hard-fails
   an undeclared migration. (This is separate from the `gate_allow: migrations` front-matter.)
2. **Update the affected unit specs.** Changing a service's Prisma `create`/`update` payload breaks
   that service's `*.spec.ts` `toHaveBeenCalledWith(...)` assertions — add the new fields to the
   expected objects in the same PR, or the API test job fails.

## Why this exists

Of 194 historical failures, **34 were stale prompts** — an agent booting, grepping, discovering the
work was already on `main`, and exiting with no PR. A full agent run, burned, every time. Prompts are
authored days-to-weeks before they dequeue, **and nothing re-validated the premise**.

Another **5** had a premise that was simply *false* — `pr-23` ordered tests mirroring a spec file that
does not exist; `pr-ops-map-m1` ordered the agent to read a design doc that does not exist.

**39 failures, all preventable by one deterministic check that costs zero tokens.**

---

## Required front-matter

```yaml
---
premise: grep -rc "ConfirmDialog" apps/web/src | grep -q ":0"
premise_means: The ConfirmDialog component does not exist yet.
scope:
  - apps/web/src/components/**
  - packages/ui/src/**
done_when: pnpm build && pnpm lint && grep -rq "ConfirmDialog" packages/ui/src
size: 6
gate_allow: none          # none | migrations | env-vars | dependencies
seed_only: false
escalates: false          # true if this touches prod data / auth / Azure
rollback_strategy: ''     # OPTIONAL in general; REQUIRED when scope touches prisma/migrations
---
```

### `premise` — **the field that matters**

A **shell command that must EXIT 0 for the work to still be needed.**

The linter runs it **at dequeue time**, against current `main`. If it fails, the work is already done
(or was never real) and **the prompt is binned before an agent is spawned.**

> **If you cannot express the premise as a command, you do not understand the problem well enough to
> propose the work.** That is the point of the field, not a formality.

Good premises are assertions of *absence*:

| Intent | Premise |
|---|---|
| Component doesn't exist yet | `grep -rc "ConfirmDialog" apps/web/src \| grep -q ":0"` |
| Env var not yet added | `! grep -q "MAIL_AUTH_MODE" .env.example` |
| Route still unguarded | `! grep -q "isSuperUser" apps/web/src/pages/admin/RatesListsAdminPage.tsx` |
| Migration not yet written | `! ls apps/api/prisma/migrations \| grep -q "rate_table_is_reference"` |
| PR still open | `gh pr view 549 --json state -q .state \| grep -q OPEN` |

### `size` — number of files the prompt expects to touch

**`size > 10` → the linter REJECTS it and demands a split.**

`pr-replace-native-browser-dialogs` tried to migrate **48 call sites**. It burned **240 turns**,
left 33 uncommitted files in the shared tree, and **killed the queue for 13 hours.**
It had already been given double the normal turn budget — **raising the cap does not help. Splitting
does.** That prompt should have been four prompts.

### `gate_allow`

If the PR will add a migration / env var / dependency, name it here. The pipeline then writes the
marker into the PR body **bare, at column 0** — because `## GATE-ALLOW: migrations` does **not** match
CP-11's regex, and `GATE-ALLOW: migrations.` (trailing period) doesn't either. **10 PRs failed on
exactly this.** Stop hand-writing it.

### `rollback_strategy` — required when scope touches `prisma/migrations`

One or two lines saying how to revert or fix-forward if the run dies **mid-flight** — after the
migration is applied but before the code that depends on it lands. OPTIONAL for every other prompt;
the linter REJECTs a migration-scoped prompt with a missing or empty `rollback_strategy` as a
`MISSING_FIELD`-class failure.

Examples of what belongs in the field:

- `migration is additive (adds a nullable column); safe to leave on main, re-run drops nothing`
- `revert migration 20260722_add_x, then re-apply after code lands`
- `no rollback — column has a NOT NULL default backfilled in the same migration; forward-only`

Why (LL-29, 2026-07-23): a turn-capped agent left a migration applied on `main` with all of the
consuming code still uncommitted. The recovery cycle had no prompt-authored note on whether to drop
the migration or press on and land the code, and burned an entire session guessing. A one-line note
authored at prompt-write time — when whoever proposed the work still remembers *why* — closes that
gap for the cost of one field.

### `escalates`

`true` for production data writes, production auth, or anything touching Azure/Entra/SharePoint.
The pipeline will **build the PR but never merge it** — it goes to Marco.

**`escalates: true` DOES NOT STOP THE PROMPT FROM RUNNING. It gates the MERGE, not the RUN.**

Ruled by Marco, 2026-07-20 — *"run, open PR, block merge only"*:

* The flag is **advisory metadata about the work**, not an instruction to the watcher. Nothing in
  `scripts/pr-watcher/**` reads it, and `lint-prompt.mjs` admits escalating prompts happily. This
  is deliberate and **will not be "fixed" with a watcher guard** — one stop beats two, because a
  flag that *sometimes* halts execution competes with the folder that *always* does, and agents
  end up trusting the weaker one.
* **`docs/pr-prompts/needs-marco/` is the ONLY real stop.** Location is the contract; frontmatter
  is a note. To prevent something from running, **MOVE THE FILE**. Nothing else works.
* Therefore **a loose armed `*-ready.md` WILL BE EXECUTED**, whatever its frontmatter says.
  **Arming a prompt IS the decision to run it.** Never read `escalates: true` on an armed prompt
  as "safely parked" — it is not parked.
* **Do NOT blanket-quarantine `escalates: true` prompts.** On 2026-07-20 a supervisor cycle swept
  four into `needs-marco/` on the strength of the flag alone — after Marco had explicitly asked
  for them to run. That sweep is why the `clients.*` permanently-false gate sat unfixed on main
  for days. Quarantine only what Marco personally names, or what hits a genuine hard stop
  (Azure/Entra/SharePoint, destructive, production auth, real human identity).
* `scripts/pipeline/queue-sync.ps1` **arms escalating prompts like any other** and simply counts
  them as `escalating(do-not-merge)`, printing an ACTION line telling the supervisor which open
  PRs it must not merge. An earlier revision of that script gated at ARM time and held three
  prompts idle — the exact stall the standing-authority rule exists to prevent. The block belongs
  at MERGE time, not at arm time.

---

---

## ⛔ STANDING AUTHORITY — the rule that cost three runs on 2026-07-14

**Every prompt body MUST carry this, verbatim:**

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

### Why this exists

`pr-a1` (sot-reconcile) did **the entire job** — corrected the sha, verified the map in sync,
confirmed the diff was exactly 2 lines — and then ended with:

> *"Ready to commit/push/PR when you give the word."*

`pr-a2` (timesheet) did the same:

> *"Standing by — awaiting your call on whether to arm it, dry-run, implement, or leave it."*

**Both exited 0. Neither opened a PR. Both runs were discarded.**

They did not fail. They did not exit *silently*. **They exited politely, asking a question nobody
was awake to answer.** The old guardrail only forbade exiting *silently* — so an agent that
finished the work and waited for approval slipped straight through it.

**Root cause:** both prompt bodies contained *"Do NOT auto-merge — Marco reviews the rendered
diff."* The agents read that as *"do not act without Marco"* and stopped **before opening the PR**.
**"Do not auto-merge" got read as "do not merge, and also do not do anything."**

The watcher caught both (`no-pr-opened/`, *"NOT treated as success"*) — the safety net worked. But a
safety net that catches a run is still a burned run.

---

## Also required, in the body

- **What to build** — specific, with file paths.
- **Do NOT** — the explicit out-of-scope list.
- **STANDING AUTHORITY** — the block above, verbatim. Non-negotiable.
- **Guardrails** — one attempt; never exit silently (say `NO-OP: <reason>`); **never ask a question
  or "stand by" for approval** (there is no human in a headless run — **10 runs died waiting, plus
  the two above**); read the job log before diagnosing any CI failure.

### The completion test

Before you finish, ask: **"Is there a PR number in my output?"**

- **Yes** → done.
- **No, because the work was already on `main`** → say `NO-OP: <reason>`. Correct.
- **No, because I could not do it** → say `NO-OP: <reason>`. Correct, and honest.
- **No, because I am waiting for someone** → **WRONG. There is nobody. Open the PR.**

## Optional: execution-order dependencies

Declare in front-matter — this is the ONLY form the intake lint admits (it REJECTs
`NO_FRONT_MATTER` if `---` is not on line 1, which is why the older HTML-comment
form was mutually exclusive with the lint and never actually usable):

```yaml
---
requires_merged:
  - 380
  - 379
requires_file_on_main:
  - apps/web/src/hooks/useConfirm.tsx
---
```

Inline scalar also works: `requires_file_on_main: path/to/file.ts`. The watcher
DEFERS a prompt whose deps are unmet and re-checks it on the next rescan; a
gh/git error counts as unmet (fail closed).

The legacy `<!-- watcher: requires-... -->` HTML-comment form still parses (for
back-compat) but cannot pass the intake lint — do not use it in new prompts.

## Lint failures you will hit

| Failure | Meaning |
|---|---|
| `PREMISE ALREADY SATISFIED` | The work is done. Binned. This is the lint **working** — 34 runs saved. |
| `PREMISE INVALID` | The command errored. Your assumption about the repo is wrong. Fix it. |
| `SIZE TOO LARGE` | Split it. Non-negotiable. |
| `MISSING FIELD` | Front-matter incomplete. Also fires when `scope` touches `prisma/migrations` and `rollback_strategy` is missing/empty. |
| `GATE_ALLOW MISMATCH` | You declared a migration but `scope` has no `migrations/` path (or vice-versa). |
