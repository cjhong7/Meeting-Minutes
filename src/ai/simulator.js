/**
 * ai/simulator.js — 키 없음 경로: 로컬 규칙 기반 협의록 생성
 *
 * 원칙 (계획서 Ⅵ-5):
 *  1. 줄 분리
 *  2. [협의안건] / [전달사항] 말머리로 2섹션 분류 (없으면 1섹션)
 *  3. 들여쓰기·기존 번호로 계층 인식 → 1 → 가 → - 재번호
 *  4. 마크다운 기호 제거 (###, **, __, •)
 *  5. 어미 보수적 자동 변환 (~함 / ~임), 불규칙·인용 시 원문 유지
 *  6. 표준 양식에 배치
 *
 * AI 없이 동작 (외부 전송 0, 비용 0, 오프라인 가능).
 * 요약·재구성 X, 입력 글을 양식에 맞게 정리만 함.
 */

import { todayIso } from '../state.js';

/**
 * @param {Object} params
 * @param {string}   params.text      입력 원문
 * @param {string}   params.mode      'typing' | 'plan' | 'voice' | 'pen'
 * @param {string}   [params.title]   회의명
 * @param {string}   [params.date]    YYYY-MM-DD
 * @param {string[]} [params.agendas] 안건 목록
 * @returns {string}  생성된 협의록 본문 (plain text)
 */
export function simulate({ text, mode = 'typing', title = '', date = '', agendas = [] }) {
  if (!text?.trim()) return '(입력 내용 없음)';

  const isPlanning = mode === 'plan';
  const type       = isPlanning ? '계획안' : '회의록';
  const section1   = isPlanning ? '주요 안건'        : '결정 및 논의 사항';
  const section2   = isPlanning ? '안내 사항'        : '전달 사항';
  const titleLabel = title.trim() || `${type}`;
  const dateStr    = formatDate(date || todayIso());

  // 1. 줄 분리 + 전처리
  const lines = text.split('\n').map(l => preprocessLine(l));

  // 2. 섹션 분류
  const { sec1Lines, sec2Lines } = splitSections(lines);

  // 3~5. 각 섹션 정규화 (계층 번호 + 어미 변환)
  const sec1Text = normalizeSection(sec1Lines);
  const sec2Text = normalizeSection(sec2Lines);

  // 6. 양식 배치
  const parts = [];
  parts.push(`■ ${type} ${titleLabel} (${dateStr})`);
  parts.push('');

  if (sec1Text.trim()) {
    parts.push(`[${section1}]`);
    parts.push(sec1Text);
    parts.push('');
  }

  if (sec2Text.trim()) {
    parts.push(`[${section2}]`);
    parts.push(sec2Text);
    parts.push('');
  }

  if (!sec1Text.trim() && !sec2Text.trim()) {
    // 섹션 구분 없이 전체 본문
    parts.push(`[${section1}]`);
    parts.push(normalizeSection(lines));
  }

  const result = parts.join('\n').trimEnd();
  return result + '\n\n※ 로컬 시뮬레이션 결과입니다. AI 키 설정 시 더 정확한 협의록을 생성할 수 있습니다.';
}

/* ============================================================
   내부 함수
   ============================================================ */

/** 한 줄 전처리: 마크다운 기호 제거, 앞뒤 공백 정리 */
function preprocessLine(line) {
  return line
    .replace(/^#{1,6}\s*/, '')       // 헤딩
    .replace(/\*\*(.*?)\*\*/g, '$1') // 볼드
    .replace(/__(.*?)__/g, '$1')     // 언더바 볼드
    .replace(/^[•*-]\s+/, '')        // 불릿
    .trimEnd();
}

/** [협의안건] / [전달사항] 말머리로 2섹션 분리 */
function splitSections(lines) {
  const sec1 = [];
  const sec2 = [];
  let current = sec1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\[협의안건\]|^\[결정.*논의\]/i.test(trimmed)) {
      current = sec1;
      continue;
    }
    if (/^\[전달사항\]|^\[안내.*사항\]/i.test(trimmed)) {
      current = sec2;
      continue;
    }
    current.push(line);
  }

  return { sec1Lines: sec1, sec2Lines: sec2 };
}

/**
 * 줄 목록을 계층 번호 + 어미 변환하여 반환
 * - 들여쓰기 없음 / 숫자+점 → depth 0 → "1."
 * - 들여쓰기 2칸 / 가나다 → depth 1 → "  가."
 * - 들여쓰기 4칸 이상 / 대시 → depth 2 → "    -"
 */
function normalizeSection(lines) {
  // 빈 줄만 있으면 건너뜀
  const nonEmpty = lines.filter(l => l.trim());
  if (!nonEmpty.length) return '';

  const result = [];
  let depth0Count = 0;
  const KO_ALPHA = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
  const depth1Counters = {};  // depth0Count → 현재 가나다 인덱스

  for (const line of lines) {
    if (!line.trim()) {
      result.push('');
      continue;
    }

    const indent = line.match(/^(\s*)/)[1].length;
    const content = line.trim()
      .replace(/^(\d+[).]\s*)/, '')   // 기존 숫자 번호 제거
      .replace(/^([가-하][).]\s*)/, '') // 기존 가나다 번호 제거
      .replace(/^[-•]\s*/, '');        // 기존 대시 제거

    const finalContent = convertVerb(content.trim());
    if (!finalContent) continue;

    if (indent === 0) {
      depth0Count++;
      depth1Counters[depth0Count] = 0;
      result.push(`${depth0Count}. ${finalContent}`);
    } else if (indent <= 3) {
      const parentIdx = depth0Count || 1;
      if (!depth1Counters[parentIdx]) depth1Counters[parentIdx] = 0;
      const idx = depth1Counters[parentIdx]++;
      const letter = KO_ALPHA[idx % KO_ALPHA.length];
      result.push(`  ${letter}. ${finalContent}`);
    } else {
      result.push(`    - ${finalContent}`);
    }
  }

  return result.join('\n');
}

/**
 * 문장 어미를 명사형으로 보수적 변환 (~함, ~임)
 * 불규칙 어미, 인용구, 이미 명사형인 경우 원문 유지
 */
function convertVerb(text) {
  if (!text) return text;

  // 이미 명사형 어미면 그대로
  if (/[함임됨됨됨볼필예정취][\s.]*$/.test(text)) return text;
  // 물음표·느낌표 문장은 그대로
  if (/[?!？！]$/.test(text)) return text;
  // 인용·따옴표 포함 시 그대로
  if (/["'"']/.test(text)) return text;

  // 동사 어미 변환 (매우 보수적)
  return text
    .replace(/한다\.?$/, '함')
    .replace(/했다\.?$/, '했음')
    .replace(/한다\.?$/, '함')
    .replace(/이다\.?$/, '임')
    .replace(/있다\.?$/, '있음')
    .replace(/없다\.?$/, '없음')
    .replace(/된다\.?$/, '됨')
    .replace(/한다\.?$/, '함')
    .replace(/예정이다\.?$/, '예정임')
    .replace(/필요하다\.?$/, '필요함')
    .replace(/\.$/, '');  // 마지막 마침표 제거
}

/** YYYY-MM-DD → 2026. 5. 29. */
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}. ${m}. ${d}.`;
}
