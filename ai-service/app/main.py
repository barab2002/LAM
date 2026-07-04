"""LAM AI microservice: background removal (rembg), clothing classification
(YOLO) and dominant-color extraction. Internal-only — protected by a shared
secret header (x-ai-secret) that the API server sends."""
from __future__ import annotations

import base64
import io
import os

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from PIL import Image

from .background import remove_background
from .classify import classify
from .colors import extract_colors

AI_SECRET = os.environ.get("AI_SERVICE_SECRET", "")

app = FastAPI(title="LAM AI Service", version="1.0.0")

# Seasons are assigned from category+subcategory; a garment-level season
# model is out of scope, so keep the mapping conservative (most items are
# multi-season).
SEASON_HINTS: dict[str, list[str]] = {
    "shorts": ["SUMMER", "SPRING"],
    "coat": ["WINTER", "FALL"],
    "sweater": ["WINTER", "FALL"],
    "hoodie": ["WINTER", "FALL", "SPRING"],
    "boots": ["WINTER", "FALL"],
    "jacket": ["FALL", "SPRING", "WINTER"],
}
ALL_SEASONS = ["SPRING", "SUMMER", "FALL", "WINTER"]


def check_secret(request: Request) -> None:
    if AI_SECRET and request.headers.get("x-ai-secret") != AI_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing x-ai-secret")


async def read_image(file: UploadFile) -> bytes:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        Image.open(io.BytesIO(data)).verify()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Not a valid image: {exc}") from exc
    return data


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "lam-ai"}


@app.post("/remove-background", dependencies=[Depends(check_secret)])
async def remove_background_endpoint(file: UploadFile = File(...)) -> Response:
    data = await read_image(file)
    result = remove_background(data)
    buf = io.BytesIO()
    result.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


@app.post("/classify", dependencies=[Depends(check_secret)])
async def classify_endpoint(file: UploadFile = File(...)) -> dict:
    data = await read_image(file)
    image = Image.open(io.BytesIO(data))
    result = classify(image)
    return {
        "category": result.category,
        "subcategory": result.subcategory,
        "confidence": round(result.confidence, 4),
        "method": result.method,
    }


@app.post("/analyze", dependencies=[Depends(check_secret)])
async def analyze_endpoint(file: UploadFile = File(...)) -> dict:
    """Full auto-wardrobe pipeline: rembg → YOLO → dominant colors.

    Degrades per-stage: if background removal is unavailable (e.g. model
    weights not downloadable), classification and color extraction run on
    the original image and no cutout is returned.
    """
    data = await read_image(file)

    cutout = None
    try:
        cutout = remove_background(data)
    except Exception as exc:  # noqa: BLE001
        print(f"[analyze] background removal unavailable: {exc}")

    subject = cutout if cutout is not None else Image.open(io.BytesIO(data)).convert("RGBA")
    classification = classify(subject)
    colors = extract_colors(subject)

    seasons = SEASON_HINTS.get(classification.subcategory or "", ALL_SEASONS)

    processed_b64 = None
    if cutout is not None:
        buf = io.BytesIO()
        cutout.save(buf, format="PNG")
        processed_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return {
        "category": classification.category,
        "subcategory": classification.subcategory,
        "colors": colors,
        "primaryColor": colors[0] if colors else None,
        "pattern": None,  # pattern detection: future work
        "seasons": seasons,
        "confidence": round(classification.confidence, 4),
        "processedImageBase64": processed_b64,
        "method": classification.method,
    }
