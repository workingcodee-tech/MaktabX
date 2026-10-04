/**
 * MaktabX - Maktab Admini Sozlamalar Sahifasi (Admin Settings View)
 * Xuddi o'qituvchi panelining sahifasidek:
 * - Hisob ma'lumotlari, Admin profili
 * - Login & Parol, PIN-kod (4 xonali), Face ID
 * - Yordam va Qo'llab-quvvatlash (WORKING CODE)
 * - Tizim versiyasi
 */

import { formatReadableDate, saveData } from '../data.js';
import { saveSchoolToFirestore } from '../firebase.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderAdminSettingsView(container, {
  state,
  currentSchool,
  onChangeCredentials,
  onOpenPinSettings,
  onOpenFaceIdAuth,
  onRemoveFaceId,
  onLogout,
  showToast
}) {
  const developer = state.developer || {
    brand: 'WORKING CODE',
    telegram: '@diyorbek_dev',
    phone: '+998 90 000 12 34'
  };

  const isPinActive = Boolean(currentSchool.pinCode);
  const isFaceIdActive = Boolean(currentSchool.faceIdData?.enabled);
  const currentVersion = state.siteInfo?.version || state.developer?.version || '2.4.0';

  const totalClasses = (state.classes || []).filter(c => c.schoolId === currentSchool.id).length;
  const totalStudents = (state.students || []).filter(s => s.schoolId === currentSchool.id).length;

  function render() {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-5 sm:space-y-6 animate-fade-in text-slate-800 pb-28">
        
        <!-- Sarlavha -->
        <div class="flex items-center justify-between gap-3 px-1">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-xl font-bold border border-indigo-100 shadow-2xs">
              ⚙️
            </div>
            <div>
              <h1 class="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Sozlamalar va Xavfsizlik
              </h1>
              <p class="text-xs text-slate-500">
                ${escapeHtml(currentSchool.name)} • ${escapeHtml(currentSchool.adminName || "Admin")}
              </p>
            </div>
          </div>

          <button 
            type="button" 
            id="admin-settings-logout-btn" 
            class="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            title="Hisobdan chiqish"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            <span>Chiqish</span>
          </button>
        </div>

        <!-- 1. HISOB (ADMIN MA'LUMOTLARI) -->
        <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs">
                ${escapeHtml((currentSchool.adminName || currentSchool.name || 'A')[0].toUpperCase())}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-sm sm:text-base font-bold text-slate-900 truncate">
                    ${escapeHtml(currentSchool.adminName || "Maktab Admini")}
                  </h2>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Maktab Admini
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5 truncate">
                  ${escapeHtml(currentSchool.name)} • ${totalClasses} ta sinf • ${totalStudents} ta o'quvchi
                </p>
                ${currentSchool.adminPhone ? `
                  <p class="text-xs text-slate-600 font-mono mt-0.5">
                    📞 ${escapeHtml(currentSchool.adminPhone)}
                  </p>
                ` : ''}
              </div>
            </div>

            <!-- Kichik va qulay tugmalar -->
            <div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
              <button 
                type="button" 
                id="btn-admin-edit-creds" 
                class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <span>🔑 Login & Parol</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. PAROL VA XAVFSIZLIK BO'LIMI -->
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
                  Admin hisobining login va parolini xavfsiz o'zgartirish
                </p>
              </div>
            </div>

            <button 
              type="button" 
              id="btn-trigger-creds" 
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
                  Kabinetga tezkor kirish uchun 4 xonali PIN-kod
                </p>
              </div>
            </div>

            <button 
              type="button" 
              id="btn-trigger-pin" 
              class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1 active:scale-95"
            >
              <span>PIN sozlash &rarr;</span>
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
              id="btn-trigger-face" 
              class="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1 active:scale-95"
            >
              <span>${isFaceIdActive ? "Face ID yangilash &rarr;" : "Face ID o'rnatish &rarr;"}</span>
            </button>
          </div>

        </div>

        <!-- 3. YORDAM VA QO'LLAB-QUVVATLASH BO'LIMI -->
        <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                💡
              </span>
              <h2 class="text-sm font-bold text-slate-900">
                Qo'llab-quvvatlash va Dasturchi bilan Aloqa
              </h2>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <!-- Telegram -->
            <a 
              href="https://t.me/${developer.telegram ? developer.telegram.replace('@', '') : 'diyorbek_dev'}" 
              target="_blank" 
              rel="noreferrer" 
              class="p-3.5 rounded-2xl bg-sky-50/60 hover:bg-sky-50 border border-sky-100 hover:border-sky-300 transition-all flex items-center justify-between gap-3 group active:scale-98"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-xs">
                  ✈️
                </div>
                <div class="min-w-0">
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-900 transition-colors truncate">
                    Telegram Aloqa
                  </h3>
                  <p class="text-[11px] text-slate-500 truncate font-mono">
                    ${escapeHtml(developer.telegram || '@diyorbek_dev')}
                  </p>
                </div>
              </div>
              <span class="text-sky-600 font-bold text-xs">&rarr;</span>
            </a>

            <!-- Telefon -->
            <a 
              href="tel:${developer.phone ? developer.phone.replace(/[^0-9+]/g, '') : '+998900001234'}" 
              class="p-3.5 rounded-2xl bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100 hover:border-emerald-300 transition-all flex items-center justify-between gap-3 group active:scale-98"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-xs">
                  📞
                </div>
                <div class="min-w-0">
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-900 transition-colors truncate">
                    Tezkor Telefon
                  </h3>
                  <p class="text-[11px] text-slate-500 truncate font-mono">
                    ${escapeHtml(developer.phone || '+998 90 000 12 34')}
                  </p>
                </div>
              </div>
              <span class="text-emerald-600 font-bold text-xs">&rarr;</span>
            </a>
          </div>
        </div>

        <!-- 4. TIZIM HAQIDA VA VERSIYA -->
        <div class="p-4 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-1 text-xs text-slate-500">
          <p class="font-bold text-slate-800">
            MaktabX • Versiya ${currentVersion}
          </p>
          <p>
            Dastur muallifi: <strong class="text-indigo-600">${developer.brand || 'WORKING CODE'}</strong>
          </p>
        </div>

      </div>
    `;

    // Listeners
    container.querySelector('#admin-settings-logout-btn')?.addEventListener('click', () => {
      if (onLogout) onLogout();
    });

    container.querySelector('#btn-admin-edit-creds')?.addEventListener('click', () => {
      if (onChangeCredentials) onChangeCredentials();
    });

    container.querySelector('#btn-trigger-creds')?.addEventListener('click', () => {
      if (onChangeCredentials) onChangeCredentials();
    });

    container.querySelector('#btn-trigger-pin')?.addEventListener('click', () => {
      if (onOpenPinSettings) onOpenPinSettings();
    });

    container.querySelector('#btn-trigger-face')?.addEventListener('click', () => {
      if (onOpenFaceIdAuth) onOpenFaceIdAuth();
    });
  }

  render();
}
