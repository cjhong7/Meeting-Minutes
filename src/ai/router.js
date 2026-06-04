/**
 * ai/router.js — AI 엔진 라우팅
 *
 * 선택된 엔진(appState.aiEngine)에 따라:
 *  1. 프롬프트 빌드 (prompt.js)
 *  2. 엔진별 API 호출 (openai/gemini/claude.js)
 *  3. 후처리 (postprocess.js)
 *  4. 토큰 사용량 누적 (state.js)
 *
 * 키 없음(sim) → simulator.js 직접 호출 (AI 미경유).
 */

import { appState, setState, currentMonthKey } from '../state.js';
import { buildPrompt } from './prompt.js';
import { postprocess } from './postprocess.js';
import { callOpenAI } from './openai.js';
import { callGemini } from './gemini.js';
import { callClaude } from './claude.js';
import { simulate } from './simulator.js';

/** 기본 모델 (사용자가 선택하지 않은 경우 사용) */
const DEFAULT_MODEL = {
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-2.5-pro',
  claude: 'claude-haiku-4-20250414',
};

/** localStorage에서 사용자가 선택한 모델을 가져옴 */
function getSelectedModel(engine) {
  let model = localStorage.getItem(`anti_model_${engine}`) || DEFAULT_MODEL[engine];
  // 단종된 Gemini 2.0 모델은 2.5-flash로 대체
  if (engine === 'gemini' && model.includes('2.0')) {
    model = 'gemini-2.5-flash';
    localStorage.setItem('anti_model_gemini', model);
  }
  // 제거된 OpenAI 4o 계열은 4.1 계열로 대체
  if (engine === 'openai' && model.includes('4o')) {
    model = model.includes('mini') ? 'gpt-4.1-mini' : 'gpt-4.1';
    localStorage.setItem('anti_model_openai', model);
  }
  return model;
}

/**
 * 협의록을 생성합니다.
 *
 * @param {Object} params
 * @param {string}   params.text      입력 원문
 * @param {string}   params.mode      'typing' | 'plan' | 'voice' | 'pen'
 * @param {string}   [params.title]   회의명
 * @param {string}   [params.date]    YYYY-MM-DD
 * @param {string[]} [params.agendas] 안건 목록
 * @returns {Promise<string>}  생성된 협의록 본문
 */
export async function generate({ text, mode, title, date, agendas }) {
  const engine = appState.aiEngine;   // 'openai' | 'gemini' | 'claude' | 'sim'

  // ── 키 없음 → 로컬 시뮬레이션 ──
  if (engine === 'sim') {
    return simulate({ text, mode, title, date, agendas });
  }

  // ── API 키 가져오기 ──
  const apiKey = await getApiKey(engine);
  if (!apiKey) {
    throw new Error(
      `${engineLabel(engine)} API 키가 설정되지 않았습니다.\n` +
      '⚙ AI 설정에서 키를 입력해 주세요.'
    );
  }

  // ── 모델 결정 (사용자 선택 모델 우선) ──
  const model = getSelectedModel(engine);

  // ── 프롬프트 빌드 (모델 등급별 상세도 조정) ──
  const { system, user } = buildPrompt({ text, mode, title, date, agendas, model });

  // ── 엔진별 호출 ──
  let result;
  switch (engine) {
    case 'openai':
      result = await callOpenAI({ system, user, model, apiKey });
      break;
    case 'gemini':
      result = await callGemini({ system, user, model, apiKey, mode });
      break;
    case 'claude':
      result = await callClaude({ system, user, model, apiKey });
      break;
    default:
      throw new Error(`알 수 없는 AI 엔진: ${engine}`);
  }

  // ── 토큰 사용량 누적 ──
  accumulateTokens(result.usage);

  // ── 후처리 ──
  const processed = postprocess(result.text);

  return processed;
}

/* ================================================================
   내부 헬퍼
   ================================================================ */

/**
 * API 키 가져오기 — sessionStorage 캐시 우선, 없으면 IndexedDB에서 복원
 * 탭을 닫았다 열어도 IndexedDB에 저장된 키를 자동으로 불러옴
 */
async function getApiKey(engine) {
  // 1. sessionStorage 캐시 확인 (가장 빠름)
  const cached = sessionStorage.getItem(`anti_key_${engine}`);
  if (cached) return cached;

  // 2. IndexedDB에서 복원 시도 (PIN 없는 키만 자동 복원)
  try {
    const { loadKey, needsPin } = await import('../crypto/keystore.js');
    const pinRequired = await needsPin(engine);
    if (!pinRequired) {
      const key = await loadKey(engine, '');
      return key || '';
    }
  } catch {}
  return '';
}

/** 엔진 한글 레이블 */
function engineLabel(engine) {
  const labels = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    claude: 'Claude',
  };
  return labels[engine] || engine;
}

/** 월별 토큰 사용량 누적 */
function accumulateTokens({ input = 0, output = 0 }) {
  const monthKey = currentMonthKey();
  const prev = appState.monthlyTokenEstimate;

  // 월이 바뀌면 리셋
  const current = prev.month === monthKey
    ? { ...prev }
    : { month: monthKey, inputTokens: 0, outputTokens: 0 };

  current.inputTokens  += input;
  current.outputTokens += output;

  setState({ monthlyTokenEstimate: current });
}
