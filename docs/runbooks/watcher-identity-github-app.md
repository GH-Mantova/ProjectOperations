# Runbook — a distinguishable identity for the watcher (option B)

**Written 2026-09-01 by Station 06 (PR Master). Measured against `origin/main` `755255ab`.**

Option (B) from Station 00's 2026-08-31 06:09Z escalation: *"Give the watcher its own GitHub App or
machine account so `LABELED by watcher` and `UNLABELED by Marco` are distinguishable."*

Most of this is Marco's. The code is small and comes last.

---

## STATUS - where this stands today

**Updated 2026-09-07 by Station 06 (PR Master).**

| Stage | State |
|---|---|
| PART 1 - the App exists, is installed, key generated and stored off-tree | **DONE.** App ID, Installation ID and the `.pem` path are recorded in `docs/approvals/watcher-identity-approved-by-marco.md` (2026-09-01). |
| PART 2 - the minting code | **MERGED** (PR #1510): `scripts/pr-watcher/app-auth.mjs` plus the wiring in `index.mjs`. |
| PART 2.5 - the launcher reads the three variables | **MERGED** (this PR): `scripts/pr-watcher/start-watcher.ps1`. |
| **The switch itself** | **STILL OFF.** Nothing sets the three variables on the machine. See "5. Switch it on" below - that step is Marco's and nobody else can do it. |

Until Marco does step 5, the watcher runs exactly as it always has, as ambient
`GH-Mantova`. That is the intended resting state, not a bug: CI, a fresh clone and any
second machine have no key, and a mandatory App auth would fail the watcher closed on
every one of them.

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

### 5. Switch it on - MARCO ONLY, and nothing happens until he does it

> ⚠️ **This step replaces a verification command that could never have worked, and which has been
> removed rather than fixed.** Earlier revisions told you to check the App installation by calling
> the repository-installation endpoint through `gh`. That endpoint authenticates **only** with an
> App JWT; `gh` sends your *user* token, so the call fails no matter how correctly the App is
> installed. Do not re-add it, and never read a failure from it as evidence about the installation.
> The Installation ID needs no API call at all: open the App's **Install App** -> **Configure** page
> and read the number at the end of the URL (`.../settings/installations/<Installation ID>`).

`scripts/pr-watcher/start-watcher.ps1` reads the App identity from a **machine-local file that is
not in this repository and never will be**:

```
C:\po-secrets\watcher-app-auth.ps1
```

Create it with **exactly** these three lines and nothing else:

```powershell
$env:PO_WATCHER_APP_ID          = "<App ID>"
$env:PO_WATCHER_INSTALLATION_ID = "<Installation ID>"
$env:PO_WATCHER_APP_KEY         = "C:\po-secrets\<the .pem from step 2>"
```

The three values for this machine are recorded in
`docs/approvals/watcher-identity-approved-by-marco.md`. They are deliberately **not** hard-coded in
`start-watcher.ps1`: they are machine-and-account facts, and a second machine or a rebuilt App would
silently disagree with a value baked into a tracked file.

🔴 **Four things about that file, all of them load-bearing:**

- **`PO_WATCHER_APP_KEY` is a PATH, not a key.** `app-auth.mjs:141` reads it and `:159` does
  `readFile(keyPath)`. Never
  paste PEM material into this file, into the repo, or into a chat.
- **It is dot-sourced, i.e. executed** by `start-watcher.ps1`. Three assignments and nothing else -
  no logging, no `Write-Host`, no logic. A load failure is logged verbatim, so anything you put in
  there can end up in a log file.
- **It must live outside every working tree.** Not `C:\ProjectOperations2\`, not
  `C:\po-watcher\ProjectOperations\`. `C:\po-secrets\` exists for exactly this.
- **Restrict it to your account** (`Properties -> Security`), same as the `.pem`. Anyone who can
  write it can make the watcher run as any App they like.

Then, **in an idle window**, restart the watcher so it picks up the new environment. A running
watcher holds the environment it started with; nothing here reaches into a live process. Scheduling
that restart is Station 00's, not an agent's.

### 6. Verify the switch actually took - do not assume it

Two lines, in this order, in the watcher's daily log
(`<clone>\scripts\pr-watcher\logs\YYYY-MM-DD.log`):

The launcher banner, which proves `start-watcher.ps1` read your config file:

```
App auth:       configured (App id <App ID>, installation <Installation ID>) -- see node's app-auth line below
```

Then, from `index.mjs`, the line that proves a token was actually minted:

```
app-auth:    gh[installation] (projectops-watcher[bot], WATCHER_APP_AUTH_V1)
```

**Only the second line is proof.** The banner says "your config parsed"; it says nothing about
whether GitHub accepted the key. If the log instead shows

```
app-auth:    OFF (PO_WATCHER_APP_KEY unset - running as ambient GH-Mantova)
```

the switch-on did **not** take, and the only way to reach that line is that
`C:\po-secrets\watcher-app-auth.ps1` **was not found** - wrong folder, wrong filename, or the
watcher is running on a machine that has no copy of it. A file that exists but sets nothing does
not reach this line; it refuses to start (step 7).

The end-to-end confirmation is on GitHub: the next label the watcher applies reads
`LABELED 'do-not-merge' by projectops-watcher[bot]`, not `by GH-Mantova`.

### 7. What a HALF-configured state does

Setting one or two of the three variables is the dangerous case, because it is the one that could
have looked like success. `index.mjs` decides whether App auth is on by looking at
`PO_WATCHER_APP_KEY` **alone**, so a config that sets the two ids and forgets the key path would
leave auth OFF and the watcher would go on merging as `GH-Mantova` while you believed it was the
bot. node cannot detect that: a variable that was meant to be set and isn't looks exactly like one
that was never wanted.

`start-watcher.ps1` therefore treats the **existence of `C:\po-secrets\watcher-app-auth.ps1` as a
declaration of intent**: once that file is there, all three variables must be set, or the launcher
refuses to start. A file that is present but sets nothing (a typo'd variable name, a commented-out
line) is refused for the same reason - it is the case where you would be most sure the switch was
on:

```
PRE-FLIGHT FAIL: app-auth is HALF-CONFIGURED (missing: PO_WATCHER_APP_KEY). Refusing to
start, because a half-configured watcher merges as ambient GH-Mantova while looking
switched on.
```

It refuses the same way when the three are set but `PO_WATCHER_APP_KEY` names no readable file
(only the basename is printed - the path is not secret, but there is no reason to spray it):

```
PRE-FLIGHT FAIL: app-auth private key not found (projectops-watcher.pem). Refusing to
start rather than falling back to ambient GH-Mantova.
```

Both exit 1. `supervise-watcher.ps1` picks the `PRE-FLIGHT FAIL` line up as the failure REASON,
retries five times at 60s, then trips its crash-loop guard, **stops**, and writes
`WATCHER-CRASH-LOOP-<timestamp>.md` naming the missing variable. So a half-configured switch-on
costs you a stopped queue and an escalation file within about five minutes. It never costs you a
run of unattributable merges.

**Hand over:** App ID, Installation ID, and the path to the `.pem`. Not the key contents.

---

# PART 2 - The code change - **MERGED, and inert until PART 1 step 5**

Kept here as the record of what was built and why. It was gated on a marker file only Marco could
land, using the convention in `docs/approvals/README.md`:

```yaml
requires_file_on_main: docs/approvals/watcher-identity-approved-by-marco.md
```

That marker states the App ID and Installation ID (**not** the key), so the gate could not open
until the identity actually existed. It was landed 2026-09-01 and the code merged as PR #1510:
`scripts/pr-watcher/app-auth.mjs` (minting, caching, fail-closed) plus its wiring in `index.mjs`.
The launcher side - reading the three variables out of `C:\po-secrets\watcher-app-auth.ps1` -
landed separately in `scripts/pr-watcher/start-watcher.ps1`.

**None of it does anything until step 5 above.** With no config file the three variables are unset,
`APP_AUTH_ENABLED` is false, and every code path below is skipped.

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

Rename the config file and restart the watcher:

```powershell
Rename-Item C:\po-secrets\watcher-app-auth.ps1 watcher-app-auth.ps1.off
```

`start-watcher.ps1` then sets nothing, `APP_AUTH_ENABLED` is false, and the watcher is back to
ambient keyring auth on its next start - the banner reads `App auth: OFF - ambient GH-Mantova`.
**Rename the whole file; do not comment out one or two of the three lines.** That is the
half-configured state, and the launcher will refuse to start (PART 1, step 7) - which is the correct
behaviour, but not the rollback you wanted.

Nothing in the repository has to change to roll back. Uninstalling the App revokes every
installation token within the hour. No repo content, no branch and no PR is affected either way.

# PART 4 - The standing costs, stated plainly

- **A private key lives on that laptop, forever.** Its blast radius is the repo permissions above.
- **A refresh path that can fail at 3am.** Fail-closed makes that a stopped watcher rather than a
  silent identity swap - the right trade, and still an outage.
- **Key rotation is manual.** Nothing here reminds you. If that matters, it wants its own scheduled
  task.
- **It does not close the forgery hole.** Anyone holding the `.pem` can act as the bot. Option (A)
  makes an approval visible; (B) makes the actor meaningful; neither makes forgery impossible.

# PART 5 - Sequencing

The original sequencing note said: do Part 1 whenever it suits, and do not stage Part 2 until option
(A) has landed and its receipt format is settled. Both of those have happened - the marker landed
2026-09-01, the code merged as PR #1510.

**One step remains, and it is Marco's:** create `C:\po-secrets\watcher-app-auth.ps1` (PART 1, step
5), then have Station 00 schedule an idle-window restart. Do not restart the watcher to switch this
on mid-queue: a restart mid-run abandons whatever prompt is in flight, and if the App turns out to
lack a permission the watcher fails **closed** and the queue stops until someone rolls back per
PART 3. Switch it on when a stopped queue costs nothing.
