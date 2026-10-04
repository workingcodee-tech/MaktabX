/**
 * MaktabX - Sinf Rahbari Login va Parolini Yangilash Sahifasi
 * Avvalgi parolni tasdiqlash, yangi login va yangi parol orqali xavfsiz yangilash
 * (SMS orqali emas, bevosita joriy parol tekshiruvi bilan)
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

export function renderTeacherChangeCredentialsView(container, {
  state,
  currentClass,
  onSaveCredentials,
  onBack,
  showToast
}) {
  function render() {
    container.innerHTML = `
      <div class="max-w-xl mx-auto space-y-4 sm:space-y-6 animate-fade-in text-slate-800 pb-12">
        
        <!-- Yuqori Navigatsiya & Sarlavha -->
        <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button 
              id="btn-creds-back"
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
                Login va Parolni Yangilash
              </h1>
              <p class="text-xs text-slate-500">
                ${escapeHtml(currentClass.name)} • ${escapeHtml(currentClass.teacherName || "Sinf Rahbari")}
              </p>
            </div>
          </div>

          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
            🔑 Xavfsizlik
          </span>
        </div>

        <!-- Asosiy Forma Kartasi -->
        <div class="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm space-y-5">
          
          <div class="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3">
            <span class="text-xl shrink-0">🛡️</span>
            <div class="text-xs text-amber-900 leading-relaxed">
              <p class="font-bold">Xavfsizlik qoidasi:</p>
              <p class="mt-0.5 text-amber-800">
                Hisobingiz ma'lumotlarini yangilash uchun, avval <strong>amaldagi parolingizni</strong> to'g'ri kiritishingiz shart.
              </p>
            </div>
          </div>

          <form id="form-change-teacher-creds" class="space-y-4">
            
            <!-- 1. Avvalgi (Joriy) Parol -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Avvalgi (Joriy) Parol: <span class="text-red-500">*</span></span>
              </label>
              <div class="relative">
                <input 
                  type="password" 
                  id="input-current-password" 
                  required
                  placeholder="Amaldagi parolingizni kiriting"
                  class="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition-all pr-11"
                  autocomplete="current-password"
                />
                <button 
                  type="button" 
                  id="toggle-cur-pass" 
                  class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  title="Parolni ko'rsatish/yashirish"
                >
                  <svg class="w-5 h-5 eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <hr class="border-slate-100 my-1" />

            <!-- 2. Yangi Login -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Yangi Login: <span class="text-red-500">*</span></span>
                <span class="text-[11px] font-normal text-slate-400">Joriy: ${escapeHtml(currentClass.login || 'kiritilmagan')}</span>
              </label>
              <input 
                type="text" 
                id="input-new-login" 
                required
                value="${escapeHtml(currentClass.login || '')}"
                placeholder="Yangi login kiriting"
                class="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition-all"
                autocomplete="username"
              />
            </div>

            <!-- 3. Yangi Parol -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5">
                Yangi Parol: <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <input 
                  type="password" 
                  id="input-new-password" 
                  required
                  placeholder="Kamida 4 ta belgidan iborat yangi parol"
                  class="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition-all pr-11"
                  autocomplete="new-password"
                />
                <button 
                  type="button" 
                  id="toggle-new-pass" 
                  class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  title="Parolni ko'rsatish/yashirish"
                >
                  <svg class="w-5 h-5 eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- 4. Yangi Parolni Qayta Kiriting -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5">
                Yangi Parolni Tasdiqlang: <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <input 
                  type="password" 
                  id="input-confirm-password" 
                  required
                  placeholder="Yangi parolni qayta kiriting"
                  class="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition-all pr-11"
                  autocomplete="new-password"
                />
                <button 
                  type="button" 
                  id="toggle-cnf-pass" 
                  class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  title="Parolni ko'rsatish/yashirish"
                >
                  <svg class="w-5 h-5 eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Tugmalar -->
            <div class="pt-4 flex flex-col sm:flex-row items-center gap-3">
              <button 
                type="submit" 
                id="btn-submit-creds"
                class="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                <span>Login va Parolni Saqlash</span>
              </button>

              <button 
                type="button" 
                id="btn-cancel-creds"
                class="w-full sm:w-auto py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
              >
                Bekor qilish
              </button>
            </div>

          </form>

        </div>

      </div>
    `;

    // Orqaga qaytish
    document.getElementById('btn-creds-back')?.addEventListener('click', onBack);
    document.getElementById('btn-cancel-creds')?.addEventListener('click', onBack);

    // Parol ko'rish tugmalari
    const bindToggle = (btnId, inputId) => {
      const btn = document.getElementById(btnId);
      const input = document.getElementById(inputId);
      if (btn && input) {
        btn.addEventListener('click', () => {
          input.type = input.type === 'password' ? 'text' : 'password';
        });
      }
    };
    bindToggle('toggle-cur-pass', 'input-current-password');
    bindToggle('toggle-new-pass', 'input-new-password');
    bindToggle('toggle-cnf-pass', 'input-confirm-password');

    // Forma yuborish
    const form = document.getElementById('form-change-teacher-creds');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassInput = document.getElementById('input-current-password')?.value || '';
        const newLoginInput = (document.getElementById('input-new-login')?.value || '').trim();
        const newPassInput = document.getElementById('input-new-password')?.value || '';
        const confirmPassInput = document.getElementById('input-confirm-password')?.value || '';

        // 1. Avvalgi parolni tekshirish
        const actualPassword = currentClass.password || '';
        if (currentPassInput !== actualPassword) {
          if (showToast) {
            showToast("Avvalgi parol noto'g'ri kiritildi! Iltimos, amaldagi parolingizni to'g'ri kiriting.", "error");
          }
          document.getElementById('input-current-password')?.focus();
          return;
        }

        // 2. Yangi login tekshiruvi
        if (!newLoginInput) {
          if (showToast) showToast("Iltimos, yangi loginni kiriting", "warning");
          return;
        }

        // Login bandligini tekshirish (o'zidan boshqa sinflar bilan to'qnashmasligi)
        const isDuplicateLogin = (state.classes || []).some(
          c => c.id !== currentClass.id && String(c.login || '').trim().toLowerCase() === newLoginInput.toLowerCase()
        );
        if (isDuplicateLogin) {
          if (showToast) showToast("Ushbu login boshqa sinf tomonidan band qilingan. Boshqa login tanlang.", "warning");
          return;
        }

        // 3. Yangi parol tekshiruvi
        if (newPassInput.length < 4) {
          if (showToast) showToast("Yangi parol kamida 4 ta belgidan iborat bo'lishi lozim", "warning");
          return;
        }

        // 4. Tasdiqlash paroli
        if (newPassInput !== confirmPassInput) {
          if (showToast) showToast("Yangi parol va uni tasdiqlash mos kelmadi!", "warning");
          return;
        }

        // Saqlash chaqirig'i
        if (onSaveCredentials) {
          await onSaveCredentials(newLoginInput, newPassInput);
        }
      });
    }
  }

  render();
}
