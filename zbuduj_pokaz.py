"""Generuj samodzielny pokaz HTML z tych samych źródeł co aplikacja serwerowa."""
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"

def text(path):
    return path.read_text(encoding="utf-8")

def build():
    page = text(ROOT / "index.html")
    css = text(STATIC / "atlas.css")
    for font in ("DMSans", "InstrumentSerif"):
        data = base64.b64encode((STATIC / "fonts" / (font + ".woff")).read_bytes()).decode("ascii")
        css = css.replace(f'url("fonts/{font}.woff")', f'url("data:font/woff;base64,{data}")')
    page = page.replace('<link rel="stylesheet" href="static/atlas.css">', "<style>\n" + css + "\n</style>")
    catalog = {"lakes": json.loads(text(STATIC / "lowiska.json")), "regions": json.loads(text(STATIC / "regiony.json"))}
    encoded = json.dumps(catalog, ensure_ascii=False, separators=(",",":")).replace("<", r"\u003c")
    scripts = ["<script>window.ATLAS_PREVIEW = " + encoded + ";</script>"]
    for name in ("mapa.js", "atlas.js"):
        page = page.replace(f'<script defer src="static/{name}"></script>', "")
        scripts.append("<script>\n" + text(STATIC / name) + "\n</script>")
    for name in ("OFL-DMSans.txt", "OFL-InstrumentSerif.txt"):
        scripts.append('<script type="text/plain" data-font-license="' + name + '">\n' +
                       text(STATIC / "fonts" / name) + "\n</script>")
    target = ROOT / "Atlas_lowisk.html"
    target.write_text(page.replace("</body>", "\n".join(scripts) + "\n</body>"), encoding="utf-8")
    return target

if __name__ == "__main__":
    print(build())
