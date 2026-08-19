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
backfill: false           # OPTIONAL; only meaningful for migration-scoped prompts (see Gate A below)
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

### `backfill` and the Gate A test rule — required for migration-scoped prompts

Gate A (`docs/plans/pipeline-correctness-gates-plan.md` §2, closes the #923 class): a migration-scoped
prompt (any `scope` entry under `apps/api/prisma/migrations/**`) must satisfy **one** of the following,
or the linter REJECTs with `BACKFILL_TEST_REQUIRED`:

1. **Name a test file in `scope`** matching `*.spec.ts` / `*.spec.js` / `*.test.ts` / `*.test.js` — a
   test that exercises the migration against a seeded legacy row and asserts the produced value is
   contract-valid. This is the layer that would have caught #923.
2. **Declare `backfill: false`** as a front-matter boolean — the author's explicit assertion that the
   migration is purely additive (`ADD COLUMN` / `CREATE`) and performs no `UPDATE … SET` data
   transformation. Use this for migrations that genuinely need no backfill test.

Why: the intake linter runs BEFORE the migration file exists on disk, so it cannot inspect the SQL
body for the backfill signature (`/UPDATE\s+.*\sSET\s/i`). Instead it forces the author to make the
choice up front: bring the test, or consciously assert "no backfill." This closes the #923 class
without false-positiving on genuinely additive migrations. See SLICE 2 of the plan for the
FormRule-specific CI test that pairs with this general lint rule.

### `escalates`

`true` for production data writes, production auth, or anything touching Azure/Entra/SharePoint.
The pipeline will **build the PR but never merge it** — it goes to Marco.

**`escalates: true` DOES NOT STOP THE PROMPT FROM RUNNING. It gates the MERGE, not the RUN.**

#### How the merge gate is actually enforced (2026-08-17)

Until 2026-08-17 the sentence above was aspirational: **nothing enforced it.** The watcher ran
`gh pr merge --auto --squash` on every PR it opened, the string `escalates` appeared nowhere in
`scripts/pr-watcher/index.mjs`, and no CI gate looked at the `do-not-merge` label — which already
existed, described as *"escalates:true - Marco merges this, not automation (DOCTRINE 5b)"*, and was
never applied or checked by anything. A destructive prompt was one green build from merging itself;
OPS-6 was caught by hand.

Two mechanisms now enforce it, deliberately in different places:

1. **The watcher withholds auto-merge.** `parseWatcherFrontMatter` reads `escalates`. When it is
   true the watcher takes neither merge path regardless of `AUTO_MERGE_POLICY`; it applies the
   `do-not-merge` label, comments on the PR explaining the hold, and leaves it open. If the label
   cannot be applied it says so LOUDLY in the merge report rather than proceeding quietly.
2. **CP-26 fails while the label is present** (`scripts/pr-gates/pr-gates.mjs`). This is the part
   with teeth: enforcement sits at the gate, not in the watcher's decision, because a filter is one
   quirk away from being a silent no-op — which is how #552, the production-data PR, was once
   selected for merge. CP-26 also fails **closed** if the labels cannot be read.

**Removing the label is the human's act of approval.** Review the PR, remove `do-not-merge`, CI
re-runs, CP-26 passes, and the PR becomes mergeable. Nothing else is required, and nothing can
merge it while the label is on.

#### Destructive / backfill / NOT-NULL / DROP / DELETE / TRUNCATE slices MUST set `escalates: true`

The linter enforces this via the `DESTRUCTIVE_MUST_ESCALATE` rule (OPS-6, 2026-08-12). Any prompt
whose `premise`, `premise_means`, `done_when`, or Markdown body contains one of the following
signals will be **rejected** unless `escalates: true` is set:

- `backfill` or `destructive` (intent words, checked in prose fields and body only)
- `NOT NULL`, `NOT-NULL`, or `SET NOT NULL`
- `DROP TABLE`, `DROP COLUMN`, `DROP CONSTRAINT`, or `DROP TYPE`
- `DELETE FROM`
- `TRUNCATE`
- `drop-legacy` or `drop_legacy`

**Why:** arming a `*-ready.md` prompt IS the decision to run it. `escalates: true` gates only the
MERGE — so a green build of a destructive prompt with `escalates: false` would auto-merge a
destructive migration with no human in the loop. `siteid-notnull-backfill` (OPS-6) was caught by
hand review only. The linter now makes this mechanical: **if your slice is destructive, you MUST
set `escalates: true`, or it never reaches an agent.**

If you have a false-positive (e.g., the word "backfill" appears in a non-destructive context),
set `escalates: true` anyway — the merge gate is cheap and the cost of a false-negative is
a destructive auto-merge.

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

Declare in front-matter -- this is the ONLY form the intake lint admits (it REJECTs
`NO_FRONT_MATTER` if `---` is not on line 1, which is why the older HTML-comment
form was mutually exclusive with the lint and never actually usable):

```yaml
---
requires_merged:
  - 380
  - 379
requires_file_on_main:
  - apps/web/src/hooks/useConfirm.tsx
requires_on_main: apps/api/src/foo.ts :: some fixed string
---
```

Inline scalar also works: `requires_file_on_main: path/to/file.ts`. The watcher
DEFERS a prompt whose deps are unmet and re-checks it on the next rescan; a
gh/git error counts as unmet (fail closed).

The legacy `<!-- watcher: requires-... -->` HTML-comment form still parses (for
back-compat) but cannot pass the intake lint -- do not use it in new prompts.

### The three dependency keys

| Key | Value | What the watcher checks |
|---|---|---|
| `requires_merged` | Positive integer PR number | `gh pr view N --json state` must be `MERGED` |
| `requires_file_on_main` | Non-empty file path | `git cat-file -e origin/main:<path>` must succeed (file exists) |
| `requires_on_main` | `<path>` or `<path> :: <fixed-string>` | File must exist on `origin/main`; with `::`, the fixed string must appear in the file |

Both list form and inline scalar are accepted for all three keys.

A `requires_file_on_main` path that ALREADY exists on `origin/main` at intake is a dead
gate — the path can never be absent, so the check can never fail, and the slice would
dispatch alongside its predecessor with no ordering at all. The linter REJECTs this as
`FILE_GATE_DEAD`. Two legal fixes: re-point at a content gate
(`requires_on_main: <path> :: <fixed string the predecessor introduces>`), or drop the key
because the dependency is genuinely satisfied.

#### `requires_on_main` -- content gate (cluster-chaining SLICE 2)

`requires_on_main` lets a later slice chain on a SPECIFIC ARTIFACT inside a file, not
just on the file's existence. Use it when your predecessor modifies an existing file and
you need to wait until a particular function, constant, or marker is on `main`:

```yaml
requires_on_main: scripts/pipeline/lint-prompt.mjs :: UNKNOWN_KEY
```

This defers the prompt until `lint-prompt.mjs` on `origin/main` contains the string
`UNKNOWN_KEY` (fixed-string containment, NOT a regex). A missing file counts as UNMET.

Two value forms are accepted:

| Form | Example | What the watcher checks |
|---|---|---|
| `<path>` | `requires_on_main: scripts/foo.mjs` | File exists on `origin/main` (identical to `requires_file_on_main`) |
| `<path> :: <fixed-string>` | `requires_on_main: scripts/foo.mjs :: UNKNOWN_KEY` | File exists AND contains the fixed string (fixed-string containment, NOT a regex) |

Rules:
- The separator is a literal ` :: ` (space-colon-colon-space). Split on the FIRST occurrence; the needle may contain interior colons.
- **Fixed-string only** -- the needle is matched with `String.prototype.includes`, never with `new RegExp(needle)`. A needle containing regex metacharacters (e.g. `a.*b`, `(((((`) is matched literally.
- A missing file on `origin/main` is always **UNMET** (never throws, never crashes).
- A malformed value (empty path, empty needle after ` :: `) is **UNMET** and logs a warning. A malformed gate never passes -- it fails closed.
- Any `git` error is **UNMET** (consistent with how `requires_merged` treats `gh` errors).

## Optional: cluster chaining (SLICE 3, 2026-08-18)

A **cluster** groups a set of prompts into an ORDERED chain. Two optional front-matter keys:

```yaml
---
cluster: my-feature-name          # kebab-case slug, ^[a-z][a-z0-9-]{2,40}$
cluster_order: 2                  # positive integer position within the chain
---
```

Both keys are OPTIONAL - a prompt with neither is unchanged. `cluster_order` without `cluster`
is a REJECT. `cluster` without `cluster_order` is legal (a one-slice cluster).

### The four cluster rejection codes

| Code | Meaning | Why this rule exists |
|---|---|---|
| `CLUSTER_BAD_SLUG` | `cluster` does not match `^[a-z][a-z0-9-]{2,40}$`. | Slugs are how the watcher's future cluster-aware dispatch groups prompts. A malformed slug silently splits one cluster into two. |
| `CLUSTER_ORDER_INVALID` / `CLUSTER_ORDER_NO_CLUSTER` | `cluster_order` is not a positive integer, or set without `cluster`. | A position without a chain has no meaning; ordering must be well-formed before any other rule applies. |
| `CLUSTER_NO_DEP` | `cluster_order > 1` but no `requires_merged` / `requires_file_on_main` / `requires_on_main`. | A slice that claims to be second in line but declares nothing to wait on dispatches alongside the first one - exactly the silently-ungated prompt this cluster exists to eliminate. |
| `CLUSTER_CYCLE` | Two or more prompts in the same cluster reference each other's files via `requires_file_on_main` / `requires_on_main`. | A cycle means no slice can start. The error names the exact path (`a-ready.md -> b-ready.md -> a-ready.md`) so the author can find the back-edge. |
| `CLUSTER_DEAD_GATE` | A `requires_on_main` needle is ALREADY present on `origin/main` at intake time. | The arming PR would dispatch that slice instantly with no gate at all, which reads as ordered and is not. The predecessor already merged, or the needle is wrong. |

### Worked example - a two-slice cluster

```yaml
# pr-my-feature-s1-schema-ready.md
---
premise: '! grep -q "MyFeatureConfig" apps/api/prisma/schema.prisma'
premise_means: The MyFeatureConfig model does not exist yet.
scope:
  - apps/api/prisma/schema.prisma
done_when: pnpm build
size: 2
gate_allow: migrations
rollback_strategy: 'additive; safe to leave, re-run drops nothing'
cluster: my-feature
cluster_order: 1
---
```

```yaml
# pr-my-feature-s2-service-ready.md
---
premise: '! grep -q "myFeatureService" apps/api/src/modules/my-feature/'
premise_means: The MyFeatureService does not exist yet.
scope:
  - apps/api/src/modules/my-feature/**
done_when: pnpm build
size: 4
gate_allow: none
cluster: my-feature
cluster_order: 2
requires_on_main: apps/api/prisma/schema.prisma :: MyFeatureConfig
---
```

Slice 2's `requires_on_main` names the exact artifact slice 1 introduces (`MyFeatureConfig`).
If someone arms slice 2 while `MyFeatureConfig` is already on `main` (slice 1 merged and the
gate needle stayed unchanged) the linter REJECTs `CLUSTER_DEAD_GATE` - the arming author has
to either re-point the gate at a fresh predecessor artifact or drop the gate entirely.

### Fail-safe behaviour

Both `CLUSTER_CYCLE` (reads sibling prompt files) and `CLUSTER_DEAD_GATE` (probes
`origin/main` via `git show`) fail SAFE, not closed. An unreadable directory, a malformed
sibling, or a broken `git` binary emits a WARN line to stderr and SKIPs that check - it
never rejects a well-formed prompt because unrelated tooling around it is broken. One bad
prompt cannot block the whole queue.

### Typo traps the linter now rejects (SLICE 1, 2026-08-18)

**The linter rejects any unrecognised `requires*` key with `UNKNOWN_KEY` and suggests
the nearest legal key.** A mistyped key previously passed lint and the prompt ran
completely ungated -- silently losing its ordering gate. Common traps:

| Wrong | Right | Error |
|---|---|---|
| `requires-merged:` (hyphen) | `requires_merged:` | `UNKNOWN_KEY` |
| `requires_files_on_main:` (plural) | `requires_file_on_main:` (singular) | `UNKNOWN_KEY` |
| `require_merged:` (no `s`) | `requires_merged:` | `UNKNOWN_KEY` |
| `requires_merge:` | `requires_merged:` | `UNKNOWN_KEY` |

**The singular/plural trap is the most common:** `requires_file_on_main` (singular) is
the real key. `requires_files_on_main` (plural) looks plausible, passes a spell-check,
but the watcher never sees it and the gate silently disappears. The linter now catches it.

## Optional: `fixes_pr` — the fix lane

When a merged regression or a red PR blocks other work, a fix-forward prompt for
it must NOT queue behind ordinary work. Add:

```yaml
---
fixes_pr: 812
---
```

The watcher recognises this as a **fix-lane** prompt and inserts it at the FRONT
of the queue (behind any currently-running job, in front of every other armed
prompt — the same mechanism `rev-*` review jobs use). Log line:
`[fix-lane] <name> jumped to front (fixes PR #N)`.

**Dependency hold pairs with this.** Any dependent prompt that declares
`requires_merged: [N]` stays HELD (not binned) while the fix is in flight,
because PR N is still OPEN — the existing dep-gate already defers rather than
discards when a dep isn't MERGED.

**Intake lint live-checks the target.** At dequeue time the linter runs
`gh pr view N --json state` and REJECTs `FIX_TARGET_SETTLED` when N is MERGED
or CLOSED. A fix pointer that has settled is a stale diagnosis; re-author
against current head or drop the prompt. A gh failure REJECTs with
`FIX_TARGET_UNKNOWN` (fail closed — never bin work on a broken tool).

**Authoring rule.** A fix prompt SHOULD instruct the agent to **re-verify the
failure on the current head before acting**. Errors drift — by the time the fix
runs, the log may point somewhere new. Chase the log, not the original diagnosis.

## Lint failures you will hit

| Failure | Meaning |
|---|---|
| `PREMISE ALREADY SATISFIED` | The work is done. Binned. This is the lint **working** — 34 runs saved. |
| `PREMISE INVALID` | The command errored. Your assumption about the repo is wrong. Fix it. |
| `SIZE TOO LARGE` | Split it. Non-negotiable. |
| `MISSING FIELD` | Front-matter incomplete. Also fires when `scope` touches `prisma/migrations` and `rollback_strategy` is missing/empty. |
| `GATE_ALLOW MISMATCH` | You declared a migration but `scope` has no `migrations/` path (or vice-versa). |
| `BACKFILL_TEST_REQUIRED` | `scope` touches `prisma/migrations/**` but names no `*.spec.ts` / `*.test.ts` file and does not declare `backfill: false`. Gate A (closes the #923 class): bring a test that runs the backfill, or assert the migration is purely additive. See `docs/plans/pipeline-correctness-gates-plan.md` §2 Gate A. |
| `FIX_TARGET_SETTLED` | `fixes_pr: N` points at a PR that has MERGED or CLOSED — the fix diagnosis is stale. |
| `FIX_TARGET_UNKNOWN` | `fixes_pr` state check failed (bad number, network, gh auth). Fix the pointer. |
| `FIX_TARGET_INVALID` | `fixes_pr` is not a positive integer. |
| `DESTRUCTIVE_MUST_ESCALATE` | Destructive signal detected (`backfill`, `NOT NULL`, `DROP TABLE/COLUMN/CONSTRAINT/TYPE`, `DELETE FROM`, `TRUNCATE`, `drop-legacy`, or `destructive`) but `escalates` is not `true`. Set `escalates: true`. (OPS-6 2026-08-12) |
| `UNKNOWN_KEY` | A `requires*` key in front-matter does not match any of the three legal keys (`requires_merged`, `requires_file_on_main`, `requires_on_main`). The rejection message suggests the nearest legal key. Common causes: hyphen instead of underscore (`requires-merged`), plural instead of singular (`requires_files_on_main`). |
| `REQUIRES_MERGED_INVALID` | `requires_merged` value is not a positive integer. Reject: `0`, negatives, `#123`, `abc`, empty. The watcher silently ignores non-integer values, so the gate would disappear. |
| `REQUIRES_PATH_EMPTY` | `requires_file_on_main` or `requires_on_main` has an empty value. An empty path gates nothing and the prompt runs ungated. |
| `CLUSTER_BAD_SLUG` | `cluster` does not match `^[a-z][a-z0-9-]{2,40}$` (lowercase-kebab, 3-41 chars, must start with a letter). |
| `CLUSTER_ORDER_INVALID` | `cluster_order` is not a positive integer. |
| `CLUSTER_ORDER_NO_CLUSTER` | `cluster_order` is set but `cluster` is not - a position without a chain has no meaning. |
| `CLUSTER_NO_DEP` | `cluster_order > 1` but no `requires_merged` / `requires_file_on_main` / `requires_on_main` - a later slice with nothing to wait on dispatches alongside the first one. |
| `CLUSTER_CYCLE` | Two or more prompts in the same cluster reference each other's files. The error names the cycle path. |
| `CLUSTER_DEAD_GATE` | A `requires_on_main` needle is already on `origin/main` at intake - the ordering gate is a no-op. Only checked for cluster prompts. |
| `FILE_GATE_DEAD` | A `requires_file_on_main` path is already on `origin/main` at intake - the gate can never fail, so the slice would dispatch ungated. Applies to ALL prompts (cluster or not). Fail-safe on git errors: WARN and skip. |

---

## Arming a prompt requires `git add -f`

`.gitignore:73` ignores `docs/pr-prompts/*-ready.md`:

```
docs/pr-prompts/*-ready.md
```

A plain `git add docs/pr-prompts/pr-<slug>-ready.md` therefore does **nothing** â€” silently. The
file is not staged, the arming PR contains no prompt, and the prompt never reaches `main`. Use:

```
git add -f docs/pr-prompts/pr-<slug>-ready.md
```

Two things make this easy to get wrong, so check for both:

- **`git check-ignore` can return empty for an ignored path.** If the file is *already tracked*,
  the ignore rule no longer applies to it and `check-ignore` reports nothing. An empty result is
  therefore not evidence that the pattern does not exist â€” it may only mean this particular file
  was force-added once before. Read `.gitignore` directly rather than probing one file.
- **Reaching `main` is not the same as running.** The watcher consumes prompts from the DEV TREE
  filesystem at `C:\ProjectOperations2\docs\pr-prompts\`, not from `main`. After the arming PR
  merges, the file must also be materialised into that directory. A committed-but-unmaterialised
  prompt never runs.

`*-HOLD.md` is not covered by the ignore pattern and stages normally. Only `*-ready.md` needs the
`-f`.

