/**
 * export/excel.js — ExcelJS 기반 협의록 엑셀 내보내기
 *
 * 스펙 (계획서 VIII + 직전 버전 app.js 양식 유지):
 *  - fitToPage: true, fitToWidth: 1, fitToHeight: 0 (가로 1쪽, 세로 가변)
 *  - 용지: A4 세로 (paperSize: 9, orientation: 'portrait')
 *  - 참석자: 이름 + 서명란, 8명 이하 1행, 9~16명 2행
 *  - 동적 컬럼 수: 참석자 수 기반 (최소 6칸)
 *  - 상단 양식: 제목 → 일시/장소 → 참석자(이름+서명) → 안건 → 회의내용(높이 400)
 *  - 테두리, 헤더 배경, 볼드 등 이전 버전과 동일한 스타일
 *
 * 라이브러리: ExcelJS (CDN에서 동적 로딩, 서비스워커가 캐시)
 */

import { appState } from '../state.js';
import { showToast } from '../ui/toast.js';

/* ── ExcelJS CDN URL ── */
const EXCELJS_CDN = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';

/* ── ExcelJS 동적 로딩 ── */
let excelJsLoaded = false;

async function ensureExcelJS() {
  if (excelJsLoaded && window.ExcelJS) return;

  return new Promise((resolve, reject) => {
    // 이미 로드된 경우
    if (window.ExcelJS) {
      excelJsLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = EXCELJS_CDN;
    script.crossOrigin = 'anonymous';   // CORS → SW가 캐시 가능
    script.onload = () => {
      excelJsLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('ExcelJS 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));
    };
    document.head.appendChild(script);
  });
}

/* ── 스타일 상수 ── */
const FILL_HEADER = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF8FAFC' },
};

const BORDER_THIN = {
  top:    { style: 'thin' },
  left:   { style: 'thin' },
  bottom: { style: 'thin' },
  right:  { style: 'thin' },
};

const FONT_BOLD = { bold: true };

const ALIGN_CENTER = {
  vertical: 'middle',
  horizontal: 'center',
  wrapText: true,
};

/* ── 파일 다운로드 (FileSaver 대체) ── */
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

/* ================================================================
   메인 엑셀 내보내기
   ================================================================ */

/**
 * 현재 appState.meeting 데이터를 엑셀 파일로 다운로드
 */
export async function exportExcel() {
  const meeting = appState.meeting;

  if (!meeting.minutes) {
    showToast('협의록을 먼저 생성해 주세요.', 'warn');
    return;
  }

  try {
    // 1. ExcelJS 로딩
    await ensureExcelJS();

    const title = meeting.title.trim() || '회의록';

    // 2. 워크북 + 시트 생성
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('회의록');

    // ── 참석자 수 기반 컬럼 계산 ──
    const attendeeNames = meeting.attendeeNames || [];
    const total = meeting.attendeeCount || attendeeNames.length || 6;
    const actualRows = total >= 9 ? 2 : 1;                          // 참석자 행 수
    const slotsPerRow = actualRows === 1
      ? Math.max(total, 6)                                          // 1행: 최소 6칸
      : Math.ceil(total / 2);                                       // 2행: 반씩 배분
    const contentCols = slotsPerRow;
    const totalCols   = contentCols + 1;                             // +1 = 왼쪽 헤더 열

    // ── 열 너비 설정 ──
    const cols = [{ width: 13 }];                                    // 헤더 열 고정 13
    const colWidth = 85 / contentCols;                               // 나머지 열 균등 분배
    for (let i = 0; i < contentCols; i++) cols.push({ width: colWidth });
    ws.columns = cols;

    // ── 페이지 설정 (A4 세로) ──
    ws.pageSetup = {
      orientation: 'portrait',
      paperSize: 9,                                                  // A4
      scale: 100,
      margins: {
        left: 0.25, right: 0.25,
        top: 0.5,   bottom: 0.5,
        header: 0.3, footer: 0.3,
      },
    };

    let currentRow = 1;

    // ════════════════════════════════════════════════════════════
    //  Row 1 — 제목
    // ════════════════════════════════════════════════════════════
    ws.mergeCells(currentRow, 1, currentRow, totalCols);
    const titleCell = ws.getCell(currentRow, 1);
    titleCell.value     = title;
    titleCell.font      = { bold: true, size: 16 };
    titleCell.alignment = ALIGN_CENTER;
    ws.getRow(currentRow).height = 45;
    currentRow++;

    // ════════════════════════════════════════════════════════════
    //  Row 2 — 일시 + 장소
    // ════════════════════════════════════════════════════════════
    const dateWidth  = Math.max(Math.ceil((contentCols - 1) * 0.65) - 1, 1);
    const placeWidth = (contentCols - 1) - dateWidth;

    // 일시 헤더
    ws.getCell(currentRow, 1).value = '일시';
    ws.getCell(currentRow, 1).fill  = FILL_HEADER;
    ws.getCell(currentRow, 1).font  = FONT_BOLD;

    // 일시 값 병합
    ws.mergeCells(currentRow, 2, currentRow, 2 + dateWidth - 1);
    const dateStr = formatDateForExcel(meeting.date, meeting.time);
    ws.getCell(currentRow, 2).value = dateStr;

    // 장소 헤더
    const placeHeaderCol = 2 + dateWidth;
    ws.getCell(currentRow, placeHeaderCol).value = '장소';
    ws.getCell(currentRow, placeHeaderCol).fill  = FILL_HEADER;
    ws.getCell(currentRow, placeHeaderCol).font  = FONT_BOLD;

    // 장소 값 병합
    ws.mergeCells(currentRow, placeHeaderCol + 1, currentRow, totalCols);
    ws.getCell(currentRow, placeHeaderCol + 1).value = meeting.place || '';

    ws.getRow(currentRow).height = 25;
    currentRow++;

    // ════════════════════════════════════════════════════════════
    //  참석자 행
    // ════════════════════════════════════════════════════════════
    const defaultNames = [
      '교장', '교감', '부장', '참석자', '참석자', '참석자',
      '참석자', '참석자', '참석자', '참석자', '참석자', '참석자',
      '참석자', '참석자', '참석자', '참석자',
    ];

    if (total === 1) {
      // 1명: 이름을 한 칸으로 병합, 서명란 없음
      ws.getCell(currentRow, 1).value = '참석자';
      ws.getCell(currentRow, 1).fill  = FILL_HEADER;
      ws.getCell(currentRow, 1).font  = FONT_BOLD;
      ws.getCell(currentRow, 1).alignment = ALIGN_CENTER;

      ws.mergeCells(currentRow, 2, currentRow, totalCols);
      const nameCell = ws.getCell(currentRow, 2);
      nameCell.value = (attendeeNames[0] || '').trim() || '참석자';
      nameCell.fill  = FILL_HEADER;
      nameCell.font  = FONT_BOLD;
      nameCell.alignment = ALIGN_CENTER;
      ws.getRow(currentRow).height = 25;
      currentRow += 1;
    } else if (total > 0) {
      // "참석자" 헤더를 세로 병합
      const attRowSpan = actualRows * 2;  // 이름+서명 × 행 수
      ws.mergeCells(currentRow, 1, currentRow + attRowSpan - 1, 1);
      const attLabel   = ws.getCell(currentRow, 1);
      attLabel.value   = '참석자';
      attLabel.fill    = FILL_HEADER;
      attLabel.font    = FONT_BOLD;
      attLabel.alignment = ALIGN_CENTER;

      for (let r = 0; r < actualRows; r++) {
        const nameRow = currentRow;
        const signRow = currentRow + 1;

        ws.getRow(nameRow).height = 25;
        ws.getRow(signRow).height = 45;

        const startIndex = r * slotsPerRow;

        for (let c = 0; c < slotsPerRow; c++) {
          const idx    = startIndex + c;
          const colIdx = 2 + c;

          const nameCell = ws.getCell(nameRow, colIdx);
          const signCell = ws.getCell(signRow, colIdx);

          if (idx < total) {
            // 이름: 입력값 또는 기본값
            nameCell.value = (attendeeNames[idx] || '').trim() || defaultNames[idx] || '참석자';
            nameCell.fill  = FILL_HEADER;
            nameCell.font  = FONT_BOLD;
            nameCell.alignment = ALIGN_CENTER;

            // 서명란
            signCell.value = '(서명)';
            signCell.font  = { color: { argb: 'FF94A3B8' }, italic: true, size: 10 };
            signCell.alignment = ALIGN_CENTER;
          } else {
            // 빈 슬롯도 배경 통일
            nameCell.fill  = FILL_HEADER;
            nameCell.alignment = ALIGN_CENTER;
            signCell.alignment = ALIGN_CENTER;
          }
        }

        currentRow += 2;
      }
    }

    // ════════════════════════════════════════════════════════════
    //  안건 행
    // ════════════════════════════════════════════════════════════
    ws.mergeCells(currentRow, 2, currentRow, totalCols);
    ws.getCell(currentRow, 1).value = '안건';
    ws.getCell(currentRow, 1).fill  = FILL_HEADER;
    ws.getCell(currentRow, 1).font  = FONT_BOLD;
    ws.getCell(currentRow, 1).alignment = ALIGN_CENTER;

    // 안건 목록을 줄바꿈으로 합침
    const agendaText = (meeting.agendas || [])
      .filter(a => a.trim())
      .map((a, i) => `${i + 1}. ${a}`)
      .join('\n') || '';
    ws.getCell(currentRow, 2).value     = agendaText;
    ws.getCell(currentRow, 2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    // 안건 행 높이: 안건 수에 따라 동적 조정 (최소 25)
    const agendaCount = (meeting.agendas || []).filter(a => a.trim()).length;
    ws.getRow(currentRow).height = Math.max(25, agendaCount * 20);
    currentRow++;

    // ════════════════════════════════════════════════════════════
    //  회의내용 행 (height 400)
    // ════════════════════════════════════════════════════════════
    ws.mergeCells(currentRow, 2, currentRow, totalCols);
    ws.getCell(currentRow, 1).value = '회의내용';
    ws.getCell(currentRow, 1).fill  = FILL_HEADER;
    ws.getCell(currentRow, 1).font  = FONT_BOLD;
    ws.getCell(currentRow, 1).alignment = ALIGN_CENTER;

    ws.getRow(currentRow).height = 400;

    const contentCell = ws.getCell(currentRow, 2);
    contentCell.value     = meeting.minutes || '';
    contentCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

    // ════════════════════════════════════════════════════════════
    //  전체 셀에 테두리 + 기본 정렬 적용
    // ════════════════════════════════════════════════════════════
    for (let R = 1; R <= currentRow; R++) {
      for (let C = 1; C <= totalCols; C++) {
        const cell = ws.getCell(R, C);
        cell.border = BORDER_THIN;

        // 정렬이 아직 없는 셀에 기본 중앙정렬 (회의내용 셀은 제외)
        if (!cell.alignment && cell !== contentCell) {
          cell.alignment = ALIGN_CENTER;
        }
      }
    }

    // ── 버퍼 → 다운로드 ──
    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, `${title}.xlsx`);

    showToast('엑셀 파일이 다운로드되었습니다.', 'success');
  } catch (err) {
    console.error('[Excel]', err);
    showToast(`엑셀 내보내기 실패: ${err.message}`, 'error');
  }
}

/**
 * 엑셀 Blob과 파일명을 생성하여 반환 (다운로드/폴더저장 공용)
 * @returns {Promise<{ blob: Blob, fileName: string }|null>}
 */
export async function buildExcelBlob() {
  const meeting = appState.meeting;
  if (!meeting.minutes) return null;

  await ensureExcelJS();
  const title = meeting.title.trim() || '회의록';

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('회의록');

  const attendeeNames = meeting.attendeeNames || [];
  const total = meeting.attendeeCount || attendeeNames.length || 6;
  const actualRows = total >= 9 ? 2 : 1;
  const slotsPerRow = actualRows === 1 ? Math.max(total, 6) : Math.ceil(total / 2);
  const contentCols = slotsPerRow;
  const totalCols   = contentCols + 1;

  const cols = [{ width: 13 }];
  const colWidth = 85 / contentCols;
  for (let i = 0; i < contentCols; i++) cols.push({ width: colWidth });
  ws.columns = cols;

  ws.pageSetup = {
    orientation: 'portrait', paperSize: 9, scale: 100,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };

  let currentRow = 1;

  // 제목
  ws.mergeCells(currentRow, 1, currentRow, totalCols);
  const titleCell = ws.getCell(currentRow, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = ALIGN_CENTER;
  ws.getRow(currentRow).height = 45;
  currentRow++;

  // 일시 + 장소
  const dateWidth  = Math.max(Math.ceil((contentCols - 1) * 0.65) - 1, 1);
  ws.getCell(currentRow, 1).value = '일시';
  ws.getCell(currentRow, 1).fill = FILL_HEADER;
  ws.getCell(currentRow, 1).font = FONT_BOLD;
  ws.mergeCells(currentRow, 2, currentRow, 2 + dateWidth - 1);
  ws.getCell(currentRow, 2).value = formatDateForExcel(meeting.date, meeting.time);
  const placeHeaderCol = 2 + dateWidth;
  ws.getCell(currentRow, placeHeaderCol).value = '장소';
  ws.getCell(currentRow, placeHeaderCol).fill = FILL_HEADER;
  ws.getCell(currentRow, placeHeaderCol).font = FONT_BOLD;
  ws.mergeCells(currentRow, placeHeaderCol + 1, currentRow, totalCols);
  ws.getCell(currentRow, placeHeaderCol + 1).value = meeting.place || '';
  ws.getRow(currentRow).height = 25;
  currentRow++;

  // 참석자
  const defaultNames = ['교장','교감','부장','참석자','참석자','참석자','참석자','참석자','참석자','참석자','참석자','참석자','참석자','참석자','참석자','참석자'];
  if (total === 1) {
    // 1명: 이름을 한 칸으로 병합, 서명란 없음
    ws.getCell(currentRow, 1).value = '참석자';
    ws.getCell(currentRow, 1).fill = FILL_HEADER;
    ws.getCell(currentRow, 1).font = FONT_BOLD;
    ws.getCell(currentRow, 1).alignment = ALIGN_CENTER;
    ws.mergeCells(currentRow, 2, currentRow, totalCols);
    const nameCell = ws.getCell(currentRow, 2);
    nameCell.value = (attendeeNames[0] || '').trim() || '참석자';
    nameCell.fill = FILL_HEADER; nameCell.font = FONT_BOLD; nameCell.alignment = ALIGN_CENTER;
    ws.getRow(currentRow).height = 25;
    currentRow += 1;
  } else if (total > 0) {
    const attRowSpan = actualRows * 2;
    ws.mergeCells(currentRow, 1, currentRow + attRowSpan - 1, 1);
    const attLabel = ws.getCell(currentRow, 1);
    attLabel.value = '참석자'; attLabel.fill = FILL_HEADER; attLabel.font = FONT_BOLD;
    attLabel.alignment = ALIGN_CENTER;
    for (let r = 0; r < actualRows; r++) {
      const nameRow = currentRow, signRow = currentRow + 1;
      ws.getRow(nameRow).height = 25;
      ws.getRow(signRow).height = 45;
      const startIndex = r * slotsPerRow;
      for (let c = 0; c < slotsPerRow; c++) {
        const idx = startIndex + c, colIdx = 2 + c;
        const nameCell = ws.getCell(nameRow, colIdx), signCell = ws.getCell(signRow, colIdx);
        if (idx < total) {
          nameCell.value = (attendeeNames[idx] || '').trim() || defaultNames[idx] || '참석자';
          nameCell.fill = FILL_HEADER; nameCell.font = FONT_BOLD; nameCell.alignment = ALIGN_CENTER;
          signCell.value = '(서명)';
          signCell.font = { color: { argb: 'FF94A3B8' }, italic: true, size: 10 };
          signCell.alignment = ALIGN_CENTER;
        } else {
          nameCell.fill = FILL_HEADER; nameCell.alignment = ALIGN_CENTER; signCell.alignment = ALIGN_CENTER;
        }
      }
      currentRow += 2;
    }
  }

  // 안건
  ws.mergeCells(currentRow, 2, currentRow, totalCols);
  ws.getCell(currentRow, 1).value = '안건';
  ws.getCell(currentRow, 1).fill = FILL_HEADER;
  ws.getCell(currentRow, 1).font = FONT_BOLD;
  ws.getCell(currentRow, 1).alignment = ALIGN_CENTER;
  const agendaText = (meeting.agendas || []).filter(a => a.trim()).map((a, i) => `${i + 1}. ${a}`).join('\n') || '';
  ws.getCell(currentRow, 2).value = agendaText;
  ws.getCell(currentRow, 2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  const agendaCount = (meeting.agendas || []).filter(a => a.trim()).length;
  ws.getRow(currentRow).height = Math.max(25, agendaCount * 20);
  currentRow++;

  // 회의내용
  ws.mergeCells(currentRow, 2, currentRow, totalCols);
  ws.getCell(currentRow, 1).value = '회의내용';
  ws.getCell(currentRow, 1).fill = FILL_HEADER;
  ws.getCell(currentRow, 1).font = FONT_BOLD;
  ws.getCell(currentRow, 1).alignment = ALIGN_CENTER;
  ws.getRow(currentRow).height = 400;
  const contentCell = ws.getCell(currentRow, 2);
  contentCell.value = meeting.minutes || '';
  contentCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

  // 테두리
  for (let R = 1; R <= currentRow; R++) {
    for (let C = 1; C <= totalCols; C++) {
      const cell = ws.getCell(R, C);
      cell.border = BORDER_THIN;
      if (!cell.alignment && cell !== contentCell) cell.alignment = ALIGN_CENTER;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fileName = `${title}_${meeting.date || ''}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
  return { blob, fileName };
}

/* ── 날짜 포맷 헬퍼 ── */
function formatDateForExcel(dateStr, timeStr) {
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
