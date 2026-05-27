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

REM 4. Switch to main and pull latest
echo.
echo --- Switching to main and pulling latest ---
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

REM 6. Check for orphan processes on dev ports
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

REM 7. Start pnpm dev
echo.
echo --- Starting pnpm dev ---
echo (Press Ctrl+C to stop both API and web)
echo.
pnpm dev

REM 8. After pnpm dev exits (Ctrl+C), pause so you can read any final output
echo.
echo --- Dev session ended ---
pause