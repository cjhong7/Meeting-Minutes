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
  const validAgendas = (agendas || []).filter(a => a?.trim());

  // 1. 줄 분리 + 전처리
  const lines = text.split('\n').map(l => preprocessLine(l));

  // 2. 섹션 분류
  const { sec1Lines, sec2Lines } = splitSections(lines);

  // 3. 안건이 있으면 안건 제목 중심으로 구조화
  const parts = [];
  parts.push(`■ ${type} ${titleLabel} (${dateStr})`);
  parts.push('');

  const sec1Content = sec1Lines.length ? sec1Lines : lines;
  const sec1NonEmpty = sec1Content.filter(l => l.trim());

  parts.push(`[${section1}]`);

  if (validAgendas.length > 0 && sec1NonEmpty.length > 0) {
    // 안건 기반 구조화: 각 안건을 1단계 제목으로, 내용을 가나다로 배치
    if (validAgendas.length === 1) {
      // 안건 1개: 제목 + 전체 내용을 하위로
      parts.push(`1. ${validAgendas[0]}`);
      const subItems = normalizeSectionAsSub(sec1Content);
      if (subItems.trim()) parts.push(subItems);
    } else {
      // 안건 여러 개: 내용을 안건 수로 균등 배분
      const linesPerAgenda = Math.ceil(sec1NonEmpty.length / validAgendas.length);
      validAgendas.forEach((agenda, i) => {
        parts.push(`${i + 1}. ${agenda}`);
        const start = i * linesPerAgenda;
        const chunk = sec1NonEmpty.slice(start, start + linesPerAgenda);
        if (chunk.length > 0) {
          const subItems = normalizeSectionAsSub(chunk);
          if (subItems.trim()) parts.push(subItems);
        }
      });
    }
  } else {
    // 안건 없음: 기존 방식
    const normalized = normalizeSection(sec1Content);
    if (normalized.trim()) parts.push(normalized);
  }

  parts.push('');

  if (sec2Lines.filter(l => l.trim()).length > 0) {
    parts.push(`[${section2}]`);
    parts.push(normalizeSection(sec2Lines));
    parts.push('');
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
 * 안건 하위 항목으로 정규화 (가. 나. 다. → - 2단계)
 * 안건 제목이 이미 1단계이므로 내용은 2단계부터 시작
 */
function normalizeSectionAsSub(lines) {
  const KO_ALPHA = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
  const result = [];
  let alphaIdx = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    const content = line.trim()
      .replace(/^(\d+[).]\s*)/, '')
      .replace(/^([가-하][).]\s*)/, '')
      .replace(/^[-•]\s*/, '');

    const finalContent = convertVerb(content.trim());
    if (!finalContent) continue;

    const indent = line.match(/^(\s*)/)[1].length;
    if (indent >= 4) {
      result.push(`    - ${finalContent}`);
    } else {
      const letter = KO_ALPHA[alphaIdx % KO_ALPHA.length];
      alphaIdx++;
      result.push(`  ${letter}. ${finalContent}`);
    }
  }

  return result.join('\n');
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
  if (/[함임됨음정][\s.]*$/.test(text)) return text;
  // 물음표·느낌표 문장은 그대로
  if (/[?!？！]$/.test(text)) return text;
  // 인용·따옴표 포함 시 그대로
  if (/["'"']/.test(text)) return text;

  // 동사 어미 변환
  return text
    .replace(/합니다\.?$/, '함')
    .replace(/했습니다\.?$/, '했음')
    .replace(/됩니다\.?$/, '됨')
    .replace(/있습니다\.?$/, '있음')
    .replace(/없습니다\.?$/, '없음')
    .replace(/입니다\.?$/, '임')
    .replace(/습니다\.?$/, '음')
    .replace(/한다\.?$/, '함')
    .replace(/했다\.?$/, '했음')
    .replace(/이다\.?$/, '임')
    .replace(/있다\.?$/, '있음')
    .replace(/없다\.?$/, '없음')
    .replace(/된다\.?$/, '됨')
    .replace(/예정이다\.?$/, '예정임')
    .replace(/예정입니다\.?$/, '예정임')
    .replace(/필요하다\.?$/, '필요함')
    .replace(/필요합니다\.?$/, '필요함')
    .replace(/하겠다\.?$/, '할 예정임')
    .replace(/하겠습니다\.?$/, '할 예정임')
    .replace(/바란다\.?$/, '바람')
    .replace(/바랍니다\.?$/, '바람')
    .replace(/\.$/, '');  // 마지막 마침표 제거
}

/** YYYY-MM-DD → 2026. 5. 29. */
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}. ${m}. ${d}.`;
}
