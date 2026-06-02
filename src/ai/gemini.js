/**
 * ai/gemini.js — Google Gemini API 직접 호출 (fetch, SDK 미사용)
 *
 * 계획서 Ⅵ-9:
 *  - generateContent API, API 키 쿼리 파라미터 방식
 *  - 모델: gemini-2.0-flash (저가) / gemini-2.0-pro (고급)
 *  - 브라우저 직접 호출 가능
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const BASE_URL_V1 = 'https://generativelanguage.googleapis.com/v1/models';

/**
 * Gemini generateContent API를 호출합니다.
 *
 * @param {Object} params
 * @param {string}   params.system   시스템 지시 (systemInstruction)
 * @param {string}   params.user     사용자 입력 (contents)
 * @param {string}   params.model    모델명 (gemini-2.0-flash / gemini-2.0-pro)
 * @param {string}   params.apiKey   Gemini API 키
 * @returns {Promise<{ text: string, usage: { input: number, output: number } }>}
 */
export async function callGemini({ system, user, model, apiKey }) {
  if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다.');

  // 모든 2.0/2.5 모델은 v1beta + systemInstruction 지원
  const endpoint = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      {
        role: 'user',
        parts: [{ text: user }],
      },
    ],
    generationConfig: {
      temperature: 0.6,        // 자연스러운 상세화 허용
      maxOutputTokens: 8192,
    },
  };

  // ── 모델별 차별화 ──
  if (model.includes('2.5-pro')) {
    // pro: 깊은 추론으로 더 풍부·정교하게
    body.generationConfig.thinkingConfig = { thinkingBudget: 2048 };
    body.generationConfig.temperature = 0.7;
  } else if (model.includes('2.5-flash')) {
    // flash: 가벼운 추론으로 빠르게
    body.generationConfig.thinkingConfig = { thinkingBudget: 512 };
    body.generationConfig.temperature = 0.5;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await parseErrorResponse(response);
    throw new Error(`Gemini 오류 (${response.status}): ${err}`);
  }

  const data = await response.json();

  // 안전 차단 확인
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini 안전 필터에 의해 차단되었습니다: ${blockReason}`);
    }
    throw new Error('Gemini 응답에 내용이 없습니다.');
  }

  // finishReason 확인
  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Gemini 안전 필터에 의해 응답이 차단되었습니다.');
  }

  const text = candidate.content?.parts
    ?.map(p => p.text)
    .filter(Boolean)
    .join('') || '';

  if (!text.trim()) {
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new Error('응답 생성 한도를 초과했습니다. gemini-2.5-flash 모델을 사용하거나 입력 내용을 줄여 주세요.');
    }
    if (candidate.finishReason === 'RECITATION') {
      throw new Error('Gemini가 저작권 우려로 응답을 중단했습니다. 입력 내용을 수정해 주세요.');
    }
    throw new Error(`Gemini 응답이 비어있습니다. (사유: ${candidate.finishReason || '알 수 없음'})`);
  }

  // 토큰 사용량
  const usage = data.usageMetadata || {};

  return {
    text: text.trim(),
    usage: {
      input:  usage.promptTokenCount     || 0,
      output: usage.candidatesTokenCount || 0,
    },
  };
}

/* ── 에러 응답 파싱 ── */
async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    return data.error?.message || data.error?.status || JSON.stringify(data.error);
  } catch {
    return response.statusText || '알 수 없는 오류';
  }
}
