from fastapi import FastAPI, File, UploadFile, HTTPException
import io
import logging
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

        config = Cfg.load_config_from_name("vgg_transformer")
        config["device"] = "cpu"
        config["cnn"]["pretrained"] = False
        _ocr_predictor = Predictor(config)
        logger.info("VietOCR predictor loaded")
    return _ocr_predictor


def get_yolo_model():
    """Lazy-load YOLO model (CPU mode, nano variant for speed)."""
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO

        _yolo_model = YOLO("yolov8n.pt")
        logger.info("YOLO model loaded")
    return _yolo_model


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):
    """
    Extract Vietnamese text from an uploaded image using VietOCR.

    - **file**: image file (JPEG, PNG, BMP, TIFF, …)

    Returns extracted text string.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        predictor = get_ocr_predictor()
        text = predictor.predict(image)
        return {"text": text, "filename": file.filename}
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
