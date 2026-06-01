/**
 * ai/postprocess.js — AI 응답 후처리 (양식 강제 정규화)
 *
 * 계획서 Ⅵ-7:
 *  - 마크다운 기호 자동 제거
 *  - 번호 1 · 가 · - 정규화
 *  - 빈 섹션 제거 (환각 방지)
 *  - 평서형 어미 → 명사형 보정
 *
 * 3엔진 응답을 동일 파이프라인으로 통과시켜 양식 통일.
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

  // 2. 빈 섹션 제거 (섹션 헤더만 있고 내용 없는 경우)
  text = removeEmptySections(text);

  // 3. 번호 체계 경미한 정규화 (이미 AI가 지시대로 했으면 변경 적음)
  text = normalizeNumbering(text);

  // 4. 어미 보정 (평서형 → 명사형, 보수적)
  text = convertEndings(text);

  // 5. 연속 빈 줄 축소 (최대 1줄)
  text = text.replace(/\n{3,}/g, '\n\n');

  // 6. 앞뒤 공백 정리
  text = text.trim();

  return text;
}

/* ================================================================
   내부 함수
   ================================================================ */

/** 마크다운 기호 제거 */
function removeMarkdown(text) {
  return text
    // 헤딩 (### 등)
    .replace(/^#{1,6}\s*/gm, '')
    // 볼드 (**text** 또는 __text__)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // 이탤릭 (*text* 또는 _text_)  — 단독 *만 제거, 1→가→- 패턴은 보호
    .replace(/(?<!\w)\*(?!\s)(.*?)(?<!\s)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_(?!\s)(.*?)(?<!\s)_(?!\w)/g, '$1')
    // 코드 블록 (```)
    .replace(/```[\s\S]*?```/g, '')
    // 인라인 코드 (`text`)
    .replace(/`([^`]+)`/g, '$1')
    // 취소선 (~~text~~)
    .replace(/~~(.*?)~~/g, '$1')
    // 불릿 기호 (• 또는 * 으로 시작하는 줄 → 공백으로 대체, - 는 보존)
    .replace(/^[•*]\s+/gm, '  ')
    // 수평선 (---  또는 ***)
    .replace(/^[-*]{3,}\s*$/gm, '');
}

/** 빈 섹션 제거: 섹션 헤더([...]) 바로 뒤에 다음 섹션이나 끝이 오면 제거 */
function removeEmptySections(text) {
  // [섹션명] 다음에 빈 줄만 있고 바로 다른 [섹션] 또는 끝이면 제거
  return text.replace(
    /^\[([^\]]+)\]\s*\n(\s*\n)*(?=\[|$)/gm,
    ''
  );
}

/** 번호 체계 경미한 정규화 */
function normalizeNumbering(text) {
  // 1) 또는 1. 은 그대로 유지 (AI가 대부분 맞게 생성)
  // ① ② 같은 원문자 → 1. 2. 변환
  const circleNums = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
  return text.replace(/[①-⑳]/g, (match) => {
    const idx = circleNums.indexOf(match) + 1;
    return `${idx}.`;
  });
}

/** 어미 변환 (평서형 → 명사형, 보수적) */
function convertEndings(text) {
  return text.split('\n').map(line => {
    const trimmed = line.trim();

    // 빈 줄·섹션 헤더·제목은 건너뜀
    if (!trimmed) return line;
    if (/^\[.*\]$/.test(trimmed)) return line;
    if (/^■/.test(trimmed)) return line;

    // 이미 명사형이면 그대로
    if (/[함임됨음정볼][\s.]*$/.test(trimmed)) return line;
    // 물음표·느낌표·인용 포함 시 그대로
    if (/[?!？！]$/.test(trimmed)) return line;
    if (/["'"']/.test(trimmed)) return line;

    // 어미 변환 (줄 전체가 아닌 마지막 어미만)
    const converted = line
      .replace(/합니다\.?$/,     '함')
      .replace(/했습니다\.?$/,   '했음')
      .replace(/됩니다\.?$/,     '됨')
      .replace(/있습니다\.?$/,   '있음')
      .replace(/없습니다\.?$/,   '없음')
      .replace(/입니다\.?$/,     '임')
      .replace(/습니다\.?$/,     '음')
      .replace(/한다\.?$/,       '함')
      .replace(/했다\.?$/,       '했음')
      .replace(/된다\.?$/,       '됨')
      .replace(/이다\.?$/,       '임')
      .replace(/있다\.?$/,       '있음')
      .replace(/없다\.?$/,       '없음')
      .replace(/예정이다\.?$/,   '예정임')
      .replace(/예정입니다\.?$/, '예정임')
      .replace(/필요하다\.?$/,   '필요함')
      .replace(/필요합니다\.?$/, '필요함')
      .replace(/바란다\.?$/,     '바람')
      .replace(/바랍니다\.?$/,   '바람');

    return converted;
  }).join('\n');
}
