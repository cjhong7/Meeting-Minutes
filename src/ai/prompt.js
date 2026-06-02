/**
 * ai/prompt.js — AI 프롬프트 생성
 *
 * 학교 협의록 양식 규칙 + 안건 중심 구조화.
 * 3엔진 공통, 모드별 변수(type/section1/section2) 주입.
 */

import { todayIso } from '../state.js';

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
 * @param {Object} params
 * @returns {{ system: string, user: string }}
 */
export function buildPrompt({ text, mode = 'typing', title = '', date = '', agendas = [] }) {
  const isPlanning = mode === 'plan';
  const vars = isPlanning ? MODE_VARS.plan : MODE_VARS.meeting;

  const titleLabel = title.trim() || vars.type;
  const dateStr    = formatDate(date || todayIso());

  // 유효한 안건 목록
  const validAgendas = agendas.filter(a => a?.trim());
  const hasAgendas   = validAgendas.length > 0;

  // 안건 기반 출력 구조 예시 생성
  const agendaExample = hasAgendas
    ? validAgendas.map((a, i) => `${i + 1}. ${a}\n  가. (이 안건에 해당하는 논의·결정 내용 정리)\n  나. (세부 사항)`).join('\n')
    : '1. 안건 제목\n  가. 세부 논의 내용\n    - 구체적 사항\n  나. 결정 사항';

  const system = `당신은 대한민국 초·중·고등학교 협의록 작성 전문가입니다.
아래 [회의 내용]을 학교 공문서 양식에 맞는 정식 협의록으로 작성해 주세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[★ 가장 중요한 규칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${hasAgendas
  ? `이 회의의 안건은 다음과 같습니다:
${validAgendas.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}

반드시 위 안건 제목을 [${vars.section1}]의 1단계 번호(1. 2. 3.)로 사용하고,
각 안건 아래에 해당하는 회의 내용을 가. 나. 다. 로 분류·정리해 주세요.
회의 내용 중 안건과 직접 관련 없는 전달·공지 사항은 [${vars.section2}]로 분리하세요.`
  : `회의 내용에서 주요 안건을 파악하여 [${vars.section1}]에 번호별로 정리하고,
전달·공지 사항은 [${vars.section2}]로 분리해 주세요.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[출력 양식]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ ${vars.type} ${titleLabel} (${dateStr})

[${vars.section1}]
${agendaExample}

[${vars.section2}]
1. 전달 항목
  가. 세부 내용

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 안건 중심 구조화
   - [${vars.section1}]의 1단계 번호(1. 2. 3.)는 반드시 안건 제목으로 사용
   - 각 안건 아래 관련 논의·결정 내용을 가. 나. 다.로 세분화
   - 안건과 무관한 전달 사항은 [${vars.section2}]로 분리
   - 안건이 1개뿐이면 1번 하나만 작성

2. 번호 체계 (개조식 3단계)
   - 1단계: 1. 2. 3. (안건 제목)
   - 2단계: 가. 나. 다. (2칸 들여쓰기, 세부 내용)
   - 3단계: - (4칸 들여쓰기, 구체적 사항)

3. 문체
   - 명사형 어미: ~함, ~임, ~됨, ~있음, ~예정임, ~필요함
   - 예) "급식 메뉴를 다양화하기로 결정함"
   - 구어체·대화체 금지, 간결한 공문서체

4. 분량 및 요약 규칙
   - 입력된 회의 내용에 담긴 사항을 빠짐없이 정리 (있는 내용은 충실히 반영)
   - 각 안건의 논의 내용을 가.나.다. 세부 항목으로 구분하여 작성
   - 각 항목은 한 문장으로 간결하게 기재
   - 입력에 있는 날짜·담당자·기한·장소·대상 등 구체적 정보는 반드시 포함
   - "~에 대해 논의함" 같은 모호한 표현 대신 입력에 적힌 구체적 결정 내용 기재
   - 같은 안건의 관련 내용은 반드시 해당 안건 번호 아래에 묶기
   - 분량은 입력 내용의 양에 비례 (내용이 많으면 길게, 적으면 짧게)

5. 금지 사항 (★★ 환각 절대 금지)
   - 입력 [회의 내용]에 실제로 적힌 내용만 사용할 것
   - 회의에서 논의되지 않은 사항을 추측·상상·일반론으로 추가하는 것 절대 금지
   - "일반적으로 학교에서는…" 같은 배경 지식 추가 금지
   - 입력에 없는 날짜·인명·수치·결정사항을 만들어내지 말 것
   - 내용이 부족하면 부족한 대로 짧게 작성 (억지로 늘리지 말 것)
   - 마크다운 기호(###, **, __, \`\`\`) 절대 금지
   - 불필요한 인사말·맺음말 금지
   - 같은 내용 반복 금지`;

  const user = `[회의 내용]\n${text}`;

  return { system, user };
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}. ${m}. ${d}.`;
}
