/**
 * preview.js — 2쪽 미리보기 실시간 업데이트
 *
 * appState.meeting의 메타 정보가 바뀔 때마다 호출됨.
 */

import { appState } from '../state.js';

/* 한국어 요일 */
const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

/* ============================================================
   전체 미리보기 갱신 (메타만)
   ============================================================ */
export function updatePreview() {
  updateTitle();
  updateDatetime();
  updatePlace();
  updateAgendas();
  // 참석자는 attendees.js의 updateAttendeePreview() 가 담당
}

/* ── 회의명 ── */
function updateTitle() {
  const el = document.getElementById('pvTitle');
  if (!el) return;
  const title = appState.meeting.title.trim();
  el.textContent = title || '';
  el.innerHTML = title
    ? escHtml(title)
    : '<span class="pv-placeholder">회의명을 입력하세요</span>';
}

/* ── 일시 ── */
function updateDatetime() {
  const el = document.getElementById('pvDate');
  if (!el) return;

  const { date, time } = appState.meeting;
  if (!date) {
    el.innerHTML = '<span class="pv-placeholder">날짜를 선택하세요</span>';
    return;
  }

  const [y, m, d] = date.split('-').map(Number);
  const dayOfWeek = KO_DAYS[new Date(y, m - 1, d).getDay()];
  let text = `${y}. ${m}. ${d}.(${dayOfWeek})`;
  if (time) text += ` ${time} ~`;

  el.textContent = text;
}

/* ── 장소 ── */
function updatePlace() {
  const el = document.getElementById('pvPlace');
  if (!el) return;
  const place = appState.meeting.place.trim();
  el.innerHTML = place
    ? escHtml(place)
    : '<span class="pv-placeholder">장소를 입력하세요</span>';
}

/* ── 안건 ── */
function updateAgendas() {
  const el = document.getElementById('pvAgendas');
  if (!el) return;
  const agendas = appState.meeting.agendas.filter(a => a.trim());
  if (!agendas.length) {
    el.innerHTML = '<span class="pv-placeholder">안건을 입력하세요</span>';
    return;
  }
  el.innerHTML = agendas
    .map((a, i) =>
      `<span class="agenda-pv-item">${i + 1}. ${escHtml(a)}</span>`
    )
    .join('\n');
}

/* ============================================================
   협의록 본문 표시 / 숨기기
   ============================================================ */

/** 생성된 협의록 본문을 2쪽에 표시 (화면: 단일 연속 스크롤, 페이지 구분선 없음) */
export function showMinutes(text) {
  const placeholder = document.getElementById('minutesPlaceholder');
  const content     = document.getElementById('minutesContent');
  if (!placeholder || !content) return;

  // 이전 렌더링에서 남은 추가 페이지 블록 제거 (방어적 정리)
  document.querySelectorAll('.extra-page').forEach(el => el.remove());

  placeholder.hidden = true;
  content.hidden = false;
  content.textContent = text;  // 전체 내용을 그대로 표시 (페이지 분할 없음)
}

/** 협의록 본문을 초기 플레이스홀더 상태로 되돌리기 */
export function clearMinutes() {
  const placeholder = document.getElementById('minutesPlaceholder');
  const content     = document.getElementById('minutesContent');
  if (!placeholder || !content) return;

  // 추가 페이지 블록 제거
  document.querySelectorAll('.extra-page').forEach(el => el.remove());

  placeholder.hidden = false;
  content.hidden = true;
  content.textContent = '';
}

/** 협의록 생성 중 스피너 표시 */
export function showGeneratingSpinner(show = true) {
  const paper = document.getElementById('paper');
  if (!paper) return;

  let overlay = paper.querySelector('.generating-overlay');
  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'generating-overlay';
      overlay.innerHTML = `
        <div class="spinner" aria-hidden="true"></div>
        <p class="generating-text">협의록 생성 중…</p>
      `;
      // paper는 relative여야 함 (CSS에서 처리)
      paper.style.position = 'relative';
      paper.appendChild(overlay);
    }
  } else {
    overlay?.remove();
    paper.style.position = '';
  }
}

/* ============================================================
   내부 헬퍼
   ============================================================ */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}
