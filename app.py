import os
import sqlite3
import uuid
from datetime import datetime, timezone
from functools import wraps
from werkzeug.utils import secure_filename
from flask import Flask, request, session, redirect, url_for, render_template, jsonify, send_from_directory

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(APP_DIR, "chat.db")
UPLOAD_DIR = os.path.join(APP_DIR, "uploads")
MAX_UPLOAD_BYTES = 24 * 1024 * 1024

os.makedirs(UPLOAD_DIR, exist_ok=True)
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-this-secret-key-before-deployment")
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES
APP_PASSWORD = os.environ.get("CHAT_PASSWORD", "wearebestfriends")

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                body TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                attachment_url TEXT,
                attachment_name TEXT,
                attachment_type TEXT
            )
        """)
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(messages)")}
        for name in ("attachment_url", "attachment_name", "attachment_type"):
            if name not in columns:
                conn.execute(f"ALTER TABLE messages ADD COLUMN {name} TEXT")

def logged_in(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("authenticated"):
            if request.path.startswith("/api/") or request.path.startswith("/uploads/"):
                return jsonify({"error": "Please unlock the app first."}), 401
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped

def create_message(body="", attachment_url=None, attachment_name=None, attachment_type=None):
    username = session.get("username", "Friend")
    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with db() as conn:
        cursor = conn.execute(
            """INSERT INTO messages
               (username, body, created_at, attachment_url, attachment_name, attachment_type)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (username, body, created_at, attachment_url, attachment_name, attachment_type)
        )
        message_id = cursor.lastrowid
    return {
        "id": message_id, "username": username, "body": body,
        "created_at": created_at, "attachment_url": attachment_url,
        "attachment_name": attachment_name, "attachment_type": attachment_type
    }

@app.get("/")
def home():
    if not session.get("authenticated"):
        return redirect(url_for("login"))
    return render_template("index.html", username=session.get("username", "Friend"))

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        password = request.form.get("password", "")
        username = request.form.get("username", "").strip()
        if password == APP_PASSWORD:
            session["authenticated"] = True
            session["username"] = (username or "Friend")[:24]
            return redirect(url_for("home"))
        error = "That password is not correct. Try again."
    return render_template("login.html", error=error)

@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.get("/api/messages")
@logged_in
def get_messages():
    try:
        after_id = max(0, int(request.args.get("after", "0")))
    except ValueError:
        after_id = 0
    with db() as conn:
        rows = conn.execute(
            """SELECT id, username, body, created_at, attachment_url,
                      attachment_name, attachment_type
               FROM messages WHERE id > ? ORDER BY id ASC LIMIT 100""",
            (after_id,)
        ).fetchall()
    return jsonify([dict(row) for row in rows])

@app.post("/api/messages")
@logged_in
def send_message():
    data = request.get_json(silent=True) or {}
    body = str(data.get("body", "")).strip()
    if not body:
        return jsonify({"error": "Write a message first."}), 400
    if len(body) > 2000:
        return jsonify({"error": "Messages must be 2,000 characters or less."}), 400
    return jsonify(create_message(body=body)), 201

@app.post("/api/upload")
@logged_in
def upload_file():
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "Choose a file first."}), 400
    original_name = secure_filename(uploaded.filename) or "shared-file"
    extension = os.path.splitext(original_name)[1][:16]
    stored_name = f"{uuid.uuid4().hex}{extension}"
    content_type = (uploaded.mimetype or "application/octet-stream").lower()
    kind = "image" if content_type.startswith("image/") else "video" if content_type.startswith("video/") else "file"
    uploaded.save(os.path.join(UPLOAD_DIR, stored_name))
    return jsonify(create_message(
        attachment_url=url_for("uploaded_file", filename=stored_name),
        attachment_name=original_name,
        attachment_type=kind
    )), 201

@app.get("/uploads/<path:filename>")
@logged_in
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename, as_attachment=False, conditional=True)

@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": "That file is too large. The limit is 24 MB."}), 413

@app.get("/health")
def health():
    return {"status": "ok"}

init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
