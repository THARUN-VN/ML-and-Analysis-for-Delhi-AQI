"""
Delhi AQI — Platform Launcher
Run this script to start the server and automatically open the dashboard:
    python run.py
"""
import sys
from pathlib import Path

# Add dashboard folder to path and start server
dashboard_dir = Path(__file__).resolve().parent / "dashboard"
sys.path.insert(0, str(dashboard_dir))

import server

if __name__ == "__main__":
    server.start_server()
