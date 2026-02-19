# Quick Start: OpenClaw Gateway as Windows Service

## Prerequisites
- NSSM (Non-Sucking Service Manager) installed. Get it from https://nssm.cc/download
  Extract `nssm.exe` to `C:\Program Files\nssm\nssm.exe` (or adjust script)
- Node.js installed and in PATH (or edit wrapper to use full path to node.exe)
- OpenClaw project built (`dist/entry.js` exists)
- Gateway configuration already set up (credentials, etc.)

## Step 1: Prepare Wrapper Script

The `gateway-wrapper.bat` file is provided. Review and edit these variables if needed:
```
set OPENCLAW_PATH=D:\workspace\appDev\openclaw
set GATEWAY_PORT=18789
set GATEWAY_BIND=127.0.0.1
```

## Step 2: Install Service

Run PowerShell as **Administrator** and execute:

```powershell
.\install-gateway-service.ps1
```

Optional parameters:
```powershell
.\install-gateway-service.ps1 -OpenClawPath "D:\Software\codex" -ServiceName "OpenClawGateway" -NssmPath "C:\nssm.exe"
```

The script will:
- Remove any existing OpenClawGateway service
- Install new service using NSSM
- Configure automatic startup and restart on failure (5s delay)
- Set working directory
- Configure log rotation (1 MB, 1 file)
- Start the service

## Step 3: Verify Service

Check service status:
```powershell
Get-Service OpenClawGateway
```

View recent logs:
```powershell
Get-Content C:\OpenClaw\logs\gateway-stdout.log -Tail 20
Get-Content C:\OpenClaw\logs\gateway-stderr.log -Tail 20
```

If the service failed to start, check the NSSM error output or Windows Event Viewer.

## Step 4: Test Sleep/Wake

1. Ensure the gateway is running and WhatsApp channel is connected (check OpenClaw UI or logs).
2. Put the laptop to sleep (Start menu > Power > Sleep or close lid).
3. Wait 10-30 seconds.
4. Wake the laptop.
5. Immediately check:
   - Service status: `Get-Service OpenClawGateway` should be Running.
   - Logs: Look for gateway restart or continuation.
   - WhatsApp connectivity: Send a test message to your own number or check the gateway log for "WhatsApp connected".

Expected: The service remains running or quickly restarts (within a few seconds). WhatsApp automatically reconnects.

If the service stopped during sleep, Windows should automatically restart it (since it's set to automatic). NSSM will relaunch the gateway immediately.

## Optional: Adjust Power Settings (Prevent Sleep)

If you prefer the laptop not to sleep at all (to avoid any interruption), run as Administrator:

```powershell
.\adjust-power-settings.ps1
```

This sets sleep timeouts to Never and enables wake timers. You can later revert via Power Options control panel.

**Note**: Disabling sleep may reduce battery life on laptops.

## Troubleshooting

- **"node is not recognized"**: Edit `gateway-wrapper.bat` to use full path to `node.exe`, e.g.:
  ```
  "C:\Program Files\nodejs\node.exe" "%OPENCLAW_PATH%\openclaw.mjs" gateway run ...
  ```
  Or set NSSM environment: `& $NssmPath set $ServiceName AppEnvironment "PATH=C:\Program Files\nodejs;%PATH%"`

- **Port already in use**: Change `GATEWAY_PORT` in wrapper to an available port and update any clients accordingly.

- **Permission denied on logs**: Ensure `C:\OpenClaw` and subfolders are writable by the service account (LocalSystem by default). The install script creates them.

- **Gateway fails to start**: Check the stdout and stderr logs for errors. Common issues: missing `dist/entry.js`, configuration not found, or credentials expired.

- **Service does not restart after crash**: Confirm NSSM restart settings: `& $NssmPath open $ServiceName` to open the NSSM GUI and check the "Shutdown" and "Exit" actions are set to "Restart".

- **WhatsApp does not reconnect after wake**: This is a gateway issue. Ensure you have a stable network. The gateway should attempt reconnection automatically. If not, check the WhatsApp channel code for WebSocket/Puppeteer handling of network changes.

## Uninstall

```powershell
Stop-Service OpenClawGateway -Force
& "C:\Program Files\nssm\nssm.exe" remove OpenClawGateway confirm
```

Remove log files if desired: `Remove-Item -Recurse -Force C:\OpenClaw`

## Files

- `gateway-wrapper.bat` - Service wrapper that launches the gateway
- `install-gateway-service.ps1` - Installer script
- `adjust-power-settings.ps1` - Optional power settings tweaks
- `SERVICE_SETUP.md` - Detailed documentation

## Support

For issues specific to NSSM: https://nssm.cc/usage
For OpenClaw issues: https://github.com/openclaw/openclaw
