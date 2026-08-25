<#
Installs docling-service as a persistent Windows Service via NSSM, so it
survives reboots and restarts itself if it crashes (systemd's job on Linux).

Prereqs, run once on the target Windows machine first:
  python -m venv .venv
  .venv\Scripts\pip install -r requirements.txt
  winget install NSSM.NSSM   (or: choco install nssm, or download from nssm.cc)

Then, from inside this folder (services/docling-service), in an
Administrator PowerShell:
  .\install-windows-service.ps1
#>
param(
    [string]$ServiceName = "DoclingService",
    [int]$Port = 8100
)

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot

$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssm) {
    Write-Host "nssm not found on PATH. Install it first (winget install NSSM.NSSM), then re-run this script." -ForegroundColor Yellow
    exit 1
}

$uvicorn = Join-Path $here ".venv\Scripts\uvicorn.exe"
if (-not (Test-Path $uvicorn)) {
    Write-Host "$uvicorn not found — run '.venv\Scripts\pip install -r requirements.txt' first." -ForegroundColor Yellow
    exit 1
}

$logsDir = Join-Path $here "logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

nssm install $ServiceName $uvicorn "main:app --host 0.0.0.0 --port $Port"
nssm set $ServiceName AppDirectory $here
nssm set $ServiceName Start SERVICE_AUTO_START
nssm set $ServiceName AppStdout (Join-Path $logsDir "stdout.log")
nssm set $ServiceName AppStderr (Join-Path $logsDir "stderr.log")
nssm set $ServiceName AppRotateFiles 1

try {
    New-NetFirewallRule -DisplayName "Docling Service" -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -ErrorAction Stop | Out-Null
} catch {
    Write-Host "Could not add the firewall rule automatically ($($_.Exception.Message)) — add one manually for port $Port." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Service '$ServiceName' installed but not started yet. Before starting it:" -ForegroundColor Cyan
Write-Host "  1. Set the shared secret machine-wide (services read env vars at start, so do this before step 2):"
Write-Host "       setx DOCLING_SHARED_SECRET `"<pick-a-random-string>`" /M"
Write-Host "  2. Start it:"
Write-Host "       nssm start $ServiceName"
Write-Host "  3. Verify:"
Write-Host "       Invoke-RestMethod http://localhost:$Port/health"
Write-Host ""
Write-Host "To remove later: nssm stop $ServiceName; nssm remove $ServiceName confirm"
