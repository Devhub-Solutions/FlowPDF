import os
import shutil

def save_upload_file(upload_file, destination: str):
    """
    Save an uploaded file to a destination path.
    """
    try:
        with open(destination, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
    finally:
        upload_file.file.close()

def delete_file(file_path: str):
    """
    Delete a file from the filesystem.
    """
    if os.path.exists(file_path):
        os.remove(file_path)
