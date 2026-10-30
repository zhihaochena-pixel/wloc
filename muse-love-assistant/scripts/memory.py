#!/usr/bin/env python3
"""Muse Love Assistant optional local memory store. Python 3 stdlib only.

No network, no chat integrations, no automatic harvesting. This is plaintext
SQLite in the current server account: not end-to-end encrypted.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import sqlite3
import sys

ROOT = Path(os.environ.get("MUSE_LOVE_DB", "~/.local/share/muse-love-assistant/relations.db")).expanduser()
ALIAS = re.compile(r"^[A-Za-z0-9_-]{1,32}$")


def output(value):
    print(json.dumps(value, ensure_ascii=False, indent=2))


def fail(message):
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False), file=sys.stderr)
    sys.exit(2)


def ensure_parent(path: Path):
    if not path.is_absolute():
        fail("MUSE_LOVE_DB must be an absolute path")
    if path.is_symlink():
        fail("Refusing symlink database path")
    created = not path.parent.exists()
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Never change permissions on an existing arbitrary directory.
    if created:
        os.chmod(path.parent, 0o700)


def connect(create=False):
    if not ROOT.is_absolute():
        fail("MUSE_LOVE_DB must be an absolute path")
    if ROOT.is_symlink():
        fail("Refusing symlink database path")
    if not ROOT.exists() and not create:
        return None
    if create:
        ensure_parent(ROOT)
    conn = sqlite3.connect(str(ROOT))
    if ROOT.exists():
        os.chmod(ROOT, 0o600)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA secure_delete = ON")
    conn.execute("PRAGMA journal_mode = DELETE")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS people (
            id TEXT PRIMARY KEY, stage TEXT NOT NULL DEFAULT '待观察',
            summary TEXT NOT NULL DEFAULT '', modified_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
            happened_on TEXT NOT NULL, kind TEXT NOT NULL,
            fact TEXT NOT NULL, inference TEXT NOT NULL DEFAULT '',
            next_step TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS companion (
            id INTEGER PRIMARY KEY CHECK (id=1),
            name TEXT NOT NULL, style TEXT NOT NULL, modified_at TEXT NOT NULL
        );
    """)
    return conn


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def is_on(conn):
    if conn is None:
        return False
    row = conn.execute("SELECT value FROM settings WHERE key='consent'").fetchone()
    return row is not None and row["value"] == "on"


def require_on(conn):
    if not is_on(conn):
        fail("未开启存储授权。须先由用户明确授权，再执行 consent on --confirm YES。")


def bounded(value, label, limit=1200):
    if not value or not value.strip():
        fail(f"{label} cannot be blank")
    if len(value) > limit:
        fail(f"{label} is too long (max {limit} chars)")
    return value.strip()


def check_id(value):
    if not ALIAS.fullmatch(value):
        fail("人物 ID 需是 1~32 位英数、下划线或短横线的代号，例如 A、B、friend_1")
    return value


def check_date(s):
    try:
        if dt.date.fromisoformat(s).isoformat() != s:
            raise ValueError
    except ValueError:
        fail("日期请使用 YYYY-MM-DD 格式")
    return s


def fetch_data(conn):
    if conn is None:
        return {"people": [], "notes": [], "companion": None}
    return {
        "people": [dict(r) for r in conn.execute("SELECT * FROM people ORDER BY id")],
        "notes": [dict(r) for r in conn.execute("SELECT * FROM notes ORDER BY happened_on, id")],
        "companion": (dict(r) if (r := conn.execute("SELECT name,style,modified_at FROM companion WHERE id=1").fetchone()) else None),
    }


def main():
    p = argparse.ArgumentParser(description="Muse 恋爱助手本地可选记忆（明文存储；默认关闭）")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("status")

    consent = sub.add_parser("consent")
    cs = consent.add_subparsers(dest="action", required=True)
    on = cs.add_parser("on"); on.add_argument("--confirm", required=True)
    cs.add_parser("off")

    person = sub.add_parser("person")
    ps = person.add_subparsers(dest="action", required=True)
    upsert = ps.add_parser("upsert")
    upsert.add_argument("--id", required=True); upsert.add_argument("--stage", required=True)
    upsert.add_argument("--summary", default="")
    ps.add_parser("list")
    show = ps.add_parser("show"); show.add_argument("--id", required=True)
    show.add_argument("--limit", type=int, default=30)

    note = sub.add_parser("note")
    ns = note.add_subparsers(dest="action", required=True)
    add = ns.add_parser("add")
    for opt in ("person", "date", "kind", "fact"):
        add.add_argument("--"+opt, required=True)
    add.add_argument("--inference", default=""); add.add_argument("--next", default="")

    companion = sub.add_parser("companion")
    comps = companion.add_subparsers(dest="action", required=True)
    setp = comps.add_parser("set")
    setp.add_argument("--name", required=True); setp.add_argument("--style", required=True)
    comps.add_parser("show")

    export = sub.add_parser("export"); export.add_argument("--out", required=True)
    forget = sub.add_parser("forget"); forget.add_argument("--id", required=True)
    forget.add_argument("--confirm", required=True)
    allp = sub.add_parser("forget-all"); allp.add_argument("--confirm", required=True)
    a = p.parse_args()

    if a.command == "forget-all":
        if a.confirm != "DELETE_ALL":
            fail("Must provide --confirm DELETE_ALL")
        conn = connect(create=False)
        if conn:
            # Secure-delete rows and remove the active DB. External backups/logs are unaffected.
            conn.execute("DELETE FROM notes"); conn.execute("DELETE FROM people")
            conn.execute("DELETE FROM companion"); conn.execute("DELETE FROM settings")
            conn.commit(); conn.close()
            ROOT.unlink(missing_ok=True)
        output({"ok": True, "deleted": "local skill database", "caveat": "不包括备份、聊天平台日志或模型服务日志"})
        return

    conn = connect(create=a.command == "consent" and a.action == "on")
    try:
        if a.command == "status":
            output({"ok": True, "storage_enabled": is_on(conn), "store_exists": conn is not None,
                    "people_count": (conn.execute("SELECT COUNT(*) FROM people").fetchone()[0] if conn else 0),
                    "notes_count": (conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0] if conn else 0),
                    "location": "server-user-local", "encrypted": False})
        elif a.command == "consent":
            if a.action == "on":
                if a.confirm != "YES":
                    fail("Must provide --confirm YES after explicit user consent")
                conn.execute("INSERT INTO settings(key,value) VALUES('consent','on') ON CONFLICT(key) DO UPDATE SET value='on'")
                conn.commit()
                output({"ok": True, "storage_enabled": True, "warning": "数据保存在 Muse 服务器，未加密"})
            else:
                if conn:
                    conn.execute("INSERT INTO settings(key,value) VALUES('consent','off') ON CONFLICT(key) DO UPDATE SET value='off'")
                    conn.commit()
                output({"ok": True, "storage_enabled": False, "deleted": False})
        elif a.command == "person":
            if a.action == "list":
                output({"ok": True, "people": ([dict(r) for r in conn.execute("SELECT id,stage,modified_at FROM people ORDER BY id")] if conn else [])})
            elif a.action == "show":
                check_id(a.id)
                if not conn:
                    fail("No stored people")
                r = conn.execute("SELECT * FROM people WHERE id=?", (a.id,)).fetchone()
                if r is None:
                    fail("Unknown person ID")
                limit = max(1, min(100, a.limit))
                notes = [dict(x) for x in conn.execute("SELECT * FROM notes WHERE person_id=? ORDER BY happened_on DESC,id DESC LIMIT ?", (a.id, limit))]
                output({"ok": True, "person": dict(r), "notes": notes})
            else:
                require_on(conn); check_id(a.id)
                stage = bounded(a.stage, "stage", 60)
                summary = a.summary.strip()
                if len(summary) > 800:
                    fail("summary is too long")
                conn.execute("INSERT INTO people(id,stage,summary,modified_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET stage=excluded.stage,summary=excluded.summary,modified_at=excluded.modified_at", (a.id, stage, summary, now()))
                conn.commit(); output({"ok": True, "person_id": a.id})
        elif a.command == "note":
            require_on(conn); check_id(a.person)
            if not conn.execute("SELECT 1 FROM people WHERE id=?", (a.person,)).fetchone():
                fail("先创建人物代号档案")
            check_date(a.date)
            kind = bounded(a.kind, "kind", 50)
            fact = bounded(a.fact, "fact", 1500)
            inference = a.inference.strip(); next_step = a.next.strip()
            if len(inference) > 1000 or len(next_step) > 1000:
                fail("inference/next too long")
            conn.execute("INSERT INTO notes(person_id,happened_on,kind,fact,inference,next_step,created_at) VALUES(?,?,?,?,?,?,?)", (a.person,a.date,kind,fact,inference,next_step,now()))
            conn.commit(); output({"ok": True, "stored_for": a.person, "date": a.date})
        elif a.command == "companion":
            if a.action == "show":
                row = conn.execute("SELECT name,style,modified_at FROM companion WHERE id=1").fetchone() if conn else None
                output({"ok": True, "companion": dict(row) if row else None, "fictional_ai": True})
            else:
                require_on(conn)
                name = bounded(a.name, "name", 50); style = bounded(a.style, "style", 400)
                conn.execute("INSERT INTO companion(id,name,style,modified_at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,style=excluded.style,modified_at=excluded.modified_at",(name,style,now()))
                conn.commit(); output({"ok": True, "fictional_ai": True, "companion_name": name})
        elif a.command == "export":
            if conn is None:
                fail("No database to export")
            out = Path(a.out).expanduser()
            if not out.is_absolute() or out.is_symlink():
                fail("Export path must be absolute and not symlink")
            if not out.parent.is_dir():
                fail("Export destination folder does not exist")
            payload = {"format": "muse-love-assistant-v1", "exported_at_utc": now(), **fetch_data(conn)}
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
            try:
                fd = os.open(out, flags, 0o600)
            except FileExistsError:
                fail("Export destination already exists; refusing overwrite")
            with os.fdopen(fd, "w", encoding="utf-8") as file:
                json.dump(payload, file, ensure_ascii=False, indent=2)
            output({"ok": True, "exported": str(out), "plaintext": True})
        elif a.command == "forget":
            check_id(a.id)
            if a.confirm != "DELETE":
                fail("Must provide --confirm DELETE")
            if conn:
                conn.execute("DELETE FROM people WHERE id=?", (a.id,))
                count = conn.execute("SELECT changes()").fetchone()[0]
                conn.commit()
            else:
                count = 0
            output({"ok": True, "deleted_people": count, "person_id": a.id, "caveat": "外部备份/日志不受影响"})
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()
