@echo off
REM Simyo eSIM 代理服务器启动脚本 (Windows)

echo 🚀 启动 Simyo eSIM 代理服务器...

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未检测到 Node.js，请先安装 Node.js (版本 >= 14.0.0)
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 显示Node.js版本
echo ✅ Node.js 版本:
node --version

REM 检查package.json是否存在
if not exist "package.json" (
    echo ❌ 错误: 未找到 package.json 文件
    echo    请确保在正确的目录中运行此脚本
    pause
    exit /b 1
)

REM 检查依赖是否已安装
if not exist "node_modules" (
    echo 📦 安装依赖包...
    npm install
    
    if errorlevel 1 (
        echo ❌ 依赖安装失败，请检查网络连接或npm配置
        pause
        exit /b 1
    )
    
    echo ✅ 依赖安装完成
) else (
    echo ✅ 依赖包已存在
)

REM 启动服务器
echo 🌟 启动代理服务器...
echo 📍 服务器将在 http://localhost:3000 启动
echo 💡 按 Ctrl+C 停止服务器
echo.

REM 启动服务器
node simyo_proxy_server.js

pause