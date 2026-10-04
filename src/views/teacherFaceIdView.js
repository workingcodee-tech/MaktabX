/**
 * MaktabX - Sinf Rahbari Face ID Sahifasi
 * Face ID ni o'rnatish, yangilash va boshqarish bo'yicha to'liq alohida sahifa
 */

import { showFaceAuthModal } from './faceAuthModal.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTeacherFaceIdView(container, {
  state,
  currentClass,
  onSaveFaceId,
  onRemoveFaceId,
  onBack,
  showToast
}) {
  function render() {
    const isFaceIdActive = Boolean(currentClass.faceIdData && currentClass.faceIdData.enabled);

    container.innerHTML = `
      <div class="max-w-xl mx-auto space-y-4 sm:space-y-6 animate-fade-in text-slate-800 pb-12">
        
        <!-- Yuqori Navigatsiya & Sarlavha -->
        <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button 
              id="btn-face-back"
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
                Face ID (Yuz Bilan Kirish)
              </h1>
              <p class="text-xs text-slate-500">
                ${escapeHtml(currentClass.name)} • ${escapeHtml(currentClass.teacherName || "Sinf Rahbari")}
              </p>
            </div>
          </div>

          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            isFaceIdActive 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' 
              : 'bg-slate-100 text-slate-600 border border-slate-200/80'
          }">
            <span class="w-2 h-2 rounded-full ${isFaceIdActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
            ${isFaceIdActive ? "Faol" : "O'rnatilmagan"}
          </span>
        </div>

        <!-- Asosiy Vizual Karta -->
        <div class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm text-center space-y-6">
          
          <!-- Face ID Emblemasi -->
          <div class="relative w-28 h-28 mx-auto flex items-center justify-center">
            <div class="absolute inset-0 rounded-3xl ${
              isFaceIdActive 
                ? 'bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border-2 border-emerald-400/40' 
                : 'bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 border-2 border-indigo-300/40'
            } animate-pulse"></div>
            
            <div class="w-20 h-20 rounded-2xl ${
              isFaceIdActive ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
            } shadow-xl flex items-center justify-center transform transition-transform hover:scale-105">
              <svg class="w-10 h-10 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>

          <!-- Ta'rif -->
          <div class="max-w-md mx-auto space-y-2">
            <h2 class="text-base sm:text-lg font-black text-slate-900">
              ${isFaceIdActive ? "Face ID Muvaffaqiyatli O'rnatilgan" : "Face ID O'rnatilmagan"}
            </h2>
            <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
              ${isFaceIdActive 
                ? "Sizning yuzingiz tizimga ro'yxatga olingan. Har safar tizimga kirishda kamera orqali 1 soniyada login va parolsiz kabinetga kira olasiz." 
                : "Kamerangiz orqali yuzingizni skanerlang va parolsiz, tezkor kirish imkoniyatidan foydalaning. Bu mutlaqo xavfsiz va qulay."}
            </p>
          </div>

          <!-- Xususiyatlar Ro'yxati -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div class="text-indigo-600 font-black text-xs">⚡ Tezkor</div>
              <p class="text-[11px] text-slate-500 mt-0.5">1 soniyada avtomatik aniqlaydi</p>
            </div>
            <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div class="text-emerald-600 font-black text-xs">🔒 Xavfsiz</div>
              <p class="text-[11px] text-slate-500 mt-0.5">Biometrik shifrlangan ma'lumot</p>
            </div>
            <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div class="text-purple-600 font-black text-xs">📱 Qulay</div>
              <p class="text-[11px] text-slate-500 mt-0.5">Har qanday mobil va kompyuterda</p>
            </div>
          </div>

          <!-- Amallar Tugmalari -->
          <div class="pt-2 space-y-3">
            <button 
              type="button" 
              id="btn-trigger-enroll"
              class="w-full py-3.5 px-6 rounded-2xl ${
                isFaceIdActive 
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25' 
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
              } text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span>${isFaceIdActive ? "Face ID ni Qayta O'rnatish / Yangilash" : "Face ID ni O'rnatish"}</span>
            </button>

            ${isFaceIdActive ? `
              <button 
                type="button" 
                id="btn-trigger-remove-face"
                class="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer"
              >
                Face ID ni o'chirish (Bekor qilish)
              </button>
            ` : ''}
          </div>

        </div>

      </div>
    `;

    // Orqaga qaytish
    document.getElementById('btn-face-back')?.addEventListener('click', onBack);

    // O'rnatish / Yangilash tugmasi
    document.getElementById('btn-trigger-enroll')?.addEventListener('click', () => {
      showFaceAuthModal({
        mode: 'enroll',
        currentUser: { role: 'teacher', data: currentClass },
        onSuccess: (faceData) => {
          if (onSaveFaceId) {
            onSaveFaceId(faceData);
          }
          render(); // Mahsulot holatini yangilash
        },
        showToast
      });
    });

    // Face ID ni o'chirish
    document.getElementById('btn-trigger-remove-face')?.addEventListener('click', () => {
      if (confirm("Haqiqatan ham ushbu kabinet uchun Face ID ma'lumotlarini o'chirmoqchimisiz?")) {
        if (onRemoveFaceId) {
          onRemoveFaceId();
        }
        render(); // Mahsulot holatini yangilash
      }
    });
  }

  render();
}
