/**
 * MaktabX - Face ID Yuqori Xavfsizlikdagi Interaktiv Modali
 * Apple Face ID uslubidagi zamonaviy neon skaner doirasi, jonli video tahlil
 * va yuz orqali qat'iy biometrik tekshirish.
 */
import { faceAuthService } from '../services/faceAuthService.js';
import { closeModalWithAnimation } from '../utils/modalAnimation.js';

export function showFaceAuthModal({
  mode = 'verify', // 'verify' | 'enroll' | 'universal_login'
  currentUser = null,
  candidateAccounts = [], // universal_login uchun bazadagi barcha hisoblar
  savedFaceData = null, // verify rejimida tekshirish uchun
  expectedPin = '', // enroll rejimida tekshirish uchun PIN-kod
  onSuccess,
  onSaveNewPin, // Agar hisobda PIN bo'lmasa, yangi kiritilgan PIN ni ham saqlash
  onCancel,
  showToast
}) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const role = currentUser?.role || 'teacher';
  const data = currentUser?.data || {};
  let accountName = data.name || "Kabinet";
  if (role === 'teacher' && data.teacherName) {
    accountName = `${data.name} (${data.teacherName})`;
  } else if (role === 'admin' && data.adminName) {
    accountName = `${data.name} (${data.adminName})`;
  } else if (role === 'developer') {
    accountName = "Bosh Dasturchi";
  } else if (mode === 'universal_login') {
    accountName = "Yuz orqali tezkor kirish";
  }

  const isEnroll = mode === 'enroll';
  const isUniversalLogin = mode === 'universal_login';

  const title = isEnroll 
    ? "Face ID (Yuz bilan kirish)ni o'rnatish" 
    : (isUniversalLogin ? "Face ID orqali tizimga kirish" : "Face ID orqali kirish");
  
  const subtitle = isEnroll 
    ? "Istalgan qurilmadan yuzingiz orqali parolsiz kirish uchun biometriyani saqlang" 
    : (isUniversalLogin ? "Yuzingizni kameraga qarating, tizim sizni avtomatik taniydi" : "PIN-kodsiz kabinetingizni yuzingiz orqali oching");

  modalContainer.innerHTML = `
    <div id="face-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter select-none">
      <div class="modal-dialog-box bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-700/80 w-full max-w-md my-auto overflow-hidden modal-dialog-enter flex flex-col max-h-[calc(100dvh-1.5rem)] relative">
        
        <!-- Yuqori panel -->
        <div class="px-5 sm:px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-400 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-white leading-tight">${title}</h3>
              <p class="text-[11px] text-slate-400 truncate max-w-[220px] sm:max-w-[260px]">${accountName}</p>
            </div>
          </div>

          <button 
            type="button" 
            id="close-face-modal-btn" 
            class="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Yopish"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- ASOSIY SKANNER & VIDEO MAYDONI -->
        <div id="face-scanner-step" class="flex p-5 sm:p-6 flex-1 flex-col items-center justify-center text-center space-y-3.5 overflow-y-auto">
          
          <!-- Skaner Viewport -->
          <div class="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full p-2 flex items-center justify-center overflow-hidden shadow-2xl shadow-indigo-950 shrink-0">
            
            <!-- Tashqi neon aylanuvchi doira -->
            <div id="scanner-ring" class="absolute inset-0 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 border-r-indigo-400 animate-spin transition-all duration-300"></div>

            <!-- Kamera oqimi (Video) -->
            <div class="w-full h-full rounded-full overflow-hidden relative bg-slate-950 border-2 border-indigo-400/50 flex items-center justify-center">
              <video 
                id="face-camera-feed" 
                autoplay 
                playsinline 
                muted 
                class="w-full h-full object-cover -scale-x-100"
              ></video>

              <!-- Yuz ramkasi / Fokus burchaklari (Apple Face ID uslubida) -->
              <div class="absolute inset-4 pointer-events-none border-2 border-dashed border-white/20 rounded-full flex items-center justify-center">
                <div id="face-laser-line" class="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-lg shadow-cyan-400/50 transition-all"></div>
              </div>

              <!-- Muvaffaqiyatli / Xatolik overlay holati -->
              <div id="face-status-overlay" class="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center opacity-0 pointer-events-none transition-opacity duration-300 p-4">
                <div id="face-status-icon" class="w-14 h-14 rounded-full flex items-center justify-center mb-2"></div>
                <div id="face-status-title" class="text-sm sm:text-base font-bold"></div>
                <div id="face-status-sub" class="text-[11px] text-slate-300 mt-1"></div>
              </div>

              <!-- Kamera yuklanmoqda placeholder -->
              <div id="camera-loading-box" class="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-4 space-y-2">
                <div class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-xs">Kamera ishga tushmoqda...</p>
                <p class="text-[10.5px] text-slate-500">Brauzerda kameraga ruxsat bering</p>
              </div>
            </div>

          </div>

          <!-- Ko'rsatma va holat yozuvi -->
          <div class="space-y-1 max-w-xs">
            <div id="face-guide-badge" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-indigo-300 text-xs font-semibold">
              <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span id="face-guide-text">Yuzingizni doira markaziga qarating</span>
            </div>
            <p class="text-[11px] text-slate-400 leading-relaxed pt-0.5">
              ${subtitle}
            </p>
          </div>

          <!-- Progress bar -->
          <div class="w-full max-w-xs bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/60 relative">
            <div id="face-scan-progress" class="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 w-0 transition-all duration-200"></div>
          </div>

          <!-- Kamera ochilmasa ko'rsatiladigan yordamchi blok -->
          <div id="face-error-alert" class="hidden text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 p-3 rounded-2xl text-left max-w-sm space-y-2 leading-relaxed">
            <div class="flex items-center gap-2 font-bold text-amber-400">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span id="face-error-title">Kamera ochilmadi</span>
            </div>
            <p id="face-error-desc" class="text-[11px] text-amber-200/90"></p>
            <div class="flex flex-wrap gap-2 pt-1">
              <button 
                type="button" 
                id="retry-camera-btn" 
                class="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-[11px] font-semibold transition-all cursor-pointer"
              >
                Kamerani qayta yoqish
              </button>
              <button 
                type="button" 
                id="open-new-tab-btn" 
                class="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold transition-all cursor-pointer"
              >
                Yangi oynada ochish
              </button>
            </div>
          </div>

          <!-- Muqobil: Selfie suratga olish yoki rasm yuklash orqali Face ID -->
          <div class="w-full max-w-xs pt-1">
            <input 
              type="file" 
              id="face-image-input" 
              accept="image/*" 
              capture="user" 
              class="hidden" 
            />
            <button 
              type="button" 
              id="trigger-selfie-btn" 
              class="w-full py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 active:scale-98 border border-slate-700 text-indigo-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span>${isEnroll ? "Selfie rasm yuklab o'rnatish" : "Selfie rasm orqali kirish"}</span>
            </button>
            <p class="text-[10px] text-slate-500 text-center mt-1">Kamera ishlamasa, fayl yoki selfi tanlang</p>
          </div>

        </div>

        <!-- Pastki boshqaruv paneli -->
        <div class="px-5 sm:px-6 py-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button 
            type="button" 
            id="cancel-face-btn" 
            class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Bekor qilish
          </button>

          <button 
            type="button" 
            id="action-face-btn" 
            class="flex px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-950 transition-all cursor-pointer items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span id="action-face-btn-label">${isEnroll ? "Qaytadan boshlash" : "Qayta urinish"}</span>
          </button>
        </div>

      </div>
    </div>
  `;

  const backdrop = document.getElementById('face-modal-backdrop');
  const video = document.getElementById('face-camera-feed');
  const loadingBox = document.getElementById('camera-loading-box');
  const guideText = document.getElementById('face-guide-text');
  const progressBar = document.getElementById('face-scan-progress');
  const errorAlert = document.getElementById('face-error-alert');
  const errorDesc = document.getElementById('face-error-desc');
  const retryCameraBtn = document.getElementById('retry-camera-btn');
  const fileInput = document.getElementById('face-image-input');
  const triggerSelfieBtn = document.getElementById('trigger-selfie-btn');
  const closeBtn = document.getElementById('close-face-modal-btn');
  const cancelBtn = document.getElementById('cancel-face-btn');
  const actionBtn = document.getElementById('action-face-btn');
  const actionBtnLabel = document.getElementById('action-face-btn-label');
  const statusOverlay = document.getElementById('face-status-overlay');
  const statusIcon = document.getElementById('face-status-icon');
  const statusTitle = document.getElementById('face-status-title');
  const statusSub = document.getElementById('face-status-sub');
  const laserLine = document.getElementById('face-laser-line');
  const scannerRing = document.getElementById('scanner-ring');

  let isScanning = false;
  let scanTimer = null;
  let progressVal = 0;
  let sampleDescriptors = [];
  let sampleProportions = [];

  function closeModal(callback) {
    if (scanTimer) clearInterval(scanTimer);
    faceAuthService.stopCamera();
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (typeof callback === 'function') callback();
    });
  }

  closeBtn?.addEventListener('click', () => closeModal(onCancel));
  cancelBtn?.addEventListener('click', () => closeModal(onCancel));

  // --- SKANNER VA KAMERA BOSQICHI ---
  retryCameraBtn?.addEventListener('click', () => {
    initCamera();
  });

  triggerSelfieBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  // Fayl tanlanganda (Selfie tahlil qilish)
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      if (guideText) guideText.textContent = "Selfie rasm tahlil qilinmoqda...";
      if (progressBar) progressBar.style.width = '60%';

      const processed = await faceAuthService.processImageFile(file);
      if (progressBar) progressBar.style.width = '100%';

      if (isEnroll) {
        const faceIdRecord = {
          enabled: true,
          version: '3.0-biometric',
          enrolledAt: new Date().toISOString(),
          descriptor: processed.descriptor,
          anthropometrics: processed.anthropometrics,
          proportions: processed.proportions,
          thumbnail: processed.thumbnail
        };
        showSuccessStatus("Face ID o'rnatildi!", "Endi yuzingiz bilan tezkor kira olasiz", () => {
          closeModal(() => {
            if (typeof onSuccess === 'function') onSuccess(faceIdRecord);
          });
        });
      } else if (isUniversalLogin) {
        const matchedAccount = findMatchingAccount(processed.descriptor, processed.anthropometrics, processed.proportions);
        if (matchedAccount) {
          finishUniversalSuccess(matchedAccount);
        } else {
          showFailedStatus("Tizimda topilmadi", "Yuklangan yuzga tegishli hisob topilmadi yoki begona shaxs");
        }
      } else {
        const savedDescriptor = savedFaceData?.descriptor;
        if (!savedDescriptor) {
          showFailedStatus("Face ID topilmadi", "Hisobingizda Face ID hali o'rnatilmagan");
          return;
        }

        const match = faceAuthService.compareWithStoredFace(
          processed.descriptor, 
          savedFaceData, 
          processed.anthropometrics,
          processed.proportions
        );

        if (match.isMatch) {
          finishVerificationSuccess(match);
        } else {
          showFailedStatus("Yuz mos kelmadi", "Yuklangan selfi hisob egasiga mos kelmadi (Begona shaxs)");
        }
      }
    } catch (err) {
      if (progressBar) progressBar.style.width = '0%';
      if (showToast) showToast(err.message || "Rasmni tahlil qilib bo'lmadi", 'error');
      if (guideText) guideText.textContent = err.message || "Rasmdan yuz aniqlanmadi";
      showFailedStatus("Yuz aniqlanmadi", err.message || "Aniqroq selfi yuklang");
    }
  });

  // Kamerani ishga tushirish
  async function initCamera() {
    try {
      if (errorAlert) errorAlert.classList.add('hidden');
      if (loadingBox) loadingBox.classList.remove('hidden');

      await faceAuthService.startCamera(video);
      if (loadingBox) loadingBox.classList.add('hidden');

      startScanningProcess();
    } catch (err) {
      console.warn("Face ID camera init error:", err);
      if (loadingBox) loadingBox.classList.add('hidden');
      if (errorAlert && errorDesc) {
        errorDesc.textContent = (err.message || "Kameraga ulanib bo'lmadi") + ". Brauzer kamera ruxsatini bering yoki pastdagi 'Selfie rasm yuklab o'rnatish' tugmasidan foydalaning.";
        errorAlert.classList.remove('hidden');
      }
      if (guideText) guideText.textContent = "Kamera ruxsati berilmadi";
    }
  }

  // Universal login uchun hisoblar orasidan yuz egasini topish
  function findMatchingAccount(liveDescriptor, liveAnthropometrics, liveProportions) {
    if (!candidateAccounts || candidateAccounts.length === 0) return null;

    let bestMatch = null;
    let highestSim = 0;

    for (const acc of candidateAccounts) {
      const faceData = acc.faceIdData || acc.data?.faceIdData;
      if (!faceData || !faceData.enabled) continue;

      const comp = faceAuthService.compareWithStoredFace(
        liveDescriptor, 
        faceData, 
        liveAnthropometrics,
        liveProportions
      );

      if (comp.isMatch && comp.similarity > highestSim) {
        highestSim = comp.similarity;
        bestMatch = { account: acc, match: comp };
      }
    }

    return bestMatch;
  }

  // Ko'p burchakli (Multi-angle) namunalar
  let centerAngleDescriptors = [];
  let rightAngleDescriptors = [];
  let leftAngleDescriptors = [];
  let upAngleDescriptors = [];
  let sampleAnthropometrics = [];
  let lastCapturedFrame = null;

  // Skanerlash jarayoni (Kamida 6-7 soniya aniqlik bilan ko'p burchakli skanerlash)
  function startScanningProcess() {
    if (isScanning) return;
    isScanning = true;
    progressVal = 0;
    centerAngleDescriptors = [];
    rightAngleDescriptors = [];
    leftAngleDescriptors = [];
    upAngleDescriptors = [];
    sampleProportions = [];
    sampleAnthropometrics = [];
    let consecutiveMatches = 0;
    const REQUIRED_CONSECUTIVE_MATCHES = 2; // Xavfsizlik uchun ketma-ket 2 ta kadrda yuz to'liq tasdiqlanishi shart!

    if (errorAlert) errorAlert.classList.add('hidden');

    if (laserLine) laserLine.classList.add('animate-pulse');
    if (scannerRing) {
      scannerRing.className = 'absolute inset-0 rounded-full border-2 border-indigo-500/40 border-t-cyan-400 border-r-cyan-400 animate-spin';
    }

    if (guideText) {
      guideText.textContent = isEnroll 
        ? "1-bosqich: Kameraga to'g'ri qarang (Markaziy skanerlash)..." 
        : "Yuz aniqlanmoqda...";
    }

    // IsEnroll uchun har 150ms da kadr olinadi: 100% ga yetish uchun ~45 ta muvaffaqiyatli kadr (~6.8 soniya)
    // Verify uchun tezkor va xavfsiz kirish: har 160ms da tekshiriladi
    scanTimer = setInterval(() => {
      if (!video || video.readyState < 2) return;

      const frame = faceAuthService.captureFrameData(video);
      if (!frame) return;

      const result = faceAuthService.extractFaceFeatures(frame.imageData);

      // Agar kamera to'silgan, barmoq bilan yopilgan yoki yuz yo'q bo'lsa
      if (!result.detected) {
        consecutiveMatches = 0;
        if (guideText) {
          guideText.innerHTML = `⚠️ <span class="text-amber-300 font-semibold">${result.reason || "Kameraga to'g'ri qarang..."}</span>`;
        }
        if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, progressVal))}%`;
        return;
      }

      lastCapturedFrame = frame;
      if (result.proportions) sampleProportions.push(result.proportions);
      if (result.anthropometrics) sampleAnthropometrics.push(result.anthropometrics);

      // --- ENROLL REJIMI: 4 TA BURCHAK BO'YICHA 6-7 SONIYALIK INTERAKTIV SKANERLASH ---
      if (isEnroll) {
        progressVal += 2.2; // ~45 qadam * 150ms ≈ 6.8 soniya
        const currProgress = Math.min(100, Math.round(progressVal));
        if (progressBar) progressBar.style.width = `${currProgress}%`;

        // 1-bosqich: To'g'ri qarang (0% - 25%, ~1.7 sek)
        if (currProgress < 25) {
          centerAngleDescriptors.push(result.descriptor);
          if (guideText) {
            guideText.innerHTML = `🎯 <span class="text-cyan-300 font-bold">1-bosqich:</span> Kameraga to'g'ri qarang (${currProgress}%)`;
          }
          if (scannerRing) {
            scannerRing.className = 'absolute inset-0 rounded-full border-2 border-cyan-500/40 border-t-cyan-400 animate-spin';
          }
        }
        // 2-bosqich: Boshni o'ngga burang (25% - 50%, ~1.7 sek)
        else if (currProgress < 50) {
          rightAngleDescriptors.push(result.descriptor);
          if (guideText) {
            guideText.innerHTML = `➡️ <span class="text-amber-300 font-bold">2-bosqich:</span> Boshni sekin o'ng tomonga burang (${currProgress}%)`;
          }
          if (scannerRing) {
            scannerRing.className = 'absolute inset-0 rounded-full border-2 border-amber-500/40 border-t-amber-400 border-r-amber-400 animate-spin';
          }
        }
        // 3-bosqich: Boshni chapga burang (50% - 75%, ~1.7 sek)
        else if (currProgress < 75) {
          leftAngleDescriptors.push(result.descriptor);
          if (guideText) {
            guideText.innerHTML = `⬅️ <span class="text-indigo-300 font-bold">3-bosqich:</span> Boshni sekin chap tomonga burang (${currProgress}%)`;
          }
          if (scannerRing) {
            scannerRing.className = 'absolute inset-0 rounded-full border-2 border-indigo-500/40 border-t-indigo-400 border-l-indigo-400 animate-spin';
          }
        }
        // 4-bosqich: Boshni yuqoriga qarating (75% - 95%, ~1.4 sek)
        else if (currProgress < 95) {
          upAngleDescriptors.push(result.descriptor);
          if (guideText) {
            guideText.innerHTML = `⬆️ <span class="text-purple-300 font-bold">4-bosqich:</span> Boshni biroz yuqoriga qarating (${currProgress}%)`;
          }
          if (scannerRing) {
            scannerRing.className = 'absolute inset-0 rounded-full border-2 border-purple-500/40 border-t-purple-400 animate-spin';
          }
        }
        // 5-bosqich: Yakunlash (95% - 100%)
        else {
          centerAngleDescriptors.push(result.descriptor);
          if (guideText) {
            guideText.innerHTML = `🔒 <span class="text-emerald-300 font-bold">Yakunlanmoqda:</span> 3D Profil saqlanmoqda (100%)`;
          }
          if (scannerRing) {
            scannerRing.className = 'absolute inset-0 rounded-full border-3 border-emerald-400 animate-pulse';
          }
        }

        // 100% ga yetganda 4 ta burchakli to'liq biometrik profilni saqlash
        if (currProgress >= 100) {
          clearInterval(scanTimer);
          finishEnrollmentMultiAngle(lastCapturedFrame, {
            center: centerAngleDescriptors,
            right: rightAngleDescriptors,
            left: leftAngleDescriptors,
            up: upAngleDescriptors
          }, sampleProportions, sampleAnthropometrics, result);
        }
        return;
      }

      // --- KIRISH REJIMI: TEZKOR VA ISHONCHLI TANIB OLISH ---
      progressVal += 5;
      if (progressBar) progressBar.style.width = `${Math.min(100, progressVal)}%`;

      // 2. UNIVERSAL LOGIN REJIMI: barcha hisoblar ichidan qidirish
      if (isUniversalLogin) {
        const matched = findMatchingAccount(result.descriptor, result.anthropometrics, result.proportions);
        if (matched) {
          consecutiveMatches++;
          if (guideText) {
            guideText.innerHTML = `✅ <span class="text-emerald-300 font-bold">Yuz tasdiqlandi (${matched.match.matchPercentage}%)!</span>`;
          }
          if (consecutiveMatches >= REQUIRED_CONSECUTIVE_MATCHES) {
            clearInterval(scanTimer);
            if (progressBar) progressBar.style.width = '100%';
            finishUniversalSuccess(matched);
            return;
          }
        } else {
          consecutiveMatches = 0;
          if (guideText) {
            guideText.innerHTML = `🔍 <span class="text-amber-300 font-bold">Tekshirilmoqda:</span> Hisob qidirilmoqda...`;
          }
          if (progressVal >= 100) {
            clearInterval(scanTimer);
            showFailedStatus("Hisob topilmadi", "Yuzingizga biriktirilgan hisob topilmadi yoki begona shaxs");
            return;
          }
        }
      }

      // 3. SHAXSIY VERIFY REJIMI: joriy hisob yuz ma'lumotlari bilan solishtirish
      if (!isEnroll && !isUniversalLogin) {
        if (!savedFaceData || (!savedFaceData.descriptor && !savedFaceData.multiAngleDescriptors && !savedFaceData.gallery)) {
          clearInterval(scanTimer);
          showFailedStatus("Face ID topilmadi", "Hisobingizda Face ID hali o'rnatilmagan");
          return;
        }

        const match = faceAuthService.compareWithStoredFace(
          result.descriptor, 
          savedFaceData, 
          result.anthropometrics,
          result.proportions
        );

        if (guideText) {
          if (match.isMatch) {
            guideText.innerHTML = `✅ <span class="text-emerald-300 font-bold">Yuz tasdiqlandi (${match.matchPercentage}%)!</span>`;
          } else {
            guideText.innerHTML = `🔍 <span class="text-amber-300 font-bold">Begona shaxs yoki yuz mos kelmadi (${match.matchPercentage}%)</span>`;
          }
        }

        if (match.isMatch) {
          consecutiveMatches++;
          // Ketma-ket 2 ta tasdiqlangan kadr olinganda tizim ochiladi
          if (consecutiveMatches >= REQUIRED_CONSECUTIVE_MATCHES) {
            clearInterval(scanTimer);
            if (progressBar) progressBar.style.width = '100%';
            finishVerificationSuccess(match);
            return;
          }
        } else {
          consecutiveMatches = 0;
          if (progressVal >= 100) {
            clearInterval(scanTimer);
            showFailedStatus("Yuz mos kelmadi", "Kameradagi yuz hisob egasiga mos kelmadi (Begona shaxs rad etildi)");
            return;
          }
        }
      }
    }, 150);
  }

  // O'rtacha deskriptorni hisoblovchi yordamchi funksiya
  function computeAverageDescriptor(descriptors) {
    if (!descriptors || descriptors.length === 0) return null;
    const len = descriptors[0].length;
    const avg = new Array(len).fill(0);
    descriptors.forEach(d => {
      d.forEach((val, i) => {
        avg[i] += (Number.isFinite(val) ? val : 0) / descriptors.length;
      });
    });
    return avg.map(v => Number(v.toFixed(6)));
  }

  // Ko'p burchakli (Multi-angle 3D) Face ID profilini saqlash
  function finishEnrollmentMultiAngle(frame, angleDescriptors, proportionsList, anthropometricsList = [], lastResult = null) {
    const avgCenter = computeAverageDescriptor(angleDescriptors.center) || [];
    const avgRight = computeAverageDescriptor(angleDescriptors.right) || avgCenter;
    const avgLeft = computeAverageDescriptor(angleDescriptors.left) || avgCenter;
    const avgUp = computeAverageDescriptor(angleDescriptors.up) || avgCenter;
    const avgAnthro = computeAverageDescriptor(anthropometricsList) || lastResult?.anthropometrics || [];

    // Eng toza, aniq individual namunalarni galereyaga to'plash
    const gallery = [];
    const pushRepresentative = (arr) => {
      if (!arr || arr.length === 0) return;
      gallery.push(arr[0]);
      if (arr.length > 2) gallery.push(arr[Math.floor(arr.length / 2)]);
    };

    pushRepresentative(angleDescriptors.center);
    pushRepresentative(angleDescriptors.right);
    pushRepresentative(angleDescriptors.left);
    pushRepresentative(angleDescriptors.up);

    // Asosiy frontal deskriptor sifatida markaziy toza deskriptorni olamiz
    const primaryDescriptor = (angleDescriptors.center && angleDescriptors.center.length > 0)
      ? angleDescriptors.center[Math.floor(angleDescriptors.center.length / 2)]
      : (avgCenter.length > 0 ? avgCenter : (gallery[0] || []));

    let avgAspect = 0, avgTopMid = 0, avgMidBot = 0;
    const pLen = Math.max(1, proportionsList.length);
    proportionsList.forEach(p => {
      avgAspect += (p.aspectRatio || 1) / pLen;
      avgTopMid += (p.topMidRatio || 1) / pLen;
      avgMidBot += (p.midBotRatio || 1) / pLen;
    });

    const fb = lastResult?.faceBounds || (frame ? { x: frame.startX, y: frame.startY, width: frame.cropSize, height: frame.cropSize } : null);
    const thumbnail = (frame && fb)
      ? faceAuthService.createThumbnail(frame.fullCanvas, Math.max(fb.width, fb.height), fb.x, fb.y) 
      : (frame ? faceAuthService.createThumbnail(frame.fullCanvas, frame.cropSize, frame.startX, frame.startY) : '');

    const faceIdRecord = {
      enabled: true,
      version: '3.0-biometric',
      enrolledAt: new Date().toISOString(),
      descriptor: primaryDescriptor,
      anthropometrics: avgAnthro,
      gallery,
      multiAngleDescriptors: {
        center: avgCenter,
        right: avgRight,
        left: avgLeft,
        up: avgUp
      },
      sampleDescriptors: [avgCenter, avgRight, avgLeft, avgUp, ...gallery],
      proportions: {
        aspectRatio: Number(avgAspect.toFixed(4)),
        topMidRatio: Number(avgTopMid.toFixed(4)),
        midBotRatio: Number(avgMidBot.toFixed(4)),
        anthropometrics: avgAnthro
      },
      thumbnail
    };

    showSuccessStatus("Face ID muvaffaqiyatli o'rnatildi!", "Barcha burchaklar (3D profil) saqlandi", () => {
      closeModal(() => {
        if (typeof onSuccess === 'function') onSuccess(faceIdRecord);
      });
    });
  }

  // Verify muvaffaqiyatli
  function finishVerificationSuccess(match) {
    showSuccessStatus("Yuz tasdiqlandi!", `Kabinet ochilmoqda... (${match.matchPercentage}% moslik)`, () => {
      closeModal(() => {
        if (typeof onSuccess === 'function') onSuccess();
      });
    });
  }

  // Universal Login muvaffaqiyatli
  function finishUniversalSuccess(matchedData) {
    const acc = matchedData.account;
    const accTitle = acc.data?.teacherName || acc.data?.adminName || acc.data?.name || acc.name || "Hisob";
    showSuccessStatus("Xush kelibsiz!", `${accTitle} hisobiga kirilmoqda...`, () => {
      closeModal(() => {
        if (typeof onSuccess === 'function') onSuccess(acc);
      });
    });
  }

  // Muvaffaqiyatli overlay
  function showSuccessStatus(title, sub, callback) {
    if (statusOverlay && statusIcon && statusTitle && statusSub) {
      statusIcon.className = "w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mb-2 shadow-lg shadow-emerald-500/30";
      statusIcon.innerHTML = `
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
        </svg>
      `;
      statusTitle.className = "text-sm sm:text-base font-bold text-emerald-400";
      statusTitle.textContent = title;
      statusSub.textContent = sub;
      statusOverlay.style.opacity = '1';
    }
    if (scannerRing) {
      scannerRing.className = 'absolute inset-0 rounded-full border-4 border-emerald-400 transition-all';
    }

    setTimeout(() => {
      if (typeof callback === 'function') callback();
    }, 1100);
  }

  // Xatolik overlay
  function showFailedStatus(title, sub) {
    isScanning = false;
    if (statusOverlay && statusIcon && statusTitle && statusSub) {
      statusIcon.className = "w-14 h-14 rounded-full bg-rose-500/20 border-2 border-rose-400 text-rose-400 flex items-center justify-center mb-2 shadow-lg shadow-rose-500/30";
      statusIcon.innerHTML = `
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      `;
      statusTitle.className = "text-sm sm:text-base font-bold text-rose-400";
      statusTitle.textContent = title;
      statusSub.textContent = sub;
      statusOverlay.style.opacity = '1';
    }

    if (actionBtnLabel) {
      actionBtnLabel.textContent = "Qaytadan urinish";
    }

    setTimeout(() => {
      if (statusOverlay) statusOverlay.style.opacity = '0';
    }, 2400);
  }

  // Action button: Qaytadan skanerlashni boshlash
  actionBtn?.addEventListener('click', () => {
    if (scanTimer) clearInterval(scanTimer);
    isScanning = false;
    startScanningProcess();
  });

  // Modal ochilishi bilan kamerani darhol ishga tushirish
  initCamera();
}
