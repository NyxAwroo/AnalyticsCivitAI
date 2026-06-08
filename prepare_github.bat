@echo off
setlocal EnableExtensions

set "SOURCE=%~dp0"
set "SOURCE=%SOURCE:~0,-1%"
set "TARGET=%SOURCE%-GitHub"

echo.
echo ================================================
echo  AnalyticsCivitAI - GitHub folder preparation
echo ================================================
echo Source: "%SOURCE%"
echo Target: "%TARGET%"
echo.

if exist "%TARGET%" (
  echo Removing previous GitHub folder...
  rmdir /s /q "%TARGET%"
)

mkdir "%TARGET%"

echo Copying source files without local data/build artifacts...
robocopy "%SOURCE%" "%TARGET%" /E ^
  /XD "%SOURCE%\node_modules" "%SOURCE%\dist" "%SOURCE%\.git" "%SOURCE%\.vite" "%SOURCE%\work" "%SOURCE%\outputs" "%TARGET%" ^
  /XF ".env" ".env.*" "*.local" "*.log" "npm-debug.log*" "yarn-debug.log*" "yarn-error.log*" > nul

set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
  echo.
  echo Robocopy failed with code %RC%.
  exit /b %RC%
)

echo.
echo Done.
echo GitHub-ready folder:
echo "%TARGET%"
echo.
echo Next steps:
echo   cd "%TARGET%"
echo   npm install
echo   npm run build
echo.
pause
