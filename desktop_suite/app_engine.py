"""Bobby's Case File (Atlas Verify) — Evidence Provenance, SHA-256 Chain & Authenticode Workbench."""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
import platform_exclusive

def _db() -> Path:
    return platform_exclusive.local_data_dir("bobbys-case-file") / "cases.json"

def load_cases() -> list:
    p = _db()
    if p.exists():
        try: return json.loads(p.read_text(encoding="utf-8"))
        except Exception: pass
    return []

def start_server(port: int, bundle_root: Path, meta: dict):
    app = Flask(__name__)
    ui_dir, assets_dir = bundle_root / "ui", bundle_root / "assets"

    @app.route("/")
    def index(): return send_from_directory(ui_dir, "index.html")
    @app.route("/assets/<path:f>")
    def assets(f): return send_from_directory(assets_dir, f)
    @app.route("/api/health")
    def health(): return jsonify({"ok": True, "app": meta["title"]})
    @app.route("/api/platform")
    def plat(): return jsonify(platform_exclusive.get_system_overview())
    @app.route("/api/cases", methods=["GET", "POST"])
    def cases():
        items = load_cases()
        if request.method == "GET": return jsonify({"cases": items})
        b = request.get_json(force=True, silent=True) or {}
        items.insert(0, {
            "case_id": b.get("case_id") or f"CASE-{int(datetime.now().timestamp())%100000}",
            "title": b.get("title") or "Untitled Case File",
            "created": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "summary": b.get("summary") or "",
            "evidence": [],
        })
        _db().write_text(json.dumps(items, indent=2), encoding="utf-8")
        return jsonify({"ok": True, "cases": items})
    @app.route("/api/verify-evidence", methods=["POST"])
    def vev():
        b = request.get_json(force=True, silent=True) or {}
        res = platform_exclusive.verify_file_evidence(b.get("path", ""))
        if res.get("ok"):
            items = load_cases()
            if items:
                items[0].setdefault("evidence", []).insert(0, res)
                _db().write_text(json.dumps(items, indent=2), encoding="utf-8")
        return jsonify(res)

    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
