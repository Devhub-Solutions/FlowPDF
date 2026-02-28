import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from ...services.template_service import extract_variables
from ...utils.file_utils import save_upload_file
from ...core.config import settings

router = APIRouter()

# In-memory template storage (replace with DB in production)
_templates = {}

@router.post("/upload")
async def upload_template(file: UploadFile = File(...)):
    """Upload a DOCX template and extract its variables."""
    if not file.filename.endswith(('.docx', '.doc')):
        raise HTTPException(status_code=400, detail="File must be .docx or .doc")
    
    template_id = str(uuid.uuid4())
    template_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "templates")
    os.makedirs(template_dir, exist_ok=True)
    file_path = os.path.join(template_dir, f"{template_id}_{file.filename}")
    
    save_upload_file(file, file_path)
    
    # Extract template variables
    try:
        variables = list(extract_variables(file_path))
    except Exception as e:
        variables = []
        print(f"Warning: Could not extract variables: {e}")
    
    # Store template info
    _templates[template_id] = {
        "id": template_id,
        "name": file.filename,
        "file_path": file_path,
        "variables": variables,
    }
    
    return {
        "message": f"Template '{file.filename}' uploaded successfully",
        "template_id": template_id,
        "variables": variables,
    }

@router.get("/")
async def get_templates():
    """List all templates."""
    return {"templates": list(_templates.values())}

@router.get("/{template_id}")
async def get_template(template_id: str):
    """Get a specific template by ID."""
    if template_id not in _templates:
        raise HTTPException(status_code=404, detail="Template not found")
    return _templates[template_id]

@router.delete("/{template_id}")
async def delete_template(template_id: str):
    """Delete a template."""
    if template_id not in _templates:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = _templates.pop(template_id)
    # Remove file
    if os.path.exists(template["file_path"]):
        os.remove(template["file_path"])
    
    return {"message": f"Template '{template['name']}' deleted"}
