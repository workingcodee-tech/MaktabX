import { closeModalWithAnimation } from '../utils/modalAnimation.js';

export function showAdminModal({ school = null, onSave, onCancel }) {
  const modalContainer = document.getElementById('modal-container');
  const isEdit = !!school;
  const initial = school || {
    name: '',
    shortCode: '',
    address: '',
    adminName: '',
    adminPhone: '',
    login: '',
    password: ''
  };

  modalContainer.innerHTML = `
    <div id="admin-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
      <div class="modal-dialog-box bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden modal-dialog-enter">
        
        <!-- Fixed Header -->
        <div class="px-5 sm:px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 class="text-base sm:text-lg font-bold text-slate-950">
              ${isEdit ? "Maktab va Adminni Tahrirlash" : "Yangi Maktab va Admin Qo'shish"}
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Dasturchi tomonidan yangi maktab hisobini ro'yxatdan o'tkazish</p>
          </div>
          <button id="close-admin-modal-btn" class="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Yopish">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Form with scrollable body and fixed footer -->
        <form id="admin-form" class="flex flex-col flex-1 min-h-0 overflow-hidden text-sm">
          
          <div class="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="adm-sch-name">Maktab To'liq Nomi <span class="text-red-500">*</span></label>
              <input 
                type="text" 
                id="adm-sch-name" 
                value="${initial.name || ''}" 
                placeholder="Masalan: Toshkent shahar 21-sonli maktab" 
                required
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition-all placeholder:text-slate-400"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="adm-sch-code">Qisqa Nomi / Kodi</label>
                <input 
                  type="text" 
                  id="adm-sch-code" 
                  value="${initial.shortCode || ''}" 
                  placeholder="Masalan: 21-maktab" 
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition-all placeholder:text-slate-400"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="adm-phone">Admin Telefoni <span class="text-red-500">*</span></label>
                <input 
                  type="text" 
                  id="adm-phone" 
                  value="${initial.adminPhone || ''}" 
                  placeholder="+998 90 123 45 67" 
                  required
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="adm-name">Mas'ul Admin (F.I.SH) <span class="text-red-500">*</span></label>
                <input 
                  type="text" 
                  id="adm-name" 
                  value="${initial.adminName || ''}" 
                  placeholder="Familiya Ism Otasining ismi" 
                  required
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition-all placeholder:text-slate-400"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="adm-email">Admin Email <span class="text-slate-400 font-normal">(ixtiyoriy)</span></label>
                <input 
                  type="email" 
                  id="adm-email" 
                  value="${initial.adminEmail || initial.email || ''}" 
                  placeholder="admin@maktab.uz" 
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="adm-address">Maktab Manzili</label>
              <input 
                type="text" 
                id="adm-address" 
                value="${initial.address || ''}" 
                placeholder="Shahar, tuman, ko'cha" 
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm transition-all placeholder:text-slate-400"
              />
            </div>

            <div class="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-3">
              <div class="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Admin Kirish Ma'lumotlari</div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="adm-login">Admin Login <span class="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    id="adm-login" 
                    value="${initial.login || ''}" 
                    placeholder="Masalan: admin21" 
                    required
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1.5" for="adm-password">Admin Parol <span class="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    id="adm-password" 
                    value="${initial.password || ''}" 
                    placeholder="Parolni kiriting" 
                    required
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Fixed Footer -->
          <div class="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button 
              type="button" 
              id="cancel-admin-modal-btn"
              class="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Bekor qilish
            </button>
            <button 
              type="submit" 
              class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              ${isEdit ? "Saqlash" : "Adminni Yaratish"}
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  const form = modalContainer.querySelector('#admin-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      ...(school || {}),
      id: school ? school.id : 'sch-' + Date.now(),
      name: modalContainer.querySelector('#adm-sch-name').value.trim(),
      shortCode: modalContainer.querySelector('#adm-sch-code').value.trim(),
      adminPhone: modalContainer.querySelector('#adm-phone').value.trim(),
      adminName: modalContainer.querySelector('#adm-name').value.trim(),
      adminEmail: modalContainer.querySelector('#adm-email')?.value.trim() || '',
      email: modalContainer.querySelector('#adm-email')?.value.trim() || '',
      address: modalContainer.querySelector('#adm-address').value.trim(),
      login: modalContainer.querySelector('#adm-login').value.trim(),
      password: modalContainer.querySelector('#adm-password').value.trim(),
      createdAt: school ? school.createdAt : new Date().toISOString().split('T')[0]
    };
    const backdrop = modalContainer.querySelector('#admin-modal-backdrop');
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      onSave(data);
    });
  });

  const close = () => {
    const backdrop = modalContainer.querySelector('#admin-modal-backdrop');
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (onCancel) onCancel();
    });
  };
  modalContainer.querySelector('#close-admin-modal-btn').addEventListener('click', close);
  modalContainer.querySelector('#cancel-admin-modal-btn').addEventListener('click', close);
  const backdrop = modalContainer.querySelector('#admin-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }
}
