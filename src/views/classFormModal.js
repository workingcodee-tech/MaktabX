import { generateRecoveryId } from '../data.js';
import { closeModalWithAnimation } from '../utils/modalAnimation.js';

export function showClassModal({ classItem = null, schoolId, existingClasses = [], onSave, onCancel }) {
  const modalContainer = document.getElementById('modal-container');
  const isEdit = !!classItem;
  
  // ID FAQAT RAQAM va BARCHA FOYDALANUVCHIGA HAR XIL BO'LISHI SHART
  let currentRecoveryId = classItem?.recoveryId ? String(classItem.recoveryId).replace(/\D/g, '') : '';
  if (!currentRecoveryId || currentRecoveryId.length < 4) {
    currentRecoveryId = generateRecoveryId(existingClasses);
  }

  const initial = classItem || {
    name: '',
    academicYear: '2025-2026',
    language: "O'zbek",
    teacherName: '',
    teacherSubject: '',
    teacherPhone: '',
    login: '',
    password: '',
    recoveryId: currentRecoveryId
  };

  modalContainer.innerHTML = `
    <div id="class-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
      <div class="modal-dialog-box bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden modal-dialog-enter">
        
        <!-- Fixed Header -->
        <div class="px-5 sm:px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 class="text-base sm:text-lg font-bold text-slate-950">
              ${isEdit ? "Sinf va Rahbarni Tahrirlash" : "Yangi Sinf va Rahbar Qo'shish"}
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Masalan: 1-A, 5-B, 11-D va unga mas'ul sinf rahbari</p>
          </div>
          <button id="close-class-modal-btn" class="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Yopish">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Form with scrollable body and fixed footer -->
        <form id="class-form" class="flex flex-col flex-1 min-h-0 overflow-hidden text-sm">
          
          <div class="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cls-name">Sinf Nomi <span class="text-red-500">*</span></label>
                <input 
                  type="text" 
                  id="cls-name" 
                  value="${initial.name || ''}" 
                  placeholder="Masalan: 5-B" 
                  required
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm font-bold text-indigo-700 font-mono transition-all"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cls-year">O'quv Yili</label>
                <input 
                  type="text" 
                  id="cls-year" 
                  value="${initial.academicYear || '2025-2026'}" 
                  placeholder="2025-2026" 
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cls-teacher-name">Sinf Rahbari (F.I.SH) <span class="text-red-500">*</span></label>
              <input 
                type="text" 
                id="cls-teacher-name" 
                value="${initial.teacherName || ''}" 
                placeholder="Masalan: Rahimova Nozima Alisher qizi" 
                required
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition-all placeholder:text-slate-400"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cls-teacher-subject">Mutaxassislik Fani</label>
                <input 
                  type="text" 
                  id="cls-teacher-subject" 
                  value="${initial.teacherSubject || ''}" 
                  placeholder="Ona tili, Matematika..." 
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition-all placeholder:text-slate-400"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cls-teacher-phone">O'qituvchi Telefoni <span class="text-red-500">*</span></label>
                <input 
                  type="text" 
                  id="cls-teacher-phone" 
                  value="${initial.teacherPhone || ''}" 
                  placeholder="+998 90 123 45 67" 
                  required
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm font-mono transition-all placeholder:text-slate-400"
                />
                <p class="text-[10.5px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                  <svg class="w-3 h-3 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                  </svg>
                  <span>SMS orqali parolni tiklash ushbu raqamga yuboriladi</span>
                </p>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cls-teacher-email">O'qituvchi Emaili <span class="text-slate-400 font-normal">(ixtiyoriy)</span></label>
              <input 
                type="email" 
                id="cls-teacher-email" 
                value="${initial.teacherEmail || initial.email || ''}" 
                placeholder="oqituvchi@maktab.uz" 
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition-all placeholder:text-slate-400"
              />
            </div>

            <div class="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-3">
              <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-700">O'qituvchi Kirish Hisobi (Login & Parol)</div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cls-login">O'qituvchi Logini <span class="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    id="cls-login" 
                    value="${initial.login || ''}" 
                    placeholder="Masalan: rahbar5b" 
                    required
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="cls-password">O'qituvchi Paroli <span class="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    id="cls-password" 
                    value="${initial.password || ''}" 
                    placeholder="Parolni kiriting" 
                    required
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm bg-white"
                  />
                </div>
              </div>

              <!-- Tiklash ID axborot bloki -->
              <div class="mt-2 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-xs">
                <div class="flex items-center gap-1.5 text-emerald-900 font-medium">
                  <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                  </svg>
                  <span>Tiklash ID:</span>
                  <span class="font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-700 select-all" id="cls-recovery-id-badge">${currentRecoveryId}</span>
                </div>
                <input type="hidden" id="cls-recovery-id" value="${currentRecoveryId}" />
                <span class="text-[11px] text-slate-500">Parol esdan chiqqanda kerak bo'ladi</span>
              </div>
            </div>
          </div>

          <!-- Fixed Footer -->
          <div class="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button 
              type="button" 
              id="cancel-class-modal-btn"
              class="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Bekor qilish
            </button>
            <button 
              type="submit" 
              class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              ${isEdit ? "Saqlash" : "Sinfni Yaratish"}
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  const form = modalContainer.querySelector('#class-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      ...(classItem || {}),
      id: classItem ? classItem.id : 'cls-' + Date.now(),
      schoolId: classItem ? classItem.schoolId : schoolId,
      name: modalContainer.querySelector('#cls-name').value.trim(),
      academicYear: modalContainer.querySelector('#cls-year').value.trim(),
      language: "O'zbek",
      teacherName: modalContainer.querySelector('#cls-teacher-name').value.trim(),
      teacherSubject: modalContainer.querySelector('#cls-teacher-subject').value.trim(),
      teacherPhone: modalContainer.querySelector('#cls-teacher-phone').value.trim(),
      teacherEmail: modalContainer.querySelector('#cls-teacher-email')?.value.trim() || '',
      email: modalContainer.querySelector('#cls-teacher-email')?.value.trim() || '',
      login: modalContainer.querySelector('#cls-login').value.trim(),
      password: modalContainer.querySelector('#cls-password').value.trim(),
      recoveryId: modalContainer.querySelector('#cls-recovery-id')?.value || classItem?.recoveryId || currentRecoveryId,
      createdAt: classItem ? classItem.createdAt : new Date().toISOString().split('T')[0]
    };
    const backdrop = modalContainer.querySelector('#class-modal-backdrop');
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      onSave(data);
    });
  });

  const close = () => {
    const backdrop = modalContainer.querySelector('#class-modal-backdrop');
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (onCancel) onCancel();
    });
  };
  modalContainer.querySelector('#close-class-modal-btn').addEventListener('click', close);
  modalContainer.querySelector('#cancel-class-modal-btn').addEventListener('click', close);
  const backdrop = modalContainer.querySelector('#class-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }
}
