# #544's e2e failure is a REAL behaviour change, not a flake.
#
# Two tests assert the OLD behaviour - that a permission denial SILENTLY REDIRECTS to "/".
# #544 exists to STOP that (sot/01 SECTION 6, failure honesty): a silent redirect makes a
# permission failure look identical to a broken feature - exactly what cost hours on 2026-07-13
# when "Rates & Lists opened the dashboard" and the real cause was a missing rates.manage grant.
#
# THE TESTS ARE ASSERTING THE BUG THE PR FIXES. They must follow the new contract:
#   stay on the route, render <NoAccess/> (data-testid="no-access").
#
# Matching is REGEX with \s+ between statements, because the working copy uses CRLF and an exact
# multi-line string match silently fails. (It did, on the first attempt.)
#
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-fix"
git fetch origin --quiet 2>$null

$branch = "fix/no-access-page-instead-of-redirect"
git checkout -B $branch ("origin/" + $branch) --quiet 2>$null

$noBom = New-Object System.Text.UTF8Encoding($false)

# ---------- batch7: /timesheets/approval ----------
$f7 = "tests\e2e\pr-acceptance\batch7-field.spec.ts"
$t7 = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $f7))

$re7 = '(?s)test\("user without field\.manage is redirected from /timesheets/approval to /".*?\}\);'
$new7 = @"
// #544 (failure honesty, sot/01 SECTION 6): a permission denial must NOT silently redirect.
  // The old assertion here ENCODED THE DEFECT - it required the user to be bounced to "/",
  // which is indistinguishable from a broken page. We now stay put and say why.
  test("user without field.manage sees NoAccess on /timesheets/approval (no silent redirect)", async ({
    page
  }) => {
    await loginAsViewer(page);
    await page.goto("/timesheets/approval");
    await expect(page.getByTestId("no-access")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/timesheets/approval");
  });
"@

if ($t7 -match $re7) {
    $t7 = [regex]::Replace($t7, $re7, $new7, 1)
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $f7), $t7, $noBom)
    Write-Output "  batch7-field.spec.ts  UPDATED"
} else {
    Write-Output "  batch7-field.spec.ts  *** regex did not match"
}

# ---------- batch8: /admin/settings ----------
$f8 = "tests\e2e\pr-acceptance\batch8-admin-portal.spec.ts"
$t8 = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $f8))

$re8 = '(?s)test\("viewer is redirected away from admin settings \(prompt-directed\)".*?\}\);'
$new8 = @"
test("viewer sees NoAccess on admin settings, not a silent redirect (#544)", async ({ page }) => {
    await loginAsViewer(page);
    await page.goto("/admin/settings");

    // #544 (failure honesty, sot/01 SECTION 6): non-admins are NOT bounced to the dashboard -
    // that made a permission failure look exactly like a broken page. They stay here and are
    // told which permission they lack.
    await expect(page.getByTestId("no-access")).toBeVisible();
    await expect(page).toHaveURL(/admin\/settings/);
    await expect(page.getByRole("heading", { name: "Admin settings" })).toHaveCount(0);
  });
"@

if ($t8 -match $re8) {
    $t8 = [regex]::Replace($t8, $re8, $new8, 1)
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $f8), $t8, $noBom)
    Write-Output "  batch8-admin-portal.spec.ts  UPDATED"
} else {
    Write-Output "  batch8-admin-portal.spec.ts  *** regex did not match"
}

$changed = git status --short -- tests/ 2>$null
if (-not $changed) { Write-Output "NOTHING CHANGED. Aborting."; exit 1 }

Write-Output ""
Write-Output "=== diff:"
git diff -- tests/ 2>$null | Select-Object -First 60

if (-not $Execute) {
    git checkout -- tests/ 2>$null
    Write-Output ""
    Write-Output "DRY RUN - reverted."
    exit 0
}

git add tests/ 2>$null
git commit -m "test(e2e): permission denial renders NoAccess instead of redirecting (#544 failure-honesty)" --quiet 2>$null
$head = git rev-parse --short HEAD
git push origin $branch 2>$null
if ($LASTEXITCODE -eq 0) { Write-Output ("PUSHED " + $head) } else { Write-Output "push failed" }
git checkout --detach origin/main --quiet 2>$null
