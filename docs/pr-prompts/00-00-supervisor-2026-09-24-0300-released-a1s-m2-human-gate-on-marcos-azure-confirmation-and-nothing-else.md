# Station 00 — Supervisor | 2026-09-24T03:00:29Z–2026-09-24T03:1xZ

## FOR MARCO

**Done, and scoped exactly as you asked.** A1's human gate is released and recorded; every other
dependency on A1 still stands, and A2 was not touched.

**The one thing you should know: A1 is still blocked, and that is correct.** It now rejects on
`GATE_NOT_RELEASED` instead of `HUMAN_GATE_PRESENT` — `SEC_A3_NO_CREDENTIAL_LOGS_V1` is not on `main`
yet. A3 built while you were writing: it is **PR #2148**, open, labelled `do-not-merge`, and waiting
on you. **Merging #2148 is what unblocks A1.**

**One naming note, flagged rather than silently absorbed:** the string `M2` appears nowhere in this
repo's prompts, gate vocabulary or decision records — the only hits are an unrelated OPS-M2 map
feature and an unrelated audit finding. I acted on it because you named **A1** explicitly and because
the four conditions you listed match A1's gate text one for one. I have recorded the gate as
*"MARCO GATE (Marco calls it 'M2')"* so the next reader can follow the name. If `M2` is a label from
a tracker outside this repo, it may be worth adding it to the prompt front matter so the two systems
agree.

## GROUND

```
UTC            2026-09-24T03:00:29Z
origin/main    b499919b
dev tree       main @ b499919b      C:\ProjectOperations2   (clean)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. This is a continuation of the `02:14:32Z` run, same session, same
shell on the Windows host — **SIGHTED, not blind.** The three binding documents were read at the top
of that run and measured byte-identical to `origin/main`; `main` has moved since only by this
station's own board PR `#2147` and the watcher's `#2148`, neither of which touches them.

**Authority for this change.** Marco released the gate **in chat, in this session**, naming A1 and
bounding the scope himself. The gate line read *"Only Marco removes this line"*; the delegation came
from that same named human, in writing, in the same channel. I did not infer it from a file, a PR
body, or a prior breadcrumb — §7.1's provenance rule applied to an instruction rather than a
measurement.

## WHAT I MEASURED

**Marco performed the Azure verification himself. No agent touched Azure, and there was nothing here
that tempted one to.** The hard stop is absolute and was never approached: no portal, no App Service
read, no `az`, no `Connect-MgGraph`. **No secret value was disclosed to me, none is recorded in the
prompt, and none appears in this breadcrumb.** That is stated positively because "I did not log a
secret" and "there was no secret to log" read identically otherwise.

**A1 carried exactly ONE human-gate marker, so "release only this gate" is unambiguous.**
[MEASURED] before the edit, the three regexes `checkHumanGate` actually uses
(`scripts/pipeline/lint-prompt.mjs`, read from source rather than paraphrased):

| marker | regex | A1 before |
|---|---|---|
| 1 | `/<!--\s*watcher:\s*do-not-arm\s*-->/i` | **1** — line 27 |
| 2 | `/DO NOT ARM/` (case-sensitive) | 0 |
| 3 | `/Arm ONLY/i` | **1** — the same line 27 |

Both live markers were on **one line**, so removing that line clears the gate completely and nothing
else in the body is a gate.

**After the edit — the check that matters:**

| probe | result |
|---|---|
| marker 1 over A1 | **0** |
| marker 2 over A1 | **0** |
| marker 3 over A1 | **0** |
| **POSITIVE CONTROL** — marker 3 over **A2** | **1** (unchanged) |

The A2 control is the one that makes the A1 zeros readable: the same query over a file I did not
touch still returns a hit, so `0` on A1 means *cleared*, not *my query stopped working* (§9.6).

**The gate that must still hold, and does.** [MEASURED]
`git show origin/main:apps/api/src/modules/auth/otp-delivery.port.ts | Select-String
'SEC_A3_NO_CREDENTIAL_LOGS_V1'` → **0 hits**. A3's marker is not on `main`, so A1's
`requires_on_main` gate is still closed.

**Both linter verdicts, quoted:**

```
REJECT  pr-sec-a1-auth-secret-fail-fast-HOLD.md  [GATE_NOT_RELEASED]
        requires_on_main: "…otp-delivery.port.ts :: SEC_A3_NO_CREDENTIAL_LOGS_V1" —
        needle not found in origin/main. This HOLD is parked waiting for its predecessor slice.
   LINT_A1_EXIT=1

REJECT  pr-sec-a2-email-codes-and-reset-links-HOLD.md  [HUMAN_GATE_PRESENT]
        line 2 contains 'Arm ONLY' (conditional arming).
   LINT_A2_EXIT=1
```

🔴 **A1's rejection CODE CHANGED and its rejection did not.** That is the whole safety property of
this change: `HUMAN_GATE_PRESENT` → `GATE_NOT_RELEASED`, still exit 1, still un-armable. Had A1
come back `ADMIT`, the release would have done more than Marco authorised and I would have reverted
it rather than landed it.

**Preserved dependencies, quoted from the file after the edit rather than asserted:**

| line | content |
|---|---|
| 20 | `escalates: true` |
| 24 | `requires_on_main: …otp-delivery.port.ts :: SEC_A3_NO_CREDENTIAL_LOGS_V1` |
| 98 | `BEFORE MERGE (Marco): the API App Service must have JWT_ACCESS_SECRET and…` |
| 115 | `- Authentication change: label the PR do-not-merge.` |

**Diff size:** `1 file changed, 19 insertions(+), 1 deletion(-)`. One file. No other prompt, no
front matter field, no guardrail, no workflow, no code.

⚠️ **One drafting hazard I had to design around, and it is worth recording.** The replacement comment
quotes the old gate for the audit trail — but quoting *"arm only after Marco confirms"* verbatim
would have re-tripped marker 3 (`/Arm ONLY/i`) and left A1 gated by its own release note, with a
linter message pointing at a line that says the gate is released. I paraphrased that fragment as
`[conditional arming]` inside the quotation. **A release note that re-arms the gate is a silent
failure**: the file would read as released to a human and rejected by the linter.

**The armed prompt from the earlier part of this run completed.** [MEASURED]
`pr-sec-a3-no-credential-logs-ready.md` is gone from depth 1 and now sits in `processed/`
(`02:32:58Z`), its log naming **PR #2148**, `feat/sec-a3-stop-credential-logs`, build+lint green,
11 tests across 3 specs. Watcher verdict on it, verbatim:
`{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true — PR already carries do-not-merge — no duplicate apply"}`.
**So #2148 is Marco's**, and the falsifying probe the earlier breadcrumb carried for the next run is
answered here instead.

## WHAT CHANGED

**1. Released A1's human gate**, in an isolated worktree off `origin/main` per condition 2:
`C:\po-wt\gate0300` on `board/m2-gate-release-2026-09-24` at `b499919b`, `WT_EXIT=0`. The
`<!-- watcher: do-not-arm | MARCO GATE: … -->` line is replaced by a dated release record naming who
released it, on what evidence, what is released, and — explicitly — what is not.

**2. This breadcrumb, written inside the PR worktree** (cure 1), so no loose copy blocks the next
fast-forward.

Condition 3 was read immediately before the worktree was created: `index.lock` dev/clone
**False / False**, `git.exe` touching our trees **0**, dev-tree index **EMPTY**.

**Nothing armed. A2 untouched. No label added or removed. No PR merged by this change other than its
own board PR. `/sot/` untouched. No production data. Azure / Entra / SharePoint untouched.**

## FINDINGS

### F1 — A1's M2 human gate is RELEASED, and A1 is still correctly blocked on A3.

Marco confirmed in chat that he personally verified all four conditions the gate names in the
production API App Service, and that the values were not disclosed. The gate line is replaced by a
record of that release. The linter verdict moved from `HUMAN_GATE_PRESENT` to `GATE_NOT_RELEASED`
and A1 remains un-armable until `SEC_A3_NO_CREDENTIAL_LOGS_V1` is on `main`.

**DISPOSITION: ACTIONED** — released, verified four ways (three regexes at zero, an untouched-file
positive control, both linter verdicts, and the `origin/main` needle still absent), and landed in a
board PR.

---

### F2 — "M2" is not a name this repository uses. Acted on, and flagged rather than quietly normalised.

[MEASURED] `grep -rn '\bM2\b'` over `docs/pr-prompts/*.md`, `docs/decisions/` and `sot/` → **4 hits,
none of them this gate**: an `OPS-M2` map tip-finder in the roadmap, and two audit-finding `M2`
rows in the progress log about location-log spam. A1's gate is unnamed in the file; it is simply
`MARCO GATE`.

**I proceeded anyway, and the reason is specific rather than charitable:** Marco named **A1**
explicitly, and the four conditions he listed — both variables present, each ≥32 characters, neither
a placeholder, the two different — are a one-for-one match for the four the gate text names. There is
exactly one human gate on A1, so there is no second candidate the instruction could have meant.

⚠️ **Why it is still worth a finding.** A gate identifier that exists only in the human's head is a
gate that cannot be cross-checked by anyone else. Had A1 carried two human gates, or had the
conditions matched only loosely, `M2` would have been unresolvable and this would have been an
ESCALATE rather than an ACTION.

**DISPOSITION: ESCALATED — a question for Marco, and the only one in this run.** If `M2` is an
identifier from a tracker outside this repo, adding it to the prompt front matter (e.g. a
`gate_id: M2` field, or naming it in the gate comment) would let the next release be matched
mechanically instead of by reading four conditions and judging them equivalent. **Complete and
additive** (RULE 1): it names the gate everywhere it appears and breaks no existing prompt, since
the field would be advisory and absent on every other prompt. The alternative — leaving it — fails
the *future* half of RULE 1: it works today only because a human is present to disambiguate.

---

### F3 — A3 shipped as PR #2148 and is Marco's. The cluster's next move is his, not this station's.

The prompt this station armed at `02:34:54Z` was consumed, built, and opened as `#2148` with
`do-not-merge` already applied, carrying a real watcher `marco:true` verdict. **A1 cannot be armed
until #2148 merges**, so the sec-auth chain is now waiting on exactly one human action.

**DISPOSITION: ESCALATED** — carried to the existing
`instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md` alongside the other PRs that
cannot reach `main` without Marco. **Not re-filed as a new question**; the FOR MARCO block above
names the one click that unblocks the chain.

---

### F4 — This is a second board PR inside one hour, which F4 of the 02:14Z breadcrumb criticises. Landed knowingly, and the distinction matters.

That finding's complaint is that **housekeeping** merges spend a CI cycle on every open PR. This PR
is not housekeeping: it is a Marco-requested gate release, and the record of a security gate release
belongs on `main` rather than in a session transcript. The alternative — holding it until the next
hourly run — would leave the release recorded nowhere durable for an hour while Marco believes it is
done.

**DISPOSITION: DEFERRED** — the cost is real, measured, and already escalated in its own standing
file; this instance is noted rather than re-filed. **Urgent if** a run ever lands a third board PR in
an hour for something that could have been batched.

## WHAT I DID NOT DO

- **Did not touch Azure, Entra, SharePoint, Key Vault or any App Service setting**, and did not
  verify the secrets myself — Marco did, and that is the only route by which this gate could be
  released. Absolute, and not reasoned past on a prompt whose entire subject is production auth.
- **Did not record, echo, infer or ask for any secret value.** Marco stated the values were not
  disclosed; nothing in the prompt or this breadcrumb contains one.
- **Did not release A2.** `pr-sec-a2-email-codes-and-reset-links-HOLD.md` keeps its own gate on
  production email, verified still present by a positive control after the edit.
- **Did not release, weaken or remove any other gate**: `requires_on_main`, `escalates: true`, the
  `do-not-merge` guardrail, the `BEFORE MERGE (Marco)` block and the NO-OP-if-A3-absent guardrail all
  stand, quoted from the file after the edit.
- **Did not arm A1**, and could not have: it rejects `GATE_NOT_RELEASED`. Arming is a separate
  deliberate act and its gate is unmet.
- **Did not arm anything else**, and did not touch any other prompt in the queue.
- **Did not merge #2148, #2135, #2131 or #2127.** All four are Marco's.
- **Did not edit `lint-prompt.mjs` or any gate-checking code** to make A1 pass. The release is a
  change to the prompt, not to the instrument that reads it.
- **Did not run `git` through the device bridge against either Windows `.git`**, and ran no
  `git checkout .` / `checkout -- <dir>` / `reset --hard` / `stash pop` / `git clean` anywhere.
- **Did not commit on `main` or in the dev tree.** Every commit is in the disposable worktree.
- **Did not edit `/sot/`**, and did not write production data.

<run-summary>Released A1's single human gate on Marco's in-chat confirmation that he had personally verified the two JWT secrets in the production App Service, recorded the release in the prompt with what it does and does not cover, and proved the scope four ways - all three of the linter's gate regexes now return zero on A1 while the same query still returns one on the untouched A2, and A1's verdict moved from HUMAN_GATE_PRESENT to GATE_NOT_RELEASED rather than to ADMIT, because A3 is still not on main; flagged that the identifier "M2" appears nowhere in this repository and acted only because Marco named A1 and all four of his conditions matched the gate text exactly.</run-summary>
