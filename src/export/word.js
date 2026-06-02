/**
 * export/word.js — 워드(.doc) 협의록 내보내기
 *
 * 라이브러리 없이 HTML 기반 .doc 파일 생성.
 * MS Word·한글(HWP) 모두 직접 열어 편집 가능.
 *
 * 엑셀 양식과 동일한 표 구조 (제목·일시/장소·참석자·안건·회의내용).
 */

import { appState } from '../state.js';
import { showToast } from '../ui/toast.js';

/**
 * 현재 회의를 워드(.doc) 파일로 다운로드
 */
export async function exportWord() {
  const meeting = appState.meeting;

  if (!meeting.minutes) {
    showToast('협의록을 먼저 생성해 주세요.', 'warn');
    return;
  }

  try {
    const title = (meeting.title || '회의록').trim();
    const dateStr = formatDate(meeting.date, meeting.time);
    const place = meeting.place || '';

    // 참석자
    const names = meeting.attendeeNames || [];
    const total = meeting.attendeeCount || names.length || 0;
    const defaultNames = ['교장', '교감', '부장', '참석자', '참석자', '참석자',
      '참석자', '참석자', '참석자', '참석자', '참석자', '참석자',
      '참석자', '참석자', '참석자', '참석자'];

    // 참석자 칸 (이름 + 서명) — 한 행에 최대 4명씩
    const perRow = 4;
    let attRows = '';
    for (let i = 0; i < total; i += perRow) {
      let nameCells = '';
      let signCells = '';
      for (let c = 0; c < perRow; c++) {
        const idx = i + c;
        if (idx < total) {
          const nm = (names[idx] || '').trim() || defaultNames[idx] || '참석자';
          nameCells += `<td class="att-name">${esc(nm)}</td>`;
          signCells += `<td class="att-sign">(서명)</td>`;
        } else {
          nameCells += `<td></td>`;
          signCells += `<td></td>`;
        }
      }
      attRows += `<tr>${nameCells}</tr><tr>${signCells}</tr>`;
    }

    // 안건
    const agendaText = (meeting.agendas || [])
      .filter(a => a.trim())
      .map((a, i) => `${i + 1}. ${esc(a)}`)
      .join('<br>') || '';

    // 회의내용 (줄바꿈 유지)
    const minutesHtml = esc(meeting.minutes).replace(/\n/g, '<br>');

    const colspan = perRow;

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4 portrait; margin: 18mm 15mm; }
  body { font-family: "맑은 고딕", "Malgun Gothic", sans-serif; font-size: 11pt; color: #000; }
  h1 { text-align: center; font-size: 18pt; font-weight: bold; margin: 0 0 14pt; letter-spacing: 2pt; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { border: 1px solid #000; padding: 6pt 8pt; vertical-align: middle; font-size: 11pt; word-break: break-all; }
  .label { background: #dfe6f7; font-weight: bold; text-align: center; width: 90pt; }
  .att-name { background: #f0f3fa; font-weight: bold; text-align: center; }
  .att-sign { text-align: center; color: #888; height: 36pt; font-size: 9pt; }
  .content-cell { height: 380pt; vertical-align: top; line-height: 1.7; }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <table>
    <tr>
      <td class="label">회의명</td>
      <td colspan="${colspan}">${esc(title)}</td>
    </tr>
    <tr>
      <td class="label">일&nbsp;&nbsp;시</td>
      <td colspan="${Math.max(1, colspan - 2)}">${esc(dateStr)}</td>
      <td class="label">장&nbsp;&nbsp;소</td>
      <td>${esc(place)}</td>
    </tr>
    ${total > 0 ? `<tr><td class="label" rowspan="${Math.ceil(total / perRow) * 2}">참석자</td>${attRows.replace('<tr>', '')}` : ''}
    <tr>
      <td class="label">안&nbsp;&nbsp;건</td>
      <td colspan="${colspan}">${agendaText}</td>
    </tr>
    <tr>
      <td class="label">회의내용</td>
      <td colspan="${colspan}" class="content-cell">${minutesHtml}</td>
    </tr>
  </table>
</body>
</html>`;

    // .doc 파일로 다운로드 (Word가 HTML을 doc로 인식)
    const blob = new Blob(['﻿', html], { type: 'application/msword;charset=utf-8' });
    const fileName = sanitize(`${title}_${meeting.date || ''}.doc`);
    downloadBlob(blob, fileName);

    showToast('워드 파일이 다운로드되었습니다.', 'success');
  } catch (err) {
    console.error('[Word]', err);
    showToast(`워드 내보내기 실패: ${err.message}`, 'error');
  }
}

/* ── 헬퍼 ── */
function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || '회의록.doc';
}

function formatDate(dateStr, timeStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dateObj  = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const dayName  = dayNames[dateObj.getDay()];
  let result = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${dayName})`;
  if (timeStr) {
    const [h, min] = timeStr.split(':');
    const hour = parseInt(h);
    const period = hour < 12 ? '오전' : '오후';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    result += ` ${period} ${h12}:${min}`;
  }
  return result;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
