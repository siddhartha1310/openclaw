@echo off
REM OpenClaw Gateway Service Wrapper
setlocal

REM Configuration - adjust as needed
set OPENCLAW_PATH=D:\workspace\appDev\openclaw
set GATEWAY_PORT=18789
set GATEWAY_BIND=127.0.0.1

REM Change to the OpenClaw directory
cd /d "%OPENCLAW_PATH%"

REM Echo start message to stdout (captured by NSSM)
echo [%date% %time%] Starting OpenClaw gateway on %GATEWAY_BIND%:%GATEWAY_PORT%...

REM Run the gateway. NSSM will capture stdout/stderr to configured log files.
node "%OPENCLAW_PATH%\openclaw.mjs" gateway run --bind %GATEWAY_BIND% --port %GATEWAY_PORT% --force

REM If the gateway exits, return its exit code so NSSM can handle restart.
exit /b %errorlevel%