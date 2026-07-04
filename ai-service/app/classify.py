"""Clothing classification.

Primary path: a YOLO model (ultralytics) pointed at by MODEL_PATH. Works
best with a fashion-trained checkpoint (e.g. DeepFashion2 classes); the
class-name mapping below covers both DeepFashion2-style names and the few
relevant COCO classes so the default yolov8n weights still catch bags/ties.

Fallback path (model unavailable / nothing detected): a shape heuristic on
the garment's alpha-mask bounding box, returned with low confidence so the
client can prompt the user to confirm the tag.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import numpy as np
from PIL import Image

MODEL_PATH = os.environ.get("MODEL_PATH", "yolov8n.pt")

# model class name (lowercased) -> (category, subcategory)
CLASS_MAP: dict[str, tuple[str, str | None]] = {
    # DeepFashion2 classes
    "short_sleeved_shirt": ("TOP", "t-shirt"),
    "long_sleeved_shirt": ("TOP", "shirt"),
    "short_sleeved_outwear": ("OUTERWEAR", "jacket"),
    "long_sleeved_outwear": ("OUTERWEAR", "coat"),
    "vest": ("TOP", "vest"),
    "sling": ("TOP", "sling top"),
    "shorts": ("BOTTOM", "shorts"),
    "trousers": ("BOTTOM", "trousers"),
    "skirt": ("BOTTOM", "skirt"),
    "short_sleeved_dress": ("DRESS", "dress"),
    "long_sleeved_dress": ("DRESS", "dress"),
    "vest_dress": ("DRESS", "dress"),
    "sling_dress": ("DRESS", "dress"),
    # Generic / custom-model names
    "shirt": ("TOP", "shirt"),
    "t-shirt": ("TOP", "t-shirt"),
    "tshirt": ("TOP", "t-shirt"),
    "top": ("TOP", None),
    "sweater": ("TOP", "sweater"),
    "hoodie": ("TOP", "hoodie"),
    "jacket": ("OUTERWEAR", "jacket"),
    "coat": ("OUTERWEAR", "coat"),
    "jeans": ("BOTTOM", "jeans"),
    "pants": ("BOTTOM", "trousers"),
    "dress": ("DRESS", "dress"),
    "shoe": ("SHOES", None),
    "shoes": ("SHOES", None),
    "sneaker": ("SHOES", "sneakers"),
    "boot": ("SHOES", "boots"),
    # COCO classes that matter for a wardrobe
    "tie": ("ACCESSORY", "tie"),
    "handbag": ("BAG", "handbag"),
    "backpack": ("BAG", "backpack"),
    "suitcase": ("BAG", "suitcase"),
}


@dataclass
class Classification:
    category: str
    subcategory: str | None
    confidence: float
    method: str  # "yolo" | "heuristic"


_model = None
_model_failed = False


def _get_model():
    global _model, _model_failed
    if _model is None and not _model_failed:
        try:
            from ultralytics import YOLO

            _model = YOLO(MODEL_PATH)
        except Exception as exc:  # noqa: BLE001 — degrade to heuristic
            print(f"[classify] YOLO unavailable ({exc}); using shape heuristic")
            _model_failed = True
    return _model


def _heuristic(image: Image.Image) -> Classification:
    """Bounding-box aspect ratio of the opaque region — crude but better
    than nothing, and flagged with low confidence."""
    rgba = image.convert("RGBA")
    rgba.thumbnail((200, 200))
    alpha = np.asarray(rgba)[..., 3]
    ys, xs = np.nonzero(alpha > 128)
    if len(xs) < 10:
        return Classification("TOP", None, 0.1, "heuristic")

    height = ys.max() - ys.min() + 1
    width = xs.max() - xs.min() + 1
    ratio = height / max(width, 1)

    if ratio > 1.9:
        return Classification("DRESS", None, 0.3, "heuristic")
    if ratio > 1.25:
        return Classification("BOTTOM", None, 0.25, "heuristic")
    if ratio < 0.6:
        return Classification("SHOES", None, 0.25, "heuristic")
    return Classification("TOP", None, 0.3, "heuristic")


def classify(image: Image.Image) -> Classification:
    model = _get_model()
    if model is not None:
        try:
            results = model.predict(image.convert("RGB"), verbose=False, conf=0.25)
            best: Classification | None = None
            for result in results:
                names = result.names
                for box in result.boxes:
                    label = str(names[int(box.cls)]).lower()
                    mapped = CLASS_MAP.get(label)
                    if not mapped:
                        continue
                    conf = float(box.conf)
                    if best is None or conf > best.confidence:
                        best = Classification(mapped[0], mapped[1], conf, "yolo")
            if best:
                return best
        except Exception as exc:  # noqa: BLE001
            print(f"[classify] YOLO inference failed ({exc}); falling back")
    return _heuristic(image)
