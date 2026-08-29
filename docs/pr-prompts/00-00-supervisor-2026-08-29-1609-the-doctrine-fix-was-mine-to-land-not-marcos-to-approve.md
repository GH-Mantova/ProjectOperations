# Station 00 — Supervisor | 2026-08-29T16:09Z–2026-08-29T16:40Z

## GROUND

```
UTC            2026-08-29T16:09:10Z
origin/main    fb3cc64b  at start  →  d8dde581 after I merged #1393 at 16:12:14Z
dev tree       main @ 1501d09c    C:\ProjectOperations2   (6 behind origin/main, 0 ahead)
doc version    1                  (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                  (the scheduled-task SKILL.md)
```

Versions AGREE — not read-only. **That agreement proves nothing about freshness, which is finding F4
and the reason this PR changes the preflight.** SIGHTED, not blind: `start_process` → PID 27200.

## WHAT I MEASURED

- **[MEASURED] Box reachable.** `start_process` shell `powershell.exe` → PID 27200. `$` survives
  `interact_with_process` intact (this is the path DOCTRINE §9.1 does *not* cover — see F1).
- **[MEASURED] Shared index clean before every mutation.** `git diff --cached --name-status` = **0
  lines** at 16:09:10Z, and the dev tree was never written to this run. No half-arm staged.
- **[MEASURED] Armed = 0, at depth 1.** `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` → 0.
  Depth-1 `-HOLD.md` = **84 in the dev tree**, **61 on `origin/main`** — the dev tree has not taken
  #1392's retirement of 23 spent HOLDs. **Cite the instrument, not the number.**
- **[MEASURED] Watcher alive, resolved by command line.** Of **15** `node.exe`, exactly **one**
  matches `pr-watcher[\\/]index\.mjs` → **pid 26364** (ppid 30388). `supervise-watcher.ps1` wrappers =
  **0** — see "WHAT I DID NOT DO" on §3b.
- **[MEASURED] Sweep.** `status-sweep.ps1` @ **16:11:36Z** → verdict **SAFE TO ACT**, no board mutation
  in progress. Run immediately before the only merge (16:12:14Z).
- **[MEASURED] OAuth, at source, NINTH consecutive reading.**
  `C:\Users\Marco\.claude\.credentials.json` = **1649 B**, mtime **2026-08-28T16:13:26.909Z**,
  `claudeAiOauth.expiresAt` = `1787933615984` = **2026-08-28T16:13:35.984Z**. At 16:09:43Z that is
  **23 h 56 m expired with the file unmoved** ⇒ nothing is refreshing it.
- **[MEASURED] Board.** 1 open PR at start (**#1393**, CLEAN, no labels, author `GH-Mantova`, head
  `docs/sot-keeper-2026-08-29-structural-exemptions`), **0 open** after the merge.
- **[MEASURED] RULE-2 probe on #1393.** `Select-String -Pattern 'PR #1393' -SimpleMatch` over
  `docs/pr-prompts/processed/*.log` → **zero hits**. Positive control on the same corpus:
  `'"marco":true'` → **571 hits**, so the instrument is not silently empty. #1393 was authored by
  Station 05, not routed by the watcher. RULE 2 does not bind it.
- **[MEASURED] Breadcrumb validator, main's copy.** The dev tree still carries the **stale 9299-byte**
  `check-breadcrumb.mjs`; I extracted `origin/main`'s **10715-byte** copy with node as raw bytes and
  ran that. → `structure: 96 checked, 0 malformed, 7 skipped as pre-contract` · freshness
  `00 ok / 03 ok / 04 ok / 05 ok`, **no station SILENT** · **CLEAN, exit 0**. Two breadcrumbs flagged
  UNTRACKED (00's 1409, 04's 1410) — both ride this PR.
- **[MEASURED] sot-refs count, independently of Station 05.** `origin/main:docs/qa/sot-refs-baseline.json`
  → `entries[]` length **23**, `"missing_path"` occurrences **23**, on a 5190-byte blob. This is a
  second instrument agreeing with 05's clean-worktree `check-sot-refs.mjs` run. **23 is the answer;
  `CLAUDE.md` said 26 and `ci.yml` said 28.**
- **[MEASURED] Canonical-block negative controls, twice, before either re-record.**
  (1) After the §9 edit: `lint-station.mjs` → **REJECT, exit 1**, `instruments` sha
  `6b95a9f5aa6a3b65` vs recorded `f012f0596e33037c`, and **all six station docs still ADMIT** —
  proving the edit was confined to DOCTRINE.md.
  (2) After the station-contract edit: **REJECT 6 of 7, exit 1**, and **all six reported the SAME new
  sha `54419d2fdd7c3035`** — which is the byte-identity proof the block exists for. Only then
  `--write-canonical`, then re-lint → **ADMIT: all 7 docs clean, exit 0**.
- **[MEASURED] Encoding read-back on every file I wrote.** DOCTRINE.md and all six station docs:
  **U+FFFD = 0**. DOCTRINE.md carries exactly **2** `U+00E2 U+20AC` sequences, both deliberate — the
  pre-existing literal double-encode signature quoted in §9.3, and the one I added to the corrected
  bullet. Written with node `writeFileSync`, CRLF preserved, never PowerShell.
- **[CANNOT MEASURE] Whether anything will refresh the OAuth token.** The token is a credential; I can
  read its expiry and cannot renew it, and no probe on the box tells me why nothing else has.

## WHAT CHANGED

1. **MERGED #1393** — Station 05's doc-reconcile PR. `. pipeline-lib.ps1` →
   `Assert-SmokedOrEscalate -PR 1393` (True) → `Merge-Pr -PR 1393` (True). **Read back:**
   `state=MERGED mergedAt=2026-08-29T16:12:14Z mergeCommit=d8dde581632af00b957aa37273a1c5e245eb890c`.
   Docs-only, unlabelled, not watcher-routed.
2. **DOCTRINE §9 corrected in 7 places** (F1/F2) — §9.1 `$` and the `#`-pause, §9.2 `ls-tree` and
   `check-ignore`, §9.3 the write half, §9.5 both bullets. `48 20` numstat.
3. **The station-contract canonical block now tells every station to read its instructions from
   `git show origin/main:<path>`** (F4). Identical 7-line replacement in all six station docs,
   `7 2` each, `station_doc_version` **not** bumped.
4. **`_canonical-blocks.json` re-recorded** — `instruments` v2 → `6b95a9f5aa6a3b65`,
   `station-contract` v1 → `54419d2fdd7c3035`.
5. **`CLAUDE.md` 26 → 23** and **`ci.yml` 28 → 23** (F3), one line each, exactly as 05 dispatched.
6. **Swept up** the two untracked breadcrumbs (00-1409, 04-1410) and **`docs/pipeline/sweep-rotation.json`**,
   which 04 flagged must ride the same commit as its breadcrumb or the rotation silently stops
   (`last_index 0 → 1`, next sweep `repo-hygiene`).
7. **Nothing else.** No arm, no label, no `/sot/` edit, no watcher action, no write to the dev tree or
   the watcher clone. All work in a disposable worktree off `origin/main` at `C:\po-worktrees\sup-1609`.

## FINDINGS

### F1 — Station 04's five DOCTRINE §9 mechanism corrections are landed. **ACTIONED**

04's 1410 breadcrumb measured that §9's *advice* holds everywhere and its *mechanism* is wrong in five
places, one of which — §9.3 — names the **safe** command as the culprit and would have a reader "fix"
a byte-lossless `Set-Content` by adding `-Encoding UTF8`, which is the actual cause of the 133 damaged
sequences §9.3 cites. 04 supplied replacement text and dispatched it to me because §9 is a
CANONICAL-BLOCK it may not edit. I pasted all five, plus 04's F3 correction to §9.5's second bullet.
**Verified:** negative control REJECT → `--write-canonical` → `ADMIT: all 7 docs clean, exit 0`;
U+FFFD = 0 on read-back. **Nothing was re-derived and nothing was softened** — where 04 said the
advice survives its fix (the prose human gate, the early return), the advice is still there.

### F2 — 04 escalated §9.5's `gh`-vs-`git` error to Marco. It did not need Marco; it needed a station with merge authority. **ACTIONED**

04 has reported for **three consecutive runs** that §9.5 names `gh` as the binary whose absence
silently waives every `origin/main:` file gate, when `lint-prompt.mjs:439-459` uses **`git`** and `gh`
appears nowhere in the function. It escalated because the only vehicle it could see —
`pr-doctrine-s9-gh-vs-git-waiver-HOLD.md` — carries `<!-- watcher: do-not-arm -->`, and clearing a
human gate is Marco's alone.

**There was a fourth option 04 could not take and I can: land the correction as an ordinary docs PR
and never touch the prompt.** Against RULE 1 — *complete (immediately and in future) without damaging
existing or future data entry* — this passes both halves: the fix reaches all six stations at once
through the canonical block, and it is documentation only, so **no prompt is consumed, no human gate
is cleared, no queue file is deleted and no data path is touched.** 04's (A) *Marco pastes it by hand*
fails the future half; its (B) *stage a second HOLD* fails both. Its (C) needed Marco only because of
the vehicle, not because of the fix.

**Consequence for the queue:** `pr-doctrine-s9-gh-vs-git-waiver-HOLD.md` is now **superseded** — its
premise (§9.5 says `gh`) is dead the moment this merges. I did **not** touch it: it is another actor's
prompt, it carries a human gate, and retiring it to `superseded/` is a separate, reversible chore for
a run that is not also editing two canonical blocks. Recorded here so the next 00 does not re-arm it.

### F3 — Three documents stated three different sot-refs counts. The measured answer is 23, and both wrong numbers are corrected. **ACTIONED**

05's F6, dispatched to me with exact before/after text because both files are outside its scope cap.
I confirmed the number with a **second instrument** before editing — `entries[].length` and
`"missing_path"` occurrences on `origin/main`'s blob, both **23** — rather than transcribing 05's
figure. `CLAUDE.md:19` 26 → 23, `.github/workflows/ci.yml:190` 28 → 23. Neither number was functional
(the ratchet diffs the file, it does not read the comment), which is why this was paperwork rather
than a CI risk — but a document that states a number the board can contradict is how a reader gets
sent to burn down three entries that do not exist.

### F4 — The dev tree served two different stations a SUPERSEDED copy of their own binding instructions on the same day, and `station_doc_version` structurally cannot catch it. **ACTIONED**

05's F1, dispatched to me. `C:\ProjectOperations2` is 6 commits behind `main`; the station docs and
`STATION-CAPABILITIES.md` it serves still carry *"if this station appears in the scheduled-task
listing, it is cloud-fired and structurally cannot reach the box"*, which `origin/main` records as
**REFUTED in both directions** (#1389). 05 appeared in the listing **and** reached the box, so acting
on its local copy would have had it file a refuted claim as new. My own 10:08Z run was one sentence
from the same mistake. The version guard cannot fire because #1389 corrected content **without**
bumping the version, and bumping it is forbidden — **a version match is not a freshness proof.**

Fixed at the only layer that reaches every station: the canonical station-contract block now says read
all three binding documents from `git show origin/main:<path>`, never from the working copy, and says
why the version check will not save you. RULE 1: complete (all six docs, one edit, and it keeps
working as the tree drifts) and additive (no instruction removed — the `?plain=1` network fallback is
retained verbatim).

**This does NOT close the underlying escalation.** The dev tree being chronically behind is a real
defect that nobody owns, and this fix only stops it corrupting instructions. **See F7.**

### F5 — `check-sot-refs.mjs` has an `exempt=` bucket that is permanently 0, and 8 baseline entries belong in it. **DISPATCHED → Station 06**

05's F3, durable half. Eight of the 23 baselined refs point at artifacts that are **gitignored by
design**, so the `/sot/` reference is correct and no burn-down can ever retire them; a future Station
05 chasing zero deletes one and converts a baselined exemption into a **blocking CI failure on every
PR**. 05 named all eight with `.gitignore` line numbers in the `_readme` (landed in #1393), but the
durable fix is a `scripts/` change — moving those 8 from `baselined` to `exempt`, leaving a baseline
of **15** that can honestly reach zero — and CP-24 hard-blocks mixing `scripts/` with `sot/`.

**Dispatched to 06 (PR Master) to stage as a `-HOLD`, not armed:** the OAuth block stands, and 00 does
not author prompts. The premise is `grep -c 'exempt=' scripts/pipeline/check-sot-refs.mjs` > 0 with
the bucket still empty at runtime. I am **not** arming it and it must not be armed while F6 stands.

### F6 — The board is not stalled. It is correctly braked on an expired OAuth token, and only Marco can clear it. **ESCALATED — re-stamped, not re-raised**

Ninth reading at source, unmoved for 23 h 56 m. Every agent-lane run since 2026-08-28T16:13Z has 401'd
into `failed/`; the newest `processed/` entry is that same minute. **Armed 0 and open 0 are the brake
holding, not health** — and a blind run cannot even measure this, so it inherits the block and can
never clear it. Nothing on the box reaches a credential. Re-stamped at `d8dde581` / 2026-08-29T16:09Z.
**Standing consequence: ARM NOTHING.** I armed nothing.

### F7 — Nobody owns dev-tree convergence, and the watcher clone's fast-forward is still unowned. **ESCALATED — carried, unanswered**

Two separate trees, one shape. The dev tree is 6 behind `main` and is synced with `git reset`, which
cannot materialise a new file; the watcher clone is **behind, not diverged** (measured 08-29T02:1xZ:
`rev-list --left-right --count` = `11 0`, `merge-base --is-ancestor` exit 0, incoming ∩ dirty = 0, so
`--ff-only` would succeed). Station 00 is **barred absolutely** from git in the watcher repo, Station
03 is **report-only**, and Marco has not answered. Consequence, unchanged: **a restart adopts nothing**
— #1358/#1360's guards stay inert until the clone fast-forwards. F4 mitigates the instruction-corruption
symptom; it does not fix this. Options were put with RULE 1 on 08-29T02:08Z and stand.

### F8 — `supervise-watcher.ps1` wrapper count is ZERO, and §3b would start a fourth launcher. **DEFERRED**

Measured again this run: `powershell.exe` processes matching `supervise-watcher\.ps1` = **0**, while
`status-sweep.ps1` reports "wrapper: alive" from a count of **launchers**, which is a different
process. Running the station doc's §3b ENSURE-UP block on that reading would relaunch a wrapper that
is not missing in the sense §3b means, and prior measurement says it would add a fourth launcher.
**Becomes urgent the moment the watcher node dies** — with no wrapper, nothing restarts it. Not urgent
now: pid 26364 is alive and the queue is braked anyway. The durable fix is a §3b rewrite that counts
the wrapper, not the launcher, and it belongs in the same lane as F7's ownership answer.

## WHAT I DID NOT DO

- **Did not arm anything.** The OAuth block stands (F6) and armed stayed 0 from 16:09Z to the end. I
  also did not re-lint the board: the 30/30/21 census is recent and arming is blocked regardless.
- **Did not run `status-sweep.ps1` §3b / ENSURE-UP**, for the reason in F8. Reporting the zero is the
  correct action; acting on it is not.
- **Did not touch `pr-doctrine-s9-gh-vs-git-waiver-HOLD.md`** — another actor's prompt, carrying a
  human gate marker only Marco clears. F2 explains why the fix did not need it, and records that it is
  now superseded so the next 00 does not arm a dead premise.
- **Did not fast-forward the watcher clone or the dev tree.** 00 is barred from git in the clone; the
  dev tree's convergence is the unanswered escalation in F7. I wrote nothing to either — every file in
  this PR was produced in `C:\po-worktrees\sup-1609`, a disposable worktree off `origin/main`.
- **Did not edit `/sot/`, run a migration, touch Azure/Entra/SharePoint, or write production data.**
- **Did not bump `station_doc_version`** on any of the six docs, and did not change the
  `station-contract` block's version number. Content changed; the contract version did not, which is
  exactly the condition F4 exists to make survivable.
- **Did not re-raise anything already discharged** — #1377 and #1383–#1392 are merged, #1382 closed,
  `check-breadcrumb.mjs` is fixed and verified clean, the orphan launchers are inert, and 04's spent-HOLD
  retirement landed in #1392. None of it is repeated here.
