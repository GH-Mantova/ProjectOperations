param(
  [Parameter(Mandatory = $true)]
  [string]$LocalPath,

  [Parameter(Mandatory = $true)]
  [string]$SharePointPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LocalPath)) {
  throw "Local path does not exist: $LocalPath"
}

if (-not (Test-Path -LiteralPath $SharePointPath)) {
  throw "SharePoint path does not exist: $SharePointPath"
}

$excludeDirs = @(
  "node_modules",
  ".pnpm-store",
  ".turbo",
  "dist",
  "build",
  ".vite",
  ".next"
)

$excludeFiles = @(
  "*.log",
  ".env",
  ".env.local"
)

$robocopyArgs = @(
  $LocalPath,
  $SharePointPath,
  "/MIR",
  "/FFT",
  "/R:1",
  "/W:1",
  "/XD"
) + $excludeDirs + @(
  "/XF"
) + $excludeFiles

Write-Host "Syncing project from local working folder back to SharePoint..."
Write-Host "From: $LocalPath"
Write-Host "To:   $SharePointPath"

& robocopy @robocopyArgs | Out-Host

if ($LASTEXITCODE -gt 7) {
  throw "Robocopy failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "SharePoint copy updated."
Write-Host "Runtime/build artifacts and local env files were excluded."
