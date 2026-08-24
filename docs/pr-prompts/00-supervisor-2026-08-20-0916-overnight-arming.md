# 00-SUPERVISOR NOTICE — 2026-08-20 09:16Z — OVERNIGHT ARMING under Marco's RULE 4

## What Marco authorised

Asked what I may do while he sleeps, he chose: **"arm a small amount of safe work, stop on first
failure."** Named risk he accepted: tonight produced 9 runs that did the work then stopped to ask,
so overnight runs may add to that pile until the NO-PR auto-restage lands.

"Safe" = ALL of: `escalates: false` · `gate_allow: none` (no migration/schema/seed) · already
staged `-HOLD` with its gate satisfied · premise re-measured TRUE against current `origin/main`
immediately before arming.

**Stop condition is HARD:** first failed run, first `[NO-PR]`, or first red check — arm nothing
further, leave the board for Marco. No "one more try".

## Armed (ONE, deliberately)

    pr-comms-hub-inbox-HOLD.md  ->  pr-comms-hub-inbox-ready.md     (git mv, tracked rename)

    premise      '! test -f apps/web/src/pages/crm/comms-inbox.helpers.ts'   [MEASURED true]
    lint         ADMIT, exit 0, size 3
    escalates    false      gate_allow  none      cluster  none
    picked up    09:16:00Z

**Why this one:** it fixes the defect Marco reported in person this session — the Comms hub showing
nothing because NAV-4 wired an anchored-only page into the nav while the API already serves
unanchored threads. Highest user-visible value of anything armable, and the smallest blast radius.

**Why only one:** "stop on first failure" is meaningless if two run before either is evaluated.
The second candidate is verified and waiting.

## Verified and held in reserve (do NOT arm until the first completes cleanly)

    pr-crm-leads-page-title-HOLD.md   ADMIT exit 0, size 2, escalates:false, gate none
    premise 'grep -q ">CRM</h1>" apps/web/src/pages/crm/CrmBoardPage.tsx'  [MEASURED true]

## Explicitly NOT armed, and why

- **All 9 `pr-apierr-*`** — they pass the mechanical safe-filter but Marco decided a **gate-fix
  slice ships first**. Their shared premise regex under-reports (reports 0 files; reality is 25
  sites / 17 files, because the defect spans two lines and the gate is a single-line regex), so
  arming any of them bins ~66 files as finished work. Scanner's calibrated replacement is at
  `outputs/scanner-2026-08-20/check-raw-error-envelope.mjs`.
- `pr-fv2-ai-describe`, `pr-ratehub-s5-xlsm-import-export` — already shipped (#1279, #1281).
- `pr-tendering-board-restore-submitted-cardless` — its cluster sibling was replaced by the
  pipeline-fold redesign in #1290; re-check the cluster before touching it.
- Everything size 8+ — poor overnight candidates; more turns, more chance of the stop-and-ask
  failure mode.

## Also done in this pass

`pr-sor-s9-register-to-progress-claim-HOLD.md` — my 06:19Z local disarm was a **bare rename**;
#1291 landed a *better* version carrying PR Master's full disarm note (the split decision, the
timing, and the S9a/S9b next steps). A hash guard caught the difference before the pull, I diffed
both, **main's version won**, mine is backed up at
`C:\po-watcher\_mm-backup-2026-08-20-queue-tree\pr-sor-s9-HOLD-local-superseded.md`.
The tree now carries main's, tracked. Queue tree is `c211ad62`, 0 behind.

-- Station 00, Supervisor
