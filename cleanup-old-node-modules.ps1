# Cleanup script - Remove all plugin node_modules
# Usage: Run .\cleanup-old-node-modules.ps1 in PowerShell

Write-Host "Starting cleanup of old node_modules..." -ForegroundColor Green

# Remove all plugin node_modules
$pluginDirs = Get-ChildItem -Path "plugins" -Directory | Where-Object { $_.Name -notlike "_*" }

foreach ($dir in $pluginDirs) {
    $nodeModulesPath = Join-Path $dir.FullName "node_modules"
    if (Test-Path $nodeModulesPath) {
        Write-Host "Removing $($dir.Name)/node_modules..." -ForegroundColor Yellow
        Remove-Item -Path $nodeModulesPath -Recurse -Force
    }

    $packageLockPath = Join-Path $dir.FullName "package-lock.json"
    if (Test-Path $packageLockPath) {
        Write-Host "Removing $($dir.Name)/package-lock.json..." -ForegroundColor Yellow
        Remove-Item -Path $packageLockPath -Force
    }
}

# Remove frontend node_modules
$frontendNodeModules = "frontend\node_modules"
if (Test-Path $frontendNodeModules) {
    Write-Host "Removing frontend/node_modules..." -ForegroundColor Yellow
    Remove-Item -Path $frontendNodeModules -Recurse -Force
}

$frontendPackageLock = "frontend\package-lock.json"
if (Test-Path $frontendPackageLock) {
    Write-Host "Removing frontend/package-lock.json..." -ForegroundColor Yellow
    Remove-Item -Path $frontendPackageLock -Force
}

Write-Host "`nCleanup complete!" -ForegroundColor Green
Write-Host "Now you can run: pnpm install" -ForegroundColor Cyan
