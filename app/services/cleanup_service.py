"""
File Cleanup Service
- Deletes rendered DOCX/PDF files older than 1 day
- Deletes raw upload files older than 1 day  
- Keeps published template files (permanent)
- Logs cleanup activity
"""
import os
import time
import threading
from datetime import datetime, timedelta
from ..core.config import settings
from .db_repository import log_activity


CLEANUP_INTERVAL = 3600  # Run every 1 hour
MAX_FILE_AGE = 86400     # 1 day in seconds


def cleanup_old_files():
    """Delete files older than MAX_FILE_AGE from rendered/, pdfs/, uploads/, and raw templates without DB records."""
    storage = settings.LOCAL_STORAGE_PATH
    now = time.time()
    deleted = []
    kept = []

    # Folders to clean (non-permanent)
    clean_dirs = [
        os.path.join(storage, "rendered"),
        os.path.join(storage, "pdfs"),
        os.path.join(storage, "uploads"),
        os.path.join(storage, "templates", "raw"),
    ]

    for dir_path in clean_dirs:
        if not os.path.exists(dir_path):
            continue
        for filename in os.listdir(dir_path):
            filepath = os.path.join(dir_path, filename)
            if not os.path.isfile(filepath):
                continue
            file_age = now - os.path.getmtime(filepath)
            if file_age > MAX_FILE_AGE:
                try:
                    os.remove(filepath)
                    rel = os.path.relpath(filepath, storage)
                    deleted.append(rel)
                except Exception as e:
                    print(f"⚠️  Cleanup failed for {filepath}: {e}")

    if deleted:
        log_activity("file_cleanup", "system", None, {
            "deleted_count": len(deleted),
            "files": deleted[:20],  # Log first 20
        })
        print(f"🧹 Cleanup: deleted {len(deleted)} old files")

    return {"deleted": len(deleted), "files": deleted}


def get_storage_stats():
    """Get storage usage statistics."""
    storage = settings.LOCAL_STORAGE_PATH
    stats = {}

    dirs = {
        "templates_raw": os.path.join(storage, "templates", "raw"),
        "templates_published": os.path.join(storage, "templates", "published"),
        "rendered": os.path.join(storage, "rendered"),
        "pdfs": os.path.join(storage, "pdfs"),
        "uploads": os.path.join(storage, "uploads"),
    }

    total_size = 0
    total_files = 0

    for name, dir_path in dirs.items():
        if not os.path.exists(dir_path):
            stats[name] = {"count": 0, "size": 0, "files": []}
            continue

        files = []
        dir_size = 0
        for filename in sorted(os.listdir(dir_path)):
            filepath = os.path.join(dir_path, filename)
            if not os.path.isfile(filepath):
                continue
            fsize = os.path.getsize(filepath)
            fmtime = datetime.fromtimestamp(os.path.getmtime(filepath))
            age_hours = (datetime.now() - fmtime).total_seconds() / 3600
            files.append({
                "name": filename,
                "size": fsize,
                "size_display": _fmt_size(fsize),
                "modified": fmtime.strftime("%Y-%m-%d %H:%M:%S"),
                "age_hours": round(age_hours, 1),
                "expires_in": max(0, round(24 - age_hours, 1)) if name != "templates_published" else None,
            })
            dir_size += fsize

        total_size += dir_size
        total_files += len(files)
        stats[name] = {
            "count": len(files),
            "size": dir_size,
            "size_display": _fmt_size(dir_size),
            "files": files,
        }

    stats["total"] = {
        "files": total_files,
        "size": total_size,
        "size_display": _fmt_size(total_size),
    }

    return stats


def _fmt_size(b):
    if b < 1024:
        return f"{b} B"
    if b < 1024 * 1024:
        return f"{b / 1024:.1f} KB"
    return f"{b / (1024 * 1024):.1f} MB"


# Background cleanup thread
_cleanup_thread = None

def start_cleanup_scheduler():
    """Start background thread for periodic cleanup."""
    global _cleanup_thread
    if _cleanup_thread and _cleanup_thread.is_alive():
        return

    def _run():
        while True:
            try:
                cleanup_old_files()
            except Exception as e:
                print(f"⚠️  Cleanup error: {e}")
            time.sleep(CLEANUP_INTERVAL)

    _cleanup_thread = threading.Thread(target=_run, daemon=True)
    _cleanup_thread.start()
    print("🧹 File cleanup scheduler started (interval: 1h, max age: 24h)")
