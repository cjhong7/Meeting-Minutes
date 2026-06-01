/**
 * export/print.js — 인쇄 유틸리티
 *
 * 스펙 (계획서 Ⅷ-4):
 *  - styles/print.css가 media="print"로 자동 적용
 *  - A4 세로, 여백 최소화
 *  - 표 행 분리 방지 (page-break-inside: avoid)
 *  - 태블릿 탭으로 미리보기가 숨겨진 경우에도 인쇄 가능하도록 처리
 */

import { appState } from '../state.js';
import { showToast } from '../ui/toast.js';

/**
 * 협의록을 인쇄합니다.
 * 태블릿 모드에서 미리보기 탭이 숨겨져 있어도 인쇄 CSS가 처리합니다.
 */
export function printMinutes() {
  if (!appState.meeting.minutes) {
    showToast('협의록을 먼저 생성해 주세요.', 'warn');
    return;
  }

  window.print();
}
