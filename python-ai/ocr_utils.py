import html
import re


def normalize_ocr_text(text: str) -> str:
    """Normalize OCR output to remove common noise tokens."""
    if not text:
        return ""
    cleaned = html.unescape(text)
    cleaned = cleaned.replace("}", " ").replace("{", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()
