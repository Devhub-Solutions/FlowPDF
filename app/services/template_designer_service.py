"""
Template Designer Service v3 — MySQL Persistent Storage
Key improvements:
  - All data stored in MySQL (templates, mappings, rendered docs, logs)
  - Mappings use original_text for reliable matching
  - Table loop/array support with manual row expansion
  - Structured table output for easy frontend rendering
"""

import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

from .docx_parser_service import parse_document_structure, apply_mappings_to_document
from .template_service import render_template
from .libreoffice_service import convert_to_pdf
from .db_repository import (
    db_create_template, db_get_template, db_list_templates,
    db_delete_template, db_update_template,
    db_create_mapping, db_list_mappings, db_get_mapping, db_delete_mapping,
    db_create_rendered, db_update_rendered,
    log_activity,
)
from ..core.config import settings


# ═══════════════════════════════════════════
# TEMPLATE CRUD
# ═══════════════════════════════════════════

def create_template(name: str, file_path: str) -> Dict[str, Any]:
    return db_create_template(name, file_path)


def get_template(template_id: str) -> Optional[Dict[str, Any]]:
    t = db_get_template(template_id)
    if t:
        # Normalize datetime to string for JSON
        for key in ["created_at", "updated_at"]:
            if t.get(key) and hasattr(t[key], "isoformat"):
                t[key] = t[key].isoformat()
    return t


def list_templates() -> List[Dict[str, Any]]:
    templates = db_list_templates()
    for t in templates:
        for key in ["created_at", "updated_at"]:
            if t.get(key) and hasattr(t[key], "isoformat"):
                t[key] = t[key].isoformat()
    return templates


def delete_template(template_id: str) -> bool:
    template = get_template(template_id)
    if not template:
        return False
    # Clean up files
    for path_key in ["file_path", "template_path"]:
        path = template.get(path_key)
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass
    return db_delete_template(template_id)


# ═══════════════════════════════════════════
# DOCUMENT STRUCTURE
# ═══════════════════════════════════════════

def get_template_structure(template_id: str) -> Optional[Dict[str, Any]]:
    template = get_template(template_id)
    if not template:
        return None
    file_path = template["file_path"]
    if not os.path.exists(file_path):
        return None
    structure = parse_document_structure(file_path)
    structure["template_id"] = template_id
    return structure


# ═══════════════════════════════════════════
# MAPPING CRUD
# ═══════════════════════════════════════════

def create_mapping(template_id: str, mapping_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    template = get_template(template_id)
    if not template or template["status"] == "published":
        return None

    mapping_type = mapping_data.get("mapping_type", "paragraph")
    if mapping_type not in ("paragraph", "table_cell", "table_loop"):
        return None

    return db_create_mapping(template_id, mapping_data)


def list_mappings(template_id: str) -> List[Dict[str, Any]]:
    return db_list_mappings(template_id)


def get_mapping(template_id: str, mapping_id: str) -> Optional[Dict[str, Any]]:
    return db_get_mapping(template_id, mapping_id)


def update_mapping(template_id: str, mapping_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    mapping = get_mapping(template_id, mapping_id)
    if not mapping:
        return None
    template = get_template(template_id)
    if template and template["status"] == "published":
        return None
    # For now, delete + recreate with merged data
    merged = {**mapping, **{k: v for k, v in update_data.items() if v is not None}}
    db_delete_mapping(template_id, mapping_id)
    return db_create_mapping(template_id, merged)


def delete_mapping(template_id: str, mapping_id: str) -> bool:
    template = get_template(template_id)
    if template and template["status"] == "published":
        return False
    return db_delete_mapping(template_id, mapping_id)


# ═══════════════════════════════════════════
# PUBLISH
# ═══════════════════════════════════════════

def publish_template(template_id: str) -> Optional[Dict[str, Any]]:
    template = get_template(template_id)
    if not template:
        return None

    mappings = list_mappings(template_id)
    if not mappings:
        return None

    template_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "templates", "published")
    os.makedirs(template_dir, exist_ok=True)
    template_path = os.path.join(template_dir, f"{template_id}_template.docx")

    success = apply_mappings_to_document(
        source_path=template["file_path"],
        mappings=mappings,
        output_path=template_path,
    )

    if not success:
        return None

    updated = db_update_template(template_id, status="published", template_path=template_path)
    log_activity("template_published", "template", template_id)
    return updated


# ═══════════════════════════════════════════
# SCHEMA
# ═══════════════════════════════════════════

def get_template_schema(template_id: str) -> Optional[Dict[str, Any]]:
    template = get_template(template_id)
    if not template:
        return None

    mappings = list_mappings(template_id)
    fields = []
    seen_labels = set()

    for mapping in mappings:
        mtype = mapping.get("mapping_type", "paragraph")

        if mtype in ("paragraph", "table_cell"):
            label = mapping["label"]
            if label not in seen_labels:
                seen_labels.add(label)
                fields.append({
                    "name": label,
                    "type": mapping.get("field_type", "string"),
                    "required": mapping.get("required", True),
                    "original_text": mapping.get("original_text", ""),
                })
        elif mtype == "table_loop":
            loop_var = mapping["loop_variable"]
            cell_labels = mapping.get("cell_labels", [])
            sub_fields = []
            for cl in cell_labels:
                sub_fields.append({
                    "name": cl["label"],
                    "type": cl.get("field_type", "string"),
                    "original_text": cl.get("original_text", ""),
                })
            fields.append({
                "name": loop_var,
                "type": "array",
                "required": True,
                "original_text": f"Table loop ({len(sub_fields)} columns)",
                "sub_fields": sub_fields,
            })

    return {
        "template_id": template_id,
        "template_name": template["name"],
        "status": template["status"],
        "fields": fields,
    }


# ═══════════════════════════════════════════
# RENDER
# ═══════════════════════════════════════════

def render_document(template_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    template = get_template(template_id)
    if not template or template["status"] != "published":
        return None

    template_path = template.get("template_path")
    if not template_path or not os.path.exists(template_path):
        return None

    # Validate required fields
    schema = get_template_schema(template_id)
    if schema:
        for field in schema["fields"]:
            if field["required"] and field["name"] not in data:
                raise ValueError(f"Missing required field: {field['name']}")

    doc_id = str(uuid.uuid4())
    rendered_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "rendered")
    pdf_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "pdfs")
    os.makedirs(rendered_dir, exist_ok=True)
    os.makedirs(pdf_dir, exist_ok=True)

    output_docx = os.path.join(rendered_dir, f"{doc_id}.docx")

    # Record in DB
    db_create_rendered(doc_id, template_id, data, status="pending")

    # Step 1: Expand table loops (manual row duplication)
    mappings = list_mappings(template_id)
    loop_mappings = [m for m in mappings if m.get("mapping_type") == "table_loop"]

    if loop_mappings:
        from .docx_parser_service import expand_table_loops
        temp_expanded = os.path.join(rendered_dir, f"{doc_id}_expanded.docx")
        expand_table_loops(template_path, data, mappings, temp_expanded)

        docxtpl_data = {k: v for k, v in data.items()
                        if not any(m["loop_variable"] == k for m in loop_mappings)}
        render_template(temp_expanded, docxtpl_data, output_docx)

        try:
            os.remove(temp_expanded)
        except OSError:
            pass
    else:
        render_template(template_path, data, output_docx)

    pdf_path = None
    try:
        pdf_path = convert_to_pdf(output_docx, pdf_dir)
    except Exception as e:
        print(f"⚠️  PDF conversion failed: {e}")

    status = "completed" if pdf_path else "docx_only"
    db_update_rendered(doc_id, docx_path=output_docx, pdf_path=pdf_path, status=status)

    return {
        "document_id": doc_id,
        "template_id": template_id,
        "docx_path": output_docx,
        "pdf_path": pdf_path,
        "status": status,
    }
