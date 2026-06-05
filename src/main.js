/**
 * main.js — 앱 부트스트랩 & 이벤트 바인딩
 *
 * 담당 범위 (Stage 0 / 1):
 *  - 면책 고지 최초 1회 표시
 *  - 메타 입력 → 미리보기 실시간 반영
 *  - 안건 추가/삭제
 *  - 참석자 수 조절 + 이름 입력
 *  - 작성 방식 라디오 → 모드 패널 전환
 *  - 타자 모드 초기화
 *  - 도구바 버튼 (새로작성, 내기기에저장 stub, 보관함 stub, 엑셀)
 *  - AI 설정 모달 (UI + sessionStorage 임시 저장, Stage 4에서 keystore 연결)
 *  - 협의록 생성 버튼 (AI 라우터 연동: OpenAI·Gemini·Claude + 로컬 시뮬레이션)
 *  - 인쇄 버튼
 *  - 태블릿 탭 전환
 */

import { appState, setState, resetMeeting, todayIso } from './state.js';
import { openModal, closeModal, initModalBehaviors, confirm } from './ui/modal.js';
import { showToast } from './ui/toast.js';
import { renderAttendeeInputs, updateAttendeePreview, changeAttendeeCount } from './ui/attendees.js';
import { updatePreview, showMinutes, clearMinutes, showGeneratingSpinner } from './ui/preview.js';
import { initTypingMode, stopDictationIfActive } from './modes/typing.js';
import { initVoiceMode, stopRecordingIfActive, activateVoiceMode } from './modes/voice.js';
import { initPlanMode } from './modes/plan.js';
import { initPenMode } from './modes/pen.js';

/* ============================================================
   앱 부팅
   ============================================================ */
document.addEventListener('DOMContentLoaded', boot);

function boot() {
  // 오늘 날짜 기본 세팅
  const todayInput = document.getElementById('inDate');
  if (todayInput) {
    const today = todayIso();
    todayInput.value = today;
    setState({ meeting: { date: today } });
  }

  initModalBehaviors();
  initFirstVisit();
  restoreSavedSettings();
  renderAttendeeInputs();
  updateAttendeePreview();
  updatePreview();

  bindMetaInputs();
  bindAgendaControls();
  bindAttendeeControls();
  bindModeSwitch();
  bindToolbar();
  bindGenerateBtn();
  bindAiSettingsModal();
  bindPrintBtn();
  bindTabSwitcher();
  bindBeforeUnload();
  bindArchiveSearch();

  initTypingMode();
  initVoiceMode();
  initPlanMode();
  initPenMode();

  // 기본 안건 1개 렌더링
  renderAgendaList();

  // 협의록 있으면 도구바 버튼 활성화
  updateToolbarState();

  // 폴더 지정 미지원 기기(모바일 등)에서는 버튼 숨김
  adaptForDeviceSupport();
}

/** 기기 지원 여부에 따라 UI 조정 (모바일 = File System Access 미지원) */
function adaptForDeviceSupport() {
  const supportsFolder = 'showDirectoryPicker' in window;
  const setFolderBtn = document.getElementById('btnSetFolder');
  if (setFolderBtn && !supportsFolder) {
    setFolderBtn.hidden = true; // 모바일·일부 브라우저: 폴더 지정 불가
  }
}

/* ============================================================
   최초 방문 — 면책 고지
   ============================================================ */
function initFirstVisit() {
  const accepted = localStorage.getItem('anti_conver_disclaimer_v1');
  if (!accepted) {
    openModal('modalDisclaimer');
  } else {
    setState({ hasAcceptedDisclaimer: true });
  }

  document.getElementById('btnAcceptDisclaimer')?.addEventListener('click', () => {
    localStorage.setItem('anti_conver_disclaimer_v1', '1');
    setState({ hasAcceptedDisclaimer: true });
    closeModal('modalDisclaimer');
    showToast('시작합니다. 회의 정보를 입력해 주세요.', 'success');
  });

  document.getElementById('btnShowDisclaimer')?.addEventListener('click', () => {
    openModal('modalDisclaimer');
  });
}

/* ============================================================
   메타 입력 → 상태 + 미리보기 반영
   ============================================================ */
function bindMetaInputs() {
  const bind = (id, stateKey) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', e => {
      setState({ meeting: { [stateKey]: e.target.value, isDirty: true } });
      updatePreview();
    });
  };

  bind('inTitle', 'title');
  bind('inDate',  'date');
  bind('inTime',  'time');
  bind('inPlace', 'place');
}

/* ============================================================
   안건 추가/삭제
   ============================================================ */
function bindAgendaControls() {
  document.getElementById('btnAddAgenda')?.addEventListener('click', () => {
    const agendas = [...appState.meeting.agendas, ''];
    setState({ meeting: { agendas, isDirty: true } });
    renderAgendaList();
    updatePreview();

    // 새 입력 필드에 포커스
    const list = document.getElementById('agendaList');
    const inputs = list?.querySelectorAll('.agenda-input');
    inputs?.[inputs.length - 1]?.focus();
  });
}

function renderAgendaList() {
  const list = document.getElementById('agendaList');
  if (!list) return;

  const agendas = appState.meeting.agendas;
  list.innerHTML = '';

  agendas.forEach((val, i) => {
    const li = document.createElement('li');
    li.className = 'agenda-item';

    const num = document.createElement('span');
    num.className = 'agenda-num';
    num.textContent = `${i + 1}.`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'agenda-input field-input';
    input.placeholder = `안건 ${i + 1}`;
    input.value = val;
    input.autocomplete = 'off';
    input.dataset.index = i;

    input.addEventListener('input', e => {
      const agendas = [...appState.meeting.agendas];
      agendas[parseInt(e.target.dataset.index, 10)] = e.target.value;
      setState({ meeting: { agendas, isDirty: true } });
      updatePreview();
    });

    // Enter → 다음 안건 추가 또는 이동
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (i === agendas.length - 1) {
          document.getElementById('btnAddAgenda')?.click();
        } else {
          const nextInput = list.querySelectorAll('.agenda-input')[i + 1];
          nextInput?.focus();
        }
      }
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'agenda-del';
    delBtn.innerHTML = '✕';
    delBtn.title = '안건 삭제';
    delBtn.setAttribute('aria-label', `안건 ${i + 1} 삭제`);
    delBtn.dataset.index = i;

    delBtn.addEventListener('click', async e => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      const agendas = appState.meeting.agendas;
      if (agendas.length <= 1) {
        // 마지막 남은 안건은 내용만 지우기
        setState({ meeting: { agendas: [''], isDirty: true } });
        renderAgendaList();
        updatePreview();
        return;
      }
      const newAgendas = agendas.filter((_, j) => j !== idx);
      setState({ meeting: { agendas: newAgendas, isDirty: true } });
      renderAgendaList();
      updatePreview();
    });

    li.appendChild(num);
    li.appendChild(input);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

/* ============================================================
   참석자 수 조절
   ============================================================ */
function bindAttendeeControls() {
  document.getElementById('btnAttInc')?.addEventListener('click', async () => {
    if (appState.meeting.attendeeCount >= 16) {
      showToast('최대 16명까지 입력 가능합니다.', 'warn');
      return;
    }
    changeAttendeeCount(1);
    renderAttendeeInputs();
    updateAttendeePreview();
    updateAttCountLabel();
    setState({ meeting: { isDirty: true } });
  });

  document.getElementById('btnAttDec')?.addEventListener('click', () => {
    const { attendeeCount } = appState.meeting;
    if (attendeeCount <= 1) {
      showToast('최소 1명이어야 합니다.', 'warn');
      return;
    }

    changeAttendeeCount(-1);
    renderAttendeeInputs();
    updateAttendeePreview();
    updateAttCountLabel();
    setState({ meeting: { isDirty: true } });
  });
}

function updateAttCountLabel() {
  const el = document.getElementById('attCountLabel');
  if (el) el.textContent = `참석자 ${appState.meeting.attendeeCount}`;
}

/* ============================================================
   작성 방식 라디오 전환
   ============================================================ */
const MODE_PANELS = {
  voice:  'paneVoice',
  plan:   'panePlan',
  typing: 'paneTyping',
  pen:    'panePen',
};

function bindModeSwitch() {
  document.querySelectorAll('.mode-radio').forEach(radio => {
    radio.addEventListener('change', e => {
      const mode = e.target.value;
      stopDictationIfActive();
      stopRecordingIfActive();
      setState({ meeting: { mode, isDirty: true } });
      showModePanel(mode);
      updateGenerateHint();
      // 녹음 모드 진입 시 마이크 권한 확인 + 버튼 활성화
      if (mode === 'voice') activateVoiceMode();
      // 계획서 모드 진입 시 state → textarea 동기화
      if (mode === 'plan') syncPlanTextarea();
    });
  });
}

function showModePanel(mode) {
  for (const [key, panelId] of Object.entries(MODE_PANELS)) {
    const panel = document.getElementById(panelId);
    if (!panel) continue;
    if (key === mode) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  }
}

/* ============================================================
   도구바
   ============================================================ */
function bindToolbar() {
  // 새로작성
  document.getElementById('btnNew')?.addEventListener('click', async () => {
    if (appState.meeting.isDirty || appState.meeting.typingText.trim()) {
      const ok = await confirm(
        '현재 작성 중인 내용이 있습니다.\n새로 작성하면 저장되지 않은 내용이 사라집니다.',
        '새로작성'
      );
      if (!ok) return;
    }
    resetMeeting();
    // 오늘 날짜 다시 세팅
    const todayVal = todayIso();
    setState({ meeting: { date: todayVal } });

    // 폼 초기화
    syncFormFromState();
    renderAgendaList();
    renderAttendeeInputs();
    updateAttendeePreview();
    updatePreview();
    clearMinutes();
    updateAttCountLabel();
    updateToolbarState();

    // 타이핑 영역 초기화
    const ta = document.getElementById('typingText');
    if (ta) ta.value = '';
    document.getElementById('typingCharCount') && (document.getElementById('typingCharCount').textContent = '0자');

    // 계획서 영역 초기화
    const planTa = document.getElementById('planExtractText');
    if (planTa) planTa.value = '';
    document.getElementById('planCharCount') && (document.getElementById('planCharCount').textContent = '0자');
    document.getElementById('planFileList') && (document.getElementById('planFileList').innerHTML = '');
    document.getElementById('planFileList') && (document.getElementById('planFileList').hidden = true);

    showToast('새 협의록 작성을 시작합니다.', 'success');
  });

  // ① 보관함 폴더 지정 — 저장 위치만 설정(기억)
  document.getElementById('btnSetFolder')?.addEventListener('click', async () => {
    const { chooseArchiveFolder } = await import('./db/backup.js');
    const folderName = await chooseArchiveFolder();
    if (folderName) {
      showToast(`저장 폴더가 지정되었습니다: ${folderName}`, 'success');
    }
  });

  // 클라우드 연동 안내
  document.getElementById('btnCloudHelp')?.addEventListener('click', () => {
    openModal('modalCloudHelp');
  });

  // ② 협의록 불러오기 — 보관함 목록
  document.getElementById('btnArchive')?.addEventListener('click', async () => {
    await renderArchiveList();
    openModal('modalArchive');
  });

  // 엑셀 다운로드
  document.getElementById('btnExcel')?.addEventListener('click', async () => {
    if (!appState.meeting.minutes) {
      showToast('협의록을 먼저 생성해 주세요.', 'warn');
      return;
    }
    const { exportExcel } = await import('./export/excel.js');
    await exportExcel();
  });

}

/** 협의록 생성 여부에 따라 버튼 활성/비활성 */
function updateToolbarState() {
  const hasMinutes = !!appState.meeting.minutes;
  const excelBtn = document.getElementById('btnExcel');
  if (excelBtn) excelBtn.disabled = !hasMinutes;
}

/* ============================================================
   협의록 생성 버튼
   ============================================================ */
function bindGenerateBtn() {
  document.getElementById('btnGenerate')?.addEventListener('click', onGenerateClick);
}

async function onGenerateClick() {
  const { mode, typingText, title, date } = appState.meeting;

  // 안건 입력 검증
  const validAgendas = appState.meeting.agendas.filter(a => a.trim());
  if (validAgendas.length === 0) {
    showToast('안건 내용을 입력해 주세요.', 'warn');
    return;
  }

  // 입력 검증
  const inputText = getInputTextForCurrentMode();
  if (!inputText || inputText.trim().length < 30) {
    showToast('회의 내용을 30자 이상 입력해 주세요.', 'warn');
    return;
  }

  // 비용 확인 모달 표시
  const engine = appState.aiEngine;
  setupCostConfirmModal(engine, inputText);
  openModal('modalCostConfirm');
}

function setupCostConfirmModal(engine, inputText) {
  const names = {
    openai: 'GPT (OpenAI)',
    gemini: 'Gemini (Google)',
    claude: 'Claude (Anthropic)',
    sim:    '로컬 시뮬레이션',
  };

  // 무료 티어가 있는 엔진 (Gemini만 무료 티어 제공)
  const FREE_TIER = { gemini: true };

  const engineMsg = document.getElementById('costEngineMsg');
  const estimateMsg = document.getElementById('costEstimateMsg');
  const transferMsg = document.getElementById('transferWarnMsg');

  // 선택된 모델명 가져오기
  const selectedModel = engine !== 'sim'
    ? (localStorage.getItem(`anti_model_${engine}`) || '')
    : '';

  if (engineMsg) {
    engineMsg.textContent = selectedModel
      ? `엔진: ${names[engine] || engine} · ${selectedModel}`
      : `엔진: ${names[engine] || engine}`;
  }

  if (estimateMsg) {
    if (engine === 'sim') {
      estimateMsg.textContent = '비용: 0원 (로컬 시뮬레이션, AI 호출 없음)';
    } else if (FREE_TIER[engine]) {
      estimateMsg.innerHTML =
        '💚 <b>무료 티어 우선 사용</b> — 분당 사용량 한도 내에서는 무료입니다.<br>' +
        '<span style="color:#c0392b">한도를 초과하거나 유료 결제가 설정된 경우 비용이 발생할 수 있습니다.</span>';
    } else {
      const words = inputText.trim().split(/\s+/).length;
      const tokenEst = Math.round(words * 1.3);
      estimateMsg.innerHTML =
        `⚠ <b>유료 엔진</b> — 예상 입력 토큰 약 ${tokenEst.toLocaleString()}개<br>` +
        '<span style="color:#c0392b">호출 시 API 사용료가 발생합니다.</span>';
    }
  }

  if (transferMsg) {
    transferMsg.hidden = engine === 'sim';
    transferMsg.textContent = engine !== 'sim'
      ? `⚠ 입력 내용이 ${names[engine]} 서버로 전송됩니다.`
      : '';
  }

  // 확인 버튼
  const confirmBtn = document.getElementById('btnConfirmGenerate');
  if (confirmBtn) {
    // 이전 리스너 제거 후 재등록
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.replaceWith(newBtn);
    newBtn.addEventListener('click', async () => {
      closeModal('modalCostConfirm');
      await runGenerate();
    });
  }
}

function getInputTextForCurrentMode() {
  const mode = appState.meeting.mode;
  switch (mode) {
    case 'typing': return appState.meeting.typingText;
    case 'plan':   return appState.meeting.planExtractedText;
    case 'voice':  return appState.meeting.voiceTranscript;
    case 'pen':    return appState.meeting.penOcrText;
    default:       return '';
  }
}

async function runGenerate() {
  if (appState.meeting.isGenerating) return;

  setState({ meeting: { isGenerating: true } });
  showGeneratingSpinner(true);
  disableInputPanel(true);
  updateGenerateHint('생성 중…');

  try {
    const result = await generateMinutes();
    setState({ meeting: { minutes: result, isGenerating: false, isDirty: true } });
    showMinutes(result);
    updateToolbarState();
    showToast('협의록이 생성되었습니다.', 'success');
    updateGenerateHint('재생성하려면 버튼을 다시 누르세요');

    // 생성 직후 자동 저장 (보관함 + 파일)
    await autoSaveMeeting();
  } catch (err) {
    console.error('[Generate]', err);
    setState({ meeting: { isGenerating: false } });
    showToast(`생성 실패: ${err.message}`, 'error');
    updateGenerateHint('생성에 실패했습니다. 다시 시도해 주세요.');
  } finally {
    showGeneratingSpinner(false);
    disableInputPanel(false);
  }
}

/**
 * 협의록 생성 직후 자동 저장
 * - 보관함(IndexedDB)에 저장 (불러오기용)
 * - 지정 폴더가 있으면 그 폴더에, 없으면 기본 다운로드 폴더에 엑셀 자동 저장
 */
async function autoSaveMeeting() {
  // 1. 보관함(IndexedDB)
  try {
    const { saveMeeting } = await import('./db/indexeddb.js');
    const saved = await saveMeeting(appState.meeting);
    setState({ meeting: { id: saved.id, createdAt: saved.createdAt, updatedAt: saved.updatedAt, isDirty: false } });
  } catch (err) {
    console.error('[AutoSave/DB]', err);
  }

  // 2. 엑셀 파일 자동 저장
  try {
    const { buildExcelBlob } = await import('./export/excel.js');
    const { getArchiveFolder, saveBlobToArchiveFolder, downloadBlobPublic } = await import('./db/backup.js');
    const result = await buildExcelBlob();
    if (!result) return;

    const dir = await getArchiveFolder();
    if (dir) {
      // 사용자가 지정한 폴더에 저장
      await saveBlobToArchiveFolder(result.blob, result.fileName);
      showToast(`지정 폴더에 저장되었습니다: ${result.fileName}`, 'success');
    } else {
      // 폴더 미지정 → 기본 다운로드 폴더에 자동 저장
      downloadBlobPublic(result.blob, result.fileName);
      showToast(`다운로드 폴더에 저장되었습니다: ${result.fileName}`, 'success');
    }
  } catch (err) {
    console.error('[AutoSave/File]', err);
  }
}

/** AI 라우터를 통한 협의록 생성 */
async function generateMinutes() {
  const { title, date, mode, agendas } = appState.meeting;
  const raw = getInputTextForCurrentMode() || '';

  const { generate } = await import('./ai/router.js');
  return generate({
    text: raw,
    mode,
    title,
    date,
    agendas,
  });
}

/** 생성 중 1쪽 입력 비활성 */
function disableInputPanel(disable) {
  const panel = document.getElementById('panelInput');
  if (!panel) return;
  panel.querySelectorAll('input, textarea, button, select').forEach(el => {
    el.disabled = disable;
  });
}

function updateGenerateHint(msg = '') {
  const el = document.getElementById('generateHint');
  if (el) el.textContent = msg;
}

/* ============================================================
   AI 설정 모달
   ============================================================ */
function bindAiSettingsModal() {
  document.getElementById('btnAiSettings')?.addEventListener('click', () => {
    syncAiSettingsModal();
    openModal('modalAiSettings');
  });

  // 엔진 라디오 → 키 입력 필드 표시
  document.querySelectorAll('.engine-radio').forEach(radio => {
    radio.addEventListener('change', e => {
      updateKeyFieldsVisibility(e.target.value);
    });
  });

  // 키 보기/숨기기 버튼
  ['OpenaiKey', 'GeminiKey', 'ClaudeKey'].forEach(name => {
    const btn = document.getElementById(`btnShow${name}`);
    const inp = document.getElementById(`in${name}`);
    if (btn && inp) {
      btn.addEventListener('click', () => {
        const isPassword = inp.type === 'password';
        inp.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? '숨기기' : '보기';
      });
    }
  });

  // 설정 저장
  document.getElementById('btnSaveAiSettings')?.addEventListener('click', saveAiSettings);
}

async function syncAiSettingsModal() {
  const engine = appState.aiEngine;
  const radios = document.querySelectorAll('.engine-radio');
  radios.forEach(r => { r.checked = r.value === engine; });
  updateKeyFieldsVisibility(engine);
  updateUsageDisplay();

  // 구버전 모델 ID → 현재 ID 자동 마이그레이션
  const MODEL_MIGRATIONS = {
    'claude-haiku-4-20250414':  'claude-haiku-4-5-20251001',
    'claude-sonnet-4-20250514': 'claude-sonnet-4-6',
    'claude-opus-4-5':          'claude-opus-4-8',
  };
  ['openai', 'gemini', 'claude'].forEach(eng => {
    const saved = localStorage.getItem(`anti_model_${eng}`);
    if (saved && MODEL_MIGRATIONS[saved]) {
      localStorage.setItem(`anti_model_${eng}`, MODEL_MIGRATIONS[saved]);
    }
  });

  // 저장된 모델 선택값 복원
  ['openai', 'gemini', 'claude'].forEach(eng => {
    const saved = localStorage.getItem(`anti_model_${eng}`);
    const label = eng.charAt(0).toUpperCase() + eng.slice(1);
    const sel   = document.getElementById(`sel${label}Model`);
    const customInput = document.getElementById(`custom${label}Model`);
    if (!sel || !saved) return;
    // 저장값이 드롭다운 옵션에 있으면 그대로 선택, 없으면 직접입력 모드
    const hasOption = Array.from(sel.options).some(o => o.value === saved);
    if (hasOption) {
      sel.value = saved;
    } else {
      sel.value = '__custom__';
      if (customInput) { customInput.value = saved; customInput.hidden = false; }
    }
  });
  // 드롭다운 변경 시 직접입력 창 토글
  ['openai', 'gemini', 'claude'].forEach(eng => {
    const label = eng.charAt(0).toUpperCase() + eng.slice(1);
    const sel   = document.getElementById(`sel${label}Model`);
    const customInput = document.getElementById(`custom${label}Model`);
    if (!sel || !customInput) return;
    sel.addEventListener('change', () => {
      customInput.hidden = sel.value !== '__custom__';
      if (!customInput.hidden) customInput.focus();
    });
  });

  // 키 복원 (비동기)
  try {
    const { hasKey, loadKey, isPersisted } = await import('./crypto/keystore.js');
    for (const eng of ['openai', 'gemini', 'claude']) {
      const label  = eng.charAt(0).toUpperCase() + eng.slice(1);
      const saved  = await hasKey(eng);              // 영구 또는 세션 키 존재 여부
      const persisted = await isPersisted(eng);      // 영구 저장 여부
      const inputEl  = document.getElementById(`in${label}Key`);

      // 저장된 키를 입력 필드에 복원
      if (inputEl && saved) {
        try {
          const decrypted = await loadKey(eng, '');
          if (decrypted) inputEl.value = decrypted;
        } catch {}
      }

      // 라디오 초기 상태: 영구 저장이면 'persist', 세션전용이면 'session', 없으면 기본 'persist'
      const mode = persisted ? 'persist' : (saved ? 'session' : 'persist');
      const radio = document.querySelector(`input[name="keyMode${label}"][value="${mode}"]`);
      if (radio) radio.checked = true;
    }
  } catch (e) {
    console.warn('[Settings] 키 상태 확인 실패:', e);
  }
}

/** 월별 토큰 사용량 → 예상 비용 표시 */
function updateUsageDisplay() {
  const el = document.getElementById('usageAmount');
  if (!el) return;

  const { inputTokens, outputTokens, month } = appState.monthlyTokenEstimate;
  if (!month || (inputTokens === 0 && outputTokens === 0)) {
    el.textContent = '0원';
    return;
  }

  // 대략적 비용 추정 (GPT-4o-mini 기준, 1K 입력 ≈ 0.3원, 1K 출력 ≈ 1.2원)
  const costEstimate = Math.round(
    (inputTokens / 1000) * 0.3 + (outputTokens / 1000) * 1.2
  );
  el.textContent = `약 ${costEstimate.toLocaleString()}원`;
}

function updateKeyFieldsVisibility(engine) {
  document.getElementById('fieldOpenaiKey')?.toggleAttribute('hidden', engine !== 'openai');
  document.getElementById('fieldGeminiKey')?.toggleAttribute('hidden', engine !== 'gemini');
  document.getElementById('fieldClaudeKey')?.toggleAttribute('hidden', engine !== 'claude');
}

async function saveAiSettings() {
  const engineEl = document.querySelector('.engine-radio:checked');
  const engine = engineEl ? engineEl.value : 'sim';

  setState({ aiEngine: engine });

  // keystore.js로 암호화 저장
  try {
    const { saveKey, deleteKey, saveKeySessionOnly } = await import('./crypto/keystore.js');
    const keyMap = {
      openai: document.getElementById('inOpenaiKey')?.value?.trim(),
      gemini: document.getElementById('inGeminiKey')?.value?.trim(),
      claude: document.getElementById('inClaudeKey')?.value?.trim(),
    };
    // 라디오: 'persist'(계속 사용) / 'session'(이번에만)
    const modeMap = {
      openai: document.querySelector('input[name="keyModeOpenai"]:checked')?.value || 'persist',
      gemini: document.querySelector('input[name="keyModeGemini"]:checked')?.value || 'persist',
      claude: document.querySelector('input[name="keyModeClaude"]:checked')?.value || 'persist',
    };

    for (const [eng, val] of Object.entries(keyMap)) {
      if (modeMap[eng] === 'persist') {
        // 이 기기에서 계속 키 사용 → 영구 저장 (빈 값이면 기존 키 유지)
        if (val) await saveKey(eng, val, '');
      } else {
        // 이번에만 키 사용 → 세션 전용 (브라우저 닫으면 사라짐)
        if (val) {
          await saveKeySessionOnly(eng, val);
        } else {
          await deleteKey(eng);
        }
      }
    }

    // 엔진·모델 설정 localStorage에 보관
    localStorage.setItem('anti_conver_engine', engine);

    // 각 엔진별 선택 모델 저장 (직접입력 시 텍스트값 사용)
    ['openai', 'gemini', 'claude'].forEach(eng => {
      const label = eng.charAt(0).toUpperCase() + eng.slice(1);
      const sel   = document.getElementById(`sel${label}Model`);
      const customInput = document.getElementById(`custom${label}Model`);
      if (!sel) return;
      const modelVal = sel.value === '__custom__'
        ? (customInput?.value?.trim() || '')
        : sel.value;
      if (modelVal) localStorage.setItem(`anti_model_${eng}`, modelVal);
    });
  } catch (err) {
    console.error('[AI Settings]', err);
    showToast(`설정 저장 실패: ${err.message}`, 'error');
    return;
  }

  closeModal('modalAiSettings');
  showToast('AI 설정이 저장되었습니다.', 'success');
  updateGenerateHint();
}

/* ============================================================
   인쇄
   ============================================================ */
function bindPrintBtn() {
  document.getElementById('btnPrint')?.addEventListener('click', () => {
    window.print();
  });
}

/* ============================================================
   태블릿 탭 전환
   ============================================================ */
function bindTabSwitcher() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const target = e.currentTarget.dataset.panel;

      // 탭 버튼 active
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
      e.currentTarget.classList.add('tab-active');

      // 패널 show/hide
      ['panelInput', 'panelPreview'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('tab-hidden', id !== target);
      });
    });
  });
}

/* ============================================================
   beforeunload 경고
   ============================================================ */
function bindBeforeUnload() {
  window.addEventListener('beforeunload', e => {
    if (appState.meeting.isDirty && appState.meeting.typingText?.trim()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

/* ============================================================
   저장된 AI 설정 복원 (부팅 시)
   ============================================================ */
function restoreSavedSettings() {
  const engine = localStorage.getItem('anti_conver_engine') || 'sim';
  setState({ aiEngine: engine });

  // 저장된 키가 있으면 세션 캐시에 복원 시도 (PIN 없는 키만 자동 복원)
  (async () => {
    try {
      const { loadKey, needsPin } = await import('./crypto/keystore.js');
      for (const eng of ['openai', 'gemini', 'claude']) {
        const pinRequired = await needsPin(eng);
        if (!pinRequired) {
          // PIN 없는 키는 자동 복호화
          await loadKey(eng, '').catch(() => {});
        }
      }
    } catch {
      // keystore 로딩 실패 시 무시 (첫 방문 등)
    }
  })();
}

/* ============================================================
   폼 → 상태 동기화 (새로작성 후 폼 값 업데이트)
   ============================================================ */
function syncFormFromState() {
  const { title, date, time, place } = appState.meeting;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };
  set('inTitle', title);
  set('inDate',  date || todayIso());
  set('inTime',  time);
  set('inPlace', place);
}

/* ============================================================
   보관함 — 목록 렌더링 + 불러오기 + 삭제 + 검색
   ============================================================ */

/** 보관함 모달에 저장된 회의 목록을 렌더링 */
async function renderArchiveList(keyword = '') {
  const listEl = document.getElementById('archiveList');
  if (!listEl) return;

  try {
    const { searchMeetings, listMeetings } = await import('./db/indexeddb.js');
    const meetings = keyword.trim()
      ? await searchMeetings(keyword)
      : await listMeetings();

    if (meetings.length === 0) {
      listEl.innerHTML = `
        <p class="empty-state">저장된 회의록이 없습니다.<br>
          <small>협의록 생성 후 '내 기기에 저장'을 눌러보세요.</small>
        </p>`;
      return;
    }

    listEl.innerHTML = meetings.map(m => `
      <div class="archive-item" data-id="${m.id}">
        <div class="archive-item-info">
          <strong class="archive-item-title">${escForHtml(m.title || '제목 없음')}</strong>
          <span class="archive-item-date">${m.date || ''}</span>
          <span class="archive-item-agenda">${(m.agendas || []).filter(a => a?.trim()).map(a => escForHtml(a)).join(', ') || ''}</span>
        </div>
        <div class="archive-item-actions">
          <button class="btn btn-xs btn-primary archive-load-btn" data-id="${m.id}" type="button">불러오기</button>
          <button class="btn btn-xs btn-ghost archive-del-btn" data-id="${m.id}" type="button">삭제</button>
        </div>
      </div>
    `).join('');

    // 불러오기 버튼
    listEl.querySelectorAll('.archive-load-btn').forEach(btn => {
      btn.addEventListener('click', () => loadFromArchive(btn.dataset.id));
    });

    // 삭제 버튼
    listEl.querySelectorAll('.archive-del-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteFromArchive(btn.dataset.id));
    });
  } catch (err) {
    console.error('[Archive]', err);
    listEl.innerHTML = `<p class="empty-state">보관함 로드 실패: ${err.message}</p>`;
  }
}

/** 보관함에서 회의 불러오기 */
async function loadFromArchive(id) {
  try {
    const { loadMeeting } = await import('./db/indexeddb.js');
    const meeting = await loadMeeting(id);
    if (!meeting) {
      showToast('회의록을 찾을 수 없습니다.', 'error');
      return;
    }

    // 상태에 로드
    setState({
      meeting: {
        ...meeting,
        isDirty: false,
        isGenerating: false,
      },
    });

    // 폼 동기화
    syncFormFromState();
    renderAgendaList();
    renderAttendeeInputs();
    updateAttendeePreview();
    updatePreview();
    updateAttCountLabel();
    updateToolbarState();

    // 협의록 본문 표시
    if (meeting.minutes) {
      showMinutes(meeting.minutes);
    } else {
      clearMinutes();
    }

    // 타자 모드 텍스트 복원
    const ta = document.getElementById('typingText');
    if (ta) ta.value = meeting.typingText || '';
    const cc = document.getElementById('typingCharCount');
    if (cc) cc.textContent = `${(meeting.typingText || '').length}자`;

    closeModal('modalArchive');
    showToast(`"${meeting.title || '회의록'}" 불러오기 완료`, 'success');
  } catch (err) {
    console.error('[Archive Load]', err);
    showToast(`불러오기 실패: ${err.message}`, 'error');
  }
}

/** 보관함에서 회의 삭제 */
async function deleteFromArchive(id) {
  const ok = await confirm('이 회의록을 보관함에서 삭제하겠습니까?', '삭제');
  if (!ok) return;

  try {
    const { deleteMeeting } = await import('./db/indexeddb.js');
    await deleteMeeting(id);

    // OPFS 파일도 함께 삭제
    try {
      const { deleteFolder } = await import('./db/opfs.js');
      await deleteFolder(id);
    } catch { /* OPFS 파일 없으면 무시 */ }

    showToast('삭제되었습니다.', 'success');
    await renderArchiveList(); // 목록 갱신
  } catch (err) {
    console.error('[Archive Delete]', err);
    showToast(`삭제 실패: ${err.message}`, 'error');
  }
}

/** 보관함 검색 바인딩 (boot 내 bindToolbar에서 호출) */
function bindArchiveSearch() {
  const input = document.getElementById('archiveSearch');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderArchiveList(input.value);
    }, 300);
  });
}

/** 계획서 모드 진입 시 state.planExtractedText → textarea 동기화 */
function syncPlanTextarea() {
  const ta = document.getElementById('planExtractText');
  if (!ta) return;
  const stateText = appState.meeting.planExtractedText || '';
  if (ta.value !== stateText) {
    ta.value = stateText;
    // 글자 수 갱신
    const cc = document.getElementById('planCharCount');
    if (cc) cc.textContent = stateText.length + '자';
  }
}

/** HTML 이스케이프 (보관함 렌더링용) */
function escForHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
