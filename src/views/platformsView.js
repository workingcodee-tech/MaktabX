/**
 * MaktabX - Platformalar tartibi (Dedicated Platforms Management View)
 * O'qituvchi sinf uchun platformalarni (Kundalik.com va boshqalar) boshqaradi.
 * Har bir platforma bo'yicha o'quvchilar login va parollari kiritiladi va nusxa olinadi.
 */

import { PRESET_PLATFORMS, getClassPlatforms } from '../data.js';

// O'quvchining platforma login va parolini xavfsiz olish (aliaslar va obyekt strukturasi bilan)
export function getStudentPlatformCred(student, platform) {
  if (!student || !platform) return { login: '', password: '' };
  const plats = student.platforms || {};

  // 1. To'g'ridan-to'g'ri ID orqali qidirish
  let cred = plats[platform.id];

  // 2. Agar topilmasa yoki bo'sh bo'lsa, kanonik nom orqali qidirish
  if (!cred || (!cred.login && !cred.password)) {
    const platName = (platform.name || '').toLowerCase();
    const isKundalik = platform.id === 'plat-kundalik' || platName.includes('kundalik') || platName.includes('emaktab');

    for (const [key, val] of Object.entries(plats)) {
      if (!val) continue;
      if (isKundalik && (key === 'plat-kundalik' || key.toLowerCase().includes('kundalik') || key.toLowerCase().includes('emaktab'))) {
        cred = val;
        break;
      }
    }
  }

  if (!cred) return { login: '', password: '' };

  let login = '';
  let password = '';
  if (typeof cred === 'object') {
    if (cred.login && typeof cred.login === 'object') {
      login = String(cred.login.login || '').trim();
      password = String(cred.login.password || cred.password || '').trim();
    } else {
      login = String(cred.login || '').trim();
      password = String(cred.password || '').trim();
    }
  }

  return { login, password };
}

export function renderPlatformsView(container, {
  currentClass,
  students = [],
  showToast,
  onBack,
  onAddPlatform,
  onEditPlatform,
  onUpdatePlatform,
  onDeletePlatform,
  onUpdateStudentPlatformCredential,
  onOpenStudentModal
}) {
  const classPlatforms = getClassPlatforms(currentClass);
  let activePlatformId = classPlatforms.length > 0 ? classPlatforms[0].id : null;
  let searchFilter = '';
  let showPasswordMap = {}; // { [studentId]: boolean }

  function render() {
    const platforms = getClassPlatforms(currentClass);
    if (!activePlatformId || !platforms.some(p => p.id === activePlatformId)) {
      activePlatformId = platforms.length > 0 ? platforms[0].id : null;
    }
    const currentPlatform = platforms.find(p => p.id === activePlatformId) || null;

    // Filter students by search
    const filteredStudents = students.filter(s => {
      if (!searchFilter) return true;
      const q = searchFilter.toLowerCase();
      const name = (s.fullName || `${s.lastName || ''} ${s.firstName || ''}`).toLowerCase();
      const creds = currentPlatform ? getStudentPlatformCred(s, currentPlatform) : { login: '', password: '' };
      const login = (creds.login || '').toLowerCase();
      return name.includes(q) || login.includes(q);
    });

    // Counts
    const filledCount = currentPlatform
      ? students.filter(s => {
          const cred = getStudentPlatformCred(s, currentPlatform);
          return !!cred.login;
        }).length
      : 0;
    const totalCount = students.length;
    const percentage = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

    container.innerHTML = `
      <div class="space-y-6 pb-28 animate-fade-in">
        
        <!-- Header & Top Actions -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm">
          <div class="flex items-center gap-3">
            <button 
              id="platforms-back-btn" 
              class="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Sinf ro'yxatiga qaytish"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
            </button>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-base sm:text-lg font-bold text-slate-900">Platformalar Tartibi</h1>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  ${currentClass.name}
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Kundalik.com va boshqa ta'lim platformalari login va parollarini boshqarish
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button 
              id="open-add-platform-modal-btn"
              class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-indigo-100 flex items-center gap-2 cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              <span>Yangi platforma qo'shish</span>
            </button>
          </div>
        </div>

        ${platforms.length === 0 ? `
          <!-- No Platforms Yet -->
          <div class="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-6 sm:p-10 text-center shadow-sm space-y-6">
            <div class="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
            </div>
            
            <div class="max-w-md mx-auto space-y-1.5">
              <h3 class="text-base font-bold text-slate-900">Hozircha birorta platforma qo'shilmagan</h3>
              <p class="text-xs text-slate-500">
                Sinf o'quvchilari uchun Kundalik.com (eMaktab) yoki boshqa ta'lim platformalarini qo'shing. Shundan so'ng barcha o'quvchilarga login va parol kiritish mumkin bo'ladi.
              </p>
            </div>

            <!-- Quick Preset Platforms -->
            <div class="pt-2">
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tavsiya etilgan platformalarni 1 bosishda qo'shing:</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
                ${PRESET_PLATFORMS.map(preset => `
                  <button 
                    data-preset-id="${preset.id}"
                    class="add-preset-btn p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-left group cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div class="text-xs font-bold text-slate-900 group-hover:text-indigo-600 flex items-center justify-between">
                        <span>${preset.name}</span>
                        <svg class="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                        </svg>
                      </div>
                      <p class="text-[11px] text-slate-500 mt-1 line-clamp-2">${preset.description}</p>
                    </div>
                    <span class="mt-3 text-[10px] font-semibold text-indigo-600 inline-flex items-center gap-1">
                      Platformani qo'shish &rarr;
                    </span>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        ` : `
          <!-- Platforms Bar / Tabs -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            ${platforms.map(p => {
              const isActive = p.id === activePlatformId;
              const pCount = students.filter(s => s.platforms && s.platforms[p.id] && s.platforms[p.id].login).length;
              return `
                <button 
                  data-platform-tab="${p.id}"
                  class="platform-tab-btn shrink-0 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center gap-2 border ${
                    isActive 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }"
                >
                  <svg class="w-4 h-4 ${isActive ? 'text-white' : 'text-indigo-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <span>${p.name}</span>
                  <span class="px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    isActive ? 'bg-indigo-700/80 text-white' : 'bg-slate-100 text-slate-600'
                  }">
                    ${pCount}/${students.length}
                  </span>
                </button>
              `;
            }).join('')}

            <!-- Add another platform button -->
            <button 
              id="add-more-platform-btn"
              class="shrink-0 px-3 py-2 rounded-xl border border-dashed border-slate-300 hover:border-indigo-400 hover:text-indigo-600 text-slate-500 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              <span>Boshqa platforma</span>
            </button>
          </div>

          <!-- Active Platform Detail Card -->
          ${currentPlatform ? `
            <div class="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-sm space-y-5">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h2 class="text-base sm:text-lg font-bold text-slate-900">${currentPlatform.name}</h2>
                    ${currentPlatform.url ? `
                      <a 
                        href="${currentPlatform.url}" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                        title="Rasmiy veb-saytga o'tish"
                      >
                        <span>Saytga o'tish</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                      </a>
                    ` : ''}
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">${currentPlatform.description || "Ta'lim va o'quv platformasi"}</p>
                </div>

                <!-- Platform Actions -->
                <div class="flex items-center gap-2 shrink-0">
                  <button 
                    id="copy-all-platform-creds-btn"
                    class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title="Barcha o'quvchilar login va parollaridan nusxa olish"
                  >
                    <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                    </svg>
                    <span>Barcha login/parollarni nusxalash</span>
                  </button>

                  <button 
                    id="edit-current-platform-btn"
                    class="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                    title="Platformani tahrirlash"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>

                  <button 
                    id="delete-current-platform-btn"
                    class="px-2.5 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold active:scale-95 shadow-2xs"
                    title="Platformani o'chirish"
                  >
                    <svg class="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    <span class="hidden sm:inline">Platformani o'chirish</span>
                  </button>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-semibold text-slate-700">Kiritilgan login va parollar to'liqligi:</span>
                  <span class="font-bold text-indigo-600">${filledCount} / ${totalCount} (${percentage}%)</span>
                </div>
                <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full bg-indigo-600 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
              </div>

              <!-- Search inside platform list -->
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div class="relative flex-1 max-w-sm">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                  </div>
                  <input 
                    type="text" 
                    id="platform-student-search" 
                    value="${searchFilter}"
                    placeholder="O'quvchi yoki login bo'yicha qidirish..."
                    class="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  ${searchFilter ? `
                    <button id="clear-platform-search" class="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  ` : ''}
                </div>

                <div class="text-xs text-slate-500 flex items-center gap-2">
                  <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Har bir o'quvchi yonidagi nusxa olish tugmasi orqali tezda nusxalang</span>
                </div>
              </div>

              <!-- Student Credentials Table / List -->
              <div class="overflow-x-auto rounded-xl border border-slate-200">
                <table class="w-full text-left text-xs text-slate-700">
                  <thead class="bg-slate-50/80 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th class="py-3 px-3.5 w-12 text-center">T/r</th>
                      <th class="py-3 px-3.5">O'quvchi (F.I.SH)</th>
                      <th class="py-3 px-3.5">${currentPlatform.name} Logini</th>
                      <th class="py-3 px-3.5">${currentPlatform.name} Paroli</th>
                      <th class="py-3 px-3.5 text-right w-44">Amallar</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${filteredStudents.length === 0 ? `
                      <tr>
                        <td colspan="5" class="py-8 text-center text-slate-400">
                          Hech qanday o'quvchi topilmadi
                        </td>
                      </tr>
                    ` : filteredStudents.map((std, idx) => {
                      const creds = currentPlatform ? getStudentPlatformCred(std, currentPlatform) : { login: '', password: '' };
                      const stdLogin = creds.login || '';
                      const stdPass = creds.password || '';
                      const isShowPass = !!showPasswordMap[std.id];
                      const fullName = std.fullName || `${std.lastName || ''} ${std.firstName || ''}`;

                      return `
                        <tr class="hover:bg-slate-50/60 transition-colors group">
                          <td class="py-2.5 px-3.5 text-center font-semibold text-slate-400">${idx + 1}</td>
                          
                          <!-- Student Name -->
                          <td class="py-2.5 px-3.5 font-medium text-slate-900">
                            <div class="flex items-center gap-2">
                              <span class="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                ${(fullName || 'O').charAt(0).toUpperCase()}
                              </span>
                              <span class="truncate max-w-[200px] sm:max-w-xs" title="${fullName}">${fullName}</span>
                            </div>
                          </td>

                          <!-- Login with Copy -->
                          <td class="py-2.5 px-3.5">
                            <div class="flex items-center gap-1.5">
                              ${stdLogin ? `
                                <span class="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded-md text-xs">
                                  ${stdLogin}
                                </span>
                                <button 
                                  class="copy-cred-btn p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                  data-copy-text="${encodeURIComponent(stdLogin)}"
                                  title="Logindan nusxa olish"
                                >
                                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                  </svg>
                                </button>
                              ` : `
                                <span class="text-slate-400 italic text-[11px]">Kiritilmagan</span>
                              `}
                            </div>
                          </td>

                          <!-- Password with Show/Hide & Copy -->
                          <td class="py-2.5 px-3.5">
                            <div class="flex items-center gap-1.5">
                              ${stdPass ? `
                                <span class="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded-md text-xs">
                                  ${isShowPass ? stdPass : '••••••••'}
                                </span>
                                <button 
                                  class="toggle-pass-btn p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                                  data-student-id="${std.id}"
                                  title="${isShowPass ? 'Parolni yashirish' : 'Parolni ko\'rish'}"
                                >
                                  ${isShowPass ? `
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>
                                    </svg>
                                  ` : `
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                    </svg>
                                  `}
                                </button>
                                <button 
                                  class="copy-cred-btn p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                  data-copy-text="${encodeURIComponent(stdPass)}"
                                  title="Paroldan nusxa olish"
                                >
                                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                  </svg>
                                </button>
                              ` : `
                                <span class="text-slate-400 italic text-[11px]">Kiritilmagan</span>
                              `}
                            </div>
                          </td>

                          <!-- Actions -->
                          <td class="py-2.5 px-3.5 text-right">
                            <div class="flex items-center justify-end gap-1.5">
                              ${(stdLogin || stdPass) ? `
                                <button 
                                  class="copy-pair-btn px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                  data-student-name="${encodeURIComponent(fullName)}"
                                  data-platform-name="${encodeURIComponent(currentPlatform.name)}"
                                  data-login="${encodeURIComponent(stdLogin)}"
                                  data-pass="${encodeURIComponent(stdPass)}"
                                  title="Ikkalasini birga nusxalash (Telegram orqali jo'natish uchun)"
                                >
                                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                                  </svg>
                                  <span>Nusxalash</span>
                                </button>
                              ` : ''}

                              <button 
                                class="inline-edit-cred-btn p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                data-student-id="${std.id}"
                                title="Login va parolni kiritish / o'zgartirish"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        `}

      </div>
    `;

    attachListeners();
  }

  function attachListeners() {
    // Back button
    const backBtn = container.querySelector('#platforms-back-btn');
    if (backBtn && onBack) {
      backBtn.onclick = onBack;
    }

    // Add platform modal button
    const addPlatBtn = container.querySelector('#open-add-platform-modal-btn');
    if (addPlatBtn) {
      addPlatBtn.onclick = () => openPlatformModal();
    }

    const addMoreBtn = container.querySelector('#add-more-platform-btn');
    if (addMoreBtn) {
      addMoreBtn.onclick = () => openPlatformModal();
    }

    // Add preset buttons
    container.querySelectorAll('.add-preset-btn').forEach(btn => {
      btn.onclick = () => {
        const presetId = btn.dataset.presetId;
        const preset = PRESET_PLATFORMS.find(p => p.id === presetId);
        if (preset) {
          const platforms = getClassPlatforms(currentClass);
          const lowerPreset = preset.name.toLowerCase();
          const existing = platforms.find(p => 
            p.id === preset.id || 
            p.name.toLowerCase() === lowerPreset ||
            ((lowerPreset.includes('kundalik') || lowerPreset.includes('emaktab')) && 
             (p.name.toLowerCase().includes('kundalik') || p.name.toLowerCase().includes('emaktab') || p.id === 'plat-kundalik'))
          );
          if (existing) {
            activePlatformId = existing.id;
            if (showToast) showToast(`"${existing.name}" platformasi allaqachon mavjud`, 'info');
            render();
            return;
          }
          const newPlatform = {
            id: preset.id,
            name: preset.name,
            url: preset.url,
            description: preset.description,
            color: preset.color,
            createdAt: new Date().toISOString()
          };
          onAddPlatform(newPlatform);
          activePlatformId = newPlatform.id;
        }
      };
    });

    // Platform tab switch
    container.querySelectorAll('.platform-tab-btn').forEach(btn => {
      btn.onclick = () => {
        activePlatformId = btn.dataset.platformTab;
        render();
      };
    });

    // Search filter
    const searchInput = container.querySelector('#platform-student-search');
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchFilter = e.target.value;
        render();
      };
    }

    const clearSearchBtn = container.querySelector('#clear-platform-search');
    if (clearSearchBtn) {
      clearSearchBtn.onclick = () => {
        searchFilter = '';
        render();
      };
    }

    // Edit current platform
    const editPlatformBtn = container.querySelector('#edit-current-platform-btn');
    if (editPlatformBtn) {
      editPlatformBtn.onclick = () => {
        const platforms = getClassPlatforms(currentClass);
        const cur = platforms.find(p => p.id === activePlatformId);
        if (cur) openPlatformModal(cur);
      };
    }

    // Delete current platform
    const deletePlatformBtn = container.querySelector('#delete-current-platform-btn');
    if (deletePlatformBtn) {
      deletePlatformBtn.onclick = () => {
        const platforms = getClassPlatforms(currentClass);
        const cur = platforms.find(p => p.id === activePlatformId);
        if (!cur) return;
        openDeleteConfirmModal(cur, () => {
          onDeletePlatform(cur.id);
        });
      };
    }

    // Toggle password visibility
    container.querySelectorAll('.toggle-pass-btn').forEach(btn => {
      btn.onclick = () => {
        const stdId = btn.dataset.studentId;
        showPasswordMap[stdId] = !showPasswordMap[stdId];
        render();
      };
    });

    // Copy single credential (login or password)
    container.querySelectorAll('.copy-cred-btn').forEach(btn => {
      btn.onclick = async () => {
        const text = decodeURIComponent(btn.dataset.copyText || '');
        if (text) {
          try {
            await navigator.clipboard.writeText(text);
            showToast("Nusxa olindi: " + text, 'success');
          } catch (_) {
            showToast("Nusxalab bo'lmadi", 'error');
          }
        }
      };
    });

    // Copy pair (Login and password formatted for Telegram/SMS)
    container.querySelectorAll('.copy-pair-btn').forEach(btn => {
      btn.onclick = async () => {
        const stdName = decodeURIComponent(btn.dataset.studentName || '');
        const platName = decodeURIComponent(btn.dataset.platformName || '');
        const login = decodeURIComponent(btn.dataset.login || '');
        const pass = decodeURIComponent(btn.dataset.pass || '');

        const message = `📋 ${platName}\n👤 O'quvchi: ${stdName}\n🔑 Login: ${login}\n🔒 Parol: ${pass}`;
        try {
          await navigator.clipboard.writeText(message);
          showToast(`${stdName} uchun login va parol nusxalandi!`, 'success');
        } catch (_) {
          showToast("Nusxalab bo'lmadi", 'error');
        }
      };
    });

    // Copy all credentials for active platform
    const copyAllBtn = container.querySelector('#copy-all-platform-creds-btn');
    if (copyAllBtn) {
      copyAllBtn.onclick = async () => {
        const platforms = getClassPlatforms(currentClass);
        const cur = platforms.find(p => p.id === activePlatformId);
        if (!cur) return;

        const list = students.filter(s => s.platforms && s.platforms[cur.id] && (s.platforms[cur.id].login || s.platforms[cur.id].password));
        if (list.length === 0) {
          showToast("Ushbu platforma bo'yicha hali login yoki parol kiritilmagan", 'info');
          return;
        }

        const lines = [
          `📚 ${currentClass.name} - ${cur.name} tizimi login va parollari ro'yxati:`,
          `Sana: ${new Date().toLocaleDateString('uz-UZ')}`,
          '----------------------------------------'
        ];

        list.forEach((s, idx) => {
          const cred = s.platforms[cur.id];
          const name = s.fullName || `${s.lastName || ''} ${s.firstName || ''}`;
          lines.push(`${idx + 1}. ${name}\n   Login: ${cred.login || '-'}\n   Parol: ${cred.password || '-'}`);
        });

        lines.push('----------------------------------------');
        const textToCopy = lines.join('\n');

        try {
          await navigator.clipboard.writeText(textToCopy);
          showToast(`${list.length} ta o'quvchi login va parollari to'liq nusxalandi!`, 'success');
        } catch (_) {
          showToast("Nusxalab bo'lmadi", 'error');
        }
      };
    }

    // Inline edit modal for student credentials
    container.querySelectorAll('.inline-edit-cred-btn').forEach(btn => {
      btn.onclick = () => {
        const stdId = btn.dataset.studentId;
        const std = students.find(s => s.id === stdId);
        const platforms = getClassPlatforms(currentClass);
        const cur = platforms.find(p => p.id === activePlatformId);
        if (std && cur) {
          openEditCredentialModal(std, cur);
        }
      };
    });
  }

  // Quick Modal: Edit student credentials for specific platform
  function openEditCredentialModal(student, platform) {
    const modalWrap = document.createElement('div');
    modalWrap.className = 'fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in';
    const currentCred = getStudentPlatformCred(student, platform);
    const fullName = student.fullName || `${student.lastName || ''} ${student.firstName || ''}`;

    modalWrap.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-scale-up">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-sm font-bold text-slate-900">${platform.name} Login va Paroli</h3>
            <p class="text-xs text-slate-500 mt-0.5">${fullName}</p>
          </div>
          <button type="button" id="close-cred-modal" class="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <form id="cred-edit-form" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">${platform.name} Logini</label>
            <input 
              type="text" 
              id="modal-cred-login" 
              value="${currentCred.login || ''}" 
              placeholder="Masalan: jasur_2012"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">${platform.name} Paroli</label>
            <div class="relative">
              <input 
                type="text" 
                id="modal-cred-password" 
                value="${currentCred.password || ''}" 
                placeholder="Parolni kiriting"
                class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
              />
            </div>
            <p class="text-[10px] text-slate-400 mt-1">O'quvchi yoki ota-onaga beriladigan platforma paroli</p>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button 
              type="button" 
              id="cancel-cred-modal" 
              class="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
            >
              Bekor qilish
            </button>
            <button 
              type="submit" 
              class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-xs"
            >
              Saqlash
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalWrap);

    const close = () => modalWrap.remove();
    modalWrap.querySelector('#close-cred-modal').onclick = close;
    modalWrap.querySelector('#cancel-cred-modal').onclick = close;
    modalWrap.onclick = (e) => { if (e.target === modalWrap) close(); };

    modalWrap.querySelector('#cred-edit-form').onsubmit = (e) => {
      e.preventDefault();
      const newLogin = modalWrap.querySelector('#modal-cred-login').value.trim();
      const newPassword = modalWrap.querySelector('#modal-cred-password').value.trim();

      if (!student.platforms) student.platforms = {};
      if (newLogin || newPassword) {
        student.platforms[platform.id] = { login: newLogin, password: newPassword };
      } else {
        delete student.platforms[platform.id];
      }

      if (onUpdateStudentPlatformCredential) {
        onUpdateStudentPlatformCredential(student.id, platform.id, newLogin, newPassword);
      }
      close();
      render();
    };
  }

  // Modal: Add or Edit Platform
  function openPlatformModal(existingPlatform = null) {
    const modalWrap = document.createElement('div');
    modalWrap.className = 'fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in';
    const isEdit = !!existingPlatform;

    modalWrap.innerHTML = `
      <div class="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 sm:p-6 space-y-4 animate-scale-up">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-sm sm:text-base font-bold text-slate-900">
              ${isEdit ? "Platformani Tahrirlash" : "Yangi Ta'lim Platformasi Qo'shish"}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Platforma qo'shilgach, sinf o'quvchilariga uning login va parollari biriktiriladi
            </p>
          </div>
          <button type="button" id="close-plat-modal" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <form id="plat-form" class="space-y-3.5 text-xs">
          <!-- Preset quick select if creating new -->
          ${!isEdit ? `
            <div>
              <label class="block font-semibold text-slate-700 mb-1.5">Tezkor shablonlardan tanlash:</label>
              <div class="grid grid-cols-2 gap-2">
                ${PRESET_PLATFORMS.map(preset => `
                  <button 
                    type="button" 
                    data-preset-fill="${preset.name}"
                    data-preset-url="${preset.url}"
                    data-preset-desc="${preset.description}"
                    class="preset-fill-btn p-2 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left font-medium text-slate-800 text-[11px] cursor-pointer flex items-center gap-1.5"
                  >
                    <span class="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                    <span class="truncate">${preset.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div>
            <label class="block font-semibold text-slate-700 mb-1" for="plat-name-input">
              Platforma nomi <span class="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              id="plat-name-input" 
              value="${existingPlatform ? existingPlatform.name : ''}" 
              placeholder="Masalan: Kundalik.com (eMaktab)"
              required
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1" for="plat-url-input">
              Veb-sayt havolasi (URL - ixtiyoriy)
            </label>
            <input 
              type="url" 
              id="plat-url-input" 
              value="${existingPlatform && existingPlatform.url ? existingPlatform.url : ''}" 
              placeholder="Masalan: https://emaktab.uz"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1" for="plat-desc-input">
              Tavsif / Izoh (ixtiyoriy)
            </label>
            <input 
              type="text" 
              id="plat-desc-input" 
              value="${existingPlatform && existingPlatform.description ? existingPlatform.description : ''}" 
              placeholder="Masalan: O'quvchilar elektron baholash jurnali"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button 
              type="button" 
              id="cancel-plat-modal" 
              class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Bekor qilish
            </button>
            <button 
              type="submit" 
              class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-md shadow-indigo-100"
            >
              ${isEdit ? "O'zgarishlarni saqlash" : "Platformani qo'shish"}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modalWrap);

    const close = () => modalWrap.remove();
    modalWrap.querySelector('#close-plat-modal').onclick = close;
    modalWrap.querySelector('#cancel-plat-modal').onclick = close;
    modalWrap.onclick = (e) => { if (e.target === modalWrap) close(); };

    modalWrap.querySelectorAll('.preset-fill-btn').forEach(b => {
      b.onclick = () => {
        modalWrap.querySelector('#plat-name-input').value = b.dataset.presetFill || '';
        modalWrap.querySelector('#plat-url-input').value = b.dataset.presetUrl || '';
        modalWrap.querySelector('#plat-desc-input').value = b.dataset.presetDesc || '';
      };
    });

    modalWrap.querySelector('#plat-form').onsubmit = (e) => {
      e.preventDefault();
      const name = modalWrap.querySelector('#plat-name-input').value.trim();
      const url = modalWrap.querySelector('#plat-url-input').value.trim();
      const description = modalWrap.querySelector('#plat-desc-input').value.trim();

      if (!name) return;

      if (isEdit) {
        if (onEditPlatform) {
          onEditPlatform(existingPlatform.id, { name, url, description });
        } else if (onUpdatePlatform) {
          onUpdatePlatform({ ...existingPlatform, name, url, description });
        }
      } else {
        const platforms = getClassPlatforms(currentClass);
        const lower = name.toLowerCase();
        let targetId = 'plat-' + Date.now();
        if (lower.includes('kundalik') || lower.includes('emaktab')) {
          targetId = 'plat-kundalik';
        } else if (lower.includes('khan academy')) {
          targetId = 'plat-khan';
        } else if (lower.includes('kitob')) {
          targetId = 'plat-kitob';
        } else if (lower.includes('edu.uz')) {
          targetId = 'plat-edu';
        }

        const existing = platforms.find(p => 
          p.id === targetId || 
          p.name.toLowerCase() === lower ||
          ((lower.includes('kundalik') || lower.includes('emaktab')) && 
           (p.name.toLowerCase().includes('kundalik') || p.name.toLowerCase().includes('emaktab') || p.id === 'plat-kundalik'))
        );

        if (existing) {
          activePlatformId = existing.id;
          if (showToast) showToast(`"${existing.name}" platformasi allaqachon mavjud`, 'info');
          close();
          render();
          return;
        }

        const newPlatform = {
          id: targetId,
          name,
          url,
          description,
          createdAt: new Date().toISOString()
        };
        onAddPlatform(newPlatform);
        activePlatformId = newPlatform.id;
      }

      close();
      render();
    };
  }

  // Platformani o'chirishni tasdiqlash modali (brauzer confirm dialogi o'rniga xavfsiz va chiroyli modal)
  function openDeleteConfirmModal(platform, onConfirmCallback) {
    if (!platform) return;
    const oldModal = document.getElementById('delete-plat-confirm-modal');
    if (oldModal) oldModal.remove();

    const modalWrap = document.createElement('div');
    modalWrap.id = 'delete-plat-confirm-modal';
    modalWrap.className = 'fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in';
    modalWrap.innerHTML = `
      <div class="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md p-5 sm:p-6 text-center animate-scale-in">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-100 shadow-inner">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </div>

        <h3 class="text-base sm:text-lg font-bold text-slate-900">
          "${platform.name}" platformasini o'chirish
        </h3>
        
        <p class="text-xs sm:text-sm text-slate-600 mt-2 mb-4 leading-relaxed">
          Haqiqatan ham ushbu platformani sinfingizdan olib tashlamoqchimisiz?
        </p>

        <div class="p-3 bg-red-50/80 border border-red-200/80 rounded-xl text-xs text-red-800 text-left mb-5 flex items-start gap-2.5">
          <svg class="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <span class="leading-relaxed">
            <strong>Muhim ogohlantirish:</strong> Ushbu platformaga kiritilgan barcha o'quvchilarning login va parollari ham to'liq o'chirib tashlanadi.
          </span>
        </div>

        <div class="flex items-center justify-end gap-2.5">
          <button 
            type="button" 
            id="cancel-delete-plat-btn" 
            class="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs cursor-pointer transition-colors"
          >
            Bekor qilish
          </button>
          <button 
            type="button" 
            id="confirm-delete-plat-btn" 
            class="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs cursor-pointer shadow-sm shadow-red-200 transition-all active:scale-95"
          >
            Ha, o'chirilsin
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalWrap);

    const close = () => modalWrap.remove();
    modalWrap.querySelector('#cancel-delete-plat-btn').onclick = close;
    modalWrap.onclick = (e) => { if (e.target === modalWrap) close(); };

    modalWrap.querySelector('#confirm-delete-plat-btn').onclick = () => {
      close();
      if (onConfirmCallback) {
        onConfirmCallback();
      }
    };
  }

  render();
}
