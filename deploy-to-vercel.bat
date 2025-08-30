@echo off
echo ========================================
echo DEPLOYING TO VERCEL
echo ========================================
echo.

echo Checking if Vercel CLI is installed...
vercel --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Vercel CLI...
    npm install -g vercel
) else (
    echo Vercel CLI found!
)

echo.
echo Starting deployment...
echo.
echo Follow the prompts:
echo 1. Login to Vercel (if needed)
echo 2. Project name: staging-space-tool
echo 3. Directory: ./
echo 4. Override settings: No
echo.

vercel

echo.
echo ========================================
echo DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Your app should now be live at:
echo https://staging-space-tool.vercel.app
echo.
echo Check the URL above for your demo!
pause
