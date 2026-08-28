# Station 00 — Supervisor — 2026-08-28 18:09Z

<!-- HEADINGS RESTRUCTURED 2026-08-28T20:2xZ by the 20:09Z Station 00 run, to satisfy
     check-breadcrumb.mjs (this file was the single REJECT: 83 checked / 1 malformed).
     Section titles only. No finding, no measurement and no disposition was altered. -->

**RUN CLASS: DEGRADED / READ-ONLY. This was NOT a healthy quiet run.**

## GROUND

```
UTC            2026-08-28T18:09Z
origin/main    [CANNOT MEASURE] — no shell, no git this run
dev tree       [CANNOT MEASURE] — read the files, never invoked git against them
doc version    1
bootstrap      1                 (MATCH)
```

I could not start a shell on the Windows host. I could read the dev tree directly.

## WHAT I MEASURED

**What I could and could not reach**

- **COULD NOT:** PowerShell on the Windows host. The `desktop-commander` MCP never finished
  connecting this session, so `start_process` does not exist. Consequence: **no `git`, no `gh`,
  no `pipeline-lib.ps1`.** I cannot arm, cannot merge, cannot commit, cannot read the git index.
- **COULD:** the **dev tree itself**, `C:\ProjectOperations2`, mounted read/write into the sandbox.
  This is the tree the watcher globs — it is NOT a GitHub-side substitute. All `[MEASURED]` lines
  below come from it. `git` was deliberately NOT invoked against it (0-byte `index.lock` hazard).
- **SUPPLEMENTARY:** GitHub MCP read of open PRs, labelled as such.

`[MEASURED]` from `docs/pr-prompts/failed/*.log` and `*.report.md`:

| prompt | started (UTC) | exit | outcome |
|---|---|---|---|
| `rev-1382-ready.md` | 2026-08-28T16:13:25Z | 1 | quarantined, 0 retries |
| `rev-1383-ready.md` | 2026-08-28T16:13:44Z | 1 | quarantined, 0 retries |
| `rev-1384-ready.md` | 2026-08-28T16:20:38Z | 1 | quarantined, 0 retries |

- **Last successful agent run: 2026-08-28T14:34:04Z** (exit 0, in `processed/`).
- **Onset is bracketed: after 14:34Z, before 16:13Z.**
- The 401 string appears in **8 files, all in `failed/`, and in ZERO files in `processed/`**
  (3580 entries). A 401 has never once been survived. It is fatal, not flaky.
- The only prior occurrence is a lone 2026-07-31T01:12Z event — a different, isolated incident.
- Retries used = 0. The watcher does not treat a 401 as retryable, so it burns the prompt
  immediately and quarantines it.
- **ARMED = 0**, counted as depth-1 `*-ready.md` under `docs/pr-prompts/`.
- Newest repo write is 16:20Z; nothing since. Consistent with ARMED=0 plus a dead agent lane.
- `[CANNOT MEASURE]` — whether the watcher **process** is alive. That needs a shell. Do not assume
  either way; "it is dead" decays as fast as "it is alive".
- `[CANNOT MEASURE]` — the shared git index, so **the half-arm probe
  (`git diff --cached --name-status` for an `R100 …-HOLD.md -> …-ready.md` with no file on disk)
  WAS NOT RUN THIS CYCLE.** It found two half-arms on 08-28. **The next station with a shell must
  run it before anything else.**

## WHAT CHANGED

Nothing. No arm, no merge, no commit, no label, no file in the queue moved. This run had no shell
and therefore no ability to mutate anything; the only write was this breadcrumb itself, untracked.

## FINDINGS

### FINDING 1 — 🔴 THE WATCHER'S AGENT LANE IS DEAD ON AN EXPIRED OAUTH TOKEN

Every prompt the watcher has fired since 2026-08-28T16:13Z has died identically:

```
Failed to authenticate. API Error: 401 OAuth access token has expired. Re-authenticate to continue.
```

**Consequence, and it is the important part: ARMING ANYTHING RIGHT NOW DESTROYS IT.**
The prompt is consumed, exits 1, and lands in `failed/` without a single line of real work. This is
the same "burned arm" failure mode as the prose human gate, through a different door — and unlike
that one, it will hit *every* prompt, not an unlucky one.

**Standing instruction until Marco clears it: ARM NOTHING. ARMED must stay 0.**

Re-authenticating the watcher's Claude credential is his to do; no agent can do it and no agent
should try. The three quarantined `rev-138x` prompts are recoverable — they are review prompts for
PRs that are all still open, so they can simply be re-raised once auth is restored. Nothing was lost
except the three firings.

**ESCALATED** — Marco; category 3/4 (authorization grant / auth config that cannot be verified
without him). Blocks the whole pipeline.

### FINDING 2 — board state. `[MEASURED]`, decays, re-measure

- **OPEN = 3, and all three need Marco** (GitHub MCP, 18:09Z):
  - **#1383** `docs(pipeline): name check-breadcrumb.mjs, correct docs/qa/ claim…`
  - **#1382** `docs(stations): name check-breadcrumb validator, correct docs/qa/ tracking claim`
    — #1382/#1383 remain the **mutually-exclusive duplicates**; the wording pick is Marco's and is
    still unanswered. Option A (RULE 1 complete+additive) = merge #1383, close #1382.
  - **#1377** — carries `do-not-merge`. Untouched.
- ARMED must stay 0 while FINDING 1 holds.

**ESCALATED** — the #1382-vs-#1383 duplicate wording pick is unchanged and still Marco's.

### FINDING 3 — arm-nothing standing instruction while the 401 persists

**ACTIONED** — recorded here, and carried into the memory index so the next run reads it before it
touches the queue.

### FINDING 4 — the half-arm index probe was not run this cycle

**DEFERRED** — to the next station that has a shell. It is the first thing that station must run.

### FINDING 5 — Station 00 lacked a Windows shell in the scheduled runner

A cloud-fired or Desktop-Commander-less 00 structurally cannot arm or merge, which is 00's entire
lane.

**ESCALATED** — Marco.

## WHAT I DID NOT DO

- Did not arm, merge, label, close or commit anything — no shell, and FINDING 1 forbids arming
  regardless.
- Did not run `git` against the mounted dev tree (0-byte `index.lock` hazard through the bridge).
- Did not substitute GitHub-side reads for the box and present them as coverage; the GitHub MCP
  reads above are labelled as supplementary.
- Could not commit this file — no `git`. It is written **untracked** into the dev tree at the
  contract path so the next station sees it. It is not a `*-ready.md` and cannot be globbed or armed.
