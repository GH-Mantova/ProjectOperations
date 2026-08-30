# 00-SUPERVISOR → STATION 06 (next session) — 2026-08-20 09:20Z
# CORRECTIONS to your own 2026-08-20 handover. Measured at origin/main c211ad62.

Your handover is good — read it. It was measured at `fa061e02` and its own line 5 says
"Re-measure everything." Three facts have moved since, and one trap you flagged is still live.

## ALREADY DONE — do not redo

- **#1290 and #1291 are BOTH MERGED.** sor-s9 is `-HOLD` on main carrying your disarm note; the
  three shipped prompts are in `superseded/cleared-2026-08-20-verified-shipped/` with EVIDENCE.md
  appended. Control run: all three gone from the top level.
- **#1257 and #1285 merged 09:07Z** on Marco's explicit instruction. The plant-category fix is live:
  `scope-of-works.service.ts:1118` now has
  `if (typeof cat === "string" && cat !== "") rateCategories.set(r.rowId, cat)`.

## THE DEV TREE IS FIXED — your numbers are stale

                          your handover (fa061e02)      measured now (c211ad62)
    behind                24+                            0
    deleted prompts       34, of which 27 on main        7, of which 7 on main
    "git add -A deletes   a third of the queue           7 files
     ...
    dirty                 "permanently dirty"            21 = 13 preserved untracked
                                                              + 7 consumed deletions
                                                              + 0 modified

Fixed 06:17Z: `stash push -- docs/pr-prompts/` (parks the deletions AND restores the files),
`merge --ff-only`, re-delete only `*-ready.md` that ALSO exist in `processed/` (positive proof they
ran), `stash drop` — never `pop`. Neither `reset --hard` nor `checkout --` was used; both would
have resurrected ~26 already-executed prompts.

**Keep working in a worktree off origin/main — that practice is still right.** The reason you gave
for it is largely resolved.

## LIVE TRAP — you flagged it, nobody retired it

`pr-deps-clear-high-advisories-ready.md`
  - still ARMED (`-ready`) on origin/main
  - ALREADY RAN: processed/pr-deps-clear-high-advisories-ready.md, 2026-08-18 14:02
  - AND DID NOT WORK: `gh api dependabot/alerts?state=open` still returns #88, high, `extract-zip`

My 06:17Z sync removed it from the queue tree (it was in processed/), so it will not run right now —
but any fresh clone or future sync re-arms it and burns a run on a known-failed prompt.

**Retire it on main (`git mv` into superseded/) and design a replacement that actually targets
`extract-zip`.** Do not re-arm it as-is.

## OVERNIGHT STATE (so you do not re-measure blind)

- Queue tree `c211ad62`, 0 behind. Build clone `c211ad62`, 0 behind — **#1275 is live**
  (`lane-classify.mjs` present, `PR_WATCHER_LANE` 13 hits in supervise-watcher.ps1, was 0).
  Note: a watcher RESTART alone adopts nothing — the clone must be fast-forwarded first.
- Watcher PID re-launched detached via **watcher-launcher-singlelane.ps1** (the station doc names
  `watcher-launcher.ps1` — WRONG for this box; verify with Get-CimInstance).
- **ARMED: `pr-comms-hub-inbox-ready.md`** — running since 09:16Z. Under Marco's RULE 4 I may arm a
  small amount of safe work overnight and must STOP on the first failure. One more is verified and
  held in reserve (`pr-crm-leads-page-title`, ADMIT, size 2).
- **Do NOT arm any `pr-apierr-*`.** Marco decided a gate-fix slice ships first — their shared premise
  regex under-reports (0 files reported, 25 sites / 17 files real) because the defect spans two lines
  and the gate is a single-line regex. Scanner's calibrated replacement:
  `outputs/scanner-2026-08-20/check-raw-error-envelope.mjs`.

## MARCO'S DECISIONS SINCE YOUR HANDOVER

- `D42` → **RESCIND** (practice superseded it; #1146/#1149/#1150 merged and their slice-0s ran).
- The nine `no-pr-opened/` runs → **wait for the NO-PR auto-restage to land, then recover them
  systematically.** Do not hand-re-arm them now.
- `D<n>` namespace → **option 1, five-slice chain, strictly sequential.** See
  `00-supervisor-2026-08-20-D-NAMESPACE-CHAIN-for-05-and-06.md` in this folder.

-- Station 00, Supervisor
