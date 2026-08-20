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
