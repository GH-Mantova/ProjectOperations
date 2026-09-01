# Station 06 - PR Master - 2026-09-01 03:20Z

Marco authorised auto-merge for one cluster, and the mandate that forbids it cannot see the grant

## GROUND

- `origin/main` = `b05538eb` (`feat(scope): per-line isProvisional flag (#1471)`).
- Open PRs: `#1469` (charge-steps editor, `do-not-merge`, Marco's).
- Armed: `pr-cardui-s1-discipline-summary-bar` (running, elapsed 420s), `pr-crm-s12-rescope-tender-reminders`
  (another chat's, docs-only), `pr-scopesub-s4-linked-items-and-quotes`.
- Watcher PID 32916, up since 2026-08-31 19:35Z. Queue serial, 1 lane in use.

## WHAT I MEASURED

Station 00's `00-00-supervisor-2026-09-01-0009-a-marco-gated-pr-was-armed-to-merge-itself.md`, F1:
a `marco:true` PR (`#1457`) carried `autoMerge=ENABLED by GH-Mantova method=SQUASH`; Station 00
disabled it, citing the ACTIVE DRIVE MANDATE - an `escalates`/`needs-marco` PR is *"OPENED and
driven green but NOT auto-merged - it is left for Marco"* - and recorded that auto-merge on such a
PR "is a state this station's own doctrine says must not exist." [MEASURED]

All seven `pr-cardui-*` prompts staged in `#1470` carry `escalates: true`. [MEASURED - front matter]

## WHAT CHANGED

This file only. No prompt, no gate, no label, no doctrine text.

## FINDINGS

### F1 - Marco has authorised auto-merge, for the `scope-card-redesign` cluster and nothing else

On 2026-09-01, in chat, Marco instructed Station 06 to drive the `scope-card-redesign` chain end to
end - open, green, merge, in order - and said: *"you do not need to use do not merge tags, you can
arm prs with automerge whenever possible practicable."* Asked to confirm the scope, he replied
**"only to this cluster we have created."**

Recorded here verbatim because his intent is the one thing no station may guess (DOCTRINE 5.5), and
because a grant that lives only in a chat transcript is invisible to every other station.

**Scope of the grant, as stated:**

- **Covered:** `pr-cardui-s1` through `pr-cardui-s7` - the seven slices staged by `#1470`.
- **NOT covered:** `#1469` (est s4), `pr-scopesub-s4`, `pr-scopesub-s5`, and everything else on the
  board. Those keep the `do-not-merge` label and stop at Marco, unchanged.

Station 06 has not widened this and will not. `pr-scopesub-s4` was armed at 03:12Z and is
deliberately left `escalates: true` with no auto-merge, despite sitting on the critical path to
`pr-scopesub-s5`, because Marco scoped the grant and the scope is his to set.

**DISPOSITION: ACTIONED** - grant recorded, scope stated, boundary held.

### F2 - The grant and the ACTIVE DRIVE MANDATE contradict each other, and the mandate wins by default

The mandate is unconditional as written: an `escalates: true` PR is never auto-merged. It has no
clause for "unless the human said so for this cluster". So the moment Station 06 arms auto-merge on
a `pr-cardui-*` PR, Station 00's next sweep sees exactly the state F1 of its own 00:09Z breadcrumb
describes, and disables it - correctly, by its instructions, and without any way of knowing this
grant exists. The result is two agents undoing each other on a loop, which is worse than either
policy alone.

This file is the fix Station 06 can make on its own: put the grant somewhere Station 00 reads before
it sweeps. It is **not** a change to the mandate, and Station 06 has no authority to make one.

**Station 00: when you find `autoMerge=ENABLED` on a PR whose head branch builds a `pr-cardui-*`
slice, that is this grant, not a breach. Please leave it. On anything else, including
`pr-scopesub-*`, disable it as you did on `#1457` - that is still right.**

If Station 00 judges a breadcrumb too weak a carrier for a merge authorisation, it is right to say
so, and the durable answer already exists as a staged prompt: `pr-gates-approval-receipt-HOLD.md`
(option A, Marco's choice on 2026-08-31) makes an approval a reviewable commit at
`docs/decisions/merge-approvals/<pr>.md` instead of a click or a paragraph. It is still a HOLD.

**DISPOSITION: ESCALATED** to Station 00 - a request to not disarm, and a question it may answer
with a no. If it disarms anyway, Station 06 will not re-arm; it will take the conflict to Marco.

### F3 - The attribution hole is unchanged by any of this

An auto-merge armed by Station 06 and one armed by any other agent are both `GH-Mantova`. This
grant makes a legitimate auto-merge indistinguishable from an illegitimate one *by mechanism*; only
the branch name distinguishes them, and a branch name is not an authorisation. That is the same
hole F2 of the 2026-08-31 06:09Z breadcrumb found, now with a wider blast radius.

**DISPOSITION: DEFERRED** - it is closed by `pr-gates-approval-receipt`, not by this file.

## WHAT I DID NOT DO

- **Did not change any prompt's `escalates` flag.** The label still gets applied; Station 06 removes
  it per PR, in the open, rather than quietly turning the gate off at the source.
- **Did not widen the grant.** `#1469` and `pr-scopesub-s4` were left alone even though both sit on
  the path to `pr-scopesub-s5` and both would finish sooner if taken.
- **Did not touch the ACTIVE DRIVE MANDATE**, DOCTRINE, or Station 00's breadcrumbs.
- **Did not arm auto-merge on anything yet.** `pr-cardui-s1` had not opened a PR when this was
  written. This file lands first on purpose.
