# Station 00 — Supervisor | 2026-08-30T00:08:59Z–2026-08-30T00:2xZ

## GROUND

```
UTC            2026-08-30T00:08:59Z
origin/main    0182444e            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 0182444e     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE. This run was NOT read-only-locked.

**Not blind.** `start_process` shell `powershell.exe` succeeded at 2026-08-30T00:08:59Z; Desktop
Commander present for the whole run. Every claim below is from the box.

Blindness alternation for the record: 14:09 blind · 16:09 sighted · 18:09 blind · 20:09 sighted ·
22:09 sighted · **00:09 SIGHTED**.

## WHAT I MEASURED

### The freshness proof for my own binding documents

The preflight orders the three binding docs read from `git show origin/main:<path>`, never the
working copy. I proved equivalence instead of assuming it.

`[MEASURED]` `git rev-parse origin/main:<path>` vs `git hash-object <path>`, all three:

```
docs/pipeline/stations/00-supervisor.md   e84b87b3fd50183d78e876b2e385c2c0e88fd107  same=True
docs/pipeline/DOCTRINE.md                 ac04e437c91e086a3123ebd90015cae69ae1d85a  same=True
docs/pipeline/STATION-CAPABILITIES.md     b3976fe129475d289fb524302a6f78f12a16939d  same=True
```

Blob-identical, so reading the working copy WAS reading `origin/main`. Read all three in full.

### Ground and board

`[MEASURED]` `git rev-list --left-right --count origin/main...HEAD` = `0	0`; `git diff --cached
--name-status` = empty. The dev tree is converged and its shared index is clean.

`[MEASURED]` `scripts/pipeline/status-sweep.ps1`, run twice (00:09:50Z and 00:10:14Z):

```
0. gh CAN reach GitHub (saw merged PR #1398) · node runs        <- both positive controls pass
1. OPEN PRs: 0        main branch CI last 3 runs: 3 success     <- trunk green
2. watcher node RUNNING pid 26364 · wrapper alive (3) · heartbeat 1917 min · clone dirty=35
3. in-progress prompts 0 · index.lock false/false · git processes 0 · no PR touched in 2 min
4. armed (*-ready.md): 0 · needs-marco 14 · no-pr-opened 107 · failed 41 · blocked 0
7. SAFE TO ACT
```

`[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, **EXIT=0**,
112 checked, 0 malformed, 9 skipped as pre-contract. No station SILENT: 00 2.0h / 03 1.1h /
04 2.0h / 05 10.0h, all inside cadence. (This is the first freshness run since #1397 widened
`NAME_RE`; the checked count is 112, against 106 and 111 in the two runs before it.)

`[MEASURED]` `node scripts/pipeline/lint-station.mjs` → `ADMIT: all 7 docs clean`, EXIT=0.

### The OAuth token, read at source — TWELFTH consecutive reading, unmoved

`[MEASURED]` node against `C:\Users\Marco\.claude\.credentials.json` (expiry field only; no secret
value read or printed):

```
expiresAt_raw 1787933615984
expiresAt_utc 2026-08-28T16:13:35.984Z
now_utc       2026-08-30T00:11:16.972Z
EXPIRED       true
mtime_utc     2026-08-28T16:13:26.909Z
bytes         1649
```

Byte-for-byte the same reading as the eleventh, and the mtime has not moved in **31.9 hours** —
so nothing is refreshing it and nothing will. **ARM NOTHING.** The board's stillness is a
correctly-held brake, not health and not a stall.

### The collection sweep

`[MEASURED]` `Get-ChildItem docs\pr-prompts\00-*.md` filtered on `LastWriteTimeUtc > 21:30Z`, then
`git status --short`: exactly **one** new breadcrumb since my 22:09Z run, and it was **untracked**:

```
08-29 23:08  00-03-machine-minder-2026-08-29-2305-oauth-expired-watcher-cannot-run.md  17506B  ??
```

Read in full. Its five findings are dispositioned below. `[MEASURED]` I copied it into this PR's
worktree with a `Buffer.compare` read-back (`copied bytes 17506 -> equal=0`), so the sweep-up is
byte-exact, not a re-typing.

### The instrument that lied to Station 03

`[MEASURED]` 03 measured `Compare-Object` returning **100 differences** between two 285-line copies
of its own station doc that `git diff --stat` and `git hash-object` both prove identical. That is
DOCTRINE §7's exact shape — a broken instrument handing over a confident, coherent, wrong verdict
about a healthy system — and it was one belief away from opening a station report with a false
*"your station doc is not what `origin/main` says it is."* It was not in §9. It is now.

## WHAT CHANGED

One PR, three files, all docs. No board mutation of any other kind.

- `docs/pipeline/DOCTRINE.md` — §9.3 gains the `Compare-Object` phantom-diff trap (F5).
- `docs/pipeline/stations/_canonical-blocks.json` — the `instruments` hash re-recorded.
- `docs/pr-prompts/00-03-machine-minder-...-2305-...md` — 03's breadcrumb, swept up.
- this breadcrumb.

`[MEASURED]` The canonical-block procedure, with its negative control run BEFORE the re-record:

```
node C:\po-sup-fix-scripts\st00-0011-patch-doctrine-93.mjs docs\pipeline\DOCTRINE.md
   anchor occurrences: 1 · read-back contains marker: true · 30880 -> 31552 bytes
node scripts/pipeline/lint-station.mjs
   REJECT docs/pipeline/DOCTRINE.md
     x canonical block `instruments` has been EDITED (sha 2edc6347fb6ab1b2, expected 8e1ee36e44f1f2ed)
   ADMIT the other six · REJECT: 1 of 7 · EXIT=1
node scripts/pipeline/lint-station.mjs --write-canonical
   WROTE  instruments v2 2edc6347fb6ab1b2 · station-contract v1 192677cc8d5680a6
node scripts/pipeline/lint-station.mjs
   ADMIT: all 7 docs clean · EXIT=0
```

`[MEASURED]` `git diff --numstat` = `8 0 DOCTRINE.md` and `1 1 _canonical-blocks.json`; the json
diff is the `instruments` sha alone, `station-contract v1` untouched; `git diff` over
`docs/pipeline/stations/` matches **no** `station_doc_version` line. Eight added lines for a
seven-line bullet plus its blank — no line-ending damage, no version bump.

`[INFERRED]` One string, one script, one anchor asserted unique, an idempotence guard on the marker
and a read-back — the shape that replaced six hand edits. Note the difference from the
`station-contract` case: `instruments v2` lives in DOCTRINE **only** (stations point at it, they do
not copy it), so the correct negative control here is **REJECT 1 of 7**, not 6 of 7. The other six
staying ADMIT is itself the proof that no station carries a copy.

## FINDINGS

### F1 — 03's OAuth escalation: I am confirming it independently, not re-reporting it. Thirty-two hours dark.

03 filed the seventh report of the expired token. I read the credential at source myself (above) and
it is the twelfth consecutive identical reading. Between them, 00 and 03 have escalated this every
two hours since 2026-08-28T18:09Z and the file has not been touched once.

DOCTRINE §5.6 calls this verification exhausted, and §5.3 says re-authentication needs a real human
identity that no agent has. So this run adds exactly one thing to the record and stops: **the
elapsed number.** 31.9 hours in which the whole execution lane produced nothing, four prompts
(`rev-1384`, `rev-1385`, `rev-1386`, `pr-crm-s3-account-on-client-create`) quarantined to `failed/`
by a 401 rather than by any defect of their own, and every process-level probe reading green
throughout.

I endorse 03's option set unchanged and will not restate it — **(A) re-authenticate AND re-stage the
four burned prompts by copy-with-fresh-letter is the complete-and-additive one**; (B) fails the
future-data half by discarding four real pieces of staged work with no marker; (C) is a correct
follow-up to (A), never an alternative to it.

**DISPOSITION: ESCALATED** — Marco, at the keyboard on `LAPTOP-E6NHU4E4`. Nothing else on this
board can move until it is done.

### F2 — F5 from 03: `Compare-Object` lies. Fixed in DOCTRINE §9.3 this run.

03 dispatched a one-line §9.3 addition to me. I actioned it, slightly expanded: the bullet names
the measurement (100 phantom differences on two byte-identical 285-line files), names the false
headline it would have produced, and names the three instruments that DO decide the question —
`git diff`, `git hash-object`, `Buffer.compare` in node.

Verified by the four-step canonical procedure quoted under WHAT CHANGED, ending `ADMIT: all 7 docs
clean, EXIT=0` with the hash file carrying the new `instruments` sha.

**DISPOSITION: ACTIONED** — in this PR.

### F3 — F2 from 03: `verdict-archive` moves tracked files out of the clone without committing; 51 stashes and counting

The watcher's own verdict-archive sweep moves 35 tracked `docs/pr-reviews/pr-*-review.md` out of the
clone without committing; the next preflight stashes the deletions; nothing ever pops or drops; the
stash list has reached 51 and `status-sweep.ps1` prints `watcher clone: dirty=35` on every single
run. A permanent amber trains its readers to ignore it, which is the real cost.

The fix is a code change under `scripts/pr-watcher/**` (archive by copy and `git rm` in one commit,
or commit the deletions) plus a one-off `git stash drop` loop — **never `pop`** (DOCTRINE §9.2).
That is a `rev-` prompt, and a prompt cannot run: the token is dead (F1) and anything I arm
quarantines instantly. Staging it now would put a live prompt in a queue that eats prompts.

**DISPOSITION: DEFERRED** — hard-blocked behind F1. The moment F1 clears, this is the first
non-board item to stage. It is not urgent in itself; it becomes urgent if the stash count starts
consuming disk or if someone acts on the permanent `dirty=35` amber as though it were news.

### F4 — F3 from 03: the watcher clone is 22 commits behind, none of them behavioural

Clone HEAD `181817aa` vs origin/main `0182444e`; `git log HEAD..origin/main -- scripts/pr-watcher/`
= **0** commits, with a positive control of 13 over `docs/pipeline/`. The running node is executing
current watcher code. Fast-forwarding is bookkeeping and must ride along with whatever restart
follows F1 — a restart adopts nothing (DOCTRINE §9.5), so doing it alone changes no behaviour and
costs an idle window.

**DISPOSITION: DEFERRED** — becomes urgent the instant any commit lands in `scripts/pr-watcher/**`,
because from that moment the running watcher is executing stale code.

### F5 — F4 from 03: three launcher wrappers alive, and the launcher has no instance guard

PIDs 10364, 23100, 2984, started on three different days, all
`watcher-launcher-singlelane.ps1`. They have NOT produced duplicate nodes — the guard one layer down
at `start-watcher.ps1:136-140` holds and exactly one node (26364) is measured — but the launcher
itself greps zero for `SINGLE-INSTANCE|ADOPT|Mutex` against a working `'.'` positive control, so the
count can only grow, and each loop is another preflight-stash path feeding F3.

Killing two wrappers is a repair in 03's lane, and 03 is report-only, so this needs 00 to dispatch
it — but the additive fix is a named mutex in the launcher, which is again a prompt, which again
cannot run (F1). Two stale wrappers cause no measured harm today.

**DISPOSITION: DEFERRED** — retire the two stale wrappers at the relaunch window that F1's fix will
require anyway, rather than killing them ad hoc now. Add the mutex in the same prompt as F3's
archive-sweep fix; they touch the same machinery and the same idle window.

### F6 — 06 still has no cadence, so "DISPATCHED → 06" parks instead of closing. Unchanged, and now four runs old.

Raised 2026-08-29T22:4xZ and still unanswered. Station 06 appears in the authority matrix with
cadence "on demand"; every other station has a clock. An item dispatched to 06 therefore has no
mechanism that ever picks it up, which is how a defect named in a breadcrumb FILENAME on 08-26 was
still live three days later. The one item genuinely sitting in that state is the sot-refs exemption
bucket (built, running green at `total=274 dangling=0 exempt=0 baselined=17`, but **`exempt=0`**, so
the eight gitignored-by-design refs are still baselined and the floor-of-8 is intact inside the 17 —
remaining work is to POPULATE the bucket, not build it).

Options, RULE 1 applied: **(A) give 06 a cadence** — complete and additive: the lane keeps its
designer, and dispatched items acquire a clock that closes them. **(B) 00 actions such items
itself** — passes the immediate half, fails the future half by re-concentrating board work in one
station, which is the LL-38 shape. **(C) leave it** — fails both halves; it is the status quo that
already lost three days.

**DISPOSITION: ESCALATED** — Marco. Unchanged from 22:4xZ; re-stated because an unanswered
escalation that stops being repeated stops existing.

### F7 — 13 dead escalations sit in `needs-marco/`, and they are gitignored, so no PR can clear them

`status-sweep.ps1` §5 names 13 `[STALE]` entries across 7 files whose referenced PRs are all MERGED
or CLOSED (#1134, #1135, #212, #213, #1337, #1340, #1342, #1343, #1344, #1345, #1158, #727). The
sweep already refuses to report them as pending, so they mislead nobody who reads the sweep — but
they inflate `needs-marco/: 14` on every run, and that count IS read as a backlog.

The reason nobody has cleared them is structural and worth writing down: `needs-marco/` is
gitignored at `.gitignore:75-82`, so these files exist only on this box. There is no PR that can
retire them and no CI that can see them; clearing them is a disk operation with no review and no
audit trail, on the one folder DOCTRINE §5b calls "the only real stop".

**DISPOSITION: DEFERRED** — deliberately not cleared this run. Deleting from the only folder that
genuinely halts work, unreviewably, to improve a count, is a bad trade while the board is frozen for
an unrelated reason. The complete-and-additive shape when it is done: move them to a dated
`needs-marco/discharged-YYYY-MM-DD/` subfolder rather than delete, so the paper trail survives on
the box even though git cannot see it.

## WHAT I DID NOT DO

- **Armed nothing.** The OAuth block stands on a twelfth direct reading; an armed prompt quarantines
  instantly (four already have). ARMED went 0 → 0.
- **Merged nothing** — OPEN PRs = 0, so there was nothing to merge. No label touched, no
  watcher-routed PR approached (RULE 2), no `do-not-merge` removed.
- **Did not restart the watcher, kill the two stale wrappers, fast-forward the clone, drop a stash,
  or clean the clone's 35 deletions.** All repairs, all behind F1, and all better done in the one
  idle window that F1's fix will require anyway.
- **Did not re-stage the four 401-burned prompts.** That is an arm, and it would burn them a second
  time before F1 is fixed.
- **Did not clear the 13 dead `needs-marco/` escalations** — see F7 for why that is a decision and
  not an oversight.
- **Did not touch `/sot/`** (05's alone), production data, or anything Azure / Entra / SharePoint.
- **Did not run `git` from the device bridge against either `.git`** — every git call went through
  Desktop Commander PowerShell on the Windows host (DOCTRINE §9.2, the 0-byte `index.lock` trap).
- **Did not do 02/03/04/05's work myself** (LL-38). The only mutation this run is a docs PR in a
  disposable worktree off `origin/main`.

---

Stamped `2026-08-30T00:2xZ`, true at `origin/main 0182444e`, dev tree `main @ 0182444e`, watcher
clone `main @ 181817aa`. This breadcrumb ships **inside its own PR**, so it needs no sweeping up.
