@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0\.."

echo 剧情动画候选库 - 一键换密码
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请先安装 Node.js 18 或更高版本。
  pause
  exit /b 1
)
where git >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Git，请先安装 Git for Windows。
  pause
  exit /b 1
)

node "%~dp0change-password.mjs"
set "EC=%ERRORLEVEL%"
echo.
if not "%EC%"=="0" (
  echo 操作未完成，请根据上面的错误信息处理后重试。
) else (
  echo 操作完成。
)
pause
exit /b %EC%
