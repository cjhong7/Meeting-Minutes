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

  // 2.0 모델은 v1, 2.5+ 모델은 v1beta 사용
  const useV1 = model.includes('2.0');
  const base = useV1 ? BASE_URL_V1 : BASE_URL;
  const endpoint = `${base}/${model}:generateContent?key=${apiKey}`;

  // v1은 systemInstruction 미지원 → 시스템 메시지를 사용자 메시지에 합침
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: useV1 ? `${system}\n\n${user}` : user }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  // v1beta만 systemInstruction 지원
  if (!useV1) {
    body.systemInstruction = { parts: [{ text: system }] };
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
    throw new Error('Gemini 응답이 비어있습니다.');
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
