---
premise: '! grep -q "WATCHER_APP_AUTH_V1" scripts/pr-watcher/index.mjs'
premise_means: >-
  The watcher carries no credential of its own. It shells out to `gh`, which reads the Windows
  keyring and authenticates as GH-Mantova - and so do Station 00, Station 06 and Marco at his own
  terminal. One OAuth token, one identity, four actors. Every label the watcher applies and every
  merge it performs is indistinguishable in the audit trail from a human doing the same thing, which
  is why `LABELED do-not-merge by GH-Mantova` followed by `UNLABELED by GH-Mantova` has had to be
  resolved eight times by asking Marco what he did.
scope:
  - scripts/pr-watcher/app-auth.mjs
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/app-auth.test.mjs
  - docs/runbooks/watcher-identity-github-app.md
done_when: pnpm test --filter watcher && grep -q "WATCHER_APP_AUTH_V1" scripts/pr-watcher/index.mjs
size: 7
gate_allow: none
seed_only: false
escalates: true
backfill: false
requires_file_on_main: docs/approvals/watcher-identity-approved-by-marco.md
rollback_strategy: >-
  Unset PO_WATCHER_APP_KEY (or delete the .pem) and restart the watcher; it returns to ambient
  keyring auth on the next tick. No repo content, no branch, no PR and no label is affected either
  way. Uninstalling the GitHub App revokes every outstanding installation token within the hour.
---

# Give the watcher its own identity (option B, part 2)

Part 1 is DONE and its evidence is on main at
`docs/approvals/watcher-identity-approved-by-marco.md`. The App exists and works:

| | |
|---|---|
| App slug | `projectops-watcher` (renders as `projectops-watcher[bot]`) |
| App ID | `4798698` |
| Installation ID | `158348768` |
| Installed on | `GH-Mantova/ProjectOperations` only, `repository_selection: selected` |

**The mechanism is already proven end-to-end.** On 2026-09-02 a throwaway probe minted an App JWT
from the `.pem`, called `GET /app`, `GET /app/installations`, exchanged for an installation token
(`201`) and listed `GH-Mantova/ProjectOperations` through it. Token TTL measured at one hour. You
are not prototyping; you are productionising a path that has been shown to work.

Background and the standing costs: `docs/runbooks/watcher-identity-github-app.md`.

## What to build

### 1. `scripts/pr-watcher/app-auth.mjs` - a pure-ish module, Node built-ins only

- `mintAppJwt(appId, pem, now)` - RS256 over `{ iat: now - 60, exp: now + 540, iss: appId }`,
  base64url, signed with `crypto.createSign("RSA-SHA256")`. `exp` must never exceed 10 minutes;
  GitHub rejects it and the 60-second backdate absorbs clock skew.
- `fetchInstallationToken(jwt, installationId)` - `POST /app/installations/<id>/access_tokens`,
  returns `{ token, expiresAt }`.
- `getToken({ now })` - the cache. Installation tokens last **one hour**. Refresh at **50 minutes**,
  never per-call and never on expiry. Take `now` as a parameter so the tests can drive the clock
  without sleeping.

Configuration comes from the environment, never from a literal in the file:
`PO_WATCHER_APP_ID`, `PO_WATCHER_INSTALLATION_ID`, `PO_WATCHER_APP_KEY` (the path to the `.pem`).
The key lives at `C:\po-secrets\` and **must never be read from, or written to, any working tree**.

### 2. Wire it into `index.mjs`

Set `GH_TOKEN` in the environment of every `gh` invocation the watcher makes. `GH_TOKEN` takes
precedence over the keyring, so nothing else on the box changes - Marco's own terminal, Station 00
and Station 06 all keep working exactly as they do now. Plant `WATCHER_APP_AUTH_V1` here.

### 3. It must fail CLOSED. This is the whole design, not a nicety.

If minting fails for any reason - key rotated, clock skew, GitHub 5xx, App uninstalled - the watcher
logs loudly and **stops labelling and merging**. It does **not** fall back to ambient keyring auth.

A silent fallback puts the identity back to `GH-Mantova` at exactly the moment something is already
wrong, so the audit trail becomes unreadable precisely when you most need to read it. **Write that
as a test**: mock a minting failure and assert that no `gh` call carrying a mutation is attempted.

### 4. Never log the token or the key

Not at debug level, not in an error path, not in a stack trace. Redact to `gh[installation]` in any
diagnostic line.

## What this does NOT fix - state it in the PR body

This separates the **watcher** from Marco. It does **not** separate the **stations** from Marco:
Station 00 and Station 06 run through Desktop Commander on the same ambient auth and will still
appear as `GH-Mantova`. So #1457 - auto-merge armed on a `marco:true` PR by an unidentified actor -
would still be unattributable after this lands. Giving each station its own identity is a larger
piece of work and is deliberately out of scope here.

What it does fix completely: every label the watcher applies or removes, every PR it opens and every
merge it performs becomes distinguishable from a human action at a glance. That is the single
highest-volume source of ambiguity on this board.

## Verification

1. Start the watcher with `PO_WATCHER_APP_KEY` set. Its next label or comment on a PR must show
   `projectops-watcher[bot]`, not `GH-Mantova`. Screenshot it into the PR body.
2. Move the `.pem` aside and restart. The watcher must log the failure and perform **no** mutation.
   Restore it and confirm recovery.

You have STANDING AUTHORITY to finish the work, commit, push and open the PR.
