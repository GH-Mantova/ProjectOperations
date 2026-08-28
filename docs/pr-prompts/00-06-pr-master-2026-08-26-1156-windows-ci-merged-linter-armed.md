# Station 06 — PR Master — 2026-08-26 11:56Z — Windows CI merged, linter armed, and my armable scan was lying

## GROUND

Station 06 (PR Master), `GH-Mantova/ProjectOperations`. Marco's standing loop, unattended run.
Previous breadcrumb: `00-06-pr-master-2026-08-26-1133-1334-finding-withdrawn-windows-ci-armed.md`.

## WHAT I MEASURED

**#1335** (`ci: run pipeline tests on windows-latest`), head `1c4c8782`:

- 1 file, `+43 / -0`. Scope was `.github/workflows/ci.yml`; nothing else touched. Purely additive.
- `labels: []`, `mergeStateStatus: CLEAN`, 13/13 checks pass.
- Diff carries `runs-on: windows-latest`, `shell: bash` on the run step, and asserts `skipped == 0`
  and `pass >= 8`, failing otherwise.

I did not take the PR body's word for the two things the prompt required. **Read the actual runner
log** (`actions/jobs/98162945748/logs`):

```
# tests 19    # suites 1    # pass 19    # fail 0    # skipped 0    # todo 0
OK: pass=19 skipped=0
```

All eight `arm-prompt.ps1` subtests are named individually in the log — including
`lock held by another process causes non-zero exit within timeout` and
`timeout message names the holder PID`. They genuinely executed on Windows. Before this job they
skipped on every run.

The zero-discovery guard is real and correctly shaped: if the glob failed to expand, `node --test`
would discover nothing and exit 0 with `pass 0`, and the `pass >= 8` assertion fails the job. The
`skipped == 0` check alone would NOT have caught it (a zero-discovery run also reports `skipped 0`) —
the `pass >= 8` floor is the load-bearing one.

**Merged**: squash `9ff24903`, 11:54:16Z.

**Next candidate** `pr-lint-human-gate-blindness`, measured against main `9ff24903`:

- Front matter (lines 1–14): `size: 5`, `gate_allow: none`, `escalates: false`, **no `requires_*` of
  any kind**.
- Premise `! grep -q "HUMAN_GATE" scripts/pipeline/lint-prompt.mjs` — on main: 0 × `HUMAN_GATE`,
  0 × `GATE_NOT_RELEASED`, against sanity floors of 7 × `ADMIT` and 16 × `REJECT`. **Premise holds.**
- Local 13909 bytes − 253 CR = 13656 = main's byte size exactly. In sync.

## WHAT CHANGED

- **#1335 merged** — `9ff24903`, native squash auto-merge.
- **`pr-lint-human-gate-blindness` ARMED** — `fs.renameSync` HOLD → ready, 13909 → 13909 identical.
  Never `git mv`.

## FINDINGS

**F4 — My own armable scan reports false dependency gates and false clusters.**
The scan I have been using across 55 HOLD prompts greps `^requires_…`, `^cluster:` and friends with
`grep -m1` over the WHOLE FILE, not the front matter. `pr-lint-human-gate-blindness` came back as
`reqs=1, cluster=crm-wincount, cluster_order=3`. All three are wrong. They were read from **lines
101–108 of the prompt body**, which contain an illustrative front-matter block quoted as part of the
prompt's own explanation of the F6 gate-silence defect.

The bias is toward over-reporting dependencies, so it has not caused an unsafe arm — it would make me
withhold an armable prompt, not arm a blocked one. But it is the same class as F6: a scan whose output
is trusted as a gate reading while it is actually reading prose. **Any prompt I previously set aside
on the strength of `reqs=1` may in fact be armable**, and the 14-armable figure from earlier tonight
is not trustworthy in either direction.
*Disposition: **DEFERRED** — not fixed tonight — fixing my own scratch tooling is not a PR and Marco is asleep. Every
arm from here is gated on reading the front matter block directly, as this one was. Recorded so the
next session does not re-inherit the number. The armed linter prompt is the structural answer: once
the linter can read a body correctly, these scans stop being hand-rolled.*

**F5 — `grep -n '^---$'` silently matches nothing on the CRLF working tree.**
Lines are `---\r`, so the anchored pattern never matches and a front-matter boundary check returns
empty rather than failing. It returned "no boundary found" for a file that plainly has one.
*Disposition: **DEFERRED** — worked around by reading the block with `sed -n '1,14p'` and eyeballing it. Recorded as
a third PS/Windows-encoding trap alongside the UTF-16 `>` redirect and the `.Matches.Count` lie.*

## WHAT I DID NOT DO

- **Did not trust #1335's PR body.** Both prompt requirements were verified from the runner log.
- **Did not add the new job to branch protection.** #1335 correctly declined to; making
  `Pipeline — arm-prompt tests (Windows)` a required check is a repo-settings change and **Marco's
  call**. Worth doing once it has a few green runs.
- **Did not run `git` through the device bridge.** All measurement via the GitHub API against main.
  The local dev tree remains behind main; no fast-forward performed.
- **Did not arm a second prompt.** RULE 4: one at a time.
- **Did not arm `pr-crm-wincount-s2-close-bypasses`** (`escalates: true` — Marco's word required).
- **Did not re-raise** the XL weight-band boundary, or the withdrawn #1334 route-guard finding.
- **Did not commit these breadcrumbs**, `pr-pipeline-fold-s3-nav-any-permission-HOLD.md`, or anything
  else. Marco sweeps them himself; there is no standing exception.
