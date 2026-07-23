"""
Generate the app's logo + PWA icon set from the MPH Consulting logo.

Outputs into ``public/``:
  logo.png                  - full-res logo (used in the invoice PDF + app header)
  pwa-192x192.png           - PWA icon
  pwa-512x512.png           - PWA icon
  pwa-maskable-512x512.png  - maskable PWA icon (padded on white)
  apple-touch-icon.png      - 180x180 iOS home-screen icon (white bg)
  favicon.png               - 32x32 favicon
"""

from __future__ import annotations

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
PUBLIC = os.path.join(PROJECT, "public")

SOURCE = (
    r"C:\Users\mphil\.cursor\projects"
    r"\c-Users-mphil-OneDrive-mphconsulting-MyDocuments-MPH-Consulting-ZenNav-iOS-Upgrade-github-clone-ZenNav"
    r"\assets"
    r"\c__Users_mphil_AppData_Roaming_Cursor_User_workspaceStorage_037081911bbe9d49f9ef70ab0f5333cb_images_image-a1ee1ca3-2c4a-4bb2-9133-eed4697e00fb.png"
)


def load_square(path: str) -> Image.Image:
    """Load the logo as an RGBA square, cropped to its bounding box."""
    img = Image.open(path).convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    side = max(img.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    return canvas


def on_white(img: Image.Image, size: int, pad_ratio: float = 0.0) -> Image.Image:
    """Composite the logo centred on a white square of ``size`` px."""
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    inner = int(size * (1 - 2 * pad_ratio))
    logo = img.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    canvas.paste(logo, (off, off), logo)
    return canvas.convert("RGB")


def main() -> None:
    os.makedirs(PUBLIC, exist_ok=True)
    logo = load_square(SOURCE)

    # Full-res transparent logo for the PDF + on-screen header.
    logo.resize((512, 512), Image.LANCZOS).save(os.path.join(PUBLIC, "logo.png"))

    # Standard PWA icons on white (the logo already has its own circular border).
    on_white(logo, 192).save(os.path.join(PUBLIC, "pwa-192x192.png"))
    on_white(logo, 512).save(os.path.join(PUBLIC, "pwa-512x512.png"))

    # Maskable icon: extra padding so the circle survives the OS safe-zone crop.
    on_white(logo, 512, pad_ratio=0.12).save(os.path.join(PUBLIC, "pwa-maskable-512x512.png"))

    # iOS home-screen + favicon.
    on_white(logo, 180).save(os.path.join(PUBLIC, "apple-touch-icon.png"))
    on_white(logo, 32).save(os.path.join(PUBLIC, "favicon.png"))

    print("Icons written to", PUBLIC)
    for f in sorted(os.listdir(PUBLIC)):
        print("  ", f)


if __name__ == "__main__":
    main()
