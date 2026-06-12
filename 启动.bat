@echo off
chcp 65001 >nul
title Star宇宙
echo.
echo  ====================================
echo        Star宇宙 - 太阳系漫游
echo  ====================================
echo.
echo  正在启动本地服务器...
echo  浏览器将自动打开 http://127.0.0.1:8765
echo  关闭此窗口即可停止服务
echo.

cd /d "%~dp0"

set "URL=http://127.0.0.1:8765/"
set "PORT=8765"

where py >nul 2>&1
if %errorlevel%==0 (
    start "" cmd /c "ping -n 3 127.0.0.1 >nul && start %URL%"
    py -3 -m http.server %PORT% --bind 127.0.0.1
    goto :eof
)

where python >nul 2>&1
if %errorlevel%==0 (
    start "" cmd /c "ping -n 3 127.0.0.1 >nul && start %URL%"
    python -m http.server %PORT% --bind 127.0.0.1
    goto :eof
)

where npx >nul 2>&1
if %errorlevel%==0 (
    start "" cmd /c "ping -n 3 127.0.0.1 >nul && start %URL%"
    npx --yes serve -l %PORT% .
    goto :eof
)

echo  未找到 Python 或 Node.js，无法启动本地服务。
echo  index.html 不能直接双击打开（浏览器会拦截 ES Module）。
echo  请安装 Python 3 后重新运行本脚本。
pause
