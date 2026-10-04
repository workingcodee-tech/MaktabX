import { calculateAge } from '../data.js';
import { closeModalWithAnimation } from '../utils/modalAnimation.js';
import { isFemaleStudent, detectGenderFromName } from '../utils/exportUtils.js';

export function showStudentModal({ student = null, currentClassId, currentSchoolId, platforms = [], onSave, onCancel, onQuickAddPlatform }) {
  const modalContainer = document.getElementById('modal-container');
  const isEdit = !!student;
  let initialFullName = (student && student.fullName) || '';
  if (!initialFullName && student) {
    initialFullName = [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ');
  }

  const initialPlatforms = (student && student.platforms) || {};

  // Vaqtinchalik qoralama (draft) ni o'qish (faqat yangi o'quvchi qo'shilayotganda)
  const DRAFT_STORAGE_KEY = 'maktab_student_draft_form';
  const DRAFT_MODAL_OPEN_KEY = 'maktab_student_draft_modal_open';
  let isDraftRestored = false;
  let draftData = null;
  let isSavedSuccessfully = false;

  if (!isEdit) {
    try {
      const savedRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedRaw) {
        const parsedDraft = JSON.parse(savedRaw);
        if (parsedDraft && parsedDraft.data && typeof parsedDraft.data === 'object') {
          // Birorta maydon to'ldirilgan bo'lsa tiklaymiz
          const hasAny = Object.values(parsedDraft.data).some(v => {
            if (typeof v === 'string') return v.trim().length > 0;
            if (Array.isArray(v)) return v.length > 0;
            if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
            return false;
          });
          if (hasAny) {
            draftData = parsedDraft.data;
            isDraftRestored = true;
          }
        }
      }
    } catch (e) {
      console.warn("Qoralamani o'qishda ogohlantirish:", e);
    }
  }

  // Modal hozir ochiq ekanligini belgilab qo'yish (refresh bo'lganda tiklash uchun)
  if (!isEdit) {
    try {
      sessionStorage.setItem(DRAFT_MODAL_OPEN_KEY, JSON.stringify({ classId: currentClassId, schoolId: currentSchoolId }));
    } catch (e) {}
  }

  if (!isEdit && draftData && draftData.fullName) {
    initialFullName = draftData.fullName;
  }

  // Dublikatlarni birlashtirish va platformalar ro'yxatini to'liq shakllantirish
  const knownPlatformMap = new Map();
  if (Array.isArray(platforms)) {
    platforms.forEach(p => {
      if (!p) return;
      const lowerName = (p.name || '').toLowerCase();
      let key = p.id;
      if (p.id === 'plat-kundalik' || lowerName.includes('kundalik') || lowerName.includes('emaktab')) {
        key = 'plat-kundalik';
      }
      if (!knownPlatformMap.has(key)) {
        knownPlatformMap.set(key, {
          id: key,
          name: key === 'plat-kundalik' ? 'Kundalik.com (eMaktab)' : p.name,
          url: key === 'plat-kundalik' ? 'https://emaktab.uz' : (p.url || ''),
          description: p.description || ''
        });
      }
    });
  }

  // O'quvchida mavjud bo'lgan platformalar
  if (student && student.platforms) {
    Object.keys(student.platforms).forEach(pId => {
      let key = pId;
      if (pId === 'plat-kundalik' || pId.includes('kundalik') || pId.includes('emaktab')) {
        key = 'plat-kundalik';
      }
      if (!knownPlatformMap.has(key)) {
        knownPlatformMap.set(key, {
          id: key,
          name: key === 'plat-kundalik' ? 'Kundalik.com (eMaktab)' : 'Platforma',
          url: key === 'plat-kundalik' ? 'https://emaktab.uz' : '',
          description: ''
        });
      }
    });
  }

  let currentPlatformsList = Array.from(knownPlatformMap.values());

  function getModalCred(platId) {
    let cred = initialPlatforms[platId];
    if (!cred && (platId === 'plat-kundalik' || platId.includes('kundalik'))) {
      for (const [k, v] of Object.entries(initialPlatforms)) {
        if (k === 'plat-kundalik' || k.includes('kundalik') || k.includes('emaktab')) {
          cred = v;
          break;
        }
      }
    }
    if (!cred) return { login: '', password: '' };
    let login = '';
    let password = '';
    if (typeof cred === 'object') {
      if (cred.login && typeof cred.login === 'object') {
        login = String(cred.login.login || '').trim();
        password = String(cred.login.password || cred.password || '').trim();
      } else {
        login = String(cred.login || '').trim();
        password = String(cred.password || '').trim();
      }
    }
    return { login, password };
  }

  const isInitialFemale = isFemaleStudent(student || draftData);
  const initialGender = isInitialFemale ? "Qiz" : (student?.gender || draftData?.gender || "O'g'il");

  const initial = student || {
    lastName: draftData?.lastName || '',
    firstName: draftData?.firstName || '',
    middleName: draftData?.middleName || '',
    fullName: draftData?.fullName || '',
    birthDate: draftData?.birthDate || '',
    age: draftData?.age || '',
    gender: initialGender,
    birthPlace: draftData?.birthPlace || '',
    phone: draftData?.phone || '',
    email: draftData?.email || '',
    address: draftData?.address || '',
    photo: '',
    fhdyoOrgan: draftData?.fhdyoOrgan || '',
    dalolatnomaNumber: draftData?.dalolatnomaNumber || '',
    guvohnomaDate: draftData?.guvohnomaDate || '',
    guvohnomaSeriaNumber: draftData?.guvohnomaSeriaNumber || '',
    passportNumber: draftData?.passportNumber || '',
    pinfl: draftData?.pinfl || '',
    pinflPassport: draftData?.pinflPassport || '',
    motherFullName: draftData?.motherFullName || '',
    motherPassport: draftData?.motherPassport || '',
    motherPinfl: draftData?.motherPinfl || '',
    motherAge: draftData?.motherAge || '',
    motherBirthDate: draftData?.motherBirthDate || '',
    motherBirthPlace: draftData?.motherBirthPlace || '',
    motherPhone: draftData?.motherPhone || '',
    motherEmail: draftData?.motherEmail || '',
    motherJob: draftData?.motherJob || '',
    fatherFullName: draftData?.fatherFullName || '',
    fatherPassport: draftData?.fatherPassport || '',
    fatherPinfl: draftData?.fatherPinfl || '',
    fatherAge: draftData?.fatherAge || '',
    fatherBirthDate: draftData?.fatherBirthDate || '',
    fatherBirthPlace: draftData?.fatherBirthPlace || '',
    fatherPhone: draftData?.fatherPhone || '',
    fatherEmail: draftData?.fatherEmail || '',
    fatherJob: draftData?.fatherJob || ''
  };

  let extraCourses = [];
  if (student && Array.isArray(student.extraCourses)) {
    extraCourses = student.extraCourses.map((c, i) => ({
      id: c.id || `course-${Date.now()}-${i}`,
      courseName: c.courseName || '',
      teacherName: c.teacherName || '',
      centerName: c.centerName || '',
      centerAddress: c.centerAddress || '',
      teacherPhone: c.teacherPhone || ''
    }));
  } else if (!isEdit && draftData && Array.isArray(draftData.extraCourses)) {
    extraCourses = draftData.extraCourses.map((c, i) => ({
      id: c.id || `course-${Date.now()}-${i}`,
      courseName: c.courseName || '',
      teacherName: c.teacherName || '',
      centerName: c.centerName || '',
      centerAddress: c.centerAddress || '',
      teacherPhone: c.teacherPhone || ''
    }));
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderExtraCoursesHtml(courses) {
    if (!courses || courses.length === 0) {
      return `
        <div class="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-semibold text-slate-800">Qo'shimcha darslar kiritilmagan</p>
            <p class="text-[11.5px] text-slate-500 max-w-md mx-auto">
              O'quvchi qatnashadigan to'garak, repetitor yoki o'quv markazlari ma'lumotlarini 4-5 tagacha kiritishingiz mumkin. Faqat fan nomini kiritish yetarli, qolgan maydonlar (o'qituvchi, markaz, manzil) ixtiyoriy.
            </p>
          </div>
          <button 
            type="button" 
            id="add-first-course-btn" 
            class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>+ Qo'shimcha dars qo'shish</span>
          </button>
        </div>
      `;
    }

    return `
      <div class="space-y-3">
        ${courses.map((c, idx) => `
          <div class="extra-course-item p-3.5 sm:p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3 transition-all" data-course-id="${c.id}">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-2xs">
                  ${idx + 1}
                </span>
                <span class="text-xs font-bold text-slate-900">
                  ${idx + 1}-qo'shimcha dars ${c.courseName ? `<span class="text-indigo-600 font-normal">(${escapeAttr(c.courseName)})</span>` : ''}
                </span>
              </div>
              <button 
                type="button" 
                data-remove-course-index="${idx}"
                class="remove-course-btn px-2.5 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                title="Ushbu darsni o'chirish"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                <span>O'chirish</span>
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <!-- 1. Dars nomi (Asosiy) -->
              <div>
                <label class="block text-[11px] font-semibold text-slate-700 mb-1">
                  Dars / Fan nomi <span class="text-indigo-600 font-bold">*</span>
                </label>
                <input 
                  type="text" 
                  class="extra-course-name w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white font-medium" 
                  value="${escapeAttr(c.courseName)}" 
                  placeholder="Masalan: Ingliz tili"
                />
              </div>

              <!-- 2. O'qituvchining ismi (Ixtiyoriy) -->
              <div>
                <label class="block text-[11px] font-semibold text-slate-700 mb-1">
                  O'qituvchi ismi <span class="text-slate-400 font-normal">(ixtiyoriy)</span>
                </label>
                <input 
                  type="text" 
                  class="extra-course-teacher-name w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white font-medium" 
                  value="${escapeAttr(c.teacherName)}" 
                  placeholder="Masalan: Alisher Fayzullayev"
                />
              </div>

              <!-- 3. O'qituvchi telefon raqami (Ixtiyoriy) -->
              <div>
                <label class="block text-[11px] font-semibold text-slate-700 mb-1">
                  O'qituvchi telefoni <span class="text-slate-400 font-normal">(ixtiyoriy)</span>
                </label>
                <input 
                  type="text" 
                  class="extra-course-phone w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white font-mono font-medium" 
                  value="${escapeAttr(c.teacherPhone)}" 
                  placeholder="Masalan: +998985684187"
                />
              </div>

              <!-- 4. O'quv markazi (Ixtiyoriy) -->
              <div>
                <label class="block text-[11px] font-semibold text-slate-700 mb-1">
                  O'quv markazi <span class="text-slate-400 font-normal">(ixtiyoriy)</span>
                </label>
                <input 
                  type="text" 
                  class="extra-course-center w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white font-medium" 
                  value="${escapeAttr(c.centerName)}" 
                  placeholder="Masalan: inovation school"
                />
              </div>

              <!-- 5. O'quv markazi manzili (Ixtiyoriy) -->
              <div class="sm:col-span-2 lg:col-span-2">
                <label class="block text-[11px] font-semibold text-slate-700 mb-1">
                  O'quv markazi manzili <span class="text-slate-400 font-normal">(ixtiyoriy)</span>
                </label>
                <input 
                  type="text" 
                  class="extra-course-address w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white font-medium" 
                  value="${escapeAttr(c.centerAddress)}" 
                  placeholder="Masalan: Samarqand Toyloq"
                />
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  modalContainer.innerHTML = `
    <div id="student-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
      <form id="student-form" class="modal-dialog-box bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-4xl my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col overflow-hidden modal-dialog-enter">
        
        <!-- Fixed Header -->
        <div class="px-5 sm:px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 class="text-base sm:text-lg font-bold text-slate-950">
              ${isEdit ? "O'quvchi Ma'lumotlarini Tahrirlash" : "Yangi O'quvchi Qo'shish"}
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Faqat yulduzcha (*) bilan belgilangan asosiy maydonlar majburiy, qolgan barcha ma'lumotlar ixtiyoriy.
            </p>
          </div>
          <button type="button" id="close-modal-btn" class="p-2 text-slate-400 hover:text-slate-950 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Yopish">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        ${isDraftRestored ? `
          <div id="draft-alert-banner" class="px-5 sm:px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span><strong>Qoralama tiklandi:</strong> Brauzer yangilanganidan so'ng avval kiritgan ma'lumotlaringiz saqlanib qolgan.</span>
            </div>
            <button type="button" id="clear-draft-btn" class="text-xs text-red-600 hover:text-red-700 underline font-semibold ml-3 cursor-pointer shrink-0">
              Qoralamani tozalash
            </button>
          </div>
        ` : ''}

        <!-- Scrollable Form Body -->
        <div class="p-5 sm:p-6 overflow-y-auto overscroll-contain space-y-6 flex-1 text-sm">
          
          <!-- 1. Asosiy Ma'lumotlar -->
          <div class="space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
              Asosiy Ma'lumotlar (Shaxsiy)
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <!-- F.I.SH (Familiya, Ism, Otasining ismi bitta maydonda) -->
              <div class="md:col-span-3">
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-fullname">
                  F.I.SH (Familiya, Ism, Otasining ismi) <span class="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  id="std-fullname" 
                  value="${initialFullName}" 
                  placeholder="Shermuhammadov Mehriddin" 
                  required
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                />
                <p class="text-[11px] text-slate-400 mt-1">O'quvchining to'liq familiyasi, ismi va otasining ismini bitta qatorda kiriting</p>
              </div>

              <!-- Jinsi (Majburiy) -->
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-gender">
                  Jinsi <span class="text-red-500">*</span>
                </label>
                <select id="std-gender" class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                  <option value="O'g'il" ${!isInitialFemale ? 'selected' : ''}>O'g'il bola</option>
                  <option value="Qiz" ${isInitialFemale ? 'selected' : ''}>Qiz bola</option>
                </select>
              </div>

              <!-- Tug'ilgan sana (Majburiy) -->
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-birthdate">
                  Tug'ilgan kuni (oy, yili) <span class="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  id="std-birthdate" 
                  value="${initial.birthDate || ''}" 
                  required
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <!-- Yoshi -->
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-age">
                  Yoshi (avtomatik hisoblanadi)
                </label>
                <input 
                  type="number" 
                  id="std-age" 
                  value="${initial.age || ''}" 
                  placeholder="Masalan: 11" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-slate-50"
                />
              </div>

              <!-- O'ziniki telefon raqami -->
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-phone">
                  Telefon raqami (o'ziniki)
                </label>
                <input 
                  type="text" 
                  id="std-phone" 
                  value="${initial.phone || ''}" 
                  placeholder="+998 90 123 45 67" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <!-- O'ziniki email (ixtiyoriy) -->
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-email">
                  Email (o'ziniki, ixtiyoriy)
                </label>
                <input 
                  type="email" 
                  id="std-email" 
                  value="${initial.email || ''}" 
                  placeholder="oquvchi@gmail.com" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <!-- Tug'ilgan joyi -->
              <div class="md:col-span-2">
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-birthplace">
                  Tug'ilgan joyi
                </label>
                <input 
                  type="text" 
                  id="std-birthplace" 
                  value="${initial.birthPlace || ''}" 
                  placeholder="Shahar, tuman, viloyat" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <!-- Yashash manzili -->
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-address">
                  Yashash manzili
                </label>
                <input 
                  type="text" 
                  id="std-address" 
                  value="${initial.address || ''}" 
                  placeholder="Ko'cha, uy, xonadon" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

            </div>
          </div>

          <!-- 2. FHDYO va Guvohnoma Ma'lumotlari -->
          <div class="space-y-4 pt-4 border-t border-slate-100">
            <h3 class="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-600"></span>
              FHDYO va Tug'ilganlik Guvohnomasi
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-fhdyo">
                  Tug'ilganlik holati qayd etilgan FHDYO organi
                </label>
                <input 
                  type="text" 
                  id="std-fhdyo" 
                  value="${initial.fhdyoOrgan || ''}" 
                  placeholder="Masalan: Mirzo Ulug'bek tumani FHDYO bo'limi" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-dalolatnoma">
                  Dalolatnoma yozuvi (qayd) harfi / raqami
                </label>
                <input 
                  type="text" 
                  id="std-dalolatnoma" 
                  value="${initial.dalolatnomaNumber || ''}" 
                  placeholder="Masalan: № 482-B" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-guvohnoma-seria">
                  Guvohnomaning seriyasi va raqami
                </label>
                <input 
                  type="text" 
                  id="std-guvohnoma-seria" 
                  value="${initial.guvohnomaSeriaNumber || ''}" 
                  placeholder="Masalan: I-TN № 748192" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-guvohnoma-date">
                  Guvohnoma berilgan sana
                </label>
                <input 
                  type="date" 
                  id="std-guvohnoma-date" 
                  value="${initial.guvohnomaDate || ''}" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          <!-- 3. Pasport / ID-karta va PINFL -->
          <div class="space-y-4 pt-4 border-t border-slate-100">
            <h3 class="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
              Pasport / ID-karta va Biometrik Ma'lumotlar
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-passport">
                  Pasport/ID-karta raqami (Agar pasporti bo'lsa)
                </label>
                <input 
                  type="text" 
                  id="std-passport" 
                  value="${initial.passportNumber || ''}" 
                  placeholder="Masalan: AA 7654321" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-pinfl">
                  JShShIR (PINFL) - 14 xonali
                </label>
                <input 
                  type="text" 
                  id="std-pinfl" 
                  maxlength="14"
                  value="${initial.pinfl || ''}" 
                  placeholder="Masalan: 51504140010023" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-pinfl-passport">
                  JShShIR (PINFL) {pasport}
                </label>
                <input 
                  type="text" 
                  id="std-pinfl-passport" 
                  value="${initial.pinflPassport || ''}" 
                  placeholder="Pasportdagi PINFL" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <!-- 4. Onasi Ma'lumotlari -->
          <div class="space-y-4 pt-4 border-t border-slate-100">
            <h3 class="text-xs font-bold uppercase tracking-wider text-pink-600 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-pink-600"></span>
              Onasi Haqida Ma'lumotlar
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="md:col-span-2">
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-mother-name">
                  Onasi F.I.SH
                </label>
                <input 
                  type="text" 
                  id="std-mother-name" 
                  value="${initial.motherFullName || ''}" 
                  placeholder="Onasining to'liq ismi" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-mother-phone">
                  Telefon raqami
                </label>
                <input 
                  type="text" 
                  id="std-mother-phone" 
                  value="${initial.motherPhone || ''}" 
                  placeholder="+998 90 000 00 00" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-mother-passport">
                  Pasport / ID raqami
                </label>
                <input 
                  type="text" 
                  id="std-mother-passport" 
                  value="${initial.motherPassport || ''}" 
                  placeholder="Masalan: AA 1234567" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm font-mono"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-mother-pinfl">
                  JSHSHIR (PINFL) - 14 xonali
                </label>
                <input 
                  type="text" 
                  id="std-mother-pinfl" 
                  maxlength="14"
                  value="${initial.motherPinfl || ''}" 
                  placeholder="Masalan: 41504820010023" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm font-mono"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-mother-email">
                  Email (onasi, ixtiyoriy)
                </label>
                <input 
                  type="email" 
                  id="std-mother-email" 
                  value="${initial.motherEmail || ''}" 
                  placeholder="ona@gmail.com" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-mother-birthdate">
                  Tug'ilgan kuni
                </label>
                <input 
                  type="date" 
                  id="std-mother-birthdate" 
                  value="${initial.motherBirthDate || ''}" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-mother-age">
                  Onasi yoshi
                </label>
                <input 
                  type="number" 
                  id="std-mother-age" 
                  value="${initial.motherAge || ''}" 
                  placeholder="Masalan: 36" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-mother-job">
                  Ish joyi / Kasbi
                </label>
                <input 
                  type="text" 
                  id="std-mother-job" 
                  value="${initial.motherJob || ''}" 
                  placeholder="Kasbi yoki ish joyi" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>

              <div class="md:col-span-3">
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-mother-birthplace">
                  Tug'ilgan joyi
                </label>
                <input 
                  type="text" 
                  id="std-mother-birthplace" 
                  value="${initial.motherBirthPlace || ''}" 
                  placeholder="Viloyat, shahar, tuman" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>
            </div>
          </div>

          <!-- 5. Otasi Ma'lumotlari -->
          <div class="space-y-4 pt-4 border-t border-slate-100">
            <h3 class="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-700"></span>
              Otasi Haqida Ma'lumotlar
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="md:col-span-2">
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-father-name">
                  Otasi F.I.SH
                </label>
                <input 
                  type="text" 
                  id="std-father-name" 
                  value="${initial.fatherFullName || ''}" 
                  placeholder="Otasining to'liq ismi" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-father-phone">
                  Telefon raqami
                </label>
                <input 
                  type="text" 
                  id="std-father-phone" 
                  value="${initial.fatherPhone || ''}" 
                  placeholder="+998 90 000 00 00" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-father-passport">
                  Pasport / ID raqami
                </label>
                <input 
                  type="text" 
                  id="std-father-passport" 
                  value="${initial.fatherPassport || ''}" 
                  placeholder="Masalan: AA 7654321" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-father-pinfl">
                  JSHSHIR (PINFL) - 14 xonali
                </label>
                <input 
                  type="text" 
                  id="std-father-pinfl" 
                  maxlength="14"
                  value="${initial.fatherPinfl || ''}" 
                  placeholder="Masalan: 31504780010045" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-father-email">
                  Email (otasi, ixtiyoriy)
                </label>
                <input 
                  type="email" 
                  id="std-father-email" 
                  value="${initial.fatherEmail || ''}" 
                  placeholder="ota@gmail.com" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-father-birthdate">
                  Tug'ilgan kuni
                </label>
                <input 
                  type="date" 
                  id="std-father-birthdate" 
                  value="${initial.fatherBirthDate || ''}" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-father-age">
                  Otasi yoshi
                </label>
                <input 
                  type="number" 
                  id="std-father-age" 
                  value="${initial.fatherAge || ''}" 
                  placeholder="Masalan: 39" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-father-job">
                  Ish joyi / Kasbi
                </label>
                <input 
                  type="text" 
                  id="std-father-job" 
                  value="${initial.fatherJob || ''}" 
                  placeholder="Kasbi yoki ish joyi" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div class="md:col-span-3">
                <label class="block text-xs font-semibold text-slate-700 mb-1" for="std-father-birthplace">
                  Tug'ilgan joyi
                </label>
                <input 
                  type="text" 
                  id="std-father-birthplace" 
                  value="${initial.fatherBirthPlace || ''}" 
                  placeholder="Viloyat, shahar, tuman" 
                  class="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          <!-- 5. Ta'lim Platformalari (Kundalik.com va boshqalar) bo'yicha Login va Parollar -->
          <div class="space-y-4 pt-3 border-t border-slate-200">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                Ta'lim Platformalari (Login & Parollar)
              </h3>
              <span class="text-[11px] text-slate-500 font-medium">Kundalik.com, eMaktab va boshqalar</span>
            </div>

            <div id="platforms-form-section" class="space-y-3">
              ${currentPlatformsList.length === 0 ? `
                <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2.5">
                  <p class="text-xs text-slate-600 max-w-lg mx-auto">
                    Sinfda hali faol platformalar yo'q. Quyidagi tugma orqali <strong>Kundalik.com (eMaktab)</strong> ni darhol qo'shishingiz va o'quvchiga login/parol kiritishingiz mumkin:
                  </p>
                  <button 
                    type="button" 
                    id="quick-add-kundalik-btn"
                    class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    <span>+ Kundalik.com (eMaktab) platformasini qo'shish</span>
                  </button>
                </div>
              ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  ${currentPlatformsList.map(plat => {
                    const cred = getModalCred(plat.id);
                    return `
                      <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                            ${plat.name}
                          </span>
                          <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Hisob ma'lumotlari</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label class="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Login</label>
                            <input 
                              type="text" 
                              data-plat-login-id="${plat.id}" 
                              value="${cred.login || ''}" 
                              placeholder="Masalan: jasur_2012" 
                              class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono bg-white"
                            />
                          </div>
                          <div>
                            <label class="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Parol</label>
                            <input 
                              type="text" 
                              data-plat-pass-id="${plat.id}" 
                              value="${cred.password || ''}" 
                              placeholder="Parol" 
                              class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>

          <!-- 6. Qo'shimcha Darslar va O'quv Markazlari (To'garaklar) -->
          <div class="space-y-4 pt-4 border-t border-slate-200">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                  6. Qo'shimcha Darslar va O'quv Markazlari (To'garaklar)
                </h3>
                <p class="text-[11px] text-slate-500 mt-0.5">O'quvchi qatnashadigan to'garak, repetitor va o'quv markazlari ma'lumotlari (4-5 tagacha)</p>
              </div>
              <div class="flex items-center gap-2">
                <span id="extra-courses-counter" class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  ${extraCourses.length} / 5 ta dars
                </span>
                <button 
                  type="button" 
                  id="add-course-btn" 
                  class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs ${extraCourses.length >= 5 ? 'opacity-50 pointer-events-none' : ''}"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  <span>+ Dars qo'shish</span>
                </button>
              </div>
            </div>

            <div id="extra-courses-container" class="space-y-3">
              ${renderExtraCoursesHtml(extraCourses)}
            </div>
          </div>
        </div>

        <!-- Fixed Modal Footer (Always accessible!) -->
        <div class="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <button 
            type="button" 
            id="cancel-modal-btn"
            class="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Bekor qilish
          </button>

          <button 
            type="submit" 
            class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
          >
            ${isEdit ? "O'zgarishlarni Saqlash" : "O'quvchini Saqlash"}
          </button>
        </div>

      </form>
    </div>
  `;

  // Auto calculate age when birthDate changes
  const birthDateInput = modalContainer.querySelector('#std-birthdate');
  const ageInput = modalContainer.querySelector('#std-age');
  birthDateInput.addEventListener('change', (e) => {
    const calculated = calculateAge(e.target.value);
    if (calculated !== '') {
      ageInput.value = calculated;
    }
  });

  // Mother auto age
  const motherBirthDateInput = modalContainer.querySelector('#std-mother-birthdate');
  const motherAgeInput = modalContainer.querySelector('#std-mother-age');
  motherBirthDateInput.addEventListener('change', (e) => {
    const calculated = calculateAge(e.target.value);
    if (calculated !== '') {
      motherAgeInput.value = calculated;
    }
  });

  // Father auto age
  const fatherBirthDateInput = modalContainer.querySelector('#std-father-birthdate');
  const fatherAgeInput = modalContainer.querySelector('#std-father-age');
  fatherBirthDateInput.addEventListener('change', (e) => {
    const calculated = calculateAge(e.target.value);
    if (calculated !== '') {
      fatherAgeInput.value = calculated;
    }
  });

  const form = modalContainer.querySelector('#student-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const fullName = modalContainer.querySelector('#std-fullname').value.trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const lastName = parts[0] || '';
    const firstName = parts[1] || '';
    const middleName = parts.slice(2).join(' ') || '';

    const studentData = {
      ...(student || {}),
      id: student ? student.id : 'std-' + Date.now(),
      classId: student ? student.classId : currentClassId,
      schoolId: student ? student.schoolId : currentSchoolId,

      lastName,
      firstName,
      middleName,
      fullName,
      gender: modalContainer.querySelector('#std-gender').value,
      birthDate: modalContainer.querySelector('#std-birthdate').value,
      age: parseInt(modalContainer.querySelector('#std-age').value) || '',
      phone: modalContainer.querySelector('#std-phone').value.trim(),
      email: modalContainer.querySelector('#std-email')?.value.trim() || '',
      birthPlace: modalContainer.querySelector('#std-birthplace').value.trim(),
      address: modalContainer.querySelector('#std-address').value.trim(),
      photo: '',

      fhdyoOrgan: modalContainer.querySelector('#std-fhdyo').value.trim(),
      dalolatnomaNumber: modalContainer.querySelector('#std-dalolatnoma').value.trim(),
      guvohnomaSeriaNumber: modalContainer.querySelector('#std-guvohnoma-seria').value.trim(),
      guvohnomaDate: modalContainer.querySelector('#std-guvohnoma-date').value,

      passportNumber: modalContainer.querySelector('#std-passport').value.trim(),
      pinfl: modalContainer.querySelector('#std-pinfl').value.trim(),
      pinflPassport: modalContainer.querySelector('#std-pinfl-passport').value.trim(),

      motherFullName: modalContainer.querySelector('#std-mother-name').value.trim(),
      motherPassport: modalContainer.querySelector('#std-mother-passport')?.value.trim() || '',
      motherPinfl: modalContainer.querySelector('#std-mother-pinfl')?.value.trim() || '',
      motherPhone: modalContainer.querySelector('#std-mother-phone').value.trim(),
      motherEmail: modalContainer.querySelector('#std-mother-email')?.value.trim() || '',
      motherBirthDate: modalContainer.querySelector('#std-mother-birthdate').value,
      motherAge: parseInt(modalContainer.querySelector('#std-mother-age').value) || '',
      motherJob: modalContainer.querySelector('#std-mother-job').value.trim(),
      motherBirthPlace: modalContainer.querySelector('#std-mother-birthplace').value.trim(),

      fatherFullName: modalContainer.querySelector('#std-father-name').value.trim(),
      fatherPassport: modalContainer.querySelector('#std-father-passport')?.value.trim() || '',
      fatherPinfl: modalContainer.querySelector('#std-father-pinfl')?.value.trim() || '',
      fatherPhone: modalContainer.querySelector('#std-father-phone').value.trim(),
      fatherEmail: modalContainer.querySelector('#std-father-email')?.value.trim() || '',
      fatherBirthDate: modalContainer.querySelector('#std-father-birthdate').value,
      fatherAge: parseInt(modalContainer.querySelector('#std-father-age').value) || '',
      fatherJob: modalContainer.querySelector('#std-father-job').value.trim(),
      fatherBirthPlace: modalContainer.querySelector('#std-father-birthplace').value.trim()
    };

    delete studentData.chipData;

    // Platformalar bo'yicha kiritilgan login va parollarni yig'ish
    const platformsData = { ...(student?.platforms || {}) };
    currentPlatformsList.forEach(plat => {
      const loginEl = modalContainer.querySelector(`[data-plat-login-id="${plat.id}"]`);
      const passEl = modalContainer.querySelector(`[data-plat-pass-id="${plat.id}"]`);
      const loginVal = loginEl ? loginEl.value.trim() : '';
      const passVal = passEl ? passEl.value.trim() : '';
      if (loginVal || passVal) {
        platformsData[plat.id] = { login: loginVal, password: passVal };
      } else {
        delete platformsData[plat.id];
      }
    });
    studentData.platforms = platformsData;

    // Qo'shimcha darslar (4-5 tagacha)
    // Faqat dars nomi kiritilgan bo'lsa ham saqlanadi (qolgan barcha maydonlar bo'sh bo'lishi mumkin)
    const finalCourses = syncCurrentCoursesFromDOM()
      .map(c => ({
        id: c.id,
        courseName: (c.courseName || '').trim(),
        teacherName: (c.teacherName || '').trim(),
        centerName: (c.centerName || '').trim(),
        centerAddress: (c.centerAddress || '').trim(),
        teacherPhone: (c.teacherPhone || '').trim()
      }))
      .filter(c => c.courseName || c.teacherName || c.centerName || c.centerAddress || c.teacherPhone)
      .slice(0, 5);

    studentData.extraCourses = finalCourses;

    // Saqlash muvaffaqiyatli yakunlangach qoralama xotirasini butunlay tozalash
    isSavedSuccessfully = true;
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      sessionStorage.removeItem(DRAFT_MODAL_OPEN_KEY);
    } catch (e) {}

    const backdrop = modalContainer.querySelector('#student-modal-backdrop');
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      onSave(studentData);
    });
  });

  // Qo'shimcha darslar bilan interaktiv ishlash yordamchilari
  function syncCurrentCoursesFromDOM() {
    const items = modalContainer.querySelectorAll('.extra-course-item');
    const result = [];
    items.forEach((itemEl, idx) => {
      result.push({
        id: itemEl.dataset.courseId || `course-${Date.now()}-${idx}`,
        courseName: itemEl.querySelector('.extra-course-name')?.value || '',
        teacherName: itemEl.querySelector('.extra-course-teacher-name')?.value || '',
        centerName: itemEl.querySelector('.extra-course-center')?.value || '',
        centerAddress: itemEl.querySelector('.extra-course-address')?.value || '',
        teacherPhone: itemEl.querySelector('.extra-course-phone')?.value || ''
      });
    });
    return result;
  }

  function updateExtraCoursesUI() {
    const container = modalContainer.querySelector('#extra-courses-container');
    const counter = modalContainer.querySelector('#extra-courses-counter');
    const addBtn = modalContainer.querySelector('#add-course-btn');

    if (container) {
      container.innerHTML = renderExtraCoursesHtml(extraCourses);
    }
    if (counter) {
      counter.textContent = `${extraCourses.length} / 5 ta dars`;
    }
    if (addBtn) {
      if (extraCourses.length >= 5) {
        addBtn.classList.add('opacity-50', 'pointer-events-none');
      } else {
        addBtn.classList.remove('opacity-50', 'pointer-events-none');
      }
    }
    attachExtraCoursesListeners();
  }

  function attachExtraCoursesListeners() {
    const addBtn = modalContainer.querySelector('#add-course-btn');
    const addFirstBtn = modalContainer.querySelector('#add-first-course-btn');

    const handleAdd = () => {
      const current = syncCurrentCoursesFromDOM();
      if (current.length < 5) {
        current.push({
          id: `course-${Date.now()}-${current.length}`,
          courseName: '',
          teacherName: '',
          centerName: '',
          centerAddress: '',
          teacherPhone: ''
        });
        extraCourses = current;
        updateExtraCoursesUI();
        const names = modalContainer.querySelectorAll('.extra-course-name');
        if (names.length > 0) {
          names[names.length - 1].focus();
        }
      }
    };

    if (addBtn) addBtn.onclick = handleAdd;
    if (addFirstBtn) addFirstBtn.onclick = handleAdd;

    const removeBtns = modalContainer.querySelectorAll('.remove-course-btn');
    removeBtns.forEach(btn => {
      btn.onclick = () => {
        const removeIdx = parseInt(btn.dataset.removeCourseIndex);
        const current = syncCurrentCoursesFromDOM();
        if (!isNaN(removeIdx) && removeIdx >= 0 && removeIdx < current.length) {
          current.splice(removeIdx, 1);
          extraCourses = current;
          updateExtraCoursesUI();
        }
      };
    });
  }

  // Dastlabki hodisa tinglovchilarini ulash
  attachExtraCoursesListeners();

  // Quick add Kundalik platform from within student modal
  const quickAddKundalikBtn = modalContainer.querySelector('#quick-add-kundalik-btn');
  if (quickAddKundalikBtn) {
    quickAddKundalikBtn.addEventListener('click', () => {
      const newPlatform = {
        id: 'plat-kundalik',
        name: 'Kundalik.com (eMaktab)',
        url: 'https://emaktab.uz',
        description: "Elektron baholash, jurnal va kundalik tizimi",
        createdAt: new Date().toISOString()
      };
      if (onQuickAddPlatform) {
        onQuickAddPlatform(newPlatform);
      }
      if (!currentPlatformsList.some(p => p.id === 'plat-kundalik')) {
        currentPlatformsList.push(newPlatform);
      }

      const section = modalContainer.querySelector('#platforms-form-section');
      if (section) {
        section.innerHTML = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Kundalik.com (eMaktab)
                </span>
                <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Hisob ma'lumotlari</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label class="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Login</label>
                  <input 
                    type="text" 
                    data-plat-login-id="plat-kundalik" 
                    value="" 
                    placeholder="Masalan: jasur_2012" 
                    class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono bg-white"
                  />
                </div>
                <div>
                  <label class="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Parol</label>
                  <input 
                    type="text" 
                    data-plat-pass-id="plat-kundalik" 
                    value="" 
                    placeholder="Parol" 
                    class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        `;
      }
    });
  }

  // DIQQAT TALABI: Inputga kiritilgan ma'lumotlar real-time emas, faqat foydalanuvchi 
  // saqlash tugmasini bosmasdan chiqish yoki yopish tugmasini bosib yuborsa KEYIN saqlanadi!
  // Saqlash muvaffaqiyatli bosilgach esa qoralama butunlay tozalangan bo'ladi.
  const saveDraftOnUnsavedExit = () => {
    if (isEdit || isSavedSuccessfully) return;
    try {
      const fullName = modalContainer.querySelector('#std-fullname')?.value || '';
      const parts = fullName.trim().split(/\s+/).filter(Boolean);

      const currentVals = {
        fullName,
        lastName: parts[0] || '',
        firstName: parts[1] || '',
        middleName: parts.slice(2).join(' ') || '',
        gender: modalContainer.querySelector('#std-gender')?.value || "O'g'il",
        birthDate: modalContainer.querySelector('#std-birthdate')?.value || '',
        age: modalContainer.querySelector('#std-age')?.value || '',
        phone: modalContainer.querySelector('#std-phone')?.value || '',
        email: modalContainer.querySelector('#std-email')?.value || '',
        birthPlace: modalContainer.querySelector('#std-birthplace')?.value || '',
        address: modalContainer.querySelector('#std-address')?.value || '',
        fhdyoOrgan: modalContainer.querySelector('#std-fhdyo')?.value || '',
        dalolatnomaNumber: modalContainer.querySelector('#std-dalolatnoma')?.value || '',
        guvohnomaSeriaNumber: modalContainer.querySelector('#std-guvohnoma-seria')?.value || '',
        guvohnomaDate: modalContainer.querySelector('#std-guvohnoma-date')?.value || '',
        passportNumber: modalContainer.querySelector('#std-passport')?.value || '',
        pinfl: modalContainer.querySelector('#std-pinfl')?.value || '',
        pinflPassport: modalContainer.querySelector('#std-pinfl-passport')?.value || '',
        motherFullName: modalContainer.querySelector('#std-mother-name')?.value || '',
        motherPassport: modalContainer.querySelector('#std-mother-passport')?.value || '',
        motherPinfl: modalContainer.querySelector('#std-mother-pinfl')?.value || '',
        motherPhone: modalContainer.querySelector('#std-mother-phone')?.value || '',
        motherEmail: modalContainer.querySelector('#std-mother-email')?.value || '',
        motherBirthDate: modalContainer.querySelector('#std-mother-birthdate')?.value || '',
        motherAge: modalContainer.querySelector('#std-mother-age')?.value || '',
        motherJob: modalContainer.querySelector('#std-mother-job')?.value || '',
        motherBirthPlace: modalContainer.querySelector('#std-mother-birthplace')?.value || '',
        fatherFullName: modalContainer.querySelector('#std-father-name')?.value || '',
        fatherPassport: modalContainer.querySelector('#std-father-passport')?.value || '',
        fatherPinfl: modalContainer.querySelector('#std-father-pinfl')?.value || '',
        fatherPhone: modalContainer.querySelector('#std-father-phone')?.value || '',
        fatherEmail: modalContainer.querySelector('#std-father-email')?.value || '',
        fatherBirthDate: modalContainer.querySelector('#std-father-birthdate')?.value || '',
        fatherAge: modalContainer.querySelector('#std-father-age')?.value || '',
        fatherJob: modalContainer.querySelector('#std-father-job')?.value || '',
        fatherBirthPlace: modalContainer.querySelector('#std-father-birthplace')?.value || '',
        extraCourses: syncCurrentCoursesFromDOM(),
        platforms: {}
      };

      currentPlatformsList.forEach(plat => {
        const loginEl = modalContainer.querySelector(`[data-plat-login-id="${plat.id}"]`);
        const passEl = modalContainer.querySelector(`[data-plat-pass-id="${plat.id}"]`);
        const loginVal = loginEl ? loginEl.value.trim() : '';
        const passVal = passEl ? passEl.value.trim() : '';
        if (loginVal || passVal) {
          currentVals.platforms[plat.id] = { login: loginVal, password: passVal };
        }
      });

      // Agar foydalanuvchi rostdan ham biror ma'lumot kiritib qo'ygan bo'lsa
      const hasAnyVal = Boolean(
        fullName.trim() ||
        currentVals.phone.trim() ||
        currentVals.address.trim() ||
        currentVals.birthDate ||
        currentVals.motherFullName.trim() ||
        currentVals.fatherFullName.trim() ||
        currentVals.extraCourses.length > 0 ||
        Object.keys(currentVals.platforms).length > 0
      );

      if (hasAnyVal) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          classId: currentClassId,
          schoolId: currentSchoolId,
          data: currentVals,
          savedAt: Date.now()
        }));
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch (err) {
      console.warn("Draft saqlashda bildirishnoma:", err);
    }
  };

  // Ism-sharif kiritilganda jinsni avtomatik aniqlash (Qiz yoki O'g'il)
  const fnInput = modalContainer.querySelector('#std-fullname');
  const genderSelect = modalContainer.querySelector('#std-gender');
  let userManuallyChangedGender = false;
  if (genderSelect) {
    genderSelect.addEventListener('change', () => {
      userManuallyChangedGender = true;
    });
  }
  if (fnInput && genderSelect) {
    fnInput.addEventListener('input', () => {
      if (!userManuallyChangedGender) {
        const detected = detectGenderFromName(fnInput.value);
        if (detected) {
          genderSelect.value = detected;
        }
      }
    });
  }

  // Qoralamani qo'lda tozalash tugmasi
  const clearDraftBtn = modalContainer.querySelector('#clear-draft-btn');
  if (clearDraftBtn) {
    clearDraftBtn.addEventListener('click', () => {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        sessionStorage.removeItem(DRAFT_MODAL_OPEN_KEY);
      } catch (e) {}
      const banner = modalContainer.querySelector('#draft-alert-banner');
      if (banner) banner.remove();
      form.reset();
      // F.I.SH va yosh inputlarini bo'shatish
      const fnInput = modalContainer.querySelector('#std-fullname');
      if (fnInput) fnInput.value = '';
    });
  }

  const closeBtn = modalContainer.querySelector('#close-modal-btn');
  const cancelBtn = modalContainer.querySelector('#cancel-modal-btn');
  const close = () => {
    // Chiqish yoki yopish bosilganda, saqlanmagan bo'lsa qoralamaga yozib qoladi
    saveDraftOnUnsavedExit();
    try {
      sessionStorage.removeItem(DRAFT_MODAL_OPEN_KEY);
    } catch (e) {}
    const backdrop = modalContainer.querySelector('#student-modal-backdrop');
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (onCancel) onCancel();
    });
  };
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  // DIQQAT: Foydalanuvchi talabiga ko'ra oyna yon tomonlarini (backdrop)
  // tasodifan bosib yuborganda o'quvchi ma'lumotlari yo'qolmasligi uchun
  // fon bosilganda oyna yopilmaydi. Faqat "Bekor qilish" yoki "X" orqali yopiladi.
}
