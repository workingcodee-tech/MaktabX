/**
 * MaktabX - Admin Qidiruv Sahifasi (Admin Search View)
 * - Faqat barcha maktab o'quvchilari
 * - Qat'iy alifbo tartibida (A-Z)
 * - Barcha ma'lumotlar bilan keng qamrovli lahzalik qidiruv (ism, sinf, telefon, PINFL, manzil va h.k.)
 */

import { matchesPhone, normalizeText, getStudentContactPhone, compareClassNames } from '../data.js';
import { isFemaleStudent, formatStudentGender } from '../utils/exportUtils.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderAdminSearchView(container, {
  state,
  currentSchool,
  onViewStudent,
  onEditStudent,
  showToast
}) {
  let searchQuery = '';
  let genderFilter = 'all'; // 'all' | 'male' | 'female' | 'phone'
  let classFilter = 'all';
  let currentPage = 1;
  const pageSize = 20;

  // Ushbu maktabga tegishli barcha sinflar
  const schoolClasses = (state.classes || [])
    .filter(c => c.schoolId === currentSchool.id)
    .sort((a, b) => compareClassNames(a.name, b.name));

  const classMap = new Map();
  schoolClasses.forEach(c => classMap.set(c.id, c));

  // Ushbu maktabga tegishli barcha o'quvchilar
  const allSchoolStudents = (state.students || []).filter(s => {
    if (s.schoolId === currentSchool.id) return true;
    const cls = classMap.get(s.classId);
    return Boolean(cls);
  });

  function copyToClipboard(text, label = "Ma'lumot") {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (showToast) showToast(`${label} nusxalandi: ${text}`, 'success');
    }).catch(() => {
      if (showToast) showToast("Nusxalashda xatolik", 'error');
    });
  }

  function render() {
    const rawQuery = searchQuery.trim();
    const query = normalizeText(rawQuery);

    // Filtrlash
    let filtered = allSchoolStudents.filter(s => {
      const cls = classMap.get(s.classId);
      const className = cls ? cls.name : (s.className || '');

      // Sinf filtri
      if (classFilter !== 'all' && s.classId !== classFilter) {
        return false;
      }

      // Jins va telefon filtri
      if (genderFilter === 'male') {
        if (isFemaleStudent(s)) return false;
      } else if (genderFilter === 'female') {
        if (!isFemaleStudent(s)) return false;
      } else if (genderFilter === 'phone') {
        const phone = s.phone || s.phoneNumber || s.fatherPhone || s.motherPhone;
        if (!phone || phone.trim().length === 0) return false;
      }

      // Qidiruv so'rovi bo'sh bo'lsa
      if (!rawQuery) return true;

      // Telefon orqali qidiruv
      if (matchesPhone(s.phone, rawQuery) || 
          matchesPhone(s.fatherPhone, rawQuery) || 
          matchesPhone(s.motherPhone, rawQuery) || 
          matchesPhone(s.phoneNumber, rawQuery)) {
        return true;
      }

      // Matnli maydonlar
      const fullName = s.fullName || `${s.lastName || ''} ${s.firstName || ''} ${s.middleName || ''}`.trim();
      const pinfl = String(s.pinfl || '').replace(/\D/g, '');
      const address = s.address || '';

      return (
        normalizeText(fullName).includes(query) ||
        normalizeText(className).includes(query) ||
        (pinfl && pinfl.includes(rawQuery.replace(/\D/g, ''))) ||
        normalizeText(address).includes(query)
      );
    });

    // DIQQAT TALABI: BARCHA O'QUVCHILAR MUTLAQO ALIFBO TARTIBIDA (A-Z) SARALANADI!
    filtered.sort((a, b) => {
      const nameA = a.fullName || `${a.lastName || ''} ${a.firstName || ''} ${a.middleName || ''}`.trim();
      const nameB = b.fullName || `${b.lastName || ''} ${b.firstName || ''} ${b.middleName || ''}`.trim();
      return nameA.localeCompare(nameB, 'uz', { sensitivity: 'base' });
    });

    // Sahifalash
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    container.innerHTML = `
      <div class="space-y-4 pb-28 max-w-5xl mx-auto animate-fade-in text-slate-800">
        
        <!-- Yuqori qidiruv sarlavhasi va statistika -->
        <div class="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0 shadow-2xs">
              🔍
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  O'quvchilarni Qidirish
                </h1>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Jami: ${allSchoolStudents.length} ta o'quvchi
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                ${escapeHtml(currentSchool.name)} • Barcha o'quvchilar alifbo tartibida (A-Z)
              </p>
            </div>
          </div>

          <!-- Tezkor qidiruv inputi -->
          <div class="w-full md:w-80">
            <div class="relative">
              <input 
                type="text" 
                id="admin-search-input" 
                value="${escapeHtml(searchQuery)}" 
                placeholder="Ism, sinf, tel, PINFL yoki manzil..." 
                class="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-800 transition-all"
              />
              <svg class="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              ${searchQuery ? `
                <button id="admin-search-clear-btn" class="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Filtrlar qatori: Faqat 3 ta qisqa va oddiy tugma (Barcha, O'g'il, Qiz) -->
        <div class="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none">
            <button 
              type="button" 
              class="filter-gender-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                genderFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }" 
              data-gender="all"
            >
              Barcha (${allSchoolStudents.length})
            </button>
            <button 
              type="button" 
              class="filter-gender-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                genderFilter === 'male' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }" 
              data-gender="male"
            >
              👦 O'g'il
            </button>
            <button 
              type="button" 
              class="filter-gender-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                genderFilter === 'female' ? 'bg-pink-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }" 
              data-gender="female"
            >
              👧 Qiz
            </button>
          </div>

          <!-- Sinf tanlovi dropdown -->
          <div class="flex items-center gap-2 ml-auto">
            <span class="text-xs font-semibold text-slate-500 hidden sm:inline">Sinf:</span>
            <select 
              id="admin-search-class-select" 
              class="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Barcha sinflar (${schoolClasses.length} ta)</option>
              ${schoolClasses.map(c => `
                <option value="${c.id}" ${classFilter === c.id ? 'selected' : ''}>
                  ${c.name} (${(state.students || []).filter(s => s.classId === c.id).length} o'quvchi)
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- O'quvchilar ro'yxati -->
        <div class="space-y-2.5">
          ${paginated.length === 0 ? `
            <div class="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2">
              <span class="text-3xl">🔍</span>
              <h3 class="text-sm font-bold text-slate-800">Qidiruv bo'yicha o'quvchi topilmadi</h3>
              <p class="text-xs text-slate-500 max-w-sm mx-auto">
                Qidiruv so'zini tekshiring yoki filtrlarni tozalang
              </p>
            </div>
          ` : `
            <div class="grid grid-cols-1 gap-2.5">
              ${paginated.map((student, idx) => {
                const globalIdx = startIndex + idx + 1;
                const cls = classMap.get(student.classId);
                const className = cls ? cls.name : (student.className || '-');
                const fullName = student.fullName || `${student.lastName || ''} ${student.firstName || ''} ${student.middleName || ''}`.trim() || "O'quvchi";
                const isGirl = isFemaleStudent(student);
                const isMale = !isGirl;
                const contact = getStudentContactPhone(student);

                return `
                  <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 group">
                    
                    <div class="flex items-start sm:items-center gap-3 min-w-0">
                      <!-- Indeks va Avatar -->
                      <div class="w-10 h-10 rounded-xl ${isMale ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'} border flex items-center justify-center font-bold text-xs shrink-0 font-mono shadow-2xs">
                        ${globalIdx}
                      </div>

                      <!-- Asosiy ma'lumotlar -->
                      <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <h3 class="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            ${escapeHtml(fullName)}
                          </h3>
                          <span class="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 font-mono">
                            ${escapeHtml(className)}
                          </span>
                          <span class="px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${isMale ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'} shrink-0">
                            ${escapeHtml(formatStudentGender(student, false))}
                          </span>
                        </div>

                        <!-- Telefon, PINFL va Manzil -->
                        <div class="flex items-center gap-2 sm:gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                          ${contact ? `
                            <a 
                              href="tel:${contact.number.replace(/[^0-9+]/g, '')}" 
                              class="inline-flex items-center gap-1 text-emerald-700 font-mono font-semibold hover:underline"
                              title="${contact.label} raqami"
                            >
                              <span>📞 ${contact.label}: ${escapeHtml(contact.number)}</span>
                            </a>
                          ` : '<span class="text-slate-400">Tel: kiritilmagan</span>'}

                          ${student.pinfl ? `
                            <span 
                              class="inline-flex items-center gap-1 font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer hover:bg-slate-200" 
                              title="PINFL nusxalash"
                              onclick="navigator.clipboard.writeText('${student.pinfl}')"
                            >
                              <span>JSHSHIR: ${escapeHtml(student.pinfl)}</span>
                            </span>
                          ` : ''}

                          ${student.birthDate ? `
                            <span class="text-slate-500 font-mono">
                              🎂 ${escapeHtml(student.birthDate)}
                            </span>
                          ` : ''}

                          ${student.address ? `
                            <span class="text-slate-500 truncate max-w-xs" title="${escapeHtml(student.address)}">
                              📍 ${escapeHtml(student.address)}
                            </span>
                          ` : ''}
                        </div>
                      </div>
                    </div>

                    <!-- Tugmalar: Ko'rish va Tahrirlash -->
                    <div class="flex items-center gap-1.5 self-end md:self-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                      <button 
                        type="button" 
                        class="btn-view-student px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                        data-student-id="${student.id}"
                        title="O'quvchi ma'lumotlarini ko'rish"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        <span>Ko'rish</span>
                      </button>

                      <button 
                        type="button" 
                        class="btn-edit-student px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                        data-student-id="${student.id}"
                        title="O'quvchi ma'lumotlarini tahrirlash"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        <span>Tahrirlash</span>
                      </button>
                    </div>

                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Sahifalash (Pagination) -->
        ${totalPages > 1 ? `
          <div class="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between text-xs text-slate-600">
            <span class="font-medium">
              Ko'rsatilmoqda: <strong>${startIndex + 1} - ${Math.min(startIndex + pageSize, totalItems)}</strong> / ${totalItems} ta
            </span>
            <div class="flex items-center gap-1.5">
              <button 
                id="admin-search-prev-page" 
                class="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all"
                ${currentPage === 1 ? 'disabled' : ''}
              >
                &larr; Oldingi
              </button>
              <span class="px-2 font-mono font-bold text-indigo-700">${currentPage} / ${totalPages}</span>
              <button 
                id="admin-search-next-page" 
                class="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-all"
                ${currentPage === totalPages ? 'disabled' : ''}
              >
                Keyingi &rarr;
              </button>
            </div>
          </div>
        ` : ''}

      </div>
    `;

    // Hodisalarni ulash (Event listeners)
    const searchInput = container.querySelector('#admin-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        currentPage = 1;
        render();
        const updatedInput = container.querySelector('#admin-search-input');
        if (updatedInput) {
          updatedInput.focus();
          updatedInput.setSelectionRange(searchQuery.length, searchQuery.length);
        }
      });
    }

    container.querySelector('#admin-search-clear-btn')?.addEventListener('click', () => {
      searchQuery = '';
      currentPage = 1;
      render();
    });

    // Jins filtrlari
    container.querySelectorAll('.filter-gender-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        genderFilter = btn.getAttribute('data-gender');
        currentPage = 1;
        render();
      });
    });

    // Sinf filtri
    const classSelect = container.querySelector('#admin-search-class-select');
    if (classSelect) {
      classSelect.addEventListener('change', (e) => {
        classFilter = e.target.value;
        currentPage = 1;
        render();
      });
    }

    // Sahifalash
    container.querySelector('#admin-search-prev-page')?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        render();
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    container.querySelector('#admin-search-next-page')?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        render();
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // O'quvchi dosyesi va tahrirlash tugmalari
    container.querySelectorAll('.btn-view-student').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-student-id');
        if (onViewStudent) onViewStudent(studentId);
      });
    });

    container.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-student-id');
        if (onEditStudent) onEditStudent(studentId);
      });
    });
  }

  render();
}
