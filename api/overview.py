import csv
from http.server import BaseHTTPRequestHandler

from dashboard.server import load_summary, write_json_response


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        try:
            write_json_response(self, load_summary())
        except (OSError, ValueError, csv.Error) as error:
            self.send_error(500, str(error))
