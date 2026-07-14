# batch8: drop the leftover `"Admin settings" heading toHaveCount(0)` assertion.
#
# It failed with "unexpected value 1" - because <NoAccess/> renders IN PLACE inside the page and
# the app chrome stays. That is deliberate; NoAccess.tsx says so in its own header:
#
#   "the surrounding ShellLayout keeps the app chrome in place so the user still sees the sidebar
#    and knows where they are."
#
# The count(0) check only made sense in the REDIRECT era, when you genuinely were not on the page.
# The real contract now: no-access is visible, and the URL has not changed. Those two assertions
# remain. Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-fix"
git fetch origin --quiet 2>$null

$branch = "fix/no-access-page-instead-of-redirect"
git checkout -B $branch ("origin/" + $branch) --quiet 2>$null

$f8 = "tests\e2e\pr-acceptance\batch8-admin-portal.spec.ts"
$t8 = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $f8))

$old = '    await expect(page.getByRole("heading", { name: "Admin settings" })).toHaveCount(0);'
$new = '    // NOTE: the "Admin settings" page heading REMAINS. <NoAccess/> renders in place and the' + "`r`n" +
       '    // ShellLayout chrome is kept deliberately, so the user still knows where they are.' + "`r`n" +
       '    // Asserting the heading is absent was a leftover from the redirect era.'

if ($t8.Contains($old)) {
    $t8 = $t8.Replace($old, $new)
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $f8), $t8, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output "  removed the stale toHaveCount(0) assertion"
} else {
    Write-Output "  *** assertion not found"
    exit 1
}

Write-Output ""
git diff -- $f8 2>$null | Select-Object -First 25

if (-not $Execute) { git checkout -- tests/ 2>$null; Write-Output ""; Write-Output "DRY RUN"; exit 0 }

git add tests/ 2>$null
git commit -m "test(e2e): NoAccess renders in place - the page heading legitimately remains" --quiet 2>$null
$head = git rev-parse --short HEAD
git push origin $branch 2>$null
if ($LASTEXITCODE -eq 0) { Write-Output ("PUSHED " + $head) }
git checkout --detach origin/main --quiet 2>$null
