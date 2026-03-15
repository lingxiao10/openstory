@echo off
echo Building backend...
cd platform\backend
call npm run build
if %errorlevel% neq 0 (
    echo Backend build failed!
    exit /b %errorlevel%
)

echo Building frontend...
cd ..\frontend
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed!
    exit /b %errorlevel%
)

echo Build completed successfully!
cd ..\..
pm2 start ecosystem.config.js
pm2 logs
