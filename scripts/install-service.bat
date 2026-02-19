@echo off
echo Installing OpenClaw Gateway as a Windows Service...
nssm install OpenClawGateway "D:\workspace\appDev\openclaw\scripts\gateway-wrapper.bat"
nssm set OpenClawGateway Start SERVICE_AUTO_START
nssm start OpenClawGateway
echo Service installed and started. Check with: sc query OpenClawGateway
pause