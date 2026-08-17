# Cluster chaining — binding slice plan

**Status:** authored 2026-08-17 by PR Master with Marco; SLICE 0 (this document) awaiting
approval. No downstream slice arms until Marco says so.
**Owner:** Marco / ProjectOperations pipeline (`scripts/pr-watcher/**`,
`scripts/pipeline/**`, `docs/pr-prompts/PROMPT-SCHEMA.md`, `docs/pipeline/LESSONS.yaml`).
**Rule:** every downstream slice chains behind this document (`requires_merged`). Slices ship
independently, each ≤ ~10 files, each CI-green. Merge authority stays with the supervisor.

---

## 1. Goal

Give the queue a first-class **cluster** concept so an entire multi-slice initiative can be
staged in one arming PR, and give the watcher enough gates that ordering across a cluster —
and across clusters — is enforced by DISPATCH rather than by policy. When a chain breaks the
system self-heals or escalates; it never stalls silently and never leaves an armed prompt
sitting idle.

### Non-goals

- **No new merge authority for the watcher or the linter.** Merge decisions stay with the
  supervisor. `scripts/pr-watcher/merge-queue.mjs` may be wired only AFTER SLICE 7 lands its
  guards (`NEVER_MERGE`, `escalates: true`, do-not-merge label). Doing so beforehand would
  build an unguarded auto-merger.
- **No re-litigation of merge-liberty hard-stops.** Cluster chaining is upstream of merge
  policy — it decides what DISPATCHES, not what merges.
- **No fixing the `escalates: true` non-enforcement gap in this plan.** It is real (the
  watcher auto-merges every PR it opens, has no concept of `escalates`, and CI has no
  do-not-merge gate), and it MUST be recorded in §9 as a separate brief; but fixing it is a
  distinct piece of work and would balloon the scope here.
- **No editing under `sot/` in any slice of this cluster.** CP-24 hard-fails a mixed PR.
- **No regex quantifiers introduced in the watcher.** `index.mjs` deliberately avoids them
  (CodeQL js/polynomial-redos). Fixed-string containment only. See SLICE 2.

---

## 2. Verified current state (origin/main; read-only positive control passed 2026-08-17)

### 2.1 What already works — do not rebuild

- `scripts/pr-watcher/index.mjs` parses `requires_merged:` and `requires_file_on_main:` from
  YAML front-matter (plus a legacy HTML-comment form). The effective set is the
  de-duplicated union of both forms.
- `unmetDependencies()` runs `gh pr view <n> --json state` and REQUIRES state `MERGED`; and
  `git cat-file -e origin/main:<file>` for file dependencies. Any `gh` or `git` error counts
  as UNMET — fail-closed by construction.
- An unmet dependency **defers** the prompt: the prompt file is NOT consumed, it stays in
  `seen`, and the periodic rescan re-checks it. `syncMain()` pulls `main` so the next
  scheduling pass observes the newly-merged commit.
- `scripts/pr-watcher/merge-queue.mjs` already merges an ordered PR list sequentially,
  confirms `state == MERGED` before advancing, and re-runs a failed CI job once to clear
  transient flakes. **It is not wired to anything today.**
- A pause path exists: any remaining `*-ready.md` in the queue can be moved to `paused/`
  with a `PAUSED_SUMMARY.md`.
- A fix lane exists: `fixes_pr: <N>` front-inserts a fix-forward prompt ahead of ordinary
  work.

### 2.2 What is missing — the actual work in this cluster

1. **`scripts/pipeline/lint-prompt.mjs` contains ZERO references** to `requires_merged` or
   `requires_file_on_main`. A mistyped key — `requires-merged` (hyphen), or the plural
   `requires_files_on_main` (the real key is SINGULAR) — passes lint and the prompt runs
   COMPLETELY UNGATED. This is the out-of-order mechanism, and it is silent.
2. **No content gate.** `requires_file_on_main` only expresses "a new file exists at path
   X". Any slice that MODIFIES an existing file cannot be chained and cannot be pre-staged
   in a cluster.
3. **No cluster concept anywhere** — not in the watcher, not in the pipeline scripts, not
   in `PROMPT-SCHEMA.md`. Ordering today is emergent from declared dependencies only; two
   prompts with no declared dependency run in `readdir` order, and with two lanes they run
   CONCURRENTLY.
4. **A `requires_merged` target that is CLOSED-not-merged defers forever, silently** —
   violating the DOCTRINE never-exit-silently rule.
5. **QUEUE ROT, verified 2026-08-17.** Two prompts sit armed in `docs/pr-prompts/` that the
   CURRENT linter REJECTS, so neither can ever dispatch — they would be binned at dequeue
   and nobody would know. Both edit `scripts/pipeline/lint-prompt.mjs`; neither declares a
   dependency on the other; both fail the OPS-6 escalation heuristic:
   - `pr-pr-master-hardening-slice0-ready.md` — trips the escalation rule on its OWN prose
     describing the nullability signal it introduced.
   - The Gate-A intake lint-rule prompt — trips the rule on a single ordinary word in its
     body.

   Neither prompt is hazardous. The rule matches its trigger words ANYWHERE in the body —
   inside a file NAME, or inside prose that merely EXPLAINS the rule — so it fires on
   prompts that carry no risk. Demonstrated live while authoring this very prompt: two
   successive drafts were rejected, the second purely for quoting the rule's own wording in
   a description of the problem. This is the plan's worked example: an armed prompt whose
   lint status nobody re-checks is exactly the "sitting idle" failure Marco is trying to
   eliminate, and an over-matching rule is how a safety gate loses its authority. SLICE 1
   must decide whether the two rot-prompts are re-authored, retired, or chained ahead of
   SLICE 1 — and record the decision in this document before SLICE 1 arms.

---

## 3. Design decisions Marco approved (do not re-litigate)

- **The chaining primitive is the ARTIFACT, not the PR number.** A cluster stages in one
  arming PR with no numbers to fill in later. `requires_merged` remains supported for
  after-the-fact chaining against known PR numbers.
- **Extend the watcher with a CONTENT gate** so modified files can be chained. New key
  `requires_on_main:` accepts either `<path>` or `<path> :: <fixed-string>`. The string
  form checks `git show origin/main:<path>` for FIXED-STRING containment — **NOT a regex**.
  Missing file → UNMET (never throws). Fixed-string only; do not reintroduce quantifiers.
- **A cluster is a DAG, not a line.** A slice waits ONLY on the slices it explicitly
  declares. Independent siblings run IN PARALLEL across both watcher lanes — that is what
  two lanes exist for. In the theme cluster, for example, the token-cleanup slices are
  mutually independent once the foundation slice has landed; forcing them through one lane
  would waste a lane on the largest phase of the work. Marco corrected an earlier
  "one cluster, one lane" proposal on exactly this ground.
- **SCOPE OVERLAP serialises, independently of dependencies.** Two prompts with no
  dependency between them can still edit the same file. Derive this from the `scope` globs
  already present in every prompt: if two ready prompts have overlapping `scope`, dispatch
  them one at a time even when neither declares a dependency — AND DO THIS ACROSS CLUSTERS
  TOO. Dependencies express ORDER; scope overlap expresses COLLISION. Both are required;
  only the first exists today.
- **Ordering comes from DISPATCH gating, not from merge control.** A slice cannot start
  until its declared predecessor's artifact is on `main`, so a dependent pair can never
  have two PRs open at once. Out-of-order merging inside a chain is impossible by
  construction rather than by policy.
- **`merge-queue.mjs` may be wired ONLY AFTER SLICE 7.** Today it checks NOTHING —
  no `NEVER_MERGE` list, no `escalates`, no label — so wiring it as-is would build an
  unguarded automatic merger. With two lanes producing PRs concurrently the supervisor
  genuinely wants it, so the guards are a slice in this plan rather than a prohibition.
  Merge authority stays with the supervisor.
- **Broken chain**: pause the cluster (existing `paused/` machinery) with a summary naming
  the broken link, AND auto-author a fix-forward prompt (`fixes_pr: <N>`) inside the same
  cluster so the chain can free itself once the fix is on `main`. After TWO failed fix
  attempts, escalate to Marco — the doctrine's two-honest-attempts rule.
- **Visibility ships WITH the gates, not later.** A deferred prompt must be answerable
  with one command: which cluster, which slice, what it is waiting on, since when.

---

## 4. The slices

Each slice ≤ ~10 files. Each ships independently and CI-green. Each has a machine-checkable
premise: if the premise is already false when the agent boots, the run exits NO-OP.

### SLICE 1 — Intake linter learns the dependency keys

- **Goal:** `scripts/pipeline/lint-prompt.mjs` recognises `requires_merged`,
  `requires_file_on_main`, and `requires_on_main`. ANY unrecognised `requires*` key is
  rejected as a typo (`UNKNOWN_KEY`) with a suggestion. Rejects `requires_merged: <n>`
  where `<n>` is not a positive integer, and rejects `requires_file_on_main:` /
  `requires_on_main:` with an empty path.
- **Files expected:** `scripts/pipeline/lint-prompt.mjs`,
  `scripts/pipeline/lint-prompt.test.mjs` (or the existing test file for the linter),
  `docs/pr-prompts/PROMPT-SCHEMA.md`.
- **Premise:** `! grep -q "requires_merged" scripts/pipeline/lint-prompt.mjs`
- **Predecessor:** none (this is the foundation).
- **Acceptance:** negative tests for each typo case are RED before the fix and GREEN after.
  A prompt with `requires-merged: 42` (hyphen) is REJECTED, not silently accepted.
- **Housekeeping:** the two rot-prompts listed in §2.2(5) both edit this file. Before SLICE
  1 arms, Marco decides whether each is (a) re-authored to pass current lint, (b) retired,
  or (c) chained ahead of SLICE 1. Record the decision in an addendum to this section.

### SLICE 2 — Watcher: the `requires_on_main` content gate

- **Goal:** extend `unmetDependencies()` in `scripts/pr-watcher/index.mjs` to honour
  `requires_on_main:`. Value forms:
  - `<path>` — equivalent to existing `requires_file_on_main` (file must exist on
    `origin/main`).
  - `<path> :: <fixed-string>` — the string must appear (FIXED-STRING containment) in
    `git show origin/main:<path>`. A missing file counts as UNMET, not a throw.
- **Files expected:** `scripts/pr-watcher/index.mjs`,
  `scripts/pr-watcher/index.test.mjs` (or equivalent), `docs/pr-prompts/PROMPT-SCHEMA.md`.
- **Premise:** `! grep -q "requires_on_main" scripts/pr-watcher/index.mjs`
- **Predecessor:** SLICE 1 on `main` — so the linter already accepts the new key.
  Encoded as `requires_on_main: scripts/pipeline/lint-prompt.mjs :: requires_on_main`.
- **Acceptance:** unit tests cover: missing file (UNMET), file present + string absent
  (UNMET), file present + string present (MET), malformed value (UNMET + warn), and the
  regex-free implementation (no `new RegExp(...)` on the value).

### SLICE 3 — Cluster metadata + linter rules

- **Goal:** introduce `cluster: <slug>` and `cluster_order: <n>` front-matter keys, and
  teach the linter to enforce cluster consistency.
- **Files expected:** `scripts/pipeline/lint-prompt.mjs`,
  `docs/pr-prompts/PROMPT-SCHEMA.md`, tests.
- **Premise:** `! grep -q "cluster_order" scripts/pipeline/lint-prompt.mjs`
- **Predecessor:** SLICE 1 on `main`.
  Encoded as `requires_on_main: scripts/pipeline/lint-prompt.mjs :: UNKNOWN_KEY`.
- **Acceptance / rejection rules:**
  - `cluster_order > 1` with NO declared dependency (`requires_merged`,
    `requires_file_on_main`, or `requires_on_main`) → REJECT (`CLUSTER_NO_DEP`).
  - A cycle in a cluster's declared-dependency graph, computed across the ready+HOLD
    prompts staged in `docs/pr-prompts/**` → REJECT (`CLUSTER_CYCLE`).
  - A **dead gate** — a `requires_on_main` whose fixed string is ALREADY present on
    `origin/main` at intake time — REJECT (`CLUSTER_DEAD_GATE`), because the arming PR
    would dispatch that slice immediately with no gate.
  - Cluster slug must be `^[a-z][a-z0-9-]{2,40}$`.

### SLICE 4 — Watcher dispatch: DAG traversal + scope-overlap serialisation

- **Goal:** teach the watcher to (a) walk each cluster's DAG, running independent siblings
  in PARALLEL across the two lanes; and (b) serialise any two ready prompts that share a
  declared dependency edge OR whose `scope` globs OVERLAP — across clusters too. Tie-break
  on `cluster_order` so dispatch is deterministic, not filesystem-ordered.
- **Files expected:** `scripts/pr-watcher/index.mjs`,
  `scripts/pr-watcher/scope-overlap.mjs` (new small pure module), tests.
- **Premise:** `! grep -q "scope-overlap" scripts/pr-watcher/index.mjs`
- **Predecessor:** SLICE 2 (content gate) AND SLICE 3 (cluster keys) both on `main`.
  Encoded as two `requires_on_main:` entries.
- **Acceptance:** unit tests cover: two independent siblings dispatched to both lanes; a
  parent + child never dispatched concurrently; two cross-cluster prompts with
  overlapping `scope` serialised; tie-break by `cluster_order` deterministic on identical
  wall-clock; DAG walk terminates on the cycle case defined in SLICE 3.
- **Note on `scope` overlap semantics**: overlap is the intersection of the globs' matched
  file sets against a snapshot of the working tree — NOT string equality of the glob
  patterns. Two prompts whose globs both match `apps/api/src/foo.ts` collide even if the
  glob strings differ.

### SLICE 5 — Visibility

- **Goal:** answer "what is armed and why is it waiting?" in one command, and never let a
  defer loop silently past a threshold.
- **Files expected:** `scripts/pr-watcher/cluster-status.mjs` (new), an npm script,
  small change in `scripts/pr-watcher/index.mjs` for the per-defer log line.
- **Premise:** `! test -f scripts/pr-watcher/cluster-status.mjs`
- **Predecessor:** SLICE 4 on `main`.
- **Acceptance:**
  - `node scripts/pr-watcher/cluster-status.mjs` prints one row per armed prompt with
    columns: cluster, `cluster_order`, prompt file, state (READY / DEFERRED / RUNNING /
    PAUSED), what-awaited (predecessor slice id / PR number / path::string), waited-since
    (ISO timestamp).
  - Every DEFER emits a single log line with those fields; a prompt deferred for more than
    a configurable threshold (default 6 hours) triggers an escalation ping to Marco via the
    existing `needs-marco/` router.

### SLICE 6 — Broken-chain handling

- **Goal:** when a slice's PR is CLOSED-not-merged, or is red past the two-attempts rule,
  the cluster pauses AND auto-authors a `fixes_pr: <N>` prompt inside the same cluster.
  After two failed fix attempts, escalate to Marco.
- **Files expected:** `scripts/pr-watcher/broken-chain.mjs` (new pure module),
  `scripts/pr-watcher/index.mjs` (wire it), tests.
- **Premise:** `! test -f scripts/pr-watcher/broken-chain.mjs`
- **Predecessor:** SLICE 5 on `main` (visibility ships first so the pause is observable).
- **Acceptance:** a synthetic cluster whose middle slice is CLOSED-not-merged results in:
  (a) the cluster's remaining ready prompts moved to `paused/` with a `PAUSED_SUMMARY.md`
  naming the broken link; (b) a `pr-<cluster>-fix-<slice-id>-ready.md` prompt authored
  with `fixes_pr:` set correctly; (c) after two consecutive failed fix attempts, an
  escalation lands in `needs-marco/`.

### SLICE 7 — Guard `merge-queue.mjs` (prerequisite for any auto-merge wiring)

- **Goal:** before ANYTHING wires the merge queue, it must refuse:
  1. A PR whose head is in the `NEVER_MERGE` list.
  2. A PR whose originating prompt carried `escalates: true`.
  3. A PR carrying a do-not-merge label (`do-not-merge`, `needs-marco`, `hold`).
- **Files expected:** `scripts/pr-watcher/merge-queue.mjs`,
  `scripts/pr-watcher/merge-queue.test.mjs`, docs.
- **Premise:** `! grep -q "NEVER_MERGE" scripts/pr-watcher/merge-queue.mjs`
- **Predecessor:** none of the above slices — this one is standalone and can arm in
  parallel with any of them, since it doesn't touch dispatch. Recommended `cluster_order`
  early so it lands before the supervisor is tempted to wire the queue.
- **Acceptance:** each of the three refusal paths has a unit test; refusal exits non-zero
  and prints the reason.

### SLICE 8 — Lesson + worked example

- **Goal:** codify the lesson so it survives beyond this cluster.
- **Files expected:** `docs/pipeline/LESSONS.yaml` (new entry),
  `docs/pr-prompts/PROMPT-SCHEMA.md` (worked example section).
- **Premise:** `! grep -q "cluster-chaining" docs/pipeline/LESSONS.yaml`
- **Predecessor:** SLICES 1–7 all on `main`.
- **Acceptance:** a new lesson entry (`id: cluster-chaining`) with a MECHANICAL guard
  pointing at the linter rules and the watcher gates (not a prose reminder); a worked
  example in `PROMPT-SCHEMA.md` showing a two-slice cluster with `cluster:`,
  `cluster_order:`, and a `requires_on_main:` content gate.

---

## 5. What ordering looks like once all eight slices are on main

- Marco writes a cluster of N slices in one arming PR: N `pr-*.md` files, all with the
  same `cluster: <slug>`, ascending `cluster_order`, each declaring predecessors via
  `requires_on_main:` (fixed-string containment of an artifact the predecessor will land).
- Intake lint rejects the arming PR if any slice has a typo'd key, a missing dependency
  where `cluster_order > 1`, a cycle, or a dead gate.
- Once merged, the watcher walks each cluster's DAG. Independent siblings run in parallel
  across the two lanes. Dependent pairs cannot have two PRs open at once, because dispatch
  itself is gated on the predecessor's artifact being on `main`.
- Prompts with overlapping `scope` are serialised, even across clusters.
- A closed-not-merged slice pauses the cluster and auto-authors a fix-forward; two failed
  fix attempts escalate to Marco.
- `node scripts/pr-watcher/cluster-status.mjs` answers "what is going on" at any moment.
- The merge queue (if the supervisor chooses to wire it later) refuses any PR it must not
  auto-merge.

---

## 6. Test strategy

- **Unit tests, per slice:** each slice ships its own tests co-located with the changed
  script. Prefer pure modules for the new logic (scope overlap, DAG traversal, broken-
  chain detection) so they are unit-testable without spawning `gh`/`git`.
- **Integration test (SLICE 4 acceptance):** a synthetic queue directory of ~6 prompts
  across 2 clusters, with a mix of dependencies and scope overlaps, is fed to the watcher
  in dry-run mode; the emitted dispatch order is asserted deterministic.
- **Regression:** SLICE 1's typo tests are the guard against the failure mode in §2.2(1).

---

## 7. Rollout order and gating

1. SLICE 1 arms first (foundation; nothing gates on it in the watcher).
2. SLICE 7 may arm in parallel with SLICE 1 (guards `merge-queue.mjs`; no dispatch
   dependency).
3. SLICE 2 arms after SLICE 1 is on `main`.
4. SLICE 3 arms after SLICE 1 is on `main` (independent of SLICE 2).
5. SLICE 4 arms after both SLICE 2 and SLICE 3 are on `main`.
6. SLICE 5 arms after SLICE 4.
7. SLICE 6 arms after SLICE 5.
8. SLICE 8 arms last, after 1–7 are all on `main`.

The `requires_on_main:` gates encode this order literally, so arming SLICES 1–8 all at
once (in one arming PR) is safe — the watcher will dispatch them in DAG order regardless
of `readdir`. This IS the cluster mechanism eating its own dogfood.

---

## 8. Rollback

Every slice is a small script change with tests. Rollback = revert the merge commit. No
migration, no schema change, no seed change. SLICE 6's `paused/` machinery already exists;
this cluster only adds callers.

---

## 9. Open questions (for Marco or a separate brief)

- **`escalates: true` is enforced by nothing.** The watcher auto-merges every PR it opens,
  has no concept of `escalates`, and CI has no do-not-merge gate. SLICE 7 addresses ONE
  half (the queue-side refusal) but only if the queue is ever wired. Fixing this end-to-
  end is a separate brief — a CI-side hard-fail on any PR whose originating prompt
  carries `escalates: true`, or on any PR labelled `escalates`. Recorded here so it is
  not lost.
- **Two-lane fairness.** With SCOPE OVERLAP serialisation across clusters, a very
  broad-scope prompt can effectively hog both lanes. Do we want an explicit
  `max_parallel_per_cluster` knob, or is the DAG's natural fan-out sufficient? Deferred
  until we see it happen.
- **Rot-prompt policy.** The two rot-prompts named in §2.2(5) are a symptom of a broader
  gap: no periodic re-lint of armed prompts against the CURRENT linter. Worth a small
  standalone script (`scripts/pipeline/relint-queue.mjs`) that runs nightly and posts to
  `needs-marco/` when an armed prompt no longer passes lint. Not in this cluster; noted
  for a follow-up.
- **OPS-6 escalation heuristic scope.** Marco has flagged that the rule matches trigger
  words anywhere in the body — inside file names, inside prose that merely EXPLAINS the
  rule. Tightening the heuristic (e.g. only match outside fenced code blocks, only match
  in imperative sentences, allow explicit `escalates_ok: true` for meta-prompts) is a
  separate brief. If it lands first, several rot-prompts free themselves.

---

## 10. VERIFY

```
pnpm lint
test -f docs/plans/cluster-chaining-plan.md
grep -q "SLICE 8" docs/plans/cluster-chaining-plan.md
grep -q "requires_on_main" docs/plans/cluster-chaining-plan.md
grep -q "SCOPE OVERLAP" docs/plans/cluster-chaining-plan.md
```
