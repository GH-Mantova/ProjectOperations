# Prisma query engine .dll lock on Windows

Last seen: 2026-05-03 during BYOK resolver diagnosis.

## Symptoms

- `prisma generate` reports "Generated Prisma Client (vX.X.X)"
  successfully
- But `query_engine-windows.dll.node` retains an OLD timestamp
- And `node_modules/.pnpm/@prisma+client@*/...` accumulates many
  `query_engine-windows.dll.node.tmpNNNN` files
- At runtime: schema fields added in recent migrations are silently
  missing from query results (Prisma returns rows but new columns
  appear undefined)
- No errors in API logs — fields just look null

## Cause

Windows file locking. Any running node / tsx / esbuild process holds
the .dll open. `prisma generate` writes a `.tmpNNNN` then attempts to
rename → fails silently → leaves the .tmp behind. JS portion of the
client regenerates fine because no process holds those files. So
schema.prisma and index.js update but the engine binary does not.

At runtime, the JS client builds queries against the new schema, but
the old engine .dll has no idea what those columns are. The engine
appears to silently strip unknown columns rather than throw, so
Prisma returns rows with the new fields undefined.

## Recovery sequence

Run from `C:\ProjectOperations2` in PowerShell:

```powershell
# 1. Kill anything holding the .dll
Get-Process node, tsx, esbuild -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# 2. Verify nothing still holds the file open
$files = @(
  "node_modules\.pnpm\@prisma+client@*\node_modules\.prisma\client\query_engine-windows.dll.node",
  "node_modules\.pnpm\@prisma+engines@*\node_modules\@prisma\engines\query_engine-windows.dll.node",
  "node_modules\.pnpm\prisma@*\node_modules\prisma\query_engine-windows.dll.node"
)
foreach ($pattern in $files) {
  Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      [IO.File]::Open($_.FullName, 'Open', 'ReadWrite', 'None').Close()
    } catch {
      Write-Host "STILL LOCKED: $($_.FullName)" -ForegroundColor Red
    }
  }
}

# 3. Clean up leftover .tmp files
Get-ChildItem -Path "node_modules" -Recurse -Filter "query_engine-windows.dll.node.tmp*" `
  -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction Continue

# 4. Delete stale .dll from all 3 locations
Get-ChildItem -Path "node_modules" -Recurse -Filter "query_engine-windows.dll.node" `
  -ErrorAction SilentlyContinue | Remove-Item -Force

# 5. Verify all gone
Get-ChildItem -Path "node_modules" -Recurse -Filter "query_engine-windows.dll.node" `
  -ErrorAction SilentlyContinue | Select-Object FullName, LastWriteTime
# Expected: zero rows

# 6. Regenerate
pnpm --filter @project-ops/api exec prisma generate

# 7. Verify all 3 .dlls present with TODAY'S timestamp
Get-ChildItem -Path "node_modules" -Recurse -Filter "query_engine-windows.dll.node" `
  -ErrorAction SilentlyContinue | Select-Object FullName, LastWriteTime,
  @{N='SizeMB';E={[math]::Round($_.Length/1MB,1)}}

# 8. Verify zero new .tmp files
Get-ChildItem -Path "node_modules" -Recurse -Filter "query_engine-windows.dll.node.tmp*" `
  -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 0

# 9. Restart API
pnpm --filter @project-ops/api dev
```

## How to detect this is happening

When you suspect schema-vs-runtime mismatch, run:

```powershell
Get-ChildItem -Path "node_modules" -Recurse -Filter "query_engine-windows.dll.node" `
  -ErrorAction SilentlyContinue | Select-Object FullName, LastWriteTime
```

All three timestamps should match the most recent `prisma generate`.
If they don't — run the recovery sequence.
