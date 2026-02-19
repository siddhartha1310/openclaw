Write-Host "=== Searching for OpenClaw launchers ==="
Write-Host "`nScheduled tasks containing 'openclaw' or 'gateway':"
Get-ScheduledTask | Where-Object { $_.TaskName -like '*openclaw*' -or $_.TaskName -like '*gateway*' } | Select-Object TaskName, State, @{n='Trigger';e={($_.Triggers | Select-Object -First 1).ToString()}}, @{n='Action';e={($_.Actions | Select-Object -ExpandProperty Execute) -join ','}} | Format-Table -AutoSize

Write-Host "`nStartup folder items:"
$startup = [Environment]::GetFolderPath('Startup')
Get-ChildItem $startup | Select-Object Name, FullName | Format-Table -AutoSize

Write-Host "`nRunning processes with 'openclaw' or 'gateway' in command line:"
Get-Process | Where-Object { $_.CommandLine -match 'openclaw' -or $_.CommandLine -match 'gateway' } | Select-Object Id, ProcessName, CommandLine | Format-List

Write-Host "`nServices containing 'openclaw' or 'gateway':"
Get-CimInstance Win32_Service | Where-Object { $_.Name -like '*openclaw*' -or $_.Name -like '*gateway*' } | Select-Object Name, DisplayName, State, StartMode | Format-List

Write-Host "`nDone. Check above for any suspicious entries and disable/remove them."