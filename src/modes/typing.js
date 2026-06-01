/**
 * modes/typing.js — 타자 모드 (MVP 핵심)
 *
 * 담당:
 *  - textarea 글자 수 실시간 표시
 *  - 5초 디바운스 자동 저장 (IndexedDB Stage 4에서 연결)
 *  - [협의안건] / [전달사항] 태그 삽입
 *  - 🎤 받아쓰기 (브라우저 SpeechRecognition, Stage 5에서 완성)
 *  - beforeunload 경고 등록/해제
 */

import { appState, setState } from '../state.js';
import { showToast } from '../ui/toast.js';

const MAX_CHARS_WARN = 20000; // 초과 시 비용 경고

let _autoSaveTimer    = null;
let _dictationActive  = false;
let _recognition      = null;

/* ============================================================
   초기화 (main.js에서 앱 부팅 시 1회 호출)
   ============================================================ */
export function initTypingMode() {
  const textarea = document.getElementById('typingText');
  if (!textarea) return;

  // 저장된 값 복원
  textarea.value = appState.meeting.typingText || '';
  updateCharCount(textarea.value.length);

  // 입력 이벤트
  textarea.addEventListener('input', onTypingInput);

  // 태그 삽입 버튼
  document.getElementById('btnTagAgenda')?.addEventListener('click', () =>
    insertTag(textarea, '[협의안건] ')
  );
  document.getElementById('btnTagNotice')?.addEventListener('click', () =>
    insertTag(textarea, '[전달사항] ')
  );

  // 받아쓰기 버튼
  document.getElementById('btnDictate')?.addEventListener('click', toggleDictation);
}

/* ============================================================
   입력 핸들러
   ============================================================ */
function onTypingInput(e) {
  const text = e.target.value;
  setState({ meeting: { typingText: text, isDirty: true } });
  updateCharCount(text.length);
  scheduleAutoSave();
}

/* ── 글자 수 표시 ── */
function updateCharCount(len) {
  const el = document.getElementById('typingCharCount');
  if (!el) return;
  el.textContent = `${len.toLocaleString()}자`;
  el.classList.toggle('warn', len > MAX_CHARS_WARN);
  if (len > MAX_CHARS_WARN) {
    document.getElementById('typingCharCount').title =
      '글자 수가 많아 AI 비용·시간이 증가할 수 있습니다.';
  }
}

/* ── 자동 저장 디바운스 ── */
function scheduleAutoSave() {
  clearTimeout(_autoSaveTimer);
  const statusEl = document.getElementById('typingAutoSave');
  if (statusEl) statusEl.textContent = '';

  _autoSaveTimer = setTimeout(async () => {
    // Stage 4에서 IndexedDB 연결. 지금은 메모리만.
    if (statusEl) {
      statusEl.textContent = '자동 저장됨';
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
    }
  }, 5000);
}

/* ── 태그 삽입 ── */
function insertTag(textarea, tag) {
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after  = textarea.value.slice(end);

  // 줄 시작에 삽입
  const needNewline = before.length > 0 && !before.endsWith('\n');
  const insert = (needNewline ? '\n' : '') + tag;

  textarea.value = before + insert + after;
  const cursor = before.length + insert.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.focus();

  // 상태 동기화
  setState({ meeting: { typingText: textarea.value, isDirty: true } });
  updateCharCount(textarea.value.length);
  scheduleAutoSave();
}

/* ============================================================
   받아쓰기 (브라우저 SpeechRecognition)
   Stage 0에서는 기본 동작만; 정책 정리는 Stage 5
   ============================================================ */
function toggleDictation() {
  const btn = document.getElementById('btnDictate');
  if (!btn) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast('이 브라우저는 음성 받아쓰기를 지원하지 않습니다.', 'warn');
    return;
  }

  if (_dictationActive) {
    stopDictation();
    return;
  }

  startDictation(SR, btn);
}

function startDictation(SR, btn) {
  _recognition = new SR();
  _recognition.lang = 'ko-KR';
  _recognition.continuous = true;
  _recognition.interimResults = true;

  const textarea = document.getElementById('typingText');
  let interimStart = textarea ? textarea.value.length : 0;

  _recognition.onstart = () => {
    _dictationActive = true;
    if (btn) {
      btn.textContent = '⏹ 받아쓰기 중지';
      btn.style.color = 'var(--red)';
    }
  };

  _recognition.onresult = e => {
    if (!textarea) return;
    let interim = '';
    let final   = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final  += e.results[i][0].transcript;
      else                       interim += e.results[i][0].transcript;
    }

    const base = textarea.value.slice(0, interimStart);
    textarea.value = base + final + interim;
    if (final) {
      interimStart = base.length + final.length;
      setState({ meeting: { typingText: textarea.value, isDirty: true } });
      updateCharCount(textarea.value.length);
    }
  };

  _recognition.onerror = e => {
    console.warn('[STT]', e.error);
    stopDictation();
  };

  _recognition.onend = () => {
    if (_dictationActive) {
      // 자동 재시작
      try { _recognition.start(); } catch { stopDictation(); }
    }
  };

  try {
    _recognition.start();
  } catch (err) {
    showToast('음성 인식을 시작할 수 없습니다.', 'error');
    _dictationActive = false;
  }
}

function stopDictation() {
  _dictationActive = false;
  try { _recognition?.stop(); } catch { /* ignore */ }
  _recognition = null;

  const btn = document.getElementById('btnDictate');
  if (btn) {
    btn.innerHTML = '🎤 받아쓰기';
    btn.style.color = '';
  }
}

/* ============================================================
   외부 공개 API
   ============================================================ */

/** 타자 모드 현재 텍스트 반환 */
export function getTypingText() {
  return appState.meeting.typingText || '';
}

/** 받아쓰기 강제 중지 (모드 전환 시 호출) */
export function stopDictationIfActive() {
  if (_dictationActive) stopDictation();
}
