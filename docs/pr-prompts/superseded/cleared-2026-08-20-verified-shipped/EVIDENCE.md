# Cleared 2026-08-20 — verified shipped

Measured against `origin/main` **16402f22** by 06-pr-master. Every prompt here was sitting in the
**active queue root**, where a triage pass reads it as outstanding work.

| Prompt | Lint verdict | Shipped as | Why it was still in the root |
|---|---|---|---|
| `pr-ratehub-s4-create-sor-HOLD.md` | `STALE` — premise dead | #1255 | Nothing moves a STALE prompt automatically. `lint-prompt.mjs` exits 3 and the move is a human/agent convention that was never performed. |
| `pr-apierr-s5-crm-HOLD.md` | `STALE` — premise dead | #1251 | Same. Note its `premise_means` renders as the literal string `>-`, a YAML folding artifact — harmless here, but it means the STALE message carried no explanation. |
| `pr-realtime-safety-HOLD.md` | **`ADMIT` (size 8)** — the linter did **not** catch it | #1108 (RT-2) | **See below. This one is the dangerous case.** |

## `pr-realtime-safety-HOLD.md` — a prompt that survived its own delivery

The linter admitted this prompt. Arming it would have dispatched an agent to build RT-2, which has
been on main since #1108.

Its premise asked whether the safety module referenced `SchedulerRealtimeService` /
`scheduler-realtime`:

```
! grep -rq "SchedulerRealtimeService\|scheduler-realtime" apps/api/src/modules/safety
```

RT-2 shipped a **parallel, safety-scoped SSE seam** (`apps/api/src/modules/safety/realtime/` —
controller, emitter, guard) rather than importing the scheduler's. That was the right engineering
call. It also means the premise stayed true against shipped code, permanently.

The prompt's own `done_when` was already satisfied on main:

```
test -f apps/api/src/modules/safety/realtime/safety-realtime.emitter.ts && grep -rq "safety-realtime" .../safety.service.ts
```

**The lesson, which is worth more than the cleanup:** a premise that names *the implementation you
expect* rather than *the artifact you require* cannot detect its own delivery. `done_when` pointed at
the artifact and was correct. `premise` pointed at a design choice and was not. When they disagree
about whether work is done, the premise is the one that is wrong.

Nothing was deleted. All three prompts are preserved here in full.

---

# Second batch, 2026-08-20 — three prompts still ARMED on main after their work shipped

Measured against `origin/main` **fa061e02** by 06-pr-master. All three were sitting as `*-ready.md`
in the **active queue root**, so every tree sync re-materialised them and the linter binned them
again — a wasted cycle each time, and they read as pending work on any board built from main.

Each verdict below is `lint-prompt.mjs` run directly, not inherited from a handover.

| Prompt | Lint verdict | Shipped by | The premise, and why it is now false |
|---|---|---|---|
| `pr-fix-watchdog-lane-awareness-ready.md` | `STALE` | **#1275** (merged 2026-08-20 04:17Z) | *"The heartbeat watchdog in `supervise-watcher.ps1` has no concept of lanes… A prompt owned by an idle lane therefore makes a healthy node look hung, forever."* Lane awareness is on main. |
| `pr-migration-naming-guard-ready.md` | `STALE` | **#1246** | *"No guard spec rejects bare `YYYYMMDD_` migration folder names, so the next one lands unnoticed."* The guard spec exists. |
| `pr-queue-sync-lint-cwd-ready.md` | `STALE` | **#1254** | *"`queue-sync.ps1` calls `lint-prompt.mjs` without pinning the repo root, so every premise runs in the caller's cwd and the ADMIT/SHIPPED verdict depends on where the script was launched from."* The root is pinned. |

## Why these were retired and `pr-sor-s9` was only disarmed

Both moved in the same PR, and the distinction is the point.

**Retired = a decision, taken after classifying a dead premise as genuinely shipped.** These three
measure `STALE` *and* a named PR shipped the work. They will not run again.

**Disarmed ≠ retired.** `pr-sor-s9-register-to-progress-claim` measured **`ADMIT`, size 9, premise
alive** in the same pass. It is live work being held for re-shaping — Marco chose to split it at the
API/web seam because single nine-scope runs historically produce partial work. It went back to
`-HOLD`, stayed in the queue root, and carries a note saying what it is waiting for.

A dead premise is a **signal to investigate**, never a decision. Retirement is what you do *after*
classifying one as genuinely shipped — and a premise can read dead because its needle was matched
literally instead of as a regex, or because it counts wrong, not because the work is done. That is
why the verdicts above are quoted from the linter and paired with a PR number, rather than asserted.

Nothing was deleted. All three prompts are preserved here in full.
