"""
MySQL Repository for Template Designer
Replaces in-memory dicts with persistent MySQL storage + activity logging.
"""
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

from sqlalchemy import text
from ..core.database import get_db_session


# ═══════════════════════════════════════════
# ACTIVITY LOG
# ═══════════════════════════════════════════

def log_activity(action: str, entity_type: str = None, entity_id: str = None, details: dict = None):
    """Log an activity to the database."""
    try:
        with get_db_session() as db:
            db.execute(text("""
                INSERT INTO activity_logs (action, entity_type, entity_id, details)
                VALUES (:action, :entity_type, :entity_id, :details)
            """), {
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "details": json.dumps(details, ensure_ascii=False) if details else None,
            })
    except Exception as e:
        print(f"⚠️  Log failed: {e}")


# ═══════════════════════════════════════════
# TEMPLATE CRUD
# ═══════════════════════════════════════════

def db_create_template(name: str, file_path: str) -> Dict[str, Any]:
    template_id = str(uuid.uuid4())
    now = datetime.utcnow()
    with get_db_session() as db:
        db.execute(text("""
            INSERT INTO templates (id, name, file_path, status, created_at)
            VALUES (:id, :name, :file_path, 'draft', :created_at)
        """), {"id": template_id, "name": name, "file_path": file_path, "created_at": now})

    log_activity("template_created", "template", template_id, {"name": name})
    return db_get_template(template_id)


def db_get_template(template_id: str) -> Optional[Dict[str, Any]]:
    with get_db_session() as db:
        row = db.execute(text("""
            SELECT t.*, 
                   (SELECT COUNT(*) FROM template_mappings WHERE template_id = t.id) as mappings_count
            FROM templates t WHERE t.id = :id
        """), {"id": template_id}).mappings().first()
        if not row:
            return None
        return dict(row)


def db_list_templates() -> List[Dict[str, Any]]:
    with get_db_session() as db:
        rows = db.execute(text("""
            SELECT t.*,
                   (SELECT COUNT(*) FROM template_mappings WHERE template_id = t.id) as mappings_count
            FROM templates t ORDER BY t.created_at DESC
        """)).mappings().all()
        return [dict(r) for r in rows]


def db_delete_template(template_id: str) -> bool:
    with get_db_session() as db:
        result = db.execute(text("DELETE FROM templates WHERE id = :id"), {"id": template_id})
        if result.rowcount > 0:
            log_activity("template_deleted", "template", template_id)
            return True
        return False


def db_update_template(template_id: str, **kwargs) -> Optional[Dict[str, Any]]:
    sets = []
    params = {"id": template_id}
    for key, value in kwargs.items():
        if value is not None:
            sets.append(f"{key} = :{key}")
            params[key] = value
    if not sets:
        return db_get_template(template_id)
    with get_db_session() as db:
        db.execute(text(f"UPDATE templates SET {', '.join(sets)} WHERE id = :id"), params)
    return db_get_template(template_id)


# ═══════════════════════════════════════════
# MAPPING CRUD
# ═══════════════════════════════════════════

def db_create_mapping(template_id: str, mapping_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    mapping_id = str(uuid.uuid4())
    mapping_type = mapping_data.get("mapping_type", "paragraph")

    with get_db_session() as db:
        db.execute(text("""
            INSERT INTO template_mappings 
                (id, template_id, mapping_type, label, paragraph_index, table_index,
                 row_index, col_index, original_text, required, field_type,
                 data_row_index, loop_variable, cell_labels)
            VALUES 
                (:id, :template_id, :mapping_type, :label, :paragraph_index, :table_index,
                 :row_index, :col_index, :original_text, :required, :field_type,
                 :data_row_index, :loop_variable, :cell_labels)
        """), {
            "id": mapping_id,
            "template_id": template_id,
            "mapping_type": mapping_type,
            "label": mapping_data.get("label"),
            "paragraph_index": mapping_data.get("paragraph_index"),
            "table_index": mapping_data.get("table_index"),
            "row_index": mapping_data.get("row_index"),
            "col_index": mapping_data.get("col_index"),
            "original_text": mapping_data.get("original_text"),
            "required": mapping_data.get("required", True),
            "field_type": mapping_data.get("field_type", "string"),
            "data_row_index": mapping_data.get("data_row_index"),
            "loop_variable": mapping_data.get("loop_variable"),
            "cell_labels": json.dumps(mapping_data.get("cell_labels"), ensure_ascii=False)
                if mapping_data.get("cell_labels") else None,
        })

    log_activity("mapping_created", "mapping", mapping_id, {
        "template_id": template_id,
        "type": mapping_type,
        "label": mapping_data.get("label") or mapping_data.get("loop_variable"),
    })
    return db_get_mapping(template_id, mapping_id)


def db_list_mappings(template_id: str) -> List[Dict[str, Any]]:
    with get_db_session() as db:
        rows = db.execute(text("""
            SELECT * FROM template_mappings WHERE template_id = :tid ORDER BY created_at
        """), {"tid": template_id}).mappings().all()
        result = []
        for r in rows:
            m = dict(r)
            if m.get("cell_labels") and isinstance(m["cell_labels"], str):
                m["cell_labels"] = json.loads(m["cell_labels"])
            result.append(m)
        return result


def db_get_mapping(template_id: str, mapping_id: str) -> Optional[Dict[str, Any]]:
    with get_db_session() as db:
        row = db.execute(text("""
            SELECT * FROM template_mappings WHERE id = :id AND template_id = :tid
        """), {"id": mapping_id, "tid": template_id}).mappings().first()
        if not row:
            return None
        m = dict(row)
        if m.get("cell_labels") and isinstance(m["cell_labels"], str):
            m["cell_labels"] = json.loads(m["cell_labels"])
        return m


def db_delete_mapping(template_id: str, mapping_id: str) -> bool:
    with get_db_session() as db:
        result = db.execute(text("""
            DELETE FROM template_mappings WHERE id = :id AND template_id = :tid
        """), {"id": mapping_id, "tid": template_id})
        if result.rowcount > 0:
            log_activity("mapping_deleted", "mapping", mapping_id, {"template_id": template_id})
            return True
        return False


# ═══════════════════════════════════════════
# RENDERED DOCUMENTS
# ═══════════════════════════════════════════

def db_create_rendered(doc_id: str, template_id: str, data: dict,
                       docx_path: str = None, pdf_path: str = None,
                       status: str = "pending") -> Dict[str, Any]:
    with get_db_session() as db:
        db.execute(text("""
            INSERT INTO rendered_documents (id, template_id, data, docx_path, pdf_path, status)
            VALUES (:id, :tid, :data, :docx, :pdf, :status)
        """), {
            "id": doc_id,
            "tid": template_id,
            "data": json.dumps(data, ensure_ascii=False) if data else None,
            "docx": docx_path, "pdf": pdf_path, "status": status,
        })
    log_activity("document_rendered", "document", doc_id, {"template_id": template_id, "status": status})
    return {"id": doc_id, "template_id": template_id, "status": status}


def db_update_rendered(doc_id: str, **kwargs):
    sets = []
    params = {"id": doc_id}
    for key, value in kwargs.items():
        if value is not None:
            sets.append(f"{key} = :{key}")
            params[key] = value
    if sets:
        with get_db_session() as db:
            db.execute(text(f"UPDATE rendered_documents SET {', '.join(sets)} WHERE id = :id"), params)
