# Station 00 — Supervisor | 2026-09-14T08:46Z–08:55Z

Tail of the 08:08Z run. Its main breadcrumb is
`00-00-supervisor-2026-09-14-0808-every-open-pr-is-marcos-and-a-mandatory-parameter-hung-the-arm-script-with-no-human-to-answer.md`,
tracked on `main` as of `34b7af7a`. This file carries only what happened **after** that breadcrumb
was committed. **It is UNTRACKED and reaches nobody until a board PR commits it.**

## GROUND

```
UTC            2026-09-14T08:46Z
origin/main    34b7af7a              (git fetch, then git rev-parse --short origin/main)
dev tree       main @ 34b7af7a       C:\ProjectOperations2   (0 ahead, 0 behind)
doc version    1
bootstrap      1
```

## WHAT I MEASURED

- [MEASURED] **`#1922` merged.** `Assert-SmokedOrEscalate -PR 1922` → True, `Merge-Pr -PR 1922` →
  True, read back `state=MERGED mergedAt=2026-09-14T08:46:24Z mergeCommit=34b7af7a`. The sweep was
  re-run immediately before and §7 read `[LIVE] SAFE TO ACT` at `08:43:07Z`.
- [MEASURED] **The arm completed end to end.** Armed `08:24:38Z` → watcher build in flight `08:30Z` →
  `#1923` opened `08:28:53Z`, head `fix/ratescol-s0-column-server-messages`, **exactly the two scoped
  files**, title exactly as the prompt specified. Verdict written:
  `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}`.
  `*-ready.md` → **0**: the prompt was consumed.
- [MEASURED] **The dev tree fast-forwarded, and BOTH documented blockers fired again, in order.**
  Untracked case: the 07:45Z addendum, proved byte-identical first — `git rev-parse origin/main:<path>`
  and `git hash-object <path>` both `e5d13ca4`, MATCH — then deleted. Tracked-modified case:
  `.arming-log.txt`. Read-backs after the FF: `git rev-list --left-right --count HEAD...origin/main`
  → **`0 0`**, `git diff --cached --name-status` → **EMPTY**.
- [MEASURED] **No arming-log data was lost.** Before the restore the working copy was 18,784 B / 116
  rows; `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` was **EMPTY**, which is
  the discriminator that says this is the line-ending smudge and **not** the append-only superset
  case. After the FF: **116 rows**, newest still my own `08:24:38Z ... actor=station-00.0808`.
- [MEASURED] **Another actor fast-forwarded the shared dev tree mid-run.** At `08:08Z` the dev tree
  read `HEAD=6a3fb6c4`; at `08:46Z`, before I touched it, it read `HEAD=9b98e199`. I did not move it.
  Recorded, not alarmed at: a fast-forward is not a destructive act, and the index was clean at every
  commit boundary I checked.

## WHAT CHANGED

- `#1922` merged; `main` is `34b7af7a`; the dev tree is level with it.
- **Nothing else.** No further arm, no label, no merge, no `/sot/`, no Azure.

## FINDINGS

### F1 — S3. My own arm created a THIRD live instance of the stays-armable-forever defect

After the fast-forward the single non-empty line in `git diff --numstat` is:

```
0	95	docs/pr-prompts/pr-ratescol-s0-column-api-hygiene-HOLD.md
```

`arm-prompt.ps1` renamed the `-HOLD.md` to `-ready.md`, the watcher consumed the `-ready.md` when it
built `#1923` — and **`#1923`'s diff is its two scope files only, so it does not retire the prompt.**
The `-HOLD.md` is therefore still **tracked on `origin/main`** while absent from disk. The moment
anything restores that path, `lint-prompt.mjs` reads it ADMIT again and it is armable — a duplicate
of an open PR.

**This is the third concurrent instance, and the three differ in a way worth recording:**

| prompt | its PR | does the PR retire the prompt? |
|---|---|---|
| `pr-fv2-import-s1-docx-and-persona` | `#1918` | **YES** — `docs/pr-prompts/superseded/…` is in its file list |
| `pr-ea-s2a-dashboard-preset-seed` | `#1920` | no |
| `pr-ratescol-s0-column-api-hygiene` | `#1923` | **no — created by this run** |

So the cure exists and one lane already applies it; it is simply not universal. **I caused this one**,
and the honest framing is that arming a prompt today reliably leaves this residue unless the prompt's
own body tells the code-writer to retire itself.

DISPOSITION: **DEFERRED**, with the same instruction the 07:09Z run gave for `pr-ea-s2a` and for the
same reason — **retire it to `superseded/` once `#1923` merges, not before.** Retiring early would
destroy a prompt whose work has not landed if `#1923` were closed unmerged; restoring the path early
puts an armable duplicate of an open PR back in the queue. **Leaving the deletion in the dev tree is
the safe state**, and my commit used a pathspec so it could not carry it.

⚠️ What would make it urgent: `#1923` merging, or anyone restoring that path.

🔧 **The general fix is upstream of all three and is cheap: a prompt's `scope:` should include its own
`-HOLD.md` path**, so the code-writer retires it in the same PR — which is exactly what made `#1918`
the row that works. That is a `docs/pr-prompts/PROMPT-SCHEMA.md` change, inside 00's docs lane, and is
the first concrete cure anyone has proposed for a defect that has now been re-found five times.

## WHAT I DID NOT DO

- **Did not retire `pr-ratescol-s0-column-api-hygiene-HOLD.md` or `pr-ea-s2a-dashboard-preset-seed-HOLD.md`.**
  Both PRs are open; see F1.
- **Did not merge `#1918`, `#1919`, `#1920` or `#1923`.** All four are Marco's — three on live watcher
  `marco:true` verdicts, `#1919` on the prose HOLD in its body.
- **Did not write the PROMPT-SCHEMA change.** It is a real proposal, not a measured fix, and a collect
  run that has already merged its board PR should not start new work it cannot verify in the same run.
- **This file is UNTRACKED** and reaches nobody until a board PR commits it. It will also be the
  untracked FF blocker for the next run — the documented one, cured by the byte-identity proof above.
