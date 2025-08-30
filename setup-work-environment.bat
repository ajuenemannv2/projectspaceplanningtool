@echo off
echo ========================================
echo STAGING SPACE TOOL - WORK ENVIRONMENT SETUP
echo ========================================
echo.

echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo Recommended version: 18.x or higher
    pause
    exit /b 1
)

echo Node.js found: 
node --version

echo.
echo Checking npm installation...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed!
    pause
    exit /b 1
)

echo npm found:
npm --version

echo.
echo Creating necessary directories...
if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "backups" mkdir backups

echo.
echo Checking required files...
if not exist "construction-campusog.json" (
    echo WARNING: construction-campusog.json not found!
    echo Please ensure this file is present in the project directory.
)

if not exist "index.html" (
    echo ERROR: index.html not found!
    echo Please ensure all project files are present.
    pause
    exit /b 1
)

echo.
echo Setting up environment variables...
set NODE_ENV=production
set PORT=3000

echo.
echo Installing dependencies (if any)...
npm install

echo.
echo ========================================
echo SETUP COMPLETE!
echo ========================================
echo.
echo To start the application:
echo 1. Open Command Prompt as Administrator
echo 2. Navigate to this directory
echo 3. Run: node server.js
echo 4. Open browser to: http://localhost:3000
echo.
echo For production deployment:
echo 1. Update deployment-config.js with your work environment settings
echo 2. Configure firewall rules for port 3000
echo 3. Set up as Windows service if needed
echo.
pause
