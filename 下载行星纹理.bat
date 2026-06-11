@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "textures\planets" mkdir "textures\planets"
echo 正在下载真实行星纹理到 textures\planets\ ...
echo 每颗天体仅下载其专属贴图，不使用跨天体占位。
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\download-planet-textures.ps1"

echo.
echo 下载结束。请 Ctrl+F5 刷新浏览器。
pause
