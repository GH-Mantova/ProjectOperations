param(
  [Parameter(Mandatory = $true)]
  [string]$SharePointPath,

  [Parameter(Mandatory = $true)]
  [string]$LocalPath
)

$ErrorActionPreference = "Stop"

function Ensure-Path {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

Ensure-Path -Path $LocalPath

$excludeDirs = @(
  "node_modules",
  ".pnpm-store",
  ".turbo",
  "dist",
  "build",
  ".vite",
  ".next",
  ".git"
)

$excludeFiles = @(
  "*.log",
  ".env.local"
)

$robocopyArgs = @(
  $SharePointPath,
  $LocalPath,
  "/MIR",
  "/FFT",
  "/R:1",
  "/W:1",
  "/XD"
) + $excludeDirs + @(
  "/XF"
) + $excludeFiles

Write-Host "Syncing project from SharePoint to local working folder..."
Write-Host "From: $SharePointPath"
Write-Host "To:   $LocalPath"

& robocopy @robocopyArgs | Out-Host

if ($LASTEXITCODE -gt 7) {
  throw "Robocopy failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Local working copy is ready."
Write-Host "Run Docker/Node/Vite from the local path, not the SharePoint-synced folder."
