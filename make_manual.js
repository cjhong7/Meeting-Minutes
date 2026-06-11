/**
 * 학교 협의록 작성기 사용설명서 생성 스크립트
 * 실행: node make_manual.js
 */
const DOCX_PATH = 'C:/Users/user/AppData/Roaming/npm/node_modules/docx';
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak, ExternalHyperlink,
} = require(DOCX_PATH);
const fs = require('fs');

/* ───────────────────────────────────────────────
   색상 팔레트
   ─────────────────────────────────────────────── */
const C = {
  navy:    '1F4E79',  // 진한 남색
  blue:    '2E75B6',  // 기본 파란색
  lightBl: 'D5E8F0',  // 연한 하늘색 (셀 배경)
  midBl:   'BDD7EE',  // 중간 파란 (헤더 셀)
  darkBl:  '1F4E79',  // 진한 남색 텍스트
  green:   '375623',  // 진한 초록
  lgGreen: 'E2EFDA',  // 연한 초록
  midGr:   'C6EFCE',  // 중간 초록
  yellow:  'FFC000',  // 노란색
  orange:  'ED7D31',  // 주황
  gray:    'F2F2F2',  // 연회색
  midGray: 'D9D9D9',  // 중간 회색
  dkGray:  '595959',  // 진한 회색
  black:   '000000',
  white:   'FFFFFF',
  red:     'C00000',
};

/* ───────────────────────────────────────────────
   공통 테두리
   ─────────────────────────────────────────────── */
const border1 = { style: BorderStyle.SINGLE, size: 8, color: C.blue };
const border2 = { style: BorderStyle.SINGLE, size: 4, color: C.midGray };
const borderBlk = { style: BorderStyle.SINGLE, size: 6, color: C.black };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

function allBorder(b) { return { top: b, bottom: b, left: b, right: b }; }
function allBorder2(b) { return { top: border2, bottom: b, left: b, right: b }; }

/* ───────────────────────────────────────────────
   헬퍼: 단락
   ─────────────────────────────────────────────── */
function para(text, opts = {}) {
  const {
    bold = false, size = 22, color = C.black, font = '맑은 고딕',
    align = AlignmentType.LEFT, spacing = { before: 0, after: 80 },
    indent, heading,
  } = opts;

  const runs = [];
  if (typeof text === 'string') {
    runs.push(new TextRun({ text, bold, size, color, font }));
  } else if (Array.isArray(text)) {
    text.forEach(r => runs.push(r));
  } else {
    runs.push(text);
  }

  const p = {
    alignment: align,
    spacing,
    children: runs,
  };
  if (indent) p.indent = indent;
  if (heading) p.heading = heading;

  return new Paragraph(p);
}

function run(text, opts = {}) {
  const { bold = false, size = 22, color = C.black, font = '맑은 고딕',
    underline, highlight } = opts;
  const r = { text, bold, size, color, font };
  if (underline) r.underline = {};
  if (highlight) r.highlight = highlight;
  return new TextRun(r);
}

function spacer(before = 100, after = 100) {
  return new Paragraph({ spacing: { before, after }, children: [] });
}

/* ───────────────────────────────────────────────
   헬퍼: 표 셀
   ─────────────────────────────────────────────── */
function cell(children, { width, fill, bold = false, align = AlignmentType.CENTER,
  vAlign = VerticalAlign.CENTER, borders, colspan, rowspan } = {}) {
  if (!Array.isArray(children)) children = [children];

  // children이 Paragraph 배열인지 TextRun/string 배열인지 처리
  const paras = children.map(c => {
    if (c instanceof Paragraph) return c;
    if (typeof c === 'string') return para(c, { bold, align, spacing: { before: 60, after: 60 } });
    return new Paragraph({ alignment: align, spacing: { before: 60, after: 60 }, children: [c] });
  });

  const cellOpts = {
    children: paras,
    verticalAlign: vAlign,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  };
  if (width) cellOpts.width = { size: width, type: WidthType.DXA };
  if (fill) cellOpts.shading = { fill, type: ShadingType.CLEAR };
  if (borders) cellOpts.borders = borders;
  if (colspan) cellOpts.columnSpan = colspan;
  if (rowspan) cellOpts.rowSpan = rowspan;

  return new TableCell(cellOpts);
}

function tableRow(cells, isHeader = false) {
  return new TableRow({ children: cells, tableHeader: isHeader });
}

/* ───────────────────────────────────────────────
   헬퍼: 글머리 기호 단락
   ─────────────────────────────────────────────── */
function bullet(text, level = 0, opts = {}) {
  const size = opts.size || 20;
  const bold = opts.bold || false;
  const color = opts.color || C.black;
  const indent = level === 0
    ? { left: 400, hanging: 200 }
    : { left: 720, hanging: 200 };
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 40, after: 40 },
    indent,
    children: [
      new TextRun({ text: (level === 0 ? '■ ' : '- ') + text, size, bold, color, font: '맑은 고딕' }),
    ],
  });
}

/* ───────────────────────────────────────────────
   헬퍼: 번호 단락
   ─────────────────────────────────────────────── */
function numbered(num, text, opts = {}) {
  const size = opts.size || 20;
  const bold = opts.bold || false;
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 40 },
    indent: { left: 420, hanging: 320 },
    children: [
      new TextRun({ text: `${num}. `, bold: true, size, font: '맑은 고딕', color: C.navy }),
      new TextRun({ text, size, bold, font: '맑은 고딕', color: C.black }),
    ],
  });
}

/* ───────────────────────────────────────────────
   헬퍼: 장 제목
   ─────────────────────────────────────────────── */
function chapterTitle(num, title) {
  return new Paragraph({
    pageBreakBefore: true,
    spacing: { before: 200, after: 160 },
    children: [
      new TextRun({ text: `제${num}장  ${title}`, bold: true, size: 28, color: C.navy, font: '맑은 고딕' }),
    ],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.blue, space: 4 } },
  });
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({ text, bold: true, size: 24, color: C.navy, font: '맑은 고딕' }),
    ],
  });
}

function subTitle(text) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({ text, bold: true, size: 22, color: C.blue, font: '맑은 고딕' }),
    ],
  });
}

/* ───────────────────────────────────────────────
   콘텐츠 생성
   ─────────────────────────────────────────────── */

/* == 1쪽: 표지 ================================================ */
function makeCoverPage() {
  const W = 11906 - 1440 * 2; // A4 내용 너비

  return [
    spacer(2000, 0),

    // 로고/아이콘 대신 텍스트 배지
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: '📋', size: 72, font: '맑은 고딕' })],
    }),

    // 제목
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [new TextRun({ text: '학교 협의록 작성기', bold: true, size: 52, color: C.navy, font: '맑은 고딕' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400 },
      children: [new TextRun({ text: '사용설명서', bold: true, size: 40, color: C.blue, font: '맑은 고딕' })],
    }),

    // 구분선
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.blue, space: 4 } },
      children: [],
    }),

    // 부제
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 600 },
      children: [new TextRun({ text: 'AI 기반 학교 회의록 자동 작성 시스템', size: 28, color: C.dkGray, font: '맑은 고딕' })],
    }),

    // 정보 박스
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [W],
      rows: [
        tableRow([
          cell([
            para('접속 URL', { align: AlignmentType.CENTER, bold: true, size: 20, color: C.navy }),
            para('https://cjhong7.github.io/Meeting-Minutes/', { align: AlignmentType.CENTER, size: 22, color: C.blue, bold: true }),
          ], { width: W, fill: C.lightBl, borders: allBorder(border1) }),
        ]),
      ],
    }),

    spacer(600, 0),

    // 하단 정보 테이블
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [2800, 6000],
      rows: [
        tableRow([
          cell('개  발', { width: 2800, fill: C.midBl, bold: true, borders: allBorder(border2) }),
          cell('교사 개인 개발 · 무료 배포', { width: 6000, borders: allBorder(border2) }),
        ]),
        tableRow([
          cell('작성일', { width: 2800, fill: C.midBl, bold: true, borders: allBorder(border2) }),
          cell('2026년 6월', { width: 6000, borders: allBorder(border2) }),
        ]),
        tableRow([
          cell('버  전', { width: 2800, fill: C.midBl, bold: true, borders: allBorder(border2) }),
          cell('v1.0 (2026 연구학교 배포판)', { width: 6000, borders: allBorder(border2) }),
        ]),
        tableRow([
          cell('지원 브라우저', { width: 2800, fill: C.midBl, bold: true, borders: allBorder(border2) }),
          cell('Chrome, Edge (최신 버전 권장)', { width: 6000, borders: allBorder(border2) }),
        ]),
      ],
    }),

    spacer(400, 0),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: '본 프로그램은 설치 없이 웹 브라우저에서 바로 사용하는 무료 서비스입니다.', size: 18, color: C.dkGray, font: '맑은 고딕' })],
    }),
  ];
}

/* == 2쪽: 한장 요약 설명서 ===================================== */
function makeSummaryPage() {
  const W = 11906 - 1440 * 2;
  const col4 = Math.floor(W / 4);

  return [
    /* 섹션 제목 */
    new Paragraph({
      pageBreakBefore: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({ text: '⚡ 한장 요약 설명서', bold: true, size: 36, color: C.navy, font: '맑은 고딕' }),
        new TextRun({ text: '  — 이 페이지만 읽어도 바로 사용할 수 있습니다', size: 20, color: C.dkGray, font: '맑은 고딕' }),
      ],
    }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      border: { bottom: { style: BorderStyle.THICK, size: 16, color: C.blue, space: 2 } },
      children: [],
    }),

    /* ── 5단계 빠른 시작 ── */
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: '▶ 5단계 빠른 시작', bold: true, size: 24, color: C.navy, font: '맑은 고딕' })],
    }),

    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [1100, 2200, 5500],
      rows: [
        // 헤더
        tableRow([
          cell('단계', { width: 1100, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
          cell('항목', { width: 2200, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
          cell('방법', { width: 5500, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
        ].map((c, i) => {
          c.options && (c.options.textColor = C.white);
          return c;
        }), true),

        tableRow([
          cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '①', bold: true, size: 24, color: C.white, font: '맑은 고딕' })] })],
            { width: 1100, fill: C.blue, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '접 속', bold: true, size: 22, color: C.navy, font: '맑은 고딕' })] })],
            { width: 2200, fill: C.lightBl, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: '크롬/엣지 주소창에 입력: ', size: 20, font: '맑은 고딕', color: C.black }),
            new TextRun({ text: 'https://cjhong7.github.io/Meeting-Minutes/', size: 20, bold: true, color: C.blue, font: '맑은 고딕' }),
            new TextRun({ text: '\n※ 이용 안내 팝업이 뜨면 [확인하고 시작하기] 클릭', size: 18, color: C.dkGray, font: '맑은 고딕' }),
          ] })], { width: 5500, borders: allBorder(borderBlk) }),
        ]),

        tableRow([
          cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '②', bold: true, size: 24, color: C.white, font: '맑은 고딕' })] })],
            { width: 1100, fill: C.blue, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: 'AI 설정', bold: true, size: 22, color: C.navy, font: '맑은 고딕' })] })],
            { width: 2200, fill: C.lightBl, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: '상단 [⚙ AI 설정] 버튼 클릭 → 엔진 선택 → API 키 입력 → [설정 저장]\n', size: 20, font: '맑은 고딕', color: C.black }),
            new TextRun({ text: '※ API 키 없으면 "키 없음(로컬 시뮬레이션)" 선택 후 건너뜀', size: 18, color: C.dkGray, font: '맑은 고딕' }),
          ] })], { width: 5500, borders: allBorder(borderBlk) }),
        ]),

        tableRow([
          cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '③', bold: true, size: 24, color: C.white, font: '맑은 고딕' })] })],
            { width: 1100, fill: C.blue, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '회의 정보\n입력', bold: true, size: 22, color: C.navy, font: '맑은 고딕' })] })],
            { width: 2200, fill: C.lightBl, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: '왼쪽 입력 패널: 회의명 / 날짜·시간 / 장소 / 안건 / 참석자 입력\n', size: 20, font: '맑은 고딕', color: C.black }),
            new TextRun({ text: '※ 참석자 수는 − / + 버튼으로 조절 (최대 16명)', size: 18, color: C.dkGray, font: '맑은 고딕' }),
          ] })], { width: 5500, borders: allBorder(borderBlk) }),
        ]),

        tableRow([
          cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '④', bold: true, size: 24, color: C.white, font: '맑은 고딕' })] })],
            { width: 1100, fill: C.blue, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '내용 입력\n(방식 선택)', bold: true, size: 22, color: C.navy, font: '맑은 고딕' })] })],
            { width: 2200, fill: C.lightBl, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: '⌨ 타자(기본): ', size: 20, bold: true, color: C.navy, font: '맑은 고딕' }),
            new TextRun({ text: '회의 내용 직접 입력\n', size: 20, font: '맑은 고딕', color: C.black }),
            new TextRun({ text: '🎤 녹음: ', size: 20, bold: true, color: C.navy, font: '맑은 고딕' }),
            new TextRun({ text: '실시간 녹음 또는 오디오 파일 업로드\n', size: 20, font: '맑은 고딕', color: C.black }),
            new TextRun({ text: '📄 계획서: ', size: 20, bold: true, color: C.navy, font: '맑은 고딕' }),
            new TextRun({ text: 'HWPX·PDF·DOCX 파일 업로드\n', size: 20, font: '맑은 고딕', color: C.black }),
            new TextRun({ text: '✏ 펜: ', size: 20, bold: true, color: C.navy, font: '맑은 고딕' }),
            new TextRun({ text: '터치·마우스로 손글씨 → OCR 변환', size: 20, font: '맑은 고딕', color: C.black }),
          ] })], { width: 5500, borders: allBorder(borderBlk) }),
        ]),

        tableRow([
          cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '⑤', bold: true, size: 24, color: C.white, font: '맑은 고딕' })] })],
            { width: 1100, fill: C.green, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '생성·저장', bold: true, size: 22, color: C.green, font: '맑은 고딕' })] })],
            { width: 2200, fill: C.lgGreen, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: '[협의록 생성 →] 버튼 클릭 → AI가 자동 작성 (오른쪽 미리보기 확인)\n', size: 20, font: '맑은 고딕', color: C.black }),
            new TextRun({ text: '→ [📊 엑셀 다운로드] 또는 [🖨 인쇄] 또는 워드 다운로드로 저장', size: 20, bold: true, color: C.green, font: '맑은 고딕' }),
          ] })], { width: 5500, fill: C.lgGreen, borders: allBorder(borderBlk) }),
        ]),
      ],
    }),

    spacer(120, 0),

    /* ── AI 엔진 비교 ── */
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: '▶ AI 엔진 비교', bold: true, size: 24, color: C.navy, font: '맑은 고딕' })],
    }),

    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [2200, 2200, 2200, 3206],
      rows: [
        tableRow([
          cell('OpenAI (GPT-4o)', { width: 2200, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
          cell('Gemini (Google)', { width: 2200, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
          cell('Claude (Anthropic)', { width: 2200, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
          cell('키 없음 (무료)', { width: 3206, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
        ], true),
        tableRow([
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 80 }, children: [
            new TextRun({ text: '추천 모델: gpt-4.1-mini\n', size: 19, color: C.navy, bold: true, font: '맑은 고딕' }),
            new TextRun({ text: 'Whisper STT 지원\n녹음→텍스트 최고품질\n회당 약 8~30원', size: 18, color: C.black, font: '맑은 고딕' }),
          ] })], { width: 2200, fill: C.lightBl, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 80 }, children: [
            new TextRun({ text: '추천 모델: gemini-2.5-pro\n', size: 19, color: C.navy, bold: true, font: '맑은 고딕' }),
            new TextRun({ text: '오디오 직접 분석\n무료 할당량 제공\n할당량 초과 시 유료', size: 18, color: C.black, font: '맑은 고딕' }),
          ] })], { width: 2200, fill: C.lightBl, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 80 }, children: [
            new TextRun({ text: '추천 모델: claude-haiku-4.5\n', size: 19, color: C.navy, bold: true, font: '맑은 고딕' }),
            new TextRun({ text: '녹음 STT→브라우저 대체\n협의록 품질 우수\n회당 약 3~100원', size: 18, color: C.black, font: '맑은 고딕' }),
          ] })], { width: 2200, fill: C.lightBl, borders: allBorder(borderBlk) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 80 }, children: [
            new TextRun({ text: '완전 무료·오프라인\n', size: 19, color: C.green, bold: true, font: '맑은 고딕' }),
            new TextRun({ text: 'AI 없이 양식만 정리\n회의 내용 그대로 표 정리\nAPI 키 불필요', size: 18, color: C.black, font: '맑은 고딕' }),
          ] })], { width: 3206, fill: C.lgGreen, borders: allBorder(borderBlk) }),
        ]),
      ],
    }),

    spacer(120, 0),

    /* ── 자주 묻는 질문 3가지 ── */
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: '▶ 자주 묻는 질문 (Quick FAQ)', bold: true, size: 24, color: C.navy, font: '맑은 고딕' })],
    }),

    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [4200, 5606],
      rows: [
        tableRow([
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: 'Q. ', bold: true, size: 22, color: C.red, font: '맑은 고딕' }),
            new TextRun({ text: '녹음이 텍스트로 변환이 안 돼요', bold: true, size: 20, color: C.black, font: '맑은 고딕' }),
          ] })], { width: 4200, fill: C.gray, borders: allBorder(border2) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: 'A. ', bold: true, size: 22, color: C.blue, font: '맑은 고딕' }),
            new TextRun({ text: '실시간 녹음은 브라우저 무료 인식 사용(한계 있음). 파일 첨부 탭에서 오디오 파일 업로드 후 Whisper(OpenAI 키) 또는 Gemini 엔진으로 변환하면 정확도가 높습니다.', size: 19, color: C.black, font: '맑은 고딕' }),
          ] })], { width: 5606, borders: allBorder(border2) }),
        ]),
        tableRow([
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: 'Q. ', bold: true, size: 22, color: C.red, font: '맑은 고딕' }),
            new TextRun({ text: 'API 키는 어디서 받나요?', bold: true, size: 20, color: C.black, font: '맑은 고딕' }),
          ] })], { width: 4200, fill: C.gray, borders: allBorder(border2) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: 'A. ', bold: true, size: 22, color: C.blue, font: '맑은 고딕' }),
            new TextRun({ text: 'OpenAI: platform.openai.com/api-keys  /  Gemini: ai.google.dev  /  Claude: anthropic.com/api  (각 사이트에서 회원가입 후 발급, AI 설정 창에 링크 있음)', size: 19, color: C.black, font: '맑은 고딕' }),
          ] })], { width: 5606, borders: allBorder(border2) }),
        ]),
        tableRow([
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: 'Q. ', bold: true, size: 22, color: C.red, font: '맑은 고딕' }),
            new TextRun({ text: '협의록이 저장이 안 되는 것 같아요', bold: true, size: 20, color: C.black, font: '맑은 고딕' }),
          ] })], { width: 4200, fill: C.gray, borders: allBorder(border2) }),
          cell([new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, indent: { left: 100 }, children: [
            new TextRun({ text: 'A. ', bold: true, size: 22, color: C.blue, font: '맑은 고딕' }),
            new TextRun({ text: '협의록 생성 후 자동으로 브라우저 보관함에 저장됩니다. [📂 협의록 불러오기] 버튼으로 확인하세요. 브라우저 캐시를 지우면 삭제될 수 있으니 엑셀로 다운로드해 두는 것을 권장합니다.', size: 19, color: C.black, font: '맑은 고딕' }),
          ] })], { width: 5606, borders: allBorder(border2) }),
        ]),
      ],
    }),
  ];
}

/* == 상세 설명서 ============================================== */
function makeDetailPages() {
  const W = 11906 - 1440 * 2;

  const items = [];

  /* ─── 1장: 시작하기 ─── */
  items.push(chapterTitle(1, '시작하기'));

  items.push(sectionTitle('1.1 접속 방법'));
  items.push(para('본 프로그램은 별도의 소프트웨어 설치 없이 웹 브라우저에서 바로 사용합니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [tableRow([cell([
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [
        new TextRun({ text: '접속 주소:  ', bold: true, size: 22, color: C.black, font: '맑은 고딕' }),
        new TextRun({ text: 'https://cjhong7.github.io/Meeting-Minutes/', bold: true, size: 24, color: C.blue, font: '맑은 고딕' }),
      ] }),
    ], { width: W, fill: C.lightBl, borders: allBorder(border1) })])],
  }));
  items.push(spacer(80, 0));
  items.push(bullet('크롬(Chrome) 또는 엣지(Edge) 브라우저의 주소창에 위 주소를 입력하고 Enter를 누릅니다.', 0, { size: 20 }));
  items.push(bullet('인터넷 연결이 필요합니다. (AI 기능 사용 시 필수, 보관함 조회는 오프라인 가능)', 0, { size: 20 }));
  items.push(bullet('모바일 기기에서도 접속 가능하나, 화면 크기 및 일부 기능(폴더 지정)이 제한될 수 있습니다.', 0, { size: 20 }));

  items.push(sectionTitle('1.2 첫 실행 시 이용 안내'));
  items.push(para('처음 접속하면 이용 안내 및 동의 팝업이 표시됩니다. 아래 내용을 확인 후 [확인하고 시작하기]를 클릭합니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [480, W - 480],
    rows: [
      tableRow([
        cell('확인', { width: 480, fill: C.midBl, bold: true, borders: allBorder(border2) }),
        cell('회의 녹음·문서·필기 등 원본 데이터는 사용자 기기에만 저장됨', { width: W - 480, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell('확인', { width: 480, fill: C.midBl, bold: true, borders: allBorder(border2) }),
        cell('AI 협의록 생성 시에만 입력 내용이 OpenAI·Gemini·Claude 서버로 전송됨', { width: W - 480, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell('주의', { width: 480, fill: '#FFE699', bold: true, borders: allBorder(border2) }),
        cell('학생 개인정보 입력에 주의, 녹음 전 참석자 동의 필수', { width: W - 480, borders: allBorder(border2) }),
      ]),
    ],
  }));

  items.push(sectionTitle('1.3 화면 구성'));
  items.push(para('화면은 크게 두 영역으로 나뉩니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [2400, W - 2400],
    rows: [
      tableRow([
        cell('영역', { width: 2400, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
        cell('설명', { width: W - 2400, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
      ], true),
      tableRow([
        cell('상단 헤더', { width: 2400, fill: C.midBl, bold: true, borders: allBorder(border2) }),
        cell('앱 제목, ⚙ AI 설정 버튼, 4단계 사용 가이드 표시', { width: W - 2400, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell('도구바', { width: 2400, fill: C.midBl, bold: true, borders: allBorder(border2) }),
        cell('새로작성 / 보관함 폴더 지정 / 협의록 불러오기 / 엑셀 다운로드 버튼', { width: W - 2400, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell('1쪽 (왼쪽, 입력 패널)', { width: 2400, fill: C.lightBl, bold: true, borders: allBorder(border2) }),
        cell('회의 정보, 안건, 참석자, 작성 방식 선택, 내용 입력 영역', { width: W - 2400, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell('2쪽 (오른쪽, 미리보기)', { width: 2400, fill: C.lightBl, bold: true, borders: allBorder(border2) }),
        cell('생성된 협의록 미리보기 (인쇄 시 이 영역이 출력됨)', { width: W - 2400, borders: allBorder(border2) }),
      ]),
    ],
  }));
  items.push(spacer(60, 0));
  items.push(para('※ 태블릿·소형 화면: 상단 탭 버튼으로 "1쪽 입력" / "2쪽 미리보기" 전환', { size: 19, color: C.dkGray }));

  /* ─── 2장: AI 설정 ─── */
  items.push(chapterTitle(2, 'AI 설정 (⚙ 버튼)'));

  items.push(sectionTitle('2.1 AI 엔진 선택'));
  items.push(para('상단 헤더의 [⚙] 아이콘 버튼을 클릭하면 AI 엔진 설정 창이 열립니다. 사용할 엔진을 하나 선택합니다.', { size: 20 }));
  items.push(spacer(80, 0));
  items.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [2000, 2400, 2400, 2000],
    rows: [
      tableRow([
        cell('엔진', { width: 2000, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
        cell('특징', { width: 2400, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
        cell('STT (음성인식)', { width: 2400, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
        cell('비용', { width: 2000, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
      ], true),
      tableRow([
        cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: 'OpenAI\n(GPT-4o)', bold: true, size: 20, color: C.navy, font: '맑은 고딕' })] })],
          { width: 2000, fill: C.lightBl, borders: allBorder(border2) }),
        cell('최고 품질 협의록 작성', { width: 2400, borders: allBorder(border2) }),
        cell('Whisper API 지원\n(오디오 파일 변환)', { width: 2400, borders: allBorder(border2) }),
        cell('회당 약 8~30원\n(녹음 60분 ~490원)', { width: 2000, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: 'Gemini\n(Google)', bold: true, size: 20, color: C.navy, font: '맑은 고딕' })] })],
          { width: 2000, fill: C.lightBl, borders: allBorder(border2) }),
        cell('높은 품질, 오디오 직접 분석', { width: 2400, borders: allBorder(border2) }),
        cell('오디오 파일 직접 입력\n(base64 변환 후 전송)', { width: 2400, borders: allBorder(border2) }),
        cell('무료 할당량 있음\n(초과 시 유료)', { width: 2000, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: 'Claude\n(Anthropic)', bold: true, size: 20, color: C.navy, font: '맑은 고딕' })] })],
          { width: 2000, fill: C.lightBl, borders: allBorder(border2) }),
        cell('높은 품질, 자연스러운 문체', { width: 2400, borders: allBorder(border2) }),
        cell('녹음 STT → 브라우저\n음성인식으로 자동 대체', { width: 2400, borders: allBorder(border2) }),
        cell('회당 약 3~100원\n(모델별 상이)', { width: 2000, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: '키 없음\n(시뮬레이션)', bold: true, size: 20, color: C.green, font: '맑은 고딕' })] })],
          { width: 2000, fill: C.lgGreen, borders: allBorder(border2) }),
        cell('AI 없이 양식 정리만', { width: 2400, fill: C.lgGreen, borders: allBorder(border2) }),
        cell('지원 안 됨', { width: 2400, fill: C.lgGreen, borders: allBorder(border2) }),
        cell('완전 무료', { width: 2000, fill: C.lgGreen, bold: true, borders: allBorder(border2) }),
      ]),
    ],
  }));

  items.push(sectionTitle('2.2 API 키 입력'));
  items.push(para('AI 엔진을 선택하면 해당 엔진의 API 키 입력란이 표시됩니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(numbered(1, '엔진 라디오 버튼 선택 → 아래에 API 키 입력란 자동 표시', { size: 20 }));
  items.push(numbered(2, '키 입력 후 사용 범위 선택: "이 기기에서 계속 키 사용" 또는 "이번에만 키 사용"', { size: 20 }));
  items.push(numbered(3, '[설정 저장] 버튼 클릭 → 키는 암호화되어 브라우저에만 저장', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(para('※ API 키는 암호화(crypto.subtle)되어 브라우저 내부에만 저장되며, 외부 서버로 전송되지 않습니다.', { size: 19, color: C.dkGray }));
  items.push(para('※ [보기] 버튼으로 입력한 키를 확인할 수 있습니다.', { size: 19, color: C.dkGray }));

  items.push(sectionTitle('2.3 API 키 발급 방법'));
  items.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [1800, W - 1800],
    rows: [
      tableRow([
        cell('OpenAI', { width: 1800, fill: C.lightBl, bold: true, borders: allBorder(border2) }),
        cell('platform.openai.com/api-keys  → 회원가입 → API Keys → [Create new secret key]', { width: W - 1800, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell('Gemini', { width: 1800, fill: C.lightBl, bold: true, borders: allBorder(border2) }),
        cell('ai.google.dev  → Google 계정 로그인 → [Get API key] → 프로젝트 선택 후 발급', { width: W - 1800, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell('Claude', { width: 1800, fill: C.lightBl, bold: true, borders: allBorder(border2) }),
        cell('anthropic.com/api  → 회원가입 → [Get API Keys] → [Create Key]', { width: W - 1800, borders: allBorder(border2) }),
      ]),
    ],
  }));
  items.push(spacer(60, 0));
  items.push(para('※ AI 설정 창 내 각 엔진 옆 [🔗 API 키 받으러 가기] 링크를 클릭해도 바로 이동합니다.', { size: 19, color: C.dkGray }));

  items.push(sectionTitle('2.4 사용량 및 비용 모니터링'));
  items.push(para('AI 설정 창 하단에 "이번 달 추정 비용"이 표시됩니다. 이는 이 기기에서 사용한 토큰 수를 기반으로 한 추정값이며, 실제 청구 금액은 각 AI 사의 대시보드에서 확인해야 합니다.', { size: 20 }));

  /* ─── 3장: 회의 정보 입력 ─── */
  items.push(chapterTitle(3, '회의 정보 입력'));

  items.push(sectionTitle('3.1 기본 정보'));
  items.push(para('화면 왼쪽 입력 패널 상단 "회의 정보" 영역에서 다음을 입력합니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [2000, W - 2000],
    rows: [
      tableRow([
        cell('항목', { width: 2000, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
        cell('입력 방법 및 설명', { width: W - 2000, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
      ], true),
      tableRow([
        cell('회의명', { width: 2000, fill: C.lightBl, bold: true, borders: allBorder(border2) }),
        cell('협의회 명칭 입력 (예: 교육과정 협의회, 학년협의회). 협의록 제목 및 파일명으로 사용됨.', { width: W - 2000, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell('날짜', { width: 2000, fill: C.lightBl, bold: true, borders: allBorder(border2) }),
        cell('날짜 선택기 클릭 → 달력에서 선택. 자동으로 오늘 날짜로 설정됨.', { width: W - 2000, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell('시작 시간', { width: 2000, fill: C.lightBl, bold: true, borders: allBorder(border2) }),
        cell('회의 시작 시각 입력 (선택 사항)', { width: W - 2000, borders: allBorder(border2) }),
      ]),
      tableRow([
        cell('장소', { width: 2000, fill: C.lightBl, bold: true, borders: allBorder(border2) }),
        cell('회의 장소 입력 (예: 교무실, 회의실, 도서관)', { width: W - 2000, borders: allBorder(border2) }),
      ]),
    ],
  }));

  items.push(sectionTitle('3.2 안건 입력'));
  items.push(numbered(1, '"안건" 섹션의 입력란에 안건을 입력합니다.', { size: 20 }));
  items.push(numbered(2, '[＋ 안건 추가] 버튼으로 안건을 여러 개 추가할 수 있습니다.', { size: 20 }));
  items.push(numbered(3, '각 안건 옆 [×] 버튼으로 삭제 가능합니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(para('※ 안건 내용은 AI가 협의록을 생성할 때 참고 정보로 활용됩니다.', { size: 19, color: C.dkGray }));

  items.push(sectionTitle('3.3 참석자 입력'));
  items.push(numbered(1, '"참석자" 섹션에서 [−] / [＋] 버튼으로 참석자 수를 조절합니다. (최소 1명, 최대 16명)', { size: 20 }));
  items.push(numbered(2, '각 칸에 참석자 이름을 입력합니다.', { size: 20 }));
  items.push(numbered(3, '8명 이하: 1행으로 표시, 9~16명: 자동으로 2행으로 분리', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(para('※ 이름을 입력하면 오른쪽 미리보기에서 서명란과 함께 실시간으로 확인할 수 있습니다.', { size: 19, color: C.dkGray }));

  /* ─── 4장: 작성 방식 ─── */
  items.push(chapterTitle(4, '작성 방식 선택 및 사용'));

  items.push(para('화면 왼쪽 "작성 방식" 섹션에서 아래 4가지 방식 중 하나를 선택합니다. 한 번에 하나의 방식만 사용할 수 있습니다.', { size: 20 }));
  items.push(spacer(80, 0));

  items.push(subTitle('4-1. 타자 모드 ⌨  (기본 추천)'));
  items.push(para('회의 내용을 직접 키보드로 입력하는 방식입니다. 가장 간단하며 추천합니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(bullet('[협의안건] 버튼: 커서 위치에 "[협의안건]" 태그 삽입 → AI가 해당 안건 결과를 별도 구분', 0, { size: 20 }));
  items.push(bullet('[전달사항] 버튼: "[전달사항]" 태그 삽입 → 전달 내용을 구분하여 정리', 0, { size: 20 }));
  items.push(bullet('[🎤 받아쓰기] 버튼: 클릭 시 브라우저 음성인식 활성화 → 말하면 텍스트로 자동 입력', 0, { size: 20 }));
  items.push(bullet('태그 없이 자유롭게 입력해도 AI가 자동으로 구조화하여 협의록을 작성합니다.', 0, { size: 20 }));
  items.push(spacer(60, 0));
  items.push(para('Tip. 예시 입력 방법:', { size: 20, bold: true }));
  items.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [tableRow([cell([
      new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 40 }, indent: { left: 100 }, children: [new TextRun({ text: '[협의안건] 2학기 수업시수 조정 건', size: 20, font: 'Courier New', color: C.navy })] }),
      new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 40 }, indent: { left: 100 }, children: [new TextRun({ text: '교과별 시수를 확인하고 국어 1시간 감축, 창체 1시간 증가로 조정하기로 결정', size: 20, font: 'Courier New', color: C.black })] }),
      new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 60 }, indent: { left: 100 }, children: [new TextRun({ text: '[전달사항] 다음 주 화요일 교직원 회의 참석 필수', size: 20, font: 'Courier New', color: C.navy })] }),
    ], { width: W, fill: C.gray, borders: allBorder(border2) })])],
  }));

  items.push(spacer(100, 0));
  items.push(subTitle('4-2. 녹음 모드 🎤'));
  items.push(para('마이크로 회의를 녹음하거나, 미리 녹음한 오디오 파일을 텍스트로 변환합니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(bullet('실시간 녹음 탭: 마이크 연결 확인 후 [녹음 시작] → 회의 진행 → [녹음 정지]', 0, { size: 20 }));
  items.push(bullet('- 브라우저가 자동으로 음성을 텍스트로 변환합니다(무료, 정확도 보통)', 1, { size: 19 }));
  items.push(bullet('- 최대 3시간, 초과 시 자동 정지', 1, { size: 19 }));
  items.push(bullet('- 녹음이 끝나면 [⬇ 녹음 파일 다운로드] 버튼으로 오디오 파일 보관 가능', 1, { size: 19 }));
  items.push(bullet('파일 첨부 탭: 오디오 파일(MP3, M4A, WAV, WebM, OGG)을 드래그하거나 클릭하여 업로드', 0, { size: 20 }));
  items.push(bullet('- Whisper 선택 시 OpenAI API 키 필요, Gemini 선택 시 Gemini API 키 필요', 1, { size: 19 }));
  items.push(bullet('- 25MB 이하 파일 권장 (Whisper 기준)', 1, { size: 19 }));
  items.push(bullet('STT 결과 텍스트는 편집 가능합니다. 오인식된 내용을 수정 후 협의록 생성 가능', 0, { size: 20 }));

  items.push(spacer(100, 0));
  items.push(subTitle('4-3. 계획서 모드 📄'));
  items.push(para('기존에 작성된 계획서(HWPX·PDF·DOCX)를 업로드하여 협의록을 생성합니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(bullet('파일을 끌어다 놓거나 클릭하여 파일을 선택합니다.', 0, { size: 20 }));
  items.push(bullet('여러 파일을 동시에 업로드할 수 있으며, 텍스트가 자동으로 추출됩니다.', 0, { size: 20 }));
  items.push(bullet('추출된 텍스트는 편집 가능합니다. 불필요한 내용을 삭제하거나 내용을 추가할 수 있습니다.', 0, { size: 20 }));
  items.push(spacer(60, 0));
  items.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [1600, W - 1600],
    rows: [
      tableRow([
        cell('파일 형식', { width: 1600, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
        cell('지원 방법 및 주의사항', { width: W - 1600, fill: C.navy, bold: true, borders: allBorder(borderBlk) }),
      ], true),
      tableRow([cell('HWPX', { width: 1600, fill: C.lightBl, bold: true, borders: allBorder(border2) }), cell('한글(HWP) 최신 형식. *.hwpx 파일 직접 업로드 가능. 구형 .hwp는 한글에서 [파일 → 다른 이름으로 저장 → .hwpx] 변환 후 업로드', { width: W - 1600, borders: allBorder(border2) })]),
      tableRow([cell('PDF', { width: 1600, fill: C.lightBl, bold: true, borders: allBorder(border2) }), cell('텍스트 PDF만 지원. 이미지로 스캔된 PDF는 텍스트 추출이 안 될 수 있습니다.', { width: W - 1600, borders: allBorder(border2) })]),
      tableRow([cell('DOCX', { width: 1600, fill: C.lightBl, bold: true, borders: allBorder(border2) }), cell('Microsoft Word 문서. 바로 업로드 가능합니다.', { width: W - 1600, borders: allBorder(border2) })]),
    ],
  }));

  items.push(spacer(100, 0));
  items.push(subTitle('4-4. 펜 모드 ✏'));
  items.push(para('터치 화면이나 마우스로 직접 손글씨를 쓰고, AI OCR로 텍스트를 추출합니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(bullet('펜 도구: ✏ 펜 / 🧽 지우개 선택, 굵기·색상 설정 가능', 0, { size: 20 }));
  items.push(bullet('↩ 실행취소 / ↪ 다시실행 / 🗑 전체 지우기', 0, { size: 20 }));
  items.push(bullet('[텍스트 추출 (OCR)] 버튼: AI(선택한 엔진)가 손글씨를 텍스트로 변환', 0, { size: 20 }));
  items.push(bullet('손바닥 오터치 방지: 체크 시 터치 입력만 인식 (펜 전용 모드)', 0, { size: 20 }));
  items.push(bullet('OCR 결과는 정확하지 않을 수 있으므로 추출 후 수정하고 협의록 생성 진행', 0, { size: 20 }));

  /* ─── 5장: 협의록 생성 ─── */
  items.push(chapterTitle(5, '협의록 생성'));

  items.push(para('회의 정보와 내용 입력이 완료되면 [협의록 생성 →] 버튼을 클릭합니다.', { size: 20 }));
  items.push(spacer(80, 0));

  items.push(sectionTitle('5.1 생성 절차'));
  items.push(numbered(1, '[협의록 생성 →] 버튼 클릭', { size: 20 }));
  items.push(numbered(2, 'AI 전송 확인 팝업이 표시됩니다. 사용 엔진, 예상 비용, 전송 안내를 확인합니다.', { size: 20 }));
  items.push(numbered(3, '[생성하기] 클릭 → AI가 학교 공문 양식으로 협의록을 자동 작성합니다.', { size: 20 }));
  items.push(numbered(4, '생성 완료 후 오른쪽 미리보기 패널에서 결과를 확인합니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(para('※ "키 없음(로컬 시뮬레이션)" 모드에서는 AI 없이 입력 내용을 양식에 정리만 합니다.', { size: 19, color: C.dkGray }));

  items.push(sectionTitle('5.2 AI 후처리 (자동 적용)'));
  items.push(para('AI 응답은 학교 공문 양식에 맞게 자동 후처리됩니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(bullet('마크다운 기호(#, **, **, -, ---) 자동 제거', 0, { size: 20 }));
  items.push(bullet('번호 체계 정규화 (①→1., (1)→1., (가)→가.)', 0, { size: 20 }));
  items.push(bullet('어미 변환 (합니다→함, 됩니다→됨, 예정입니다→예정임)', 0, { size: 20 }));
  items.push(bullet('들여쓰기 정리 및 빈 줄 축소', 0, { size: 20 }));

  /* ─── 6장: 내보내기 ─── */
  items.push(chapterTitle(6, '내보내기'));

  items.push(sectionTitle('6.1 인쇄'));
  items.push(numbered(1, '미리보기 영역 상단 [🖨 인쇄] 버튼 클릭', { size: 20 }));
  items.push(numbered(2, '브라우저 인쇄 대화상자가 열립니다. A4 용지, 세로 방향으로 설정 후 인쇄', { size: 20 }));
  items.push(numbered(3, '협의록 양식(제목·일시·장소·참석자·안건·본문)이 포함된 완성된 양식이 출력됩니다.', { size: 20 }));

  items.push(sectionTitle('6.2 엑셀 다운로드'));
  items.push(numbered(1, '협의록 생성 후 상단 도구바의 [📊 엑셀 다운로드] 버튼 활성화', { size: 20 }));
  items.push(numbered(2, '클릭 시 엑셀(.xlsx 또는 .csv) 형식의 파일이 다운로드됩니다.', { size: 20 }));
  items.push(numbered(3, '엑셀에서 내용 수정·편집이 자유롭게 가능합니다.', { size: 20 }));

  items.push(sectionTitle('6.3 워드 다운로드'));
  items.push(numbered(1, '미리보기 영역에서 워드 다운로드 버튼 클릭 시 .doc 파일이 저장됩니다.', { size: 20 }));
  items.push(numbered(2, 'Microsoft Word 및 한글(HWP)에서 직접 열어 편집 가능합니다.', { size: 20 }));
  items.push(numbered(3, '협의록 표 구조(회의명·일시·장소·참석자·안건·회의내용) 그대로 포함됩니다.', { size: 20 }));

  /* ─── 7장: 보관함 ─── */
  items.push(chapterTitle(7, '보관함 활용'));

  items.push(sectionTitle('7.1 자동 저장'));
  items.push(para('협의록이 생성되면 브라우저 내부 저장소(IndexedDB)에 자동으로 저장됩니다. 인터넷 연결 없이도 이전 협의록을 조회할 수 있습니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(para('⚠ 주의: 브라우저 캐시 및 사이트 데이터를 삭제하면 보관된 협의록도 함께 삭제됩니다. 중요한 협의록은 반드시 엑셀 또는 워드로 다운로드해 별도 보관하세요.', { size: 20, color: C.red }));

  items.push(sectionTitle('7.2 협의록 불러오기'));
  items.push(numbered(1, '상단 도구바 [📂 협의록 불러오기] 클릭', { size: 20 }));
  items.push(numbered(2, '보관함 팝업에서 회의명, 안건, 일시로 검색 가능', { size: 20 }));
  items.push(numbered(3, '해당 협의록을 클릭하면 모든 입력 정보와 협의록 내용이 복원됩니다.', { size: 20 }));

  items.push(sectionTitle('7.3 클라우드 백업 연동'));
  items.push(para('PC의 구글 드라이브 또는 원드라이브 동기화 폴더를 보관함으로 지정하면 자동 백업이 됩니다.', { size: 20 }));
  items.push(spacer(60, 0));
  items.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [1800, W - 1800],
    rows: [
      tableRow([cell('구글 드라이브', { width: 1800, fill: C.lightBl, bold: true, borders: allBorder(border2) }), cell('Google Drive for Desktop 설치 → PC에 드라이브 폴더 생성 → [📁 보관함 폴더 지정]에서 해당 폴더 선택', { width: W - 1800, borders: allBorder(border2) })]),
      tableRow([cell('원드라이브', { width: 1800, fill: C.lightBl, bold: true, borders: allBorder(border2) }), cell('Windows 기본 OneDrive 로그인 → OneDrive 폴더 확인 → [📁 보관함 폴더 지정]에서 해당 폴더 선택', { width: W - 1800, borders: allBorder(border2) })]),
    ],
  }));
  items.push(spacer(60, 0));
  items.push(para('※ 폴더 지정 기능은 데스크톱 Chrome/Edge에서만 지원합니다. 모바일에서는 다운로드 폴더에 저장됩니다.', { size: 19, color: C.dkGray }));

  /* ─── 8장: FAQ ─── */
  items.push(chapterTitle(8, '자주 묻는 질문 (FAQ)'));

  const faqs = [
    {
      q: 'API 키가 없어도 사용할 수 있나요?',
      a: '네, 가능합니다. AI 설정에서 "키 없음(로컬 시뮬레이션)"을 선택하면 AI 없이도 입력한 내용을 학교 협의록 양식으로 정리해 줍니다. 다만, 자연스러운 문체로 내용을 구조화하는 AI 기능은 사용할 수 없습니다.',
    },
    {
      q: '협의록이 생성되었는데 오른쪽 미리보기에 안 보여요.',
      a: '태블릿이나 소형 화면의 경우 화면 상단의 탭 버튼에서 "2쪽 미리보기"를 클릭하면 확인할 수 있습니다.',
    },
    {
      q: '녹음 중 화면이 꺼질 것 같아요.',
      a: '녹음 모드 실행 시 브라우저 Wake Lock 기능이 활성화되어 화면이 꺼지는 것을 방지합니다. 단, 일부 환경에서는 지원되지 않을 수 있으니 장시간 녹음 시 전원 연결을 권장합니다.',
    },
    {
      q: '한글(.hwp) 파일은 업로드가 안 되나요?',
      a: '구형 .hwp 형식은 지원하지 않습니다. 한글 프로그램에서 [파일 → 다른 이름으로 저장] 후 형식을 .hwpx로 변경하여 저장한 뒤 업로드해 주세요.',
    },
    {
      q: '협의록 내용을 수정하고 싶어요.',
      a: '현재 버전에서는 미리보기 영역의 내용을 직접 편집하는 기능이 없습니다. 엑셀 또는 워드로 다운로드한 후 수정하거나, 타자 모드에서 내용을 수정 후 다시 생성하는 방법을 사용하세요.',
    },
    {
      q: '새 브라우저로 접속했더니 이전 협의록이 없어요.',
      a: '보관함은 브라우저별로 별도 저장됩니다. 이전에 사용한 브라우저에서 접속해야 저장된 협의록을 볼 수 있습니다. 다른 기기나 브라우저에서 사용하려면 엑셀/워드 파일로 백업하거나 클라우드 폴더를 보관함으로 지정하세요.',
    },
    {
      q: '여러 명이 함께 협의록을 작성할 수 있나요?',
      a: '현재 버전은 단일 기기에서 작성하는 방식입니다. 완성된 협의록을 엑셀 또는 워드로 공유하거나, 구글 드라이브에 백업하여 공유하시기 바랍니다.',
    },
    {
      q: '인터넷 없이도 사용 가능한가요?',
      a: '"키 없음(시뮬레이션)" 모드와 보관함 조회는 오프라인에서도 가능합니다. 단, AI 협의록 생성·STT 음성인식·파일 첨부 STT 변환은 인터넷 연결이 필요합니다.',
    },
  ];

  faqs.forEach((faq, i) => {
    items.push(new Paragraph({
      spacing: { before: i === 0 ? 0 : 120, after: 40 },
      indent: { left: 100 },
      children: [
        new TextRun({ text: `Q${i + 1}. `, bold: true, size: 22, color: C.red, font: '맑은 고딕' }),
        new TextRun({ text: faq.q, bold: true, size: 22, color: C.black, font: '맑은 고딕' }),
      ],
    }));
    items.push(new Paragraph({
      spacing: { before: 40, after: 80 },
      indent: { left: 200 },
      children: [
        new TextRun({ text: 'A. ', bold: true, size: 21, color: C.blue, font: '맑은 고딕' }),
        new TextRun({ text: faq.a, size: 20, color: C.black, font: '맑은 고딕' }),
      ],
    }));
  });

  /* ─── 9장: 개인정보·보안 ─── */
  items.push(chapterTitle(9, '개인정보 및 보안 안내'));

  items.push(sectionTitle('9.1 데이터 저장 정책'));
  items.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [2800, W - 2800],
    rows: [
      tableRow([cell('데이터 종류', { width: 2800, fill: C.navy, bold: true, borders: allBorder(borderBlk) }), cell('저장 위치 및 정책', { width: W - 2800, fill: C.navy, bold: true, borders: allBorder(borderBlk) })], true),
      tableRow([cell('회의 입력 내용 (타자/펜/계획서)', { width: 2800, fill: C.lightBl, borders: allBorder(border2) }), cell('사용자 기기 브라우저(IndexedDB·OPFS)에만 저장. 개발자 서버 미경유.', { width: W - 2800, borders: allBorder(border2) })]),
      tableRow([cell('녹음 파일', { width: 2800, fill: C.lightBl, borders: allBorder(border2) }), cell('기기 브라우저 메모리에만 보관. 다운로드 버튼으로 직접 저장 필요.', { width: W - 2800, borders: allBorder(border2) })]),
      tableRow([cell('AI 협의록 생성 시', { width: 2800, fill: '#FFE699', borders: allBorder(border2) }), cell('입력 텍스트(회의 내용, 안건)가 OpenAI·Gemini·Claude 서버로 전송됩니다. ※ 개인정보·학생정보가 포함되지 않도록 주의하세요.', { width: W - 2800, borders: allBorder(border2) })]),
      tableRow([cell('API 키', { width: 2800, fill: C.lightBl, borders: allBorder(border2) }), cell('crypto.subtle로 암호화하여 IndexedDB에 저장. 평문으로 저장·전송되지 않습니다.', { width: W - 2800, borders: allBorder(border2) })]),
    ],
  }));

  items.push(sectionTitle('9.2 개인정보 보호 수칙'));
  items.push(bullet('학생 이름, 성적, 개인 정보는 회의 내용에 입력하지 않도록 주의하세요.', 0, { size: 20 }));
  items.push(bullet('녹음 시작 전 반드시 참석자 전원의 동의를 받으세요.', 0, { size: 20 }));
  items.push(bullet('API 키를 타인과 공유하지 마세요. 유출 시 과금 피해가 발생할 수 있습니다.', 0, { size: 20 }));
  items.push(bullet('공용 PC에서는 "이번에만 키 사용" 옵션을 선택하세요.', 0, { size: 20 }));
  items.push(bullet('협의록 다운로드 파일은 학교 문서 보안 정책에 따라 관리하세요.', 0, { size: 20 }));

  items.push(sectionTitle('9.3 책임 한계'));
  items.push(para('본 프로그램은 교사 개인이 무료로 개발·배포하는 서비스입니다. 데이터 손실, API 키 유출, AI 생성 오류, 서비스 중단 등에 대해 개발자는 법적 책임을 지지 않습니다. 학교 업무에 활용 시 AI 생성 내용을 반드시 검토·수정하여 사용하시기 바랍니다.', { size: 20 }));

  return items;
}

/* ───────────────────────────────────────────────
   문서 조립
   ─────────────────────────────────────────────── */
function buildDoc() {
  const pageMargin = { top: 1008, right: 1008, bottom: 1008, left: 1008 }; // 약 1.8cm

  const footerContent = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: '학교 협의록 작성기 사용설명서  |  ', size: 16, color: C.dkGray, font: '맑은 고딕' }),
          new TextRun({ text: 'https://cjhong7.github.io/Meeting-Minutes/  |  페이지 ', size: 16, color: C.dkGray, font: '맑은 고딕' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.dkGray, font: '맑은 고딕' }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: pageMargin,
          },
        },
        footers: { default: footerContent },
        children: [
          ...makeCoverPage(),
          ...makeSummaryPage(),
          ...makeDetailPages(),
        ],
      },
    ],
  });

  return doc;
}

/* ───────────────────────────────────────────────
   실행
   ─────────────────────────────────────────────── */
const doc = buildDoc();
const OUTPUT = 'C:/Users/user/Desktop/2026 연구학교 관련/warp-project/anti-conver/학교_협의록_작성기_사용설명서.docx';

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT, buf);
  console.log('✅ 생성 완료:', OUTPUT);
}).catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
