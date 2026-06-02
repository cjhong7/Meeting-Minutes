/**
 * db/backup.js — 로컬 폴더 / 클라우드 동기화 폴더 백업
 *
 * 계획서 Ⅶ-4,5:
 *  - File System Access API (Chrome/Edge): 폴더 선택 → 직접 쓰기
 *  - 미지원 (Firefox/Safari): 일반 다운로드 폴백
 *  - 형식: 회의 1건 = JSON(메타+협의록)
 *  - 클라우드: OAuth 없이 PC 동기화 폴더에 저장
 */

import { showToast } from '../ui/toast.js';

/**
 * File System Access API 지원 여부
 */
export function isFileSystemAccessSupported() {
  return 'showDirectoryPicker' in window;
}

/* ============================================================
   보관함 폴더 지정 (저장 위치 기억)
   ============================================================ */

let _dirHandle = null;  // 세션 메모리 캐시

const HANDLE_DB    = 'anti_conver_db';
const HANDLE_STORE = 'settings';
const HANDLE_KEY   = 'archive_dir_handle';

/**
 * 협의록을 저장할 폴더를 지정하고 기억 (다음 실행에도 유지)
 * @returns {Promise<string|null>} 지정된 폴더 이름 (취소 시 null)
 */
export async function chooseArchiveFolder() {
  if (!('showDirectoryPicker' in window)) {
    showToast('이 브라우저는 폴더 지정을 지원하지 않습니다. (Chrome·Edge 권장)', 'warn');
    return null;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    _dirHandle = handle;
    await saveDirHandle(handle);
    return handle.name;
  } catch (err) {
    if (err.name === 'AbortError') return null;
    showToast('폴더 지정 실패: ' + err.message, 'error');
    return null;
  }
}

/**
 * 지정된 폴더 핸들 반환 (권한 확인 포함). 없으면 null.
 */
export async function getArchiveFolder() {
  if (_dirHandle && await verifyPermission(_dirHandle)) return _dirHandle;

  const stored = await loadDirHandle();
  if (stored && await verifyPermission(stored)) {
    _dirHandle = stored;
    return stored;
  }
  return null;
}

/** 현재 지정된 폴더 이름 (없으면 null) — 권한 요청 없이 조회 */
export async function getArchiveFolderName() {
  if (_dirHandle) return _dirHandle.name;
  const stored = await loadDirHandle();
  return stored ? stored.name : null;
}

/**
 * 지정된 폴더에 파일(Blob) 저장
 * @returns {Promise<boolean>} 성공 여부
 */
export async function saveBlobToArchiveFolder(blob, fileName) {
  const dir = await getArchiveFolder();
  if (!dir) return false;
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable   = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return true;
}

/* ── 권한 확인 ── */
async function verifyPermission(handle) {
  const opts = { mode: 'readwrite' };
  try {
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
  } catch { /* 핸들 무효 */ }
  return false;
}

/* ── 디렉터리 핸들 IndexedDB 저장/로드 ── */
function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('meetings')) {
        const s = db.createObjectStore('meetings', { keyPath: 'id' });
        s.createIndex('date', 'date', { unique: false });
        s.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function saveDirHandle(handle) {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put({ key: HANDLE_KEY, handle });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => reject(tx.error);
  });
}

async function loadDirHandle() {
  const db = await openHandleDB();
  return new Promise((resolve) => {
    const tx  = db.transaction(HANDLE_STORE, 'readonly');
    const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
    req.onsuccess = () => { db.close(); resolve(req.result?.handle || null); };
    req.onerror   = () => { db.close(); resolve(null); };
  });
}

/**
 * 저장 위치를 지정하는 창을 열어 엑셀 파일을 저장
 * (showSaveFilePicker: 폴더 + 파일명 직접 지정)
 * @param {Blob} blob       엑셀 Blob
 * @param {string} fileName 기본 파일명
 */
export async function saveBlobToLocation(blob, fileName) {
  // File System Access API (Chrome/Edge): 저장 위치 지정 창
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: '엑셀 통합 문서',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      showToast('지정한 위치에 저장되었습니다.', 'success');
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false; // 사용자 취소
      console.warn('[Save] 위치 지정 실패, 다운로드로 폴백:', err);
    }
  }

  // 폴백: 일반 다운로드
  downloadBlob(blob, fileName);
  showToast('다운로드 폴더에 저장되었습니다.', 'success');
  return true;
}

/**
 * 회의 데이터를 폴더에 JSON으로 저장
 *
 * @param {Object} meeting  회의 데이터 (appState.meeting 형태)
 * @param {'local'|'drive'|'onedrive'} [target]  저장 대상 (UI 힌트용)
 */
export async function saveToFolder(meeting, target = 'local') {
  const title = meeting.title?.trim() || '회의록';
  const date  = meeting.date || '';
  const fileName = sanitizeFilename(`${title}_${date}.json`);

  // 저장할 데이터 (내부 플래그 제외)
  const data = { ...meeting };
  delete data.isGenerating;
  delete data.isDirty;

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json; charset=utf-8' });

  // File System Access API 지원 시 폴더 선택
  if (isFileSystemAccessSupported()) {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: target === 'drive' ? 'documents' : target === 'onedrive' ? 'documents' : 'desktop',
      });

      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable   = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      showToast(`"${fileName}" 저장 완료`, 'success');
      return;
    } catch (err) {
      // 사용자가 취소하면 AbortError
      if (err.name === 'AbortError') return;
      console.warn('[Backup] File System Access 실패, 다운로드로 폴백:', err);
    }
  }

  // 폴백: 일반 다운로드
  downloadBlob(blob, fileName);
  showToast(`"${fileName}" 다운로드 완료`, 'success');
}

/**
 * JSON 파일에서 회의 데이터 불러오기
 * @returns {Promise<Object|null>} 회의 데이터 또는 null(취소)
 */
export async function loadFromFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // 기본 검증
        if (!data.title && !data.minutes && !data.date) {
          showToast('올바른 협의록 파일이 아닙니다.', 'error');
          resolve(null);
          return;
        }

        resolve(data);
      } catch {
        showToast('파일 읽기에 실패했습니다.', 'error');
        resolve(null);
      }
    });

    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/* ============================================================
   내부 헬퍼
   ============================================================ */

/** 파일명에 사용할 수 없는 문자 제거 */
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'meeting.json';
}

/** Blob 다운로드 (폴백) */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Blob 다운로드 (외부 공개용 — 기본 다운로드 폴더에 저장) */
export function downloadBlobPublic(blob, filename) {
  downloadBlob(blob, filename);
}
