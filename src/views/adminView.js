/**
 * MaktabX - Maktab Ma'muriyati (Admin) Bosh Sahifasi
 * 
 * - Sinflar tugmalari (har birida sinf nomi, nechta o'quvchi bor ekani, tahrirlash va o'chirish tugmalari)
 * - Sinf va rahbarni nomi orqali sinflarni qidirish imkoniyati
 * - Diqqat: O'qituvchilar va o'quvchilar qat'iy ALIFBO TARTIBIDA!
 */

import { compareClassNames, normalizeText, matchesPhone } from '../data.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderAdmin(container, {
  state,
  currentSchool,
  isLoading = false,
  showToast,
  onRefreshData,
  onAddClass,
  onEditClass,
  onDeleteClass,
  onViewTeacher,
  onViewStudent,
  onChangeCredentials
}) {
  let searchQuery = '';
  let sortMode = 'class_order'; // Har doim 1-sinfdan boshlab (1-A...11-D)
  let isInternalLoading = false;

  function render() {
    const schoolClasses = (state.classes || [])
      .filter(c => c.schoolId === currentSchool.id);

    const schoolStudents = (state.students || []).filter(s => {
      if (s.schoolId === currentSchool.id) return true;
      const cls = schoolClasses.find(c => c.id === s.classId);
      return Boolean(cls);
    });

    // Har bir sinfdagi o'quvchilar sonini hisoblash
    const classStudentCounts = new Map();
    schoolClasses.forEach(c => {
      const count = schoolStudents.filter(s => s.classId === c.id).length;
      classStudentCounts.set(c.id, count);
    });

    // Qidiruv
    const rawQuery = searchQuery.trim();
    const query = normalizeText(rawQuery);

    let filteredClasses = schoolClasses.filter(c => {
      if (!rawQuery) return true;
      if (matchesPhone(c.teacherPhone, rawQuery)) return true;
      return (
        (c.name && normalizeText(c.name).includes(query)) ||
        (c.teacherName && normalizeText(c.teacherName).includes(query)) ||
        (c.teacherSubject && normalizeText(c.teacherSubject).includes(query))
      );
    });

    // DIQQAT TALABI: QAYERDA VA QACHON O'QUVCHI VA O'QITUVCHILAR BO'LSA ALIFBO TARTIBIDA YOZILADI
    if (sortMode === 'alphabetical') {
      // O'qituvchilar ismi bo'yicha qat'iy alifbo tartibida (A-Z)
      filteredClasses.sort((a, b) => {
        const nameA = a.teacherName || '';
        const nameB = b.teacherName || '';
        if (!nameA && !nameB) return compareClassNames(a.name, b.name);
        if (!nameA) return 1;
        if (!nameB) return -1;
        return nameA.localeCompare(nameB, 'uz', { sensitivity: 'base' });
      });
    } else {
      // Sinflar o'sish tartibida (1-A, 1-B, 2-A...)
      filteredClasses.sort((a, b) => compareClassNames(a.name, b.name));
    }

    container.innerHTML = `
      <div class="space-y-4 pb-28 max-w-5xl mx-auto animate-fade-in text-slate-800">
        
        <!-- ======================================================== -->
        <!-- MAKTAB PASPORTI VA TEZKOR BOSHQARUV HEADER               -->
        <!-- ======================================================== -->
        <div class="bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xl shrink-0 shadow-2xs">
              🏫
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-base sm:text-lg font-black text-slate-900 truncate leading-tight">
                  ${escapeHtml(currentSchool.name)}
                </h1>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 shadow-2xs">
                  Maktab Admini
                </span>
              </div>
              <div class="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                  👤 ${escapeHtml(currentSchool.adminName || 'Admin')}
                </span>
                ${currentSchool.adminPhone ? `
                  <a 
                    href="tel:${currentSchool.adminPhone.replace(/[^0-9+]/g, '')}" 
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono font-bold hover:bg-emerald-100 transition-colors"
                  >
                    📞 ${escapeHtml(currentSchool.adminPhone)}
                  </a>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Amallar: Yangilash va Yangi Sinf Qo'shish -->
          <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap sm:flex-nowrap">
            <button 
              type="button" 
              id="admin-home-refresh-btn" 
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              title="Server bilan ma'lumotlarni yangilash"
            >
              <svg class="w-4 h-4 text-indigo-600 ${isInternalLoading ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <span class="hidden sm:inline">Yangilash</span>
            </button>

            <button 
              type="button" 
              id="admin-home-add-class-btn" 
              class="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
              title="Yangi sinf va sinf rahbarini qo'shish"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
              </svg>
              <span>+ Sinf qo'shish</span>
            </button>
          </div>

        </div>

        <!-- ======================================================== -->
        <!-- QIDIRUV VA FILTR QATORI                                  -->
        <!-- Sinf nomi va Rahbar nomi orqali qidirish                  -->
        <!-- ======================================================== -->
        <div class="bg-white p-3 sm:p-4 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <!-- Qidiruv inputi -->
          <div class="relative flex-1">
            <input 
              type="text" 
              id="class-search-input" 
              value="${escapeHtml(searchQuery)}" 
              placeholder="Sinf (masalan: 5-A) yoki sinf rahbari ismi orqali qidirish..." 
              class="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-800 transition-all"
            />
            <svg class="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            ${searchQuery ? `
              <button id="class-search-clear-btn" class="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            ` : ''}
          </div>

          <!-- Saralash tugmalari va Sinflar soni -->
          <div class="flex items-center gap-2 shrink-0 justify-between sm:justify-end">
            <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button 
                type="button" 
                class="sort-toggle-btn px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  sortMode === 'class_order' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }"
                data-sort="class_order"
                title="Sinflar o'sish tartibida (1-A, 1-B... 11-D)"
              >
                Sinf 1-11
              </button>
              <button 
                type="button" 
                class="sort-toggle-btn px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  sortMode === 'alphabetical' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }"
                data-sort="alphabetical"
                title="O'qituvchilar alifbo tartibida (A-Z)"
              >
                Rahbar A-Z
              </button>
            </div>

            <span class="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold font-mono">
              ${filteredClasses.length} ta sinf
            </span>
          </div>

        </div>

        <!-- ======================================================== -->
        <!-- SINFLAR TUGMALARI (GRID)                                 -->
        <!-- Har birida sinf nomi, nechta o'quvchi bor ekani,         -->
        <!-- tahrirlash va o'chirish tugmasi qo'shilgan               -->
        <!-- ======================================================== -->
        ${filteredClasses.length === 0 ? `
          <div class="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3">
            <span class="text-4xl">📚</span>
            <h3 class="text-base font-bold text-slate-800">
              ${searchQuery ? "Qidiruv bo'yicha hech qanday sinf topilmadi" : "Maktabda hali sinflar qo'shilmagan"}
            </h3>
            <p class="text-xs text-slate-500 max-w-sm mx-auto">
              ${searchQuery ? "Boshqa sinf yoki o'qituvchi ismini qidirib ko'ring" : "Birinchi sinf va sinf rahbarini qo'shish uchun quyidagi tugmani bosing"}
            </p>
            ${!searchQuery ? `
              <button 
                type="button" 
                id="btn-empty-add-class" 
                class="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                + Birinchi sinfni qo'shish
              </button>
            ` : ''}
          </div>
        ` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
            ${filteredClasses.map((cls, idx) => {
              const studentsCount = classStudentCounts.get(cls.id) || 0;
              const teacherName = cls.teacherName || "Sinf rahbari belgilanmagan";

              return `
                <div 
                  class="class-item-card bg-white p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between gap-2 sm:gap-3 group relative cursor-pointer active:scale-[0.99]"
                  data-class-id="${cls.id}"
                >
                  <!-- Mobil ko'rinish uchun ixcham va qulay tugma dizayni -->
                  <div class="flex sm:hidden items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <!-- Kichik Sinf nishoni -->
                      <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 font-mono shadow-xs">
                        ${escapeHtml(cls.name)}
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <h3 class="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            ${escapeHtml(cls.name)} sinf
                          </h3>
                          <span class="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono shrink-0">
                            👥 ${studentsCount}
                          </span>
                        </div>
                        <p class="text-[11px] text-slate-500 truncate mt-0.5">
                          👨‍🏫 ${escapeHtml(teacherName)}
                        </p>
                      </div>
                    </div>

                    <!-- Mobil amallar: Tahrirlash va O'chirish -->
                    <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
                      <button 
                        type="button" 
                        class="btn-edit-class p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-all active:scale-95 cursor-pointer"
                        data-class-id="${cls.id}"
                        title="Tahrirlash"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      <button 
                        type="button" 
                        class="btn-delete-class p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs transition-all active:scale-95 cursor-pointer"
                        data-class-id="${cls.id}"
                        data-class-name="${escapeHtml(cls.name)}"
                        title="O'chirish"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- Desktop ko'rinish (sm va undan katta) -->
                  <div class="hidden sm:block">
                    <div class="flex items-center justify-between gap-2 mb-2.5">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <!-- Katta Sinf nishoni -->
                        <div class="w-11 h-11 rounded-2xl bg-indigo-600 text-white font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-xs font-mono group-hover:scale-105 transition-transform">
                          ${escapeHtml(cls.name)}
                        </div>

                        <div class="min-w-0">
                          <h3 class="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            ${escapeHtml(cls.name)} sinf
                          </h3>
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 font-mono mt-0.5">
                            👥 ${studentsCount} ta o'quvchi
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Sinf rahbari ma'lumoti -->
                    <div class="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <div class="flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate">
                        <span>👨‍🏫</span>
                        <span class="truncate">${escapeHtml(teacherName)}</span>
                      </div>
                      ${cls.teacherPhone ? `
                        <div class="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                          <span>📞</span>
                          <span>${escapeHtml(cls.teacherPhone)}</span>
                        </div>
                      ` : ''}
                      ${cls.teacherSubject ? `
                        <div class="text-[10.5px] text-slate-500 truncate">
                          Fani: <strong>${escapeHtml(cls.teacherSubject)}</strong>
                        </div>
                      ` : ''}
                    </div>
                  </div>

                  <!-- Desktop pastki qator: Ko'rish, Tahrirlash va O'chirish -->
                  <div class="hidden sm:flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100" onclick="event.stopPropagation()">
                    
                    <button 
                      type="button" 
                      class="btn-view-class-students flex-1 py-1.5 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                      data-class-id="${cls.id}"
                      title="Sinf o'quvchilari ro'yxatini ko'rish"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                      <span>Ko'rish</span>
                    </button>

                    <!-- Tahrirlash tugmasi -->
                    <button 
                      type="button" 
                      class="btn-edit-class p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
                      data-class-id="${cls.id}"
                      title="Sinf va rahbar ma'lumotlarini tahrirlash"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>

                    <!-- O'chirish tugmasi -->
                    <button 
                      type="button" 
                      class="btn-delete-class p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
                      data-class-id="${cls.id}"
                      data-class-name="${escapeHtml(cls.name)}"
                      title="Sinfni o'chirish"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>

                  </div>

                </div>
              `;
            }).join('')}
          </div>
        `}

      </div>
    `;

    // Hodisalarni ulash
    const searchInput = container.querySelector('#class-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        render();
        const updatedInput = container.querySelector('#class-search-input');
        if (updatedInput) {
          updatedInput.focus();
          updatedInput.setSelectionRange(searchQuery.length, searchQuery.length);
        }
      });
    }

    container.querySelector('#class-search-clear-btn')?.addEventListener('click', () => {
      searchQuery = '';
      render();
    });

    // Saralash rejimi
    container.querySelectorAll('.sort-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sortMode = btn.getAttribute('data-sort');
        render();
      });
    });

    // Yangilash tugmasi
    container.querySelector('#admin-home-refresh-btn')?.addEventListener('click', async () => {
      isInternalLoading = true;
      render();
      if (onRefreshData) await onRefreshData();
      isInternalLoading = false;
      render();
    });

    // Sinf qo'shish
    container.querySelector('#admin-home-add-class-btn')?.addEventListener('click', () => {
      if (onAddClass) onAddClass();
    });

    container.querySelector('#btn-empty-add-class')?.addEventListener('click', () => {
      if (onAddClass) onAddClass();
    });

    // Tahrirlash tugmasi
    container.querySelectorAll('.btn-edit-class').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const classId = btn.getAttribute('data-class-id');
        if (onEditClass) onEditClass(classId);
      });
    });

    // O'chirish tugmasi
    container.querySelectorAll('.btn-delete-class').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const classId = btn.getAttribute('data-class-id');
        if (onDeleteClass) onDeleteClass(classId);
      });
    });

    // Sinf kartasini yoki Ko'rish tugmasini bosganda
    container.querySelectorAll('.class-item-card, .btn-view-class-students').forEach(el => {
      el.addEventListener('click', () => {
        const classId = el.getAttribute('data-class-id');
        if (onViewTeacher) onViewTeacher(classId);
      });
    });
  }

  render();
}
