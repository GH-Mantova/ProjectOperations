# Station 06 — PR Master — 2026-08-26 11:33Z — #1334 finding withdrawn, windows-CI armed

## GROUND

Station 06 (PR Master), `GH-Mantova/ProjectOperations`. Continuing Marco's standing instruction of
2026-08-26: *"keep watching the board, driving crm prs to open and merged. once they're all merged,
arm the next pr that has gates open or is the beginning of a new cluster (slice-0)."* Marco is away;
this run is unattended.

Entering this session I held a finding against #1334 (`feat(tendering): fold CRM pipeline into
Tendering`) that it had dropped an access-control route guard, and I had a fix script written and
staged to run against the PR branch. I did not run it.

## WHAT I MEASURED

Against `main` and PR head `bfe02891`:

- `App.tsx` on the PR branch: `<Route path="/tenders/pipeline" element={<PipelinePage />} />` — bare,
  no guard. Confirmed.
- **But**: `/tenders`, `/tenders/leads`, `/tenders/:id`, `/tenders/:id/quote`, `/jobs`, `/projects`,
  `/workers` are all equally bare. Route-level guards in `App.tsx` exist only on `/crm/*`,
  `/settings/administration/*`, and `/admin/settings`.
- `route-guards.authz.test.ts` (Gate B) scopes itself to admin/super-rendering routes via
  `ADMIN_PATH_PREFIXES` + `ADMIN_COMPONENT_RE`. `<PipelinePage />` matches neither, so its pass is
  legitimate and no `SELF_GUARDED_ROUTES` entry was required.
- `pipeline-dashboard.controller.ts`: `@RequireAnyPermission("tenders.view", "crm.view")` on all five
  routes. `ANY_PERMISSIONS_KEY` present on main at `permissions.decorator.ts:10` — the s2 gate was
  genuinely satisfied.
- The s2 prompt, lines 69-70, **explicitly instructed** the `/crm/pipeline` → `/tenders/pipeline`
  `<Navigate replace>`. Removing that route's guard is entailed by the authorised redirect.
- #1334: 12/12 checks green, `mergeStateStatus: CLEAN`, `labels: []` (no `do-not-merge`), not draft.
- `ci.yml` on main `8bf95711`: 225 lines, 7 × `runs-on`, 7 × `ubuntu-latest`, **0 × `windows-latest`**.
- `pr-ci-windows-pipeline-tests-HOLD.md`: local 5565 bytes / 107 lines / 107 CR; 5565 − 107 = 5458 =
  main's byte size exactly. Local copy byte-identical to main modulo CRLF.

### Two instrument failures caught before they were acted on

1. `($ci | Select-String 'ubuntu-latest' -SimpleMatch -AllMatches).Matches.Count` returned **0** for a
   file containing seven of them, while a sibling check on the same variable returned True. Piping a
   line array into `Select-String` and reaching through `.Matches.Count` is not a countable result.
2. Re-doing it in node returned `runs-on 0`, `pipeline-tests 0` on a 20610-byte file — because
   PowerShell 5.1's `>` redirect writes **UTF-16LE**, and node read it as UTF-8. Decoding as
   `utf16le` gave the true counts.

Both were caught by sanity floors (a CI file cannot contain zero `runs-on`), not by luck. The premise
was only trusted after the third, self-consistent measurement.

## WHAT CHANGED

- **#1334 merged** — squash, `8bf95711`, 11:28:43Z. Not hand-merged; `gh pr merge --squash --auto`,
  which completed immediately as all checks were already green.
- **Comment posted to #1334** (`#issuecomment-5424621285`) withdrawing my finding with the five
  measurements above, so the reversal is auditable rather than asserted.
- **`pr-ci-windows-pipeline-tests` ARMED** — filesystem rename HOLD → ready via `fs.renameSync`, never
  `git mv`. Verified: source gone, target present, 5565 → 5565 bytes identical.
- **`pr-pipeline-fold-s3-nav-any-permission-HOLD.md` staged** (not armed) — the follow-up finding.
- `fix1334.mjs` renamed to `fix1334.mjs.OBSOLETE-finding-withdrawn` so no later session runs it.

## FINDINGS

**F1 — My #1334 finding was wrong. Withdrawn.**
I characterised an authorised, prompt-specified redirect as an unauthorised gate removal, and was one
command away from pushing an unnecessary "fix" onto a clean PR. The error was reasoning from a single
observation (the route is bare) without measuring the surrounding convention (every sibling route is
bare) or re-reading the prompt clause that authorised it.
*Disposition: **ACTIONED** — withdrawn on the PR with measurements; #1334 merged unmodified; fix script neutralised.*

**F2 — The fold created the mirror image of the bug it fixed.**
`ShellLayout.tsx:33` types `requiresPermission?: string` — singular, no any-of form anywhere in the
nav model — and `:645` is the only evaluation point. The Pipeline item now gates on `tenders.view`
alone while the API admits `tenders.view` OR `crm.view`. A `crm.view`-only holder is entitled to the
page, admitted by the server, and has no link to it. Discoverability defect, **not** a lockout and
**not** an authorisation hole: the route is unguarded, so the URL still works.
*Disposition: **DEFERRED** — staged as `pr-pipeline-fold-s3-nav-any-permission-HOLD.md`, size 3, escalates:false,
gate `ShellLayout.tsx :: PIPELINE_FOLDED` (satisfied). Not armed — RULE 4 is one at a time.*

**F3 — PowerShell 5.1 `>` silently writes UTF-16LE.**
This is the second encoding trap from PS 5.1 this week (the first was the BOM-less em-dash parse
failure in `arm-prompt.ps1`). Any future check that pipes `gh api` output through `>` and then reads
it with a UTF-8 reader will report a clean file as empty of everything.
*Disposition: **DEFERRED** — recorded here. Not fixed — no tooling of ours depends on it today; the armed
windows-CI prompt is the structural answer to "PS 5.1 behaviour is untested".*

## WHAT I DID NOT DO

- **Did not run `fix1334.mjs`.** The finding it was written to fix did not survive re-measurement.
- **Did not run `git` through the device bridge.** All gate and premise measurement went via the
  GitHub API against `main` at `8bf95711`, which is more authoritative than the local tree anyway.
  The local dev tree is therefore still behind main; no fast-forward was performed.
- **Did not remove any `do-not-merge` label.** #1334 carried none; the boundary stands regardless.
- **Did not arm a second prompt.** RULE 4: one at a time. `pr-lint-human-gate-blindness` (size 5,
  escalates:false, gate_allow:none) is the intended next arm once the windows-CI run lands.
- **Did not arm `pr-crm-wincount-s2-close-bypasses`.** Gate is open (PROMOTE) but `escalates: true`.
  Marco's word required.
- **Did not touch the XL weight-band boundary.** Parked deliberately by Marco; not re-raised.
- **Did not commit these breadcrumbs.** Per Marco's 2026-08-26 decision there is no standing
  exception — he sweeps them in a PR he merges himself. This file and the new HOLD prompt are
  uncommitted in the working tree.
