# Station 06 — PR Master | 2026-08-26T06:57:22Z–2026-08-26T07:4xZ

## GROUND

```
UTC            2026-08-26T06:57:22Z
origin/main    8f0377e5
dev tree       main @ 8f0377e5   C:\ProjectOperations2   (fast-forwarded overnight by 00)
doc version    1
bootstrap      1 (interactive run, continuing the 2026-08-25T22:09Z session)
```

NOT BLIND. Desktop Commander reached the box first call. Marco present and answering.

**Authority for this run.** Marco was asked, via `AskUserQuestion`, how the four Marco-gated PRs
should be handled and chose **"Fix-forward all three, then release"** — naming #1320, #1316 and
#1323. That is the RULE 2 exception: an explicit instruction naming the PRs. **#1325 was NOT named
and was not touched.** He separately chose to sweep the untracked breadcrumbs as one PR he merges,
declining a standing exception.

## WHAT I MEASURED

- `[MEASURED]` Board at 06:57Z: 4 open, unchanged for 8 h 50 m. `ARMED = 0`. Watcher live
  (`.queue-state.json` ts 06:53:07Z against a 06:57Z clock).
- `[MEASURED]` Both infra reds from 21:54Z had cleared overnight. #1323 and #1325 each had exactly
  one non-green check — `PR gates`, i.e. CP-26 on their own label. #1320 and #1316: 0 non-green.
- `[MEASURED]` **#1320.** All ten CRM routes gated `crm.view` alone. Two serve a wider audience:
  `pipeline-dashboard.controller.ts` decorates all five routes `@RequireAnyPermission("tenders.view",
  "crm.view")` (`:54 :66 :74 :82 :91`) and its spec `:56` asserts *"allows a user who holds
  tenders.view (and NOT crm.view)"*; `TendersRegisterPage.tsx:60` reaches only the tendering API via
  `fetchAllPages()`. `RequirePermissions` is `perms.some(...)` (`SettingsShell.tsx`) — OR semantics,
  so listing both codes widens. **Scope control:** `pipeline-dashboard.controller.ts` is the ONLY
  controller in `apps/api` naming `tenders.view` in a `RequireAnyPermission`; every other CRM
  controller is `crm.view`/`crm.manage`. Exactly two routes needed widening.
- `[MEASURED]` **#1316.** The `jest.config.ts` hunk is real and suppresses TS 2339/2345/2353/7006
  across all of `apps/api`. Its justification is refuted by `ci.yml`: `:86 pnpm prisma:generate`
  precedes `:98 lint` and `:99 test:api:serial`, and both models the spec needs are already on main
  (`schema.prisma:7929`, `:7939`; this PR does not touch `schema.prisma`).
- `[MEASURED]` **#1316 second finding, and a CORRECTION to the inherited review.** The seed defines
  FIVE size bands (`seed.ts:3951-3957`), `SIZE_BAND_KEYS` lists four — so far as reviewed. But
  `VALUE_BAND_EDGES` ends at `maxExclusive: Infinity`, which means the fallback at the end of
  `sizeBand()` is **unreachable**. The obvious fix — append `"XL"` and let the fallback pick it — does
  **not** work. Closing the gap needs a fifth value threshold that is not derivable from the repo.
  Documented in place; NOT guessed.
- `[MEASURED]` **#1323.** All three review defects reproduce at head `d66fb2db`: the reverse `git mv`
  at the rollback is followed directly by `exit 3` with no `$LASTEXITCODE` check; `Acquire-Lock`
  opens `FileShare::None` while the waiter calls `File::ReadAllText`, which cannot coexist with the
  holder's `ReadWrite` handle; the harness patch is a bare `String.replace` whose non-match returns
  the input unchanged.
- `[MEASURED]` **B4 — new, and the most serious of the four.** `arm-prompt.ps1` declares
  `#Requires -Version 5.1` and **cannot be parsed by 5.1**. BOM-less UTF-8 + twelve em dashes; PS 5.1
  decodes BOM-less UTF-8 as Windows-1252, so `U+2014` becomes three chars ending in `"`, terminating
  the string at `Write-Fail "Ready file already exists: ..."`. On the byte-exact previous head:
  **3 parse errors under `powershell.exe`, 0 under `pwsh` 7.** `powershell.exe` is the DEFAULT shell
  on this box. The suite is skipped in CI and the harness prefers `pwsh`, so nothing was going to
  catch it.
- `[MEASURED]` **My own instrument lied first, and the control caught it.** My initial parse check ran
  PS 5.1 against a `Set-Content -Encoding UTF8` copy of the original — which ADDED a BOM — and
  returned 0 errors, which read as "the original is fine, you broke it". Re-running against the
  byte-exact blob returned 3. DOCTRINE §7 lie #2, in the wild, in the instrument I built to check my
  own work.
- `[MEASURED]` **`node --test` on Windows: 8 pass, 0 fail, 0 skipped** against the fixed script. The
  new B2 regression test was verified to **FAIL** against the pre-fix script first.
- `[MEASURED]` The suite also caught a defect in MY OWN fix before it was committed: `"$REPO_ROOT:"`
  parses as a drive-qualified variable reference. Corrected to `"${REPO_ROOT}:"`.
- `[MEASURED]` RULE 2 probe re-run: all four open PRs carry a `stays for Marco` line, one each,
  against a control of 1475 `[merge]` lines / 645 hits.

## WHAT CHANGED

All work done in a throwaway clone at `%TEMP%\po-fix826`. **The dev tree's index was never touched**
and no `git` ran against `C:\ProjectOperations2\.git` beyond read-only queries.

| PR | before | after | what |
|---|---|---|---|
| #1320 | `52fb9a1c` | `c04ca351` | two `perms` arrays widened + new regression test |
| #1316 | `f26b3404` | `c229f2b6` | `jest.config.ts` restored to main byte-for-byte; false comment corrected |
| #1323 | `d66fb2db` | `943b8c5b` | B1/B2/B3/B4 + new regression test + `ARMING.md` corrected |

- `do-not-merge` removed from **#1323** only. Read back: all three now unlabelled.
- Native **squash auto-merge armed** on all three. Read back: `ARMED:SQUASH` on each, heads matching
  the pushes above. **Nothing was hand-merged.**
- Explanatory comment posted on each PR (issuecomment-5421909674 / -5421909893 / -5421910175).
- This breadcrumb, plus a docs-only sweep PR carrying every untracked `00-*.md`.

## FINDINGS

### F1 — #1323 was never broken by CI, and it is the fix for the arming trap
Its three reds were CP-26 on its own label plus one GitHub Actions action-download outage. The four
real defects were only ever visible to a human reading the script. One of them (B4) made the script
unparseable in the shell most callers use, which means the serializer that is supposed to end the
`git mv` index collisions **has never actually been runnable by them.**
**DISPOSITION: ACTIONED** — four defects fixed, 8/8 tests pass on Windows with a negative control,
auto-merge armed.

### F2 — the arm-prompt test suite does not run in CI, and CI cannot tell you it didn't
Gated on `!IS_WIN || !PWSH`; the Ubuntu runner SKIPs all 8. CI stays green no matter what happens to
this script — which is precisely how B4 survived. Making it real needs a `windows-latest` job, which
is a CI cost decision.
**DISPOSITION: ESCALATED** — Marco's call. Not added silently.

### F3 — the XL weight band needs a number only Marco has
`XL` (5.00) is seeded and unreachable; everything above 1M weights 3.50. The fix is not mechanical
and the naive version does not work (see WHAT I MEASURED).
**DISPOSITION: ESCALATED** — one question: what is the XL boundary? Nothing else depends on it.

### F4 — the reporting channel is being closed once, not permanently
Marco declined a standing exception and chose a one-off sweep. That fixes today; the pile starts
rebuilding with the next station run, and the same escalation will be back within about a week.
Recording it here so the next run does not present it as new.
**DISPOSITION: DEFERRED** — becomes urgent at roughly 20 untracked breadcrumbs, or the next time a
station finding is missed because nobody read it.

### F5 — 16 executed HOLD prompts are still tracked on origin/main
Station 04 measured this at 06:11Z: one `git checkout` in the dev tree re-arms them. It is a
deletion, it is Station 00's lane, and Marco did not authorise it in this session.
**DISPOSITION: DISPATCHED** — to Station 00, unchanged from 04's own disposition. Not folded into the
breadcrumb sweep, which is deliberately additive-only.

## WHAT I DID NOT DO

- **#1325 — untouched.** Not named in Marco's instruction; it reverses a documented `/sot/` direction
  and is his decision. Still `do-not-merge`, still CP-26 red by design.
- **Did not hand-merge anything.** Auto-merge only, per DOCTRINE §8.3.
- **Did not invent the XL threshold**, did not append `"XL"` to `SIZE_BAND_KEYS` (it would not work),
  and did not touch `seed.ts`.
- **Did not add a `windows-latest` CI job** to make the arm-prompt tests real — raised instead.
- **Did not arm any prompt**, including `pr-crm-tender-count-truth` and `pr-crm-wincount-s2`, whose
  gates are both open on main.
- **Did not delete the 16 tracked HOLD prompts**, prune the 4 orphaned worktrees, or touch the
  watcher clone.
- **Did not commit from the dev tree.** Its index was empty when I started and I left it that way.

*This breadcrumb is committed by the sweep PR that accompanies it — the first station report in this
series that does not need Station 00 to pick it up.*
