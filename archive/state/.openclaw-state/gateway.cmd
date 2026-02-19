@echo off
rem OpenClaw Gateway (v2026.2.15)
set HOME=C:\Users\mangs
set PATH=D:\workspace\appDev\openclaw\node_modules\.bin;C:\Users\mangs\AppData\Local\pnpm\.tools\pnpm\10.23.0_tmp_39780\node_modules\pnpm\dist\node-gyp-bin;D:\workspace\appDev\openclaw\node_modules\.bin;C:\Users\mangs\AppData\Local\pnpm\.tools\pnpm\10.23.0\bin;%PATH%;D:\OpenClaw\bin;C:\Program Files\Go\bin;D:\Software\codex;C:\Python314\Scripts\;C:\Python314\;C:\Windows\system32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0\;C:\Windows\System32\OpenSSH\;C:\JupyterLab;C:\Program Files\dotnet\;D:\Software\node\;C:\ProgramData\chocolatey\bin;D:\Software\Git\cmd;C:\Program Files\Python\Scripts\;C:\Program Files\Python\;C:\Users\mangs\AppData\Local\Microsoft\WindowsApps;D:\Software\Antigravity\bin;C:\Users\mangs\AppData\Local\GitHubDesktop\bin;C:\Users\mangs\AppData\Roaming\npm;C:\Program Files\PostgreSQL\17\bin;C:\Users\mangs\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;C:\Users\mangs\go\bin;D:\OpenClaw\bin;C:\Program Files\Go\bin;D:\Software\codex;C:\Python314\Scripts\;C:\Python314\;C:\Windows\system32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0\;C:\Windows\System32\OpenSSH\;C:\JupyterLab;C:\Program Files\dotnet\;D:\Software\node\;C:\ProgramData\chocolatey\bin;D:\Software\Git\cmd;C:\Program Files\Python\Scripts\;C:\Program Files\Python\;C:\Users\mangs\AppData\Local\Microsoft\WindowsApps;D:\Software\Antigravity\bin;C:\Users\mangs\AppData\Local\GitHubDesktop\bin;C:\Users\mangs\AppData\Roaming\npm;C:\Program Files\PostgreSQL\17\bin;C:\Users\mangs\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;C:\Users\mangs\go\bin
set OPENCLAW_STATE_DIR=D:\workspace\appDev\openclaw\.openclaw-state
set OPENCLAW_CONFIG_PATH=D:\workspace\appDev\openclaw\.openclaw-state\openclaw.json
set OPENCLAW_GATEWAY_PORT=18789
set OPENCLAW_GATEWAY_TOKEN=openclaw-token
set OPENCLAW_SYSTEMD_UNIT=openclaw-gateway.service
set OPENCLAW_SERVICE_MARKER=openclaw
set OPENCLAW_SERVICE_KIND=gateway
set OPENCLAW_SERVICE_VERSION=2026.2.15
D:\Software\node\node.exe D:\workspace\appDev\openclaw\dist\index.js gateway --port 18789
