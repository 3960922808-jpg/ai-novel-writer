# Publish packaged exe files to GitHub Releases
# Usage:
#   1. Set env:  $env:GH_TOKEN = "ghp_xxx"
#   2. Bump version in package.json
#   3. Run:      powershell -ExecutionPolicy Bypass -File publish-release.ps1
#
# This script will:
#   - Read version from package.json
#   - Create a GitHub Release tagged v<version> (updates if exists)
#   - Upload Setup.exe and win-unpacked/TrmWrite.exe as release assets

$ErrorActionPreference = 'Stop'

$repo = '3960922808-jpg/ai-novel-writer'
$token = $env:GH_TOKEN
if (-not $token) {
  Write-Host "ERROR: GH_TOKEN environment variable is not set." -ForegroundColor Red
  Write-Host "Set it with:  `$env:GH_TOKEN = 'ghp_xxx'"
  exit 1
}

# Read version from package.json
$pkg = Get-Content -Path (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json
$version = $pkg.version
$tagName = "v$version"
Write-Host "Publishing release $tagName ..." -ForegroundColor Cyan

$headers = @{
  'Authorization'        = "Bearer $token"
  'Accept'               = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
}

# Locate packaged files
$setupExe = Join-Path $PSScriptRoot "release\TrmWrite Setup $version.exe"
$unpackedExe = Join-Path $PSScriptRoot 'release\win-unpacked\TrmWrite.exe'

$assets = @()
if (Test-Path $setupExe) {
  $assets += $setupExe
} else {
  Write-Host "WARN: Setup exe not found at: $setupExe" -ForegroundColor Yellow
}
if (Test-Path $unpackedExe) {
  $assets += $unpackedExe
} else {
  Write-Host "WARN: Unpacked exe not found at: $unpackedExe" -ForegroundColor Yellow
}
if ($assets.Count -eq 0) {
  Write-Host "ERROR: No exe files found. Run 'npm run build:win' first." -ForegroundColor Red
  exit 1
}

# Check if release already exists, create or update accordingly
$release = $null
try {
  $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/$tagName" -Headers $headers
  $release = $existing
  Write-Host "Release $tagName already exists (id=$($release.id)). Will update assets." -ForegroundColor Yellow
} catch {
  # 404 means release does not exist yet, which is expected
  Write-Host "Release $tagName does not exist yet, creating..." -ForegroundColor Green
}

if (-not $release) {
  $body = @{
    tag_name    = $tagName
    name        = "TrmWrite $version"
    body        = "版本 $version 发布。`n`n- 安装包：双击 Setup.exe 安装`n- 免安装版：直接运行 TrmWrite.exe"
    draft       = $false
    prerelease  = $false
  } | ConvertTo-Json
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Method Post -Headers $headers -Body $body -ContentType 'application/json'
  Write-Host "Created release id=$($release.id)" -ForegroundColor Green
}

# Upload each asset (delete existing asset with same name first)
$uploadUrlBase = $release.upload_url -replace '\{\?name,label\}$', ''
foreach ($assetPath in $assets) {
  $fileName = [System.IO.Path]::GetFileName($assetPath)
  Write-Host "Uploading $fileName ..." -ForegroundColor Cyan

  # Delete existing asset with same name
  foreach ($a in $release.assets) {
    if ($a.name -eq $fileName) {
      Write-Host "  Deleting existing asset id=$($a.id)" -ForegroundColor Yellow
      Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($a.id)" -Method Delete -Headers $headers | Out-Null
    }
  }

  # Upload new asset
  $bytes = [System.IO.File]::ReadAllBytes($assetPath)
  $uploadUri = "$uploadUrlBase`?name=$fileName"
  $assetHeaders = $headers.Clone()
  $assetHeaders['Content-Type'] = 'application/octet-stream'
  $resp = Invoke-RestMethod -Uri $uploadUri -Method Post -Headers $assetHeaders -Body $bytes
  Write-Host "  Uploaded: $($resp.browser_download_url)" -ForegroundColor Green
}

# Refresh release object to get final asset list
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/$($release.id)" -Headers $headers
Write-Host ""
Write-Host "=== Release published ===" -ForegroundColor Green
Write-Host "Tag:     $tagName"
Write-Host "URL:     $($release.html_url)"
Write-Host "Assets:"
foreach ($a in $release.assets) {
  $sizeMb = [math]::Round($a.size / 1024 / 1024, 2)
  Write-Host "  - $($a.name) ($sizeMb MB) -> $($a.browser_download_url)"
}
