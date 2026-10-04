/**
 * Modal oynalari uchun o'zgacha ochilish va yopilish animatsiyalarini boshqarish
 */

/**
  * Har qanday modalni o'zgacha exit animatsiyasi bilan yopish
  * @param {HTMLElement|string} backdropOrContainer - Modal backdrop elementi yoki ID/selektori
  * @param {Function} [onComplete] - Yopilish animatsiyasi yakunlangach chaqiriladigan callback (masalan container.innerHTML = '')
  */
export function closeModalWithAnimation(backdropOrContainer, onComplete) {
  let backdrop = typeof backdropOrContainer === 'string'
    ? document.querySelector(backdropOrContainer)
    : backdropOrContainer;

  if (!backdrop) {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer && modalContainer.firstElementChild) {
      backdrop = modalContainer.firstElementChild;
    }
  }

  if (!backdrop) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  // Agar allaqachon yopilayotgan bo'lsa qayta ishga tushmasin
  if (backdrop.dataset.closing === 'true') {
    return;
  }
  backdrop.dataset.closing = 'true';

  // Modal ichidagi oynani topamiz
  const dialog = backdrop.querySelector('.modal-dialog-box') || backdrop.firstElementChild;

  // Chiqish animatsiyalari
  backdrop.classList.remove('modal-backdrop-enter', 'animate-fade-in');
  backdrop.classList.add('modal-backdrop-exit');

  if (dialog) {
    dialog.classList.remove('modal-dialog-enter', 'animate-scale-up');
    dialog.classList.add('modal-dialog-exit');
  }

  // Animatsiya tugagach tozalash
  setTimeout(() => {
    try {
      if (typeof onComplete === 'function') {
        onComplete();
      } else {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
      }
    } catch (err) {
      console.error('Modal yopilishida xatolik:', err);
    }
  }, 220);
}
