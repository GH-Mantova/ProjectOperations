# Station 00 — Supervisor | 2026-09-05T16:30Z–2026-09-05T16:4xZ

Addendum to the 16:08Z run (same station, same run, later measurement). The collect, the board
classification and F1–F3 are in
`docs/pr-prompts/00-00-supervisor-2026-09-05-1608-thirty-six-of-forty-admit-prompts-stop-at-marco-and-one-of-the-four-that-do-not-rewrites-every-station-contract.md`,
landed as `#1672`. This carries one finding that could only be measured **after** that PR merged.

## GROUND

```
UTC            2026-09-05T16:30Z
origin/main    a051c6e2            (#1672, merged 16:25:21Z)
dev tree       main @ a051c6e2     C:\ProjectOperations2   (0/0, both diffs EMPTY)
doc version    1                   (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

## WHAT I MEASURED

### The post-merge fast-forward, run exactly as the station doc prescribes

`#1672` landed `docs/pr-prompts/.arming-log.txt` (DOCTRINE §9.5 requires any run that arms a prompt to
commit the log) and deleted a consumed `-HOLD.md`. Both were locally modified in the dev tree, so the
fast-forward hit the *"local changes would be overwritten"* branch of the FF cure, and I ran that cure
step by step.

**Step 1 — restore to HEAD, byte-exact.** `[MEASURED]` `git show HEAD:docs/pr-prompts/.arming-log.txt`
written to disk with node (`readFileSync`/`writeFileSync`, never PowerShell `>`, §9.3):
`restored docs/pr-prompts/.arming-log.txt bytes=7014`. The same for the HOLD file, 5448 bytes. Nothing
was `git checkout`-ed, anywhere (§9.2).

**Step 2 — `git add --renormalize`, then read back `git diff --cached --name-status` for EMPTY.**
`[MEASURED]` it was **not** empty:

```
git diff --cached --numstat   ->  53      53      docs/pr-prompts/.arming-log.txt
git rev-parse HEAD:docs/pr-prompts/.arming-log.txt  ->  b3ea9f15…
git hash-object docs/pr-prompts/.arming-log.txt     ->  917b1245…
git check-attr text eol -- docs/pr-prompts/.arming-log.txt  ->  text: auto · eol: unspecified
```

Every line of a 53-line file, reported changed, on a restore that wrote the blob's own bytes and could
not have changed one. The blob **stores CRLF**; under `text: auto` the clean filter strips those CRs,
so `--renormalize` stages the LF form as a genuine content change.

### Why this matters more than a line-ending curiosity

The station doc's own read-back instruction reads: *"it must be **EMPTY**; if the renormalize staged
something, the content really did differ and you have a different problem."* **On this file that
sentence is false**, and it is false in the expensive direction: it sends the next run hunting a
content difference that does not exist, in the middle of a cure for a trap that has already cost four
consecutive runs a re-diagnosis from first principles.

This is §7's shape occurring **inside** the cure for a §7 trap — a correct reading of the wrong
quantity, shipped with a prescribed misinterpretation attached. `--numstat` reading `53 53` is true;
what is false is what the doc tells you it means.

`[MEASURED]` **The cure is to undo step 2, not to diagnose it.** `git restore --staged <path>` —
index-only, and specifically not `git checkout -- <path>` (§9.2, one typo from `checkout -- <dir>`,
which resurrects consumed prompts). After it, `git diff --cached --name-status` **EMPTY** and
`git diff --numstat` **EMPTY**: the byte-exact file from step 1 had been correct all along and needed
no normalization at all. Step 3 then fast-forwarded cleanly, `41e9600a..a051c6e2`, and step 5's three
read-backs all passed — `0 0`, EMPTY, EMPTY — with the armed `-ready.md` (gitignored, untracked)
untouched throughout, which is the thing the whole sequence must not disturb.

`[MEASURED]` Watcher re-checked afterwards via the sanctioned probe,
`scripts/restart-watcher-if-wedged.ps1` (report-only, no `-Fix`): **`VERDICT: HEALTHY`**, pid 20000
ALIVE, `armed prompts waiting: 1`, `queue last moved: 3 min ago (rev-1672-ready.md)`,
`heartbeat last write: 2 min ago`, `restart churn: 0 cycles in 20 min`. The arm from the 16:08Z run is
queued behind the auto-generated review job for `#1672`, which is the healthy state, not a stall.

## WHAT CHANGED

One paragraph added to `docs/pipeline/stations/00-supervisor.md` under step 2 of the FF cure, plus this
report. No canonical block touched — the FF cure sits well below `END-CANONICAL-BLOCK: station-contract v2`
— confirmed by `node scripts/pipeline/lint-station.mjs` exit 0 on both sides of the edit.

## FINDINGS

### F4 — the FF cure's step 2 manufactures the difference it then tells you to diagnose, and every arming run now meets it

**DISPOSITION: ACTIONED in this PR.** The correction is written where the failure happens — inside
step 2, not as a footnote — and carries the discriminator rather than a blanket "skip step 2": step 2
is still right for `docs/pipeline/sweep-rotation.json`, the file it was written for, whose smudge is
real. **The test is whether step 1 restored the bytes byte-exact from `git show HEAD:`.** If it did, a
non-empty `--cached` after `--renormalize` is the renormalize talking, not the content.

The frequency claim is the part that makes this worth a PR rather than a note: this used to be a
`sweep-rotation.json` path, hit only when Station 04 had left that file dirty. Since DOCTRINE §9.5
began requiring every arming run to commit `.arming-log.txt` in its board PR, **every arm now lands
that file and meets this on the fast-forward afterwards.**

**Hand-landed deliberately, and this is the §10.3 declaration that it was.** §10.3: *"Hand-land when
the content must be exact — binding law, a canonical block, a correction to DOCTRINE itself — and say
in the PR body that you did, and why."* This is a correction to a binding station document whose text
must match the commands it names character for character, and the 16:08Z run's **F2** is an open
escalation about precisely this class of change reaching `main` unreviewed through the `tests-docs`
lane. Routing it through that lane while escalating that the lane should not carry it would be
incoherent.

## WHAT I DID NOT DO

- **Did not change step 2 for `sweep-rotation.json`**, and did not weaken the read-back. The
  instruction still says EMPTY; what is added is what a non-empty result means when step 1 was
  byte-exact, and how to clear it.
- **Did not touch `.gitattributes`** or re-commit `.arming-log.txt` in a normalized form. Rewriting
  53 lines of an append-only audit log to fix a line-ending inconsistency would put a whole-file
  rewrite into the one artifact RULE 2 and §9.5 read for arm history — a much worse trade than
  documenting the behaviour.
- **Merged nothing else, armed nothing else, labelled nothing, and authored no receipt.** The board is
  unchanged from the 16:08Z report: `#1667`, `#1665`, `#1662`, all CLEAN, all green, all Marco's.
- **Did not restart, kill or `-Fix` the watcher** — the sanctioned probe returned HEALTHY with a fresh
  heartbeat and a moving queue.
