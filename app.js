/* Hanzi — app học từ vựng HSK chạy hoàn toàn trên trình duyệt.
 * Dữ liệu: window.HSK[level] = [{id, w, py, hv, pos, vi, ex, exPy, exVi}]
 * Tiến độ: localStorage (key STORE_KEY).
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- config
  const STORE_KEY = 'hanzi.v1';
  const ALL_LEVELS = [1, 2, 3, 4, 5, 6, 10];       // 10 = list bổ sung
  const levelName = l => (l === 10 ? 'Bổ sung' : `HSK${l}`);
  const levelSub = l => (l === 10 ? 'Từ HSK 2.0 ngoài HSK 3.0' : '');
  const SESSION_SIZE = 10;          // số câu mỗi lượt học
  const PTS = { correct: 20, hint: 10, skip: 5 };
  const VERSION = '1.3.0';
  // f = cờ "đã xong", w = cờ "làm sai" trong S.words[id]
  const MODES = {
    known: { f: 'k', w: 'wk', label: '# Từ vựng', chip: 'green' },
    done:  { f: 'd', w: 'wd', label: '✓ Đoạn văn', chip: 'orange' },
    write: { f: 'v', w: 'wv', label: '✍️ Luyện viết', chip: 'violet' },
  };
  const CHEERS = [
    '🌟 Bạn đang làm rất tốt!', '💪 Mỗi ngày một chút!', '📚 Học chữ Hán vui vẻ!',
    '🚀 Tiến bộ từng ngày!', '🎯 Kiên định với mục tiêu!', '🔥 Đừng bỏ cuộc!',
    '🌱 Tri thức là đầu tư tốt nhất', '📖 Học đến đâu chắc đến đó!',
  ];

  const DATA = window.HSK || {};
  const LEVELS = ALL_LEVELS.filter(l => Array.isArray(DATA[l]) && DATA[l].length);

  // ---------------------------------------------------------------- storage
  const blank = () => ({ words: {}, days: {}, score: 0, edits: {}, mode: {} });
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(blank(), JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return blank();
  }
  let S = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }

  const todayKey = (d = new Date()) => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  function day(key = todayKey()) {
    return S.days[key] || (S.days[key] = { known: 0, completed: 0, written: 0, score: 0 });
  }
  function addScore(n) {
    S.score += n;
    day().score += n;
  }
  const st = id => S.words[id] || (S.words[id] = {});

  // ---------------------------------------------------------------- data helpers
  const byId = {};
  LEVELS.forEach(l => DATA[l].forEach((w, i) => { w.level = l; w.n = i + 1; byId[w.id] = w; }));

  function word(id) {
    const base = byId[id];
    const ed = S.edits[id];
    return ed ? Object.assign({}, base, ed) : base;
  }
  const words = level => DATA[level].map(w => word(w.id));
  const modeOf = level => (MODES[S.mode[level]] ? S.mode[level] : 'known');
  const modeCounts = (s, mode) => {
    const done = mode === 'known' ? s.known : mode === 'done' ? s.done : s.written;
    const wrong = mode === 'known' ? s.wk : mode === 'done' ? s.wd : s.wv;
    return { done, wrong, remaining: s.total - done };
  };

  function levelStats(level) {
    const list = DATA[level];
    let known = 0, done = 0, written = 0, wk = 0, wd = 0, wv = 0, a = 0, c = 0;
    list.forEach(w => {
      const s = S.words[w.id];
      if (!s) return;
      if (s.k) known++;
      if (s.d) done++;
      if (s.wk) wk++;
      if (s.wd) wd++;
      if (s.v) written++;
      if (s.wv) wv++;
      a += s.a || 0; c += s.c || 0;
    });
    return { total: list.length, known, done, written, wk, wd, wv, acc: a ? c / a : null };
  }

  function streak() {
    const d = new Date();
    const active = k => { const x = S.days[k]; return x && (x.known || x.completed || x.written); };
    if (!active(todayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (active(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---------------------------------------------------------------- utils
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n).toLocaleString('vi-VN');
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = arr => arr[Math.random() * arr.length | 0];
  const stripTones = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

  function highlight(sentence, w) {
    const i = sentence.indexOf(w);
    if (i < 0) return esc(sentence);
    return esc(sentence.slice(0, i)) + '<b>' + esc(w) + '</b>' + esc(sentence.slice(i + w.length));
  }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------------- speech
  let zhVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('Trình duyệt không hỗ trợ đọc'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (zhVoice) u.voice = zhVoice;
    u.rate = 0.85;
    speechSynthesis.speak(u);
  }

  // ---------------------------------------------------------------- router
  const app = document.getElementById('app');
  let quiz = null;          // phiên học hiện tại
  let listQuery = '';

  function route() {
    if (typeof destroyWriters === 'function') destroyWriters();
    const h = location.hash.replace(/^#\/?/, '');
    const m = h.match(/^hsk(\d+)(?:\/(quiz))?$/);
    if (m && LEVELS.includes(+m[1])) {
      const lvl = +m[1];
      if (m[2]) {
        if (!quiz || quiz.level !== lvl) { location.replace(`#/hsk${lvl}`); return; }
        renderQuiz();
      } else {
        if (quiz) quiz = null;
        renderLevel(lvl);
      }
      return;
    }
    quiz = null;
    renderHome();
  }
  window.addEventListener('hashchange', route);

  // ---------------------------------------------------------------- home
  function renderHome() {
    let total = 0, known = 0, done = 0, written = 0;
    LEVELS.forEach(l => { const s = levelStats(l); total += s.total; known += s.known; done += s.done; written += s.written; });
    const td = day();
    const sk = streak();
    const activeDays = Object.values(S.days).filter(d => d.known || d.completed || d.written).length;
    const allK = pct(known, total), allD = pct(done, total);

    app.innerHTML = `
      <div class="topbar">
        <div class="brand"><div class="logo">汉</div>Hanzi</div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="pill">📊 Hôm nay <span class="sep"></span>⭐ <span class="val">${fmt(td.score)}</span></div>
          <button class="icon-btn" data-act="menu" aria-label="Cài đặt">⚙️</button>
        </div>
      </div>

      ${dailyCard()}

      <div class="card stats">
        <div class="stat"><div class="lbl">Tổng từ</div><div class="num c-ink">${fmt(total)}</div></div>
        <div class="stat"><div class="lbl">Đã biết</div><div class="num c-green">${fmt(known)}</div></div>
        <div class="stat"><div class="lbl">Hoàn thành</div><div class="num c-orange">${fmt(done)}</div><div class="lbl c-violet" style="margin-top:2px">✍️ ${fmt(written)}</div></div>
        <div class="stat"><div class="lbl">Điểm học</div><div class="num c-rose">${fmt(S.score)}</div></div>
      </div>

      <div class="section-title">
        <span><i class="bar"></i>7 ngày qua · 📅 ${activeDays} ngày</span>
        <span class="right">🔥 ${sk}</span>
      </div>
      <div class="card chart">${chartSVG()}</div>

      <div class="section-title">
        <span><i class="bar"></i>HSK 3.0 · 📚 ${LEVELS.length} list</span>
        <span class="right"><span class="c-green">#: ${allK}%</span> &nbsp;<span class="c-orange">✓: ${allD}%</span></span>
      </div>
      <div class="levels">
        ${ALL_LEVELS.map(levelCard).join('')}
      </div>

      <div class="footer">Hanzi · v${VERSION} · dữ liệu HSK 3.0 (complete-hsk-vocabulary, MIT)</div>
    `;
  }

  function levelCard(l) {
    if (!LEVELS.includes(l)) {
      return `<div class="card level locked"><div class="row"><span class="name">${levelName(l)}</span><span class="chip orange">Sắp có</span></div></div>`;
    }
    const s = levelStats(l);
    const gk = pct(s.known, s.total), od = pct(s.done, s.total);
    return `
      <button class="card level" data-act="open" data-level="${l}">
        <div class="row">
          <span class="name">${levelName(l)}${levelSub(l) ? `<small class="lvl-sub">${levelSub(l)}</small>` : ''}</span>
          <span class="pct"><span class="c-green">#: ${gk}%</span> &nbsp;<span class="c-orange">✓: ${od}%</span> &nbsp;<span class="c-violet">✍️: ${pct(s.written, s.total)}%</span></span>
        </div>
        <div class="row">
          <div class="progress"><div class="g" style="width:${Math.max(0, gk - od)}%"></div><div class="o" style="width:${od}%"></div></div>
          <span class="count">${s.known}/${s.total}</span>
        </div>
      </button>`;
  }

  function chartSVG() {
    const days = [];
    const d = new Date();
    d.setDate(d.getDate() - 6);
    for (let i = 0; i < 7; i++) {
      const k = todayKey(d);
      const x = S.days[k] || { known: 0, completed: 0, written: 0 };
      days.push({ label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, known: x.known, completed: x.completed, written: x.written || 0 });
      d.setDate(d.getDate() + 1);
    }
    if (!days.some(x => x.known || x.completed || x.written)) {
      return `<div class="legend"><span><i style="background:var(--green-soft);border:1.5px solid var(--green)"></i>Đã biết (#)</span><span><i style="background:var(--orange)"></i>Hoàn thành (✓)</span><span><i style="background:var(--violet)"></i>Đã viết (✍️)</span></div>
              <div class="chart-empty">Chưa có dữ liệu — bắt đầu học để thấy biểu đồ 📈</div>`;
    }
    const W = 340, H = 150, padL = 34, padB = 22, padT = 18;
    const max = Math.max(4, ...days.map(x => Math.max(x.known, x.completed, x.written)));
    const nice = Math.ceil(max / 4) * 4;
    const cw = (W - padL - 6) / 7;
    const y = v => padT + (H - padT - padB) * (1 - v / nice);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = nice / 4 * i;
      g += `<line x1="${padL}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="#eef2f6"/>
            <text x="${padL - 6}" y="${y(v) + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${fmt(v)}</text>`;
    }
    days.forEach((x, i) => {
      const cx = padL + cw * i + cw / 2;
      const bw = cw * 0.56;
      if (x.known) g += `<rect x="${cx - bw / 2}" y="${y(x.known)}" width="${bw}" height="${y(0) - y(x.known)}" rx="4" fill="#d1fae5" stroke="#10b981" stroke-width="1.2"/>`;
      g += `<text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#64748b" font-weight="700">${x.label}</text>`;
    });
    if (days.some(x => x.written)) {
      const vp = days.map((x, i) => [padL + cw * i + cw / 2, y(x.written)]);
      g += `<polyline points="${vp.map(p => p.join(',')).join(' ')}" fill="none" stroke="#7c3aed" stroke-width="2" stroke-dasharray="4 3" stroke-linejoin="round"/>`;
      vp.forEach((p, i) => { if (days[i].written) g += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#7c3aed"/>`; });
    }
    const pts = days.map((x, i) => [padL + cw * i + cw / 2, y(x.completed)]);
    g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linejoin="round"/>`;
    pts.forEach((p, i) => {
      const v = days[i].completed;
      g += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#fff" stroke="#f59e0b" stroke-width="2"/>`;
      if (v) g += `<text x="${p[0]}" y="${p[1] - 8}" text-anchor="middle" font-size="9" fill="#b45309" font-weight="800">${fmt(v)}</text>`;
    });
    return `<div class="legend"><span><i style="background:var(--green-soft);border:1.5px solid var(--green)"></i>Đã biết (#)</span><span><i style="background:var(--orange)"></i>Hoàn thành (✓)</span><span><i style="background:var(--violet)"></i>Đã viết (✍️)</span></div>
            <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ 7 ngày">${g}</svg>`;
  }

  // ---------------------------------------------------------------- level screen
  function renderLevel(level) {
    const s = levelStats(level);
    const mode = modeOf(level);
    const { done: doneN, wrong, remaining } = modeCounts(s, mode);
    const g = pct(s.known, s.total), o = pct(s.done, s.total);
    const metaText = mode === 'known' ? `Đã biết: ${s.known}/${s.total} từ`
      : mode === 'done' ? `Hoàn thành: ${s.done}/${s.total} câu` : `Đã viết: ${s.written}/${s.total} từ`;

    app.innerHTML = `
      <div class="topbar">
        <button class="icon-btn" data-act="home" aria-label="Về trang chủ">←</button>
        <div class="pill">
          <span class="chip ${MODES[mode].chip}">${MODES[mode].label}</span>
          Điểm: <span class="val" style="color:var(--ink)">${fmt(S.score)}</span>
        </div>
      </div>

      <div class="seg seg3">
        <button class="${mode === 'known' ? 'on known' : ''}" data-act="mode" data-mode="known"># Known</button>
        <button class="${mode === 'done' ? 'on done' : ''}" data-act="mode" data-mode="done">✓ Done</button>
        <button class="${mode === 'write' ? 'on write' : ''}" data-act="mode" data-mode="write">✍️ Viết</button>
      </div>

      <div class="meta">
        <span>${metaText}</span>
        <span class="chip orange">${levelName(level)}</span>
        <span class="acc">Tỷ lệ đúng: ${s.acc == null ? '—' : (s.acc * 100).toFixed(1) + '%'}</span>
      </div>
      <div class="progress bigbar">${mode === 'write'
        ? `<div class="v" style="width:${pct(doneN, s.total)}%"></div>`
        : `<div class="g" style="width:${Math.max(0, g - o)}%"></div><div class="o" style="width:${o}%"></div>`}</div>

      <div class="list-head">📚 Danh sách từ <small>(${s.total} từ)</small></div>
      <div class="search"><input id="q" type="search" placeholder="Tìm chữ, pinyin, nghĩa…" value="${esc(listQuery)}" autocomplete="off"><span>⌕</span></div>
      <div class="words" id="words"></div>

      <div class="bottom-actions"><div class="inner">
        <button class="btn ${mode === 'write' ? 'violet' : 'green'}" data-act="start" data-kind="new" ${remaining || mode === 'known' ? '' : 'disabled'}>${mode === 'write' ? '✍️ Viết mới' : '📝 Học mới'} (${remaining})</button>
        <button class="btn rose" data-act="start" data-kind="wrong" ${wrong ? '' : 'disabled'}>🔁 Câu sai (${wrong})</button>
      </div></div>
    `;
    app.dataset.level = level;
    renderWordList(level);
    const q = document.getElementById('q');
    q.addEventListener('input', () => { listQuery = q.value; renderWordList(level); });
  }

  function renderWordList(level) {
    const box = document.getElementById('words');
    if (!box) return;
    const q = stripTones(listQuery.trim());
    let list = words(level);
    if (q) {
      list = list.filter(w =>
        w.w.includes(listQuery.trim()) ||
        stripTones(w.py).replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        stripTones(w.hv).includes(q) || stripTones(w.vi).includes(q));
    }
    if (!list.length) { box.innerHTML = '<div class="empty">Không tìm thấy từ nào</div>'; return; }
    box.innerHTML = list.map(w => {
      const s = S.words[w.id] || {};
      return `
      <div class="card word">
        <div class="head">
          <span class="idx">${w.n}</span>
          <span class="w">${esc(w.w)}</span>
          <span class="py">${esc(w.py)}</span>
          <span class="hv">[${esc(w.hv)}]</span>
          <span class="pos">(${esc(w.pos)})</span>
          <span class="badges">${s.k ? '<span class="badge k">#</span>' : ''}${s.d ? '<span class="badge d">✓</span>' : ''}${s.v ? '<span class="badge v">✍️</span>' : ''}${(s.wk || s.wd || s.wv) ? '<span class="badge x">✗</span>' : ''}</span>
          <span class="tools">
            <button data-act="speak" data-text="${esc(w.w)}" aria-label="Nghe">🔊</button>
            <button data-act="strokes" data-id="${w.id}" aria-label="Xem cách viết">✍️</button>
            <button data-act="edit" data-id="${w.id}" aria-label="Sửa">✏️</button>
          </span>
        </div>
        <div class="vi">${esc(w.vi)}</div>
        <div class="ex">
          <div class="z">${highlight(w.ex, w.w)}</div>
          ${w.exPy ? `<div class="p">${esc(w.exPy)}</div>` : ''}
          <div class="v">${esc(w.exVi)}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- quiz
  function startQuiz(level, kind) {
    let mode = modeOf(level);
    const list = words(level);
    let pool;
    if (kind === 'wrong') {
      const flag = MODES[mode].w;
      pool = shuffle(list.filter(w => S.words[w.id] && S.words[w.id][flag]));
    } else {
      if (mode === 'known' && list.every(w => S.words[w.id] && S.words[w.id].k)) {
        mode = S.mode[level] = 'done';
        save();
        toast('✨ Bạn đã biết hết từ vựng! Tự động chuyển sang Đoạn văn.');
      }
      const flag = MODES[mode].f;
      pool = list.filter(w => !(S.words[w.id] && S.words[w.id][flag]));
      if (mode !== 'known') {
        // ưu tiên những từ đã biết nghĩa trước
        pool.sort((a, b) => (S.words[b.id]?.k ? 1 : 0) - (S.words[a.id]?.k ? 1 : 0));
      }
    }
    if (!pool.length) { toast(mode === 'known' ? 'Không còn từ nào' : '🎉 Bạn đã hoàn thành hết cấp này!'); return; }
    const items = pool.slice(0, SESSION_SIZE).map(w => mode === 'write' ? { w, options: [] } : buildQuestion(w, mode, list));
    quiz = { level, kind, mode, items, i: 0, right: 0, wrong: 0, gained: 0, countdown: 3, answered: null, used: {} };
    if (mode === 'write') {
      quiz.countdown = 0;
      app.innerHTML = '<div class="countdown"><span style="font-size:20px">Đang tải nét chữ…</span></div>';
      loadWriter().then(() => ensureChars(items.flatMap(it => [...it.w.w]).filter(c => HAN.test(c)))).then(() => {
        if (!quiz || quiz.level !== level) return;
        quiz.countdown = 3;
        const h = `#/hsk${level}/quiz`;
        if (location.hash === h) renderQuiz(); else location.hash = h;
      })
        .catch(() => { quiz = null; toast('Không tải được dữ liệu nét chữ'); renderLevel(level); });
      return;
    }
    location.hash = `#/hsk${level}/quiz`;
  }

  function buildQuestion(w, mode, list) {
    const others = list.filter(x => x.id !== w.id && x.w !== w.w);
    let cands;
    if (mode === 'known') {
      cands = shuffle(others.filter(x => x.vi !== w.vi));
    } else {
      const sameLen = others.filter(x => x.w.length === w.w.length && !w.ex.includes(x.w));
      cands = shuffle(sameLen.length >= 3 ? sameLen : others);
    }
    const seen = new Set([mode === 'known' ? w.vi : w.w]);
    const distract = [];
    for (const c of cands) {
      const key = mode === 'known' ? c.vi : c.w;
      if (seen.has(key)) continue;
      seen.add(key); distract.push(c);
      if (distract.length === 3) break;
    }
    return { w, options: shuffle([w, ...distract]) };
  }

  function renderQuiz() {
    const q = quiz;
    const header = `
      <div class="topbar">
        <button class="icon-btn" data-act="quit" aria-label="Thoát">✕</button>
        <div class="pill">
          <span class="chip ${MODES[q.mode].chip}">${q.kind === 'wrong' ? '🔁 Câu sai' : MODES[q.mode].label}</span>
          Điểm: <span class="val" style="color:var(--ink)">${fmt(S.score)}</span>
        </div>
      </div>
      <div class="meta">
        <span>Câu ${Math.min(q.i + 1, q.items.length)}/${q.items.length}</span>
        <span class="chip orange">${levelName(q.level)}</span>
        <span class="acc">✓ ${q.right} · ✗ ${q.wrong}</span>
      </div>
      <div class="progress bigbar"><div class="g" style="width:${pct(q.i, q.items.length)}%"></div></div>`;

    if (q.countdown > 0) {
      app.innerHTML = header + `<div class="countdown"><span>${q.countdown}</span></div><div class="footer">${esc(pick(CHEERS))}</div>`;
      setTimeout(() => { if (quiz === q) { q.countdown--; renderQuiz(); } }, 800);
      return;
    }
    if (q.i >= q.items.length) { renderFinish(header); return; }
    if (q.mode === 'write') { renderWrite(header); return; }

    const it = q.items[q.i];
    const w = it.w;
    const ans = q.answered;
    const used = q.used;
    let prompt;
    if (q.mode === 'known') {
      prompt = `
        <div class="big">${esc(w.w)}</div>
        <div class="sub">${used.nghe || ans ? esc(w.py) : '&nbsp;'}</div>
        <div class="hints">
          <button class="hint hv" data-act="hint" data-h="hv" ${used.hv || ans ? 'disabled' : ''}>🈶 Hán Việt (−${PTS.hint}Đ)</button>
          <button class="hint nghe" data-act="hint" data-h="nghe" ${ans ? 'disabled' : ''}>🔊 Nghe${used.nghe ? '' : ` (−${PTS.hint}Đ)`}</button>
          <button class="hint nghia" data-act="hint" data-h="vidu" ${used.vidu || ans ? 'disabled' : ''}>📖 Ví dụ (−${PTS.hint}Đ)</button>
        </div>
        <div class="reveal">
          ${used.hv ? `<div class="r-hv">[${esc(w.hv)}]</div>` : ''}
          ${used.vidu ? `<div class="zh">${highlight(w.ex, w.w)}</div>` : ''}
        </div>`;
    } else {
      const i = w.ex.indexOf(w.w);
      const gapped = esc(w.ex.slice(0, i)) + `<span class="gap">${ans ? esc(w.w) : '＊'}</span>` + esc(w.ex.slice(i + w.w.length));
      prompt = `
        <div class="sentence">${gapped}</div>
        <div class="hints">
          <button class="hint hv" data-act="hint" data-h="hv" ${used.hv || ans ? 'disabled' : ''}>🈶 Hán Việt (−${PTS.hint}Đ)</button>
          <button class="hint nghe" data-act="hint" data-h="nghe" ${ans ? 'disabled' : ''}>🔊 Nghe${used.nghe ? '' : ` (−${PTS.hint}Đ)`}</button>
          <button class="hint nghia" data-act="hint" data-h="nghia" ${used.nghia || ans ? 'disabled' : ''}>📖 Nghĩa (−${PTS.hint}Đ)</button>
        </div>
        <div class="reveal">
          ${used.hv ? `<div class="r-hv">[${esc(w.hv)}]</div>` : ''}
          ${used.nghia ? `<div class="r-vi">${esc(w.exVi)}</div>` : ''}
        </div>`;
    }

    const letters = 'ABCD';
    const opts = it.options.map((o, k) => {
      let cls = '';
      if (ans) {
        if (o.id === w.id) cls = 'right';
        else if (o.id === ans.pickedId) cls = 'wrong';
      }
      const body = q.mode === 'known'
        ? `<span class="o-vi">${esc(o.vi)}</span>`
        : `<span class="o-zh">${esc(o.w)}</span><span class="o-py">${esc(o.py)}</span>`;
      return `<button class="opt ${cls}" data-act="answer" data-id="${o.id}" ${ans ? 'disabled' : ''}><span class="letter">${letters[k]}</span>${body}</button>`;
    }).join('');

    const answerCard = ans ? `
      <div class="card answer">
        <div class="verdict ${ans.ok ? 'ok' : 'no'}">${ans.ok ? `✓ Chính xác! +${PTS.correct}Đ` : (ans.skipped ? `⏭ Đã bỏ qua (−${PTS.skip}Đ)` : '✗ Chưa đúng')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div>
            <span class="zh" style="font-size:22px;font-weight:900">${esc(w.w)}</span>
            <span class="p" style="margin-left:6px">${esc(w.py)}</span>
            <span class="hv" style="color:var(--violet);font-weight:800;font-size:13px;margin-left:6px">[${esc(w.hv)}]</span>
          </div>
          <button class="icon-btn" data-act="speak" data-text="${esc(w.ex)}" aria-label="Nghe câu">🔊</button>
        </div>
        <div class="v" style="margin-bottom:8px">${esc(w.vi)}</div>
        <div class="z">${highlight(w.ex, w.w)}</div>
        ${w.exPy ? `<div class="p">${esc(w.exPy)}</div>` : ''}
        <div class="v">${esc(w.exVi)}</div>
      </div>` : '';

    app.innerHTML = header + `
      <div class="quiz">
        <div class="card prompt">${prompt}</div>
        <div class="card options">${opts}</div>
        ${answerCard}
        <div class="quiz-foot">
          ${ans
            ? `<button class="btn green next" data-act="next">${q.i + 1 < q.items.length ? 'Câu tiếp →' : 'Xem kết quả'}</button>`
            : `<button class="skip" data-act="skip">⏩ Bỏ qua (−${PTS.skip}Đ)</button>`}
        </div>
      </div>`;
  }

  function useHint(h) {
    const q = quiz, w = q.items[q.i].w;
    if (q.answered) return;
    if (h === 'nghe') {
      if (!q.used.nghe) { q.used.nghe = true; addScore(-PTS.hint); q.gained -= PTS.hint; save(); }
      speak(q.mode === 'known' ? w.w : w.ex);
    } else if (!q.used[h]) {
      q.used[h] = true; addScore(-PTS.hint); q.gained -= PTS.hint; save();
    }
    renderQuiz();
  }

  function answer(pickedId, skipped = false) {
    const q = quiz;
    if (q.answered) return;
    const w = q.items[q.i].w;
    const s = st(w.id);
    const ok = !skipped && pickedId === w.id;
    const flag = MODES[q.mode].f;
    const wflag = MODES[q.mode].w;
    if (skipped) {
      addScore(-PTS.skip); q.gained -= PTS.skip;
    } else {
      s.a = (s.a || 0) + 1;
      if (ok) {
        s.c = (s.c || 0) + 1;
        if (!s[flag]) {
          s[flag] = 1;
          if (flag === 'k') day().known++; else if (flag === 'd') day().completed++; else day().written = (day().written || 0) + 1;
        }
        delete s[wflag];
        addScore(PTS.correct); q.gained += PTS.correct;
        q.right++;
      } else {
        s[wflag] = 1;
        q.wrong++;
      }
    }
    save();
    q.answered = { ok, pickedId, skipped };
    if (q.mode === 'write') { renderWriteResult(); if (ok) speak(w.w); return; }
    renderQuiz();
    if (ok && q.mode === 'done') speak(w.ex);
  }

  function nextQuestion() {
    destroyWriters();
    quiz.i++;
    quiz.answered = null;
    quiz.used = {};
    renderQuiz();
  }

  function renderFinish(header) {
    const q = quiz;
    const total = q.items.length;
    const emoji = q.right === total ? '🏆' : q.right >= total / 2 ? '🎉' : '💪';
    const s = levelStats(q.level);
    const { remaining: remain, wrong: wrongN } = modeCounts(s, q.mode);
    app.innerHTML = header + `
      <div class="card finish">
        <div class="emoji">${emoji}</div>
        <h2>Xong lượt học!</h2>
        <p>Đúng <b class="c-green">${q.right}</b> · Sai <b style="color:var(--red)">${q.wrong}</b> · Bỏ qua ${total - q.right - q.wrong}</p>
        <p>Điểm lượt này: <b class="c-rose">${q.gained >= 0 ? '+' : ''}${fmt(q.gained)}</b></p>
        <p>${esc(pick(CHEERS))}</p>
        <div class="actions">
          ${remain ? `<button class="btn green" data-act="again" data-kind="new">📝 Học tiếp (${remain})</button>` : ''}
          ${wrongN ? `<button class="btn rose" data-act="again" data-kind="wrong">🔁 Ôn câu sai (${wrongN})</button>` : ''}
          <button class="btn ghost" data-act="back">Về danh sách</button>
        </div>
      </div>`;
  }


  // ---------------------------------------------------------------- writing (Hanzi Writer)
  const HAN = /[一-鿿]/;
  let writerLoad = null;
  function loadScript(src) {
    return new Promise((ok, fail) => {
      const el = document.createElement('script');
      el.src = src; el.onload = ok; el.onerror = fail;
      document.head.appendChild(el);
    });
  }
  // Tải thư viện + dữ liệu nét chữ khi cần (lần đầu luyện viết), không làm chậm lúc mở app
  function loadWriter() {
    if (window.HanziWriter) return Promise.resolve();
    if (!writerLoad) {
      writerLoad = loadScript('vendor/hanzi-writer.min.js').catch(e => { writerLoad = null; throw e; });
    }
    return writerLoad;
  }
  // Dữ liệu nét chia thành 32 file theo mã Unicode (data/strokes/sNN.js), chỉ tải file cần dùng
  const SHARDS = 32;
  const shardLoads = {};
  const shardOf = ch => ch.codePointAt(0) % SHARDS;
  function loadShard(n) {
    if (!shardLoads[n]) {
      shardLoads[n] = loadScript(`data/strokes/s${String(n).padStart(2, '0')}.js`).catch(e => { delete shardLoads[n]; throw e; });
    }
    return shardLoads[n];
  }
  const ensureChars = chars => Promise.all([...new Set(chars.map(shardOf))].map(loadShard));
  const charLoader = (ch, done, fail) => {
    const got = () => (window.STROKES && window.STROKES[ch] ? done(window.STROKES[ch]) : fail && fail(new Error('no data')));
    if (window.STROKES && window.STROKES[ch]) got(); else loadShard(shardOf(ch)).then(got, () => fail && fail(new Error('load failed')));
  };
  const GRID = `<svg class="grid" viewBox="0 0 100 100" aria-hidden="true"><path d="M0 0L100 100M100 0L0 100M50 0V100M0 50H100" /></svg>`;

  let writers = [];
  function destroyWriters() {
    writers.forEach(w => { try { w.cancelQuiz(); } catch (e) { /* ignore */ } });
    writers = [];
  }
  function boardSize() { return Math.min(350, Math.max(240, Math.floor(window.innerWidth - 40))); }
  function makeWriter(el, ch, opts) {
    const size = opts.size || boardSize();
    el.style.width = el.style.height = size + 'px';
    const w = HanziWriter.create(el, ch, Object.assign({
      width: size, height: size, padding: 12,
      charDataLoader: charLoader,
      strokeColor: '#1e293b', radicalColor: '#ef4444', highlightColor: '#10b981',
      outlineColor: '#e2e8f0', drawingColor: '#334155', drawingWidth: 22,
      strokeAnimationSpeed: 1.2, delayBetweenStrokes: 220,
    }, opts));
    writers.push(w);
    return w;
  }

  // ----- công tắc "Tự viết": ẩn nét mờ + tắt gợi ý nét khi viết sai (lưu lại cho lần sau)
  const freeWrite = () => !!S.freeWrite;
  const freeToggle = () => `
    <label class="switch-row"><span>✍️ Tự viết <small>(ẩn nét mờ &amp; gợi ý)</small></span>
      <input type="checkbox" class="free-toggle" ${freeWrite() ? 'checked' : ''}><i class="switch"></i></label>`;
  function bindFreeToggle(root, onChange) {
    const cb = root.querySelector('.free-toggle');
    if (cb) cb.onchange = () => { S.freeWrite = cb.checked; save(); onChange(); };
  }

  // ----- quiz viết: nhìn nghĩa + pinyin → viết lần lượt từng chữ
  function renderWrite(header) {
    const q = quiz, w = q.items[q.i].w;
    const chars = [...w.w].filter(c => HAN.test(c));
    q.wstate = { chars, ci: 0, mistakes: 0, hinted: 0 };
    app.innerHTML = header + `
      <div class="quiz">
        <div class="card prompt">
          <div class="sub" style="font-size:18px;color:var(--ink);font-weight:800">${esc(w.vi)}</div>
          <div class="sub" id="w-py">${q.used.py ? esc(w.py) : '&nbsp;'}</div>
          <div class="hints">
            <button class="hint nghe" data-act="whint" data-h="py">🔤 Pinyin${q.used.py ? '' : ` (−${PTS.hint}Đ)`}</button>
            <button class="hint nghe" data-act="whint" data-h="nghe">🔊 Nghe${q.used.nghe ? '' : ` (−${PTS.hint}Đ)`}</button>
            <button class="hint hv" data-act="whint" data-h="mau">👁 Xem mẫu (−${PTS.hint}Đ)</button>
          </div>
          <div class="reveal"><div class="zh" id="w-ex">${q.used.ex ? highlight(w.ex, w.w) : ''}</div></div>
        </div>
        <div class="card board-wrap">
          <div class="slots" id="w-slots">${chars.map((c, k) => `<span class="slot${k === 0 ? ' cur' : ''}">${k === 0 ? '✍️' : '·'}</span>`).join('')}</div>
          <div class="board" id="w-board">${GRID}<div id="w-target"></div></div>
          <div class="board-note" id="w-note">${writeNote(1, chars.length)}</div>
          ${freeToggle()}
        </div>
        <div class="card answer" id="w-answer" hidden></div>
        <div class="quiz-foot" id="w-foot"><button class="skip" data-act="skip">⏩ Bỏ qua (−${PTS.skip}Đ)</button></div>
      </div>`;
    if (!chars.length) { answer(null, true); return; }
    bindFreeToggle(app, () => {
      const note = document.getElementById('w-note');
      if (note) note.textContent = writeNote(q.wstate.ci + 1, chars.length);
      if (!q.answered) startChar();   // viết lại chữ hiện tại với chế độ mới
    });
    startChar();
  }
  const writeNote = (k, n) => `Viết chữ thứ ${k}/${n}` + (freeWrite() ? '' : ' — sai 3 lần sẽ hiện gợi ý nét');

  function startChar() {
    const q = quiz, ws = q.wstate;
    destroyWriters();
    const target = document.getElementById('w-target');
    if (!target) return;
    target.innerHTML = '';
    const ch = ws.chars[ws.ci];
    const wr = makeWriter(target, ch, { showCharacter: false, showOutline: false });
    let charMiss = 0;
    wr.quiz({
      showHintAfterMisses: freeWrite() ? false : 3,
      leniency: 1.15,
      onMistake: () => { charMiss++; ws.mistakes++; },
      onComplete: () => {
        const slots = document.querySelectorAll('#w-slots .slot');
        if (slots[ws.ci]) { slots[ws.ci].textContent = ch; slots[ws.ci].className = 'slot ' + (charMiss >= 3 ? 'meh' : 'ok'); }
        ws.ci++;
        if (ws.ci < ws.chars.length) {
          if (slots[ws.ci]) { slots[ws.ci].classList.add('cur'); slots[ws.ci].textContent = '✍️'; }
          const note = document.getElementById('w-note');
          if (note) note.textContent = writeNote(ws.ci + 1, ws.chars.length);
          setTimeout(() => { if (quiz === q && !q.answered) startChar(); }, 450);
        } else {
          // đạt nếu trung bình không quá 2 lỗi / chữ và không phải dùng "xem mẫu"
          const ok = ws.mistakes <= ws.chars.length * 2 && !ws.hinted;
          setTimeout(() => { if (quiz === q && !q.answered) answer(ok ? q.items[q.i].w.id : '__miss__'); }, 350);
        }
      },
    });
  }

  function writeHint(h) {
    const q = quiz; if (!q || q.answered) return;
    const w = q.items[q.i].w;
    if (h === 'py' && !q.used.py) {
      q.used.py = true; addScore(-PTS.hint); q.gained -= PTS.hint;
      document.getElementById('w-py').textContent = w.py;
    } else if (h === 'nghe') {
      if (!q.used.nghe) { q.used.nghe = true; addScore(-PTS.hint); q.gained -= PTS.hint; }
      speak(w.w);
    } else if (h === 'mau') {
      addScore(-PTS.hint); q.gained -= PTS.hint; q.wstate.hinted++;
      const wr = writers[0];
      if (wr) wr.showOutline();
    }
    save();
    const btns = app.querySelectorAll('[data-act=whint]');
    btns.forEach(b => {
      const k = b.dataset.h;
      if (k === 'py') { b.textContent = '🔤 Pinyin'; b.disabled = !!q.used.py; }
      if (k === 'nghe' && q.used.nghe) b.textContent = '🔊 Nghe';
    });
    const pill = app.querySelector('.topbar .pill .val'); if (pill) pill.textContent = fmt(S.score);
  }

  function renderWriteResult() {
    const q = quiz, w = q.items[q.i].w, ans = q.answered;
    destroyWriters();
    // hiện chữ hoàn chỉnh + hoạt ảnh thứ tự nét ở bảng
    const target = document.getElementById('w-target');
    const ws = q.wstate;
    if (target && ws && ws.chars.length) {
      target.innerHTML = '';
      const ch = ws.chars[Math.min(ws.ci, ws.chars.length) - 1] || ws.chars[0];
      const wr = makeWriter(target, ch, { showCharacter: !ans.skipped, showOutline: true });
      if (ans.skipped) loopAnimate(wr, ws.chars, 0);
    }
    document.getElementById('w-slots').innerHTML = [...w.w].map(c => `<span class="slot ok">${esc(c)}</span>`).join('');
    document.getElementById('w-note').textContent = ans.ok ? `Lỗi: ${ws ? ws.mistakes : 0} nét` : (ans.skipped ? 'Xem thứ tự nét' : `Lỗi: ${ws ? ws.mistakes : 0} nét — từ này được đưa vào "Câu sai"`);
    app.querySelectorAll('[data-act=whint]').forEach(b => { b.disabled = true; });
    const sw = app.querySelector('.board-wrap .switch-row'); if (sw) sw.remove();
    const box = document.getElementById('w-answer');
    box.hidden = false;
    box.innerHTML = `
      <div class="verdict ${ans.ok ? 'ok' : 'no'}">${ans.ok ? `✓ Viết đúng! +${PTS.correct}Đ` : (ans.skipped ? `⏭ Đã bỏ qua (−${PTS.skip}Đ)` : '✗ Cần luyện thêm')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <span class="zh" style="font-size:26px;font-weight:900">${esc(w.w)}</span>
          <span class="p" style="margin-left:6px">${esc(w.py)}</span>
          <span style="color:var(--violet);font-weight:800;font-size:13px;margin-left:6px">[${esc(w.hv)}]</span>
        </div>
        <button class="icon-btn" data-act="speak" data-text="${esc(w.w)}" aria-label="Nghe">🔊</button>
      </div>
      <div class="z" style="margin-top:6px">${highlight(w.ex, w.w)}</div>
      ${w.exPy ? `<div class="p">${esc(w.exPy)}</div>` : ''}
      <div class="v">${esc(w.exVi)}</div>
      <button class="btn ghost" style="width:100%;margin-top:10px" data-act="strokes" data-id="${w.id}">✍️ Xem thứ tự nét</button>`;
    document.getElementById('w-foot').innerHTML =
      `<button class="btn green next" data-act="next">${q.i + 1 < q.items.length ? 'Câu tiếp →' : 'Xem kết quả'}</button>`;
    const pill = app.querySelector('.topbar .pill .val'); if (pill) pill.textContent = fmt(S.score);
    const acc = app.querySelector('.meta .acc'); if (acc) acc.textContent = `✓ ${q.right} · ✗ ${q.wrong}`;
  }

  function loopAnimate(wr, chars, k) {
    wr.animateCharacter({ onComplete: () => {
      if (!writers.includes(wr) || chars.length < 2) return;
      setTimeout(() => {
        if (!writers.includes(wr)) return;
        const n = (k + 1) % chars.length;
        wr.setCharacter(chars[n]).then(() => loopAnimate(wr, chars, n));
      }, 700);
    } });
  }

  // ----- bảng xem / tập viết cho một từ (mở từ danh sách)
  function openStrokeSheet(id) {
    const w = word(id);
    const chars = [...w.w].filter(c => HAN.test(c));
    if (!chars.length) { toast('Từ này không có chữ Hán để viết'); return; }
    let cur = 0, writer = null;
    const ov = openSheet(`
      <h3 style="display:flex;align-items:baseline;gap:8px">✍️ <span class="zh">${esc(w.w)}</span>
        <small style="color:var(--muted)">${esc(w.py)} · ${esc(w.vi)}</small></h3>
      ${chars.length > 1 ? `<div class="char-tabs">${chars.map((c, k) => `<button class="zh${k === 0 ? ' on' : ''}" data-c="${k}">${esc(c)}</button>`).join('')}</div>` : ''}
      <div class="board" style="margin:10px auto">${GRID}<div class="target"></div></div>
      <div class="board-note s-note">Đang tải…</div>
      ${freeToggle()}
      <div class="row3">
        <button class="btn ghost" data-x="anim">▶️ Xem nét</button>
        <button class="btn green" data-x="practice">✍️ Tập viết</button>
        <button class="btn ghost" data-x="speak">🔊 Nghe</button>
      </div>`, ov => {
      const target = ov.querySelector('.target');
      const note = ov.querySelector('.s-note');
      const close = () => { destroyWriters(); ov.remove(); };
      ov.addEventListener('click', e => { if (e.target === ov) destroyWriters(); }, true);
      const strokeCount = ch => (window.STROKES && window.STROKES[ch] ? window.STROKES[ch].strokes.length : '?');
      const show = () => {
        destroyWriters();
        target.innerHTML = '';
        writer = makeWriter(target, chars[cur], { size: Math.min(300, boardSize()), showOutline: true });
        note.textContent = `${chars[cur]} · ${strokeCount(chars[cur])} nét`;
        writer.animateCharacter();
      };
      loadWriter().then(() => ensureChars(chars)).then(show).catch(() => { note.textContent = 'Không tải được dữ liệu nét chữ'; });
      ov.querySelectorAll('.char-tabs button').forEach(b => b.onclick = () => {
        ov.querySelectorAll('.char-tabs button').forEach(x => x.classList.remove('on'));
        b.classList.add('on'); cur = +b.dataset.c; if (window.HanziWriter) show();
      });
      ov.querySelector('[data-x=anim]').onclick = () => { if (!writer) return; practicing = false; writer.cancelQuiz(); writer.showOutline(); writer.showCharacter(); writer.animateCharacter(); note.textContent = `${chars[cur]} · ${strokeCount(chars[cur])} nét`; };
      ov.querySelector('[data-x=speak]').onclick = () => speak(w.w);
      let practicing = false;
      const practice = () => {
        if (!writer) return;
        practicing = true;
        writer.cancelQuiz();
        writer.hideCharacter();
        if (freeWrite()) writer.hideOutline(); else writer.showOutline();
        let miss = 0;
        note.textContent = freeWrite() ? 'Tự viết — không có nét mờ' : 'Viết theo nét mờ — sai 3 lần sẽ hiện gợi ý';
        writer.quiz({
          showHintAfterMisses: freeWrite() ? false : 3,
          onMistake: () => { miss++; },
          onComplete: () => {
            practicing = false;
            writer.showOutline();
            note.textContent = miss ? `Xong! Lỗi ${miss} nét` : 'Hoàn hảo! Không lỗi nét nào 🎉';
          },
        });
      };
      ov.querySelector('[data-x=practice]').onclick = practice;
      bindFreeToggle(ov, () => { if (practicing) practice(); });
      void close;
    });
  }


  // ---------------------------------------------------------------- từ mỗi ngày
  // S.daily = { on, scope, today:{date,id,done}, reviews:[{id,due,learned,fails}], mastered:[{id,date}] }
  function dailyState() {
    if (!S.daily) S.daily = { on: true, scope: 'all', today: null, reviews: [], mastered: [] };
    return S.daily;
  }
  const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return todayKey(new Date(y, m - 1, d + n)); };
  const fmtDay = key => { const [, m, d] = key.split('-'); return `${d}/${m}`; };

  function pickDailyWord(excludeId) {
    const D = dailyState();
    const busy = new Set([...D.reviews.map(r => r.id), ...D.mastered.map(m => m.id), excludeId]);
    const lv = D.scope === 'all' ? LEVELS : LEVELS.filter(l => String(l) === String(D.scope));
    let pool = [];
    (lv.length ? lv : LEVELS).forEach(l => DATA[l].forEach(w => {
      if (!busy.has(w.id) && !(S.words[w.id] && S.words[w.id].k) && [...w.w].some(c => HAN.test(c))) pool.push(w.id);
    }));
    if (!pool.length) (lv.length ? lv : LEVELS).forEach(l => DATA[l].forEach(w => { if (!busy.has(w.id)) pool.push(w.id); }));
    return pool.length ? pick(pool) : null;
  }

  // ----- nhận dạng tên nét từ đường giữa (medians) của dữ liệu nét chữ (tương đối, theo hướng & chỗ gập)
  const STROKE_INFO = {
    'Chấm': ['点', 'chấm ngắn, đi chéo xuống'],
    'Ngang': ['横', 'kéo từ trái sang phải'],
    'Sổ': ['竖', 'kéo thẳng từ trên xuống'],
    'Phẩy': ['撇', 'kéo chéo từ trên phải xuống dưới trái'],
    'Mác': ['捺', 'kéo chéo từ trên trái xuống dưới phải, đuôi xoè'],
    'Hất': ['提', 'hất chéo từ dưới trái lên trên phải'],
    'Ngang gập': ['横折', 'ngang sang phải rồi gập xuống'],
    'Ngang móc': ['横钩', 'ngang sang phải rồi móc xuống'],
    'Ngang gập móc': ['横折钩', 'ngang sang phải, gập xuống rồi móc vào trong'],
    'Ngang phẩy': ['横撇', 'ngang sang phải rồi phẩy xuống trái'],
    'Sổ móc': ['竖钩', 'sổ thẳng xuống rồi móc lên trái'],
    'Sổ gập': ['竖折', 'sổ xuống rồi gập sang phải'],
    'Sổ hất': ['竖提', 'sổ xuống rồi hất lên phải'],
    'Sổ cong móc': ['竖弯钩', 'sổ xuống, cong sang phải rồi móc lên'],
    'Phẩy gập': ['撇折', 'phẩy xuống trái rồi gập hất sang phải'],
    'Phẩy chấm': ['撇点', 'phẩy xuống trái rồi chấm sang phải'],
    'Cong móc': ['弯钩', 'cong xuống rồi móc lên'],
    'Nét gập': ['折', 'nét có nhiều chỗ gập, theo hướng hoạt ảnh'],
  };
  function rdp(pts, eps) {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let idx = -1, dmax = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L;
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax <= eps) return [a, b];
    return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
  }
  function dir(a, b) {
    const g = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; // y xuống
    if (g > -30 && g <= 25) return 'H';
    if (g > 25 && g <= 65) return 'N';
    if (g > 65 && g <= 102) return 'S';
    if (g > 102 && g <= 172) return 'P';
    if (g > -75 && g <= -30) return 'T';
    return 'L'; // trái / lên (móc)
  }
  function strokeName(median) {
    let pts = median.map(([x, y]) => [x, 900 - y]);
    const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    let total = 0; for (let i = 1; i < pts.length; i++) total += len(pts[i - 1], pts[i]);
    const s = rdp(pts, Math.max(28, total * 0.09));
    // gộp các đoạn liền nhau đổi hướng < 45° (nét cong) thành một đoạn theo dây cung
    const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    const diff = (x, y) => { let d = Math.abs(x - y) % 360; return d > 180 ? 360 - d : d; };
    let runs = [[s[0], s[1]]];
    for (let i = 2; i < s.length; i++) {
      const r = runs[runs.length - 1];
      if (diff(ang(r[0], r[r.length - 1]), ang(s[i - 1], s[i])) < 45) r.push(s[i]); else runs.push([s[i - 1], s[i]]);
    }
    let segs = runs.map(r => { const a = r[0], b = r[r.length - 1]; return { k: dir(a, b), l: len(a, b) }; });
    while (segs.length > 1 && segs[0].l < total * 0.12) segs.shift();
    const seq = segs.map(x => x.k).join('');
    const last = segs[segs.length - 1];
    if (total < 190) return 'Chấm';
    const hook = segs.length > 1 && last.l < total * 0.28 && /[LT]/.test(last.k);
    const body = hook ? seq.slice(0, -1) : seq;
    const tail = hook ? last.k : '';
    const one = { H: 'Ngang', S: 'Sổ', P: 'Phẩy', N: 'Mác', T: 'Hất', L: 'Phẩy' };
    if (body.length === 1) {
      if (!hook) return one[body];
      if (body === 'H') return 'Ngang móc';
      if (body === 'S' || body === 'P') return tail === 'T' ? 'Sổ hất' : 'Sổ móc';
      if (body === 'N') return 'Cong móc';
      return one[body];
    }
    if (/^H[SP]$/.test(body)) return hook ? 'Ngang gập móc' : body === 'HP' ? 'Ngang phẩy' : 'Ngang gập';
    if (/^HS[HN]$/.test(body)) return hook ? 'Sổ cong móc' : 'Nét gập';
    if (/^HP[HN]?$/.test(body)) return 'Ngang phẩy';
    if (/^S[HN]$/.test(body)) return hook ? 'Sổ cong móc' : 'Sổ gập';
    if (/^ST$/.test(body)) return 'Sổ hất';
    if (/^P[HT]$/.test(body)) return 'Phẩy gập';
    if (/^PN$/.test(body)) return 'Phẩy chấm';
    if (/^[SPN]+$/.test(body)) return hook ? 'Cong móc' : one[body[0]];
    return 'Nét gập';
  }
  const strokeList = ch => (window.STROKES && window.STROKES[ch] ? window.STROKES[ch].medians.map(strokeName) : []);

  // ----- khớp nghĩa người dùng gõ với nghĩa trong dữ liệu (dễ dãi: chấp nhận 1 trong các nghĩa, không dấu, gần đúng)
  const normVi = s => s.toLowerCase().normalize('NFC').replace(/\([^)]*\)/g, ' ').replace(/[.,!?"'“”…:]/g, ' ').replace(/\s+/g, ' ').trim();
  function meaningMatches(input, vi) {
    const a = normVi(input);
    if (a.length < 1) return false;
    const senses = vi.split(/[;,/]/).map(normVi).filter(Boolean);
    const plain = s => stripTones(s);
    return senses.some(s => {
      if (a === s || plain(a) === plain(s)) return true;
      if (a.length >= 2 && (s.includes(a) && a.length >= Math.min(s.length, Math.max(2, s.length * 0.4)))) return true;
      if (s.length >= 2 && a.includes(s)) return true;
      const wa = new Set(a.split(' ')), ws = s.split(' ');
      const hit = ws.filter(x => wa.has(x)).length;
      return ws.length > 1 && hit / ws.length >= 0.5;
    });
  }

  // ----- khung popup toàn màn hình
  function openDaily(html, onMount) {
    closeDaily();
    const ov = document.createElement('div');
    ov.className = 'daily-overlay';
    ov.innerHTML = `<div class="daily" role="dialog">${html}</div>`;
    document.body.appendChild(ov);
    document.body.classList.add('no-scroll');
    onMount && onMount(ov);
    return ov;
  }
  function closeDaily() {
    const ov = document.querySelector('.daily-overlay');
    if (ov) { destroyWriters(); ov.remove(); document.body.classList.remove('no-scroll'); }
  }

  let dailyRunning = false;
  async function runDaily(force) {
    const D = dailyState();
    if ((!D.on && !force) || dailyRunning) return;
    dailyRunning = true;
    try {
      const today = todayKey();
      const due = D.reviews.filter(r => r.due <= today);
      if (due.length) { await reviewQueue(due); }
      if (!D.today || D.today.date !== today) {
        const id = pickDailyWord();
        if (!id) return;
        D.today = { date: today, id, done: false };
        save();
      }
      if (!D.today.done || force) await learnPopup(D.today.id);
    } catch (e) { /* bỏ qua */ } finally {
      dailyRunning = false;
      if (!location.hash.replace(/^#\/?/, '')) renderHome();
    }
  }

  // ----- bước 2–4: popup học từ mới
  function learnPopup(id) {
    return new Promise(resolve => {
      const w = word(id);
      const D = dailyState();
      const chars = [...w.w].filter(c => HAN.test(c));
      let cur = 0, writer = null, step = -1, stepping = false;
      const ov = openDaily(`
        <div class="d-head"><span class="chip violet">📅 Từ hôm nay · ${fmtDay(todayKey())}</span>
          <button class="icon-btn d-close" aria-label="Để sau">✕</button></div>
        <div class="d-word">
          <span class="zh d-big">${esc(w.w)}</span>
          <div><div class="d-py">${esc(w.py)} <span class="d-hv">[${esc(w.hv)}]</span> <span class="chip orange">${levelName(w.level)}</span></div>
          <div class="d-vi">${esc(w.vi)} <small>(${esc(w.pos)})</small></div></div>
          <button class="icon-btn d-say" aria-label="Nghe">🔊</button>
        </div>
        <div class="d-ex">
          <div class="z">${highlight(w.ex, w.w)}</div>
          ${w.exPy ? `<div class="p">${esc(w.exPy)}</div>` : ''}
          <div class="v">${esc(w.exVi)}</div>
        </div>
        ${chars.length > 1 ? `<div class="char-tabs">${chars.map((c, k) => `<button class="zh${k === 0 ? ' on' : ''}" data-c="${k}">${esc(c)}</button>`).join('')}</div>` : ''}
        <div class="board d-board">${GRID}<div class="d-target"></div></div>
        <div class="d-stepnote">Đang tải nét chữ…</div>
        <div class="d-strokes"></div>
        <div class="d-note">Tên nét do app tự nhận dạng, nét phức tạp có thể chưa chuẩn — hãy theo hoạt ảnh.</div>
        <div class="row3 d-row">
          <button class="btn ghost" data-d="all">▶️ Cả chữ</button>
          <button class="btn ghost" data-d="next">⏭ Nét tiếp</button>
          <button class="btn ghost" data-d="practice">✍️ Tập viết</button>
        </div>
        <button class="btn green d-done">✅ Done — Đã học từ này</button>
        <button class="d-link d-swap">🔄 Đổi từ khác</button>`, ov => {
        const target = ov.querySelector('.d-target');
        const note = ov.querySelector('.d-stepnote');
        const list = ov.querySelector('.d-strokes');
        const finish = done => { closeDaily(); resolve(done); };
        ov.querySelector('.d-close').onclick = () => finish(false);
        ov.querySelector('.d-say').onclick = () => speak(w.w);
        const renderStrokes = () => {
          const names = strokeList(chars[cur]);
          list.innerHTML = names.map((n, i) => `<span class="d-sk${i === step ? ' on' : ''}${i < step ? ' past' : ''}" data-i="${i}"><b>${i + 1}</b> ${n} <small class="zh">${STROKE_INFO[n] ? STROKE_INFO[n][0] : ''}</small></span>`).join('');
          return names;
        };
        const describe = () => {
          const names = renderStrokes();
          if (step < 0) { note.textContent = `${chars[cur]} · ${names.length} nét — bấm "Nét tiếp" để xem từng nét`; return; }
          const n = names[step], info = STROKE_INFO[n];
          note.innerHTML = `Nét <b>${step + 1}/${names.length}</b>: <b>${n}</b> ${info ? `(${info[0]}) — ${info[1]}` : ''}`;
        };
        const show = () => {
          destroyWriters(); target.innerHTML = '';
          writer = makeWriter(target, chars[cur], { size: Math.min(300, boardSize()), showOutline: true });
          step = -1; describe();
          writer.animateCharacter();
        };
        const nextStroke = () => {
          if (!writer || stepping) return;
          const total = strokeList(chars[cur]).length;
          if (step === -1 || step >= total - 1) { writer.cancelQuiz(); writer.hideCharacter(); writer.showOutline(); step = -1; }
          step++; describe(); stepping = true;
          writer.animateStroke(step, { onComplete: () => { stepping = false; } });
          setTimeout(() => { stepping = false; }, 1500);
        };
        loadWriter().then(() => ensureChars(chars)).then(show).catch(() => { note.textContent = 'Không tải được dữ liệu nét chữ'; });
        ov.querySelectorAll('.char-tabs button').forEach(b => b.onclick = () => {
          ov.querySelectorAll('.char-tabs button').forEach(x => x.classList.remove('on'));
          b.classList.add('on'); cur = +b.dataset.c; if (window.HanziWriter) show();
        });
        ov.querySelector('[data-d=all]').onclick = () => { if (!writer) return; writer.cancelQuiz(); writer.showOutline(); step = -1; describe(); writer.animateCharacter(); };
        ov.querySelector('[data-d=next]').onclick = nextStroke;
        ov.querySelector('[data-d=practice]').onclick = () => {
          if (!writer) return;
          writer.cancelQuiz(); writer.hideCharacter(); writer.showOutline(); step = -1; renderStrokes();
          let miss = 0;
          note.textContent = 'Viết theo nét mờ — sai 3 lần sẽ hiện gợi ý';
          writer.quiz({
            showHintAfterMisses: 3,
            onMistake: () => { miss++; },
            onCorrectStroke: d => { step = d.strokeNum; renderStrokes(); },
            onComplete: () => { step = -1; renderStrokes(); note.textContent = miss ? `Xong! Lỗi ${miss} nét` : 'Hoàn hảo! 🎉'; },
          });
        };
        ov.querySelector('.d-done').onclick = () => {
          const today = todayKey();
          D.today = { date: today, id, done: true };
          D.reviews = D.reviews.filter(r => r.id !== id);
          D.reviews.push({ id, due: addDays(today, 1), learned: today, fails: 0 });
          save();
          toast(`✅ Đã học ${w.w} — mai ôn lại nhé!`);
          finish(true);
        };
        ov.querySelector('.d-swap').onclick = () => {
          const nid = pickDailyWord(id);
          if (!nid) return;
          D.today = { date: todayKey(), id: nid, done: false }; save();
          closeDaily(); learnPopup(nid).then(resolve);
        };
      });
    });
  }

  // ----- bước 5–7: ôn từ đã học (tự nhập nghĩa + tự viết lại, không nét mẫu)
  async function reviewQueue(items) {
    for (let k = 0; k < items.length; k++) {
      const r = await reviewPopup(items[k], k, items.length);
      if (r === 'later') break;
    }
  }
  function reviewPopup(rev, k, n) {
    return new Promise(resolve => {
      const w = word(rev.id);
      const D = dailyState();
      const chars = [...w.w].filter(c => HAN.test(c));
      const MAX = 3;
      let tries = 0, meaningOk = false, writeOk = false, phase = 'meaning', answerText = '';
      const ov = openDaily(`
        <div class="d-head"><span class="chip orange">🔁 Ôn từ ngày ${fmtDay(rev.learned)}${n > 1 ? ` · ${k + 1}/${n}` : ''}</span>
          <button class="icon-btn d-close" aria-label="Để sau">✕</button></div>
        <div class="d-body"></div>`, ov => {
        const body = ov.querySelector('.d-body');
        const finish = v => { closeDaily(); resolve(v); };
        ov.querySelector('.d-close').onclick = () => finish('later');
        const tryChip = () => `<div class="d-try">Lần ${tries + 1}/${MAX}</div>`;

        const askMeaning = () => {
          phase = 'meaning';
          body.innerHTML = `
            ${tryChip()}
            <div class="zh d-big d-center">${esc(w.w)}</div>
            <label class="d-lbl">Nghĩa của từ này là gì?</label>
            <input class="d-input" type="text" placeholder="Gõ nghĩa tiếng Việt…" value="${esc(answerText)}" autocomplete="off">
            <button class="btn green d-go">Tiếp → viết lại chữ</button>`;
          const inp = body.querySelector('.d-input');
          const go = () => {
            answerText = inp.value.trim();
            if (!answerText) { toast('Hãy gõ nghĩa của từ'); return; }
            meaningOk = meaningMatches(answerText, w.vi);
            if (writeOk) judge(); else askWrite();
          };
          body.querySelector('.d-go').onclick = go;
          inp.onkeydown = e => { if (e.key === 'Enter') go(); };
          setTimeout(() => inp.focus(), 50);
        };

        const askWrite = () => {
          phase = 'write';
          let ci = 0, failed = false;
          body.innerHTML = `
            ${tryChip()}
            <div class="d-lbl d-center">Viết lại từ vừa rồi — không có nét mẫu</div>
            <div class="slots">${chars.map((c, i) => `<span class="slot${i === 0 ? ' cur' : ''}">${i === 0 ? '✍️' : '·'}</span>`).join('')}</div>
            <div class="board d-board">${GRID}<div class="d-target"></div></div>
            <div class="d-stepnote">Chữ 1/${chars.length} · sai 3 lần cùng một nét là tính chưa đúng</div>
            <button class="d-link d-giveup">Mình không nhớ chữ này</button>`;
          const target = body.querySelector('.d-target');
          const note = body.querySelector('.d-stepnote');
          const endWrite = ok => { writeOk = ok; destroyWriters(); judge(); };
          body.querySelector('.d-giveup').onclick = () => endWrite(false);
          const startChar = () => {
            destroyWriters(); target.innerHTML = '';
            const wr = makeWriter(target, chars[ci], { showCharacter: false, showOutline: false });
            wr.quiz({
              showHintAfterMisses: false,
              leniency: 1.15,
              onMistake: d => { if (!failed && d.mistakesOnStroke >= 3) { failed = true; setTimeout(() => endWrite(false), 300); } },
              onComplete: () => {
                if (failed) return;
                const slots = body.querySelectorAll('.slot');
                if (slots[ci]) { slots[ci].textContent = chars[ci]; slots[ci].className = 'slot ok'; }
                ci++;
                if (ci < chars.length) {
                  if (slots[ci]) { slots[ci].classList.add('cur'); slots[ci].textContent = '✍️'; }
                  note.textContent = `Chữ ${ci + 1}/${chars.length}`;
                  setTimeout(startChar, 400);
                } else setTimeout(() => endWrite(true), 400);
              },
            });
          };
          loadWriter().then(() => ensureChars(chars)).then(startChar).catch(() => endWrite(false));
        };

        const reveal = () => `
          <div class="d-word d-word-c">
            <span class="zh d-big">${esc(w.w)}</span>
            <div><div class="d-py">${esc(w.py)} <span class="d-hv">[${esc(w.hv)}]</span></div><div class="d-vi">${esc(w.vi)}</div></div>
          </div>
          <div class="d-ex"><div class="z">${highlight(w.ex, w.w)}</div>${w.exPy ? `<div class="p">${esc(w.exPy)}</div>` : ''}<div class="v">${esc(w.exVi)}</div></div>`;

        const master = () => {
          const today = todayKey();
          const s = st(rev.id);
          if (!s.k) { s.k = 1; day().known++; }
          if (!s.v) { s.v = 1; day().written = (day().written || 0) + 1; }
          delete s.wk; delete s.wv;
          addScore(PTS.correct);
          D.reviews = D.reviews.filter(r => r.id !== rev.id);
          D.mastered = D.mastered.filter(m => m.id !== rev.id);
          D.mastered.push({ id: rev.id, date: today });
          save();
        };

        const judge = () => {
          tries++;
          const mark = ok => `<span class="${ok ? 'c-green' : 'd-bad'}">${ok ? '✓' : '✗'}</span>`;
          if (meaningOk && writeOk) {
            master();
            speak(w.w);
            body.innerHTML = `
              <div class="d-result ok">🎉 Hoàn thành!</div>
              <div class="d-center d-sub">Từ <b class="zh">${esc(w.w)}</b> đã được lưu vào <b>từ đã học</b> (+${PTS.correct}Đ)</div>
              ${reveal()}
              <button class="btn green d-next">${k + 1 < n ? 'Ôn từ tiếp theo →' : 'Tiếp tục →'}</button>`;
            body.querySelector('.d-next').onclick = () => finish('ok');
            return;
          }
          if (tries < MAX) {
            body.innerHTML = `
              <div class="d-result no">Chưa đúng — thử lại nhé</div>
              <div class="d-check"><div>${mark(meaningOk)} Nghĩa</div><div>${mark(writeOk)} Viết chữ</div></div>
              <div class="d-center d-sub">Còn ${MAX - tries} lần. ${meaningOk ? 'Nghĩa đã đúng, chỉ cần viết lại chữ.' : writeOk ? 'Chữ đã viết đúng, chỉ cần sửa lại nghĩa.' : 'Làm lại cả nghĩa và chữ.'}</div>
              <button class="btn rose d-retry">✍️ Viết lại (lần ${tries + 1}/${MAX})</button>`;
            body.querySelector('.d-retry').onclick = () => {
              if (!meaningOk) { if (!writeOk) answerText = ''; askMeaning(); } else askWrite();
            };
            return;
          }
          // lần 3 vẫn sai → bỏ qua, hẹn ôn lại hôm sau
          const tomorrow = addDays(todayKey(), 1);
          rev.due = tomorrow; rev.fails = (rev.fails || 0) + 1;
          const t = D.reviews.find(r => r.id === rev.id); if (t) { t.due = tomorrow; t.fails = rev.fails; }
          const s = st(rev.id); s.wv = 1; save();
          body.innerHTML = `
            <div class="d-result no">Hẹn mai viết lại nhé 💪</div>
            <div class="d-check"><div>${mark(meaningOk)} Nghĩa${meaningOk ? '' : ` <small>(bạn gõ: “${esc(answerText)}”)</small>`}</div><div>${mark(writeOk)} Viết chữ</div></div>
            ${reveal()}
            <div class="board d-board">${GRID}<div class="d-target"></div></div>
            ${!meaningOk && writeOk ? `<button class="d-link d-override">Nghĩa mình gõ cũng đúng → tính là đã thuộc</button>` : ''}
            <button class="btn green d-next">${k + 1 < n ? 'Ôn từ tiếp theo →' : 'Tiếp tục →'}</button>`;
          const tg = body.querySelector('.d-target');
          loadWriter().then(() => ensureChars(chars)).then(() => {
            const wr = makeWriter(tg, chars[0], { size: Math.min(240, boardSize()), showOutline: true });
            loopAnimate(wr, chars, 0);
          }).catch(() => {});
          body.querySelector('.d-next').onclick = () => finish('fail');
          const ovr = body.querySelector('.d-override');
          if (ovr) ovr.onclick = () => { master(); toast(`🎉 Đã lưu ${w.w} vào từ đã học`); finish('ok'); };
        };

        askMeaning();
      });
    });
  }

  // ----- thẻ trên trang chủ
  function dailyCard() {
    const D = dailyState();
    if (!D.on) return '';
    const today = todayKey();
    const due = D.reviews.filter(r => r.due <= today).length;
    const t = D.today && D.today.date === today ? D.today : null;
    const w = t ? word(t.id) : null;
    return `
      <button class="card daily-card" data-act="daily">
        <div class="dc-left">
          <div class="dc-title">📅 Từ hôm nay</div>
          ${w ? `<div class="dc-word"><span class="zh">${esc(w.w)}</span> <small>${t.done ? esc(w.py) + ' · ' + esc(w.vi) : 'chưa học'}</small></div>` : '<div class="dc-word"><small>Bấm để nhận từ mới</small></div>'}
          <div class="dc-meta">✅ Đã thuộc ${D.mastered.length} · 🔁 Chờ ôn ${D.reviews.length}${due ? ` <b class="c-rose">(${due} hôm nay)</b>` : ''}</div>
        </div>
        <span class="dc-status ${t && t.done && !due ? 'ok' : ''}">${t && t.done && !due ? '✓' : '▶'}</span>
      </button>`;
  }

  // ---------------------------------------------------------------- sheets
  function openSheet(html, onMount) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    onMount && onMount(ov);
    return ov;
  }

  function editWord(id) {
    const w = word(id);
    const ov = openSheet(`
      <h3><span class="zh">${esc(w.w)}</span> <small style="color:var(--muted)">${esc(w.py)}</small></h3>
      <label>Hán Việt</label><input name="hv" value="${esc(w.hv)}">
      <label>Nghĩa tiếng Việt</label><input name="vi" value="${esc(w.vi)}">
      <label>Câu ví dụ (phải chứa "${esc(w.w)}")</label><textarea name="ex" class="zh">${esc(w.ex)}</textarea>
      <label>Dịch câu ví dụ</label><textarea name="exVi">${esc(w.exVi)}</textarea>
      <div class="note">Sửa được lưu trên máy này. Nếu đổi câu ví dụ, pinyin của câu sẽ bị ẩn.</div>
      <div class="row2">
        <button class="btn ghost" data-x="reset">Khôi phục gốc</button>
        <button class="btn green" data-x="save">Lưu</button>
      </div>`, ov => {
      ov.querySelector('[data-x=save]').onclick = () => {
        const v = n => ov.querySelector(`[name=${n}]`).value.trim();
        const ex = v('ex');
        if (!ex.includes(w.w)) { toast(`Câu ví dụ phải chứa "${w.w}"`); return; }
        const base = byId[id];
        const ed = { hv: v('hv') || base.hv, vi: v('vi') || base.vi, ex, exVi: v('exVi') };
        if (ex !== base.ex) ed.exPy = '';
        S.edits[id] = ed; save(); ov.remove(); toast('Đã lưu'); route();
      };
      ov.querySelector('[data-x=reset]').onclick = () => {
        delete S.edits[id]; save(); ov.remove(); toast('Đã khôi phục'); route();
      };
    });
    return ov;
  }

  function openMenu() {
    openSheet(`
      <h3>⚙️ Cài đặt</h3>
      <label class="switch-row d-set"><span>📅 Từ mỗi ngày <small>(hiện khi mở app)</small></span>
        <input type="checkbox" class="daily-on" ${dailyState().on ? 'checked' : ''}><i class="switch"></i></label>
      <div class="d-scope"><span>Lấy từ trong</span>
        <select class="daily-scope">
          <option value="all">Tất cả các list</option>
          ${LEVELS.map(l => `<option value="${l}" ${String(dailyState().scope) === String(l) ? 'selected' : ''}>${levelName(l)}</option>`).join('')}
        </select></div>
      <div class="menu">
        <button class="btn ghost" data-x="export">⬇️ Sao lưu tiến độ (.json)</button>
        <button class="btn ghost" data-x="import">⬆️ Khôi phục từ file sao lưu</button>
        <button class="btn ghost" data-x="test">🔊 Thử giọng đọc</button>
        <button class="btn rose" data-x="reset">🗑️ Xoá toàn bộ tiến độ</button>
      </div>
      <div class="note">Tiến độ được lưu trong trình duyệt này. Sao lưu định kỳ nếu bạn hay xoá dữ liệu trình duyệt.</div>
      <input type="file" accept="application/json" hidden>`, ov => {
      const file = ov.querySelector('input[type=file]');
      ov.querySelector('.daily-on').onchange = e => { dailyState().on = e.target.checked; save(); route(); };
      ov.querySelector('.daily-scope').onchange = e => {
        const D = dailyState(); D.scope = e.target.value;
        if (D.today && !D.today.done) D.today = null;     // đổi phạm vi → chọn lại từ hôm nay nếu chưa học
        save(); route();
      };
      ov.querySelector('[data-x=export]').onclick = () => {
        const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `hanzi-backup-${todayKey()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };
      ov.querySelector('[data-x=import]').onclick = () => file.click();
      file.onchange = async () => {
        try {
          const obj = JSON.parse(await file.files[0].text());
          if (!obj || typeof obj.words !== 'object') throw new Error('bad');
          S = Object.assign(blank(), obj); save(); ov.remove(); toast('Đã khôi phục tiến độ'); route();
        } catch (e) { toast('File sao lưu không hợp lệ'); }
      };
      ov.querySelector('[data-x=test]').onclick = () => speak('你好，我们一起学习汉语吧！');
      ov.querySelector('[data-x=reset]').onclick = () => {
        if (confirm('Xoá toàn bộ tiến độ, điểm và các chỉnh sửa? Không thể hoàn tác.')) {
          S = blank(); save(); ov.remove(); toast('Đã xoá tiến độ'); route();
        }
      };
    });
  }

  // ---------------------------------------------------------------- events
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const lvl = +(app.dataset.level || 0);
    switch (act) {
      case 'open': listQuery = ''; location.hash = `#/hsk${b.dataset.level}`; break;
      case 'home': location.hash = '#/'; break;
      case 'menu': openMenu(); break;
      case 'mode': S.mode[lvl] = b.dataset.mode; save(); renderLevel(lvl); break;
      case 'speak': speak(b.dataset.text); break;
      case 'edit': editWord(b.dataset.id); break;
      case 'start': startQuiz(lvl, b.dataset.kind); break;
      case 'hint': useHint(b.dataset.h); break;
      case 'answer': answer(b.dataset.id); break;
      case 'skip': answer(null, true); break;
      case 'next': nextQuestion(); break;
      case 'quit': case 'back': destroyWriters(); location.hash = `#/hsk${quiz ? quiz.level : lvl}`; break;
      case 'again': { const l = quiz.level; quiz = null; startQuiz(l, b.dataset.kind); if (quiz && quiz.mode !== 'write') renderQuiz(); break; }
      case 'strokes': openStrokeSheet(b.dataset.id); break;
      case 'whint': writeHint(b.dataset.h); break;
      case 'daily': runDaily(true); break;
    }
  });

  document.addEventListener('keydown', e => {
    if (!quiz || quiz.countdown > 0 || e.target.matches('input, textarea')) return;
    const k = e.key.toUpperCase();
    if (quiz.mode === 'write') {
      if (quiz.answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextQuestion(); }
      return;
    }
    if (!quiz.answered && 'ABCD1234'.includes(k) && k) {
      const idx = 'ABCD'.includes(k) ? 'ABCD'.indexOf(k) : +k - 1;
      const opt = quiz.items[quiz.i]?.options[idx];
      if (opt) answer(opt.id);
    } else if (quiz.answered && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      nextQuestion();
    }
  });

  // ---------------------------------------------------------------- boot
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (!LEVELS.length) {
    app.innerHTML = '<div class="empty">Không tải được dữ liệu từ vựng (thư mục data/).</div>';
    return;
  }
  route();
  // Từ mỗi ngày: hiện khi mở app, và khi quay lại app sang ngày mới
  let lastDay = todayKey();
  setTimeout(() => runDaily(), 300);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && todayKey() !== lastDay) { lastDay = todayKey(); runDaily(); }
  });
})();
