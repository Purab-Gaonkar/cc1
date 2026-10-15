@echo off
echo Stopping all Monolithic and Microservice servers...
for %%P in (5000 8000 8001 8002 8003 8004) do (
  for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%%P ^| findstr LISTENING') do (
    echo Killing process on port %%P (PID %%a)
    taskkill /f /pid %%a 2>nul
  )
)
echo All servers stopped successfully.
pause
