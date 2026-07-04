"""Dominant-color extraction with a small named-color vocabulary.

K-means over the opaque pixels of the (background-removed) garment image,
then each cluster centroid is snapped to the nearest named color. The named
vocabulary is intentionally coarse — it feeds the color-pair preference
engine, which needs stable canonical names, not exact shades.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

# name -> sRGB reference
NAMED_COLORS: dict[str, tuple[int, int, int]] = {
    "black": (20, 20, 20),
    "white": (245, 245, 245),
    "gray": (128, 128, 128),
    "beige": (222, 202, 166),
    "cream": (255, 246, 222),
    "brown": (110, 74, 47),
    "tan": (188, 152, 106),
    "navy": (25, 35, 80),
    "blue": (50, 100, 200),
    "denim": (60, 90, 140),
    "light-blue": (150, 195, 235),
    "teal": (0, 128, 128),
    "green": (60, 140, 70),
    "dark-green": (25, 70, 40),
    "olive": (110, 115, 60),
    "yellow": (240, 210, 60),
    "mustard": (205, 165, 50),
    "orange": (235, 140, 50),
    "red": (200, 40, 45),
    "burgundy": (110, 30, 45),
    "pink": (240, 150, 180),
    "purple": (130, 70, 160),
    "lavender": (190, 165, 220),
    "gold": (212, 175, 55),
    "silver": (192, 192, 200),
}

_PALETTE = np.array(list(NAMED_COLORS.values()), dtype=np.float32)
_NAMES = list(NAMED_COLORS.keys())


def nearest_named_color(rgb: tuple[float, float, float]) -> str:
    """Snap an RGB triple to the nearest named color (Euclidean in RGB)."""
    point = np.asarray(rgb, dtype=np.float32)
    distances = np.linalg.norm(_PALETTE - point, axis=1)
    return _NAMES[int(np.argmin(distances))]


def _kmeans(pixels: np.ndarray, k: int, iterations: int = 12, seed: int = 7):
    """Tiny k-means (numpy only). Returns (centroids, counts)."""
    rng = np.random.default_rng(seed)
    k = min(k, len(pixels))
    centroids = pixels[rng.choice(len(pixels), size=k, replace=False)].astype(np.float32)

    for _ in range(iterations):
        distances = np.linalg.norm(pixels[:, None, :] - centroids[None, :, :], axis=2)
        labels = distances.argmin(axis=1)
        for i in range(k):
            members = pixels[labels == i]
            if len(members):
                centroids[i] = members.mean(axis=0)

    distances = np.linalg.norm(pixels[:, None, :] - centroids[None, :, :], axis=2)
    labels = distances.argmin(axis=1)
    counts = np.bincount(labels, minlength=k)
    return centroids, counts


def extract_colors(image: Image.Image, max_colors: int = 3) -> list[str]:
    """Dominant named colors ordered by pixel coverage.

    Transparent pixels (removed background) are ignored; requires >= 5% of
    the garment's pixels for a color to count.
    """
    rgba = image.convert("RGBA")
    rgba.thumbnail((160, 160))
    arr = np.asarray(rgba, dtype=np.float32)
    mask = arr[..., 3] > 128  # opaque garment pixels only
    pixels = arr[..., :3][mask]
    if len(pixels) < 20:
        return []

    centroids, counts = _kmeans(pixels, k=min(5, max_colors + 2))
    order = np.argsort(-counts)
    total = counts.sum()

    seen: list[str] = []
    for idx in order:
        if counts[idx] / total < 0.05:
            continue
        name = nearest_named_color(tuple(centroids[idx]))
        if name not in seen:
            seen.append(name)
        if len(seen) >= max_colors:
            break
    return seen
