import os
import uuid
from fastapi import APIRouter, HTTPException, Body
from ...services.template_service import render_template
from ...services.libreoffice_service import convert_to_pdf
from ...core.config import settings

router = APIRouter()

# Reference to template storage (shared with template.py at module level)
# In production, this would be a database query
def _get_template_store():
    from .template import _templates
    return _templates

@router.post("/{template_id}")
async def render_document(template_id: str, data: dict = Body(...)):
    """Render a document from a saved template."""
    from ...services.designer_service import render_document as designer_render
    try:
        return designer_render(template_id, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract")
async def extract_template_form(file: __import__('fastapi').UploadFile = __import__('fastapi').File(...)):
    """Upload a raw DOCX, extract its variables using docxtpl, and generate a form schema."""
    if not file.filename.endswith(".docx"):
        raise HTTPException(400, "Only .docx files are supported")
    
    temp_id = str(uuid.uuid4())
    upload_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"temp_{temp_id}.docx")
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
        
    # Extract variables
    from docxtpl import DocxTemplate
    doc = DocxTemplate(file_path)
    vars = doc.get_undeclared_template_variables()
    
    fields = []
    for v in vars:
        fields.append({"name": v, "type": "string", "required": True})
        
    return {
        "success": True,
        "temp_id": temp_id,
        "filename": file.filename,
        "schema": {
            "template_name": file.filename,
            "fields": fields
        }
    }

@router.post("/direct/{temp_id}")
async def direct_render(temp_id: str, data: dict = Body(...)):
    """Directly render a previously uploaded temporary DOCX file."""
    upload_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "uploads")
    file_path = os.path.join(upload_dir, f"temp_{temp_id}.docx")
    
    if not os.path.exists(file_path):
        raise HTTPException(404, "Temporary template not found or expired")
        
    doc_id = str(uuid.uuid4())
    rendered_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "rendered")
    pdf_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "pdfs")
    
    output_docx = os.path.join(rendered_dir, f"{doc_id}.docx")
    try:
        render_template(file_path, data, output_docx)
    except Exception as e:
        raise HTTPException(500, f"Render failed: {str(e)}")
        
    pdf_path = None
    try:
        pdf_path = convert_to_pdf(output_docx, pdf_dir)
    except Exception as e:
        pass
        
    return {
        "document_id": doc_id,
        "docx_path": output_docx,
        "pdf_path": pdf_path,
        "status": "completed" if pdf_path else "docx_only"
    }

@router.get("/document/{document_id}")
async def get_document(document_id: str):
    """Get document info by ID."""
    # Check rendered directory
    rendered_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "rendered")
    pdf_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "pdfs")
    
    docx_path = os.path.join(rendered_dir, f"{document_id}.docx")
    pdf_path = os.path.join(pdf_dir, f"{document_id}.pdf")
    
    if not os.path.exists(docx_path):
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {
        "document_id": document_id,
        "docx_exists": os.path.exists(docx_path),
        "pdf_exists": os.path.exists(pdf_path),
        "docx_path": docx_path if os.path.exists(docx_path) else None,
        "pdf_path": pdf_path if os.path.exists(pdf_path) else None,
    }

@router.get("/document/{document_id}/download")
async def download_document(document_id: str):
    """Download a rendered document (PDF preferred, otherwise DOCX)."""
    from fastapi.responses import FileResponse
    
    pdf_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "pdfs")
    rendered_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "rendered")
    
    pdf_path = os.path.join(pdf_dir, f"{document_id}.pdf")
    docx_path = os.path.join(rendered_dir, f"{document_id}.docx")
    
    if os.path.exists(pdf_path):
        return FileResponse(pdf_path, media_type="application/pdf", filename=f"{document_id}.pdf")
    elif os.path.exists(docx_path):
        return FileResponse(docx_path, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename=f"{document_id}.docx")
    else:
        raise HTTPException(status_code=404, detail="Document not found")
