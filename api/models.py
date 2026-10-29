from http.server import BaseHTTPRequestHandler

from dashboard.server import models_metadata, write_json_response


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        write_json_response(self, models_metadata())
