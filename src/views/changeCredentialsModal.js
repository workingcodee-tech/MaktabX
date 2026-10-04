/**
 * Login va Parolni Almashtirish Modali
 * Barcha rollar (Dasturchi, Maktab Admini, Sinf Rahbari) uchun xavfsiz va qulay
 */

import { closeModalWithAnimation } from '../utils/modalAnimation.js';

export function showChangeCredentialsModal({ 
  currentUser, 
  userRole, 
  targetName, 
  currentLogin: passedLogin, 
  onSave, 
  onCancel, 
  showToast,
  isFromIdLogin = false,
  reason = ''
}) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const role = currentUser?.role || userRole;
  const currentLogin = passedLogin || currentUser?.data?.login || '';

  let roleTitle = "Foydalanuvchi";
  let roleBadgeClass = "bg-blue-50 text-blue-700 border-blue-200/80";
  let accountName = targetName || currentUser?.data?.name || "Foydalanuvchi hisobi";

  if (role === 'developer') {
    roleTitle = "Tizim Dasturchisi";
    roleBadgeClass = "bg-purple-50 text-purple-700 border-purple-200/80";
    accountName = targetName || currentUser?.data?.brand || currentUser?.data?.name || "WORKING CODE";
  } else if (role === 'admin') {
    roleTitle = "Maktab Administratori";
    roleBadgeClass = "bg-blue-50 text-blue-700 border-blue-200/80";
    accountName = targetName || `${currentUser?.data?.name || 'Maktab'} (Admin: ${currentUser?.data?.adminName || ''})`;
  } else if (role === 'teacher') {
    roleTitle = "Sinf Rahbari";
    roleBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
    accountName = targetName || `${currentUser?.data?.name || 'Sinf'} (Rahbar: ${currentUser?.data?.teacherName || ''})`;
  }

  const modalTitle = isFromIdLogin ? "Yangi Login va Parol O'rnatish" : "Login va Parolni Almashtirish";
  const modalSubtitle = isFromIdLogin 
    ? "ID orqali kirdingiz. Yangi parolingizni belgilab oling" 
    : "Hisobingiz xavfsizlik ma'lumotlarini yangilang";

  modalContainer.innerHTML = `
    <div id="cred-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
      <div class="modal-dialog-box bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md my-auto max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden modal-dialog-enter">
        
        <!-- Header -->
        <div class="px-5 sm:px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl ${isFromIdLogin ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-xs' : 'bg-amber-50 text-amber-600 border border-amber-200/80'} flex items-center justify-center shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <h2 class="text-base sm:text-lg font-bold text-slate-950 truncate leading-tight">
                ${modalTitle}
              </h2>
              <p class="text-xs text-slate-500 mt-0.5 truncate">${modalSubtitle}</p>
            </div>
          </div>
          <button id="close-cred-modal-btn" class="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Yopish">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Body Form -->
        <form id="cred-form" class="flex flex-col flex-1 min-h-0 overflow-hidden text-sm">
          <div class="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
            
            ${isFromIdLogin ? `
              <!-- ID orqali kirilganda maxsus yo'naltiruvchi bildirishnoma -->
              <div class="p-4 bg-gradient-to-r from-amber-500/10 via-amber-50 to-emerald-50/50 border border-amber-300 rounded-2xl flex items-start gap-3 shadow-xs animate-fade-in">
                <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <div class="text-xs text-amber-950 space-y-1">
                  <div class="font-bold text-amber-900 flex items-center gap-2">
                    <span>Yangi parol belgilash</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ID orqali kirildi
                    </span>
                  </div>
                  <p class="text-slate-600 leading-relaxed text-[11.5px]">
                    ${reason || "Siz hisobingizga <strong>Tiklash ID</strong> raqami orqali kirdingiz. Yangi parolni qayerdan qo'yishni izlab yurmashingiz uchun ushbu oyna avtomatik ochildi. O'zingizga qulay yangi login va parol o'rnating."}
                  </p>
                </div>
              </div>
            ` : ''}

            <!-- Hisob egasi info kartochkasi -->
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hisob turi</span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadgeClass}">
                  ${roleTitle}
                </span>
              </div>
              <div class="text-xs font-bold text-slate-800 truncate">${accountName}</div>

              ${role === 'teacher' && currentUser?.data?.recoveryId ? `
                <div class="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div class="text-[11px] text-slate-500">
                    <span class="font-semibold text-emerald-800">Tiklash ID:</span> Parolni unutganda ishlatiladi
                  </div>
                  <span class="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 select-all">
                    ${currentUser.data.recoveryId}
                  </span>
                </div>
              ` : ''}
            </div>

            <!-- Login maydoni -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cred-new-login">
                Login / Foydalanuvchi nomi <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </div>
                <input 
                  type="text" 
                  id="cred-new-login" 
                  value="${currentLogin}" 
                  required
                  autocomplete="username"
                  placeholder="Yangi login kiriting" 
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 text-sm transition-all placeholder:text-slate-400 font-medium"
                />
              </div>
              <p class="text-[11px] text-slate-400 mt-1">Tizimga kirish uchun ushbu logindan foydalanasiz</p>
            </div>

            <!-- Yangi parol maydoni -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cred-new-pwd">
                Yangi parol <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
                <input 
                  type="password" 
                  id="cred-new-pwd" 
                  required
                  autocomplete="new-password"
                  placeholder="Kamida 4 ta belgi" 
                  class="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 text-sm transition-all placeholder:text-slate-400"
                />
                <button 
                  type="button" 
                  id="toggle-new-pwd-btn" 
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabindex="-1"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Yangi parolni tasdiqlash maydoni -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cred-confirm-pwd">
                Yangi parolni takrorlang <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <input 
                  type="password" 
                  id="cred-confirm-pwd" 
                  required
                  autocomplete="new-password"
                  placeholder="Yangi parolni qayta kiriting" 
                  class="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 text-sm transition-all placeholder:text-slate-400"
                />
                <button 
                  type="button" 
                  id="toggle-confirm-pwd-btn" 
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabindex="-1"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Eslatma -->
            <div class="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 flex items-start gap-2.5">
              <svg class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div class="text-[11px] text-amber-900 leading-relaxed">
                Yangi login va parolingizni eslab qoling. Parol o'zgartirilgach, keyingi safar tizimga kirishda faqat yangi ma'lumotlar amal qiladi.
              </div>
            </div>

            <!-- PIN-kod himoyasi bloki -->
            <div class="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200/80 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-indigo-950 truncate">Kabinetni PIN-kod bilan qulflash</div>
                  <div class="text-[10.5px] text-slate-500 truncate">${currentUser?.data?.pinCode ? "PIN-kod himoyasi faol ✅" : "Har gal profilingizga kirganda 4 xonali PIN talab qilinadi"}</div>
                </div>
              </div>
              <button 
                type="button" 
                id="modal-open-pin-btn" 
                class="px-2.5 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100/50 font-bold text-[11px] shrink-0 cursor-pointer transition-colors"
              >
                ${currentUser?.data?.pinCode ? "Sozlash" : "O'rnatish"}
              </button>
            </div>

          </div>

          <!-- Footer Buttons -->
          <div class="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button 
              type="button" 
              id="cancel-cred-btn" 
              class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
            >
              ${isFromIdLogin ? 'Keyinroq' : 'Bekor qilish'}
            </button>
            <button 
              type="submit" 
              id="save-cred-btn" 
              class="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold text-xs shadow-md shadow-amber-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span>Saqlash va yangilash</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  const backdrop = document.getElementById('cred-modal-backdrop');

  const closeModal = (callback) => {
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (typeof callback === 'function') {
        callback();
      } else if (onCancel) {
        onCancel();
      }
    });
  };

  document.getElementById('close-cred-modal-btn')?.addEventListener('click', () => closeModal());
  document.getElementById('cancel-cred-btn')?.addEventListener('click', () => closeModal());

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  // Password toggle helpers
  const setupToggle = (btnId, inputId) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input) {
      btn.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    }
  };

  setupToggle('toggle-new-pwd-btn', 'cred-new-pwd');
  setupToggle('toggle-confirm-pwd-btn', 'cred-confirm-pwd');

  // PIN settings trigger
  const pinBtn = document.getElementById('modal-open-pin-btn');
  if (pinBtn) {
    pinBtn.addEventListener('click', () => {
      closeModal(() => {
        if (options?.onOpenPinSettings) {
          options.onOpenPinSettings();
        }
      });
    });
  }

  // Submit handler
  const form = document.getElementById('cred-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newLogin = document.getElementById('cred-new-login')?.value.trim();
    const newPwd = document.getElementById('cred-new-pwd')?.value.trim();
    const confirmPwd = document.getElementById('cred-confirm-pwd')?.value.trim();

    if (!newLogin || newLogin.length < 3) {
      if (showToast) showToast("Login kamida 3 ta belgidan iborat bo'lishi kerak!", 'error');
      return;
    }

    if (!newPwd || newPwd.length < 4) {
      if (showToast) showToast("Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak!", 'error');
      return;
    }

    if (newPwd !== confirmPwd) {
      if (showToast) showToast("Yangi parol va tasdiqlash paroli bir-biriga mos kelmadi!", 'error');
      return;
    }

    closeModal(() => {
      onSave({
        newLogin,
        newPassword: newPwd
      });
    });
  });

  // Avtomatik yangi parol kiritish maydoniga fokus qaratish
  setTimeout(() => {
    const pwdInput = document.getElementById('cred-new-pwd');
    if (pwdInput) {
      pwdInput.focus();
    }
  }, 120);
}
