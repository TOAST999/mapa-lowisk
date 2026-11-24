"""Serwer szkolnego atlasu. Uruchom poleceniem: python serwer.py."""
import argparse
import json
import re
import secrets
import sqlite3
import time
from contextlib import closing
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
LAKES = {item["id"] for item in json.loads((STATIC / "lowiska.json").read_text(encoding="utf-8"))}
LIFETIME = 2 * 60 * 60
FILE_TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
              ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
              ".woff": "font/woff", ".txt": "text/plain; charset=utf-8"}

def connect(path):
    db = sqlite3.connect(path, timeout=8)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db

def setup(path):
    with closing(connect(path)) as db:
        db.executescript("""
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT, lake TEXT NOT NULL UNIQUE,
                created INTEGER NOT NULL, author TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS votes (
                report INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
                voter TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('confirm','flag')),
                PRIMARY KEY (report,voter)
            );
        """)

class InputError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status

def active(db, client, now):
    rows = db.execute("""
        SELECT r.id, r.lake, r.created, (r.author = ?) AS mine,
               count(CASE WHEN v.kind = 'confirm' THEN 1 END) AS confirmations,
               count(CASE WHEN v.kind = 'flag' THEN 1 END) AS flags,
               max(CASE WHEN v.voter = ? THEN v.kind END) AS vote
        FROM reports AS r LEFT JOIN votes AS v ON v.report = r.id
        WHERE r.created > ? GROUP BY r.id ORDER BY r.created DESC
    """, (client, client, now - LIFETIME))
    return [{"id": r["id"], "lake": r["lake"], "created": r["created"],
             "expires": r["created"] + LIFETIME, "mine": bool(r["mine"]),
             "confirmations": r["confirmations"], "flags": r["flags"], "vote": r["vote"]} for r in rows]

def change(db, path, payload, client, now):
    db.execute("BEGIN IMMEDIATE")
    db.execute("DELETE FROM reports WHERE created <= ?", (now - LIFETIME,))
    if path == "/api/zgloszenia":
        lake = payload.get("lake")
        if set(payload) != {"lake"} or not isinstance(lake, str) or lake not in LAKES:
            raise InputError(400, "Wybierz łowisko z atlasu.")
        if db.execute("SELECT 1 FROM reports WHERE lake = ?", (lake,)).fetchone():
            raise InputError(409, "Na tym łowisku jest już aktywne zgłoszenie.")
        db.execute("INSERT INTO reports(lake,created,author) VALUES (?,?,?)", (lake, now, client))
    else:
        match = re.fullmatch(r"/api/zgloszenia/([1-9][0-9]{0,17})/glos", path)
        if not match:
            raise InputError(404, "Nie znaleziono zasobu.")
        kind = payload.get("kind")
        if set(payload) != {"kind"} or kind not in ("confirm", "flag"):
            raise InputError(400, "Wybierz potwierdzenie lub oznaczenie błędu.")
        number = int(match.group(1))
        row = db.execute("SELECT author FROM reports WHERE id = ?", (number,)).fetchone()
        if row is None:
            raise InputError(404, "Wpis już wygasł lub został ukryty.")
        if row["author"] == client:
            raise InputError(403, "Wpis ocenia inny tester.")
        db.execute("""INSERT INTO votes(report,voter,kind) VALUES (?,?,?)
                      ON CONFLICT(report,voter) DO UPDATE SET kind = excluded.kind""", (number, client, kind))
        flags = db.execute("SELECT count(*) FROM votes WHERE report=? AND kind='flag'", (number,)).fetchone()[0]
        if flags >= 2:
            db.execute("DELETE FROM reports WHERE id = ?", (number,))
    result = active(db, client, now)
    db.commit()
    return result

class AtlasHandler(BaseHTTPRequestHandler):
    def send_bytes(self, status, body, content_type, cookie=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if content_type.startswith("application/json") else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        if cookie:
            self.send_header("Set-Cookie", f"atlas_tester={cookie}; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, data, cookie=None):
        self.send_bytes(status, json.dumps(data, ensure_ascii=False).encode(), FILE_TYPES[".json"], cookie)

    def client_id(self):
        jar = SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
            item = jar.get("atlas_tester")
            if item and re.fullmatch(r"[0-9a-f]{32}", item.value):
                return item.value, None
        except (ValueError, CookieError):
            pass
        fresh = secrets.token_hex(16)
        return fresh, fresh

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/zgloszenia":
            client, cookie = self.client_id()
            try:
                with closing(connect(self.server.database)) as db:
                    entries = active(db, client, int(time.time()))
                self.send_json(200, {"reports": entries}, cookie)
            except sqlite3.Error:
                self.send_json(503, {"error":"Baza jest chwilowo niedostępna. Spróbuj ponownie."})
            return
        if path in ("/", "/index.html"):
            file = ROOT / "index.html"
        elif path.startswith("/static/"):
            file = (ROOT / path.lstrip("/")).resolve()
            if STATIC not in file.parents or file.suffix not in FILE_TYPES:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
        else:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if not file.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.send_bytes(200, file.read_bytes(), FILE_TYPES[file.suffix])

    def do_POST(self):
        try:
            origin = self.headers.get("Origin")
            if origin and urlsplit(origin).netloc != self.headers.get("Host"):
                raise InputError(403, "Otwórz formularz w aplikacji.")
            if self.headers.get_content_type() != "application/json":
                raise InputError(415, "Wymagane są dane JSON.")
            length = int(self.headers.get("Content-Length", "-1"))
            if not 0 < length <= 512:
                raise InputError(400, "Nieprawidłowe dane formularza.")
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise InputError(400, "Nieprawidłowe dane formularza.")
            client, cookie = self.client_id()
            with closing(connect(self.server.database)) as db:
                reports = change(db, urlsplit(self.path).path, payload, client, int(time.time()))
            self.send_json(200, {"reports": reports}, cookie)
        except InputError as exc:
            self.send_json(exc.status, {"error": str(exc)})
        except (ValueError, UnicodeError):
            self.send_json(400, {"error": "Nieprawidłowe dane formularza."})
        except sqlite3.Error:
            self.send_json(503, {"error": "Baza jest chwilowo niedostępna. Spróbuj ponownie."})

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", type=Path, default=ROOT / "atlas.sqlite3")
    args = parser.parse_args()
    setup(args.db)
    with ThreadingHTTPServer((args.host, args.port), AtlasHandler) as server:
        server.database = args.db
        print(f"Atlas łowisk: http://{args.host}:{args.port} (Ctrl+C kończy pracę)", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
