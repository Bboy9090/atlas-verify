"""Local case workspace: explicit evidence association and corruption-safe saves."""
from __future__ import annotations
import hashlib
import json
import os
import stat
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


class CaseError(ValueError):
    pass


def _db():
    import platform_exclusive
    return platform_exclusive.local_data_dir("bobbys-case-file") / "cases.json"


def unique_object(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise CaseError("Duplicate JSON key")
        obj[key] = value
    return obj


def load_cases():
    path = _db()
    if path.is_symlink():
        raise CaseError("Unsafe case store")
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return []
    try:
        rows = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
        if not isinstance(rows, list):
            raise CaseError("Invalid case list")
        for row in rows:
            if not isinstance(row, dict) or not all(isinstance(row.get(k), str) for k in ("case_id", "title", "created", "summary")) or not isinstance(row.get("evidence"), list):
                raise CaseError("Invalid stored case")
            if not row["case_id"].strip():
                raise CaseError("Missing case identifier")
    except (ValueError, TypeError, UnicodeError) as exc:
        raise CaseError("Existing case store unreadable; original preserved") from exc
    return rows


def mutate(change):
    path = _db()
    lock = path.with_name(path.name + ".write-lock")
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise CaseError("Case store busy or interrupted; inspect lock before retry") from exc
    pending = None
    try:
        os.close(fd)
        rows = load_cases()
        result = change(rows)
        payload = json.dumps(rows, ensure_ascii=False, indent=2, allow_nan=False).encode("utf-8")
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name+".", delete=False) as out:
            pending = Path(out.name)
            out.write(payload)
            out.flush()
            os.fsync(out.fileno())
        os.replace(pending, path)
        pending = None
        return result
    finally:
        if pending is not None:
            pending.unlink(missing_ok=True)
        lock.unlink()


def text_field(body, key, limit, optional=False):
    if not isinstance(body, dict):
        raise CaseError("JSON object required")
    v = body.get(key, "" if optional else None)
    if not isinstance(v, str) or len(v) > limit or (not optional and not v.strip()):
        raise CaseError("Invalid " + key)
    return v


def selected_case(rows, case_id):
    matches = [row for row in rows if row["case_id"] == case_id]
    if len(matches) != 1:
        raise CaseError("Select one existing case; unknown or duplicate identifier")
    return matches[0]


def create_case(body):
    title = text_field(body, "title", 500)
    summary = text_field(body, "summary", 200000, optional=True)
    row = {"case_id": "CASE-" + uuid4().hex, "title": title,
           "created": datetime.now(timezone.utc).isoformat(), "summary": summary, "evidence": []}
    def add(rows):
        rows.insert(0, row)
        return row
    return mutate(add)


def file_receipt(raw_path):
    path = Path(raw_path)
    if not path.is_absolute() or path.is_symlink():
        raise CaseError("Choose an absolute, non-symlink local file")
    # Reject nonregular inputs before opening; compare descriptor and pathname
    # metadata before and after reading to detect ordinary concurrent changes.
    before = path.stat()
    if not stat.S_ISREG(before.st_mode):
        raise CaseError("Regular files only")
    digest = hashlib.sha256()
    count = 0
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    def signature(st):
        return (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)
    with os.fdopen(os.open(path, flags), "rb") as stream:
        opened = os.fstat(stream.fileno())
        if not stat.S_ISREG(opened.st_mode) or signature(opened) != signature(before):
            raise CaseError("File changed before acquisition")
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
            count += len(chunk)
            if count > opened.st_size:
                raise CaseError("File grew during acquisition")
        after = os.fstat(stream.fileno())
    if count != opened.st_size or signature(after) != signature(opened) or signature(path.stat()) != signature(opened):
        raise CaseError("File changed during acquisition; retry with stable source")
    # A hash is not an identity finding, trusted timestamp or proof of signature validity.
    return {"ok": True, "evidence_id": uuid4().hex, "name": path.name,
            "path": str(path.resolve()), "size_bytes": count, "sha256": digest.hexdigest(),
            "modified_utc": datetime.fromtimestamp(opened.st_mtime, tz=timezone.utc).isoformat(),
            "acquired_utc": datetime.now(timezone.utc).isoformat(),
            "evidence_status": "SHA-256 computed from selected local file",
            "signature_status": "NOT_VERIFIED", "identity_confirmed": False}


def attach_evidence(body):
    case_id = text_field(body, "case_id", 500)
    path = text_field(body, "path", 8192)
    selected_case(load_cases(), case_id)
    receipt = file_receipt(path)
    receipt["case_id"] = case_id
    def add(rows):
        selected_case(rows, case_id)["evidence"].insert(0, receipt)
        return receipt
    return mutate(add)


def create_app(port, bundle_root, meta):
    from flask import Flask, jsonify, request, send_from_directory
    import platform_exclusive
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024
    @app.before_request
    def local_only():
        host = f"127.0.0.1:{port}"
        if request.host != host or (request.headers.get("Origin") and request.headers["Origin"] != f"http://{host}"):
            return jsonify({"ok": False, "error": "Invalid local request origin"}), 403
        if request.method == "POST" and not request.is_json:
            return jsonify({"ok": False, "error": "JSON required"}), 415

    @app.route("/")
    def index():
        return send_from_directory(bundle_root / "ui", "index.html")

    @app.route("/assets/<path:f>")
    def assets(f):
        return send_from_directory(bundle_root / "assets", f)

    @app.route("/api/health")
    def health():
        try:
            load_cases()
        except (CaseError, OSError):
            return jsonify({"ok": False, "app": meta["title"], "error": "Case store unavailable; original preserved"}), 503
        return jsonify({"ok": True, "app": meta["title"], "mode": "local-case-evidence", "live_people_search": False})

    @app.route("/api/platform")
    def plat():
        return jsonify(platform_exclusive.get_system_overview())

    @app.route("/api/cases", methods=["GET", "POST"])
    def cases():
        if request.method == "POST":
            try:
                row = create_case(request.get_json(silent=True))
                return jsonify({"ok": True, "case": row}), 201
            except (CaseError, OSError) as exc:
                return jsonify({"ok": False, "error": str(exc)}), 409
        try:
            return jsonify({"cases": load_cases()})
        except (CaseError, OSError):
            return jsonify({"ok": False, "error": "Cannot read cases; existing file preserved"}), 503

    @app.route("/api/verify-evidence", methods=["POST"])
    def verify():
        try:
            receipt = attach_evidence(request.get_json(silent=True))
        except (CaseError, OSError) as exc:
            return jsonify({"ok": False, "error": str(exc), "persisted": False}), 409
        return jsonify({"ok": True, "persisted": True, "case_id": receipt["case_id"], "receipt": receipt})

    return app


def start_server(port, bundle_root, meta):
    create_app(port, bundle_root, meta).run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
