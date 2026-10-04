/**
 * MaktabX - Sinf Rahbari uchun Maxsus Qidiruv Sahifasi (Teacher Search View)
 * Mobil qurilmalar uchun moslashtirilgan, o'quvchilar bir qator bo'lib, qisqa va aniq ma'lumot bilan,
 * silliq va chiroyli animatsiya bilan chiqadi.
 */

import { normalizeText, matchesPhone, cleanPhone, formatReadableDate } from '../data.js';
import { isFemaleStudent } from '../utils/exportUtils.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTeacherSearchView(container, {
  state,
  currentClass,
  onViewStudent,
  onEditStudent,
  onAddStudent,
  onBack,
  showToast
}) {
  let searchQuery = '';
  let activeFilter = 'all'; // 'all' | 'boys' | 'girls' | 'has_phone'

  const school = state.schools?.find(s => s.id === currentClass.schoolId) || {};
  const allClassStudents = (state.students || []).filter(s => s.classId === currentClass.id);

  function getFilteredStudents() {
    let list = [...allClassStudents];

    // Filter chips
    if (activeFilter === 'boys') {
      list = list.filter(s => !isFemaleStudent(s));
    } else if (activeFilter === 'girls') {
      list = list.filter(s => isFemaleStudent(s));
    } else if (activeFilter === 'has_phone') {
      list = list.filter(s => s.phone || s.fatherPhone || s.motherPhone || s.phoneNumber);
    }

    const rawQuery = searchQuery.trim();
    if (!rawQuery) {
      list.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'uz'));
      return list;
    }

    const query = normalizeText(rawQuery);
    const queryDigits = rawQuery.replace(/\D/g, '');

    list = list.filter(student => {
      // 1. Telefon raqamlari
      if (matchesPhone(student.phone, rawQuery)) return true;
      if (matchesPhone(student.fatherPhone, rawQuery)) return true;
      if (matchesPhone(student.motherPhone, rawQuery)) return true;
      if (student.phoneNumber && matchesPhone(student.phoneNumber, rawQuery)) return true;

      // 2. Matnli maydonlar (Ism, familiya, ota-ona, manzil, pasport)
      const fullName = normalizeText(student.fullName || '');
      const lastName = normalizeText(student.lastName || '');
      const firstName = normalizeText(student.firstName || '');
      const middleName = normalizeText(student.middleName || '');
      const fatherName = normalizeText(student.fatherFullName || '');
      const motherName = normalizeText(student.motherFullName || '');
      const pinfl = normalizeText(student.pinfl || '');
      const passport = normalizeText(student.passportNumber || '');
      const guvohnoma = normalizeText(student.guvohnomaSeriaNumber || '');
      const address = normalizeText(student.address || '');

      if (fullName.includes(query)) return true;
      if (lastName.includes(query)) return true;
      if (firstName.includes(query)) return true;
      if (middleName.includes(query)) return true;
      if (fatherName.includes(query)) return true;
      if (motherName.includes(query)) return true;
      if (pinfl.includes(query)) return true;
      if (passport.includes(query)) return true;
      if (guvohnoma.includes(query)) return true;
      if (address.includes(query)) return true;

      // 3. Platformalar loginlari
      if (student.platforms) {
        for (const pKey of Object.keys(student.platforms)) {
          const cred = student.platforms[pKey];
          if (cred && cred.login && normalizeText(cred.login).includes(query)) {
            return true;
          }
        }
      }

      // 4. Raqamli maydonlar (PINFL, Pasport)
      if (queryDigits && queryDigits.length >= 2) {
        const sPinfl = (student.pinfl || '').replace(/\D/g, '');
        if (sPinfl && sPinfl.includes(queryDigits)) return true;
        const sPassport = (student.passportNumber || '').replace(/\D/g, '');
        if (sPassport && sPassport.includes(queryDigits)) return true;
      }

      return false;
    });

    list.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'uz'));
    return list;
  }

  // Sahifaning doimiy bazaviy tuzilishi (Input qayta chizilmaydi, fokus yo'qolmaydi)
  container.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-3.5 sm:space-y-4 animate-fade-in text-slate-800 pb-10">
      
      <!-- Qidiruv paneli (Header) -->
      <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg border border-indigo-100/80 shadow-2xs">
              🔍
            </div>
            <div>
              <h1 class="text-sm sm:text-base font-black text-slate-900 leading-tight">
                O'quvchilarni Qidirish
              </h1>
              <p class="text-[11px] text-slate-500">
                ${escapeHtml(currentClass.name)} • Jami ${allClassStudents.length} nafar o'quvchi
              </p>
            </div>
          </div>

          <button 
            id="btn-search-add-student"
            type="button"
            class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
            </svg>
            <span>Qo'shish</span>
          </button>
        </div>

        <!-- Qidiruv inputi -->
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
          <input 
            type="text" 
            id="teacher-search-input" 
            value="${escapeHtml(searchQuery)}"
            placeholder="Ism, telefon, manzil, PINFL..." 
            class="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200/90 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400 shadow-inner"
            autocomplete="off"
            autofocus
          />
          <button 
            id="btn-clear-search" 
            type="button"
            class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer hidden"
            title="Tozalash"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Filter tugmalari (Faqat 3 ta qisqa va oddiy tugma: Barcha, O'g'il, Qiz) -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
          <button 
            type="button" 
            class="btn-search-filter px-3.5 py-1.5 rounded-xl border whitespace-nowrap cursor-pointer transition-all active:scale-95 bg-slate-900 text-white border-slate-900 shadow-xs"
            data-filter="all"
          >
            Barcha (${allClassStudents.length})
          </button>
          <button 
            type="button" 
            class="btn-search-filter px-3.5 py-1.5 rounded-xl border whitespace-nowrap cursor-pointer transition-all active:scale-95 bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            data-filter="boys"
          >
            👦 O'g'il (${allClassStudents.filter(s => !isFemaleStudent(s)).length})
          </button>
          <button 
            type="button" 
            class="btn-search-filter px-3.5 py-1.5 rounded-xl border whitespace-nowrap cursor-pointer transition-all active:scale-95 bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            data-filter="girls"
          >
            👧 Qiz (${allClassStudents.filter(s => isFemaleStudent(s)).length})
          </button>
        </div>
      </div>

      <!-- Qidiruv natijalari soni va qisqa xulosa -->
      <div class="flex items-center justify-between px-2 text-xs text-slate-500">
        <span id="search-counter-text">
          <strong class="text-slate-900 font-bold">${allClassStudents.length} ta</strong> o'quvchi
        </span>
        <span class="text-[11px] font-medium text-slate-400">
          ${escapeHtml(currentClass.name)}
        </span>
      </div>

      <!-- Natijalar ro'yxati (Bir qatorli silliq ro'yxat) -->
      <div id="search-results-list" class="space-y-1.5 transition-all">
        <!-- Rendered dynamically -->
      </div>

    </div>
  `;

  const inputEl = container.querySelector('#teacher-search-input');
  const clearBtn = container.querySelector('#btn-clear-search');
  const counterText = container.querySelector('#search-counter-text');
  const resultsContainer = container.querySelector('#search-results-list');

  // Natijalarni bitta qatorda, qisqa, aniq va animatsiya bilan yangilovchi funksiya
  function updateResultsList() {
    const students = getFilteredStudents();

    // Tozalash tugmasi ko'rinishi
    if (clearBtn) {
      if (searchQuery.trim()) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }

    // Hisoblagich matni
    if (counterText) {
      if (searchQuery.trim()) {
        counterText.innerHTML = `"${escapeHtml(searchQuery)}" bo'yicha: <strong class="text-indigo-600 font-bold">${students.length} ta</strong> o'quvchi topildi`;
      } else {
        counterText.innerHTML = `Jami: <strong class="text-slate-900 font-bold">${students.length} ta</strong> o'quvchi`;
      }
    }

    if (!resultsContainer) return;

    if (students.length === 0) {
      resultsContainer.innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center border border-slate-200/90 shadow-2xs animate-fade-in">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-2">
            🔎
          </div>
          <h3 class="text-xs sm:text-sm font-bold text-slate-800">
            O'quvchi topilmadi
          </h3>
          <p class="text-[11px] text-slate-400 mt-0.5">
            "${escapeHtml(searchQuery)}" bo'yicha ma'lumot yo'q. Boshqa so'z bilan qidiring.
          </p>
        </div>
      `;
      return;
    }

    // Har bir o'quvchi bir qatorda (Single Row), qisqa va aniq ma'lumot bilan
    resultsContainer.innerHTML = students.map((student, idx) => {
      const isGirl = isFemaleStudent(student);
      const cleanStdPhone = cleanPhone(student.phone || student.phoneNumber || '');
      const cleanMotherPhone = cleanPhone(student.motherPhone || '');
      const cleanFatherPhone = cleanPhone(student.fatherPhone || '');
      const bestPhone = cleanStdPhone || cleanMotherPhone || cleanFatherPhone;
      const phoneDisplay = student.phone || student.phoneNumber || student.motherPhone || student.fatherPhone || '';

      const animDelay = Math.min(idx * 25, 250);

      return `
        <div 
          class="student-search-row group bg-white hover:bg-indigo-50/40 active:bg-indigo-50 rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 hover:border-indigo-300 shadow-2xs transition-all duration-200 flex items-center justify-between gap-2.5 cursor-pointer"
          style="animation: fadeIn 0.25s ease-out ${animDelay}ms both;"
          data-id="${student.id}"
        >
          <!-- Chap qism: Tartib raqami, Avatar va Asosiy Ism/Telefon bir qatorda -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <span class="w-5 text-center text-[10.5px] font-mono font-bold text-slate-400 shrink-0">
              ${idx + 1}
            </span>

            <div class="relative shrink-0">
              ${student.photo ? `
                <img 
                  src="${student.photo}" 
                  alt="${escapeHtml(student.fullName)}" 
                  class="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-2xs"
                  loading="lazy"
                />
              ` : `
                <div class="w-9 h-9 rounded-xl ${isGirl ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'} flex items-center justify-center font-black text-xs border border-slate-200/80 shadow-2xs">
                  ${(student.firstName || student.fullName || 'O').charAt(0).toUpperCase()}
                </div>
              `}
              <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${isGirl ? 'bg-pink-500' : 'bg-blue-500'} ring-2 ring-white text-[8px] flex items-center justify-center text-white">
                ${isGirl ? '♀' : '♂'}
              </span>
            </div>

            <!-- Ism va Qisqa aniq ma'lumotlar -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-indigo-900 transition-colors">
                  ${escapeHtml(student.fullName || `${student.lastName || ''} ${student.firstName || ''}`)}
                </h3>
              </div>

              <div class="flex items-center gap-2 text-[11px] text-slate-500 truncate mt-0.5">
                ${phoneDisplay ? `
                  <span class="font-mono text-slate-600 font-semibold inline-flex items-center gap-1">
                    📞 ${escapeHtml(phoneDisplay)}
                  </span>
                ` : `
                  <span class="text-slate-400 italic">Telefon yo'q</span>
                `}

                ${student.address ? `
                  <span class="text-slate-300 hidden sm:inline">•</span>
                  <span class="text-slate-500 truncate hidden sm:inline max-w-[200px]">
                    📍 ${escapeHtml(student.address)}
                  </span>
                ` : ''}

                ${student.pinfl ? `
                  <span class="text-slate-300 hidden md:inline">•</span>
                  <span class="font-mono text-[10px] text-slate-400 hidden md:inline">
                    ${escapeHtml(student.pinfl)}
                  </span>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- O'ng qism: Qo'ng'iroq va Dosyega o'tish tugmalari -->
          <div class="flex items-center gap-1.5 shrink-0" onclick="event.stopPropagation()">
            ${bestPhone ? `
              <a 
                href="tel:${bestPhone}" 
                class="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs transition-colors cursor-pointer border border-emerald-200/80 active:scale-95"
                title="Qo'ng'iroq qilish"
              >
                📞
              </a>
            ` : ''}

            <button 
              type="button" 
              class="btn-row-dossier px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              data-id="${student.id}"
              title="O'quvchi ma'lumotlarini ko'rish"
            >
              <span class="hidden sm:inline">Ko'rish</span>
              <span>&rarr;</span>
            </button>
          </div>

        </div>
      `;
    }).join('');

    // Har bir qator bosilganda to'g'ridan-to'g'ri o'quvchi profiliga o'tish
    resultsContainer.querySelectorAll('.student-search-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        if (id && onViewStudent) onViewStudent(id);
      });
    });

    resultsContainer.querySelectorAll('.btn-row-dossier').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id && onViewStudent) onViewStudent(id);
      });
    });
  }

  // Input listener - darhol qidiradi, animatsiya bilan ko'rsatadi, input fokusini saqlaydi!
  if (inputEl) {
    inputEl.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      updateResultsList();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchQuery = '';
      if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
      }
      updateResultsList();
    });
  }

  // Filter chips listeners
  container.querySelectorAll('.btn-search-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.getAttribute('data-filter') || 'all';

      // Tugmalar ko'rinishini almashtirish
      container.querySelectorAll('.btn-search-filter').forEach(b => {
        const bFilter = b.getAttribute('data-filter');
        if (bFilter === activeFilter) {
          b.className = "btn-search-filter px-3 py-1 rounded-xl border whitespace-nowrap cursor-pointer transition-all active:scale-95 bg-slate-900 text-white border-slate-900 shadow-xs";
        } else {
          b.className = "btn-search-filter px-3 py-1 rounded-xl border whitespace-nowrap cursor-pointer transition-all active:scale-95 bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100";
        }
      });

      updateResultsList();
    });
  });

  // Yangi o'quvchi qo'shish
  container.querySelector('#btn-search-add-student')?.addEventListener('click', () => {
    if (onAddStudent) onAddStudent();
  });

  // Dastlabki ro'yxatni yuklash
  updateResultsList();
}
