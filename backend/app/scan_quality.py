"""Is this scan good enough to read? Checked before the reader is called, so the officer hears about a blurry photo at once.

Thresholds come from measuring real OCR results: clean prints score about 900 or more, ordinary phone photos 300 to 380 (read
perfectly), and a dim 620 px photo scoring 43 was read badly.
"""
import io

from PIL import Image, ImageFilter, ImageStat

_LAPLACIAN = ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], scale=1, offset=128)
MIN_SHARP, MIN_SIDE, MIN_MEAN, MIN_CONTRAST = 120.0, 800, 100.0, 18.0


def assess(data: bytes) -> dict:
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception:  # noqa: BLE001  (not an image we can open: nothing to say)
        return {"ok": True, "issues": [], "sharpness": None, "width": None, "height": None}
    w, h = im.size
    g = im.convert("L")
    g.thumbnail((1000, 1000))
    sharp = ImageStat.Stat(g.filter(_LAPLACIAN)).var[0]
    st = ImageStat.Stat(g)
    issues = []
    if max(w, h) < MIN_SIDE:
        issues.append(f"The image is small ({w}×{h}). Scan or photograph at a higher resolution.")
    if sharp < MIN_SHARP:
        issues.append("The image is blurry. Hold the camera steady, or scan again.")
    if st.mean[0] < MIN_MEAN:
        issues.append("The image is dark. Use more light and avoid shadows.")
    elif st.stddev[0] < MIN_CONTRAST:
        issues.append("The text is faint or washed out. Check the lighting and try again.")
    return {"ok": not issues, "issues": issues, "sharpness": round(sharp, 1), "width": w, "height": h}
