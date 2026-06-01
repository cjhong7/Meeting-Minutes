/**
 * ai/postprocess.js — AI 응답 후처리 (양식 강제 정규화)
 *
 * 3엔진 응답을 동일 파이프라인으로 통과시켜 학교 협의록 양식 통일.
 */

/**
 * AI 생성 텍스트를 후처리합니다.
 * @param {string} raw  AI 응답 원문
 * @returns {string}     정규화된 협의록 텍스트
 */
export function postprocess(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw;

  // 1. 마크다운 기호 제거
  text = removeMarkdown(text);

  // 2. 빈 섹션 제거
  text = removeEmptySections(text);

  // 3. 번호 체계 정규화
  text = normalizeNumbering(text);

  // 4. 어미 보정 (평서형 → 명사형)
  text = convertEndings(text);

  // 5. 들여쓰기 정리 (가. 나. → 2칸, - → 4칸)
  text = normalizeIndent(text);

  // 6. 연속 빈 줄 축소 (최대 1줄)
  text = text.replace(/\n{3,}/g, '\n\n');

  // 7. 앞뒤 공백 정리
  text = text.trim();

  return text;
}

/* ── 마크다운 기호 제거 ── */
function removeMarkdown(text) {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/(?<!\w)\*(?!\s)(.*?)(?<!\s)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_(?!\s)(.*?)(?<!\s)_(?!\w)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^[•*]\s+/gm, '  ')
    .replace(/^[-*]{3,}\s*$/gm, '')
    .replace(/^━+$/gm, '');
}

/* ── 빈 섹션 제거 ── */
function removeEmptySections(text) {
  return text.replace(
    /^\[([^\]]+)\]\s*\n(\s*\n)*(?=\[|$)/gm,
    ''
  );
}

/* ── 번호 체계 정규화 ── */
function normalizeNumbering(text) {
  const circleNums = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
  return text
    .replace(/[①-⑳]/g, (match) => `${circleNums.indexOf(match) + 1}.`)
    // 1) → 1.
    .replace(/^(\s*)(\d+)\)\s*/gm, '$1$2. ')
    // (1) → 1.
    .replace(/^(\s*)\((\d+)\)\s*/gm, '$1$2. ')
    // (가) → 가.
    .replace(/^(\s*)\(([가-하])\)\s*/gm, '$1$2. ');
}

/* ── 들여쓰기 정리 ── */
function normalizeIndent(text) {
  return text.split('\n').map(line => {
    // 가~하. 으로 시작하는 줄 → 2칸 들여쓰기
    if (/^\s*[가-하]\.\s/.test(line)) {
      return '  ' + line.trim();
    }
    // - 으로 시작하는 줄 (번호가 아닌 대시) → 4칸 들여쓰기
    if (/^\s+-\s/.test(line) && !/^\s*\d/.test(line)) {
      return '    - ' + line.replace(/^\s*-\s*/, '').trim();
    }
    return line;
  }).join('\n');
}

/* ── 어미 변환 ── */
function convertEndings(text) {
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (/^\[.*\]$/.test(trimmed)) return line;
    if (/^■/.test(trimmed)) return line;

    // 이미 명사형이면 그대로
    if (/[함임됨음정][\s.]*$/.test(trimmed)) return line;
    if (/[?!？！]$/.test(trimmed)) return line;
    if (/["'"']/.test(trimmed)) return line;

    return line
      .replace(/합니다\.?$/, '함')
      .replace(/했습니다\.?$/, '했음')
      .replace(/됩니다\.?$/, '됨')
      .replace(/있습니다\.?$/, '있음')
      .replace(/없습니다\.?$/, '없음')
      .replace(/입니다\.?$/, '임')
      .replace(/습니다\.?$/, '음')
      .replace(/한다\.?$/, '함')
      .replace(/했다\.?$/, '했음')
      .replace(/된다\.?$/, '됨')
      .replace(/이다\.?$/, '임')
      .replace(/있다\.?$/, '있음')
      .replace(/없다\.?$/, '없음')
      .replace(/예정이다\.?$/, '예정임')
      .replace(/예정입니다\.?$/, '예정임')
      .replace(/필요하다\.?$/, '필요함')
      .replace(/필요합니다\.?$/, '필요함')
      .replace(/바란다\.?$/, '바람')
      .replace(/바랍니다\.?$/, '바람')
      .replace(/하겠다\.?$/, '할 예정임')
      .replace(/하겠습니다\.?$/, '할 예정임');
  }).join('\n');
}
