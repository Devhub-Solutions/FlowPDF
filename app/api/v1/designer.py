"""
Template Designer API v2
- Mappings use original_text (not offsets) for reliable matching
- Tables returned as structured rows/cols for easy HTML rendering
- Table loop (array) mapping support
"""

import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Body
from typing import Dict, Any

from ...services.template_designer_service import (
    create_template, get_template, list_templates, delete_template,
    get_template_structure, create_mapping, get_mapping, list_mappings,
    update_mapping, delete_mapping, publish_template, get_template_schema,
    render_document,
)
from ...utils.file_utils import save_upload_file
from ...core.config import settings

router = APIRouter()


# ═══ TEMPLATE CRUD ═══

@router.post("/raw")
async def upload_raw_template(file: UploadFile = File(...)):
    """Upload a raw DOCX file to start design."""
    if not file.filename.endswith(('.docx',)):
        raise HTTPException(status_code=400, detail="Only .docx files supported")

    file_id = str(uuid.uuid4())
    upload_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "templates", "raw")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{file_id}_{file.filename}")
    save_upload_file(file, file_path)

    template = create_template(name=file.filename, file_path=file_path)
    return {"message": f"Template '{file.filename}' uploaded", "template_id": template["id"], "status": "draft"}


@router.get("/")
async def get_all_templates():
    return {"templates": list_templates()}


@router.get("/{template_id}")
async def get_template_info(template_id: str):
    t = get_template(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.delete("/{template_id}")
async def remove_template(template_id: str):
    if not delete_template(template_id):
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}


# ═══ STRUCTURE (paragraphs + tables as nested rows/cols) ═══

@router.get("/{template_id}/structure")
async def get_structure(template_id: str):
    """
    Returns:
      paragraphs: [{paragraph_index, text, style, is_heading, runs}]
      tables: [{table_index, num_rows, num_cols, rows: [{row_index, cells: [{col_index, text}]}]}]
    """
    structure = get_template_structure(template_id)
    if not structure:
        raise HTTPException(status_code=404, detail="Template not found")
    return structure


# ═══ MAPPINGS CRUD ═══

@router.post("/{template_id}/mappings")
async def create_template_mapping(template_id: str, mapping: Dict[str, Any] = Body(...)):
    """
    Create a mapping. Three types supported:

    1. Paragraph mapping:
    {
        "mapping_type": "paragraph",
        "paragraph_index": 2,
        "original_text": "Nguyễn Văn A",
        "label": "customer_name",
        "required": true,
        "field_type": "string"
    }

    2. Table cell mapping:
    {
        "mapping_type": "table_cell",
        "table_index": 0,
        "row_index": 1,
        "col_index": 2,
        "original_text": "5.000.000",
        "label": "amount",
        "field_type": "currency"
    }

    3. Table loop (array) mapping:
    {
        "mapping_type": "table_loop",
        "table_index": 0,
        "data_row_index": 1,
        "loop_variable": "items",
        "cell_labels": [
            {"col_index": 0, "label": "stt", "original_text": "1"},
            {"col_index": 1, "label": "description", "original_text": "Dịch vụ tư vấn"},
            {"col_index": 2, "label": "amount", "original_text": "5.000.000"}
        ]
    }
    """
    mapping_type = mapping.get("mapping_type", "paragraph")

    if mapping_type == "paragraph":
        for f in ["paragraph_index", "original_text", "label"]:
            if f not in mapping:
                raise HTTPException(status_code=400, detail=f"'{f}' is required for paragraph mapping")
    elif mapping_type == "table_cell":
        for f in ["table_index", "row_index", "col_index", "original_text", "label"]:
            if f not in mapping:
                raise HTTPException(status_code=400, detail=f"'{f}' is required for table_cell mapping")
    elif mapping_type == "table_loop":
        for f in ["table_index", "data_row_index", "loop_variable", "cell_labels"]:
            if f not in mapping:
                raise HTTPException(status_code=400, detail=f"'{f}' is required for table_loop mapping")
    else:
        raise HTTPException(status_code=400, detail=f"Unknown mapping_type: {mapping_type}")

    result = create_mapping(template_id, mapping)
    if not result:
        raise HTTPException(status_code=400, detail="Cannot create mapping (template not found or published)")
    return {"message": "Mapping created", "mapping": result}


@router.get("/{template_id}/mappings")
async def get_template_mappings(template_id: str):
    t = get_template(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"mappings": list_mappings(template_id)}


@router.put("/{template_id}/mappings/{mapping_id}")
async def update_template_mapping(template_id: str, mapping_id: str, data: Dict[str, Any] = Body(...)):
    result = update_mapping(template_id, mapping_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Mapping not found or template published")
    return {"message": "Updated", "mapping": result}


@router.delete("/{template_id}/mappings/{mapping_id}")
async def remove_mapping(template_id: str, mapping_id: str):
    if not delete_mapping(template_id, mapping_id):
        raise HTTPException(status_code=404, detail="Mapping not found or template published")
    return {"message": "Deleted"}


# ═══ PUBLISH ═══

@router.post("/{template_id}/publish")
async def publish(template_id: str):
    t = get_template(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    if t["status"] == "published":
        raise HTTPException(status_code=400, detail="Already published")
    if not list_mappings(template_id):
        raise HTTPException(status_code=400, detail="No mappings defined")

    result = publish_template(template_id)
    if not result:
        raise HTTPException(status_code=500, detail="Publish failed")
    return {"message": "Published", "template": result}


# ═══ SCHEMA ═══

@router.get("/{template_id}/schema")
async def get_schema(template_id: str):
    schema = get_template_schema(template_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Template not found")
    return schema


# ═══ RENDER ═══

@router.post("/{template_id}/render")
async def render(template_id: str, data: Dict[str, Any] = Body(...)):
    t = get_template(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    if t["status"] != "published":
        raise HTTPException(status_code=400, detail="Template must be published first")
    try:
        result = render_document(template_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Render failed: {str(e)}")
    if not result:
        raise HTTPException(status_code=500, detail="Render failed")
    return result
