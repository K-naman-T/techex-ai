from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = REPO_ROOT / "public" / "assets" / "techex26-logo.png"
FAVICON_PATH = REPO_ROOT / "public" / "favicon.png"

def create_favicon():
    if not LOGO_PATH.exists():
        print(f"Error: Logo not found at {LOGO_PATH}")
        return

    with Image.open(LOGO_PATH) as img:
        # The graphic is in the upper part.
        # Original is roughly 516x463 (based on visual).
        # We want to crop the top circular/graphic part.
        width, height = img.size
        # Crop top ~65% of the image to get the hands/bulb/gear graphic
        # and exclude the "TECHEX" text at the bottom.
        crop_box = (0, 0, width, int(height * 0.65))
        graphic = img.crop(crop_box)
        
        # Save as PNG first to keep transparency
        graphic.save(FAVICON_PATH)
        print(f"Favicon saved to {FAVICON_PATH}")

if __name__ == "__main__":
    create_favicon()
