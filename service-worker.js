/**
 * service-worker.js — PWA 오프라인 캐싱 (Stage 6 고도화)
 *
 * 전략:
 *  - 앱 셸(HTML/CSS/JS): Cache-First + 백그라운드 리밸리데이트
 *  - CDN 라이브러리: Cache-First (한번 받으면 오프라인 사용)
 *  - AI API 호출: Network-Only (캐시 안 함)
 *  - 네비게이션 실패 시: index.html 폴백 (SPA)
 *
 * 오프라인에서 동작하는 기능:
 *  - 타자 모드 입력
 *  - 펜 모드 필기
 *  - 로컬 시뮬레이션 (키 없음)
 *  - 보관함 열기/불러오기
 *  - 엑셀 다운로드 (ExcelJS 캐시 시)
 *
 * 온라인 필수 기능:
 *  - AI 협의록 생성 (OpenAI/Gemini/Claude)
 *  - Whisper STT
 *  - 펜 OCR
 */

const CACHE_NAME = 'anti-conver-v52';

/* 앱 셸 사전 캐시 목록 */
const SHELL_FILES = [
  './',
  './index.html',
  './styles/main.css',
  './styles/print.css',
  './src/main.js',
  './src/state.js',
  './src/ui/modal.js',
  './src/ui/toast.js',
  './src/ui/attendees.js',
  './src/ui/preview.js',
  './src/modes/typing.js',
  './src/modes/voice.js',
  './src/modes/plan.js',
  './src/modes/pen.js',
  './src/ai/simulator.js',
  './src/ai/router.js',
  './src/ai/prompt.js',
  './src/ai/postprocess.js',
  './src/ai/openai.js',
  './src/ai/gemini.js',
  './src/ai/claude.js',
  './src/crypto/keystore.js',
  './src/db/indexeddb.js',
  './src/db/opfs.js',
  './src/db/backup.js',
  './src/export/excel.js',
  './src/export/word.js',
  './src/export/print.js',
  './icons/icon.svg',
  './manifest.webmanifest',
];

/* ── install: 앱 셸 사전 캐시 ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] 캐시 실패:', err))
  );
});

/* ── activate: 오래된 캐시 제거 + 즉시 제어 ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── fetch 전략 ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1) AI API → Network-Only (캐시 안 함)
  if (
    url.hostname.includes('openai.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('anthropic.com')
  ) {
    return; // 브라우저 기본 처리
  }

  // 2) CDN 라이브러리 → Cache-First + 캐시에 저장
  if (url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => new Response('오프라인: 라이브러리 로드 실패', { status: 503 }))
    );
    return;
  }

  // 3) 앱 셸(HTML/CSS/JS) → Network-First
  //    온라인이면 항상 최신 코드, 오프라인이면 캐시 사용
  //    (캐시 누적으로 옛 버전이 계속 뜨던 문제 방지)
  event.respondWith(
    fetch(event.request).then(response => {
      // 성공한 GET 응답을 캐시에 갱신
      if (
        event.request.method === 'GET' &&
        response.status === 200 &&
        response.type !== 'opaque'
      ) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // 오프라인 → 캐시 폴백
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('오프라인', { status: 503 });
      });
    })
  );
});

/* ── 클라이언트에 메시지 전송 (업데이트 알림) ── */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
