# 汉字 · Hanzi

App học từ vựng HSK 3.0 (cấp 1–6, 5.363 từ) + list **Bổ sung** (2.056 từ HSK 2.0 không có trong HSK 3.0 cấp 1–6) cho người Việt, chạy hoàn toàn trên trình duyệt: không cần server, không cần tài khoản. Tiến độ lưu trong trình duyệt (localStorage).

## Chạy

**Cách nhanh nhất:** mở `index.html` bằng trình duyệt (double-click).

**Chạy như web (khuyên dùng, bật được chế độ offline/cài app):**

```bash
cd hanzi-app
python -m http.server 8000      # hoặc: npx serve .
```

Mở http://localhost:8000.

**Dùng trên điện thoại:** deploy thư mục này lên GitHub Pages / Vercel / Netlify (static site, không cần build). Mở link trên Safari → Share → **Add to Home Screen** để dùng như app.

## Tính năng

- **Trang chủ:** tổng số từ, đã biết, hoàn thành, điểm, chuỗi ngày học (🔥), biểu đồ 7 ngày, tiến độ từng cấp HSK.
- **Danh sách từ theo cấp:** chữ Hán, pinyin, âm Hán Việt, từ loại, nghĩa tiếng Việt, câu ví dụ (chữ Hán + pinyin + dịch), nghe phát âm, tìm kiếm (chữ / pinyin không dấu / Hán Việt / nghĩa), sửa nội dung từng từ.
- **Chế độ `# Known`:** nhìn chữ → chọn nghĩa đúng trong 4 đáp án.
- **Chế độ `✓ Done`:** câu ví dụ bị khuyết từ → chọn từ đúng. Khi đã biết hết từ của một cấp, app tự chuyển sang chế độ này.
- **Chế độ `✍️ Viết`:** nhìn nghĩa → tự viết từng chữ lên bảng ô 米 bằng ngón tay / chuột, app chấm từng nét (sai 3 lần sẽ hiện gợi ý nét). Gợi ý: Pinyin, Nghe, Xem mẫu (−10Đ). Đạt nếu trung bình ≤ 2 lỗi/chữ và không dùng "Xem mẫu".
- **Công tắc "Tự viết":** ở bảng luyện viết và bảng xem nét — bật để ẩn nét mờ và tắt gợi ý khi viết sai, tự viết hoàn toàn. App nhớ lựa chọn cho lần sau.
- **Xem thứ tự nét:** nút ✍️ ở mỗi từ trong danh sách → hoạt ảnh thứ tự nét + tập viết từng chữ.
- **Gợi ý trừ điểm:** Hán Việt (−10), Nghe (−10), Nghĩa/Ví dụ (−10), Bỏ qua (−5). Trả lời đúng +20.
- **Câu sai:** ôn lại những từ đã trả lời sai; trả lời đúng thì từ đó được gỡ khỏi danh sách.
- **Cài đặt (⚙️):** sao lưu và khôi phục tiến độ ra file `.json`, thử giọng đọc, xoá tiến độ.
- Phím tắt khi làm quiz: `A–D` hoặc `1–4` để chọn, `Enter` để sang câu tiếp.

Phát âm dùng giọng đọc tiếng Trung có sẵn của hệ điều hành (Web Speech API). Trên iPhone/macOS giọng zh-CN có sẵn; trên Windows có thể phải cài thêm gói tiếng Trung trong Settings → Time & Language → Speech.

## Cấu trúc

```
index.html, style.css, app.js     giao diện + logic
data/hsk1.js … hsk6.js, hsk10.js   dữ liệu từ vựng (mỗi cấp một file; 10 = list Bổ sung)
data/strokes/s00–s31.js           dữ liệu nét chữ (2.639 chữ), chia 32 file theo mã Unicode, chỉ tải file cần dùng
vendor/hanzi-writer.min.js        thư viện vẽ & chấm nét
sw.js, manifest.webmanifest       offline + cài như app (PWA)
tools/                            script sinh dữ liệu
build/                            dữ liệu trung gian (danh sách gốc + phần bổ sung tiếng Việt)
```

Mỗi từ trong `data/hsk{N}.js`:

```js
{ "id": "h1-0001", "w": "爱", "py": "ài", "hv": "Ái", "pos": "Động từ",
  "vi": "Yêu; thương; yêu quý", "ex": "我爱我的家人。",
  "exPy": "Wǒ ài wǒ de jiārén.", "exVi": "Tôi yêu gia đình mình." }
```

Muốn sửa dữ liệu vĩnh viễn: sửa `build/out/*.jsonl` rồi chạy `python3 tools/build_data.py` (cần `pip install pypinyin jieba` và repo [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)). Sửa nhanh cho riêng mình thì dùng nút ✏️ trong app.

**Thêm list mới:** chạy `tools/prep.py <complete-hsk-vocabulary> <cấp>` cho cấp mới, sinh phần tiếng Việt (`hv`, `pos_vi`, `vi`, `ex_zh`, `ex_vi`) theo `tools/ENRICH_PROMPT.md`, kiểm tra bằng `tools/check_batch.py`, chạy `build_data.py`, chạy `tools/build_strokes.py <node_modules/hanzi-writer-data>` để cập nhật nét chữ, rồi thêm một dòng `<script src="data/hskN.js">` vào `index.html` và thêm file vào `sw.js` (nhớ tăng `CACHE`).

## Nguồn dữ liệu

- Danh sách từ HSK 3.0 (chữ, pinyin, từ loại): [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) — MIT License (xem `tools/LICENSE-complete-hsk-vocabulary.txt`).
- Âm Hán Việt, nghĩa tiếng Việt, câu ví dụ và bản dịch: sinh tự động bằng AI, đã kiểm tra định dạng nhưng chưa được người duyệt từng dòng. Nếu thấy sai, sửa bằng nút ✏️ hoặc trong `build/out/`.
- Luyện viết: [Hanzi Writer](https://github.com/chanind/hanzi-writer) (MIT); dữ liệu nét chữ [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) từ Make Me a Hanzi, theo Arphic Public License (xem `vendor/`).
- Pinyin câu ví dụ: sinh bằng `pypinyin` + `jieba`, có thể lệch ở một số chữ đa âm.
