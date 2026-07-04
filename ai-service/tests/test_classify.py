import numpy as np
from PIL import Image

from app import classify as classify_mod
from app.classify import CLASS_MAP, _heuristic


def garment_silhouette(width, height, canvas=(200, 200)):
    """Opaque rectangle of the given size on a transparent canvas."""
    arr = np.zeros((*canvas, 4), dtype=np.uint8)
    y0 = (canvas[0] - height) // 2
    x0 = (canvas[1] - width) // 2
    arr[y0 : y0 + height, x0 : x0 + width] = (100, 100, 100, 255)
    return Image.fromarray(arr, "RGBA")


def test_class_map_covers_deepfashion2_and_coco():
    assert CLASS_MAP["trousers"][0] == "BOTTOM"
    assert CLASS_MAP["long_sleeved_dress"][0] == "DRESS"
    assert CLASS_MAP["handbag"][0] == "BAG"
    assert CLASS_MAP["tie"][0] == "ACCESSORY"


def test_heuristic_shapes():
    assert _heuristic(garment_silhouette(80, 180)).category == "DRESS"
    assert _heuristic(garment_silhouette(80, 110)).category == "BOTTOM"
    assert _heuristic(garment_silhouette(120, 60)).category == "SHOES"
    assert _heuristic(garment_silhouette(100, 100)).category == "TOP"


def test_heuristic_confidence_is_low():
    result = _heuristic(garment_silhouette(100, 100))
    assert result.method == "heuristic"
    assert result.confidence < 0.5


def test_classify_falls_back_when_model_missing(monkeypatch):
    monkeypatch.setattr(classify_mod, "_model", None)
    monkeypatch.setattr(classify_mod, "_model_failed", True)
    result = classify_mod.classify(garment_silhouette(100, 100))
    assert result.method == "heuristic"
