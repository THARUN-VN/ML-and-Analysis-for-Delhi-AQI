"""
Delhi AQI — Platform Launcher
Run this script to start the server and automatically open the dashboard:
    python run.py
"""
import importlib.util
import sys
from pathlib import Path

# Use spec_from_file_location to avoid module naming collision between
# root server.py (stub) and dashboard/server.py (actual server).
_dashboard_server_path = Path(__file__).resolve().parent / "dashboard" / "server.py"
_spec = importlib.util.spec_from_file_location("dashboard_server", _dashboard_server_path)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["dashboard_server"] = _mod
_spec.loader.exec_module(_mod)

if __name__ == "__main__":
    _mod.start_server()
