"""
Delhi AQI — Main Entry Point
Usage:
    python main.py
"""
import importlib.util
import sys
from pathlib import Path

_dashboard_server_path = Path(__file__).resolve().parent / "dashboard" / "server.py"
_spec = importlib.util.spec_from_file_location("dashboard_server", _dashboard_server_path)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["dashboard_server"] = _mod
_spec.loader.exec_module(_mod)

if __name__ == "__main__":
    _mod.start_server()
