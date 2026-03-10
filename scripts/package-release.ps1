$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseRoot = Join-Path $repoRoot "release"
$pluginId = "embedded-whiteboard"
$packageDir = Join-Path $releaseRoot $pluginId
$zipPath = Join-Path $releaseRoot "$pluginId.zip"

if (Test-Path $releaseRoot) {
  Remove-Item $releaseRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $packageDir -Force | Out-Null

$filesToCopy = @(
  "manifest.json",
  "main.js",
  "styles.css"
)

foreach ($file in $filesToCopy) {
  Copy-Item (Join-Path $repoRoot $file) $packageDir
}

Compress-Archive -Path $packageDir -DestinationPath $zipPath -Force
Write-Host "Created $zipPath"
