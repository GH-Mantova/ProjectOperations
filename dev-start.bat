@echo off
setlocal

REM ProjectOperations dev environment startup script
REM Usage: double-click, or run from any terminal

set REPO=C:\ProjectOperations2

echo.
echo === ProjectOperations dev startup ===
echo.

REM 1. Navigate to repo
cd /d "%REPO%" || (echo Failed to cd to %REPO% && pause && exit /b 1)

REM 2. Verify we're in the right place
if not exist package.json (
    echo ERROR: package.json not found in %REPO%
    pause
    exit /b 1
)

REM 3. Check for uncommitted changes — fail fast, do not continue into a broken pull
git diff-index --quiet HEAD -- 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: You have uncommitted changes.
    echo dev-start.bat will not continue — a `git pull` on a dirty tree has
    echo twice left this repo in a broken-HEAD state requiring manual recovery.
    echo.
    echo Resolve the working tree first, then re-run this script:
    echo   git status                    ^(see what's modified^)
    echo   git stash push -m "wip"       ^(stash for later^)
    echo   git checkout -- .             ^(DISCARD all changes — destructive^)
    echo   git add . ^&^& git commit -m "..."  ^(commit them^)
    echo.
    pause
    exit /b 1
)

REM 4. Detect branch — switch to main + pull only if currently on main; otherwise just pull current branch
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i

if "%CURRENT_BRANCH%"=="main" goto branch_main

echo.
echo *********************************************************************
echo ***                                                               ***
echo ***  WARNING: you are NOT on main                                 ***
echo ***  The app will run branch '%CURRENT_BRANCH%'
echo ***                                                               ***
echo *********************************************************************
echo.
choice /c MC /m "Switch to main (M) or Continue on this branch (C)?"
if errorlevel 2 goto branch_stay

:branch_main
echo.
echo --- On main: pulling latest ---
git checkout main
if errorlevel 1 (
    echo Failed to checkout main. Resolve any conflicts and try again.
    pause
    exit /b 1
)
git pull
if errorlevel 1 (
    echo Failed to pull from origin/main. Check your network or git status.
    pause
    exit /b 1
)
goto branch_done

:branch_stay
echo.
echo --- Staying on branch '%CURRENT_BRANCH%' ^(not main^); pulling latest ---
git pull
if errorlevel 1 (
    echo Failed to pull. Check your network or git status.
    pause
    exit /b 1
)

:branch_done

REM 5. Verify postgres is running
echo.
echo --- Checking postgres container ---
docker ps --filter "name=project-operations-postgres" --filter "status=running" --format "{{.Names}}" | findstr "project-operations-postgres" >nul
if errorlevel 1 (
    echo Postgres container not running. Starting it now...
    docker compose up -d postgres
    if errorlevel 1 (
        echo Failed to start postgres. Check Docker Desktop is running.
        pause
        exit /b 1
    )
    echo Waiting 3 seconds for postgres to be ready...
    timeout /t 3 /nobreak >nul
) else (
    echo Postgres already running.
)

REM 6. Schema advisory - warn if DB schema has drifted from migrations (LL-07/LL-29)
echo.
echo --- Checking database schema status ---
call pnpm --filter @project-ops/api exec prisma migrate status > "%TEMP%\po-migrate-status.txt" 2>&1
findstr /c:"Database schema is up to date!" "%TEMP%\po-migrate-status.txt" >nul
if errorlevel 1 (
    echo.
    echo *********************************************************************
    echo ***  WARN: database schema may be out of sync with migrations.   ***
    echo ***  See docs/lessons-learned/incident-ledger.md - LL-07 playbook ***
    echo *********************************************************************
    echo.
    type "%TEMP%\po-migrate-status.txt"
    echo.
    choice /c YN /m "Continue anyway (Y) or stop (N)?"
    if errorlevel 2 (
        del "%TEMP%\po-migrate-status.txt" >nul 2>&1
        pause
        exit /b 1
    )
) else (
    echo Schema is up to date.
)
del "%TEMP%\po-migrate-status.txt" >nul 2>&1

REM 7. Check for orphan processes on dev ports
echo.
echo --- Checking for orphan processes on dev ports ---
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo Port 3000 is in use by an orphan process — killing it...
    powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 } | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
    timeout /t 1 /nobreak >nul
)

netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo Port 5173 is in use by an orphan process — killing it...
    powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 } | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
    timeout /t 1 /nobreak >nul
)

REM 8. Start pnpm dev
echo.
echo --- Starting pnpm dev ---
echo (Press Ctrl+C to stop both API and web)
echo.
pnpm dev

REM 9. After pnpm dev exits (Ctrl+C), pause so you can read any final output
echo.
echo --- Dev session ended ---
pause