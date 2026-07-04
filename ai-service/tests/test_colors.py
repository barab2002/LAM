import numpy as np
from PIL import Image

from app.colors import extract_colors, nearest_named_color


def solid_image(rgb, size=(64, 64), alpha=255):
    img = Image.new("RGBA", size, (*rgb, alpha))
    return img


def test_nearest_named_color_snaps_to_vocabulary():
    assert nearest_named_color((250, 250, 250)) == "white"
    assert nearest_named_color((10, 10, 10)) == "black"
    assert nearest_named_color((205, 45, 50)) == "red"
    assert nearest_named_color((28, 38, 85)) == "navy"


def test_extract_colors_single_solid_color():
    assert extract_colors(solid_image((200, 40, 45))) == ["red"]


def test_extract_colors_ignores_transparent_background():
    img = Image.new("RGBA", (64, 64), (0, 255, 0, 0))  # transparent green
    # Opaque white square in the middle (the "garment")
    for x in range(16, 48):
        for y in range(16, 48):
            img.putpixel((x, y), (245, 245, 245, 255))
    colors = extract_colors(img)
    assert colors == ["white"]


def test_extract_colors_two_dominant_colors():
    img = Image.new("RGBA", (64, 64))
    arr = np.zeros((64, 64, 4), dtype=np.uint8)
    arr[:32, :, :] = (200, 40, 45, 255)  # red half
    arr[32:, :, :] = (20, 20, 20, 255)  # black half
    img = Image.fromarray(arr, "RGBA")
    colors = extract_colors(img)
    assert set(colors) == {"red", "black"}


def test_extract_colors_empty_image():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    assert extract_colors(img) == []
