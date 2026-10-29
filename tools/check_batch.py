import json, sys

POS = {"Danh từ", "Động từ", "Tính từ", "Phó từ", "Số từ", "Lượng từ", "Đại từ",
       "Giới từ", "Liên từ", "Trợ từ", "Thán từ", "Danh từ riêng", "Cụm từ"}
KEYS = {"id", "hv", "pos_vi", "vi", "ex_zh", "ex_vi"}

tsv, out = sys.argv[1], sys.argv[2]
rows = [l.rstrip("\n").split("\t") for l in open(tsv, encoding="utf-8")][1:]
words = {r[0]: r[1] for r in rows}
problems = []
try:
    lines = [l for l in open(out, encoding="utf-8") if l.strip()]
except FileNotFoundError:
    print("missing output file"); sys.exit(1)
seen = []
for n, l in enumerate(lines, 1):
    try:
        o = json.loads(l)
    except Exception as e:
        problems.append(f"line {n}: invalid JSON ({e})"); continue
    if set(o) != KEYS:
        problems.append(f"line {n}: keys {sorted(o)}")
        continue
    i = o["id"]; seen.append(i)
    w = words.get(i)
    if w is None:
        problems.append(f"{i}: unknown id"); continue
    if o["pos_vi"] not in POS:
        problems.append(f"{i}: pos_vi '{o['pos_vi']}' not allowed")
    if w not in o["ex_zh"]:
        problems.append(f"{i}: ex_zh does not contain '{w}'")
    if len(o["hv"].split()) != len(w):
        problems.append(f"{i}: hv '{o['hv']}' has {len(o['hv'].split())} syllables, word has {len(w)} chars")
    for k in ("hv", "vi", "ex_zh", "ex_vi"):
        if not str(o[k]).strip():
            problems.append(f"{i}: empty {k}")
    if not (4 <= len(o["ex_zh"]) <= 24):
        problems.append(f"{i}: ex_zh length {len(o['ex_zh'])}")
missing = [r[0] for r in rows if r[0] not in seen]
if missing:
    problems.append(f"missing ids: {missing[:10]}{'...' if len(missing) > 10 else ''} ({len(missing)})")
if [r[0] for r in rows] != seen and not missing:
    problems.append("order differs from input")
if problems:
    print("\n".join(problems)); print(f"{len(problems)} problems")
else:
    print("OK")
