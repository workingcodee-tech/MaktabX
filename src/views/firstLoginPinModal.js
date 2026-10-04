/**
 * Birinchi marta kirganda Majburiy PIN-kod o'rnatish modali
 * Yangi Admin yoki yangi O'qituvchi o'z hisobiga 1-marotaba kirayotganda 
 * kabinet xavfsizligi uchun 4 xonali PIN-kod o'rnatishi SHART!
 */
import { closeModalWithAnimation } from '../utils/modalAnimation.js';

export function showFirstLoginPinModal({
  currentUser,
  onSavePin,
  onCancelLogout,
  showToast
}) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const role = currentUser?.role || 'teacher';
  const data = currentUser?.data || {};

  let accountTitle = "Sinf Rahbari";
  let accountName = data.name || "Kabinet";

  if (role === 'admin') {
    accountTitle = "Maktab Administratori";
    accountName = `${data.name || 'Maktab'} (Admin: ${data.adminName || ''})`;
  } else if (role === 'teacher') {
    accountTitle = "Sinf Rahbari";
    accountName = `${data.name || 'Sinf'} (Rahbar: ${data.teacherName || ''})`;
  }

  modalContainer.innerHTML = `
    <div id="first-pin-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
      <div class="modal-dialog-box bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md my-auto overflow-hidden modal-dialog-enter flex flex-col max-h-[calc(100dvh-2rem)]">
        
        <!-- Header -->
        <div class="px-6 py-4.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-sm">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div>
              <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold tracking-wider uppercase mb-0.5">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Majburiy xavfsizlik bosqichi</span>
              </div>
              <h2 class="text-base sm:text-lg font-bold leading-tight">PIN-kod o'rnatish</h2>
            </div>
          </div>
        </div>

        <!-- Body Content -->
        <div class="p-6 overflow-y-auto flex-1 space-y-4.5">
          
          <!-- Xush kelibsiz tabrigi va hisob ma'lumoti -->
          <div class="text-center space-y-1">
            <h3 class="text-lg font-bold text-slate-900">Xush kelibsiz!</h3>
            <p class="text-xs text-slate-600 leading-relaxed">
              Hisobingizga 1-marotaba kirayotganingiz munosabati bilan kabinetingiz xavfsizligini ta'minlash uchun <strong>4 xonali shaxsiy PIN-kod</strong> o'rnatishingiz shart.
            </p>
            <div class="mt-2 inline-block px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
              ${accountTitle}: <span class="text-indigo-600 font-bold">${accountName}</span>
            </div>
          </div>

          <!-- PIN-kod kiritish formasi -->
          <form id="first-pin-form" class="space-y-4 pt-1">
            
            <!-- Yangi PIN -->
            <div>
              <label for="first-new-pin" class="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Yangi 4 xonali PIN-kod</span>
                <span class="text-[11px] text-slate-400 font-normal">Faqat 4 ta raqam</span>
              </label>
              <div class="relative">
                <input 
                  type="password" 
                  id="first-new-pin" 
                  inputmode="numeric" 
                  pattern="[0-9]*" 
                  maxlength="4" 
                  placeholder="••••" 
                  autocomplete="off"
                  required
                  class="w-full text-center tracking-[0.6em] font-mono text-xl sm:text-2xl font-bold py-3 bg-slate-50 border border-slate-200/90 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
                />
                <button 
                  type="button" 
                  id="toggle-pin-visibility-btn" 
                  class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title="PIN-kodni ko'rsatish/yashirish"
                >
                  <svg id="eye-icon-pin" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- PIN-kodni tasdiqlash -->
            <div>
              <label for="first-confirm-pin" class="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>PIN-kodni qayta kiriting</span>
                <span class="text-[11px] text-slate-400 font-normal">Tasdiqlash</span>
              </label>
              <input 
                type="password" 
                id="first-confirm-pin" 
                inputmode="numeric" 
                pattern="[0-9]*" 
                maxlength="4" 
                placeholder="••••" 
                autocomplete="off"
                required
                class="w-full text-center tracking-[0.6em] font-mono text-xl sm:text-2xl font-bold py-3 bg-slate-50 border border-slate-200/90 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
              />
            </div>

            <div id="first-pin-error" class="hidden p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <svg class="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span id="first-pin-error-text">PIN-kodlar mos kelmadi</span>
            </div>

            <!-- ⚠️ DIQQAT VA ESLATMALAR BLOKI -->
            <div class="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-2.5">
              <div class="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <span class="text-base">📌</span>
                <span>Xavfsizlik uchun muhim eslatmalar:</span>
              </div>
              <ul class="text-[11.5px] text-amber-900/90 space-y-1.5 list-disc pl-4 leading-relaxed">
                <li>
                  <strong>PIN-kodni unutmang:</strong> Ushbu 4 xonali kodni eslab qoling yoki daftaringizga qayd eting.
                </li>
                <li>
                  <strong>Doimiy himoya:</strong> Har safar kabinetga kirganingizda va sahifa yangilanganda shu PIN-kod talab qilinadi.
                </li>
                <li>
                  <strong>Unutilganda:</strong> Agar PIN-kod esingizdan chiqsa, uni faqat tizim Dasturchisiga murojaat qilib bekor qildirishingiz mumkin.
                </li>
              </ul>
            </div>

            <!-- Tasdiqlash tugmasi -->
            <button 
              type="submit" 
              id="submit-first-pin-btn"
              class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-indigo-200 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span>PIN-kodni tasdiqlash va kabinetga o'tish</span>
            </button>
          </form>

        </div>

        <!-- Footer: Majburiy ekanligi sababli faqat "Hisobdan chiqish" tugmasi -->
        <div class="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span class="text-[11px] text-slate-400">PIN-kod o'rnatmasdan kirib bo'lmaydi</span>
          <button 
            type="button" 
            id="cancel-first-pin-logout-btn" 
            class="text-xs text-red-600 hover:text-red-800 font-semibold hover:underline cursor-pointer py-1"
          >
            Hisobdan chiqish
          </button>
        </div>

      </div>
    </div>
  `;

  const newPinInput = document.getElementById('first-new-pin');
  const confirmPinInput = document.getElementById('first-confirm-pin');
  const form = document.getElementById('first-pin-form');
  const errorBox = document.getElementById('first-pin-error');
  const errorText = document.getElementById('first-pin-error-text');
  const toggleVisibilityBtn = document.getElementById('toggle-pin-visibility-btn');
  const logoutBtn = document.getElementById('cancel-first-pin-logout-btn');

  // Avtofokus
  setTimeout(() => newPinInput?.focus(), 100);

  // Faqat raqam qabul qilish
  [newPinInput, confirmPinInput].forEach(inp => {
    inp?.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (errorBox) errorBox.classList.add('hidden');
      if (inp === newPinInput && inp.value.length === 4) {
        confirmPinInput?.focus();
      }
    });
  });

  // Ko'rsatish/yashirish
  let isVisible = false;
  toggleVisibilityBtn?.addEventListener('click', () => {
    isVisible = !isVisible;
    const type = isVisible ? 'text' : 'password';
    if (newPinInput) newPinInput.type = type;
    if (confirmPinInput) confirmPinInput.type = type;
  });

  // Chiqish tugmasi
  logoutBtn?.addEventListener('click', () => {
    const backdrop = document.getElementById('first-pin-modal-backdrop');
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (typeof onCancelLogout === 'function') onCancelLogout();
    });
  });

  // Form submit
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin1 = (newPinInput?.value || '').trim();
    const pin2 = (confirmPinInput?.value || '').trim();

    if (!pin1 || pin1.length !== 4) {
      if (errorText) errorText.textContent = "PIN-kod aniq 4 xonali raqam bo'lishi kerak";
      if (errorBox) errorBox.classList.remove('hidden');
      newPinInput?.focus();
      return;
    }

    if (pin1 !== pin2) {
      if (errorText) errorText.textContent = "Kiritilgan PIN-kodlar bir-biriga mos kelmadi";
      if (errorBox) errorBox.classList.remove('hidden');
      confirmPinInput?.focus();
      return;
    }

    // Saqlash
    const backdrop = document.getElementById('first-pin-modal-backdrop');
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (typeof onSavePin === 'function') {
        onSavePin(pin1);
      }
    });
  });
}
