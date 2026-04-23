@echo off
cd /d "%~dp0"

echo ======================================
echo   PORTANAG SYNC -> GITHUB
echo ======================================

REM Check if there are changes
git status --porcelain > temp_git_status.txt

for %%A in (temp_git_status.txt) do if %%~zA==0 (
    echo No changes detected. Nothing to push.
    del temp_git_status.txt
    goto end
)

del temp_git_status.txt

echo Changes detected. Staging files...
git add .

REM Create timestamp commit message
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH:mm:ss"') do set timestamp=%%i

echo Committing changes...
git commit -m "auto-sync %timestamp%"

echo Pushing to origin...
git push

echo.
echo Sync complete.

:end
pause