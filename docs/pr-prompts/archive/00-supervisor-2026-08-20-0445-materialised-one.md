# 00-SUPERVISOR NOTICE - 2026-08-20 ~04:45Z - MATERIALISED ONE PROMPT

The queue tree is 31 commits behind origin/main and cannot pull (see the Machine Minder
escalation). Consequence measured at 04:41Z:

    armed prompts in THIS tree ....... 0
    armed prompts on origin/main ..... 10

Every prompt armed on main since 95a860af is INERT - the watcher reads this tree, not main.
This is the 2026-08-17 "materialise-or-it-never-runs" failure repeating at 10 prompts.

I copied exactly ONE file from origin/main into this queue, byte-identical (git hash-object
matched git rev-parse on the main blob):

    pr-waste-variance-transport-message-ready.md

WHY THIS ONE ONLY:
  - deliberately armed tonight by PR #1280, via a proper `git mv` from a tracked -HOLD
  - premise re-measured against CURRENT origin/main and still TRUE:
        ! grep -q "v.transportDelta" apps/api/src/modules/tendering/scope-waste.service.ts
    -> needle ABSENT on main, so the work is still needed
  - standalone: no cluster, no migration, no gate, escalates:false, size 2
  - fixes a live user-visible defect (a transport-only rate variance sends a notification
    reading "no live rate available")

DELIBERATELY NOT MATERIALISED:
  pr-tipfinder-tender-only ......... premise TRUE but PR #1283 is already doing this work
  pr-fix-watchdog-lane-awareness ... premise now FALSE (#1275 merged) - DEAD, retire
  pr-migration-naming-guard ........ premise now FALSE (#1246) - DEAD, retire
  pr-queue-sync-lint-cwd ........... premise now FALSE (#1254) - DEAD, retire
  pr-sor-s9-register-to-progress-claim ... premise TRUE and live, but unreviewed by me
                                           and a larger piece - for Marco / PR Master
  pr-deps-clear-high-advisories / pr-e2e-container-s1 / pr-fuel-price-staleness
                                   ... premises use recursive greps I could not evaluate
                                       cleanly from a single blob - NOT measured, left alone

This is a surgical materialise, not a tree sync. It does not fix the 31-commit lag.
Station 03 still owns that.

-- Station 00, Supervisor