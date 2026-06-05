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
const SCREEN_CHARS       = 44;   // 화면 1줄 기준 글자 수
const SCREEN_FIRST_LINES = 28;   // 1페이지 회의내용 최대 줄 수
const SCREEN_FULL_LINES  = 42;   // 2페이지 이상 최대 줄 수

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

/** 생성된 협의록 본문을 2쪽에 표시 (화면 페이지 구분선 포함) */
export function showMinutes(text) {
  const placeholder = document.getElementById('minutesPlaceholder');
  const content     = document.getElementById('minutesContent');
  if (!placeholder || !content) return;

  placeholder.hidden = true;
  content.hidden = false;

  const pages = splitIntoPages(text);
  if (pages.length <= 1) {
    // 단일 페이지: 기존 방식
    content.textContent = text;
  } else {
    // 다중 페이지: 페이지 사이에 시각적 구분선 삽입
    content.innerHTML = pages
      .map((pageText, i) => {
        const body = escRaw(pageText);
        const sep  = i < pages.length - 1
          ? `<span class="screen-page-sep">${i + 2}페이지</span>`
          : '';
        return body + sep;
      })
      .join('');
  }
}

/** 협의록 본문을 초기 플레이스홀더 상태로 되돌리기 */
export function clearMinutes() {
  const placeholder = document.getElementById('minutesPlaceholder');
  const content     = document.getElementById('minutesContent');
  if (!placeholder || !content) return;

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
