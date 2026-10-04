/**
 * PIN-kod Sozlamalari Modali
 * Kabinetga kirishni 4 xonali PIN-kod bilan qulflash, o'zgartirish yoki bekor qilish
 */

import { closeModalWithAnimation } from '../utils/modalAnimation.js';
import { showFaceAuthModal } from './faceAuthModal.js';

export function showPinSettingsModal({
  currentUser,
  userRole,
  onSavePin,
  onRemovePin,
  onSaveFaceId,
  onRemoveFaceId,
  onLockNow,
  showToast
}) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const role = currentUser?.role || userRole || 'teacher';
  const data = currentUser?.data || {};
  const currentPin = data.pinCode ? String(data.pinCode) : '';
  const isPinEnabled = Boolean(currentPin);
  const isFaceIdEnabled = Boolean(data.faceIdData?.enabled);

  let roleTitle = "Sinf Rahbari";
  let accountName = data.name || "Kabinet";

  if (role === 'developer') {
    roleTitle = "Tizim Dasturchisi";
    accountName = data.brand || data.name || "WORKING CODE";
  } else if (role === 'admin') {
    roleTitle = "Maktab Administratori";
    accountName = `${data.name || 'Maktab'} (Admin: ${data.adminName || ''})`;
  } else if (role === 'teacher') {
    roleTitle = "Sinf Rahbari";
    accountName = `${data.name || 'Sinf'} (Rahbar: ${data.teacherName || ''})`;
  }

  modalContainer.innerHTML = `
    <div id="pin-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
      <div class="modal-dialog-box bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md my-auto max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden modal-dialog-enter">
        
        <!-- Header -->
        <div class="px-5 sm:px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl ${isPinEnabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/80' : 'bg-indigo-50 text-indigo-600 border border-indigo-200/80'} flex items-center justify-center shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <h2 class="text-base sm:text-lg font-bold text-slate-950 truncate leading-tight">
                Kabinetni PIN-kod bilan qulflash
              </h2>
              <p class="text-xs text-slate-500 mt-0.5 truncate">${accountName}</p>
            </div>
          </div>
          <button id="close-pin-settings-modal-btn" class="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Yopish">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Body Content -->
        <div class="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain text-xs">
          
          <!-- Status Banner -->
          <div class="p-4 rounded-2xl border ${isPinEnabled ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-amber-50/70 border-amber-200 text-amber-900'} flex items-start gap-3">
            <div class="w-8 h-8 rounded-xl ${isPinEnabled ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'} flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              ${isPinEnabled ? `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
              ` : `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                </svg>
              `}
            </div>
            <div class="space-y-1">
              <div class="font-bold flex items-center gap-2">
                <span>${isPinEnabled ? "PIN-kod himoyasi YOQILGAN" : "PIN-kod himoyasi o'rnatilmagan"}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isPinEnabled ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}">
                  ${isPinEnabled ? "Faol" : "O'chiq"}
                </span>
              </div>
              <p class="text-[11.5px] leading-relaxed text-slate-600">
                ${isPinEnabled 
                  ? "Kabinetga har safar kirganingizda (yoki sahifa yangilanganda) o'rnatilgan 4 xonali PIN-kod talab qilinadi." 
                  : "PIN-kod o'rnatilsa, o'z profilingizga kirganingizda doim 4 xonali PIN-kod talab qilinadi va begona shaxslar ma'lumotlarni ko'ra olmaydi."}
              </p>
            </div>
          </div>

          ${isPinEnabled ? `
            <!-- Action to lock immediately -->
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span class="font-bold text-slate-800 text-xs block">Kabinetni hoziroq qulflash</span>
                <span class="text-[11px] text-slate-500">Kompyuterdan vaqtincha uzoqlashayotganda tezkor qulflash</span>
              </div>
              <button 
                type="button" 
                id="modal-lock-now-btn" 
                class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <span>Qulflash</span>
              </button>
            </div>
          ` : ''}

          <!-- Face ID (Yuz bilan kirish) Bo'limi -->
          <div class="p-4 rounded-2xl border ${isFaceIdEnabled ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950' : 'bg-slate-50 border-slate-200 text-slate-900'} space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl ${isFaceIdEnabled ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'} flex items-center justify-center shrink-0 mt-0.5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <div class="font-bold text-xs flex items-center gap-2">
                    <span>Face ID (Yuz bilan kirish)</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isFaceIdEnabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-700'}">
                      ${isFaceIdEnabled ? "Faol (O'rnatilgan)" : "O'rnatilmagan"}
                    </span>
                  </div>
                  <p class="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                    ${isFaceIdEnabled 
                      ? "PIN-kod esdan chiqqanda istalgan qurilmadan yuzingiz orqali 1 soniyada kirishingiz mumkin." 
                      : "PIN-kodni unutib qo'ysangiz ham xavotirsiz istalgan qurilmadan yuzingiz orqali kirish uchun Face ID o'rnating."}
                  </p>
                </div>
              </div>
            </div>

            <div class="pt-1 flex items-center gap-2">
              <button 
                type="button" 
                id="setup-face-id-btn" 
                class="flex-1 py-2.5 px-3 rounded-xl ${isFaceIdEnabled ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border border-indigo-200' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'} font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                </svg>
                <span>${isFaceIdEnabled ? "Yuzni qayta skanerlash (Yangilash)" : "Face ID o'rnatish"}</span>
              </button>

              ${isFaceIdEnabled ? `
                <button 
                  type="button" 
                  id="remove-face-id-btn" 
                  class="py-2.5 px-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs transition-colors cursor-pointer"
                  title="Face ID ni o'chirish"
                >
                  O'chirish
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Form: Set or Change PIN -->
          <form id="pin-setup-form" class="space-y-4">
            
            ${isPinEnabled ? `
              <!-- Old PIN required if changing -->
              <div>
                <label class="block font-bold text-slate-700 mb-1" for="old-pin-input">
                  Amaldagi PIN-kod <span class="text-red-500">*</span>
                </label>
                <input 
                  type="password" 
                  id="old-pin-input" 
                  maxlength="4" 
                  inputmode="numeric" 
                  placeholder="Amaldagi 4 xonali PIN"
                  required
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest text-sm text-center font-bold"
                />
              </div>
            ` : ''}

            <!-- New PIN input -->
            <div>
              <label class="block font-bold text-slate-700 mb-1" for="new-pin-input">
                ${isPinEnabled ? "Yangi 4 xonali PIN-kod" : "4 xonali PIN-kod kiriting"} <span class="text-red-500">*</span>
              </label>
              <input 
                type="password" 
                id="new-pin-input" 
                maxlength="4" 
                inputmode="numeric" 
                placeholder="Masalan: 1234"
                required
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest text-sm text-center font-bold"
              />
              <p class="text-[11px] text-slate-400 mt-1">Faqat 4 ta raqam (0-9) dan iborat bo'lishi lozim</p>
            </div>

            <!-- Confirm New PIN input -->
            <div>
              <label class="block font-bold text-slate-700 mb-1" for="confirm-pin-input">
                PIN-kodni tasdiqlang <span class="text-red-500">*</span>
              </label>
              <input 
                type="password" 
                id="confirm-pin-input" 
                maxlength="4" 
                inputmode="numeric" 
                placeholder="PIN-kodni takrorlang"
                required
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest text-sm text-center font-bold"
              />
            </div>

            <!-- Buttons -->
            <div class="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <button 
                type="submit" 
                class="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                <span>${isPinEnabled ? "Yangi PIN-kodni saqlash" : "PIN-kod himoyasini yoqish"}</span>
              </button>

              ${isPinEnabled ? `
                <button 
                  type="button" 
                  id="disable-pin-btn" 
                  class="w-full sm:w-auto py-2.5 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs transition-colors cursor-pointer"
                  title="PIN-kod himoyasini bekor qilish"
                >
                  Himoyani o'chirish
                </button>
              ` : ''}
            </div>

          </form>

        </div>

      </div>
    </div>
  `;

  const backdrop = modalContainer.querySelector('#pin-modal-backdrop');
  const dialog = modalContainer.querySelector('.modal-dialog-box');
  const closeBtn = modalContainer.querySelector('#close-pin-settings-modal-btn');
  const form = modalContainer.querySelector('#pin-setup-form');
  const lockNowBtn = modalContainer.querySelector('#modal-lock-now-btn');
  const disableBtn = modalContainer.querySelector('#disable-pin-btn');
  const setupFaceBtn = modalContainer.querySelector('#setup-face-id-btn');
  const removeFaceBtn = modalContainer.querySelector('#remove-face-id-btn');

  function closeModal() {
    closeModalWithAnimation(backdrop, dialog, () => {
      modalContainer.innerHTML = '';
    });
  }

  if (closeBtn) closeBtn.onclick = closeModal;
  if (backdrop) {
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal();
    };
  }

  // Face ID sozlash (Enroll)
  if (setupFaceBtn) {
    setupFaceBtn.onclick = () => {
      // Oldingi modal animatsiyasining innerHTML tozalashidan qochish uchun to'g'ridan-to'g'ri ochamiz
      showFaceAuthModal({
        mode: 'enroll',
        currentUser,
        expectedPin: currentPin || data.pinCode || '',
        onSuccess: (faceData) => {
          if (onSaveFaceId) {
            onSaveFaceId(faceData);
          }
        },
        onSaveNewPin: (newPin) => {
          if (onSavePin) {
            onSavePin(newPin);
          }
        },
        showToast
      });
    };
  }

  // Face ID o'chirish
  if (removeFaceBtn) {
    removeFaceBtn.onclick = () => {
      if (onRemoveFaceId) {
        onRemoveFaceId();
      }
      closeModal();
    };
  }

  // Lock now button
  if (lockNowBtn) {
    lockNowBtn.onclick = () => {
      closeModal();
      if (onLockNow) onLockNow();
    };
  }

  // Form submit (save or update pin)
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();

      const newPin = (document.getElementById('new-pin-input')?.value || '').trim();
      const confirmPin = (document.getElementById('confirm-pin-input')?.value || '').trim();

      if (!/^\d{4}$/.test(newPin)) {
        showToast("PIN-kod aynan 4 ta raqamdan iborat bo'lishi shart (masalan: 1234)", 'error');
        return;
      }

      if (newPin !== confirmPin) {
        showToast("Kiritilgan PIN-kodlar bir-biriga mos kelmadi!", 'error');
        return;
      }

      if (isPinEnabled) {
        const oldPin = (document.getElementById('old-pin-input')?.value || '').trim();
        if (oldPin !== currentPin) {
          showToast("Amaldagi PIN-kod noto'g'ri kiritildi!", 'error');
          return;
        }
      }

      if (onSavePin) {
        onSavePin(newPin);
      }
      closeModal();
    };
  }

  // Disable PIN protection
  if (disableBtn) {
    disableBtn.onclick = () => {
      const oldPinInput = document.getElementById('old-pin-input');
      const oldPin = (oldPinInput?.value || '').trim();

      if (!oldPin) {
        showToast("PIN-kod himoyasini o'chirish uchun avval 'Amaldagi PIN-kod' maydonini to'ldiring", 'error');
        oldPinInput?.focus();
        return;
      }

      if (oldPin !== currentPin) {
        showToast("Amaldagi PIN-kod noto'g'ri!", 'error');
        return;
      }

      if (onRemovePin) {
        onRemovePin();
      }
      closeModal();
    };
  }
}
