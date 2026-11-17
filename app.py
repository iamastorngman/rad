import os
import sqlite3
from datetime import datetime, timezone
from functools import wraps
from flask import Flask, request, session, redirect, url_for, render_template, jsonify, abort

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(APP_DIR, "chat.db")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-this-secret-key-before-deployment")
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
                body TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

def logged_in(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("authenticated"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "Please unlock the app first."}), 401
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped

@app.route("/", methods=["GET"])
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
            if not username:
                username = "Friend"
            session["authenticated"] = True
            session["username"] = username[:24]
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
    after = request.args.get("after", "0")
    try:
        after_id = max(0, int(after))
    except ValueError:
        after_id = 0
    with db() as conn:
        rows = conn.execute(
            "SELECT id, username, body, created_at FROM messages WHERE id > ? ORDER BY id ASC LIMIT 100",
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
    username = session.get("username", "Friend")
    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with db() as conn:
        cursor = conn.execute(
            "INSERT INTO messages (username, body, created_at) VALUES (?, ?, ?)",
            (username, body, created_at)
        )
        message_id = cursor.lastrowid
    return jsonify({
        "id": message_id, "username": username,
        "body": body, "created_at": created_at
    }), 201

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    init_db()
    # 0.0.0.0 allows other devices on your Wi-Fi to connect using this PC's local IP.
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
