import io

from fastapi.testclient import TestClient
from PIL import Image

from app import main
from app.classify import Classification


def png_bytes(rgb=(200, 40, 45), size=(64, 64)):
    buf = io.BytesIO()
    Image.new("RGB", size, rgb).save(buf, format="PNG")
    return buf.getvalue()


def make_client(monkeypatch, secret=""):
    monkeypatch.setattr(main, "AI_SECRET", secret)
    # Avoid heavy model downloads in unit tests: background removal becomes
    # a passthrough to RGBA, classification returns a fixed result.
    monkeypatch.setattr(
        main, "remove_background", lambda data: Image.open(io.BytesIO(data)).convert("RGBA")
    )
    monkeypatch.setattr(
        main, "classify", lambda img: Classification("TOP", "t-shirt", 0.91, "yolo")
    )
    return TestClient(main.app)


def test_health(monkeypatch):
    client = make_client(monkeypatch)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_analyze_returns_tags_and_cutout(monkeypatch):
    client = make_client(monkeypatch)
    res = client.post("/analyze", files={"file": ("shirt.png", png_bytes(), "image/png")})
    assert res.status_code == 200
    body = res.json()
    assert body["category"] == "TOP"
    assert body["subcategory"] == "t-shirt"
    assert body["primaryColor"] == "red"
    assert body["confidence"] == 0.91
    assert body["processedImageBase64"]
    assert body["seasons"] == ["SPRING", "SUMMER", "FALL", "WINTER"]


def test_classify_endpoint(monkeypatch):
    client = make_client(monkeypatch)
    res = client.post("/classify", files={"file": ("shirt.png", png_bytes(), "image/png")})
    assert res.status_code == 200
    assert res.json()["method"] == "yolo"


def test_rejects_bad_secret(monkeypatch):
    client = make_client(monkeypatch, secret="s3cret")
    res = client.post("/analyze", files={"file": ("shirt.png", png_bytes(), "image/png")})
    assert res.status_code == 401

    ok = client.post(
        "/analyze",
        files={"file": ("shirt.png", png_bytes(), "image/png")},
        headers={"x-ai-secret": "s3cret"},
    )
    assert ok.status_code == 200


def test_rejects_non_image(monkeypatch):
    client = make_client(monkeypatch)
    res = client.post("/analyze", files={"file": ("evil.txt", b"not an image", "text/plain")})
    assert res.status_code == 400


def test_analyze_degrades_without_bg_model(monkeypatch):
    """When rembg can't load (e.g. weights unavailable), /analyze still
    classifies and extracts colors from the original image."""
    monkeypatch.setattr(main, "AI_SECRET", "")
    monkeypatch.setattr(
        main, "classify", lambda img: Classification("TOP", None, 0.3, "heuristic")
    )

    def broken_rembg(data):
        raise RuntimeError("weights unavailable")

    monkeypatch.setattr(main, "remove_background", broken_rembg)
    client = TestClient(main.app)
    res = client.post("/analyze", files={"file": ("shirt.png", png_bytes(), "image/png")})
    assert res.status_code == 200
    body = res.json()
    assert body["processedImageBase64"] is None
    assert body["primaryColor"] == "red"
