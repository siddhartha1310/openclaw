@echo off
setlocal
cd /d "%~dp0"

set "OPENCLAW_STATE_DIR=%~dp0.openclaw-state"
set "OPENCLAW_CONFIG_PATH=%OPENCLAW_STATE_DIR%\openclaw.json"
set "OPENCLAW_AGENT_DIR=%OPENCLAW_STATE_DIR%\agents\pluto\agent"
set "TMP=%OPENCLAW_STATE_DIR%\tmp"
set "TEMP=%OPENCLAW_STATE_DIR%\tmp"

if not exist "%OPENCLAW_STATE_DIR%" mkdir "%OPENCLAW_STATE_DIR%"
if not exist "%TMP%" mkdir "%TMP%"

if not exist "%OPENCLAW_CONFIG_PATH%" (
  if exist "%USERPROFILE%\.openclaw" (
    robocopy "%USERPROFILE%\.openclaw" "%OPENCLAW_STATE_DIR%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
  )
)

node "%~dp0openclaw.mjs" %*
