from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs

from dashboard.server import predict_pm25, write_json_response


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        query_params = {
            key: value[0]
            for key, value in parse_qs(self.path.partition("?")[2]).items()
        }
        model_type = query_params.get("model", "LR")
        write_json_response(self, predict_pm25(query_params, model_type))

    def do_POST(self) -> None:
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON payload")
            return

        model_type = data.get("model", "LR")
        write_json_response(self, predict_pm25(data, model_type))
