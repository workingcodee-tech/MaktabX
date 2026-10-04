/**
 * MaktabX - Parolni Tiklash Modallari
 * 1. Admin orqali ID bilan tiklash (6 xonali Tiklash ID orqali)
 * 2. Telefonga SMS yuborish (DevSMS.uz 6 talik OTP kod orqali)
 */
import { closeModalWithAnimation } from '../utils/modalAnimation.js';
import { 
  normalizePhone, 
  formatPhoneDisplay, 
  maskPhone, 
  findTeacherByPhone, 
  generateSixDigitOtp, 
  sendOtpSms 
} from '../services/smsService.js';
import { saveData } from '../data.js';
import { saveClassToFirestore, saveRecoveryRequestToFirestore } from '../firebase.js';

export function showRecoveryModal({ state, showToast, initialId = '', onAutoLogin, onPasswordResetSuccess }) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const dev = state?.developer || {
    name: 'WORKING CODE',
    brand: 'WORKING CODE',
    phone: '+998 90 000 12 34',
    telegram: '@diyorbek_dev'
  };

  const cleanPhone = (dev.phone || '+998900001234').replace(/[^0-9+]/g, '');
  const cleanTelegram = (dev.telegram || '@diyorbek_dev').replace('@', '');

  // Holat boshqaruvi - Foydalanuvchi talabi: Birinchi o'rinda ID orqali tiklash ko'rinadi
  let activeTab = 'id'; // 'id' | 'sms'
  let smsStep = 'phone'; // 'phone' | 'otp'
  let currentStep = 'start'; // 'start' | 'pin_verify' | 'new_credentials'
  let targetAccount = null;
  let recoveryMethod = 'id'; // 'id' | 'sms'
  let verifiedPin = '';
  let newPinToSave = '';
  let isPasswordVisible = false;
  let targetTeacher = null;
  let sentOtpCode = '';
  let otpExpiresAt = 0;
  let timerInterval = null;

  function closeModal(callback) {
    if (timerInterval) clearInterval(timerInterval);
    const backdrop = document.getElementById('recovery-modal-backdrop');
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (typeof callback === 'function') callback();
    });
  }

  // Dasturchini har bir muvaffaqiyatli hisob tiklanishi haqida xabardor qilish
  async function notifyDeveloperAboutRecovery(targetClass, method, extraDetails = {}) {
    try {
      const school = state?.schools?.find(s => s.id === targetClass.schoolId);
      const schoolName = school ? school.name : "Maktab";
      const logItem = {
        id: `rec_${Date.now()}_${targetClass.id}`,
        type: 'account_recovered',
        method: method === 'sms' ? 'SMS orqali tiklandi' : 'Admin ID orqali tiklandi',
        methodType: method,
        teacherId: targetClass.id,
        teacherName: targetClass.teacherName || "Sinf Rahbari",
        className: targetClass.name || "Sinf",
        schoolId: targetClass.schoolId || "",
        schoolName: schoolName,
        teacherPhone: targetClass.teacherPhone || "",
        login: extraDetails.newLogin || targetClass.login || "",
        status: 'recovered',
        message: `${targetClass.teacherName || targetClass.name} (${targetClass.name} - ${schoolName}) o'z hisobini ${method === 'sms' ? 'SMS tasdiqlash kodi' : 'Admin ID'} orqali muvaffaqiyatli tikladi.`,
        recoveredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        unreadByDev: true
      };

      if (!state.recoveryRequests) state.recoveryRequests = [];
      state.recoveryRequests.unshift(logItem);
      saveData(state);

      await saveRecoveryRequestToFirestore(logItem);
    } catch (err) {
      console.warn("Dasturchini xabardor qilishda xatolik:", err);
    }
  }

  function renderModal() {
    let headerTitle = "Hisobni qayta tiklash";
    let headerSubtitle = "Login yoki parol unutilganda tiklash";
    let headerIconBg = "bg-indigo-50 text-indigo-600 border-indigo-100";

    if (currentStep === 'pin_verify') {
      headerTitle = "PIN-kodni tasdiqlang";
      headerSubtitle = "Xavfsizlik tekshiruvi (1-bosqich)";
      headerIconBg = "bg-amber-50 text-amber-600 border-amber-100";
    } else if (currentStep === 'new_credentials') {
      headerTitle = "Login va Parol almashtirish";
      headerSubtitle = "Yangi hisob ma'lumotlari (2-bosqich)";
      headerIconBg = "bg-emerald-50 text-emerald-600 border-emerald-100";
    }

    modalContainer.innerHTML = `
      <div id="recovery-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
        <div class="modal-dialog-box bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md my-auto overflow-hidden modal-dialog-enter flex flex-col max-h-[calc(100dvh-2rem)]">
          
          <!-- Header -->
          <div class="px-5 sm:px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl ${headerIconBg} border flex items-center justify-center shrink-0 shadow-2xs">
                ${currentStep === 'pin_verify' ? `
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                ` : currentStep === 'new_credentials' ? `
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                ` : `
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                  </svg>
                `}
              </div>
              <div>
                <h2 class="text-base sm:text-lg font-bold text-slate-950 leading-tight">${headerTitle}</h2>
                <p class="text-xs text-slate-500 mt-0.5">${headerSubtitle}</p>
              </div>
            </div>
            <button id="close-recovery-modal-btn" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Yopish">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Bosqichlar yoki Tablar paneli -->
          ${currentStep === 'start' ? `
            <div class="px-5 sm:px-6 pt-3 pb-1 bg-slate-50/70 border-b border-slate-100 shrink-0">
              <div class="grid grid-cols-2 p-1 bg-slate-200/70 rounded-2xl gap-1 text-xs font-bold">
                <button 
                  type="button" 
                  id="tab-id-btn" 
                  class="py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'id' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
                >
                  <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                  </svg>
                  <span>Admin ID orqali</span>
                </button>

                <button 
                  type="button" 
                  id="tab-sms-btn" 
                  class="py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'sms' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
                >
                  <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                  </svg>
                  <span>SMS orqali</span>
                </button>
              </div>
            </div>
          ` : `
            <div class="px-5 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-100 shrink-0">
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${currentStep === 'pin_verify' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-emerald-500 text-white'}">
                    ${currentStep === 'new_credentials' ? '✓' : '1'}
                  </span>
                  <span class="font-bold ${currentStep === 'pin_verify' ? 'text-indigo-900' : 'text-emerald-700'}">PIN-kod tekshiruvi</span>
                </div>

                <div class="w-8 h-0.5 ${currentStep === 'new_credentials' ? 'bg-emerald-400' : 'bg-slate-200'} rounded-full"></div>

                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${currentStep === 'new_credentials' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-500'}">
                    2
                  </span>
                  <span class="font-bold ${currentStep === 'new_credentials' ? 'text-indigo-900' : 'text-slate-400'}">Yangi Login & Parol</span>
                </div>
              </div>
            </div>
          `}

          <!-- Body Content -->
          <div id="recovery-body-content" class="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
            ${currentStep === 'pin_verify' 
              ? renderPinVerifyBody() 
              : currentStep === 'new_credentials' 
                ? renderNewCredentialsBody() 
                : (activeTab === 'sms' ? renderSmsBody() : renderIdBody())
            }
          </div>

          <!-- Footer -->
          <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <span class="text-xs text-slate-500">
              ${currentStep === 'start' ? 'DevSMS & MaktabX Xavfsizlik xizmati' : 'MaktabX Xavfsiz PIN Himoyasi'}
            </span>
            <div class="flex items-center gap-2">
              ${currentStep !== 'start' ? `
                <button 
                  type="button" 
                  id="back-to-start-btn" 
                  class="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-all cursor-pointer"
                >
                  Orqaga
                </button>
              ` : ''}
              <button 
                type="button" 
                id="cancel-recovery-btn" 
                class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-all cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    setupEvents();
  }

  // BOSQICH 1: SHAXSIY PIN-KODNI TEKSHIRISH (Foydalanuvchi talabi: eng avval PIN kod so'ralsin)
  function renderPinVerifyBody() {
    const acc = targetAccount || {};
    const school = state?.schools?.find(s => s.id === acc.schoolId);
    const schoolName = school ? school.name : "Maktab";
    const hasPin = Boolean(acc.pinCode);

    return `
      <div class="space-y-4">
        <!-- O'qituvchi ma'lumoti kartasi -->
        <div class="p-3.5 rounded-2xl bg-indigo-50/90 border border-indigo-200/90 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              <span>Hisob aniqlandi</span>
            </span>
            <span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold ${recoveryMethod === 'sms' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
              ✓ ${recoveryMethod === 'sms' ? 'SMS tasdiqlandi' : 'ID tasdiqlandi'}
            </span>
          </div>

          <div class="bg-white/80 p-2.5 rounded-xl border border-indigo-100/80 flex items-center justify-between">
            <div>
              <div class="text-xs font-extrabold text-slate-900">${acc.teacherName || 'Sinf rahbari'}</div>
              <div class="text-[11px] text-slate-500 font-medium">${acc.name}-sinf • ${schoolName}</div>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-slate-400 block uppercase font-mono font-semibold">Login (ID)</span>
              <span class="text-xs font-mono font-bold text-indigo-600">${acc.login || acc.name}</span>
            </div>
          </div>

          <p class="text-[11.5px] text-slate-600 leading-relaxed pt-0.5">
            Hisob xavfsizligini ta'minlash maqsadida login va parolni almashtirishdan oldin <strong>4 xonali shaxsiy PIN-kodingizni</strong> kiriting:
          </p>
        </div>

        <!-- PIN-kod kiritish formasi -->
        <form id="recovery-pin-form" class="space-y-4 pt-1">
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label for="recovery-pin-input" class="text-xs font-bold text-slate-700">
                ${hasPin ? 'Shaxsiy PIN-kodingiz' : 'Yangi 4 xonali PIN-kod belgilang'}
              </label>
              <span class="text-[11px] text-indigo-600 font-semibold font-mono">4 xonali</span>
            </div>

            <div class="relative">
              <input 
                type="password" 
                id="recovery-pin-input" 
                maxlength="6"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="• • • •"
                autocomplete="off"
                class="w-full py-3.5 px-4 bg-slate-50 border border-slate-200/90 rounded-2xl text-center text-2xl font-mono font-black tracking-[0.45em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-300 placeholder:tracking-[0.25em]"
              />
              <div class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
            </div>

            <div id="recovery-pin-error-msg" class="hidden mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1.5 p-2 bg-rose-50 rounded-xl border border-rose-100">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span id="recovery-pin-error-text">Noto'g'ri PIN-kod</span>
            </div>
          </div>

          <button 
            type="submit" 
            id="recovery-pin-submit-btn"
            class="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-semibold text-sm shadow-md shadow-indigo-200 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>PIN-kodni tasdiqlash</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
          </button>
        </form>

        <!-- PIN esdan chiqqanda Dasturchiga murojaat bo'limi -->
        <div class="pt-3 border-t border-slate-100 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-700">PIN-kodingizni eslay olmaysizmi?</span>
            <span class="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-semibold">Xavfsizlik</span>
          </div>
          <p class="text-[11.5px] text-slate-500 leading-relaxed">
            Hisob xavfsizligi sababli, PIN-kod kiritilmasdan parolni almashtirib bo'lmaydi. PIN-kodni tiklash uchun tizim Dasturchisiga murojaat qiling:
          </p>
          <div class="grid grid-cols-2 gap-2 pt-0.5">
            <a 
              href="tel:${cleanPhone}"
              class="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
            >
              <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>Qo'ng'iroq</span>
            </a>

            <a 
              href="https://t.me/${cleanTelegram}"
              target="_blank"
              rel="noopener noreferrer"
              class="p-2 rounded-xl bg-[#229ED9] hover:bg-[#1e8ec3] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              <span>Telegram</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // BOSQICH 2: PIN-KOD TO'G'RI BO'LGACH LOGIN VA PAROLNI ALMASHTIRISH OYNASI
  function renderNewCredentialsBody() {
    const acc = targetAccount || {};
    return `
      <div class="space-y-4">
        <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
          <div class="flex items-center gap-2 text-emerald-800 font-bold text-xs">
            <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            </svg>
            <span>PIN-kod to'g'ri tasdiqlandi!</span>
          </div>
          <p class="text-[11.5px] text-slate-600 leading-relaxed">
            Hisobingiz: <strong>${acc.teacherName || ''}</strong> (${acc.name}-sinf rahbarligi).
            Endi kabinetingiz uchun yangi login va parolni belgilang:
          </p>
        </div>

        <form id="new-credentials-form" class="space-y-3.5 pt-1">
          <div>
            <label for="new-login-input" class="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Yangi Login (ID) <span class="text-red-500">*</span></span>
              <span class="text-[11px] text-slate-400">O'zgartirishingiz mumkin</span>
            </label>
            <div class="relative">
              <input 
                type="text" 
                id="new-login-input" 
                value="${acc.login || acc.name || ''}"
                required
                class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/90 rounded-2xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              />
              <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label for="new-pwd-input" class="block text-xs font-semibold text-slate-700 mb-1.5">
              Yangi Parol <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input 
                type="${isPasswordVisible ? 'text' : 'password'}" 
                id="new-pwd-input" 
                placeholder="Yangi maxfiy parolni kiriting" 
                required
                class="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200/90 rounded-2xl text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              />
              <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              <button 
                type="button" 
                id="toggle-pwd-visibility-btn" 
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                title="${isPasswordVisible ? 'Yashirish' : 'Ko\'rish'}"
              >
                ${isPasswordVisible ? `
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>
                  </svg>
                ` : `
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                `}
              </button>
            </div>
          </div>

          <div id="new-cred-error-msg" class="hidden mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span id="new-cred-error-text">Iltimos, maydonlarni to'ldiring</span>
          </div>

          <button 
            type="submit" 
            id="save-new-cred-btn"
            class="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-semibold text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Saqlash va hisobga kirish</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
          </button>
        </form>
      </div>
    `;
  }

  // 1-TAB: ADMIN ORQALI ID BILAN TIKLASH
  function renderIdBody() {
    return `
      <!-- Tushuntirish bildirishnomasi -->
      <div class="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3">
        <div class="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <p class="text-slate-700 text-xs leading-relaxed">
          Maktab ma'muri yoki tizim dasturchisi tomonidan sizga berilgan <strong>6 xonali Tiklash ID</strong> raqamini kiriting.
        </p>
      </div>

      <!-- Tiklash ID kiritish formasi -->
      <form id="recovery-id-form" class="space-y-3.5 pt-1">
        <div>
          <label for="recovery-id-input" class="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
            <span>Tiklash ID raqamingiz</span>
            <span class="text-[11px] text-slate-400 font-normal">6 xonali raqam</span>
          </label>
          <div class="relative">
            <input 
              type="text" 
              id="recovery-id-input" 
              value="${initialId || ''}"
              placeholder="Masalan: 742918"
              maxlength="15"
              autocomplete="off"
              class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200/90 rounded-2xl text-base font-mono font-bold tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal"
            />
            <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
              </svg>
            </div>
          </div>
          <div id="recovery-error-msg" class="hidden mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span id="recovery-error-text">Bunday Tiklash ID topilmadi</span>
          </div>
        </div>

        <button 
          type="submit" 
          id="recovery-submit-btn"
          class="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-semibold text-sm shadow-md shadow-amber-200 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Hisobga kirish</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
          </svg>
        </button>
      </form>

      <!-- Tiklash ID sini bilmaganlar uchun Dasturchiga murojaat bo'limi -->
      <div class="pt-3 border-t border-slate-100">
        <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-800">Tiklash ID raqamingizni bilmaysizmi?</span>
            <span class="text-[10.5px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Dasturchi yordami</span>
          </div>
          <p class="text-[11.5px] text-slate-500 leading-relaxed">
            Agar sizda Tiklash ID bo'lmasa, hisobingizni tiklash uchun tizim Dasturchisiga murojaat qiling:
          </p>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <a 
              href="tel:${cleanPhone}"
              class="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
            >
              <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>Qo'ng'iroq</span>
            </a>

            <a 
              href="https://t.me/${cleanTelegram}"
              target="_blank"
              rel="noopener noreferrer"
              class="p-2 rounded-xl bg-[#229ED9] hover:bg-[#1e8ec3] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              <span>Telegram</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // 2-TAB: TELEFONGA SMS YUBORISH ORQALI TIKLASH
  function renderSmsBody() {
    // 1-bosqich: Telefon raqamini kiritish
    if (smsStep === 'phone') {
      return `
        <div class="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-start gap-3">
          <div class="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
          </div>
          <p class="text-slate-700 text-xs leading-relaxed">
            Admin sizni tizimga qo'shganda kiritgan telefon raqamingizni kiriting. Ushbu raqamga <strong>6 talik tasdiqlash kodi</strong> SMS tarzida yuboriladi.
          </p>
        </div>

        <form id="sms-phone-form" class="space-y-4 pt-1">
          <div>
            <label for="sms-phone-input" class="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>O'qituvchi telefon raqami</span>
              <span class="text-[11px] text-emerald-600 font-medium">O'zbekiston (+998)</span>
            </label>
            <div class="relative">
              <input 
                type="tel" 
                id="sms-phone-input" 
                placeholder="+998 90 123 45 67"
                autocomplete="tel"
                class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200/90 rounded-2xl text-base font-mono font-bold tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal"
              />
              <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
              </div>
            </div>
            <div id="sms-phone-error-msg" class="hidden mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span id="sms-phone-error-text">Telefon raqami topilmadi</span>
            </div>
          </div>

          <button 
            type="submit" 
            id="sms-send-code-btn"
            class="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-semibold text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span id="sms-send-btn-text">SMS kodni yuborish</span>
            <svg id="sms-send-btn-icon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
          </button>
        </form>

        <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-[11.5px] text-slate-500 space-y-1">
          <p class="font-semibold text-slate-700 flex items-center gap-1.5">
            <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Eslatma:</span>
          </p>
          <p>Telefon raqam admin o'qituvchini (sinf rahbarini) qo'shgan vaqtda kiritilgan raqam bilan to'liq mos bo'lishi shart.</p>
        </div>
      `;
    }

    // 2-bosqich: 6 talik SMS kodni kiritish
    if (smsStep === 'otp') {
      const masked = maskPhone(targetTeacher?.teacherPhone || '');
      return `
        <!-- Xabarnoma -->
        <div class="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              <span>SMS yuborildi: <strong class="font-mono text-indigo-700">${masked}</strong></span>
            </span>
            <button 
              type="button" 
              id="change-phone-btn" 
              class="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
            >
              Raqamni o'zgartirish
            </button>
          </div>
          <p class="text-slate-600 text-xs">
            O'qituvchi: <strong>${targetTeacher?.teacherName || 'Sinf rahbari'}</strong> (${targetTeacher?.name || ''}-sinf)
          </p>
        </div>

        <!-- 6 talik OTP Formasi -->
        <form id="sms-otp-form" class="space-y-4 pt-1">
          <div>
            <label for="sms-otp-input" class="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>6 xonali tasdiqlash kodi</span>
              <span id="sms-timer-text" class="font-mono text-xs font-bold text-slate-500">02:00</span>
            </label>

            <div class="relative">
              <input 
                type="text" 
                id="sms-otp-input" 
                maxlength="6"
                placeholder="• • • • • •"
                autocomplete="one-time-code"
                class="w-full py-3.5 px-4 bg-slate-50 border border-slate-200/90 rounded-2xl text-center text-2xl font-mono font-black tracking-[0.4em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-300 placeholder:tracking-[0.25em]"
              />
            </div>

            <div id="sms-otp-error-msg" class="hidden mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span id="sms-otp-error-text">Tasdiqlash kodi noto'g'ri</span>
            </div>
          </div>

          <button 
            type="submit" 
            id="sms-verify-btn"
            class="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-semibold text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Kodni tasdiqlash</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </button>

          <div class="flex items-center justify-center pt-1">
            <button 
              type="button" 
              id="resend-sms-btn" 
              disabled
              class="text-xs font-semibold text-slate-400 hover:text-emerald-700 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              Kodni qayta yuborish
            </button>
          </div>
        </form>
      `;
    }

    return '';
  }

  function startOtpTimer(durationSeconds = 120) {
    if (timerInterval) clearInterval(timerInterval);
    otpExpiresAt = Date.now() + durationSeconds * 1000;

    const timerEl = document.getElementById('sms-timer-text');
    const resendBtn = document.getElementById('resend-sms-btn');

    function update() {
      const remaining = Math.max(0, Math.round((otpExpiresAt - Date.now()) / 1000));
      const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
      const secs = String(remaining % 60).padStart(2, '0');

      if (timerEl) {
        timerEl.textContent = `${mins}:${secs}`;
      }

      if (remaining <= 0) {
        clearInterval(timerInterval);
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.classList.remove('text-slate-400');
          resendBtn.classList.add('text-emerald-600', 'hover:underline');
        }
      }
    }

    update();
    timerInterval = setInterval(update, 1000);
  }

  function setupEvents() {
    const backdrop = document.getElementById('recovery-modal-backdrop');
    const closeBtn = document.getElementById('close-recovery-modal-btn');
    const cancelBtn = document.getElementById('cancel-recovery-btn');
    const tabSmsBtn = document.getElementById('tab-sms-btn');
    const tabIdBtn = document.getElementById('tab-id-btn');

    closeBtn?.addEventListener('click', () => closeModal());
    cancelBtn?.addEventListener('click', () => closeModal());
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const backToStartBtn = document.getElementById('back-to-start-btn');
    backToStartBtn?.addEventListener('click', () => {
      if (currentStep === 'new_credentials') {
        currentStep = 'pin_verify';
        renderModal();
      } else if (currentStep === 'pin_verify') {
        currentStep = 'start';
        renderModal();
      }
    });

    // 1-BOSQICH: BOSHLANG'ICH TIKLASH USULLARI (ADMIN ID YOKI SMS)
    if (currentStep === 'start') {
      tabSmsBtn?.addEventListener('click', () => {
        if (activeTab !== 'sms') {
          activeTab = 'sms';
          renderModal();
        }
      });

      tabIdBtn?.addEventListener('click', () => {
        if (activeTab !== 'id') {
          activeTab = 'id';
          renderModal();
        }
      });

      // 1-TAB EVENTLARI (ID orqali)
      if (activeTab === 'id') {
        const form = document.getElementById('recovery-id-form');
        const idInput = document.getElementById('recovery-id-input');
        const errorMsg = document.getElementById('recovery-error-msg');
        const errorText = document.getElementById('recovery-error-text');

        if (idInput) {
          setTimeout(() => idInput.focus(), 100);
          idInput.addEventListener('input', () => {
            if (errorMsg) errorMsg.classList.add('hidden');
          });
        }

        form?.addEventListener('submit', (e) => {
          e.preventDefault();
          const enteredVal = (idInput?.value || '').trim();
          if (!enteredVal) {
            if (errorText) errorText.textContent = "Iltimos, Tiklash ID raqamini kiriting";
            if (errorMsg) errorMsg.classList.remove('hidden');
            idInput?.focus();
            return;
          }

          const cleanDigits = enteredVal.replace(/\D/g, '');
          const rawUpper = enteredVal.toUpperCase().replace(/\s+/g, '');

          const matchedClass = state?.classes?.find(c => {
            const cRecDigits = (c.recoveryId || '').replace(/\D/g, '');
            const cId = String(c.id || '');
            return (
              (cleanDigits && cRecDigits && cleanDigits === cRecDigits) ||
              c.recoveryId === rawUpper ||
              cId === rawUpper ||
              cId === enteredVal
            );
          });

          if (matchedClass) {
            targetAccount = matchedClass;
            recoveryMethod = 'id';
            // Foydalanuvchi talabi: to'g'ridan-to'g'ri kirmasdan eng avval PIN kod so'ralsin!
            currentStep = 'pin_verify';
            renderModal();
            return;
          }

          const matchedSchool = state?.schools?.find(s => {
            const sId = String(s.id || '');
            return sId === enteredVal || sId === rawUpper;
          });

          if (matchedSchool) {
            targetAccount = matchedSchool;
            recoveryMethod = 'id';
            // Maktab admin hisobi uchun ham avval PIN tekshiruvi
            currentStep = 'pin_verify';
            renderModal();
            return;
          }

          if (errorText) errorText.textContent = "Bunday Tiklash ID topilmadi. Raqamni tekshirib qayta kiriting";
          if (errorMsg) errorMsg.classList.remove('hidden');
          idInput?.select();
        });
      }

      // 2-TAB EVENTLARI (SMS orqali)
      if (activeTab === 'sms') {
        // 1-bosqich: Telefon raqamini yuborish
        if (smsStep === 'phone') {
          const phoneForm = document.getElementById('sms-phone-form');
          const phoneInput = document.getElementById('sms-phone-input');
          const errorMsg = document.getElementById('sms-phone-error-msg');
          const errorText = document.getElementById('sms-phone-error-text');
          const sendBtn = document.getElementById('sms-send-code-btn');
          const sendBtnText = document.getElementById('sms-send-btn-text');

          if (phoneInput) {
            setTimeout(() => phoneInput.focus(), 100);
            phoneInput.addEventListener('input', () => {
              if (errorMsg) errorMsg.classList.add('hidden');
            });
          }

          phoneForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const enteredPhone = (phoneInput?.value || '').trim();

            if (!enteredPhone) {
              if (errorText) errorText.textContent = "Iltimos, telefon raqamingizni kiriting";
              if (errorMsg) errorMsg.classList.remove('hidden');
              phoneInput?.focus();
              return;
            }

            // Admin kiritgan sinflar (o'qituvchilar) orasidan qidirish
            const found = findTeacherByPhone(state?.classes || [], enteredPhone);

            if (!found) {
              if (errorText) errorText.textContent = "Ushbu telefon raqami tizimdagi hech bir o'qituvchiga biriktirilmagan";
              if (errorMsg) errorMsg.classList.remove('hidden');
              phoneInput?.select();
              return;
            }

            targetTeacher = found;
            targetAccount = found;

            // 6 talik kod generatsiyasi
            sentOtpCode = generateSixDigitOtp();

            // Yuklanish indikatori
            if (sendBtn) sendBtn.disabled = true;
            if (sendBtnText) sendBtnText.textContent = "SMS yuborilmoqda...";

            const res = await sendOtpSms({
              phone: targetTeacher.teacherPhone,
              code: sentOtpCode,
              teacherName: targetTeacher.teacherName,
              className: targetTeacher.name
            });

            if (sendBtn) sendBtn.disabled = false;
            if (sendBtnText) sendBtnText.textContent = "SMS kodni yuborish";

            if (res.success) {
              if (showToast) {
                showToast("6 talik tasdiqlash kodi telefoningizga yuborildi!", "success");
              }
              smsStep = 'otp';
              renderModal();
              startOtpTimer(120);
            } else {
              // DevSMS limiti tugagan bo'lsa yoki boshqa xatolik yuz bersa, hech qanday demo kod berilmaydi
              const errMsg = res.error || "SMS yuborishda xatolik yuz berdi";
              if (errorText) errorText.textContent = errMsg;
              if (errorMsg) errorMsg.classList.remove('hidden');
              if (showToast) showToast(errMsg, "error");
            }
          });
        }

        // 2-bosqich: 6 talik kodni tekshirish
        if (smsStep === 'otp') {
          const otpForm = document.getElementById('sms-otp-form');
          const otpInput = document.getElementById('sms-otp-input');
          const errorMsg = document.getElementById('sms-otp-error-msg');
          const errorText = document.getElementById('sms-otp-error-text');
          const resendBtn = document.getElementById('resend-sms-btn');
          const changePhoneBtn = document.getElementById('change-phone-btn');

          if (otpInput) {
            setTimeout(() => otpInput.focus(), 100);
            otpInput.addEventListener('input', () => {
              if (errorMsg) errorMsg.classList.add('hidden');
              if (otpInput.value.replace(/\D/g, '').length === 6) {
                otpForm?.requestSubmit();
              }
            });
          }

          changePhoneBtn?.addEventListener('click', () => {
            if (timerInterval) clearInterval(timerInterval);
            smsStep = 'phone';
            renderModal();
          });

          resendBtn?.addEventListener('click', async () => {
            if (!targetTeacher) return;
            sentOtpCode = generateSixDigitOtp();
            resendBtn.disabled = true;
            resendBtn.textContent = "Yuborilmoqda...";

            const res = await sendOtpSms({
              phone: targetTeacher.teacherPhone,
              code: sentOtpCode,
              teacherName: targetTeacher.teacherName,
              className: targetTeacher.name
            });

            if (res.success) {
              if (showToast) {
                showToast("Yangi tasdiqlash kodi yuborildi!", "success");
              }
              resendBtn.textContent = "Kodni qayta yuborish";
              startOtpTimer(120);
            } else {
              const errMsg = res.error || "SMS yuborib bo'lmadi";
              if (showToast) showToast(errMsg, "error");
              resendBtn.textContent = "Kodni qayta yuborish";
              resendBtn.disabled = false;
            }
          });

          otpForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const enteredOtp = (otpInput?.value || '').replace(/\D/g, '');

            if (!enteredOtp || enteredOtp.length !== 6) {
              if (errorText) errorText.textContent = "Iltimos, 6 xonali tasdiqlash kodini to'liq kiriting";
              if (errorMsg) errorMsg.classList.remove('hidden');
              otpInput?.focus();
              return;
            }

            if (enteredOtp !== sentOtpCode) {
              if (errorText) errorText.textContent = "Kiritilgan kod noto'g'ri. Qaytadan urinib ko'ring";
              if (errorMsg) errorMsg.classList.remove('hidden');
              otpInput?.select();
              return;
            }

            // SMS kod to'g'ri tasdiqlandi!
            if (timerInterval) clearInterval(timerInterval);
            if (showToast) showToast("SMS kod muvaffaqiyatli tasdiqlandi!", "success");

            targetAccount = targetTeacher;
            recoveryMethod = 'sms';
            // Foydalanuvchi talabi: eng avval PIN kod so'ralsin!
            currentStep = 'pin_verify';
            renderModal();
          });
        }
      }
    }

    // 2-BOSQICH: SHAXSIY PIN-KODNI TEKSHIRISH (Foydalanuvchi talabi)
    if (currentStep === 'pin_verify') {
      const pinForm = document.getElementById('recovery-pin-form');
      const pinInput = document.getElementById('recovery-pin-input');
      const errorMsg = document.getElementById('recovery-pin-error-msg');
      const errorText = document.getElementById('recovery-pin-error-text');

      if (pinInput) {
        setTimeout(() => pinInput.focus(), 100);
        pinInput.addEventListener('input', () => {
          if (errorMsg) errorMsg.classList.add('hidden');
          // 4 xonali PIN kiritilgach avtomatik tasdiqlashga tayyorlash
          const cleanDigits = pinInput.value.replace(/\D/g, '');
          if (cleanDigits.length === 4) {
            pinForm?.requestSubmit();
          }
        });
      }

      pinForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredPin = (pinInput?.value || '').replace(/\D/g, '');

        if (!enteredPin || enteredPin.length < 4) {
          if (errorText) errorText.textContent = "Iltimos, 4 xonali PIN-kodni to'liq kiriting";
          if (errorMsg) errorMsg.classList.remove('hidden');
          pinInput?.focus();
          return;
        }

        const expectedPin = targetAccount?.pinCode ? String(targetAccount.pinCode).trim() : null;

        if (expectedPin) {
          if (enteredPin !== expectedPin) {
            if (errorText) errorText.textContent = "Kiritilgan PIN-kod noto'g'ri! Qayta urinib ko'ring yoki Dasturchiga murojaat qiling";
            if (errorMsg) errorMsg.classList.remove('hidden');
            pinInput?.select();
            return;
          }
        }

        // PIN muvaffaqiyatli tasdiqlandi (yoki yangi biriktirildi)
        verifiedPin = enteredPin;
        if (!expectedPin && targetAccount) {
          targetAccount.pinCode = enteredPin;
        }

        if (showToast) showToast("PIN-kod to'g'ri tasdiqlandi!", "success");

        // Endi yangi Login va Parolni o'rnatish oynasiga ruxsat beriladi
        currentStep = 'new_credentials';
        renderModal();
      });
    }

    // 3-BOSQICH: PIN KOD TEKSHIRILGACH YANGI LOGIN VA PAROL O'RNATISH
    if (currentStep === 'new_credentials') {
      const credForm = document.getElementById('new-credentials-form');
      const newLoginInput = document.getElementById('new-login-input');
      const newPwdInput = document.getElementById('new-pwd-input');
      const errorMsg = document.getElementById('new-cred-error-msg');
      const errorText = document.getElementById('new-cred-error-text');
      const togglePwdBtn = document.getElementById('toggle-pwd-visibility-btn');

      if (newPwdInput) {
        setTimeout(() => newPwdInput.focus(), 100);
      }

      togglePwdBtn?.addEventListener('click', () => {
        isPasswordVisible = !isPasswordVisible;
        if (newPwdInput) {
          newPwdInput.type = isPasswordVisible ? 'text' : 'password';
        }
        togglePwdBtn.title = isPasswordVisible ? 'Yashirish' : "Ko'rish";
      });

      credForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newLogin = (newLoginInput?.value || '').trim();
        const newPwd = (newPwdInput?.value || '').trim();

        if (!newLogin || !newPwd) {
          if (errorText) errorText.textContent = "Yangi login va yangi parol kiritilishi shart";
          if (errorMsg) errorMsg.classList.remove('hidden');
          return;
        }

        if (newPwd.length < 3) {
          if (errorText) errorText.textContent = "Parol kamida 3 ta belgidan iborat bo'lishi kerak";
          if (errorMsg) errorMsg.classList.remove('hidden');
          return;
        }

        // 1. Sinf (o'qituvchi) hisobi bo'lsa
        const clsIdx = state?.classes?.findIndex(c => c.id === targetAccount?.id);
        if (clsIdx >= 0) {
          state.classes[clsIdx].login = newLogin;
          state.classes[clsIdx].password = newPwd;
          if (verifiedPin) {
            state.classes[clsIdx].pinCode = verifiedPin;
          }
          targetAccount.login = newLogin;
          targetAccount.password = newPwd;
          if (verifiedPin) {
            targetAccount.pinCode = verifiedPin;
          }

          saveData(state);

          try {
            await saveClassToFirestore(state.classes[clsIdx]);
          } catch (fsErr) {
            console.warn("Firestore saqlash:", fsErr);
          }
        } else {
          // 2. Maktab (admin) hisobi bo'lsa
          const schIdx = state?.schools?.findIndex(s => s.id === targetAccount?.id);
          if (schIdx >= 0) {
            state.schools[schIdx].login = newLogin;
            state.schools[schIdx].password = newPwd;
            if (verifiedPin) {
              state.schools[schIdx].pinCode = verifiedPin;
            }
            targetAccount.login = newLogin;
            targetAccount.password = newPwd;
            if (verifiedPin) {
              targetAccount.pinCode = verifiedPin;
            }

            saveData(state);

            try {
              await saveSchoolToFirestore(state.schools[schIdx]);
            } catch (fsErr) {
              console.warn("Firestore maktab saqlash:", fsErr);
            }
          }
        }

        // Dasturchini xabardor qilish
        await notifyDeveloperAboutRecovery(targetAccount, recoveryMethod, { newLogin });

        closeModal(() => {
          if (showToast) showToast("Hisobingiz muvaffaqiyatli tiklandi va ma'lumotlar saqlandi!", "success");
          if (typeof onAutoLogin === 'function') {
            onAutoLogin(targetAccount);
          }
        });
      });
    }
  }

  renderModal();
}

/**
 * 2. PIN-kod (kirish kodi) unutilganda: To'g'ridan-to'g'ri Dasturchiga murojaat qilish modali
 */
export function showPinRecoveryModal({ state, showToast, currentUser, onUnlockWithFaceId }) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const dev = state?.developer || {
    name: 'WORKING CODE',
    brand: 'WORKING CODE',
    phone: '+998 90 000 12 34',
    telegram: '@diyorbek_dev'
  };

  const cleanPhone = (dev.phone || '+998900001234').replace(/[^0-9+]/g, '');
  const cleanTelegram = (dev.telegram || '@diyorbek_dev').replace('@', '');

  const role = currentUser?.role || 'teacher';
  const data = currentUser?.data || {};
  let accountInfo = data.name || "Kabinet";
  if (role === 'developer') {
    accountInfo = "Bosh Dasturchi kabineti";
  } else if (role === 'admin') {
    accountInfo = `${data.name || 'Maktab'} Admin kabineti`;
  } else if (role === 'teacher') {
    accountInfo = `${data.name || ''}-sinf rahbari (${data.teacherName || ''})`;
  }

  function closeModal(callback) {
    const backdrop = document.getElementById('pin-recovery-modal-backdrop');
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (typeof callback === 'function') callback();
    });
  }

  modalContainer.innerHTML = `
    <div id="pin-recovery-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
      <div class="modal-dialog-box bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md my-auto overflow-hidden modal-dialog-enter flex flex-col max-h-[calc(100dvh-2rem)]">
        
        <div class="px-5 sm:px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 shadow-2xs">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-base sm:text-lg font-bold text-slate-950 leading-tight">PIN-kodni qayta tiklash</h2>
              <p class="text-xs text-slate-500 mt-0.5">Xavfsizlik xizmati orqali tiklash</p>
            </div>
          </div>
          <button id="close-pin-recovery-modal-btn" class="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Yopish">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div class="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-100 flex items-start gap-3">
            <div class="w-7 h-7 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div>
              <p class="text-slate-800 text-xs font-bold leading-relaxed">PIN-kod esdan chiqqan taqdirda:</p>
              <p class="text-slate-600 text-xs mt-1 leading-relaxed">
                Platforma xavfsizligini ta'minlash maqsadida 4 xonali PIN-kod faqat tizim Dasturchisi tomonidan tiklab beriladi.
              </p>
            </div>
          </div>

          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
            <div class="text-slate-500 text-[11px] font-semibold uppercase">Murojaat qiluvchi:</div>
            <div class="font-bold text-slate-900">${accountInfo}</div>
          </div>

          <div class="grid grid-cols-2 gap-2.5 pt-1">
            <a 
              href="tel:${cleanPhone}"
              class="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition-all cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              <span>Qo'ng'iroq qilish</span>
            </a>

            <a 
              href="https://t.me/${cleanTelegram}"
              target="_blank"
              rel="noopener noreferrer"
              class="p-3 rounded-2xl bg-[#229ED9] hover:bg-[#1e8ec3] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-200 transition-all cursor-pointer"
            >
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              <span>Telegram orqali</span>
            </a>
          </div>
        </div>

        <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-500">MaktabX Xavfsizlik xizmati</span>
          <button 
            type="button" 
            id="cancel-pin-recovery-btn" 
            class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-all cursor-pointer"
          >
            Yopish
          </button>
        </div>

      </div>
    </div>
  `;

  const closeBtn = document.getElementById('close-pin-recovery-modal-btn');
  const cancelBtn = document.getElementById('cancel-pin-recovery-btn');
  const backdrop = document.getElementById('pin-recovery-modal-backdrop');

  closeBtn?.addEventListener('click', () => closeModal());
  cancelBtn?.addEventListener('click', () => closeModal());
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
}
