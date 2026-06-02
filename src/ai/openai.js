/**
 * ai/openai.js — OpenAI API 직접 호출 (fetch, SDK 미사용)
 *
 * 계획서 Ⅵ-9:
 *  - Chat Completions API
 *  - 브라우저 직접 호출 (dangerouslyAllowBrowser 개념, 실제로는 fetch)
 *  - 모델: gpt-4o-mini (저가) / gpt-4o (고급)
 *
 * STT (Whisper)는 Stage 5(녹음 모드)에서 구현.
 */

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * OpenAI Chat Completions API를 호출합니다.
 *
 * @param {Object} params
 * @param {string}   params.system   시스템 메시지
 * @param {string}   params.user     사용자 메시지
 * @param {string}   params.model    모델명 (gpt-4o-mini / gpt-4o)
 * @param {string}   params.apiKey   OpenAI API 키
 * @returns {Promise<{ text: string, usage: { input: number, output: number } }>}
 */
export async function callOpenAI({ system, user, model, apiKey }) {
  if (!apiKey) throw new Error('OpenAI API 키가 설정되지 않았습니다.');

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ],
    temperature: 0.3,
    max_tokens: 3500,
  };

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await parseErrorResponse(response);
    throw new Error(`OpenAI 오류 (${response.status}): ${err}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice?.message?.content) {
    throw new Error('OpenAI 응답에 내용이 없습니다.');
  }

  return {
    text: choice.message.content.trim(),
    usage: {
      input:  data.usage?.prompt_tokens     || 0,
      output: data.usage?.completion_tokens || 0,
    },
  };
}

/**
 * Whisper STT — Stage 5(녹음 모드)에서 구현 예정
 */
export async function whisperTranscribe({ audioBlob, apiKey, language = 'ko' }) {
  throw new Error('Whisper STT는 Stage 5(녹음 모드)에서 구현됩니다.');
}

/* ── 에러 응답 파싱 ── */
async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    return data.error?.message || data.error?.code || JSON.stringify(data.error);
  } catch {
    return response.statusText || '알 수 없는 오류';
  }
}
