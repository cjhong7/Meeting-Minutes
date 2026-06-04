/**
 * crypto/keystore.js — API 키 암호화 저장/복호화
 *
 *  - crypto.subtle + PBKDF2로 키 파생
 *  - AES-GCM으로 API 키 암호화
 *  - 암호화된 값만 IndexedDB에 저장 (평문 localStorage 금지)
 *  - 키 사용 방식:
 *    · 영구(persist): IndexedDB에 암호화 저장 → 재방문에도 유지
 *    · 세션(session): sessionStorage·메모리만 → 브라우저 닫으면 사라짐
 *
 * 저장 구조 (IndexedDB settings 스토어):
 *   key: 'apikey_{engine}'
 *   value: { iv, salt, cipher, hasPin }
 */

/* ── 세션 메모리: 복호화된 키를 세션 내에만 보관 ── */
const _decryptedCache = new Map();

/* ── 상수 ── */
const DB_NAME      = 'anti_conver_db';
const STORE_NAME   = 'settings';
const PBKDF2_ITER  = 100_000;
const KEY_PREFIX   = 'apikey_';

/* ============================================================
   공개 API
   ============================================================ */

/**
 * API 키를 AES-GCM 암호화하여 IndexedDB에 저장
 * @param {string} engine  'openai' | 'gemini' | 'claude'
 * @param {string} rawKey  평문 API 키
 * @param {string} [pin]   암호화 PIN (빈 문자열이면 고정 솔트로 암호화)
 */
export async function saveKey(engine, rawKey, pin = '') {
  if (!rawKey?.trim()) {
    await deleteKey(engine);
    return;
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));

  const cryptoKey = await deriveKey(pin, salt);
  const encoded   = new TextEncoder().encode(rawKey.trim());

  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded,
  );

  const record = {
    key:    KEY_PREFIX + engine,
    iv:     Array.from(iv),
    salt:   Array.from(salt),
    cipher: Array.from(new Uint8Array(cipher)),
    hasPin: !!pin,
  };

  await putSetting(record);

  // 세션 캐시에도 저장
  _decryptedCache.set(engine, rawKey.trim());

  // sessionStorage 임시 저장도 유지 (router.js 호환)
  sessionStorage.setItem(`anti_key_${engine}`, rawKey.trim());
}

/**
 * IndexedDB에서 암호화된 키를 복호화하여 반환
 * @param {string} engine  'openai' | 'gemini' | 'claude'
 * @param {string} [pin]   복호화 PIN
 * @returns {Promise<string>} 평문 API 키 (없으면 빈 문자열)
 */
export async function loadKey(engine, pin = '') {
  // 1. 세션 캐시 확인
  if (_decryptedCache.has(engine)) {
    return _decryptedCache.get(engine);
  }

  // 2. IndexedDB에서 읽기
  const record = await getSetting(KEY_PREFIX + engine);
  if (!record) return '';

  try {
    const salt = new Uint8Array(record.salt);
    const iv   = new Uint8Array(record.iv);
    const cipher = new Uint8Array(record.cipher).buffer;

    const cryptoKey = await deriveKey(pin, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      cipher,
    );

    const rawKey = new TextDecoder().decode(decrypted);

    // 세션 캐시 + sessionStorage에 보관
    _decryptedCache.set(engine, rawKey);
    sessionStorage.setItem(`anti_key_${engine}`, rawKey);

    return rawKey;
  } catch {
    // PIN 불일치 또는 데이터 손상
    throw new Error(
      'API 키 복호화에 실패했습니다.\nPIN이 올바른지 확인해 주세요.'
    );
  }
}

/**
 * 저장된 키 삭제
 * @param {string} engine
 */
export async function deleteKey(engine) {
  await deleteSetting(KEY_PREFIX + engine);
  _decryptedCache.delete(engine);
  sessionStorage.removeItem(`anti_key_${engine}`);
}

/**
 * 세션 전용 저장 — 영구 저장(IndexedDB)은 하지 않고
 * 현재 세션(메모리 + sessionStorage)에서만 키를 사용.
 * 브라우저(탭)를 닫으면 사라짐.
 * @param {string} engine
 * @param {string} rawKey
 */
export async function saveKeySessionOnly(engine, rawKey) {
  const k = (rawKey || '').trim();
  if (!k) { await deleteKey(engine); return; }
  // 영구 저장분 제거 (디스크에 남기지 않음)
  await deleteSetting(KEY_PREFIX + engine);
  // 세션·메모리에만 보관
  _decryptedCache.set(engine, k);
  sessionStorage.setItem(`anti_key_${engine}`, k);
}

/**
 * 해당 엔진의 키가 영구 저장(IndexedDB)되어 있는지 확인
 * (세션 전용 키는 false)
 * @param {string} engine
 * @returns {Promise<boolean>}
 */
export async function isPersisted(engine) {
  const record = await getSetting(KEY_PREFIX + engine);
  return !!record;
}

/**
 * 해당 엔진의 키가 저장되어 있는지 확인
 * @param {string} engine
 * @returns {Promise<boolean>}
 */
export async function hasKey(engine) {
  if (_decryptedCache.has(engine)) return true;
  const record = await getSetting(KEY_PREFIX + engine);
  return !!record;
}

/**
 * 해당 엔진의 키가 PIN으로 보호되어 있는지 확인
 * @param {string} engine
 * @returns {Promise<boolean>}
 */
export async function needsPin(engine) {
  const record = await getSetting(KEY_PREFIX + engine);
  return record?.hasPin === true;
}

/**
 * 세션 캐시 초기화 (페이지 언로드 시)
 */
export function clearSessionCache() {
  _decryptedCache.clear();
  ['openai', 'gemini', 'claude'].forEach(e => {
    sessionStorage.removeItem(`anti_key_${e}`);
  });
}

/* ============================================================
   내부: PBKDF2 + AES-GCM
   ============================================================ */

/**
 * PIN(또는 빈 문자열)로부터 AES-GCM 키를 파생
 */
async function deriveKey(pin, salt) {
  // PIN이 없으면 고정 패스프레이즈 사용 (암호화는 하되 PIN 없이도 접근 가능)
  const passphrase = pin || 'anti-conver-default-passphrase-v1';
  const encoded = new TextEncoder().encode(passphrase);

  const baseKey = await crypto.subtle.importKey(
    'raw', encoded, 'PBKDF2', false, ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/* ============================================================
   내부: IndexedDB settings 스토어 헬퍼
   ============================================================ */

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('meetings')) {
        const store = db.createObjectStore('meetings', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function putSetting(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function getSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function deleteSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
