@echo off
cd /d "%~dp0platform\backend"
npx ts-node --transpile-only src/initDb.ts
pause
