from .celery_app import celery_app
from ..services.libreoffice_service import convert_to_pdf
import os

@celery_app.task(name="app.workers.tasks.convert_to_pdf_task")
def convert_to_pdf_task(input_path: str, output_dir: str):
    """
    Background task to convert a document to PDF.
    """
    pdf_path = convert_to_pdf(input_path, output_dir)
    if pdf_path:
        # Update document status in DB
        # upload_to_supabase_storage(pdf_path)
        return {"status": "success", "pdf_path": pdf_path}
    else:
        return {"status": "error", "message": "Conversion failed"}

@celery_app.task(name="app.workers.tasks.process_excel_task")
def process_excel_task(file_path: str):
    """
    Background task to process an Excel file.
    """
    # Logic to process excel
    return {"status": "success", "message": "Excel processed"}
