"""Regenerate launcher/store PNGs from assets/pengo-icon.png.

Development-only dependency: Pillow (python3 -m pip install Pillow).
Run after replacing the master; native builds use the checked-in Android PNGs.
iOS staging already copies/resizes the master to its 1024px app icon.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def main():
    with Image.open(ROOT / "assets/pengo-icon.png") as source:
        if source.size != (1024, 1024):
            raise ValueError("The icon master must be 1024x1024.")
        if source.convert("RGBA").getextrema()[3] != (255, 255):
            raise ValueError("The icon master must be fully opaque, including corners.")
        master = source.convert("RGB")

    for density, size in SIZES.items():
        directory = RES / ("mipmap-" + density)
        icon = master.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(directory / "ic_launcher.png", optimize=True)
        # Android 7.1's roundIcon predates adaptive launcher masks.
        mask = Image.new("L", (size * 4, size * 4))
        ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        rounded = icon.convert("RGBA")
        rounded.putalpha(mask.resize((size, size), Image.Resampling.LANCZOS))
        rounded.save(directory / "ic_launcher_round.png", optimize=True)

    directory = RES / "drawable-nodpi"
    directory.mkdir(exist_ok=True)
    master.resize((432, 432), Image.Resampling.LANCZOS).save(
        directory / "pengo_launcher.png", optimize=True)
    master.resize((512, 512), Image.Resampling.LANCZOS).save(
        ROOT / "fastlane/metadata/android/en-US/images/icon.png", optimize=True)
    print("Generated Android legacy/adaptive and store icons from the opaque master.")


if __name__ == "__main__":
    main()
