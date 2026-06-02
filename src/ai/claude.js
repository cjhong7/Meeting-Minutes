/**
 * ai/claude.js — Anthropic Claude API 직접 호출 (fetch, SDK 미사용)
 *
 * 계획서 Ⅵ-9:
 *  - Messages API
 *  - 필수 헤더: anthropic-dangerous-direct-browser-access: true
 *  - 모델: claude-haiku (저가) / claude-sonnet (고급)
 *  - Claude는 오디오 미지원 → 녹음 STT는 브라우저 SR로 자동 대체
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/**
 * Claude Messages API를 호출합니다.
 *
 * @param {Object} params
 * @param {string}   params.system   시스템 메시지
 * @param {string}   params.user     사용자 메시지
 * @param {string}   params.model    모델명 (claude-haiku 등)
 * @param {string}   params.apiKey   Anthropic API 키
 * @returns {Promise<{ text: string, usage: { input: number, output: number } }>}
 */
export async function callClaude({ system, user, model, apiKey }) {
  if (!apiKey) throw new Error('Claude API 키가 설정되지 않았습니다.');

  const body = {
    model,
    max_tokens: 6500,
    system,
    messages: [
      { role: 'user', content: user },
    ],
    temperature: 0.3,
  };

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       apiKey,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await parseErrorResponse(response);
    throw new Error(`Claude 오류 (${response.status}): ${err}`);
  }

  const data = await response.json();

  // content 블록에서 텍스트 추출
  const textBlocks = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text);

  const text = textBlocks.join('').trim();

  if (!text) {
    // stop_reason 확인
    if (data.stop_reason === 'max_tokens') {
      throw new Error('Claude 응답이 최대 토큰에서 잘렸습니다. 입력을 줄여주세요.');
    }
    throw new Error('Claude 응답에 내용이 없습니다.');
  }

  return {
    text,
    usage: {
      input:  data.usage?.input_tokens  || 0,
      output: data.usage?.output_tokens || 0,
    },
  };
}

/* ── 에러 응답 파싱 ── */
async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    // Anthropic 에러 형식: { type: "error", error: { type, message } }
    return data.error?.message || data.error?.type || JSON.stringify(data);
  } catch {
    return response.statusText || '알 수 없는 오류';
  }
}
