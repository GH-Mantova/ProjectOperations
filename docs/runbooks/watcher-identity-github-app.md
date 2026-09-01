# Runbook — a distinguishable identity for the watcher (option B)

**Written 2026-09-01 by Station 06 (PR Master). Measured against `origin/main` `755255ab`.**

Option (B) from Station 00's 2026-08-31 06:09Z escalation: *"Give the watcher its own GitHub App or
machine account so `LABELED by watcher` and `UNLABELED by Marco` are distinguishable."*

Most of this is Marco's. The code is small and comes last.

---

## Why it is needed - measured, not assumed

```
gh api users/GH-Mantova              ->  User  GH-Mantova          [MEASURED]
gh auth status                       ->  Logged in ... (keyring)
                                         Token: gho_****
                                         scopes: gist, read:org, repo, workflow   [MEASURED]
grep -n 'GH_TOKEN|GITHUB_TOKEN' scripts/pr-watcher/index.mjs  ->  no matches      [MEASURED]
```

The watcher carries **no credential of its own**. It shells out to `gh`, which reads the Windows
keyring and authenticates as `GH-Mantova`. So does Station 00. So does Station 06 through Desktop
Commander. So does Marco at his own terminal.

**One OAuth token, one identity, four actors.** That is why
`LABELED 'do-not-merge' by GH-Mantova` followed by `UNLABELED 'do-not-merge' by GH-Mantova`
cannot be attributed, and why the 2026-08-31 F2 escalation had to be answered by asking Marco.

## Read this limit before deciding it is worth doing

**This runbook separates the WATCHER from Marco. It does not separate the stations from Marco.**

Station 00 and Station 06 run as agents through Desktop Commander on Marco's box, using the same
ambient `gh` auth. After this change:

| actor | appears in the audit trail as |
|---|---|
| the watcher | `projectops-watcher[bot]` |
| Station 00 | `GH-Mantova` |
| Station 06 | `GH-Mantova` |
| Marco | `GH-Mantova` |

So `#1457` - auto-merge armed on a `marco:true` PR by an unidentified actor - would **still** be
unattributable after this work, because the watcher was not the suspect. Giving every station its
own identity is a materially larger project and is NOT scoped here.

What this does fix, completely: every label the watcher applies or removes, every PR it opens, every
merge it performs, becomes distinguishable from a human action at a glance. That is the single
highest-volume source of ambiguity on this board.

---

# PART 1 - Marco only. No agent can do any of this.

### 1. Create the GitHub App

`github.com` -> your avatar -> **Settings** -> **Developer settings** -> **GitHub Apps** ->
**New GitHub App**

| Field | Value |
|---|---|
| GitHub App name | `projectops-watcher` (renders as `projectops-watcher[bot]`) |
| Homepage URL | `https://github.com/GH-Mantova/ProjectOperations` |
| Webhook -> Active | **UNCHECK.** The watcher polls; it needs no webhook. |
| Where can this be installed | **Only on this account** |

**Repository permissions** - grant exactly these, nothing more:

| Permission | Level | Why |
|---|---|---|
| Metadata | Read | mandatory, granted automatically |
| Contents | Read and write | push branches, read files |
| Pull requests | Read and write | open, comment, merge |
| Issues | Read and write | **labels live on the issues API**, not the PR API |
| Actions | Read | read job logs when a check fails |
| Checks | Read | read check-run conclusions |

Do **not** grant Administration - the ruleset must stay outside the watcher's reach.

### 2. Generate the private key

On the App's page -> **Private keys** -> **Generate a private key**. A `.pem` downloads.
**Record the App ID** from the top of that page.

### 3. Install it on the repo

App page -> **Install App** -> your account -> **Only select repositories** -> `ProjectOperations`.

After installing, the URL of the settings page ends in the **Installation ID** - record it.

### 4. Put the key somewhere that is not a git repo

```
C:\po-secrets\projectops-watcher.pem
```

**Not** under `C:\po-watcher\` and **not** under `C:\ProjectOperations2\` - both are working trees,
and a key committed once is a key rotated forever. Create `C:\po-secrets\` fresh.

### 5. Verify before handing over

```powershell
gh api /repos/GH-Mantova/ProjectOperations/installation --jq '.id, .app_slug'
```

Should print your Installation ID and `projectops-watcher`. If it 404s, the App is not installed on
the repo and nothing downstream will work.

**Hand over:** App ID, Installation ID, and the path to the `.pem`. Not the key contents.

---

# PART 2 - The code change (a prompt, staged `-HOLD` until Part 1 is done)

Gated on a marker file only Marco can land, using the convention already in
`docs/approvals/README.md`:

```yaml
requires_file_on_main: docs/approvals/watcher-identity-approved-by-marco.md
```

That marker states the App ID and Installation ID (**not** the key), so the gate cannot open until
the identity actually exists.

### What it builds

1. **Mint an App JWT** - RS256 over `{iat, exp, iss: <App ID>}`, `exp` at most 10 minutes out.
2. **Exchange for an installation token** - `POST /app/installations/<id>/access_tokens`.
3. **Cache it.** Installation tokens expire after **one hour**. Refresh at ~50 minutes, not on
   expiry, and never per-call.
4. **Inject it** - set `GH_TOKEN` in the environment of every `gh` invocation the watcher makes.
   `GH_TOKEN` takes precedence over the keyring, so nothing else on the box changes.

### The one design decision that matters

**It must fail CLOSED.**

If minting fails - key rotated, clock skew, GitHub 500 - the watcher must log loudly and **stop
labelling and merging**. It must NOT fall back to ambient keyring auth. A silent fallback puts the
identity back to `GH-Mantova` exactly when something is already wrong, and the audit trail goes back
to being unreadable at the precise moment you most need to read it. Write that as a test.

### What becomes possible afterwards

CP-26 and the approval-receipt check (option A, armed 2026-09-01T09:07Z) can then assert the
**actor**, not just the presence of a label:

```
LABELED   'do-not-merge'  by projectops-watcher[bot]     <- the machine gated it
UNLABELED 'do-not-merge'  by GH-Mantova                  <- a human released it
```

A label removed by `projectops-watcher[bot]` becomes a provable defect rather than a question.

---

# PART 3 - Rollback

Unset `GH_TOKEN` in the watcher's environment and restart it; it returns to ambient keyring auth
immediately. Uninstalling the App revokes every installation token within the hour. No repo content,
no branch and no PR is affected either way.

# PART 4 - The standing costs, stated plainly

- **A private key lives on that laptop, forever.** Its blast radius is the repo permissions above.
- **A refresh path that can fail at 3am.** Fail-closed makes that a stopped watcher rather than a
  silent identity swap - the right trade, and still an outage.
- **Key rotation is manual.** Nothing here reminds you. If that matters, it wants its own scheduled
  task.
- **It does not close the forgery hole.** Anyone holding the `.pem` can act as the bot. Option (A)
  makes an approval visible; (B) makes the actor meaningful; neither makes forgery impossible.

# PART 5 - Sequencing

Do Part 1 whenever it suits. Do **not** stage Part 2 until option (A) has landed and its receipt
format is settled - B's whole value is making A's receipts attributable, and a B written against a
receipt shape that then changes gets rewritten.
