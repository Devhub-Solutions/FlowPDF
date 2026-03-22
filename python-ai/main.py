import os
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from pydantic import BaseModel
import io
import re
import unicodedata
import logging
import asyncio
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="FlowPDF AI Service", version="1.0.0")

# Lazily loaded model instances
_ocr_predictor = None
_yolo_model = None


def get_ocr_predictor():
    """Lazy-load VietOCR predictor (CPU mode)."""
    global _ocr_predictor
    if _ocr_predictor is None:
        from vietocr.tool.predictor import Predictor
        from vietocr.tool.config import Cfg

        config_path = os.getenv("VIETOCR_CONFIG_PATH")
        if config_path and os.path.isfile(config_path):
            cfg_file = Path(config_path)
        else:
            cfg_file = Path(__file__).with_name("vietocr_vgg_transformer.yml")

        config = Cfg.load_config_from_file(str(cfg_file))
        weight_override = os.getenv("VIETOCR_WEIGHTS")
        if weight_override:
            config["weights"] = weight_override
            config["pretrain"] = weight_override
        config["device"] = "cpu"
        config["cnn"]["pretrained"] = False
        try:
            _ocr_predictor = Predictor(config)
            logger.info("VietOCR predictor loaded (config=%s)", cfg_file)
        except Exception as exc:
            logger.error(
                "Failed to initialize VietOCR predictor. "
                "Set VIETOCR_WEIGHTS to a reachable local path or URL. Error: %s",
                exc,
            )
            raise
    return _ocr_predictor


def get_yolo_model():
    """Lazy-load YOLO model (CPU mode, nano variant for speed)."""
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO

        _yolo_model = YOLO("yolov8n.pt")
        logger.info("YOLO model loaded")
    return _yolo_model


# ---------------------------------------------------------------------------
# Lookup helpers (csgt.vn scraping via Playwright)
# ---------------------------------------------------------------------------

def _normalize_key(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def _strip_accents(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text


def _to_ascii_json(data: dict) -> dict:
    return {_normalize_key(k): v for k, v in data.items()}


def _extract_table_result(page) -> dict:
    rows = page.locator("table tr")
    data: dict = {}
    for i in range(rows.count()):
        row = rows.nth(i)
        cells = row.locator("th, td")
        if cells.count() < 2:
            continue
        key = cells.first.inner_text().strip()
        value = cells.last.inner_text().strip()
        if key and value:
            data[key] = value
    return data


def _parse_violation_text_block(raw_text: str) -> dict:
    section = ""
    out: dict = {}

    section_map = {
        "Thong tin phuong tien": "vehicle",
        "Chi tiet vi pham": "violation",
        "Thong tin xu ly": "handling",
    }

    key_map = {
        "Bien so": "plate_number",
        "Loai xe": "vehicle_type",
        "Mau bien": "plate_color",
        "Loi vi pham": "violation_desc",
        "Thoi gian": "violation_time",
        "Dia diem": "violation_location",
        "Don vi phat hien": "detecting_unit",
        "Don vi giai quyet": "handling_unit",
        "Dia chi": "address",
    }

    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    for line in lines:
        ascii_line = _strip_accents(line)
        if ascii_line in section_map:
            section = section_map[ascii_line]
            continue

        if ":" not in line:
            if "Da xu phat" in _strip_accents(line):
                out["status"] = "processed"
            continue

        left, right = line.split(":", 1)
        left_ascii = _strip_accents(left).strip()
        right_value = right.strip()

        base_key = key_map.get(left_ascii, _normalize_key(left_ascii))

        if base_key == "address" and section:
            final_key = f"{section}_address"
        elif section and base_key in {
            "vehicle_type", "plate_color", "violation_desc",
            "violation_time", "violation_location", "detecting_unit", "handling_unit",
        }:
            final_key = f"{section}_{base_key}"
        else:
            final_key = base_key

        out[final_key] = right_value

    return out


_VN_TO_EN_INSPECTION_KEY = {
    "bien_so_xe": "license_plate",
    "nhan_hieu": "brand",
    "so_loai": "model_code",
    "so_khung": "vin",
    "so_may": "engine_number",
    "nam_san_xuat": "manufacture_year",
    "so_cho_ngoi": "seat_count",
    "so_gcn_kiem_dinh": "inspection_certificate_number",
    "ngay_kiem_dinh": "inspection_date",
    "thoi_han_kiem_dinh": "inspection_expiry_date",
    "khoi_luong_thiet_ke": "design_weight_kg",
    "khoi_luong_cho_phep": "permitted_weight_kg",
}

# csgt.vn endpoint URLs used by both scraping functions
_CSGT_VIOLATION_URL = "https://csgt.vn/tra-cuu-phat-nguoi"
_CSGT_INSPECTION_URL = "https://csgt.vn/tra-cuu-dang-kiem"

# CSS selector that matches both result tables and visible feedback messages
_RESULT_SELECTOR = "table tr, .text-danger, .text-success, .alert, .result, .message"


def _run_violation_lookup(plate: str, vehicle_type: str) -> dict:
    """Blocking Playwright scrape for traffic-fine lookup (csgt.vn)."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            page.goto(_CSGT_VIOLATION_URL, timeout=30000)
            page.locator("#vehicle_type").select_option(vehicle_type)
            page.get_by_role("textbox", name="Biển số xe").fill(plate)
            page.get_by_role("button", name="Tra cứu").click()

            # Wait for the first meaningful element to appear instead of a fixed delay
            page.wait_for_selector(_RESULT_SELECTOR, timeout=15000)

            result: dict = {}
            try:
                page.wait_for_selector("table tr", timeout=3000)
                result = _extract_table_result(page)
            except Exception:
                pass

            if result:
                return {"found": True, "data": _to_ascii_json(result)}

            messages = page.locator(".text-danger, .text-success, .alert, .result, .message")
            collected = []
            for i in range(messages.count()):
                text = messages.nth(i).inner_text().strip()
                if text:
                    collected.append(text)

            if collected:
                merged = "\n".join(collected)
                parsed = _parse_violation_text_block(merged)
                if parsed:
                    return {"found": True, "data": parsed}
                return {"found": False, "message": merged}

            return {"found": False, "message": "No data found. CAPTCHA or selector may have changed."}
        finally:
            context.close()
            browser.close()


def _run_inspection_lookup(plate: str, vin: str) -> dict:
    """Blocking Playwright scrape for vehicle-inspection lookup (csgt.vn)."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            page.goto(_CSGT_INSPECTION_URL, timeout=30000)
            page.get_by_role("textbox", name="Biển số xe Số khung").fill(plate)
            page.get_by_role("textbox", name="Nhập số khung").fill(vin)
            page.get_by_role("button", name="Tra cứu").click()

            # Wait for the first meaningful element to appear instead of a fixed delay
            page.wait_for_selector(_RESULT_SELECTOR, timeout=20000)

            result: dict = {}
            try:
                page.wait_for_selector("table tr", timeout=3000)
                result = _extract_table_result(page)
            except Exception:
                pass

            if result:
                normalized = _to_ascii_json(result)
                en_result = {_VN_TO_EN_INSPECTION_KEY.get(k, k): v for k, v in normalized.items()}
                return {"found": True, "data": en_result}

            messages = page.locator(".text-danger, .text-success, .alert, .result, .message")
            collected = []
            for i in range(messages.count()):
                text = messages.nth(i).inner_text().strip()
                if text:
                    collected.append(text)

            if collected:
                return {"found": False, "message": "\n".join(collected)}

            return {"found": False, "message": "No data found. CAPTCHA or selector may have changed."}
        finally:
            context.close()
            browser.close()


# ---------------------------------------------------------------------------
# Pydantic request models
# ---------------------------------------------------------------------------

class ViolationLookupRequest(BaseModel):
    plate: str
    vehicle_type: str = "motorbike"


class InspectionLookupRequest(BaseModel):
    plate: str
    vin: str


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/ocr")
async def ocr_image(
    file: UploadFile = File(...),
    engine: str = Query(
        "vncv",
        description="OCR engine to use (vncv: VNCV detection + VietOCR; simple: VietOCR only)",
    ),
):
    """
    Extract Vietnamese text from an uploaded image using VNCV (detection + VietOCR).

    - **file**: image file (JPEG, PNG, BMP, TIFF, …)
    - **engine**: vncv (default) or simple (legacy VietOCR only)

    Returns extracted text string and detected lines without writing any files.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    try:
        contents = await file.read()
        predictor = get_ocr_predictor()

        if engine == "simple":
            image = Image.open(io.BytesIO(contents)).convert("RGB")
            text = predictor.predict(image)
            return {"text": text, "filename": file.filename, "engine": "simple"}

        from vncv_ocr import run_vncv_ocr

        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, run_vncv_ocr, contents, predictor)
        result["filename"] = file.filename
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("OCR error: %s", exc)
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc


@app.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
    """
    Detect objects in an uploaded image using YOLO.

    - **file**: image file (JPEG, PNG, BMP, TIFF, …)

    Returns a list of detections, each with class name, confidence score,
    and bounding box coordinates [x1, y1, x2, y2].
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        model = get_yolo_model()
        results = model(image)

        detections = []
        for result in results:
            for box in result.boxes:
                detections.append(
                    {
                        "class": result.names[int(box.cls)],
                        "confidence": round(float(box.conf), 4),
                        "bbox": [round(v, 2) for v in box.xyxy[0].tolist()],
                    }
                )

        return {
            "detections": detections,
            "count": len(detections),
            "filename": file.filename,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Detection error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Detection failed: {exc}") from exc


@app.post("/lookup/violation")
async def lookup_violation(req: ViolationLookupRequest):
    """
    Look up traffic fine records (phạt nguội) from csgt.vn.

    - **plate**: vehicle license plate number (e.g. 60A64685)
    - **vehicle_type**: one of `car`, `motorbike`, `electricbike` (default: motorbike)

    Returns structured fine information or a not-found message.
    """
    plate = req.plate.strip().upper()
    if not plate:
        raise HTTPException(status_code=400, detail="plate is required")

    valid_types = {"car", "motorbike", "electricbike"}
    if req.vehicle_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"vehicle_type must be one of: {', '.join(sorted(valid_types))}",
        )

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _run_violation_lookup, plate, req.vehicle_type)
        return result
    except Exception as exc:
        logger.error("Violation lookup error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Violation lookup failed: {exc}") from exc


@app.post("/lookup/inspection")
async def lookup_inspection(req: InspectionLookupRequest):
    """
    Look up vehicle inspection (đăng kiểm) information from csgt.vn.

    - **plate**: vehicle license plate number (e.g. 64H00355)
    - **vin**: vehicle identification / chassis number (e.g. RNHA39KHALT028519)

    Returns structured inspection details or a not-found message.
    """
    plate = req.plate.strip().upper()
    vin = req.vin.strip().upper()
    if not plate or not vin:
        raise HTTPException(status_code=400, detail="plate and vin are required")

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _run_inspection_lookup, plate, vin)
        return result
    except Exception as exc:
        logger.error("Inspection lookup error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Inspection lookup failed: {exc}") from exc
