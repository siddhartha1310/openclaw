param(
  [switch]$NoTui
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Force OpenClaw runtime state/config to this project folder (D: drive).
$stateRoot = Join-Path $root ".openclaw-state"
$configPath = Join-Path $stateRoot "openclaw.json"
$agentDir = Join-Path $stateRoot "agents\\pluto\\agent"
$tmpDir = Join-Path $stateRoot "tmp"
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

$env:OPENCLAW_STATE_DIR = $stateRoot
$env:OPENCLAW_CONFIG_PATH = $configPath
$env:OPENCLAW_AGENT_DIR = $agentDir
$env:TEMP = $tmpDir
$env:TMP = $tmpDir

# One-time migration from legacy user-profile state.
$legacyState = Join-Path $HOME ".openclaw"
if (-not (Test-Path $configPath) -and (Test-Path $legacyState)) {
  $null = robocopy $legacyState $stateRoot /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
}

# Keep provider key available for child node processes.
$userOpenRouter = [Environment]::GetEnvironmentVariable("OPENROUTER_API_KEY", "User")
if (-not [string]::IsNullOrWhiteSpace($userOpenRouter)) {
  $env:OPENROUTER_API_KEY = $userOpenRouter
}

$port = 18789
$listening = netstat -ano | Select-String "127.0.0.1:$port" | Select-String "LISTENING"
if (-not $listening) {
  Start-Process -FilePath node -ArgumentList @("openclaw.mjs", "gateway", "run", "--bind", "loopback", "--port", "$port") -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 4
}

if (-not $NoTui) {
  # Interactive CLI session.
  & node openclaw.mjs tui
}
