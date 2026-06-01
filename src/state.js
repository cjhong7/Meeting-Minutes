/**
 * state.js — 중앙 상태 모델 + 경량 구독 패턴
 *
 * 사용법:
 *   import { appState, setState, subscribe } from './state.js';
 *
 *   // 상태 읽기
 *   const title = appState.meeting.title;
 *
 *   // 상태 쓰기 (자동으로 구독자 알림)
 *   setState({ meeting: { title: '새 회의' } });
 *
 *   // 구독 (특정 키 변화 감지)
 *   const unsub = subscribe('meeting', (meeting) => { ... });
 *   unsub(); // 구독 해제
 */

/* ============================================================
   단일 회의 초기 데이터
   ============================================================ */
export function createMeeting() {
  return {
    id:         null,         // 보관함 저장 시 부여 (nanoid)
    createdAt:  null,
    updatedAt:  null,

    // ── 1쪽 메타 ──
    title:         '',        // 회의명
    date:          '',        // YYYY-MM-DD
    time:          '',        // HH:MM
    place:         '',        // 장소
    agendas:       [''],      // string[] (최소 1개 빈 안건)
    attendeeCount: 6,         // 3~16
    attendeeNames: Array(6).fill(''),

    // ── 입력 모드 ──
    mode: 'typing',           // 'voice' | 'plan' | 'typing' | 'pen'

    // ── 모드별 입력 원본 ──
    typingText:         '',   // 타자 모드 입력
    planExtractedText:  '',   // 계획서 모드 추출 텍스트
    voiceTranscript:    '',   // 녹음 모드 STT 결과
    penOcrText:         '',   // 펜 모드 OCR 결과

    // ── AI 협의록 생성 결과 ──
    minutes:         '',      // 생성된 협의록 본문 (plain text)
    minutesType:     'meeting', // 'meeting' | 'plan'

    // ── 상태 플래그 ──
    isGenerating: false,
    isDirty:      false,      // 저장 후 변경 여부
  };
}

/* ============================================================
   앱 전역 상태
   ============================================================ */
export const appState = {
  // 현재 작업 중인 회의
  meeting: createMeeting(),

  // AI 설정 (세션 내 유지, 나중에 keystore.js가 암호화하여 IndexedDB에 저장)
  aiEngine:  'sim',   // 'openai' | 'gemini' | 'claude' | 'sim'
  aiQuality: 'low',   // 'low' | 'high'
  // 키는 직접 appState에 두지 않고 keystore.js에서 관리 (평문 최소 노출)

  // 앱 전역 설정
  hasAcceptedDisclaimer: false,
  hasSeenSendConsentOnce: false,

  // 월별 사용량 추정 (토큰 수 로컬 누적)
  monthlyTokenEstimate: { month: '', inputTokens: 0, outputTokens: 0 },

  // ── 내부 구독 테이블 ──
  _listeners: new Map(),
};

/* ============================================================
   상태 업데이트
   ============================================================ */

/**
 * 상태를 업데이트하고 영향받은 키의 구독자에게 알림
 *
 * @param {Object} patch  최상위 키를 가진 부분 객체
 *                        예) { meeting: { title: '...' }, aiEngine: 'openai' }
 */
export function setState(patch) {
  const changedTopKeys = [];

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'meeting') {
      // 회의 객체는 깊은 병합 (단순 1-depth)
      const prev = appState.meeting;
      appState.meeting = { ...prev, ...value };
      changedTopKeys.push('meeting');
    } else {
      appState[key] = value;
      changedTopKeys.push(key);
    }
  }

  // 영향받은 키의 구독자 실행
  for (const key of changedTopKeys) {
    const subs = appState._listeners.get(key);
    if (subs) {
      const val = key === 'meeting' ? appState.meeting : appState[key];
      for (const fn of subs) fn(val);
    }
  }

  // 와일드카드 구독자 알림
  const wildSubs = appState._listeners.get('*');
  if (wildSubs && changedTopKeys.length > 0) {
    for (const fn of wildSubs) fn(appState);
  }
}

/**
 * 구독 등록. 반환된 함수를 호출하면 구독 해제됨.
 *
 * @param {string}   key  'meeting' | 'aiEngine' | '*' (모든 변경)
 * @param {Function} fn   (value) => void
 * @returns {Function}    unsubscribe 함수
 */
export function subscribe(key, fn) {
  if (!appState._listeners.has(key)) {
    appState._listeners.set(key, new Set());
  }
  appState._listeners.get(key).add(fn);
  return () => appState._listeners.get(key)?.delete(fn);
}

/* ============================================================
   편의 헬퍼
   ============================================================ */

/** 현재 회의를 초기 상태로 리셋 */
export function resetMeeting() {
  const fresh = createMeeting();
  // 오늘 날짜 자동 입력
  fresh.date = todayIso();
  setState({ meeting: fresh });
}

/** 오늘 날짜를 YYYY-MM-DD 로 반환 */
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** 현재 연-월 키 (사용량 추적용) */
export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
