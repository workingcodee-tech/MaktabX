/**
 * MaktabX - Sinf Rahbari uchun Yo'riqnoma va Qo'llab-quvvatlash Sahifasi
 * Aynan o'qituvchiga tegishli platforma imkoniyatlari va Working Code dasturchisi bilan aloqa
 */

import { formatReadableDate } from '../data.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTeacherHelpView(container, {
  state,
  currentClass,
  initialSection = 'help', // 'help' | 'support'
  onBack,
  showToast
}) {
  let activeSection = initialSection; // 'help' | 'support'

  const developer = state.developer || {
    brand: 'WORKING CODE',
    name: 'WORKING CODE',
    phone: '+998 90 000 12 34',
    telegram: '@diyorbek_dev',
    email: 'diyorbek.dev1510@gmail.com'
  };

  const tgClean = (developer.telegram || '@diyorbek_dev').replace('@', '');
  const phoneClean = (developer.phone || '+998900001234').replace(/[^0-9+]/g, '');

  function render() {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-in text-slate-800">
        
        <!-- Yuqori Navigatsiya & Tablar -->
        <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button 
              id="btn-help-back"
              class="p-2 sm:p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0 active:scale-95"
              title="Orqaga qaytish"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div>
              <h1 class="text-base sm:text-lg font-black text-slate-900 leading-tight">
                ${activeSection === 'help' ? "O'qituvchi Yo'riqnomasi" : "Dasturchi bilan Bog'lanish"}
              </h1>
              <p class="text-xs text-slate-500">
                ${activeSection === 'help' 
                  ? "Sinf rahbari uchun platformaning ishlash tizimi va qoidalari" 
                  : "WORKING CODE texnik ko'mak va qo'llab-quvvatlash xizmati"}
              </p>
            </div>
          </div>

          <!-- Tab almashtirish (Yordam / Qo'llab-quvvatlash) -->
          <div class="flex items-center bg-slate-100 p-1 rounded-2xl shrink-0 self-start sm:self-auto w-full sm:w-auto">
            <button 
              type="button" 
              id="tab-btn-help" 
              class="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeSection === 'help' 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }"
            >
              <span>📖 Yo'riqnoma</span>
            </button>
            <button 
              type="button" 
              id="tab-btn-support" 
              class="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeSection === 'support' 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }"
            >
              <span>💬 Dasturchi (Working Code)</span>
            </button>
          </div>
        </div>

        ${activeSection === 'help' ? `
          <!-- YORDAM VA YO'RIQNOMA BO'LIMI -->
          <div class="space-y-4">
            
            <!-- 1. Sinf Rahbari asosiy vazifalari -->
            <div class="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold shrink-0">
                  👨‍🏫
                </div>
                <div>
                  <h3 class="text-sm sm:text-base font-bold text-slate-900">
                    1. Sinf Rahbari Kabineti va O'quvchilar Boshqaruvi
                  </h3>
                  <p class="text-xs text-slate-500">24 ta rasmiy parametrli o'quvchi ma'lumotlari</p>
                </div>
              </div>
              <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Sizning kabinetingizda faqat o'zingizga biriktirilgan <strong>${escapeHtml(currentClass.name)}</strong> sinfi o'quvchilari joylashgan. 
                Siz har bir o'quvchi uchun to'liq 24 maydonli dosye yuritishingiz (shaxsiy ma'lumotlar, ota-onalar telefoni, manzili, PINFL, fotosurati va h.k.) mumkin.
              </p>
              <ul class="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <li class="flex items-start gap-2">
                  <span class="text-emerald-500 font-bold">✓</span>
                  <span><strong>Yangi o'quvchi qo'shish:</strong> Bosh sahifadagi yoki qidiruvdagi "+" tugmasi orqali tezkor qo'shiladi.</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-emerald-500 font-bold">✓</span>
                  <span><strong>To'liq dosye:</strong> Har bir o'quvchi ustiga bosib, rasmiy anketani ko'rish, Word, Excel yoki PDF da yuklab olish mumkin.</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-emerald-500 font-bold">✓</span>
                  <span><strong>Tezkor qidiruv:</strong> Pastki navigatsiyadagi "Qidirish" bo'limi orqali o'quvchilarni ism, telefon yoki ota-onasi bo'yicha darhol topish va qo'ng'iroq qilish mumkin.</span>
                </li>
              </ul>
            </div>

            <!-- 2. Davomat qoidalari: Faqat mas'ul navbatchi o'qituvchi oladi! -->
            <div class="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl font-bold shrink-0">
                  📋
                </div>
                <div>
                  <h3 class="text-sm sm:text-base font-bold text-slate-900">
                    2. Davomat Olish Tizimi va Maktab Tartibi
                  </h3>
                  <p class="text-xs text-slate-500">Guruhlar va smenalar bo'yicha mas'ul navbatchi qoidalari</p>
                </div>
              </div>
              <div class="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-950 space-y-1 leading-relaxed">
                <strong>⚡ Asosiy Qoida:</strong> Maktab nizomiga ko'ra, har kuni har bir smenaga maxsus navbatchi sinf rahbari biriktiriladi. 
                <strong>Davomatni faqat o'sha kungi Mas'ul Navbatchi o'qituvchi oladi!</strong> 
                Boshqa barcha sinf rahbarlari esa "Davomat" bo'limida bugungi navbatchi kimligini ko'rishlari va o'z sinflari holatini kuzatishlari mumkin.
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span class="font-bold text-slate-800 block mb-1">⭐ Agar siz bugun navbatchi bo'lsangiz:</span>
                  Tizim sizga butun maktab sinflari davomatini olish, o'quvchilarni kelgan, sababli yoki sababsiz deb belgilash imkoniyatini beradi.
                </div>
                <div class="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span class="font-bold text-slate-800 block mb-1">👥 Agar siz navbatchi bo'lmasangiz:</span>
                  Siz "Bugungi Navbatchilar" sahifasida kim mas'ul ekanini, uning telefon raqamini ko'rishingiz va zarur bo'lsa telefon orqali bog'lanishingiz mumkin.
                </div>
              </div>
            </div>

            <!-- 3. Sababli deb belgilash va sabab izohini qoldirish tartibi -->
            <div class="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl font-bold shrink-0">
                  🟡
                </div>
                <div>
                  <h3 class="text-sm sm:text-base font-bold text-slate-900">
                    3. O'quvchini "Sababli" deb belgilash tartibi
                  </h3>
                  <p class="text-xs text-slate-500">Majburiy izoh va tezkor sabab shablonlari</p>
                </div>
              </div>
              <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Maktab intizomiga binoan, biror bir o'quvchi darsga kelmaganda uni shunchaki "Sababli" deb belgilab bo'lmaydi. 
                Navbatchi o'qituvchi "Sababli" tugmasini bosganda avtomatik ravishda izoh oynasi ochiladi va quyidagi sabablardan birini tanlash yoki yozish talab etiladi:
              </p>
              <div class="flex flex-wrap gap-2 text-xs">
                <span class="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-medium">🤒 Betoblik / Shifoxona</span>
                <span class="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-medium">📄 Ota-ona arizasi</span>
                <span class="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-medium">🚗 Oilaviy safar</span>
                <span class="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-medium">🏆 Musobaqa / Olimpiada</span>
              </div>
              <p class="text-xs text-slate-500">
                Kiritilgan sabab har doim o'quvchi kartasida saqlanadi va monitoring hisobotlarida aks etadi.
              </p>
            </div>

            <!-- 4. Navbatchi o'qituvchi kelolmay qolganda zaxira tartibi -->
            <div class="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center text-xl font-bold shrink-0">
                  ⚠️
                </div>
                <div>
                  <h3 class="text-sm sm:text-base font-bold text-slate-900">
                    4. Navbatchi kela olmay qolganda nima qilish kerak?
                  </h3>
                  <p class="text-xs text-slate-500">Zaxiraga topshirish va Adminga avtomatik xabar</p>
                </div>
              </div>
              <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Agar siz bugun navbatchi bo'lsangiz, lekin kutilmagan betoblik yoki safar tufayli maktabga kela olmasangiz:
              </p>
              <ol class="text-xs text-slate-600 space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 list-decimal list-inside">
                <li>Davomat yoki Bosh sahifadagi <strong>"⚠️ Kelolmaslikni bildirish"</strong> tugmasini bosing.</li>
                <li>Sababingizni qisqacha yozing yoki tezkor sabablardan birini tanlang.</li>
                <li>Tugmani tasdiqlang. Tizim navbatchilikni jadval bo'yicha <strong>Zaxiradagi o'qituvchiga</strong> avtomatik topshiradi va maktab Ma'muriyati (Admin)ga shoshilinch ogohlantirish xabarnomasini yuboradi.</li>
              </ol>
            </div>

            <!-- 5. Ta'lim platformalari va Eksport -->
            <div class="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-bold shrink-0">
                  🌐
                </div>
                <div>
                  <h3 class="text-sm sm:text-base font-bold text-slate-900">
                    5. Ta'lim Platformalari (eMaktab / Kundalik) va Hujjatlar
                  </h3>
                  <p class="text-xs text-slate-500">Parollarni bir joyda saqlash va yuklab olish</p>
                </div>
              </div>
              <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Har bir o'quvchining eMaktab / Kundalik logini va parolini platformada saqlashingiz mumkin. 
                Shuningdek, butun sinf ro'yxatini Word, Excel jadvali yoki rasmiy PDF hujjat ko'rinishida 1 ta tugma bilan yuklab olish imkoniyati mavjud.
              </p>
            </div>

          </div>
        ` : `
          <!-- QO'LLAB-QUVVATLASH VA DASTURCHI BO'LIMI -->
          <div class="space-y-4">
            
            <!-- WORKING CODE brendi taqdimoti -->
            <div class="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-800/60 relative overflow-hidden">
              <div class="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none"></div>
              
              <div class="flex items-start gap-4">
                <div class="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-3xl font-black shrink-0 border border-white/20 shadow-inner">
                  💻
                </div>
                <div class="min-w-0">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Bosh Dasturchi & Muallif
                  </span>
                  <h2 class="text-xl sm:text-2xl font-black mt-1">
                    WORKING CODE
                  </h2>
                  <p class="text-xs sm:text-sm text-indigo-200/90 mt-1 max-w-xl leading-relaxed">
                    MaktabX axborot tizimi O'zbekiston Respublikasi maktab ta'limi tizimi uchun WORKING CODE brendi tomonidan ishlab chiqilgan va uzluksiz rivojlantirib boriladi.
                  </p>
                </div>
              </div>

              <!-- Aloqa tugmalari -->
              <div class="mt-6 pt-5 border-t border-indigo-800/60 flex flex-wrap items-center gap-2.5">
                <a 
                  href="https://t.me/${tgClean}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 active:scale-95"
                >
                  <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.38-.49 1.03-.75 4.04-1.76 6.74-2.92 8.09-3.49 3.85-1.62 4.65-1.9 5.17-1.91.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.21-.04.38z"/>
                  </svg>
                  <span>Telegram: @${tgClean}</span>
                </a>

                <a 
                  href="tel:${phoneClean}" 
                  class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 active:scale-95"
                >
                  <span>📞 Qo'ng'iroq: ${developer.phone || '+998 90 000 12 34'}</span>
                </a>

                <a 
                  href="mailto:${developer.email || 'diyorbek.dev1510@gmail.com'}" 
                  class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
                >
                  <span>✉️ Email</span>
                </a>
              </div>
            </div>

            <!-- Texnik qo'llab-quvvatlash ma'lumotlari -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
                <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  ⏱️
                </div>
                <h4 class="text-sm font-bold text-slate-900">Ish Vaqti & Qabul</h4>
                <p class="text-xs text-slate-600 leading-relaxed">
                  Platforma bo'yicha texnik ko'mak <strong>haftaning barcha kunlarida 24/7 rejimda</strong> ishlaydi. 
                  Favqulodda holatlar va xatoliklar yuzasidan zudlik bilan Telegram orqali javob beriladi.
                </p>
              </div>

              <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
                <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                  🔒
                </div>
                <h4 class="text-sm font-bold text-slate-900">Xavfsizlik va PIN-kodni tiklash</h4>
                <p class="text-xs text-slate-600 leading-relaxed">
                  Agar kabinet PIN-kodingiz yoki parolingiz yodingizdan ko'tarilgan bo'lsa, sizning shaxsingizni tasdiqlash uchun 
                  <strong>Tiklash ID: <code class="font-mono text-indigo-700 font-bold">${currentClass.recoveryId || 'REC-...'}</code></strong> raqamingizdan foydalaniladi.
                </p>
              </div>
            </div>

            <!-- Dasturchiga to'g'ridan-to'g'ri tezkor murojaat xabari yuborish -->
            <div class="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-base">
                  ✍️
                </span>
                <div>
                  <h3 class="text-sm sm:text-base font-bold text-slate-900">
                    Dasturchiga To'g'ridan-to'g'ri Murojaat Qoldirish
                  </h3>
                  <p class="text-xs text-slate-500">Taklif, savol yoki tizim bo'yicha yordam so'rash</p>
                </div>
              </div>

              <form id="support-quick-form" class="space-y-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    Murojaat mavzusi:
                  </label>
                  <select 
                    id="support-topic-select" 
                    class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="PIN-kodni yangilash yoki bekor qilish">PIN-kodni yangilash yoki bekor qilish</option>
                    <option value="Davomat olishda yordam kerak">Davomat olishda yordam kerak</option>
                    <option value="O'quvchi ma'lumotlarini to'g'rilash">O'quvchi ma'lumotlarini to'g'rilash</option>
                    <option value="Yangi taklif yoki qo'shimcha kiritish">Yangi taklif yoki qo'shimcha kiritish</option>
                    <option value="Boshqa texnik savol">Boshqa texnik savol</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    Xabaringiz:
                  </label>
                  <textarea 
                    id="support-message-text" 
                    rows="3" 
                    placeholder="Murojaat matnini yozing..." 
                    class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    required
                  ></textarea>
                </div>

                <div class="flex items-center justify-between gap-3 pt-2">
                  <span class="text-[11px] text-slate-400">
                    * Yuborilganda sizga qulay Telegram ilovasida tayyor xabar ochiladi.
                  </span>
                  <button 
                    type="submit" 
                    class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span>Yuborish &rarr;</span>
                  </button>
                </div>
              </form>
            </div>

          </div>
        `}

        <!-- Pastki qism: Tizim versiyasi (User talabiga binoan) -->
        <div class="pt-4 pb-2 text-center border-t border-slate-200/80 space-y-0.5">
          <p class="text-xs font-black text-slate-700">
            MaktabX • Versiya ${escapeHtml(state.siteInfo?.version || state.developer?.version || developer.version || '2.4.0')} (${escapeHtml(developer.brand || 'WORKING CODE')})
          </p>
          <p class="text-[10px] text-slate-400">
            &copy; ${escapeHtml(state.siteInfo?.releaseYear || '2026')} ${escapeHtml(developer.brand || 'WORKING CODE')}. Barcha huquqlar himoyalangan.
          </p>
        </div>

      </div>
    `;

    // Listeners
    document.getElementById('btn-help-back')?.addEventListener('click', () => {
      if (onBack) onBack();
    });

    document.getElementById('tab-btn-help')?.addEventListener('click', () => {
      activeSection = 'help';
      render();
    });

    document.getElementById('tab-btn-support')?.addEventListener('click', () => {
      activeSection = 'support';
      render();
    });

    const supportForm = document.getElementById('support-quick-form');
    if (supportForm) {
      supportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const topic = document.getElementById('support-topic-select')?.value || 'Murojaat';
        const msg = (document.getElementById('support-message-text')?.value || '').trim();
        if (!msg) {
          if (showToast) showToast("Iltimos, xabar matnini kiriting!", "warning");
          return;
        }

        const fullText = `Salom, WORKING CODE dasturchisi! Men ${currentClass.name} sinf rahbari ${currentClass.teacherName || ''}man.\nTiklash ID: ${currentClass.recoveryId || 'Yo\'q'}\nMavzu: ${topic}\nXabar: ${msg}`;
        const tgUrl = `https://t.me/${tgClean}?text=${encodeURIComponent(fullText)}`;
        window.open(tgUrl, '_blank');
        if (showToast) showToast("Dasturchiga xabar tayyorlandi!", "success");
      });
    }
  }

  render();
}
