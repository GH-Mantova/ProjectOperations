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

---

## ADDENDUM 2026-09-14T11:1xZ — ITEM 1 gains a SIXTH paste, in a different file

**Added by** Station 00 (scheduled, 2026-09-14T11:08Z run), at `origin/main daec3f2b`.
**Source finding:** Station 04, `docs/pr-prompts/00-04-scanner-2026-09-14-1010-the-task-store-reverted-a-verified-write-and-a-sixth-rotten-citation-sits-in-05s-bootstrap.md`, F1 — DISPATCHED to 00, which owns this file.

ITEM 1 above is still **entirely unactioned**: [MEASURED 2026-09-14] all five bootstraps still carry
the `.gitignore:107-111` sentence and all five still have mtime `2026-09-01T00:07:44Z`.

**What is new** is a sixth rotten citation of the same class, which the ITEM 1 paste will NOT touch
because it is in a different file and a different sentence. `C:\Users\Marco\Claude\Scheduled\05-sot-keeper\SKILL.md`
line 63 reads, verbatim:

```
CP-24 is a hard block: a PR mixing `sot/` with `scripts/` or `apps/` fails (`pr-gates.mjs:327`). `sot/` plus `docs/` is allowed. Split before you open, not after CI tells you.
```

[MEASURED 2026-09-14T11:1xZ, independently of 04] line **327** of
`scripts/pr-gates/pr-gates.mjs` on `origin/main daec3f2b` is a bare `{`. The real anchor is
`const sotRe = /^sot\//;`. Negative control: a needle minted this run, `zzKt9r3Bq8Xm`, returns 0
occurrences in the same bootstrap, so the search is not matching everything.

### The sixth paste

In `05-sot-keeper\SKILL.md` line 63, replace:

```
(`pr-gates.mjs:327`)
```

with:

```
(anchor: `const sotRe = /^sot\//` in scripts/pr-gates/pr-gates.mjs)
```

Same principle as the five above — **an anchor, not a number** — so the next insertion into
`pr-gates.mjs` cannot re-rot it.

### Why this one matters slightly more than the five

A station that checks the citation finds a brace, and the available conclusion is *"CP-24 is not
where this says it is"* — about the single gate that stops `sot/` work being mixed with code. The
repo-side `docs/pipeline/stations/05-sot-keeper.md` already carries the anchor form correctly, so the
anchor conversion **stopped at the repo boundary** and the layer that actually governs a scheduled
run kept the number.

### It also strengthens ITEM 2

ITEM 2's argument was "this class has recurred twice". It is now *"recurred twice, and has a live
instance that ITEM 1's own value-query could not see"* — 04's 09-06 scan searched the class
`\.gitignore:\d+`, and this member is a different file entirely. A CI check that validates every
`<file>:<N>` citation against the token its sentence claims is the only thing that enumerates the
class rather than its known members.

### Nothing here is urgent and nothing is irreversible

One more text paste, in a file that is outside the repo, outside CI and versioned by nothing — which
is exactly why Station 00 is asking rather than writing it (`STATION-CAPABILITIES.md` §1, and RULE 1
option 2 above, unchanged).


---

## ADDENDUM 2026-09-15T02:45Z — Station 00 (scheduled), at `19d6d827`: PIN ITEM 2's REGEX BEFORE THE CHECK IS BUILT

ITEM 2 of this file asks for a `lint-station.mjs` check that validates every `<file>:<N>` citation
against the token its sentence claims. **Built the obvious way — keyed on a file EXTENSION — that
check is born blind to `.gitignore:<N>`, which is the entire class that motivated this escalation.**

[MEASURED] 2026-09-15T02:1xZ by Station 04 at `25db3c36`, two regex forms over the same nine files
(the five scheduled-task bootstraps plus four binding documents):

| form | citations found |
|---|---|
| extension-keyed | **6** |
| dotfile-tolerant | **17** |
| **invisible to the extension-keyed form** | **11** |

Four of the eleven are inside the binding documents, not the bootstraps: `STATION-CAPABILITIES.md`
carries `.gitignore:28`, `stations/05-sot-keeper.md` carries `.gitignore:76-83` and `.gitignore:75`,
`stations/04-scanner.md` carries `.gitignore:76-83`. NEGATIVE control, a freshly minted needle across
four of those files -> 0. POSITIVE control, `.gitignore:<N>` present -> 4 of 4. All four resolve
correctly today; they are live citations of the class that has already rotted twice.

**The form the check must use, now also written into DOCTRINE section 9.5 where CI can see it:**

```
(^|[\s(`"'])(\.?[A-Za-z0-9_.\-/]+):(\d+(?:-\d+)?)\b
```

The leading `\.?` is the load-bearing part: a citation's file part may begin with a dot and carry no
extension at all.

⚠️ **ITEM 2's own words already record the cousin of this failure** — *"the value query cannot
enumerate the class"*. This is the same mistake one level up, in the CLASS query itself, and it would
have shipped inside the fix rather than being found by it.

**Nothing in ITEM 1 or ITEM 2 is withdrawn.** The ask is unchanged; this addendum only fixes the
specification so the check, when Marco approves it, is not born unable to see its own subject.
Reported in full in
`docs/pr-prompts/00-00-supervisor-2026-09-15-0240-addendum-the-citation-probe-is-blind-to-dotfiles-and-the-security-audit-task-is-off.md`
finding 2, because this folder is gitignored and reaches nobody on its own.

---

## ADDENDUM 2026-09-22T05:5xZ — ITEM 2's CHECK IS SUPPRESSED BY `lint-station.mjs`'s OWN GUARD, AND ITS CORPUS CANNOT SEE ITEM 1

Landed by scheduled Station 00 at `cf8c87ac`, collecting Station 04's 2026-09-22T02:11Z breadcrumb
(`00-04-scanner-2026-09-22-0211-lint-stations-own-neargitignore-guard-suppresses-all-thirty-gitignore-citations-the-item-2-check-would-validate.md`,
findings F1 and F2), which lands in the same PR and carries the full measurements, controls and
falsifying probes. **This addendum is the summary; that breadcrumb is the evidence.**

**The 2026-09-15 addendum above pins ITEM 2's regex so the check is not born blind. It is born blind
anyway, and the regex is not the reason.**

`lint-station.mjs` **already collects citations**, at anchor `function repoPathsIn` — the second
`for (const m of text.matchAll(` in that function. Both the existing collector and any replacement
built at that anchor are filtered by `const nearGitignore`:

```js
const nearGitignore = (t, i) => /gitignor/i.test(t.slice(Math.max(0, i - 240), i + 240));
```

🔴 **The window `[i-240, i+240]` contains the match itself, and the literal text `.gitignore:107-111`
contains `gitignor` at offset 1 — so the guard is self-satisfying on exactly the class it must not
suppress.** [MEASURED] 2026-09-22T02:1xZ at `3f8c51f7`, lint-station's own two predicates applied
verbatim to the 14-file corpus:

| instrument | matched | survived `nearGitignore` |
|---|---|---|
| the **shipped** collector (`repoPathsIn`, second `matchAll`) | 0 | 0 |
| ITEM 2's **pinned** regex (the 2026-09-15 guarded form) | 47 | 14 |
| …of which the `.gitignore:<N>` class | **30** | 🔴 **0** |

Mechanism proof, two calls anyone can re-run: `nearGitignore('.gitignore:115', 0)` → **true**;
`nearGitignore('docs/x.md:42', 0)` → **false**. The guard's stated intent (*"a path named inside an
explicit gitignore warning is NOT a claim that the file exists"*) is **correct for path EXISTENCE and
wrong for LINE-NUMBER validity** — a `.gitignore` line citation is a claim about `.gitignore`, which
is tracked and always present.

🔴 **The shipped collector also discards the line number**, adding only the file part to `found`. So
ITEM 2 is not *"build a check"*; it is **"make the existing collector assert the cited line, and
exempt the `.gitignore` class from `nearGitignore`"** — a smaller and differently-shaped change than
this escalation currently describes.

🔴 **And ITEM 2's gate can never reach ITEM 1.** `lint-station.mjs`'s targets are
`[DOCTRINE, ...stationDocs()]`, and `stationDocs()` reads `STATION_DIR` only —
`C:\Users\Marco\Claude\Scheduled` appears in that file once, in the known-folder-map allowlist, never
as a lint target. **The four rotten bootstrap pastes live in a layer the gate cannot see**, even once
the suppression is fixed.

**RULE 1 options, complete-and-additive first:**

- **(A) — complete and additive.** In `repoPathsIn`, split the two concerns: keep `nearGitignore` on
  the *existence* pass, and in a separate *citation* pass assert the cited line exists **and** carries
  expected content, with **no** `nearGitignore` exemption. Run that pass over the corpus as the RULE
  states it — every `SKILL.md` behind an ENABLED task (read from the scheduled-tasks MCP), plus the
  seven station docs, plus `DOCTRINE.md`, `STATION-CAPABILITIES.md` and `CLAUDE.md`. Solves it
  immediately (the 30 suppressed citations become visible) and in future (a new citation class is
  caught, and ITEM 1's layer is in scope). Damages no data entry — it is a linter warning path.
- **(B) — fails the *completely* half.** Fix only the regex, as the 2026-09-15 addendum currently
  prescribes. The widened regex matches all 30 and `nearGitignore` discards all 30, so the gate ships
  green and the class stays unprotected. **This is the option this escalation as written produces.**
- **(C) — fails the *future* half.** Hand-correct the four rotten pastes (ITEM 1) and build no check.
  Fixes today's instances; the class recurs, as it has twice.

⚠️ **`IN RANGE` is not `RESOLVES`, and any check built on range alone certifies this class as
healthy.** 04's first pass printed `IN RANGE` for all four bootstrap citations — `.gitignore:107-111`
is within a 151-line file — and the available write-up was *"the bootstrap citations resolve"*, the
exact polarity that retires a live escalation. It was caught only by asking what line 107 **says**.

⚠️ **ITEM 1 status at 2026-09-22: still entirely unactioned, day 16.** All four ENABLED bootstraps
carry `.gitignore:107-111`; the five QA sinks are at **115–119**, under the
`# Overnight-QA scheduled task` comment at 113 — off by exactly eight. The repair
(`scripts/pipeline/lint-station.mjs`) is `scripts/`, outside both Station 04's read-only lane and
Station 00's recorded `docs/` lane, and the bootstraps are the one layer no agent can edit. **Both
halves are yours.**
