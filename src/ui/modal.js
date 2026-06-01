/**
 * modal.js — 모달 열기/닫기 유틸리티
 */

let _confirmResolver = null;

/* ============================================================
   기본 open / close
   ============================================================ */

/**
 * 모달 표시
 * @param {string} id  모달 overlay 의 id
 */
export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.removeAttribute('hidden');
  document.body.classList.add('modal-open');

  // 첫 포커스 가능한 요소에 포커스
  requestAnimationFrame(() => {
    const focusable = el.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  });
}

/**
 * 모달 닫기
 * @param {string} id  모달 overlay 의 id
 */
export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute('hidden', '');

  // 다른 열린 모달이 없으면 body 스크롤 복원
  const anyOpen = document.querySelector('.modal-overlay:not([hidden])');
  if (!anyOpen) document.body.classList.remove('modal-open');
}

/* ============================================================
   오버레이 클릭 + ESC 닫기 초기화
   (main.js 에서 앱 부팅 시 1회 호출)
   ============================================================ */
export function initModalBehaviors() {
  // 오버레이 바깥 클릭으로 닫기
  document.addEventListener('click', e => {
    if (!e.target.classList.contains('modal-overlay')) return;
    // 면책 모달은 오버레이 클릭으로 안 닫힘
    if (e.target.id === 'modalDisclaimer') return;
    e.target.setAttribute('hidden', '');
    const anyOpen = document.querySelector('.modal-overlay:not([hidden])');
    if (!anyOpen) document.body.classList.remove('modal-open');
    if (_confirmResolver) { _confirmResolver(false); _confirmResolver = null; }
  });

  // data-close 버튼으로 닫기
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-close]');
    if (!btn) return;
    closeModal(btn.dataset.close);
    if (_confirmResolver) { _confirmResolver(false); _confirmResolver = null; }
  });

  // ESC 키로 닫기
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const openOverlays = Array.from(
      document.querySelectorAll('.modal-overlay:not([hidden])')
    );
    if (!openOverlays.length) return;
    const last = openOverlays[openOverlays.length - 1];
    if (last.id === 'modalDisclaimer') return; // 면책 모달 ESC 불가
    closeModal(last.id);
    if (_confirmResolver) { _confirmResolver(false); _confirmResolver = null; }
  });
}

/* ============================================================
   확인 모달 (비동기 Promise)
   ============================================================ */

/**
 * 확인 모달을 열고 사용자 응답(true/false)을 Promise로 반환
 *
 * @param {string} message   표시할 메시지 (줄바꿈 \n 포함 가능)
 * @param {string} [okLabel] 확인 버튼 텍스트 (기본 '확인')
 * @returns {Promise<boolean>}
 */
export function confirm(message, okLabel = '확인') {
  document.getElementById('confirmMsg').textContent = message;
  const okBtn = document.getElementById('btnConfirmYes');
  if (okBtn) okBtn.textContent = okLabel;
  openModal('modalConfirm');

  return new Promise(resolve => {
    _confirmResolver = resolve;

    const yes = document.getElementById('btnConfirmYes');
    const no  = document.getElementById('btnConfirmNo');

    const onYes = () => { cleanup(); resolve(true);  };
    const onNo  = () => { cleanup(); resolve(false); };

    function cleanup() {
      yes?.removeEventListener('click', onYes);
      no?.removeEventListener('click', onNo);
      closeModal('modalConfirm');
      _confirmResolver = null;
    }

    yes?.addEventListener('click', onYes, { once: true });
    no?.addEventListener('click', onNo,  { once: true });
  });
}
