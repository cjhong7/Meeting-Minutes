/**
 * modes/voice.js — 녹음 모드
 *
 * 계획서 Ⅴ-1:
 *  - 실시간 녹음 (MediaRecorder) + 브라우저 SpeechRecognition 실시간 텍스트
 *  - 오디오 레벨 시각화 (AnalyserNode)
 *  - 파일 첨부 탭 (외부 녹음 파일 업로드)
 *  - Wake Lock으로 화면 꺼짐 방지
 *  - 3시간 자동 정지
 */

import { appState, setState } from '../state.js';
import { showToast } from '../ui/toast.js';

/* ── 상태 ── */
let mediaStream    = null;
let mediaRecorder  = null;
let audioContext   = null;
let analyser       = null;
let levelAnimId    = null;
let recognition    = null;
let wakeLock       = null;
let recordedChunks = [];
let timerInterval  = null;
let startTime      = 0;
let transcript     = '';
let recordedBlob   = null;   // 완성된 오디오 Blob
let recordedMime   = 'audio/webm';

/* ============================================================
   초기화
   ============================================================ */
export function initVoiceMode() {
  bindVoiceTabs();
  bindRecControls();
  bindFileAttach();
  bindTranscriptSync();
}

/** 녹음 모드 패널이 보일 때 마이크 확인 */
export function activateVoiceMode() {
  checkMicPermission();
}

/* ── 탭 전환 ── */
function bindVoiceTabs() {
  const tabLive = document.getElementById('tabLiveRec');
  const tabFile = document.getElementById('tabFileAttach');
  const paneLive = document.getElementById('paneLiveRec');
  const paneFile = document.getElementById('paneFileAttach');

  tabLive?.addEventListener('click', () => {
    tabLive.classList.add('voice-tab-active');
    tabFile?.classList.remove('voice-tab-active');
    if (paneLive) paneLive.hidden = false;
    if (paneFile) paneFile.hidden = true;
  });

  tabFile?.addEventListener('click', () => {
    tabFile.classList.add('voice-tab-active');
    tabLive?.classList.remove('voice-tab-active');
    if (paneFile) paneFile.hidden = false;
    if (paneLive) paneLive.hidden = true;
  });
}

/* ── 마이크 확인 ── */
async function checkMicPermission() {
  const statusEl = document.getElementById('micStatus');
  const btnStart = document.getElementById('btnStartRec');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    if (statusEl) { statusEl.textContent = '마이크 연결됨 ✓'; statusEl.className = 'mic-status mic-ok'; }
    if (btnStart) btnStart.disabled = false;
  } catch {
    if (statusEl) { statusEl.textContent = '마이크 사용 불가 ✗ — 브라우저 설정에서 마이크를 허용해 주세요'; statusEl.className = 'mic-status mic-err'; }
  }
}

/* ── 녹음 컨트롤 ── */
function bindRecControls() {
  document.getElementById('btnStartRec')?.addEventListener('click', startRecording);
  document.getElementById('btnStopRec')?.addEventListener('click', stopRecording);
}

async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showToast('마이크 접근이 거부되었습니다.', 'error');
    return;
  }

  recordedChunks = [];
  recordedBlob   = null;
  transcript = '';
  const ta = document.getElementById('voiceTranscript');
  if (ta) ta.value = '';

  // 다운로드 버튼 숨기기
  const dlArea = document.getElementById('recDownloadArea');
  if (dlArea) dlArea.hidden = true;

  // 지원 mimeType 결정
  recordedMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : '';

  mediaRecorder = new MediaRecorder(mediaStream,
    recordedMime ? { mimeType: recordedMime } : {}
  );

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = onRecordingStop;
  mediaRecorder.start(10000);

  startAudioLevel(mediaStream);
  startBrowserStt();
  acquireWakeLock();

  // UI 전환 — 시작 버튼을 "● 녹음중"으로 변경
  const btnStart = document.getElementById('btnStartRec');
  const btnStop  = document.getElementById('btnStopRec');
  if (btnStart) {
    btnStart.textContent = '● 녹음중';
    btnStart.classList.add('btn-recording');
    btnStart.disabled = true;
  }
  if (btnStop) btnStop.hidden = false;
  document.getElementById('recTimer').hidden = false;
  document.getElementById('voiceTranscriptArea').hidden = false;

  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
  showToast('녹음을 시작합니다.', 'success');
}

function stopRecording() {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
  mediaStream?.getTracks().forEach(t => t.stop());
  stopAudioLevel();
  stopBrowserStt();
  releaseWakeLock();
  clearInterval(timerInterval);

  // 버튼 원래대로 복원
  const btnStart = document.getElementById('btnStartRec');
  if (btnStart) {
    btnStart.textContent = '녹음 시작';
    btnStart.classList.remove('btn-recording');
    btnStart.disabled = false;
  }
  document.getElementById('btnStopRec').hidden = true;
  document.getElementById('recTimer').hidden = true;
  showToast('녹음이 정지되었습니다.', 'info');
}

/** 녹음 중이면 정지 (모드 전환 시 호출) */
export function stopRecordingIfActive() {
  if (mediaRecorder?.state === 'recording') stopRecording();
}

function onRecordingStop() {
  // ── 오디오 Blob 생성 ──
  if (recordedChunks.length > 0) {
    const mime = recordedMime || 'audio/webm';
    recordedBlob = new Blob(recordedChunks, { type: mime });

    const sizeMB = (recordedBlob.size / 1024 / 1024).toFixed(1);
    const ext    = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : 'webm';

    // 다운로드 버튼 표시
    const dlArea   = document.getElementById('recDownloadArea');
    const btnDl    = document.getElementById('btnDownloadRec');
    const fileInfo = document.getElementById('recFileInfo');
    if (dlArea) dlArea.hidden = false;
    if (fileInfo) fileInfo.textContent = `  (${sizeMB}MB · ${ext})`;

    if (btnDl) {
      // 이전 리스너 제거
      const newBtn = btnDl.cloneNode(true);
      btnDl.replaceWith(newBtn);

      newBtn.addEventListener('click', () => {
        const url   = URL.createObjectURL(recordedBlob);
        const a     = document.createElement('a');
        const title = (appState.meeting.title || '회의녹음').replace(/[\\/:*?"<>|]/g, '_');
        const date  = appState.meeting.date || new Date().toISOString().slice(0, 10);
        a.href     = url;
        a.download = `${title}_${date}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast('녹음 파일 다운로드를 시작합니다.', 'success');
      });
    }

    showToast(`녹음 완료 (${sizeMB}MB). 파일을 다운로드할 수 있습니다.`, 'success');
  } else {
    showToast('녹음된 데이터가 없습니다.', 'warn');
  }

  // ── STT 텍스트 저장 ──
  const ta   = document.getElementById('voiceTranscript');
  const text = ta?.value || transcript;
  setState({ meeting: { voiceTranscript: text, isDirty: true } });

  if (!text.trim()) {
    showToast('음성 인식 결과가 없습니다. 텍스트를 직접 입력해 주세요.', 'warn');
  }
}

/* ── 오디오 레벨 시각화 ── */
function startAudioLevel(stream) {
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const fill = document.getElementById('audioLevelFill');

  function draw() {
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const pct = Math.min(100, (avg / 128) * 100);
    if (fill) fill.style.width = pct + '%';
    levelAnimId = requestAnimationFrame(draw);
  }
  draw();
}

function stopAudioLevel() {
  cancelAnimationFrame(levelAnimId);
  audioContext?.close();
  audioContext = null;
  const fill = document.getElementById('audioLevelFill');
  if (fill) fill.style.width = '0%';
}

/* ── 브라우저 SpeechRecognition ── */
function startBrowserStt() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  recognition = new SR();
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalText = '';

  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        finalText += e.results[i][0].transcript + ' ';
      } else {
        interim += e.results[i][0].transcript;
      }
    }
    transcript = finalText;
    const ta = document.getElementById('voiceTranscript');
    if (ta) {
      ta.value = finalText + interim;
      const cc = document.getElementById('voiceCharCount');
      if (cc) cc.textContent = ta.value.length + '자';
    }
  };

  recognition.onend = () => {
    if (mediaRecorder?.state === 'recording') {
      setTimeout(() => { try { recognition?.start(); } catch {} }, 300);
    }
  };

  recognition.onerror = e => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    console.warn('[STT]', e.error);
  };

  try { recognition.start(); } catch {}
}

function stopBrowserStt() {
  try { recognition?.stop(); } catch {}
  recognition = null;
}

/* ── 타이머 ── */
function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  const el = document.getElementById('recTime');
  if (el) el.textContent = `${h}:${m}:${s}`;

  if (elapsed >= 10800) {
    showToast('3시간이 되어 녹음이 자동 정지됩니다.', 'warn');
    stopRecording();
  }
}

/* ── Wake Lock ── */
async function acquireWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
function releaseWakeLock() { wakeLock?.release(); wakeLock = null; }

/* ── 파일 첨부 ── */
let attachedAudioFile = null;

function bindFileAttach() {
  const dropZone = document.getElementById('voiceDropZone');
  const fileInput = document.getElementById('voiceFileInput');

  dropZone?.addEventListener('click', () => fileInput?.click());
  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleAudioFile(e.dataTransfer.files[0]);
  });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files.length) handleAudioFile(fileInput.files[0]);
  });

  document.getElementById('btnRemoveAttached')?.addEventListener('click', () => {
    attachedAudioFile = null;
    document.getElementById('attachedFileInfo').hidden = true;
    document.getElementById('fileSttControls').hidden = true;
    document.getElementById('voiceDropZone').hidden = false;
  });

  // 텍스트 변환 버튼
  document.getElementById('btnFileToText')?.addEventListener('click', runFileStt);
}

function handleAudioFile(file) {
  attachedAudioFile = file;
  document.getElementById('attachedFileName').textContent = file.name;
  document.getElementById('attachedFileMeta').textContent = `(${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  document.getElementById('attachedFileInfo').hidden = false;
  document.getElementById('fileSttControls').hidden = false;
  document.getElementById('voiceDropZone').hidden = true;
  document.getElementById('voiceTranscriptArea').hidden = false;

  if (file.size > 25 * 1024 * 1024) {
    showToast('파일이 25MB를 초과합니다. 25MB 이하 파일을 권장합니다.', 'warn');
  }
}

/* ── 파일 STT 변환 (엔진 선택) ── */
async function runFileStt() {
  if (!attachedAudioFile) {
    showToast('첨부된 오디오 파일이 없습니다.', 'warn');
    return;
  }

  const sttEngine = document.getElementById('selSttEngine')?.value || 'whisper';

  if (sttEngine === 'whisper') {
    await runWhisperStt();
  } else if (sttEngine === 'gemini') {
    await runGeminiStt();
  }
}

/* ── Whisper STT ── */
async function runWhisperStt() {
  const apiKey = await getKeyFor('openai');
  if (!apiKey) {
    showToast('Whisper STT에는 OpenAI API 키가 필요합니다.\n⚙ AI 설정에서 OpenAI 키를 입력해 주세요.', 'error');
    return;
  }

  const btn      = document.getElementById('btnFileToText');
  const progress = document.getElementById('sttProgress');
  const ta       = document.getElementById('voiceTranscript');

  if (btn) { btn.disabled = true; btn.textContent = '변환 중…'; }
  if (progress) progress.textContent = '오디오 전송 중…';

  try {
    const file = attachedAudioFile;
    if (file.size > 25 * 1024 * 1024) {
      showToast('Whisper는 25MB 이하만 지원합니다. Gemini 오디오를 사용하거나 파일을 분할해 주세요.', 'warn');
      return;
    }
    if (progress) progress.textContent = `Whisper로 전송 중… (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    const text = await callWhisper(file, apiKey);
    if (ta) ta.value = text;
    setState({ meeting: { voiceTranscript: text, isDirty: true } });
    updateCharCount();
    showToast('텍스트 변환 완료!', 'success');
  } catch (err) {
    console.error('[Whisper]', err);
    showToast(`변환 실패: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '텍스트 변환'; }
    if (progress) progress.textContent = '';
  }
}

/* ── Gemini 오디오 STT ── */
async function runGeminiStt() {
  const apiKey = await getKeyFor('gemini');
  if (!apiKey) {
    showToast('Gemini STT에는 Gemini API 키가 필요합니다.\n⚙ AI 설정에서 Gemini 키를 입력해 주세요.', 'error');
    return;
  }

  const btn      = document.getElementById('btnFileToText');
  const progress = document.getElementById('sttProgress');
  const ta       = document.getElementById('voiceTranscript');

  if (btn) { btn.disabled = true; btn.textContent = '변환 중…'; }
  if (progress) progress.textContent = 'Gemini로 오디오 전송 중…';

  try {
    const file = attachedAudioFile;
    if (progress) progress.textContent = `Gemini 오디오 분석 중… (${(file.size / 1024 / 1024).toFixed(1)}MB)`;

    // 오디오 파일 → base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // MIME 타입 결정
    const mimeMap = { mp3: 'audio/mp3', m4a: 'audio/mp4', wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg' };
    const ext = file.name.split('.').pop().toLowerCase();
    const mimeType = mimeMap[ext] || file.type || 'audio/webm';

    // Gemini 모델 선택 (저장된 모델 또는 기본)
    const model = localStorage.getItem('anti_model_gemini') || 'gemini-2.5-flash';
    const base  = model.includes('2.0') ? 'https://generativelanguage.googleapis.com/v1/models'
                                        : 'https://generativelanguage.googleapis.com/v1beta/models';

    const res = await fetch(`${base}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: '이 오디오 파일의 모든 음성을 한국어 텍스트로 정확하게 받아쓰기 해주세요. 말한 내용을 빠짐없이 그대로 텍스트로 변환하세요.' },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini 오류 (${res.status})`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';

    if (!text.trim()) throw new Error('Gemini 응답이 비어있습니다.');

    if (ta) ta.value = text;
    setState({ meeting: { voiceTranscript: text, isDirty: true } });
    updateCharCount();
    showToast('텍스트 변환 완료!', 'success');
  } catch (err) {
    console.error('[Gemini STT]', err);
    showToast(`변환 실패: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '텍스트 변환'; }
    if (progress) progress.textContent = '';
  }
}

/* ── API 키 가져오기 헬퍼 ── */
async function getKeyFor(engine) {
  let key = sessionStorage.getItem(`anti_key_${engine}`) || '';
  if (!key) {
    try {
      const { loadKey, needsPin } = await import('../crypto/keystore.js');
      const pinRequired = await needsPin(engine);
      if (!pinRequired) key = await loadKey(engine, '');
    } catch {}
  }
  return key;
}

/** Whisper API 호출 */
async function callWhisper(file, apiKey) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-1');
  formData.append('language', 'ko');
  formData.append('response_format', 'text');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Whisper 오류 (${res.status})`);
  }

  return (await res.text()).trim();
}

function updateCharCount() {
  const ta = document.getElementById('voiceTranscript');
  const cc = document.getElementById('voiceCharCount');
  if (ta && cc) cc.textContent = ta.value.length + '자';
}

/* ── 텍스트 동기화 ── */
function bindTranscriptSync() {
  const ta = document.getElementById('voiceTranscript');
  ta?.addEventListener('input', () => {
    setState({ meeting: { voiceTranscript: ta.value, isDirty: true } });
    const cc = document.getElementById('voiceCharCount');
    if (cc) cc.textContent = ta.value.length + '자';
  });
}
