/**
 * modes/pen.js — 펜(손글씨) 모드
 *
 * 계획서 Ⅴ-4:
 *  - 단일 캔버스 + 세로 스크롤로 공간 확보
 *  - Pointer Events (마우스·터치·스타일러스 통합)
 *  - 필압(pressure) 지원 → 선 굵기 자연스럽게
 *  - 손바닥 오터치 방지 (pointerType === 'pen'만) 옵션
 *  - 캔버스 2x DPR → 선명도 확보
 *  - 도구: 펜·지우개·굵기·색·전체지우기·Undo·Redo
 *  - [텍스트 추출]: PNG(2x) → 선택 엔진 vision → OCR 텍스트
 *  - 키 없으면 직접 입력 폴백
 */

import { appState, setState } from '../state.js';
import { showToast } from '../ui/toast.js';

/* ── 상태 ── */
let canvas, ctx;
let isDrawing   = false;
let tool        = 'pen';     // 'pen' | 'eraser'
let penColor    = '#1e2633';
let penSize     = 3;
let palmReject  = false;
let undoStack   = [];
let redoStack   = [];
const DPR       = Math.min(window.devicePixelRatio || 1, 2);

/* ============================================================
   초기화
   ============================================================ */
export function initPenMode() {
  canvas = document.getElementById('penCanvas');
  if (!canvas) return;

  setupCanvas();
  bindTools();
  bindPointerEvents();
  bindOcr();
  bindTextSync();
}

/* ── 캔버스 설정 (2x DPR) ── */
function setupCanvas() {
  const wrap = document.getElementById('penCanvasWrap');
  if (!wrap) return;

  const w = wrap.clientWidth || 600;
  const h = 800; // 세로 기본 높이

  canvas.width  = w * DPR;
  canvas.height = h * DPR;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';

  ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';

  fillWhite();
  saveUndoState();
}

function fillWhite() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);
}

/* ── 도구 바인딩 ── */
function bindTools() {
  document.getElementById('btnPenDraw')?.addEventListener('click', () => setTool('pen'));
  document.getElementById('btnPenErase')?.addEventListener('click', () => setTool('eraser'));

  document.getElementById('penSize')?.addEventListener('input', e => {
    penSize = parseInt(e.target.value, 10);
  });

  document.getElementById('penColor')?.addEventListener('input', e => {
    penColor = e.target.value;
  });

  document.getElementById('btnPenUndo')?.addEventListener('click', undo);
  document.getElementById('btnPenRedo')?.addEventListener('click', redo);
  document.getElementById('btnPenClear')?.addEventListener('click', clearCanvas);

  document.getElementById('chkPalmReject')?.addEventListener('change', e => {
    palmReject = e.target.checked;
  });
}

function setTool(t) {
  tool = t;
  document.getElementById('btnPenDraw')?.classList.toggle('pen-tool-active', t === 'pen');
  document.getElementById('btnPenErase')?.classList.toggle('pen-tool-active', t === 'eraser');
}

/* ── 포인터 이벤트 ── */
function bindPointerEvents() {
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup',   onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  // 터치 스크롤 방지
  canvas.style.touchAction = 'none';
}

function onPointerDown(e) {
  if (palmReject && e.pointerType !== 'pen') return;
  isDrawing = true;
  const { x, y } = getPos(e);

  ctx.beginPath();
  ctx.moveTo(x, y);

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = penSize * 4;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize * (0.5 + (e.pressure || 0.5));
  }
}

function onPointerMove(e) {
  if (!isDrawing) return;
  if (palmReject && e.pointerType !== 'pen') return;

  const { x, y } = getPos(e);

  if (tool === 'pen') {
    ctx.lineWidth = penSize * (0.5 + (e.pressure || 0.5));
  }

  ctx.lineTo(x, y);
  ctx.stroke();
}

function onPointerUp() {
  if (!isDrawing) return;
  isDrawing = false;
  ctx.closePath();
  ctx.globalCompositeOperation = 'source-over';
  saveUndoState();
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left),
    y: (e.clientY - rect.top),
  };
}

/* ── Undo / Redo ── */
function saveUndoState() {
  undoStack.push(canvas.toDataURL());
  if (undoStack.length > 50) undoStack.shift(); // 메모리 제한
  redoStack = [];
}

function undo() {
  if (undoStack.length <= 1) return;
  redoStack.push(undoStack.pop());
  restoreState(undoStack[undoStack.length - 1]);
}

function redo() {
  if (!redoStack.length) return;
  const state = redoStack.pop();
  undoStack.push(state);
  restoreState(state);
}

function restoreState(dataUrl) {
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
    ctx.drawImage(img, 0, 0, canvas.width / DPR, canvas.height / DPR);
  };
  img.src = dataUrl;
}

function clearCanvas() {
  fillWhite();
  saveUndoState();
  showToast('캔버스를 지웠습니다.', 'info');
}

/* ── OCR 텍스트 추출 ── */
function bindOcr() {
  document.getElementById('btnPenExtract')?.addEventListener('click', extractText);
}

async function extractText() {
  const engine = appState.aiEngine;
  if (engine === 'sim') {
    showToast('OCR에는 AI 키가 필요합니다. AI 설정에서 키를 입력하거나 텍스트를 직접 입력해 주세요.', 'warn');
    document.getElementById('penOcrArea').hidden = false;
    return;
  }

  const apiKey = sessionStorage.getItem(`anti_key_${engine}`);
  if (!apiKey) {
    showToast('AI 키가 설정되지 않았습니다. AI 설정에서 키를 입력해 주세요.', 'warn');
    document.getElementById('penOcrArea').hidden = false;
    return;
  }

  showToast('손글씨 OCR 진행 중…', 'info');

  try {
    // 캔버스 → PNG base64
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];

    let text = '';
    if (engine === 'openai') {
      text = await ocrWithOpenAI(base64, apiKey);
    } else if (engine === 'gemini') {
      text = await ocrWithGemini(base64, apiKey);
    } else if (engine === 'claude') {
      text = await ocrWithClaude(base64, apiKey);
    }

    const ta = document.getElementById('penOcrText');
    if (ta) ta.value = text;
    document.getElementById('penOcrArea').hidden = false;
    setState({ meeting: { penOcrText: text, isDirty: true } });
    showToast('OCR 완료! 결과를 확인하고 수정해 주세요.', 'success');
  } catch (err) {
    console.error('[OCR]', err);
    showToast(`OCR 실패: ${err.message}`, 'error');
    document.getElementById('penOcrArea').hidden = false;
  }
}

/* ── 엔진별 Vision OCR ── */
const OCR_PROMPT = '이 이미지는 한국어 손글씨 회의 메모입니다. 모든 텍스트를 정확하게 읽어서 원문 그대로 텍스트로 변환해 주세요. 글씨가 불분명한 부분은 [?]로 표시하세요.';

async function ocrWithOpenAI(base64, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: appState.aiQuality === 'high' ? 'gpt-4o' : 'gpt-4o-mini',
      messages: [{ role: 'user', content: [
        { type: 'text', text: OCR_PROMPT },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
      ]}],
      max_tokens: 4096,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function ocrWithGemini(base64, apiKey) {
  const model = appState.aiQuality === 'high' ? 'gemini-2.0-pro-exp-03-25' : 'gemini-2.0-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: OCR_PROMPT },
        { inline_data: { mime_type: 'image/png', data: base64 } },
      ]}],
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
}

async function ocrWithClaude(base64, apiKey) {
  const model = appState.aiQuality === 'high' ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-20250414';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model, max_tokens: 4096,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
        { type: 'text', text: OCR_PROMPT },
      ]}],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  return data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
}

/* ── 텍스트 동기화 ── */
function bindTextSync() {
  const ta = document.getElementById('penOcrText');
  ta?.addEventListener('input', () => {
    setState({ meeting: { penOcrText: ta.value, isDirty: true } });
    const cc = document.getElementById('penCharCount');
    if (cc) cc.textContent = ta.value.length + '자';
  });
}
