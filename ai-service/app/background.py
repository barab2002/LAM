"""Background removal via rembg (u2net). The ONNX session is created once
and reused; model weights download on first use and are cached in
~/.u2net (baked into the Docker image at build time)."""
from __future__ import annotations

import io

from PIL import Image

_session = None


def _get_session():
    global _session
    if _session is None:
        from rembg import new_session

        _session = new_session("u2net")
    return _session


def remove_background(image_bytes: bytes) -> Image.Image:
    """Returns an RGBA image with the background removed."""
    from rembg import remove

    result = remove(image_bytes, session=_get_session())
    return Image.open(io.BytesIO(result)).convert("RGBA")
