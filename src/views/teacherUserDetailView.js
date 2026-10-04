/**
 * Dasturchi uchun Sinf Rahbari (O'qituvchi) batafsil sahifasi
 * O'qituvchi ma'lumotlari, hisob ma'lumotlari (login & parol),
 * biriktirilgan maktab va sinf, hamda barcha o'quvchilar to'liq ro'yxati
 */

import { formatDate } from '../data.js';
import { isFemaleStudent, formatStudentGender } from '../utils/exportUtils.js';

export function renderTeacherUserDetail(container, { classItem, state, onBack, onEditClass, onDeleteClass, onViewSchool, onViewStudent, onExportClass, onManagePlatforms, onResetPin, backButtonLabel, showToast }) {
  const school = state.schools.find(s => s.id === classItem.schoolId) || { name: "Umumta'lim maktabi" };
  const students = (state.students || [])
    .filter(s => s.classId === classItem.id)
    .sort((a, b) => {
      const nameA = a.fullName || `${a.lastName || ''} ${a.firstName || ''}`.trim();
      const nameB = b.fullName || `${b.lastName || ''} ${b.firstName || ''}`.trim();
      return nameA.localeCompare(nameB, 'uz', { sensitivity: 'base' });
    });

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
    const backText = backButtonLabel || "Orqaga qaytish";
    container.innerHTML = `
      <div class="space-y-6 max-w-5xl mx-auto pb-36 sm:pb-24">
        
        <!-- Breadcrumb / Orqaga qaytish va Amallar Menusi -->
        <div class="flex items-center justify-between gap-2 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <button 
            id="back-to-dev-btn"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-100 text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0"
            title="${backText}"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            <span class="hidden sm:inline">${backText}</span>
            <span class="sm:hidden">Orqaga</span>
          </button>

          <!-- Ixcham va aniq Iconli Amallar Qatori -->
          <div class="flex items-center gap-1.5 shrink-0">
            ${onManagePlatforms ? `
              <button 
                id="manage-class-platforms-btn"
                class="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer shrink-0"
                title="Ta'lim platformalari (Kundalik.com va b.)"
                aria-label="Platformalar"
              >
                <svg class="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <span class="hidden md:inline">Platformalar</span>
              </button>
            ` : ''}
            ${onExportClass ? `
              <button 
                id="export-class-btn"
                class="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer shrink-0"
                title="Sinf o'quvchilarini PDF / Excel ga eksport qilish"
                aria-label="Eksport qilish"
              >
                <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span class="hidden md:inline">Eksport</span>
              </button>
            ` : ''}
            <button 
              id="edit-class-btn"
              class="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer shrink-0"
              title="Sinf va o'qituvchi ma'lumotlarini tahrirlash"
              aria-label="Tahrirlash"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              <span class="hidden md:inline">Tahrirlash</span>
            </button>
            <button 
              id="delete-class-btn"
              class="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer shrink-0"
              title="Sinfni o'chirish"
              aria-label="O'chirish"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              <span class="hidden md:inline">O'chirish</span>
            </button>
          </div>
        </div>

        <!-- Asosiy O'qituvchi & Sinf Pasporti -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 font-bold text-2xl">
                ${(classItem.teacherName || 'O').charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                    🎓 Sinf Rahbari / O'qituvchi
                  </span>
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700">
                    ${classItem.name} Sinf
                  </span>
                </div>
                <h1 class="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">${classItem.teacherName}</h1>
                <p class="text-xs sm:text-sm text-slate-500 mt-0.5">
                  ${classItem.teacherSubject ? `${classItem.teacherSubject} fani o'qituvchisi` : "Sinf rahbari"}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-1.5 w-full sm:w-auto bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
              <a 
                href="tel:${classItem.teacherPhone ? classItem.teacherPhone.replace(/[^0-9+]/g, '') : ''}" 
                class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 text-slate-800 hover:text-emerald-700 font-mono text-xs font-semibold transition-colors"
                title="Qo'ng'iroq qilish"
              >
                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                ${classItem.teacherPhone || "Tel mavjud emas"}
              </a>
              ${classItem.teacherPhone ? `
                <a 
                  href="tel:${classItem.teacherPhone.replace(/[^0-9+]/g, '')}"
                  class="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors cursor-pointer"
                  title="O'qituvchi bilan bog'lanish (qo'ng'iroq qilish)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                </a>
                <button 
                  class="copy-teacher-phone-btn p-2 rounded-xl text-slate-500 hover:bg-white hover:text-indigo-600 transition-colors cursor-pointer"
                  data-val="${classItem.teacherPhone}"
                  title="Telefon raqamidan nusxa olish"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Hisob ma'lumotlari: Login va Parol (Asosiy talab) -->
          <div class="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/80 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                </svg>
                <span class="text-xs font-bold uppercase tracking-wider text-blue-900">O'qituvchi Kirish Hisobi (Login va Parol)</span>
              </div>
              <button 
                id="toggle-pwd-btn"
                class="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer inline-flex items-center gap-1"
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

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div class="bg-white p-3.5 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Login</div>
                  <div class="font-mono font-bold text-slate-900 text-sm mt-0.5">${classItem.login}</div>
                </div>
                <button 
                  class="copy-login-btn p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  data-val="${classItem.login}"
                  title="Loginni nusxalash"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                </button>
              </div>

              <div class="bg-white p-3.5 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parol</div>
                  <div class="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    ${isPasswordVisible ? classItem.password : '••••••••'}
                  </div>
                </div>
                <button 
                  class="copy-pwd-btn p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  data-val="${classItem.password}"
                  title="Parolni nusxalash"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                </button>
              </div>

              <div class="bg-white p-3.5 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Vaqtinchalik Tiklash ID</div>
                  <div class="font-mono font-bold text-emerald-700 text-sm mt-0.5 select-all">${classItem.recoveryId || 'REC-000000'}</div>
                </div>
                <button 
                  class="copy-recovery-id-btn p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  data-val="${classItem.recoveryId || ''}"
                  title="Tiklash ID sini nusxalash"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                </button>
              </div>

              <!-- Kabinet PIN-kodi (Dasturchi uchun to'liq ko'rinadi) -->
              <div class="bg-white p-3.5 rounded-xl border ${classItem.pinCode ? 'border-indigo-200 bg-indigo-50/20' : 'border-blue-100'} flex items-center justify-between">
                <div>
                  <div class="text-[10px] font-bold uppercase tracking-wider ${classItem.pinCode ? 'text-indigo-600' : 'text-slate-400'} flex items-center gap-1">
                    <svg class="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                    <span>Kabinet PIN-kodi</span>
                  </div>
                  <div class="font-mono font-bold text-sm mt-0.5 ${classItem.pinCode ? 'text-indigo-900 font-extrabold' : 'text-slate-400 font-normal'}">
                    ${classItem.pinCode ? (isPasswordVisible ? classItem.pinCode : '••••') : 'O\'rnatilmagan'}
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  ${classItem.pinCode ? `
                    <button 
                      class="copy-pin-btn p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      data-val="${classItem.pinCode}"
                      title="PIN-kodni nusxalash"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                      </svg>
                    </button>
                    ${onResetPin ? `
                      <button 
                        id="reset-teacher-pin-btn"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="O'qituvchining PIN-kodini bekor qilish (o'chirish)"
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

          <!-- Biriktirilgan Maktab va Sinf ma'lumotlari -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <!-- Maktab ma'lumotlari -->
            <div class="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Biriktirilgan Maktab</div>
              <div class="font-bold text-slate-900 text-base">${school.name}</div>
              <div class="text-xs text-slate-500">
                <span>Manzil: <strong>${school.address || "Ko'rsatilmagan"}</strong></span>
              </div>
              <div class="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span>Maktab Admini: <strong>${school.adminName}</strong></span>
                <a href="tel:${school.adminPhone}" class="font-mono text-indigo-600 hover:underline">${school.adminPhone}</a>
              </div>
              ${onViewSchool ? `
                <div class="pt-1">
                  <button 
                    id="goto-school-btn"
                    class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Maktab profilini ochish</span>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              ` : ''}
            </div>

            <!-- Sinf ma'lumotlari -->
            <div class="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
              <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sinf Tavsifi</div>
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900 text-base">${classItem.name} Sinf</span>
                <span class="font-bold text-emerald-600 text-lg">${students.length} nafar o'quvchi</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                <div>
                  <span class="text-slate-400">O'quv yili:</span>
                  <div class="font-semibold text-slate-800">${classItem.academicYear || "2025-2026"}</div>
                </div>
                <div>
                  <span class="text-slate-400">Ta'lim tili:</span>
                  <div class="font-semibold text-slate-800">${classItem.language || "O'zbek"}</div>
                </div>
              </div>
            </div>

          </div>

        </div>

        <!-- Ushbu Sinf O'quvchilari Ro'yxati -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <h2 class="font-bold text-slate-900 text-sm sm:text-base">${classItem.name} Sinf O'quvchilari</h2>
            </div>
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              ${students.length} nafar o'quvchi
            </span>
          </div>

          ${students.length === 0 ? `
            <div class="py-12 text-center text-slate-400 text-sm">
              Bu sinfda hozircha o'quvchilar ro'yxati mavjud emas
            </div>
          ` : `
            <div class="divide-y divide-slate-100">
              ${students.map((std, idx) => `
                <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                  <div class="flex items-start sm:items-center gap-3 min-w-0">
                    <span class="text-xs font-mono text-slate-400 w-6 shrink-0 mt-0.5 sm:mt-0">${idx + 1}.</span>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-slate-900 text-sm truncate">${std.fullName}</span>
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${isFemaleStudent(std) ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'}">
                          ${formatStudentGender(std, false)}
                        </span>
                        ${std.age ? `
                          <span class="text-[11px] text-slate-400 font-medium">(${std.age} yosh)</span>
                        ` : ''}
                      </div>
                      <div class="text-xs text-slate-500 flex flex-wrap items-center gap-3 mt-1">
                        ${std.phone ? `
                          <span class="inline-flex items-center gap-1">
                            <span>Tel:</span>
                            <a href="tel:${std.phone.replace(/[^0-9+]/g, '')}" class="font-mono text-indigo-600 hover:text-emerald-600 hover:underline font-semibold">${std.phone}</a>
                            <a href="tel:${std.phone.replace(/[^0-9+]/g, '')}" class="p-0.5 rounded text-emerald-600 hover:bg-emerald-50" title="Qo'ng'iroq qilish: ${std.phone}">
                              <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                              </svg>
                            </a>
                          </span>
                        ` : ''}
                        ${std.motherFullName ? `<span class="inline-flex items-center gap-1"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-100">Onasi:</span> ${std.motherFullName}</span>` : ''}
                        ${std.fatherFullName ? `<span class="inline-flex items-center gap-1"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">Otasi:</span> ${std.fatherFullName}</span>` : ''}
                        ${std.pinfl ? `<span class="font-mono text-slate-400">PINFL: ${std.pinfl}</span>` : ''}
                      </div>
                    </div>
                  </div>

                  <div class="shrink-0 pl-9 sm:pl-0">
                    <button 
                      class="view-std-btn px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      data-id="${std.id}"
                    >
                      <span>Ko'rish</span>
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>
    `;

    // Listeners
    const backBtn = container.querySelector('#back-to-dev-btn');
    if (backBtn) backBtn.onclick = onBack;

    const platformsBtn = container.querySelector('#manage-class-platforms-btn');
    if (platformsBtn && onManagePlatforms) {
      platformsBtn.onclick = onManagePlatforms;
    }

    const editBtn = container.querySelector('#edit-class-btn');
    if (editBtn) editBtn.onclick = () => onEditClass(classItem.id, classItem.schoolId);

    const deleteBtn = container.querySelector('#delete-class-btn');
    if (deleteBtn) deleteBtn.onclick = () => onDeleteClass(classItem.id);

    const exportBtn = container.querySelector('#export-class-btn');
    if (exportBtn && onExportClass) {
      exportBtn.onclick = () => onExportClass(students);
    }

    const gotoSchoolBtn = container.querySelector('#goto-school-btn');
    if (gotoSchoolBtn && onViewSchool) {
      gotoSchoolBtn.onclick = () => onViewSchool(classItem.schoolId);
    }

    const togglePwdBtn = container.querySelector('#toggle-pwd-btn');
    if (togglePwdBtn) {
      togglePwdBtn.onclick = () => {
        isPasswordVisible = !isPasswordVisible;
        render();
      };
    }

    const copyTeacherPhoneBtn = container.querySelector('.copy-teacher-phone-btn');
    if (copyTeacherPhoneBtn) {
      copyTeacherPhoneBtn.onclick = () => copyText(classItem.teacherPhone, "O'qituvchi telefoni");
    }

    const copyLoginBtn = container.querySelector('.copy-login-btn');
    if (copyLoginBtn) {
      copyLoginBtn.onclick = () => copyText(classItem.login, "Login");
    }

    const copyPwdBtn = container.querySelector('.copy-pwd-btn');
    if (copyPwdBtn) {
      copyPwdBtn.onclick = () => copyText(classItem.password, "Parol");
    }

    const copyRecoveryIdBtn = container.querySelector('.copy-recovery-id-btn');
    if (copyRecoveryIdBtn) {
      copyRecoveryIdBtn.onclick = () => copyText(classItem.recoveryId, "Tiklash ID");
    }

    const copyPinBtn = container.querySelector('.copy-pin-btn');
    if (copyPinBtn) {
      copyPinBtn.onclick = () => copyText(classItem.pinCode, "Kabinet PIN-kodi");
    }

    const resetPinBtn = container.querySelector('#reset-teacher-pin-btn');
    if (resetPinBtn && onResetPin) {
      resetPinBtn.onclick = () => onResetPin(classItem.id);
    }

    const viewStdBtns = container.querySelectorAll('.view-std-btn');
    viewStdBtns.forEach(btn => {
      btn.onclick = () => {
        const studentId = btn.getAttribute('data-id');
        if (onViewStudent) onViewStudent(studentId);
      };
    });
  }

  render();
}
