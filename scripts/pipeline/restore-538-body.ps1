# Restore #538's PR body. I FLATTENED IT.
#
# THE BUG (mine, 2026-07-14):
#   $body = gh pr view $PR --json body -q .body     <- returns a STRING ARRAY (one item per line)
#   $newBody = $prefix + "`n" + $body               <- string + array => PowerShell joins the array
#                                                      with $OFS (a SPACE). Every newline destroyed.
#
#   Result: the whole body collapsed onto one line, so CP-11's regex
#       /^GATE-ALLOW: (migrations|...)\s*$/gm
#   could no longer match - the marker had prose trailing it on the same line.
#
# THE FIX, generally: when a command returns lines, JOIN them explicitly:
#       $body = (gh pr view $PR --json body -q .body) -join "`n"
#   Never rely on implicit array-to-string conversion. $OFS is a space, not a newline.
#
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

$body = @'
GATE-ALLOW: migrations
GATE-ALLOW: env-vars

## Summary

- **Shared-computer switch-user:** `prompt: "select_account"` on the MSAL loginRequest, the MSAL cache is cleared in `AuthContext.logout`, and hard-coded seed credentials are removed from the LoginPage fields.
- **Gated Entra SSO:** auto-provisioning is OFF. Unregistered Entra users get a `403 { code: "ENTRA_NOT_REGISTERED", email, displayName }` and are routed to a request-access screen that posts `POST /auth/request-access` (identity is idToken-derived, never client-supplied). Requests land in a new `AccessRequest` table and email the admin (`ACCESS_REQUEST_NOTIFY_EMAIL`, default `marco@initialservices.net`).
- **Admin UI:** new "Access requests" tab under Admin settings - list PENDING, approve (creates an SSO-only user with the chosen role, idempotent if the email already exists), or deny. Each approve/deny writes an audit entry.
- **Filter:** `ApiExceptionFilter` now preserves extra structured fields (`code` / `email` / `displayName`) from HttpException object bodies so the client can branch on them.
- **Never-blank guarantee:** a top-level `ErrorBoundary` is added in `main.tsx`; `consumeSsoRedirect` no longer silently swallows a non-OK response - it stashes the pending request so the LoginPage renders the request-access screen.
- **Forward-compat:** `AccessRequest.kind` discriminator (default `OFFICE`) so a future `FIELD` personal-email site-worker channel can share the table.

## Security notes - DO NOT AUTO-MERGE

Marco reviews and smoke-tests. This touches the login / SSO paths.

- Auto-provisioning is intentionally removed. Approving an access request is the only way to onboard a new SSO user.
- Identity for `/auth/request-access` is always re-derived from the validated Entra idToken; the client-supplied email is never trusted. Raw idTokens are not logged.
- Existing password-login, refresh, and existing provisioned-user SSO flows are unchanged.

## Gates

- `pnpm --filter @project-ops/api build` / `lint`
- `pnpm --filter @project-ops/api test:serial` (163 suites, 2167 tests)
- `pnpm --filter @project-ops/web build` / `lint`
- `pnpm --filter @project-ops/web test` (60 files, 753 tests)
- `pnpm compliance:smoke`
- Prisma migration `20260710120000_access_requests` applies cleanly on the current dev DB (no drift).
- Route mapping confirmed for `POST /auth/request-access` and `GET/POST /admin/access-requests[/:id/approve|/deny]`.

## Manual smoke - PENDING MARCO

- [ ] Shared PC: sign in as user A, sign out, click "Sign in with Microsoft" - the Microsoft account picker appears (not a silent re-login as A).
- [ ] Login form email/password fields start empty (no seed creds).
- [ ] Unregistered Entra user: SSO leads to the **request-access screen** (never blank), types a message, submits - Marco receives the email AND a PENDING `AccessRequest` row exists. The user still has NO app access.
- [ ] Admin -> Access requests -> **Approve** with a role - the user is created, the request goes APPROVED, and that person can sign in. **Deny** marks DENIED.
- [ ] Existing provisioned users: password login and Microsoft SSO are both unaffected.

## Follow-ups (deliberately NOT in this PR)

- Field-worker (personal-email) auth path - a separate future PR; `AccessRequest.kind` is designed so no migration will be needed.
- Field / tender spec regeneration after the SSO smoke is green.
'@

if (-not $Execute) {
    Write-Output "=== body to be written (first 6 lines):"
    ($body -split "`n") | Select-Object -First 6 | ForEach-Object { Write-Output ("  |" + $_ + "|") }
    Write-Output "DRY RUN"
    exit 0
}

$tmp = Join-Path $env:TEMP "pr538-body.md"
[System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding($false)))
gh pr edit 538 --body-file $tmp 2>$null | Out-Null
Write-Output "body restored with real newlines."

# Verify the markers are BARE at column 0 now.
$check = (gh pr view 538 --json body -q .body) -join "`n"
foreach ($m in @("GATE-ALLOW: migrations", "GATE-ALLOW: env-vars")) {
    $ok = $false
    foreach ($l in ($check -split "`n")) { if ($l.TrimEnd() -ceq $m) { $ok = $true } }
    if ($ok) { Write-Output ("  OK   bare at column 0: " + $m) } else { Write-Output ("  FAIL: " + $m) }
}
