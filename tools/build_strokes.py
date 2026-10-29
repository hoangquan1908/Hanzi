"""Gom dữ liệu nét chữ (hanzi-writer-data) cho mọi chữ Hán trong data/hsk*.js
→ data/strokes/s00.js … s31.js (chia theo mã Unicode % 32, app chỉ tải file cần dùng)

npm install hanzi-writer-data
python3 tools/build_strokes.py node_modules/hanzi-writer-data
"""
import glob, json, os, sys

SHARDS = 32
src = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chars = set()
for f in sorted(glob.glob(os.path.join(root, "data/hsk*.js"))):
    for w in json.loads(open(f, encoding="utf-8").read().split("=", 2)[2].rstrip(";\n")):
        chars.update(c for c in w["w"] if "一" <= c <= "鿿")
shards, missing = {i: {} for i in range(SHARDS)}, []
for c in sorted(chars):
    p = os.path.join(src, f"{c}.json")
    if os.path.exists(p):
        shards[ord(c) % SHARDS][c] = json.load(open(p, encoding="utf-8"))
    else:
        missing.append(c)
out = os.path.join(root, "data/strokes")
os.makedirs(out, exist_ok=True)
for i, d in shards.items():
    open(os.path.join(out, f"s{i:02d}.js"), "w", encoding="utf-8").write(
        "window.STROKES=Object.assign(window.STROKES||{}," + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + ");\n")
old = os.path.join(root, "data/strokes.js")
if os.path.exists(old):
    os.remove(old)
print(f"{len(chars) - len(missing)} chars in {SHARDS} shards, missing: {''.join(missing) or 'none'}")
