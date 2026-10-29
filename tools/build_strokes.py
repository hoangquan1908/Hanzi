"""Gom dữ liệu nét chữ (hanzi-writer-data) cho mọi chữ Hán trong data/hsk*.js → data/strokes.js

npm install hanzi-writer-data   (rồi truyền đường dẫn node_modules/hanzi-writer-data)
python3 tools/build_strokes.py path/to/hanzi-writer-data
"""
import glob, json, os, sys

src = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chars = set()
for f in sorted(glob.glob(os.path.join(root, "data/hsk*.js"))):
    for w in json.loads(open(f, encoding="utf-8").read().split("=", 2)[2].rstrip(";\n")):
        chars.update(c for c in w["w"] if "一" <= c <= "鿿")
out, missing = {}, []
for c in sorted(chars):
    p = os.path.join(src, f"{c}.json")
    if os.path.exists(p):
        out[c] = json.load(open(p, encoding="utf-8"))
    else:
        missing.append(c)
open(os.path.join(root, "data/strokes.js"), "w", encoding="utf-8").write(
    "window.STROKES=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(f"{len(out)} chars written, missing: {''.join(missing) or 'none'}")
