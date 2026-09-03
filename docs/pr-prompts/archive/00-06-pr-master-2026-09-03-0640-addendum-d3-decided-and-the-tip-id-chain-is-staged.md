# Station 06 — PR Master | 2026-09-03T06:20Z–2026-09-03T06:45Z

**Addendum to the 0615 breadcrumb** (`00-06-pr-master-2026-09-03-0615-…`, merged in `#1530`). Same
run, later work: Marco decided D3 and this lane drafted and staged the chain that implements it.
`[NO LANE VERDICT — hand-classified]` per DOCTRINE §10.1 — docs-only, every path under
`docs/pr-prompts/`. Staged under the Phase 6 gate with Marco's explicit approval in chat.

## GROUND

```
UTC            2026-09-03T06:20Z–06:45Z
origin/main    50662fdc at drafting; #1531 merged 06:29:17Z mid-run
dev tree       main, fast-forwarded to 50662fdc earlier this run
doc version    1
bootstrap      n/a — invoked from chat
mutation gate  index.lock absent · 0 git processes · armed (excluding rev-*) = 1
```

## WHAT I MEASURED

**[MEASURED] The guard D3 is about is fourteen lines, and it is a compile-time dependency.**
`apps/api/src/modules/map-locations/map-locations.service.ts:138-157` throws a 409 when a TIP's
`facility` is renamed and `prisma.estimateWasteRate.count()` finds rows referencing the old string.
Because it names `estimateWasteRate`, **11c dropping that model makes the file stop compiling** — the
guard cannot be lost silently; 11c is forced to edit it.

**[MEASURED] Option (a) is structurally impossible after 11c.** The post-11c home for waste rates is
`RateTable`, seeded at `seed-initial-services.ts:3764-3799` as `rt-wst-t` / `rt-wst-m3`, where
`facility` is a KEY column inside a JSON `cells` blob on `RateRow` (`schema.prisma:5869`).
**A Prisma foreign key cannot point into a JSON cell**, so "give `EstimateWasteRate` a real relation"
would put the FK on the very table 11c deletes.

**[MEASURED] Neither side owns identity.** `MapLocation.facility` is a nullable `String?` with
`@@index([kind, facility])` and **no unique constraint** (`schema.prisma:6929,6937`);
`EstimateWasteRate.facility` sits inside `@@unique([wasteType, facility])` (`:2588,:2598`). Two TIPs
may carry the same facility string and nothing objects.

**[MEASURED] `MapLocation` is seeded nowhere.** A grep over `apps/api/prisma/*.ts` returns nothing;
the only creator is `map-locations.service.ts:116`, a person in Settings. So at seed time there are
zero MapLocations and **no ids to write** — populating the link needs a real database, which is why
it is a separate slice.

**[MEASURED] The seed defines exactly EIGHT distinct facility strings** — Alex Fraser · BMI Acacia
Ridge · BMI Stapylton · BMI Hendra · Rowcon (Bells Creek) · Cleanaway · Moreton Bay Recycling ·
Sunshine Coast Council — and they are the same eight TIPs. **No orphan exists in the baseline.**

**[MEASURED] `apps/api/src/modules/map-locations/` contains no `__tests__` directory and no spec of
any kind** — controller, module, service and the tip-recommendation pair only. The rename guard has
**never had a test**.

**[MEASURED] Lint, against `origin/main`, with premise controls run separately:**
`pr-tipid-s1` **ADMIT (size 3)**; `pr-tipid-s2` and `pr-tipid-s3` **REJECT [GATE_NOT_RELEASED]**,
each parked on its predecessor's artifact. Controls: `mapLocationId` occurs **0** times in the seed,
the backfill script is **not tracked**, the guard string occurs **1** time — all three premises hold.

## WHAT CHANGED

Four files added under `docs/pr-prompts/`, all new: three `-HOLD.md` prompts and this addendum.
**Nothing armed by this addendum, nothing merged, no code touched, `sot/` untouched.** Work was done
in a disposable worktree off `origin/main`, torn down after the push.

Earlier in the same run, recorded here for one place: `#1530` merged (six prompts + the 0615
breadcrumb), the dev tree was fast-forwarded `de811907` → `50662fdc`, `pr-plandocs-s1` was armed, and
the watcher's `#1531` **merged at 06:29:17Z through the tests-docs lane with no human**.

## FINDINGS

**F1 — D3 is DECIDED: option (d), the rate row carries the `MapLocation` id and the name is
resolved.** Marco, in chat, 2026-09-03. The three options in the backlog register are superseded and
must not be re-presented; option (a) is refuted on the JSON-cell measurement above.
**ACTIONED** — staged as the `tip-facility-id` chain: `pr-tipid-s1` (no migration, inert on landing),
`pr-tipid-s2` (backfill + admin, `escalates`), `pr-tipid-s3` (retire the guard, add the id check,
`escalates`).

**F2 — s3 cannot be a free-standing slice; it is bound to 11c.** Production prices from `legacy`
(`RATES_CANONICAL_SOURCE` is set in no environment), so the rename guard currently protects the table
that prices every job. Removing it before the flip is option (c) wearing option (d)'s clothes.
**DEFERRED** — s3 carries a two-part hard stop, and only the first half is machine-gateable: the
backfill must report `unmatched: 0`, **and** Marco must confirm the legacy table is going. 11c is
itself barred twice over.

**F3 — the module holding the guard has no tests.** The first test it will ever have is the one in s3
asserting the removal of a safety check. **ACTIONED** — s2 and s3 both now state the spec is a file
they create, and s3 is instructed to write the failing half first and prove it fails before making it
pass.

**F4 — the residual unknown in the D3 register now has an instrument.** *"Is there a waste-rate
facility with no TIP?"* has been unanswerable because such a row renders nowhere on Settings › Map
locations. **ACTIONED** — s2's backfill reports every unmatched facility by name and refuses to
`--apply` on a partial match without an explicit flag.

**F5 — `docs/pr-reviews/pr-1529-review.md` is untracked and unclaimed.** Station 00's `#1532` sweeps
the 05:37Z blind-run breadcrumb but not this file. **DISPATCHED → Station 00**: take it in the next
collect, or record deliberately that review verdicts stay local. This lane did not take it because
`#1532` is open and claiming files another station may be mid-sweep on is how two PRs collide.

## WHAT I DID NOT DO

- **Did not arm any of the three.** All `-HOLD`. s1 is armable; s2 and s3 are correctly parked.
- **Did not sweep `docs/pr-reviews/pr-1529-review.md`** — see F5, `#1532` is open and 00 is collecting.
- **Did not touch the 05:37Z blind-run breadcrumb** — `#1532` has claimed it.
- **Did not merge anything**, including `#1531`; the tests-docs lane took it on its own.
- **Did not write code.** Every finding became a prompt.
- **Did not add a Prisma migration to any slice** — the id lives in a JSON cell, so none is needed.
- **Did not touch `/sot/`, `Claude Design/`, `.gitignore`, or the watcher clone.**
- **Did not edit the Discipline Cards mock-up**, which joins TIPs by name and now disagrees with the
  decision. Noted in s3 for the design lane; that folder is gitignored and its own chain's business.
