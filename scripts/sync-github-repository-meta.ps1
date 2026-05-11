#Requires -Version 5.1
<#
.SYNOPSIS
  Sets GitHub repository description (About) and topics via REST API.

.DESCRIPTION
  GitHub UI: About + Topics. This script does the same without needing the gh CLI.
  Create a Personal Access Token (classic) with `public_repo`, or a fine-grained token
  with Contents: Read and Administration: Read and write for this repository.

.EXAMPLE
  $env:GITHUB_TOKEN = "ghp_..."   # never commit tokens
  ./scripts/sync-github-repository-meta.ps1

.EXAMPLE
  $env:GITHUB_TOKEN = "ghp_..."
  $env:GITHUB_HOMEPAGE = "https://your-render-app.onrender.com"
  ./scripts/sync-github-repository-meta.ps1 -Owner "youruser" -Repo "interviewAvatar"
#>
param(
    [string] $Owner = "stato10",
    [string] $Repo = "interviewAvatar"
)

$ErrorActionPreference = "Stop"

if (-not $env:GITHUB_TOKEN -or $env:GITHUB_TOKEN.Trim() -eq "") {
    Write-Host "Missing GITHUB_TOKEN." -ForegroundColor Yellow
    Write-Host "See README (GitHub repository settings) or use the About gear on GitHub.`n"
    Write-Host "To use this script:"
    Write-Host "  `$env:GITHUB_TOKEN = '<PAT-with-repo-scope>'"
    Write-Host "  ./scripts/sync-github-repository-meta.ps1"
    exit 1
}

$description = 'AI interview coaching platform with real-time voice & vision - FastAPI, LiveKit, GPT-4o, React.'
$homepage = if ($env:GITHUB_HOMEPAGE) { $env:GITHUB_HOMEPAGE } else { "" }

$topicNames = @(
    "python", "fastapi", "react", "typescript", "livekit",
    "openai", "ai", "interview", "webrtc", "hebrew"
)

$headers = @{
    Authorization             = "Bearer $($env:GITHUB_TOKEN.Trim())"
    Accept                    = "application/vnd.github+json"
    "X-GitHub-Api-Version"    = "2022-11-28"
}

$topicHeaders = @{
    Authorization             = "Bearer $($env:GITHUB_TOKEN.Trim())"
    Accept                    = "application/vnd.github+json"
    "X-GitHub-Api-Version"    = "2022-11-28"
}

$topicHeadersMercy = @{
    Authorization             = "Bearer $($env:GITHUB_TOKEN.Trim())"
    Accept                    = "application/vnd.github.mercy-preview+json"
    "X-GitHub-Api-Version"    = "2022-11-28"
}

$base = "https://api.github.com/repos/$Owner/$Repo"

Write-Host "PATCH $base (description + homepage)..."
$patchBodyObj = @{ description = $description }
if ($homepage) { $patchBodyObj.homepage = $homepage }
$patchBody = $patchBodyObj | ConvertTo-Json
Invoke-RestMethod -Uri $base -Method Patch -Headers $headers -Body $patchBody -ContentType "application/json; charset=utf-8" | Out-Null

Write-Host ("PUT $($base)/topics [{0} topic(s)]..." -f $topicNames.Count)
$topicsBody = @{ names = $topicNames } | ConvertTo-Json -Compress
try {
    Invoke-RestMethod -Uri "$base/topics" -Method Put -Headers $topicHeaders -Body $topicsBody -ContentType "application/json; charset=utf-8" | Out-Null
} catch {
    Invoke-RestMethod -Uri "$base/topics" -Method Put -Headers $topicHeadersMercy -Body $topicsBody -ContentType "application/json; charset=utf-8" | Out-Null
}

Write-Host ("Done. Refresh https://github.com/{0}/{1} - About and Topics should be updated." -f $Owner, $Repo) -ForegroundColor Green
