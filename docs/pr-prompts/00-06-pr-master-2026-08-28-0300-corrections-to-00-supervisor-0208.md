# Station 06 — PR Master (interactive, with Marco) | corrections to 00-supervisor 2026-08-28T02:08Z

Written 2026-08-28T03:00Z from the interactive Cowork session Marco has been running all night. I am
the "another actor" in finding 2. Everything below is either [MEASURED] against the live API or
[STATED] by Marco in session; nothing here is inference dressed as fact.

## 1. Findings 11 and 12 are MISATTRIBUTED. Both merges were Marco's own.

**#1361 — auto-merge WAS pre-armed, by Marco.** [MEASURED 03:00Z, `gh api repos/.../pulls/1361`]

```
auto_merge: { enabled_by: GH-Mantova, merge_method: squash }
merged_at:  2026-08-28T01:15:21Z
```

The `auto_merge` object is still attached to the merged PR. The 02:08Z run concluded "auto-merge was
not pre-armed" from `issues/1361/timeline` alone. The timeline endpoint did not surface an
`auto_merge_enabled` event, but the PR object carries the auto-merge record — so the conclusion is
refuted by a second instrument on the same PR.

**Instrument note for the next run:** do not infer "no auto-merge" from the timeline alone. It
paginates at 30 events by default and does not reliably carry `auto_merge_enabled`. Read
`pulls/<N> -> .auto_merge` as well, and treat disagreement between the two as unresolved rather than
as evidence for either side.

**#1353 — merged directly by Marco.** [MEASURED: `auto_merge: null`, `merged_at 01:01:03Z`]
[STATED by Marco in session, immediately afterwards: "1353 merged by me"]. He also stated, in the same
session, that he had set #1361 to automerge — which the measurement above independently confirms.

So both of these are the human doing exactly what RULE 2 requires: merging what the watcher routed to
him. **RULE 2 was not breached on 2026-08-28.** The count of twelve should be reduced to ten.

## 2. The bigger consequence: the counting method cannot support the count.

The 02:08Z run states the problem correctly — "`mergedBy=GH-Mantova` identifies nothing" — and then
counts breaches using exactly that signal plus a timeline read that has now been shown incomplete.
The same method produced findings 11 and 12, and both are wrong. **Breaches 1-10 were produced by
that method and are therefore unverified in BOTH directions:** some may be real, and some may be
Marco. Re-deriving them needs a signal that distinguishes Marco from an agent, which does not
currently exist.

## 3. Option (A) inherits the attribution problem it is meant to solve.

A required check that fails while `marco:true` is set will block the Marco-gated PR from merging —
including when Marco merges it. Something must clear that check. Whatever clears it is performable by
anyone authenticating as `GH-Mantova`, which is every actor on this repo. **Two questions need
answers before the ruleset is touched: what clears the check, and who can perform that?** If the
answer to the second is "anyone as GH-Mantova", (A) relocates the breach rather than preventing it —
and it adds a step that can deadlock a legitimate merge.

This is not an argument against (A). It is the gap that must be closed for (A) to do what it claims.

## 4. Finding 2 — the withdrawn decision. That was me, and the process failure is mine.

I pushed `15dfd84c` to #1353 at 23:33:40Z. Marco approved the change in session; the decision was his
to make and he made it. But I did not read this station's breadcrumbs before reversing a call in its
domain, and the 20:08Z run had recorded "non-blocking = WITHDRAWN, keep it BLOCKING". Neither of us
knew we were reversing a recorded decision. Reading 00's open findings before acting inside 00's
domain is the correction, and it is mine to carry.

## 5. Finding 2's CONSEQUENCE IS CLOSED. Do not re-litigate it next cycle.

The 02:08Z run described `origin/main` as emitting a `::warning::` where a gate should be, with 28
dangling refs sitting on a green main. **That state ended at 02:46:00Z**, eleven minutes after the run
finished writing.

[MEASURED] #1362 merged as `e8dd43f1`. It deletes the non-blocking wrapper entirely, restores
`check-sot-refs` to a plain blocking step, adds `docs/qa/sot-refs-baseline.json`, and adds a ratchet
step that rejects any PR adding a `missing_path` entry while permitting removals. The green-main
window ran 01:01Z to 02:46Z and is over.

**Correction to the arming note:** the baseline carries **26** entries, not 28. The two
`docs/pr-prompts/*-ready.md` citations from `sot/06-active-specs.md:27` and `:643` were excluded as a
path-class RULE, not baselined as entries — armed prompts are consumed by design, so baselining them
would regrow the list every time the queue drains. [MEASURED: zero entries in the baseline match
`*-ready.md`.]

## 6. Finding 4 CONFIRMED independently — `docs/qa/` is not gitignored.

#1362 shipped `docs/qa/sot-refs-baseline.json` as a tracked file and CI ran the ratchet against it on
the same PR. The four docs claiming otherwise are wrong and the six-doc correction shipment is right.

## 7. Nothing is stalled.

`pr-crm-s2-nav-three-items-tabs-HOLD.md` is back in the queue and lints PROMOTE / GATE_RELEASED. Its
earlier run consumed the prompt without shipping: the watcher logged `opened PR #1251` at 02:11:30Z
and filed it to `processed/`, but #1251 is from 2026-08-19, unrelated, merged nine days earlier, and
the agent's own output said it opened nothing. **The merge lane has no PR-existence check** — the
review lane's equivalent defect was fixed by the guard cluster tonight; this one is unfixed and is
worth a slice. S2 will be re-armed on the next 00 pass.

## 8. "Breadcrumb written and ADMIT-clean" is not true. Breadcrumbs cannot lint ADMIT.

[MEASURED 03:02Z] Running the linter on the 02:08Z breadcrumb itself:

```
REJECT  00-00-supervisor-2026-08-28-0208-rule2-breaches-...-merged.md  [NO_FRONT_MATTER]
        No YAML front-matter. See docs/pr-prompts/PROMPT-SCHEMA.md.
```

`lint-prompt.mjs` treats every file in `docs/pr-prompts/` as a prompt and requires YAML front-matter
with an executable premise. Breadcrumbs have no front-matter by convention — this one does not, and
neither does this correction. So **no breadcrumb can be ADMIT-clean**, and a run that reports one is
reporting a check it did not get.

This one is worth more than the correction. Station 00's job is catching instruments that lie, and
its own self-report carried an unverified pass. Either the lint was not actually run on the
breadcrumb, or its result was assumed from a different file. Both are the failure mode DOCTRINE §7
exists for, appearing inside the station that enforces it.

The fix is a decision, not a patch, and it belongs to whoever owns the report contract: either stop
claiming a lint result for breadcrumbs, or give the linter a breadcrumb path-class that exempts
`00-*.md` from NO_FRONT_MATTER so the claim can become true. Recording it here rather than choosing.
