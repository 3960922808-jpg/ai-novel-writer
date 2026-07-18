@echo off
chcp 936 >nul
title AI 写小说 - 一键安装运行
color 0A

echo ============================================
echo    AI 写小说 - 一键安装运行脚本
echo ============================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [X] 未检测到 Node.js，请先安装：
    echo     https://nodejs.org/zh-cn/download/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js 版本： %NODE_VER%

REM 检查 npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [X] 未检测到 npm
    pause
    exit /b 1
)
echo [OK] npm 已就绪
echo.

REM 设置国内镜像加速
echo [INFO] 切换 npm 国内镜像...
call npm config set registry https://registry.npmmirror.com
echo.

echo ============================================
echo  第 1 步：安装依赖（首次约 3-5 分钟）
echo ============================================
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo [X] 依赖安装失败，请检查网络
    pause
    exit /b 1
)
echo.
echo [OK] 依赖安装完成
echo.

echo ============================================
echo  第 2 步：选择运行模式
echo ============================================
echo   1. 开发模式（热重载，推荐首次使用）
echo   2. 打包成 exe 安装包（约 1-2 分钟）
echo   3. 退出
echo.
set /p choice="请输入 1 / 2 / 3 ："

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto build
goto end

:dev
echo.
echo ============================================
echo  启动开发模式（两个窗口会自动打开）
echo  关闭窗口即退出应用
echo ============================================
echo.
start "Vite Dev Server" cmd /k "npm run dev"
echo [INFO] 等待 Vite 启动（5秒）...
timeout /t 5 >nul
start "Electron" cmd /k "npm run dev:electron"
exit /b 0

:build
echo.
echo ============================================
echo  打包 Windows 安装包
echo ============================================
call npm run build:win
if errorlevel 1 (
    echo [X] 打包失败
    pause
    exit /b 1
)
echo.
echo [OK] 打包完成！安装包位于 release 目录
echo.
explorer release
pause
exit /b 0

:end
exit /b 0
