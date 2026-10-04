/**
 * Sayt va Dasturchi Haqida Modali (About Modal)
 * Barcha foydalanuvchilar va mehmonlar uchun ochiq, chiroyli va qulay
 */
import { closeModalWithAnimation } from '../utils/modalAnimation.js';

export function showAboutModal({ siteInfo, developer, isDeveloper = false, onOpenSettings }) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const info = siteInfo || {
    title: 'MaktabX',
    subtitle: "Ta'lim va O'quvchilar Boshqaruv Tizimi",
    description: "MaktabX - maktablar, sinflar va o'quvchilarning barcha rasmiy ma'lumotlarini qulay, xavfsiz va markazlashgan holda yuritish, rasmiy dosyelarni chop etish va yuklab olish tizimi.",
    version: '1.0.0',
    supportPhone: '+998 90 000 12 34',
    supportTelegram: '@diyorbek_dev',
    supportEmail: 'diyorbek.dev1510@gmail.com',
    releaseYear: '2026'
  };

  const dev = developer || {
    name: 'WORKING CODE',
    brand: 'WORKING CODE',
    phone: '+998 90 000 12 34',
    telegram: '@diyorbek_dev',
    email: 'diyorbek.dev1510@gmail.com',
    bio: "MaktabX axborot tizimi asoschisi va dasturiy ta'minot muallifi - WORKING CODE brendi."
  };

  const cleanPhone = dev.phone ? dev.phone.replace(/[^0-9+]/g, '') : '';
  const tgUser = dev.telegram ? dev.telegram.replace('@', '') : 'diyorbek_dev';

  modalContainer.innerHTML = `
    <div id="about-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
      <div class="modal-dialog-box bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden modal-dialog-enter">
        
        <!-- Header -->
        <div class="px-5 sm:px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <img 
              src="/maktabx-logo.png" 
              alt="MaktabX Logo" 
              class="w-10 h-10 object-contain drop-shadow-xs" 
              referrerPolicy="no-referrer"
            />
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base sm:text-lg font-bold text-slate-950">${info.title || 'MaktabX'}</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  v${info.version || '1.0.0'}
                </span>
              </div>
              <p class="text-xs text-slate-500">${info.subtitle || "Ta'lim va O'quvchilar Boshqaruv Tizimi"}</p>
            </div>
          </div>
          <button id="close-about-modal-btn" class="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Yopish">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain text-sm">
          
          <!-- Sayt haqida tavsif -->
          <div class="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-2">
            <div class="flex items-center gap-2 text-xs font-bold text-slate-800">
              <svg class="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Platforma haqida</span>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed">
              ${info.description || "MaktabX - maktablar, sinflar va o'quvchilar ma'lumotlarini qulay, xavfsiz va markazlashgan holda yuritish, rasmiy dosyelarni chop etish va yuklab olish tizimi. WORKING CODE brendi tomonidan yaratilgan."}
            </p>
          </div>

          <!-- Dasturchi (Muallif) Bloki -->
          <div class="p-4 bg-white rounded-2xl border border-indigo-100 shadow-xs space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-center p-1 shrink-0">
                  <img src="/working-code-logo.svg" alt="Working Code Logo" class="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Platforma Muallifi & Yaratuvchisi</h3>
                  <div class="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span>WORKING CODE</span>
                    <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Brend
                    </span>
                  </div>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                Rasmiy IT Dasturchi
              </span>
            </div>

            <p class="text-xs text-slate-600 italic">
              "${dev.bio || "MaktabX axborot tizimi asoschisi va dasturiy ta'minot muallifi - WORKING CODE brendi."}"
            </p>

            <!-- Aloqa tugmalari -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              ${dev.phone ? `
                <a 
                  href="tel:${cleanPhone}" 
                  class="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors text-xs font-semibold"
                  title="Qo'ng'iroq qilish"
                >
                  <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  <span>Qo'ng'iroq</span>
                </a>
              ` : ''}

              ${dev.telegram ? `
                <a 
                  href="https://t.me/${tgUser}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors text-xs font-semibold"
                  title="Telegram orqali yozish"
                >
                  <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/>
                  </svg>
                  <span>Telegram</span>
                </a>
              ` : ''}

              ${dev.email ? `
                <a 
                  href="mailto:${dev.email}" 
                  class="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors text-xs font-semibold"
                  title="Email orqali yozish"
                >
                  <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <span>Email</span>
                </a>
              ` : ''}
            </div>
          </div>

          <!-- Qo'llab-quvvatlash va Tizim afzalliklari -->
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Xavfsizlik</span>
              <span class="font-semibold text-slate-700">Cloud Firestore Realtime Sync</span>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Eksport</span>
              <span class="font-semibold text-slate-700">Word, Excel, PDF dosye</span>
            </div>
          </div>

          ${isDeveloper ? `
            <!-- Dasturchi uchun tezkor tahrirlash havolasi -->
            <div class="p-3 bg-purple-50/80 rounded-xl border border-purple-200 flex items-center justify-between gap-2">
              <span class="text-xs text-purple-900 font-medium">Ushbu ma'lumotlarni o'zgartirmoqchimisiz?</span>
              <button 
                id="about-go-settings-btn"
                type="button" 
                class="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors cursor-pointer"
              >
                Sozlamalarni ochish
              </button>
            </div>
          ` : ''}

        </div>

        <!-- Footer -->
        <div class="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>© ${info.releaseYear || '2026'} ${info.title || 'MaktabX'}</span>
          <button 
            id="close-about-modal-bottom-btn"
            type="button"
            class="px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-semibold transition-colors cursor-pointer"
          >
            Yopish
          </button>
        </div>

      </div>
    </div>
  `;

  const backdrop = document.getElementById('about-modal-backdrop');

  const closeModal = (callback) => {
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (typeof callback === 'function') callback();
    });
  };

  document.getElementById('close-about-modal-btn')?.addEventListener('click', () => closeModal());
  document.getElementById('close-about-modal-bottom-btn')?.addEventListener('click', () => closeModal());

  document.getElementById('about-go-settings-btn')?.addEventListener('click', () => {
    closeModal(() => {
      if (onOpenSettings) onOpenSettings();
    });
  });

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }
}
