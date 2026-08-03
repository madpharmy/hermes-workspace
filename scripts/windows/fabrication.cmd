@echo off
setlocal
set "HERMES_HOME=%LOCALAPPDATA%\hermes\profiles\fabrication"
call hermes.cmd %*
exit /b %ERRORLEVEL%
