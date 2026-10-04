/**
 * Hisobdan Chiqishni Tasdiqlash Modali (Logout Confirmation Modal)
 * Foydalanuvchi tasodifan yoki bilmasdan chiqib ketmasligi uchun tasdiqlash so'raydi
 */
import { closeModalWithAnimation } from '../utils/modalAnimation.js';

export function showLogoutConfirmModal({ 
  accountName, 
  roleTitle, 
  badgeColor = "bg-blue-50 text-blue-700 border-blue-200", 
  isDeveloper = false, 
  onConfirm, 
  onCancel 
}) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div id="logout-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
      <div class="modal-dialog-box bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md p-5 sm:p-6 text-center my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain modal-dialog-enter">
        
        <!-- Chiqish Ikonkasi -->
        <div class="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100 shadow-inner">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </div>

        <!-- Sarlavha -->
        <h3 class="text-base sm:text-lg font-bold text-slate-900">
          Hisobdan chiqishni tasdiqlaysizmi?
        </h3>

        <!-- Profil haqida ma'lumot qutisi -->
        <div class="my-4 p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl text-left">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="text-[11px] font-medium text-slate-400">Joriy profil:</span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}">
              ${roleTitle || 'Foydalanuvchi'}
            </span>
          </div>
          <p class="text-xs sm:text-sm font-bold text-slate-800 break-words">
            ${accountName || 'Faol foydalanuvchi hisobi'}
          </p>
        </div>

        <p class="text-xs text-slate-500 mb-6 leading-relaxed">
          ${isDeveloper 
            ? "Tizimdan chiqqaningizdan so'ng, Dasturchi paneliga qayta kirish uchun yana login va parol kiritishingiz talab etiladi." 
            : "Chiqish tugmasini bossangiz, tizimdan to'liq chiqasiz. Keyingi safar kirish uchun yana login va parolingizni kiritasiz."}
        </p>

        <!-- Tugmalar -->
        <div class="flex items-center gap-3">
          <button 
            id="cancel-logout-modal-btn"
            type="button" 
            class="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors text-xs sm:text-sm cursor-pointer"
          >
            Yo'q, qolish
          </button>
          <button 
            id="confirm-logout-modal-btn"
            type="button" 
            class="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-md shadow-rose-200 transition-colors text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            <span>Ha, chiqish</span>
          </button>
        </div>

      </div>
    </div>
  `;

  const backdrop = document.getElementById('logout-modal-backdrop');

  const closeModal = (callback) => {
    document.removeEventListener('keydown', handleKeyDown);
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (typeof callback === 'function') {
        callback();
      } else if (onCancel) {
        onCancel();
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  document.addEventListener('keydown', handleKeyDown);

  document.getElementById('cancel-logout-modal-btn')?.addEventListener('click', () => closeModal());
  document.getElementById('confirm-logout-modal-btn')?.addEventListener('click', () => {
    closeModal(() => {
      if (onConfirm) onConfirm();
    });
  });

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }
}
