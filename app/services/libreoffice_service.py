import subprocess
import os

def convert_to_pdf(input_path: str, output_dir: str):
    """
    Convert a document to PDF using LibreOffice headless.
    """
    try:
        subprocess.run([
            "libreoffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            output_dir,
            input_path
        ], check=True)
        
        # Get the output file path
        filename = os.path.basename(input_path)
        name, _ = os.path.splitext(filename)
        pdf_path = os.path.join(output_dir, f"{name}.pdf")
        return pdf_path
    except subprocess.CalledProcessError as e:
        print(f"Error converting to PDF: {e}")
        return None
