"""
Files API — list, download, storage stats, cleanup, history
"""
import os
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import text

from ...core.config import settings
from ...core.database import get_db_session
from ...services.cleanup_service import cleanup_old_files, get_storage_stats

router = APIRouter()


@router.get("/list")
async def list_files():
    """List all files in storage."""
    storage_path = settings.LOCAL_STORAGE_PATH
    files = []
    if os.path.exists(storage_path):
        for root_dir, dirs, filenames in os.walk(storage_path):
            for filename in filenames:
                full_path = os.path.join(root_dir, filename)
                rel_path = os.path.relpath(full_path, storage_path)
                mtime = datetime.fromtimestamp(os.path.getmtime(full_path))
                files.append({
                    "path": rel_path,
                    "size": os.path.getsize(full_path),
                    "modified": mtime.strftime("%Y-%m-%d %H:%M:%S"),
                })
    return {"files": files}


@router.get("/download/{file_path:path}")
async def get_file(file_path: str):
    """Get/download a file from storage."""
    full_path = os.path.join(settings.LOCAL_STORAGE_PATH, file_path)

    real_path = os.path.realpath(full_path)
    storage_root = os.path.realpath(settings.LOCAL_STORAGE_PATH)
    if not real_path.startswith(storage_root):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(full_path, filename=os.path.basename(full_path))


@router.delete("/{file_path:path}")
async def delete_file(file_path: str):
    """Delete a file from storage."""
    full_path = os.path.join(settings.LOCAL_STORAGE_PATH, file_path)

    real_path = os.path.realpath(full_path)
    storage_root = os.path.realpath(settings.LOCAL_STORAGE_PATH)
    if not real_path.startswith(storage_root):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    os.remove(full_path)
    return {"message": f"File '{file_path}' deleted"}


@router.get("/storage")
async def storage_stats():
    """Get storage usage stats (file counts, sizes, expiry info)."""
    return get_storage_stats()


@router.post("/cleanup")
async def run_cleanup():
    """Manually trigger file cleanup (delete files > 24h old)."""
    result = cleanup_old_files()
    return {"message": f"Cleanup done. Deleted {result['deleted']} files.", **result}


@router.get("/history")
async def get_history(limit: int = 50):
    """Get activity history — templates created, rendered, deleted, etc."""
    with get_db_session() as db:
        logs = db.execute(text("""
            SELECT id, action, entity_type, entity_id, details, created_at
            FROM activity_logs
            ORDER BY created_at DESC
            LIMIT :lim
        """), {"lim": limit}).mappings().all()

        result = []
        for row in logs:
            r = dict(row)
            if r.get("details") and isinstance(r["details"], str):
                try:
                    r["details"] = json.loads(r["details"])
                except:
                    pass
            result.append(r)

    return {"history": result, "count": len(result)}


@router.get("/renders")
async def get_render_history(limit: int = 50):
    """Get rendered document history with template names."""
    with get_db_session() as db:
        rows = db.execute(text("""
            SELECT rd.id, rd.template_id, t.name as template_name,
                   rd.docx_path, rd.pdf_path, rd.status, rd.created_at
            FROM rendered_documents rd
            LEFT JOIN templates t ON t.id = rd.template_id
            ORDER BY rd.created_at DESC
            LIMIT :lim
        """), {"lim": limit}).mappings().all()

        renders = []
        for row in rows:
            r = dict(row)
            # Check if files still exist
            if r.get("docx_path"):
                r["docx_exists"] = os.path.exists(r["docx_path"])
            if r.get("pdf_path"):
                r["pdf_exists"] = os.path.exists(r["pdf_path"])
            renders.append(r)

    return {"renders": renders, "count": len(renders)}
