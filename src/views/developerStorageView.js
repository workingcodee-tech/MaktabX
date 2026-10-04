/**
 * Dasturchi Paneli - Aqlli Xotira va Sig'im Tahlili (Smart Storage & Capacity Analytics)
 * Bepul 1 GB (1,024 MB) Cloud Firestore xotirasidan foydalanish holati,
 * ma'lumotlar hajmini baytma-bayt hisoblash va kelajakdagi sig'im prognozi.
 */

// Bepul kvota chegarasi: 1 GB = 1024 MB = 1,073,741,824 Bayt
export const TOTAL_FREE_STORAGE_BYTES = 1024 * 1024 * 1024;

/**
 * Xotira va foydalanuvchilar sig'imini hisoblash
 */
export function calculateStorageMetrics(state) {
  const safeState = state || {};
  const schools = safeState.schools || [];
  const classes = safeState.classes || [];
  const students = safeState.students || [];
  const requests = safeState.recoveryRequests || [];
  const developer = safeState.developer || {};
  const siteInfo = safeState.siteInfo || {};

  // JSON hajmini UTF-8 baytlarida aniq o'lchash
  const getBytes = (obj) => {
    try {
      return new Blob([JSON.stringify(obj || [])]).size;
    } catch (e) {
      return 0;
    }
  };

  const studentsBytes = getBytes(students);
  const classesBytes = getBytes(classes);
  const schoolsBytes = getBytes(schools);
  const requestsBytes = getBytes(requests);
  const systemBytes = getBytes({ developer, siteInfo });

  const totalUsedBytes = studentsBytes + classesBytes + schoolsBytes + requestsBytes + systemBytes;
  const remainingBytes = Math.max(0, TOTAL_FREE_STORAGE_BYTES - totalUsedBytes);

  const totalSchools = schools.length;
  const totalClasses = classes.length;
  const totalStudents = students.length;
  const totalAllUsers = totalSchools + totalClasses + totalStudents;

  // O'rtacha bitta o'quvchi ma'lumoti hajmi (toza matn, rasmlarsiz)
  const avgStudentBytes = totalStudents > 0 
    ? Math.max(1200, Math.round(studentsBytes / totalStudents)) 
    : 1850; // Standart ~1.85 KB

  const avgClassBytes = totalClasses > 0
    ? Math.max(600, Math.round(classesBytes / totalClasses))
    : 850;

  const avgSchoolBytes = totalSchools > 0
    ? Math.max(800, Math.round(schoolsBytes / totalSchools))
    : 1100;

  // Yana qancha foydalanuvchi qo'shish imkoni borligi (Prognoz)
  const maxAdditionalStudents = Math.floor(remainingBytes / avgStudentBytes);
  const maxAdditionalClasses = Math.floor(maxAdditionalStudents / 30); // 30 o'quvchili o'rtacha sinflar
  const maxAdditionalSchools = Math.floor(maxAdditionalStudents / 500); // 500 o'quvchili o'rtacha maktablar

  // Foizlar
  const usedPercent = ((totalUsedBytes / TOTAL_FREE_STORAGE_BYTES) * 100);
  const freePercent = Math.max(0, 100 - usedPercent);

  // MB va KB ko'rinishlari
  const usedMB = (totalUsedBytes / (1024 * 1024)).toFixed(2);
  const usedKB = (totalUsedBytes / 1024).toFixed(1);
  const freeMB = (remainingBytes / (1024 * 1024)).toFixed(1);
  const totalMB = (TOTAL_FREE_STORAGE_BYTES / (1024 * 1024)).toFixed(0);

  // Rasmlar tozalangani hisobiga tejalgan taxminiy hajm (~450 KB har bir o'quvchi rasmi)
  const savedPhotoEstimateBytes = totalStudents * 450 * 1024;
  const savedPhotoMB = (savedPhotoEstimateBytes / (1024 * 1024)).toFixed(1);

  return {
    totalSchools,
    totalClasses,
    totalStudents,
    totalAllUsers,
    studentsBytes,
    classesBytes,
    schoolsBytes,
    requestsBytes,
    systemBytes,
    totalUsedBytes,
    remainingBytes,
    usedMB,
    usedKB,
    freeMB,
    totalMB,
    usedPercent,
    freePercent,
    avgStudentBytes,
    avgStudentKB: (avgStudentBytes / 1024).toFixed(2),
    avgClassBytes,
    avgSchoolBytes,
    maxAdditionalStudents,
    maxAdditionalClasses,
    maxAdditionalSchools,
    savedPhotoMB
  };
}

/**
 * Dasturchi boshqaruv kartasi ostida ko'rinuvchi Aqlli Mini Vidjet (Glassmorphic Widget)
 */
export function renderStorageMiniWidget(metrics, onOpenDetailedTab) {
  const percentDisplay = metrics.usedPercent < 0.01 
    ? (metrics.usedPercent < 0.001 ? "< 0.001%" : metrics.usedPercent.toFixed(3) + "%") 
    : metrics.usedPercent.toFixed(2) + "%";

  return `
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/25 p-3.5 sm:p-4 text-white shadow-lg shadow-indigo-950/30">
      <!-- Orqa fon bezak nurlari -->
      <div class="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none"></div>
      <div class="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none"></div>
      
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        
        <!-- Chap: Diagramma va ko'rsatkichlar -->
        <div class="flex items-center gap-3 sm:gap-4 min-w-0">
          
          <!-- Radial Progress Gauge (Mini) -->
          <div class="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center">
            <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
              <!-- Fon doirasi -->
              <path
                class="text-white/10"
                stroke-width="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <!-- Bandlik chizig'i -->
              <path
                class="text-emerald-400 transition-all duration-1000 ease-out"
                stroke-dasharray="${Math.max(1, Math.min(100, metrics.usedPercent * 10))}, 100"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span class="text-[10px] sm:text-[11px] font-black text-emerald-300 leading-none">1GB</span>
              <span class="text-[8px] text-slate-300 font-medium scale-90">Free</span>
            </div>
          </div>

          <!-- Matnli ko'rsatkichlar -->
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10.5px] font-bold">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>1 GB Bepul Xotira</span>
              </span>
              <span class="text-xs font-semibold text-slate-200">
                Band: <strong class="text-white font-bold">${metrics.usedMB} MB</strong> / Bo'sh: <strong class="text-emerald-300 font-bold">${metrics.freeMB} MB</strong>
              </span>
            </div>
            
            <p class="text-[11px] sm:text-xs text-slate-300 leading-relaxed truncate sm:whitespace-normal">
              Foydalanuvchilar: <strong class="text-white">${metrics.totalAllUsers} ta</strong> (${metrics.totalStudents} o'quvchi) • 
              Yana sig'imi: <strong class="text-emerald-300">+${metrics.maxAdditionalStudents.toLocaleString()} ta</strong> o'quvchi qo'shish mumkin
            </p>
          </div>
        </div>

        <!-- O'ng: Tugma -->
        <div class="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <button 
            type="button" 
            id="open-storage-analytics-btn"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer shadow-xs"
            title="1 GB bepul xotira va sig'im tahlilini ochish"
          >
            <svg class="w-3.5 h-3.5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <span>Aqlli Xotira & Diagramma</span>
            <svg class="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  `;
}

/**
 * To'liq "Aqlli Xotira & Sig'im" (Smart Storage & Capacity) Tahlil Ko'rinishi
 */
export function renderDetailedStorageView(metrics, onRefreshData, showToast) {
  const percentDisplay = metrics.usedPercent < 0.01 
    ? (metrics.usedPercent < 0.001 ? "< 0.001%" : metrics.usedPercent.toFixed(3) + "%") 
    : metrics.usedPercent.toFixed(2) + "%";

  // Segmentli stacked bar uchun foizlar (jami ishlatilgan qismdan)
  const safeUsed = Math.max(1, metrics.totalUsedBytes);
  const studentsBarPct = Math.max(2, Math.round((metrics.studentsBytes / safeUsed) * 100));
  const classesBarPct = Math.max(1, Math.round((metrics.classesBytes / safeUsed) * 100));
  const schoolsBarPct = Math.max(1, Math.round((metrics.schoolsBytes / safeUsed) * 100));
  const systemBarPct = Math.max(1, 100 - (studentsBarPct + classesBarPct + schoolsBarPct));

  return `
    <div class="space-y-6 animate-fade-in">
      
      <!-- Yuqori Asosiy Karta: 1 GB Bepul Cloud Firestore Holati -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-[#0B1120] to-[#111836] border border-indigo-500/30 p-5 sm:p-7 text-white shadow-2xl">
        <!-- Bezak nurlari -->
        <div class="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none"></div>
        <div class="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-600/20 blur-3xl pointer-events-none"></div>

        <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          <!-- Chap tomondagi Asosiy Donut Diagrammasi -->
          <div class="flex items-center gap-5 sm:gap-7">
            
            <!-- SVG Donut Chart -->
            <div class="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center">
              <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                <!-- Fon aylanasi (Bo'sh xotira - kulrang/moviy) -->
                <path
                  class="text-indigo-950/80"
                  stroke-width="3.2"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <!-- Band qilingan qism (Emerald neon) -->
                <path
                  class="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)] transition-all duration-1000 ease-out"
                  stroke-dasharray="${Math.max(2, Math.min(100, metrics.usedPercent * 10))}, 100"
                  stroke-width="3.6"
                  stroke-linecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <!-- Markaziy Matn -->
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Band</span>
                <span class="text-base sm:text-lg font-black text-emerald-300 leading-tight">${percentDisplay}</span>
                <span class="text-[9px] text-slate-400 font-mono">${metrics.usedMB} MB</span>
              </div>
            </div>

            <!-- Sarlavhalar va tezkor xulosa -->
            <div class="space-y-1.5 min-w-0">
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Bepul 1 GB Xotira (Cloud Firestore)</span>
              </div>
              
              <h1 class="text-lg sm:text-2xl font-black text-white tracking-tight">
                Aqlli Xotira va Sig'im Tahlili
              </h1>
              
              <p class="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                Jami bepul ajratilgan <strong class="text-white">1,024 MB (1.00 GB)</strong> xotiradan hozirda atigi 
                <strong class="text-emerald-300">${metrics.usedMB} MB</strong> band qilingan. 
                Sizda hali <strong class="text-white font-bold">${metrics.freeMB} MB</strong> bo'sh joy mavjud!
              </p>

              <!-- Xavfsizlik darajasi ko'rsatkichi -->
              <div class="pt-1 flex items-center gap-2">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-[11px] text-emerald-300 font-semibold">
                  <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                  <span>Holat: Maksimal Xavfsiz Yashil Zona (${metrics.freePercent.toFixed(1)}% erkin)</span>
                </span>
              </div>
            </div>

          </div>

          <!-- O'ng tomondagi Qayta tekshirish tugmasi -->
          <div class="flex items-center gap-2 shrink-0">
            <button 
              type="button" 
              id="refresh-storage-metrics-btn"
              class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all cursor-pointer"
              title="Xotira baytlarini qayta o'lchash"
            >
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <span>Qayta o'lchash</span>
            </button>
          </div>

        </div>

        <!-- Segmented Stacked Progress Bar (Rangli Xotira Chizig'i) -->
        <div class="mt-6 pt-5 border-t border-slate-800/80 space-y-2.5">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>1 GB Bepul kvota taqsimoti:</span>
            <span>Jami: <strong>1,024 MB</strong></span>
          </div>

          <!-- Asosiy 1 GB chizig'i -->
          <div class="w-full h-4 rounded-full bg-slate-800/90 overflow-hidden p-0.5 border border-slate-700/60 flex gap-0.5 shadow-inner">
            <!-- Band qism (Kichik, lekin ko'rinadigan qilib kamida 2% kenglikda) -->
            <div 
              class="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 transition-all duration-700 relative group cursor-pointer"
              style="width: ${Math.max(2, Math.min(100, metrics.usedPercent * 10))}%;"
              title="Band: ${metrics.usedMB} MB (${percentDisplay})"
            ></div>
            <!-- Bo'sh qism -->
            <div 
              class="h-full rounded-full bg-indigo-950/60 flex-1 relative group cursor-pointer"
              title="Bo'sh: ${metrics.freeMB} MB (${metrics.freePercent.toFixed(2)}%)"
            ></div>
          </div>

          <!-- Izoh belgilar (Legend) -->
          <div class="flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2 pt-1">
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>Band qilingan joy: <strong class="text-white">${metrics.usedMB} MB</strong> (${percentDisplay})</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-indigo-950 border border-indigo-400/40"></span>
              <span>Bo'sh bepul xotira: <strong class="text-emerald-300">${metrics.freeMB} MB</strong> (${metrics.freePercent.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

      </div>

      <!-- 4 ta Asosiy Aqlli Ko'rsatkich Kartalari (Smart KPI Cards) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- 1-Karta: Jami Foydalanuvchilar -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500">Jami Foydalanuvchilar</span>
            <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
          </div>
          <div class="text-2xl font-black text-slate-900 leading-tight">
            ${metrics.totalAllUsers.toLocaleString()} <span class="text-xs font-semibold text-slate-500">kishi</span>
          </div>
          <div class="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
            <div>• <strong class="text-slate-800">${metrics.totalSchools}</strong> ta maktab admini</div>
            <div>• <strong class="text-slate-800">${metrics.totalClasses}</strong> ta sinf rahbari / o'qituvchi</div>
            <div>• <strong class="text-indigo-600 font-bold">${metrics.totalStudents}</strong> ta o'quvchi dosyesi</div>
          </div>
        </div>

        <!-- 2-Karta: Bepul Xotira Zaxirasi -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500">Bo'sh Bepul Xotira</span>
            <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
              </svg>
            </div>
          </div>
          <div class="text-2xl font-black text-emerald-600 leading-tight">
            ${metrics.freeMB} <span class="text-xs font-semibold text-slate-500">MB bo'sh</span>
          </div>
          <div class="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
            <div>• Jami kvota: <strong class="text-slate-800">1,024 MB (1 GB)</strong></div>
            <div>• Band qilingan: <strong class="text-slate-800">${metrics.usedMB} MB</strong> (${percentDisplay})</div>
            <div>• Bo'sh qolgan: <strong class="text-emerald-700 font-bold">${metrics.freePercent.toFixed(2)}%</strong></div>
          </div>
        </div>

        <!-- 3-Karta: Yana Qancha O'quvchi Qo'shish Mumkin (Sig'im Prognozi) -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200/90 shadow-xs space-y-2 bg-gradient-to-b from-white to-emerald-50/30">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-900">Yana Qo'shish Imkoni</span>
            <div class="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
            </div>
          </div>
          <div class="text-2xl font-black text-emerald-700 leading-tight">
            ~${metrics.maxAdditionalStudents.toLocaleString()}
            <span class="text-xs font-semibold text-emerald-800">o'quvchi</span>
          </div>
          <div class="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-emerald-100">
            <div>• Yana <strong class="text-slate-900 font-bold">~${metrics.maxAdditionalClasses.toLocaleString()}</strong> ta sinf (30 tadan)</div>
            <div>• Yana <strong class="text-slate-900 font-bold">~${metrics.maxAdditionalSchools.toLocaleString()}</strong> ta maktab (500 tadan)</div>
            <div class="text-emerald-700 font-semibold">• Bepul tarif uchun bemalol yetarli!</div>
          </div>
        </div>

        <!-- 4-Karta: Tejamkorlik Ko'rsatkichi (Suratlarsiz toza matn) -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500">1 Ta O'quvchi Hajmi</span>
            <div class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
          </div>
          <div class="text-2xl font-black text-purple-700 leading-tight">
            ~${metrics.avgStudentKB} <span class="text-xs font-semibold text-slate-500">KB</span>
          </div>
          <div class="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
            <div>• Fotosuratlarsiz ultra-yengil format</div>
            <div>• Tejalgan xotira: <strong class="text-purple-700 font-bold">~${metrics.savedPhotoMB} MB</strong></div>
            <div>• Ma'lumotlar 100% tez va yengil yuklanadi</div>
          </div>
        </div>

      </div>

      <!-- 2 ta Ustunli Blok: Xotira Taqsimoti Jadvali va Interaktiv Sig'im Kalkulyatori -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Chap: Aniq Baytma-bayt Taqsimot Jadvali -->
        <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div class="px-5 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
                </svg>
              </div>
              <h2 class="text-sm font-bold text-slate-900">Ma'lumotlar Bo'yicha Xotira Taqsimoti</h2>
            </div>
            <span class="text-[11px] font-mono text-slate-500">Firestore JSON</span>
          </div>

          <div class="divide-y divide-slate-100 text-xs">
            
            <!-- O'quvchilar -->
            <div class="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></div>
                <div>
                  <div class="font-bold text-slate-800">O'quvchilar Ma'lumotlar Bazasi</div>
                  <div class="text-[11px] text-slate-500">${metrics.totalStudents} ta o'quvchi dosyesi (platforma parollari bilan)</div>
                </div>
              </div>
              <div class="text-right font-mono">
                <div class="font-bold text-slate-900">${(metrics.studentsBytes / 1024).toFixed(2)} KB</div>
                <div class="text-[10.5px] text-slate-400">${(metrics.studentsBytes / (1024 * 1024)).toFixed(3)} MB</div>
              </div>
            </div>

            <!-- Sinflar -->
            <div class="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></div>
                <div>
                  <div class="font-bold text-slate-800">Sinflar va O'qituvchilar</div>
                  <div class="text-[11px] text-slate-500">${metrics.totalClasses} ta sinf, login/parol va PIN-kodlar</div>
                </div>
              </div>
              <div class="text-right font-mono">
                <div class="font-bold text-slate-900">${(metrics.classesBytes / 1024).toFixed(2)} KB</div>
                <div class="text-[10.5px] text-slate-400">${(metrics.classesBytes / (1024 * 1024)).toFixed(3)} MB</div>
              </div>
            </div>

            <!-- Maktablar -->
            <div class="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></div>
                <div>
                  <div class="font-bold text-slate-800">Maktablar va Adminlar</div>
                  <div class="text-[11px] text-slate-500">${metrics.totalSchools} ta maktab administratsiyasi</div>
                </div>
              </div>
              <div class="text-right font-mono">
                <div class="font-bold text-slate-900">${(metrics.schoolsBytes / 1024).toFixed(2)} KB</div>
                <div class="text-[10.5px] text-slate-400">${(metrics.schoolsBytes / (1024 * 1024)).toFixed(3)} MB</div>
              </div>
            </div>

            <!-- Tiklash so'rovlari va Tizim -->
            <div class="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></div>
                <div>
                  <div class="font-bold text-slate-800">Tizim Sozlamalari va So'rovlar</div>
                  <div class="text-[11px] text-slate-500">Dasturchi profili, sayt ma'lumotlari, tiklash arizalari</div>
                </div>
              </div>
              <div class="text-right font-mono">
                <div class="font-bold text-slate-900">${((metrics.systemBytes + metrics.requestsBytes) / 1024).toFixed(2)} KB</div>
                <div class="text-[10.5px] text-slate-400">${((metrics.systemBytes + metrics.requestsBytes) / (1024 * 1024)).toFixed(3)} MB</div>
              </div>
            </div>

            <!-- Jami qator -->
            <div class="p-4 bg-slate-50 flex items-center justify-between font-bold">
              <div class="text-slate-900">Jami Band Qilingan Xotira:</div>
              <div class="text-right font-mono text-indigo-700">
                <span>${metrics.usedMB} MB</span>
                <span class="text-[11px] font-normal text-slate-500 ml-1">(${percentDisplay})</span>
              </div>
            </div>

          </div>
        </div>

        <!-- O'ng: Interaktiv Sig'im Kalkulyatori (Capacity Simulator) -->
        <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
          <div class="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-sm font-bold text-slate-900">Interaktiv Sig'im Kalkulyatori</h2>
              <p class="text-[11px] text-slate-500">Yana o'quvchi yoki maktab qo'shilganda qancha joy ketishini hisoblang</p>
            </div>
          </div>

          <div class="space-y-4 text-xs">
            <div>
              <label class="block font-semibold text-slate-700 mb-1.5" for="calc-students-count">
                Rejalashtirilgan o'quvchilar sonini kiriting:
              </label>
              <div class="relative">
                <input 
                  type="number" 
                  id="calc-students-count" 
                  value="1000" 
                  min="1" 
                  max="1000000" 
                  step="50"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono text-sm font-bold"
                />
                <span class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 text-xs pointer-events-none">
                  ta o'quvchi
                </span>
              </div>
            </div>

            <!-- Tezkor tugmachalar -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[11px] text-slate-400">Tezkor:</span>
              <button type="button" class="calc-preset-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer" data-val="500">+500</button>
              <button type="button" class="calc-preset-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer" data-val="1000">+1,000</button>
              <button type="button" class="calc-preset-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer" data-val="5000">+5,000</button>
              <button type="button" class="calc-preset-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer" data-val="20000">+20,000</button>
              <button type="button" class="calc-preset-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer" data-val="50000">+50,000</button>
            </div>

            <!-- Kalkulyator Natijasi Bloki -->
            <div id="calc-result-box" class="p-4 rounded-xl bg-gradient-to-br from-emerald-50/80 to-teal-50/40 border border-emerald-200/80 space-y-2">
              <div class="font-bold text-emerald-950 flex items-center justify-between">
                <span>Prognoz Hisob-kitobi:</span>
                <span id="calc-estimated-size" class="font-mono text-emerald-800 text-sm">~1.85 MB</span>
              </div>
              <p id="calc-result-text" class="text-[11.5px] leading-relaxed text-emerald-900">
                1,000 ta qo'shimcha o'quvchi Firestore'da taxminan <strong class="font-mono">1.85 MB</strong> xotira egallaydi. 
                Bu bepul 1 GB (1,024 MB) kvotaning atigi <strong class="font-mono">0.18%</strong> qismini tashkil qiladi.
              </p>
              <div class="pt-1 text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
                <span>Xulosa: Bepul tarifingiz ushbu yuklamani bemalol ko'tara oladi!</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- Xulosa va Tavsiyalar Kartasi -->
      <div class="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 text-xs text-indigo-950 space-y-3">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="font-bold text-sm">Dasturchi uchun Xotira va Xavfsizlik bo'yicha Muhim Tavsiyalar:</span>
        </div>
        <ul class="space-y-1.5 text-[11.5px] text-slate-700 list-disc list-inside leading-relaxed">
          <li><strong>Fotosuratlarsiz toza ma'lumotlar:</strong> Tizimdan rasmlar yuklash olib tashlanganligi sababli xotira 99% tejalmoqda va o'quvchilar soni yarim milliondan oshganda ham 1 GB bepul kvotadan chiqib ketmaydi.</li>
          <li><strong>Tezkor kesh va oflayn ishlash:</strong> Ma'lumotlar kichik hajmda bo'lgani sababli brauzer sahifasi bir zumda yuklanadi va internet sekin bo'lganda ham xotiradan lahzada ochiladi.</li>
          <li><strong>Eksport imkoniyati:</strong> O'quvchilar ro'yxatini istalgan paytda Excel (.xlsx) va PDF formatida yuklab olib, zaxira nusxa sifatida saqlashingiz mumkin.</li>
        </ul>
      </div>

    </div>
  `;
}

/**
 * Kalkulyator interaktivligini ulash
 */
export function attachStorageCalculatorEvents(container, avgStudentBytes) {
  const calcInput = container.querySelector('#calc-students-count');
  const resultSize = container.querySelector('#calc-estimated-size');
  const resultText = container.querySelector('#calc-result-text');
  const presetBtns = container.querySelectorAll('.calc-preset-btn');

  function updateCalc(count) {
    const safeCount = Math.max(1, parseInt(count) || 1);
    const estBytes = safeCount * avgStudentBytes;
    const estMB = (estBytes / (1024 * 1024)).toFixed(2);
    const estKB = (estBytes / 1024).toFixed(1);
    const pct = ((estBytes / TOTAL_FREE_STORAGE_BYTES) * 100).toFixed(2);

    if (resultSize) {
      resultSize.textContent = estMB >= 1 ? `~${estMB} MB` : `~${estKB} KB`;
    }
    if (resultText) {
      resultText.innerHTML = `
        ${safeCount.toLocaleString()} ta qo'shimcha o'quvchi Firestore'da taxminan <strong class="font-mono">${estMB >= 1 ? estMB + ' MB' : estKB + ' KB'}</strong> xotira egallaydi. 
        Bu bepul 1 GB (1,024 MB) kvotaning atigi <strong class="font-mono">${pct}%</strong> qismini tashkil qiladi.
      `;
    }
  }

  if (calcInput) {
    calcInput.oninput = () => updateCalc(calcInput.value);
  }

  presetBtns.forEach(btn => {
    btn.onclick = () => {
      const val = btn.dataset.val;
      if (calcInput) {
        calcInput.value = val;
        updateCalc(val);
      }
    };
  });
}
