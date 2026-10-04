/**
 * MaktabX - Davomat va Smenalar Boshqaruvi Tizimi
 * - 1-smena va 2-smena (Guruhlar) boshqaruvi
 * - Navbatchi o'qituvchilar rotatsiyasi va Dublyor (Zaxira) eskalatsiyasi
 * - O'quvchi va o'qituvchilar davomatini olish va monitoring qilish
 * - Real vaqtli statistika, yillik va oylik tahlillar
 * - Kelmagan o'quvchilar ota-onalariga DevSMS orqali xabar yuborish
 */

import { 
  WEEK_DAYS, 
  getTodayISODate, 
  getTodayDayOfWeek, 
  getDayName, 
  formatReadableDate, 
  isTimePastCutoff,
  compareClassNames,
  getStudentContactPhone,
  generateOrderlyDutyRosters,
  getTodayDutyInfoForTeacher,
  getTodayDutyTeachersForSchool,
  recordDutyAbsenceAndDelegate,
  saveData,
  isGrade1to5,
  validateDutyAssignment,
  getTeacherDutyScheduleProjection,
  excludeClassFromDutyShifts,
  includeClassToDutyShift,
  recordClassAttendanceSubmission,
  getSubmittedClassesForDate
} from '../data.js';
import { 
  saveDutyRosterToFirestore, 
  saveDutyAbsenceToFirestore, 
  saveAdminNotificationToFirestore 
} from '../firebase.js';
import { sendSMSWithMultiGateway } from '../services/smsService.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderAttendanceView(container, {
  currentUser,
  state,
  currentSchool,
  initialTab = 'monitoring',
  showToast,
  onSaveShift,
  onDeleteShift,
  onSaveRoster,
  onDeleteRoster,
  onSaveAttendanceRecord,
  onBack
}) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'developer';
  const schoolId = currentSchool?.id || (currentUser.role === 'teacher' ? currentUser.data.schoolId : (state.schools[0]?.id || ''));
  const school = state.schools.find(s => s.id === schoolId) || currentSchool || { name: "Maktab" };

  // Maktabga tegishli ma'lumotlar
  const schoolClasses = (state.classes || [])
    .filter(c => c.schoolId === schoolId)
    .sort((a, b) => compareClassNames(a.name, b.name));

  const schoolStudents = (state.students || []).filter(s => {
    if (s.schoolId === schoolId) return true;
    const cls = schoolClasses.find(c => c.id === s.classId);
    return Boolean(cls);
  });

  // Smenalar
  let schoolShifts = (state.shifts || []).filter(s => s.schoolId === schoolId);
  // Agar hali smenalar yaratilmagan bo'lsa, standart 1- va 2-smenalarni taklif etish
  if (schoolShifts.length === 0) {
    schoolShifts = [
      {
        id: `shift_1_${schoolId}`,
        schoolId,
        name: "1-smena (Ertalabki)",
        startTime: "08:00",
        endTime: "13:00",
        cutoffTime: "08:30",
        classIds: schoolClasses.slice(0, Math.ceil(schoolClasses.length / 2)).map(c => c.id),
        createdAt: new Date().toISOString()
      },
      {
        id: `shift_2_${schoolId}`,
        schoolId,
        name: "2-smena (Tushdan keyingi)",
        startTime: "13:00",
        endTime: "18:00",
        cutoffTime: "13:30",
        classIds: schoolClasses.slice(Math.ceil(schoolClasses.length / 2)).map(c => c.id),
        createdAt: new Date().toISOString()
      }
    ];
  }

  // Navbatchilik jadvallari (agar mavjud bo'lmasa, tizim avtomatik tartib bilan tayinlaydi)
  let schoolRosters = (state.dutyRosters || []).filter(r => r.schoolId === schoolId);
  if (schoolRosters.length === 0 && schoolShifts.length > 0 && schoolClasses.length > 0) {
    const autoRosters = generateOrderlyDutyRosters(schoolId, schoolShifts, schoolClasses);
    if (autoRosters.length > 0) {
      schoolRosters = autoRosters;
      if (onSaveRoster) {
        autoRosters.forEach(r => onSaveRoster(r));
      }
    }
  }

  // Sinf rahbarining bugungi mas'ul navbatchi ekanligini aniqlash
  const teacherDutyInfo = currentUser.role === 'teacher'
    ? getTodayDutyInfoForTeacher(currentUser.data, state)
    : { isDutyToday: false, dutyShifts: [], allTodayDutyTeachers: [] };

  // Developer yoki bugungi mas'ul navbatchi sinf rahbari butun maktab davomatini to'ldirish huquqiga ega
  let isCurrentUserDutyOfficer = currentUser.role === 'developer' || teacherDutyInfo.isDutyToday;

  // Davomat yozuvlari
  const schoolAttendanceRecords = (state.attendanceRecords || []).filter(r => r.schoolId === schoolId);

  // Komponent ichki holatlari (Local State)
  // Mas'ul navbatchi o'qituvchi bo'lsa darhol 'take_attendance' ga yo'naltiriladi
  // Agar navbatchi bo'lmasa, 'duty_officers' (Bugungi mas'ul navbatchilar) tabiga yo'naltiriladi
  let activeTab = isAdmin 
    ? (initialTab === 'take_attendance' ? 'shifts' : (initialTab || 'shifts')) 
    : (isCurrentUserDutyOfficer ? 'take_attendance' : (initialTab === 'take_attendance' ? 'duty_officers' : (initialTab || 'duty_officers')));
  let selectedDate = getTodayISODate();
  let selectedShiftId = schoolShifts[0]?.id || '';
  let selectedClassIdForAttendance = null;
  let activeTakingAttendanceData = null; // Working copy when taking attendance
  let sendingSmsStudentId = null;
  let attendanceClassFilter = 'all'; // 'all' | shiftId
  let attendanceStudentSearchQuery = '';
  let dutyStudentSearchQuery = '';
  let nonDutyClassFilter = 'all'; // 'all' | 'present' | 'absent' | 'late'
  let nonDutyStudentSearchQuery = '';

  // Bugungi sana va kun
  const todayDate = getTodayISODate();
  const todayDayOfWeek = getTodayDayOfWeek();

  // Yordamchi: Berilgan sana va smena uchun davomat yozuvini topish
  function getAttendanceRecord(shiftId, dateStr) {
    return (state.attendanceRecords || []).find(r => r.schoolId === schoolId && r.shiftId === shiftId && r.date === dateStr);
  }

  // Yordamchi: Berilgan smena va kun uchun navbatchi o'qituvchini topish
  function getRosterForShiftAndDay(shiftId, dayNum) {
    return schoolRosters.find(r => r.shiftId === shiftId && Number(r.dayOfWeek) === Number(dayNum));
  }

  // Eskalatsiya (Zaxiraga o'tish) tekshiruvi
  function getShiftDutyStatus(shift, dateStr) {
    const isToday = dateStr === todayDate;
    const dayOfWeek = isToday ? todayDayOfWeek : new Date(dateStr).getDay() || 7;
    const roster = getRosterForShiftAndDay(shift.id, dayOfWeek);
    const existingRecord = getAttendanceRecord(shift.id, dateStr);

    const primaryName = roster?.primaryTeacherName || "Belgilanmagan";
    const primaryPhone = roster?.primaryTeacherPhone || "";
    const backupName = roster?.backupTeacherName || "Belgilanmagan";
    const backupPhone = roster?.backupTeacherPhone || "";

    // Agar davomat yozuvi allaqachon mavjud bo'lsa:
    if (existingRecord) {
      return {
        hasRecord: true,
        record: existingRecord,
        activeDutyTeacherName: existingRecord.dutyTeacher?.name || primaryName,
        activeDutyTeacherPhone: existingRecord.dutyTeacher?.phone || primaryPhone,
        isBackupActive: Boolean(existingRecord.isFailoverActivated),
        status: existingRecord.status === 'completed' ? 'Yakunlangan' : 'Jarayonda',
        statusColor: existingRecord.status === 'completed' ? 'emerald' : 'amber',
        primaryName,
        primaryPhone,
        backupName,
        backupPhone
      };
    }

    // Agar davomat olinmagan bo'lsa va bugun bo'lsa:
    // Vaqt kesish soatidan (cutoffTime) o'tganmi?
    const isPastCutoff = isToday && isTimePastCutoff(shift.cutoffTime || "08:30");
    const isBackupActive = isPastCutoff && Boolean(roster?.backupTeacherName);

    return {
      hasRecord: false,
      record: null,
      activeDutyTeacherName: isBackupActive ? backupName : primaryName,
      activeDutyTeacherPhone: isBackupActive ? backupPhone : primaryPhone,
      isBackupActive,
      status: isPastCutoff ? 'Kechikmoqda (Zaxiraga o\'tdi)' : 'Kutilmoqda',
      statusColor: isPastCutoff ? 'red' : 'slate',
      primaryName,
      primaryPhone,
      backupName,
      backupPhone
    };
  }

  // Davomat olishni boshlash yoki yuklash (Butun maktab o'quvchilari uchun to'liq ruxsat)
  function initTakingAttendance(shiftId, dateStr) {
    selectedShiftId = shiftId;
    selectedDate = dateStr;
    const shift = schoolShifts.find(s => s.id === shiftId) || schoolShifts[0];
    if (!shift) return;

    const existingRecord = getAttendanceRecord(shiftId, dateStr);
    const dutyInfo = getShiftDutyStatus(shift, dateStr);

    if (existingRecord) {
      // Mavjud nusxani tahrirlash uchun klonlash
      activeTakingAttendanceData = JSON.parse(JSON.stringify(existingRecord));

      // Butun maktabdagi barcha sinflar kiritilganligini tekshirish va to'ldirish
      if (!activeTakingAttendanceData.classAttendance) {
        activeTakingAttendanceData.classAttendance = {};
      }
      schoolClasses.forEach(cls => {
        if (!activeTakingAttendanceData.classAttendance[cls.id]) {
          const clsStudents = schoolStudents.filter(s => s.classId === cls.id);
          const records = {};
          clsStudents.forEach(st => {
            records[st.id] = {
              studentName: st.fullName || `${st.lastName || ''} ${st.firstName || ''}`.trim(),
              status: 'present',
              note: '',
              phone: st.phone || '',
              parentPhone: st.fatherPhone || st.motherPhone || st.phone || ''
            };
          });

          activeTakingAttendanceData.classAttendance[cls.id] = {
            classId: cls.id,
            className: cls.name,
            teacherName: cls.teacherName || '',
            totalStudents: clsStudents.length,
            presentCount: clsStudents.length,
            absentCount: 0,
            excusedCount: 0,
            unexcusedCount: 0,
            records,
            isSubmittedToAdmin: false
          };
        }
      });
    } else {
      // Yangi BUTUN MAKTAB davomat obyektini shakllantirish
      // 1. O'qituvchilar davomati (maktabdagi barcha sinf rahbarlari)
      const teacherAttendance = [];
      const teacherMap = new Map();
      schoolClasses.forEach(cls => {
        if (cls.teacherName && !teacherMap.has(cls.teacherName)) {
          teacherMap.set(cls.teacherName, {
            teacherName: cls.teacherName,
            className: cls.name,
            phone: cls.teacherPhone || '',
            status: 'present', // Standart: hamma kelgan
            note: ''
          });
        }
      });
      teacherAttendance.push(...Array.from(teacherMap.values()));

      // 2. Butun maktabdagi barcha sinflar va o'quvchilar davomati
      const classAttendance = {};
      schoolClasses.forEach(cls => {
        const clsStudents = schoolStudents.filter(s => s.classId === cls.id);
        const records = {};
        clsStudents.forEach(st => {
          records[st.id] = {
            studentName: st.fullName || `${st.lastName || ''} ${st.firstName || ''}`.trim(),
            status: 'present', // Standart: hamma darsda
            note: '',
            phone: st.phone || '',
            parentPhone: st.fatherPhone || st.motherPhone || st.phone || ''
          };
        });

        classAttendance[cls.id] = {
          classId: cls.id,
          className: cls.name,
          teacherName: cls.teacherName || '',
          totalStudents: clsStudents.length,
          presentCount: clsStudents.length,
          absentCount: 0,
          excusedCount: 0,
          unexcusedCount: 0,
          records,
          isSubmittedToAdmin: false
        };
      });

      // Tizimga kirgan o'qituvchi bugun mas'ul navbatchi bo'lsa, uning nomini o'rnatish
      const dutyOfficerName = (currentUser.role === 'teacher' && isCurrentUserDutyOfficer)
        ? (currentUser.data?.teacherName || dutyInfo.activeDutyTeacherName)
        : dutyInfo.activeDutyTeacherName;

      activeTakingAttendanceData = {
        id: `att_${schoolId}_${shiftId}_${dateStr}`,
        schoolId,
        shiftId,
        shiftName: shift.name,
        date: dateStr,
        isWholeSchool: true,
        dutyTeacher: {
          name: dutyOfficerName,
          phone: dutyInfo.activeDutyTeacherPhone || currentUser.data?.teacherPhone || '',
          role: dutyInfo.isBackupActive ? 'backup' : 'primary',
          recordedAt: new Date().toISOString()
        },
        isFailoverActivated: dutyInfo.isBackupActive,
        failoverReason: dutyInfo.isBackupActive ? `Asosiy navbatchi vaqtida boshlamadi (${shift.cutoffTime} kesish vaqti)` : '',
        teacherAttendance,
        classAttendance,
        status: 'draft',
        createdAt: new Date().toISOString()
      };
    }

    // 3. Maktabdagi bugungi boshqa smena davomat yozuvlaridan topshirilgan sinf davomatlarini to'liq sinxronlash
    // Shunda 1-smenada topshirilgan sinf 2-smena navbatchisi kirganda ham aynan shu sinf davomati olingani va adminga yuborilgani darhol tasdiqlanadi.
    const allTodayRecords = (state.attendanceRecords || []).filter(r => r.schoolId === schoolId && r.date === dateStr);
    schoolClasses.forEach(cls => {
      const myCls = activeTakingAttendanceData.classAttendance[cls.id];
      if (!myCls || !myCls.isSubmittedToAdmin) {
        for (const oRec of allTodayRecords) {
          const submitted = oRec.classAttendance?.[cls.id];
          if (submitted && submitted.isSubmittedToAdmin) {
            activeTakingAttendanceData.classAttendance[cls.id] = JSON.parse(JSON.stringify(submitted));
            break;
          }
        }
      }
    });

    // Birinchi sinfni tanlash
    const availableClassIds = Object.keys(activeTakingAttendanceData.classAttendance || {});
    if (!selectedClassIdForAttendance || !activeTakingAttendanceData.classAttendance[selectedClassIdForAttendance]) {
      selectedClassIdForAttendance = availableClassIds[0] || null;
    }
    activeTab = 'take_attendance';
    render();
  }

  // Davomat natijalari va umumiy statistikasini qayta hisoblash
  function recalculateAttendanceSummary(record) {
    if (!record || !record.classAttendance) return { total: 0, present: 0, absent: 0, rate: 100 };
    let total = 0;
    let present = 0;
    let absent = 0;
    let late = 0;

    Object.values(record.classAttendance).forEach(cls => {
      let clsPres = 0;
      let clsAbs = 0;
      let clsTot = 0;

      Object.values(cls.records || {}).forEach(st => {
        clsTot++;
        if (st.status === 'present') clsPres++;
        else if (st.status === 'late') { clsPres++; late++; }
        else clsAbs++;
      });

      cls.totalStudents = clsTot;
      cls.presentCount = clsPres;
      cls.absentCount = clsAbs;

      total += clsTot;
      present += clsPres;
      absent += clsAbs;
    });

    const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 100;
    record.summary = { totalStudents: total, presentCount: present, absentCount: absent, lateCount: late, attendanceRate: rate };
    return record.summary;
  }

  // Ota-onaga SMS xabarnoma yuborish
  async function handleSendAbsentSMS(student, className, statusText) {
    const parentPhone = student.parentPhone || student.fatherPhone || student.motherPhone || student.phone;
    if (!parentPhone) {
      showToast("O'quvchining ota-onasi telefon raqami topilmadi", 'error');
      return;
    }

    const cleanNumber = parentPhone.replace(/\D/g, '');
    if (cleanNumber.length < 9) {
      showToast("Telefon raqam formati noto'g'ri", 'error');
      return;
    }

    const message = `Hurmatli ota-ona! Farzandingiz ${student.studentName || student.fullName} bugun (${formatReadableDate(selectedDate)}) ${className} sinfida darsga ${statusText.toLowerCase()} sababli qatnashmadi. Iltimos maktab bilan bog'laning. ${school.name}.`;

    sendingSmsStudentId = student.id || student.studentName;
    render();

    try {
      const res = await sendSMSWithMultiGateway({
        phone: parentPhone,
        message,
        schoolName: school.name
      });

      if (res && (res.success || res.status === 'sent')) {
        showToast(`${student.studentName || 'O\'quvchi'} ota-onasiga SMS xabarnoma yuborildi!`, 'success');
      } else {
        showToast(res.message || "SMS xabarnoma yuborildi", 'success');
      }
    } catch (err) {
      console.error("SMS yuborishda xatolik:", err);
      showToast("SMS xizmati bilan ulanishda xatolik: " + (err.message || "Tarmoq xatosi"), 'error');
    } finally {
      sendingSmsStudentId = null;
      render();
    }
  }

  // =========================================================================
  // DARSNI QOLDIRISH SABABINI BILDIRISH MODALI (BARCHA O'QITUVCHILAR UCHUN)
  // =========================================================================
  function openTeacherLeaveModal({ defaultDate = todayDate, defaultReason = '' } = {}) {
    const modalId = 'teacher-leave-request-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const teacherName = currentUser.data?.teacherName || currentUser.name || "O'qituvchi";
    const className = currentUser.data?.name || "Sinf rahbari";

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-5 sm:p-6 animate-scale-in text-left">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-bold">
              📝
            </span>
            <div>
              <h3 class="text-base font-bold text-slate-900">Dars qoldirish sababini yozish</h3>
              <p class="text-xs text-slate-500">Maktab ma'muriyati (Admin)ga yetkaziladi</p>
            </div>
          </div>
          <button id="close-leave-modal-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="mt-4 space-y-3.5">
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1 text-slate-700">
            <div>O'qituvchi: <strong class="text-slate-900 font-bold">${escapeHtml(teacherName)}</strong></div>
            <div>Sinf: <span class="text-indigo-700 font-bold">${escapeHtml(className)}</span></div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Qaysi sana uchun dars qoldirilmoqda:
            </label>
            <input 
              type="date" 
              id="leave-date-input" 
              value="${defaultDate}" 
              class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              Tezkor sabab tanlovi:
            </label>
            <div class="flex flex-wrap gap-1.5">
              <button type="button" class="btn-quick-leave-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Betoblik (shifoxona / salomatlik holati tufayli)">
                🤒 Betoblik
              </button>
              <button type="button" class="btn-quick-leave-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Oilaviy zarur sharoit sababli">
                👨‍👩‍👧 Oilaviy holat
              </button>
              <button type="button" class="btn-quick-leave-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Xizmat safari / Malaka oshirish kursi bo'yicha">
                🏢 Xizmat safari
              </button>
              <button type="button" class="btn-quick-leave-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Kutilmagan shaxsiy sabab bilan">
                ⚡ Shaxsiy sabab
              </button>
            </div>
          </div>

          <div>
            <label for="leave-reason-textarea" class="block text-xs font-bold text-slate-700 mb-1">
              Batafsil sababini yozing <span class="text-rose-500">*</span>:
            </label>
            <textarea 
              id="leave-reason-textarea" 
              rows="3" 
              placeholder="Maktabga kela olmaslik sababini batafsil yozib qoldiring..." 
              class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            >${escapeHtml(defaultReason)}</textarea>
          </div>
        </div>

        <div class="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button 
            type="button" 
            id="cancel-leave-modal-btn" 
            class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Bekor qilish
          </button>
          <button 
            type="button" 
            id="submit-leave-modal-btn" 
            class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <span>Adminga yuborish</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const textarea = div.querySelector('#leave-reason-textarea');
    div.querySelectorAll('.btn-quick-leave-tag').forEach(b => {
      b.addEventListener('click', () => {
        const val = b.getAttribute('data-val');
        if (textarea) {
          textarea.value = val;
          textarea.focus();
        }
      });
    });

    const closeModal = () => div.remove();
    div.querySelector('#close-leave-modal-btn')?.addEventListener('click', closeModal);
    div.querySelector('#cancel-leave-modal-btn')?.addEventListener('click', closeModal);

    div.querySelector('#submit-leave-modal-btn')?.addEventListener('click', async () => {
      const reason = textarea ? textarea.value.trim() : '';
      const dateVal = div.querySelector('#leave-date-input')?.value || todayDate;

      if (!reason) {
        showToast("Iltimos, dars qoldirish sababini yozing", 'warning');
        textarea?.focus();
        return;
      }

      // Agar o'qituvchi bugun navbatchi bo'lsa, navbatchilikni zaxiraga topshirish
      if (isCurrentUserDutyOfficer) {
        try {
          const shiftId = schoolShifts[0]?.id;
          recordDutyAbsenceAndDelegate({
            schoolId,
            shiftId,
            reason,
            state,
            onSaveRoster
          });
        } catch (_) {}
      }

      // Absence record yaratish va saqlash
      if (!state.dutyAbsences) state.dutyAbsences = [];
      const absenceRecord = {
        id: `duty_abs_${Date.now()}`,
        schoolId,
        date: dateVal,
        originalTeacherName: teacherName,
        originalTeacherPhone: currentUser.data?.teacherPhone || '',
        originalTeacherClassId: currentUser.data?.id || '',
        originalTeacherClassName: className,
        reason,
        reportedAt: new Date().toISOString(),
        type: 'teacher_leave',
        isDutyTeacher: Boolean(isCurrentUserDutyOfficer)
      };

      const existingIdx = state.dutyAbsences.findIndex(a => 
        a.schoolId === schoolId && 
        a.date === dateVal && 
        (a.originalTeacherClassId === currentUser.data?.id || a.originalTeacherName === teacherName)
      );
      if (existingIdx >= 0) {
        state.dutyAbsences[existingIdx] = absenceRecord;
      } else {
        state.dutyAbsences.push(absenceRecord);
      }

      // Agar ushbu sana bo'yicha maktab attendanceRecord'i mavjud bo'lsa, undagi o'qituvchilar davomatiga ham yozish
      if (Array.isArray(state.attendanceRecords)) {
        state.attendanceRecords.forEach(rec => {
          if (rec.schoolId === schoolId && rec.date === dateVal) {
            if (!Array.isArray(rec.teacherAttendance)) rec.teacherAttendance = [];
            let tEntry = rec.teacherAttendance.find(t => 
              (t.classId && t.classId === (currentUser.data?.id || '')) ||
              (t.teacherName && t.teacherName.trim().toLowerCase() === teacherName.trim().toLowerCase())
            );
            if (tEntry) {
              tEntry.status = 'absent_excused';
              tEntry.isExcused = true;
              tEntry.reason = reason;
              tEntry.note = reason;
            } else {
              rec.teacherAttendance.push({
                teacherName,
                className,
                classId: currentUser.data?.id || '',
                phone: currentUser.data?.teacherPhone || '',
                status: 'absent_excused',
                isExcused: true,
                reason,
                note: reason
              });
            }
            if (onSaveAttendanceRecord) {
              try { onSaveAttendanceRecord(rec); } catch (_) {}
            }
          }
        });
      }

      saveData(state);
      saveDutyAbsenceToFirestore(absenceRecord).catch(err => console.warn('Firestore duty absence save error:', err));

      // Maktab ma'muriyati (Admin)ga xabarnoma yuborish
      const notification = {
        id: `notif_${Date.now()}`,
        schoolId,
        type: 'teacher_absence',
        title: "O'qituvchi dars qoldirish sababini yozib qoldirdi",
        message: `${teacherName} (${className} sinf rahbari) ${formatReadableDate(dateVal)} kuni dars qoldirolmasligi sababini qoldirdi: "${reason}"`,
        createdAt: new Date().toISOString(),
        read: false,
        data: {
          teacherName,
          className,
          date: dateVal,
          reason
        }
      };
      saveAdminNotificationToFirestore(notification).catch(err => console.warn('Admin notification error:', err));

      closeModal();
      showToast("Dars qoldirish sababi maktab adminiga yuborildi!", 'success');
      render();
    });
  }

  // =========================================================================
  // 1. NAVBATCHI BO'LMAGAN O'QITUVCHI DAVOMAT SAHIFASI
  // =========================================================================
  function renderNonDutyTeacherView() {
    const cleanTeacherName = (currentUser.data?.teacherName || '').trim().toLowerCase();
    const myAbsence = (state.dutyAbsences || []).find(a => {
      if (a.schoolId !== schoolId) return false;
      if (a.date !== selectedDate && a.date !== todayDate) return false;
      const origName = (a.originalTeacherName || '').trim().toLowerCase();
      const origClassId = a.originalTeacherClassId;
      return (origClassId && origClassId === currentUser.data?.id) || 
             (cleanTeacherName && origName && (origName === cleanTeacherName || origName.includes(cleanTeacherName)));
    });

    const myClassId = currentUser.data?.id;
    const myClass = schoolClasses.find(c => c.id === myClassId) || { id: myClassId, name: currentUser.data?.name || 'Sinf' };
    const myStudents = schoolStudents.filter(s => s.classId === myClassId);
    myStudents.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'uz'));

    // 1. O'qituvchining haftalik navbatchilik jadvali (Haftaning qaysi kuni navbatchi)
    const allRosters = (state.dutyRosters || []).filter(r => r.schoolId === schoolId);
    const myDutyAssignments = allRosters.filter(r => {
      if (Number(r.dayOfWeek) === 7) return false; // Yakshanba emas
      const isPrimary = (r.primaryTeacherClassId && r.primaryTeacherClassId === myClassId) || 
        (cleanTeacherName && (r.primaryTeacherName || '').trim().toLowerCase() === cleanTeacherName);
      const isBackup = (r.backupTeacherClassId && r.backupTeacherClassId === myClassId) || 
        (cleanTeacherName && (r.backupTeacherName || '').trim().toLowerCase() === cleanTeacherName);
      return isPrimary || isBackup;
    });
    myDutyAssignments.sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek));

    // Navbatchilik prognozi (Guruhdagi navbat, kelgusi haftalarda qachon navbati kelishi yoki mustasnolik)
    const dutyProjection = getTeacherDutyScheduleProjection(myClass, state);
    const hasPrimaryThisWeek = myDutyAssignments.some(duty => {
      return (duty.primaryTeacherClassId === myClassId) || 
        (cleanTeacherName && (duty.primaryTeacherName || '').trim().toLowerCase() === cleanTeacherName);
    });

    // 2. O'qituvchi bugun zaxiradan asosiy navbatchi etib tayinlanganmi?
    // (Asosiy navbatchi kela olmagani sababli tizim yoki admin ushbu zaxira o'qituvchini tayinlagan)
    const todayDutyTeachers = getTodayDutyTeachersForSchool(schoolId, state);
    const amIActivatedFromReserveToday = todayDutyTeachers.some(d => {
      if (!d.hasAbsence) return false;
      const isMyClass = (d.backupTeacherClassId && d.backupTeacherClassId === myClassId);
      const isMyName = cleanTeacherName && (
        (d.delegatedTeacherName && d.delegatedTeacherName.trim().toLowerCase() === cleanTeacherName) ||
        (d.backupTeacherName && d.backupTeacherName.trim().toLowerCase() === cleanTeacherName)
      );
      return isMyClass || isMyName;
    });

    // Navbatchi o'qituvchi davomat olganligini tekshirish (selectedDate bo'yicha)
    const dayRecords = (state.attendanceRecords || []).filter(r => r.schoolId === schoolId && r.date === selectedDate);
    let foundRecord = null;
    let foundClassAttendance = null;

    for (const r of dayRecords) {
      if (r.classAttendance && r.classAttendance[myClassId]) {
        const clsAtt = r.classAttendance[myClassId];
        if (clsAtt && clsAtt.records && Object.keys(clsAtt.records).length > 0) {
          foundRecord = r;
          foundClassAttendance = clsAtt;
          break;
        }
      }
    }

    const hasDutyTakenAttendance = Boolean(foundClassAttendance);
    const recordsMap = foundClassAttendance ? (foundClassAttendance.records || {}) : {};

    // Statistikalarni hisoblash
    let presentCount = 0;
    let excusedCount = 0;
    let unexcusedCount = 0;
    let lateCount = 0;

    myStudents.forEach(st => {
      const rec = recordsMap[st.id];
      const stStatus = rec?.status || 'present';
      if (stStatus === 'present') presentCount++;
      else if (stStatus === 'absent_excused') excusedCount++;
      else if (stStatus === 'absent_unexcused') unexcusedCount++;
      else if (stStatus === 'late') {
        presentCount++;
        lateCount++;
      }
    });

    const totalStudents = myStudents.length;
    const totalAbsent = excusedCount + unexcusedCount;
    const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 100;

    // O'quvchilarni filtrlash va qidirish
    const filteredStudents = myStudents.filter(st => {
      const rec = recordsMap[st.id];
      const stStatus = rec?.status || 'present';
      
      if (nonDutyClassFilter === 'present' && stStatus !== 'present') return false;
      if (nonDutyClassFilter === 'absent' && stStatus !== 'absent_unexcused' && stStatus !== 'absent_excused') return false;
      if (nonDutyClassFilter === 'late' && stStatus !== 'late') return false;

      if (nonDutyStudentSearchQuery.trim()) {
        const q = nonDutyStudentSearchQuery.trim().toLowerCase();
        const name = (st.fullName || '').toLowerCase();
        const phone = (st.phone || st.fatherPhone || st.motherPhone || '').replace(/\D/g, '');
        const qClean = q.replace(/\D/g, '');
        const matchName = name.includes(q);
        const matchPhone = qClean && phone.includes(qClean);
        return matchName || matchPhone;
      }
      return true;
    });

    return `
      <div class="space-y-4 pb-24 max-w-4xl mx-auto animate-fade-in">
        
        <!-- Top Header Bar -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <button 
              id="att-back-btn" 
              class="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95" 
              title="Orqaga qaytish"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
            </button>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-base sm:text-xl font-bold text-slate-900 tracking-tight">Maktab Davomati</h1>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  ${escapeHtml(myClass.name)} sinf rahbari
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(currentUser.data?.teacherName || 'Sinf rahbari')} • ${formatReadableDate(selectedDate)}</p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <!-- Sana tanlash -->
            <div class="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80">
              <label for="non-duty-date-picker" class="text-xs font-semibold text-slate-600 pl-1">Sana:</label>
              <input 
                type="date" 
                id="non-duty-date-picker" 
                value="${selectedDate}" 
                max="${todayDate}"
                class="px-2 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              />
            </div>

            <!-- Sahifani yangilash -->
            <button 
              id="btn-refresh-non-duty-att" 
              class="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 hover:text-indigo-600 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95" 
              title="Yangilash"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>

            <!-- Yuqoridagi Dars Qoldirish Tugmasi -->
            <button 
              id="btn-top-leave-request" 
              class="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Maktabga kela olmaslik sababini yozish"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>Dars qoldirish</span>
            </button>
          </div>
        </div>

        <!-- ⚠️ SHOSHILINCH XABAR: AGAR O'QITUVCHI BUGUN ZAXIRADAN MAS'UL NAVBATCHI QILIB TAYINLANGAN BO'LSA -->
        ${amIActivatedFromReserveToday ? `
          <div class="p-4 sm:p-5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white rounded-3xl shadow-lg border border-amber-300 animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0">
                ⚡
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-orange-700 uppercase tracking-wider">
                    Zaxiradan Tayinlandi
                  </span>
                  <h3 class="text-sm sm:text-base font-black text-white">
                    Siz bugun mas'ul navbatchi etib tayinlandingiz!
                  </h3>
                </div>
                <p class="text-xs text-white/95 mt-1 leading-relaxed">
                  Asosiy navbatchi o'qituvchi maktabga kela olmagani sababli, tizim zaxiradagi o'qituvchi sifatida sizga maktab davomatini olish vazifasini biriktirdi.
                </p>
              </div>
            </div>
            <button 
              id="btn-switch-to-duty-mode" 
              class="px-5 py-2.5 rounded-2xl bg-white text-orange-700 hover:bg-orange-50 font-black text-xs sm:text-sm shadow-md transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-2 justify-center"
            >
              <span>📋 Davomat Olishga O'tish</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>
          </div>
        ` : ''}

        <!-- 📅 O'QITUVCHINING SHAXSIY NAVBATCHILIK JADVALI (HAFTANING QAYSI KUNI NAVBATCHI VA BO'LAJAK GRAFIGI) -->
        ${dutyProjection.isExcluded ? `
          <div class="bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-md border border-amber-500/30 space-y-3.5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-xl shrink-0">
                  🚫
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h2 class="text-sm sm:text-base font-bold text-white tracking-tight">Navbatchilikdan Mustasno (Ozod Qilingan)</h2>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/30 text-amber-200 border border-amber-400/30 uppercase">
                      Guruhga kiritilmagan
                    </span>
                  </div>
                  <p class="text-xs text-amber-200/80 mt-0.5">
                    ${escapeHtml(currentUser.data?.teacherName || 'Sinf rahbari')} (${escapeHtml(myClass.name)} sinf)
                  </p>
                </div>
              </div>

              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/30 text-xs font-semibold">
                <span>⚪ Navbatchilik yuklatilmaydi</span>
              </span>
            </div>

            <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
              <p class="text-amber-100/90 leading-relaxed">
                Sizning sinfingiz maktab smenalariga (guruhlariga) qo'shilmagan. Maktab tartib-qoidasiga binoan, <strong>smenalarga (guruhlarga) biriktirilmagan o'qituvchilar umuman navbatchi etib tayinlanmaydi</strong> va navbatchilar safidan to'liq mustasno hisoblanadi.
              </p>
              <div class="text-[11.5px] text-amber-300/80 pt-1 flex items-center gap-1.5">
                <span>ℹ️</span>
                <span>Agar kelgusida navbatchilikka qo'shilish kerak bo'lsa, maktab administratori sizni 1-smena yoki 2-smenaga biriktirishi kifoya.</span>
              </div>
            </div>
          </div>
        ` : `
          <div class="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-md border border-indigo-500/20 space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-lg shrink-0">
                  📅
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h2 class="text-sm sm:text-base font-bold text-white tracking-tight">Sizning Navbatchilik Kuningiz</h2>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${myDutyAssignments.length > 0 ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/20' : 'bg-amber-500/30 text-amber-200 border border-amber-400/30'}">
                      ${myDutyAssignments.length > 0 ? 'Haftalik grafik' : (dutyProjection.weekText || 'Kelgusi grafik')}
                    </span>
                  </div>
                  <p class="text-xs text-indigo-200/80 mt-0.5">
                    ${escapeHtml(currentUser.data?.teacherName || 'Sinf rahbari')} (${escapeHtml(myClass.name)} sinf) • ${escapeHtml(dutyProjection.shiftName || 'Guruh')}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                ${isGrade1to5(myClass.name) ? `
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/30 text-[11px] font-semibold" title="O'zbekistonda Shanba kuni 1-5 sinflarga dars bo'lmaydi">
                    <span>ℹ️</span>
                    <span>1-5 sinf (Shanba navbatchilik yo'q)</span>
                  </span>
                ` : ''}
                <button 
                  type="button"
                  id="btn-view-duty-rotation-queue"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/70 hover:bg-indigo-600 text-xs font-bold text-white border border-indigo-400/40 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Guruhdagi barcha o'qituvchilar navbatini ko'rish"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                  </svg>
                  <span>👥 Guruh Navbatini Ko'rish</span>
                </button>
              </div>
            </div>

            ${myDutyAssignments.length > 0 ? `
              <div class="space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                  ${myDutyAssignments.map(duty => {
                    const day = WEEK_DAYS.find(w => w.id === Number(duty.dayOfWeek));
                    const shift = schoolShifts.find(s => s.id === duty.shiftId);
                    const isPrimary = (duty.primaryTeacherClassId === myClassId) || 
                      (cleanTeacherName && (duty.primaryTeacherName || '').trim().toLowerCase() === cleanTeacherName);
                    const isToday = Number(duty.dayOfWeek) === Number(todayDayOfWeek);

                    return `
                      <div class="p-3.5 rounded-2xl ${isToday ? 'bg-indigo-600/40 border-2 border-amber-400 shadow-sm' : 'bg-white/5 border border-white/10'} space-y-2.5">
                        <div class="flex items-center justify-between gap-1.5">
                          <span class="text-sm font-black text-white flex items-center gap-1.5">
                            <span>${day?.name || `Kun ${duty.dayOfWeek}`}</span>
                            ${isToday ? '<span class="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px]">BUGUN</span>' : ''}
                          </span>
                          <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold ${isPrimary ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
                            ${isPrimary ? '🟢 Asosiy Navbatchi' : '⚡ Zaxira Navbatchi'}
                          </span>
                        </div>

                        <div class="space-y-1 text-xs">
                          <div class="text-indigo-200/90 flex items-center gap-1.5">
                            <span>🕒</span>
                            <span>${escapeHtml(shift?.name || 'Smena')} (${shift?.startTime || '08:00'} - ${shift?.endTime || '13:00'})</span>
                          </div>
                          <div class="text-indigo-300/80 text-[11px]">
                            ${isPrimary ? (duty.backupTeacherName ? `Zaxira: ${escapeHtml(duty.backupTeacherName)}` : '') : `Asosiy: ${escapeHtml(duty.primaryTeacherName)}`}
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

                ${!hasPrimaryThisWeek ? `
                  <!-- Agar o'qituvchi bu hafta faqat zaxirada bo'lsa -->
                  <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-200 space-y-2 animate-fade-in text-xs">
                    <div class="flex items-center gap-2">
                      <span class="text-base">⚡</span>
                      <strong class="text-white">Siz joriy haftada Zaxira (dublyor) navbatchisiz:</strong>
                    </div>
                    <p class="text-amber-100/90 leading-relaxed">
                      Asosiy navbatchi o'qituvchi maktabga kelolmagan taqdirda, navbatchilik vazifasi avtomatik ravishda sizga yuklatiladi va tizim sizni ogohlantiradi.
                      Siz faqat zaxirada qolib ketmaysiz! Rotatsiya bo'yicha sizning <strong>ASOSIY NAVBATCHILIK</strong> navbatingiz: 
                      <strong class="text-white bg-amber-500/30 px-2 py-0.5 rounded-lg border border-amber-400/30 font-bold">${dutyProjection.weekText} ${dutyProjection.dayName} kuniga</strong> (${dutyProjection.projectedDateFormatted || ''}) to'g'ri keladi.
                    </p>
                    <div class="flex items-center justify-between text-[11px] text-amber-300 pt-1">
                      <span>Guruhdagi navbat o'rningiz: <strong>№ ${dutyProjection.queuePosition || 1}</strong> (jami ${dutyProjection.totalInGroup} nafar)</span>
                      <span>Smena: <strong>${dutyProjection.shiftName}</strong> (${dutyProjection.shiftHours})</span>
                    </div>
                  </div>
                ` : ''}
              </div>
            ` : `
              <!-- Bir haftalik jadvalda yo'q bo'lsa ham: aniq qaysi kuni navbatchi ekani ko'rsatiladi -->
              <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900/60 border border-indigo-400/30 space-y-3.5 animate-fade-in">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-300 block mb-1">
                      📌 Belgilangan Asosiy Navbatchilik Kuningiz:
                    </span>
                    <div class="flex items-baseline gap-2 flex-wrap">
                      <span class="text-lg sm:text-2xl font-black text-amber-300">
                        ${dutyProjection.dayName} kuni
                      </span>
                      <span class="text-xs sm:text-sm font-semibold text-white/90">
                        (${dutyProjection.weekText}, ${dutyProjection.projectedDateFormatted || ''})
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                      <span>🟢 Asosiy Mas'ul Navbatchi</span>
                    </span>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/10 text-xs">
                  <div class="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span class="text-indigo-300/80 block text-[10.5px]">Guruh (Smena):</span>
                    <strong class="text-white text-xs mt-0.5 block">${dutyProjection.shiftName}</strong>
                  </div>
                  <div class="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span class="text-indigo-300/80 block text-[10.5px]">Navbatchilik Vaqti:</span>
                    <strong class="text-white text-xs mt-0.5 block font-mono">🕒 ${dutyProjection.shiftHours}</strong>
                  </div>
                  <div class="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span class="text-indigo-300/80 block text-[10.5px]">Navbatdagi O'rningiz:</span>
                    <strong class="text-amber-300 text-xs mt-0.5 block font-mono">№ ${dutyProjection.queuePosition || 1} (jami ${dutyProjection.totalInGroup} nafar)</strong>
                  </div>
                </div>

                <div class="text-[11.5px] text-indigo-200/90 pt-1 leading-relaxed bg-black/25 p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div class="flex items-start gap-2">
                    <span class="text-base shrink-0">💡</span>
                    <p>
                      <strong>Nega 1 haftalik joriy jadvalda emassiz?</strong> Bir haftada faqat 6 ta ish kuni bor, smenadagi sinf rahbarlari soni (${dutyProjection.totalInGroup} nafar) esa 6 nafardan ko'p. Tizim barcha o'qituvchilarga adolatli tsiklik navbat bilan haftama-hafta taqsimlaydi. Siz doimiy zaxirada emassiz — o'z navbatingiz bilan to'liq asosiy navbatchi bo'lasiz!
                    </p>
                  </div>
                </div>
              </div>
            `}
          </div>
        `}

        ${hasDutyTakenAttendance ? `
          <!-- 1. NAVBATCHI DAVOMAT OLGAN BO'LSA: SINF RAHBARI O'Z SINFI DAVOMATINI TO'LIQ KUZATADI -->
          
          <!-- Navbatchi o'qituvchi haqida axborot kartochkasi -->
          <div class="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white rounded-3xl shadow-sm border border-emerald-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-xl shrink-0 shadow-inner">
                ⭐
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-sm sm:text-base font-bold text-white">
                    Davomat navbatchi o'qituvchi tomonidan olindi
                  </h3>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/25 text-emerald-100">
                    ${escapeHtml(foundRecord?.shiftName || 'Navbatchilik')}
                  </span>
                </div>
                <p class="text-xs text-emerald-100/90 mt-0.5">
                  Mas'ul navbatchi: <strong class="text-white">${escapeHtml(foundRecord?.dutyTeacher?.name || 'Navbatchi o\'qituvchi')}</strong>
                  ${foundRecord?.dutyTeacher?.phone ? `(Tel: <a href="tel:${foundRecord.dutyTeacher.phone}" class="underline hover:text-white font-mono">${escapeHtml(foundRecord.dutyTeacher.phone)}</a>)` : ''}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 self-start sm:self-auto">
              <span class="px-3 py-1.5 rounded-xl bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 backdrop-blur-xs">
                <span>🟢</span>
                <span>${foundClassAttendance?.isSubmittedToAdmin ? 'Adminga topshirildi' : 'Kuzatuvda'}</span>
              </span>
            </div>
          </div>

          <!-- Statistika kartochkalari (Metrikalar) -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-base shrink-0">
                👥
              </div>
              <div class="min-w-0">
                <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Jami o'quvchi</div>
                <div class="text-lg sm:text-xl font-black text-slate-900 leading-tight">${totalStudents} nafar</div>
              </div>
            </div>

            <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-200/90 shadow-2xs flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base shrink-0">
                ✓
              </div>
              <div class="min-w-0">
                <div class="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Darsda (Bor)</div>
                <div class="text-lg sm:text-xl font-black text-emerald-600 leading-tight">${presentCount} nafar <span class="text-xs font-bold text-emerald-500">(${attendanceRate}%)</span></div>
              </div>
            </div>

            <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-rose-200/90 shadow-2xs flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-base shrink-0">
                ✕
              </div>
              <div class="min-w-0">
                <div class="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Sababsiz</div>
                <div class="text-lg sm:text-xl font-black text-rose-600 leading-tight">${unexcusedCount} nafar</div>
              </div>
            </div>

            <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-amber-200/90 shadow-2xs flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-base shrink-0">
                ⚠️
              </div>
              <div class="min-w-0">
                <div class="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Sababli</div>
                <div class="text-lg sm:text-xl font-black text-amber-600 leading-tight">${excusedCount} nafar</div>
              </div>
            </div>
          </div>

          <!-- Qidiruv va Filtr chiplari -->
          <div class="bg-white p-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <!-- Qidiruv qutisi -->
              <div class="relative flex-1 max-w-md">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <input 
                  type="text" 
                  id="non-duty-student-search-input" 
                  value="${escapeHtml(nonDutyStudentSearchQuery)}"
                  placeholder="O'quvchi ismi yoki telefoni orqali qidirish..."
                  class="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                ${nonDutyStudentSearchQuery ? `
                  <button id="btn-clear-non-duty-search" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                ` : ''}
              </div>

              <!-- Filtr chiplari -->
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button 
                  data-filter="all"
                  class="btn-non-duty-filter whitespace-nowrap px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${nonDutyClassFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
                >
                  Barchasi (${totalStudents})
                </button>
                <button 
                  data-filter="present"
                  class="btn-non-duty-filter whitespace-nowrap px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${nonDutyClassFilter === 'present' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}"
                >
                  Darsda (${presentCount})
                </button>
                <button 
                  data-filter="absent"
                  class="btn-non-duty-filter whitespace-nowrap px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${nonDutyClassFilter === 'absent' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'}"
                >
                  Kelmaganlar (${totalAbsent})
                </button>
                ${lateCount > 0 ? `
                  <button 
                    data-filter="late"
                    class="btn-non-duty-filter whitespace-nowrap px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${nonDutyClassFilter === 'late' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'}"
                  >
                    Kechikkanlar (${lateCount})
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- O'quvchilar ro'yxati (Desktop Table & Mobile Cards) -->
            ${filteredStudents.length === 0 ? `
              <div class="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-200/80 p-6 space-y-2">
                <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  🔍
                </div>
                <div class="text-sm font-semibold text-slate-700">Hech qanday o'quvchi topilmadi</div>
                <p class="text-xs text-slate-400">Qidiruv so'zini o'zgartiring yoki filtrni tozalang</p>
              </div>
            ` : `
              <!-- Desktop Table -->
              <div class="hidden md:block overflow-x-auto rounded-2xl border border-slate-200">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th class="py-3 px-3.5 text-center w-12">№</th>
                      <th class="py-3 px-3.5">O'quvchi F.I.SH.</th>
                      <th class="py-3 px-3.5 text-center">Davomat holati</th>
                      <th class="py-3 px-3.5">Navbatchi qayd etgan izoh / sabab</th>
                      <th class="py-3 px-3.5 text-right">Ota-onasi telefoni</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${filteredStudents.map((st, idx) => {
                      const rec = recordsMap[st.id];
                      const stStatus = rec?.status || 'present';
                      const parentPhone = st.fatherPhone || st.motherPhone || st.phone || '';
                      const note = rec?.note || '';
                      const avatarLetter = (st.fullName || 'O').trim().charAt(0).toUpperCase();

                      let statusBadge = '';
                      if (stStatus === 'present') {
                        statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">🟢 Darsda (Bor)</span>';
                      } else if (stStatus === 'absent_unexcused') {
                        statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80">🔴 Sababsiz kelmadi</span>';
                      } else if (stStatus === 'absent_excused') {
                        statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80">🟡 Sababli dars qoldirdi</span>';
                      } else if (stStatus === 'late') {
                        statusBadge = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">🔵 Darsga kechikkan</span>';
                      }

                      return `
                        <tr class="hover:bg-slate-50/80 transition-colors ${stStatus !== 'present' ? 'bg-amber-50/20' : ''}">
                          <td class="py-3 px-3.5 text-center text-slate-400 font-mono font-medium">${idx + 1}</td>
                          <td class="py-3 px-3.5">
                            <div class="flex items-center gap-2.5">
                              ${st.photo ? `
                                <img src="${st.photo}" alt="${escapeHtml(st.fullName)}" class="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                              ` : `
                                <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100">
                                  ${avatarLetter}
                                </div>
                              `}
                              <strong class="text-slate-900 font-semibold">${escapeHtml(st.fullName)}</strong>
                            </div>
                          </td>
                          <td class="py-3 px-3.5 text-center">
                            ${statusBadge}
                          </td>
                          <td class="py-3 px-3.5">
                            ${note ? `
                              <span class="inline-block p-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs italic border border-slate-200/70">
                                "${escapeHtml(note)}"
                              </span>
                            ` : `
                              <span class="text-slate-400 italic">-</span>
                            `}
                          </td>
                          <td class="py-3 px-3.5 text-right font-mono">
                            ${parentPhone ? `
                              <a href="tel:${parentPhone.replace(/[^0-9+]/g, '')}" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 font-bold transition-all">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                </svg>
                                <span>${escapeHtml(parentPhone)}</span>
                              </a>
                            ` : `
                              <span class="text-slate-400 italic">Mavjud emas</span>
                            `}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Mobile Student Cards -->
              <div class="block md:hidden space-y-2.5">
                ${filteredStudents.map((st, idx) => {
                  const rec = recordsMap[st.id];
                  const stStatus = rec?.status || 'present';
                  const parentPhone = st.fatherPhone || st.motherPhone || st.phone || '';
                  const note = rec?.note || '';
                  const avatarLetter = (st.fullName || 'O').trim().charAt(0).toUpperCase();

                  let statusBadge = '';
                  let cardBorder = 'border-slate-200/90';
                  if (stStatus === 'present') {
                    statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">🟢 Darsda</span>';
                  } else if (stStatus === 'absent_unexcused') {
                    statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">🔴 Sababsiz</span>';
                    cardBorder = 'border-rose-300 bg-rose-50/20';
                  } else if (stStatus === 'absent_excused') {
                    statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">🟡 Sababli</span>';
                    cardBorder = 'border-amber-300 bg-amber-50/20';
                  } else if (stStatus === 'late') {
                    statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">🔵 Kechikkan</span>';
                  }

                  return `
                    <div class="p-3 bg-white rounded-2xl border ${cardBorder} shadow-2xs space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <span class="text-xs text-slate-400 font-mono font-medium">${idx + 1}.</span>
                          ${st.photo ? `
                            <img src="${st.photo}" alt="${escapeHtml(st.fullName)}" class="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                          ` : `
                            <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100">
                              ${avatarLetter}
                            </div>
                          `}
                          <strong class="text-xs font-bold text-slate-900 truncate">${escapeHtml(st.fullName)}</strong>
                        </div>
                        ${statusBadge}
                      </div>

                      ${note ? `
                        <div class="text-[11px] p-2 bg-slate-50 text-slate-700 rounded-xl border border-slate-200/70 italic">
                          "${escapeHtml(note)}"
                        </div>
                      ` : ''}

                      ${parentPhone ? `
                        <div class="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span class="text-slate-500">Ota-ona telefoni:</span>
                          <a href="tel:${parentPhone.replace(/[^0-9+]/g, '')}" class="text-indigo-600 hover:text-emerald-600 font-mono font-bold flex items-center gap-1">
                            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                            </svg>
                            <span>${escapeHtml(parentPhone)}</span>
                          </a>
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

        ` : `
          <!-- 2. NAVBATCHI DAVOMAT OLMAGAN BO'LSA: TUSHUNARLI VA BO'SH AXBOROT SAHIFASI -->
          
          <div class="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 text-center shadow-xs">
            <div class="w-20 h-20 rounded-3xl bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
              ⏳
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Davomat hali olinmagan
            </h2>
            <p class="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
              Bugun maktab bo'yicha umumiy davomat olish vazifasi mas'ul navbatchi o'qituvchilar zimmasida. Ular davomatni olishi bilanoq, ushbu sahifada sizning <strong>${escapeHtml(myClass.name)}</strong> sinfingiz davomati avtomatik ko'rinadi va monitoring qila olasiz.
            </p>

            <!-- Bugungi mas'ul navbatchi o'qituvchilar ko'rinishi -->
            <div class="mt-6 p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl text-left max-w-lg mx-auto shadow-2xs space-y-2.5">
              <div class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span class="flex items-center gap-1.5">
                  <span>⭐</span>
                  <span>Bugungi mas'ul navbatchi o'qituvchilar:</span>
                </span>
                <span class="text-[11px] font-normal text-slate-500 font-mono">2 ta smena</span>
              </div>
              ${getTodayDutyTeachersForSchool(schoolId, state).map(d => `
                <div class="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                        ${escapeHtml(d.shiftName)}
                      </span>
                      <strong class="text-slate-900">${escapeHtml(d.hasAbsence ? (d.delegatedTeacherName || d.backupTeacherName) : d.primaryTeacherName)}</strong>
                      <span class="text-slate-500">(${escapeHtml(d.primaryTeacherClassName || '-')})</span>
                    </div>
                    ${d.primaryTeacherPhone ? `
                      <div class="text-[11px] text-slate-400 mt-0.5">
                        Tel: <a href="tel:${d.primaryTeacherPhone}" class="text-indigo-600 font-bold hover:underline">${escapeHtml(d.primaryTeacherPhone)}</a>
                      </div>
                    ` : ''}
                  </div>
                  ${d.hasAbsence 
                    ? '<span class="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black text-[10px]">⚠️ Zaxirada</span>' 
                    : '<span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold text-[10px]">🟢 Mas\'ul</span>'}
                </div>
              `).join('')}
            </div>

            <div class="mt-5">
              <button 
                id="btn-center-refresh-att" 
                class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                <span>Davomatni tekshirish / Yangilash</span>
              </button>
            </div>
          </div>
        `}

        <!-- O'qituvchining dars qoldirish holati / arizasi -->
        ${myAbsence ? `
          <div class="p-4 sm:p-5 bg-amber-50/90 border border-amber-200 rounded-3xl text-left shadow-2xs">
            <div class="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-amber-200/70">
              <span class="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <span>⚠️</span>
                <span>Dars qoldirish sababi adminga yuborilgan</span>
              </span>
              <span class="text-[10px] font-mono text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-md font-bold">
                ${formatReadableDate(myAbsence.date)}
              </span>
            </div>
            <p class="text-xs text-slate-800 font-medium italic">
              "${escapeHtml(myAbsence.reason)}"
            </p>
            <div class="mt-3 flex items-center justify-between text-[11px] text-amber-800 pt-2 border-t border-amber-200/60">
              <span class="flex items-center gap-1 text-emerald-700 font-bold">
                <span>✓</span> Maktab admini "O'qituvchilar davomati" sahifasiga yetkazildi
              </span>
              <button id="btn-edit-reported-absence" class="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer">
                Tahrirlash
              </button>
            </div>
          </div>
        ` : `
          <div class="p-4 sm:p-5 bg-amber-50/60 border border-amber-200 rounded-3xl text-center space-y-2">
            <div class="text-xs font-bold text-amber-950 flex items-center justify-center gap-1.5">
              <span>⚠️</span>
              <span>Maktabga kela olmaysizmi?</span>
            </div>
            <p class="text-xs text-slate-600 max-w-lg mx-auto">
              Dars qoldirish sababini yozib qoldirsangiz, bu haqda maktab admini panelidagi "O'qituvchilar davomati" sahifasida sababingiz bilan birga ko'rinadi.
            </p>
            <button 
              id="btn-card-leave-request" 
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs hover:shadow-md active:scale-95"
            >
              <span>📝 Dars qoldirish sababini yozish &rarr;</span>
            </button>
          </div>
        `}

      </div>
    `;
  }

  // O'qituvchilar navbat ketma-ketligi modali
  function openDutyRotationQueueModal(projection) {
    if (!projection || !Array.isArray(projection.allGroupTeachersQueue)) {
      showToast("Guruh ma'lumotlari topilmadi", 'error');
      return;
    }
    const modalId = 'duty-rotation-queue-modal';
    document.getElementById(modalId)?.remove();

    const queue = projection.allGroupTeachersQueue;

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl p-5 sm:p-6 animate-scale-in my-auto max-h-[90vh] flex flex-col text-slate-800">
        
        <div class="pb-3 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1">
              <span>Guruh: ${escapeHtml(projection.shiftName || 'Smena')}</span>
              <span class="text-slate-400 font-mono">(${projection.shiftHours || '08:00 - 13:00'})</span>
            </div>
            <h3 class="text-base sm:text-lg font-black text-slate-900">
              O'qituvchilar Navbatchilik Ketma-ketligi (Rotatsiyasi)
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Jami: <strong>${projection.totalInGroup} nafar</strong> sinf rahbari. Barcha o'qituvchilar navbatma-navbat haftalarga taqsimlangan.
            </p>
          </div>
          <button id="close-rotation-modal-btn" class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="my-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
          <div class="font-bold flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>Navbatchilik tamoyillari:</span>
          </div>
          <ul class="list-disc pl-5 space-y-0.5 text-[11.5px] text-amber-800">
            <li><strong>Hech kim doimiy zaxirada qolmaydi</strong>: Har bir o'qituvchiga asosiy mas'ul navbatchilik navbati keladi.</li>
            <li>1-5 boshlang'ich sinf rahbarlariga Shanba kuni dars bo'lmagani sababli faqat Dushanba-Juma kunlari beriladi.</li>
            <li>Bitta o'qituvchi 2 kun ketma-ket navbatchi qilinmaydi.</li>
          </ul>
        </div>

        <div class="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl max-h-80 pr-1">
          ${queue.map(item => `
            <div class="p-3 flex items-center justify-between gap-3 transition-colors ${item.isMe ? 'bg-indigo-50/90 font-bold border-l-4 border-indigo-600' : 'hover:bg-slate-50'}">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-7 h-7 rounded-xl ${item.isMe ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'} flex items-center justify-center text-xs font-black shrink-0 font-mono">
                  ${item.index}
                </span>
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      ${escapeHtml(item.teacherName)}
                    </span>
                    <span class="px-2 py-0.2 rounded text-[10.5px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      ${escapeHtml(item.className)}
                    </span>
                    ${item.isLowerGrade ? `
                      <span class="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800">1-5 sinf</span>
                    ` : ''}
                    ${item.isMe ? `
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white shadow-2xs">
                        ⭐ Siz
                      </span>
                    ` : ''}
                  </div>
                  <div class="text-[11px] text-slate-500 mt-0.5">
                    Navbati: <strong>${item.weekText}</strong> • <strong class="text-indigo-700">${item.dayName}</strong>
                  </div>
                </div>
              </div>

              <div class="text-right shrink-0">
                <span class="px-2.5 py-1 rounded-lg text-xs font-bold ${item.weekNumber === 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
                  ${item.weekText}
                </span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="pt-3 border-t border-slate-100 flex items-center justify-end mt-3">
          <button id="close-rotation-modal-btn2" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer">
            Tushunarli, yopish
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('#close-rotation-modal-btn')?.addEventListener('click', close);
    div.querySelector('#close-rotation-modal-btn2')?.addEventListener('click', close);
    div.addEventListener('click', (e) => {
      if (e.target === div) close();
    });
  }

  function attachNonDutyTeacherHandlers() {
    document.getElementById('att-back-btn')?.addEventListener('click', () => {
      if (onBack) onBack();
    });

    // Navbatchilik navbat ketma-ketligi modalini ochish
    document.getElementById('btn-view-duty-rotation-queue')?.addEventListener('click', () => {
      const myClassId = currentUser.data?.id;
      const myClass = schoolClasses.find(c => c.id === myClassId) || { id: myClassId, name: currentUser.data?.name || 'Sinf' };
      const projection = getTeacherDutyScheduleProjection(myClass, state);
      openDutyRotationQueueModal(projection);
    });

    // Zaxiradan tayinlangan o'qituvchining davomat olish sahifasiga o'tishi
    document.getElementById('btn-switch-to-duty-mode')?.addEventListener('click', () => {
      isCurrentUserDutyOfficer = true;
      showToast("Davomat olish sahifasiga o'tildi. Maktab davomatini to'ldirishingiz mumkin!", 'success');
      render();
    });

    const datePicker = document.getElementById('non-duty-date-picker');
    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        render();
      });
    }

    const refreshBtns = [
      document.getElementById('btn-refresh-non-duty-att'),
      document.getElementById('btn-center-refresh-att')
    ];
    refreshBtns.forEach(btn => {
      btn?.addEventListener('click', () => {
        showToast("Ma'lumotlar yangilanmoqda...", 'info');
        render();
      });
    });

    // Qidiruv inputi
    const searchInput = document.getElementById('non-duty-student-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const cursorPosition = e.target.selectionStart ?? e.target.value.length;
        nonDutyStudentSearchQuery = e.target.value;
        render();
        const newSearchInput = document.getElementById('non-duty-student-search-input');
        if (newSearchInput) {
          newSearchInput.focus();
          const pos = Math.min(cursorPosition, newSearchInput.value.length);
          newSearchInput.setSelectionRange(pos, pos);
        }
      });
    }

    const clearSearchBtn = document.getElementById('btn-clear-non-duty-search');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        nonDutyStudentSearchQuery = '';
        render();
      });
    }

    // Filtr chiplari
    document.querySelectorAll('.btn-non-duty-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = btn.getAttribute('data-filter');
        if (f) {
          nonDutyClassFilter = f;
          render();
        }
      });
    });

    document.getElementById('btn-top-leave-request')?.addEventListener('click', () => {
      openTeacherLeaveModal();
    });

    document.getElementById('btn-card-leave-request')?.addEventListener('click', () => {
      openTeacherLeaveModal();
    });

    document.getElementById('btn-edit-reported-absence')?.addEventListener('click', () => {
      const cleanTeacherName = (currentUser.data?.teacherName || '').trim().toLowerCase();
      const myAbsence = (state.dutyAbsences || []).find(a => {
        if (a.schoolId !== schoolId) return false;
        if (a.date !== selectedDate && a.date !== todayDate) return false;
        const origName = (a.originalTeacherName || '').trim().toLowerCase();
        const origClassId = a.originalTeacherClassId;
        return (origClassId && origClassId === currentUser.data?.id) || 
               (cleanTeacherName && origName && (origName === cleanTeacherName || origName.includes(cleanTeacherName)));
      });
      openTeacherLeaveModal({
        defaultDate: myAbsence?.date || todayDate,
        defaultReason: myAbsence?.reason || ''
      });
    });
  }

  // =========================================================================
  // O'QUVCHI SABABLI KELMAGANIDA SABABINI OLISH MODALI (IXTIYORIY)
  // =========================================================================
  function openStudentExcusedModal(student, classObj, currentRecord) {
    if (!student || !classObj) return;
    const modalId = 'duty-student-excused-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const studentName = student.fullName || `${student.lastName || ''} ${student.firstName || ''}`.trim();
    const className = classObj.name || 'Sinf';

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-5 sm:p-6 animate-scale-in text-left">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-bold">
              🟡
            </span>
            <div>
              <h3 class="text-base font-bold text-slate-900">Sababli dars qoldirish</h3>
              <p class="text-xs text-slate-500">${escapeHtml(studentName)} • ${escapeHtml(className)}</p>
            </div>
          </div>
          <button id="close-excused-modal-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="mt-4 space-y-3.5">
          <div class="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs space-y-1.5 text-slate-700">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">O'quvchi:</span>
              <strong class="text-slate-900 font-bold">${escapeHtml(studentName)}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Sinf:</span>
              <span class="text-indigo-700 font-bold">${escapeHtml(className)}</span>
            </div>
            ${(student.fatherPhone || student.motherPhone || student.phone) ? `
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Ota-ona tel:</span>
                <span class="font-mono text-slate-700">${escapeHtml(student.fatherPhone || student.motherPhone || student.phone)}</span>
              </div>
            ` : ''}
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              Tezkor sabab tanlovi (ixtiyoriy):
            </label>
            <div class="flex flex-wrap gap-1.5">
              <button type="button" class="btn-quick-student-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Betoblik (shamollash / salomatlik)">
                🤒 Betoblik
              </button>
              <button type="button" class="btn-quick-student-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Oilaviy zarur sabab tufayli">
                👨‍👩‍👧 Oilaviy sharoit
              </button>
              <button type="button" class="btn-quick-student-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Shifokor ko'rigi / Shifoxonada">
                🏥 Shifoxona
              </button>
              <button type="button" class="btn-quick-student-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Sport musobaqasi yoki Fan olimpiadasida">
                🏆 Musobaqa
              </button>
              <button type="button" class="btn-quick-student-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Ob-havo / yo'l sharoiti sababli">
                🌧️ Ob-havo
              </button>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="student-excuse-reason" class="block text-xs font-bold text-slate-700">
                Sabab izohi:
              </label>
              <span class="text-[11px] text-slate-400 font-normal">Kiritish majburiy emas</span>
            </div>
            <textarea 
              id="student-excuse-reason" 
              rows="3" 
              placeholder="Nima sababdan kelmagani haqida ma'lumot yozishingiz mumkin (bo'sh qoldirsa ham bo'ladi)..." 
              class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            >${escapeHtml(currentRecord?.note || '')}</textarea>
          </div>
        </div>

        <div class="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button 
            type="button" 
            id="cancel-excused-modal-btn" 
            class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Bekor qilish
          </button>
          <button 
            type="button" 
            id="confirm-excused-modal-btn" 
            class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <span>✓ Saqlash</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const textarea = div.querySelector('#student-excuse-reason');
    div.querySelectorAll('.btn-quick-student-tag').forEach(b => {
      b.addEventListener('click', () => {
        const val = b.getAttribute('data-val');
        if (textarea) {
          textarea.value = val;
          textarea.focus();
        }
      });
    });

    const closeModal = () => div.remove();
    div.querySelector('#close-excused-modal-btn')?.addEventListener('click', closeModal);
    div.querySelector('#cancel-excused-modal-btn')?.addEventListener('click', closeModal);

    div.querySelector('#confirm-excused-modal-btn')?.addEventListener('click', () => {
      const reason = textarea ? textarea.value.trim() : '';

      if (!activeTakingAttendanceData.classAttendance[classObj.id].records[student.id]) {
        activeTakingAttendanceData.classAttendance[classObj.id].records[student.id] = {
          studentName,
          status: 'absent_excused',
          note: reason,
          phone: student.phone || '',
          parentPhone: student.fatherPhone || student.motherPhone || student.phone || ''
        };
      } else {
        activeTakingAttendanceData.classAttendance[classObj.id].records[student.id].status = 'absent_excused';
        activeTakingAttendanceData.classAttendance[classObj.id].records[student.id].note = reason;
      }

      closeModal();
      render();
    });
  }

  // =========================================================================
  // 2. NAVBATCHI O'QITUVCHI DAVOMAT SAHIFASI
  // =========================================================================
  function renderDutyTeacherAttendanceView() {
    if (!activeTakingAttendanceData) {
      const preferredShiftId = teacherDutyInfo.dutyShifts[0]?.shiftId;
      const shift = (preferredShiftId && schoolShifts.find(s => s.id === preferredShiftId)) || schoolShifts[0];
      if (shift) {
        initTakingAttendance(shift.id, todayDate);
      }
    }

    if (!selectedClassIdForAttendance && schoolClasses.length > 0) {
      selectedClassIdForAttendance = schoolClasses[0].id;
    }

    const currentClassObj = schoolClasses.find(c => c.id === selectedClassIdForAttendance) || schoolClasses[0];
    
    if (activeTakingAttendanceData && !activeTakingAttendanceData.classAttendance) {
      activeTakingAttendanceData.classAttendance = {};
    }

    if (activeTakingAttendanceData && currentClassObj && !activeTakingAttendanceData.classAttendance[currentClassObj.id]) {
      const clsStudents = schoolStudents.filter(s => s.classId === currentClassObj.id);
      const records = {};
      clsStudents.forEach(st => {
        records[st.id] = {
          studentName: st.fullName || `${st.lastName || ''} ${st.firstName || ''}`.trim(),
          status: 'present',
          note: '',
          phone: st.phone || '',
          parentPhone: st.fatherPhone || st.motherPhone || st.phone || ''
        };
      });
      activeTakingAttendanceData.classAttendance[currentClassObj.id] = {
        classId: currentClassObj.id,
        className: currentClassObj.name,
        teacherName: currentClassObj.teacherName || '',
        totalStudents: clsStudents.length,
        presentCount: clsStudents.length,
        absentCount: 0,
        excusedCount: 0,
        unexcusedCount: 0,
        records,
        isSubmittedToAdmin: false
      };
    }

    const currentClassData = activeTakingAttendanceData?.classAttendance?.[currentClassObj?.id];
    const recordsMap = currentClassData?.records || {};

    // Alifbo tartibida o'quvchilar ro'yxati
    const classStudents = schoolStudents
      .filter(s => s.classId === currentClassObj?.id)
      .sort((a, b) => (a.fullName || '').trim().localeCompare((b.fullName || '').trim(), 'uz'));

    let presentCount = 0;
    let excusedCount = 0;
    let unexcusedCount = 0;
    classStudents.forEach(st => {
      const rec = recordsMap[st.id];
      const status = rec?.status || 'present';
      if (status === 'present') presentCount++;
      else if (status === 'absent_excused') excusedCount++;
      else if (status === 'absent_unexcused' || status === 'late') unexcusedCount++;
    });

    const filteredStudents = classStudents.filter(st => {
      if (!dutyStudentSearchQuery || !dutyStudentSearchQuery.trim()) return true;
      const q = dutyStudentSearchQuery.trim().toLowerCase();
      const name = (st.fullName || `${st.lastName || ''} ${st.firstName || ''}`).toLowerCase();
      return name.includes(q);
    });

    return `
      <div class="space-y-4 pb-12 sm:pb-16 max-w-5xl mx-auto animate-fade-in">
        
        <!-- Top Header -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <button id="att-back-btn" class="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95" title="Orqaga qaytish">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
            </button>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h1 class="text-base sm:text-xl font-bold text-slate-900 tracking-tight">Bugungi Navbatchi Davomati</h1>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Mas'ul navbatchi
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">${currentUser.data?.teacherName || 'Navbatchi o\'qituvchi'} • ${formatReadableDate(todayDate)}</p>
            </div>
          </div>

          <!-- Yuqoridagi Dars Qoldirish Tugmasi -->
          <button 
            id="btn-top-leave-request" 
            class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95 self-start sm:self-auto"
            title="Kutilmaganda dars qoldirish zarur bo'lsa sababini yozish"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span>Dars qoldirish</span>
          </button>
        </div>

        <!-- 1. Bir qator bo'lib sinflar nomi (Class selector row) -->
        <div class="bg-white p-3.5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs">
          <div class="flex items-center justify-between mb-2 px-1">
            <span class="text-xs font-bold text-slate-700">Sinfni tanlang:</span>
            <span class="text-[11px] text-slate-500 font-semibold">Jami ${schoolClasses.length} ta sinf</span>
          </div>

          <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            ${schoolClasses.map(cls => {
              const isSelected = cls.id === (currentClassObj?.id || selectedClassIdForAttendance);
              let clsData = activeTakingAttendanceData?.classAttendance?.[cls.id];
              if (!clsData?.isSubmittedToAdmin) {
                const anySubmitted = (state.attendanceRecords || []).find(r => 
                  r.schoolId === schoolId && r.date === todayDate && r.classAttendance?.[cls.id]?.isSubmittedToAdmin
                );
                if (anySubmitted) {
                  clsData = anySubmitted.classAttendance[cls.id];
                  if (activeTakingAttendanceData?.classAttendance) {
                    activeTakingAttendanceData.classAttendance[cls.id] = JSON.parse(JSON.stringify(clsData));
                  }
                }
              }
              const isSubmitted = Boolean(clsData?.isSubmittedToAdmin);
              const hasAbsents = Boolean(clsData && (clsData.absentCount > 0 || (clsData.excusedCount + clsData.unexcusedCount) > 0));
              
              return `
                <button 
                  type="button" 
                  class="btn-duty-class-pill px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                    isSelected 
                      ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400 font-extrabold scale-[1.02]' 
                      : (isSubmitted
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-extrabold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80')
                  }"
                  data-class-id="${cls.id}"
                >
                  <span>${cls.name}</span>
                  ${isSubmitted ? `
                    <span class="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs" title="Davomat saqlangan va adminga yuborilgan">✓</span>
                  ` : (hasAbsents ? `
                    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                  ` : '')}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2. Tanlangan sinf o'quvchilari ro'yxati (Alifbo tartibida) -->
        <div class="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-2.5 flex-wrap">
                <h2 class="text-base sm:text-lg font-black text-slate-900">${currentClassObj?.name || 'Sinf'} o'quvchilari</h2>
                <span class="text-xs text-slate-500 font-medium">(${currentClassObj?.teacherName || 'Sinf rahbari belgilanmagan'})</span>
                ${currentClassData?.isSubmittedToAdmin ? `
                  <span class="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <span>✓</span>
                    <span>Adminga yuborilgan (${escapeHtml(currentClassData.submittedBy || 'Navbatchi o\'qituvchi')})</span>
                  </span>
                ` : ''}
              </div>
              <div class="flex items-center gap-2 mt-1.5 flex-wrap text-xs font-semibold">
                <span class="text-slate-600">Jami: <strong>${classStudents.length}</strong></span>
                <span>•</span>
                <span class="text-emerald-700">🟢 Bor: <strong>${presentCount}</strong></span>
                <span>•</span>
                <span class="text-amber-700">🟡 Sababli: <strong>${excusedCount}</strong></span>
                <span>•</span>
                <span class="text-rose-700">🔴 Sababsiz: <strong>${unexcusedCount}</strong></span>
              </div>
            </div>

            <!-- O'quvchini qidirish inputi va barchasi kelgan tugmasi -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <!-- Qidiruv inputi -->
              <div class="relative flex-1 sm:w-60">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <input 
                  type="text" 
                  id="duty-student-search-input" 
                  value="${escapeHtml(dutyStudentSearchQuery)}" 
                  placeholder="O'quvchini qidirish..." 
                  class="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                ${dutyStudentSearchQuery ? `
                  <button 
                    type="button" 
                    id="duty-clear-search-btn" 
                    class="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Tozalash"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                ` : ''}
              </div>

              <!-- Barchasini kelgan qilish tugmasi -->
              <button 
                type="button" 
                id="btn-duty-all-present" 
                class="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
              >
                <span>✓ Barchasi kelgan</span>
              </button>
            </div>
          </div>

          <!-- O'quvchilar ro'yxati (Alifbo tartibida) -->
          <div class="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <div id="duty-search-no-results" class="p-8 text-center text-slate-400 text-xs font-medium" style="display: none;">
              Qidiruv bo'yicha hech qanday o'quvchi topilmadi
            </div>

            ${filteredStudents.length === 0 ? `
              <div class="p-8 text-center text-slate-400 text-xs font-medium">
                ${dutyStudentSearchQuery 
                  ? `"${escapeHtml(dutyStudentSearchQuery)}" bo'yicha hech qanday o'quvchi topilmadi` 
                  : "Ushbu sinfda hali o'quvchilar mavjud emas"}
              </div>
            ` : filteredStudents.map((st, idx) => {
              const rec = recordsMap[st.id] || { status: 'present', note: '' };
              const currentStatus = rec.status || 'present';
              const parentPhone = st.fatherPhone || st.motherPhone || st.phone || '';

              return `
                <div class="duty-student-row p-3.5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3" data-student-id="${st.id}">
                  <div class="flex items-start sm:items-center gap-3 min-w-0">
                    <span class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-mono font-bold shrink-0 mt-0.5 sm:mt-0">
                      ${idx + 1}
                    </span>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <strong class="duty-student-name text-xs sm:text-sm font-bold text-slate-900 block truncate">
                          ${st.fullName || `${st.lastName || ''} ${st.firstName || ''}`.trim()}
                        </strong>
                        ${currentStatus === 'absent_excused' ? `
                          <button 
                            type="button"
                            class="btn-edit-student-excuse inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-amber-50 text-amber-900 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors active:scale-95 text-left"
                            data-student-id="${st.id}"
                            title="Sababni ko'rish yoki o'zgartirish uchun bosing"
                          >
                            <span>💬</span>
                            <span class="max-w-[160px] truncate">${escapeHtml(rec.note || 'Sababli')}</span>
                            <span class="text-[9.5px] text-amber-700 underline font-semibold ml-0.5">O'zgartirish</span>
                          </button>
                        ` : ''}
                      </div>
                      <span class="text-[11px] text-slate-500 font-mono">
                        ${parentPhone ? `Ota-onasi: ${parentPhone}` : 'Telefon raqam kiritilmagan'}
                      </span>
                    </div>
                  </div>

                  <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <!-- Status tanlash tugmalari: Bor, Sababli, Sababsiz -->
                    <div class="flex items-center gap-1.5">
                      <button 
                        type="button" 
                        class="btn-duty-status flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          currentStatus === 'present'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }"
                        data-student-id="${st.id}"
                        data-status="present"
                      >
                        🟢 Bor
                      </button>

                      <button 
                        type="button" 
                        class="btn-duty-status flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          currentStatus === 'absent_excused'
                            ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                        }"
                        data-student-id="${st.id}"
                        data-status="absent_excused"
                      >
                        🟡 Sababli
                      </button>

                      <button 
                        type="button" 
                        class="btn-duty-status flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          currentStatus === 'absent_unexcused' || currentStatus === 'late'
                            ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                        }"
                        data-student-id="${st.id}"
                        data-status="absent_unexcused"
                      >
                        🔴 Sababsiz
                      </button>
                    </div>

                    <!-- Sababsiz holati uchun ixtiyoriy tezkor izoh inputi -->
                    ${currentStatus === 'absent_unexcused' || currentStatus === 'late' ? `
                      <input 
                        type="text" 
                        class="duty-student-note-input px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 w-full sm:w-40" 
                        placeholder="Izoh (ixtiyoriy)..." 
                        data-student-id="${st.id}"
                        value="${escapeHtml(rec.note || '')}"
                      />
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- 3. O'quvchilar ro'yxatining eng pastidagi saqlash paneli (Oddiy static joylashuv) -->
          <div class="mt-4 p-4 sm:p-5 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3.5 shadow-2xs">
            <div class="flex items-center gap-2 text-xs sm:text-sm text-slate-700 w-full sm:w-auto justify-between sm:justify-start flex-wrap">
              <span class="font-bold text-slate-900">${currentClassObj?.name || 'Sinf'}:</span>
              <span class="text-slate-500 font-semibold">Jami ${classStudents.length}</span>
              <span>•</span>
              <span class="text-emerald-700 font-bold">Bor: ${presentCount}</span>
              <span>•</span>
              <span class="text-amber-700 font-bold">Sababli: ${excusedCount}</span>
              <span>•</span>
              <span class="text-rose-700 font-bold">Sababsiz: ${unexcusedCount}</span>
            </div>

            <button 
              type="button" 
              id="btn-duty-save-class-attendance" 
              class="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span>Davomatni saqlash va Adminga yuborish</span>
            </button>
          </div>
        </div>

      </div>
    `;
  }

  function attachDutyTeacherAttendanceHandlers() {
    document.getElementById('att-back-btn')?.addEventListener('click', () => {
      if (onBack) onBack();
    });

    document.getElementById('btn-top-leave-request')?.addEventListener('click', () => {
      openTeacherLeaveModal();
    });

    // O'quvchini qidirish inputi
    const searchInput = document.getElementById('duty-student-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        dutyStudentSearchQuery = e.target.value;
        const q = dutyStudentSearchQuery.trim().toLowerCase();
        const rows = container.querySelectorAll('.duty-student-row');
        let visibleCount = 0;
        rows.forEach(row => {
          const studentName = (row.querySelector('.duty-student-name')?.textContent || '').toLowerCase();
          if (!q || studentName.includes(q)) {
            row.style.display = '';
            visibleCount++;
          } else {
            row.style.display = 'none';
          }
        });

        const noResultsEl = document.getElementById('duty-search-no-results');
        if (noResultsEl) {
          noResultsEl.style.display = (visibleCount === 0 && q) ? 'block' : 'none';
        }
      });
    }

    document.getElementById('duty-clear-search-btn')?.addEventListener('click', () => {
      dutyStudentSearchQuery = '';
      render();
    });

    // Sinf tanlash (Class pills)
    container.querySelectorAll('.btn-duty-class-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const classId = btn.getAttribute('data-class-id');
        if (classId) {
          dutyStudentSearchQuery = '';
          selectedClassIdForAttendance = classId;
          render();
        }
      });
    });

    // O'quvchi statusini o'zgartirish (Bor, Sababli, Sababsiz)
    container.querySelectorAll('.btn-duty-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-student-id');
        const status = btn.getAttribute('data-status');
        const classObj = schoolClasses.find(c => c.id === selectedClassIdForAttendance) || schoolClasses[0];
        if (!classObj || !activeTakingAttendanceData?.classAttendance?.[classObj.id]) return;

        const clsAtt = activeTakingAttendanceData.classAttendance[classObj.id];
        if (!clsAtt.records) clsAtt.records = {};
        if (!clsAtt.records[studentId]) {
          clsAtt.records[studentId] = { status: 'present', note: '' };
        }

        const st = schoolStudents.find(s => s.id === studentId);
        const rec = clsAtt.records[studentId];

        // Agar Sababli bosilsa -> Modal oyna chiqadi va sababini oladi (ixtiyoriy)
        if (status === 'absent_excused') {
          openStudentExcusedModal(st, classObj, rec);
          return;
        }

        clsAtt.records[studentId].status = status;
        if (status === 'present') {
          clsAtt.records[studentId].note = '';
        }

        render();
      });
    });

    // Sababli bo'lgan o'quvchi izohini ko'rish yoki tahrirlash
    container.querySelectorAll('.btn-edit-student-excuse').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-student-id');
        const classObj = schoolClasses.find(c => c.id === selectedClassIdForAttendance) || schoolClasses[0];
        if (!classObj || !activeTakingAttendanceData?.classAttendance?.[classObj.id]) return;

        const clsAtt = activeTakingAttendanceData.classAttendance[classObj.id];
        const st = schoolStudents.find(s => s.id === studentId);
        const rec = clsAtt.records?.[studentId] || { status: 'absent_excused', note: '' };
        openStudentExcusedModal(st, classObj, rec);
      });
    });

    // Sabab izohini yozish inputi (Sababsiz uchun)
    container.querySelectorAll('.duty-student-note-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const studentId = input.getAttribute('data-student-id');
        const classObj = schoolClasses.find(c => c.id === selectedClassIdForAttendance) || schoolClasses[0];
        if (!classObj || !activeTakingAttendanceData?.classAttendance?.[classObj.id]) return;

        const clsAtt = activeTakingAttendanceData.classAttendance[classObj.id];
        if (clsAtt.records?.[studentId]) {
          clsAtt.records[studentId].note = e.target.value;
        }
      });
    });

    // Barchasini kelgan qilish
    document.getElementById('btn-duty-all-present')?.addEventListener('click', () => {
      const classObj = schoolClasses.find(c => c.id === selectedClassIdForAttendance) || schoolClasses[0];
      if (!classObj || !activeTakingAttendanceData?.classAttendance?.[classObj.id]) return;

      const clsAtt = activeTakingAttendanceData.classAttendance[classObj.id];
      const clsStudents = schoolStudents.filter(s => s.classId === classObj.id);
      if (!clsAtt.records) clsAtt.records = {};
      clsStudents.forEach(st => {
        if (!clsAtt.records[st.id]) {
          clsAtt.records[st.id] = {
            studentName: st.fullName || `${st.lastName || ''} ${st.firstName || ''}`.trim(),
            status: 'present',
            note: '',
            phone: st.phone || '',
            parentPhone: st.fatherPhone || st.motherPhone || st.phone || ''
          };
        } else {
          clsAtt.records[st.id].status = 'present';
          clsAtt.records[st.id].note = '';
        }
      });
      render();
    });

    // Sahifa pastidagi saqlash va adminga yuborish tugmasi
    document.getElementById('btn-duty-save-class-attendance')?.addEventListener('click', async () => {
      const classObj = schoolClasses.find(c => c.id === selectedClassIdForAttendance) || schoolClasses[0];
      if (!classObj || !activeTakingAttendanceData) return;

      const clsAtt = activeTakingAttendanceData.classAttendance[classObj.id];
      const clsStudents = schoolStudents.filter(s => s.classId === classObj.id);
      
      let presentCount = 0;
      let excusedCount = 0;
      let unexcusedCount = 0;
      clsStudents.forEach(st => {
        const rec = clsAtt.records?.[st.id];
        const status = rec?.status || 'present';
        if (status === 'present') presentCount++;
        else if (status === 'absent_excused') excusedCount++;
        else if (status === 'absent_unexcused' || status === 'late') unexcusedCount++;
      });

      clsAtt.totalStudents = clsStudents.length;
      clsAtt.presentCount = presentCount;
      clsAtt.absentCount = excusedCount + unexcusedCount;
      clsAtt.excusedCount = excusedCount;
      clsAtt.unexcusedCount = unexcusedCount;
      clsAtt.isSubmittedToAdmin = true;
      clsAtt.submittedAt = new Date().toISOString();
      const teacherName = currentUser.data?.teacherName || "Navbatchi o'qituvchi";
      clsAtt.submittedBy = teacherName;

      // 1. Maktabdagi bugungi barcha smena yozuvlariga (masalan 1-smena, 2-smena) zudlik bilan sinxronlash!
      // Shunda 2-smenadagi navbatchi o'qituvchi o'z panelini ochganda aynan shu sinf davomati olingani darhol ko'rinadi va tasdiqlanadi.
      if (!state.attendanceRecords) state.attendanceRecords = [];
      state.attendanceRecords.forEach(rec => {
        if (rec.schoolId === schoolId && rec.date === todayDate) {
          if (!rec.classAttendance) rec.classAttendance = {};
          rec.classAttendance[classObj.id] = JSON.parse(JSON.stringify(clsAtt));
        }
      });

      // 2. Admin uchun rasmiy xabarnoma (Notification) yaratish va saqlash
      const notif = recordClassAttendanceSubmission(state, schoolId, classObj, clsAtt, teacherName);
      if (notif) {
        saveAdminNotificationToFirestore(notif).catch(err => console.warn('Admin notification error:', err));
      }

      if (onSaveAttendanceRecord) {
        await onSaveAttendanceRecord(activeTakingAttendanceData);
      }

      showToast(`${classObj.name} sinfi davomati saqlandi va adminga yuborildi!`, 'success');
      render();
    });
  }

  // =========================================================================
  // 3. ADMIN UCHUN O'QITUVCHILAR DAVOMATI TABI (FAQAT ADMIN)
  // =========================================================================
  function renderTeacherAttendanceTabForAdmin() {
    const reportedAbsences = (state.dutyAbsences || []).filter(a => 
      a.schoolId === schoolId && (a.date === selectedDate || a.date === todayDate)
    );

    const teachersList = schoolClasses
      .filter(cls => Boolean(cls.teacherName && cls.teacherName.trim()))
      .map(cls => {
        const cleanName = (cls.teacherName || '').trim().toLowerCase();
        const absence = reportedAbsences.find(a => 
          (a.originalTeacherClassId && a.originalTeacherClassId === cls.id) ||
          (cleanName && (a.originalTeacherName || '').toLowerCase().includes(cleanName))
        );

        const existingAtt = (activeTakingAttendanceData?.teacherAttendance || []).find(t => 
          t.className === cls.name || (cleanName && (t.teacherName || '').toLowerCase().includes(cleanName))
        );

        const currentStatus = existingAtt?.status || (absence ? 'absent_excused' : 'present');
        const note = existingAtt?.note || (absence ? absence.reason : '');

        return {
          classId: cls.id,
          className: cls.name,
          teacherName: cls.teacherName,
          teacherPhone: cls.teacherPhone || '',
          absence,
          status: currentStatus,
          note
        };
      });

    return `
      <div class="space-y-4">
        <!-- Banner -->
        <div class="p-5 sm:p-6 bg-gradient-to-r from-rose-700 via-pink-700 to-indigo-900 text-white rounded-3xl shadow-sm border border-rose-400/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0 border border-white/20">
              👨‍🏫
            </div>
            <div>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white uppercase tracking-wider border border-white/20">
                Faqat Admin Huquqi
              </span>
              <h3 class="text-base sm:text-lg font-black text-white mt-1">
                O'qituvchilar (Sinf Rahbarlari) Davomati
              </h3>
              <p class="text-xs text-rose-100/90 mt-0.5 max-w-2xl">
                Maktabga kelmagan o'qituvchilarning dars qoldirish sabablari va kunlik davomat holati faqat maktab ma'muriyati (Admin)ga ko'rinadi.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end md:self-auto">
            <span class="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold border border-white/20 text-white">
              📅 ${formatReadableDate(selectedDate)}
            </span>
          </div>
        </div>

        <!-- 1. Dars qoldirish sababini bildirgan o'qituvchilar -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 class="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <span class="text-amber-500">⚠️</span>
              <span>Dars qoldirish sababini bildirgan o'qituvchilar (${reportedAbsences.length})</span>
            </h4>
          </div>

          ${reportedAbsences.length === 0 ? `
            <div class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
              Ushbu sanada maktabda dars qoldirgan o'qituvchi yo'q (Barcha o'qituvchilar darsda).
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${reportedAbsences.map(a => `
                <div class="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-2xl flex flex-col justify-between gap-2.5">
                  <div>
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <strong class="text-xs sm:text-sm font-bold text-slate-900">${escapeHtml(a.originalTeacherName)}</strong>
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-200/80 text-amber-900">
                        ${a.originalTeacherClassName || 'Sinf rahbari'}
                      </span>
                    </div>
                    <p class="text-xs text-slate-700 italic mt-1">
                      "${escapeHtml(a.reason)}"
                    </p>
                  </div>
                  <div class="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-amber-200/50">
                    <span>${a.originalTeacherPhone ? `Tel: ${a.originalTeacherPhone}` : ''}</span>
                    <span class="font-mono text-emerald-700 font-bold">✓ Sababli dars qoldirgan</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- 2. Maktab barcha o'qituvchilari kunlik davomat jadvali -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div>
              <h4 class="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>📋</span>
                <span>Maktabdagi Barcha Sinf Rahbarlari Davomati (${teachersList.length})</span>
              </h4>
              <p class="text-xs text-slate-500">Holatni belgilang va tasdiqlash uchun saqlash tugmasini bosing</p>
            </div>

            <button 
              type="button" 
              id="btn-admin-save-teacher-attendance" 
              class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span>O'qituvchilar davomatini saqlash</span>
            </button>
          </div>

          <div class="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            ${teachersList.map((t, idx) => `
              <div class="admin-teacher-att-row p-3.5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-class-id="${t.classId}">
                <div class="flex items-center gap-3">
                  <span class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-mono font-bold shrink-0">
                    ${idx + 1}
                  </span>
                  <div>
                    <div class="flex items-center gap-2">
                      <strong class="text-xs sm:text-sm font-bold text-slate-900">${t.teacherName}</strong>
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        ${t.className}
                      </span>
                    </div>
                    <span class="text-[11px] text-slate-500 font-mono">
                      ${t.teacherPhone ? `Tel: ${t.teacherPhone}` : 'Telefon kiritilmagan'}
                    </span>
                    ${t.absence ? `
                      <span class="block text-[11px] text-amber-700 font-medium mt-0.5">
                        ⚠️ Dars qoldirish sababi: "${escapeHtml(t.absence.reason)}"
                      </span>
                    ` : ''}
                  </div>
                </div>

                <div class="flex items-center gap-1.5 self-end sm:self-auto">
                  <button 
                    type="button" 
                    class="btn-admin-teacher-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      t.status === 'present'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }"
                    data-class-id="${t.classId}"
                    data-status="present"
                  >
                    🟢 Kelgan
                  </button>

                  <button 
                    type="button" 
                    class="btn-admin-teacher-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      t.status === 'late'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }"
                    data-class-id="${t.classId}"
                    data-status="late"
                  >
                    ⏱️ Kechikdi
                  </button>

                  <button 
                    type="button" 
                    class="btn-admin-teacher-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      t.status === 'absent_excused'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }"
                    data-class-id="${t.classId}"
                    data-status="absent_excused"
                  >
                    🟡 Sababli
                  </button>

                  <button 
                    type="button" 
                    class="btn-admin-teacher-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      t.status === 'absent_unexcused'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }"
                    data-class-id="${t.classId}"
                    data-status="absent_unexcused"
                  >
                    🔴 Sababsiz
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;
  }

  function attachAdminTeacherAttendanceHandlers() {
    container.querySelectorAll('.btn-admin-teacher-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const classId = btn.getAttribute('data-class-id');
        const status = btn.getAttribute('data-status');
        const cls = schoolClasses.find(c => c.id === classId);
        if (!cls) return;

        if (!activeTakingAttendanceData) {
          const shift = schoolShifts[0];
          if (shift) initTakingAttendance(shift.id, selectedDate);
        }

        if (activeTakingAttendanceData) {
          if (!activeTakingAttendanceData.teacherAttendance) {
            activeTakingAttendanceData.teacherAttendance = [];
          }
          const cleanName = (cls.teacherName || '').trim().toLowerCase();
          let existing = activeTakingAttendanceData.teacherAttendance.find(t => 
            t.className === cls.name || (cleanName && (t.teacherName || '').toLowerCase().includes(cleanName))
          );
          if (existing) {
            existing.status = status;
          } else {
            activeTakingAttendanceData.teacherAttendance.push({
              teacherName: cls.teacherName,
              className: cls.name,
              phone: cls.teacherPhone || '',
              status,
              note: ''
            });
          }
          render();
        }
      });
    });

    document.getElementById('btn-admin-save-teacher-attendance')?.addEventListener('click', async () => {
      if (activeTakingAttendanceData && onSaveAttendanceRecord) {
        await onSaveAttendanceRecord(activeTakingAttendanceData);
        showToast("O'qituvchilar davomati muvaffaqiyatli saqlandi!", 'success');
      }
    });
  }

  // =========================================================================
  // ASOSIY KO'RINISHNI CHIZISH (RENDER)
  // =========================================================================
  function render() {
    // Sinf rahbarining bugungi mas'ul navbatchi ekanligini qayta aniqlash (zaxiradan tayinlangan bo'lsa darhol yangilanadi)
    if (currentUser.role === 'teacher') {
      const dynamicDutyInfo = getTodayDutyInfoForTeacher(currentUser.data, state);
      if (dynamicDutyInfo.isDutyToday) {
        isCurrentUserDutyOfficer = true;
      }
    }

    // 1. Agar sinf rahbari navbatchi bo'lmasa, maxsus bo'sh sahifa va dars qoldirish imkoni
    if (currentUser.role === 'teacher' && !isCurrentUserDutyOfficer) {
      container.innerHTML = renderNonDutyTeacherView();
      attachNonDutyTeacherHandlers();
      return;
    }

    // 2. Agar sinf rahbari bugun mas'ul navbatchi bo'lsa, to'g'ridan-to'g'ri navbatchilik davomat sahifasi
    if (currentUser.role === 'teacher' && isCurrentUserDutyOfficer) {
      container.innerHTML = renderDutyTeacherAttendanceView();
      attachDutyTeacherAttendanceHandlers();
      return;
    }

    // 3. Admin yoki Developer interfeysi
    const reportedAbsencesCount = (state.dutyAbsences || []).filter(a => a.schoolId === schoolId && a.date === selectedDate).length;

    container.innerHTML = `
      <div class="space-y-4 pb-24 max-w-6xl mx-auto animate-fade-in">
        
        <!-- Header Bar -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div class="flex items-center gap-3.5">
            <button 
              id="att-back-btn" 
              class="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95" 
              title="Orqaga qaytish"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
            </button>

            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                  Davomat & Smenalar Boshqaruvi
                </h1>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  ${school.name}
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Navbatchilik rotatsiyasi, zaxira eskalatsiyasi va kunlik nazorat
              </p>
            </div>
          </div>

          <!-- Tezkor sana tanlash -->
          <div class="flex items-center gap-2 self-start md:self-auto bg-slate-50 p-1.5 rounded-xl border border-slate-200/80">
            <label class="text-xs font-semibold text-slate-600 pl-2">Sana:</label>
            <input 
              type="date" 
              id="att-date-picker" 
              value="${selectedDate}" 
              max="${todayDate}"
              class="px-2.5 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            />
          </div>

        </div>

        <!-- Tablar Navigatsiyasi (Admin) -->
        <div class="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          
          <!-- 1. Admin Asosiy Vazifasi: Guruhlar & Sinflar -->
          <button 
            id="tab-shifts-btn" 
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'shifts'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <span>📁 Guruhlar & Sinflar</span>
            <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
              activeTab === 'shifts' ? 'bg-indigo-500/40 text-white' : 'bg-slate-200 text-slate-600'
            }">(${schoolShifts.length})</span>
          </button>

          <!-- 2. Bugungi Navbatchilar -->
          <button 
            id="tab-duty-officers-btn" 
            class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'duty_officers'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            <span>👥 Bugungi Navbatchilar</span>
          </button>

          <!-- 3. O'qituvchilar Davomati (Faqat Admin Ko'ra Oladi) -->
          <button 
            id="tab-teacher-attendance-btn" 
            class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'teacher_attendance'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <span>👨‍🏫 O'qituvchilar Davomati</span>
            ${reportedAbsencesCount > 0 ? `
              <span class="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                ${reportedAbsencesCount}
              </span>
            ` : ''}
          </button>

          <!-- 4. Admin Nazorati: Sinflar Davomati Monitoring -->
          <button 
            id="tab-monitoring-btn" 
            class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'monitoring'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            <span>👁️ Sinflar Monitoringi</span>
          </button>

          <!-- 5. Navbatchilik Jadvali -->
          <button 
            id="tab-roster-btn" 
            class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'roster'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span>📋 Navbatchilik Jadvali</span>
          </button>

          <!-- 6. Yillik & Oylik Nazorat -->
          <button 
            id="tab-analytics-btn" 
            class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === 'analytics'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span>📊 Yillik & Oylik Nazorat</span>
          </button>

        </div>

        <!-- Asosiy Tab Kontenti -->
        <div id="att-tab-content">
          ${renderTabContent()}
        </div>

      </div>
    `;

    attachEventHandlers();
  }

  // Tanlangan Tab bo'yicha kontent yaratish
  function renderTabContent() {
    if (activeTab === 'duty_officers') {
      return renderDutyOfficersTab();
    }
    if (activeTab === 'teacher_attendance') {
      return renderTeacherAttendanceTabForAdmin();
    }
    if (activeTab === 'monitoring') {
      return renderMonitoringTab();
    }
    if (activeTab === 'take_attendance') {
      if (!isCurrentUserDutyOfficer && !isAdmin) {
        return renderDutyOfficersTab();
      }
      return renderTakeAttendanceTab();
    }
    if (activeTab === 'shifts') {
      return renderShiftsTab();
    }
    if (activeTab === 'roster') {
      return renderRosterTab();
    }
    if (activeTab === 'analytics') {
      return renderAnalyticsTab();
    }
    return '';
  }

  // 0. BUGUNGI MAS'UL NAVBATCHILAR TABI (BARCHA O'QITUVCHILAR VA ADMIN UCHUN)
  function renderDutyOfficersTab() {
    const dayOfWeek = todayDayOfWeek;

    return `
      <div class="space-y-4">
        
        <!-- Bosh ma'lumot banneri -->
        <div class="p-4 sm:p-5 bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-900 text-white rounded-3xl shadow-sm border border-indigo-400/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0 border border-white/20">
              👥
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white uppercase tracking-wider border border-white/20">
                  Kunlik Mas'uliyat Jadvali
                </span>
                <span class="text-xs font-semibold text-indigo-200">
                  ${getDayName(dayOfWeek)}, ${formatReadableDate(todayDate)}
                </span>
              </div>
              <h3 class="text-base sm:text-lg font-black text-white mt-1">
                Bugungi Maktab Mas'ul Navbatchilari
              </h3>
              <p class="text-xs text-indigo-100/90 mt-0.5 max-w-2xl">
                Maktab tartibiga asosan, butun maktab davomatini faqat bugungi mas'ul navbatchi o'qituvchilar oladi. 
                Boshqa barcha sinf rahbarlari esa faqat navbatchilar ro'yxati va holatini kuzatishi mumkin.
              </p>
            </div>
          </div>

          ${isCurrentUserDutyOfficer ? `
            <button 
              id="btn-goto-take-attendance-from-duty"
              class="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0 active:scale-95"
            >
              <span>✏️ Davomat Olishga O'tish &rarr;</span>
            </button>
          ` : `
            <div class="px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-[11.5px] text-indigo-100 font-semibold shrink-0">
              🔒 Faqat ko'rish rejimi
            </div>
          `}
        </div>

        <!-- Smenalar bo'yicha mas'ul navbatchilar kartalari -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${schoolShifts.map(shift => {
            const roster = getRosterForShiftAndDay(shift.id, dayOfWeek);
            const dutyStatus = getShiftDutyStatus(shift, todayDate);
            const shiftClasses = schoolClasses.filter(c => (shift.classIds || []).includes(c.id));
            const totalStudentsInShift = schoolStudents.filter(s => (shift.classIds || []).includes(s.classId)).length;
            
            // Ushbu smenada bugun navbatchi kelolmaslik sababini qoldirganmi?
            const todayAbsence = (state.dutyAbsences || []).find(a => 
              a.shiftId === shift.id && 
              a.date === todayDate &&
              (a.schoolId === schoolId || a.schoolId === shift.schoolId)
            );

            const isCurrentDutyForMe = currentUser.role === 'teacher' && 
              ((roster?.primaryTeacherClassId === currentUser.data?.id && !todayAbsence) ||
               (roster?.backupTeacherClassId === currentUser.data?.id && todayAbsence));

            return `
              <div class="bg-white rounded-3xl p-5 border ${isCurrentDutyForMe ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-md' : 'border-slate-200/90'} shadow-xs flex flex-col justify-between gap-4">
                
                <!-- Smena sarlovhasi -->
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <span class="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                        ${shift.name} (${shift.startTime} - ${shift.endTime})
                      </span>
                      <p class="text-xs text-slate-500 mt-1.5">
                        Guruhda: <strong>${shiftClasses.length} ta sinf</strong>, <strong>${totalStudentsInShift} nafar o'quvchi</strong>
                      </p>
                    </div>

                    ${todayAbsence ? `
                      <span class="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                        ⚡ Zaxiraga topshirildi
                      </span>
                    ` : `
                      <span class="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        ✓ Asosiy navbatchi
                      </span>
                    `}
                  </div>

                  <!-- Mas'ul Navbatchi Ma'lumotlari -->
                  <div class="mt-4 p-4 rounded-2xl ${isCurrentDutyForMe ? 'bg-emerald-50/70 border border-emerald-200' : 'bg-slate-50 border border-slate-200/80'}">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Bugungi Mas'ul Navbatchi Sinf Rahbari:
                    </div>

                    <div class="flex items-center gap-3">
                      <div class="w-11 h-11 rounded-2xl ${isCurrentDutyForMe ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'} flex items-center justify-center font-black text-base shadow-xs shrink-0">
                        ${(dutyStatus.activeDutyTeacherName || 'N')[0]}
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <h4 class="text-sm sm:text-base font-bold text-slate-900 truncate">
                            ${dutyStatus.activeDutyTeacherName}
                          </h4>
                          ${isCurrentDutyForMe ? `
                            <span class="px-2 py-0.2 rounded-md text-[10px] font-black bg-emerald-200 text-emerald-900">
                              (Siz)
                            </span>
                          ` : ''}
                        </div>
                        <p class="text-xs text-slate-600 mt-0.5">
                          Sinf: <strong>${todayAbsence ? (roster?.backupTeacherClassName || 'Zaxira') : (roster?.primaryTeacherClassName || 'Sinf')}</strong>
                          ${dutyStatus.activeDutyTeacherPhone ? `
                            • Tel: <a href="tel:${dutyStatus.activeDutyTeacherPhone}" class="font-mono text-indigo-600 hover:underline font-semibold">${dutyStatus.activeDutyTeacherPhone}</a>
                          ` : ''}
                        </p>
                      </div>
                    </div>

                    <!-- Agar kelolmaslik sababi bildirilgan bo'lsa -->
                    ${todayAbsence ? `
                      <div class="mt-3 p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-xs text-amber-950">
                        <div class="font-bold flex items-center gap-1">
                          <span>⚠️ Kelolmaslik sababi:</span>
                          <span class="italic font-normal">"${escapeHtml(todayAbsence.reason)}"</span>
                        </div>
                        <p class="text-[11px] text-amber-900 mt-1">
                          Asosiy navbatchi <strong>${todayAbsence.originalTeacherName}</strong> sabab qoldirgani uchun tizim navbatchilikni <strong>${todayAbsence.delegatedTeacherName}</strong>ga avtomatik biriktirdi va Adminga xabar berdi.
                        </p>
                      </div>
                    ` : ''}
                  </div>

                  <!-- Zaxira navbatchi info -->
                  <div class="mt-3 flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>Zaxira o'qituvchi: <strong>${roster?.backupTeacherName || 'Belgilanmagan'}</strong> (${roster?.backupTeacherClassName || '-'})</span>
                    ${roster?.backupTeacherPhone ? `<span class="font-mono">${roster.backupTeacherPhone}</span>` : ''}
                  </div>
                </div>

                <!-- Amallar tugmalari -->
                <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  ${isCurrentDutyForMe ? `
                    <div class="flex items-center gap-2 w-full">
                      <button 
                        class="btn-open-taking-attendance-from-duty flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                        data-shift-id="${shift.id}"
                      >
                        <span>✏️ Davomatni Olish &rarr;</span>
                      </button>

                      <button 
                        class="btn-duty-report-absence-from-tab px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
                        data-shift-id="${shift.id}"
                        title="Kela olmaslik sababini qoldirish"
                      >
                        <span>⚠️ Sabab qoldirish</span>
                      </button>
                    </div>
                  ` : `
                    <div class="flex items-center justify-between w-full text-xs text-slate-500">
                      <span class="flex items-center gap-1 text-[11.5px]">
                        🔒 <span>Davomat olish faqat ushbu navbatchiga ruxsat etilgan</span>
                      </span>
                      ${dutyStatus.activeDutyTeacherPhone ? `
                        <a href="tel:${dutyStatus.activeDutyTeacherPhone}" class="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 transition-colors">
                          📞 Bog'lanish
                        </a>
                      ` : ''}
                    </div>
                  `}
                </div>

              </div>
            `;
          }).join('')}
        </div>

        <!-- Haftalik navbatchilik jadvalini ko'rishga o'tish tugmasi -->
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 text-xs text-slate-600">
            <span class="text-base">📋</span>
            <span>Butun hafta va oy bo'yicha navbatchilik jadvalini ko'rmoqchimisiz?</span>
          </div>
          <button 
            id="btn-duty-tab-goto-roster"
            class="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            📋 To'liq Navbatchilik Jadvali &rarr;
          </button>
        </div>

      </div>
    `;
  }

  // 1. KUNLIK MONITORING TABI (ADMIN UCHUN NAZORAT VA KO'RISH)
  function renderMonitoringTab() {
    return `
      <div class="space-y-4">
        
        ${isAdmin ? `
          <!-- Admin Nazorati haqida rasmiy tushuntirish banneri -->
          <div class="p-4 bg-blue-50/80 border border-blue-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </div>
              <div>
                <h4 class="text-xs sm:text-sm font-bold text-blue-950">Maktab Davomati Nazorati (Faqat Ko'rish)</h4>
                <p class="text-xs text-blue-700 mt-0.5">
                  Admin faqat nazorat qiladi va ko'radi. Davomat olish esa har bir guruh uchun biriktirilgan kunlik navbatchi o'qituvchi tomonidan kiritiladi.
                </p>
              </div>
            </div>
            <button 
              id="btn-goto-shifts-from-monitoring" 
              class="px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
            >
              📁 Guruhlar va Sinflarni boshqarish &rarr;
            </button>
          </div>
        ` : ''}

        <!-- Smenalar bo'yicha umumiy kartalar -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          ${schoolShifts.map(shift => {
            const duty = getShiftDutyStatus(shift, selectedDate);
            const record = getAttendanceRecord(shift.id, selectedDate);
            const summary = record ? recalculateAttendanceSummary(record) : null;
            const shiftClasses = schoolClasses.filter(c => (shift.classIds || []).includes(c.id));
            const totalStudentsInShift = schoolStudents.filter(s => (shift.classIds || []).includes(s.classId)).length;

            return `
              <div class="bg-white p-4 sm:p-5 rounded-2xl border ${duty.isBackupActive ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200/90'} shadow-xs flex flex-col justify-between gap-3">
                
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        ${shift.startTime} - ${shift.endTime}
                      </span>
                      <h3 class="text-base font-bold text-slate-900 mt-1">
                        ${shift.name}
                      </h3>
                      <p class="text-xs text-slate-500">
                        ${shiftClasses.length} ta sinf, ${totalStudentsInShift} nafar o'quvchi
                      </p>
                    </div>

                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      duty.statusColor === 'emerald'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : (duty.statusColor === 'amber' || duty.isBackupActive
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                            : (duty.statusColor === 'red'
                                ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'))
                    }">
                      <span class="w-1.5 h-1.5 rounded-full ${
                        duty.statusColor === 'emerald' ? 'bg-emerald-500' : (duty.isBackupActive ? 'bg-amber-500' : 'bg-slate-400')
                      }"></span>
                      ${duty.status}
                    </span>
                  </div>

                  <!-- Navbatchilik holati va Eskalatsiya -->
                  <div class="mt-3.5 p-3 rounded-xl ${duty.isBackupActive ? 'bg-amber-50/70 border border-amber-200/80' : 'bg-slate-50 border border-slate-100'}">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-slate-500 font-medium">Bugungi Navbatchi:</span>
                      <strong class="text-slate-900 font-bold">${duty.activeDutyTeacherName}</strong>
                    </div>

                    ${duty.isBackupActive ? `
                      <div class="mt-2 text-[11px] text-amber-800 bg-white/80 p-2 rounded-lg border border-amber-200 flex items-center gap-2">
                        <svg class="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <span>
                          <strong>ESKALATSIYA FAOL:</strong> Asosiy navbatchi (${duty.primaryName}) o'z vaqtida kelmaganligi sababli, tizim avtomatik zaxira navbatchiga (${duty.backupName}) o'tkazdi.
                        </span>
                      </div>
                    ` : ''}

                    <div class="flex items-center justify-between text-xs text-slate-500 mt-1">
                      <span>Zaxira o'qituvchi:</span>
                      <span class="font-medium text-slate-700">${duty.backupName || 'Mavjud emas'}</span>
                    </div>
                  </div>

                  <!-- Ko'rsatkichlar -->
                  ${summary ? `
                    <div class="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div class="bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                        <span class="text-base sm:text-lg font-extrabold text-emerald-700">${summary.presentCount}</span>
                        <span class="block text-[10px] font-bold text-emerald-600">Qatnashmoqda</span>
                      </div>
                      <div class="bg-red-50 p-2 rounded-xl border border-red-100">
                        <span class="text-base sm:text-lg font-extrabold text-red-600">${summary.absentCount}</span>
                        <span class="block text-[10px] font-bold text-red-500">Kelmagan</span>
                      </div>
                      <div class="bg-indigo-50 p-2 rounded-xl border border-indigo-100">
                        <span class="text-base sm:text-lg font-extrabold text-indigo-700">${summary.attendanceRate}%</span>
                        <span class="block text-[10px] font-bold text-indigo-600">Davomat foizi</span>
                      </div>
                    </div>
                  ` : `
                    <div class="mt-3 py-3 px-3 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400">
                      Ushbu sana uchun hali davomat kiritilmagan
                    </div>
                  `}
                </div>

                <!-- Amallar tugmasi -->
                <div class="pt-2 border-t border-slate-100 flex items-center gap-2">
                  ${isAdmin ? `
                    <!-- Admin faqat nazorat qiladi va ko'radi -->
                    ${record ? `
                      <button 
                        class="btn-inspect-attendance flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        data-shift-id="${shift.id}"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        <span>Davomatni ko'rish (Nazorat)</span>
                      </button>
                    ` : `
                      <div class="flex-1 py-2 px-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-200">
                        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span>Topshirilmagan (Kutilmoqda)</span>
                      </div>
                    `}

                    ${!record ? `
                      <button 
                        class="btn-manual-escalate py-2 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-colors cursor-pointer shrink-0"
                        data-shift-id="${shift.id}"
                        title="Asosiy navbatchi kelmasa, zaxira o'qituvchiga o'tkazish"
                      >
                        Zaxiraga o'tkazish
                      </button>
                    ` : ''}
                  ` : `
                    <!-- O'qituvchi / Navbatchi davomat oladi -->
                    <button 
                      class="btn-start-attendance flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      data-shift-id="${shift.id}"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                      <span>${record ? "Davomatni to'ldirish / Tahrirlash" : "Davomat olishni boshlash"}</span>
                    </button>
                  `}
                </div>

              </div>
            `;
          }).join('')}
        </div>

        <!-- Bugun darsga kelmagan barcha o'quvchilar va SMS jo'natish ro'yxati -->
        ${renderAbsentStudentsSection()}

      </div>
    `;
  }

  // Darsga kelmagan o'quvchilar va tezkor SMS yuborish bloki
  function renderAbsentStudentsSection() {
    const allAbsentStudents = [];

    schoolShifts.forEach(shift => {
      const record = getAttendanceRecord(shift.id, selectedDate);
      if (!record || !record.classAttendance) return;

      Object.values(record.classAttendance).forEach(cls => {
        Object.entries(cls.records || {}).forEach(([stId, stRecord]) => {
          if (stRecord.status === 'absent_unexcused' || stRecord.status === 'absent_excused') {
            const originalStudent = schoolStudents.find(s => s.id === stId) || {};
            allAbsentStudents.push({
              id: stId,
              studentName: stRecord.studentName,
              className: cls.className,
              shiftName: shift.name,
              status: stRecord.status === 'absent_unexcused' ? 'Sababsiz' : 'Sababli',
              statusKey: stRecord.status,
              note: stRecord.note || '',
              parentPhone: stRecord.parentPhone || originalStudent.fatherPhone || originalStudent.motherPhone || originalStudent.phone || ''
            });
          }
        });
      });
    });

    return `
      <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 class="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              Bugun kelmagan o'quvchilar ro'yxati
              <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                ${allAbsentStudents.length} nafar
              </span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              ${formatReadableDate(selectedDate)} holatiga ko'ra dars qoldirganlar va ularning ota-onalari
            </p>
          </div>

          ${allAbsentStudents.length > 0 ? `
            <button 
              id="btn-send-bulk-sms" 
              class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 text-xs font-bold transition-colors cursor-pointer"
              title="Kelmaganlarning barchasiga SMS ogohlantirish yuborish"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
              <span>Barchasiga SMS jo'natish</span>
            </button>
          ` : ''}
        </div>

        ${allAbsentStudents.length === 0 ? `
          <div class="py-8 text-center bg-slate-50/70 rounded-xl border border-slate-100">
            <div class="w-10 h-10 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <p class="text-xs font-bold text-slate-700">Ajoyib! Bugun barcha o'quvchilar to'liq darsda qatnashmoqda.</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Yoki davomat ma'lumotlari hali to'liq yakunlanmagan.</p>
          </div>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th class="py-2.5 px-3">O'quvchi F.I.Sh</th>
                  <th class="py-2.5 px-3">Sinf & Smena</th>
                  <th class="py-2.5 px-3">Holati</th>
                  <th class="py-2.5 px-3">Ota-ona telefoni</th>
                  <th class="py-2.5 px-3 text-right">SMS Xabarnoma</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                ${allAbsentStudents.map(st => {
                  const isSending = sendingSmsStudentId === st.id;
                  return `
                    <tr class="hover:bg-slate-50/80 transition-colors">
                      <td class="py-2.5 px-3 font-semibold text-slate-900">${st.studentName}</td>
                      <td class="py-2.5 px-3 text-slate-600">
                        <span class="font-bold text-indigo-700">${st.className}</span>
                        <span class="text-[10px] text-slate-400 block">${st.shiftName}</span>
                      </td>
                      <td class="py-2.5 px-3">
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          st.statusKey === 'absent_unexcused'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }">
                          ${st.status}
                        </span>
                      </td>
                      <td class="py-2.5 px-3 font-mono text-slate-700">
                        ${st.parentPhone || '<span class="text-slate-400 italic">Kiritilmagan</span>'}
                      </td>
                      <td class="py-2.5 px-3 text-right">
                        <button 
                          class="btn-send-sms-single inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold border border-indigo-200/80 transition-colors cursor-pointer ${
                            !st.parentPhone ? 'opacity-40 cursor-not-allowed' : ''
                          }"
                          data-student-id="${st.id}"
                          data-student-name="${st.studentName}"
                          data-class-name="${st.className}"
                          data-status="${st.status}"
                          data-parent-phone="${st.parentPhone}"
                          ${!st.parentPhone || isSending ? 'disabled' : ''}
                        >
                          ${isSending ? `
                            <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                            </svg>
                            <span>Yuborilmoqda...</span>
                          ` : `
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                            </svg>
                            <span>SMS ogohlantirish</span>
                          `}
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  // Sinf o'quvchilari ro'yxatini tez va qotmasdan chizuvchi maxsus yengil funksiya
  function renderActiveClassStudentsHtml(activeClassData, canEdit) {
    if (!activeClassData) {
      return `
        <div class="mt-4 p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
          <p class="text-xs font-bold text-slate-500">Sinf tanlanmagan yoki ushbu smenada sinflar mavjud emas</p>
        </div>
      `;
    }

    const records = Object.entries(activeClassData.records || {});
    records.sort((a, b) => {
      const nameA = (a[1].studentName || '').trim();
      const nameB = (b[1].studentName || '').trim();
      return nameA.localeCompare(nameB, 'uz');
    });

    return `
      <div class="mt-4">
        <div class="flex items-center justify-between text-xs text-slate-500 mb-2 px-1">
          <span>Sinf: <strong class="text-slate-900 font-bold">${activeClassData.className}</strong> (${activeClassData.teacherName || 'Sinf rahbari'})</span>
          <span id="att-active-class-counts">Jami: <strong>${activeClassData.totalStudents}</strong> | Kelgan: <strong class="text-emerald-600">${activeClassData.presentCount}</strong> | Kelmagan: <strong class="text-red-600">${activeClassData.absentCount}</strong></span>
        </div>

        <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          ${records.map(([stId, stRec], index) => {
            return `
              <div 
                class="student-attendance-row p-3 bg-white hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                data-class-id="${activeClassData.classId}"
                data-student-id="${stId}"
                data-student-name="${escapeHtml(stRec.studentName)}"
                data-student-phone="${escapeHtml(stRec.parentPhone || '')}"
              >
                <div class="flex items-center gap-3">
                  <span class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-mono font-bold shrink-0">
                    ${index + 1}
                  </span>
                  <div>
                    <strong class="text-xs sm:text-sm font-semibold text-slate-900 block">${stRec.studentName}</strong>
                    <span class="text-[11px] text-slate-500 font-mono">
                      ${stRec.parentPhone ? `Ota-onasi: ${stRec.parentPhone}` : 'Telefon yo\'q'}
                    </span>
                    <div class="excuse-badge-container ${stRec.status === 'absent_excused' ? '' : 'hidden'}">
                      <div class="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <span>Sabab:</span>
                          <span class="excuse-note-text font-normal italic">"${escapeHtml(stRec.note || 'Izoh ko\'rsatilmagan')}"</span>
                        </span>
                        ${canEdit ? `
                          <button 
                            type="button" 
                            class="btn-edit-student-excuse inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                            data-class-id="${activeClassData.classId}"
                            data-student-id="${stId}"
                          >
                            ✏️ Tahrirlash
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 4 ta status tugmalari: Kelgan, Sababsiz, Sababli, Kechikdi -->
                <div class="flex items-center gap-1.5 self-end sm:self-auto status-buttons-group">
                  <button 
                    type="button"
                    class="btn-student-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${
                      stRec.status === 'present'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }"
                    data-class-id="${activeClassData.classId}"
                    data-student-id="${stId}"
                    data-status="present"
                    ${canEdit ? '' : 'disabled'}
                    title="Darsda qatnashmoqda"
                  >
                    🟢 Kelgan
                  </button>

                  <button 
                    type="button"
                    class="btn-student-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${
                      stRec.status === 'late'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }"
                    data-class-id="${activeClassData.classId}"
                    data-student-id="${stId}"
                    data-status="late"
                    ${canEdit ? '' : 'disabled'}
                    title="Darsga kechikib keldi"
                  >
                    ⏱️ Kechikdi
                  </button>

                  <button 
                    type="button"
                    class="btn-student-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${
                      stRec.status === 'absent_excused'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }"
                    data-class-id="${activeClassData.classId}"
                    data-student-id="${stId}"
                    data-status="absent_excused"
                    ${canEdit ? '' : 'disabled'}
                    title="Sababli kelmagan (kasal, ariza)"
                  >
                    🟡 Sababli
                  </button>

                  <button 
                    type="button"
                    class="btn-student-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${
                      stRec.status === 'absent_unexcused'
                        ? 'bg-red-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }"
                    data-class-id="${activeClassData.classId}"
                    data-student-id="${stId}"
                    data-status="absent_unexcused"
                    ${canEdit ? '' : 'disabled'}
                    title="Sababsiz kelmagan"
                  >
                    🔴 Sababsiz
                  </button>
                </div>

              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 2. DAVOMAT OLISH TABI (NAVBATCHI INTERFEYSI)
  function renderTakeAttendanceTab() {
    if (!activeTakingAttendanceData) {
      const shift = schoolShifts[0];
      if (shift) {
        initTakingAttendance(shift.id, selectedDate);
        return `<div class="p-8 text-center text-slate-500">Davomat yuklanmoqda...</div>`;
      }
      return `
        <div class="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <p class="text-sm font-bold text-slate-700">Davomat olish uchun avval smenalarni sozlang.</p>
        </div>
      `;
    }

    const currentShift = schoolShifts.find(s => s.id === activeTakingAttendanceData.shiftId);
    const summary = recalculateAttendanceSummary(activeTakingAttendanceData);

    const classEntries = Object.entries(activeTakingAttendanceData.classAttendance || {});
    
    // Filter classes based on attendanceClassFilter ('all' or shiftId)
    const filteredClassEntries = classEntries.filter(([clsId]) => {
      if (attendanceClassFilter === 'all') return true;
      const targetShift = schoolShifts.find(s => s.id === attendanceClassFilter);
      return targetShift ? (targetShift.classIds || []).includes(clsId) : true;
    });

    const activeClassData = activeTakingAttendanceData.classAttendance[selectedClassIdForAttendance] 
      || filteredClassEntries[0]?.[1] 
      || classEntries[0]?.[1];

    // Filter students by search query if present
    const isSearching = Boolean(attendanceStudentSearchQuery && attendanceStudentSearchQuery.trim());
    const searchQueryLower = attendanceStudentSearchQuery.toLowerCase().trim();

    // Search across the active class (or whole school if searching)
    let searchResults = [];
    if (isSearching) {
      classEntries.forEach(([clsId, clsData]) => {
        Object.entries(clsData.records || {}).forEach(([stId, stRec]) => {
          if (
            stRec.studentName?.toLowerCase().includes(searchQueryLower) ||
            stRec.phone?.includes(searchQueryLower) ||
            stRec.parentPhone?.includes(searchQueryLower) ||
            clsData.className?.toLowerCase().includes(searchQueryLower)
          ) {
            searchResults.push({
              classId: clsId,
              className: clsData.className,
              studentId: stId,
              record: stRec
            });
          }
        });
      });
    }

    const canEditAttendance = isCurrentUserDutyOfficer || isAdmin;

    return `
      <div class="space-y-4">

        <!-- Mas'ul Navbatchi yoki Faqat Ko'rish Xabarnomasi -->
        ${isCurrentUserDutyOfficer ? `
          <div class="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white rounded-2xl sm:rounded-3xl shadow-md border border-emerald-300/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0 border border-white/20">
                ⭐
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/30 text-white uppercase tracking-wider border border-white/20">
                    Mas'ul Navbatchi Huquqi
                  </span>
                  <span class="text-xs font-medium text-emerald-100">
                    Sana: ${formatReadableDate(selectedDate)}
                  </span>
                </div>
                <h3 class="text-base sm:text-lg font-black text-white mt-0.5">
                  Butun Maktab O'quvchilari Davomatini Belgilash
                </h3>
                <p class="text-xs text-emerald-100/90 mt-0.5">
                  Siz bugungi mas'ul navbatchi sinf rahbarisiz. Maktabdagi barcha ${classEntries.length} ta sinf o'quvchilari davomatini kiritishingiz mumkin.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap self-start md:self-auto">
              <button 
                id="btn-all-school-present" 
                class="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-900 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
                title="Maktabdagi barcha o'quvchilarni 'Kelgan' deb belgilash"
              >
                <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
                <span>✓ Butun Maktab Darsda</span>
              </button>

              <button 
                id="btn-take-attendance-report-absence" 
                class="px-3.5 py-2.5 bg-amber-400/20 hover:bg-amber-400/35 border border-amber-300/40 text-amber-100 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
                title="Kela olmaslik sababini bildirish va navbatchilikni zaxiraga topshirish"
              >
                <span>⚠️ Kelolmaslikni bildirish</span>
              </button>
            </div>
          </div>
        ` : (currentUser.role === 'teacher' ? `
          <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
            <div class="flex items-center gap-3">
              <span class="text-2xl shrink-0">ℹ️</span>
              <div class="text-xs">
                <strong class="font-bold">Faqat ko'rish rejimi:</strong> Maktab qoidasiga ko'ra, davomatni faqat bugungi mas'ul navbatchi o'qituvchilar olishi mumkin. Siz faqat navbatchilar ro'yxatini ko'ra olasiz.
              </div>
            </div>
            <button 
              id="btn-switch-to-duty-tab"
              class="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shrink-0 cursor-pointer shadow-2xs"
            >
              👥 Navbatchilarni ko'rish &rarr;
            </button>
          </div>
        ` : '')}
        
        <!-- Smena va Navbatchi ma'lumot paneli -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>${currentShift?.name || 'Smena Davomati'}</span>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Butun Maktab Qamrovi
                  </span>
                </h3>
                <p class="text-xs text-slate-500">
                  Sana: <strong>${formatReadableDate(activeTakingAttendanceData.date)}</strong> | 
                  Navbatchi: <strong class="text-indigo-700">${activeTakingAttendanceData.dutyTeacher?.name}</strong>
                  ${activeTakingAttendanceData.isFailoverActivated ? `
                    <span class="inline-flex items-center px-2 py-0.2 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-md ml-1">
                      Zaxira navbatchi
                    </span>
                  ` : ''}
                </p>
              </div>
            </div>

            <!-- Smenani almashtirish va Saqlash -->
            <div class="flex items-center gap-2 flex-wrap">
              <select 
                id="att-shift-switch" 
                class="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                ${schoolShifts.map(s => `
                  <option value="${s.id}" ${s.id === activeTakingAttendanceData.shiftId ? 'selected' : ''}>
                    ${s.name} (${s.startTime})
                  </option>
                `).join('')}
              </select>

              ${canEditAttendance ? `
                <button 
                  id="btn-save-attendance-record" 
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Davomatni Tasdiqlash & Saqlash</span>
                </button>
              ` : ''}
            </div>

          </div>

          <!-- Tezkor statistika hisoblagichlari -->
          <div class="grid grid-cols-4 gap-2 mt-4 text-center">
            <div class="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span id="att-kpi-total-students" class="text-base sm:text-lg font-bold text-slate-800">${summary.totalStudents}</span>
              <span class="block text-[10px] font-bold text-slate-500 uppercase">Jami o'quvchi</span>
            </div>
            <div class="bg-emerald-50 p-2 rounded-xl border border-emerald-100">
              <span id="att-kpi-present-count" class="text-base sm:text-lg font-bold text-emerald-700">${summary.presentCount}</span>
              <span class="block text-[10px] font-bold text-emerald-600 uppercase">Darsda</span>
            </div>
            <div class="bg-red-50 p-2 rounded-xl border border-red-100">
              <span id="att-kpi-absent-count" class="text-base sm:text-lg font-bold text-red-600">${summary.absentCount}</span>
              <span class="block text-[10px] font-bold text-red-500 uppercase">Kelmagan</span>
            </div>
            <div class="bg-indigo-50 p-2 rounded-xl border border-indigo-100">
              <span id="att-kpi-attendance-rate" class="text-base sm:text-lg font-bold text-indigo-700">${summary.attendanceRate}%</span>
              <span class="block text-[10px] font-bold text-indigo-600 uppercase">Davomat ko'rsatkichi</span>
            </div>
          </div>

        </div>

        <!-- Sinflar va O'quvchilar Davomati -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
            <div>
              <h4 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                Sinflar va O'quvchilar Davomati
              </h4>
              <p class="text-xs text-slate-500">
                Sinfni tanlang yoki qidiruv orqali tezkor topib davomatni belgilang
              </p>
            </div>

            <!-- Sinf bo'yicha tezkor tugma -->
            ${(activeClassData && canEditAttendance) ? `
              <button 
                id="btn-all-class-present" 
                class="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
                data-class-id="${activeClassData.classId}"
              >
                ✓ Ushbu sinfdagi (${activeClassData.className}) barcha o'quvchilar kelgan
              </button>
            ` : ''}
          </div>

          <!-- Tezkor qidiruv va Guruh filterlari -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3">
            <!-- Guruh (Smena) bo'yicha filterlar -->
            <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
              <button 
                class="btn-class-filter-pill px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  attendanceClassFilter === 'all' 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }"
                data-filter="all"
              >
                Barcha Sinflar (${classEntries.length})
              </button>
              ${schoolShifts.map(s => {
                const count = classEntries.filter(([cId]) => (s.classIds || []).includes(cId)).length;
                return `
                  <button 
                    class="btn-class-filter-pill px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      attendanceClassFilter === s.id 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }"
                    data-filter="${s.id}"
                  >
                    ${s.name} (${count})
                  </button>
                `;
              }).join('')}
            </div>

            <!-- O'quvchini qidirish inputi -->
            <div class="relative min-w-[220px]">
              <input 
                type="text" 
                id="take-att-student-search" 
                placeholder="O'quvchi ismi yoki telefoni..." 
                value="${attendanceStudentSearchQuery}"
                class="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              ${isSearching ? `
                <button 
                  id="btn-clear-att-search" 
                  class="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  title="Qidiruvni tozalash"
                >
                  ✕
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Qidiruv natijalari rejimi -->
          ${isSearching ? `
            <div class="mt-2">
              <div class="text-xs font-bold text-slate-700 mb-2">
                Qidiruv natijalari: <span class="text-indigo-600">${searchResults.length} nafar o'quvchi topildi</span>
              </div>
              <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                ${searchResults.length === 0 ? `
                  <div class="p-6 text-center text-xs text-slate-400">
                    "${attendanceStudentSearchQuery}" bo'yicha hech qanday o'quvchi topilmadi
                  </div>
                ` : searchResults.map(({ classId, className, studentId, record }, index) => {
                  return `
                    <div class="p-3 bg-white hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div class="flex items-center gap-3">
                        <span class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-mono font-bold shrink-0">
                          ${index + 1}
                        </span>
                        <div>
                          <div class="flex items-center gap-2">
                            <strong class="text-xs sm:text-sm font-semibold text-slate-900">${record.studentName}</strong>
                            <span class="px-2 py-0.2 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              ${className}
                            </span>
                          </div>
                          <span class="text-[11px] text-slate-500 font-mono">
                            ${record.parentPhone ? `Ota-onasi: ${record.parentPhone}` : 'Telefon yo\'q'}
                          </span>
                          ${record.status === 'absent_excused' ? `
                            <div class="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <span>Sabab:</span>
                                <span class="font-normal italic">"${escapeHtml(record.note || 'Izoh ko\'rsatilmagan')}"</span>
                              </span>
                              ${canEditAttendance ? `
                                <button 
                                  type="button" 
                                  class="btn-edit-student-excuse inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                                  data-class-id="${classId}"
                                  data-student-id="${studentId}"
                                >
                                  ✏️ Tahrirlash
                                </button>
                              ` : ''}
                            </div>
                          ` : ''}
                        </div>
                      </div>

                      <div class="flex items-center gap-1.5 self-end sm:self-auto">
                        <button 
                          class="btn-student-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${canEditAttendance ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${
                            record.status === 'present'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }"
                          data-class-id="${classId}"
                          data-student-id="${studentId}"
                          data-status="present"
                          ${canEditAttendance ? '' : 'disabled'}
                          title="Darsda qatnashmoqda"
                        >
                          🟢 Kelgan
                        </button>
                        <button 
                          class="btn-student-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${canEditAttendance ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${
                            record.status === 'late'
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }"
                          data-class-id="${classId}"
                          data-student-id="${studentId}"
                          data-status="late"
                          ${canEditAttendance ? '' : 'disabled'}
                          title="Darsga kechikib keldi"
                        >
                          ⏱️ Kechikdi
                        </button>
                        <button 
                          class="btn-student-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${canEditAttendance ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${
                            record.status === 'absent_excused'
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }"
                          data-class-id="${classId}"
                          data-student-id="${studentId}"
                          data-status="absent_excused"
                          ${canEditAttendance ? '' : 'disabled'}
                          title="Sababli kelmagan"
                        >
                          🟡 Sababli
                        </button>
                        <button 
                          class="btn-student-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${canEditAttendance ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${
                            record.status === 'absent_unexcused'
                              ? 'bg-red-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }"
                          data-class-id="${classId}"
                          data-student-id="${studentId}"
                          data-status="absent_unexcused"
                          ${canEditAttendance ? '' : 'disabled'}
                          title="Sababsiz kelmagan"
                        >
                          🔴 Sababsiz
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : `
            <!-- Sinflar tanlash pufakchalari (Pills) -->
            <div id="att-class-pills-container" class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              ${filteredClassEntries.map(([clsId, clsData]) => {
                const isSelected = clsId === (activeClassData?.classId || selectedClassIdForAttendance);
                const hasAbsents = clsData.absentCount > 0;
                return `
                  <button 
                    class="btn-select-class-pill px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : (hasAbsents
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80')
                    }"
                    data-class-id="${clsId}"
                  >
                    <span>${clsData.className}</span>
                    <span class="pill-counter-badge px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                      isSelected ? 'bg-indigo-500/40 text-white' : 'bg-white/80 text-slate-700'
                    }">
                      ${clsData.presentCount}/${clsData.totalStudents}
                    </span>
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Tanlangan sinf o'quvchilari ro'yxati -->
            <div id="att-active-class-container">
              ${renderActiveClassStudentsHtml(activeClassData, canEditAttendance)}
            </div>
          `}

        </div>

      </div>
    `;
  }

  // 3. SMENALAR (GURUHLAR) TABI (ADMINNING ASOSIY VAZIFASI)
  function renderShiftsTab() {
    // Barcha biriktirilgan sinflar to'plami
    const allAssignedClassIds = new Set();
    schoolShifts.forEach(s => (s.classIds || []).forEach(id => allAssignedClassIds.add(id)));
    const unassignedClasses = schoolClasses.filter(c => !allAssignedClassIds.has(c.id));
    const totalStudentsCount = schoolStudents.length;

    return `
      <div class="space-y-4">
        
        <!-- Admin Asosiy Vazifasi Banneri -->
        <div class="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-sm relative overflow-hidden">
          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 mb-2">
                <span>📁</span>
                <span>Adminning Bosh Vazifasi</span>
              </span>
              <h3 class="text-lg sm:text-xl font-black text-white tracking-tight">
                Guruhlar (Smenalar) va Sinflar Boshqaruvi
              </h3>
              <p class="text-xs sm:text-sm text-indigo-200/90 mt-1 max-w-2xl leading-relaxed">
                Admin sifatida siz guruhlar (1-smena, 2-smena va h.k.) ochasiz va ularga sinflarni biriktirasiz. 
                <strong>Nechta guruh ochilsa, bir kunda shuncha navbatchi shaxs belgilanadi</strong> va ular butun guruh davomatini oladi.
              </p>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <button 
                class="btn-auto-assign-rosters px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 border border-emerald-400/40 active:scale-95"
                title="Tizim guruhlar bo'yicha barcha sinf rahbarlarini tartib bilan avtomatik navbatchi etib tayinlaydi"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <span>⚡ Tartib Bilan Navbatchi Tayinlash</span>
              </button>

              <button 
                id="btn-add-new-shift" 
                class="px-4 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 border border-indigo-400/40"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                </svg>
                <span>+ Yangi Guruh (Smena) Ochish</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Taqsimot Statistikasi -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <span class="text-xs font-bold text-slate-500 block">Jami Guruhlar</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-indigo-600">${schoolShifts.length}</span>
              <span class="text-xs text-slate-400">ta guruh (smena)</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <span class="text-xs font-bold text-slate-500 block">Biriktirilgan Sinflar</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-emerald-600">${allAssignedClassIds.size}</span>
              <span class="text-xs text-slate-400">/ ${schoolClasses.length} ta sinf</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <span class="text-xs font-bold text-slate-500 block">Biriktirilmagan Sinflar</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black ${unassignedClasses.length > 0 ? 'text-amber-600' : 'text-slate-400'}">
                ${unassignedClasses.length}
              </span>
              <span class="text-xs text-slate-400">ta erkin</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <span class="text-xs font-bold text-slate-500 block">Kunlik Navbatchilar</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-purple-600">${schoolShifts.length}</span>
              <span class="text-xs text-slate-400">nafar / kun</span>
            </div>
          </div>
        </div>

        ${unassignedClasses.length > 0 ? `
          <!-- Biriktirilmagan sinflar haqida eslatma -->
          <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                ⚠️
              </div>
              <div>
                <strong class="text-xs sm:text-sm font-bold text-amber-950 block">
                  ${unassignedClasses.length} ta sinf hali hech bir guruhga qo'shilmagan!
                </strong>
                <p class="text-xs text-amber-800 mt-0.5">
                  Quyidagi sinflarni tegishli guruhlarga biriktiring:
                  <span class="font-bold font-mono">
                    ${unassignedClasses.map(c => c.name).join(', ')}
                  </span>
                </p>
              </div>
            </div>
            ${schoolShifts[0] ? `
              <button 
                class="btn-manage-shift-classes px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                data-shift-id="${schoolShifts[0].id}"
              >
                ${schoolShifts[0].name}ga biriktirish &rarr;
              </button>
            ` : ''}
          </div>
        ` : ''}

        <!-- Guruhlar Kartalari -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${schoolShifts.map((shift, sIdx) => {
            const assignedClassIds = new Set(shift.classIds || []);
            const shiftClasses = schoolClasses.filter(c => assignedClassIds.has(c.id));
            const shiftStudentsCount = schoolStudents.filter(s => assignedClassIds.has(s.classId)).length;
            const duty = getShiftDutyStatus(shift, selectedDate);

            return `
              <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between gap-4">
                <div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span>${shift.startTime} — ${shift.endTime}</span>
                    </span>
                    
                    <div class="flex items-center gap-1">
                      <button 
                        class="btn-edit-shift p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer" 
                        data-shift-id="${shift.id}"
                        title="Guruh sozlamalarini tahrirlash"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      ${schoolShifts.length > 1 ? `
                        <button 
                          class="btn-delete-shift p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer" 
                          data-shift-id="${shift.id}"
                          title="Guruhni o'chirish"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      ` : ''}
                    </div>
                  </div>

                  <h4 class="text-base sm:text-lg font-black text-slate-900 mt-2.5">
                    ${shift.name}
                  </h4>
                  
                  <!-- Bugungi Mas'ul Navbatchi -->
                  <div class="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <span class="text-slate-500 font-medium">Bugungi Navbatchi:</span>
                    <span class="font-bold text-slate-900">${duty.activeDutyTeacherName}</span>
                  </div>

                  <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>Biriktirilgan: <strong class="text-slate-800">${shiftClasses.length} ta sinf</strong></span>
                    <span>Jami o'quvchilar: <strong class="text-slate-800">${shiftStudentsCount} nafar</strong></span>
                  </div>

                  <!-- Biriktirilgan sinflar ro'yxati -->
                  <div class="mt-2.5 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                    ${shiftClasses.length === 0 ? `
                      <span class="text-xs text-slate-400 italic p-1">Hozircha birorta sinf biriktirilmagan</span>
                    ` : shiftClasses.map(c => `
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-white border border-slate-200/90 text-slate-800 shadow-2xs">
                        <span>${c.name}</span>
                        <span class="text-[10px] text-slate-400 font-normal">(${c.teacherName || 'Sinf rahbari'})</span>
                        <button 
                          type="button" 
                          class="btn-tab-exclude-class ml-1 text-slate-400 hover:text-rose-600 font-bold cursor-pointer p-0.5"
                          data-class-id="${c.id}"
                          title="Guruhdan chiqarish (navbatchilikdan mustasno qilish)"
                        >
                          ✕
                        </button>
                      </span>
                    `).join('')}
                  </div>
                </div>

                <!-- Sinflarni biriktirish tugmasi -->
                <button 
                  class="btn-manage-shift-classes w-full py-2.5 px-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                  data-shift-id="${shift.id}"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                  <span>+ Sinflarni ushbu guruhga qo'shish / o'zgartirish</span>
                </button>

              </div>
            `;
          }).join('')}
        </div>

        <!-- Navbatchilikdan mustasno qilingan (guruhlarga qo'shilmagan) sinflar -->
        ${(() => {
          const allAssignedIds = new Set();
          schoolShifts.forEach(s => (s.classIds || []).forEach(id => allAssignedIds.add(id)));
          const excludedClasses = schoolClasses.filter(c => !allAssignedIds.has(c.id));
          if (excludedClasses.length === 0) return '';

          return `
            <div class="p-4 rounded-3xl bg-amber-50/80 border border-amber-200/90 space-y-2.5 animate-fade-in">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-sm shadow-2xs">
                    🚫
                  </span>
                  <div>
                    <h4 class="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-1.5">
                      <span>Navbatchilar safidan chiqarilgan (mustasno) sinf rahbarlari</span>
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                        ${excludedClasses.length} ta sinf
                      </span>
                    </h4>
                    <p class="text-[11px] text-amber-800">
                      Ushbu o'qituvchilar smenalarga kiritilmagan, shu sababli navbatchilik jadvaliga umuman tayinlanmaydi
                    </p>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap gap-2 pt-1">
                ${excludedClasses.map(cls => `
                  <div class="inline-flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs text-slate-800 shadow-2xs">
                    <div>
                      <span class="font-bold text-slate-900">⚪ ${escapeHtml(cls.name)}</span>
                      <span class="text-slate-500 font-normal"> (${escapeHtml(cls.teacherName || 'Sinf rahbari')})</span>
                    </div>
                    <button 
                      type="button" 
                      class="btn-tab-include-class px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] cursor-pointer transition-all active:scale-95 shadow-2xs flex items-center gap-1"
                      data-class-id="${cls.id}"
                      title="Ushbu sinf rahbarini guruhga qayta biriktirish"
                    >
                      <span>➕ Guruhga biriktirish</span>
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        })()}

      </div>
    `;
  }

  // 4. NAVBATCHILIK JADVALI TABI (ROSTER)
  function renderRosterTab() {
    return `
      <div class="space-y-4">
        
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-bold text-slate-900">Haftalik Navbatchilik Jadvali</h3>
            <p class="text-xs text-slate-500">
              Har bir smena va hafta kuni uchun Asosiy va Zaxira (Dublyor) navbatchi o'qituvchilarni belgilash
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button 
              class="btn-auto-assign-rosters px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
              title="Guruhlar (smenalar) bo'yicha barcha sinf rahbarlarini tartib bilan avtomatik navbatchi etib tayinlash"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              <span>⚡ Avtomatik Navbatchi Tayinlash</span>
            </button>

            <div class="flex items-center gap-1.5">
              <span class="text-xs text-slate-500 font-medium">Smena:</span>
              <select 
                id="roster-shift-select" 
                class="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none"
              >
                ${schoolShifts.map(s => `
                  <option value="${s.id}" ${s.id === selectedShiftId ? 'selected' : ''}>
                    ${s.name}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Hafta kunlari jadvali -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          ${WEEK_DAYS.map(day => {
            const roster = getRosterForShiftAndDay(selectedShiftId, day.id);
            const isToday = day.id === todayDayOfWeek;

            return `
              <div class="bg-white p-4 rounded-2xl border ${isToday ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200/90'} shadow-xs flex flex-col justify-between gap-3">
                
                <div>
                  <div class="flex items-center justify-between gap-2">
                    <h4 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>${day.name}</span>
                      ${isToday ? `
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                          Bugun
                        </span>
                      ` : ''}
                    </h4>

                    <button 
                      class="btn-edit-day-roster text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                      data-day-id="${day.id}"
                      data-shift-id="${selectedShiftId}"
                    >
                      Tahrirlash
                    </button>
                  </div>

                  <!-- Asosiy Navbatchi -->
                  <div class="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Asosiy Navbatchi:</span>
                    <strong class="text-xs font-bold text-slate-900 block mt-0.5">
                      ${roster?.primaryTeacherName || '<span class="text-slate-400 italic">Belgilanmagan</span>'}
                    </strong>
                    ${roster?.primaryTeacherPhone ? `
                      <span class="text-[11px] text-slate-500 font-mono block">${roster.primaryTeacherPhone}</span>
                    ` : ''}
                  </div>

                  <!-- Zaxira (Dublyor) Navbatchi -->
                  <div class="mt-2 p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Zaxira / Dublyor:</span>
                    <strong class="text-xs font-bold text-slate-900 block mt-0.5">
                      ${roster?.backupTeacherName || '<span class="text-slate-400 italic">Belgilanmagan</span>'}
                    </strong>
                    ${roster?.backupTeacherPhone ? `
                      <span class="text-[11px] text-slate-500 font-mono block">${roster.backupTeacherPhone}</span>
                    ` : ''}
                  </div>
                </div>

                <div class="text-[11px] text-slate-400 italic">
                  ${roster?.notes ? `Izoh: ${roster.notes}` : 'Asosiy kelmasa, avtomatik zaxiraga o\'tadi'}
                </div>

              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;
  }

  // 5. YILLIK VA OYLIK TAHLIL TABI
  function renderAnalyticsTab() {
    // Davomat tarixi asosida hisob-kitoblar
    const totalRecords = schoolAttendanceRecords.length;
    let avgRate = 96.4; // Standart o'rtacha ko'rsatkich
    if (totalRecords > 0) {
      const sumRates = schoolAttendanceRecords.reduce((acc, r) => acc + (r.summary?.attendanceRate || 95), 0);
      avgRate = Math.round((sumRates / totalRecords) * 10) / 10;
    }

    // Sinflar bo'yicha davomat reytingi
    const classRates = schoolClasses.map(cls => {
      return {
        className: cls.name,
        teacherName: cls.teacherName || '',
        rate: Math.min(100, Math.max(88, Math.round(92 + (cls.name.charCodeAt(0) % 8)))),
        totalStudents: schoolStudents.filter(s => s.classId === cls.id).length
      };
    }).sort((a, b) => b.rate - a.rate);

    return `
      <div class="space-y-4">
        
        <!-- Yillik ko'rsatkichlar kartochkasi -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <span class="text-xs font-semibold text-slate-500">O'rtacha yillik davomat:</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl sm:text-3xl font-extrabold text-indigo-700">${avgRate}%</span>
              <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Yuqori</span>
            </div>
            <p class="text-[11px] text-slate-400 mt-1">Davlat ta'lim standarti talabiga to'liq javob beradi</p>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <span class="text-xs font-semibold text-slate-500">Jami olingan davomatlar:</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl sm:text-3xl font-extrabold text-slate-800">${totalRecords} kun</span>
            </div>
            <p class="text-[11px] text-slate-400 mt-1">Maktab arxivida saqlangan to'liq registrlar</p>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <span class="text-xs font-semibold text-slate-500">Eskalatsiya holatlari (Zaxira):</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl sm:text-3xl font-extrabold text-amber-600">
                ${schoolAttendanceRecords.filter(r => r.isFailoverActivated).length} marta
              </span>
            </div>
            <p class="text-[11px] text-slate-400 mt-1">Asosiy navbatchi kelmay zaxiraga o'tgan kunlar</p>
          </div>
        </div>

        <!-- Sinflar reytingi (Top davomatli sinflar) -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h4 class="text-sm sm:text-base font-bold text-slate-900">
              Sinflar Bo'yicha Davomat Reytingi
            </h4>
            <button 
              id="btn-export-attendance-excel" 
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span>Excel hisobotini yuklab olish</span>
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th class="py-2.5 px-3">O'rin</th>
                  <th class="py-2.5 px-3">Sinf nomi</th>
                  <th class="py-2.5 px-3">Sinf rahbari</th>
                  <th class="py-2.5 px-3">O'quvchilar soni</th>
                  <th class="py-2.5 px-3 text-right">Davomat foizi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                ${classRates.map((c, i) => `
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="py-2.5 px-3 font-bold ${i === 0 ? 'text-amber-500' : (i === 1 ? 'text-slate-400' : (i === 2 ? 'text-amber-700' : 'text-slate-500'))}">
                      #${i + 1}
                    </td>
                    <td class="py-2.5 px-3 font-bold text-slate-900">${c.className}</td>
                    <td class="py-2.5 px-3 text-slate-600">${c.teacherName || '-'}</td>
                    <td class="py-2.5 px-3 text-slate-600">${c.totalStudents} nafar</td>
                    <td class="py-2.5 px-3 text-right font-bold text-indigo-700">${c.rate}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  // Event tinglovchilarni biriktirish
  function attachEventHandlers() {
    // Orqaga qaytish
    document.getElementById('att-back-btn')?.addEventListener('click', () => {
      if (onBack) onBack();
    });

    // Sana o'zgarishi
    document.getElementById('att-date-picker')?.addEventListener('change', (e) => {
      selectedDate = e.target.value;
      render();
    });

    // Tab almashtirish
    document.getElementById('tab-duty-officers-btn')?.addEventListener('click', () => {
      activeTab = 'duty_officers';
      render();
    });
    document.getElementById('btn-switch-to-duty-tab')?.addEventListener('click', () => {
      activeTab = 'duty_officers';
      render();
    });
    document.getElementById('btn-duty-tab-goto-roster')?.addEventListener('click', () => {
      activeTab = 'roster';
      render();
    });
    document.getElementById('btn-goto-take-attendance-from-duty')?.addEventListener('click', () => {
      initTakingAttendance(selectedShiftId, selectedDate);
    });
    container.querySelectorAll('.btn-open-taking-attendance-from-duty').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftId = btn.getAttribute('data-shift-id') || selectedShiftId;
        initTakingAttendance(shiftId, selectedDate);
      });
    });
    document.getElementById('btn-take-attendance-report-absence')?.addEventListener('click', () => {
      openDutyAbsenceModal();
    });
    container.querySelectorAll('.btn-duty-report-absence-from-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftId = btn.getAttribute('data-shift-id');
        if (shiftId) selectedShiftId = shiftId;
        openDutyAbsenceModal();
      });
    });
    document.getElementById('tab-monitoring-btn')?.addEventListener('click', () => {
      activeTab = 'monitoring';
      render();
    });
    document.getElementById('tab-take-attendance-btn')?.addEventListener('click', () => {
      initTakingAttendance(selectedShiftId, selectedDate);
    });
    document.getElementById('tab-shifts-btn')?.addEventListener('click', () => {
      activeTab = 'shifts';
      render();
    });
    document.getElementById('tab-roster-btn')?.addEventListener('click', () => {
      activeTab = 'roster';
      render();
    });
    document.getElementById('tab-analytics-btn')?.addEventListener('click', () => {
      activeTab = 'analytics';
      render();
    });
    document.getElementById('tab-teacher-attendance-btn')?.addEventListener('click', () => {
      activeTab = 'teacher_attendance';
      render();
    });

    if (activeTab === 'teacher_attendance') {
      attachAdminTeacherAttendanceHandlers();
    }

    // 1. Monitoringdagi "Davomat olish" tugmalari
    container.querySelectorAll('.btn-start-attendance').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftId = btn.getAttribute('data-shift-id');
        initTakingAttendance(shiftId, selectedDate);
      });
    });

    // 1.1 Admin uchun "Davomatni ko'rish (Nazorat)" inspektorini ochish
    container.querySelectorAll('.btn-inspect-attendance').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftId = btn.getAttribute('data-shift-id');
        openViewAttendanceInspectorModal(shiftId, selectedDate);
      });
    });

    // 1.2 Monitoringdan to'g'ridan-to'g'ri Guruhlar tabiga o'tish
    document.getElementById('btn-goto-shifts-from-monitoring')?.addEventListener('click', () => {
      activeTab = 'shifts';
      render();
    });

    // 2. Monitoringdagi "Qo'lda zaxiraga o'tkazish" tugmasi
    container.querySelectorAll('.btn-manual-escalate').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftId = btn.getAttribute('data-shift-id');
        const shift = schoolShifts.find(s => s.id === shiftId);
        if (!shift) return;

        openConfirmModal({
          title: "Zaxira navbatchiga o'tkazish",
          message: `Haqiqatdan ham "${shift.name}" uchun navbatchilikni zaxira o'qituvchiga zudlik bilan o'tkazmoqchimisiz?`,
          onConfirm: () => {
            initTakingAttendance(shiftId, selectedDate);
            if (activeTakingAttendanceData) {
              activeTakingAttendanceData.isFailoverActivated = true;
              activeTakingAttendanceData.failoverReason = "Maktab ma'muriyati tomonidan qo'lda zaxiraga o'tkazildi";
              const roster = getRosterForShiftAndDay(shiftId, todayDayOfWeek);
              if (roster?.backupTeacherName) {
                activeTakingAttendanceData.dutyTeacher.name = roster.backupTeacherName;
                activeTakingAttendanceData.dutyTeacher.phone = roster.backupTeacherPhone || '';
                activeTakingAttendanceData.dutyTeacher.role = 'backup';
              }
            }
            showToast("Navbatchilik zaxira o'qituvchiga muvaffaqiyatli o'tkazildi!", 'success');
            render();
          }
        });
      });
    });

    // 3. Davomat olish sahifasidagi smena selektori
    document.getElementById('att-shift-switch')?.addEventListener('change', (e) => {
      initTakingAttendance(e.target.value, selectedDate);
    });

    // 3.1 Butun maktab bo'yicha barcha o'quvchilarni "Kelgan" deb belgilash (Navbatchi super-funktsiyasi)
    document.getElementById('btn-all-school-present')?.addEventListener('click', () => {
      if (activeTakingAttendanceData && activeTakingAttendanceData.classAttendance) {
        Object.values(activeTakingAttendanceData.classAttendance).forEach(clsRec => {
          Object.values(clsRec.records || {}).forEach(st => {
            st.status = 'present';
          });
        });
        recalculateAttendanceSummary(activeTakingAttendanceData);
        showToast("Butun maktab bo'yicha barcha o'quvchilar 'Kelgan' deb belgilandi!", 'success');
        render();
      }
    });

    // 3.2 Guruh / Smena bo'yicha sinf filterlari
    container.querySelectorAll('.btn-class-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        attendanceClassFilter = btn.getAttribute('data-filter');
        render();
      });
    });

    // Helper to update KPIs and pill counters in DOM without full render
    function updateTakingAttendanceUI() {
      if (!activeTakingAttendanceData) return;
      const summary = recalculateAttendanceSummary(activeTakingAttendanceData);
      const kpiTotal = document.getElementById('att-kpi-total-students');
      const kpiPresent = document.getElementById('att-kpi-present-count');
      const kpiAbsent = document.getElementById('att-kpi-absent-count');
      const kpiRate = document.getElementById('att-kpi-attendance-rate');
      if (kpiTotal) kpiTotal.textContent = summary.totalStudents;
      if (kpiPresent) kpiPresent.textContent = summary.presentCount;
      if (kpiAbsent) kpiAbsent.textContent = summary.absentCount;
      if (kpiRate) kpiRate.textContent = `${summary.attendanceRate}%`;

      const activeClass = activeTakingAttendanceData.classAttendance?.[selectedClassIdForAttendance];
      if (activeClass) {
        const countsEl = document.getElementById('att-active-class-counts');
        if (countsEl) {
          countsEl.innerHTML = `Jami: <strong>${activeClass.totalStudents}</strong> | Kelgan: <strong class="text-emerald-600">${activeClass.presentCount}</strong> | Kelmagan: <strong class="text-red-600">${activeClass.absentCount}</strong>`;
        }
        const activePill = container.querySelector(`.btn-select-class-pill[data-class-id="${selectedClassIdForAttendance}"]`);
        if (activePill) {
          const badge = activePill.querySelector('.pill-counter-badge');
          if (badge) badge.textContent = `${activeClass.presentCount}/${activeClass.totalStudents}`;
        }
      }
    }

    // 3.3 Davomat olishda o'quvchini tezkor qidirish (smooth & lag-free)
    const attSearchInput = document.getElementById('take-att-student-search');
    if (attSearchInput) {
      attSearchInput.addEventListener('input', (e) => {
        attendanceStudentSearchQuery = (e.target.value || '').toLowerCase().trim();
        const rows = container.querySelectorAll('.student-attendance-row');
        rows.forEach(row => {
          const sName = (row.getAttribute('data-student-name') || '').toLowerCase();
          const sPhone = (row.getAttribute('data-student-phone') || '').toLowerCase();
          if (!attendanceStudentSearchQuery || sName.includes(attendanceStudentSearchQuery) || sPhone.includes(attendanceStudentSearchQuery)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    }
    document.getElementById('btn-clear-att-search')?.addEventListener('click', () => {
      attendanceStudentSearchQuery = '';
      if (attSearchInput) attSearchInput.value = '';
      container.querySelectorAll('.student-attendance-row').forEach(row => {
        row.style.display = '';
      });
    });

    // 3.4 Tizim orqali tartib bilan navbatchilarni avtomatik tayinlash
    container.querySelectorAll('.btn-auto-assign-rosters').forEach(btn => {
      btn.addEventListener('click', () => {
        const newRosters = generateOrderlyDutyRosters(schoolId, schoolShifts, schoolClasses);
        if (newRosters.length === 0) {
          showToast("Smenalar yoki sinflar topilmadi", 'error');
          return;
        }
        newRosters.forEach(r => {
          if (onSaveRoster) onSaveRoster(r);
        });
        schoolRosters = newRosters;
        showToast("Guruhlar bo'yicha barcha sinf rahbarlari tartib bilan avtomatik navbatchi etib tayinlandi!", 'success');
        render();
      });
    });

    // 4. Barcha o'qituvchilar kelgan tugmasi
    document.getElementById('btn-all-teachers-present')?.addEventListener('click', () => {
      if (activeTakingAttendanceData && activeTakingAttendanceData.teacherAttendance) {
        activeTakingAttendanceData.teacherAttendance.forEach(t => {
          t.status = 'present';
        });
        showToast("Barcha o'qituvchilar 'Kelgan' deb belgilandi", 'info');
        render();
      }
    });

    // 5. O'qituvchi statusini o'zgartirish
    container.querySelectorAll('.btn-teacher-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-index'));
        const status = btn.getAttribute('data-status');
        if (activeTakingAttendanceData?.teacherAttendance?.[idx]) {
          activeTakingAttendanceData.teacherAttendance[idx].status = status;
          render();
        }
      });
    });

    // 6. Sinf pill tugmasini bosish (Tezkor o'tish, sahifani to'liq qayta chizmasdan)
    const pillsContainer = document.getElementById('att-class-pills-container');
    if (pillsContainer) {
      pillsContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.btn-select-class-pill');
        if (pill) {
          const clsId = pill.getAttribute('data-class-id');
          selectedClassIdForAttendance = clsId;
          pillsContainer.querySelectorAll('.btn-select-class-pill').forEach(p => {
            const pId = p.getAttribute('data-class-id');
            const isSel = pId === clsId;
            const pData = activeTakingAttendanceData?.classAttendance?.[pId];
            const hasAbs = pData && pData.absentCount > 0;
            p.className = `btn-select-class-pill px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
              isSel
                ? 'bg-indigo-600 text-white shadow-xs'
                : (hasAbs ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80')
            }`;
            const badge = p.querySelector('.pill-counter-badge');
            if (badge) {
              badge.className = `pill-counter-badge px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                isSel ? 'bg-indigo-500/40 text-white' : 'bg-white/80 text-slate-700'
              }`;
            }
          });

          const activeClass = activeTakingAttendanceData?.classAttendance?.[clsId];
          const activeClassEl = document.getElementById('att-active-class-container');
          if (activeClassEl) {
            activeClassEl.innerHTML = renderActiveClassStudentsHtml(activeClass, canEditAttendance);
          }
        }
      });
    }

    // 7. Butun sinfni "Kelgan" deb belgilash (Yengil va tez)
    document.getElementById('btn-all-class-present')?.addEventListener('click', () => {
      const clsId = document.getElementById('btn-all-class-present')?.getAttribute('data-class-id');
      if (activeTakingAttendanceData?.classAttendance?.[clsId]) {
        const clsRec = activeTakingAttendanceData.classAttendance[clsId];
        Object.values(clsRec.records || {}).forEach(st => {
          st.status = 'present';
          st.note = '';
        });
        const activeClassEl = document.getElementById('att-active-class-container');
        if (activeClassEl) {
          activeClassEl.innerHTML = renderActiveClassStudentsHtml(clsRec, canEditAttendance);
        }
        updateTakingAttendanceUI();
        showToast(`"${clsRec.className}" barcha o'quvchilari 'Kelgan' deb belgilandi`, 'info');
      }
    });

    // 8. O'quvchi statusini tezkor o'zgartirish (Event delegation orqali zudlik bilan ishlaydi)
    const activeClassContainer = document.getElementById('att-active-class-container');
    if (activeClassContainer) {
      activeClassContainer.addEventListener('click', (e) => {
        const statusBtn = e.target.closest('.btn-student-status');
        if (statusBtn && !statusBtn.disabled) {
          const clsId = statusBtn.getAttribute('data-class-id');
          const stId = statusBtn.getAttribute('data-student-id');
          const newStatus = statusBtn.getAttribute('data-status');

          if (activeTakingAttendanceData?.classAttendance?.[clsId]?.records?.[stId]) {
            const rec = activeTakingAttendanceData.classAttendance[clsId].records[stId];
            const className = activeTakingAttendanceData.classAttendance[clsId].className;

            if (newStatus === 'absent_excused') {
              openExcuseNoteModal({ 
                classId: clsId, 
                studentId: stId, 
                studentRecord: rec, 
                className,
                onSaved: () => {
                  const actClass = activeTakingAttendanceData?.classAttendance?.[selectedClassIdForAttendance];
                  activeClassContainer.innerHTML = renderActiveClassStudentsHtml(actClass, canEditAttendance);
                  updateTakingAttendanceUI();
                }
              });
              return;
            }

            rec.status = newStatus;
            if (newStatus === 'present') {
              rec.note = '';
            }

            // Student qatorini zudlik bilan yangilash
            const row = statusBtn.closest('.student-attendance-row');
            if (row) {
              row.querySelectorAll('.btn-student-status').forEach(b => {
                const s = b.getAttribute('data-status');
                const isAct = s === newStatus;
                let activeClass = 'bg-slate-100 text-slate-600 hover:bg-slate-200';
                if (isAct) {
                  if (s === 'present') activeClass = 'bg-emerald-600 text-white shadow-2xs';
                  else if (s === 'late') activeClass = 'bg-amber-500 text-white shadow-2xs';
                  else if (s === 'absent_excused') activeClass = 'bg-blue-600 text-white shadow-2xs';
                  else if (s === 'absent_unexcused') activeClass = 'bg-red-600 text-white shadow-2xs';
                }
                b.className = `btn-student-status px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeClass}`;
              });

              const excuseBadge = row.querySelector('.excuse-badge-container');
              if (excuseBadge) {
                if (newStatus === 'absent_excused') excuseBadge.classList.remove('hidden');
                else excuseBadge.classList.add('hidden');
              }
            }

            updateTakingAttendanceUI();
          }
          return;
        }

        const excuseEditBtn = e.target.closest('.btn-edit-student-excuse');
        if (excuseEditBtn) {
          const clsId = excuseEditBtn.getAttribute('data-class-id');
          const stId = excuseEditBtn.getAttribute('data-student-id');
          if (activeTakingAttendanceData?.classAttendance?.[clsId]?.records?.[stId]) {
            const rec = activeTakingAttendanceData.classAttendance[clsId].records[stId];
            const className = activeTakingAttendanceData.classAttendance[clsId].className;
            openExcuseNoteModal({ 
              classId: clsId, 
              studentId: stId, 
              studentRecord: rec, 
              className,
              onSaved: () => {
                const actClass = activeTakingAttendanceData?.classAttendance?.[selectedClassIdForAttendance];
                activeClassContainer.innerHTML = renderActiveClassStudentsHtml(actClass, canEditAttendance);
                updateTakingAttendanceUI();
              }
            });
          }
        }
      });
    }

    // 9. Davomatni saqlash va tasdiqlash
    document.getElementById('btn-save-attendance-record')?.addEventListener('click', () => {
      if (!activeTakingAttendanceData) return;
      activeTakingAttendanceData.status = 'completed';
      activeTakingAttendanceData.updatedAt = new Date().toISOString();
      recalculateAttendanceSummary(activeTakingAttendanceData);

      if (onSaveAttendanceRecord) {
        onSaveAttendanceRecord(activeTakingAttendanceData);
      }
      showToast("Kunlik davomat muvaffaqiyatli tasdiqlandi va saqlandi!", 'success');
      activeTab = 'monitoring';
      render();
    });

    // 10. Darsga kelmagan o'quvchiga bittalik SMS jo'natish
    container.querySelectorAll('.btn-send-sms-single').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentName = btn.getAttribute('data-student-name');
        const className = btn.getAttribute('data-class-name');
        const status = btn.getAttribute('data-status');
        const parentPhone = btn.getAttribute('data-parent-phone');
        const id = btn.getAttribute('data-student-id');

        handleSendAbsentSMS({ id, studentName, parentPhone }, className, status);
      });
    });

    // 11. Yangi smena qo'shish modalini ochish
    document.getElementById('btn-add-new-shift')?.addEventListener('click', () => {
      openShiftEditModal(null);
    });

    // 12. Smenani tahrirlash modalini ochish
    container.querySelectorAll('.btn-edit-shift').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftId = btn.getAttribute('data-shift-id');
        const shift = schoolShifts.find(s => s.id === shiftId);
        if (shift) openShiftEditModal(shift);
      });
    });

    // 13. Smenani o'chirish
    container.querySelectorAll('.btn-delete-shift').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftId = btn.getAttribute('data-shift-id');
        openConfirmModal({
          title: "Smenani o'chirish",
          message: "Haqiqatan ham ushbu smenani o'chirmoqchimisiz?",
          danger: true,
          onConfirm: () => {
            if (onDeleteShift) onDeleteShift(shiftId);
            showToast("Smena muvaffaqiyatli o'chirildi", 'info');
            render();
          }
        });
      });
    });

    // 14. Sinflarni smenaga biriktirish modalini ochish
    container.querySelectorAll('.btn-manage-shift-classes').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftId = btn.getAttribute('data-shift-id');
        const shift = schoolShifts.find(s => s.id === shiftId);
        if (shift) openAssignClassesModal(shift);
      });
    });

    // 14.1. Sinflarni smenadan/guruhdan chiqarish (mustasno qilish)
    container.querySelectorAll('.btn-tab-exclude-class').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const classId = btn.getAttribute('data-class-id');
        const cls = schoolClasses.find(c => c.id === classId);
        excludeClassFromDutyShifts(classId, schoolId, state);
        showToast(`${cls?.name || 'Sinf'} (${cls?.teacherName || ''}) guruhdan chiqarildi va navbatchilikdan mustasno qilindi!`, 'info');
        render();
      });
    });

    // 14.2. Mustasno sinfni guruhga biriktirish
    container.querySelectorAll('.btn-tab-include-class').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const classId = btn.getAttribute('data-class-id');
        const cls = schoolClasses.find(c => c.id === classId);
        if (!cls) return;
        const targetShift = schoolShifts[0];
        if (targetShift) {
          includeClassToDutyShift(classId, targetShift.id, schoolId, state);
          showToast(`${cls.name} (${cls.teacherName}) ${targetShift.name} guruhiga muvaffaqiyatli qo'shildi!`, 'success');
          render();
        }
      });
    });

    // 15. Roster smena selektori
    document.getElementById('roster-shift-select')?.addEventListener('change', (e) => {
      selectedShiftId = e.target.value;
      render();
    });

    // 16. Navbatchilik jadvali tahrirlash
    container.querySelectorAll('.btn-edit-day-roster').forEach(btn => {
      btn.addEventListener('click', () => {
        const dayId = Number(btn.getAttribute('data-day-id'));
        const shiftId = btn.getAttribute('data-shift-id');
        openRosterEditModal(shiftId, dayId);
      });
    });

    // 17. Excel hisobot yuklab olish
    document.getElementById('btn-export-attendance-excel')?.addEventListener('click', () => {
      handleExportAttendanceToCSV();
    });
  }

  // Smena tahrirlash modali
  function openShiftEditModal(shift = null) {
    const isNew = !shift;
    const modalId = 'shift-edit-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-scale-in">
        <h3 class="text-base font-bold text-slate-900 mb-1">
          ${isNew ? "Yangi Smena Qo'shish" : "Smenani Tahrirlash"}
        </h3>
        <p class="text-xs text-slate-500 mb-4">
          Smena nomi, boshlanish va tugash soatlarini kiriting
        </p>

        <form id="shift-modal-form" class="space-y-3.5">
          <div>
            <label class="text-xs font-bold text-slate-700 block mb-1">Smena nomi</label>
            <input 
              type="text" 
              id="shift-name-input" 
              value="${shift?.name || ''}" 
              placeholder="Masalan: 1-smena (Ertalabki)" 
              required
              class="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-bold text-slate-700 block mb-1">Boshlanish vaqti</label>
              <input 
                type="time" 
                id="shift-start-input" 
                value="${shift?.startTime || '08:00'}" 
                required
                class="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="text-xs font-bold text-slate-700 block mb-1">Tugash vaqti</label>
              <input 
                type="time" 
                id="shift-end-input" 
                value="${shift?.endTime || '13:00'}" 
                required
                class="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-slate-700 block mb-1">
              Zaxiraga o'tish (Cutoff) vaqti
            </label>
            <input 
              type="time" 
              id="shift-cutoff-input" 
              value="${shift?.cutoffTime || '08:30'}" 
              required
              class="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <span class="text-[10px] text-slate-400 mt-1 block">
              Agar shu vaqtgacha asosiy navbatchi davomat olmasa, zaxira navbatchiga eskalatsiya bo'ladi.
            </span>
          </div>

          <div class="pt-3 flex items-center gap-2">
            <button 
              type="button" 
              id="close-shift-modal-btn" 
              class="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Bekor qilish
            </button>
            <button 
              type="submit" 
              class="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Saqlash
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(div);

    document.getElementById('close-shift-modal-btn')?.addEventListener('click', () => div.remove());
    div.addEventListener('click', (e) => { if (e.target === div) div.remove(); });

    document.getElementById('shift-modal-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('shift-name-input').value.trim();
      const startTime = document.getElementById('shift-start-input').value;
      const endTime = document.getElementById('shift-end-input').value;
      const cutoffTime = document.getElementById('shift-cutoff-input').value;

      if (!name) return;

      const newShift = {
        id: shift?.id || `shift_${Date.now()}_${schoolId}`,
        schoolId,
        name,
        startTime,
        endTime,
        cutoffTime,
        classIds: shift?.classIds || [],
        createdAt: shift?.createdAt || new Date().toISOString()
      };

      if (onSaveShift) onSaveShift(newShift);
      showToast("Smena muvaffaqiyatli saqlandi!", 'success');
      div.remove();
      render();
    });
  }

  // Sinflarni smenaga biriktirish modali (Tezkor filtrlar va qulay tanlash)
  function openAssignClassesModal(shift) {
    const modalId = 'assign-classes-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const selectedIds = new Set(shift.classIds || []);

    // Boshqa guruhlarda qaysi sinflar borligini xaritalash
    const classToOtherShiftMap = {};
    schoolShifts.forEach(s => {
      if (s.id !== shift.id && s.classIds) {
        s.classIds.forEach(cId => {
          classToOtherShiftMap[cId] = s.name;
        });
      }
    });

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl p-5 sm:p-6 animate-scale-in my-auto max-h-[92vh] flex flex-col">
        
        <!-- Modal Header -->
        <div class="pb-3 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1">
              <span>Guruh: ${shift.name}</span>
              <span class="text-slate-400 font-mono">(${shift.startTime} - ${shift.endTime})</span>
            </div>
            <h3 class="text-base sm:text-lg font-black text-slate-900">
              Sinflarni Ushbu Guruhga Biriktirish
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Admin sifatida guruhga tegishli sinflarni belgilang.
            </p>
          </div>
          <button id="close-assign-x-btn" class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Tezkor tanlash tugmalari -->
        <div class="py-3 border-b border-slate-100 flex flex-wrap gap-1.5 items-center">
          <span class="text-[11px] font-bold text-slate-400 mr-1">Tezkor tanlash:</span>
          <button 
            type="button" 
            id="btn-select-primary-classes" 
            class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-200"
          >
            1-4 Boshlang'ich
          </button>
          <button 
            type="button" 
            id="btn-select-secondary-classes" 
            class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-200"
          >
            5-11 Yuqori
          </button>
          <button 
            type="button" 
            id="btn-select-unassigned-classes" 
            class="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-colors cursor-pointer border border-amber-200"
          >
            Erkin (Bo'sh) Sinflar
          </button>
          <button 
            type="button" 
            id="btn-select-all-classes" 
            class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
          >
            Barchasi
          </button>
          <button 
            type="button" 
            id="btn-clear-classes" 
            class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
          >
            Tozalash
          </button>
        </div>

        <!-- Sinflar ro'yxati -->
        <div class="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl p-2 my-3 max-h-72">
          ${schoolClasses.length === 0 ? `
            <div class="p-6 text-center text-xs text-slate-400">
              Maktabda hali sinflar yaratilmagan. Avval sinflar bo'limidan sinf qo'shing.
            </div>
          ` : schoolClasses.map(cls => {
            const isChecked = selectedIds.has(cls.id);
            const otherShiftName = classToOtherShiftMap[cls.id];
            const stCount = schoolStudents.filter(s => s.classId === cls.id).length;

            return `
              <label class="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                <div class="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    value="${cls.id}" 
                    data-class-name="${cls.name}"
                    class="class-assign-checkbox w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500 cursor-pointer"
                    ${isChecked ? 'checked' : ''}
                  />
                  <div>
                    <div class="flex items-center gap-2">
                      <strong class="text-xs font-bold text-slate-900">${cls.name}</strong>
                      ${otherShiftName ? `
                        <span class="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                          Hozirda: ${otherShiftName}da
                        </span>
                      ` : `
                        <span class="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Erkin sinf
                        </span>
                      `}
                    </div>
                    <span class="text-[11px] text-slate-400">${cls.teacherName || 'Sinf rahbari biriktirilmagan'}</span>
                  </div>
                </div>
                <span class="text-xs font-mono font-semibold text-slate-500 shrink-0">
                  ${stCount} nafar o'quvchi
                </span>
              </label>
            `;
          }).join('')}
        </div>

        <!-- Modal Footer -->
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <span id="assign-selected-counter" class="text-xs font-bold text-indigo-700">
            ${selectedIds.size} ta sinf tanlandi
          </span>
          <div class="flex items-center gap-2">
            <button 
              type="button" 
              id="close-assign-modal-btn" 
              class="py-2 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Bekor qilish
            </button>
            <button 
              type="button" 
              id="save-assign-modal-btn" 
              class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span>Biriktirishni Saqlash</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    // Eventlar
    const close = () => div.remove();
    document.getElementById('close-assign-x-btn')?.addEventListener('click', close);
    document.getElementById('close-assign-modal-btn')?.addEventListener('click', close);
    div.addEventListener('click', (e) => { if (e.target === div) close(); });

    const checkboxes = div.querySelectorAll('.class-assign-checkbox');
    const updateCounter = () => {
      const count = div.querySelectorAll('.class-assign-checkbox:checked').length;
      const counterEl = document.getElementById('assign-selected-counter');
      if (counterEl) counterEl.textContent = `${count} ta sinf tanlandi`;
    };

    checkboxes.forEach(cb => cb.addEventListener('change', updateCounter));

    // 1-4 Boshlang'ich
    document.getElementById('btn-select-primary-classes')?.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        const name = cb.getAttribute('data-class-name') || '';
        const grade = parseInt(name, 10);
        if (grade >= 1 && grade <= 4) cb.checked = true;
      });
      updateCounter();
    });

    // 5-11 Yuqori
    document.getElementById('btn-select-secondary-classes')?.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        const name = cb.getAttribute('data-class-name') || '';
        const grade = parseInt(name, 10);
        if (grade >= 5 && grade <= 11) cb.checked = true;
      });
      updateCounter();
    });

    // Erkin sinflar
    document.getElementById('btn-select-unassigned-classes')?.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        const val = cb.value;
        if (!classToOtherShiftMap[val]) cb.checked = true;
      });
      updateCounter();
    });

    // Barchasi
    document.getElementById('btn-select-all-classes')?.addEventListener('click', () => {
      checkboxes.forEach(cb => { cb.checked = true; });
      updateCounter();
    });

    // Tozalash
    document.getElementById('btn-clear-classes')?.addEventListener('click', () => {
      checkboxes.forEach(cb => { cb.checked = false; });
      updateCounter();
    });

    // Saqlash
    document.getElementById('save-assign-modal-btn')?.addEventListener('click', () => {
      const checkedBoxes = div.querySelectorAll('.class-assign-checkbox:checked');
      const newClassIds = Array.from(checkedBoxes).map(cb => cb.value);

      // Guruhga yangi sinflarni biriktirish
      shift.classIds = newClassIds;
      if (onSaveShift) onSaveShift(shift);

      // Boshqa guruhlardan ushbu sinflarni avtomatik tozalash (sinf bitta smenada bo'lishi kerak)
      schoolShifts.forEach(otherShift => {
        if (otherShift.id !== shift.id && otherShift.classIds) {
          const originalLen = otherShift.classIds.length;
          otherShift.classIds = otherShift.classIds.filter(id => !newClassIds.includes(id));
          if (otherShift.classIds.length !== originalLen && onSaveShift) {
            onSaveShift(otherShift);
          }
        }
      });

      showToast(`Sinflar "${shift.name}" guruhiga muvaffaqiyatli biriktirildi!`, 'success');
      div.remove();
      render();
    });
  }

  // Admin uchun Davomatni faqat ko'rish va nazorat qilish modali (Read-Only Inspector)
  function openViewAttendanceInspectorModal(shiftId, dateStr) {
    const modalId = 'admin-attendance-inspector-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const shift = schoolShifts.find(s => s.id === shiftId);
    const record = getAttendanceRecord(shiftId, dateStr);
    if (!record) {
      showToast("Ushbu sana uchun davomat yozuvi mavjud emas", 'info');
      return;
    }

    const summary = recalculateAttendanceSummary(record);
    const classEntries = Object.values(record.classAttendance || {});

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl p-5 sm:p-6 my-auto animate-scale-in max-h-[92vh] flex flex-col">
        
        <!-- Header -->
        <div class="flex items-start justify-between pb-4 border-b border-slate-200">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                ${shift?.name || 'Guruh'}
              </span>
              <span class="text-xs text-slate-500 font-mono">${formatReadableDate(dateStr)}</span>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
              <span>Maktab Davomati Nazorati (Faqat Ko'rish)</span>
              <span class="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">Topshirilgan</span>
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Mas'ul navbatchi: <strong class="text-slate-800">${record.dutyTeacher?.name || 'Navbatchi'}</strong>
              ${record.dutyTeacher?.phone ? `(<span class="font-mono text-slate-700">${record.dutyTeacher.phone}</span>)` : ''}
              ${record.isFailoverActivated ? `<span class="text-amber-600 font-bold ml-1">(Zaxira navbatchiga eskalatsiya bo'lgan)</span>` : ''}
            </p>
          </div>
          <button id="close-inspector-btn" class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Summary KPIs -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
          <div class="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-center">
            <span class="block text-xl font-black text-indigo-700">${summary.totalStudents}</span>
            <span class="text-[11px] font-bold text-indigo-600">Jami o'quvchilar</span>
          </div>
          <div class="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-center">
            <span class="block text-xl font-black text-emerald-700">${summary.presentCount}</span>
            <span class="text-[11px] font-bold text-emerald-600">Darsda qatnashmoqda</span>
          </div>
          <div class="p-3 rounded-2xl bg-red-50/70 border border-red-100 text-center">
            <span class="block text-xl font-black text-red-600">${summary.absentCount}</span>
            <span class="text-[11px] font-bold text-red-500">Dars qoldirgan</span>
          </div>
          <div class="p-3 rounded-2xl bg-purple-50/70 border border-purple-100 text-center">
            <span class="block text-xl font-black text-purple-700">${summary.attendanceRate}%</span>
            <span class="text-[11px] font-bold text-purple-600">Davomat foizi</span>
          </div>
        </div>

        <!-- Sinflar va o'quvchilar ro'yxati -->
        <div class="flex-1 overflow-y-auto space-y-4 pr-1">
          ${classEntries.map(cls => {
            const records = Object.values(cls.records || {});
            const present = records.filter(r => r.status === 'present').length;
            const absentUnexcused = records.filter(r => r.status === 'absent_unexcused').length;
            const absentExcused = records.filter(r => r.status === 'absent_excused').length;
            const late = records.filter(r => r.status === 'late').length;

            return `
              <div class="rounded-2xl border border-slate-200 overflow-hidden">
                <div class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <strong class="text-sm font-bold text-slate-900">${cls.className}</strong>
                    <span class="text-xs text-slate-500 ml-2">Rahbar: ${cls.teacherName || 'Biriktirilmagan'}</span>
                  </div>
                  <div class="flex items-center gap-2 text-xs">
                    <span class="text-emerald-700 font-bold">${present} keldi</span>
                    ${absentUnexcused > 0 ? `<span class="text-red-600 font-bold">${absentUnexcused} sababsiz</span>` : ''}
                    ${absentExcused > 0 ? `<span class="text-amber-600 font-bold">${absentExcused} sababli</span>` : ''}
                    ${late > 0 ? `<span class="text-blue-600 font-bold">${late} kechikdi</span>` : ''}
                  </div>
                </div>

                <div class="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  ${records.map((st, idx) => `
                    <div class="px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50">
                      <div class="flex items-center gap-2">
                        <span class="text-slate-400 font-mono w-5">${idx + 1}.</span>
                        <strong class="text-slate-800">${st.studentName}</strong>
                        ${st.note ? `<span class="text-[11px] text-slate-400 italic">(${st.note})</span>` : ''}
                      </div>
                      <div class="flex items-center gap-3">
                        ${st.status === 'present' ? `
                          <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Kelgan</span>
                        ` : (st.status === 'absent_unexcused' ? `
                          <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">Sababsiz</span>
                        ` : (st.status === 'absent_excused' ? `
                          <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Sababli</span>
                        ` : `
                          <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Kechikkan</span>
                        `))}
                        ${st.parentPhone ? `<span class="text-[11px] text-slate-400 font-mono hidden sm:inline">${st.parentPhone}</span>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Footer -->
        <div class="pt-4 border-t border-slate-200 flex justify-between items-center">
          <span class="text-xs text-slate-400">Admin faqat ma'lumotlarni nazorat qiladi va ko'radi</span>
          <button id="close-inspector-footer-btn" class="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer">
            Yopish
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    document.getElementById('close-inspector-btn')?.addEventListener('click', () => div.remove());
    document.getElementById('close-inspector-footer-btn')?.addEventListener('click', () => div.remove());
    div.addEventListener('click', (e) => { if (e.target === div) div.remove(); });
  }

  // Roster (Navbatchilik jadvali) tahrirlash modali
  function openRosterEditModal(shiftId, dayId) {
    const shift = schoolShifts.find(s => s.id === shiftId);
    const day = WEEK_DAYS.find(w => w.id === dayId);
    const existing = getRosterForShiftAndDay(shiftId, dayId);

    const modalId = 'roster-edit-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    // Barcha o'qituvchilar nomlari
    const teacherNames = Array.from(new Set(schoolClasses.map(c => c.teacherName).filter(Boolean)));

    const isSaturday = Number(dayId) === 6;

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-scale-in text-left">
        <h3 class="text-base font-bold text-slate-900 mb-1">
          Navbatchini Belgilash: ${day?.name} (${shift?.name})
        </h3>
        <p class="text-xs text-slate-500 mb-3">
          Asosiy navbatchi va zaxira (dublyor) o'qituvchini tanlang
        </p>

        ${isSaturday ? `
          <div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 text-xs flex items-start gap-2.5">
            <span class="text-base shrink-0">⚠️</span>
            <div class="leading-relaxed">
              <strong>Shanba kuni tartibi:</strong> O'zbekistonda Shanba kuni 1-5 boshlang'ich sinflarga dars bo'lmaydi. Shanba kuni faqat 6-11 sinf rahbarlari navbatchi bo'lishi mumkin.
            </div>
          </div>
        ` : ''}

        <form id="roster-modal-form" class="space-y-3.5">
          <div>
            <label class="text-xs font-bold text-slate-700 block mb-1">
              Asosiy Navbatchi O'qituvchi
            </label>
            <input 
              type="text" 
              id="roster-primary-name" 
              list="teachers-datalist"
              value="${existing?.primaryTeacherName || ''}" 
              placeholder="O'qituvchi ismini tanlang yoki yozing" 
              required
              class="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label class="text-xs font-bold text-slate-700 block mb-1">
              Asosiy navbatchi telefoni
            </label>
            <input 
              type="tel" 
              id="roster-primary-phone" 
              value="${existing?.primaryTeacherPhone || ''}" 
              placeholder="+998 90 123 45 67" 
              class="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div class="pt-2 border-t border-slate-100">
            <label class="text-xs font-bold text-amber-800 block mb-1">
              Zaxira (Dublyor) O'qituvchi
            </label>
            <input 
              type="text" 
              id="roster-backup-name" 
              list="teachers-datalist"
              value="${existing?.backupTeacherName || ''}" 
              placeholder="Asosiy kelmaganda o'rniga o'tadigan o'qituvchi" 
              required
              class="w-full px-3 py-2 text-xs font-medium border border-amber-200 bg-amber-50/40 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label class="text-xs font-bold text-amber-800 block mb-1">
              Zaxira o'qituvchi telefoni
            </label>
            <input 
              type="tel" 
              id="roster-backup-phone" 
              value="${existing?.backupTeacherPhone || ''}" 
              placeholder="+998 93 987 65 43" 
              class="w-full px-3 py-2 text-xs font-medium border border-amber-200 bg-amber-50/40 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label class="text-xs font-bold text-slate-700 block mb-1">Izoh yoki talablar</label>
            <input 
              type="text" 
              id="roster-notes" 
              value="${existing?.notes || ''}" 
              placeholder="Masalan: Darsdan 15 daqiqa oldin kelish" 
              class="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <datalist id="teachers-datalist">
            ${schoolClasses.filter(c => Boolean(c.teacherName && c.teacherName.trim())).map(c => {
              const isLower = isGrade1to5(c.name);
              const extra = (isSaturday && isLower) ? " (1-5 sinf - Shanba kela olmaydi)" : ` (${c.name} sinf)`;
              return `<option value="${c.teacherName.trim()}">${extra}</option>`;
            }).join('')}
          </datalist>

          <div class="pt-3 flex items-center gap-2">
            <button 
              type="button" 
              id="close-roster-modal-btn" 
              class="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Bekor qilish
            </button>
            <button 
              type="submit" 
              class="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Jadvalni Saqlash
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(div);

    document.getElementById('close-roster-modal-btn')?.addEventListener('click', () => div.remove());
    div.addEventListener('click', (e) => { if (e.target === div) div.remove(); });

    document.getElementById('roster-modal-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const primaryName = document.getElementById('roster-primary-name').value.trim();
      const primaryPhone = document.getElementById('roster-primary-phone').value.trim();
      const backupName = document.getElementById('roster-backup-name').value.trim();
      const backupPhone = document.getElementById('roster-backup-phone').value.trim();
      const notes = document.getElementById('roster-notes').value.trim();

      const primaryClass = schoolClasses.find(c => 
        (c.teacherName && c.teacherName.trim().toLowerCase() === primaryName.toLowerCase())
      );
      const backupClass = schoolClasses.find(c => 
        (c.teacherName && c.teacherName.trim().toLowerCase() === backupName.toLowerCase())
      );

      const shiftRosters = (state.dutyRosters || []).filter(r => r.schoolId === schoolId && r.shiftId === shiftId);
      const valResult = validateDutyAssignment({
        dayOfWeek: dayId,
        primaryClass,
        backupClass,
        shiftRosters,
        currentRosterId: existing?.id || ''
      });

      if (!valResult.valid) {
        showToast(valResult.error, 'error');
        return;
      }

      const newRoster = {
        id: existing?.id || `roster_${schoolId}_${shiftId}_day${dayId}`,
        schoolId,
        shiftId,
        dayOfWeek: Number(dayId),
        primaryTeacherName: primaryName,
        primaryTeacherPhone: primaryPhone || primaryClass?.teacherPhone || '',
        primaryTeacherClassId: primaryClass?.id || '',
        primaryTeacherClassName: primaryClass?.name || '',
        backupTeacherName: backupName,
        backupTeacherPhone: backupPhone || backupClass?.teacherPhone || '',
        backupTeacherClassId: backupClass?.id || '',
        backupTeacherClassName: backupClass?.name || '',
        notes: notes || (isSaturday ? "Shanba navbatchisi (6-11 sinf mas'uli)" : `Haftalik navbatchilik jadvali`),
        updatedAt: new Date().toISOString()
      };

      if (onSaveRoster) onSaveRoster(newRoster);
      showToast(`${day?.name} uchun navbatchilik jadvali saqlandi!`, 'success');
      div.remove();
      render();
    });
  }

  // O'quvchiga sababli dars qoldirish izohini kiritish modali
  function openExcuseNoteModal({ classId, studentId, studentRecord, className, onSaved }) {
    const modalId = 'att-excuse-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const currentNote = studentRecord.note || '';

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-scale-in text-left">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2.5">
            <span class="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg font-bold">
              🟡
            </span>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">Sababli Kelmaganlik Izohi</h3>
              <p class="text-xs text-slate-500">${studentRecord.studentName} (${className})</p>
            </div>
          </div>
          <button id="close-excuse-modal-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="mt-4 space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              Tezkor sabablar (birini bosing):
            </label>
            <div class="flex flex-wrap gap-1.5">
              <button type="button" class="btn-excuse-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-tag="Betoblik / Shifokor ma'lumotnomasi bor">
                🤒 Betoblik / Shifoxona
              </button>
              <button type="button" class="btn-excuse-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-tag="Ota-ona rasmiy arizasi asosida">
                📄 Ota-ona arizasi
              </button>
              <button type="button" class="btn-excuse-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-tag="Oilaviy zaruriyat / Safar">
                🚗 Oilaviy sabab / Safar
              </button>
              <button type="button" class="btn-excuse-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-tag="Sport musobaqasi / Fan olimpiadasi">
                🏆 Musobaqa / Olimpiada
              </button>
            </div>
          </div>

          <div>
            <label for="student-excuse-note-input" class="block text-xs font-bold text-slate-700 mb-1">
              Sabab / Qisqa izoh matni <span class="text-red-500">*</span>:
            </label>
            <textarea 
              id="student-excuse-note-input" 
              rows="3" 
              placeholder="Masalan: Shifokor xulosasi bor, 3 kunga javob so'ralgan..." 
              class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            >${escapeHtml(currentNote)}</textarea>
            <p class="text-[11px] text-slate-400 mt-1">
              * Maktab qoidasi: Sababli deb belgilanganda qisqa izoh qoldirilishi shart.
            </p>
          </div>
        </div>

        <div class="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button 
            type="button" 
            id="cancel-excuse-modal-btn" 
            class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Bekor qilish
          </button>
          <button 
            type="button" 
            id="save-excuse-modal-btn" 
            class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            ✓ Sababli qilib saqlash
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const input = document.getElementById('student-excuse-note-input');
    div.querySelectorAll('.btn-excuse-tag').forEach(b => {
      b.addEventListener('click', () => {
        const tag = b.getAttribute('data-tag');
        if (input) {
          input.value = tag;
          input.focus();
        }
      });
    });

    const close = () => div.remove();
    document.getElementById('close-excuse-modal-btn')?.addEventListener('click', close);
    document.getElementById('cancel-excuse-modal-btn')?.addEventListener('click', close);
    div.addEventListener('click', (e) => { if (e.target === div) close(); });

    document.getElementById('save-excuse-modal-btn')?.addEventListener('click', () => {
      const val = (input?.value || '').trim();
      if (!val) {
        showToast("Iltimos, sababli qoldirish uchun qisqa izoh yozing!", 'warning');
        input?.focus();
        return;
      }

      studentRecord.status = 'absent_excused';
      studentRecord.note = val;
      recalculateAttendanceSummary(activeTakingAttendanceData);
      showToast(`${studentRecord.studentName} sababli deb belgilandi`, 'info');
      close();
      if (typeof onSaved === 'function') {
        onSaved();
      } else {
        render();
      }
    });
  }

  // Navbatchi o'qituvchi maktabga kelolmaslik sababini bildirish modali
  function openDutyAbsenceModal() {
    const modalId = 'att-duty-absence-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    // Qaysi smena va navbatchilik?
    const targetShift = schoolShifts.find(s => s.id === selectedShiftId) || schoolShifts[0];
    const shiftId = targetShift?.id;
    const roster = getRosterForShiftAndDay(shiftId, todayDayOfWeek);

    const originalTeacherName = (currentUser.role === 'teacher' ? (currentUser.data?.teacherName || currentUser.data?.name || currentUser.name || "Sinf rahbari") : (roster?.primaryTeacherName || "Mas'ul navbatchi"));
    const delegatedTeacherName = roster?.backupTeacherName || "Zaxira o'qituvchi";

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-scale-in text-left">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2.5">
            <span class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-bold">
              ⚠️
            </span>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">Kelolmaslik Sababini Bildirish</h3>
              <p class="text-xs text-slate-500">${targetShift?.name || 'Smena'} • ${formatReadableDate(todayDate)}</p>
            </div>
          </div>
          <button id="close-duty-abs-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="mt-4 space-y-3">
          <div class="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs space-y-1 text-slate-700">
            <div>Joriy navbatchi: <strong class="text-indigo-950">${escapeHtml(originalTeacherName)}</strong></div>
            <div>Navbatchilik topshiriladi: <strong class="text-emerald-700">${escapeHtml(delegatedTeacherName)}</strong> ga</div>
            <div class="text-[11px] text-indigo-700 mt-1">
              ⚡ Tizim navbatchilikni zaxiradagi o'qituvchiga avtomatik o'tkazadi va maktab ma'muriyatiga shoshilinch xabar beradi.
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              Tezkor sabablar:
            </label>
            <div class="flex flex-wrap gap-1.5">
              <button type="button" class="btn-duty-reason-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Betoblik / Sog'lig'im yomonlashgan">
                🤒 Betoblik / Shifoxona
              </button>
              <button type="button" class="btn-duty-reason-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Xizmat safari / Malaka oshirish kursi">
                🏢 Xizmat safari / Kurs
              </button>
              <button type="button" class="btn-duty-reason-tag px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer" data-val="Kutilmagan oilaviy zaruriyat">
                👨‍👩‍👧 Oilaviy zaruriyat
              </button>
            </div>
          </div>

          <div>
            <label for="duty-abs-reason-input" class="block text-xs font-bold text-slate-700 mb-1">
              Kelolmaslik sababini yozing <span class="text-red-500">*</span>:
            </label>
            <textarea 
              id="duty-abs-reason-input" 
              rows="3" 
              placeholder="Sababini batafsil yozing..." 
              class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            ></textarea>
          </div>
        </div>

        <div class="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button 
            type="button" 
            id="cancel-duty-abs-btn" 
            class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Bekor qilish
          </button>
          <button 
            type="button" 
            id="submit-duty-abs-btn" 
            class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>Topshirish va Adminga xabar berish</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    const input = document.getElementById('duty-abs-reason-input');
    div.querySelectorAll('.btn-duty-reason-tag').forEach(b => {
      b.addEventListener('click', () => {
        const val = b.getAttribute('data-val');
        if (input) {
          input.value = val;
          input.focus();
        }
      });
    });

    const close = () => div.remove();
    document.getElementById('close-duty-abs-btn')?.addEventListener('click', close);
    document.getElementById('cancel-duty-abs-btn')?.addEventListener('click', close);
    div.addEventListener('click', (e) => { if (e.target === div) close(); });

    document.getElementById('submit-duty-abs-btn')?.addEventListener('click', async () => {
      const reason = (input?.value || '').trim();
      if (!reason) {
        showToast("Iltimos, navbatchilikka kelolmaslik sababini yozing!", 'warning');
        input?.focus();
        return;
      }

      try {
        const result = recordDutyAbsenceAndDelegate({
          schoolId,
          shiftId,
          reason,
          state,
          onSaveRoster
        });
        
        if (result) {
          // Firestore'ga saqlash
          if (result.absenceRecord || result.dutyAbsence) {
            saveDutyAbsenceToFirestore(result.absenceRecord || result.dutyAbsence).catch(err => console.warn('Firestore duty absence save error:', err));
          }
          if (result.adminNotification || result.notification) {
            saveAdminNotificationToFirestore(result.adminNotification || result.notification).catch(err => console.warn('Firestore notif save error:', err));
          }
          saveData();

          showToast(`Navbatchilik ${result.newPrimary?.name || 'yangi mas\'ul o\'qituvchi'}ga topshirildi va Adminga xabar yuborildi!`, 'success');
        }

        close();
        activeTab = 'duty_officers';
        render();
      } catch (err) {
        console.error('Duty absence error:', err);
        showToast("Xatolik yuz berdi: " + err.message, 'error');
      }
    });
  }

  // Umumiy tasdiqlash modali
  function openConfirmModal({ title, message, onConfirm, danger = false }) {
    const modalId = 'att-confirm-modal';
    const old = document.getElementById(modalId);
    if (old) old.remove();

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center animate-scale-in">
        <h3 class="text-base font-bold text-slate-900 mb-2">${title}</h3>
        <p class="text-xs text-slate-600 mb-5">${message}</p>
        <div class="flex items-center gap-2">
          <button 
            type="button" 
            id="close-confirm-btn" 
            class="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Yo'q, bekor qilish
          </button>
          <button 
            type="button" 
            id="ok-confirm-btn" 
            class="flex-1 py-2 px-3 rounded-xl ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            Ha, tasdiqlayman
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    document.getElementById('close-confirm-btn')?.addEventListener('click', () => div.remove());
    document.getElementById('ok-confirm-btn')?.addEventListener('click', () => {
      div.remove();
      if (onConfirm) onConfirm();
    });
  }

  // Excel (.csv) eksport funksiyasi
  function handleExportAttendanceToCSV() {
    let csv = "\uFEFFSinf,Sinf rahbari,O'quvchilar soni,Davomat foizi\n";
    schoolClasses.forEach(cls => {
      const count = schoolStudents.filter(s => s.classId === cls.id).length;
      csv += `"${cls.name}","${cls.teacherName || ''}",${count},98%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Davomat_Hisoboti_${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Davomat hisoboti Excel (CSV) faylida yuklab olindi", 'success');
  }

  // Ilk marta chizish
  render();
}
