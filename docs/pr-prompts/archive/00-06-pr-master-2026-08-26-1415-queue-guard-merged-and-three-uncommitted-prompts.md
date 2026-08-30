# Station 06 — PR Master — 2026-08-26 14:15Z — queue guard merged; stopping arming, and why

## GROUND

Station 06 (PR Master), unattended. Previous breadcrumb:
`00-06-pr-master-2026-08-26-1345-dns-chain-stops-at-s3.md`.

## WHAT I MEASURED

### #1340 — the ORPHANED_DISCHARGE queue guard (merged `44b5f3af`, 14:12:18Z)

**+168 / −0** — zero deletions, which is the strongest possible answer to F12's worry that this would
collide with #1336's 80-minute-old rewrite of the same file.

Verdict-token counts, main `cfc74982` → head `6a568c8d`:

| Token | before | after | |
|---|---|---|---|
| `ORPHANED_DISCHARGE` | 0 | **3** | the new guard |
| `STALE` | 2 | 6 | extended, hooks the stale path |
| `REJECT` | 23 | 26 | new rejection route |
| `HUMAN_GATE` | 8 | **8** | #1336 untouched |
| `GATE_NOT_RELEASED` | 10 | **10** | #1336 untouched |
| `ADMIT` / `PROMOTE` | 13 / 3 | 13 / 3 | unchanged |

Nothing decreased. Confirmed live in the runner log, not from the PR body:

- `PASS pr-orphan-example (exit 1, wanted 1)` — a stale prompt whose basename appears in a
  `BACKLOG.yaml` discharge line now REJECTs instead of being binned.
- `PASS pr-ordinary-stale (exit 3, wanted 3)` — negative control; ordinary STALE still bins.
- `PASS pr-live-and-discharged (exit 0, wanted 0)` — a live+discharged prompt still ADMITs.
- `PASS hold-content-gate-unmet (exit 1)`, `with-authority-quiet`, `imposter-heading` — **#1336's
  verdicts all still pass.**
- `=== 67 passed, 0 failed`; node suites 137/137 and 33/33.

**Scope excursion, examined:** a third file, `docs/pr-reviews/pr-1339-review.md` (+28), outside the
declared 2-file scope. I read it. It is the pr-fix-reviewer's verdict on #1339 — **MERGE, "Risks
Marco should know: None"** — which independently corroborates my own review of #1339 before I merged
it. It also records `pnpm build ✓ (green)`, further undercutting the F10 "194 TS errors pre-exist on
main" claim from #1338's author.

Content harmless, so I merged. But see F13.

## WHAT CHANGED

- **#1340 merged** — `44b5f3af`, native squash auto-merge. Sixth merge of the night.
- Nothing armed.

## FINDINGS

**F13 — One agent committed another agent's uncommitted working-tree file.**
The queue-bin-guard agent swept `docs/pr-reviews/pr-1339-review.md` into its feature branch. That file
was written by a *different* process (the reviewer) into the shared tree. Benign this time — a
finished, correct verdict — but the mechanism would just as happily ship a half-written file, or one
containing something that should not be in a feature PR. It also means pipeline bookkeeping is
reaching git through feature PRs rather than through Marco's sweep.
*Disposition: **ACTIONED** — merged; recorded. This is the same family the `.gitignore` hygiene prompt addresses.*

**F14 — Three HOLD prompts in the queue do not exist on main. I stopped arming because of it.**

`CR=0` (LF endings) maps exactly onto "absent from main" — verified by 404 against the API:

| Prompt | staged | on main |
|---|---|---|
| `pr-hygiene-gitignore-no-pr-opened-HOLD.md` | 2026-08-25 02:17 | **ABSENT** |
| `pr-watcher-idle-tick-liveness-HOLD.md` | 2026-08-25 07:18 | **ABSENT** |
| `pr-pipeline-fold-s3-nav-any-permission-HOLD.md` | 2026-08-26 11:33 (mine, tonight) | **ABSENT** |

Controls: `pr-tendering-board-restore-submitted-cardless-HOLD.md` (8637 B) and
`pr-bp-s2-worth-chasing-view-HOLD.md` (5632 B) are both present on main, and both are CRLF.

**Why this stops me.** `*-ready.md` is gitignored (`.gitignore:73`) and so is `processed/`. So arming
an uncommitted HOLD walks it HOLD → ready → processed/ entirely inside ignored space: **the prompt
text would never reach git at all.** The only record of what was asked would be a file on Marco's
disk. That is precisely the loss-of-record class that #1340 — merged forty minutes ago — exists to
prevent, and the same shape as the escalation that vanished for seven days (F6).

Two of the three were staged on 25 August by an earlier session and have been waiting for Marco's
sweep ever since.

*Disposition: **DEFERRED** — **nothing armed this cycle.** The three attractive small candidates (size 1, 3, 3) are
all uncommitted. The committed alternatives are size 4-8 — and reaching for a size-8 prompt at 14:15Z
with nobody watching is the worse risk, not the better one. Marco has a real choice here: sweep the
three into a PR, or tell me arming uncommitted prompts is acceptable. I am not making that call for
him.*

## WHAT I DID NOT DO

- **Did not arm an uncommitted prompt.** See F14.
- **Did not commit the three uncommitted prompts** — Marco sweeps; there is no standing exception.
- **Did not arm a size-8 prompt unattended** as a substitute.
- **Did not merge #1337** — still Marco's, still fails its own `done_when`. And
  `docs/pr-reviews/pr-1337-review.md` **still does not exist at 14:10Z, ~85 minutes after `rev-1337`
  was dispatched** — while the reviewer demonstrably did produce a verdict for #1339 in that window.
  The 1337 review task appears to have died.
- **Did not run the #1337 review myself.** Not my lane.
- **Did not run `git` through the bridge**, and did not fast-forward the dev tree.
