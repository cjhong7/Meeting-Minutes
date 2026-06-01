/**
 * toast.js — 화면 하단 토스트 알림
 */

/**
 * 토스트 메시지 표시
 *
 * @param {string} message   표시할 텍스트
 * @param {'info'|'success'|'warn'|'error'} [type='info']
 * @param {number} [duration=3000]  자동 사라짐 시간 (ms)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastArea');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'status');

  container.appendChild(toast);

  // 애니메이션 트리거 (다음 프레임)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
  });

  // 자동 제거
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener(
      'transitionend',
      () => toast.remove(),
      { once: true }
    );
    // transitionend가 안 오는 브라우저 대비 fallback
    setTimeout(() => toast.remove(), 500);
  }, duration);
}
