/**
 * ai/prompt.js — AI 프롬프트 생성
 *
 * 계획서 Ⅵ-4 프롬프트 전문 기반.
 * 3엔진 공통 프롬프트, 모드별 변수(type/section1/section2) 주입.
 */

import { todayIso } from '../state.js';

/**
 * 모드별 변수 맵
 * - 녹음·타자·펜 → 회의록 모드
 * - 계획서 → 계획안 모드
 */
const MODE_VARS = {
  meeting: {
    type:     '회의록',
    section1: '결정 및 논의 사항',
    section2: '전달 사항',
  },
  plan: {
    type:     '계획안',
    section1: '주요 안건',
    section2: '안내 사항',
  },
};

/**
 * AI 프롬프트를 생성합니다.
 *
 * @param {Object} params
 * @param {string}   params.text      입력 원문
 * @param {string}   params.mode      'typing' | 'plan' | 'voice' | 'pen'
 * @param {string}   [params.title]   회의명
 * @param {string}   [params.date]    YYYY-MM-DD
 * @param {string[]} [params.agendas] 안건 목록
 * @returns {{ system: string, user: string }}
 */
export function buildPrompt({ text, mode = 'typing', title = '', date = '', agendas = [] }) {
  const isPlanning = mode === 'plan';
  const vars = isPlanning ? MODE_VARS.plan : MODE_VARS.meeting;

  const titleLabel = title.trim() || vars.type;
  const dateStr    = formatDate(date || todayIso());

  // 안건 목록이 있으면 참고 정보로 추가
  const agendaInfo = agendas.filter(a => a?.trim()).length > 0
    ? `\n\n[안건]\n${agendas.filter(a => a?.trim()).map((a, i) => `${i + 1}. ${a}`).join('\n')}`
    : '';

  const system = `당신은 학교 회의록 정리 전문가입니다.
다음 [회의 내용]을 바탕으로 핵심을 '${vars.section1}'과 '${vars.section2}'으로
구분하여 정리해주세요. 절대 제공되지 않은 정보를 추측하거나 추가하지 마세요.

[출력 형식 및 스타일 가이드라인]
1. 제목: '■ ${vars.type} ${titleLabel} (${dateStr})'
2. 2섹션 구분 (해당 내용 있을 때만)
   - [${vars.section1}]
   - [${vars.section2}]
3. 개조식 계층: 1,2,3 → 가,나,다 → -(대시)
4. 명사형 어미(~함, ~임, ~함에 따름)로 간결·전문적으로
5. 규칙:
   - 마크다운 기호(###, **, __) 절대 금지
   - 주요 항목 사이 빈 줄 하나
   - 근거 없으면 빈 섹션으로 둘 것(추측 금지)`;

  const user = `[회의 내용]${agendaInfo}\n${text}`;

  return { system, user };
}

/* ── 날짜 포맷: YYYY-MM-DD → 2026. 5. 29. ── */
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}. ${m}. ${d}.`;
}
