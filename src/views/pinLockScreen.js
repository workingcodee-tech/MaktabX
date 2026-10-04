/**
 * PIN-kod orqali qulflangan kabinet ekrani (Lock Screen)
 * Foydalanuvchi profiliga kirganda shaxsiy PIN-kod so'raladi
 * - Zamonaviy premium dizayn, optimal o'lcham va ergonomik klaviatura
 */

import { showFaceAuthModal } from './faceAuthModal.js';

export function renderPinLockScreen(container, {
  currentUser,
  getRealExpectedPin,
  onUnlock,
  onLogout,
  showToast,
  onForgotPin,
  onSaveFaceId
}) {
  const role = currentUser?.role || 'teacher';
  const data = currentUser?.data || {};

  let roleTitle = "Sinf Rahbari";
  let roleBadgeClass = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  let accountName = data.name || "Kabinet";
  let accountSubtitle = data.teacherName ? `Sinf rahbari: ${data.teacherName}` : "";

  if (role === 'developer') {
    roleTitle = "Tizim Dasturchisi";
    roleBadgeClass = "bg-purple-500/10 text-purple-300 border-purple-500/30";
    accountName = data.brand || data.name || "WORKING CODE";
    accountSubtitle = "Bosh boshqaruv va arxitektura";
  } else if (role === 'admin') {
    roleTitle = "Maktab Administratori";
    roleBadgeClass = "bg-blue-500/10 text-blue-300 border-blue-500/30";
    accountName = data.name || "Maktab Administratsiyasi";
    accountSubtitle = data.adminName ? `Mas'ul: ${data.adminName}` : "";
  }

  const getExpectedPin = () => {
    if (typeof getRealExpectedPin === 'function') {
      const p = getRealExpectedPin();
      if (p) return String(p).trim();
    }
    return String(data.pinCode || '').trim();
  };
  const isFaceIdEnrolled = Boolean(data.faceIdData?.enabled && data.faceIdData?.descriptor);

  const keypadItems = [
    { num: 1, sub: '' },
    { num: 2, sub: 'ABC' },
    { num: 3, sub: 'DEF' },
    { num: 4, sub: 'GHI' },
    { num: 5, sub: 'JKL' },
    { num: 6, sub: 'MNO' },
    { num: 7, sub: 'PQRS' },
    { num: 8, sub: 'TUV' },
    { num: 9, sub: 'WXYZ' },
  ];

  container.innerHTML = `
    <div class="h-full w-full max-h-screen bg-gradient-to-br from-slate-950 via-[#0B1120] to-[#111836] bg-grid-pattern flex flex-col justify-between items-center py-2 px-3 sm:px-6 select-none overflow-hidden relative">
      
      <!-- Orqa fon nurlari -->
      <div class="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none animate-pulse-slow"></div>
      <div class="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-blue-600/20 blur-3xl pointer-events-none animate-pulse-slow"></div>

      <!-- Yuqori brending qatori -->
      <div class="w-full max-w-[400px] flex items-center justify-between shrink-0 py-1 relative z-10">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-white/10 p-1 flex items-center justify-center border border-white/20">
            <img 
              src="/maktabx-logo.png" 
              alt="MaktabX" 
              class="w-full h-full object-contain drop-shadow-xs" 
              referrerPolicy="no-referrer"
            />
          </div>
          <span class="font-black text-white text-sm tracking-tight">MaktabX</span>
        </div>

        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${roleBadgeClass}">
          ${roleTitle}
        </span>
      </div>

      <!-- Markaziy Qulf Kartasi (Kompakt va scroll bo'lmaydigan qilib sozlangan) -->
      <div class="w-full max-w-[380px] sm:max-w-[390px] my-auto bg-white rounded-3xl shadow-2xl shadow-indigo-950/70 border border-slate-200/90 p-4 sm:p-5 flex flex-col items-center text-center shrink animate-fade-in relative z-10">
        
        <!-- Qulf Ikonkasi -->
        <div class="relative mb-2">
          <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center shadow-xs">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <div class="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white shadow-xs">
            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>
            </svg>
          </div>
        </div>

        <!-- Hisob ma'lumotlari -->
        <h2 class="text-base sm:text-lg font-black text-slate-900 leading-tight truncate max-w-[320px]">
          ${accountName}
        </h2>
        ${accountSubtitle ? `<p class="text-[11px] text-slate-500 font-medium truncate max-w-[320px] mt-0.5">${accountSubtitle}</p>` : ''}

        <p class="text-xs text-slate-500 font-medium mt-0.5 mb-2">
          Kirish uchun 4 xonali PIN-kodni tering
        </p>

        <!-- PIN Nuqtalari -->
        <div id="pin-dots-container" class="flex items-center justify-center gap-3.5 mb-1.5 py-1 transition-all">
          <div class="pin-dot w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-slate-300 bg-slate-100 transition-all duration-150"></div>
          <div class="pin-dot w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-slate-300 bg-slate-100 transition-all duration-150"></div>
          <div class="pin-dot w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-slate-300 bg-slate-100 transition-all duration-150"></div>
          <div class="pin-dot w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-slate-300 bg-slate-100 transition-all duration-150"></div>
        </div>

        <!-- Xatolik xabari -->
        <div id="pin-error-msg" class="min-h-[18px] text-[11px] font-semibold text-rose-600 flex items-center justify-center gap-1 transition-opacity opacity-0 mb-1.5">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Noto'g'ri PIN-kod! Qaytadan tering.</span>
        </div>

        <!-- Ergonomik Klaviatura -->
        <div class="w-full max-w-[280px] sm:max-w-[300px] grid grid-cols-3 gap-2 sm:gap-2.5 mb-2">
          ${keypadItems.map(item => `
            <button 
              type="button" 
              data-pin-key="${item.num}" 
              class="pin-key-btn w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-full mx-auto bg-slate-50 hover:bg-slate-100 active:bg-indigo-600 border border-slate-200 hover:border-indigo-300 active:border-indigo-600 shadow-2xs active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer group select-none"
            >
              <span class="text-lg sm:text-xl font-bold text-slate-800 group-active:text-white transition-colors leading-none">${item.num}</span>
              ${item.sub ? `<span class="text-[8px] sm:text-[9px] font-bold text-slate-400 group-hover:text-indigo-600 group-active:text-indigo-200 transition-colors tracking-wider leading-none mt-0.5 uppercase">${item.sub}</span>` : ''}
            </button>
          `).join('')}
          
          <!-- Clear / C -->
          <button 
            type="button" 
            id="pin-clear-btn" 
            class="w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-full mx-auto bg-slate-100/90 hover:bg-slate-200 active:bg-slate-300 text-slate-600 font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer select-none"
            title="Tozalash"
          >
            C
          </button>

          <!-- 0 -->
          <button 
            type="button" 
            data-pin-key="0" 
            class="pin-key-btn w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-full mx-auto bg-slate-50 hover:bg-slate-100 active:bg-indigo-600 border border-slate-200 hover:border-indigo-300 active:border-indigo-600 shadow-2xs active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer group select-none"
          >
            <span class="text-lg sm:text-xl font-bold text-slate-800 group-active:text-white transition-colors leading-none">0</span>
            <span class="text-[9px] font-bold text-slate-400 group-hover:text-indigo-600 group-active:text-indigo-200 transition-colors leading-none mt-0.5">+</span>
          </button>

          <!-- Backspace -->
          <button 
            type="button" 
            id="pin-backspace-btn" 
            class="w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-full mx-auto bg-slate-100/90 hover:bg-slate-200 active:bg-slate-300 text-slate-600 active:scale-95 transition-all flex items-center justify-center cursor-pointer select-none"
            title="O'chirish"
          >
            <svg class="w-4.5 h-4.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2H10.828a2 2 0 01-1.414-.586L3 12z"/>
            </svg>
          </button>
        </div>

        <!-- Yashirin input -->
        <input 
          type="password" 
          id="pin-hidden-input" 
          inputmode="numeric" 
          pattern="[0-9]*" 
          maxlength="4" 
          autocomplete="off" 
          class="opacity-0 absolute -z-10 w-0 h-0 pointer-events-none" 
        />

        <!-- Face ID Tugmasi (Faqat Face ID o'rnatilgan bo'lsa) -->
        ${isFaceIdEnrolled ? `
          <div class="w-full max-w-[280px] sm:max-w-[300px] mb-1.5">
            <button 
              type="button" 
              id="pin-face-id-btn" 
              class="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Face ID orqali ochish</span>
            </button>
          </div>
        ` : ''}

        <!-- PIN unutdingizmi? havolasi -->
        <button 
          type="button" 
          id="pin-forgot-btn" 
          class="text-[11px] sm:text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer py-0.5 inline-flex items-center gap-1"
        >
          <svg class="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>PIN-kodni unutdingizmi?</span>
        </button>

      </div>

      <!-- Pastki Chiqish Tugmasi -->
      <div class="w-full max-w-[400px] flex items-center justify-center shrink-0 py-1 relative z-10">
        <button 
          type="button" 
          id="pin-logout-btn" 
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer border border-transparent hover:border-white/15"
        >
          <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          <span>Boshqa hisobga o'tish (Chiqish)</span>
        </button>
      </div>

    </div>
  `;

  let currentEnteredPin = '';
  const dots = container.querySelectorAll('.pin-dot');
  const errorMsg = container.querySelector('#pin-error-msg');
  const dotsContainer = container.querySelector('#pin-dots-container');
  const hiddenInput = container.querySelector('#pin-hidden-input');

  function updateDots() {
    dots.forEach((dot, idx) => {
      if (idx < currentEnteredPin.length) {
        dot.className = 'pin-dot w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-indigo-600 bg-indigo-600 shadow-md shadow-indigo-500/40 scale-110 transition-all duration-150';
      } else {
        dot.className = 'pin-dot w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-slate-300 bg-slate-100 transition-all duration-150';
      }
    });
  }

  function showError() {
    if (errorMsg) errorMsg.classList.remove('opacity-0');
    if (dotsContainer) {
      dotsContainer.classList.add('animate-shake');
      dots.forEach(dot => {
        dot.className = 'pin-dot w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-rose-500 bg-rose-500 shadow-md shadow-rose-500/40 transition-all duration-150';
      });
      setTimeout(() => {
        dotsContainer.classList.remove('animate-shake');
        currentEnteredPin = '';
        if (hiddenInput) hiddenInput.value = '';
        updateDots();
      }, 500);
    }
  }

  function handleDigit(digit) {
    if (currentEnteredPin.length >= 4) return;
    if (errorMsg) errorMsg.classList.add('opacity-0');
    currentEnteredPin += String(digit);
    if (hiddenInput) hiddenInput.value = currentEnteredPin;
    updateDots();

    if (currentEnteredPin.length === 4) {
      setTimeout(() => {
        const targetPin = getExpectedPin();
        if (targetPin && targetPin.length === 4 && currentEnteredPin === targetPin) {
          dots.forEach(dot => {
            dot.className = 'pin-dot w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-emerald-500 bg-emerald-500 shadow-md shadow-emerald-500/40 scale-125 transition-all duration-150';
          });
          setTimeout(() => {
            const ok = onUnlock ? onUnlock(currentEnteredPin) : true;
            if (ok === false) {
              showError();
            }
          }, 150);
        } else {
          showError();
        }
      }, 100);
    }
  }

  function handleBackspace() {
    if (currentEnteredPin.length > 0) {
      currentEnteredPin = currentEnteredPin.slice(0, -1);
      if (hiddenInput) hiddenInput.value = currentEnteredPin;
      if (errorMsg) errorMsg.classList.add('opacity-0');
      updateDots();
    }
  }

  function handleClear() {
    currentEnteredPin = '';
    if (hiddenInput) hiddenInput.value = '';
    if (errorMsg) errorMsg.classList.add('opacity-0');
    updateDots();
  }

  // Keypad click listeners
  container.querySelectorAll('.pin-key-btn').forEach(btn => {
    btn.onclick = () => {
      const digit = btn.dataset.pinKey;
      handleDigit(digit);
    };
  });

  const clearBtn = container.querySelector('#pin-clear-btn');
  if (clearBtn) clearBtn.onclick = handleClear;

  const backspaceBtn = container.querySelector('#pin-backspace-btn');
  if (backspaceBtn) backspaceBtn.onclick = handleBackspace;

  // Keyboard handler
  const handleKeyDown = (e) => {
    if (e.key >= '0' && e.key <= '9') {
      handleDigit(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
      handleClear();
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  // Auto-focus hidden input on click anywhere to support virtual keyboards
  container.onclick = (e) => {
    if (!e.target.closest('button')) {
      hiddenInput?.focus();
    }
  };

  // Face ID orqali kirish (faqat o'rnatilgan bo'lsa)
  const faceIdBtn = container.querySelector('#pin-face-id-btn');
  if (faceIdBtn) {
    faceIdBtn.onclick = () => {
      const isEnrolled = Boolean(data.faceIdData?.enabled && data.faceIdData?.descriptor);
      if (!isEnrolled) return;

      showFaceAuthModal({
        mode: 'verify',
        currentUser,
        savedFaceData: data.faceIdData,
        onSuccess: () => {
          window.removeEventListener('keydown', handleKeyDown);
          showToast("Face ID orqali muvaffaqiyatli qulfdan ochildi! Xush kelibsiz!", 'success');
          if (onUnlock) onUnlock();
        },
        showToast
      });
    };
  }

  // Logout button
  const logoutBtn = container.querySelector('#pin-logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (onLogout) onLogout();
    };
  }

  // Forgot PIN button
  const forgotBtn = container.querySelector('#pin-forgot-btn');
  if (forgotBtn) {
    forgotBtn.onclick = () => {
      if (onForgotPin) {
        onForgotPin();
      } else {
        showToast("PIN-kodni unutgan bo'lsangiz, Maktab Administratori orqali hisobingiz parolini yangilashingiz mumkin.", 'info');
      }
    };
  }

  // Cleanup on unload/unmount
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}
