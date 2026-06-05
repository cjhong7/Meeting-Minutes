/**
 * export/excel.js — ExcelJS 기반 협의록 엑셀 내보내기
 *
 * v2: 페이지 경계 인식 레이아웃
 *  - A4 인쇄 가능 높이(약 720pt)를 기준으로 회의내용을 페이지 단위 청크로 분할
 *  - 각 청크는 독립적인 병합 셀 → 어떤 행도 페이지 경계를 걸치지 않음
 *  - ExcelJS pageBreaks API로 청크 사이에 명시적 페이지 구분선 삽입
 *  - exportExcel / buildExcelBlob 공통 로직을 buildWorkbookBuffer 로 통합
 *
 * 라이브러리: ExcelJS 4.4.0 (CDN 동적 로딩)
 */

import { appState } from '../state.js';
import { showToast } from '../ui/toast.js';

/* ── ExcelJS CDN ── */
const EXCELJS_CDN = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
let excelJsLoaded = false;

async function ensureExcelJS() {
  if (excelJsLoaded && window.ExcelJS) return;
  return new Promise((resolve, reject) => {
    if (window.ExcelJS) { excelJsLoaded = true; resolve(); return; }
    const script = document.createElement('script');
    script.src = EXCELJS_CDN;
    script.crossOrigin = 'anonymous';
    script.onload  = () => { excelJsLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('ExcelJS 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(script);
  });
}

/* ── 스타일 상수 ── */
const FILL_HEADER = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
const BORDER_THIN = {
  top:    { style: 'thin' }, left:   { style: 'thin' },
  bottom: { style: 'thin' }, right:  { style: 'thin' },
};
const FONT_BOLD    = { bold: true };
const ALIGN_CENTER = { vertical: 'middle', horizontal: 'center', wrapText: true };

/* ── 파일 다운로드 ── */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ================================================================
   페이지 인식 회의내용 레이아웃
   ================================================================
   A4 인쇄 가능 높이(A4_SAFE_H ≈ 720pt)를 기준으로 텍스트를 분할.
   각 청크는 하나의 페이지 안에서 완결되므로 어떤 행도 페이지를 걸치지 않음.
   청크 간에 ExcelJS 명시적 페이지 구분선을 삽입한다.

   계산 기준 (현행 pageSetup 기준):
     A4 높이         = 841.89pt
     상·하 마진(0.5in × 2) = 72pt
     헤더·푸터(0.3in × 2) = 43.2pt
     인쇄 가능 영역   ≈ 726.7pt → 안전 여유 6pt 뺀 720pt 사용
   ================================================================ */

const A4_SAFE_H   = 720;   // A4 인쇄 가능 높이 (안전 여유 포함)
const EXCEL_MAX_R = 400;   // Excel 단일 행 안전 높이 상한 (실제 한계 409pt)
const LINE_H      = 16;    // 줄당 높이(pt)
const CHARS       = 42;    // 한 줄 기준 글자 수 (가로폭 약 85단위, 한글 ~2단위)
const CELL_PAD    = 24;    // 셀 내부 상하 여백(pt)

/**
 * 텍스트를 A4 페이지 단위 청크로 분할
 * @param {string} text        회의내용 전문
 * @param {number} headerHeight 제목~안건까지 합산 행 높이(pt)
 * @returns {Array<{text:string, numRows:number, rowH:number}>}
 *   text    : 이 청크에 들어갈 텍스트
 *   numRows : 이 청크를 구성하는 Excel 행 수 (높이 분산용, 항상 ≤ EXCEL_MAX_R)
 *   rowH    : 각 행의 높이(pt)
 */
function computePageAwareChunks(text, headerHeight) {
  const txt = text || '';

  // 1페이지에서 헤더 이후 남은 공간
  const posOnPage1 = headerHeight % A4_SAFE_H;
  const page1Space = Math.max(80, A4_SAFE_H - posOnPage1);

  // 텍스트 → 시각적 줄 목록 (줄바꿈 + 자동 줄바꿈 모두 반영)
  const measuredLines = txt.split('\n').map(ln => ({
    text: ln,
    vl: Math.max(1, Math.ceil(ln.length / CHARS)),
  }));

  const chunks = [];
  let lineIdx = 0;
  let isFirst = true;

  do {
    const pageSpace = isFirst ? page1Space : A4_SAFE_H;
    const linesCap  = Math.max(2, Math.floor((pageSpace - CELL_PAD) / LINE_H));

    // 이 페이지에 들어갈 줄 수집
    const chunkLines = [];
    let usedVl = 0;
    while (lineIdx < measuredLines.length) {
      const l = measuredLines[lineIdx];
      // 이미 내용이 있으면 용량 초과 시 다음 청크로
      if (usedVl + l.vl > linesCap && chunkLines.length > 0) break;
      chunkLines.push(l.text);
      usedVl += l.vl;
      lineIdx++;
    }

    // 청크 높이 계산 (콘텐츠 기반, 최대 pageSpace 이하)
    const rawH   = Math.max(
      isFirst ? Math.min(page1Space, 200) : 200,
      usedVl * LINE_H + CELL_PAD
    );
    const chunkH = Math.min(rawH, pageSpace);

    // EXCEL_MAX_R 초과 시 여러 행으로 균등 분산 (청크 내부는 페이지 경계 없으므로 안전)
    const numRows = Math.max(1, Math.ceil(chunkH / EXCEL_MAX_R));
    const rowH    = Math.ceil(chunkH / numRows);

    chunks.push({ text: chunkLines.join('\n'), numRows, rowH });
    isFirst = false;
  } while (lineIdx < measuredLines.length);

  // 텍스트가 없을 때 최소 1개 청크 보장
  if (chunks.length === 0) {
    chunks.push({ text: '', numRows: 1, rowH: Math.min(page1Space, EXCEL_MAX_R) });
  }

  return chunks;
}

/* ================================================================
   공통 워크북 버퍼 생성
   ================================================================ */

/**
 * meeting 데이터로 완성된 워크북 버퍼를 반환
 * @param {object} meeting  appState.meeting
 * @returns {Promise<{buffer: ArrayBuffer, title: string}>}
 */
async function buildWorkbookBuffer(meeting) {
  const wb    = new ExcelJS.Workbook();
  const ws    = wb.addWorksheet('회의록');
  const title = meeting.title.trim() || '회의록';

  /* ── 참석자 수 기반 열 계산 ── */
  const attendeeNames = meeting.attendeeNames || [];
  const total       = meeting.attendeeCount || attendeeNames.length || 6;
  const actualRows  = total >= 9 ? 2 : 1;
  const slotsPerRow = actualRows === 1
    ? (total === 1 ? 6 : Math.max(total, 3))
    : Math.ceil(total / 2);
  const contentCols = slotsPerRow;
  const totalCols   = contentCols + 1;

  /* ── 열 너비 ── */
  ws.columns = [
    { width: 13 },
    ...Array.from({ length: contentCols }, () => ({ width: 85 / contentCols })),
  ];

  /* ── 페이지 설정 (A4 세로, 100%) ── */
  ws.pageSetup = {
    orientation: 'portrait', paperSize: 9, scale: 100,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };

  const defaultNames = [
    '교장','교감','부장','참석자','참석자','참석자','참석자','참석자',
    '참석자','참석자','참석자','참석자','참석자','참석자','참석자','참석자',
  ];

  let currentRow   = 1;
  let headerHeight = 0;  // 페이지 레이아웃 계산용 누적 헤더 높이

  /* ════════════════════════════════════════════════
     Row 1 — 제목
     ════════════════════════════════════════════════ */
  ws.mergeCells(currentRow, 1, currentRow, totalCols);
  const titleCell = ws.getCell(currentRow, 1);
  titleCell.value     = title;
  titleCell.font      = { bold: true, size: 16 };
  titleCell.alignment = ALIGN_CENTER;
  ws.getRow(currentRow).height = 45;
  headerHeight += 45;
  currentRow++;

  /* ════════════════════════════════════════════════
     Row 2 — 일시 + 장소
     ════════════════════════════════════════════════ */
  const dateWidth = Math.max(Math.ceil((contentCols - 1) * 0.65) - 1, 1);

  ws.getCell(currentRow, 1).value = '일시';
  ws.getCell(currentRow, 1).fill  = FILL_HEADER;
  ws.getCell(currentRow, 1).font  = FONT_BOLD;

  ws.mergeCells(currentRow, 2, currentRow, 2 + dateWidth - 1);
  ws.getCell(currentRow, 2).value = formatDateForExcel(meeting.date, meeting.time);

  const placeHeaderCol = 2 + dateWidth;
  ws.getCell(currentRow, placeHeaderCol).value = '장소';
  ws.getCell(currentRow, placeHeaderCol).fill  = FILL_HEADER;
  ws.getCell(currentRow, placeHeaderCol).font  = FONT_BOLD;

  ws.mergeCells(currentRow, placeHeaderCol + 1, currentRow, totalCols);
  ws.getCell(currentRow, placeHeaderCol + 1).value = meeting.place || '';

  ws.getRow(currentRow).height = 25;
  headerHeight += 25;
  currentRow++;

  /* ════════════════════════════════════════════════
     참석자 행
     ════════════════════════════════════════════════ */
  if (total === 1) {
    ws.getCell(currentRow, 1).value     = '참석자';
    ws.getCell(currentRow, 1).fill      = FILL_HEADER;
    ws.getCell(currentRow, 1).font      = FONT_BOLD;
    ws.getCell(currentRow, 1).alignment = ALIGN_CENTER;
    ws.mergeCells(currentRow, 2, currentRow, totalCols);
    const nc = ws.getCell(currentRow, 2);
    nc.value     = (attendeeNames[0] || '').trim() || '참석자';
    nc.fill      = FILL_HEADER;
    nc.font      = FONT_BOLD;
    nc.alignment = ALIGN_CENTER;
    ws.getRow(currentRow).height = 25;
    headerHeight += 25;
    currentRow++;
  } else if (total > 0) {
    const attRowSpan = actualRows * 2;
    ws.mergeCells(currentRow, 1, currentRow + attRowSpan - 1, 1);
    const attLabel = ws.getCell(currentRow, 1);
    attLabel.value     = '참석자';
    attLabel.fill      = FILL_HEADER;
    attLabel.font      = FONT_BOLD;
    attLabel.alignment = ALIGN_CENTER;

    for (let r = 0; r < actualRows; r++) {
      const nameRow    = currentRow;
      const signRow    = currentRow + 1;
      ws.getRow(nameRow).height = 45;
      ws.getRow(signRow).height = 45;
      const startIndex = r * slotsPerRow;

      for (let c = 0; c < slotsPerRow; c++) {
        const idx      = startIndex + c;
        const colIdx   = 2 + c;
        const nameCell = ws.getCell(nameRow, colIdx);
        const signCell = ws.getCell(signRow, colIdx);
        if (idx < total) {
          nameCell.value     = (attendeeNames[idx] || '').trim() || defaultNames[idx] || '참석자';
          nameCell.fill      = FILL_HEADER;
          nameCell.font      = FONT_BOLD;
          nameCell.alignment = ALIGN_CENTER;
          signCell.value     = '(서명)';
          signCell.font      = { color: { argb: 'FF94A3B8' }, italic: true, size: 10 };
          signCell.alignment = ALIGN_CENTER;
        } else {
          nameCell.fill      = FILL_HEADER;
          nameCell.alignment = ALIGN_CENTER;
          signCell.alignment = ALIGN_CENTER;
        }
      }
      currentRow += 2;
    }
    headerHeight += actualRows * 2 * 45;
  }

  /* ════════════════════════════════════════════════
     안건 행
     ════════════════════════════════════════════════ */
  ws.mergeCells(currentRow, 2, currentRow, totalCols);
  ws.getCell(currentRow, 1).value     = '안건';
  ws.getCell(currentRow, 1).fill      = FILL_HEADER;
  ws.getCell(currentRow, 1).font      = FONT_BOLD;
  ws.getCell(currentRow, 1).alignment = ALIGN_CENTER;

  const agendaText  = (meeting.agendas || []).filter(a => a.trim())
    .map((a, i) => `${i + 1}. ${a}`).join('\n') || '';
  ws.getCell(currentRow, 2).value     = agendaText;
  ws.getCell(currentRow, 2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

  const agendaCount = (meeting.agendas || []).filter(a => a.trim()).length;
  const agendaRowH  = Math.max(25, agendaCount * 20);
  ws.getRow(currentRow).height = agendaRowH;
  headerHeight += agendaRowH;
  currentRow++;

  /* ════════════════════════════════════════════════
     회의내용: 페이지 인식 청크
     ════════════════════════════════════════════════ */
  const chunks       = computePageAwareChunks(meeting.minutes, headerHeight);
  const pageBreakAfter = [];   // 페이지 구분이 필요한 행 번호 목록

  for (let ci = 0; ci < chunks.length; ci++) {
    const { text: chunkText, numRows, rowH } = chunks[ci];
    const cStart = currentRow;
    const cEnd   = currentRow + numRows - 1;

    /* 회의내용 레이블 (청크마다 독립 — 페이지 경계를 넘지 않음) */
    if (numRows > 1) ws.mergeCells(cStart, 1, cEnd, 1);
    const lbl = ws.getCell(cStart, 1);
    lbl.value     = '회의내용';
    lbl.fill      = FILL_HEADER;
    lbl.font      = FONT_BOLD;
    lbl.alignment = ALIGN_CENTER;

    /* 내용 셀 (청크 내 행 세로 + 전체 열 가로 병합) */
    ws.mergeCells(cStart, 2, cEnd, totalCols);
    const cc = ws.getCell(cStart, 2);
    cc.value     = chunkText;
    cc.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

    /* 행 높이 */
    for (let r = cStart; r <= cEnd; r++) ws.getRow(r).height = rowH;

    currentRow = cEnd + 1;

    /* 마지막 청크 제외 → 이 청크 마지막 행 뒤에 페이지 구분 */
    if (ci < chunks.length - 1) pageBreakAfter.push(cEnd);
  }

  const contentEndRow = currentRow - 1;

  /* ── 명시적 페이지 구분선 ── */
  if (pageBreakAfter.length > 0) {
    ws.pageBreaks = {
      count:            pageBreakAfter.length,
      manualBreakCount: pageBreakAfter.length,
      breaks: pageBreakAfter.map(r => ({ id: r, man: true, max: 16383, min: 1 })),
    };
  }

  /* ── 전체 셀 테두리 + 기본 정렬 ── */
  for (let R = 1; R <= contentEndRow; R++) {
    for (let C = 1; C <= totalCols; C++) {
      const cell = ws.getCell(R, C);
      cell.border = BORDER_THIN;
      if (!cell.alignment) cell.alignment = ALIGN_CENTER;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, title };
}

/* ================================================================
   공개 API
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
    await ensureExcelJS();
    const { buffer, title } = await buildWorkbookBuffer(meeting);
    const blob = new Blob([buffer], {
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
 * 엑셀 Blob과 파일명을 생성하여 반환 (자동저장 공용)
 * @returns {Promise<{ blob: Blob, fileName: string }|null>}
 */
export async function buildExcelBlob() {
  const meeting = appState.meeting;
  if (!meeting.minutes) return null;

  await ensureExcelJS();
  const { buffer, title } = await buildWorkbookBuffer(meeting);
  const blob     = new Blob([buffer], {
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
  const [y, m, d]  = parts;
  const dayNames   = ['일','월','화','수','목','금','토'];
  const dateObj    = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const dayName    = dayNames[dateObj.getDay()];
  let result = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${dayName})`;
  if (timeStr) {
    const [h, min] = timeStr.split(':');
    const hour     = parseInt(h);
    const period   = hour < 12 ? '오전' : '오후';
    const h12      = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    result += ` ${period} ${h12}:${min}`;
  }
  return result;
}
