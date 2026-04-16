@echo off
chcp 65001 >nul

where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装 Node.js LTS: https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo 未检测到 npm，请重新安装 Node.js 并勾选 npm。
  pause
  exit /b 1
)

echo [1/3] 安装依赖...
call npm install
if errorlevel 1 (
  echo npm install 失败，请检查网络或 npm 源。
  pause
  exit /b 1
)

echo [2/3] 打包 Windows 安装包...
call npm run dist
if errorlevel 1 (
  echo 打包失败，请检查上方错误信息。
  pause
  exit /b 1
)

echo [3/3] 打包完成，产物位于 dist 目录。
pause
