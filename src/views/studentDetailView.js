import { formatDate } from '../data.js';
import { formatStudentGender, isFemaleStudent } from '../utils/exportUtils.js';

export function generateFullDossierText(student, school, studentClass) {
  let lastName = student.lastName || '';
  let firstName = student.firstName || '';
  let middleName = student.middleName || '';

  if (!lastName && !firstName && student.fullName) {
    const parts = student.fullName.trim().split(/\s+/);
    lastName = parts[0] || '';
    firstName = parts[1] || '';
    middleName = parts.slice(2).join(' ') || '';
  }

  const platforms = (studentClass && Array.isArray(studentClass.platforms)) ? studentClass.platforms : [];
  let platformsText = '';
  if (student.platforms && Object.keys(student.platforms).length > 0) {
    const pLines = [];
    Object.entries(student.platforms).forEach(([pId, cred]) => {
      const pObj = platforms.find(p => p.id === pId);
      const pName = pObj ? pObj.name : pId;
      pLines.push(`- ${pName}: Login: ${cred.login || "-"} | Parol: ${cred.password || "-"}`);
    });
    if (pLines.length > 0) {
      platformsText = `\n\nTA'LIM PLATFORMALARI (KUNDALIK VA B.):\n` + pLines.join('\n');
    }
  }

  let extraCoursesText = '';
  if (Array.isArray(student.extraCourses) && student.extraCourses.length > 0) {
    const cLines = [];
    student.extraCourses.forEach((c, i) => {
      const parts = [`${i + 1}. Dars: ${c.courseName || "-"}`];
      if (c.teacherName) parts.push(`O'qituvchi: ${c.teacherName}`);
      if (c.teacherPhone) parts.push(`Tel: ${c.teacherPhone}`);
      if (c.centerName) parts.push(`O'quv markazi: ${c.centerName}`);
      if (c.centerAddress) parts.push(`Manzil: ${c.centerAddress}`);
      cLines.push(parts.join(' | '));
    });
    if (cLines.length > 0) {
      extraCoursesText = `\n\nQO'SHIMCHA DARSLAR VA O'QUV MARKAZLARI:\n` + cLines.join('\n');
    }
  }

  return `
O'QUVCHINING TO'LIQ SHAXSIY DOSYESI:
----------------------------------------
Maktab: ${school ? school.name : "-"}
Sinf: ${studentClass ? studentClass.name : "-"}
Sinf rahbari: ${studentClass ? studentClass.teacherName : "-"}

SHAXSIY MA'LUMOTLAR:
- Familiya: ${lastName || "-"}
- Ism: ${firstName || "-"}
- Otasining ismi: ${middleName || "-"}
- To'liq F.I.SH: ${student.fullName || "-"}
- Jinsi: ${formatStudentGender(student, true)}
- Tug'ilgan sana: ${formatDate(student.birthDate)} (${student.age || '-'} yosh)
- Tug'ilgan joyi: ${student.birthPlace || "-"}
- Yashash manzili: ${student.address || "-"}
- Telefon: ${student.phone || "-"}
- Email: ${student.email || "-"}

FHDYO VA TUG'ILGANLIK GUVOHNOMASI:
- FHDYO organi: ${student.fhdyoOrgan || "-"}
- Dalolatnoma raqami: ${student.dalolatnomaNumber || "-"}
- Guvohnoma seriyasi va raqami: ${student.guvohnomaSeriaNumber || "-"}
- Guvohnoma berilgan sana: ${formatDate(student.guvohnomaDate)}

PASPORT VA PINFL:
- Pasport / ID-karta raqami: ${student.passportNumber || "-"}
- JShShIR (PINFL): ${student.pinfl || "-"}
- JShShIR {Pasport}: ${student.pinflPassport || "-"}

ONASI:
- F.I.SH: ${student.motherFullName || "-"}
- Pasport / ID: ${student.motherPassport || "-"}
- JShShIR: ${student.motherPinfl || "-"}
- Yoshi: ${student.motherAge || "-"}
- Tug'ilgan sanasi: ${formatDate(student.motherBirthDate)}
- Tug'ilgan joyi: ${student.motherBirthPlace || "-"}
- Telefon: ${student.motherPhone || "-"}
- Email: ${student.motherEmail || "-"}
- Ish joyi / Kasbi: ${student.motherJob || "-"}

OTASI:
- F.I.SH: ${student.fatherFullName || "-"}
- Pasport / ID: ${student.fatherPassport || "-"}
- JShShIR: ${student.fatherPinfl || "-"}
- Yoshi: ${student.fatherAge || "-"}
- Tug'ilgan sanasi: ${formatDate(student.fatherBirthDate)}
- Tug'ilgan joyi: ${student.fatherBirthPlace || "-"}
- Telefon: ${student.fatherPhone || "-"}
- Email: ${student.fatherEmail || "-"}
- Ish joyi / Kasbi: ${student.fatherJob || "-"}${platformsText}${extraCoursesText}
----------------------------------------
Ko'chirildi: ${new Date().toLocaleString('uz-UZ')}
  `.trim();
}

export function renderStudentDetail(container, { 
  student, 
  school, 
  studentClass, 
  onBack, 
  onEdit, 
  onDelete, 
  onExport, 
  onExportWord, 
  onExportExcel, 
  onExportPDF, 
  onPrint, 
  showToast, 
  backButtonLabel 
}) {
  const avatarLetter = (student.fullName || 'O').trim().charAt(0).toUpperCase();

  const backLabel = backButtonLabel || "Orqaga qaytish";

  let lastName = student.lastName || '';
  let firstName = student.firstName || '';
  let middleName = student.middleName || '';

  if (!lastName && !firstName && student.fullName) {
    const parts = student.fullName.trim().split(/\s+/);
    lastName = parts[0] || '';
    firstName = parts[1] || '';
    middleName = parts.slice(2).join(' ') || '';
  }

  // Copy helper component
  function renderCopyBtn(value, label = '', theme = 'indigo') {
    if (!value || value === '-' || value === 'Mavjud emas' || value === 'Kiritilmagan') {
      return '';
    }
    const hoverColor = theme === 'pink' 
      ? 'hover:text-pink-600 hover:bg-pink-50' 
      : (theme === 'blue' ? 'hover:text-blue-600 hover:bg-blue-50' : 'hover:text-indigo-600 hover:bg-indigo-50/80');

    return `
      <button 
        type="button" 
        class="copy-btn inline-flex items-center justify-center p-1 rounded-md text-slate-400 ${hoverColor} transition-all cursor-pointer print-hide shrink-0" 
        data-copy="${encodeURIComponent(String(value))}"
        data-label="${label}"
        title="${label ? label + 'dan nusxa olish' : 'Nusxa olish'}"
      >
        <svg class="w-3.5 h-3.5 copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
      </button>
    `;
  }

  // Call helper component (mobile/phone click-to-call)
  function renderCallBtn(phone, label = '') {
    if (!phone || phone === '-' || phone === 'Mavjud emas' || phone === 'Kiritilmagan') {
      return '';
    }
    const cleanNumber = String(phone).replace(/[^0-9+]/g, '');
    if (!cleanNumber) return '';
    return `
      <a 
        href="tel:${cleanNumber}" 
        class="call-btn inline-flex items-center justify-center p-1 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 transition-all cursor-pointer print-hide shrink-0" 
        title="${label ? label + 'ga qo\'ng\'iroq qilish' : 'Qo\'ng\'iroq qilish'}: ${phone}"
        aria-label="${label ? label + 'ga qo\'ng\'iroq qilish' : 'Qo\'ng\'iroq qilish'}"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
        </svg>
      </a>
    `;
  }

  container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto pb-16">
      
      <!-- Clean Top Breadcrumb (Print hide) -->
      <div class="flex items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs print-hide">
        <div class="flex items-center gap-3">
          <button 
            id="back-to-list-btn"
            class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200/80 transition-all cursor-pointer shadow-xs active:scale-95 group shrink-0"
            title="${backLabel || 'Orqaga'}"
            aria-label="${backLabel || 'Orqaga'}"
          >
            <svg class="w-5 h-5 text-slate-700 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
          </button>
          <div class="hidden sm:block min-w-0">
            <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">O'quvchi ma'lumotlari</div>
            <div class="text-sm font-bold text-slate-800 truncate">${student.fullName || "O'quvchi"}</div>
          </div>
        </div>

        <!-- Classic format icons and action buttons -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <!-- Word (.docx) -->
          <button 
            id="student-export-word-btn"
            class="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 hover:bg-blue-100/90 text-blue-700 border border-blue-200 transition-all shadow-2xs cursor-pointer active:scale-95 group"
            title="Word (.docx) formatida yuklab olish"
            aria-label="Word (.docx) formatida yuklab olish"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </button>

          <!-- Excel (.xlsx) -->
          <button 
            id="student-export-excel-btn"
            class="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200 transition-all shadow-2xs cursor-pointer active:scale-95 group"
            title="Excel (.xlsx) jadvalini yuklab olish"
            aria-label="Excel (.xlsx) jadvalini yuklab olish"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </button>

          <!-- PDF (.pdf) -->
          <button 
            id="student-export-pdf-btn"
            class="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 hover:bg-rose-100/90 text-rose-700 border border-rose-200 transition-all shadow-2xs cursor-pointer active:scale-95 group"
            title="PDF (.pdf) formatida yuklab olish"
            aria-label="PDF (.pdf) formatida yuklab olish"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
          </button>

          <!-- Chop etish (Printer) -->
          <button 
            id="student-print-btn"
            class="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Chop etish (Printer)"
            aria-label="Chop etish (Printer)"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
          </button>

          <!-- Ma'lumotlarni nusxalash -->
          <button 
            id="student-copy-text-btn"
            class="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-all shadow-2xs cursor-pointer active:scale-95 group"
            title="O'quvchi ma'lumotlarini to'liq nusxalash (Clipboard)"
            aria-label="Ma'lumotlarni nusxalash"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 group-hover:text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
          </button>

          <!-- Eksport Modal ochish tugmasi -->
          <button 
            id="student-detail-export-btn"
            class="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200 transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Barcha eksport formatlari"
            aria-label="Eksport menyusi"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Official Dossier Card (Printable) -->
      <div class="print-page bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-10 space-y-8">
        
        <!-- Print Header (Visible in print) -->
        <div class="hidden print-header text-center">
          <div class="text-xs uppercase tracking-widest text-slate-500 font-semibold">O'zbekiston Respublikasi Maktabgacha va Maktab Ta'limi Vazirligi</div>
          <div class="text-lg font-bold text-slate-900">${school ? school.name : "Umumta'lim Maktabi"}</div>
          <div class="text-base font-semibold text-slate-700 mt-1">O'QUVCHINING SHAXSIY VARAQASI</div>
        </div>

        <!-- Student Hero Card -->
        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-8 border-b border-slate-100">
          <div class="relative shrink-0">
            ${student.photo ? `
              <img src="${student.photo}" alt="${student.fullName}" class="w-36 h-44 rounded-2xl object-cover border border-slate-200 shadow-sm" />
            ` : `
              <div class="w-36 h-44 rounded-2xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                <span class="text-4xl font-bold text-slate-400">${avatarLetter}</span>
                <span class="text-[11px] mt-2 font-medium">Fotosurat yo'q</span>
              </div>
            `}
          </div>

          <div class="flex-1 text-center sm:text-left space-y-2.5">
            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                ${studentClass ? `${studentClass.name} sinf` : "Sinf"}
              </span>
              <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${isFemaleStudent(student) ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'}">
                ${formatStudentGender(student, true)}
              </span>
              ${student.age ? `
                <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  ${student.age} yosh
                </span>
              ` : ''}
            </div>

            <div class="flex items-center justify-center sm:justify-start gap-2">
              <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                ${student.fullName}
              </h1>
              ${renderCopyBtn(student.fullName, "To'liq F.I.SH")}
            </div>

            <div class="text-xs sm:text-sm text-slate-600">
              <span>Maktab: <strong>${school ? school.name : "-"}</strong></span>
              ${studentClass ? ` | <span>Sinf rahbari: <strong>${studentClass.teacherName}</strong></span>` : ''}
            </div>

            <div class="pt-2 flex flex-wrap gap-3 text-xs font-mono text-slate-600 justify-center sm:justify-start">
              ${student.phone ? `
                <div class="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                  <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  <span>Tel: <a href="tel:${student.phone.replace(/[^0-9+]/g, '')}" class="text-slate-900 font-bold hover:text-emerald-600 transition-colors">${student.phone}</a></span>
                  <div class="flex items-center gap-0.5 ml-1">
                    ${renderCallBtn(student.phone, "O'quvchi")}
                    ${renderCopyBtn(student.phone, "Telefon")}
                  </div>
                </div>
              ` : ''}
              ${student.email ? `
                <div class="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                  <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <span>Email: <strong class="text-slate-900">${student.email}</strong></span>
                  ${renderCopyBtn(student.email, "Email")}
                </div>
              ` : ''}
              ${student.pinfl ? `
                <div class="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                  <span class="text-slate-400 font-sans">JShShIR:</span>
                  <strong class="text-slate-900">${student.pinfl}</strong>
                  ${renderCopyBtn(student.pinfl, "JShShIR")}
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- 0. Ta'lim Muassasasi va Mas'ul Shaxslar (Maktab, Sinf va Shaxslar) -->
        <div class="space-y-3">
          <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-violet-600"></span>
            Ta'lim Muassasasi va Mas'ul Shaxslar
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50/90 p-5 rounded-2xl border border-slate-200/80">
            <!-- Maktab va Admin -->
            <div class="space-y-2">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maktab va Mas'ul Admin</div>
              <div class="font-bold text-slate-900 text-base">${school ? school.name : "Umumta'lim maktabi"}</div>
              <div class="text-xs text-slate-500">Manzil: <strong class="text-slate-800">${school?.address || "Ko'rsatilmagan"}</strong></div>
              <div class="text-xs text-slate-600 flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                <span>Mas'ul Admin: <strong class="text-slate-900">${school?.adminName || "-"}</strong></span>
                ${school?.adminPhone ? `
                  <div class="flex items-center gap-1">
                    <a href="tel:${school.adminPhone.replace(/[^0-9+]/g, '')}" class="font-mono text-indigo-600 hover:text-emerald-600 hover:underline font-semibold">${school.adminPhone}</a>
                    ${renderCallBtn(school.adminPhone, "Mas'ul Admin")}
                    ${renderCopyBtn(school.adminPhone, "Admin telefoni")}
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Sinf va Sinf Rahbari -->
            <div class="space-y-2">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sinf va Sinf Rahbari</div>
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900 text-base">${studentClass ? `${studentClass.name} Sinf` : "Sinf biriktirilmagan"}</span>
                ${studentClass?.academicYear ? `
                  <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono">${studentClass.academicYear}</span>
                ` : ''}
              </div>
              <div class="text-xs text-slate-500">
                Mutaxassislik fani: <strong class="text-slate-800">${studentClass?.teacherSubject || "Ko'rsatilmagan"}</strong>
                ${studentClass?.language ? ` | Tili: <strong class="text-slate-800">${studentClass.language}</strong>` : ''}
              </div>
              <div class="text-xs text-slate-600 flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                <span>Sinf Rahbari: <strong class="text-slate-900">${studentClass?.teacherName || "-"}</strong></span>
                ${studentClass?.teacherPhone ? `
                  <div class="flex items-center gap-1">
                    <a href="tel:${studentClass.teacherPhone.replace(/[^0-9+]/g, '')}" class="font-mono text-indigo-600 hover:text-emerald-600 hover:underline font-semibold">${studentClass.teacherPhone}</a>
                    ${renderCallBtn(studentClass.teacherPhone, "Sinf Rahbari")}
                    ${renderCopyBtn(studentClass.teacherPhone, "Sinf rahbari telefoni")}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- 1. Ism, Familiya va Otasining ismi (Alohida ko'rinishi) -->
        <div class="space-y-3">
          <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
            1. Shaxsiy Ism va Familiya Bo'limi
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/70 flex items-center justify-between">
              <div>
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Familiya</div>
                <div class="font-bold text-slate-900 text-sm mt-0.5">${lastName || "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(lastName, "Familiya")}
            </div>

            <div class="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/70 flex items-center justify-between">
              <div>
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ism</div>
                <div class="font-bold text-slate-900 text-sm mt-0.5">${firstName || "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(firstName, "Ism")}
            </div>

            <div class="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/70 flex items-center justify-between">
              <div>
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Otasining ismi</div>
                <div class="font-bold text-slate-900 text-sm mt-0.5">${middleName || "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(middleName, "Otasining ismi")}
            </div>
          </div>
        </div>

        <!-- 2. Tug'ilish va Shaxsiy Ma'lumotlar -->
        <div class="space-y-3">
          <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            2. Tug'ilish va Aloqa Ma'lumotlari
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
            <div class="flex items-start justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tug'ilgan sana</div>
                <div class="font-semibold text-slate-900 mt-1">${formatDate(student.birthDate)} (${student.age || '-'} yosh)</div>
              </div>
              ${renderCopyBtn(formatDate(student.birthDate), "Tug'ilgan sana")}
            </div>

            <div class="flex items-start justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tug'ilgan joyi</div>
                <div class="font-semibold text-slate-900 mt-1">${student.birthPlace || "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(student.birthPlace, "Tug'ilgan joyi")}
            </div>

            <div class="flex items-start justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jinsi</div>
                <div class="font-semibold text-slate-900 mt-1">${formatStudentGender(student, true)}</div>
              </div>
              ${renderCopyBtn(formatStudentGender(student, true), "Jinsi")}
            </div>

            <div class="flex items-start justify-between pt-2 border-t border-slate-200/60">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Telefon raqami (o'ziniki)</div>
                <div class="font-semibold font-mono text-slate-900 mt-1">
                  ${student.phone ? `<a href="tel:${student.phone.replace(/[^0-9+]/g, '')}" class="text-indigo-600 hover:text-emerald-600 hover:underline transition-colors">${student.phone}</a>` : "Kiritilmagan"}
                </div>
              </div>
              <div class="flex items-center gap-0.5">
                ${renderCallBtn(student.phone, "O'quvchi telefoni")}
                ${renderCopyBtn(student.phone, "Telefon raqami")}
              </div>
            </div>

            <div class="flex items-start justify-between pt-2 border-t border-slate-200/60">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email (o'ziniki, ixtiyoriy)</div>
                <div class="font-semibold text-slate-900 mt-1">${student.email ? `<a href="mailto:${student.email}" class="text-indigo-600 hover:underline">${student.email}</a>` : "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(student.email, "Email")}
            </div>

            <div class="md:col-span-2 lg:col-span-3 flex items-start justify-between pt-2 border-t border-slate-200/60">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Yashash manzili</div>
                <div class="font-semibold text-slate-900 mt-1">${student.address || "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(student.address, "Yashash manzili")}
            </div>
          </div>
        </div>

        <!-- 3. FHDYO va Davlat Ro'yxati Ma'lumotlari -->
        <div class="space-y-3">
          <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
            3. FHDYO va Tug'ilganlik Guvohnomasi
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
            <div class="md:col-span-2 flex items-start justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">FHDYO organi nomi</div>
                <div class="font-semibold text-slate-900 mt-1">${student.fhdyoOrgan || "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(student.fhdyoOrgan, "FHDYO organi")}
            </div>

            <div class="flex items-start justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dalolatnoma yozuvi (qayd)</div>
                <div class="font-semibold text-slate-900 mt-1">${student.dalolatnomaNumber || "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(student.dalolatnomaNumber, "Dalolatnoma raqami")}
            </div>

            <div class="flex items-start justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Guvohnoma seriyasi va raqami</div>
                <div class="font-semibold text-slate-900 font-mono mt-1">${student.guvohnomaSeriaNumber || "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(student.guvohnomaSeriaNumber, "Guvohnoma seriyasi")}
            </div>

            <div class="flex items-start justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Guvohnoma berilgan sana</div>
                <div class="font-semibold text-slate-900 mt-1">${formatDate(student.guvohnomaDate)}</div>
              </div>
              ${renderCopyBtn(formatDate(student.guvohnomaDate), "Guvohnoma berilgan sana")}
            </div>
          </div>
        </div>

        <!-- 4. Pasport / ID-karta va Biometrik Ma'lumotlar -->
        <div class="space-y-3">
          <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            4. Pasport / ID-karta va PINFL Ma'lumotlari
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
            <div class="flex items-start justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pasport / ID raqami</div>
                <div class="font-semibold font-mono text-slate-900 mt-1">${student.passportNumber || "Mavjud emas"}</div>
              </div>
              ${renderCopyBtn(student.passportNumber, "Pasport raqami")}
            </div>

            <div class="flex items-start justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">JShShIR (PINFL)</div>
                <div class="font-semibold font-mono text-slate-900 mt-1">${student.pinfl || "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(student.pinfl, "JShShIR")}
            </div>

            <div class="flex items-start justify-between">
              <div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">JShShIR {Pasport}</div>
                <div class="font-semibold font-mono text-slate-900 mt-1">${student.pinflPassport || "Kiritilmagan"}</div>
              </div>
              ${renderCopyBtn(student.pinflPassport, "Pasport JShShIR")}
            </div>
          </div>
        </div>

        <!-- 5. Ota-onasi haqida to'liq ma'lumotlar -->
        <div class="space-y-3">
          <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
            5. Ota-onasi haqida ma'lumotlar
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- Onasi -->
            <div class="bg-pink-50/50 p-5 rounded-2xl border border-pink-200/80 space-y-3.5">
              <div class="flex items-center justify-between">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-100/90 text-pink-700 border border-pink-200">Onasi</span>
                ${student.motherAge ? `<span class="text-xs font-semibold text-pink-600">${student.motherAge} yosh</span>` : ''}
              </div>
              <div class="flex items-start justify-between">
                <div>
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">F.I.SH</div>
                  <div class="font-bold text-slate-900 text-base mt-0.5">${student.motherFullName || "Kiritilmagan"}</div>
                </div>
                ${renderCopyBtn(student.motherFullName, "Onasining F.I.SH", 'pink')}
              </div>

              <div class="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span class="text-slate-400">Tug'ilgan sanasi:</span>
                  <div class="font-semibold text-slate-800 mt-0.5">${formatDate(student.motherBirthDate)}</div>
                </div>
                <div>
                  <span class="text-slate-400">Tug'ilgan joyi:</span>
                  <div class="font-semibold text-slate-800 mt-0.5">${student.motherBirthPlace || "-"}</div>
                </div>
              </div>

              <!-- Onasi Pasport / ID va JSHSHIR -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="flex items-start justify-between bg-white/90 p-2.5 rounded-xl border border-pink-200/70">
                  <div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pasport / ID</div>
                    <div class="font-bold font-mono text-slate-900 text-xs mt-0.5">${student.motherPassport || "Mavjud emas"}</div>
                  </div>
                  ${renderCopyBtn(student.motherPassport, "Onasining pasporti", 'pink')}
                </div>
                <div class="flex items-start justify-between bg-white/90 p-2.5 rounded-xl border border-pink-200/70">
                  <div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">JSHSHIR (PINFL)</div>
                    <div class="font-bold font-mono text-slate-900 text-xs mt-0.5">${student.motherPinfl || "Kiritilmagan"}</div>
                  </div>
                  ${renderCopyBtn(student.motherPinfl, "Onasining JSHSHIR", 'pink')}
                </div>
              </div>

              <div class="flex items-start justify-between">
                <div>
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telefon raqami</div>
                  <div class="font-bold font-mono text-slate-900 text-sm mt-0.5">
                    ${student.motherPhone ? `<a href="tel:${student.motherPhone.replace(/[^0-9+]/g, '')}" class="text-pink-700 hover:text-emerald-600 transition-colors hover:underline">${student.motherPhone}</a>` : "Kiritilmagan"}
                  </div>
                </div>
                <div class="flex items-center gap-0.5">
                  ${renderCallBtn(student.motherPhone, "Onasi")}
                  ${renderCopyBtn(student.motherPhone, "Onasining telefoni", 'pink')}
                </div>
              </div>

              <div class="flex items-start justify-between">
                <div>
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email (ixtiyoriy)</div>
                  <div class="font-medium text-slate-800 text-xs mt-0.5">
                    ${student.motherEmail ? `<a href="mailto:${student.motherEmail}" class="text-pink-700 hover:underline">${student.motherEmail}</a>` : "Kiritilmagan"}
                  </div>
                </div>
                ${renderCopyBtn(student.motherEmail, "Onasining emaili", 'pink')}
              </div>

              <div class="flex items-start justify-between">
                <div>
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ish joyi / Kasbi</div>
                  <div class="font-medium text-slate-800 text-xs mt-0.5">${student.motherJob || "Kiritilmagan"}</div>
                </div>
                ${renderCopyBtn(student.motherJob, "Onasining ish joyi", 'pink')}
              </div>
            </div>

            <!-- Otasi -->
            <div class="bg-blue-50/50 p-5 rounded-2xl border border-blue-200/80 space-y-3.5">
              <div class="flex items-center justify-between">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100/90 text-blue-700 border border-blue-200">Otasi</span>
                ${student.fatherAge ? `<span class="text-xs font-semibold text-blue-600">${student.fatherAge} yosh</span>` : ''}
              </div>
              <div class="flex items-start justify-between">
                <div>
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">F.I.SH</div>
                  <div class="font-bold text-slate-900 text-base mt-0.5">${student.fatherFullName || "Kiritilmagan"}</div>
                </div>
                ${renderCopyBtn(student.fatherFullName, "Otasining F.I.SH", 'blue')}
              </div>

              <div class="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span class="text-slate-400">Tug'ilgan sanasi:</span>
                  <div class="font-semibold text-slate-800 mt-0.5">${formatDate(student.fatherBirthDate)}</div>
                </div>
                <div>
                  <span class="text-slate-400">Tug'ilgan joyi:</span>
                  <div class="font-semibold text-slate-800 mt-0.5">${student.fatherBirthPlace || "-"}</div>
                </div>
              </div>

              <!-- Otasi Pasport / ID va JSHSHIR -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="flex items-start justify-between bg-white/90 p-2.5 rounded-xl border border-blue-200/70">
                  <div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pasport / ID</div>
                    <div class="font-bold font-mono text-slate-900 text-xs mt-0.5">${student.fatherPassport || "Mavjud emas"}</div>
                  </div>
                  ${renderCopyBtn(student.fatherPassport, "Otasining pasporti", 'blue')}
                </div>
                <div class="flex items-start justify-between bg-white/90 p-2.5 rounded-xl border border-blue-200/70">
                  <div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">JSHSHIR (PINFL)</div>
                    <div class="font-bold font-mono text-slate-900 text-xs mt-0.5">${student.fatherPinfl || "Kiritilmagan"}</div>
                  </div>
                  ${renderCopyBtn(student.fatherPinfl, "Otasining JSHSHIR", 'blue')}
                </div>
              </div>

              <div class="flex items-start justify-between">
                <div>
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telefon raqami</div>
                  <div class="font-bold font-mono text-slate-900 text-sm mt-0.5">
                    ${student.fatherPhone ? `<a href="tel:${student.fatherPhone.replace(/[^0-9+]/g, '')}" class="text-blue-700 hover:text-emerald-600 transition-colors hover:underline">${student.fatherPhone}</a>` : "Kiritilmagan"}
                  </div>
                </div>
                <div class="flex items-center gap-0.5">
                  ${renderCallBtn(student.fatherPhone, "Otasi")}
                  ${renderCopyBtn(student.fatherPhone, "Otasining telefoni", 'blue')}
                </div>
              </div>

              <div class="flex items-start justify-between">
                <div>
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email (ixtiyoriy)</div>
                  <div class="font-medium text-slate-800 text-xs mt-0.5">
                    ${student.fatherEmail ? `<a href="mailto:${student.fatherEmail}" class="text-blue-700 hover:underline">${student.fatherEmail}</a>` : "Kiritilmagan"}
                  </div>
                </div>
                ${renderCopyBtn(student.fatherEmail, "Otasining emaili", 'blue')}
              </div>

              <div class="flex items-start justify-between">
                <div>
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ish joyi / Kasbi</div>
                  <div class="font-medium text-slate-800 text-xs mt-0.5">${student.fatherJob || "Kiritilmagan"}</div>
                </div>
                ${renderCopyBtn(student.fatherJob, "Otasining ish joyi", 'blue')}
              </div>
            </div>

          </div>
        </div>

        <!-- 6. Ta'lim Platformalari hisoblari (Kundalik.com va boshqalar) -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
              6. Ta'lim Platformalari hisoblari (Kundalik.com va boshqalar)
            </h2>
            <span class="text-xs font-semibold text-indigo-600 print-hide">Login va parollar</span>
          </div>

          <div class="bg-slate-50/90 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            ${(() => {
              const classPlatforms = (studentClass && Array.isArray(studentClass.platforms)) ? studentClass.platforms : [];
              const studentPlatforms = student.platforms || {};

              // Dublikatlarni birlashtirish va platformalarni aniq kanonik shaklga keltirish
              const canonicalPlatMap = new Map();

              // 1. Sinf platformalari
              classPlatforms.forEach(plat => {
                if (!plat) return;
                const lowerName = (plat.name || '').toLowerCase();
                let cKey = plat.id;
                if (plat.id === 'plat-kundalik' || lowerName.includes('kundalik') || lowerName.includes('emaktab')) {
                  cKey = 'plat-kundalik';
                }
                if (!canonicalPlatMap.has(cKey)) {
                  canonicalPlatMap.set(cKey, {
                    id: cKey,
                    name: cKey === 'plat-kundalik' ? 'Kundalik.com (eMaktab)' : plat.name,
                    url: cKey === 'plat-kundalik' ? 'https://emaktab.uz' : (plat.url || ''),
                    login: '',
                    password: ''
                  });
                }
              });

              // 2. O'quvchi login va parollari
              Object.entries(studentPlatforms).forEach(([pId, rawCred]) => {
                if (!rawCred) return;
                let login = '';
                let password = '';
                if (typeof rawCred === 'object') {
                  if (rawCred.login && typeof rawCred.login === 'object') {
                    login = String(rawCred.login.login || '').trim();
                    password = String(rawCred.login.password || rawCred.password || '').trim();
                  } else {
                    login = String(rawCred.login || '').trim();
                    password = String(rawCred.password || '').trim();
                  }
                }

                let cKey = pId;
                if (pId === 'plat-kundalik' || pId.includes('kundalik') || pId.includes('emaktab')) {
                  cKey = 'plat-kundalik';
                }

                if (!canonicalPlatMap.has(cKey)) {
                  const platObj = classPlatforms.find(p => p.id === pId);
                  canonicalPlatMap.set(cKey, {
                    id: cKey,
                    name: platObj ? platObj.name : (cKey === 'plat-kundalik' ? 'Kundalik.com (eMaktab)' : 'Platforma'),
                    url: platObj?.url || (cKey === 'plat-kundalik' ? 'https://emaktab.uz' : ''),
                    login,
                    password
                  });
                } else {
                  const item = canonicalPlatMap.get(cKey);
                  if (login && !item.login) item.login = login;
                  if (password && !item.password) item.password = password;
                }
              });

              const platformList = Array.from(canonicalPlatMap.values());

              if (platformList.length === 0) {
                return `
                  <div class="text-center py-4 text-slate-500 text-xs">
                    <p>Hozircha birorta platforma kiritilmagan.</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">O'quvchi ma'lumotlarini tahrirlash orqali Kundalik.com va boshqa platformalar login va parolini kiritishingiz mumkin.</p>
                  </div>
                `;
              }

              return `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${platformList.map(plat => {
                    const platName = plat.name;
                    const platUrl = plat.url;
                    const login = plat.login;
                    const pass = plat.password;

                    return `
                      <div class="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                        <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                            <span class="font-bold text-slate-900 text-sm">${platName}</span>
                          </div>
                          ${platUrl ? `
                            <a 
                              href="${platUrl}" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              class="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 print-hide"
                            >
                              <span>Saytga o'tish</span>
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                            </a>
                          ` : ''}
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <!-- Login -->
                          <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start justify-between">
                            <div>
                              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Login</div>
                              <div class="font-mono font-bold text-slate-900 text-xs mt-0.5">${login || '<span class="text-slate-400 font-sans font-normal italic">Kiritilmagan</span>'}</div>
                            </div>
                            ${renderCopyBtn(login, `${platName} logini`)}
                          </div>

                          <!-- Parol -->
                          <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start justify-between">
                            <div>
                              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parol</div>
                              <div class="font-mono font-bold text-slate-900 text-xs mt-0.5">${pass || '<span class="text-slate-400 font-sans font-normal italic">Kiritilmagan</span>'}</div>
                            </div>
                            ${renderCopyBtn(pass, `${platName} paroli`)}
                          </div>
                        </div>

                        ${(login || pass) ? `
                          <div class="pt-1 flex items-center justify-end print-hide">
                            <button 
                              type="button"
                              class="copy-btn px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                              data-copy="${encodeURIComponent(`📋 ${platName}\n👤 O'quvchi: ${student.fullName}\n🔑 Login: ${login}\n🔒 Parol: ${pass}`)}"
                              data-label="${platName} login va paroli"
                              title="Ikkalasini birga nusxalash (Telegram orqali yuborish uchun)"
                            >
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                              <span>Login & Parolni birga nusxalash</span>
                            </button>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              `;
            })()}
          </div>
        </div>

        <!-- 7. Qo'shimcha Darslar va O'quv Markazlari (To'garaklar) -->
        <div class="space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <h2 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
                7. Qo'shimcha Darslar va O'quv Markazlari (To'garaklar)
              </h2>
              ${Array.isArray(student.extraCourses) && student.extraCourses.length > 0 ? `
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ${student.extraCourses.length} ta dars
                </span>
              ` : ''}
            </div>

            <button 
              type="button"
              id="edit-courses-btn"
              class="print-hide px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
              title="Qo'shimcha darslarni tahrirlash yoki yangi dars qo'shish"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              <span>${Array.isArray(student.extraCourses) && student.extraCourses.length > 0 ? "Darslarni tahrirlash" : "+ Dars qo'shish"}</span>
            </button>
          </div>

          <div class="bg-slate-50/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-4">
            ${(() => {
              const courses = Array.isArray(student.extraCourses) ? student.extraCourses : [];

              if (courses.length === 0) {
                return `
                  <div class="text-center py-6 text-slate-500 text-xs space-y-2">
                    <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                      </svg>
                    </div>
                    <p class="font-medium text-slate-700">Qo'shimcha darslar yoki to'garaklar hali kiritilmagan.</p>
                    <p class="text-[11px] text-slate-400 max-w-sm mx-auto">
                      O'quvchining fan to'garaklari, repetitor yoki o'quv markazlari (4-5 tagacha) ma'lumotlarini kiritish uchun yuqoridagi "+ Dars qo'shish" tugmasini bosing.
                    </p>
                  </div>
                `;
              }

              return `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  ${courses.map((course, idx) => `
                    <div class="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                      <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            ${idx + 1}
                          </span>
                          <span class="font-bold text-slate-900 text-sm truncate">
                            ${course.courseName || "Qo'shimcha dars"}
                          </span>
                        </div>
                        ${course.centerName ? `
                          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                            ${course.centerName}
                          </span>
                        ` : ''}
                      </div>

                      <div class="space-y-2 text-xs">
                        <!-- O'qituvchi (F.I.Sh.) -->
                        <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start justify-between">
                          <div class="min-w-0 pr-2">
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">O'qituvchi (F.I.Sh.)</div>
                            <div class="font-semibold text-slate-900 text-xs mt-0.5 truncate">
                              ${course.teacherName || '<span class="text-slate-400 font-normal italic">Kiritilmagan</span>'}
                            </div>
                          </div>
                          ${renderCopyBtn(course.teacherName, "O'qituvchi ismi")}
                        </div>

                        <!-- O'qituvchi telefoni -->
                        <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start justify-between">
                          <div class="min-w-0 pr-2">
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">O'qituvchi telefon raqami</div>
                            <div class="font-mono font-bold text-slate-900 text-xs mt-0.5">
                              ${course.teacherPhone ? `
                                <a href="tel:${course.teacherPhone.replace(/[^0-9+]/g, '')}" class="text-indigo-600 hover:text-emerald-700 hover:underline">
                                  ${course.teacherPhone}
                                </a>
                              ` : '<span class="text-slate-400 font-sans font-normal italic">Kiritilmagan</span>'}
                            </div>
                          </div>
                          <div class="flex items-center gap-0.5">
                            ${renderCallBtn(course.teacherPhone, "O'qituvchi")}
                            ${renderCopyBtn(course.teacherPhone, "O'qituvchi telefoni")}
                          </div>
                        </div>

                        <!-- O'quv markazi -->
                        <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start justify-between">
                          <div class="min-w-0 pr-2">
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">O'quv markazi</div>
                            <div class="font-semibold text-slate-900 text-xs mt-0.5 truncate">
                              ${course.centerName || '<span class="text-slate-400 font-normal italic">Kiritilmagan</span>'}
                            </div>
                          </div>
                          ${renderCopyBtn(course.centerName, "O'quv markazi")}
                        </div>

                        <!-- Manzil -->
                        <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start justify-between">
                          <div class="min-w-0 pr-2">
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                              <span>O'quv markazi manzili</span>
                            </div>
                            <div class="font-medium text-slate-800 text-xs mt-0.5">
                              ${course.centerAddress || '<span class="text-slate-400 font-normal italic">Kiritilmagan</span>'}
                            </div>
                          </div>
                          ${renderCopyBtn(course.centerAddress, "Markaz manzili")}
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `;
            })()}
          </div>
        </div>

        <!-- Print Footer Signatures (Print paytida chiqadi) -->
        <div class="hidden print-header pt-12 text-xs">
          <div class="flex justify-between items-end">
            <div>
              <div>Sinf rahbari: __________________ / ${studentClass ? studentClass.teacherName : ""} /</div>
              <div class="text-slate-400 mt-1">Sana: ${new Date().toLocaleDateString('uz-UZ')}</div>
            </div>
            <div class="text-right">
              <div>Maktab direktori: __________________ / Muhr o'rni /</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Function to copy text to clipboard with feedback
  async function copyText(text, label, buttonEl) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      if (showToast) {
        showToast(`${label ? label + ': ' : ''}nusxalandi!`);
      }

      if (buttonEl) {
        const originalHTML = buttonEl.innerHTML;
        buttonEl.innerHTML = `
          <svg class="w-3.5 h-3.5 text-emerald-600 animate-scale-up" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
          </svg>
        `;
        setTimeout(() => {
          buttonEl.innerHTML = originalHTML;
        }, 1500);
      }
    } catch (err) {
      console.error('Nusxa olishda xatolik:', err);
    }
  }

  // Attach individual copy button listeners
  const copyButtons = container.querySelectorAll('.copy-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rawVal = btn.getAttribute('data-copy');
      const val = decodeURIComponent(rawVal || '');
      const label = btn.getAttribute('data-label') || '';
      copyText(val, label, btn);
    });
  });

  // Attach "Barcha ma'lumotlarni nusxalash" button listener
  const copyAllBtn = container.querySelector('#copy-all-btn');
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', () => {
      const fullDossierText = generateFullDossierText(student, school, studentClass);
      copyText(fullDossierText, "O'quvchining to'liq ma'lumotlari", copyAllBtn);
    });
  }

  // Attach back button handler
  const backBtn = container.querySelector('#back-to-list-btn');
  if (backBtn) backBtn.addEventListener('click', onBack);

  // Direct export buttons
  const wordBtn = container.querySelector('#student-export-word-btn');
  if (wordBtn) {
    wordBtn.addEventListener('click', () => {
      if (onExportWord) onExportWord(student.id);
      else if (onExport) onExport(student.id);
    });
  }

  const excelBtn = container.querySelector('#student-export-excel-btn');
  if (excelBtn) {
    excelBtn.addEventListener('click', () => {
      if (onExportExcel) onExportExcel(student.id);
      else if (onExport) onExport(student.id);
    });
  }

  const pdfBtn = container.querySelector('#student-export-pdf-btn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      if (onExportPDF) onExportPDF(student.id);
      else if (onExport) onExport(student.id);
    });
  }

  const printBtn = container.querySelector('#student-print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      if (onPrint) onPrint();
      else window.print();
    });
  }

  const topCopyBtn = container.querySelector('#student-copy-text-btn');
  if (topCopyBtn) {
    topCopyBtn.addEventListener('click', () => {
      const fullText = generateFullDossierText(student, school, studentClass);
      copyText(fullText, "O'quvchining to'liq dosyesi", topCopyBtn);
    });
  }

  // Attach bottom bar buttons (located in document #bottom-nav-bar)
  const bottomBack = document.querySelector('#bottom-bar-back');
  if (bottomBack) {
    bottomBack.onclick = onBack;
  }

  const bottomCopy = document.querySelector('#bottom-bar-copy');
  if (bottomCopy) {
    bottomCopy.onclick = () => {
      const fullText = generateFullDossierText(student, school, studentClass);
      copyText(fullText, "O'quvchining to'liq dosyesi", bottomCopy);
    };
  }

  // Attach Export buttons (top bar & bottom bar)
  const topExportBtn = container.querySelector('#student-detail-export-btn');
  if (topExportBtn && onExport) {
    topExportBtn.addEventListener('click', () => onExport(student.id));
  }

  const bottomExport = document.querySelector('#bottom-bar-export');
  if (bottomExport && onExport) {
    bottomExport.onclick = () => onExport(student.id);
  }

  const bottomPrint = document.querySelector('#bottom-bar-print');
  if (bottomPrint) {
    bottomPrint.onclick = () => window.print();
  }

  const bottomEdit = document.querySelector('#bottom-bar-edit');
  if (bottomEdit) {
    bottomEdit.onclick = () => onEdit(student.id);
  }

  const bottomDelete = document.querySelector('#bottom-bar-delete');
  if (bottomDelete) {
    bottomDelete.onclick = () => onDelete(student.id);
  }

  const editCoursesBtn = container.querySelector('#edit-courses-btn');
  if (editCoursesBtn && onEdit) {
    editCoursesBtn.onclick = () => onEdit(student.id);
  }
}
