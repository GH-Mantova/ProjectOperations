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

REM 3. Check for uncommitted changes
git diff-index --quiet HEAD -- 2>nul
if errorlevel 1 (
    echo WARNING: You have uncommitted changes.
    echo The script will continue, but git pull may not behave as expected.
    echo Press Ctrl+C to abort, or any key to continue...
    pause >nul
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
    echo WARNING: Something is already listening on port 3000.
    echo This may be an orphan from a previous pnpm dev session.
    echo Run 'netstat -ano ^| findstr :3000' to find the PID, then 'taskkill /F /PID ^<pid^>' to kill it.
    echo Press Ctrl+C to abort and clean up, or any key to continue anyway...
    pause >nul
)

netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo WARNING: Something is already listening on port 5173.
    echo Press Ctrl+C to abort and clean up, or any key to continue anyway...
    pause >nul
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