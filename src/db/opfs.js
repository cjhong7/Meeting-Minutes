/**
 * db/opfs.js — OPFS(Origin Private File System) 대용량 파일 저장
 *
 * 대상 (Stage 5에서 본격 사용):
 *  - 녹음 MP3 세그먼트 (10분 단위)
 *  - 펜 필기 PNG
 *  - 계획서 원본 파일
 *
 * OPFS는 Chrome 102+, Edge 102+, Firefox 111+, Safari 15.2+에서 지원.
 * 미지원 브라우저에서는 에러 메시지를 띄움.
 *
 * 파일 구조: /{meetingId}/{filename}
 */

/**
 * OPFS 지원 여부 확인
 * @returns {boolean}
 */
export function isOpfsSupported() {
  return 'storage' in navigator && 'getDirectory' in navigator.storage;
}

/**
 * 파일 쓰기
 * @param {string} meetingId   회의 ID
 * @param {string} filename    파일명 (예: 'recording-001.mp3')
 * @param {ArrayBuffer|Uint8Array} buffer  파일 데이터
 */
export async function writeFile(meetingId, filename, buffer) {
  if (!isOpfsSupported()) {
    throw new Error('이 브라우저는 파일 저장(OPFS)을 지원하지 않습니다.');
  }

  const root = await navigator.storage.getDirectory();
  const meetingDir = await root.getDirectoryHandle(meetingId, { create: true });
  const fileHandle = await meetingDir.getFileHandle(filename, { create: true });

  const writable = await fileHandle.createWritable();
  await writable.write(buffer);
  await writable.close();
}

/**
 * 파일 읽기
 * @param {string} meetingId
 * @param {string} filename
 * @returns {Promise<ArrayBuffer>}
 */
export async function readFile(meetingId, filename) {
  if (!isOpfsSupported()) {
    throw new Error('이 브라우저는 파일 읽기(OPFS)를 지원하지 않습니다.');
  }

  const root = await navigator.storage.getDirectory();
  const meetingDir = await root.getDirectoryHandle(meetingId);
  const fileHandle = await meetingDir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return file.arrayBuffer();
}

/**
 * 파일 삭제
 * @param {string} meetingId
 * @param {string} filename
 */
export async function deleteFile(meetingId, filename) {
  if (!isOpfsSupported()) return;

  try {
    const root = await navigator.storage.getDirectory();
    const meetingDir = await root.getDirectoryHandle(meetingId);
    await meetingDir.removeEntry(filename);
  } catch {
    // 파일이 없으면 무시
  }
}

/**
 * 회의 폴더 전체 삭제
 * @param {string} meetingId
 */
export async function deleteFolder(meetingId) {
  if (!isOpfsSupported()) return;

  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(meetingId, { recursive: true });
  } catch {
    // 폴더가 없으면 무시
  }
}

/**
 * 회의 폴더 내 파일 목록
 * @param {string} meetingId
 * @returns {Promise<string[]>} 파일명 배열
 */
export async function listFiles(meetingId) {
  if (!isOpfsSupported()) return [];

  try {
    const root = await navigator.storage.getDirectory();
    const meetingDir = await root.getDirectoryHandle(meetingId);
    const names = [];
    for await (const [name] of meetingDir) {
      names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}
