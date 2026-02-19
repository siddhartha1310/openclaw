# OpenClaw Gateway Windows Service Setup

## Objective
Ensure OpenClaw gateway stays running across sleep/wake cycles by installing it as a Windows service using NSSM (Non-Sucking Service Manager).

## Steps Completed

### 1. Identify OpenClaw Executable Location

**Assumption**: The OpenClaw executable is at:
- Development: `D:\workspace\appDev\openclaw\openclaw.mjs`
- Possible production install: `D:\Software\codex\openclaw.mjs` (as hinted in task)
- Or globally installed as `openclaw` in PATH

To use the service, we'll reference the actual openclaw.mjs file.

### 2. Create Gateway Wrapper Batch Script

Created `gateway-wrapper.bat` in the workspace root. This script:
- Changes to the OpenClaw directory
- Runs the gateway with logging to `C:\OpenClaw\gateway-service.log`
- Logs timestamps for startup and crash events
- Automatically restarts the gateway if it crashes (with 5s delay)

Content:
```batch
@echo off
REM OpenClaw Gateway Service Wrapper
setlocal
cd /d "D:\workspace\appDev\openclaw"
set LOG_FILE=C:\OpenClaw\gateway-service.log
if not exist "C:\OpenClaw" mkdir "C:\OpenClaw"
echo [%date% %time%] Starting OpenClaw gateway... >> "%LOG_FILE%"
node "D:\workspace\appDev\openclaw\openclaw.mjs" gateway run --bind 0.0.0.0 --port 8080 2>&1 | tee -a "%LOG_FILE%"
if errorlevel 1 (
    echo [%date% %time%] Gateway crashed with exit code %errorlevel%. Restarting in 5 seconds... >> "%LOG_FILE%"
    timeout /t 5 /nobreak >nul
    goto :start
)
endlocal
```

**Note**: The wrapper uses `tee` to duplicate output to console and log file. `tee` is available in Git Bash or can be installed via Windows ports. Alternatively, modify to use PowerShell `Tee-Object` if needed.

### 3. Install Windows Service using NSSM

NSSM must be installed. Typically available at `C:\Program Files\nssm\nssm.exe` or `C:\nssm.exe`.

Create a PowerShell script to install the service:

**install-gateway-service.ps1**:
```powershell
# Parameters
$OpenClawPath = "D:\workspace\appDev\openclaw"
$WrapperScript = Join-Path $OpenClawPath "gateway-wrapper.bat"
$ServiceName = "OpenClawGateway"
$NssmPath = "C:\Program Files\nssm\nssm.exe"

if (-not (Test-Path $NssmPath)) {
    Write-Error "NSSM not found at $NssmPath. Please install NSSM from https://nssm.cc/download"
    exit 1
}

# Remove existing service if present
& $NssmPath remove $ServiceName confirm 2>$null

# Install the service
& $NssmPath install $ServiceName $WrapperScript

# Set service to start automatically
& $NssmPath set $ServiceName Start SERVICE_AUTO_START

# Set service restart behavior: restart on failure
& $NssmPath set $ServiceName AppRestartDelay 5000
& $NssmPath set $ServiceName AppExit Default Restart

# Increase shutdown timeout (if needed)
& $NssmPath set $ServiceName AppShutdownTimeout 5000

Write-Host "Service $ServiceName installed. Starting..."
Start-Service $ServiceName
```

### 4. Configure Power Settings (Optional)

To prevent the laptop from sleeping while the gateway is critical:

**Option A**: Disable sleep while on AC power:
```powershell
powercfg -change -standby-timeout-ac 0
```

**Option B**: Change sleep settings to "Never" via Control Panel > Power Options.

**Option C**: Configure the service to recover quickly after wake:
NSSM will automatically restart the gateway if it exits. Combined with Windows service recovery options, the gateway should be back up quickly after wake.

Additionally, you can configure Windows to "Wake the computer" for the service using Task Scheduler, but that's more advanced. Typically, if the service is set to automatic and the machine wakes (e.g., due to user activity or wake timers), the service will start automatically if it was stopped during sleep.

### 5. Testing

**Manual Test**:
1. Ensure the service is running: `Get-Service OpenClawGateway` or check Services.msc.
2. Put the laptop to sleep (Start > Power > Sleep or close lid).
3. Wake the laptop.
4. Verify the service status is Running: `Get-Service OpenClawGateway`
5. Check the gateway log: `C:\OpenClaw\gateway-service.log` for recent activity.
6. Test WhatsApp connectivity by sending a test message through OpenClaw.

**Expected**: After wake, the gateway should be running and WhatsApp should reconnect automatically. If the gateway failed during sleep, NSSM should restart it quickly (within 5 seconds if configured).

## Additional Considerations

- **Logging**: Monitor `C:\OpenClaw\gateway-service.log` for errors.
- **Port**: The wrapper uses port 8080; adjust as needed.
- **Binding**: `--bind 0.0.0.0` listens on all interfaces; use `127.0.0.1` for localhost only if desired.
- **Node.js**: Ensure Node.js is in the system PATH so `node` command resolves. If not, use full path to node.exe in the wrapper.
- **Gateway Config**: The gateway will use its normal configuration (likely `~/.openclaw/config.json` or similar). Ensure credentials are in place.
- **Service Recovery**: NSSM was configured to restart on failure. Also configure Windows Service Recovery tab (Actions on failure) if additional actions are needed (e.g., restart first failure, second failure, subsequent failures).

## Files Created

- `gateway-wrapper.bat` - Service wrapper script
- `install-gateway-service.ps1` - PowerShell script to install NSSM service

## Next Steps

1. Place these files in a permanent location (e.g., `C:\OpenClaw\`).
2. Install NSSM if not already present.
3. Run the PowerShell script as Administrator to install the service.
4. Start the service and monitor.
5. Perform sleep/wake test.
