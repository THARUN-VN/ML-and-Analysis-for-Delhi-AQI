@echo off
title Delhi AQI Platform
echo Starting Delhi AQI Environmental Intelligence Platform...
python run.py
if errorlevel 1 (
    echo Python failed to start. Trying py...
    py run.py
)
pause
