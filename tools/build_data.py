"""Gộp dữ liệu gốc + phần bổ sung tiếng Việt → data/hsk{N}.js

python3 tools/build_data.py
"""
import glob, json, os, re
from pypinyin import pinyin, Style

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = json.load(open(os.path.join(ROOT, "build/base.json"), encoding="utf-8"))
extra = {}
for f in sorted(glob.glob(os.path.join(ROOT, "build/out/*.jsonl"))):
    for line in open(f, encoding="utf-8"):
        if line.strip():
            o = json.loads(line)
            extra[o["id"]] = o

import jieba
jieba.setLogLevel(60)

# Từ điển pinyin theo từ (có thanh nhẹ, vd 爸爸 → bà ba) lấy từ toàn bộ danh sách HSK
COMPLETE = os.environ.get("HSK_COMPLETE_JSON", "/root/complete-hsk-vocabulary/complete.min.json")
WORD_PY = {}
if os.path.exists(COMPLETE):
    for e in json.load(open(COMPLETE, encoding="utf-8")):
        w = e.get("s") or e.get("simplified")
        forms = e.get("f") or e.get("forms") or []
        if not w or not forms:
            continue
        tr = forms[0].get("i") or forms[0].get("transcriptions") or {}
        py = tr.get("y") or tr.get("pinyin")
        if py and len(py.split()) == len(w) and w not in WORD_PY:
            WORD_PY[w] = py
for w in base:
    if len(w["py"].split()) == len(w["w"]):
        WORD_PY[w["w"]] = w["py"]


HAN = re.compile(r"[一-鿿]")
# 长 làm tính từ "dài" (cháng) — pypinyin hay đoán nhầm thành zhǎng
CHANG_BEFORE = ("很", "太", "真", "不", "多", "最", "更", "挺", "好", "那么", "这么", "非常", "比较", "特别")
CHANG_AFTER = ("城", "江", "期", "短", "时间", "度", "的", "得", "裤", "发")


def char_pinyin(s: str) -> list:
    """Pinyin từng ký tự theo ngữ cảnh cả câu (None cho ký tự không phải chữ Hán)."""
    han = [c for c in s if HAN.match(c)]
    py = [p[0] for p in pinyin("".join(han), style=Style.TONE, errors="ignore")]
    out, k = [], 0
    for i, c in enumerate(s):
        if HAN.match(c):
            p = py[k]; k += 1
            if c == "长" and p == "zhǎng" and (s[:i].endswith(CHANG_BEFORE) or s[i + 1:].startswith(CHANG_AFTER)):
                p = "cháng"
            elif c == "教" and p == "jiào" and s[i + 1:i + 2] in ("我", "你", "他", "她", "们", "学", "孩", "大", "人"):
                p = "jiāo"                      # 教 + tân ngữ = dạy
            elif c == "谁" and p == "shuí":
                p = "shéi"                      # cách đọc khẩu ngữ phổ biến
            elif c == "喂" and p == "wèi" and (i == 0 or not HAN.match(s[i - 1])):
                p = "wéi"                       # "alo" khi nghe điện thoại
            elif c == "地" and p == "dì" and i > 0 and HAN.match(s[i - 1]) and i + 1 < len(s) and HAN.match(s[i + 1]) \
                    and s[i - 1] not in "土草本当外天各此场目基园陆田内大满" and s[i + 1] not in "方图铁址区点球上下里址面板":
                p = "de"                        # trợ từ trạng ngữ: 高兴地笑
            out.append(p)
        else:
            out.append(None)
    return out


def sentence_pinyin(s: str, target: str, target_py: str):
    """Trả về (pinyin cả câu, pinyin của từ mục tiêu theo ngữ cảnh)."""
    per = char_pinyin(s)
    pos = s.index(target)
    ctx_target = " ".join(per[pos:pos + len(target)])
    jieba.add_word(target, freq=100000)
    out, i = [], 0
    for tok in jieba.cut(s, HMM=False):
        j = i + len(tok)
        if HAN.match(tok[0]):
            if i == pos and tok == target and len(target) > 1:
                out.append(target_py.replace(" ", ""))
            elif tok.startswith("个") and i > 0 and s[i - 1] in "一二三四五六七八九十两几半每这那哪":
                out.append(" ".join(per[i:j]))   # 八个人 → bā gè rén, không phải gèrén
            elif len(tok) > 1 and tok in WORD_PY:
                out.append(WORD_PY[tok].replace(" ", ""))
            elif len(tok) > 1:
                out.append(" ".join(per[i:j]))   # cụm không có trong từ điển → tách âm tiết
            else:
                out.append(per[i])
        elif tok.strip():
            out.append(tok.strip())
        i = j
    txt = " ".join(out)
    txt = txt.replace("，", ", ").replace("。", ".").replace("？", "?").replace("！", "!").replace("、", ", ").replace("：", ": ").replace("；", "; ")
    txt = re.sub(r"\s+([,.?!:;])", r"\1", txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt[:1].upper() + txt[1:], ctx_target


missing = [w["id"] for w in base if w["id"] not in extra]
assert not missing, f"missing enrichment: {missing[:10]}"

by_level = {}
fixes = []
for w in base:
    e = extra[w["id"]]
    assert w["w"] in e["ex_zh"], w["id"]
    ex_py, ctx = sentence_pinyin(e["ex_zh"], w["w"], w["py"])
    py = w["py"]
    # chữ đơn: lấy cách đọc theo ngữ cảnh câu ví dụ (sửa 吧 bā→ba, 吗 má→ma, 过 Guō→guò...)
    if len(w["w"]) == 1 and w["w"] not in "一不" and ctx and ctx != py.lower():
        fixes.append(f'{w["w"]}: {py} → {ctx}')
        py = ctx
    py = py[:1].lower() + py[1:] if e["pos_vi"] != "Danh từ riêng" else py
    by_level.setdefault(w["level"], []).append({
        "id": w["id"], "w": w["w"], "py": py, "hv": e["hv"], "pos": e["pos_vi"],
        "vi": e["vi"], "ex": e["ex_zh"], "exPy": ex_py, "exVi": e["ex_vi"],
    })

os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
for lvl, rows in by_level.items():
    js = "window.HSK = window.HSK || {};\nwindow.HSK[%d] = %s;\n" % (
        lvl, json.dumps(rows, ensure_ascii=False, separators=(",", ":")).replace("},{", "},\n{"))
    open(os.path.join(ROOT, f"data/hsk{lvl}.js"), "w", encoding="utf-8").write(js)
    print(f"data/hsk{lvl}.js: {len(rows)} words")
print(f"{len(fixes)} single-char readings taken from context:", "; ".join(fixes))
