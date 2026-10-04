/**
 * MaktabX - Sinf Rahbari PIN-kodini O'zgartirish Sahifasi
 * Avvalgi PIN-kodni tekshirish, yangi 4 xonali PIN-kod o'rnatish va tasdiqlash
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTeacherChangePinView(container, {
  state,
  currentClass,
  onSavePin,
  onRemovePin,
  onBack,
  showToast
}) {
  const hasExistingPin = Boolean(currentClass.pinCode && String(currentClass.pinCode).trim().length === 4);

  function render() {
    container.innerHTML = `
      <div class="max-w-xl mx-auto space-y-4 sm:space-y-6 animate-fade-in text-slate-800 pb-12">
        
        <!-- Yuqori Navigatsiya & Sarlavha -->
        <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button 
              id="btn-pin-back"
              type="button"
              class="p-2 sm:p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer shrink-0 active:scale-95"
              title="Sozlamalarga qaytish"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div>
              <h1 class="text-base sm:text-lg font-black text-slate-900 leading-tight">
                ${hasExistingPin ? "PIN-kodni O'zgartirish" : "Yangi PIN-kod O'rnatish"}
              </h1>
              <p class="text-xs text-slate-500">
                ${escapeHtml(currentClass.name)} • ${escapeHtml(currentClass.teacherName || "Sinf Rahbari")}
              </p>
            </div>
          </div>

          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            hasExistingPin 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' 
              : 'bg-amber-50 text-amber-700 border border-amber-200/80'
          }">
            <span class="w-2 h-2 rounded-full ${hasExistingPin ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
            ${hasExistingPin ? "PIN Faol" : "PIN O'rnatilmagan"}
          </span>
        </div>

        <!-- Asosiy Forma Kartasi -->
        <div class="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm space-y-5">
          
          <div class="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 flex items-start gap-3">
            <span class="text-xl shrink-0">🔢</span>
            <div class="text-xs text-indigo-950 leading-relaxed">
              <p class="font-bold">PIN-kod haqida ma'lumot:</p>
              <p class="mt-0.5 text-indigo-800">
                4 xonali shaxsiy PIN-kod kabinetingizni himoyalaydi. Har safar dasturga kirganingizda ushbu kod so'raladi.
              </p>
            </div>
          </div>

          <form id="form-change-teacher-pin" class="space-y-4">
            
            ${hasExistingPin ? `
              <!-- 1. Avvalgi PIN-kod -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Avvalgi (Joriy) PIN-kod: <span class="text-red-500">*</span></span>
                  <span class="text-[11px] font-normal text-slate-400">4 ta raqam</span>
                </label>
                <input 
                  type="password" 
                  id="input-current-pin" 
                  required
                  maxlength="4"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  placeholder="••••"
                  class="w-full px-4 py-3 text-center tracking-widest text-lg font-mono font-bold bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  autocomplete="off"
                />
              </div>

              <hr class="border-slate-100 my-1" />
            ` : ''}

            <!-- 2. Yangi PIN-kod -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Yangi 4 xonali PIN-kod: <span class="text-red-500">*</span></span>
                <span class="text-[11px] font-normal text-slate-400">Masalan: 1234</span>
              </label>
              <input 
                type="password" 
                id="input-new-pin" 
                required
                maxlength="4"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                class="w-full px-4 py-3 text-center tracking-widest text-lg font-mono font-bold bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                autocomplete="off"
              />
            </div>

            <!-- 3. Yangi PIN-kodni Tasdiqlash -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Yangi PIN-kodni Tasdiqlang: <span class="text-red-500">*</span></span>
                <span class="text-[11px] font-normal text-slate-400">Qayta kiriting</span>
              </label>
              <input 
                type="password" 
                id="input-confirm-pin" 
                required
                maxlength="4"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                class="w-full px-4 py-3 text-center tracking-widest text-lg font-mono font-bold bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                autocomplete="off"
              />
            </div>

            <!-- Tugmalar -->
            <div class="pt-4 space-y-2.5">
              <div class="flex flex-col sm:flex-row items-center gap-3">
                <button 
                  type="submit" 
                  id="btn-submit-pin"
                  class="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>PIN-kodni Saqlash</span>
                </button>

                <button 
                  type="button" 
                  id="btn-cancel-pin"
                  class="w-full sm:w-auto py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
                >
                  Bekor qilish
                </button>
              </div>

              ${hasExistingPin ? `
                <div class="pt-2 text-center">
                  <button 
                    type="button" 
                    id="btn-remove-existing-pin" 
                    class="text-xs font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer py-1"
                  >
                    PIN-kodni o'chirish (Bekor qilish)
                  </button>
                </div>
              ` : ''}
            </div>

          </form>

        </div>

      </div>
    `;

    // Orqaga qaytish
    document.getElementById('btn-pin-back')?.addEventListener('click', onBack);
    document.getElementById('btn-cancel-pin')?.addEventListener('click', onBack);

    // PIN o'chirish
    document.getElementById('btn-remove-existing-pin')?.addEventListener('click', () => {
      const curPinVal = (document.getElementById('input-current-pin')?.value || '').trim();
      const actualPin = String(currentClass.pinCode || '').trim();

      if (!curPinVal) {
        if (showToast) showToast("PIN-kodni o'chirish uchun avvalgi PIN-kodni kiriting", "warning");
        document.getElementById('input-current-pin')?.focus();
        return;
      }

      if (curPinVal !== actualPin) {
        if (showToast) showToast("Avvalgi PIN-kod noto'g'ri kiritildi!", "error");
        return;
      }

      if (confirm("Haqiqatan ham kabinetingizdan PIN-kod himoyasini o'chirmoqchimisiz?")) {
        if (onRemovePin) onRemovePin();
      }
    });

    // Forma saqlash
    const form = document.getElementById('form-change-teacher-pin');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Agar PIN bor bo'lsa, avvalgi PINni tekshirish
        if (hasExistingPin) {
          const curPinVal = (document.getElementById('input-current-pin')?.value || '').trim();
          const actualPin = String(currentClass.pinCode || '').trim();
          if (curPinVal !== actualPin) {
            if (showToast) showToast("Avvalgi PIN-kod noto'g'ri kiritildi!", "error");
            document.getElementById('input-current-pin')?.focus();
            return;
          }
        }

        // 2. Yangi PIN tekshiruvi
        const newPinVal = (document.getElementById('input-new-pin')?.value || '').trim();
        const cnfPinVal = (document.getElementById('input-confirm-pin')?.value || '').trim();

        if (!/^\d{4}$/.test(newPinVal)) {
          if (showToast) showToast("Yangi PIN-kod aynan 4 ta raqamdan iborat bo'lishi lozim", "warning");
          document.getElementById('input-new-pin')?.focus();
          return;
        }

        // 3. Tasdiqlash tekshiruvi
        if (newPinVal !== cnfPinVal) {
          if (showToast) showToast("Yangi PIN-kod va uni tasdiqlash mos kelmadi!", "warning");
          document.getElementById('input-confirm-pin')?.focus();
          return;
        }

        if (onSavePin) {
          await onSavePin(newPinVal);
        }
      });
    }
  }

  render();
}
