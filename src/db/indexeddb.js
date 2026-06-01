/**
 * db/indexeddb.js — 회의 메타·협의록 텍스트 IndexedDB 저장소
 *
 * 스키마:
 *  DB명: anti_conver_db  버전: 1
 *  ObjectStore: meetings  keyPath: id  (nanoid)
 *    - title, date, time, place, agendas, attendeeCount, attendeeNames
 *    - mode, minutes, minutesType, createdAt, updatedAt
 *    - typingText, planExtractedText, voiceTranscript, penOcrText (입력 원본)
 *  ObjectStore: settings  keyPath: key
 *    - encrypted API keys, user preferences
 *
 * keystore.js와 DB를 공유 (동일 DB명, 동일 버전).
 */

const DB_NAME    = 'anti_conver_db';
const DB_VERSION = 1;
const STORE_NAME = 'meetings';

/* ── nanoid 경량 구현 (외부 라이브러리 없이) ── */
function nanoid(size = 21) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = '';
  for (let i = 0; i < size; i++) {
    id += alphabet[bytes[i] & 63];
  }
  return id;
}

/* ============================================================
   DB 열기
   ============================================================ */

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/* ============================================================
   공개 API — 회의록 CRUD
   ============================================================ */

/**
 * 회의를 저장 (새 회의면 id·createdAt 자동 부여)
 * @param {Object} meeting  appState.meeting 형태
 * @returns {Promise<Object>} 저장된 meeting (id 포함)
 */
export async function saveMeeting(meeting) {
  const now = new Date().toISOString();

  const record = { ...meeting };

  // 새 회의
  if (!record.id) {
    record.id = nanoid();
    record.createdAt = now;
  }
  record.updatedAt = now;

  // 내부 상태 플래그는 저장하지 않음
  delete record.isGenerating;
  delete record.isDirty;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.put(record);

    req.onsuccess = () => resolve(record);
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * ID로 회의 1건 로드
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function loadMeeting(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * 전체 회의 목록 (최신순 정렬)
 * @returns {Promise<Object[]>}
 */
export async function listMeetings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.getAll();

    req.onsuccess = () => {
      const list = req.result || [];
      // 최신순 정렬
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * 키워드로 회의 검색 (제목, 안건, 일시)
 * @param {string} keyword
 * @returns {Promise<Object[]>}
 */
export async function searchMeetings(keyword) {
  if (!keyword?.trim()) return listMeetings();

  const all = await listMeetings();
  const q   = keyword.toLowerCase().trim();

  return all.filter(m =>
    (m.title || '').toLowerCase().includes(q) ||
    (m.date  || '').includes(q) ||
    (m.agendas || []).some(a => (a || '').toLowerCase().includes(q)) ||
    (m.place || '').toLowerCase().includes(q)
  );
}

/**
 * 회의 1건 삭제
 * @param {string} id
 */
export async function deleteMeeting(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * 전체 회의 삭제 (초기화)
 */
export async function clearAllMeetings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.clear();

    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * 저장된 회의 수
 * @returns {Promise<number>}
 */
export async function countMeetings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.count();

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
