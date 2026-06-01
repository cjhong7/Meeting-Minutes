/**
 * modes/plan.js — 계획서 모드
 *
 * 계획서 Ⅴ-2:
 *  - 드래그앤드롭/클릭 파일 업로드 (여러 개 동시 허용)
 *  - PDF  → pdf.js (텍스트 PDF)
 *  - DOCX → mammoth.js
 *  - HWPX → JSZip + section XML 파싱 (실패 시 붙여넣기 폴백)
 *  - 추출 텍스트 편집 가능 미리보기
 *
 * 라이브러리: pdf.js, mammoth.js, JSZip (CDN 동적 로딩)
 */

import { setState } from '../state.js';
import { showToast } from '../ui/toast.js';

/* ── CDN URLs ── */
const PDFJS_CDN   = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs';
const MAMMOTH_CDN = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
const JSZIP_CDN   = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

/* ============================================================
   초기화
   ============================================================ */
export function initPlanMode() {
  bindDrop();
  bindTextSync();
}

/* ── 드래그앤드롭 + 클릭 ── */
function bindDrop() {
  const dropZone  = document.getElementById('planDropZone');
  const fileInput = document.getElementById('planFileInput');

  dropZone?.addEventListener('click', () => fileInput?.click());
  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  fileInput?.addEventListener('change', () => {
    handleFiles(fileInput.files);
    fileInput.value = '';
  });
}

/* ── 파일 처리 ── */
async function handleFiles(fileList) {
  if (!fileList?.length) return;

  const listEl = document.getElementById('planFileList');
  const extractArea = document.getElementById('planExtractArea');
  const ta = document.getElementById('planExtractText');
  if (!ta) return;

  let allText = ta.value;

  for (const file of fileList) {
    const ext = file.name.split('.').pop().toLowerCase();
    showToast(`"${file.name}" 텍스트 추출 중…`, 'info');

    try {
      let text = '';
      if (ext === 'pdf')       text = await extractPdf(file);
      else if (ext === 'docx') text = await extractDocx(file);
      else if (ext === 'hwpx') text = await extractHwpx(file);
      else { showToast(`"${file.name}": 지원하지 않는 형식입니다. (PDF, DOCX, HWPX만 가능)`, 'warn'); continue; }

      if (text.trim()) {
        if (allText.trim()) allText += '\n\n---\n\n';
        allText += `[${file.name}]\n${text.trim()}`;
        showToast(`"${file.name}" 추출 완료`, 'success');
      } else {
        showToast(`"${file.name}": 텍스트를 추출하지 못했습니다. 직접 붙여넣기를 이용해 주세요.`, 'warn');
      }

      addFileToList(file.name, text.length);
    } catch (err) {
      console.error(`[Plan] ${file.name}:`, err);
      showToast(`"${file.name}" 추출 실패: ${err.message}`, 'error');
    }
  }

  ta.value = allText;
  if (extractArea) extractArea.hidden = false;
  if (listEl) listEl.hidden = false;
  setState({ meeting: { planExtractedText: allText, isDirty: true } });
  updateCharCount();
}

function addFileToList(name, charCount) {
  const listEl = document.getElementById('planFileList');
  if (!listEl) return;
  const item = document.createElement('div');
  item.className = 'plan-file-item';
  item.textContent = `📄 ${name} — ${charCount.toLocaleString()}자`;
  listEl.appendChild(item);
}

/* ============================================================
   포맷별 추출
   ============================================================ */

async function extractPdf(file) {
  const pdfjsLib = await loadPdfJs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

async function extractDocx(file) {
  await loadScript(MAMMOTH_CDN, 'mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

async function extractHwpx(file) {
  await loadScript(JSZIP_CDN, 'JSZip');
  const data = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(data);

  // HWPX의 Contents/sectionN.xml에서 텍스트 추출
  const sectionFiles = Object.keys(zip.files)
    .filter(n => /Contents\/section\d*\.xml/i.test(n)).sort();

  let text = '';
  const targets = sectionFiles.length ? sectionFiles
    : Object.keys(zip.files).filter(n => n.endsWith('.xml'));

  for (const name of targets) {
    const content = await zip.file(name).async('text');
    text += extractTextFromXml(content) + '\n';
  }
  return text;
}

function extractTextFromXml(xmlStr) {
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
  const texts = [];
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const val = walker.currentNode.nodeValue.trim();
    if (val) texts.push(val);
  }
  return texts.join(' ').replace(/\s{3,}/g, '\n');
}

/* ── 라이브러리 로딩 ── */
let _pdfjsLoaded = false;
async function loadPdfJs() {
  if (_pdfjsLoaded && window.pdfjsLib) return window.pdfjsLib;
  const mod = await import(PDFJS_CDN);
  window.pdfjsLib = mod;
  mod.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
  _pdfjsLoaded = true;
  return mod;
}

function loadScript(url, globalName) {
  return new Promise((resolve, reject) => {
    if (window[globalName]) { resolve(); return; }
    const s = document.createElement('script');
    s.src = url; s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error(`${globalName} 로딩 실패`));
    document.head.appendChild(s);
  });
}

/* ── 텍스트 동기화 ── */
function bindTextSync() {
  const ta = document.getElementById('planExtractText');
  ta?.addEventListener('input', () => {
    setState({ meeting: { planExtractedText: ta.value, isDirty: true } });
    updateCharCount();
  });
}

function updateCharCount() {
  const ta = document.getElementById('planExtractText');
  const cc = document.getElementById('planCharCount');
  if (ta && cc) cc.textContent = ta.value.length + '자';
}
