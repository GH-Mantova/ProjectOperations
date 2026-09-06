# The five scheduled bootstraps cite a `.gitignore` line that now says the opposite

**Filed by** Station 00 (scheduled, 2026-09-06T07:08Z run), at `origin/main d5d6ad69`.
**Source finding:** Station 04, `docs/pr-prompts/archive/00-04-scanner-2026-09-06-0610-the-gitignore-citations-rotted-a-second-time-and-reached-all-five-bootstraps.md`, F1 part 2.
**Companion breadcrumb:** `docs/pr-prompts/00-00-supervisor-2026-09-06-0708-...md`, F3 and F4.

Two items, both small, both yours. Neither is urgent tonight — nothing is broken right now.

---

## ITEM 1 — five one-line pastes (S3)

### What is wrong

Each of `C:\Users\Marco\Claude\Scheduled\{00-supervisor, 02-board-driver, 03-machine-minder,
04-scanner, 05-sot-keeper}\SKILL.md` tells its station:

> Never one of the five gitignored sinks named at `.gitignore:107-111` ...

[MEASURED 2026-09-06] `.gitignore` lines 107-111 are:

```
107  !Claude Design/docs/
108  !Claude Design/assets/
109  Claude Design/assets/*
110  !Claude Design/assets/routes.js
111  !Claude Design/proposed/
```

The five sinks are now at **115-119**. Cause: #1573 (`27127f6f`, 2026-09-04) inserted a nine-line
block above them and #1576 added one more. Net **+8**.

### Why it matters, and why it is S3 rather than S2

Both wrongly-cited lines are **negation** rules. A station that checks its own citation reads
`!Claude Design/assets/` under a sentence claiming `docs/qa/qa-findings.md` is gitignored, and the
available conclusion is that the file is *no longer ignored* — i.e. that it is a safe, tracked place
to write a finding. `docs/qa/qa-findings.md` swallowed a released gate for nine days once already.

It is **S3 and not S2** only because the bootstrap sentence names the five files inline immediately
after the citation, so a reader still has the names. The repo-side copies of the same sentence did
not always, which is why those were the urgent half.

### The repo half is already fixed

Station 00 replaced **22** citations of this class across the 7 station docs and
`STATION-CAPABILITIES.md` in the board PR that carries this file, with the canonical-block hash
re-recorded and `lint-station.mjs` back to exit 0. The fix is **rule text, not a renumber** — 04's
point, verbatim: *"Renumbering is a fix with a half-life: it re-arms the trap and bills the next run
to find it again."* The 2026-08-30 renumber was true for five days.

### What I am asking you to do

Paste this in place of the stale phrase, in each of the five files. It is the same replacement every
time:

```
Never one of the five gitignored sinks listed under the "# Overnight-QA scheduled task" comment in
.gitignore (docs/qa/qa-checklist.md, qa-findings.md, qa-test-data-registry.md, .qa-run.lock,
qa-run-*.md)
```

### Why I did not do it myself

RULE 1, both halves, on the three options:

1. **You paste it (recommended — passes both halves).** Fixes the five instances *and* removes the
   number, so the next `.gitignore` insertion cannot re-rot them. Nothing about any run's data entry
   changes.
2. **An agent writes the five files directly.** Passes "solves it completely"; **fails "without
   damaging"**. Those files are outside the repo, outside CI, and versioned by nothing — the edit is
   unreviewable and has no revert path, and it is the layer that governs every station's behaviour.
   `STATION-CAPABILITIES.md` section 1 already rules this: *"prefer the repo doc ... then report the
   drift so Marco can update the scheduled-task file."*
3. **Leave them.** Fails both halves: the citations stay wrong and re-rot on the next insertion.

If you would rather I just do it, say so and I will — but this is the recorded rule and I would
rather ask than quietly rewrite the layer that governs five stations.

---

## ITEM 2 — the class has no gate, and it has now recurred twice (S3)

`lint-station.mjs` already parses every station doc and every agent definition in CI. A check that
fails any `<file>:<N>` citation whose cited line does not contain the token the sentence claims would
have caught #1573 in **#1573's own CI run**, before any of this reached a station.

Two facts that make this worth building rather than watching:

- It has recurred. 2026-08-30 found the same class off by **one**; today it was off by **eight**.
- **The value query cannot enumerate the class.** 04's blast-radius scan searched for the literal
  strings `107-111` / `108` — so it found the eight instances it already knew about and was blind to
  a ninth at a different offset. Station 00 found that ninth on the first re-measurement with a class
  query (`\.gitignore:\d+(?:-\d+)?`): `05-sot-keeper.md:328` cited `.gitignore:127-128` for
  `relationship-map.md` / `.json`, which `git check-ignore -v` puts at **135-136**. Same insertion,
  same day, same +8. Now fixed in the same PR.

This is a `scripts/` change and therefore outside Station 00's merge lane, which is why it is filed
for you rather than shipped. It is **DEFERRED**, not dropped: it becomes urgent the next time any
station files a `.gitignore:<N>` finding at all.

---

## What is NOT being asked

- No Azure / Entra / SharePoint anything.
- No production data, no migration, no secret, no permission.
- Nothing irreversible. Item 1 is five text pastes; item 2 is a CI check that does not exist yet.
