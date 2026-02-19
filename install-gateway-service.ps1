# OpenClaw Gateway Windows Service Installer
# Run this script as Administrator

param(
    [string]$OpenClawPath = "D:\workspace\appDev\openclaw",
    [string]$ServiceName = "OpenClawGateway",
    [string]$NssmPath = "C:\Program Files\nssm\nssm.exe"
)

# Resolve wrapper script path
$WrapperScript = Join-Path $OpenClawPath "gateway-wrapper.bat"

# Validate paths
if (-not (Test-Path $WrapperScript)) {
    Write-Error "Wrapper script not found at $WrapperScript. Please ensure gateway-wrapper.bat exists."
    exit 1
}

if (-not (Test-Path $NssmPath)) {
    Write-Error "NSSM not found at $NssmPath.`nPlease install NSSM from https://nssm.cc/download`nExtract nssm.exe to $NssmPath or update the NssmPath parameter."
    exit 1
}

Write-Host "Installing Windows Service '$ServiceName' for OpenClaw Gateway..."
Write-Host "Wrapper: $WrapperScript"
Write-Host "NSSM: $NssmPath"

# Remove existing service if it exists
$existing = Get-Service $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Stopping and removing existing service..."
    Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
    & $NssmPath remove $ServiceName confirm 2>$null
}

# Install the service
Write-Host "Installing service via NSSM..."
& $NssmPath install $ServiceName "`"$WrapperScript`""

# Configure service startup type
Write-Host "Setting startup type to Automatic..."
& $NssmPath set $ServiceName Start SERVICE_AUTO_START

# Configure restart behavior
Write-Host "Configuring restart on failure (delay 5 seconds)..."
& $NssmPath set $ServiceName AppRestartDelay 5000
& $NssmPath set $ServiceName AppExit Default Restart

# Optional: Set shutdown timeout (default is 5000 ms)
Write-Host "Setting shutdown timeout to 5 seconds..."
& $NssmPath set $ServiceName AppShutdownTimeout 5000

# Optional: Set working directory (helps with relative paths)
Write-Host "Setting working directory to $OpenClawPath..."
& $NssmPath set $ServiceName AppDirectory "$OpenClawPath"

# IMPORTANT: Configure user profile environment so gateway finds ~/.openclaw config
# The service runs as LocalSystem by default. We set USERPROFILE/HOME to the current user's profile
$currentUserProfile = [Environment]::GetFolderPath('UserProfile')
Write-Host "Setting USERPROFILE and HOME to '$currentUserProfile' for config location..."
& $NssmPath set $ServiceName AppEnvironment "USERPROFILE=$currentUserProfile"
& $NssmPath set $ServiceName AppEnvironment "HOME=$currentUserProfile"

# Also add Node.js to PATH if not in system PATH (optional, uncomment if needed)
# $nodePath = "C:\Program Files\nodejs"
# & $NssmPath set $ServiceName AppEnvironment "PATH=$nodePath;%PATH%"

# Optionally, set NODE_ENV=production
& $NssmPath set $ServiceName AppEnvironment "NODE_ENV=production"

# Configure NSSM logging
Write-Host "Configuring NSSM logging..."
$logDir = "C:\OpenClaw\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
& $NssmPath set $ServiceName AppStdout "$logDir\gateway-stdout.log"
& $NssmPath set $ServiceName AppStderr "$logDir\gateway-stderr.log"
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateBytes 1048576
& $NssmPath set $ServiceName AppRotateOnline 1

Write-Host "`nService installed successfully."
Write-Host "Starting service..."
Start-Service $ServiceName

# Wait a moment and then check status
Start-Sleep -Seconds 2
$svc = Get-Service $ServiceName
Write-Host "Service status: $($svc.Status)"

Write-Host "`nVerification:"
Write-Host "Check logs: C:\OpenClaw\logs\gateway-stdout.log and gateway-stderr.log"
Write-Host "To stop the service: Stop-Service $ServiceName"
Write-Host "To uninstall: & `"$NssmPath`" remove $ServiceName confirm"
Write-Host "To view service properties: Get-Service $ServiceName | Format-List *"