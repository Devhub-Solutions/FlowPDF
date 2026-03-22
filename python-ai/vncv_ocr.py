import math
import os
import urllib.request
import urllib.parse
from functools import lru_cache
from typing import List, Tuple

import cv2
import numpy as np
from onnxruntime import InferenceSession
from PIL import Image
from pyclipper import ET_CLOSEDPOLYGON, JT_ROUND, PyclipperOffset
from shapely.geometry import Polygon
from ocr_utils import normalize_ocr_text

# Remote weight URLs from the open-source VNCV project (Devhub-Solutions/VNCV)
_DEFAULT_WEIGHTS_BASE = (
    "https://raw.githubusercontent.com/Devhub-Solutions/VNCV/refs/heads/main/weights"
)
_DETECTION_SOURCE = os.getenv(
    "VNCV_DETECTION_MODEL", f"{_DEFAULT_WEIGHTS_BASE}/detection.onnx"
)
_CLASSIFICATION_SOURCE = os.getenv(
    "VNCV_CLASSIFICATION_MODEL", f"{_DEFAULT_WEIGHTS_BASE}/classification.onnx"
)
_PROVIDERS = ["CPUExecutionProvider"]


def _read_bytes(source: str) -> bytes:
    """Read model bytes from a local path or URL without writing to disk."""
    if source.startswith("http://") or source.startswith("https://"):
        parsed = urllib.parse.urlparse(source)
        if not parsed.scheme or not parsed.netloc:
            raise RuntimeError(f"Invalid model URL: {source}")
        if parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
            raise RuntimeError("Refusing to download model from loopback address")
        with urllib.request.urlopen(source) as resp:
            if getattr(resp, "status", 200) != 200:
                raise RuntimeError(f"Unable to download model from {source} (status {resp.status})")
            return resp.read()

    with open(source, "rb") as f:
        return f.read()


@lru_cache(maxsize=1)
def _detection_bytes() -> bytes:
    return _read_bytes(_DETECTION_SOURCE)


@lru_cache(maxsize=1)
def _classification_bytes() -> bytes:
    return _read_bytes(_CLASSIFICATION_SOURCE)


@lru_cache(maxsize=1)
def _detection_session() -> InferenceSession:
    return InferenceSession(_detection_bytes(), providers=_PROVIDERS)


@lru_cache(maxsize=1)
def _classification_session() -> InferenceSession:
    return InferenceSession(_classification_bytes(), providers=_PROVIDERS)


def _sort_polygon(points: List[np.ndarray]) -> List[np.ndarray]:
    points.sort(key=lambda x: (x[0][1], x[0][0]))
    for i in range(len(points) - 1):
        for j in range(i, -1, -1):
            if abs(points[j + 1][0][1] - points[j][0][1]) < 10 and (
                points[j + 1][0][0] < points[j][0][0]
            ):
                points[j], points[j + 1] = points[j + 1], points[j]
            else:
                break
    return points


def _crop_image(image: np.ndarray, points: np.ndarray) -> np.ndarray:
    assert len(points) == 4, "shape of points must be 4*2"
    crop_width = int(
        max(np.linalg.norm(points[0] - points[1]), np.linalg.norm(points[2] - points[3]))
    )
    crop_height = int(
        max(np.linalg.norm(points[0] - points[3]), np.linalg.norm(points[1] - points[2]))
    )
    pts_std = np.float32([[0, 0], [crop_width, 0], [crop_width, crop_height], [0, crop_height]])
    matrix = cv2.getPerspectiveTransform(points, pts_std)
    image = cv2.warpPerspective(
        image,
        matrix,
        (crop_width, crop_height),
        borderMode=cv2.BORDER_REPLICATE,
        flags=cv2.INTER_CUBIC,
    )
    height, width = image.shape[0:2]
    if height * 1.0 / width >= 1.5:
        image = np.rot90(image, k=3)
    return image


class Detection:
    def __init__(self) -> None:
        session = _detection_session()
        self.session = session
        self.inputs = session.get_inputs()[0]
        self.min_size = 3
        self.max_size = 960
        self.box_thresh = 0.8
        self.mask_thresh = 0.8
        self.mean = np.array([123.675, 116.28, 103.53]).reshape(1, -1).astype("float64")
        self.std = 1 / np.array([58.395, 57.12, 57.375]).reshape(1, -1).astype("float64")

    def filter_polygon(self, points: np.ndarray, shape: Tuple[int, int]) -> np.ndarray:
        width, height = shape[1], shape[0]
        filtered = []
        for point in points:
            if isinstance(point, list):
                point = np.array(point)
            point = self.clockwise_order(point)
            point = self.clip(point, height, width)
            w = int(np.linalg.norm(point[0] - point[1]))
            h = int(np.linalg.norm(point[0] - point[3]))
            if w <= 3 or h <= 3:
                continue
            filtered.append(point)
        return np.array(filtered)

    def boxes_from_bitmap(
        self, output: np.ndarray, mask: np.ndarray, dest_width: int, dest_height: int
    ) -> Tuple[np.ndarray, List[float]]:
        mask = (mask * 255).astype(np.uint8)
        height, width = mask.shape
        outs = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        contours = outs[0] if len(outs) == 2 else outs[1]
        boxes, scores = [], []
        for contour in contours:
            points, min_side = self.get_min_boxes(contour)
            if min_side < self.min_size:
                continue
            points = np.array(points)
            score = self.box_score(output, contour)
            if self.box_thresh > score:
                continue
            polygon = Polygon(points)
            distance = polygon.area / polygon.length
            offset = PyclipperOffset()
            offset.AddPath(points, JT_ROUND, ET_CLOSEDPOLYGON)
            points = np.array(offset.Execute(distance * 1.5)).reshape((-1, 1, 2))
            box, min_side = self.get_min_boxes(points)
            if min_side < self.min_size + 2:
                continue
            box = np.array(box)
            box[:, 0] = np.clip(np.round(box[:, 0] / width * dest_width), 0, dest_width)
            box[:, 1] = np.clip(np.round(box[:, 1] / height * dest_height), 0, dest_height)
            boxes.append(box.astype("int32"))
            scores.append(score)
        return np.array(boxes, dtype="int32"), scores

    @staticmethod
    def get_min_boxes(contour: np.ndarray) -> Tuple[List[List[float]], float]:
        bounding_box = cv2.minAreaRect(contour)
        points = sorted(list(cv2.boxPoints(bounding_box)), key=lambda x: x[0])
        if points[1][1] > points[0][1]:
            index_1, index_4 = 0, 1
        else:
            index_1, index_4 = 1, 0
        if points[3][1] > points[2][1]:
            index_2, index_3 = 2, 3
        else:
            index_2, index_3 = 3, 2
        box = [points[index_1], points[index_2], points[index_3], points[index_4]]
        return box, min(bounding_box[1])

    @staticmethod
    def box_score(bitmap: np.ndarray, contour: np.ndarray) -> float:
        h, w = bitmap.shape[:2]
        contour = contour.copy().reshape(-1, 2)
        x1 = np.clip(np.min(contour[:, 0]), 0, w - 1)
        y1 = np.clip(np.min(contour[:, 1]), 0, h - 1)
        x2 = np.clip(np.max(contour[:, 0]), 0, w - 1)
        y2 = np.clip(np.max(contour[:, 1]), 0, h - 1)
        mask = np.zeros((y2 - y1 + 1, x2 - x1 + 1), dtype=np.uint8)
        contour[:, 0] -= x1
        contour[:, 1] -= y1
        cv2.fillPoly(mask, contour.reshape(1, -1, 2).astype("int32"), color=(1, 1))
        return cv2.mean(bitmap[y1 : y2 + 1, x1 : x2 + 1], mask)[0]

    @staticmethod
    def clockwise_order(point: np.ndarray) -> np.ndarray:
        poly = np.zeros((4, 2), dtype="float32")
        s = point.sum(axis=1)
        poly[0] = point[np.argmin(s)]
        poly[2] = point[np.argmax(s)]
        tmp = np.delete(point, (np.argmin(s), np.argmax(s)), axis=0)
        diff = np.diff(np.array(tmp), axis=1)
        poly[1] = tmp[np.argmin(diff)]
        poly[3] = tmp[np.argmax(diff)]
        return poly

    @staticmethod
    def clip(points: np.ndarray, h: int, w: int) -> np.ndarray:
        for i in range(points.shape[0]):
            points[i, 0] = int(min(max(points[i, 0], 0), w - 1))
            points[i, 1] = int(min(max(points[i, 1], 0), h - 1))
        return points

    def resize(self, image: np.ndarray) -> np.ndarray:
        h, w = image.shape[:2]
        ratio = float(self.max_size) / max(h, w) if max(h, w) > self.max_size else 1.0
        resize_h = max(int(round(int(h * ratio) / 32) * 32), 32)
        resize_w = max(int(round(int(w * ratio) / 32) * 32), 32)
        return cv2.resize(image, (resize_w, resize_h))

    @staticmethod
    def zero_pad(image: np.ndarray) -> np.ndarray:
        h, w, c = image.shape
        pad = np.zeros((max(32, h), max(32, w), c), np.uint8)
        pad[:h, :w, :] = image
        return pad

    def __call__(self, x: np.ndarray) -> Tuple[np.ndarray, List[float]]:
        h, w = x.shape[:2]
        if sum([h, w]) < 64:
            x = self.zero_pad(x)
        x = self.resize(x).astype("float32")
        cv2.subtract(x, self.mean, x)
        cv2.multiply(x, self.std, x)
        x = np.expand_dims(x.transpose((2, 0, 1)), axis=0)
        outputs = self.session.run(None, {self.inputs.name: x})[0][0, 0]
        boxes, scores = self.boxes_from_bitmap(outputs, outputs > self.mask_thresh, w, h)
        filtered = self.filter_polygon(boxes, (h, w))
        return filtered, scores[: len(filtered)]


class Classification:
    def __init__(self) -> None:
        session = _classification_session()
        self.session = session
        self.inputs = session.get_inputs()[0]
        self.threshold = 0.98
        self.labels = ["0", "180"]

    @staticmethod
    def resize(image: np.ndarray) -> np.ndarray:
        input_c, input_h, input_w = 3, 48, 192
        h, w = image.shape[:2]
        ratio = w / float(h)
        resized_w = input_w if math.ceil(input_h * ratio) > input_w else int(
            math.ceil(input_h * ratio)
        )
        resized_image = (
            cv2.resize(image, (resized_w, input_h)).transpose((2, 0, 1)).astype("float32")
        )
        resized_image = resized_image / 255.0
        resized_image = (resized_image - 0.5) / 0.5
        padded = np.zeros((input_c, input_h, input_w), dtype=np.float32)
        padded[:, :, 0:resized_w] = resized_image
        return padded

    def __call__(self, images: List[np.ndarray]) -> Tuple[List[np.ndarray], List[Tuple[str, float]]]:
        num_images = len(images)
        results: List[List[str | float]] = [["", 0.0] for _ in range(num_images)]
        indices = np.argsort(np.array([x.shape[1] / x.shape[0] for x in images]))
        batch_size = 6
        for i in range(0, num_images, batch_size):
            norm_images = []
            for j in range(i, min(num_images, i + batch_size)):
                norm_images.append(self.resize(images[indices[j]])[np.newaxis, :])
            norm_images = np.concatenate(norm_images)
            outputs = self.session.run(None, {self.inputs.name: norm_images})[0]
            outputs = [(self.labels[idx], float(outputs[k, idx])) for k, idx in enumerate(outputs.argmax(axis=1))]
            for j, (label, score) in enumerate(outputs):
                results[indices[i + j]] = [label, score]
                if "180" in label and score > self.threshold:
                    images[indices[i + j]] = cv2.rotate(images[indices[i + j]], 1)
        return images, results


def run_vncv_ocr(image_bytes: bytes, predictor) -> dict:
    """Perform OCR using the stateless VNCV pipeline (no file writes)."""
    array = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Unsupported or corrupted image data")

    detection = Detection()
    classification = Classification()

    boxes, _ = detection(frame)
    if boxes is None or len(boxes) == 0:
        h, w = frame.shape[:2]
        boxes = np.array([[[0, 0], [w, 0], [w, h], [0, h]]], dtype="int32")

    ordered_boxes = _sort_polygon(list(boxes))
    cropped_images = [_crop_image(frame, box) for box in ordered_boxes]
    cropped_images, orientations = classification(cropped_images)

    lines = []
    for idx, (img, box) in enumerate(zip(cropped_images, ordered_boxes)):
        pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        text = normalize_ocr_text(predictor.predict(pil_img))
        orientation = orientations[idx][0] if idx < len(orientations) else ""
        lines.append(
            {
                "text": text,
                "bbox": box.astype(int).tolist(),
                "orientation": orientation,
            }
        )

    combined = "\n".join([ln["text"] for ln in lines]).strip()
    return {"text": combined, "lines": lines, "engine": "vncv", "count": len(lines)}
