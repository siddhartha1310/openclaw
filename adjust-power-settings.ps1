# Adjust Windows Power Settings for OpenClaw Gateway
# Run as Administrator to modify system power configuration

Write-Host "Current Power Scheme:" -ForegroundColor Cyan
powercfg /list | Select-String "*"

Write-Host "`nAdjusting power settings to reduce aggressive sleep..." -ForegroundColor Yellow

# Set system sleep timeout to 0 (never) on AC power
powercfg -change -standby-timeout-ac 0
Write-Host "Set AC sleep timeout to Never."

# Set system sleep timeout to 0 (never) on battery (if applicable)
powercfg -change -standby-timeout-dc 0
Write-Host "Set DC (battery) sleep timeout to Never."

# Disable hibernate (optional, as it can also stop services)
powercfg -change -hibernate-timeout-ac 0
powercfg -change -hibernate-timeout-dc 0
Write-Host "Disabled hibernate."

# Allow wake timers (so the system can wake for scheduled tasks)
powercfg -change -wake-timers-ac Enable
powercfg -change -wake-timers-dc Enable
Write-Host "Enabled wake timers."

# Alternatively, you can set the monitor to turn off but keep system awake:
# powercfg -change -monitor-timeout-ac 15

Write-Host "`nPower settings updated. You can check with:" -ForegroundColor Green
Write-Host "  powercfg /a  (shows available sleep states)"
Write-Host "  powercfg /query  (shows current settings)"

Write-Host "`nIMPORTANT: If you prefer not to change global power settings," -ForegroundColor Yellow
Write-Host "you can rely on the service restart behavior: NSSM will restart the gateway quickly after wake."

Write-Host "`nPower settings adjustment complete." -ForegroundColor Green