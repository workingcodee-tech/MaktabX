/**
 * Dasturchi Paneli - Aqlli Xotira, Sig'im Tahlili va Gibrid Baza Boshqaruvi (Cloud Firestore 1 GB + Railway Server 8 GB)
 * - Shu vaqtgacha saqlangan ma'lumotlar Cloud Firestore'da daxlsiz saqlanadi va doim o'qiladi
 * - Yangi kiritiladigan ma'lumotlar Dasturchi tanloviga ko'ra Railway (8 GB), Firestore (1 GB) yoki Ikkalasiga (Gibrid) saqlanadi
 */

import {
  getStorageTargetMode,
  setStorageTargetMode,
  getHybridStorageStatus,
  syncAllDataToRailway,
  downloadFullDatabaseBackup
} from '../firebase.js';

// Kvota chegaralari:
export const TOTAL_FREE_STORAGE_BYTES = 1024 * 1024 * 1024; // 1 GB (Firestore)
export const TOTAL_RAILWAY_STORAGE_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB (Railway)

/**
 * Xotira va foydalanuvchilar sig'imini hisoblash (Firestore 1GB + Railway 8GB)
 */
export function calculateStorageMetrics(state) {
  const safeState = state || {};
  const schools = safeState.schools || [];
  const classes = safeState.classes || [];
  const students = safeState.students || [];
  const requests = safeState.recoveryRequests || [];
  const developer = safeState.developer || {};
  const siteInfo = safeState.siteInfo || {};

  const hybridStatus = getHybridStorageStatus();
  const storageMode = hybridStatus.mode || getStorageTargetMode() || 'railway';

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

  // Tanlangan rejimga qarab faol sig'im (Railway = 8 GB, Firestore = 1 GB, Both = 9 GB)
  const activeCapacityBytes = storageMode === 'railway'
    ? TOTAL_RAILWAY_STORAGE_BYTES
    : storageMode === 'both'
      ? (TOTAL_RAILWAY_STORAGE_BYTES + TOTAL_FREE_STORAGE_BYTES)
      : TOTAL_FREE_STORAGE_BYTES;

  const remainingBytes = Math.max(0, activeCapacityBytes - totalUsedBytes);

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
  const maxAdditionalClasses = Math.floor(maxAdditionalStudents / 30);
  const maxAdditionalSchools = Math.floor(maxAdditionalStudents / 500);

  // Foizlar
  const usedPercent = ((totalUsedBytes / activeCapacityBytes) * 100);
  const freePercent = Math.max(0, 100 - usedPercent);

  // MB va KB ko'rinishlari
  const usedMB = (totalUsedBytes / (1024 * 1024)).toFixed(2);
  const usedKB = (totalUsedBytes / 1024).toFixed(1);
  const freeMB = (remainingBytes / (1024 * 1024)).toFixed(1);
  const totalMB = (activeCapacityBytes / (1024 * 1024)).toFixed(0);
  const totalGB = (activeCapacityBytes / (1024 * 1024 * 1024)).toFixed(0);

  // Rasmlar tozalangani hisobiga tejalgan taxminiy hajm (~450 KB har bir o'quvchi rasmi)
  const savedPhotoEstimateBytes = totalStudents * 450 * 1024;
  const savedPhotoMB = (savedPhotoEstimateBytes / (1024 * 1024)).toFixed(1);

  const railwayUsedKB = ((hybridStatus.railwayUsedBytes || 0) / 1024).toFixed(1);
  const railwayUsedMB = ((hybridStatus.railwayUsedBytes || 0) / (1024 * 1024)).toFixed(2);

  return {
    storageMode,
    hybridStatus,
    activeCapacityBytes,
    totalGB,
    railwayUsedKB,
    railwayUsedMB,
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
 * Dasturchi Sozlamalari va Xotira bo'limi uchun:
 * Ma'lumotlarni Saqlash Manbasini Tanlash (Cloud Firestore vs Railway 8GB) Boshqaruv Kartasi
 */
export function renderStorageEngineSelectorCard(metrics) {
  const mode = metrics.storageMode || 'railway';
  const hs = metrics.hybridStatus || {};

  const modeBadge = mode === 'railway'
    ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-300">
         <span class="w-2 h-2 rounded-full bg-purple-600 animate-ping"></span>
         <span>Faol: Railway Server (8 GB)</span>
       </span>`
    : mode === 'both'
      ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300">
           <span class="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
           <span>Faol: Gibrid (Railway 8GB + Firestore 1GB)</span>
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
           <span class="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
           <span>Faol: Cloud Firestore (1 GB)</span>
         </span>`;

  return `
    <div class="bg-white rounded-2xl border-2 border-indigo-200/90 shadow-sm overflow-hidden">
      <!-- Yuqori Sarlavha -->
      <div class="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-sm sm:text-base font-black text-white">Ma'lumotlarni Saqlash Serverini Tanlash (Baza Boshqaruvi)</h2>
              <span class="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">
                0% Yo'qotishsiz Gibrid Tizim
              </span>
            </div>
            <p class="text-xs text-slate-300 mt-0.5">
              Eski ma'lumotlar Firestore'da daxlsiz saqlanib o'qilaveradi. Yangi kiritiladigan ma'lumotlar qayerga yozilishini tanlang:
            </p>
          </div>
        </div>
        <div class="shrink-0">
          ${modeBadge}
        </div>
      </div>

      <!-- 3 ta Saqlash Rejimi Tanlash Kartalari -->
      <div class="p-5 sm:p-6 space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          
          <!-- 1-Variant: RAILWAY SERVER (8 GB) - Asosiy -->
          <button
            type="button"
            data-storage-mode="railway"
            class="storage-target-mode-btn text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              mode === 'railway'
                ? 'bg-purple-50/90 border-purple-600 ring-2 ring-purple-500/20 shadow-md'
                : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
            }"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                  mode === 'railway' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800'
                }">
                  🚂 Railway Server (8 GB)
                </span>
                <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  mode === 'railway' ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'
                }">
                  ${mode === 'railway' ? '✓' : ''}
                </span>
              </div>
              <div class="font-bold text-slate-900 text-sm">
                Yangi ma'lumotlar — Railway'ga
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                Shu vaqtgacha kiritilgan ma'lumotlar <strong>Firestore'dan o'qiladi</strong> (o'chib ketmaydi), endi kiritiladigan barcha yangi ma'lumotlar esa <strong>Railway 8 GB</strong> serverga saqlanadi.
              </p>
            </div>
            <div class="pt-2 border-t border-purple-200/60 flex items-center justify-between text-[11px] font-semibold">
              <span class="text-purple-800">Sig'im: <strong>8,192 MB (8 GB)</strong></span>
              <span class="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-mono">${hs.totalRailwayRecords || 0} yozuv</span>
            </div>
          </button>

          <!-- 2-Variant: CLOUD FIRESTORE (1 GB) -->
          <button
            type="button"
            data-storage-mode="firestore"
            class="storage-target-mode-btn text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              mode === 'firestore'
                ? 'bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
            }"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                  mode === 'firestore' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
                }">
                  🔥 Cloud Firestore (1 GB)
                </span>
                <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  mode === 'firestore' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                }">
                  ${mode === 'firestore' ? '✓' : ''}
                </span>
              </div>
              <div class="font-bold text-slate-900 text-sm">
                Yangi ma'lumotlar — Firestore'ga
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                Barcha yangi qo'shiladigan maktab, sinf, o'quvchi va davomat ma'lumotlari to'g'ridan-to'g'ri <strong>Google Cloud Firestore</strong> bazasiga saqlanadi.
              </p>
            </div>
            <div class="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] font-semibold">
              <span class="text-emerald-800">Sig'im: <strong>1,024 MB (1 GB)</strong></span>
              <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono">${hs.totalFirestoreRecords || 0} yozuv</span>
            </div>
          </button>

          <!-- 3-Variant: GIBRID (IKKALASIGA BARAVAR - RAILWAY + FIRESTORE) -->
          <button
            type="button"
            data-storage-mode="both"
            class="storage-target-mode-btn text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              mode === 'both'
                ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
            }"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                  mode === 'both' ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-800'
                }">
                  ⚡ Ikkalasiga Baravar (Gibrid)
                </span>
                <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  mode === 'both' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                }">
                  ${mode === 'both' ? '✓' : ''}
                </span>
              </div>
              <div class="font-bold text-slate-900 text-sm">
                Railway (8GB) + Firestore (1GB)
              </div>
              <p class="text-xs text-slate-600 leading-relaxed">
                Qo'shilgan har bir yangi ma'lumot bir vaqtning o'zida <strong>ham Railway serveriga, ham Cloud Firestore'ga</strong> ikki nusxada parallel saqlanadi.
              </p>
            </div>
            <div class="pt-2 border-t border-indigo-200/60 flex items-center justify-between text-[11px] font-semibold">
              <span class="text-indigo-800">Qo'shma himoya: <strong>100% Dual-Write</strong></span>
              <span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-mono">2x Zaxira</span>
            </div>
          </button>

        </div>

        <!-- Ikkala server holati va 1-tugmali ko'chirish / zaxira amallari -->
        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 text-xs">
            <div class="p-2.5 rounded-xl bg-white border border-slate-200/80">
              <div class="text-[11px] text-slate-500 font-medium">Firestore Bazada:</div>
              <div class="font-black text-emerald-700 text-sm mt-0.5">${hs.totalFirestoreRecords || 0} ta yozuv</div>
              <div class="text-[10px] text-slate-400">${hs.firestoreCounts?.students || 0} o'quvchi • ${hs.firestoreCounts?.classes || 0} sinf</div>
            </div>
            <div class="p-2.5 rounded-xl bg-white border border-slate-200/80">
              <div class="text-[11px] text-slate-500 font-medium">Railway (8 GB) Bazada:</div>
              <div class="font-black text-purple-700 text-sm mt-0.5">${hs.totalRailwayRecords || 0} ta yozuv</div>
              <div class="text-[10px] text-slate-400">${hs.railwayCounts?.students || 0} o'quvchi • ${metrics.railwayUsedKB} KB</div>
            </div>
            <div class="p-2.5 rounded-xl bg-white border border-slate-200/80">
              <div class="text-[11px] text-slate-500 font-medium">O'qish (Read) Rejimi:</div>
              <div class="font-bold text-slate-900 text-xs mt-0.5">Firestore + Railway</div>
              <div class="text-[10px] text-emerald-600 font-semibold">✓ Barchasi birlashgan</div>
            </div>
            <div class="p-2.5 rounded-xl bg-white border border-slate-200/80">
              <div class="text-[11px] text-slate-500 font-medium">Yozish (Write) Manbasi:</div>
              <div class="font-bold text-indigo-700 text-xs mt-0.5">
                ${mode === 'railway' ? 'Railway Server (8 GB)' : mode === 'both' ? 'Railway + Firestore' : 'Cloud Firestore (1 GB)'}
              </div>
              <div class="text-[10px] text-slate-400">Dasturchi tanlovi</div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              id="sync-firestore-to-railway-btn"
              class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Firestore'dagi barcha ma'lumotlarni o'chirmasdan Railway bazasiga ham nusxalab qo'yish"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
              </svg>
              <span>Firestore'dan Railway'ga nusxalash</span>
            </button>

            <button
              type="button"
              id="download-full-backup-json-btn"
              class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Barcha ma'lumotlarni kompyuterga .JSON zaxira fayli sifatida yuklab olish"
            >
              <svg class="w-4 h-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              <span>To'liq Zaxira (.JSON)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Dasturchi boshqaruv kartasi ostida ko'rinuvchi Aqlli Mini Vidjet (Glassmorphic Widget)
 */
export function renderStorageMiniWidget(metrics) {
  const mode = metrics.storageMode || 'railway';
  const hs = metrics.hybridStatus || {};

  const modeTitle = mode === 'railway'
    ? 'Railway Server (8 GB) + Firestore O\'qish'
    : mode === 'both'
      ? 'Gibrid: Railway (8 GB) + Firestore (1 GB)'
      : 'Cloud Firestore (1 GB Bepul Xotira)';

  return `
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/25 p-3.5 sm:p-4 text-white shadow-lg shadow-indigo-950/30">
      <!-- Orqa fon bezak nurlari -->
      <div class="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none"></div>
      <div class="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none"></div>
      
      <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        
        <!-- Chap: Diagramma va ko'rsatkichlar -->
        <div class="flex items-center gap-3 sm:gap-4 min-w-0">
          
          <!-- Radial Progress Gauge (Mini) -->
          <div class="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center">
            <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
              <path
                class="text-white/10"
                stroke-width="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                class="${mode === 'railway' ? 'text-purple-400' : 'text-emerald-400'} transition-all duration-1000 ease-out"
                stroke-dasharray="${Math.max(2, Math.min(100, metrics.usedPercent * 10))}, 100"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span class="text-[10px] sm:text-[11px] font-black ${mode === 'railway' ? 'text-purple-300' : 'text-emerald-300'} leading-none">${metrics.totalGB}GB</span>
              <span class="text-[8px] text-slate-300 font-medium scale-90">${mode === 'railway' ? 'Railway' : mode === 'both' ? 'Gibrid' : 'Cloud'}</span>
            </div>
          </div>

          <!-- Matnli ko'rsatkichlar -->
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                mode === 'railway'
                  ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
              } text-[10.5px] font-bold">
                <span class="w-1.5 h-1.5 rounded-full ${mode === 'railway' ? 'bg-purple-400' : 'bg-emerald-400'} animate-pulse"></span>
                <span>Saqlash manbasi: ${modeTitle}</span>
              </span>
              <span class="text-xs font-semibold text-slate-200">
                Band: <strong class="text-white font-bold">${metrics.usedMB} MB</strong> / Bo'sh: <strong class="text-emerald-300 font-bold">${metrics.freeMB} MB</strong>
              </span>
            </div>
            
            <p class="text-[11px] sm:text-xs text-slate-300 leading-relaxed truncate sm:whitespace-normal">
              Firestore'da: <strong class="text-emerald-300">${hs.totalFirestoreRecords || 0} yozuv</strong> • 
              Railway (8GB) da: <strong class="text-purple-300">${hs.totalRailwayRecords || 0} yozuv</strong> • 
              Yana sig'imi: <strong class="text-white">+${metrics.maxAdditionalStudents.toLocaleString()} o'quvchi</strong>
            </p>
          </div>
        </div>

        <!-- O'ng: Tezkor Baza Tanlash Tugmalari + Batafsil Oynani Ochish -->
        <div class="flex items-center gap-2 flex-wrap shrink-0 self-end lg:self-auto">
          <div class="inline-flex items-center p-1 rounded-xl bg-black/30 border border-white/15">
            <button
              type="button"
              data-storage-mode="railway"
              class="storage-target-mode-btn px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                mode === 'railway'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }"
              title="Yangi ma'lumotlarni Railway (8 GB) serverga saqlash (Eskilari Firestore'da qoladi)"
            >
              🚂 Railway 8GB
            </button>
            <button
              type="button"
              data-storage-mode="firestore"
              class="storage-target-mode-btn px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                mode === 'firestore'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }"
              title="Yangi ma'lumotlarni Cloud Firestore (1 GB) bazasiga saqlash"
            >
              🔥 Firestore 1GB
            </button>
            <button
              type="button"
              data-storage-mode="both"
              class="storage-target-mode-btn px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                mode === 'both'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }"
              title="Ikkala bazaga ham baravar saqlash (Railway + Firestore)"
            >
              ⚡ Ikkalasi
            </button>
          </div>

          <button 
            type="button" 
            id="open-storage-analytics-btn"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer shadow-xs"
            title="Server va Xotira boshqaruvini ochish"
          >
            <span>Baza & Xotira</span>
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
 * To'liq "Aqlli Xotira & Server Boshqaruvi" (Smart Storage & Railway/Firestore Switcher) Ko'rinishi
 */
export function renderDetailedStorageView(metrics) {
  const percentDisplay = metrics.usedPercent < 0.01 
    ? (metrics.usedPercent < 0.001 ? "< 0.001%" : metrics.usedPercent.toFixed(3) + "%") 
    : metrics.usedPercent.toFixed(2) + "%";

  const mode = metrics.storageMode || 'railway';

  return `
    <div class="space-y-6 animate-fade-in">

      <!-- 1. DASTURCHI UCHUN BAZA TANLASH VA KO'CHIRISH PANELI (Railway 8GB vs Firestore 1GB) -->
      ${renderStorageEngineSelectorCard(metrics)}
      
      <!-- 2. Yuqori Asosiy Karta: Xotira va Kvota Holati -->
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
                <path
                  class="text-indigo-950/80"
                  stroke-width="3.2"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
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
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">${metrics.totalGB} GB</span>
                <span class="text-base sm:text-lg font-black text-emerald-300 leading-tight">${percentDisplay}</span>
                <span class="text-[9px] text-slate-400 font-mono">${metrics.usedMB} MB</span>
              </div>
            </div>

            <!-- Sarlavhalar va tezkor xulosa -->
            <div class="space-y-1.5 min-w-0">
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>${mode === 'railway' ? 'Railway 8 GB Server + Firestore (1 GB)' : mode === 'both' ? '9 GB Qo\'shma Gibrid Xotira' : '1 GB Cloud Firestore Xotirasi'}</span>
              </div>
              
              <h1 class="text-lg sm:text-2xl font-black text-white tracking-tight">
                Aqlli Xotira va Sig'im Tahlili
              </h1>
              
              <p class="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                Jami ajratilgan <strong class="text-white">${Number(metrics.totalMB).toLocaleString()} MB (${metrics.totalGB} GB)</strong> xotiradan hozirda atigi 
                <strong class="text-emerald-300">${metrics.usedMB} MB</strong> band qilingan. 
                Sizda hali <strong class="text-white font-bold">${Number(metrics.freeMB).toLocaleString()} MB</strong> bo'sh joy mavjud!
              </p>

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

        <!-- Segmented Stacked Progress Bar -->
        <div class="mt-6 pt-5 border-t border-slate-800/80 space-y-2.5">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Faol server kvotasi taqsimoti:</span>
            <span>Jami: <strong>${Number(metrics.totalMB).toLocaleString()} MB (${metrics.totalGB} GB)</strong></span>
          </div>

          <div class="w-full h-4 rounded-full bg-slate-800/90 overflow-hidden p-0.5 border border-slate-700/60 flex gap-0.5 shadow-inner">
            <div 
              class="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 transition-all duration-700 relative group cursor-pointer"
              style="width: ${Math.max(2, Math.min(100, metrics.usedPercent * 10))}%;"
              title="Band: ${metrics.usedMB} MB (${percentDisplay})"
            ></div>
            <div 
              class="h-full rounded-full bg-indigo-950/60 flex-1 relative group cursor-pointer"
              title="Bo'sh: ${metrics.freeMB} MB (${metrics.freePercent.toFixed(2)}%)"
            ></div>
          </div>

          <div class="flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2 pt-1">
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>Band qilingan joy: <strong class="text-white">${metrics.usedMB} MB</strong> (${percentDisplay})</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-indigo-950 border border-indigo-400/40"></span>
              <span>Bo'sh xotira: <strong class="text-emerald-300">${Number(metrics.freeMB).toLocaleString()} MB</strong> (${metrics.freePercent.toFixed(2)}%)</span>
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

        <!-- 2-Karta: Bo'sh Xotira Zaxirasi -->
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500">Bo'sh Server Xotirasi</span>
            <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
              </svg>
            </div>
          </div>
          <div class="text-2xl font-black text-emerald-600 leading-tight">
            ${Number(metrics.freeMB).toLocaleString()} <span class="text-xs font-semibold text-slate-500">MB bo'sh</span>
          </div>
          <div class="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
            <div>• Jami kvota: <strong class="text-slate-800">${Number(metrics.totalMB).toLocaleString()} MB (${metrics.totalGB} GB)</strong></div>
            <div>• Band qilingan: <strong class="text-slate-800">${metrics.usedMB} MB</strong> (${percentDisplay})</div>
            <div>• Bo'sh qolgan: <strong class="text-emerald-700 font-bold">${metrics.freePercent.toFixed(2)}%</strong></div>
          </div>
        </div>

        <!-- 3-Karta: Yana Qancha O'quvchi Qo'shish Mumkin -->
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
            <div class="text-emerald-700 font-semibold">• Railway 8 GB bilan cheksiz imkoniyat!</div>
          </div>
        </div>

        <!-- 4-Karta: Tejamkorlik Ko'rsatkichi -->
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
            <span class="text-[11px] font-mono text-slate-500">Firestore + Railway JSON</span>
          </div>

          <div class="divide-y divide-slate-100 text-xs">
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

            <div class="p-4 bg-slate-50 flex items-center justify-between font-bold">
              <div class="text-slate-900">Jami Band Qilingan Xotira:</div>
              <div class="text-right font-mono text-indigo-700">
                <span>${metrics.usedMB} MB</span>
                <span class="text-[11px] font-normal text-slate-500 ml-1">(${percentDisplay})</span>
              </div>
            </div>
          </div>
        </div>

        <!-- O'ng: Interaktiv Sig'im Kalkulyatori -->
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

            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[11px] text-slate-400">Tezkor:</span>
              <button type="button" class="calc-preset-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer" data-val="500">+500</button>
              <button type="button" class="calc-preset-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer" data-val="1000">+1,000</button>
              <button type="button" class="calc-preset-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer" data-val="5000">+5,000</button>
              <button type="button" class="calc-preset-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer" data-val="20000">+20,000</button>
              <button type="button" class="calc-preset-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer" data-val="50000">+50,000</button>
            </div>

            <div id="calc-result-box" class="p-4 rounded-xl bg-gradient-to-br from-emerald-50/80 to-teal-50/40 border border-emerald-200/80 space-y-2">
              <div class="font-bold text-emerald-950 flex items-center justify-between">
                <span>Prognoz Hisob-kitobi:</span>
                <span id="calc-estimated-size" class="font-mono text-emerald-800 text-sm">~1.85 MB</span>
              </div>
              <p id="calc-result-text" class="text-[11.5px] leading-relaxed text-emerald-900">
                1,000 ta qo'shimcha o'quvchi taxminan <strong class="font-mono">1.85 MB</strong> xotira egallaydi. 
                Railway 8 GB (8,192 MB) serverida bu atigi <strong class="font-mono">0.02%</strong> joyni band qiladi.
              </p>
              <div class="pt-1 text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
                <span>Xulosa: Gibrid (Firestore + Railway 8 GB) tizimingiz ushbu yuklamani bemalol ko'tara oladi!</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  `;
}

/**
 * Kalkulyator hamda Baza Tanlash (Railway / Firestore / Both) hodisalarini ulash
 */
export function attachStorageCalculatorEvents(container, avgStudentBytes, options = {}) {
  const { state, onRefreshData, onModeChanged, showToast } = options;

  // 1. Saqlash manbasi tugmalari (Railway 8GB | Firestore 1GB | Both)
  const modeBtns = container.querySelectorAll('.storage-target-mode-btn');
  modeBtns.forEach(btn => {
    btn.onclick = async () => {
      const targetMode = btn.getAttribute('data-storage-mode');
      if (!targetMode) return;
      await setStorageTargetMode(targetMode);
      const label = targetMode === 'railway'
        ? "Railway Server (8 GB) — Yangi ma'lumotlar endi Railway'ga saqlanadi!"
        : targetMode === 'both'
          ? "Gibrid Rejim — Yangi ma'lumotlar bir vaqtda Railway va Firestore'ga saqlanadi!"
          : "Cloud Firestore (1 GB) — Yangi ma'lumotlar Firestore'ga saqlanadi!";
      if (showToast) showToast(label, 'success');
      if (onModeChanged) onModeChanged(targetMode);
    };
  });

  // 2. Firestore'dagi barcha ma'lumotlarni Railway'ga ham xavfsiz nusxalash
  const syncBtn = container.querySelector('#sync-firestore-to-railway-btn');
  if (syncBtn) {
    syncBtn.onclick = async () => {
      syncBtn.disabled = true;
      const origHtml = syncBtn.innerHTML;
      syncBtn.innerHTML = `<span>Nusxalanmoqda...</span>`;
      try {
        const res = await syncAllDataToRailway(state);
        if (showToast) {
          showToast(`Firestore'dagi barcha ma'lumotlar (${res?.syncedCount || 0} ta yozuv) zarar yetkazmasdan Railway 8GB bazasiga ham nusxalandi!`, 'success');
        }
        if (onRefreshData) await onRefreshData();
        if (onModeChanged) onModeChanged(getStorageTargetMode());
      } catch (err) {
        if (showToast) showToast("Railway bazaga nusxalashda xatolik yuz berdi", 'error');
      } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = origHtml;
      }
    };
  }

  // 3. To'liq Zaxira (.JSON) yuklab olish
  const backupBtn = container.querySelector('#download-full-backup-json-btn');
  if (backupBtn) {
    backupBtn.onclick = () => {
      try {
        downloadFullDatabaseBackup(state);
        if (showToast) showToast("To'liq ma'lumotlar bazasi zaxirasi (.JSON) yuklab olindi!", 'success');
      } catch (err) {
        if (showToast) showToast("Zaxira faylni yuklab olishda xatolik", 'error');
      }
    };
  }

  // 4. Sig'im Kalkulyatori
  const calcInput = container.querySelector('#calc-students-count');
  const resultSize = container.querySelector('#calc-estimated-size');
  const resultText = container.querySelector('#calc-result-text');
  const presetBtns = container.querySelectorAll('.calc-preset-btn');

  function updateCalc(count) {
    const safeCount = Math.max(1, parseInt(count) || 1);
    const estBytes = safeCount * (avgStudentBytes || 1850);
    const estMB = (estBytes / (1024 * 1024)).toFixed(2);
    const estKB = (estBytes / 1024).toFixed(1);
    const mode = getStorageTargetMode();
    const capBytes = mode === 'railway' ? TOTAL_RAILWAY_STORAGE_BYTES : TOTAL_FREE_STORAGE_BYTES;
    const capLabel = mode === 'railway' ? 'Railway 8 GB (8,192 MB)' : 'Firestore 1 GB (1,024 MB)';
    const pct = ((estBytes / capBytes) * 100).toFixed(3);

    if (resultSize) {
      resultSize.textContent = estMB >= 1 ? `~${estMB} MB` : `~${estKB} KB`;
    }
    if (resultText) {
      resultText.innerHTML = `
        ${safeCount.toLocaleString()} ta qo'shimcha o'quvchi taxminan <strong class="font-mono">${estMB >= 1 ? estMB + ' MB' : estKB + ' KB'}</strong> xotira egallaydi. 
        Bu ${capLabel} kvotaning atigi <strong class="font-mono">${pct}%</strong> qismini tashkil qiladi.
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
