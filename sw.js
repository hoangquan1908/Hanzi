// Service worker: cache toàn bộ app để dùng offline.
// Đổi CACHE khi cập nhật file để trình duyệt tải bản mới.
const CACHE = 'hanzi-v1.2.2';
const ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icon.svg', 'icon-192.png', 'icon-512.png',
  'data/hsk1.js', 'data/hsk2.js', 'data/hsk3.js', 'data/hsk4.js', 'data/hsk5.js', 'data/hsk6.js', 'data/hsk10.js',
  'vendor/hanzi-writer.min.js',
  // data/strokes/sNN.js được cache dần khi dùng tới (network-first bên dưới)
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first cho file của app (luôn lấy bản mới khi có mạng), fallback cache khi offline.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && (new URL(req.url).origin === location.origin || req.url.includes('fonts.g'))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
