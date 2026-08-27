# Station 06 — PR Master | 2026-08-26T06:57Z–09:12Z

## GROUND

```
UTC            2026-08-26T09:11:58Z
origin/main    a57d22c5 -> 17db9670 over this window
dev tree       main @ 17db9670   C:\ProjectOperations2   (clean: index empty, no lock)
doc version    1
bootstrap      1 (interactive, then unattended under RULE 4 from ~08:20Z)
```

NOT BLIND throughout. Marco present until ~08:20Z, then away with the board handed over.

**Authority.** Marco chose, via `AskUserQuestion`: fix-forward #1320/#1316/#1323 and release them;
sweep the untracked breadcrumbs as one PR, no standing exception; then "1, 2 & 3, in whichever order
is safer/best" — CRM, instruments, hygiene. Ordering was mine: **hygiene → instruments → CRM**, on
the grounds that arming runs an autonomous agent against the dev tree, so the tree must be clean and
the guards that protect arming must work first. He also confirmed the #1325 merge at 07:57Z was his
own hand, closing that question.

## WHAT I MEASURED

- `[MEASURED]` Six merges this window: **#1316** 07:18:33Z · **#1326** 07:21:35Z · **#1320** 07:38:15Z ·
  **#1323** 07:53:53Z · **#1327** 08:10:27Z · **#1328** 08:17:55Z · **#1329** 08:22:24Z. Every one
  through native squash auto-merge; **nothing hand-merged**.
- `[MEASURED]` Each fix re-read from `origin/main` with a control: `App.tsx:701/:710` carry
  `["crm.view", "tenders.view"]`; `ignoreCodes` in `apps/api/jest.config.ts` = 0 hits;
  `arm-prompt.ps1` carries the rollback guard, the share-compatible reader, and a UTF-8 BOM.
- `[MEASURED]` **16 executed HOLD prompts were still tracked on main** — one `git checkout` restores
  them to depth 1 where queue-sync can re-arm executed work. Re-proved all 16 rather than trusting
  Station 04's count: 15 by their `processed/` retirement file, the 16th
  (`pr-watchdog-heartbeat-during-merge-wait`) by its artefact on main — `MERGE_WAIT_HEARTBEAT` at
  `scripts/pr-watcher/index.mjs:172`, shipped as #1304. Control: retirement buckets hold 3,438 files.
  Retired by #1327.
- `[MEASURED]` Two prompts armed and run in this window, both by the correct owner and both clean:
  `pr-gate-release-is-not-a-reject` (armed by a scheduled Station 00 run ~08:13; `[ok]` 08:26:03,
  opened **#1330**) and `pr-crm-tender-count-truth` (armed by me 08:46:06; `[ok]` 08:56:22, opened
  **#1331**). Arm-to-pickup on mine was **0.8 s** — the fs-watch path.
- `[MEASURED]` Board at close: **#1330** and **#1331**, both `CLEAN`, both **12 checks / 0 not-green**,
  both routed to Marco by the watcher. `armed = 0`, index empty, no `index.lock`.

## WHAT CHANGED

All code work in a throwaway clone; the shared dev-tree index was never committed from.

| PR | what |
|---|---|
| #1320 | two `perms` arrays widened to admit `tenders.view` + a regression test with a negative control |
| #1316 | `jest.config.ts` restored byte-identical to main; a false comment corrected |
| #1323 | four defects in `arm-prompt.ps1` + a regression test + `ARMING.md` corrected |
| #1327 | 16 executed HOLD prompts retired from main |
| #1328 | staged the linter blind-spot prompt as HOLD |
| #1329 | corrected a wrong measurement inside #1328's prompt |

Also: `do-not-merge` removed from #1323 only; `do-not-merge` **restored** on #1325 at 07:38 after it
came off unattributed at 07:22 (Marco has since confirmed both removals were his); dev tree
fast-forwarded twice; one index drain of Station 00's `git mv` pollution at 08:19; one prompt armed
by filesystem rename with the index verified empty before and after.

## FINDINGS

### F1 — the serializer had a fourth defect, and it made the tool unusable
`arm-prompt.ps1` declared `#Requires -Version 5.1` and **could not be parsed by 5.1**: BOM-less UTF-8
plus em dashes, decoded as Windows-1252, turns `U+2014` into three characters ending in a quote,
which terminates a string mid-file. Measured on the byte-exact previous head: 3 parse errors under
`powershell.exe`, 0 under `pwsh` 7. `powershell.exe` is the default shell on this box, so the tool
built to end `git mv` index collisions had never been runnable by most of its callers. The suite is
skipped in CI and the harness prefers `pwsh`, so nothing was going to catch it.
**DISPOSITION: ACTIONED** — fixed with a UTF-8 BOM, 8/8 tests pass on Windows, shipped in #1323.

### F2 — 🔴 I published a wrong measurement, and the way it was wrong is the lesson
#1328's prompt claimed **12** prompts carry a human arming gate the linter cannot see. The real
figure is **5**. My scan was case-INSENSITIVE and matched the ordinary prose line most prompts carry —
*"Do NOT arm, promote or rename any HOLD as part of this PR"* — which instructs the implementing
agent, not the arming decision. Seven of the twelve were that sentence. **I matched a discussion of
arming as though it were an instruction about arming, which is precisely what the prompt accuses the
linter of doing.** Caught only because one false positive was armed by Station 00 and began running
in front of me. Case is the discriminator: real gates are shouted in capitals.
**DISPOSITION: ACTIONED** — corrected on main by #1329, which also adds the case-sensitivity rule as
a hard requirement. The corrected evidence is stronger: 5 real gates, **5/5 lint ADMIT**, one of them
recording in its own body that it drops tables irreversibly and was already armed by mistake once.

### F3 — the destructive detector cannot be written about
Authoring the prompt that fixes it tripped it **five times** — a quoted filename, the DDL statement
named in a test bullet, the same in a do-not-weaken instruction, and finally the linter's own error
message quoted back into the body. Every destructive-sounding term in that prompt is elided for that
reason alone.
**DISPOSITION: ACTIONED** — folded into the same slice as F2's fix; one shared strip-code-context
normalizer serves both, and the detector is not weakened in any other way. Staged, not armed.

### F4 — a PowerShell probe fabricated a clean answer
Checking two prompts' front matter, a command printed complete, plausible, entirely fabricated
output for both. `Set-Location` does not move the .NET process CWD, so every `ReadAllLines` threw and
**stale variables from an earlier command printed in their place**. Only the impossibility of two
different files having identical front matter exposed it. Redone in node with absolute paths — and
that is when `pr-crm-wincount-s2` turned out to be `escalates: true`, which the fabricated read had
hidden and which would have made it ineligible for overnight arming.
**DISPOSITION: ACTIONED** — recorded here. It belongs in DOCTRINE §9.1 as a named trap: *never read
files through PowerShell after `Set-Location`; the .NET CWD does not follow, and prior variables
survive to fill the silence.*

### F5 — two PRs wait on Marco, and nothing else can move
#1330 and #1331 are both green and both watcher-routed to him. `pr-crm-wincount-s2` is
`escalates: true` and fails RULE 4's overnight-safe definition, so it was not armed and there is
nothing else eligible.
**DISPOSITION: ESCALATED** — Marco's, along with two unanswered questions: the XL weight-band
boundary, and whether to add a `windows-latest` CI job so the 8 arm-prompt tests stop being skipped.

## WHAT I DID NOT DO

- **Did not arm `pr-crm-wincount-s2`** (`escalates: true`) or anything else after the one safe arm.
- **Did not merge #1330 or #1331.** Both are watcher-routed to Marco; RULE 2 binds and his
  fix-forward instruction named three specific PRs, not a standing licence.
- **Did not prune the 4 orphaned worktrees** — Station 04 re-verified a DO-NOT-PRUNE verdict at
  06:11Z and a hygiene pass is not the place to override it.
- **Did not edit DOCTRINE §9** for F2/F4, though both belong there: §9 is a hash-recorded
  CANONICAL-BLOCK and changing it means re-recording the hash across six station docs in one PR.
- **Did not answer the XL boundary or the CI-cost question.** Both are Marco's.
- **Did not chase the #1325 label-removal actor** past the shared `GH-Mantova` token — and did not
  need to; Marco confirmed it was him.

*Untracked. Marco declined a standing exception for breadcrumb PRs, so this waits for a sweep.*

---

## ADDENDUM — 2026-08-26T09:48Z, after #1330 and #1331 landed

`[MEASURED]` **#1331 merged 09:29:47Z**; its artefact is on main (`tenderTotal` ×2 in
`accounts.service.ts`). **#1330 merged 09:15:17Z.** Board is **empty — 0 open PRs**. `origin/main`
`1f3a3747`, dev tree fast-forwarded to match, `armed = 0`, index empty, no lock.

`[MEASURED]` Re-linted all **56** HOLD prompts against the post-#1330 linter: **52 ADMIT, 0 REJECT**,
4 unclassified. Before #1330 a released gate read as a permanent REJECT; that is genuinely fixed.

### F6 — 🔴 an UNSATISFIED `requires_on_main` gate now returns a bare ADMIT

#1330 fixed released gates reading as rejects. The other half of the probe did not come with it.

`pr-crm-wincount-s3-recompute-HOLD.md` declares:

```
requires_on_main: apps/api/src/modules/jobs/jobs.service.ts :: clientStats.recordTenderOutcome
cluster: crm-wincount   cluster_order: 3
```

That needle is **NOT on origin/main** — `git grep recordTenderOutcome` in that file returns nothing,
against a working control proving the file is readable. Its predecessor `s2` has not run. The prompt
is chain-blocked by construction.

The linter returns:

```
ADMIT   pr-crm-wincount-s3-recompute-HOLD.md  (size 3)     exit 0
```

A bare ADMIT. **Nothing distinguishes it from a prompt whose gate IS satisfied** —
`pr-crm-tender-count-truth`, armed earlier tonight with its gate genuinely released, printed the same
single line.

This matters because **ADMIT is what an arming decision trusts.** The old failure mode was a false
REJECT — annoying, but it refused. The new one is a silent ADMIT on work that cannot correctly run
yet, which is the failure direction that costs a run.

**Consequence for the sweep above: the "52 ADMIT" figure is NOT an armable list.** RULE 4's safe
definition requires "gate satisfied", and that clause is **not checkable from the linter's verdict**.
It needs a separate per-prompt gate probe, which is what I did by hand before arming tonight.

**DISPOSITION: ESCALATED** — Marco's, two ways: (a) whether to fold this into the already-staged
`pr-lint-human-gate-blindness` prompt as a third defect (same file, same test surface, same root
cause — the verdict does not carry what the caller needs), or author it separately; and (b) it is
worth knowing before anyone treats a post-#1330 ADMIT as permission to arm.

**Not acted on.** Nothing armed, nothing merged, no prompt amended — Marco is away and this is a
design call, not a mechanical one.
