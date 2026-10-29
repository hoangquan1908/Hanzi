# Enrichment task (one batch)

You are enriching a Chinese HSK vocabulary list for a Vietnamese learner. Your task message states the HSK level of the batch.

Input: a TSV file with columns `id, word, pinyin, pos, english` (pos uses ICTCLAS tags: n noun, v verb, a adj, d adverb, m numeral, q measure word, r pronoun, p preposition, c conjunction, u particle, y modal particle, e interjection, t time noun, f locality noun, s place noun, nr person name, ns place name, g morpheme, b distinguishing word, vn/an verbal/adjectival noun, ad adverbial adj).

Output: a JSONL file (one JSON object per line, same order, one line for EVERY input row) with exactly these keys:

- `id` — copy from input
- `hv` — Hán Việt reading of the word, one syllable per character, first letter capitalized, e.g. 爱好 → "Ái hảo", 中国 → "Trung quốc", 们 → "Môn". Use the standard Hán Việt reading matching this word's meaning (e.g. 乐 in 快乐 → "lạc", in 音乐 → "nhạc"; 长 in 长大 → "trưởng"). For a purely onomatopoeic/colloquial char with no common Hán Việt, still give the dictionary reading.
- `pos_vi` — the single most fitting Vietnamese word class, chosen ONLY from: Danh từ, Động từ, Tính từ, Phó từ, Số từ, Lượng từ, Đại từ, Giới từ, Liên từ, Trợ từ, Thán từ, Danh từ riêng, Cụm từ
- `vi` — concise natural Vietnamese meaning(s), max ~40 characters, multiple senses separated by "; " (e.g. "Yêu; thương; yêu quý"). Put the most common sense first.
- `ex_zh` — ONE short, natural example sentence in simplified Chinese that shows the word's typical usage. Length: 6–16 characters for HSK 1–2, 8–22 characters for higher levels or the supplementary list (including the final punctuation 。？！). Keep the rest of the sentence simpler than the target word (vocabulary at or below the batch's HSK level, as stated in your task). It MUST contain the exact `word` string verbatim (character-for-character, contiguous). Prefer the word appearing exactly once. Use Chinese full-width punctuation.
- `ex_vi` — natural Vietnamese translation of `ex_zh`.

Rules:
- Output valid JSON per line (UTF-8, no trailing commas, use `ensure_ascii=False` style real characters, not \u escapes).
- Do not skip any row. Do not add extra keys.
- Write the file with a Python script (build the list of dicts in Python and `json.dumps(..., ensure_ascii=False)` each line) so the JSON is guaranteed valid.
- After writing, validate with: `python3 -I /home/claude/hanzi-app/tools/check_batch.py <input.tsv> <output.jsonl>` and fix every problem it reports until it prints `OK`.

Reply with only one line: the output path and the final OK/problem count.
