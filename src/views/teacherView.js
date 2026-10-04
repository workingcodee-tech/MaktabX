import { 
  cleanPhone, 
  matchesPhone, 
  normalizeText, 
  formatDate, 
  formatReadableDate,
  getTodayISODate,
  getStudentContactPhone, 
  getTodayDutyInfoForTeacher,
  recordDutyAbsenceAndDelegate,
  saveData
} from '../data.js';
import { saveDutyRosterToFirestore, saveDutyAbsenceToFirestore, saveAdminNotificationToFirestore } from '../firebase.js';
import { renderStudentTableSkeleton, renderStudentMobileCardsSkeleton } from '../components/skeletonLoaders.js';
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

export function renderTeacher(container, { state, currentClass, onAddStudent, onViewStudent, onEditStudent, onDeleteStudent, onExportList, onExportSingleStudent, onExportCSV, onChangeCredentials, onRefreshData, onManagePlatforms, onOpenAttendance }) {
  if (!currentClass) {
    currentClass = state?.classes?.[0] || {};
  }
  const currentSchool = (state?.schools || []).find(s => s.id === currentClass.schoolId) || {};
  let searchQuery = '';
  let selectedStudentId = null;
  let activeFilter = 'all'; // 'all' | 'boys' | 'girls'
  let isInternalLoading = false;

  function getSortedAndFilteredStudents() {
    const rawQuery = searchQuery.trim();
    if (!rawQuery) {
      let list = state.students.filter(student => {
        if (student.classId !== currentClass.id) return false;
        if (activeFilter === 'boys' && isFemaleStudent(student)) return false;
        if (activeFilter === 'girls' && !isFemaleStudent(student)) return false;
        return true;
      });
      list.sort((a, b) => {
        const nameA = (a.fullName || '').trim().toLowerCase();
        const nameB = (b.fullName || '').trim().toLowerCase();
        return nameA.localeCompare(nameB, 'uz');
      });
      return list;
    }

    const query = normalizeText(rawQuery);
    const queryDigits = rawQuery.replace(/\D/g, '');

    let list = state.students.filter(student => {
      if (student.classId !== currentClass.id) return false;

      // Filter chips: Faqat Barchasi, O'g'il bolalar, Qiz bolalar
      if (activeFilter === 'boys' && isFemaleStudent(student)) return false;
      if (activeFilter === 'girls' && !isFemaleStudent(student)) return false;

      // 1. Telefon raqamlari bo'yicha qidiruv (o'quvchi, otasi, onasi va b.)
      if (matchesPhone(student.phone, rawQuery)) return true;
      if (matchesPhone(student.fatherPhone, rawQuery)) return true;
      if (matchesPhone(student.motherPhone, rawQuery)) return true;
      if (student.phoneNumber && matchesPhone(student.phoneNumber, rawQuery)) return true;
      if (student.tel && matchesPhone(student.tel, rawQuery)) return true;

      // 2. Ism-familiya va shaxsiy matnli ma'lumotlar
      const fullName = normalizeText(student.fullName || '');
      const lastName = normalizeText(student.lastName || '');
      const firstName = normalizeText(student.firstName || '');
      const middleName = normalizeText(student.middleName || '');
      const fatherName = normalizeText(student.fatherFullName || '');
      const motherName = normalizeText(student.motherFullName || '');
      const pinfl = normalizeText(student.pinfl || '');
      const pinflPassport = normalizeText(student.pinflPassport || '');
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
      if (pinflPassport.includes(query)) return true;
      if (passport.includes(query)) return true;
      if (guvohnoma.includes(query)) return true;
      if (address.includes(query)) return true;

      // 3. Raqamli maydonlar (PINFL, Pasport)
      if (queryDigits && queryDigits.length >= 2) {
        const sPinfl = (student.pinfl || '').replace(/\D/g, '');
        if (sPinfl && sPinfl.includes(queryDigits)) return true;
        const sPassport = (student.passportNumber || '').replace(/\D/g, '');
        if (sPassport && sPassport.includes(queryDigits)) return true;
      }

      return false;
    });

    list.sort((a, b) => {
      const nameA = (a.fullName || '').trim().toLowerCase();
      const nameB = (b.fullName || '').trim().toLowerCase();
      return nameA.localeCompare(nameB, 'uz');
    });

    return list;
  }

  function render() {
    const students = getSortedAndFilteredStudents();
    const classStudents = state.students.filter(s => s.classId === currentClass.id);
    const totalClassStudents = classStudents.length;
    const boyCount = classStudents.filter(s => !isFemaleStudent(s)).length;
    const girlCount = classStudents.filter(s => isFemaleStudent(s)).length;
    const isCurrentlyLoading = isInternalLoading || !!state.isLoadingStudents;

    // Bugungi navbatchilik holatini aniqlash (Guruhlar bo'yicha mas'ul navbatchi)
    const dutyInfo = getTodayDutyInfoForTeacher(currentClass, state);
    const isDutyToday = dutyInfo.isDutyToday;

    // Ensure selected student exists in list
    if (!selectedStudentId || !students.some(s => s.id === selectedStudentId)) {
      selectedStudentId = students.length > 0 ? students[0].id : null;
    }
    const selectedStudent = students.find(s => s.id === selectedStudentId) || null;

    container.innerHTML = `
      <div class="h-full flex flex-col gap-4 sm:gap-5">

        ${isDutyToday ? `
          <!-- Bugungi Mas'ul Navbatchi Sinf Rahbari Kichik va Qulay Banneri (Faqat navbatchi o'qituvchiga ko'rinadi) -->
          <div 
            id="duty-teacher-banner" 
            class="p-2.5 sm:p-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white rounded-2xl shadow-xs flex items-center justify-between gap-3 animate-fade-in border border-emerald-400/40 cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
            title="Maktab davomatini olish uchun bosing"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-base shrink-0 shadow-inner">
                ⭐
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="text-xs sm:text-sm font-bold text-white leading-tight">
                    Bugun siz navbatchisiz!
                  </h4>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-white/20 text-emerald-100">
                    ${dutyInfo.dutyShifts.map(d => d.shift?.name || d.shiftName || 'Smena').join(', ')}
                  </span>
                </div>
                <p class="text-[11px] text-emerald-100/90 truncate mt-0.5">
                  Maktab davomatini olish uchun bosing &rarr;
                </p>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0" onclick="event.stopPropagation()">
              <button 
                type="button" 
                id="banner-report-duty-absence-btn"
                class="px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/35 border border-amber-300/40 text-amber-100 hover:text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                title="Kelolmaslik sababini bildirish"
              >
                ⚠️ Sabab
              </button>
              <button 
                type="button" 
                id="banner-open-attendance-btn"
                class="px-3 py-1.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Davomat</span>
                <span class="text-xs">&rarr;</span>
              </button>
            </div>
          </div>
        ` : ''}

        ${localStorage.getItem('maktabx_pending_cred_update') === currentClass.id ? `
          <!-- ID orqali kirilganda parolni yangilash eslatmasi -->
          <div id="pending-cred-banner" class="p-3.5 sm:p-4 bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50/60 border border-amber-300 rounded-2xl flex items-center justify-between gap-3 shadow-xs shrink-0 animate-fade-in">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <span>Siz Tiklash ID raqami orqali kirdingiz</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-800">Muhim eslatma</span>
                </div>
                <div class="text-[11.5px] text-slate-600 truncate mt-0.5">
                  Iltimos, o'zingiz uchun yangi doimiy login va parol o'rnating.
                </div>
              </div>
            </div>
            <button 
              id="banner-change-cred-btn" 
              class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold shrink-0 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
              </svg>
              <span>Parolni yangilash</span>
            </button>
          </div>
        ` : ''}

        <!-- Top Search and Actions Bar -->
        <div class="flex flex-col gap-3 shrink-0">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            <!-- Search input -->
            <div class="relative flex-1 max-w-lg">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </div>
              <input 
                type="text" 
                id="student-search-input" 
                value="${searchQuery}"
                placeholder="O'quvchi ismi, tel yoki PINFL orqali qidirish..."
                class="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              ${searchQuery ? `
                <button id="clear-search-btn" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer" title="Qidiruvni tozalash">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              ` : ''}
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 shrink-0">
              <button 
                id="teacher-refresh-btn"
                class="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 group"
                title="Ro'yxatni yangilash"
                aria-label="Yangilash"
              >
                <svg class="w-5 h-5 ${isCurrentlyLoading ? 'animate-spin text-indigo-600' : 'group-hover:rotate-180 transition-transform duration-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </button>

              <button 
                id="teacher-change-credentials-btn"
                class="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95"
                title="Sinf rahbari login va parolini o'zgartirish"
                aria-label="Login & Parol"
              >
                <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                </svg>
              </button>

              <!-- Ta'lim Platformalari (Kundalik.com va b.) boshqaruvi -->
              <button 
                id="teacher-platforms-btn"
                class="px-3 py-2.5 bg-white border border-indigo-200/90 hover:bg-indigo-50/80 text-indigo-700 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 group"
                title="Platformalar tarkibi (Kundalik.com va boshqalar) bo'yicha login/parollar"
                aria-label="Platformalar"
              >
                <svg class="w-5 h-5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <span class="text-xs font-bold hidden md:inline">Platformalar</span>
              </button>

              <!-- Davomat tugmasi -->
              <button 
                id="teacher-attendance-btn"
                class="px-3.5 py-2.5 ${
                  isDutyToday 
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white shadow-md shadow-emerald-200 ring-2 ring-emerald-300/80 font-bold cursor-pointer' 
                    : 'bg-white hover:bg-indigo-50/70 border border-slate-200 text-slate-700 hover:text-indigo-600 font-bold cursor-pointer'
                } rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 group"
                title="${
                  isDutyToday 
                    ? '⭐ Bugun siz mas\'ul navbatchisiz! Butun maktab davomatini to\'ldirish uchun bosing' 
                    : 'Davomat va Dars qoldirish'
                }"
                aria-label="Davomat"
              >
                ${isDutyToday ? `
                  <svg class="w-5 h-5 text-white group-hover:scale-110 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                  <span class="text-xs font-black hidden md:inline">
                    ⭐ Davomat (Navbatchisiz)
                  </span>
                ` : `
                  <svg class="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                  <span class="text-xs font-bold hidden md:inline">
                    Davomat
                  </span>
                `}
              </button>

              <button 
                id="export-list-btn"
                class="p-2.5 bg-white border border-slate-200 hover:bg-emerald-50/70 hover:border-emerald-300 rounded-xl text-slate-700 hover:text-emerald-700 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95"
                title="Ro'yxatni eksport qilish (Word, Excel, PDF)"
                aria-label="Eksport"
              >
                <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </button>

              <button 
                id="open-add-student-btn"
                class="bg-indigo-600 text-white p-2.5 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-md shadow-indigo-200 transition-all cursor-pointer active:scale-95"
                title="Yangi o'quvchi qo'shish"
                aria-label="Yangi o'quvchi qo'shish"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <span class="hidden sm:inline">Yangi o'quvchi</span>
              </button>
            </div>

          </div>

          <!-- Tezkor saralash filtrlari (Quick Filter Chips) -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button 
              data-filter="all"
              class="filter-chip whitespace-nowrap shrink-0 px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${activeFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white/80 border border-slate-200 text-slate-700 hover:bg-white'}"
            >
              Barchasi <span class="ml-1 opacity-80 font-normal">(${totalClassStudents})</span>
            </button>
            <button 
              data-filter="boys"
              class="filter-chip whitespace-nowrap shrink-0 px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${activeFilter === 'boys' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white/80 border border-slate-200 text-slate-700 hover:bg-blue-50/50 hover:text-blue-700'}"
            >
              O'g'il bolalar <span class="ml-1 opacity-80 font-normal">(${boyCount})</span>
            </button>
            <button 
              data-filter="girls"
              class="filter-chip whitespace-nowrap shrink-0 px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${activeFilter === 'girls' ? 'bg-pink-600 text-white shadow-xs' : 'bg-white/80 border border-slate-200 text-slate-700 hover:bg-pink-50/50 hover:text-pink-700'}"
            >
              Qiz bolalar <span class="ml-1 opacity-80 font-normal">(${girlCount})</span>
            </button>

            ${(searchQuery || activeFilter !== 'all') ? `
              <button 
                id="reset-filters-btn"
                class="whitespace-nowrap text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline flex items-center gap-1 shrink-0 ml-1"
              >
                Filtrni tozalash
              </button>
            ` : ''}
          </div>

        </div>

        <!-- Split View: Mobile Card List + Desktop Table/Inspect -->
        <div class="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
          
          <!-- Mobile Student Cards List (NO HORIZONTAL SCROLL) -->
          <div class="block md:hidden flex-1 overflow-y-auto space-y-2.5 pb-36 sm:pb-24">
            <div class="flex items-center justify-between px-1 mb-1">
              <span class="text-xs font-bold text-slate-700">
                ${currentClass?.name || 'Sinf'} Sinf (${students.length} nafar)
              </span>
              <div class="flex items-center gap-1.5 text-[11px]">
                <button id="mobile-export-btn" class="p-1.5 bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-600 rounded-lg shadow-2xs cursor-pointer active:scale-95" title="Eksport qilish (Word, Excel, PDF)" aria-label="Eksport">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </button>
                <span class="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md font-semibold">${boyCount} O'g'il</span>
                <span class="px-2 py-0.5 bg-pink-50 text-pink-600 rounded-md font-semibold">${girlCount} Qiz</span>
              </div>
            </div>

            <!-- Mobile: Skeleton Loader yoki O'quvchilar ro'yxati -->
            ${isCurrentlyLoading ? renderStudentMobileCardsSkeleton(5) : (
              students.length === 0 ? `
                <div class="py-14 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3">
                  <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                  </div>
                  <div class="text-sm font-semibold text-slate-700">
                    ${searchQuery || activeFilter !== 'all' 
                      ? `Tanlangan mezon bo'yicha hech qanday o'quvchi topilmadi` 
                      : `Bu sinfga hali o'quvchilar qo'shilmagan.`
                    }
                  </div>
                  <p class="text-xs text-slate-400">
                    ${searchQuery || activeFilter !== 'all' 
                      ? `Qidiruv matnini tekshiring yoki filtrni tozalang` 
                      : `Quyidagi "Yangi o'quvchi" tugmasini bosing.`
                    }
                  </p>
                </div>
              ` : students.map((student) => {
                const avatarLetter = (student.fullName || 'O').trim().charAt(0).toUpperCase();
                return `
                  <div 
                    data-student-id="${student.id}"
                    class="mobile-student-card w-full bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs flex items-center justify-between gap-3 active:scale-[0.99] active:bg-slate-50 hover:border-indigo-300 transition-all cursor-pointer select-none"
                  >
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <div class="relative shrink-0">
                        ${student.photo ? `
                          <img src="${student.photo}" alt="${student.fullName}" class="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                        ` : `
                          <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100/80 flex items-center justify-center font-bold text-base">
                            ${avatarLetter}
                          </div>
                        `}
                      </div>

                      <div class="min-w-0 flex-1">
                        <h3 class="text-sm font-bold text-slate-900 truncate leading-tight">
                          ${student.fullName}
                        </h3>
                        <div class="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px]">
                          <span class="px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700">
                            ${student.age ? `${student.age} yosh` : (student.birthDate ? formatDate(student.birthDate) : (currentClass?.name || 'Sinf'))}
                          </span>
                          ${(() => {
                            const contact = getStudentContactPhone(student);
                            if (!contact) return '';
                            return `
                              <div class="inline-flex items-center gap-1">
                                <span class="px-2 py-0.5 rounded-md font-mono ${contact.isParent ? 'bg-amber-50 text-amber-800 border border-amber-200/70' : 'bg-indigo-50 text-indigo-700'} font-medium flex items-center gap-1">
                                  ${contact.isParent ? `<span class="text-[9px] font-bold uppercase tracking-wider text-amber-600">${contact.label}:</span>` : ''}
                                  <span>${contact.number}</span>
                                </span>
                                <a 
                                  href="tel:${contact.number.replace(/[^0-9+]/g, '')}" 
                                  class="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 active:scale-95 transition-all" 
                                  title="${contact.label}ga qo'ng'iroq qilish"
                                  onclick="event.stopPropagation()"
                                >
                                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                  </svg>
                                </a>
                              </div>
                            `;
                          })()}
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-1 text-slate-400 shrink-0">
                      <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </div>
                `;
              }).join('')
            )}
          </div>

          <!-- Desktop Table Card (hidden on mobile) -->
          <div class="hidden md:flex flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex-col overflow-hidden min-h-[420px]">
            
            <!-- Table Header -->
            <div class="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3 shrink-0">
              <div class="flex items-center gap-3">
                <h2 class="text-xl font-bold text-slate-900">
                  ${currentClass?.name || 'Sinf'} Sinf o'quvchilari 
                  <span class="ml-2 text-sm font-normal text-slate-400">(${totalClassStudents} nafar)</span>
                </h2>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-semibold">
                  ${boyCount} O'g'il bolalar
                </span>
                <span class="px-3 py-1 bg-pink-50 text-pink-600 rounded-full font-semibold">
                  ${girlCount} Qiz bolalar
                </span>
              </div>
            </div>

            <!-- Table Body Container -->
            <div class="flex-1 overflow-auto">
              ${isCurrentlyLoading ? `
                <div class="p-4">
                  ${renderStudentTableSkeleton(7)}
                </div>
              ` : `
                <table class="w-full text-left border-collapse">
                  <thead class="sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th class="py-3.5 px-6 w-12 text-center">№</th>
                      <th class="py-3.5 px-6">F.I.SH</th>
                      <th class="py-3.5 px-6">Yoshi</th>
                      <th class="py-3.5 px-6">Tel. raqami</th>
                      <th class="py-3.5 px-6">PINFL (JShShIR)</th>
                      <th class="py-3.5 px-6 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50 text-sm">
                    ${students.length === 0 ? `
                      <tr>
                        <td colspan="6" class="py-16 text-center text-slate-400">
                          <div class="max-w-sm mx-auto space-y-3">
                            <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                              </svg>
                            </div>
                            <div class="text-sm font-semibold text-slate-700">
                              ${searchQuery || activeFilter !== 'all' 
                                ? `Tanlangan mezonlar bo'yicha o'quvchi topilmadi` 
                                : `Bu sinfga hali o'quvchilar qo'shilmagan`}
                            </div>
                            <p class="text-xs text-slate-400">
                              ${searchQuery || activeFilter !== 'all' 
                                ? `Iltimos, qidiruv matnini tekshiring yoki filtrni qayta sozlang.` 
                                : `Yuqoridagi "Yangi o'quvchi" tugmasini bosib birinchi o'quvchini kiriting.`}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ` : students.map((student, idx) => {
                      const isSelected = student.id === selectedStudentId;
                      const avatarLetter = (student.fullName || 'O').trim().charAt(0).toUpperCase();

                      return `
                        <tr 
                          data-student-id="${student.id}"
                          class="student-row hover:bg-slate-50/80 transition-colors group cursor-pointer ${isSelected ? 'bg-indigo-50/40' : ''}"
                        >
                          <td class="px-6 py-4 font-mono text-xs text-slate-400 text-center">${idx + 1}</td>
                          <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                              ${student.photo ? `
                                <img src="${student.photo}" alt="${student.fullName}" class="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
                              ` : `
                                <div class="w-9 h-9 rounded-full ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'} flex items-center justify-center text-xs font-bold shrink-0">
                                  ${avatarLetter}
                                </div>
                              `}
                              <div>
                                <div class="text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-900'}">${student.fullName}</div>
                                <div class="text-[10px] text-slate-400">${currentClass?.name || 'Sinf'} Sinf</div>
                              </div>
                            </div>
                          </td>
                          <td class="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                            ${student.age ? `${student.age} yosh` : (student.birthDate ? formatDate(student.birthDate) : '-')}
                          </td>
                          <td class="px-6 py-4 text-sm text-slate-600 whitespace-nowrap font-mono text-xs">
                            ${(() => {
                              const contact = getStudentContactPhone(student);
                              if (!contact) return '<span class="text-slate-300">-</span>';
                              return `
                                <div class="inline-flex items-center gap-1.5">
                                  ${contact.isParent ? `<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200/80">${contact.label}</span>` : ''}
                                  <a href="tel:${contact.number.replace(/[^0-9+]/g, '')}" class="text-indigo-600 hover:text-emerald-700 hover:underline transition-colors" onclick="event.stopPropagation()">${contact.number}</a>
                                  <a 
                                    href="tel:${contact.number.replace(/[^0-9+]/g, '')}" 
                                    class="p-1 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" 
                                    title="${contact.label}ga qo'ng'iroq qilish"
                                    onclick="event.stopPropagation()"
                                  >
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                    </svg>
                                  </a>
                                  <button 
                                    class="table-copy-phone-btn p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                    data-phone="${contact.number}"
                                    title="Telefon raqamidan nusxa olish"
                                    onclick="event.stopPropagation()"
                                  >
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                    </svg>
                                  </button>
                                </div>
                              `;
                            })()}
                          </td>
                          <td class="px-6 py-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                            ${student.pinfl || '<span class="text-slate-300">-</span>'}
                          </td>
                          <td class="px-6 py-4 text-right whitespace-nowrap space-x-1">
                            <button 
                              data-action="view" 
                              data-id="${student.id}"
                              class="action-btn p-2 rounded-lg transition-all shadow-xs border ${isSelected ? 'bg-white text-indigo-600 border-indigo-200' : 'text-slate-400 hover:text-indigo-600 hover:bg-white border-transparent hover:border-slate-200'} cursor-pointer"
                              title="O'quvchi dosyesini ochish"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                              </svg>
                            </button>
                            <button 
                              data-action="export" 
                              data-id="${student.id}"
                              class="action-btn p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                              title="O'quvchi ma'lumotlarini PDF yoki Excel formatida yuklab olish"
                            >
                              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                              </svg>
                            </button>
                            <button 
                              data-action="edit" 
                              data-id="${student.id}"
                              class="action-btn p-2 text-slate-400 hover:text-slate-700 hover:bg-white hover:border-slate-200 border border-transparent rounded-lg transition-all cursor-pointer"
                              title="Tahrirlash"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                              </svg>
                            </button>
                            <button 
                              data-action="delete" 
                              data-id="${student.id}"
                              class="action-btn p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="O'chirish"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              `}
            </div>

          </div>

          <!-- Right Inspector Card: Batafsil Ma'lumot (hidden on mobile, visible on desktop lg+) -->
          <div class="hidden lg:flex w-80 xl:w-88 bg-white rounded-3xl border border-slate-200 shadow-sm flex-col overflow-hidden shrink-0">
            
            <div class="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 class="font-bold text-slate-900 flex items-center gap-2">
                <span class="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                Batafsil Ma'lumot
              </h3>
              ${selectedStudent ? `
                <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${isFemaleStudent(selectedStudent) ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'}">
                  ${formatStudentGender(selectedStudent, true)}
                </span>
              ` : ''}
            </div>

            <div class="p-6 overflow-y-auto text-sm space-y-6 flex-1">
              ${selectedStudent ? `
                <!-- Avatar & Name -->
                <div class="flex flex-col items-center text-center">
                  <div class="w-24 h-24 rounded-2xl bg-slate-100 border-4 border-slate-50 shadow-inner flex items-center justify-center text-2xl font-bold text-slate-400 mb-3 overflow-hidden">
                    ${selectedStudent.photo ? `
                      <img src="${selectedStudent.photo}" alt="${selectedStudent.fullName}" class="w-full h-full object-cover" />
                    ` : `
                      <span>${(selectedStudent.fullName || 'O').trim().charAt(0).toUpperCase()}</span>
                    `}
                  </div>
                  <h4 class="font-bold text-slate-900 text-base leading-snug">${selectedStudent.fullName}</h4>
                  <p class="text-xs text-slate-400 mt-0.5">${currentClass.name} Sinf | ${selectedStudent.age ? `${selectedStudent.age} yosh` : ''}</p>
                </div>

                <!-- Info Cards -->
                <div class="space-y-3.5">
                  <div class="p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                    <div class="text-[10px] text-slate-400 uppercase tracking-wide font-bold mb-1">PINFL (JShShIR)</div>
                    <div class="font-mono font-bold text-slate-700 tracking-wider text-xs">
                      ${selectedStudent.pinfl || "Kiritilmagan"}
                    </div>
                  </div>

                  <div>
                    <div class="text-[10px] text-slate-400 uppercase tracking-wide font-bold mb-1">Tug'ilgan sanasi / Joyi</div>
                    <div class="text-xs font-semibold text-slate-700">
                      ${formatDate(selectedStudent.birthDate)} ${selectedStudent.birthPlace ? `/ ${selectedStudent.birthPlace}` : ''}
                    </div>
                  </div>

                  <div>
                    <div class="text-[10px] text-slate-400 uppercase tracking-wide font-bold mb-1">Passport / ID karta</div>
                    <div class="text-xs font-semibold text-slate-700 font-mono">
                      ${selectedStudent.passportNumber || selectedStudent.guvohnomaSeriaNumber || "Mavjud emas"}
                    </div>
                  </div>

                  <div>
                    <div class="text-[10px] text-slate-400 uppercase tracking-wide font-bold mb-1">O'quvchi telefoni</div>
                    <div class="text-xs font-semibold text-slate-700 font-mono">
                      ${selectedStudent.phone ? `
                        <div class="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                          <a href="tel:${selectedStudent.phone.replace(/[^0-9+]/g, '')}" class="text-indigo-600 hover:text-emerald-600 hover:underline font-mono">${selectedStudent.phone}</a>
                          <a href="tel:${selectedStudent.phone.replace(/[^0-9+]/g, '')}" class="p-1 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" title="Qo'ng'iroq qilish">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                            </svg>
                          </a>
                        </div>
                      ` : "Kiritilmagan"}
                    </div>
                  </div>

                  <!-- Parents Info -->
                  <div class="pt-4 border-t border-slate-100">
                    <div class="text-[10px] text-indigo-600 uppercase tracking-wide font-bold mb-2.5">Ota-ona ma'lumotlari</div>
                    <div class="space-y-2.5 text-xs">
                      <div>
                        <div class="flex items-center gap-1.5 mb-1">
                          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">Otasi:</span>
                          <span class="font-medium text-slate-800">${selectedStudent.fatherFullName || "Ko'rsatilmagan"}</span>
                        </div>
                        <div class="text-slate-600 font-mono mt-0.5">
                          ${selectedStudent.fatherPhone ? `
                            <div class="flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70 mt-1">
                              <a href="tel:${selectedStudent.fatherPhone.replace(/[^0-9+]/g, '')}" class="text-blue-700 hover:text-emerald-600 hover:underline">${selectedStudent.fatherPhone}</a>
                              <a href="tel:${selectedStudent.fatherPhone.replace(/[^0-9+]/g, '')}" class="p-1 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" title="Otasiga qo'ng'iroq qilish">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                </svg>
                              </a>
                            </div>
                          ` : "-"}
                        </div>
                      </div>
                      <div>
                        <div class="flex items-center gap-1.5 mb-1">
                          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-100">Onasi:</span>
                          <span class="font-medium text-slate-800">${selectedStudent.motherFullName || "Ko'rsatilmagan"}</span>
                        </div>
                        <div class="text-slate-600 font-mono mt-0.5">
                          ${selectedStudent.motherPhone ? `
                            <div class="flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70 mt-1">
                              <a href="tel:${selectedStudent.motherPhone.replace(/[^0-9+]/g, '')}" class="text-pink-700 hover:text-emerald-600 hover:underline">${selectedStudent.motherPhone}</a>
                              <a href="tel:${selectedStudent.motherPhone.replace(/[^0-9+]/g, '')}" class="p-1 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" title="Onasiga qo'ng'iroq qilish">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                </svg>
                              </a>
                            </div>
                          ` : "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Primary View Dossier & Export Buttons -->
                <div class="flex items-center gap-2">
                  <button 
                    id="inspect-view-dossier-btn"
                    class="flex-1 py-3 bg-slate-50 text-slate-700 rounded-xl text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200 cursor-pointer shadow-2xs text-center"
                  >
                    Barcha 24 ta maydon (Batafsil ko'rish)
                  </button>
                  <button 
                    id="inspect-export-btn"
                    class="py-3 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all border border-emerald-200 cursor-pointer shadow-2xs flex items-center gap-1.5"
                    title="O'quvchi ma'lumotlarini PDF yoki Excel yuklab olish"
                  >
                    <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span>Eksport</span>
                  </button>
                </div>
              ` : `
                <div class="h-64 flex flex-col items-center justify-center text-center text-slate-400">
                  <svg class="w-12 h-12 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <p class="text-xs font-medium">Batafsil ma'lumotni ko'rish uchun jadvaldan o'quvchini tanlang</p>
                </div>
              `}
            </div>

          </div>

        </div>

      </div>
    `;

    // Reattach listeners
    const refreshBtn = container.querySelector('#teacher-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        isInternalLoading = true;
        render();
        if (onRefreshData) {
          Promise.resolve(onRefreshData()).finally(() => {
            setTimeout(() => {
              isInternalLoading = false;
              render();
            }, 400);
          });
        } else {
          setTimeout(() => {
            isInternalLoading = false;
            render();
          }, 600);
        }
      });
    }

    // Filter chips click
    container.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const filter = chip.getAttribute('data-filter');
        if (filter) {
          activeFilter = filter;
          render();
        }
      });
    });

    const resetFilterBtn = container.querySelector('#reset-filters-btn');
    if (resetFilterBtn) {
      resetFilterBtn.addEventListener('click', () => {
        searchQuery = '';
        activeFilter = 'all';
        render();
      });
    }

    const changeCredBtn = container.querySelector('#teacher-change-credentials-btn');
    if (changeCredBtn && onChangeCredentials) {
      changeCredBtn.addEventListener('click', onChangeCredentials);
    }

    const platformsBtn = container.querySelector('#teacher-platforms-btn');
    if (platformsBtn && onManagePlatforms) {
      platformsBtn.addEventListener('click', onManagePlatforms);
    }

    const attendanceBtn = container.querySelector('#teacher-attendance-btn');
    if (attendanceBtn) {
      attendanceBtn.addEventListener('click', () => {
        if (onOpenAttendance) onOpenAttendance();
      });
    }

    const dutyTeacherBanner = container.querySelector('#duty-teacher-banner');
    if (dutyTeacherBanner && onOpenAttendance && isDutyToday) {
      dutyTeacherBanner.addEventListener('click', onOpenAttendance);
    }

    const bannerAttendanceBtn = container.querySelector('#banner-open-attendance-btn');
    if (bannerAttendanceBtn && onOpenAttendance && isDutyToday) {
      bannerAttendanceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onOpenAttendance();
      });
    }

    const bannerReportAbsenceBtn = container.querySelector('#banner-report-duty-absence-btn');
    if (bannerReportAbsenceBtn) {
      bannerReportAbsenceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTeacherDutyAbsenceModal();
      });
    }

    const bannerChangeCredBtn = container.querySelector('#banner-change-cred-btn');
    if (bannerChangeCredBtn && onChangeCredentials) {
      bannerChangeCredBtn.addEventListener('click', onChangeCredentials);
    }

    const addBtn = container.querySelector('#open-add-student-btn');
    if (addBtn) addBtn.addEventListener('click', onAddStudent);

    const exportBtn = container.querySelector('#export-list-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        if (onExportList) onExportList(students);
        else if (onExportCSV) onExportCSV(students);
      });
    }

    const mobileExportBtn = container.querySelector('#mobile-export-btn');
    if (mobileExportBtn) {
      mobileExportBtn.addEventListener('click', () => {
        if (onExportList) onExportList(students);
        else if (onExportCSV) onExportCSV(students);
      });
    }

    const searchInput = container.querySelector('#student-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const cursorPosition = e.target.selectionStart ?? e.target.value.length;
        searchQuery = e.target.value;
        render();
        const newSearchInput = container.querySelector('#student-search-input');
        if (newSearchInput) {
          newSearchInput.focus();
          const pos = Math.min(cursorPosition, newSearchInput.value.length);
          newSearchInput.setSelectionRange(pos, pos);
        }
      });
    }

    const clearBtn = container.querySelector('#clear-search-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchQuery = '';
        render();
      });
    }

    // Copy phone buttons in table
    container.querySelectorAll('.table-copy-phone-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const phone = btn.getAttribute('data-phone');
        if (phone && navigator.clipboard) {
          navigator.clipboard.writeText(phone);
          const origHtml = btn.innerHTML;
          btn.innerHTML = `
            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          `;
          setTimeout(() => {
            btn.innerHTML = origHtml;
          }, 1500);
        }
      });
    });

    // Mobile student cards tap listener -> directly opens student detail page
    container.querySelectorAll('.mobile-student-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-student-id');
        if (id) {
          onViewStudent(id);
        }
      });
    });

    // Row selection listener
    container.querySelectorAll('.student-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // If clicking action buttons, don't trigger row selection
        if (e.target.closest('.action-btn')) return;
        const id = row.getAttribute('data-student-id');
        if (id) {
          selectedStudentId = id;
          render();
        }
      });
    });

    // Action buttons inside table
    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const studentId = btn.getAttribute('data-id');
        if (action === 'view') onViewStudent(studentId);
        if (action === 'export' && onExportSingleStudent) onExportSingleStudent(studentId);
        if (action === 'edit') onEditStudent(studentId);
        if (action === 'delete') onDeleteStudent(studentId);
      });
    });

    // View full dossier or export from inspect panel
    const viewDossierBtn = container.querySelector('#inspect-view-dossier-btn');
    if (viewDossierBtn && selectedStudent) {
      viewDossierBtn.addEventListener('click', () => {
        onViewStudent(selectedStudent.id);
      });
    }

    const inspectExportBtn = container.querySelector('#inspect-export-btn');
    if (inspectExportBtn && selectedStudent && onExportSingleStudent) {
      inspectExportBtn.addEventListener('click', () => {
        onExportSingleStudent(selectedStudent.id);
      });
    }
  }

  // Navbatchilikka kela olmaslik sababini qoldirish modali
  function openTeacherDutyAbsenceModal() {
    const modalId = 'teacher-duty-absence-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const dutyInfo = getTodayDutyInfoForTeacher(currentClass, state);
    const targetShift = dutyInfo.dutyShifts[0]?.shift || (dutyInfo.dutyShifts[0]?.shiftId ? (state.shifts || []).find(s => s.id === dutyInfo.dutyShifts[0].shiftId) : null) || (state.shifts || []).find(s => s.schoolId === currentClass?.schoolId);

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 sm:p-6 animate-scale-in">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xl">
              ⚠️
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">
                Navbatchilikka Kela Olmaslik Sababini Qoldirish
              </h3>
              <p class="text-xs text-slate-500">${targetShift?.name || 'Smena'} • ${formatReadableDate(getTodayISODate())}</p>
            </div>
          </div>
          <button id="close-teacher-absence-btn" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer">
            ✕
          </button>
        </div>

        <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl mb-4 text-xs text-amber-900 leading-relaxed">
          <p class="font-bold mb-1">Muhim tartib:</p>
          Kelolmaslik sababini yozib qoldirganingizdan so'ng, tizim tartib bilan keyingi sinf rahbarini avtomatik navbatchi etib tayinlaydi 
          va bu haqda Maktab Ma'muriyati (Admin)ga xabarnoma yetkazadi.
        </div>

        <!-- Tezkor sabablar (Quick chips) -->
        <div class="mb-3">
          <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Tezkor sabab tanlash:
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" class="btn-quick-teacher-reason px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-amber-100 text-slate-800 border border-slate-200 cursor-pointer transition-colors" data-reason="Salomatligim yomonlashdi / Shifoxonadaman">
              🩺 Salomatligim yomonlashdi
            </button>
            <button type="button" class="btn-quick-teacher-reason px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-amber-100 text-slate-800 border border-slate-200 cursor-pointer transition-colors" data-reason="Oila a'zosi betobligi tufayli">
              👨‍👩‍👧 Oila a'zosi betobligi
            </button>
            <button type="button" class="btn-quick-teacher-reason px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-amber-100 text-slate-800 border border-slate-200 cursor-pointer transition-colors" data-reason="Transport nosozligi / Yo'ldaman">
              🚗 Transport / Yo'ldaman
            </button>
            <button type="button" class="btn-quick-teacher-reason px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-amber-100 text-slate-800 border border-slate-200 cursor-pointer transition-colors" data-reason="Shaxsiy uzrli holat tufayli">
              📑 Shaxsiy uzrli holat
            </button>
          </div>
        </div>

        <div class="mb-5">
          <label class="block text-xs font-bold text-slate-700 mb-1">
            Kelolmaslik sababini yozing:
          </label>
          <textarea 
            id="teacher-duty-absence-textarea" 
            rows="3" 
            placeholder="Kela olmaslik sababini qisqa va aniq yozing..." 
            class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-2.5">
          <button 
            type="button" 
            id="cancel-teacher-absence-btn" 
            class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
          >
            Bekor qilish
          </button>
          <button 
            type="button" 
            id="submit-teacher-absence-btn" 
            class="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <span>⚡ Sababni yuborish & Navbatchilikni topshirish</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const textarea = div.querySelector('#teacher-duty-absence-textarea');
    div.querySelectorAll('.btn-quick-teacher-reason').forEach(btn => {
      btn.addEventListener('click', () => {
        if (textarea) {
          textarea.value = btn.getAttribute('data-reason');
          textarea.focus();
        }
      });
    });

    const closeModal = () => div.remove();
    div.querySelector('#close-teacher-absence-btn')?.addEventListener('click', closeModal);
    div.querySelector('#cancel-teacher-absence-btn')?.addEventListener('click', closeModal);

    div.querySelector('#submit-teacher-absence-btn')?.addEventListener('click', () => {
      const reasonVal = (textarea?.value || '').trim();
      if (!reasonVal) {
        alert("Iltimos, kela olmaslik sababini yozing");
        return;
      }

      const res = recordDutyAbsenceAndDelegate({
        schoolId: currentClass.schoolId,
        shiftId: targetShift?.id,
        reason: reasonVal,
        state,
        onSaveRoster: (updatedRoster) => {
          saveDutyRosterToFirestore(updatedRoster);
        }
      });

      if (res) {
        if (res.dutyAbsence) {
          saveDutyAbsenceToFirestore(res.dutyAbsence);
        }
        if (res.notification) {
          saveAdminNotificationToFirestore(res.notification);
        }
        saveData(state);
        closeModal();
        render();
      }
    });
  }

  render();
}
