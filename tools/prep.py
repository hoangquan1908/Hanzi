"""Tạo danh sách gốc + chia lô (TSV) để bổ sung phần tiếng Việt.

python3 tools/prep.py <complete-hsk-vocabulary> <level> [batch_size]
  level = 1..6  → HSK 3.0 (wordlists/exclusive/new/<level>.json), lưu với key = level
  level = extra → từ HSK 2.0 không có trong HSK 3.0 cấp 1–6, lưu với key = 10 ("Bổ sung")
Kết quả: build/base_<key>.json, build/in/L<key>_<nn>.tsv
"""
import json, math, os, sys

repo, lvl = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 200
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
wl = os.path.join(repo, "wordlists/exclusive")

if lvl == "extra":
    key, prefix = 10, "bs"
    new_words = set()
    for i in range(1, 7):
        new_words |= {w["simplified"] for w in json.load(open(f"{wl}/new/{i}.json", encoding="utf-8"))}
    src, seen = [], set()
    for i in range(1, 7):
        for w in json.load(open(f"{wl}/old/{i}.json", encoding="utf-8")):
            if w["simplified"] not in new_words and w["simplified"] not in seen:
                seen.add(w["simplified"]); src.append(w)
else:
    key, prefix = int(lvl), f"h{int(lvl)}"
    src = json.load(open(f"{wl}/new/{key}.json", encoding="utf-8"))

rows = []
for i, w in enumerate(src, 1):
    f = w["forms"][0]
    rows.append({"id": f"{prefix}-{i:04d}", "level": key, "w": w["simplified"],
                 "py": f["transcriptions"]["pinyin"], "pos": w.get("pos", []),
                 "en": "; ".join(f["meanings"][:3])[:160]})
json.dump(rows, open(os.path.join(root, f"build/base_{key}.json"), "w", encoding="utf-8"), ensure_ascii=False)
os.makedirs(os.path.join(root, "build/in"), exist_ok=True)
n = math.ceil(len(rows) / size)
for b in range(n):
    chunk = rows[b * size:(b + 1) * size]
    with open(os.path.join(root, f"build/in/L{key}_{b:02d}.tsv"), "w", encoding="utf-8") as fh:
        fh.write("id\tword\tpinyin\tpos\tenglish\n")
        for w in chunk:
            fh.write(f"{w['id']}\t{w['w']}\t{w['py']}\t{','.join(w['pos'])}\t{w['en']}\n")
print(f"level {key}: {len(rows)} words, {n} batches")
