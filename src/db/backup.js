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
