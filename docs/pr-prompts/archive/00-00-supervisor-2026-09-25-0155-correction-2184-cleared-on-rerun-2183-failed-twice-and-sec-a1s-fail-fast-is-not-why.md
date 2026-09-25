# Station 00 — Supervisor | 2026-09-25T01:55Z–2026-09-25T02:05Z

**This is a CORRECTION to this same run's own breadcrumb**
`archive/00-00-supervisor-2026-09-25-0114-two-prs-red-on-a-flake-...md`, landed in **#2187**
(merged 2026-09-25T01:38:09Z). That report closed with the e2e outcome marked `[CANNOT MEASURE]` and
named the exact read-back to perform. The read-back has now been performed and it **splits the two
PRs**, which the original could not know. It is written here rather than left for the next run because
the original names a probe whose answer changes one PR's disposition.

## GROUND

```
UTC            2026-09-25T01:55Z
origin/main    de63eb78              (fetch, then rev-parse — advanced by #2187)
dev tree       main @ 1e5f3f11       C:\ProjectOperations2  (behind by this run's own merge)
doc version    1
bootstrap      1
```

## WHAT I MEASURED

### The read-back F1 asked for

`gh pr checks <n> -R <owner>/<repo> --json name,state`, reading `tendering-e2e`:

| PR | before re-run | after re-run | remaining failures |
|---|---|---|---|
| **#2184** | FAILURE | **SUCCESS** | 2 — the CP-26 / diff-checks label pair only |
| **#2183** | FAILURE | **FAILURE** | 3 |

So the original finding was right about #2184 and **wrong to generalise to #2183**: one re-run cleared
one PR and not the other, on the same four tests.

### #2183 failed on the IDENTICAL four tests, in the identical order

```
✘ 24 batch1-dashboards.spec.ts:262 › SLICE 5 — dashboard-level filter bar …
✘ 25 batch1-dashboards.spec.ts:350 › SLICE 7 — create dashboard from Reporting dashboard template …
✘ 26 batch1-dashboards.spec.ts:398 › SLICE 4 — add a report chart widget from the gallery …
✘ 27 batch1-dashboards.spec.ts:468 › SLICE 6 — Export button on a report widget triggers a download …
```

Failure text unchanged: `Error: element(s) not found` ×3 and a `locator.click: Test timeout` on
SLICE 5.

### I hypothesised that SEC-A1's own fail-fast was the cause. THE PROBE REFUTES IT.

#2183 is *"refuse to start in production on missing or placeholder JWT secrets"*, and the e2e
workflow's environment dump shows **literal placeholders**:

```
JWT_ACCESS_SECRET: replace-me-access
JWT_REFRESH_SECRET: replace-me-refresh
```

That is exactly the condition the PR exists to reject, so "SEC-A1 is killing the API in CI" was the
available and plausible reading. It is false. [MEASURED] over the same job log, split on tab and
searched in the last column (POSITIVE control `JWT_ACCESS_SECRET` → **14** lines; NEGATIVE control, a
freshly minted needle → **0**):

- `placeholder|refusing|refuse to start|SEC-A1|SEC_A1|fail-fast` → **one** hit, and it is the *name of
  a passing test* (`AI Settings page renders without stale placeholder text`). No refusal message, no
  boot failure, no SEC-A1 marker anywhere.
- **135+ tests ran and passed** in that job, including `batch8-admin-portal`. The API booted.

The fail-fast is scoped to production, as the PR's own title says, and CI is not production. **#2183's
diff is not why its e2e is red.** The cause is the same flaky dashboards suite that #2184 escaped on
its first re-run; #2183 has now lost the toss twice.

⚠️ The refuted hypothesis is recorded rather than deleted, because the reading it was built on — a
security PR plus literal placeholder secrets in the CI env — will look just as compelling to the next
run, and its refutation is one grep.

## WHAT CHANGED

1. **#2187 merged** at 2026-09-25T01:38:09Z via native squash auto-merge, which this run armed. Read
   back `state=MERGED mergedAt=2026-09-25T01:38:09Z`; `origin/main` advanced `1e5f3f11` → `de63eb78`.
   Its lane was established before arming auto-merge with the §10.1 step-1 probe over 954
   `processed/pr-*.log`: TARGET `PR #2187` → **0**, POSITIVE control `PR #2148` → **2**, NEGATIVE
   control `PR #999997` → **0**; hand-classified `[NO LANE VERDICT — hand-classified]` as a Station 00
   docs-only board PR confined to `docs/pr-prompts/`, i.e. inside 00's recorded lane
   (`STATION-CAPABILITIES.md` §5).
2. **Dispatched a SECOND `--failed` re-run on #2183** (`gh run rerun 36079586490 --failed`, exit 0) at
   ~01:55Z, to give the next run a third data point on the same four tests rather than a second.
3. **Staged `pr-e2e-batch1-dashboards-isolate-the-four-flaky-slices-HOLD.md`** — the permanent fix.
4. This correction breadcrumb, written inside this PR's worktree (Cure 1).

Nothing else changed. No merge, no label, no prune, no arm (RULE 4 — the 01:29Z arm is still in flight).

## FINDINGS

### F1 — CORRECTION: #2184 was a flake and is now green but for the label; #2183 is red on a REPRODUCIBLE flake, and it is not its own diff's fault

The original F1 treated the two PRs as one case. They are not. #2184's re-run cleared. #2183's did
not, on the identical four tests, and the SEC-A1 hypothesis that its own change was to blame is
refuted by its own log with both controls passing.

**DISPOSITION: ACTIONED** for #2184 — `tendering-e2e` **SUCCESS**, failures down to the two
label reds, so it is green-but-for-Marco's-label and needs nothing further from any station.
**DISPOSITION: DISPATCHED** for #2183 — handed to the **watcher** as a staged prompt (item 3 above),
because the defect is in `tests/e2e/**`, which is inside the `tests|docs` lane and therefore buildable
and auto-mergeable without Marco. A third re-run is in flight; the next run should read
`gh pr checks 2183 --json name,state` and record 2-of-3 or 3-of-3 against the prompt's premise.

### F2 — The four failing SLICEs are a shared-state cluster, not four independent tests

They fail together, in order, on two different branches, and the three later ones fail with
`element(s) not found` while the first fails with a `locator.click` timeout — the shape of a first test
leaving the page or the dashboard list in a state the next three cannot find their fixtures in. Each of
the four independently purges `Remove <prefix>-` residue and names its dashboard
`<prefix>-${Date.now()}`, so the names cannot collide; what is not isolated is the dashboard LIST and
the sidebar the four share.

**DISPOSITION: DISPATCHED** — to the watcher, in the same staged prompt. The prompt does not guess the
mechanism: it requires the builder to reproduce the ordering locally first and to name the shared state
before changing it, because a "fix" to a flaky test that is not reproduced is a mask (§8.2).

### F3 — A flaky suite that fails 1-of-4 PRs per batch is a board-wide throughput tax, and it is not on file anywhere

Two of four PRs went red on it in one 00:51Z batch; one cleared on one re-run, one has not in two. Every
occurrence costs a re-run and an hour of a station's slot, and it can turn `main` red on a docs-only
commit — which `00-supervisor.md` rule 5 tells a run to read as *"instant proof of a MAIN regression"*,
sending it hunting for a regression that does not exist. That exact misreading is already recorded in
this pipeline's history (breadcrumb `00-00-supervisor-2026-09-24-0014-the-trunk-red-was-a-transient-e2e-flake...`).

**DISPOSITION: DEFERRED** — the finding is real and the remedy is F1/F2's prompt; what is deferred is
the DOCTRINE §9 bullet naming this suite as a known flake so no future run diagnoses it as a
regression. A canonical-block edit must ship across all seven station docs in one PR and is more than
this correction should carry. It becomes urgent the first time a run authors a `fixes_pr` against `main`
for these four tests.

## WHAT I DID NOT DO

- **Did not touch #2183's branch or diff.** The red is not its defect; editing it would be a mask.
- **Did not merge or label anything**, and did not remove any label. #2184 and #2183 both still carry
  `do-not-merge`; #2184 being green changes nothing about who releases it.
- **Did not arm the new prompt.** RULE 4 is one at a time and the 01:29Z arm is still building.
- **Did not re-run #2184.** It is SUCCESS; re-running a green check to see it again is not evidence.
- **Did not quarantine, skip or weaken the four failing tests.** That is the masking §8.2 forbids, and
  it would silently delete the only coverage of four dashboard SLICEs.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** Nor the watcher clone with any mutating git.
- **Did not fast-forward the dev tree.** It is behind by this run's own merge and carries three
  now-archived breadcrumb paths at the root plus a pre-existing `metadata-catalog.json` smudge; the
  cure and its discriminator are named in #2187's breadcrumb, and the next run owns it.
