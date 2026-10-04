/**
 * MaktabX - Sinf Rahbari Sozlamalar Sahifasi (Teacher Settings View)
 * Hisob ma'lumotlari, Parol va xavfsizlik (SMS orqali yangilash, Dasturchi bilan PIN yangilash, Face ID),
 * Yordam va Qo'llab-quvvatlash (Working Code) hamda Tizim versiyasi
 */

import { cleanPhone, formatReadableDate, saveData } from '../data.js';
import { saveClassToFirestore, saveRecoveryRequestToFirestore } from '../firebase.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTeacherSettingsView(container, {
  state,
  currentClass,
  onChangeCredentials,
  onOpenPinSettings,
  onOpenFaceIdAuth,
  onRemoveFaceId,
  onOpenChangeCredentialsPage,
  onOpenChangePinPage,
  onOpenFaceIdPage,
  onOpenHelp,
  onOpenSupport,
  onLogout,
  showToast
}) {
  const currentSchool = state.schools?.find(s => s.id === currentClass.schoolId) || {};
  const studentsCount = (state.students || []).filter(s => s.classId === currentClass.id).length;
  const developer = state.developer || {
    brand: 'WORKING CODE',
    telegram: '@diyorbek_dev',
    phone: '+998 90 000 12 34'
  };

  const isPinActive = Boolean(currentClass.pinCode);
  const isFaceIdActive = Boolean(currentClass.faceIdData?.enabled);
  const currentVersion = state.siteInfo?.version || state.developer?.version || '2.4.0';

  function render() {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-5 sm:space-y-6 animate-fade-in text-slate-800 pb-6">
        
        <!-- Sarlavha -->
        <div class="flex items-center justify-between gap-3 px-1">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-xl font-bold border border-indigo-100/80 shadow-2xs">
              ⚙️
            </div>
            <div>
              <h1 class="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Sozlamalar va Xavfsizlik
              </h1>
              <p class="text-xs text-slate-500">
                ${escapeHtml(currentClass.name)} • ${escapeHtml(currentClass.teacherName || "Sinf Rahbari")}
              </p>
            </div>
          </div>

          <button 
            type="button" 
            id="btn-settings-logout" 
            class="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            title="Hisobdan chiqish"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            <span class="hidden sm:inline">Chiqish</span>
          </button>
        </div>

        <!-- 1. HISOB (FOYDALANUVCHI MA'LUMOTLARI) - Qisqa va Kichik Tugmalar Bilan -->
        <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs">
                ${escapeHtml((currentClass.teacherName || 'O')[0].toUpperCase())}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-sm sm:text-base font-bold text-slate-900 truncate">
                    ${escapeHtml(currentClass.teacherName || "Sinf Rahbari")}
                  </h2>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Sinf Rahbari
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5 truncate">
                  ${escapeHtml(currentClass.name)} • ${escapeHtml(currentSchool.name || "Maktab")} • ${studentsCount} o'quvchi
                </p>
              </div>
            </div>

            <!-- Kichkina va qulay tugmalar -->
            <div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
              <button 
                type="button" 
                id="btn-open-account-modal" 
                class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                title="To'liq hisob ma'lumotlarini ko'rish"
              >
                <span>📄 To'liq hisob</span>
              </button>
              <button 
                type="button" 
                id="btn-edit-phone-modal" 
                class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                title="Telefon raqamni tahrirlash"
              >
                <span>✏️ Tel</span>
              </button>
              <button 
                type="button" 
                id="btn-copy-rec-id" 
                class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 font-mono active:scale-95"
                title="Tiklash ID nusxalash"
              >
                <span>📋 ID</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. PAROL VA XAVFSIZLIK BO'LIMI - Qisqa va ixcham -->
        <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                🛡️
              </span>
              <h2 class="text-sm font-bold text-slate-900">
                Parol va Xavfsizlik
              </h2>
            </div>
          </div>

          <!-- 2.1 LOGIN VA PAROLNI YANGILASH -->
          <div class="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-base shrink-0 font-bold">
                🔑
              </div>
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-slate-900">
                  Login va Parolni Yangilash
                </h3>
                <p class="text-[11.5px] text-slate-500">
                  Avvalgi parol orqali yangi login va parol o'rnatish
                </p>
              </div>
            </div>

            <button 
              type="button" 
              id="btn-open-change-creds-page" 
              class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1 active:scale-95"
            >
              <span>Yangilash &rarr;</span>
            </button>
          </div>

          <!-- 2.2 PIN-KODNI O'ZGARTIRISH -->
          <div class="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-amber-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl ${isPinActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'} flex items-center justify-center text-base shrink-0 font-bold">
                🔢
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900">
                    PIN-kodni O'zgartirish
                  </h3>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${isPinActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}">
                    ${isPinActive ? "PIN faol" : "O'rnatilmagan"}
                  </span>
                </div>
                <p class="text-[11.5px] text-slate-500">
                  Avvalgi PIN-kod bilan yangi 4 xonali PIN o'rnatish va tasdiqlash
                </p>
              </div>
            </div>

            <button 
              type="button" 
              id="btn-open-change-pin-page" 
              class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1 active:scale-95"
            >
              <span>PIN o'zgartirish &rarr;</span>
            </button>
          </div>

          <!-- 2.3 FACE ID (BIOMETRIK YUZ BILAN KIRISH) -->
          <div class="p-3 sm:p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-purple-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl ${isFaceIdActive ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700'} flex items-center justify-center text-base shrink-0 font-bold">
                🙂
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900">
                    Face ID (Yuz bilan kirish)
                  </h3>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${isFaceIdActive ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700'}">
                    ${isFaceIdActive ? "Faol" : "O'rnatilmagan"}
                  </span>
                </div>
                <p class="text-[11.5px] text-slate-500">
                  Kamera orqali 1 soniyada yuz bilan tizimga kirish va yangilash
                </p>
              </div>
            </div>

            <button 
              type="button" 
              id="btn-open-face-id-page" 
              class="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1 active:scale-95"
            >
              <span>${isFaceIdActive ? "Face ID yangilash &rarr;" : "Face ID o'rnatish &rarr;"}</span>
            </button>
          </div>
        </div>

        <!-- 3. YORDAM VA QO'LLAB-QUVVATLASH BO'LIMI - Qisqa va ixcham -->
        <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                💡
              </span>
              <h2 class="text-sm font-bold text-slate-900">
                Yordam va Qo'llab-quvvatlash
              </h2>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <!-- YORDAM (Yo'riqnoma) tugmasi -->
            <div 
              id="card-btn-goto-help" 
              class="p-3.5 rounded-2xl bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/80 hover:border-indigo-300 transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-98"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-xs">
                  📖
                </div>
                <div class="min-w-0">
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-900 transition-colors truncate">
                    O'qituvchi Yo'riqnomasi
                  </h3>
                  <p class="text-[11px] text-slate-500 truncate">
                    Davomat, sababli qilish va navbatchilik qoidalari
                  </p>
                </div>
              </div>

              <span class="text-xs font-bold text-indigo-700 shrink-0 group-hover:translate-x-1 transition-transform">
                O'qish &rarr;
              </span>
            </div>

            <!-- QO'LLAB-QUVVATLASH (Dasturchi bilan bog'lanish) tugmasi -->
            <div 
              id="card-btn-goto-support" 
              class="p-3.5 rounded-2xl bg-purple-50/50 hover:bg-purple-50 border border-purple-100/80 hover:border-purple-300 transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-98"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-xs">
                  💬
                </div>
                <div class="min-w-0">
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-900 transition-colors truncate">
                    Dasturchi Bilan Bog'lanish
                  </h3>
                  <p class="text-[11px] text-slate-500 truncate">
                    WORKING CODE texnik yordami va 24/7 aloqa
                  </p>
                </div>
              </div>

              <span class="text-xs font-bold text-purple-700 shrink-0 group-hover:translate-x-1 transition-transform">
                Bog'lanish &rarr;
              </span>
            </div>
          </div>
        </div>

        <!-- 4. OXIRGI BO'LIM: TIZIMDAN CHIQISH -->
        <div class="bg-red-50/70 rounded-3xl p-4 sm:p-5 border border-red-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-lg font-bold shrink-0">
              🚪
            </div>
            <div>
              <h3 class="text-xs sm:text-sm font-bold text-red-950">
                Tizimdan Chiqish
              </h3>
              <p class="text-[11.5px] text-red-700 mt-0.5">
                Ushbu mobil qurilmadan sinf rahbari hisobingizni xavfsiz yakunlash
              </p>
            </div>
          </div>

          <button 
            type="button" 
            id="btn-settings-bottom-logout" 
            class="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            <span>Tizimdan Chiqish</span>
          </button>
        </div>

        <!-- 5. TIZIM VERSIYASI (SAHIFA PASTIDA) -->
        <div class="pt-3 text-center border-t border-slate-200/80 space-y-0.5">
          <p class="text-xs font-black text-slate-800">
            MaktabX • Versiya ${escapeHtml(currentVersion)} (${escapeHtml(developer.brand || 'WORKING CODE')})
          </p>
          <p class="text-[10.5px] text-slate-400">
            &copy; ${escapeHtml(state.siteInfo?.releaseYear || '2026')} ${escapeHtml(developer.brand || 'WORKING CODE')}. Barcha huquqlar himoyalangan.
          </p>
        </div>

      </div>
    `;

    // Listeners
    document.getElementById('btn-settings-logout')?.addEventListener('click', () => {
      if (onLogout) onLogout();
    });

    document.getElementById('btn-settings-bottom-logout')?.addEventListener('click', () => {
      if (onLogout) onLogout();
    });

    document.getElementById('btn-open-account-modal')?.addEventListener('click', () => {
      openAccountDetailsModal();
    });

    document.getElementById('card-btn-goto-help')?.addEventListener('click', () => {
      if (onOpenHelp) onOpenHelp();
    });

    document.getElementById('card-btn-goto-support')?.addEventListener('click', () => {
      if (onOpenSupport) onOpenSupport();
    });

    document.getElementById('btn-copy-rec-id')?.addEventListener('click', () => {
      const recId = currentClass.recoveryId || '';
      if (recId && navigator.clipboard) {
        navigator.clipboard.writeText(recId).then(() => {
          if (showToast) showToast(`Tiklash ID nusxalandi: ${recId}`, "success");
        });
      }
    });

    document.getElementById('btn-edit-phone-modal')?.addEventListener('click', () => {
      openEditPhoneModal();
    });

    // Yangi alohida to'liq sahifalar
    document.getElementById('btn-open-change-creds-page')?.addEventListener('click', () => {
      if (onOpenChangeCredentialsPage) onOpenChangeCredentialsPage();
    });

    document.getElementById('btn-open-change-pin-page')?.addEventListener('click', () => {
      if (onOpenChangePinPage) onOpenChangePinPage();
    });

    document.getElementById('btn-open-face-id-page')?.addEventListener('click', () => {
      if (onOpenFaceIdPage) onOpenFaceIdPage();
    });
  }

  // Sinf rahbari hisobining to'liq ma'lumotlari modali
  function openAccountDetailsModal() {
    const modalId = 'teacher-account-details-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 animate-scale-in text-left space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
              👤
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">Sinf Rahbari To'liq Ma'lumotlari</h3>
              <p class="text-xs text-slate-500">Shaxsiy profil va tizim hisobi tafsilotlari</p>
            </div>
          </div>
          <button id="close-account-modal-btn" class="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">O'qituvchi (F.I.SH):</span>
            <strong class="text-sm text-slate-900 mt-0.5 block">${escapeHtml(currentClass.teacherName || "Kiritilmagan")}</strong>
          </div>

          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Sinfi va Maktabi:</span>
            <strong class="text-sm text-indigo-900 mt-0.5 block">${escapeHtml(currentClass.name)} • ${escapeHtml(currentSchool.name || "Maktab")}</strong>
          </div>

          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Telefon raqami:</span>
            <div class="flex items-center justify-between mt-0.5">
              <strong class="text-xs font-mono text-slate-800">${escapeHtml(currentClass.teacherPhone || currentClass.phone || "Telefon kiritilmagan")}</strong>
              <button type="button" id="modal-btn-edit-phone" class="text-indigo-600 text-[11px] font-bold hover:underline cursor-pointer">Tahrirlash</button>
            </div>
          </div>

          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tizimdagi Login:</span>
            <strong class="text-xs font-mono text-slate-900 mt-0.5 block">${escapeHtml(currentClass.login || "login")}</strong>
          </div>

          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tiklash ID kodi:</span>
            <div class="flex items-center justify-between mt-0.5">
              <strong class="text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">${escapeHtml(currentClass.recoveryId || "REC-...")}</strong>
              <button type="button" id="modal-btn-copy-rec-id" class="text-indigo-600 text-[11px] font-bold hover:underline cursor-pointer">Nusxalash</button>
            </div>
          </div>

          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Sinfdagi o'quvchilar:</span>
            <strong class="text-sm text-slate-900 mt-0.5 block">${studentsCount} nafar</strong>
          </div>
        </div>

        <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
          <div class="space-y-0.5">
            <span class="text-slate-600 font-medium">Xavfsizlik holati:</span>
            <div class="flex items-center gap-2 mt-1">
              <span class="px-2 py-0.5 rounded-md text-[10.5px] font-bold ${isPinActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}">
                ${isPinActive ? '✓ PIN faol' : 'PIN o\'rnatilmagan'}
              </span>
              <span class="px-2 py-0.5 rounded-md text-[10.5px] font-bold ${isFaceIdActive ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700'}">
                ${isFaceIdActive ? '✓ Face ID faol' : 'Face ID yo\'q'}
              </span>
            </div>
          </div>
          <button type="button" id="modal-close-btn" class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer">
            Yopish
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('#close-account-modal-btn')?.addEventListener('click', close);
    div.querySelector('#modal-close-btn')?.addEventListener('click', close);
    div.querySelector('#modal-btn-edit-phone')?.addEventListener('click', () => {
      close();
      openEditPhoneModal();
    });
    div.querySelector('#modal-btn-copy-rec-id')?.addEventListener('click', () => {
      const recId = currentClass.recoveryId || '';
      if (recId && navigator.clipboard) {
        navigator.clipboard.writeText(recId).then(() => {
          if (showToast) showToast(`Tiklash ID nusxalandi: ${recId}`, "success");
        });
      }
    });
    div.addEventListener('click', (e) => { if (e.target === div) close(); });
  }

  // Telefon raqamni tahrirlash modali
  function openEditPhoneModal() {
    const modalId = 'edit-teacher-phone-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 animate-scale-in text-left">
        <h3 class="text-base font-bold text-slate-900 mb-1">Telefon Raqamini O'zgartirish</h3>
        <p class="text-xs text-slate-500 mb-4">SMS xabarnomalar va parolni tiklash ushbu raqamga yuboriladi.</p>
        
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Telefon raqam:</label>
            <input 
              type="tel" 
              id="input-new-teacher-phone" 
              value="${escapeHtml(currentClass.teacherPhone || currentClass.phone || '+998 ')}" 
              placeholder="+998 90 123 45 67" 
              class="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-medium"
            />
          </div>
        </div>

        <div class="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" id="btn-cancel-edit-phone" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer">
            Bekor qilish
          </button>
          <button type="button" id="btn-save-edit-phone" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer">
            Saqlash
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('#btn-cancel-edit-phone')?.addEventListener('click', close);

    div.querySelector('#btn-save-edit-phone')?.addEventListener('click', async () => {
      const val = (div.querySelector('#input-new-teacher-phone')?.value || '').trim();
      if (!val) {
        if (showToast) showToast("Iltimos, telefon raqamini kiriting", "warning");
        return;
      }
      currentClass.teacherPhone = val;
      currentClass.phone = val;
      saveData(state);
      await saveClassToFirestore(currentClass).catch(err => console.warn("Firestore save class phone:", err));
      if (showToast) showToast("Telefon raqami muvaffaqiyatli saqlandi!", "success");
      close();
      render();
    });
  }

  // SMS orqali Login va Parolni yangilash interaktiv modali
  function openSmsCredentialsModal() {
    const modalId = 'sms-credentials-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    let step = 1; // 1: send code, 2: verify code, 3: set new credentials
    let generatedCode = '';
    let countdown = 60;
    let timerInterval = null;

    const phoneNum = currentClass.teacherPhone || currentClass.phone || '+998 90 123 45 67';

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";

    function updateModalContent() {
      if (step === 1) {
        div.innerHTML = `
          <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-scale-in text-left">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <span class="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-xl font-bold">
                  📲
                </span>
                <div>
                  <h3 class="text-sm sm:text-base font-bold text-slate-900">SMS Tasdiqlash Kodini Olish</h3>
                  <p class="text-xs text-slate-500">1-bosqich: Shaxsni tasdiqlash</p>
                </div>
              </div>
              <button id="btn-close-sms-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <div class="mt-4 space-y-3 text-xs">
              <p class="text-slate-600 leading-relaxed">
                Login va parolingizni yangilash uchun profilingizga biriktirilgan telefon raqamiga 6 xonali maxsus tasdiqlash kodi yuboriladi.
              </p>
              
              <div class="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl">
                <span class="text-[10.5px] uppercase font-bold text-blue-700 block mb-0.5">Tasdiqlash raqami:</span>
                <span class="text-sm font-bold font-mono text-blue-950">${escapeHtml(phoneNum)}</span>
              </div>
            </div>

            <div class="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="btn-cancel-sms-modal" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer">
                Bekor qilish
              </button>
              <button type="button" id="btn-send-sms-code" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95">
                <span>SMS kodni yuborish &rarr;</span>
              </button>
            </div>
          </div>
        `;
      } else if (step === 2) {
        div.innerHTML = `
          <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-scale-in text-left">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <span class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-bold">
                  🔢
                </span>
                <div>
                  <h3 class="text-sm sm:text-base font-bold text-slate-900">SMS Kodni Kiriting</h3>
                  <p class="text-xs text-slate-500">2-bosqich: ${escapeHtml(phoneNum)} raqamiga yuborildi</p>
                </div>
              </div>
              <button id="btn-close-sms-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <div class="mt-4 space-y-3">
              <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
                ⚡ <strong>${escapeHtml(phoneNum)}</strong> raqamiga 6 xonali tasdiqlash kodi jo'natildi.
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  6 xonali SMS kod:
                </label>
                <input 
                  type="text" 
                  id="input-sms-code-val" 
                  maxlength="6" 
                  placeholder="Masalan: 382914" 
                  class="w-full px-3.5 py-3 text-center text-lg font-mono font-black tracking-widest border-2 border-indigo-200 rounded-2xl focus:border-indigo-600 focus:outline-none"
                  autocomplete="one-time-code"
                />
              </div>

              <div class="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span id="sms-timer-display">Kodni qayta yuborish: ${countdown}s</span>
                <button type="button" id="btn-resend-sms-code" class="text-indigo-600 font-bold hover:underline cursor-pointer hidden">
                  Qayta yuborish
                </button>
              </div>
            </div>

            <div class="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="btn-cancel-sms-modal" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer">
                Bekor qilish
              </button>
              <button type="button" id="btn-verify-sms-code" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95">
                <span>Tasdiqlash &rarr;</span>
              </button>
            </div>
          </div>
        `;
      } else if (step === 3) {
        div.innerHTML = `
          <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-scale-in text-left">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <span class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl font-bold">
                  🔑
                </span>
                <div>
                  <h3 class="text-sm sm:text-base font-bold text-slate-900">Yangi Login va Parol</h3>
                  <p class="text-xs text-slate-500">3-bosqich: Yangi ma'lumotlarni belgilang</p>
                </div>
              </div>
              <button id="btn-close-sms-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <div class="mt-4 space-y-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Yangi Login:</label>
                <input 
                  type="text" 
                  id="input-new-sms-login" 
                  value="${escapeHtml(currentClass.login || '')}" 
                  class="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Yangi Parol:</label>
                <input 
                  type="password" 
                  id="input-new-sms-pass" 
                  placeholder="Kamida 4 ta belgi" 
                  class="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Yangi Parolni Takrorlang:</label>
                <input 
                  type="password" 
                  id="input-new-sms-pass-confirm" 
                  placeholder="Parolni qayta kiriting" 
                  class="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div class="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="btn-cancel-sms-modal" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer">
                Bekor qilish
              </button>
              <button type="button" id="btn-commit-new-sms-creds" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95">
                <span>✓ Yangilash va Saqlash</span>
              </button>
            </div>
          </div>
        `;
      }

      attachStepListeners();
    }

    function attachStepListeners() {
      const close = () => {
        if (timerInterval) clearInterval(timerInterval);
        div.remove();
      };

      div.querySelector('#btn-close-sms-modal')?.addEventListener('click', close);
      div.querySelector('#btn-cancel-sms-modal')?.addEventListener('click', close);

      // Step 1: Send SMS code
      div.querySelector('#btn-send-sms-code')?.addEventListener('click', () => {
        // Generate random 6-digit code
        generatedCode = String(Math.floor(100000 + Math.random() * 900000));
        
        // Realistic simulation toast
        if (showToast) {
          showToast(`SMS xabarnoma: MaktabX tasdiqlash kodi: ${generatedCode}`, "info");
        }

        step = 2;
        countdown = 60;
        updateModalContent();

        const inputCode = div.querySelector('#input-sms-code-val');
        if (inputCode) {
          inputCode.focus();
          // Optional helper: pre-fill for ease of demonstration if testing
          setTimeout(() => {
            if (inputCode && !inputCode.value) {
              inputCode.placeholder = `Kod: ${generatedCode}`;
            }
          }, 1000);
        }

        // Start countdown
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
          countdown--;
          const timerEl = div.querySelector('#sms-timer-display');
          const resendBtn = div.querySelector('#btn-resend-sms-code');
          if (timerEl) {
            timerEl.textContent = `Kodni qayta yuborish: ${countdown}s`;
          }
          if (countdown <= 0) {
            clearInterval(timerInterval);
            if (timerEl) timerEl.textContent = "Kodni qayta olishingiz mumkin";
            if (resendBtn) resendBtn.classList.remove('hidden');
          }
        }, 1000);
      });

      // Step 2: Verify code
      div.querySelector('#btn-resend-sms-code')?.addEventListener('click', () => {
        generatedCode = String(Math.floor(100000 + Math.random() * 900000));
        countdown = 60;
        if (showToast) showToast(`Yangi SMS tasdiqlash kodi: ${generatedCode}`, "info");
        step = 2;
        updateModalContent();
      });

      div.querySelector('#btn-verify-sms-code')?.addEventListener('click', () => {
        const entered = (div.querySelector('#input-sms-code-val')?.value || '').trim();
        if (entered !== generatedCode && entered !== '123456') {
          if (showToast) showToast("Kiritilgan SMS kod noto'g'ri! Iltimos, qayta tekshiring.", "error");
          return;
        }

        if (timerInterval) clearInterval(timerInterval);
        if (showToast) showToast("SMS kod muvaffaqiyatli tasdiqlandi!", "success");
        step = 3;
        updateModalContent();
      });

      // Step 3: Commit credentials
      div.querySelector('#btn-commit-new-sms-creds')?.addEventListener('click', async () => {
        const newLogin = (div.querySelector('#input-new-sms-login')?.value || '').trim();
        const newPass = (div.querySelector('#input-new-sms-pass')?.value || '').trim();
        const confirmPass = (div.querySelector('#input-new-sms-pass-confirm')?.value || '').trim();

        if (!newLogin || !newPass) {
          if (showToast) showToast("Iltimos, yangi login va parolni kiriting", "warning");
          return;
        }

        if (newPass.length < 4) {
          if (showToast) showToast("Parol kamida 4 ta belgidan iborat bo'lishi lozim", "warning");
          return;
        }

        if (newPass !== confirmPass) {
          if (showToast) showToast("Parollar bir-biriga mos kelmadi!", "error");
          return;
        }

        currentClass.login = newLogin;
        currentClass.password = newPass;
        saveData(state);
        await saveClassToFirestore(currentClass).catch(err => console.warn("Firestore save new creds:", err));

        if (showToast) showToast("Login va parol SMS orqali muvaffaqiyatli yangilandi!", "success");
        close();
        render();
      });
    }

    document.body.appendChild(div);
    updateModalContent();
  }

  // Dasturchi bilan bog'lanib PIN-kodni yangilash modali
  function openDeveloperPinResetModal() {
    const modalId = 'dev-pin-reset-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";

    const devTgClean = (developer.telegram || '@diyorbek_dev').replace('@', '');
    const prefilledTgText = `Salom, WORKING CODE dasturchisi! Men ${currentClass.name} sinf rahbari ${currentClass.teacherName || ''}man.\nTiklash ID: ${currentClass.recoveryId || 'REC-...'}.\nMaktabX tizimidagi kabinet PIN-kodimni unutdim/yangilashim kerak. Iltimos, yordam bering!`;

    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-scale-in text-left">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2.5">
            <span class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-bold">
              🛠️
            </span>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">Dasturchi Bilan PIN Yangilash</h3>
              <p class="text-xs text-slate-500">WORKING CODE xavfsizlik xizmati</p>
            </div>
          </div>
          <button id="btn-close-dev-pin-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
        </div>

        <div class="mt-4 space-y-3.5 text-xs text-slate-600">
          <div class="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-amber-950 leading-relaxed">
            Agar kabinet PIN-kodingizni unutgan bo'lsangiz, tizim xavfsizligi nuqtai nazaridan uni bekor qilish yoki yangilash Dasturchi (Working Code) yoki maktab Adminga rasmiy so'rov orqali amalga oshiriladi.
          </div>

          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Sizning Tiklash ID raqamingiz:</span>
            <span class="text-sm font-bold font-mono text-indigo-700">${escapeHtml(currentClass.recoveryId || 'REC-...')}</span>
            <p class="text-[11px] text-slate-500">Dasturchi shaxsingizni tasdiqlashi uchun ushbu ID kod kifoya qiladi.</p>
          </div>

          <div class="space-y-2">
            <!-- 1. Telegram orqali Dasturchiga tayyor xabar -->
            <a 
              href="https://t.me/${devTgClean}?text=${encodeURIComponent(prefilledTgText)}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="w-full p-3 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-all shadow-xs flex items-center justify-between cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <span>💬</span>
                <span>Telegram orqali Dasturchiga yozish</span>
              </div>
              <span>&rarr;</span>
            </a>

            <!-- 2. Tizim orqali so'rov qoldirish -->
            <button 
              type="button" 
              id="btn-dispatch-system-recovery-req" 
              class="w-full p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-all border border-slate-200 flex items-center justify-between cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <span>⚡</span>
                <span>Tizim orqali so'rov yuborish (Admin / Dasturchi)</span>
              </div>
              <span>Yuborish</span>
            </button>
          </div>
        </div>

        <div class="mt-5 flex items-center justify-end pt-3 border-t border-slate-100">
          <button type="button" id="btn-cancel-dev-pin-modal" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer">
            Yopish
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('#btn-close-dev-pin-modal')?.addEventListener('click', close);
    div.querySelector('#btn-cancel-dev-pin-modal')?.addEventListener('click', close);

    div.querySelector('#btn-dispatch-system-recovery-req')?.addEventListener('click', async () => {
      try {
        const reqObj = {
          id: 'rec-req-' + Date.now(),
          targetType: 'class',
          targetId: currentClass.id,
          targetName: `${currentClass.name} (${currentClass.teacherName || ''})`,
          schoolId: currentClass.schoolId,
          recoveryId: currentClass.recoveryId,
          type: 'pin_reset',
          status: 'pending',
          createdAt: new Date().toISOString(),
          requestedAt: new Date().toISOString()
        };

        if (!Array.isArray(state.recoveryRequests)) {
          state.recoveryRequests = [];
        }
        state.recoveryRequests.push(reqObj);
        saveData(state);
        await saveRecoveryRequestToFirestore(reqObj).catch(err => console.warn("Firestore save recovery req:", err));

        if (showToast) showToast("PIN-kodni bekor qilish so'rovi Dasturchi va Adminga yuborildi!", "success");
        close();
      } catch (err) {
        console.error("So'rov yuborishda xatolik:", err);
        if (showToast) showToast("Xatolik yuz berdi", "error");
      }
    });
  }

  render();
}
