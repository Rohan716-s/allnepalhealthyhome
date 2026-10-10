param(
    [switch]$WhatIf
)

# Native Git warnings must not become terminating PowerShell errors. Git exit
# codes are checked explicitly in Invoke-Git and the direct diff checks below.
$ErrorActionPreference = 'Continue'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$expectedOrigin = 'https://github.com/Rohan716-s/allnepalhealthyhome.git'

function Send-Result([string]$Message) {
    @{ continue = $true; systemMessage = $Message } | ConvertTo-Json -Compress
}

function Invoke-Git([string[]]$GitArguments) {
    $output = & git -C $repoRoot @GitArguments 2>$null
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "git $($GitArguments[0]) failed with exit code $exitCode"
    }
    return @($output)
}

function Test-ExcludedPath([string]$Path) {
    $normalized = $Path.Replace('\', '/')
    $leaf = [IO.Path]::GetFileName($normalized)
    if ($normalized -eq 'frontend/scripts/.tmp-debug-list.mjs') { return $true }
    if ($leaf -match '^\.env($|\.(?!example$))') { return $true }
    if ($normalized -match '(?i)(^|/)App_Data(/|$)') { return $true }
    if ($normalized -match '(?i)\.(key|pem|pfx|p12|crt|cer|der|p7b|p7c)$') { return $true }
    return $false
}

function Get-TextFromWorkingTree([string]$Path) {
    $fullPath = Join-Path $repoRoot $Path
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { return $null }
    $item = Get-Item -LiteralPath $fullPath
    if ($item.Length -gt 15000000) { return $null }
    $textExtensions = @('.cs','.csproj','.ts','.tsx','.js','.mjs','.cjs','.json','.md','.sql','.yml','.yaml','.toml','.xml','.html','.css','.sh','.ps1','.py','.txt','.csv','.config','.dockerignore','.gitignore')
    if ($textExtensions -notcontains $item.Extension.ToLowerInvariant() -and $item.Name -notin @('.gitignore','.dockerignore')) { return $null }
    return [IO.File]::ReadAllText($fullPath)
}

function Get-TextFromIndex([string]$Path) {
    $item = Get-Item -LiteralPath (Join-Path $repoRoot $Path) -ErrorAction SilentlyContinue
    if ($item -and $item.Length -gt 15000000) { return $null }
    $extension = [IO.Path]::GetExtension($Path).ToLowerInvariant()
    $textExtensions = @('.cs','.csproj','.ts','.tsx','.js','.mjs','.cjs','.json','.md','.sql','.yml','.yaml','.toml','.xml','.html','.css','.sh','.ps1','.py','.txt','.csv','.config','.dockerignore','.gitignore')
    $leaf = [IO.Path]::GetFileName($Path)
    if ($textExtensions -notcontains $extension -and $leaf -notin @('.gitignore','.dockerignore')) { return $null }
    $output = & git -C $repoRoot show ":$Path" 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return ($output -join "`n")
}

function Find-SecretPatterns([string]$Text) {
    $patterns = [ordered]@{
        'private key' = '-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----'
        'AWS access key' = '\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'
        'GitHub token' = '\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})\b'
        'Slack token' = '\bxox[baprs]-[A-Za-z0-9-]{20,}\b'
        'JWT token' = '\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b'
        'long credential literal' = '(?im)\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|jwt[_-]?secret|password)\s*[:=]\s*["''][A-Za-z0-9/+_=-]{24,}["'']'
    }
    foreach ($entry in $patterns.GetEnumerator()) {
        if ($Text -match $entry.Value) { return $entry.Key }
    }
    return $null
}

try {
    $origin = (Invoke-Git @('remote','get-url','origin') | Select-Object -First 1).Trim()
    if ($origin -ne $expectedOrigin) {
        Send-Result 'Auto-push skipped: origin is not the configured All Nepal Healthy Home GitHub repository.'
        exit 0
    }

    $branch = (Invoke-Git @('symbolic-ref','--quiet','--short','HEAD') | Select-Object -First 1).Trim()
    if ([string]::IsNullOrWhiteSpace($branch)) {
        Send-Result 'Auto-push skipped: the repository is in detached-HEAD state.'
        exit 0
    }

    $cached = & git -C $repoRoot diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        Send-Result 'Auto-push skipped: staged changes already exist; they were left untouched.'
        exit 0
    }
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the Git index.' }

    $candidatePaths = @(
        (Invoke-Git @('diff','--name-only','--diff-filter=ACDMRT'))
        (Invoke-Git @('ls-files','--others','--exclude-standard'))
    ) | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Sort-Object -Unique

    $approvedPaths = @()
    $excludedCount = 0
    foreach ($path in $candidatePaths) {
        if (Test-ExcludedPath $path) {
            $excludedCount++
            continue
        }
        $file = Get-Item -LiteralPath (Join-Path $repoRoot $path) -ErrorAction SilentlyContinue
        if ($file -and -not $file.PSIsContainer -and $file.Length -ge 95000000) {
            $excludedCount++
            continue
        }
        $approvedPaths += $path
    }

    if ($approvedPaths.Count -eq 0) {
        Send-Result 'Auto-push found no eligible project changes.'
        exit 0
    }

    foreach ($path in $approvedPaths) {
        $text = Get-TextFromWorkingTree $path
        if ($null -eq $text) { continue }
        $finding = Find-SecretPatterns $text
        if ($finding) {
            Send-Result "Auto-push skipped: a $finding pattern was found in $path; review it before pushing."
            exit 0
        }
    }

    if ($WhatIf) {
        $message = "Auto-push dry run: would commit $($approvedPaths.Count) eligible paths on '$branch' and push to origin."
        if ($excludedCount -gt 0) { $message += " Skipped $excludedCount excluded or oversized paths." }
        Send-Result $message
        exit 0
    }

    Invoke-Git @('add','-A','--','.') | Out-Null
    $stagedPaths = @(Invoke-Git @('diff','--cached','--name-only','--diff-filter=ACMR')) | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    foreach ($path in $stagedPaths) {
        if (Test-ExcludedPath $path) {
            & git -C $repoRoot reset -q -- $path 2>$null
        }
    }
    $stagedPaths = @(Invoke-Git @('diff','--cached','--name-only','--diff-filter=ACMR')) | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    if ($stagedPaths.Count -eq 0) {
        Send-Result 'Auto-push found no eligible staged project changes.'
        exit 0
    }

    foreach ($path in $stagedPaths) {
        $text = Get-TextFromIndex $path
        if ($null -eq $text) { continue }
        $finding = Find-SecretPatterns $text
        if ($finding) {
            & git -C $repoRoot reset -q 2>$null
            Send-Result "Auto-push skipped: a $finding pattern was found in $path; staged changes were returned to the worktree."
            exit 0
        }
    }

    $whitespaceCheck = & git -C $repoRoot diff --cached --check 2>&1
    if ($LASTEXITCODE -ne 0) {
        & git -C $repoRoot reset -q 2>$null
        Send-Result 'Auto-push skipped: Git found whitespace errors; changes remain in the worktree.'
        exit 0
    }

    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
    Invoke-Git @('commit','-m',"Automated project updates $stamp") | Out-Null
    try {
        Invoke-Git @('push','--set-upstream','origin',$branch) | Out-Null
    }
    catch {
        Send-Result 'Local commit succeeded, but push failed. The commit is preserved; check GitHub authentication or remote divergence.'
        exit 0
    }

    Send-Result "Auto-push succeeded: committed and pushed $($stagedPaths.Count) paths on '$branch'."
    exit 0
}
catch {
    $detail = $_.Exception.Message -replace '[\r\n]+', ' '
    if ($detail.Length -gt 180) { $detail = $detail.Substring(0, 180) }
    Send-Result "Auto-push could not complete ($detail). Changes remain available locally; inspect Git status and authentication."
    exit 0
}
