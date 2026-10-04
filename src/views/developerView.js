/**
 * Dasturchi Boshqaruv Paneli (Ixcham, Sodda va Tezkor)
 * - Faqat lavozimi va ism-familiyasi ko'rinadi (batafsil ma'lumotlar bosilganda alohida sahifada ochiladi)
 * - Sodda va ixcham filtrlar: A-Z, Admin, O'qituvchi, O'quvchi
 * - Uzoq scroll bo'lmasligi uchun ixcham qatorlar va sahifalash (pagination)
 * - Skeleton loader animatsiyasi
 */

import { renderListSkeleton } from '../components/skeletonLoaders.js';
import { getStudentPlatformCred, DEFAULT_PLATFORMS, compareClassNames } from '../data.js';
import { exportPlatformCredentialsToExcel } from '../utils/exportUtils.js';
import { 
  calculateStorageMetrics, 
  renderStorageMiniWidget, 
  renderDetailedStorageView, 
  attachStorageCalculatorEvents 
} from './developerStorageView.js';

export function renderDeveloper(container, {
  state,
  isLoading = false,
  onRefreshData,
  onAddAdmin,
  onEditAdmin,
  onDeleteAdmin,
  onViewAdmin,
  onViewTeacher,
  onViewStudent,
  onSaveDeveloperProfile,
  onSaveDeveloperCredentials,
  onSaveSiteInfo,
  onSaveDeveloperPin,
  onRemoveDeveloperPin,
  onApproveRecoveryRequest,
  onRejectRecoveryRequest,
  onDeleteRecoveryRequest,
  initialTab = 'users',
  showToast
}) {
  let activeTab = initialTab; // 'users' | 'schools' | 'platforms' | 'storage' | 'settings' | 'requests'
  let sortFilter = 'all_az'; // 'all_az' | 'admins' | 'teachers' | 'students'
  let searchQuery = '';
  let platformSchoolFilter = 'all';
  let platformClassFilter = 'all';
  let platformTypeFilter = 'all';
  let visiblePasswords = new Set();
  let showAllPasswords = false;
  let currentPage = 1;
  const pageSize = 20;
  let isInternalLoading = false;

  function renderContent() {
    const storageMetrics = calculateStorageMetrics(state);
    const totalSchools = state.schools.length;
    const totalClasses = state.classes.length;
    const totalStudents = state.students.length;
    const totalAllUsers = totalSchools + totalClasses + totalStudents;

    const allRequests = state.recoveryRequests || [];
    const recoveredCount = allRequests.filter(r => r.status === 'recovered' || r.type === 'account_recovered').length;
    const pendingRequestsCount = allRequests.filter(r => r.status === 'pending').length;
    const totalRequests = allRequests.length;

    // 1. Admin foydalanuvchilar
    const adminUsers = state.schools.map((school, index) => ({
      id: school.id,
      type: 'admin',
      roleLabel: 'Admin',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
      name: school.adminName || school.name || 'Maktab Admini',
      schoolName: school.name,
      login: school.login,
      password: school.password,
      pinCode: school.pinCode || '',
      createdAt: school.createdAt || (Date.now() - (state.schools.length - index) * 100000)
    }));

    // 2. O'qituvchilar (Sinf rahbarlari)
    const teacherUsers = state.classes.map((cls, index) => {
      const sch = state.schools.find(s => s.id === cls.schoolId);
      return {
        id: cls.id,
        type: 'teacher',
        roleLabel: "O'qituvchi",
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
        name: cls.teacherName || "Sinf Rahbari",
        className: cls.name,
        schoolName: sch ? sch.name : '',
        login: cls.login,
        password: cls.password,
        pinCode: cls.pinCode || '',
        createdAt: cls.createdAt || (Date.now() - (state.classes.length - index) * 50000)
      };
    });

    // 3. O'quvchilar
    const studentUsers = state.students.map((std, index) => {
      const cls = state.classes.find(c => c.id === std.classId);
      const sch = state.schools.find(s => s.id === (cls ? cls.schoolId : std.schoolId));
      return {
        id: std.id,
        type: 'student',
        roleLabel: "O'quvchi",
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        name: std.fullName || `${std.lastName || ''} ${std.firstName || ''}`.trim() || "O'quvchi",
        className: cls ? cls.name : (std.className || ''),
        schoolName: sch ? sch.name : '',
        createdAt: std.createdAt || (Date.now() - (state.students.length - index) * 10000)
      };
    });

    // Saralash va Filtrlash (A-Z, Admin, O'qituvchi, O'quvchi)
    let processedUsers = [];
    if (sortFilter === 'all_az') {
      processedUsers = [...adminUsers, ...teacherUsers, ...studentUsers].sort((a, b) => 
        (a.name || '').localeCompare(b.name || '', 'uz', { sensitivity: 'base' })
      );
    } else if (sortFilter === 'admins') {
      processedUsers = [...adminUsers].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (sortFilter === 'teachers') {
      processedUsers = [...teacherUsers].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (sortFilter === 'students') {
      processedUsers = [...studentUsers].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    // Tezkor qidiruv
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      processedUsers = processedUsers.filter(u => 
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.roleLabel && u.roleLabel.toLowerCase().includes(query)) ||
        (u.schoolName && u.schoolName.toLowerCase().includes(query)) ||
        (u.className && u.className.toLowerCase().includes(query)) ||
        (u.pinCode && u.pinCode.includes(query)) ||
        (u.login && u.login.toLowerCase().includes(query))
      );
    }

    // Sahifalash (Pagination) - scrollni oldini olish uchun
    const totalUsersCount = processedUsers.length;
    const totalPages = Math.ceil(totalUsersCount / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const paginatedUsers = processedUsers.slice(startIndex, startIndex + pageSize);

    // Maktablar ro'yxati (Maktablar tabida)
    const filteredSchools = state.schools.filter(school => {
      if (!query) return true;
      return (
        (school.name && school.name.toLowerCase().includes(query)) ||
        (school.adminName && school.adminName.toLowerCase().includes(query)) ||
        (school.adminPhone && school.adminPhone.includes(query)) ||
        (school.login && school.login.toLowerCase().includes(query))
      );
    });

    // Ta'lim platformalari (Dasturchi uchun butun tizim bo'yicha)
    const allPlatformRecords = [];
    const allUniquePlatformsMap = new Map();

    state.classes.forEach(c => {
      const cPlats = (Array.isArray(c.platforms) && c.platforms.length > 0) ? c.platforms : DEFAULT_PLATFORMS;
      cPlats.forEach(p => {
        if (p && p.id && !allUniquePlatformsMap.has(p.id)) {
          allUniquePlatformsMap.set(p.id, p);
        }
      });
    });
    if (allUniquePlatformsMap.size === 0) {
      DEFAULT_PLATFORMS.forEach(p => allUniquePlatformsMap.set(p.id, p));
    }
    const allPlatformsList = Array.from(allUniquePlatformsMap.values());

    state.students.forEach(s => {
      const cls = state.classes.find(c => c.id === s.classId);
      const school = state.schools.find(sch => sch.id === (cls?.schoolId || s.schoolId));
      const schoolName = school ? school.name : "Maktab";
      const className = cls ? cls.name : (s.className || '-');
      const classPlats = (cls && Array.isArray(cls.platforms) && cls.platforms.length > 0)
        ? cls.platforms
        : allPlatformsList;

      classPlats.forEach(plat => {
        const cred = getStudentPlatformCred(s, plat);
        const key = `${s.id}_${plat.id}`;
        allPlatformRecords.push({
          key,
          studentId: s.id,
          studentName: s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim() || "O'quvchi",
          studentGender: s.gender,
          studentPhone: s.phone,
          schoolId: school?.id || s.schoolId,
          schoolName,
          classId: s.classId,
          className,
          platformId: plat.id,
          platformName: plat.name,
          platformUrl: plat.url,
          platformColor: plat.color || 'purple',
          login: cred.login,
          password: cred.password
        });
      });
    });

    let filteredPlatformRecords = allPlatformRecords.filter(rec => {
      if (platformSchoolFilter !== 'all' && rec.schoolId !== platformSchoolFilter) return false;
      if (platformClassFilter !== 'all' && rec.classId !== platformClassFilter) return false;
      if (platformTypeFilter !== 'all' && rec.platformId !== platformTypeFilter) return false;
      if (!query) return true;
      return (
        rec.studentName.toLowerCase().includes(query) ||
        rec.schoolName.toLowerCase().includes(query) ||
        rec.className.toLowerCase().includes(query) ||
        rec.platformName.toLowerCase().includes(query) ||
        (rec.login && rec.login.toLowerCase().includes(query))
      );
    });

    filteredPlatformRecords.sort((a, b) => {
      const schCmp = (a.schoolName || '').localeCompare(b.schoolName || '', 'uz');
      if (schCmp !== 0) return schCmp;
      const clsCmp = (a.className || '').localeCompare(b.className || '', 'uz');
      if (clsCmp !== 0) return clsCmp;
      return (a.studentName || '').localeCompare(b.studentName || '', 'uz');
    });

    const totalPlatformsCount = filteredPlatformRecords.length;
    const totalPlatformPages = Math.ceil(totalPlatformsCount / pageSize) || 1;
    let platformCurrentPage = currentPage;
    if (platformCurrentPage > totalPlatformPages) platformCurrentPage = totalPlatformPages;
    if (platformCurrentPage < 1) platformCurrentPage = 1;
    const platformStartIndex = (platformCurrentPage - 1) * pageSize;
    const paginatedPlatforms = filteredPlatformRecords.slice(platformStartIndex, platformStartIndex + pageSize);

    container.innerHTML = `
      <div class="space-y-4 pb-20 max-w-5xl mx-auto">
        
        <!-- Yangilangan Chiroyli va Zamonaviy Bosh Qism (Header) -->
        <div class="bg-white px-3.5 py-3 sm:px-5 sm:py-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <img 
              src="/maktabx-logo.png" 
              alt="MaktabX Logo" 
              class="w-10 h-10 sm:w-11 sm:h-11 object-contain shrink-0 drop-shadow-xs" 
              referrerPolicy="no-referrer"
            />
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h1 class="text-base sm:text-lg font-bold text-slate-900 leading-tight">Maktab<span class="text-blue-600">X</span> Dasturchi</h1>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80 shadow-2xs">
                  <svg class="w-3 h-3 text-purple-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                  </svg>
                  <span>Dasturchi</span>
                </span>
              </div>

              <!-- Ixcham va chiroyli iconli statistika nishonlari (Mobilda qisqa, toza va sig'adigan) -->
              <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold" title="Dasturchi muallif">
                  <svg class="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <span class="truncate max-w-[120px] sm:max-w-none">${state.developer?.name || "Dasturchi"}</span>
                </span>

                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100/80" title="Jami barcha foydalanuvchilar: ${totalAllUsers}">
                  <svg class="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                  </svg>
                  <span class="hidden sm:inline font-normal text-[11px] opacity-75">Jami:</span>
                  <span>${totalAllUsers}</span>
                </span>

                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-bold border border-purple-100/80" title="Maktab adminlari soni: ${totalSchools}">
                  <svg class="w-3.5 h-3.5 text-purple-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                  <span class="hidden sm:inline font-normal text-[11px] opacity-75">Admin:</span>
                  <span>${totalSchools}</span>
                </span>

                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100/80" title="Sinf rahbarlari / O'qituvchilar soni: ${totalClasses}">
                  <svg class="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                  </svg>
                  <span class="hidden sm:inline font-normal text-[11px] opacity-75">O'qituvchi:</span>
                  <span>${totalClasses}</span>
                </span>

                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100/80" title="O'quvchilar soni: ${totalStudents}">
                  <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                  <span class="hidden sm:inline font-normal text-[11px] opacity-75">O'quvchi:</span>
                  <span>${totalStudents}</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Tezkor Amallar: Yangilash va Yangi maktab qo'shish -->
          <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button 
              id="dev-refresh-btn"
              class="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 active:scale-95 text-slate-700 text-xs font-semibold border border-slate-200/80 transition-all cursor-pointer shrink-0"
              title="Ma'lumotlarni qayta yangilash"
              aria-label="Yangilash"
            >
              <svg class="w-4 h-4 text-indigo-600 shrink-0 ${isInternalLoading ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <span class="hidden sm:inline">Yangilash</span>
            </button>

            <button 
              id="open-add-admin-btn"
              class="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
              title="Yangi maktab va admin qo'shish"
              aria-label="Yangi maktab qo'shish"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
              </svg>
              <span class="hidden sm:inline">Maktab qo'shish</span>
            </button>
          </div>
        </div>

        <!-- Aqlli Xotira & Sig'im Holati Mini Vidjeti (1 GB Bepul kvota ko'rsatkichi) -->
        ${renderStorageMiniWidget(storageMetrics)}

        <!-- Asosiy Navigatsiya Tablari (Mobil uchun qulay gorizontal menyu) -->
        <div class="bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div class="flex items-center gap-1 overflow-x-auto scrollbar-none">
            
            <button 
              id="tab-users-btn"
              class="flex-1 min-w-[70px] sm:min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'users' 
                  ? 'bg-indigo-50 text-indigo-700 shadow-2xs ring-1 ring-indigo-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }"
              title="Foydalanuvchilar (${totalAllUsers})"
            >
              <svg class="w-4 h-4 shrink-0 ${activeTab === 'users' ? 'text-indigo-600' : 'text-slate-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
              <span class="hidden sm:inline">Foydalanuvchilar</span>
              <span class="px-1.5 py-0.2 rounded-md text-[11px] font-mono leading-tight ${
                activeTab === 'users' ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-200/80 text-slate-600'
              }">${totalAllUsers}</span>
            </button>

            <button 
              id="tab-schools-btn"
              class="flex-1 min-w-[70px] sm:min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'schools' 
                  ? 'bg-indigo-50 text-indigo-700 shadow-2xs ring-1 ring-indigo-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }"
              title="Maktablar (${totalSchools})"
            >
              <svg class="w-4 h-4 shrink-0 ${activeTab === 'schools' ? 'text-indigo-600' : 'text-slate-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              <span class="hidden sm:inline">Maktablar</span>
              <span class="px-1.5 py-0.2 rounded-md text-[11px] font-mono leading-tight ${
                activeTab === 'schools' ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-200/80 text-slate-600'
              }">${totalSchools}</span>
            </button>

            <!-- Ta'lim platformalari tabi (Dasturchi uchun) -->
            <button 
              id="tab-platforms-btn"
              class="flex-1 min-w-[70px] sm:min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'platforms' 
                  ? 'bg-purple-50 text-purple-700 shadow-2xs ring-1 ring-purple-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }"
              title="O'quvchilar ta'lim platformalari, login va parollari (${allPlatformRecords.length})"
            >
              <svg class="w-4 h-4 shrink-0 ${activeTab === 'platforms' ? 'text-purple-600' : 'text-slate-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
              <span class="hidden sm:inline">Platformalar</span>
              <span class="px-1.5 py-0.2 rounded-md text-[11px] font-mono leading-tight ${
                activeTab === 'platforms' ? 'bg-purple-100 text-purple-800 font-bold' : 'bg-slate-200/80 text-slate-600'
              }">${allPlatformRecords.length}</span>
            </button>

            <!-- Yangi Tab: Aqlli Xotira & Sig'im (1 GB Bepul kvota) -->
            <button 
              id="tab-storage-btn"
              class="flex-1 min-w-[70px] sm:min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'storage' 
                  ? 'bg-emerald-50 text-emerald-700 shadow-2xs ring-1 ring-emerald-300' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }"
              title="1 GB Bepul Xotira & Sig'im Tahlili (${storageMetrics.usedMB} MB / 1,024 MB)"
            >
              <svg class="w-4 h-4 shrink-0 ${activeTab === 'storage' ? 'text-emerald-600' : 'text-slate-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
              </svg>
              <span class="hidden sm:inline">Aqlli Xotira</span>
              <span class="px-1.5 py-0.2 rounded-md text-[10px] font-mono leading-tight ${
                activeTab === 'storage' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-slate-200/80 text-slate-600'
              }">1GB</span>
            </button>

            <button 
              id="tab-settings-btn"
              class="flex-1 min-w-[50px] sm:min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'settings' 
                  ? 'bg-indigo-50 text-indigo-700 shadow-2xs ring-1 ring-indigo-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }"
              title="Sayt va Dasturchi sozlamalari, login va parol"
            >
              <svg class="w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-amber-500' : 'text-slate-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span class="hidden sm:inline">Sozlamalar</span>
            </button>

            <button 
              id="tab-requests-btn"
              class="flex-1 min-w-[50px] sm:min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'requests' 
                  ? 'bg-indigo-50 text-indigo-700 shadow-2xs ring-1 ring-indigo-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }"
              title="Tiklashlar va so'rovlar (${totalRequests} ta)"
            >
              <svg class="w-4 h-4 shrink-0 ${activeTab === 'requests' ? 'text-emerald-600' : 'text-slate-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
              </svg>
              <span class="hidden sm:inline">Tiklashlar & So'rovlar</span>
              ${recoveredCount > 0 ? `
                <span class="px-1.5 py-0.2 rounded-md text-[10px] font-mono leading-tight bg-emerald-600 text-white font-bold" title="${recoveredCount} ta hisob muvaffaqiyatli tiklangan">
                  ✓ ${recoveredCount}
                </span>
              ` : pendingRequestsCount > 0 ? `
                <span class="px-1.5 py-0.2 rounded-md text-[10px] font-mono leading-tight bg-amber-500 text-white font-bold animate-pulse">
                  ${pendingRequestsCount}
                </span>
              ` : `
                <span class="px-1.5 py-0.2 rounded-md text-[11px] font-mono leading-tight ${
                  activeTab === 'requests' ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-200/80 text-slate-600'
                }">${totalRequests}</span>
              `}
            </button>
          </div>
        </div>

        <!-- 1-TAB: FOYDALANUVCHILAR (Chiroyli iconli filtrlar) -->
        ${activeTab === 'users' ? `
          
          <!-- Chiroyli Iconli Filtrlar va Qidiruv Qatori -->
          <div class="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            
            <!-- Chiroyli Iconli Saralash va Rol Filtr Tugmalari -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 md:pb-0 scrollbar-none">
              
              <!-- A-Z Saralash -->
              <button 
                class="sort-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  sortFilter === 'all_az'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }"
                data-filter="all_az"
                title="Barchasi alifbo tartibida (A-Z)"
              >
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/>
                </svg>
                <span>A-Z</span>
              </button>

              <!-- Faqat Adminlar -->
              <button 
                class="sort-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  sortFilter === 'admins'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100/80 border border-purple-200/60'
                }"
                data-filter="admins"
                title="Faqat maktab adminlari"
              >
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                <span class="hidden sm:inline">Admin</span>
                <span class="opacity-80 font-mono text-[11px]">(${totalSchools})</span>
              </button>

              <!-- Faqat Sinf Rahbarlari -->
              <button 
                class="sort-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  sortFilter === 'teachers'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100/80 border border-blue-200/60'
                }"
                data-filter="teachers"
                title="Faqat sinf rahbarlari"
              >
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                </svg>
                <span class="hidden sm:inline">O'qituvchi</span>
                <span class="opacity-80 font-mono text-[11px]">(${totalClasses})</span>
              </button>

              <!-- Faqat O'quvchilar -->
              <button 
                class="sort-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  sortFilter === 'students'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-200/60'
                }"
                data-filter="students"
                title="Faqat o'quvchilar"
              >
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                <span class="hidden sm:inline">O'quvchi</span>
                <span class="opacity-80 font-mono text-[11px]">(${totalStudents})</span>
              </button>

            </div>

            <!-- Ixcham Qidiruv Maydoni -->
            <div class="relative min-w-[240px] md:w-64 shrink-0">
              <input 
                type="text" 
                id="user-search-input"
                value="${searchQuery}" 
                placeholder="Ism, login, maktab bo'yicha..." 
                class="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
              />
              <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              ${searchQuery ? `
                <button id="clear-search-btn" class="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs p-0.5">
                  ✕
                </button>
              ` : ''}
            </div>

          </div>

          <!-- Foydalanuvchilar Ro'yxati (Faqat Lavozimi va Ism-Familiyasi) -->
          <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            
            ${(isLoading || isInternalLoading) ? `
              <div class="p-4">
                ${renderListSkeleton(7)}
              </div>
            ` : totalUsersCount === 0 ? `
              <div class="py-12 text-center text-slate-400 text-xs space-y-1">
                <div class="text-2xl">🔍</div>
                <div class="font-semibold text-slate-600">Foydalanuvchi topilmadi</div>
                <div class="text-slate-400">Boshqa filtr yoki qidiruv so'zini sinab ko'ring</div>
              </div>
            ` : `
              <div class="divide-y divide-slate-100">
                ${paginatedUsers.map((user, idx) => {
                  return `
                    <div 
                      class="user-row px-4 py-2.5 sm:px-5 sm:py-3 hover:bg-slate-50/90 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                      data-type="${user.type}" 
                      data-id="${user.id}"
                      title="Batafsil ma'lumotlarni ko'rish uchun bosing"
                    >
                      <!-- Lavozimi va Ism-Familiyasi -->
                      <div class="flex items-center gap-3 min-w-0">
                        <span class="font-mono text-xs text-slate-300 w-5 shrink-0 select-none text-right hidden sm:inline">
                          ${startIndex + idx + 1}
                        </span>

                        <!-- Lavozimi (Admin, O'qituvchi, O'quvchi) -->
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold border shrink-0 ${user.badgeClass}">
                          ${user.roleLabel}
                        </span>

                        <!-- Ism Familiyasi -->
                        <div class="min-w-0">
                          <span class="font-semibold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors truncate block">
                            ${user.name}
                          </span>
                        </div>
                      </div>

                      <!-- O'ng tomonda PIN-kod va ochish belgisi -->
                      <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                        ${user.pinCode ? `
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-xs font-bold shrink-0" title="Kabinet PIN-kodi: ${user.pinCode}">
                            <svg class="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                            <span>PIN: ${user.pinCode}</span>
                          </span>
                        ` : (user.type === 'teacher' || user.type === 'admin') ? `
                          <span class="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] text-slate-400 font-mono shrink-0" title="PIN-kod o'rnatilmagan">
                            PIN: —
                          </span>
                        ` : ''}

                        <div class="flex items-center gap-1 text-slate-400 group-hover:text-indigo-600 transition-colors">
                          <span class="text-xs font-medium hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity">
                            Batafsil
                          </span>
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                          </svg>
                        </div>
                      </div>

                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Sahifalash (Pagination) - qisqa, sodda, uzoq scrollni yo'qotadi -->
              ${totalPages > 1 ? `
                <div class="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div class="text-slate-500 font-medium">
                    <span>${startIndex + 1}–${Math.min(startIndex + pageSize, totalUsersCount)}</span> dan 
                    <strong class="text-slate-800">${totalUsersCount}</strong> ta
                  </div>

                  <div class="flex items-center gap-1">
                    <button 
                      id="prev-page-btn"
                      ${currentPage === 1 ? 'disabled class="px-2.5 py-1 rounded-lg text-slate-300 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium"'}
                    >
                      ‹ Oldingi
                    </button>

                    <span class="px-2 py-1 text-slate-600 font-mono font-bold">
                      ${currentPage} / ${totalPages}
                    </span>

                    <button 
                      id="next-page-btn"
                      ${currentPage === totalPages ? 'disabled class="px-2.5 py-1 rounded-lg text-slate-300 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium"'}
                    >
                      Keyingi ›
                    </button>
                  </div>
                </div>
              ` : ''}

            `}

          </div>

        ` : ''}

        <!-- 2-TAB: MAKTABLAR BOSHQARUVI (Ixcham) -->
        ${activeTab === 'schools' ? `
          <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            
            <div class="p-3.5 sm:px-5 border-b border-slate-100 flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-slate-700">Tizimdagi Maktablar (${filteredSchools.length})</span>
              <span class="text-[11px] text-slate-400">Tahrirlash va o'chirish</span>
            </div>

            ${filteredSchools.length === 0 ? `
              <div class="py-12 text-center text-slate-400 text-xs">
                Birorta ham maktab topilmadi
              </div>
            ` : `
              <div class="divide-y divide-slate-100">
                ${filteredSchools.map((sch, idx) => {
                  const schClasses = state.classes.filter(c => c.schoolId === sch.id);
                  const schStudents = state.students.filter(s => s.schoolId === sch.id);
                  return `
                    <div class="p-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3">
                      
                      <!-- Maktab nomi va admini -->
                      <div class="min-w-0 cursor-pointer view-school-row" data-id="${sch.id}">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors truncate">
                            ${sch.name}
                          </span>
                          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-700 font-bold shrink-0">
                            Admin: ${sch.adminName}
                          </span>
                        </div>
                        <div class="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                          <span class="font-mono text-slate-600">${sch.adminPhone}</span>
                          <span>•</span>
                          <span>${schClasses.length} sinf, ${schStudents.length} o'quvchi</span>
                        </div>
                      </div>

                      <!-- Amallar -->
                      <div class="flex items-center gap-1 shrink-0">
                        <button 
                          class="view-admin-page-btn px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold cursor-pointer transition-colors"
                          data-id="${sch.id}"
                          title="Maktab sahifasiga o'tish"
                        >
                          Ochish
                        </button>
                        <button 
                          class="edit-school-btn p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer transition-colors"
                          data-id="${sch.id}"
                          title="Tahrirlash"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button 
                          class="delete-school-btn p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                          data-id="${sch.id}"
                          title="O'chirish"
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
        ` : ''}

        <!-- 3-TAB: SOZLAMALAR VA XAVFSIZLIK -->
        ${activeTab === 'settings' ? `
          <div class="space-y-6">
            
            <!-- 1-Panel: Dasturchi Shaxsiy Ma'lumotlari -->
            <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div class="px-5 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 class="text-sm font-bold text-slate-900">Dasturchi Ma'lumotlari (Muallif Profili)</h2>
                    <p class="text-xs text-slate-500">Tizim dasturchisining shaxsiy va aloqa ma'lumotlari</p>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  Dasturchi
                </span>
              </div>

              <form id="dev-profile-form" class="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
                <!-- WORKING CODE Brend Banneri -->
                <div class="p-3.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/80 rounded-2xl flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-white border border-blue-200/90 shadow-2xs flex items-center justify-center p-1 shrink-0">
                      <img src="/working-code-logo.svg" alt="Working Code" class="w-full h-full object-contain" />
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Platforma Rasmiy Brendi:</span>
                        <span class="text-blue-700 font-extrabold tracking-wide">WORKING CODE</span>
                      </div>
                      <p class="text-[11px] text-slate-500 truncate">Barcha foydalanuvchilar va maktablar uchun platforma muallifi sifatida "WORKING CODE" ko'rsatiladi.</p>
                    </div>
                  </div>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 shrink-0">
                    Rasmiy Brend
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-first-name">Ism <span class="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      id="dev-first-name" 
                      value="${state.developer?.firstName || 'Diyorbek'}" 
                      required 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-last-name">Familiya <span class="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      id="dev-last-name" 
                      value="${state.developer?.lastName || 'Izzatullayev'}" 
                      required 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-phone">Telefon raqami <span class="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      id="dev-phone" 
                      value="${state.developer?.phone || '+998 90 000 12 34'}" 
                      required 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-telegram">Telegram username</label>
                    <input 
                      type="text" 
                      id="dev-telegram" 
                      value="${state.developer?.telegram || '@diyorbek_dev'}" 
                      placeholder="@username" 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-email">Email manzili</label>
                    <input 
                      type="email" 
                      id="dev-email" 
                      value="${state.developer?.email || 'diyorbek.dev1510@gmail.com'}" 
                      placeholder="email@example.com" 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-bio">Dasturchi haqida qisqa ma'lumot (Bio / Mutaxassislik)</label>
                  <input 
                    type="text" 
                    id="dev-bio" 
                    value="${state.developer?.bio || "MaktabX axborot tizimi asoschisi va dasturchisi"}" 
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div class="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-semibold text-xs transition-all shadow-md shadow-purple-200 cursor-pointer"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span>Dasturchi ma'lumotlarini saqlash</span>
                  </button>
                </div>
              </form>
            </div>

            <!-- 2-Panel: Login va Parolni O'zgartirish (Xavfsizlik) -->
            <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div class="px-5 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 class="text-sm font-bold text-slate-900">Dasturchi Login va Parolini O'zgartirish</h2>
                    <p class="text-xs text-slate-500">Tizimga kirish login va parolingizni yangilang</p>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Xavfsizlik
                </span>
              </div>

              <form id="dev-cred-form" class="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-new-login">Login / Foydalanuvchi nomi <span class="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    id="dev-new-login" 
                    value="${state.developer?.login || '1234'}" 
                    required 
                    autocomplete="username"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 font-medium"
                  />
                  <p class="text-[11px] text-slate-400 mt-1">Dasturchi kabinetiga kirish uchun yangi login</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-new-pwd">Yangi parol <span class="text-red-500">*</span></label>
                    <div class="relative">
                      <input 
                        type="password" 
                        id="dev-new-pwd" 
                        required 
                        autocomplete="new-password"
                        placeholder="Kamida 4 ta belgi"
                        class="w-full px-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                      />
                      <button type="button" id="toggle-dev-new-pwd" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-confirm-pwd">Yangi parolni takrorlang <span class="text-red-500">*</span></label>
                    <div class="relative">
                      <input 
                        type="password" 
                        id="dev-confirm-pwd" 
                        required 
                        autocomplete="new-password"
                        placeholder="Yangi parolni qayta kiriting"
                        class="w-full px-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                      />
                      <button type="button" id="toggle-dev-confirm-pwd" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold text-xs transition-all shadow-md shadow-amber-200 cursor-pointer"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                    </svg>
                    <span>Login va parolni yangilash</span>
                  </button>
                </div>
              </form>
            </div>

            <!-- 3-Panel: Sayt Haqida Ma'lumotlar -->
            <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div class="px-5 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                    </svg>
                  </div>
                  <div>
                    <h2 class="text-sm font-bold text-slate-900">Sayt va Tizim Haqida Ma'lumotlar</h2>
                    <p class="text-xs text-slate-500">Ushbu ma'lumotlar barcha foydalanuvchilarga "Sayt haqida" oynasida ko'rsatiladi</p>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Tizim
                </span>
              </div>

              <form id="dev-site-form" class="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="site-title">Sayt Nomi <span class="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      id="site-title" 
                      value="${state.siteInfo?.title || 'MaktabX'}" 
                      required 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-bold"
                    />
                  </div>
                  <div class="sm:col-span-2">
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="site-subtitle">Qisqa shior / Subtitle <span class="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      id="site-subtitle" 
                      value="${state.siteInfo?.subtitle || "Ta'lim va O'quvchilar Boshqaruv Tizimi"}" 
                      required 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="site-description">Sayt haqida batafsil ma'lumot</label>
                  <textarea 
                    id="site-description" 
                    rows="3" 
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs sm:text-sm leading-relaxed"
                  >${state.siteInfo?.description || "MaktabX - maktablar, sinflar va o'quvchilarning barcha rasmiy ma'lumotlarini qulay, xavfsiz va markazlashgan holda yuritish, rasmiy dosyelarni chop etish va yuklab olish tizimi."}</textarea>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="site-version">Versiya</label>
                    <input 
                      type="text" 
                      id="site-version" 
                      value="${state.siteInfo?.version || '1.0.0'}" 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="site-support-phone">Qo'llab-quvvatlash tel</label>
                    <input 
                      type="text" 
                      id="site-support-phone" 
                      value="${state.siteInfo?.supportPhone || '+998 90 000 12 34'}" 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="site-support-telegram">Qo'llab-quvvatlash TG</label>
                    <input 
                      type="text" 
                      id="site-support-telegram" 
                      value="${state.siteInfo?.supportTelegram || '@diyorbek_dev'}" 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="site-support-email">Qo'llab-quvvatlash Email</label>
                    <input 
                      type="email" 
                      id="site-support-email" 
                      value="${state.siteInfo?.supportEmail || 'diyorbek.dev1510@gmail.com'}" 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="site-year">Yil</label>
                    <input 
                      type="text" 
                      id="site-year" 
                      value="${state.siteInfo?.releaseYear || '2026'}" 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div class="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    id="save-site-info-btn"
                    class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs transition-all shadow-md shadow-blue-200 cursor-pointer disabled:opacity-50"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span>Sayt ma'lumotlarini saqlash</span>
                  </button>
                </div>
              </form>
            </div>

            <!-- 3-Panel: Dasturchi Maxfiy PIN-kodi (4 xonali Kabinet PIN) -->
            <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div class="px-5 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 class="text-sm font-bold text-slate-900">Dasturchi Kabinet PIN-kodi (4 xonali)</h2>
                    <p class="text-xs text-slate-500">Dasturchi paneliga faqat to'g'ri PIN-kod bilan kiriladi</p>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  PIN Himoyasi
                </span>
              </div>

              <div class="p-5 sm:p-6 space-y-5 text-xs sm:text-sm">
                <!-- Joriy holat -->
                <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <span class="text-slate-600 font-medium">Joriy o'rnatilgan PIN-kod:</span>
                    ${state.developer?.pinCode 
                      ? `<strong class="font-mono text-sm tracking-widest text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-300">${state.developer.pinCode}</strong>` 
                      : `<span class="text-slate-400 italic">O'rnatilmagan (kabinet erkin ochiladi)</span>`}
                  </div>
                  ${state.developer?.pinCode ? `
                    <button 
                      type="button" 
                      id="dev-remove-pin-btn"
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
                    >
                      PIN-kodni bekor qilish
                    </button>
                  ` : ''}
                </div>

                <!-- Yangi PIN o'rnatish formasi -->
                <form id="dev-pin-form" class="space-y-4">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-new-pin">
                        Yangi 4 xonali PIN-kod <span class="text-red-500">*</span>
                      </label>
                      <input 
                        type="password" 
                        id="dev-new-pin" 
                        maxlength="4" 
                        pattern="[0-9]{4}" 
                        inputmode="numeric"
                        placeholder="Masalan: 5565" 
                        required 
                        class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono tracking-widest text-base font-bold text-center"
                      />
                      <p class="text-[11px] text-slate-400 mt-1">Faqat 4 ta raqam kiriting</p>
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="dev-confirm-pin">
                        PIN-kodni tasdiqlang <span class="text-red-500">*</span>
                      </label>
                      <input 
                        type="password" 
                        id="dev-confirm-pin" 
                        maxlength="4" 
                        pattern="[0-9]{4}" 
                        inputmode="numeric"
                        placeholder="Masalan: 5565" 
                        required 
                        class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono tracking-widest text-base font-bold text-center"
                      />
                      <p class="text-[11px] text-slate-400 mt-1">Yuqoridagi PIN-kodni takrorlang</p>
                    </div>
                  </div>

                  <div class="flex justify-end pt-2">
                    <button 
                      type="submit" 
                      class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-semibold text-xs transition-all shadow-md shadow-purple-200 cursor-pointer"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                      <span>PIN-kodni saqlash</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        ` : ''}

        <!-- 4-TAB: PAROLNI TIKLASH VA BUYRUQLAR (Developer nazorati) -->
        ${activeTab === 'requests' ? `
          <div class="space-y-4">
            
            <!-- Ma'lumot kartasi (Dasturchi va Admin aloqasi) -->
            <div class="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
              <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
                ℹ
              </div>
              <div class="space-y-1">
                <div class="font-bold text-amber-950 text-sm">Xavfsizlik va Parolni tiklash qoidalari:</div>
                <p class="leading-relaxed">
                  • <strong>O'qituvchilar:</strong> Shaxsiy kabinetida ko'rsatilgan vaqtinchalik <code>ID</code> orqali login sahifasida tiklash so'rovi yuboradi. Maktab admini yoki Dasturchi ushbu so'rovni tasdiqlasa, o'qituvchi o'z hisobiga avtomatik kiradi.
                </p>
                <p class="leading-relaxed">
                  • <strong>Maktab Adminlari:</strong> Adminlarda tiklash ID si bo'lmaydi! Agar admin login yoki parolini unutsa, to'g'ridan-to'g'ri Dasturchiga murojaat qiladi. Dasturchi "Maktablar" yoki "Foydalanuvchilar" bo'limidan tegishli adminni tahrirlash orqali yangi parol belgilab beradi.
                </p>
              </div>
            </div>

            <!-- 1-QISM: Muvaffaqiyatli tiklangan hisoblar (Dasturchi uchun xabarnoma) -->
            <div class="bg-white rounded-2xl border border-emerald-200/90 shadow-xs overflow-hidden">
              <div class="px-4 py-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-b border-emerald-100 flex items-center justify-between">
                <div class="font-bold text-xs text-emerald-950 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Muvaffaqiyatli tiklangan hisoblar (Dasturchi xabarnomasi)</span>
                  <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">${recoveredCount} ta</span>
                </div>
                <span class="text-[11px] text-emerald-700 font-medium hidden sm:inline">Avtomatik bildirishnoma</span>
              </div>

              <div class="divide-y divide-emerald-50">
                ${recoveredCount === 0 ? `
                  <div class="py-6 px-4 text-center">
                    <p class="text-xs text-slate-400">
                      Hozircha hech qaysi hisob SMS yoki ID orqali qayta tiklanmagan.
                    </p>
                  </div>
                ` : allRequests.filter(r => r.status === 'recovered' || r.type === 'account_recovered').map(req => {
                  const sch = state.schools.find(s => s.id === req.schoolId);
                  const schoolName = sch ? sch.name : (req.schoolName || "Maktab");
                  const isSms = req.methodType === 'sms' || (req.method && req.method.includes('SMS'));

                  return `
                    <div class="p-4 sm:p-5 bg-emerald-50/20 hover:bg-emerald-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div class="space-y-1.5 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-bold text-sm text-slate-900">${req.teacherName || "Sinf Rahbari"}</span>
                          <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold font-mono border border-indigo-100">${req.className || "Sinf"}</span>
                          <span class="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-100">${schoolName}</span>
                          
                          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${isSms ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
                            <span>✓</span>
                            <span>${req.method || (isSms ? 'SMS tasdiqlash orqali tiklandi' : 'ID orqali tiklandi')}</span>
                          </span>
                        </div>

                        <div class="text-xs text-slate-700 leading-relaxed font-medium">
                          ${req.message || `${req.teacherName} o'z hisobini muvaffaqiyatli qayta tikladi.`}
                        </div>

                        <div class="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                          ${req.login ? `<span>• Yangilangan Login: <strong class="font-mono text-indigo-700 font-bold">${req.login}</strong></span>` : ''}
                          ${req.teacherPhone ? `<span>• Tel: <strong class="font-mono text-slate-700 font-semibold">${req.teacherPhone}</strong></span>` : ''}
                          <span>• Tiklangan vaqti: <strong class="text-slate-700">${new Date(req.recoveredAt || req.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></span>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        <button 
                          class="dev-delete-req-btn px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                          data-id="${req.id}"
                          title="Xabarnomani o'chirish"
                        >
                          <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                          </svg>
                          <span>Xabardor bo'ldim</span>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 2-QISM: Barcha so'rovlar va kutilayotgan arizalar -->
            <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div class="px-4 py-3 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
                <div class="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <span>Kutilayotgan va boshqa arizalar ro'yxati</span>
                  <span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono">${allRequests.filter(r => r.status !== 'recovered' && r.type !== 'account_recovered').length} ta</span>
                </div>
              </div>

              <div class="divide-y divide-slate-100">
                ${allRequests.filter(r => r.status !== 'recovered' && r.type !== 'account_recovered').length === 0 ? `
                  <div class="py-12 px-4 text-center">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <h3 class="text-sm font-bold text-slate-800">Kutilayotgan tiklash arizalari mavjud emas</h3>
                    <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      O'qituvchilar tomonidan parolni unutdim deb yuborilgan tasdiqlanmagan so'rovlar bu yerda aks etadi.
                    </p>
                  </div>
                ` : allRequests.filter(r => r.status !== 'recovered' && r.type !== 'account_recovered').map(req => {
                  const sch = state.schools.find(s => s.id === req.schoolId);
                  const schoolName = sch ? sch.name : (req.schoolName || "Maktab");
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';

                  return `
                    <div class="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      <div class="space-y-1.5 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-bold text-sm text-slate-900">${req.teacherName || "Sinf Rahbari"}</span>
                          <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold font-mono border border-indigo-100">${req.className || "Sinf"}</span>
                          <span class="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-100">${schoolName}</span>
                          
                          ${isPending ? `
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Admin tasdiqlashi kutilmoqda
                            </span>
                          ` : isApproved ? `
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ Tasdiqlangan / Kirish berilgan
                            </span>
                          ` : `
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                              ✕ Rad etilgan
                            </span>
                          `}
                        </div>

                        <div class="text-xs text-slate-600">
                          ${req.message || `Foydalanuvchi (${req.teacherName}) ID orqali login parolni tiklamoqchi.`}
                        </div>

                        <div class="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                          ${req.recoveryId ? `<span class="font-mono font-medium text-slate-600">Tiklash ID: <strong class="text-indigo-700 font-bold">${req.recoveryId}</strong></span>` : ''}
                          ${req.teacherPhone ? `<span>• Tel: <strong class="font-mono text-slate-700">${req.teacherPhone}</strong></span>` : ''}
                          <span>• Vaqti: ${new Date(req.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        ${isPending ? `
                          <button 
                            class="dev-approve-req-btn px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                            data-id="${req.id}"
                            title="Dasturchi nomidan ruxsat berish"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Ruxsat berish</span>
                          </button>

                          <button 
                            class="dev-reject-req-btn px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 text-red-600 text-xs font-bold transition-all cursor-pointer active:scale-95"
                            data-id="${req.id}"
                            title="So'rovni rad etish"
                          >
                            <span>Rad etish</span>
                          </button>
                        ` : `
                          <button 
                            class="dev-delete-req-btn p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            data-id="${req.id}"
                            title="So'rovni o'chirish"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        `}
                      </div>

                    </div>
                  `;
                }).join('')}
              </div>
            </div>

          </div>
        ` : ''}

        <!-- 5-TAB: O'QUVCHILARNING TA'LIM PLATFORMALARI VA PAROLLARI (Dasturchi uchun to'liq nazorat) -->
        ${activeTab === 'platforms' ? `
          <div class="space-y-4">
            <!-- Filtrlar va tezkor eksport paneli -->
            <div class="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div class="flex items-center gap-2 flex-wrap">
                <!-- Maktab tanlash -->
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-semibold text-slate-500">Maktab:</span>
                  <select id="dev-platform-school-select" class="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer">
                    <option value="all" ${platformSchoolFilter === 'all' ? 'selected' : ''}>Barcha maktablar (${state.schools.length})</option>
                    ${state.schools.map(s => `
                      <option value="${s.id}" ${platformSchoolFilter === s.id ? 'selected' : ''}>${s.name}</option>
                    `).join('')}
                  </select>
                </div>

                <!-- Sinf tanlash -->
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-semibold text-slate-500">Sinf:</span>
                  <select id="dev-platform-class-select" class="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer">
                    <option value="all" ${platformClassFilter === 'all' ? 'selected' : ''}>Barcha sinflar</option>
                    ${(platformSchoolFilter === 'all' ? state.classes : state.classes.filter(c => c.schoolId === platformSchoolFilter)).slice().sort((a, b) => compareClassNames(a.name, b.name)).map(c => `
                      <option value="${c.id}" ${platformClassFilter === c.id ? 'selected' : ''}>${c.name}</option>
                    `).join('')}
                  </select>
                </div>

                <!-- Platforma tanlash -->
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-semibold text-slate-500">Platforma:</span>
                  <select id="dev-platform-type-select" class="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer">
                    <option value="all" ${platformTypeFilter === 'all' ? 'selected' : ''}>Barcha platformalar (${allPlatformsList.length})</option>
                    ${allPlatformsList.map(p => `
                      <option value="${p.id}" ${platformTypeFilter === p.id ? 'selected' : ''}>${p.name}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <!-- Tezkor amallar -->
              <div class="flex items-center gap-1.5 flex-wrap justify-end">
                <button 
                  id="dev-export-platforms-excel-btn"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
                  title="Respublika bo'yicha barcha o'quvchilar login-parollarini Excel (.xlsx) jadvalida yuklab olish"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <span>Excel (.xlsx)</span>
                </button>

                <button 
                  id="dev-copy-all-platforms-btn"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold border border-slate-200 transition-all cursor-pointer active:scale-95"
                  title="Ko'rsatilgan barcha o'quvchilar login va parollarini xotiraga nusxalash"
                >
                  <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  <span>Nusxalash</span>
                </button>

                <button 
                  id="dev-toggle-all-passwords-btn"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${showAllPasswords ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-slate-100 text-slate-700 border-slate-200'} border text-xs font-bold transition-all cursor-pointer"
                  title="Barcha parollarni ko'rsatish yoki yashirish"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                  <span>${showAllPasswords ? "Parollarni yashirish" : "Parollarni ko'rsatish"}</span>
                </button>
              </div>
            </div>

            <!-- Asosiy jadval -->
            <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              ${paginatedPlatforms.length === 0 ? `
                <div class="py-12 px-4 text-center">
                  <div class="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                  </div>
                  <h3 class="text-sm font-bold text-slate-800">Platforma ma'lumotlari topilmadi</h3>
                  <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Tanlangan filtrlar yoki qidiruv so'rovi bo'yicha platforma login-parollari mavjud emas.
                  </p>
                </div>
              ` : `
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50/90 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <tr>
                        <th class="py-3 px-3.5 w-10 text-center">№</th>
                        <th class="py-3 px-3.5">Maktab</th>
                        <th class="py-3 px-3.5">Sinf</th>
                        <th class="py-3 px-3.5">O'quvchi F.I.SH</th>
                        <th class="py-3 px-3.5">Platforma</th>
                        <th class="py-3 px-3.5">Login</th>
                        <th class="py-3 px-3.5">Parol</th>
                        <th class="py-3 px-3.5 text-center">Holat</th>
                        <th class="py-3 px-3.5 text-right">Dosye</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      ${paginatedPlatforms.map((rec, idx) => {
                        const isPassVisible = showAllPasswords || visiblePasswords.has(rec.key);
                        const hasLogin = !!rec.login;
                        const hasPass = !!rec.password;
                        const isComplete = hasLogin && hasPass;

                        return `
                          <tr class="hover:bg-purple-50/20 transition-colors">
                            <td class="py-3 px-3.5 text-center font-mono text-slate-400">
                              ${platformStartIndex + idx + 1}
                            </td>
                            <td class="py-3 px-3.5 whitespace-nowrap">
                              <span class="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-100/80">
                                ${rec.schoolName}
                              </span>
                            </td>
                            <td class="py-3 px-3.5 whitespace-nowrap">
                              <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold font-mono text-[11px] border border-emerald-100/80">
                                ${rec.className}
                              </span>
                            </td>
                            <td class="py-3 px-3.5 font-semibold text-slate-900">
                              <div class="flex items-center gap-1.5 min-w-0">
                                <span class="truncate">${rec.studentName}</span>
                                <span class="text-[10px] text-slate-400 font-normal shrink-0">(${rec.studentGender || '-'})</span>
                              </div>
                            </td>
                            <td class="py-3 px-3.5 whitespace-nowrap">
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                                ${rec.platformName}
                              </span>
                            </td>
                            <td class="py-3 px-3.5 whitespace-nowrap">
                              ${hasLogin ? `
                                <div class="inline-flex items-center gap-1.5 bg-slate-100/80 px-2 py-1 rounded-lg border border-slate-200/80">
                                  <span class="font-mono font-bold text-slate-800 select-all">${rec.login}</span>
                                  <button 
                                    type="button" 
                                    class="p-0.5 text-slate-400 hover:text-indigo-600 rounded cursor-pointer dev-copy-cred-btn"
                                    data-copy="${encodeURIComponent(rec.login)}"
                                    title="Loginni nusxalash"
                                  >
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                  </button>
                                </div>
                              ` : `
                                <span class="text-slate-300 italic font-mono">-</span>
                              `}
                            </td>
                            <td class="py-3 px-3.5 whitespace-nowrap">
                              ${hasPass ? `
                                <div class="inline-flex items-center gap-1.5 bg-slate-100/80 px-2 py-1 rounded-lg border border-slate-200/80">
                                  <span class="font-mono font-bold text-slate-800 select-all ${isPassVisible ? '' : 'tracking-widest'}">
                                    ${isPassVisible ? rec.password : '••••••••'}
                                  </span>
                                  <button 
                                    type="button" 
                                    class="p-0.5 text-slate-400 hover:text-purple-600 rounded cursor-pointer dev-toggle-single-pass-btn"
                                    data-key="${rec.key}"
                                    title="${isPassVisible ? "Parolni yashirish" : "Parolni ko'rsatish"}"
                                  >
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isPassVisible ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18' : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'}"/></svg>
                                  </button>
                                  <button 
                                    type="button" 
                                    class="p-0.5 text-slate-400 hover:text-indigo-600 rounded cursor-pointer dev-copy-cred-btn"
                                    data-copy="${encodeURIComponent(rec.password)}"
                                    title="Parolni nusxalash"
                                  >
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                  </button>
                                </div>
                              ` : `
                                <span class="text-slate-300 italic font-mono">-</span>
                              `}
                            </td>
                            <td class="py-3 px-3.5 text-center whitespace-nowrap">
                              ${isComplete ? `
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  To'liq
                                </span>
                              ` : (hasLogin ? `
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Faqat login
                                </span>
                              ` : `
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                  Kiritilmagan
                                </span>
                              `)}
                            </td>
                            <td class="py-3 px-3.5 text-right whitespace-nowrap">
                              <button 
                                type="button" 
                                class="dev-open-student-dosye-btn p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                data-id="${rec.studentId}"
                                title="O'quvchi shaxsiy dosyesini ochish"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                              </button>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>

                <!-- Sahifalash -->
                ${totalPlatformPages > 1 ? `
                  <div class="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <div class="text-slate-500 font-medium">
                      <span>${platformStartIndex + 1}–${Math.min(platformStartIndex + pageSize, totalPlatformsCount)}</span> dan 
                      <strong class="text-slate-800">${totalPlatformsCount}</strong> ta
                    </div>

                    <div class="flex items-center gap-1">
                      <button 
                        id="dev-platform-prev-btn"
                        ${platformCurrentPage === 1 ? 'disabled class="px-2.5 py-1 rounded-lg text-slate-300 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium"'}
                      >
                        ‹ Oldingi
                      </button>

                      <span class="px-2 py-1 text-slate-600 font-mono font-bold">
                        ${platformCurrentPage} / ${totalPlatformPages}
                      </span>

                      <button 
                        id="dev-platform-next-btn"
                        ${platformCurrentPage === totalPlatformPages ? 'disabled class="px-2.5 py-1 rounded-lg text-slate-300 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer font-medium"'}
                      >
                        Keyingi ›
                      </button>
                    </div>
                  </div>
                ` : ''}
              `}
            </div>

          </div>
        ` : ''}

        <!-- 5-TAB: AQLLI XOTIRA VA SIG'IM TAHLILI (1 GB Bepul kvota tahlili va kalkulyatori) -->
        ${activeTab === 'storage' ? `
          ${renderDetailedStorageView(storageMetrics, onRefreshData, showToast)}
        ` : ''}

      </div>
    `;

    // Voqealar bog'lanishi (Event listeners)

    // Tab almashtirish
    const tabUsersBtn = container.querySelector('#tab-users-btn');
    if (tabUsersBtn) {
      tabUsersBtn.onclick = () => {
        activeTab = 'users';
        currentPage = 1;
        renderContent();
      };
    }

    const tabSchoolsBtn = container.querySelector('#tab-schools-btn');
    if (tabSchoolsBtn) {
      tabSchoolsBtn.onclick = () => {
        activeTab = 'schools';
        currentPage = 1;
        renderContent();
      };
    }

    const tabPlatformsBtn = container.querySelector('#tab-platforms-btn');
    if (tabPlatformsBtn) {
      tabPlatformsBtn.onclick = () => {
        activeTab = 'platforms';
        currentPage = 1;
        renderContent();
      };
    }

    const tabSettingsBtn = container.querySelector('#tab-settings-btn');
    if (tabSettingsBtn) {
      tabSettingsBtn.onclick = () => {
        activeTab = 'settings';
        renderContent();
      };
    }

    const tabRequestsBtn = container.querySelector('#tab-requests-btn');
    if (tabRequestsBtn) {
      tabRequestsBtn.onclick = () => {
        activeTab = 'requests';
        renderContent();
      };
    }

    const tabStorageBtn = container.querySelector('#tab-storage-btn');
    if (tabStorageBtn) {
      tabStorageBtn.onclick = () => {
        activeTab = 'storage';
        renderContent();
      };
    }

    const openStorageWidgetBtn = container.querySelector('#open-storage-analytics-btn');
    if (openStorageWidgetBtn) {
      openStorageWidgetBtn.onclick = () => {
        activeTab = 'storage';
        renderContent();
      };
    }

    // Maktab qo'shish
    const addBtn = container.querySelector('#open-add-admin-btn');
    if (addBtn) addBtn.onclick = onAddAdmin;

    const refreshBtn = container.querySelector('#dev-refresh-btn');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        isInternalLoading = true;
        renderContent();
        if (onRefreshData) {
          Promise.resolve(onRefreshData()).finally(() => {
            setTimeout(() => {
              isInternalLoading = false;
              renderContent();
            }, 400);
          });
        } else {
          setTimeout(() => {
            isInternalLoading = false;
            renderContent();
          }, 600);
        }
      };
    }

    // Qidiruv maydoni
    const searchInput = container.querySelector('#user-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchQuery = e.target.value;
        currentPage = 1;
        renderContent();
        const freshInput = container.querySelector('#user-search-input');
        if (freshInput) {
          freshInput.focus();
          freshInput.setSelectionRange(searchQuery.length, searchQuery.length);
        }
      };
    }

    const clearSearchBtn = container.querySelector('#clear-search-btn');
    if (clearSearchBtn) {
      clearSearchBtn.onclick = () => {
        searchQuery = '';
        currentPage = 1;
        renderContent();
      };
    }

    // Filtr tugmalari: A-Z, Admin, O'qituvchi, O'quvchi
    const sortPills = container.querySelectorAll('.sort-pill');
    sortPills.forEach(pill => {
      pill.onclick = () => {
        sortFilter = pill.getAttribute('data-filter');
        currentPage = 1;
        renderContent();
      };
    });

    // Sahifalash (Pagination) tugmalari
    const prevPageBtn = container.querySelector('#prev-page-btn');
    if (prevPageBtn) {
      prevPageBtn.onclick = () => {
        if (currentPage > 1) {
          currentPage--;
          renderContent();
        }
      };
    }

    const nextPageBtn = container.querySelector('#next-page-btn');
    if (nextPageBtn) {
      nextPageBtn.onclick = () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderContent();
        }
      };
    }

    // Foydalanuvchini ochish (har bir qator bosilganda)
    function openUserDetail(type, id) {
      if (type === 'admin' && onViewAdmin) {
        onViewAdmin(id);
      } else if (type === 'teacher' && onViewTeacher) {
        onViewTeacher(id);
      } else if (type === 'student' && onViewStudent) {
        onViewStudent(id);
      }
    }

    const userRows = container.querySelectorAll('.user-row');
    userRows.forEach(row => {
      row.onclick = () => {
        const type = row.getAttribute('data-type');
        const id = row.getAttribute('data-id');
        openUserDetail(type, id);
      };
    });

    // Maktablar bo'yicha amallar
    const viewAdminBtns = container.querySelectorAll('.view-admin-page-btn');
    viewAdminBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const schoolId = btn.getAttribute('data-id');
        if (onViewAdmin) onViewAdmin(schoolId);
      };
    });

    const viewSchoolRows = container.querySelectorAll('.view-school-row');
    viewSchoolRows.forEach(row => {
      row.onclick = () => {
        const schoolId = row.getAttribute('data-id');
        if (onViewAdmin) onViewAdmin(schoolId);
      };
    });

    const editSchoolBtns = container.querySelectorAll('.edit-school-btn');
    editSchoolBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        onEditAdmin(id);
      };
    });

    const deleteSchoolBtns = container.querySelectorAll('.delete-school-btn');
    deleteSchoolBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        onDeleteAdmin(id);
      };
    });

    // Sozlamalar: Password ko'rsatish/yashirish
    const setupPwdToggle = (btnId, inputId) => {
      const btn = container.querySelector(`#${btnId}`);
      const input = container.querySelector(`#${inputId}`);
      if (btn && input) {
        btn.onclick = () => {
          input.type = input.type === 'password' ? 'text' : 'password';
        };
      }
    };
    setupPwdToggle('toggle-dev-new-pwd', 'dev-new-pwd');
    setupPwdToggle('toggle-dev-confirm-pwd', 'dev-confirm-pwd');

    // Sozlamalar: Dasturchi profilini saqlash
    const profileForm = container.querySelector('#dev-profile-form');
    if (profileForm) {
      profileForm.onsubmit = (e) => {
        e.preventDefault();
        const firstName = container.querySelector('#dev-first-name')?.value.trim();
        const lastName = container.querySelector('#dev-last-name')?.value.trim();
        const phone = container.querySelector('#dev-phone')?.value.trim();
        const telegram = container.querySelector('#dev-telegram')?.value.trim();
        const email = container.querySelector('#dev-email')?.value.trim();
        const bio = container.querySelector('#dev-bio')?.value.trim();

        if (!firstName || !lastName || !phone) {
          if (showToast) showToast("Ism, familiya va telefon raqami majburiy!", "error");
          return;
        }

        if (onSaveDeveloperProfile) {
          onSaveDeveloperProfile({
            brand: 'WORKING CODE',
            firstName,
            lastName,
            name: 'WORKING CODE',
            realDeveloperName: `${firstName} ${lastName}`,
            phone,
            telegram,
            email,
            bio
          });
        }
      };
    }

    // Sozlamalar: Dasturchi login va parolini yangilash
    const credForm = container.querySelector('#dev-cred-form');
    if (credForm) {
      credForm.onsubmit = (e) => {
        e.preventDefault();
        const newLogin = container.querySelector('#dev-new-login')?.value.trim();
        const newPwd = container.querySelector('#dev-new-pwd')?.value.trim();
        const confirmPwd = container.querySelector('#dev-confirm-pwd')?.value.trim();

        if (!newLogin || newLogin.length < 3) {
          if (showToast) showToast("Login kamida 3 ta belgidan iborat bo'lishi kerak!", "error");
          return;
        }

        if (!newPwd || newPwd.length < 4) {
          if (showToast) showToast("Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak!", "error");
          return;
        }

        if (newPwd !== confirmPwd) {
          if (showToast) showToast("Yangi parol va tasdiqlash paroli bir-biriga mos kelmadi!", "error");
          return;
        }

        if (onSaveDeveloperCredentials) {
          onSaveDeveloperCredentials({
            newLogin,
            newPassword: newPwd
          });
        }
      };
    }

    // Sozlamalar: Sayt ma'lumotlarini saqlash
    const siteForm = container.querySelector('#dev-site-form');
    if (siteForm) {
      siteForm.onsubmit = (e) => {
        e.preventDefault();
        const title = container.querySelector('#site-title')?.value.trim();
        const subtitle = container.querySelector('#site-subtitle')?.value.trim();
        const description = container.querySelector('#site-description')?.value.trim();
        const version = container.querySelector('#site-version')?.value.trim();
        const supportPhone = container.querySelector('#site-support-phone')?.value.trim();
        const supportTelegram = container.querySelector('#site-support-telegram')?.value.trim();
        const supportEmail = container.querySelector('#site-support-email')?.value.trim();
        const releaseYear = container.querySelector('#site-year')?.value.trim();

        if (!title || !subtitle) {
          if (showToast) showToast("Sayt nomi va qisqa shiori kiritilishi shart!", "error");
          return;
        }

        if (onSaveSiteInfo) {
          onSaveSiteInfo({
            title,
            subtitle,
            description,
            version,
            supportPhone,
            supportTelegram,
            supportEmail,
            releaseYear
          });
        }
      };
    }

    // Sozlamalar: Dasturchi PIN-kodini saqlash
    const devPinForm = container.querySelector('#dev-pin-form');
    if (devPinForm) {
      devPinForm.onsubmit = (e) => {
        e.preventDefault();
        const newPin = container.querySelector('#dev-new-pin')?.value.trim();
        const confirmPin = container.querySelector('#dev-confirm-pin')?.value.trim();

        if (!newPin || !/^\d{4}$/.test(newPin)) {
          if (showToast) showToast("PIN-kod aynan 4 ta raqamdan iborat bo'lishi shart!", "error");
          return;
        }

        if (newPin !== confirmPin) {
          if (showToast) showToast("PIN-kod va tasdiqlash kodi bir-biriga mos kelmadi!", "error");
          return;
        }

        if (onSaveDeveloperPin) {
          onSaveDeveloperPin(newPin);
          renderContent();
        }
      };
    }

    // Sozlamalar: Dasturchi PIN-kodini bekor qilish
    const devRemovePinBtn = container.querySelector('#dev-remove-pin-btn');
    if (devRemovePinBtn) {
      devRemovePinBtn.onclick = () => {
        if (confirm("Haqiqatan ham Dasturchi kabinetining 4 xonali PIN-kodini bekor qilmoqchimisiz?")) {
          if (onRemoveDeveloperPin) {
            onRemoveDeveloperPin();
            renderContent();
          }
        }
      };
    }

    // Aqlli Xotira & Sig'im tab hodisalari
    if (activeTab === 'storage') {
      const refreshStorageBtn = container.querySelector('#refresh-storage-metrics-btn');
      if (refreshStorageBtn) {
        refreshStorageBtn.onclick = () => {
          if (onRefreshData) {
            Promise.resolve(onRefreshData()).finally(() => {
              renderContent();
            });
          } else {
            renderContent();
          }
        };
      }
      attachStorageCalculatorEvents(container, storageMetrics.avgStudentBytes);
    }

    // Tiklash so'rovlarini tasdiqlash, rad etish va o'chirish
    const approveBtns = container.querySelectorAll('.dev-approve-req-btn');
    approveBtns.forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        if (onApproveRecoveryRequest) {
          onApproveRecoveryRequest(id);
        }
      };
    });

    const rejectBtns = container.querySelectorAll('.dev-reject-req-btn');
    rejectBtns.forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        if (onRejectRecoveryRequest) {
          onRejectRecoveryRequest(id);
        }
      };
    });

    const deleteReqBtns = container.querySelectorAll('.dev-delete-req-btn');
    deleteReqBtns.forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        if (onDeleteRecoveryRequest) {
          onDeleteRecoveryRequest(id);
        }
      };
    });

    // Platformalar tab: maktab filtri
    const schoolSelect = container.querySelector('#dev-platform-school-select');
    if (schoolSelect) {
      schoolSelect.onchange = (e) => {
        platformSchoolFilter = e.target.value;
        platformClassFilter = 'all';
        currentPage = 1;
        renderContent();
      };
    }

    // Platformalar tab: sinf filtri
    const classSelect = container.querySelector('#dev-platform-class-select');
    if (classSelect) {
      classSelect.onchange = (e) => {
        platformClassFilter = e.target.value;
        currentPage = 1;
        renderContent();
      };
    }

    // Platformalar tab: platforma turi filtri
    const typeSelect = container.querySelector('#dev-platform-type-select');
    if (typeSelect) {
      typeSelect.onchange = (e) => {
        platformTypeFilter = e.target.value;
        currentPage = 1;
        renderContent();
      };
    }

    // Platformalar tab: Excel (.xlsx) eksport
    const exportExcelBtn = container.querySelector('#dev-export-platforms-excel-btn');
    if (exportExcelBtn) {
      exportExcelBtn.onclick = () => {
        if (!filteredPlatformRecords || filteredPlatformRecords.length === 0) {
          if (showToast) showToast("Eksport qilish uchun platforma ma'lumotlari mavjud emas", 'info');
          return;
        }
        try {
          const fileName = `Respublika_Barcha_Oquvchilar_Platformalar_${new Date().toISOString().slice(0, 10)}.xlsx`;
          exportPlatformCredentialsToExcel(filteredPlatformRecords, fileName);
          if (showToast) showToast(`${filteredPlatformRecords.length} ta o'quvchi ma'lumotlari Excel (.xlsx) da yuklab olindi`, 'success');
        } catch (err) {
          console.error("Excel eksport xatolik:", err);
          if (showToast) showToast("Excel faylni shakllantirishda xatolik yuz berdi", 'error');
        }
      };
    }

    // Platformalar tab: Barcha login-parollarni nusxalash
    const copyAllBtn = container.querySelector('#dev-copy-all-platforms-btn');
    if (copyAllBtn) {
      copyAllBtn.onclick = () => {
        if (!filteredPlatformRecords || filteredPlatformRecords.length === 0) {
          if (showToast) showToast("Nusxalash uchun platforma ma'lumotlari mavjud emas", 'info');
          return;
        }

        const lines = ["Respublika O'quvchilar Ta'lim Platformalari Login va Parollari:", ""];
        filteredPlatformRecords.forEach((rec, idx) => {
          lines.push(`${idx + 1}. [${rec.schoolName}] ${rec.className} - ${rec.studentName}`);
          lines.push(`   Platforma: ${rec.platformName}`);
          lines.push(`   Login: ${rec.login || '-'}`);
          lines.push(`   Parol: ${rec.password || '-'}`);
          lines.push("");
        });

        const textToCopy = lines.join("\n");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            if (showToast) showToast(`${filteredPlatformRecords.length} ta login-parol xotiraga nusxalandi`, 'success');
          }).catch(() => {
            if (showToast) showToast("Nusxalashda xatolik yuz berdi", 'error');
          });
        }
      };
    }

    // Platformalar tab: Barcha parollarni ko'rsatish/yashirish
    const toggleAllPassBtn = container.querySelector('#dev-toggle-all-passwords-btn');
    if (toggleAllPassBtn) {
      toggleAllPassBtn.onclick = () => {
        showAllPasswords = !showAllPasswords;
        renderContent();
      };
    }

    // Platformalar tab: bittalik parolni ko'rsatish/yashirish
    const singlePassToggles = container.querySelectorAll('.dev-toggle-single-pass-btn');
    singlePassToggles.forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-key');
        if (!key) return;
        if (visiblePasswords.has(key)) {
          visiblePasswords.delete(key);
        } else {
          visiblePasswords.add(key);
        }
        renderContent();
      };
    });

    // Platformalar tab: alohida login/parolni nusxalash
    const copyCredBtns = container.querySelectorAll('.dev-copy-cred-btn');
    copyCredBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const raw = btn.getAttribute('data-copy');
        const text = decodeURIComponent(raw || '');
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            if (showToast) showToast(`"${text}" nusxalandi`, 'success');
          });
        }
      };
    });

    // Platformalar tab: o'quvchi dosyesini ochish
    const openDosyeBtns = container.querySelectorAll('.dev-open-student-dosye-btn');
    openDosyeBtns.forEach(btn => {
      btn.onclick = () => {
        const stdId = btn.getAttribute('data-id');
        if (onViewStudent && stdId) {
          onViewStudent(stdId);
        }
      };
    });

    // Platformalar tab: Sahifalash (Pagination)
    const platPrevBtn = container.querySelector('#dev-platform-prev-btn');
    if (platPrevBtn) {
      platPrevBtn.onclick = () => {
        if (currentPage > 1) {
          currentPage--;
          renderContent();
        }
      };
    }

    const platNextBtn = container.querySelector('#dev-platform-next-btn');
    if (platNextBtn) {
      platNextBtn.onclick = () => {
        if (currentPage < totalPlatformPages) {
          currentPage++;
          renderContent();
        }
      };
    }
  }

  renderContent();
}
