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

/**
 * 모델 등급 맵 (계획서 Ⅵ-6)
 *  - low:  저가형 (기본)
 *  - high: 고급형 (고품질 토글)
 */
const MODEL_MAP = {
  openai: {
    low:  'gpt-4o-mini',
    high: 'gpt-4o',
  },
  gemini: {
    low:  'gemini-2.0-flash',
    high: 'gemini-2.0-pro-exp-03-25',
  },
  claude: {
    low:  'claude-haiku-4-20250414',
    high: 'claude-sonnet-4-20250514',
  },
};

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
  const engine  = appState.aiEngine;   // 'openai' | 'gemini' | 'claude' | 'sim'
  const quality = appState.aiQuality;  // 'low' | 'high'

  // ── 키 없음 → 로컬 시뮬레이션 ──
  if (engine === 'sim') {
    return simulate({ text, mode, title, date, agendas });
  }

  // ── API 키 가져오기 ──
  const apiKey = getApiKey(engine);
  if (!apiKey) {
    throw new Error(
      `${engineLabel(engine)} API 키가 설정되지 않았습니다.\n` +
      '⚙ AI 설정에서 키를 입력해 주세요.'
    );
  }

  // ── 프롬프트 빌드 ──
  const { system, user } = buildPrompt({ text, mode, title, date, agendas });

  // ── 모델 선택 ──
  const model = MODEL_MAP[engine]?.[quality] || MODEL_MAP[engine]?.low;

  // ── 엔진별 호출 ──
  let result;
  switch (engine) {
    case 'openai':
      result = await callOpenAI({ system, user, model, apiKey });
      break;
    case 'gemini':
      result = await callGemini({ system, user, model, apiKey });
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

/** sessionStorage에서 API 키 가져오기 (Stage 4에서 keystore.js로 교체) */
function getApiKey(engine) {
  return sessionStorage.getItem(`anti_key_${engine}`) || '';
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
