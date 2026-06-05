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

/* ── 화면 페이지 분할 상수 ──
   Malgun Gothic 13px, line-height 1.75 기준 추정값.
   1페이지: 상단 헤더 테이블(제목·일시·참석자·안건)이 공간을 차지하므로 줄 수 감소.
   2페이지~: 전체 사용. */
const SCREEN_CHARS       = 50;   // 인쇄 기준 한 줄 글자 수 (텍스트 폭 507pt ÷ 10pt)
const SCREEN_FIRST_LINES = 40;   // 화면 1페이지 줄 수 (인쇄 32줄 × 화면 보정 1.25배)
const SCREEN_FULL_LINES  = 52;   // 화면 2페이지~ 줄 수 (인쇄 43줄 × 보정 1.2배)

/** 텍스트를 화면 페이지 단위로 분할 */
function splitIntoPages(text) {
  const rawLines = (text || '').split('\n');
  const measured = rawLines.map(ln => ({
    text: ln,
    vl: Math.max(1, Math.ceil(ln.length / SCREEN_CHARS)),
  }));

  const pages = [];
  let cur = [];
  let usedVl = 0;
  let isFirst = true;

  for (const line of measured) {
    const limit = isFirst ? SCREEN_FIRST_LINES : SCREEN_FULL_LINES;
    if (usedVl + line.vl > limit && cur.length > 0) {
      pages.push(cur.join('\n'));
      cur = [line.text];
      usedVl = line.vl;
      isFirst = false;
    } else {
      cur.push(line.text);
      usedVl += line.vl;
    }
  }
  if (cur.length > 0) pages.push(cur.join('\n'));
  return pages.length ? pages : [''];
}

/** HTML 특수문자 이스케이프 (개행 유지, <br> 미변환) */
function escRaw(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 생성된 협의록 본문을 2쪽에 표시 (다중 페이지는 별도 paper 블록으로 분리) */
export function showMinutes(text) {
  const placeholder   = document.getElementById('minutesPlaceholder');
  const content       = document.getElementById('minutesContent');
  const previewScroll = document.querySelector('.preview-scroll');
  if (!placeholder || !content) return;

  // 이전 렌더링에서 남은 추가 페이지 제거
  document.querySelectorAll('.extra-page').forEach(el => el.remove());

  placeholder.hidden = true;
  content.hidden = false;

  const pages = splitIntoPages(text);

  // 1페이지: 기존 minutesContent(#paper 안)에 표시
  content.textContent = pages[0];

  // 2페이지 이상: .preview-scroll 안에 별도 .paper 블록 추가
  if (pages.length > 1 && previewScroll) {
    pages.slice(1).forEach(pageText => {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'paper extra-page';
      const pre = document.createElement('pre');
      pre.className = 'minutes-content';
      pre.textContent = pageText;
      pageDiv.appendChild(pre);
      previewScroll.appendChild(pageDiv);
    });
  }
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
