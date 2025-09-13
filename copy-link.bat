@echo off
setlocal enabledelayedexpansion
echo ========================================
echo   COPY NETWORK LINK TO CLIPBOARD
echo ========================================
echo.

echo Finding your IP address...
echo.

REM Find IP address
set "IP_FOUND="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    if not defined IP_FOUND (
        set "IP=%%a"
        set "IP=!IP: =!"
        if not "!IP!"=="" (
            set "IP_FOUND=!IP!"
        )
    )
)

if not defined IP_FOUND (
    echo Could not detect IP address automatically.
    set /p "IP_FOUND=Please enter your IP address: "
)

set "FULL_LINK=http://!IP_FOUND!:3000"

echo.
echo 🌐 Your tool link: !FULL_LINK!
echo.
echo Copying link to clipboard...

REM Copy to clipboard using PowerShell
powershell -command "Set-Clipboard -Value '!FULL_LINK!'"

echo ✅ Link copied to clipboard!
echo.
echo 📧 You can now paste this link in an email:
echo    !FULL_LINK!
echo.
echo 💡 Just press Ctrl+V to paste anywhere!
echo.
pause
