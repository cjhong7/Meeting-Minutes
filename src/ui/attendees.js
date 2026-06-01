/**
 * attendees.js — 참석자 입력 그리드 + 미리보기 그리드 렌더링
 *
 * 원칙 (계획서 Ⅳ / Ⅷ):
 *  - 3~8명: 1행 N칸
 *  - 9~16명: 2행 (ceil(N/2) + floor(N/2))
 *  - 미리보기 셀: 이름 영역 + 서명 빈칸
 */

import { appState, setState } from '../state.js';

const MIN_ATT = 3;
const MAX_ATT = 16;

/* ============================================================
   참석자 수 변경
   ============================================================ */

export function changeAttendeeCount(delta) {
  const { attendeeCount, attendeeNames } = appState.meeting;
  const newCount = Math.max(MIN_ATT, Math.min(MAX_ATT, attendeeCount + delta));
  if (newCount === attendeeCount) return;

  // 줄일 때: 사라질 칸에 이름이 있으면 경고는 main.js의 confirm()에서 처리
  const newNames = attendeeNames.slice(0, newCount);
  while (newNames.length < newCount) newNames.push('');

  setState({
    meeting: {
      attendeeCount: newCount,
      attendeeNames: newNames,
    }
  });
}

/* ============================================================
   입력 그리드 렌더링 (1쪽)
   ============================================================ */

export function renderAttendeeInputs() {
  const { attendeeCount, attendeeNames } = appState.meeting;
  const grid = document.getElementById('attendeeInputGrid');
  if (!grid) return;

  const cols = attendeeCount <= 8 ? attendeeCount : Math.ceil(attendeeCount / 2);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  // 기존 inputs 재활용 또는 재생성
  const existing = Array.from(grid.querySelectorAll('.attendee-name-input'));

  // 현재보다 많은 입력이 있으면 제거
  while (existing.length > attendeeCount) {
    existing.pop().remove();
  }

  for (let i = 0; i < attendeeCount; i++) {
    let input = existing[i];

    if (!input) {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'attendee-name-input field-input';
      input.autocomplete = 'off';
      input.maxLength = 10;

      input.addEventListener('input', e => {
        const names = [...appState.meeting.attendeeNames];
        names[parseInt(e.target.dataset.index, 10)] = e.target.value;
        setState({ meeting: { attendeeNames: names, isDirty: true } });
        updateAttendeePreview();
      });

      grid.appendChild(input);
    }

    input.placeholder = `참석자 ${i + 1}`;
    input.dataset.index = i;
    // 값이 변경된 경우에만 업데이트 (포커스 유지)
    if (input.value !== (attendeeNames[i] || '')) {
      input.value = attendeeNames[i] || '';
    }
  }
}

/* ============================================================
   미리보기 그리드 렌더링 (2쪽)
   ============================================================ */

export function updateAttendeePreview() {
  const { attendeeCount, attendeeNames } = appState.meeting;
  const container = document.getElementById('attPreview');
  if (!container) return;

  // 행 구성
  const rows = buildRows(attendeeCount);

  container.innerHTML = '';

  rows.forEach(rowIndices => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'att-row';
    rowDiv.style.gridTemplateColumns = `repeat(${rowIndices.length}, 1fr)`;

    rowIndices.forEach(idx => {
      const cell = document.createElement('div');
      cell.className = 'att-cell';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'att-name';
      nameDiv.textContent = attendeeNames[idx] || '';

      const signDiv = document.createElement('div');
      signDiv.className = 'att-sign';
      signDiv.setAttribute('aria-label', '서명란');

      cell.appendChild(nameDiv);
      cell.appendChild(signDiv);
      rowDiv.appendChild(cell);
    });

    container.appendChild(rowDiv);
  });
}

/* ── 내부 헬퍼: 행별 인덱스 배열 반환 ── */
function buildRows(count) {
  if (count <= 8) {
    return [Array.from({ length: count }, (_, i) => i)];
  }
  const firstLen  = Math.ceil(count / 2);
  const secondLen = count - firstLen;
  return [
    Array.from({ length: firstLen  }, (_, i) => i),
    Array.from({ length: secondLen }, (_, i) => firstLen + i),
  ];
}
