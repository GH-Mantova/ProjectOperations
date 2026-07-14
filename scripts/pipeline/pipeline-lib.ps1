# pipeline-lib.ps1 - the ONLY sanctioned primitives for touching the board.
#
# WHY THIS FILE EXISTS
# ====================
# On 2026-07-14 a human (me) drove 13 PRs to merge by hand. Almost every failure was NOT a
# judgement error - it was a SILENT WRONG DEFAULT in PowerShell or git. Each one produced a
# plausible-looking success while doing the wrong thing:
#
#   1. $string + $array          -> PowerShell joins with SPACES ($OFS), not newlines.
#                                   Flattened two PR bodies onto one line, breaking CP-11.
#   2. ConvertFrom-Json on a     -> emits ONE object, not a stream. `| Where-Object` then filters
#      JSON ARRAY                   a single item whose .number is an ARRAY, so the filter is a
#                                   silent NO-OP. This SELECTED THE PRODUCTION-DATA PR for merge.
#   3. $ErrorActionPreference    -> git writes harmless CRLF warnings to STDERR. With "Stop",
#      = "Stop"                     PowerShell treats them as TERMINATING and aborts the script
#                                   BEFORE the commit. The fix is never pushed; the log looks fine.
#   4. Round-tripping a file     -> double-encodes UTF-8 (em dashes). Renamed CI job names, so
#      through shell strings        required status checks stopped matching and a PR was blocked
#                                   forever with every check green.
#
# AN AGENT WOULD HAVE HIT ALL FOUR - and reported success, because each bug is silent.
#
# THE RULE THIS FILE ENFORCES
# ===========================
#   EVERY MUTATION IS FOLLOWED BY A READ-BACK THAT PROVES THE EFFECT.
#   A report must describe EFFECTS, not INTENTIONS. (sot/05 LL-38)
#
# Usage:  . "$PSScriptRoot\pipeline-lib.ps1"
#
# Pure ASCII.

# git writes warnings to stderr. "Stop" turns those into script-killing errors. Never use Stop.
$ErrorActionPreference = "Continue"

$script:REPO      = "GH-Mantova/ProjectOperations"
$script:WATCHER   = "C:\po-watcher\ProjectOperations"   # the watcher's tree - NEVER git-write here
$script:WORKTREE  = "C:\po-fix"                          # our isolated worktree - safe to git-write

# ---------------------------------------------------------------------------------------------
# READING THE BOARD
# ---------------------------------------------------------------------------------------------

function Get-Board {
    <#
      Returns an ARRAY of PR objects. Never a single collapsed object.

      BUG THIS PREVENTS: `gh pr list --json ... | ConvertFrom-Json | Where-Object {...}` sends ONE
      item (the whole array) into Where-Object, so `$_.number` is an ARRAY and any filter is a
      SILENT NO-OP. That is how the NEVER-list filter let the production-data PR through.
      ASSIGN, then foreach. Never pipe ConvertFrom-Json into a filter.
    #>
    Push-Location $script:WATCHER
    $raw = gh pr list --state open --limit 60 --json number,title,headRefName,mergeStateStatus,autoMergeRequest,isDraft | ConvertFrom-Json
    Pop-Location

    $out = @()
    foreach ($p in $raw) { $out += $p }     # foreach enumerates correctly; @( pipeline ) does not
    return ($out | Sort-Object { [int]$_.number })
}

function Get-PrBody([int]$PR) {
    <#
      Returns the body as a SINGLE STRING with real newlines.

      BUG THIS PREVENTS: `gh pr view --json body -q .body` returns a STRING ARRAY (one item per
      line). `$prefix + $body` then joins it with SPACES ($OFS), flattening the entire body onto
      one line - which broke CP-11's /^GATE-ALLOW: migrations$/ regex on #538.
    #>
    Push-Location $script:WATCHER
    $lines = gh pr view $PR --json body -q .body
    Pop-Location
    return ($lines -join "`n")     # EXPLICIT join. Never rely on implicit array-to-string.
}

function Get-ChecksFor([int]$PR) {
    <#
      Returns check objects, and marks each with .IsRealFailure.

      BUG THIS PREVENTS: while a NEW run is in flight, `gh pr checks` still reports the PREVIOUS
      run's conclusion. Acting on it means chasing a failure that is already fixed. I did, twice.
      A FAILURE IS ONLY REAL IF ITS RUN HAS COMPLETED.
    #>
    Push-Location $script:WATCHER
    $raw = gh pr checks $PR --json name,state,link 2>$null | ConvertFrom-Json

    $out = @()
    foreach ($c in $raw) {
        $real = $false
        if ($c.state -in @("FAILURE","ERROR","CANCELLED","TIMED_OUT")) {
            $real = $true
            if ($c.link -match "runs/(\d+)/") {
                $status = gh run view $Matches[1] --json status -q .status 2>$null
                if ($status -ne "completed") { $real = $false }   # stale conclusion - ignore
            }
        }
        $c | Add-Member -NotePropertyName IsRealFailure -NotePropertyValue $real -Force
        $out += $c
    }
    Pop-Location
    return $out
}

# ---------------------------------------------------------------------------------------------
# MUTATIONS - every one READS BACK and PROVES the effect
# ---------------------------------------------------------------------------------------------

function Set-PrBody {
    <#
      Replace a PR body. Writes UTF-8 WITHOUT BOM, then READS IT BACK and proves every required
      GATE-ALLOW marker is BARE at column 0.

      CP-11's parser: /^GATE-ALLOW: (migrations|env-vars|dependencies)\s*$/gm
        "## GATE-ALLOW: migrations"  -> FAILS (markdown heading)
        "GATE-ALLOW: migrations."    -> FAILS (trailing period; cost PR #497)
        "GATE-ALLOW: migrations"     -> passes
      10 PRs have failed on exactly this.
    #>
    param(
        [int]$PR,
        [string]$Body,
        [string[]]$RequiredMarkers = @()
    )

    $tmp = Join-Path $env:TEMP ("pr" + $PR + "-body.md")
    [System.IO.File]::WriteAllText($tmp, $Body, (New-Object System.Text.UTF8Encoding($false)))

    Push-Location $script:WATCHER
    gh pr edit $PR --body-file $tmp 2>$null | Out-Null
    Pop-Location

    # READ BACK. Never trust the write.
    $after = Get-PrBody $PR
    $lines = $after -split "`n"

    foreach ($m in $RequiredMarkers) {
        $bare = $false
        foreach ($l in $lines) { if ($l.TrimEnd() -ceq $m) { $bare = $true } }
        if (-not $bare) {
            throw ("Set-PrBody: '" + $m + "' is NOT bare at column 0 after the write. CP-11 will fail.")
        }
    }
    return $true
}

function Invoke-GitPush {
    <#
      Push, then READ BACK the remote SHA and prove it is ours.
      BUG THIS PREVENTS: with ErrorActionPreference=Stop, git's harmless CRLF warnings on stderr
      abort the script BEFORE the push - and the log still looks like it worked.
    #>
    param([string]$Branch, [string]$WorkTree = $script:WORKTREE)

    Push-Location $WorkTree
    $local = (git rev-parse HEAD).Trim()
    git push origin $Branch 2>$null
    $code = $LASTEXITCODE
    git fetch origin --quiet 2>$null
    $remote = (git rev-parse ("origin/" + $Branch)).Trim()
    Pop-Location

    if ($code -ne 0) { throw ("push failed for " + $Branch) }
    if ($local -ne $remote) {
        throw ("PUSH DID NOT LAND: local " + $local.Substring(0,8) + " != origin " + $remote.Substring(0,8))
    }
    return $local.Substring(0,8)
}

function Copy-FileFromRef {
    <#
      Copy a file from a git ref, BYTE-FOR-BYTE.

      BUG THIS PREVENTS: reading a file through PowerShell and writing it back DOUBLE-ENCODES
      UTF-8. It mangled the em dashes in ci.yml's job names, the required status checks stopped
      matching, and #544 was blocked forever with every check green and no explanation.

      git moves BYTES. A shell moves its GUESS at the text. Use git.
    #>
    param([string]$Ref, [string]$Path, [string]$WorkTree = $script:WORKTREE)
    Push-Location $WorkTree
    git checkout $Ref -- $Path 2>$null
    $ok = ($LASTEXITCODE -eq 0)
    Pop-Location
    if (-not $ok) { throw ("Copy-FileFromRef failed: " + $Ref + " -- " + $Path) }
    return $true
}

# ---------------------------------------------------------------------------------------------
# IRREVERSIBLE ACTIONS - guarded AT THE CALL SITE, not at selection
# ---------------------------------------------------------------------------------------------

# PRs no agent may EVER merge. Maintained here, checked at the call site.
#   Production data writes, production auth, anything needing a real human identity.
# PRs no agent may merge. Each entry needs a REASON and a DISCHARGE CONDITION - a list that only
# ever grows becomes noise, and a list nobody can clear becomes a lie.
#
#   552 - writes PRODUCTION DATA. The migration is proven idempotent, additive, and non-clobbering
#         (applied twice to a throwaway DB: 9/35/132 both runs; an admin edit survived a rerun).
#         What is NOT discharged: whether the RATES ARE CORRECT. Only Marco can say. It runs at
#         DEPLOY, not at merge.
#
#   538 - DISCHARGED 2026-07-14. It was here because it needs a real Microsoft account on a real
#         shared PC, and no agent has an identity. Marco ran it: real MS sign-in; sign-out then
#         sign-in showed the ACCOUNT PICKER (the shared-PC bug, closed); an unregistered Entra user
#         got request-access with NO auto-provision; approving as Viewer created the user and that
#         user signed in. Verified in the DB, not just the UI.
#   552 - DISCHARGED 2026-07-14 03:51Z (merged). Marco reviewed the rates. Before merging it was
#         proven idempotent (applied twice to a throwaway DB: 9/35/132 both runs), purely additive
#         (0 DELETE/UPDATE/TRUNCATE/DROP in the live SQL), non-clobbering (an admin edit survived a
#         rerun), and to contain NO invented values (md5 of all 132 rows == md5 of the seed's own
#         projection, 218217bdf30c420916899ad3e479398f).
#
# THE LIST IS CURRENTLY EMPTY - and that is CORRECT, not broken.
#
# An empty list means nothing is presently forbidden to merge. It does NOT mean the guard is off:
# Assert-Mergeable still runs at every call site, and .claude/hooks/guard.mjs still reads this list
# and will block `gh pr merge <n>` for anything added to it.
#
# ADD A PR HERE the moment you know it must not merge - production data, production auth, or anything
# needing a real human identity. And ALWAYS write the REASON and the DISCHARGE CONDITION next to it.
# A guard nobody can ever clear becomes a lie people learn to ignore; a guard left in place after its
# reason is gone protects nothing while LOOKING like it protects something. Both are worse than no
# guard at all.
$script:NEVER_MERGE = @()

function Assert-Mergeable([int]$PR) {
    <#
      THE LAST LINE OF DEFENCE. Call this IMMEDIATELY before any merge - never rely on the
      selection filter alone.

      BUG THIS PREVENTS: my selection filter was one PowerShell quirk away from being a no-op,
      and it WAS. It selected #552 (writes production data) for merge. The only thing that saved
      it was luck. A filter is one bug from wrong; a guard at the call site is not.
    #>
    if ($script:NEVER_MERGE -contains $PR) {
        throw ("REFUSING #" + $PR + " - on the NEVER-MERGE list (production data / human smoke required). " +
               "If the selection filter let it through, THE SELECTION FILTER IS BROKEN.")
    }
}

function Merge-Pr {
    <#
      Merge, then READ BACK and prove the PR is actually MERGED.
      Never report a merge you have not confirmed. (sot/05 LL-38: reports described intentions.)
    #>
    param([int]$PR, [switch]$Auto)

    Assert-Mergeable $PR          # at the call site

    Push-Location $script:WATCHER
    if ($Auto) { gh pr merge $PR --squash --auto --delete-branch 2>$null | Out-Null }
    else       { gh pr merge $PR --squash --delete-branch 2>$null | Out-Null }
    $code = $LASTEXITCODE
    Pop-Location

    if ($Auto) { return ($code -eq 0) }   # --auto merges later; nothing to read back yet

    Start-Sleep -Seconds 5
    Push-Location $script:WATCHER
    $state = gh pr view $PR --json state -q .state 2>$null
    Pop-Location

    if ($state -ne "MERGED") { throw ("Merge-Pr: #" + $PR + " is '" + $state + "', not MERGED. Do not report success.") }
    return $true
}

function Assert-ArtifactSurvived {
    <#
      After resolving a conflict: PROVE the PR's own contribution still exists.
      DOCTRINE 2 - never delete the point of the PR to make a conflict go away.
    #>
    param([string]$Needle, [string]$Path = "apps/", [string]$WorkTree = $script:WORKTREE)
    Push-Location $WorkTree
    $hits = @(git grep -l $Needle -- $Path 2>$null)
    Pop-Location
    if ($hits.Count -eq 0) { throw ("Assert-ArtifactSurvived: '" + $Needle + "' is GONE from " + $Path + ". Aborting.") }
    return $hits.Count
}

function Test-WatcherRepoClean {
    <#
      CORRUPT = mid-merge / mid-rebase / unmerged paths.
      Being on a FEATURE BRANCH is NORMAL - the watcher checks one out every run. An earlier
      version of this check called that "broken", which would have had an agent run
      `git checkout main` OUT FROM UNDER A LIVE AGENT and destroy its work.
    #>
    Push-Location $script:WATCHER
    $midMerge  = Test-Path ".git\MERGE_HEAD"
    $midRebase = (Test-Path ".git\rebase-merge") -or (Test-Path ".git\rebase-apply")
    $unmerged  = @(git diff --name-only --diff-filter=U 2>$null)
    Pop-Location

    return [pscustomobject]@{
        Corrupt  = ($midMerge -or $midRebase -or ($unmerged.Count -gt 0))
        MidMerge = $midMerge
        Unmerged = $unmerged
    }
}


# ============================================================================================
# THE EVIDENCE GATE  (added 2026-07-14)
# ============================================================================================
# An agent saying "smoke passed" is not evidence. Twice a watcher agent wrote "done - verified"
# into a PR body when the diff did not contain the artifact it named (#476, #478). The body
# lies; the code and the check runs do not.
#
# So merging is gated on FACTS PULLED FROM GITHUB, never on the agent's own report.

function Assert-SmokeGreen {
    <#
      Refuse to merge unless GitHub itself says the e2e acceptance suite CONCLUDED SUCCESS.

      Two traps this closes:
      1. "pending" is not "pass". A check still running has conclusion=null; treating null as
         benign is how a red PR sails through.
      2. A REQUIRED check that is simply ABSENT is not a pass either. When #544 renamed the CI
         job, the required context stopped matching and the PR sat green-but-unmergeable. The
         inverse - a job that vanishes and takes its gate with it - is the dangerous direction.
    #>
    # NOTE ON FIELD NAMES: Get-ChecksFor calls `gh pr checks --json name,state,link`, so each
    # object carries .state - NOT .status/.conclusion (those are the `gh pr view
    # --json statusCheckRollup` shape). Reading the wrong field yields an EMPTY string, which
    # compares unequal to "COMPLETED" and makes every check look like it is still running. That
    # is a gate that blocks everything forever - which at least fails safe, but is still broken.
    #
    # NOTE ON REQUIRED NAMES: CI job names contain EM-DASHES ("API - lint" is really
    # "API <em-dash> lint"). Matching them with an ASCII hyphen silently never matches - the
    # exact class of bug that left #544 green-but-unmergeable. So match on a dash-free prefix.
    param([int]$PR, [string[]]$Required = @("tendering-e2e", "API", "Web"))

    $checks = Get-ChecksFor -PR $PR
    if (@($checks).Count -eq 0) {
        throw ("Assert-SmokeGreen: #" + $PR + " reports NO checks at all. That is not a pass.")
    }

    $names = @()
    foreach ($c in $checks) {
        $names += $c.name
        $st = "$($c.state)".ToUpper()

        if ($st -eq "PENDING" -or $st -eq "QUEUED" -or $st -eq "IN_PROGRESS" -or $st -eq "") {
            throw ("Assert-SmokeGreen: #" + $PR + " check '" + $c.name + "' is '" + $st +
                   "' - still in flight. WAIT. Do not rebase, do not merge, do not 'retrigger'." +
                   " Rebasing a PR whose checks are running restarts CI and loops forever.")
        }
        if ($st -ne "SUCCESS" -and $st -ne "SKIPPED" -and $st -ne "NEUTRAL") {
            throw ("Assert-SmokeGreen: #" + $PR + " check '" + $c.name + "' is " + $st +
                   ". READ THE JOB LOG before you touch anything. Never diagnose a CI failure" +
                   " without it. And never call a failure a 'flake' to justify a re-run -" +
                   " #544's e2e 'flake' was two tests asserting the exact bug the PR removed.")
        }
    }

    # An absent gate is not a passed gate.
    foreach ($r in $Required) {
        $hit = @($names | Where-Object { $_ -like ("*" + $r + "*") })
        if ($hit.Count -eq 0) {
            throw ("Assert-SmokeGreen: #" + $PR + " has NO check matching '" + $r + "'. A missing" +
                   " gate is not a green gate. Did a CI job get renamed?")
        }
    }

    return $true
}

function Assert-BodyClaimsAreReal {
    <#
      DOCTRINE: trust the diff, not the prose.

      Give it the artifact the PR body claims to have created. If that string is not in the
      PR's own diff, the body is over-claiming and the PR is NOT done. This is the check that
      would have caught #476 and #478 before they merged.
    #>
    param([int]$PR, [Parameter(Mandatory = $true)][string[]]$MustContain)

    Push-Location $script:WATCHER
    $diff = (gh pr diff $PR 2>$null) | Out-String
    Pop-Location

    if ([string]::IsNullOrWhiteSpace($diff)) {
        throw ("Assert-BodyClaimsAreReal: could not read the diff for #" + $PR + ". Do not assume it is fine.")
    }

    $missing = @()
    foreach ($needle in $MustContain) {
        if ($diff -notmatch [regex]::Escape($needle)) { $missing += $needle }
    }
    if ($missing.Count -gt 0) {
        throw ("Assert-BodyClaimsAreReal: #" + $PR + " claims artifacts that are NOT in its diff: " +
               ($missing -join ", ") + ". The PR body is over-claiming. Do NOT merge it.")
    }
    return $true
}

function Assert-SmokedOrEscalate {
    <#
      The single call an agent makes before merging. Composes every gate in the right order.

      Order matters and is not negotiable:
        1. NEVER-MERGE list   - cheapest, and the only one whose failure is catastrophic.
        2. checks green       - facts from GitHub, not the agent's opinion.
        3. body claims real   - the diff actually contains what the PR says it does.
      Only then may Merge-Pr run - and Merge-Pr itself re-reads state and asserts MERGED.
    #>
    param([int]$PR, [string[]]$MustContain = @())

    Assert-Mergeable -PR $PR          # throws on #552 (prod data) and #538 (human identity)
    Assert-SmokeGreen -PR $PR
    if ($MustContain.Count -gt 0) { Assert-BodyClaimsAreReal -PR $PR -MustContain $MustContain }

    return $true
}
