import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from ...services.excel_service import process_excel
from ...utils.file_utils import save_upload_file
from ...core.config import settings

router = APIRouter()

@router.post("/upload")
async def upload_excel(file: UploadFile = File(...)):
    """Upload and process an Excel file."""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be .xlsx or .xls")
    
    # Save uploaded file
    file_id = str(uuid.uuid4())
    upload_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{file_id}_{file.filename}")
    
    save_upload_file(file, file_path)
    
    # Process Excel (synchronously for now, can be async via Celery)
    try:
        result = process_excel(file_path)
        return {
            "message": f"Excel file '{file.filename}' uploaded and processed",
            "file_id": file_id,
            "file_path": file_path,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing Excel file: {str(e)}")

@router.get("/jobs")
async def list_jobs():
    """List all import jobs (placeholder)."""
    return {"jobs": [], "message": "No active import jobs"}
