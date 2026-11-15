"""Generates the Sweety logo assets (SVG + PNG) from a single source of truth.

Usage:
    python assets/logo/build.py

Dependencies (not part of the Node toolchain, needed only to rebuild assets):
    pip install fonttools uharfbuzz pillow
Plus a local Chrome/Chromium for PNG rasterisation (set CHROME_PATH to override).

The script downloads Inter (SIL OFL 1.1) into the system temp directory on first
run; the font itself is not committed — the wordmark is stored as outlined paths.
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import urllib.request
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

LOGO = Path(__file__).resolve().parent
CACHE = Path(tempfile.gettempdir()) / "sweety-logo"
FONT_PATH = CACHE / "Inter-Variable.ttf"
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf"

CHROME_CANDIDATES = (
    os.environ.get("CHROME_PATH"),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
)


def chrome_path() -> str:
    for candidate in CHROME_CANDIDATES:
        if not candidate:
            continue
        path = Path(candidate)
        if path.exists() or (not path.is_absolute() and subprocess.run(["which", candidate], capture_output=True).returncode == 0):
            return str(path)
    raise SystemExit("Chrome not found — set CHROME_PATH to the browser binary.")


CHROME = chrome_path()

BLUE_500 = "#0EA5E9"
BLUE_700 = "#0369A1"
BLUE_900 = "#0B1220"  # logo ink / dark surface
INK = "#0F172A"
SLATE = "#64748B"
ORANGE = "#F97316"
PAPER = "#FFFFFF"

# Route polyline of the mark: a 180-degree rotationally symmetric S.
S_PATH = "M44 22C44 12 20 12 20 22C20 32 44 32 44 42C44 52 20 52 20 42"
HANDLES = ((44, 22), (20, 42))

TILE_GRADIENT = (
    f'<linearGradient id="sweety-tile" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">'
    f'<stop offset="0" stop-color="{BLUE_500}"/><stop offset="1" stop-color="{BLUE_700}"/>'
    f"</linearGradient>"
)


def ensure_font() -> None:
    if FONT_PATH.exists():
        return
    CACHE.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(FONT_URL, FONT_PATH)


def wordmark(text: str, weight: int, font_size: float) -> dict:
    """Shapes `text` with HarfBuzz and returns outlined SVG path data plus metrics."""
    ensure_font()
    font = TTFont(FONT_PATH)
    if "fvar" in font:
        font = instancer.instantiateVariableFont(font, {"wght": weight, "opsz": 32})
    upem = font["head"].unitsPerEm
    scale = font_size / upem

    tmp = Path(tempfile.mkdtemp()) / "shape.ttf"
    font.save(tmp)
    hb_font = hb.Font(hb.Face(hb.Blob.from_file_path(str(tmp))))
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf, {"kern": True, "liga": True})

    glyph_set = font.getGlyphSet()
    glyph_order = font.getGlyphOrder()
    parts: list[str] = []
    pen_x = 0.0

    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        if info.codepoint == 0:
            continue
        name = glyph_order[info.codepoint]
        svg_pen = SVGPathPen(glyph_set, ntos=lambda v: f"{v:.2f}")
        transform = TransformPen(svg_pen, (scale, 0, 0, -scale, (pen_x + pos.x_offset) * scale, 0))
        glyph_set[name].draw(transform)
        d = svg_pen.getCommands()
        if d:
            parts.append(d)
        pen_x += pos.x_advance

    return {
        "path": " ".join(parts),
        "advance": pen_x * scale,
        "capHeight": font["OS/2"].sCapHeight * scale,
    }


def handles(fill: str, size: float = 8.0) -> str:
    rects = "".join(
        f'<rect x="{x - size / 2:g}" y="{y - size / 2:g}" width="{size:g}" height="{size:g}" rx="2"/>'
        for x, y in HANDLES
    )
    return f'<g fill="{fill}">{rects}</g>'


def route(stroke: float = 7.0, color: str = "#FFFFFF") -> str:
    return (
        f'<path d="{S_PATH}" fill="none" stroke="{color}" stroke-width="{stroke:g}" '
        f'stroke-linecap="round" stroke-linejoin="round"/>'
    )


def mark_svg(stroke: float = 7.0, handle: float = 8.0) -> str:
    """Colour app icon, 64x64 with transparent corners."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Sweety">
  <defs>{TILE_GRADIENT}</defs>
  <rect width="64" height="64" rx="15" fill="url(#sweety-tile)"/>
  {route(stroke)}
  {handles(ORANGE, handle)}
</svg>
"""


def mark_mono_svg(color: str, stroke: float = 7.0, handle: float = 7.0) -> str:
    """One-colour mark on transparent background: the S route with square handles."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Sweety">
  {route(stroke, color)}
  {handles(color, handle)}
</svg>
"""


def lockup_svg(text_color: str, mono: str | None = None) -> str:
    """Horizontal lockup: 64px mark + outlined 'Sweety' wordmark."""
    wm = wordmark("Sweety", 600, 44)
    baseline = 32 + wm["capHeight"] / 2
    gap = 20
    x_text = 64 + gap
    width = x_text + wm["advance"]
    if mono is None:
        head = (
            f"<defs>{TILE_GRADIENT}</defs>\n"
            f'  <rect width="64" height="64" rx="15" fill="url(#sweety-tile)"/>\n'
            f"  {route(7)}\n  {handles(ORANGE)}"
        )
    else:
        head = f"{route(7, mono)}\n  {handles(mono, 7)}"
    pad = 3.0
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad:g} {-pad:g} {width + 2 * pad:.2f} {64 + 2 * pad:g}" width="{width + 2 * pad:.2f}" height="{64 + 2 * pad:g}" role="img" aria-label="Sweety">
  {head}
  <g transform="translate({x_text:.3f} {baseline:.3f})">
    <path d="{wm['path']}" fill="{text_color}"/>
  </g>
</svg>
"""


def render(svg_text: str, out_png: Path, width: int, height: int, background: str = "00000000") -> None:
    out_png = out_png.resolve()
    out_png.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmpdir:
        svg_file = Path(tmpdir) / "logo.svg"
        svg_file.write_text(svg_text, encoding="utf-8")
        html_file = Path(tmpdir) / "wrap.html"
        html_file.write_text(
            '<!doctype html><html><head><meta charset="utf-8"><style>'
            "html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head>"
            f'<body><img src="file:///{svg_file.as_posix()}" style="display:block;width:{width}px;height:{height}px">'
            "</body></html>",
            encoding="utf-8",
        )
        subprocess.run(
            [
                str(CHROME), "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=1", "--no-first-run", "--no-default-browser-check",
                "--allow-file-access-from-files", "--virtual-time-budget=3000",
                f"--window-size={width},{height}", f"--screenshot={out_png}",
                f"--default-background-color={background}", f"file:///{html_file.as_posix()}",
            ],
            check=True,
            capture_output=True,
        )


def main() -> None:
    LOGO.mkdir(parents=True, exist_ok=True)

    files = {
        "sweety-mark.svg": mark_svg(),
        "sweety-mark-mono.svg": mark_mono_svg(BLUE_900),
        "sweety-mark-mono-light.svg": mark_mono_svg("#FFFFFF"),
        "sweety-logo.svg": lockup_svg(INK),
        "sweety-logo-dark.svg": lockup_svg("#FFFFFF"),
        "sweety-logo-mono.svg": lockup_svg(BLUE_900, mono=BLUE_900),
        "sweety-logo-mono-light.svg": lockup_svg("#FFFFFF", mono="#FFFFFF"),
        "favicon.svg": mark_svg(stroke=7.5, handle=8.5),
    }
    for name, text in files.items():
        (LOGO / name).write_text(text, encoding="utf-8", newline="\n")

    mark = files["sweety-mark.svg"]
    for size in (512, 256, 128, 64, 32):
        render(mark, LOGO / f"sweety-mark-{size}.png", size, size)

    logo = files["sweety-logo.svg"]
    wm = wordmark("Sweety", 600, 44)
    lw = 64 + 20 + wm["advance"] + 6
    render(logo, LOGO / "sweety-logo.png", round(lw * 3), 210)
    render(files["sweety-logo-dark.svg"], LOGO / "sweety-logo-dark.png", round(lw * 3), 210, "0B1220")
    render(files["sweety-logo-mono.svg"], LOGO / "sweety-logo-mono.png", round(lw * 3), 210, "FFFFFF")

    from PIL import Image

    Image.open(LOGO / "sweety-mark-256.png").convert("RGBA").save(
        LOGO / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
    )

    print(json.dumps({"lockupWidth": round(lw, 2), "wordmarkWidth": round(wm["advance"], 2)}, indent=2))


if __name__ == "__main__":
    main()
