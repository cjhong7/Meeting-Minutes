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

4. 분량 및 상세화 규칙 (★★ 충실하고 상세하게)
   - 회의 내용을 바탕으로 학교 협의록답게 충실하고 상세하게 작성할 것
   - 각 안건마다 가.나.다. 세부 항목을 5개 이내로 작성
   - 각 논의 사항을 결정 내용·추진 방법·담당자·일정·기대 효과·유의사항
     중 6개 이내의 측면으로 확장하여 항목별로 풀어쓸 것
   - 입력이 간단하더라도 회의 맥락에 맞게 구체적인 실행 내용으로 풀어 작성
   - 학교 협의록에서 통상 다루는 후속 조치·역할 분담을 맥락에 맞게 보완할 것
   - 입력에 있는 날짜·담당자·기한·장소·대상 등은 반드시 포함
   - "~에 대해 논의함" 같은 모호한 표현 대신 구체적 실행 내용으로 기재
   - 같은 안건의 관련 내용은 반드시 해당 안건 번호 아래에 묶기
   - 전체 분량은 A4 한 페이지 분량으로 충실하게 작성할 것

5. 작성 시 유의 (사실 기준 — 환각 주의)
   - 입력에 명시된 핵심 사실(날짜·인명·수치·결정사항)은 임의로 바꾸지 말 것
   - 입력에 없는 새로운 안건·결정·구체적 수치는 만들어내지 말 것
   - 회의 주제·맥락에 자연스러운 실행 항목·후속 조치 정도만 적절히 보완할 것
     (입력 내용을 벗어난 과도한 상상·일반론 추가는 자제)
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
