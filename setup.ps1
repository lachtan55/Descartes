#Requires -Version 5.1
<#
.SYNOPSIS
    Descartes -- one-shot dependency installer.

.DESCRIPTION
    Installs every dependency the project needs EXCEPT the Bloomberg Terminal
    application itself (which must be obtained from Bloomberg directly).

    What this script does:
      1.  Verifies Python >=3.10 is on PATH
      2.  Verifies Node.js >=18 is on PATH
      3.  Creates (or reuses) the Python virtual environment at .\venv
      4.  Upgrades pip inside the venv
      5.  Installs all pip packages from backend\requirements.txt
            FastAPI, uvicorn, yfinance, pandas, httpx, anthropic,
            google-genai, openai, pypdf, python-docx, openpyxl,
            nest_asyncio, python-multipart, ib_insync
      6.  Installs blpapi (Bloomberg Python SDK) -- three attempts:
            a. Bloomberg public pip index (no Terminal needed, requires internet)
            b. blpapi*.whl bundled in the repo root (offline fallback)
            c. Prints manual instructions if both fail
      7.  Installs npm packages in .\frontend (React, Vite, recharts,
            lightweight-charts, pocketbase SDK, react-pdf, mammoth, xlsx ...)
      8.  Downloads the PocketBase binary to .\Database\ if it is missing
      9.  Creates .\backend\.env from a template if it does not exist
      10. Creates .\frontend\.env from .env.example if it does not exist
      11. Prints a start-up cheat sheet

.NOTES
    Run from the project root:
        powershell -ExecutionPolicy Bypass -File .\setup.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Helpers ────────────────────────────────────────────────────────────────────

function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "   OK   $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "   WARN $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "   FAIL $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "        $msg" -ForegroundColor Gray }

$Root   = $PSScriptRoot
$VenvPy = Join-Path $Root "venv\Scripts\python.exe"

# ── Step 1 -- Python >=3.10 ───────────────────────────────────────────────────

Write-Step "1/11  Python >=3.10"

$pyCmd = Get-Command python  -ErrorAction SilentlyContinue
if (-not $pyCmd) { $pyCmd = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $pyCmd) {
    Write-Fail "Python not found on PATH."
    Write-Info "Download from https://www.python.org/downloads/ (>=3.10 required)"
    exit 1
}
$pyExe = $pyCmd.Source

$pyVer   = & $pyExe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>&1
$pyParts = $pyVer -split "\."
$pyMajor = [int]$pyParts[0]
$pyMinor = [int]$pyParts[1]

if ($pyMajor -lt 3 -or ($pyMajor -eq 3 -and $pyMinor -lt 10)) {
    Write-Fail "Python $pyVer found but >=3.10 is required."
    exit 1
}
Write-OK "Python $pyVer  ($pyExe)"

# ── Step 2 -- Node.js >=18 ────────────────────────────────────────────────────

Write-Step "2/11  Node.js >=18"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Fail "Node.js not found on PATH."
    Write-Info "Download from https://nodejs.org/ (LTS, >=18 required)"
    exit 1
}
$nodeExe   = $nodeCmd.Source
$nodeVer   = (& node --version) -replace "^v", ""
$nodeMajor = [int]($nodeVer -split "\.")[0]

if ($nodeMajor -lt 18) {
    Write-Fail "Node.js $nodeVer found but >=18 is required."
    exit 1
}
Write-OK "Node.js $nodeVer  ($nodeExe)"

# ── Step 3 -- Python virtual environment ──────────────────────────────────────

Write-Step "3/11  Python virtual environment"

if (Test-Path $VenvPy) {
    Write-OK "venv already exists -- reusing"
} else {
    Write-Info "Creating venv at .\venv ..."
    & $pyExe -m venv venv
    if (-not (Test-Path $VenvPy)) {
        Write-Fail "venv creation failed."
        exit 1
    }
    Write-OK "venv created"
}

# ── Step 4 -- Upgrade pip ─────────────────────────────────────────────────────

Write-Step "4/11  Upgrade pip"
& $VenvPy -m pip install --quiet --upgrade pip
Write-OK "pip up to date"

# ── Step 5 -- pip packages (all except blpapi) ────────────────────────────────

Write-Step "5/11  pip packages  (FastAPI, uvicorn, pandas, yfinance, httpx, anthropic,"
Write-Info "                    google-genai, openai, pypdf, python-docx, openpyxl,"
Write-Info "                    nest_asyncio, python-multipart, ib_insync, ...)"

# blpapi lives on Bloomberg's pip index, not PyPI -- handled separately in Step 6.
# Strip blpapi lines from requirements.txt and install everything else.
$reqPath    = Join-Path $Root "backend\requirements.txt"
$tmpReqPath = Join-Path $env:TEMP "descartes_requirements_noblp.txt"

Get-Content $reqPath |
    Where-Object { $_ -notmatch "^\s*blpapi" } |
    Out-File -FilePath $tmpReqPath -Encoding utf8

& $VenvPy -m pip install --quiet -r $tmpReqPath
if ($LASTEXITCODE -ne 0) {
    Write-Fail "pip install failed. See output above."
    Remove-Item $tmpReqPath -ErrorAction SilentlyContinue
    exit 1
}
Remove-Item $tmpReqPath -ErrorAction SilentlyContinue
Write-OK "All non-Bloomberg pip packages installed"

# ── Step 6 -- blpapi (Bloomberg Python SDK) ───────────────────────────────────

Write-Step "6/11  blpapi  (Bloomberg Python API SDK)"

$blpapiOK = $false

# 6a -- Bloomberg's public pip index.
#       Wheels bundle the C++ runtime -- no Terminal installation required.
#       Confirmed working without Bloomberg Terminal (tested May 2025).
Write-Info "Attempt 1/3 -- Bloomberg public pip index (blpapi.bloomberg.com) ..."
& $VenvPy -m pip install blpapi `
    --index-url https://blpapi.bloomberg.com/repository/releases/python/simple/ `
    --quiet 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-OK "blpapi installed from Bloomberg public pip index"
    $blpapiOK = $true
}

# 6b -- Local .whl file.
#       The repo ships blpapi-3.26.4.2-py3-none-win_amd64.whl in the project
#       root as an offline fallback (py3-none = Python-version-agnostic).
#       Also searches Downloads and Desktop in case a newer wheel was placed there.
if (-not $blpapiOK) {
    Write-Info "Attempt 2/3 -- searching for a local blpapi*.whl ..."
    $searchDirs = @(
        $Root,
        (Split-Path $Root -Parent),
        "$env:USERPROFILE\Downloads",
        "$env:USERPROFILE\Desktop"
    )
    $wheel = $null
    foreach ($dir in $searchDirs) {
        if (-not (Test-Path $dir)) { continue }
        $found = Get-ChildItem $dir -Filter "blpapi*.whl" -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending |
                 Select-Object -First 1
        if ($found) { $wheel = $found.FullName; break }
    }

    if ($wheel) {
        Write-Info "Found: $wheel"
        & $VenvPy -m pip install $wheel --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-OK "blpapi installed from local wheel"
            $blpapiOK = $true
        } else {
            Write-Warn "Wheel install failed (check Python version / architecture match)."
        }
    } else {
        Write-Info "No local wheel found."
    }
}

# 6c -- Manual instructions (non-fatal -- the app runs without blpapi)
if (-not $blpapiOK) {
    Write-Warn "blpapi NOT installed -- complete this step manually:"
    Write-Host ""
    Write-Host "  Option A  (internet, no Terminal needed):" -ForegroundColor Yellow
    Write-Host "    venv\Scripts\python.exe -m pip install blpapi ``" -ForegroundColor White
    Write-Host "      --index-url https://blpapi.bloomberg.com/repository/releases/python/simple/" -ForegroundColor White
    Write-Host ""
    Write-Host "  Option B  (offline -- use the wheel bundled in the repo root):" -ForegroundColor Yellow
    Write-Host "    venv\Scripts\python.exe -m pip install blpapi-3.26.4.2-py3-none-win_amd64.whl" -ForegroundColor White
    Write-Host ""
    Write-Host "  The app starts without blpapi -- Bloomberg options endpoints" -ForegroundColor Gray
    Write-Host "  return HTTP 503 until the package is installed." -ForegroundColor Gray
}

# ── Step 7 -- npm install ─────────────────────────────────────────────────────

Write-Step "7/11  npm packages  (React 19, Vite, TypeScript, recharts, lightweight-charts,"
Write-Info "                    pocketbase SDK, react-router-dom, react-pdf, mammoth, xlsx ...)"

$frontendDir = Join-Path $Root "frontend"
if (-not (Test-Path $frontendDir)) {
    Write-Fail "frontend\ directory not found."
    exit 1
}

Push-Location $frontendDir
try {
    npm install --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install failed."
        exit 1
    }
    Write-OK "npm packages installed"
} finally {
    Pop-Location
}

# ── Step 8 -- PocketBase binary ───────────────────────────────────────────────

Write-Step "8/11  PocketBase binary"

$pbPath = Join-Path $Root "Database\pocketbase.exe"

if (Test-Path $pbPath) {
    $pbVerRaw = (& $pbPath --version 2>&1) -join ""
    Write-OK "pocketbase.exe present  ($pbVerRaw)"
} else {
    Write-Info "Not found -- downloading latest release from GitHub ..."
    try {
        $release = Invoke-RestMethod `
            -Uri "https://api.github.com/repos/pocketbase/pocketbase/releases/latest" `
            -Headers @{ "User-Agent" = "Descartes-setup-script" }

        $asset = $release.assets |
                 Where-Object { $_.name -like "*windows_amd64*" } |
                 Select-Object -First 1

        if (-not $asset) {
            Write-Warn "No Windows asset found in latest PocketBase release."
        } else {
            $zipPath    = Join-Path $env:TEMP "pocketbase_latest.zip"
            $extractDir = Join-Path $env:TEMP "pocketbase_extract"
            Write-Info "Downloading $($asset.name) ..."
            Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -UseBasicParsing
            Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

            $pbExe = Get-ChildItem $extractDir -Filter "pocketbase.exe" -Recurse |
                     Select-Object -First 1
            if ($pbExe) {
                $dbDir = Join-Path $Root "Database"
                if (-not (Test-Path $dbDir)) { New-Item -ItemType Directory -Path $dbDir | Out-Null }
                Copy-Item $pbExe.FullName -Destination $pbPath -Force
                Write-OK "pocketbase.exe downloaded  ($($release.tag_name))"
            } else {
                Write-Warn "pocketbase.exe not found inside the downloaded archive."
            }
            Remove-Item $zipPath, $extractDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Warn "PocketBase download failed: $($_.Exception.Message)"
        Write-Info "Download manually from https://github.com/pocketbase/pocketbase/releases"
        Write-Info "Extract pocketbase.exe into .\Database\"
    }
}

# ── Step 9 -- backend\.env ────────────────────────────────────────────────────

Write-Step "9/11  backend\.env  (API keys)"

$backendEnvPath = Join-Path $Root "backend\.env"
if (Test-Path $backendEnvPath) {
    Write-OK "backend\.env already exists -- leaving untouched"
} else {
    @"
# Descartes -- backend environment variables
# Fill in the keys you need. Unused services degrade gracefully (no crash).

# ── AI providers ──────────────────────────────────────────────────────────────
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# ── Macro data sources ────────────────────────────────────────────────────────
# Free FRED key: https://fred.stlouisfed.org/docs/api/api_key.html  (Phase 4)
FRED_API_KEY=

# ── AI report model ───────────────────────────────────────────────────────────
# Must be the full versioned string. Verify at:
# https://docs.anthropic.com/en/docs/about-claude/models/overview
AI_REPORT_DEFAULT_MODEL=claude-sonnet-4-5-20251022

# ── Cache ─────────────────────────────────────────────────────────────────────
MACRO_DATA_CACHE_TTL_HOURS=24
"@ | Out-File -FilePath $backendEnvPath -Encoding utf8
    Write-OK "backend\.env created -- fill in your API keys before starting"
}

# ── Step 10 -- frontend\.env ──────────────────────────────────────────────────

Write-Step "10/11 frontend\.env  (Vite environment variables)"

$frontendEnvPath  = Join-Path $Root "frontend\.env"
$frontendEnvExample = Join-Path $Root "frontend\.env.example"

if (Test-Path $frontendEnvPath) {
    Write-OK "frontend\.env already exists -- leaving untouched"
} elseif (Test-Path $frontendEnvExample) {
    Copy-Item $frontendEnvExample -Destination $frontendEnvPath
    Write-OK "frontend\.env created from .env.example"
    Write-Info "Default: VITE_POCKETBASE_URL=http://127.0.0.1:8090  (change for remote PocketBase)"
} else {
    # .env.example missing -- write the one known variable directly
    @"
# Descartes frontend environment variables
# PocketBase URL used by the DATABASE module.
# Local dev: http://127.0.0.1:8090
# Remote:    https://db.yourdescartes.com
VITE_POCKETBASE_URL=http://127.0.0.1:8090
"@ | Out-File -FilePath $frontendEnvPath -Encoding utf8
    Write-OK "frontend\.env created with default PocketBase URL"
}

# ── Step 11 -- Summary ────────────────────────────────────────────────────────

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Setup complete.  Start order:" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. PocketBase  (terminal 1)" -ForegroundColor White
Write-Host "       cd Database" -ForegroundColor Gray
Write-Host "       .\pocketbase.exe serve" -ForegroundColor Gray
Write-Host "       Admin UI: http://127.0.0.1:8090/_/" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. FastAPI     (terminal 2)" -ForegroundColor White
Write-Host "       .\venv\Scripts\activate" -ForegroundColor Gray
Write-Host "       uvicorn backend.main:app --reload --port 8000" -ForegroundColor Gray
Write-Host "       API docs: http://localhost:8000/docs" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Frontend    (terminal 3)" -ForegroundColor White
Write-Host "       cd frontend" -ForegroundColor Gray
Write-Host "       npm run dev" -ForegroundColor Gray
Write-Host "       App: http://localhost:5173" -ForegroundColor Gray
Write-Host ""
Write-Host "  Health checks:" -ForegroundColor White
Write-Host "       http://localhost:8000/api/health  (FastAPI)" -ForegroundColor Gray
Write-Host "       http://localhost:8090/api/health  (PocketBase)" -ForegroundColor Gray

if (-not $blpapiOK) {
    Write-Host ""
    Write-Host "  NOTE: blpapi not installed -- see Step 6 output above." -ForegroundColor Yellow
    Write-Host "        Bloomberg options endpoints return HTTP 503 until it is." -ForegroundColor Yellow
}

$needsKeys = $false
if (Test-Path $backendEnvPath) {
    $envContent = Get-Content $backendEnvPath -Raw
    if ($envContent -match "GEMINI_API_KEY=\s*$" -or $envContent -match "ANTHROPIC_API_KEY=\s*$") {
        $needsKeys = $true
    }
}
if ($needsKeys) {
    Write-Host ""
    Write-Host "  NOTE: backend\.env has empty API keys." -ForegroundColor Yellow
    Write-Host "        Fill them in before starting FastAPI." -ForegroundColor Yellow
}

Write-Host ""
