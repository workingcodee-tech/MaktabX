/**
 * Dasturchi uchun Maktab Admini batafsil sahifasi
 * Maktab ma'lumotlari, admin hisob ma'lumotlari (login & parol), 
 * barcha sinflar va o'quvchilar to'liq ro'yxati
 */

import { formatDate, compareClassNames } from '../data.js';
import { formatStudentGender } from '../utils/exportUtils.js';

export function renderAdminUserDetail(container, { school, state, onBack, onEditSchool, onDeleteSchool, onViewTeacher, onViewStudent, onResetPin, showToast }) {
  const schoolClasses = state.classes
    .filter(c => c.schoolId === school.id)
    .sort((a, b) => compareClassNames(a.name, b.name));
  const schoolStudents = state.students.filter(s => s.schoolId === school.id);

  let isPasswordVisible = false;

  function copyText(text, label) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (showToast) showToast(`${label} nusxalandi`, 'success');
    }).catch(() => {
      if (showToast) showToast(`Nusxalashda xatolik`, 'error');
    });
  }

  function render() {
    container.innerHTML = `
      <div class="space-y-6 max-w-5xl mx-auto pb-36 sm:pb-24">
        
        <!-- Breadcrumb / Orqaga qaytish va Amallar Menusi -->
        <div class="flex items-center justify-between gap-2 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <button 
            id="back-to-dev-btn"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-100 text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0"
            title="Dasturchi paneliga qaytish"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            <span class="hidden sm:inline">Dasturchi paneliga qaytish</span>
            <span class="sm:hidden">Orqaga</span>
          </button>

          <!-- Ixcham va aniq Iconli Amallar Qatori -->
          <div class="flex items-center gap-1.5 shrink-0">
            <button 
              id="edit-school-btn"
              class="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer shrink-0"
              title="Maktab va admin ma'lumotlarini tahrirlash"
              aria-label="Tahrirlash"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              <span class="hidden md:inline">Tahrirlash</span>
            </button>
            <button 
              id="delete-school-btn"
              class="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer shrink-0"
              title="Maktabni o'chirish"
              aria-label="O'chirish"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              <span class="hidden md:inline">O'chirish</span>
            </button>
          </div>
        </div>

        <!-- Asosiy Admin & Maktab Pasporti -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-bold text-2xl">
                ${(school.adminName || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    👑 Maktab Admini
                  </span>
                  ${school.shortCode ? `
                    <span class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-600">
                      ${school.shortCode}
                    </span>
                  ` : ''}
                </div>
                <h1 class="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">${school.adminName}</h1>
                <p class="text-xs sm:text-sm text-slate-500 mt-0.5">${school.name}</p>
              </div>
            </div>

            <div class="flex items-center gap-1.5 w-full sm:w-auto bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
              <a 
                href="tel:${school.adminPhone ? school.adminPhone.replace(/[^0-9+]/g, '') : ''}" 
                class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 text-slate-800 hover:text-emerald-700 font-mono text-xs font-semibold transition-colors"
                title="Qo'ng'iroq qilish"
              >
                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                ${school.adminPhone}
              </a>
              <a 
                href="tel:${school.adminPhone ? school.adminPhone.replace(/[^0-9+]/g, '') : ''}"
                class="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors cursor-pointer"
                title="Admin bilan bog'lanish (qo'ng'iroq qilish)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
              </a>
              <button 
                class="copy-admin-phone-btn p-2 rounded-xl text-slate-500 hover:bg-white hover:text-indigo-600 transition-colors cursor-pointer"
                data-val="${school.adminPhone}"
                title="Telefon raqamidan nusxa olish"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Hisob ma'lumotlari: Login va Parol (Asosiy talab) -->
          <div class="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100/80 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                </svg>
                <span class="text-xs font-bold uppercase tracking-wider text-indigo-900">Admin Kirish Hisobi (Login va Parol)</span>
              </div>
              <button 
                id="toggle-pwd-btn"
                class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                ${isPasswordVisible ? `
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>
                  </svg>
                  Yashirish
                ` : `
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                  Parolni ko'rsatish
                `}
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div class="bg-white p-3.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Login</div>
                  <div class="font-mono font-bold text-slate-900 text-sm mt-0.5">${school.login}</div>
                </div>
                <button 
                  class="copy-login-btn p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  data-val="${school.login}"
                  title="Loginni nusxalash"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                </button>
              </div>

              <div class="bg-white p-3.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parol</div>
                  <div class="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    ${isPasswordVisible ? school.password : '••••••••'}
                  </div>
                </div>
                <button 
                  class="copy-pwd-btn p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  data-val="${school.password}"
                  title="Parolni nusxalash"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                </button>
              </div>

              <!-- Kabinet PIN-kodi (Dasturchi uchun) -->
              <div class="bg-white p-3.5 rounded-xl border ${school.pinCode ? 'border-purple-200 bg-purple-50/20' : 'border-indigo-100'} flex items-center justify-between">
                <div>
                  <div class="text-[10px] font-bold uppercase tracking-wider ${school.pinCode ? 'text-purple-600' : 'text-slate-400'} flex items-center gap-1">
                    <svg class="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                    <span>Kabinet PIN-kodi</span>
                  </div>
                  <div class="font-mono font-bold text-sm mt-0.5 ${school.pinCode ? 'text-purple-900 font-extrabold' : 'text-slate-400 font-normal'}">
                    ${school.pinCode ? (isPasswordVisible ? school.pinCode : '••••') : 'O\'rnatilmagan'}
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  ${school.pinCode ? `
                    <button 
                      class="copy-pin-btn p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                      data-val="${school.pinCode}"
                      title="PIN-kodni nusxalash"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                      </svg>
                    </button>
                    ${onResetPin ? `
                      <button 
                        id="reset-admin-pin-btn"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Admin PIN-kodini bekor qilish (o'chirish)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    ` : ''}
                  ` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Maktab ma'lumotlari bo'limi -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Maktab Manzili</div>
              <div class="font-semibold text-slate-800 text-sm mt-1">${school.address || "Ko'rsatilmagan"}</div>
            </div>
            <div class="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jami Sinflar</div>
              <div class="font-bold text-slate-900 text-xl mt-1 text-blue-600">${schoolClasses.length} ta sinf</div>
            </div>
            <div class="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jami O'quvchilar</div>
              <div class="font-bold text-slate-900 text-xl mt-1 text-emerald-600">${schoolStudents.length} nafar o'quvchi</div>
            </div>
          </div>

        </div>

        <!-- 1. Maktabga tegishli barcha sinflar ro'yxati -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <h2 class="font-bold text-slate-900 text-sm sm:text-base">Maktab Sinflari va Mas'ul O'qituvchilar</h2>
            </div>
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
              ${schoolClasses.length} ta sinf
            </span>
          </div>

          ${schoolClasses.length === 0 ? `
            <div class="py-10 text-center text-slate-400 text-sm">
              Bu maktabda hozircha birorta ham sinf shakllantirilmagan
            </div>
          ` : `
            <div class="divide-y divide-slate-100">
              ${schoolClasses.map(cls => {
                const count = state.students.filter(s => s.classId === cls.id).length;
                return `
                  <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2.5">
                        <span class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold font-mono text-sm border border-blue-100">
                          ${cls.name}
                        </span>
                        <span class="font-bold text-slate-900 text-sm">${cls.teacherName}</span>
                        ${cls.teacherSubject ? `
                          <span class="text-xs text-slate-500">(${cls.teacherSubject})</span>
                        ` : ''}
                      </div>
                      <div class="text-xs text-slate-500 flex flex-wrap items-center gap-3 pt-0.5">
                        <span>Tel: <a href="tel:${cls.teacherPhone}" class="font-mono text-indigo-600 hover:underline">${cls.teacherPhone}</a></span>
                        <span class="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                          Login: <strong>${cls.login}</strong>
                        </span>
                        <span class="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                          Parol: <strong>${cls.password}</strong>
                        </span>
                        <span class="text-emerald-600 font-semibold">${count} o'quvchi</span>
                      </div>
                    </div>

                    <div class="shrink-0">
                      <button 
                        class="view-teacher-btn px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        data-id="${cls.id}"
                      >
                        <span>Sinf sahifasiga o'tish</span>
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- 2. Maktabdagi barcha o'quvchilar ro'yxati -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <h2 class="font-bold text-slate-900 text-sm sm:text-base">Maktabdagi Barcha O'quvchilar</h2>
            </div>
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              ${schoolStudents.length} nafar o'quvchi
            </span>
          </div>

          ${schoolStudents.length === 0 ? `
            <div class="py-10 text-center text-slate-400 text-sm">
              Bu maktabda hozircha o'quvchilar kiritilmagan
            </div>
          ` : `
            <div class="divide-y divide-slate-100">
              ${schoolStudents.map((std, idx) => {
                const stdClass = state.classes.find(c => c.id === std.classId);
                return `
                  <div class="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div class="flex items-center gap-3 min-w-0">
                      <span class="text-xs font-mono text-slate-400 w-6">${idx + 1}.</span>
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-slate-900 text-sm truncate">${std.fullName}</span>
                          <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 shrink-0">
                            ${stdClass ? stdClass.name : 'Sinf'}
                          </span>
                        </div>
                        <div class="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>${formatStudentGender(std, false)}</span>
                          ${std.phone ? `<span>• Tel: ${std.phone}</span>` : ''}
                          ${std.pinfl ? `<span class="font-mono">• PINFL: ${std.pinfl}</span>` : ''}
                        </div>
                      </div>
                    </div>

                    <button 
                      class="view-student-btn shrink-0 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      data-id="${std.id}"
                    >
                      <span>Ko'rish</span>
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

      </div>
    `;

    // Listeners
    const backBtn = container.querySelector('#back-to-dev-btn');
    if (backBtn) backBtn.onclick = onBack;

    const editBtn = container.querySelector('#edit-school-btn');
    if (editBtn) editBtn.onclick = () => onEditSchool(school.id);

    const deleteBtn = container.querySelector('#delete-school-btn');
    if (deleteBtn) deleteBtn.onclick = () => onDeleteSchool(school.id);

    const togglePwdBtn = container.querySelector('#toggle-pwd-btn');
    if (togglePwdBtn) {
      togglePwdBtn.onclick = () => {
        isPasswordVisible = !isPasswordVisible;
        render();
      };
    }

    const copyAdminPhoneBtn = container.querySelector('.copy-admin-phone-btn');
    if (copyAdminPhoneBtn) {
      copyAdminPhoneBtn.onclick = () => copyText(school.adminPhone, "Admin telefoni");
    }

    const copyLoginBtn = container.querySelector('.copy-login-btn');
    if (copyLoginBtn) {
      copyLoginBtn.onclick = () => copyText(school.login, "Login");
    }

    const copyPwdBtn = container.querySelector('.copy-pwd-btn');
    if (copyPwdBtn) {
      copyPwdBtn.onclick = () => copyText(school.password, "Parol");
    }

    const copyPinBtn = container.querySelector('.copy-pin-btn');
    if (copyPinBtn) {
      copyPinBtn.onclick = () => copyText(school.pinCode, "Kabinet PIN-kodi");
    }

    const resetPinBtn = container.querySelector('#reset-admin-pin-btn');
    if (resetPinBtn && onResetPin) {
      resetPinBtn.onclick = () => onResetPin(school.id);
    }

    const viewTeacherBtns = container.querySelectorAll('.view-teacher-btn');
    viewTeacherBtns.forEach(btn => {
      btn.onclick = () => {
        const classId = btn.getAttribute('data-id');
        if (onViewTeacher) onViewTeacher(classId);
      };
    });

    const viewStudentBtns = container.querySelectorAll('.view-student-btn');
    viewStudentBtns.forEach(btn => {
      btn.onclick = () => {
        const studentId = btn.getAttribute('data-id');
        if (onViewStudent) onViewStudent(studentId);
      };
    });
  }

  render();
}
