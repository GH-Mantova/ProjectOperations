# Station 05 — SoT Keeper | ADDENDUM | 2026-09-21T00:45Z–2026-09-21T01:05Z

Addendum to `docs/pr-prompts/archive/00-05-sot-keeper-2026-09-21-0004-the-heartbeat-alarmed-twelve-times-through-a-seventy-seven-hour-silence-and-nothing-was-awake-to-read-it.md`,
same station, same run, later measurement. That report is already archived by Station 00 and is
**not edited here** — an archived, dispositioned report is left as it was read.

## GROUND

```
UTC            2026-09-21T00:45:56Z  (the moment #2019 merged, mid-run)
origin/main    29abf8d4              (re-fetched; was 875e1076 at run start)
dev tree       main @ 64abcdcd        C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. This addendum exists because **two things happened after the main
report was written**: Marco answered F5's escalation in chat, and PR #2019 merged.

## WHAT I MEASURED

**#2019 merged mid-run, by another actor, and its branch was deleted.** [MEASURED]
`gh pr view 2019 --json state,mergedAt,closedAt,headRefName,headRefOid` →
`{"state":"MERGED","mergedAt":"2026-09-21T00:45:56Z","closedAt":"2026-09-21T00:45:56Z",
"headRefName":"docs/sot-reconcile-2026-09-21-inpr-snapshot","headRefOid":"6d3c0210…"}`. Station 05
did not merge it and did not arm auto-merge; `headRefOid` `6d3c0210` is **not** the `1024f324` this
station pushed, so the branch was advanced by that actor before merging.

**How I found out, and it is a §9.6 shape worth recording.** A second commit was ready and the push
was **REJECTED** `! [rejected] … (stale info)`. The rejection came from `--force-with-lease` reading
a remote-tracking ref that a `git fetch origin +refs/heads/<branch>:…` had already failed to update
(`fatal: couldn't find remote ref`), and `git ls-remote origin refs/heads/<branch>` returned
**EMPTY** where the same expression had returned `1024f324…` twenty minutes earlier. Three readings,
all consistent with "my branch is broken". 🔧 **The branch was simply gone, because the merge deleted
it.** The probe that decided it was `git ls-remote --heads origin` — **ask the remote for everything
and filter locally** (DOCTRINE §9.2) — with controls: 16 heads returned, POSITIVE `refs/heads/main`
→ `29abf8d4…` present, the branch **NOT PRESENT**, NEGATIVE a freshly minted needle → 0 hits.
⚠️ **A rejected push is not evidence about your commit.** Had I reached for `--force` on the "stale
info" message I would have been force-pushing a deleted branch behind a merged PR.

**Everything from commit 1 is on `main`, verified by CONTENT and not by ancestry.** [MEASURED]
`git merge-base --is-ancestor 1024f324 origin/main` → **exit 1**, i.e. "not an ancestor" — which is
the *expected* answer for a **squash** merge, and every merge on this board is a squash (DOCTRINE
§9.2). Reading that exit code as the answer would have manufactured "my work was lost". The content
probes against `git show origin/main:<path>`:

| probe | result |
|---|---|
| `sot/02` contains `open right now (1)` | **True** |
| `sot/02` contains `#2017` | **True** |
| `sot/02` contains `Refreshed again 2026-09-21` | **True** |
| `docs/pipeline/stations/05-sot-keeper.md` contains `THE SHRINK IS LINE ENDINGS` | **True** |
| NEGATIVE control, a freshly minted needle in `sot/02` | **False** |

**Station 00 collected the report.** [MEASURED] `git ls-tree -r --name-only origin/main --
docs/pr-prompts` finds the run breadcrumb at
`docs/pr-prompts/archive/00-05-sot-keeper-2026-09-21-0004-….md` — **archived**, which is where 00
puts a breadcrumb once every finding in it carries a disposition. The channel closed.

**The sot/01 gap block is not yet on `main`.** [MEASURED] `git show
origin/main:sot/01-charter-and-architecture.md` does not contain `THIS REGISTRY IS KNOWN INCOMPLETE`.
So this addendum's change is new work, not a duplicate.

## WHAT CHANGED

One PR, off the **new** `origin/main` `29abf8d4`, from a fresh disposable worktree. Two files:

1. **`sot/01-charter-and-architecture.md` SECTION 13** — a dated gap-declaration block at the top of
   the registry: the ten capabilities with a live module and no entry (**CRM, Expenses, Procurement,
   Inventory, Surveys, Handovers, Geocoding, Map locations, Branding, Public holidays**), the
   controls for that reading in both directions, an explicit warning that an earlier slug-keyed probe
   reported **36** with its own positive control failing and is **not** the finding, Marco's ruling,
   and an instruction to **delete the block in the same PR that adds the entries**.
2. **This addendum breadcrumb**, carrying the HANDOVER brief below.

**No module entries were written.** Deriving them from route and controller names is the option Marco
declined. The block declares the gap; it does not fill it.

Edits made with node by concatenation, byte-delta asserted per splice, line-ending detected per file
rather than assumed (the tracked files are CRLF): `112115→114416` (expected 114416) on sot/01 — the
two breadcrumb splices from the earlier attempt were **discarded**, because they targeted the
depth-1 breadcrumb path that no longer exists on `main` now that 00 has archived it.

**Nothing armed. Nothing merged. No label touched. No auto-merge.** CP-24: `sot/` + `docs/` only.

## FINDINGS

### F7 — A ruling given in chat reached the repo, which is the only reason it will survive this session
Marco answered F5 in chat: **option (b)**, a development chat writes the sot/01 §13 entries properly,
not Station 05 deriving them. DOCTRINE §10.2's last bullet is that a scheduled or cloud lane *"sees
only what is committed to the repo … any chat [is] invisible to it"*, and §10.2.1 records **five
consecutive runs** re-deriving a ruling from first principles for exactly this reason. This lane was
in the room when the ruling was given, which §10.2.1 distinguishes from guessing Marco's intent — so
transcribing it is permitted where inventing it would not be.
**DISPOSITION: ACTIONED** — transcribed into `sot/01` §13 in this PR, verified by the rendered diff
and the byte-delta assertion; and the ruling's own scope limit (*do not write the entries*) is
honoured rather than quietly widened.

### F8 — Nothing yet assigns the work the ruling created, and Station 05 cannot assign it
The ruling names *who* writes the entries but no artefact schedules it. Station 05 may not stage
prompts — `STATION-CAPABILITIES.md` §5 gives 05 `Mutate the board — ❌`, and staging `-HOLD` is
Station 06's cell. So the ruling is recorded and **unscheduled**, and the gap block will sit in
`sot/01` until someone briefs a development chat off the HANDOVER below.
**DISPOSITION: DISPATCHED** — to Station 00 (or 06) to stage the prompt. The HANDOVER section is
written to be the prompt's body so whoever stages it does not have to re-measure anything.

### F9 — A merged-and-deleted branch produced three readings that all looked like a broken branch
Measured in full above: a failed `fetch`, an empty targeted `ls-remote`, and a `--force-with-lease`
rejection reading `(stale info)` — none of which names the actual cause, and all three of which
invite a `--force` retry against a branch that no longer exists behind an already-merged PR. The
discriminating probe is `git ls-remote --heads origin` with controls. This is a **concurrency**
hazard, not a git one: a station that opens a PR and keeps working can have it merged underneath it
by the hourly supervisor, which is by design (DOCTRINE §8) and is not a defect.
**DISPOSITION: DEFERRED** — real, and not urgent. It cost one diagnostic cycle and no work: commit 1
was already safe on `main` and commit 2 was re-authored onto the new head. It would become urgent if
a station ever reached for `--force` on that message, so it is recorded with the probe that settles
it rather than proposed as a doc change on one occurrence. ⚠️ **Never `--force` on "stale info";
ask the remote for all heads first.**

## WHAT I DID NOT DO

- **Did not write the ten §13 module entries.** That is the option Marco declined; the block declares
  the gap and says so on its face.
- **Did not edit the archived breadcrumb.** Station 00 had already collected and archived it; an
  addendum is the house pattern and leaves the dispositioned record as it was read.
- **Did not `--force`-push.** The "stale info" rejection was diagnosed, not overridden. The branch was
  gone because the PR merged.
- **Did not re-do commit 1's work.** Verified present on `main` by content probe before writing
  anything, so nothing is duplicated.
- **Did not stage a prompt, arm anything, merge anything, or touch a label.** #2017 remains parked on
  `[LABEL_PRESENT]`; only Marco removes that.
- **Did not touch Azure, Entra or SharePoint.** Absolute.

## HANDOVER — for the development chat that writes the sot/01 §13 entries (Marco's ruling (b), 2026-09-21)

**The job.** Add one business-facing entry per module to `sot/01-charter-and-architecture.md`
SECTION 13, in the voice of the entries already there — e.g. *"Contracts module — variations,
progress claims, retention, cut-off reminders"*. Then **delete the gap-declaration block** at the top
of §13, in the same PR. That block exists only to stop the gap being re-derived; it is rubbish once
the entries land.

**Ten modules, with the API surface measured at `origin/main` `875e1076`.** This is evidence, not a
draft. Route names say what a module *touches*, never what it is *for* — which is precisely why the
mechanical derivation was declined.

| module | `@Controller` prefixes | routes | a few route names |
|---|---|---|---|
| crm | `crm`, `crm/accounts`, `crm/pipeline`, `crm/comms`, `crm/intake`, `crm/relationships`, `crm/admin/reminder-policy` | 56 | `dashboard`, `by-stage`, `:id/360`, `:id/triage`, `:id/archive` |
| expenses | `expenses` | 6 | `:id/submit`, `:id/approve`, `:id/reject`, `:id/reimburse` |
| procurement | `procurement`, `commitments`, `procurement/purchase-orders/:poId` | 23 | `budget-summary`, `:id/approve`, `:id/close`, `changes/:changeId/approve` |
| inventory | `inventory` | 15 | `items`, `categories`, `stocktakes`, `items/:id/movements` |
| surveys | (no literal `@Controller("…")` — see note) | 4 | `surveys`, `surveys/:id/responses`, `clients/:clientId/satisfaction` |
| handovers | `handovers` | 8 | `:id/finalise`, `:id/compliance-items`, `:id/compliance-items/derive`, `:id/values` |
| geocoding | `geo` | 2 | `autocomplete`, `sites/resolve` |
| map-locations | `map-locations`, `waste/recommendations` | 5 | `accept`, `orphan-facilities` |
| branding | `branding`, `admin/branding` | 7 | `active`, `assets/:kind`, `color-schemes`, `active-color-scheme` |
| public-holidays | `public-holidays` | 1 | `:id` |

⚠️ **Read the note on `surveys` rather than trusting the blank cell.** The decorator search found no
`@Controller("…")` there while finding four routes, so either the decorator is bare `@Controller()`
with the path carried elsewhere, or the routes are mounted by another module. **[CANNOT MEASURE]
which, in this run** — resolve it from the source before writing that entry.

⚠️ **The route-name search needed recalibrating twice, so the counts are quoted with their controls.**
The first pattern required single quotes; this codebase writes `@Controller("crm")` with **double**
quotes, so it returned 0 for all ten modules — including its own `@Controller` positive control,
which is what caught it. The counts above come from the double-quoted form, POSITIVE control 1 hit in
`crm.controller.ts`, NEGATIVE control 0. **Re-measure before quoting them; they are state.**

⚠️ **The 36-vs-10 trap, so nobody re-opens it.** A slug-keyed probe comparing the 81 directory names
under `apps/api/src/modules` against §13 reports **36 missing** and is **wrong** — §13 is keyed by
business name, not code slug, and that probe's own positive control fails. **Ten is the controlled
reading.**

**Two constraints on how this ships.** CP-24 hard-blocks `sot/` mixed with `apps/` or `scripts/`, so
the §13 edit must be its **own `sot/`-plus-`docs/` PR**, never bundled with code. And only Station 05
may edit `/sot/`. So a development chat should hand the finished prose back for Station 05 to land in
a doc-reconcile PR, or Marco lands it himself.
