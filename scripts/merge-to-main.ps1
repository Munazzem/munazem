# Merge into main in order (run from repo root or any folder)
# 1) Run: gh auth login   (once, in a terminal where gh works, or after step 2)
# 2) Run from project folder: .\scripts\merge-to-main.ps1

$ErrorActionPreference = "Stop"

# Go to repo root (parent of scripts folder)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
if (-not (Test-Path (Join-Path $repoRoot ".git"))) {
    Write-Error "Repo root not found (no .git in $repoRoot). Run this script from inside monazem."
    exit 1
}
Set-Location $repoRoot
Write-Host "Working in: $repoRoot"

# Find gh (GitHub CLI) - use PATH or common Windows install paths (C: and D:)
$gh = $null
if (Get-Command gh -ErrorAction SilentlyContinue) { $gh = "gh" }
else {
    $paths = @(
        "${env:ProgramFiles}\GitHub CLI\gh.exe",
        "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe",
        "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe",
        "D:\Program Files\GitHub CLI\gh.exe",
        "D:\Program Files (x86)\GitHub CLI\gh.exe",
        "D:\github cli\gh.exe"
    )
    foreach ($p in $paths) {
        if ($p -and (Test-Path $p)) { $gh = $p; break }
    }
}
if (-not $gh) {
    Write-Error "GitHub CLI (gh) not found. Install from https://cli.github.com/ and run this script again."
    exit 1
}
Write-Host "Using: $gh"
$repo = "munazem-system/munazem"
$base = "main"

# Order: branches to merge into main, one by one (first = first PR to create & merge)
$branchesInOrder = @(
    "feat/deploy-ready"
    # Add more here if you want to merge other branches after, e.g.:
    # "fix/ux-improvements"
)

foreach ($branch in $branchesInOrder) {
    Write-Host "`n--- $branch -> $base ---"
    $pr = & $gh pr list --base $base --head $branch --repo $repo --json number,state -q ".[0]"
    if ($pr) {
        $num = $pr.number
        $state = $pr.state
        if ($state -eq "OPEN") {
            Write-Host "Merging existing PR #$num ($branch -> $base)..."
            & $gh pr merge $num --repo $repo --merge
            Write-Host "Merged PR #$num."
        } elseif ($state -eq "MERGED") {
            Write-Host "PR #$num already merged. Skipping."
        } else {
            Write-Host "PR #$num state: $state. Skipping."
        }
    } else {
        Write-Host "Creating PR: $branch -> $base..."
        $createOut = & $gh pr create --base $base --head $branch --repo $repo --title "Merge $branch into $base" --body "Merge branch $branch into $base (ordered merge)." 2>&1 | Out-String
        $newPr = $null
        if ($createOut -match '/pull/(\d+)') { $newPr = $Matches[1] }
        if ($newPr) {
            Write-Host "Merging new PR #$newPr..."
            & $gh pr merge $newPr --repo $repo --merge
            Write-Host "Merged PR #$newPr."
        } else {
            Write-Host "Failed to create or merge PR for $branch. Output: $createOut"
            exit 1
        }
    }
}

Write-Host "`nDone. All branches merged into $base in order."
