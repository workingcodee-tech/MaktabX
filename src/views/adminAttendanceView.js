/**
 * MaktabX - Maktab Ma'muriyati (Admin) Davomat Sahifasi
 * 
 * - Eng asosiysi va birinchi bo'lib: Katta umumiy maktab davomati & Guruhlar davomati foizi bilan
 * - Har bir bo'lim uchun kichkina va qulay tugmalar:
 *   1-bo'lim: O'quvchilar davomati (necha foiz kelgani, sababli va sababsiz kelmaganlar, sababini ko'rish)
 *   2-bo'lim: Guruhlar boshqaruvi (bir qator bo'lib guruhlar, tahrirlash/o'chirishda boshqa guruhga qo'shish, guruh bosilganda faqat uning sinflari)
 *   3-bo'lim: O'qituvchilar davomati (kelmagan o'qituvchilar, sabablari, alifbo tartibi)
 *   4-bo'lim: Davomat arxivi (oxirgi 1 oygacha bo'lgan davomatni ko'rish)
 * - Diqqat: O'quvchilar va o'qituvchilar qat'iy ALIFBO TARTIBIDA!
 */

import { 
  WEEK_DAYS,
  getDayName,
  getTodayDayOfWeek,
  getTodayISODate, 
  formatReadableDate, 
  compareClassNames, 
  matchesPhone, 
  normalizeText,
  getStudentContactPhone,
  cleanPhone,
  getTodayDutyTeachersForSchool,
  generateOrderlyDutyRosters,
  saveData,
  isGrade1to5,
  validateDutyAssignment,
  excludeClassFromDutyShifts,
  includeClassToDutyShift,
  getSubmittedClassesForDate,
  recordClassAttendanceSubmission
} from '../data.js';
import { 
  saveShiftToFirestore, 
  deleteShiftFromFirestore, 
  saveAttendanceRecordToFirestore,
  deleteAttendanceRecordFromFirestore,
  saveDutyRosterToFirestore
} from '../firebase.js';
import { sendSMSWithMultiGateway } from '../services/smsService.js';
import { openAdminAttendanceGraphModal, getAttendanceRateColor } from './adminAttendanceGraphModal.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderAdminAttendanceView(container, {
  state,
  currentSchool,
  onSaveShift,
  onDeleteShift,
  onSaveAttendanceRecord,
  showToast
}) {
  const schoolId = currentSchool.id;

  // Local state
  let activeSection = 'overview'; // 'overview' | 'students' | 'groups' | 'teachers' | 'archive'
  let selectedDate = getTodayISODate();
  let studentAbsenceFilter = 'all_absent'; // 'all_absent' | 'excused' | 'unexcused' | 'all_students'
  let selectedClassFilterForStudents = 'all'; // 'all' | classId
  let selectedGroupIdForDetail = null; // clicked group ID to show only its classes
  let archiveViewingDate = null; // when inspecting an archive day in a dedicated view
  let archiveIsEditMode = false; // editing archive attendance
  let selectedClassAttendance = null; // { classId: string, date: string } - alohida sinf davomati sahifasi
  let singleClassStatusFilter = 'all'; // 'all' | 'present' | 'absent' | 'excused' | 'unexcused'
  let singleClassSearchQuery = '';
  let studentSearchQuery = '';
  let teacherSearchQuery = '';
  let selectedRosterShiftId = '';
  let isSendingSmsId = null;

  // Maktab sinflari va o'quvchilari
  const schoolClasses = (state.classes || [])
    .filter(c => c.schoolId === schoolId)
    .sort((a, b) => compareClassNames(a.name, b.name));

  const classMap = new Map();
  schoolClasses.forEach(c => classMap.set(c.id, c));

  const schoolStudents = (state.students || []).filter(s => {
    if (s.schoolId === schoolId) return true;
    const cls = classMap.get(s.classId);
    return Boolean(cls);
  });

  // Smenalar yaxlitligini ta'minlash:
  // 1. Agar hali birorta ham smena yaratilmagan bo'lsa, standart 1-smena yaratiladi
  // 2. Birorta ham sinf 2 ta smenaga bir vaqtda yozilishi mumkin emas (har bir sinf ko'pi bilan 1 ta smenada bo'ladi).
  // 3. Smenalardan chiqarilgan (qo'shilmagan) sinflar navbatchilikdan mustasno bo'lib qoladi.
  function ensureShiftsIntegrity() {
    let shifts = (state.shifts || []).filter(s => s.schoolId === schoolId);
    if (shifts.length === 0) {
      const allClassIds = schoolClasses.map(c => c.id);
      const defaultShift = {
        id: `shift_1_${schoolId}`,
        schoolId,
        name: "1-smena",
        startTime: "08:00",
        endTime: "13:00",
        cutoffTime: "08:30",
        classIds: allClassIds,
        createdAt: new Date().toISOString()
      };
      if (!state.shifts) state.shifts = [];
      state.shifts.push(defaultShift);
      shifts = [defaultShift];
      saveData(state);
      if (onSaveShift) onSaveShift(defaultShift);
    } else {
      // Bir sinf bir vaqtning o'zida ikkita smenaga yozilib qolmasligini ta'minlash
      const assignedMap = new Set();
      let changed = false;

      shifts.forEach(shift => {
        const uniqueIds = [];
        (shift.classIds || []).forEach(cId => {
          if (!assignedMap.has(cId) && schoolClasses.some(c => c.id === cId)) {
            assignedMap.add(cId);
            uniqueIds.push(cId);
          } else {
            changed = true;
          }
        });
        if (uniqueIds.length !== (shift.classIds || []).length) {
          shift.classIds = uniqueIds;
          changed = true;
        }
      });

      if (changed) {
        saveData(state);
      }
    }
    return (state.shifts || []).filter(s => s.schoolId === schoolId);
  }

  let schoolShifts = ensureShiftsIntegrity();

  // Davomat yozuvlari
  const schoolAttendanceRecords = (state.attendanceRecords || []).filter(r => r.schoolId === schoolId);

  // Berilgan sana uchun davomat holati
  function getAttendanceForDate(dateStr) {
    const records = (state.attendanceRecords || []).filter(r => r.schoolId === schoolId && r.date === dateStr);
    
    // 1. Qaysi sinflar bo'yicha davomat olingan (topshirilgan)?
    const markedClassIds = new Set();
    const studentStatusMap = new Map(); // studentId -> { status, isExcused, reason, note, submittedBy, submittedAt }
    const teacherStatusMap = new Map(); // teacherName -> { status, isExcused, reason, className, phone, reportedAt }

    // Birinchi navbatda TOPSHIRILGAN (isSubmittedToAdmin === true) sinflarni to'plash
    records.forEach(rec => {
      if (rec.classAttendance) {
        Object.entries(rec.classAttendance).forEach(([cId, clsAtt]) => {
          if (clsAtt && clsAtt.isSubmittedToAdmin && clsAtt.records && Object.keys(clsAtt.records).length > 0) {
            markedClassIds.add(cId);
            Object.entries(clsAtt.records).forEach(([sId, sData]) => {
              const st = sData.status || 'present';
              const isEx = Boolean(sData.isExcused || sData.status === 'excused' || sData.status === 'absent_excused');
              studentStatusMap.set(sId, {
                status: st,
                isExcused: isEx,
                reason: sData.reason || sData.note || (isEx ? "Sababli dars qoldirilgan" : ""),
                note: sData.note || '',
                submittedBy: clsAtt.submittedBy || rec.dutyTeacher?.name || '',
                submittedAt: clsAtt.submittedAt || rec.updatedAt || ''
              });
            });
          }
        });
      }
    });

    // Agar hali birorta ham sinf rasman isSubmittedToAdmin qilinmagan bo'lsa,
    // lekin recordda haqiqiy davomat olingan (kamida bitta kelmagan belgisi bor yoki record 'completed' bo'lsa):
    if (markedClassIds.size === 0) {
      records.forEach(rec => {
        if (rec.classAttendance) {
          Object.entries(rec.classAttendance).forEach(([cId, clsAtt]) => {
            if (clsAtt && clsAtt.records && Object.keys(clsAtt.records).length > 0) {
              const hasModifications = Object.values(clsAtt.records).some(r => r.status && r.status !== 'present');
              if (hasModifications || rec.status === 'completed') {
                markedClassIds.add(cId);
                Object.entries(clsAtt.records).forEach(([sId, sData]) => {
                  const st = sData.status || 'present';
                  const isEx = Boolean(sData.isExcused || sData.status === 'excused' || sData.status === 'absent_excused');
                  studentStatusMap.set(sId, {
                    status: st,
                    isExcused: isEx,
                    reason: sData.reason || sData.note || (isEx ? "Sababli dars qoldirilgan" : ""),
                    note: sData.note || '',
                    submittedBy: clsAtt.submittedBy || rec.dutyTeacher?.name || '',
                    submittedAt: clsAtt.submittedAt || rec.updatedAt || ''
                  });
                });
              }
            }
          });
        }
      });
    }

    // Topshirilgan sinflar ro'yxati (har bir sinf bo'yicha aniq ma'lumotlar bilan)
    const submittedClasses = [];
    schoolClasses.forEach(cls => {
      if (markedClassIds.has(cls.id)) {
        let foundCls = null;
        for (const rec of records) {
          if (rec.classAttendance?.[cls.id]?.isSubmittedToAdmin) {
            foundCls = rec.classAttendance[cls.id];
            break;
          }
        }
        if (!foundCls) {
          for (const rec of records) {
            if (rec.classAttendance?.[cls.id]) {
              foundCls = rec.classAttendance[cls.id];
              break;
            }
          }
        }
        if (foundCls) {
          const clsStudents = schoolStudents.filter(s => s.classId === cls.id);
          let pCount = 0;
          let eCount = 0;
          let uCount = 0;
          clsStudents.forEach(st => {
            const att = studentStatusMap.get(st.id);
            if (!att || att.status === 'present' || att.status === 'late') pCount++;
            else if (att.isExcused) eCount++;
            else uCount++;
          });
          submittedClasses.push({
            classId: cls.id,
            className: cls.name,
            teacherName: cls.teacherName || '',
            totalStudents: clsStudents.length,
            presentCount: pCount,
            absentCount: eCount + uCount,
            excusedCount: eCount,
            unexcusedCount: uCount,
            submittedBy: foundCls.submittedBy || 'Navbatchi o\'qituvchi',
            submittedAt: foundCls.submittedAt || ''
          });
        }
      }
    });

    // O'qituvchilar davomati (rec ichidagi)
    records.forEach(rec => {
      if (Array.isArray(rec.teacherAttendance)) {
        rec.teacherAttendance.forEach(t => {
          if (t && t.teacherName) {
            const isEx = Boolean(t.isExcused || t.status === 'excused' || t.status === 'absent_excused');
            teacherStatusMap.set(t.teacherName, {
              status: t.status || 'present',
              isExcused: isEx,
              reason: t.reason || t.note || (isEx ? "Sababli dars qoldirgan" : ""),
              className: t.className || '',
              phone: t.phone || ''
            });
          }
        });
      }
    });

    // 2. Maktabga kela olmagan o'qituvchilar (dutyAbsences orqali dars qoldirish sababini yuborganlar)
    const todayISO = getTodayISODate();
    const schoolAbsences = (state.dutyAbsences || []).filter(a => 
      a.schoolId === schoolId && 
      (a.date === dateStr || (dateStr === todayISO && a.date === todayISO))
    );
    schoolAbsences.forEach(abs => {
      const tName = (abs.originalTeacherName || '').trim();
      const classId = abs.originalTeacherClassId;
      const absenceInfo = {
        status: 'absent_excused',
        isExcused: true,
        reason: abs.reason || "Sababli dars qoldirilgan",
        className: abs.originalTeacherClassName || '',
        phone: abs.originalTeacherPhone || '',
        reportedAt: abs.reportedAt || '',
        isDutyTeacher: Boolean(abs.isDutyTeacher)
      };
      if (tName) {
        teacherStatusMap.set(tName, absenceInfo);
        teacherStatusMap.set(tName.toLowerCase(), absenceInfo);
      }
      if (classId) {
        teacherStatusMap.set(classId, absenceInfo);
      }
    });

    // 3. DIQQAT TALABI: ADMIN PANELGA FAQAT DAVOMAT OLINGAN SINFLAR FOIZI HISOBLAB KELIB CHIQADI!
    const studentsInMarkedClasses = schoolStudents.filter(s => markedClassIds.has(s.classId));
    const totalStudents = studentsInMarkedClasses.length;
    let presentCount = 0;
    let absentExcusedCount = 0;
    let absentUnexcusedCount = 0;

    studentsInMarkedClasses.forEach(st => {
      const att = studentStatusMap.get(st.id);
      if (!att || att.status === 'present' || att.status === 'late') {
        presentCount++;
      } else if (att.isExcused || att.status === 'excused' || att.status === 'absent_excused') {
        absentExcusedCount++;
      } else {
        absentUnexcusedCount++;
      }
    });

    const totalAbsent = absentExcusedCount + absentUnexcusedCount;
    // Agar birorta ham sinfdan davomat olinmagan bo'lsa -> 0% ko'rsatiladi, aks holda olingan sinflar bo'yicha aniq foiz
    const rate = totalStudents > 0 
      ? Math.round((presentCount / totalStudents) * 1000) / 10 
      : 0;

    // Guruhlar (Smenalar) kesimida foizlar (faqat davomat olingan sinflar bo'yicha)
    const groupsStats = schoolShifts.map(shift => {
      const shiftClassIds = new Set(shift.classIds || []);
      const shiftMarkedClassIds = (shift.classIds || []).filter(cId => markedClassIds.has(cId));
      const shiftStudents = schoolStudents.filter(s => shiftClassIds.has(s.classId) && markedClassIds.has(s.classId));
      let gPresent = 0;
      let gExcused = 0;
      let gUnexcused = 0;

      shiftStudents.forEach(st => {
        const att = studentStatusMap.get(st.id);
        if (!att || att.status === 'present' || att.status === 'late') {
          gPresent++;
        } else if (att.isExcused || att.status === 'excused' || att.status === 'absent_excused') {
          gExcused++;
        } else {
          gUnexcused++;
        }
      });

      const gTotal = shiftStudents.length;
      const gRate = gTotal > 0 ? Math.round((gPresent / gTotal) * 1000) / 10 : 0;

      return {
        shift,
        total: gTotal,
        present: gPresent,
        excused: gExcused,
        unexcused: gUnexcused,
        absent: gExcused + gUnexcused,
        rate: gRate,
        markedClassesCount: shiftMarkedClassIds.length,
        totalClassesCount: (shift.classIds || []).length
      };
    });

    return {
      date: dateStr,
      totalStudents,
      presentCount,
      absentExcusedCount,
      absentUnexcusedCount,
      totalAbsent,
      rate,
      groupsStats,
      studentStatusMap,
      teacherStatusMap,
      markedClassIds,
      markedClassesCount: markedClassIds.size,
      totalClassesCount: schoolClasses.length,
      submittedClasses
    };
  }

  // SMS yuborish
  async function handleSendStudentSms(student, className, isExcused, reason) {
    const contact = getStudentContactPhone(student);
    if (!contact || !contact.number) {
      showToast("O'quvchining ota-onasi telefon raqami mavjud emas", 'error');
      return;
    }

    const cleanNum = contact.number.replace(/\D/g, '');
    if (cleanNum.length < 9) {
      showToast("Telefon raqami noto'g'ri shaklda", 'error');
      return;
    }

    const fullName = student.fullName || `${student.lastName || ''} ${student.firstName || ''}`.trim();
    const reasonText = isExcused ? `sababli (${reason || 'ariza asosida'})` : "sababsiz";
    const msg = `Hurmatli ota-ona! Farzandingiz ${fullName} bugun (${formatReadableDate(selectedDate)}) ${className} sinfida darsga ${reasonText} qatnashmadi. ${currentSchool.name}.`;

    isSendingSmsId = student.id;
    render();

    try {
      const res = await sendSMSWithMultiGateway({
        phone: contact.number,
        message: msg,
        schoolName: currentSchool.name
      });
      if (res && (res.success || res.status === 'sent')) {
        showToast(`${fullName} ota-onasiga SMS xabarnoma yuborildi`, 'success');
      } else {
        showToast(res.message || "SMS xabarnoma yuborildi", 'success');
      }
    } catch (e) {
      showToast("SMS xizmatida xatolik: " + (e.message || "Tarmoq xatosi"), 'error');
    } finally {
      isSendingSmsId = null;
      render();
    }
  }

  // Sababni ko'rish / tahrirlash modali
  function openReasonModal(student, currentReason, isExcused, onSave) {
    const modalId = 'admin-student-reason-modal';
    document.getElementById(modalId)?.remove();

    const fullName = student.fullName || `${student.lastName || ''} ${student.firstName || ''}`.trim();
    const cls = classMap.get(student.classId);
    const className = cls ? cls.name : (student.className || '');

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-5 sm:p-6 animate-scale-in text-left">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl font-bold">
              📝
            </span>
            <div>
              <h3 class="text-base font-bold text-slate-900">Dars qoldirish sababi</h3>
              <p class="text-xs text-slate-500">${escapeHtml(fullName)} • ${escapeHtml(className)}</p>
            </div>
          </div>
          <button id="close-reason-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="mt-4 space-y-3.5">
          <div class="flex items-center gap-2 p-2.5 rounded-xl ${isExcused ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-red-50 text-red-800 border border-red-200'} text-xs font-semibold">
            <span>${isExcused ? '⚠️ Sababli kelmagan' : '🚫 Sababsiz kelmagan'}</span>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">
              Kelmaganlik sababi:
            </label>
            <textarea 
              id="student-reason-textarea" 
              rows="3" 
              placeholder="Masalan: Sog'ligi tufayli shifokor ko'rigida, oilaviy sharoit, musobaqada..." 
              class="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
            >${escapeHtml(currentReason || '')}</textarea>
          </div>

          <div class="flex items-center gap-2 pt-2 border-t border-slate-100 justify-end">
            <button 
              type="button" 
              id="cancel-reason-btn" 
              class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Yopish
            </button>
            <button 
              type="button" 
              id="save-reason-btn" 
              class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95"
            >
              Saqlash
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('#close-reason-modal')?.addEventListener('click', close);
    div.querySelector('#cancel-reason-btn')?.addEventListener('click', close);

    div.querySelector('#save-reason-btn')?.addEventListener('click', () => {
      const val = div.querySelector('#student-reason-textarea')?.value.trim();
      if (onSave) onSave(val);
      close();
    });
  }

  // Guruh qo'shish yoki tahrirlash modali
  function openGroupModal(shiftToEdit = null) {
    const isEdit = Boolean(shiftToEdit);
    const modalId = 'admin-group-modal';
    document.getElementById(modalId)?.remove();

    const initialName = shiftToEdit ? shiftToEdit.name : `${schoolShifts.length + 1}-smena`;
    const initialStart = shiftToEdit?.startTime || "08:00";
    const initialEnd = shiftToEdit?.endTime || "13:00";
    const assignedClassIds = new Set(shiftToEdit?.classIds || []);

    // DIQQAT TALABI: Bitta sinf ikkita smenaga yozilishi mumkin emas!
    // Birinchi smenaga 5-A yozilgan bo'lsa, 2-smenani qo'shish yoki tahrirlashda 5-A ko'rinmaydi!
    const otherShiftsClassIds = new Set();
    schoolShifts.forEach(s => {
      if (!shiftToEdit || s.id !== shiftToEdit.id) {
        (s.classIds || []).forEach(cId => otherShiftsClassIds.add(cId));
      }
    });

    const eligibleClasses = schoolClasses.filter(cls => !otherShiftsClassIds.has(cls.id));

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 sm:p-6 animate-scale-in text-left max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-xl font-bold">
              👥
            </span>
            <div>
              <h3 class="text-base font-bold text-slate-900">
                ${isEdit ? "Guruhni (Smenani) Tahrirlash" : "Yangi Guruh (Smena) Qo'shish"}
              </h3>
              <p class="text-xs text-slate-500">Sinflarni qo'shish yoki kamaytirish</p>
            </div>
          </div>
          <button id="close-group-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Guruh (Smena) nomi <span class="text-red-500">*</span></label>
            <input 
              type="text" 
              id="group-name-input" 
              value="${escapeHtml(initialName)}" 
              placeholder="Masalan: 1-smena (Ertalabki)" 
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold text-slate-900"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Boshlanish vaqti</label>
              <input 
                type="time" 
                id="group-start-input" 
                value="${initialStart}" 
                class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Tugash vaqti</label>
              <input 
                type="time" 
                id="group-end-input" 
                value="${initialEnd}" 
                class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
              />
            </div>
          </div>

          <!-- Ushbu guruhga sinflarni biriktirish (qo'shish yoki kamaytirish) -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-bold text-slate-700">
                Ushbu guruhga tegishli sinflar:
              </label>
              <span class="text-[11px] text-slate-500">
                Belgilangan: <strong id="selected-class-count" class="text-indigo-600 font-bold">${assignedClassIds.size}</strong> ta
              </span>
            </div>

            <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl max-h-56 overflow-y-auto space-y-1.5 divide-y divide-slate-100">
              ${eligibleClasses.length === 0 ? `
                <p class="text-xs text-slate-400 py-3 text-center">Boshqa smenalarga biriktirilmagan bo'sh sinflar mavjud emas</p>
              ` : eligibleClasses.map(cls => {
                const isChecked = assignedClassIds.has(cls.id);
                const clsStudentsCount = schoolStudents.filter(s => s.classId === cls.id).length;
                return `
                  <label class="flex items-center justify-between p-2 rounded-xl hover:bg-white cursor-pointer transition-colors pt-2">
                    <div class="flex items-center gap-2.5">
                      <input 
                        type="checkbox" 
                        class="group-class-checkbox w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" 
                        value="${cls.id}" 
                        ${isChecked ? 'checked' : ''}
                      />
                      <span class="text-xs font-bold text-slate-900">${escapeHtml(cls.name)}</span>
                      <span class="text-[11px] text-slate-500">${escapeHtml(cls.teacherName || '')}</span>
                    </div>
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200/80 text-slate-700 font-mono">
                      ${clsStudentsCount} o'quvchi
                    </span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-3 border-t border-slate-100 justify-end shrink-0 mt-4">
          <button 
            type="button" 
            id="cancel-group-modal" 
            class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Bekor qilish
          </button>
          <button 
            type="button" 
            id="save-group-modal" 
            class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95"
          >
            ${isEdit ? "O'zgarishlarni saqlash" : "Guruhni qo'shish"}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('#close-group-modal')?.addEventListener('click', close);
    div.querySelector('#cancel-group-modal')?.addEventListener('click', close);

    const checkBoxes = div.querySelectorAll('.group-class-checkbox');
    checkBoxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const count = Array.from(checkBoxes).filter(c => c.checked).length;
        const countEl = div.querySelector('#selected-class-count');
        if (countEl) countEl.textContent = String(count);
      });
    });

    div.querySelector('#save-group-modal')?.addEventListener('click', async () => {
      const name = div.querySelector('#group-name-input')?.value.trim();
      const start = div.querySelector('#group-start-input')?.value || "08:00";
      const end = div.querySelector('#group-end-input')?.value || "13:00";
      const selectedClasses = Array.from(checkBoxes).filter(c => c.checked).map(c => c.value);

      if (!name) {
        showToast("Iltimos, guruh nomini kiriting", 'error');
        return;
      }

      const updatedShift = {
        id: shiftToEdit ? shiftToEdit.id : `shift_${Date.now()}_${schoolId}`,
        schoolId,
        name,
        startTime: start,
        endTime: end,
        cutoffTime: start,
        classIds: selectedClasses,
        updatedAt: new Date().toISOString()
      };

      if (!state.shifts) state.shifts = [];
      const sIdx = state.shifts.findIndex(s => s.id === updatedShift.id);
      if (sIdx >= 0) {
        state.shifts[sIdx] = updatedShift;
      } else {
        state.shifts.push(updatedShift);
      }

      ensureShiftsIntegrity();
      saveData(state);
      try {
        await saveShiftToFirestore(updatedShift);
      } catch (e) {
        console.warn("Firestore shift save:", e);
      }

      showToast(isEdit ? "Guruh ma'lumotlari yangilandi" : "Yangi guruh muvaffaqiyatli qo'shildi", 'success');
      close();
      render();
    });
  }

  // Guruhni o'chirish (Diqqat: agar o'chirilsa barcha o'quvchilar va sinflar boshqa guruhga qo'shiladi!)
  function handleDeleteGroup(shiftToDelete) {
    if (schoolShifts.length <= 1) {
      showToast("Kamida bitta guruh qolishi shart!", 'error');
      return;
    }

    const otherShifts = schoolShifts.filter(s => s.id !== shiftToDelete.id);
    const targetShift = otherShifts[0];

    const modalId = 'admin-delete-group-modal';
    document.getElementById(modalId)?.remove();

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-5 sm:p-6 animate-scale-in text-center">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-2xl font-bold mb-3">
          ⚠️
        </div>
        <h3 class="text-base font-bold text-slate-900">Guruhni o'chirishni tasdiqlaysizmi?</h3>
        <p class="text-xs text-slate-600 mt-2">
          <strong>${escapeHtml(shiftToDelete.name)}</strong> guruhi o'chirilgach, undagi barcha sinflar va o'quvchilar avtomatik ravishda 
          <strong class="text-indigo-600 font-bold">${escapeHtml(targetShift.name)}</strong> guruhiga qo'shiladi.
        </p>

        <div class="flex items-center gap-2 mt-5">
          <button 
            type="button" 
            id="cancel-del-group" 
            class="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Bekor qilish
          </button>
          <button 
            type="button" 
            id="confirm-del-group" 
            class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95"
          >
            O'chirish va ko'chirish
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('#cancel-del-group')?.addEventListener('click', close);

    div.querySelector('#confirm-del-group')?.addEventListener('click', async () => {
      // 1. Sinflarni maqsadli guruhga qo'shish
      const mergedClassIds = Array.from(new Set([...(targetShift.classIds || []), ...(shiftToDelete.classIds || [])]));
      targetShift.classIds = mergedClassIds;

      // 2. O'chirilgan guruhni ro'yxatdan olib tashlash
      state.shifts = (state.shifts || []).filter(s => s.id !== shiftToDelete.id);
      saveData(state);

      try {
        await saveShiftToFirestore(targetShift);
        await deleteShiftFromFirestore(shiftToDelete.id);
      } catch (e) {
        console.warn("Firestore shift delete:", e);
      }

      showToast(`Guruh o'chirildi va barcha o'quvchilar "${targetShift.name}" guruhiga qo'shildi!`, 'success');
      close();
      render();
    });
  }

  // Sinf rahbarini qaysi smenaga qo'shishni tanlash modali
  function openChooseShiftModalForClass(cls) {
    const modalId = 'choose-shift-modal';
    document.getElementById(modalId)?.remove();

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm p-5 sm:p-6 animate-scale-in text-slate-800 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2.5">
            <span class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-lg font-bold">
              ➕
            </span>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">Guruhni Tanlang</h3>
              <p class="text-[11px] text-slate-500">${escapeHtml(cls.name)} (${escapeHtml(cls.teacherName || '')})</p>
            </div>
          </div>
          <button id="close-choose-shift-modal" class="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <p class="text-xs text-slate-600">
          Ushbu sinf rahbarini qaysi guruhga (smenaga) biriktirmoqchisiz? Biriktirilgach, navbatchilik jadvali yangilanadi.
        </p>

        <div class="space-y-2 pt-1">
          ${schoolShifts.map(sh => `
            <button 
              type="button" 
              class="btn-select-target-shift w-full p-3 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/70 text-left transition-all cursor-pointer flex items-center justify-between group active:scale-98"
              data-shift-id="${sh.id}"
            >
              <div>
                <strong class="text-xs sm:text-sm text-slate-900 group-hover:text-indigo-900 block">${escapeHtml(sh.name)}</strong>
                <span class="text-[11px] text-slate-500 font-mono">⏰ ${sh.startTime} - ${sh.endTime}</span>
              </div>
              <span class="text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </button>
          `).join('')}
        </div>

        <div class="pt-2 flex justify-end">
          <button 
            type="button" 
            id="cancel-choose-shift-modal" 
            class="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Bekor qilish
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('#close-choose-shift-modal')?.addEventListener('click', close);
    div.querySelector('#cancel-choose-shift-modal')?.addEventListener('click', close);

    div.querySelectorAll('.btn-select-target-shift').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftId = btn.getAttribute('data-shift-id');
        const targetShift = schoolShifts.find(s => s.id === shiftId);
        includeClassToDutyShift(cls.id, shiftId, schoolId, state);
        showToast(`${cls.name} (${cls.teacherName}) "${targetShift?.name || 'Guruh'}"ga muvaffaqiyatli qo'shildi!`, 'success');
        close();
        render();
      });
    });
  }

  function render() {
    // Agar biror sinf davomati alohida sahifada ochilgan bo'lsa (modal emas, alohida bitta sahifa!)
    if (selectedClassAttendance) {
      container.innerHTML = renderSingleClassAttendancePage();
      attachSingleClassAttendanceListeners();
      return;
    }

    const todayData = getAttendanceForDate(selectedDate);
    const todayDutyTeachers = getTodayDutyTeachersForSchool(schoolId, state, selectedDate);

    container.innerHTML = `
      <div class="space-y-4 pb-28 max-w-5xl mx-auto animate-fade-in text-slate-800">
        
        <!-- ======================================================== -->
        <!-- 1. ENG ASOSIYSI VA BIRINCHI: KATTA UMUMIY MAKTAB DAVOMATI -->
        <!-- ======================================================== -->
        <div class="bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden">
          
          <!-- Orqa fon bezagi -->
          <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
          <div class="absolute -left-10 -top-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-xl pointer-events-none"></div>

          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <!-- Chap tomon: Maktab va umumiy foiz -->
            <div class="space-y-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-white/15 text-indigo-100 backdrop-blur-xs border border-white/10">
                  📊 Bugungi Maktab Davomati
                </span>
                <span class="text-xs text-indigo-200 font-mono font-medium">
                  ${formatReadableDate(selectedDate)}
                </span>
                <button 
                  type="button" 
                  id="btn-open-class-graph" 
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white shadow-xs transition-all cursor-pointer active:scale-95 border border-emerald-400/40"
                  title="Sinflar aro davomat statistikasi grafigi"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  <span>Grafik</span>
                </button>
              </div>

              <h1 class="text-lg sm:text-2xl font-black tracking-tight text-white">
                ${escapeHtml(currentSchool.name)}
              </h1>

              <div class="flex items-baseline gap-3 pt-1">
                <div class="text-4xl sm:text-5xl font-black font-mono tracking-tight text-emerald-400 drop-shadow-sm">
                  ${todayData.rate}%
                </div>
                <div class="text-xs text-indigo-100 font-medium">
                  <div>Jami o'quvchilar: <strong>${todayData.totalStudents} nafar</strong></div>
                  <div>Darsda qatnashmoqda: <strong class="text-emerald-300 font-bold">${todayData.presentCount} nafar</strong></div>
                </div>
              </div>
            </div>

            <!-- O'ng tomon: Kelganlar va Kelmaganlar tahlil kartochkalari -->
            <div class="grid grid-cols-3 gap-2.5 sm:gap-3 bg-white/10 p-3 sm:p-4 rounded-2xl border border-white/10 backdrop-blur-md shrink-0">
              <div class="text-center p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/20">
                <div class="text-[11px] text-emerald-200 font-bold">🟢 Kelgan</div>
                <div class="text-base sm:text-xl font-black font-mono text-emerald-300 mt-0.5">${todayData.presentCount}</div>
              </div>
              <div class="text-center p-2 rounded-xl bg-amber-500/20 border border-amber-400/20">
                <div class="text-[11px] text-amber-200 font-bold">⚠️ Sababli</div>
                <div class="text-base sm:text-xl font-black font-mono text-amber-300 mt-0.5">${todayData.absentExcusedCount}</div>
              </div>
              <div class="text-center p-2 rounded-xl bg-red-500/20 border border-red-400/20">
                <div class="text-[11px] text-red-200 font-bold">🚫 Sababsiz</div>
                <div class="text-base sm:text-xl font-black font-mono text-red-300 mt-0.5">${todayData.absentUnexcusedCount}</div>
              </div>
            </div>

          </div>

          <!-- ======================================================== -->
          <!-- GURUHLAR (SMENALAR) DAVOMATI HAR BIRINING FOIZI BILAN   -->
          <!-- ======================================================== -->
          <div class="mt-5 pt-4 border-t border-white/15">
            <div class="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>👥 Guruhlar (Smenalar) Davomati:</span>
              <span class="text-[11px] font-normal lowercase text-indigo-300">har bir guruh foizi</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              ${todayData.groupsStats.map(g => `
                <div class="bg-white/10 hover:bg-white/15 border border-white/15 rounded-2xl p-3 backdrop-blur-xs transition-all flex items-center justify-between gap-3">
                  <div>
                    <h3 class="text-xs sm:text-sm font-bold text-white leading-tight">
                      ${escapeHtml(g.shift.name)}
                    </h3>
                    <p class="text-[11px] text-indigo-200 mt-0.5">
                      ${(g.shift.classIds || []).length} ta sinf • ${g.present}/${g.total} o'quvchi
                    </p>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="text-lg font-black font-mono text-emerald-400">${g.rate}%</span>
                    <span class="block text-[10px] text-indigo-200">${g.absent > 0 ? `${g.absent} ta kelmadi` : '100% kelgan'}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

        </div>

        <!-- ======================================================== -->
        <!-- XABARNOMALAR BANNERI (YANGI TOPSHIRILGAN DAVOMATLAR)     -->
        <!-- ======================================================== -->
        ${(() => {
          const unreadNotifs = (state.adminNotifications || []).filter(n => n.schoolId === schoolId && !n.read);
          if (unreadNotifs.length === 0) return '';
          return `
            <div class="p-4 rounded-2xl bg-indigo-50 border border-indigo-200/90 shadow-2xs space-y-2 animate-fade-in">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping"></span>
                  <span class="text-xs font-bold text-indigo-950 uppercase tracking-tight">
                    🔔 Yangi xabarnomalar (${unreadNotifs.length} ta)
                  </span>
                </div>
                <button 
                  type="button" 
                  id="btn-mark-all-notifs-read" 
                  class="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer transition-colors"
                >
                  Hammasini o'qildi deb belgilash
                </button>
              </div>
              <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                ${unreadNotifs.slice(0, 3).map(n => `
                  <div class="p-2.5 rounded-xl bg-white border border-indigo-100 text-xs flex items-center justify-between gap-2 shadow-2xs">
                    <div>
                      <span class="font-bold text-slate-900">${escapeHtml(n.title)}</span>
                      <p class="text-[11px] text-slate-600 mt-0.5">${escapeHtml(n.message)}</p>
                    </div>
                    <span class="text-[10px] font-mono text-slate-400 shrink-0">
                      ${n.createdAt ? new Date(n.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        })()}

        <!-- ======================================================== -->
        <!-- BUGUN TOPSHIRILGAN SINF DAVOMATLARI (QABUL QILINGANLAR)  -->
        <!-- ======================================================== -->
        <div class="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
          <div class="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base shadow-2xs">
                📥
              </span>
              <div>
                <h3 class="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                  Bugun qabul qilingan sinf davomatlari
                </h3>
                <p class="text-[11px] text-slate-500 font-medium">
                  Navbatchi o'qituvchilar tomonidan adminga yuborilgan sinflar (${todayData.submittedClasses.length} / ${schoolClasses.length} ta sinf)
                </p>
              </div>
            </div>
            
            <span class="px-3 py-1 rounded-full text-xs font-bold ${
              todayData.submittedClasses.length > 0 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                : 'bg-slate-100 text-slate-600'
            }">
              ${todayData.submittedClasses.length > 0 ? `✓ ${todayData.submittedClasses.length} ta sinf topshirildi` : "Hali topshirilmadi"}
            </span>
          </div>

          ${todayData.submittedClasses.length === 0 ? `
            <div class="py-6 px-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1.5">
              <div class="text-2xl">⏳</div>
              <div class="text-xs sm:text-sm font-bold text-slate-700">Hali birorta ham sinfdan davomat topshirilmadi</div>
              <p class="text-[11px] text-slate-500 max-w-md mx-auto">
                Navbatchi o'qituvchi o'z panelidan sinf davomatini olib "Davomatni saqlash va Adminga yuborish" tugmasini bosganida, bu yerda darhol kelib tushadi va umumiy ko'rsatkichga qo'shiladi.
              </p>
            </div>
          ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              ${todayData.submittedClasses.map(sc => `
                <div class="p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-200/90 shadow-2xs hover:shadow-xs transition-all space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono font-bold text-xs">
                        ${escapeHtml(sc.className)}
                      </span>
                      <span class="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Qabul qilindi
                      </span>
                    </div>
                    <span class="text-[10.5px] font-mono text-slate-500">
                      ${sc.submittedAt ? new Date(sc.submittedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>

                  <div class="text-xs text-slate-700">
                    <div>Rahbar: <strong>${escapeHtml(sc.teacherName || '-')}</strong></div>
                    <div class="text-[11px] text-slate-500 mt-0.5">Topshirdi: <span class="text-slate-800 font-semibold">${escapeHtml(sc.submittedBy || 'Navbatchi')}</span></div>
                  </div>

                  <div class="flex items-center gap-1.5 text-[11px] font-bold pt-1.5 border-t border-emerald-200/60 flex-wrap">
                    <span class="text-slate-600">Jami: ${sc.totalStudents}</span>
                    <span>•</span>
                    <span class="text-emerald-700">Bor: ${sc.presentCount}</span>
                    <span>•</span>
                    <span class="text-amber-700">Sababli: ${sc.excusedCount}</span>
                    <span>•</span>
                    <span class="text-rose-700">Sababsiz: ${sc.unexcusedCount}</span>
                  </div>

                  <button 
                    type="button" 
                    class="btn-admin-view-submitted-class w-full mt-1 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs"
                    data-class-id="${sc.classId}"
                  >
                    <span>👁️ Sinf davomatini ko'rish</span>
                  </button>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- ======================================================== -->
        <!-- DIQQAT TALABI: ADMIN KIM NAVBATCHI EKANINI KO'RA OLSIN   -->
        <!-- FAQAT DAVOMAT SAHIFASIGA KO'RINSIN                       -->
        <!-- ======================================================== -->
        <div class="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs">
          <div class="flex items-center justify-between gap-3 mb-3 pb-2.5 border-b border-slate-100 flex-wrap">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-base font-bold shadow-2xs">
                ⭐
              </div>
              <div>
                <h3 class="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                  Bugungi mas'ul navbatchi o'qituvchilar
                </h3>
                <p class="text-[11px] text-slate-500 font-medium">
                  Maktab bo'yicha bugun davomat olishga mas'ul bo'lgan sinf rahbarlari
                </p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0 font-mono">
              ${todayDutyTeachers.length} ta guruh (smena)
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            ${todayDutyTeachers.map(d => `
              <div class="p-3.5 rounded-2xl border ${d.hasAbsence ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50/80 border-slate-200'} space-y-1.5 transition-all hover:bg-white hover:shadow-xs">
                <div class="flex items-center justify-between font-bold mb-0.5">
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    ${escapeHtml(d.shiftName)} ${d.shiftHours ? `(${d.shiftHours})` : ''}
                  </span>
                  ${d.hasAbsence 
                    ? '<span class="px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 font-black text-[10px] animate-pulse">⚠️ Zaxirada</span>' 
                    : '<span class="px-2 py-0.5 rounded-md bg-emerald-500 text-white font-bold text-[10px] shadow-2xs">🟢 Mas\'ul navbatchi</span>'}
                </div>

                <div class="text-sm font-black text-slate-900">
                  ${escapeHtml(d.hasAbsence ? (d.delegatedTeacherName || d.backupTeacherName) : d.primaryTeacherName)}
                </div>

                <div class="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                  <span>Sinf rahbari: <strong>${escapeHtml(d.primaryTeacherClassName || '-')}</strong></span>
                  ${d.primaryTeacherPhone ? `
                    <span>•</span>
                    <a href="tel:${d.primaryTeacherPhone.replace(/[^0-9+]/g, '')}" class="text-indigo-600 hover:text-indigo-800 font-bold font-mono">
                      📞 ${escapeHtml(d.primaryTeacherPhone)}
                    </a>
                  ` : ''}
                </div>

                ${d.hasAbsence ? `
                  <div class="text-xs text-amber-900 mt-1 p-2 rounded-xl bg-amber-100/70 border border-amber-200">
                    <div>Asl navbatchi: <strong>${escapeHtml(d.originalTeacherName)}</strong> dars qoldirgan.</div>
                    <div class="italic text-[11px] mt-0.5 font-medium">Sababi: "${escapeHtml(d.absenceReason)}"</div>
                  </div>
                ` : (d.backupTeacherName && d.backupTeacherName !== d.primaryTeacherName ? `
                  <div class="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    Zaxira (Dublyor): <strong>${escapeHtml(d.backupTeacherName)}</strong> ${d.backupTeacherClassName ? `(${d.backupTeacherClassName})` : ''}
                  </div>
                ` : '')}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- HAR BIR BO'LIM UCHUN QISQA VA IXCHAM TUGMALAR (NO SCROLL)-->
        <!-- ======================================================== -->
        <div class="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
          
          <button 
            type="button" 
            id="nav-section-students" 
            class="nav-section-btn p-2 sm:p-2.5 rounded-xl text-left sm:text-center transition-all cursor-pointer active:scale-95 flex flex-col items-start sm:items-center justify-center ${
              activeSection === 'students' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
            }"
          >
            <div class="flex items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-center">
              <span class="text-sm">📊</span>
              <span class="text-xs font-bold leading-tight truncate">1. O'quvchilar</span>
            </div>
            <span class="text-[10px] sm:text-[10.5px] mt-0.5 font-medium ${activeSection === 'students' ? 'text-indigo-100' : 'text-slate-500'}">
              ${todayData.totalAbsent > 0 ? `${todayData.totalAbsent} ta kelmadi` : '100% kelgan'}
            </span>
          </button>

          <button 
            type="button" 
            id="nav-section-groups" 
            class="nav-section-btn p-2 sm:p-2.5 rounded-xl text-left sm:text-center transition-all cursor-pointer active:scale-95 flex flex-col items-start sm:items-center justify-center ${
              activeSection === 'groups' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
            }"
          >
            <div class="flex items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-center">
              <span class="text-sm">👥</span>
              <span class="text-xs font-bold leading-tight truncate">2. Guruhlar</span>
            </div>
            <span class="text-[10px] sm:text-[10.5px] mt-0.5 font-medium ${activeSection === 'groups' ? 'text-indigo-100' : 'text-slate-500'}">
              ${schoolShifts.length} ta guruh
            </span>
          </button>

          <button 
            type="button" 
            id="nav-section-teachers" 
            class="nav-section-btn p-2 sm:p-2.5 rounded-xl text-left sm:text-center transition-all cursor-pointer active:scale-95 flex flex-col items-start sm:items-center justify-center ${
              activeSection === 'teachers' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
            }"
          >
            <div class="flex items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-center">
              <span class="text-sm">👨‍🏫</span>
              <span class="text-xs font-bold leading-tight truncate">3. O'qituvchilar</span>
            </div>
            <span class="text-[10px] sm:text-[10.5px] mt-0.5 font-medium ${activeSection === 'teachers' ? 'text-indigo-100' : 'text-slate-500'}">
              davomati
            </span>
          </button>

          <button 
            type="button" 
            id="nav-section-archive" 
            class="nav-section-btn p-2 sm:p-2.5 rounded-xl text-left sm:text-center transition-all cursor-pointer active:scale-95 flex flex-col items-start sm:items-center justify-center ${
              activeSection === 'archive' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
            }"
          >
            <div class="flex items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-center">
              <span class="text-sm">📅</span>
              <span class="text-xs font-bold leading-tight truncate">4. Arxiv</span>
            </div>
            <span class="text-[10px] sm:text-[10.5px] mt-0.5 font-medium ${activeSection === 'archive' ? 'text-indigo-100' : 'text-slate-500'}">
              Oxirgi 1 oy
            </span>
          </button>

          <!-- 5-BO'LIM: NAVBATCHILIK JADVALI VA NAVBAT KETMA-KETLIGI (KO'ZGA TASHLANADIGAN) -->
          <button 
            type="button" 
            id="nav-section-roster" 
            class="nav-section-btn p-2 sm:p-2.5 rounded-xl text-left sm:text-center transition-all cursor-pointer active:scale-95 flex flex-col items-start sm:items-center justify-center col-span-2 sm:col-span-1 ${
              activeSection === 'roster' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-200 ring-2 ring-amber-300' 
                : 'bg-amber-50/90 text-amber-950 hover:bg-amber-100 border border-amber-300/80 shadow-2xs'
            }"
          >
            <div class="flex items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-center">
              <span class="text-sm">⭐</span>
              <span class="text-xs font-black leading-tight truncate">5. Navbatchilik</span>
            </div>
            <span class="text-[10px] sm:text-[10.5px] mt-0.5 font-bold ${activeSection === 'roster' ? 'text-amber-100' : 'text-amber-800'}">
              Jadval & Navbat
            </span>
          </button>

        </div>

        <!-- ======================================================== -->
        <!-- BO'LIMLAR KONTENTI                                       -->
        <!-- ======================================================== -->
        <div id="attendance-section-content" class="min-h-[300px]">
          ${renderCurrentSectionContent(todayData)}
        </div>

      </div>
    `;

    attachListeners();
  }

  // Tanlangan bo'lim kontentini chizish
  function renderCurrentSectionContent(todayData) {
    if (activeSection === 'overview' || activeSection === 'students') {
      return renderSection1Students(todayData);
    } else if (activeSection === 'groups') {
      return renderSection2Groups(todayData);
    } else if (activeSection === 'teachers') {
      return renderSection3Teachers(todayData);
    } else if (activeSection === 'archive') {
      return renderSection4Archive();
    } else if (activeSection === 'roster') {
      return renderSection5DutyRoster();
    }
    return '';
  }

  // =========================================================================
  // BO'LIM 1: O'QUVCHILAR DAVOMATI VA KELMAGANLAR (ALIFBO TARTIBIDA)
  // =========================================================================
  function renderSection1Students(todayData) {
    // Kelmagan o'quvchilarni ajratish
    const query = normalizeText(studentSearchQuery.trim());

    let studentsList = schoolStudents.map(s => {
      const cls = classMap.get(s.classId);
      const className = cls ? cls.name : (s.className || '-');
      const att = todayData.studentStatusMap.get(s.id) || { status: 'present', isExcused: false, reason: '' };
      const isAbsent = att.status !== 'present' && att.status !== 'late';
      const isExcused = Boolean(att.isExcused || att.status === 'excused' || att.status === 'absent_excused');

      return {
        student: s,
        className,
        isAbsent,
        isExcused,
        reason: att.reason || (isExcused ? "Sababli dars qoldirilgan" : "Sabab kiritilmagan"),
        status: att.status
      };
    });

    // Filtrlash
    if (studentAbsenceFilter === 'all_absent') {
      studentsList = studentsList.filter(item => item.isAbsent);
    } else if (studentAbsenceFilter === 'excused') {
      studentsList = studentsList.filter(item => item.isAbsent && item.isExcused);
    } else if (studentAbsenceFilter === 'unexcused') {
      studentsList = studentsList.filter(item => item.isAbsent && !item.isExcused);
    } else if (studentAbsenceFilter === 'submitted_classes') {
      studentsList = studentsList.filter(item => todayData.markedClassIds.has(item.student.classId));
    }

    if (query) {
      studentsList = studentsList.filter(item => {
        const s = item.student;
        const name = s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim();
        return (
          normalizeText(name).includes(query) ||
          normalizeText(item.className).includes(query) ||
          matchesPhone(s.phone, query) ||
          matchesPhone(s.fatherPhone, query) ||
          matchesPhone(s.motherPhone, query)
        );
      });
    }

    // DIQQAT TALABI: O'QUVCHILAR MUTLAQO ALIFBO TARTIBIDA (A-Z)
    studentsList.sort((a, b) => {
      const nameA = a.student.fullName || `${a.student.lastName || ''} ${a.student.firstName || ''}`.trim();
      const nameB = b.student.fullName || `${b.student.lastName || ''} ${b.student.firstName || ''}`.trim();
      return nameA.localeCompare(nameB, 'uz', { sensitivity: 'base' });
    });

    return `
      <div class="space-y-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 class="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📊 1-Bo'lim: O'quvchilar Davomati va Kelmaganlar</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Bugungi kelish ko'rsatkichi: <strong class="text-emerald-600 font-bold">${todayData.rate}%</strong> • 
              Kelmaganlar soni: <strong class="text-red-600 font-bold">${todayData.totalAbsent} nafar</strong>
            </p>
          </div>

          <!-- Qidiruv inputi -->
          <div class="w-full sm:w-64">
            <input 
              type="text" 
              id="student-att-search" 
              value="${escapeHtml(studentSearchQuery)}" 
              placeholder="O'quvchi ismi yoki sinf..." 
              class="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>

        <!-- Filter tugmalari (Ixcham va qulay) -->
        <div class="grid grid-cols-2 sm:flex sm:items-center gap-1.5 flex-wrap">
          <button 
            type="button" 
            class="student-filter-btn py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
              studentAbsenceFilter === 'all_absent' ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }" 
            data-filter="all_absent"
          >
            Kelmaganlar (${todayData.totalAbsent})
          </button>
          <button 
            type="button" 
            class="student-filter-btn py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
              studentAbsenceFilter === 'excused' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }" 
            data-filter="excused"
          >
            ⚠️ Sababli (${todayData.absentExcusedCount})
          </button>
          <button 
            type="button" 
            class="student-filter-btn py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
              studentAbsenceFilter === 'unexcused' ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }" 
            data-filter="unexcused"
          >
            🚫 Sababsiz (${todayData.absentUnexcusedCount})
          </button>
          <button 
            type="button" 
            class="student-filter-btn py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
              studentAbsenceFilter === 'submitted_classes' ? 'bg-emerald-600 text-white shadow-xs font-extrabold' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }" 
            data-filter="submitted_classes"
          >
            📥 Topshirilgan sinflar (${todayData.submittedClasses.length})
          </button>
          <button 
            type="button" 
            class="student-filter-btn py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
              studentAbsenceFilter === 'all_students' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }" 
            data-filter="all_students"
          >
            Barchasi (${schoolStudents.length})
          </button>
        </div>

        <!-- Ro'yxat: Sinflari bilan ajratilgan (1-A dan 11-D gacha) -->
        <div class="space-y-3 pt-2">
          ${(() => {
            // Sinflar bo'yicha guruhlash (1-A dan 11-D gacha tartibda)
            const classGroups = [];
            schoolClasses.forEach(cls => {
              const clsItems = studentsList.filter(item => item.student.classId === cls.id);
              if (clsItems.length === 0) return;

              // Ushbu sinfda kelmaganlar soni
              const absentCount = clsItems.filter(i => i.isAbsent).length;
              const excusedCount = clsItems.filter(i => i.isAbsent && i.isExcused).length;
              const unexcusedCount = clsItems.filter(i => i.isAbsent && !i.isExcused).length;

              // Agar faqat kelmaganlar filtri bo'lsa, kelmagan o'quvchisi bor sinflarni ko'rsatamiz
              if (studentAbsenceFilter === 'all_students' || studentAbsenceFilter === 'submitted_classes' || absentCount > 0) {
                // Sinf ichida o'quvchilar alifbo tartibida (A-Z)
                clsItems.sort((a, b) => {
                  const nameA = a.student.fullName || `${a.student.lastName || ''} ${a.student.firstName || ''}`.trim();
                  const nameB = b.student.fullName || `${b.student.lastName || ''} ${b.student.firstName || ''}`.trim();
                  return nameA.localeCompare(nameB, 'uz', { sensitivity: 'base' });
                });

                classGroups.push({
                  cls,
                  students: clsItems,
                  totalInClass: schoolStudents.filter(s => s.classId === cls.id).length,
                  absentCount,
                  excusedCount,
                  unexcusedCount
                });
              }
            });

            if (classGroups.length === 0) {
              if (todayData.submittedClasses.length === 0) {
                return `
                  <div class="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                    <span class="text-3xl">⏳</span>
                    <p class="text-xs sm:text-sm font-bold text-slate-800">Hali bugun birorta ham sinfdan davomat topshirilmadi</p>
                    <p class="text-[11px] text-slate-500 max-w-sm mx-auto">Navbatchi o'qituvchi o'z panelidan sinf davomatini topshirganda, bu yerda o'quvchilar va kelmaganlar ro'yxati darhol aks etadi.</p>
                  </div>
                `;
              }
              return `
                <div class="p-8 text-center bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-1">
                  <span class="text-2xl">🎉</span>
                  <p class="text-xs font-bold text-emerald-900">Ushbu toifada kelmagan o'quvchilar yo'q (100% davomat!)</p>
                  <p class="text-[11px] text-emerald-700">Topshirilgan sinflarda barcha o'quvchilar darsda qatnashmoqda.</p>
                </div>
              `;
            }

            return classGroups.map(grp => `
              <div class="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-2xs space-y-2.5">
                
                <!-- Sinf sarlavhasi (1-A dan 11-D gacha) -->
                <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 flex-wrap">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-8 h-8 rounded-xl bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                      ${escapeHtml(grp.cls.name)}
                    </span>
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-xs sm:text-sm font-bold text-slate-900">${escapeHtml(grp.cls.name)} sinf</h3>
                        <span class="text-[11px] text-slate-500 font-medium truncate">
                          • 👨‍🏫 ${escapeHtml(grp.cls.teacherName || 'Rahbar belgilanmagan')}
                        </span>
                      </div>
                      <p class="text-[10.5px] text-slate-500 font-mono mt-0.5">
                        Jami: <strong>${grp.totalInClass} nafar</strong> • Darsda yo'q: <strong class="${grp.absentCount > 0 ? 'text-rose-600' : 'text-emerald-600'} font-bold">${grp.absentCount} nafar</strong>
                      </p>
                    </div>
                  </div>

                  <!-- Sinf kelmaganlari tahlili -->
                  <div class="flex items-center gap-1.5 text-[10.5px] font-bold">
                    ${grp.excusedCount > 0 ? `
                      <span class="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                        ⚠️ ${grp.excusedCount} sababli
                      </span>
                    ` : ''}
                    ${grp.unexcusedCount > 0 ? `
                      <span class="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                        🚫 ${grp.unexcusedCount} sababsiz
                      </span>
                    ` : ''}
                    ${grp.absentCount === 0 ? `
                      <span class="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                        🟢 100% darsda
                      </span>
                    ` : ''}
                  </div>
                </div>

                <!-- Ushbu sinfdagi o'quvchilar ro'yxati (Alifbo tartibida) -->
                <div class="grid grid-cols-1 gap-2 pt-1">
                  ${grp.students.map((item, idx) => {
                    const s = item.student;
                    const fullName = s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim();
                    const contact = getStudentContactPhone(s);

                    return `
                      <div class="p-2.5 sm:p-3 rounded-2xl border ${item.isAbsent ? (item.isExcused ? 'bg-amber-50/50 border-amber-200' : 'bg-red-50/50 border-red-200') : 'bg-slate-50 border-slate-200'} flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all hover:bg-white hover:shadow-xs">
                        
                        <div class="flex items-start sm:items-center gap-2.5 min-w-0">
                          <span class="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center font-bold text-[11px] shrink-0 font-mono">
                            ${idx + 1}
                          </span>
                          <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                              <h4 class="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                ${escapeHtml(fullName)}
                              </h4>
                              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                                item.isAbsent 
                                  ? (item.isExcused ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-red-100 text-red-800 border border-red-300')
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }">
                                ${item.isAbsent ? (item.isExcused ? '⚠️ Sababli kelmagan' : '🚫 Sababsiz kelmagan') : '🟢 Darsda'}
                              </span>
                            </div>

                            <!-- Sababi (Sababli o'quvchilar uchun nima sababdan kelmagani) -->
                            ${item.isAbsent ? `
                              <div class="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                                <span class="font-semibold text-slate-700">Sababi:</span>
                                <span class="italic text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                  "${escapeHtml(item.reason)}"
                                </span>
                                <button 
                                  type="button" 
                                  class="btn-edit-student-reason text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer ml-1 text-xs"
                                  data-student-id="${s.id}"
                                  data-reason="${escapeHtml(item.reason)}"
                                  data-excused="${item.isExcused ? '1' : '0'}"
                                >
                                  ✏️ Tahrirlash
                                </button>
                              </div>
                            ` : ''}
                          </div>
                        </div>

                        <!-- Amallar: Telefon va SMS -->
                        <div class="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                          ${contact ? `
                            <a 
                              href="tel:${contact.number.replace(/[^0-9+]/g, '')}" 
                              class="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-all"
                              title="Ota-onasiga qo'ng'iroq qilish"
                            >
                              <span>📞 Tel</span>
                            </a>

                            <button 
                              type="button" 
                              class="btn-send-absent-sms px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${isSendingSmsId === s.id ? 'opacity-50 pointer-events-none' : ''}"
                              data-student-id="${s.id}"
                              data-class-name="${escapeHtml(grp.cls.name)}"
                              data-excused="${item.isExcused ? '1' : '0'}"
                              data-reason="${escapeHtml(item.reason)}"
                              title="Ota-onasiga SMS xabar yuborish"
                            >
                              <span>${isSendingSmsId === s.id ? 'Yuborilmoqda...' : '💬 SMS'}</span>
                            </button>
                          ` : ''}
                        </div>

                      </div>
                    `;
                  }).join('')}
                </div>

              </div>
            `).join('');
          })()}
        </div>

      </div>
    `;
  }

  // =========================================================================
  // BO'LIM 2: GURUHLAR (SMENALAR) BOSHQARUVI
  // =========================================================================
  function renderSection2Groups(todayData) {
    const selectedGroup = selectedGroupIdForDetail 
      ? schoolShifts.find(s => s.id === selectedGroupIdForDetail) 
      : null;

    return `
      <div class="space-y-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
          <div>
            <h2 class="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>👥 2-Bo'lim: Guruhlar (Smenalar) Boshqaruvi</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Guruhlarni tahrirlash, sinflarni qo'shish/kamaytirish yoki guruh ustiga bosib sinflarini ko'rish
            </p>
          </div>

          <button 
            type="button" 
            id="btn-add-group" 
            class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
            </svg>
            <span>+ Guruh qo'shish</span>
          </button>
        </div>

        <!-- Bir qator bo'lib guruhlar (Horizontal row of group cards) -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          ${schoolShifts.map((shift, idx) => {
            const shiftClassIds = new Set(shift.classIds || []);
            const shiftClasses = schoolClasses.filter(c => shiftClassIds.has(c.id));
            const shiftStudents = schoolStudents.filter(s => shiftClassIds.has(s.classId));
            const isSelected = selectedGroupIdForDetail === shift.id;

            return `
              <div 
                class="group-card p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-50/80 border-indigo-500 shadow-md ring-2 ring-indigo-500/20' 
                    : 'bg-slate-50/70 border-slate-200 hover:border-indigo-300 hover:bg-white'
                }"
                data-shift-id="${shift.id}"
              >
                <div class="flex items-center justify-between gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-xl bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                      ${idx + 1}
                    </span>
                    <h3 class="text-xs sm:text-sm font-bold text-slate-900">
                      ${escapeHtml(shift.name)}
                    </h3>
                  </div>

                  <!-- Tahrirlash va O'chirish tugmalari -->
                  <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                    <button 
                      type="button" 
                      class="btn-edit-shift p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                      data-shift-id="${shift.id}"
                      title="Guruhni tahrirlash (Sinflarni qo'shish yoki kamaytirish)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button 
                      type="button" 
                      class="btn-delete-shift p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-red-50 text-slate-700 hover:text-red-600 transition-colors cursor-pointer"
                      data-shift-id="${shift.id}"
                      title="Guruhni o'chirish (Barcha o'quvchilar boshqa guruhga qo'shiladi)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="flex items-center justify-between text-xs text-slate-500 font-mono mt-2 pt-2 border-t border-slate-200/60">
                  <span>⏰ ${shift.startTime || '08:00'} - ${shift.endTime || '13:00'}</span>
                  <span class="font-bold text-indigo-700">${shiftClasses.length} ta sinf (${shiftStudents.length} o'quvchi)</span>
                </div>

                <div class="mt-2 text-[11px] text-slate-600">
                  ${isSelected ? '👉 <strong>Sinflari ko\'rsatilmoqda</strong>' : '👆 Sinflarini ko\'rish uchun bosing'}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- ======================================================== -->
        <!-- NAVBATCHILIKDAN OZOD QILINGAN (MUSTASNO) SINFLAR         -->
        <!-- ======================================================== -->
        ${(() => {
          const allAssignedIds = new Set();
          schoolShifts.forEach(s => (s.classIds || []).forEach(id => allAssignedIds.add(id)));
          const excludedClasses = schoolClasses.filter(c => !allAssignedIds.has(c.id));
          if (excludedClasses.length === 0) return '';

          return `
            <div class="mt-3.5 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-2.5 animate-fade-in">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="w-7 h-7 rounded-xl bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-sm shadow-2xs">
                    🚫
                  </span>
                  <div>
                    <h4 class="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-1.5">
                      <span>Navbatchilikdan ozod qilingan (mustasno) sinf rahbarlari</span>
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                        ${excludedClasses.length} ta sinf
                      </span>
                    </h4>
                    <p class="text-[11px] text-amber-800">
                      Ushbu o'qituvchilar hech qaysi smenaga qo'shilmagan, shu sababli navbatchilikka jalb etilmaydi
                    </p>
                  </div>
                </div>
                <span class="text-[11px] text-amber-900 bg-amber-100 font-semibold px-2.5 py-1 rounded-lg border border-amber-300">
                  Guruhlardan chiqarilgan
                </span>
              </div>

              <div class="flex flex-wrap gap-2.5 pt-1">
                ${excludedClasses.map(cls => `
                  <div class="inline-flex items-center justify-between gap-3 px-3.5 py-2 rounded-2xl bg-white border border-amber-300 text-xs text-slate-800 shadow-2xs">
                    <div>
                      <span class="font-bold text-slate-900">⚪ ${escapeHtml(cls.name)}</span>
                      <span class="text-slate-500 font-normal"> (${escapeHtml(cls.teacherName || 'Sinf rahbari')})</span>
                      <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 uppercase ml-1.5">Mustasno</span>
                    </div>
                    <button 
                      type="button" 
                      class="btn-admin-include-class px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
                      data-class-id="${cls.id}"
                      title="Ushbu sinf rahbarini guruhga qo'shish va navbatchilar safiga qaytarish"
                    >
                      <span>➕ Guruhga biriktirish</span>
                    </button>
                  </div>
                `).join('')}
              </div>

              <div class="text-[11px] text-amber-900/90 pt-1 flex items-center gap-1.5">
                <span>💡</span>
                <span>Mustasno qilingan o'qituvchilar navbatchilik jadvaliga umuman kiritilmaydi. Guruhga qo'shish uchun yuqoridagi <strong>➕ Guruhga biriktirish</strong> tugmasini bosing.</span>
              </div>
            </div>
          `;
        })()}

        <!-- ======================================================== -->
        <!-- BIROR GURUH BOSILGANDA FAQAT O'SHA GURUH SINFLARI CHIQADI -->
        <!-- ======================================================== -->
        ${selectedGroup ? `
          <div class="mt-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-3 animate-fade-in">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-indigo-950 flex items-center gap-2">
                  <span>🏢 "${escapeHtml(selectedGroup.name)}" ga tegishli sinflar</span>
                  <span class="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-indigo-200/80 text-indigo-900">
                    ${(selectedGroup.classIds || []).length} ta sinf
                  </span>
                </h3>
                <p class="text-[11.5px] text-indigo-700">Faqat ushbu guruhga biriktirilgan sinflar. Istalgan o'qituvchini navbatchilikdan mustasno qilish uchun guruhdan chiqarishingiz mumkin.</p>
              </div>

              <button 
                type="button" 
                id="btn-close-group-detail" 
                class="px-2.5 py-1 rounded-xl bg-white border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
              >
                ✕ Yopish
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              ${schoolClasses
                .filter(c => (selectedGroup.classIds || []).includes(c.id))
                .sort((a, b) => compareClassNames(a.name, b.name))
                .map(cls => {
                  const clsStudents = schoolStudents
                    .filter(s => s.classId === cls.id)
                    .sort((a, b) => {
                      const nameA = a.fullName || `${a.lastName || ''} ${a.firstName || ''}`.trim();
                      const nameB = b.fullName || `${b.lastName || ''} ${b.firstName || ''}`.trim();
                      return nameA.localeCompare(nameB, 'uz', { sensitivity: 'base' });
                    });

                  return `
                    <div class="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs hover:border-indigo-300 transition-all flex flex-col justify-between">
                      <div>
                        <div class="flex items-center justify-between">
                          <span class="text-sm font-bold text-indigo-900">${escapeHtml(cls.name)}</span>
                          <span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-50 text-indigo-700">
                            ${clsStudents.length} o'quvchi
                          </span>
                        </div>
                        <div class="text-xs text-slate-500 mt-1">
                          Rahbar: <strong>${escapeHtml(cls.teacherName || 'Biriktirilmagan')}</strong>
                        </div>
                      </div>
                      <div class="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-end">
                        <button 
                          type="button" 
                          class="btn-admin-exclude-class px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer border border-rose-200/80 active:scale-95 flex items-center gap-1"
                          data-class-id="${cls.id}"
                          data-shift-id="${selectedGroup.id}"
                          title="Ushbu sinf rahbarini guruhdan chiqarish (navbatchilar safidan mustasno qilish)"
                        >
                          <span>🚫 Guruhdan chiqarish</span>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    `;
  }

  // =========================================================================
  // BO'LIM 3: O'QITUVCHILAR DAVOMATI (KELMAGANLAR SABABLARI BILAN, A-Z)
  // =========================================================================
  function renderSection3Teachers(todayData) {
    const query = normalizeText(teacherSearchQuery.trim());

    // Maktabdagi barcha o'qituvchilar (sinf rahbarlari)
    let teachersList = [];
    const teacherMap = new Map();

    schoolClasses.forEach(cls => {
      const tName = (cls.teacherName || '').trim();
      if (tName && !teacherMap.has(tName)) {
        const att = todayData.teacherStatusMap.get(cls.id) ||
                    todayData.teacherStatusMap.get(tName) || 
                    todayData.teacherStatusMap.get(tName.toLowerCase()) || 
                    todayData.teacherStatusMap.get(normalizeText(tName)) || 
                    { status: 'present', reason: '' };
        const teacherObj = {
          teacherName: tName,
          className: cls.name,
          classId: cls.id,
          phone: cls.teacherPhone || '',
          status: att.status || 'present',
          reason: att.reason || ''
        };
        teacherMap.set(tName, teacherObj);
        teachersList.push(teacherObj);
      }
    });

    // dutyAbsences orqali dars qoldirgan ammo ro'yxatga tushmagan o'qituvchilar bo'lsa ularni ham qo'shish
    const todayISO = getTodayISODate();
    const activeAbsences = (state.dutyAbsences || []).filter(a => 
      a.schoolId === schoolId && 
      (a.date === selectedDate || (selectedDate === todayISO && a.date === todayISO))
    );
    activeAbsences.forEach(abs => {
      const tName = (abs.originalTeacherName || '').trim();
      const classId = abs.originalTeacherClassId;
      const exists = teachersList.some(t => 
        (classId && t.classId === classId) || 
        (tName && t.teacherName.toLowerCase() === tName.toLowerCase())
      );
      if (!exists && tName) {
        const teacherObj = {
          teacherName: tName,
          className: abs.originalTeacherClassName || 'Sinf rahbari',
          classId: classId || '',
          phone: abs.originalTeacherPhone || '',
          status: 'absent_excused',
          reason: abs.reason || 'Sababli dars qoldirilgan'
        };
        teachersList.push(teacherObj);
      }
    });

    if (query) {
      teachersList = teachersList.filter(t => 
        normalizeText(t.teacherName).includes(query) ||
        normalizeText(t.className).includes(query) ||
        matchesPhone(t.phone, query)
      );
    }

    // DIQQAT TALABI: O'QITUVCHILARNI SINFLARINI 1-A.......11-D TARTIBIDA JOYLASHTIRISH
    teachersList.sort((a, b) => {
      const classCmp = compareClassNames(a.className, b.className);
      if (classCmp !== 0) return classCmp;
      return a.teacherName.localeCompare(b.teacherName, 'uz', { sensitivity: 'base' });
    });

    const absentTeachers = teachersList.filter(t => t.status !== 'present');
    const dutyTeachers = getTodayDutyTeachersForSchool(schoolId, state, selectedDate);
    const dutyTeacherNames = new Set(dutyTeachers.map(d => d.hasAbsence ? (d.delegatedTeacherName || d.backupTeacherName) : d.primaryTeacherName));

    return `
      <div class="space-y-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 class="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>👨‍🏫 3-Bo'lim: O'qituvchilar Davomati</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Jami o'qituvchilar: <strong>${teachersList.length} nafar</strong> • 
              Kelmaganlar: <strong class="text-red-600 font-bold">${absentTeachers.length} nafar</strong>
            </p>
          </div>

          <div class="w-full sm:w-64">
            <input 
              type="text" 
              id="teacher-att-search" 
              value="${escapeHtml(teacherSearchQuery)}" 
              placeholder="O'qituvchi ismini qidirish..." 
              class="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>

        <!-- Bugungi mas'ul navbatchilar tezkor bloki -->
        ${dutyTeachers.length > 0 ? `
          <div class="p-3 sm:p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div class="flex items-center gap-2">
              <span class="text-base">⭐</span>
              <div>
                <span class="text-xs font-bold text-amber-950">Bugungi mas'ul navbatchi o'qituvchilar:</span>
                <div class="flex items-center gap-2 flex-wrap mt-0.5">
                  ${dutyTeachers.map(d => `
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-white text-slate-800 border border-amber-200 shadow-2xs">
                      <span class="text-indigo-600 font-mono">${escapeHtml(d.shiftName)}:</span>
                      <strong>${escapeHtml(d.hasAbsence ? (d.delegatedTeacherName || d.backupTeacherName) : d.primaryTeacherName)}</strong>
                      <span class="text-slate-500 font-normal">(${escapeHtml(d.primaryTeacherClassName || '-')})</span>
                      ${d.hasAbsence ? '<span class="text-amber-600 text-[10px] font-black">(Zaxirada)</span>' : ''}
                    </span>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Kelmagan o'qituvchilar alohida ogohlantirish bloki -->
        ${absentTeachers.length > 0 ? `
          <div class="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
            <h3 class="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <span>⚠️ Bugun darsga kelmagan o'qituvchilar (${absentTeachers.length}):</span>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${absentTeachers.map(t => `
                <div class="p-2.5 bg-white rounded-xl border border-amber-200 text-xs">
                  <div class="flex items-center justify-between font-bold text-slate-900">
                    <span>${escapeHtml(t.teacherName)}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">${escapeHtml(t.className)}</span>
                  </div>
                  <div class="text-[11px] text-slate-600 mt-1 italic">
                    Sababi: "${escapeHtml(t.reason || 'Kiritilmagan')}"
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Barcha o'qituvchilar ro'yxati (Alifbo tartibida) -->
        <div class="space-y-2">
          ${teachersList.map((t, idx) => {
            const isDuty = dutyTeacherNames.has(t.teacherName);
            return `
            <div class="p-3 sm:p-3.5 rounded-2xl border ${
              isDuty 
                ? 'bg-amber-50/40 border-amber-300' 
                : (t.status === 'present' ? 'bg-slate-50/70 border-slate-200' : 'bg-amber-50/60 border-amber-300')
            } flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white transition-all">
              
              <div class="flex items-center gap-3">
                <span class="w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                  ${idx + 1}
                </span>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="text-xs sm:text-sm font-bold text-slate-900">
                      ${escapeHtml(t.teacherName)}
                    </h4>
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ${escapeHtml(t.className)}
                    </span>
                    ${isDuty ? `
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        ⭐ Mas'ul navbatchi
                      </span>
                    ` : ''}
                  </div>
                  <div class="text-[11px] text-slate-500 font-mono mt-0.5">
                    ${t.phone ? `Tel: ${escapeHtml(t.phone)}` : 'Tel: kiritilmagan'}
                  </div>
                  ${t.status !== 'present' && t.reason ? `
                    <div class="text-[11px] text-amber-800 font-medium mt-0.5 italic">
                      Sababi: "${escapeHtml(t.reason)}"
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- Holat belgilash tugmalari -->
              <div class="flex items-center gap-1.5 self-end sm:self-auto">
                <button 
                  type="button" 
                  class="btn-toggle-teacher-status px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    t.status === 'present' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }"
                  data-teacher-name="${escapeHtml(t.teacherName)}"
                  data-status="present"
                >
                  🟢 Kelgan
                </button>

                <button 
                  type="button" 
                  class="btn-toggle-teacher-status px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    t.status === 'absent_excused' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }"
                  data-teacher-name="${escapeHtml(t.teacherName)}"
                  data-status="absent_excused"
                >
                  ⚠️ Sababli
                </button>

                <button 
                  type="button" 
                  class="btn-toggle-teacher-status px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    t.status === 'absent_unexcused' ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }"
                  data-teacher-name="${escapeHtml(t.teacherName)}"
                  data-status="absent_unexcused"
                >
                  🚫 Sababsiz
                </button>
              </div>

            </div>
          `;
          }).join('')}
        </div>

      </div>
    `;
  }

  // =========================================================================
  // BO'LIM 4: ESKI 1 OYGACHA BO'LGAN DAVOMAT (ARXIV)
  // Alohida sahifada ochish, tozalash va tahrirlash imkoniyati
  // =========================================================================
  function renderSection4Archive() {
    // 1. Agar biror eski kun ochilgan bo'lsa -> ALOHIDA BIR SAHIFA (Dedicated View)
    if (archiveViewingDate) {
      const dayData = getAttendanceForDate(archiveViewingDate);
      const query = normalizeText(studentSearchQuery.trim());

      // Ushbu kunda dars qoldirgan o'quvchilar
      let dayStudents = schoolStudents.map(s => {
        const cls = classMap.get(s.classId);
        const className = cls ? cls.name : (s.className || '-');
        const att = dayData.studentStatusMap.get(s.id) || { status: 'present', isExcused: false, reason: '' };
        const isAbsent = att.status !== 'present' && att.status !== 'late';
        const isExcused = Boolean(att.isExcused || att.status === 'excused' || att.status === 'absent_excused');

        return {
          student: s,
          classId: s.classId,
          className,
          isAbsent,
          isExcused,
          reason: att.reason || (isExcused ? "Sababli dars qoldirilgan" : "Sababsiz dars qoldirilgan"),
          status: att.status
        };
      });

      if (query) {
        dayStudents = dayStudents.filter(item => {
          const s = item.student;
          const name = s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim();
          return (
            normalizeText(name).includes(query) ||
            normalizeText(item.className).includes(query)
          );
        });
      }

      // Sinflar bo'yicha guruhlash (1-A dan 11-D gacha)
      const dayClassGroups = [];
      schoolClasses.forEach(cls => {
        const clsStudents = dayStudents.filter(item => item.classId === cls.id);
        const absentInClass = clsStudents.filter(item => item.isAbsent);

        // Tahrirlash rejimida bo'lsa barcha o'quvchilarni, aks holda faqat kelmaganlarni ko'rsatish
        const displayStudents = archiveIsEditMode ? clsStudents : absentInClass;

        if (displayStudents.length > 0) {
          // Sinf ichida o'quvchilar alifbo tartibida (A-Z)
          displayStudents.sort((a, b) => {
            const nameA = a.student.fullName || `${a.student.lastName || ''} ${a.student.firstName || ''}`.trim();
            const nameB = b.student.fullName || `${b.student.lastName || ''} ${b.student.firstName || ''}`.trim();
            return nameA.localeCompare(nameB, 'uz', { sensitivity: 'base' });
          });

          dayClassGroups.push({
            cls,
            students: displayStudents,
            absentCount: absentInClass.length,
            excusedCount: absentInClass.filter(i => i.isExcused).length,
            unexcusedCount: absentInClass.filter(i => !i.isExcused).length,
            total: clsStudents.length
          });
        }
      });

      return `
        <div class="space-y-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs animate-fade-in text-slate-800">
          
          <!-- Yuqori boshqaruv: Orqaga qaytish va Amallar -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2.5">
              <button 
                type="button" 
                id="btn-back-to-archive-list"
                class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                <span>&larr;</span>
                <span>Arxivga qaytish</span>
              </button>

              <div>
                <h2 class="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <span>📅 ${formatReadableDate(archiveViewingDate)} kungi davomat</span>
                </h2>
                <p class="text-[11px] text-slate-500 font-mono">
                  Ko'rsatkich: <strong class="text-emerald-600 font-bold">${dayData.rate}%</strong> • 
                  Darsda yo'q: <strong class="text-rose-600 font-bold">${dayData.totalAbsent} nafar</strong>
                </p>
              </div>
            </div>

            <!-- Tahrirlash va Ushbu kunni tozalash tugmalari -->
            <div class="flex items-center gap-2 flex-wrap">
              <button 
                type="button" 
                id="btn-toggle-archive-edit" 
                class="px-3.5 py-1.5 rounded-xl ${
                  archiveIsEditMode 
                    ? 'bg-amber-600 text-white shadow-xs' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                } font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span>✏️</span>
                <span>${archiveIsEditMode ? "Tahrirlashni yakunlash" : "Davomatni tahrirlash"}</span>
              </button>

              <button 
                type="button" 
                id="btn-delete-day-archive" 
                class="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                title="Ushbu kunlik davomatni tozalash / o'chirish"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                <span>Kunni tozalash</span>
              </button>
            </div>
          </div>

          <!-- KPI Tahlil qatori -->
          <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div class="p-2.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-emerald-900">
              <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-700">🟢 Darsda</div>
              <div class="text-base sm:text-lg font-black font-mono mt-0.5">${dayData.presentCount} nafar</div>
            </div>
            <div class="p-2.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-amber-900">
              <div class="text-[10px] font-bold uppercase tracking-wider text-amber-700">⚠️ Sababli</div>
              <div class="text-base sm:text-lg font-black font-mono mt-0.5">${dayData.absentExcusedCount} nafar</div>
            </div>
            <div class="p-2.5 bg-rose-50/80 rounded-2xl border border-rose-200 text-rose-900">
              <div class="text-[10px] font-bold uppercase tracking-wider text-rose-700">🚫 Sababsiz</div>
              <div class="text-base sm:text-lg font-black font-mono mt-0.5">${dayData.absentUnexcusedCount} nafar</div>
            </div>
          </div>

          <!-- Tahrirlash rejimi haqida eslatma -->
          ${archiveIsEditMode ? `
            <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span>✏️</span>
                <span><strong>Tahrirlash rejimi:</strong> Har bir o'quvchining holatini (Darsda, Sababli, Sababsiz) o'zgartirishingiz va sababini yangilashingiz mumkin.</span>
              </div>
            </div>
          ` : ''}

          <!-- ======================================================== -->
          <!-- KELMAGAN O'QUVCHILAR: SINFLARI BILAN AJRATILGAN (1-A..11-D)-->
          <!-- ======================================================== -->
          <div class="space-y-3 pt-1">
            ${dayClassGroups.length === 0 ? `
              <div class="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span class="text-2xl">🎉</span>
                <p class="text-xs font-bold text-slate-700">Ushbu kunda barcha o'quvchilar darsda bo'lgan</p>
                <p class="text-[11px] text-slate-500">Hech qanday dars qoldirish qayd etilmagan</p>
              </div>
            ` : dayClassGroups.map(grp => `
              <div class="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-2xs space-y-2.5">
                
                <!-- Sinf sarlavhasi (1-A dan 11-D gacha tartibda) -->
                <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 flex-wrap">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-8 h-8 rounded-xl bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                      ${escapeHtml(grp.cls.name)}
                    </span>
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-xs sm:text-sm font-bold text-slate-900">${escapeHtml(grp.cls.name)} sinf</h3>
                        <span class="text-[11px] text-slate-500 font-medium truncate">
                          • 👨‍🏫 ${escapeHtml(grp.cls.teacherName || 'Rahbar belgilanmagan')}
                        </span>
                      </div>
                      <p class="text-[10.5px] text-slate-500 font-mono mt-0.5">
                        Jami: <strong>${grp.total} nafar</strong> • Darsda yo'q: <strong class="${grp.absentCount > 0 ? 'text-rose-600' : 'text-emerald-600'} font-bold">${grp.absentCount} nafar</strong>
                      </p>
                    </div>
                  </div>

                  <!-- Sinf kelmaganlari holati -->
                  <div class="flex items-center gap-1.5 text-[10.5px] font-bold">
                    ${grp.excusedCount > 0 ? `
                      <span class="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                        ⚠️ ${grp.excusedCount} sababli
                      </span>
                    ` : ''}
                    ${grp.unexcusedCount > 0 ? `
                      <span class="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                        🚫 ${grp.unexcusedCount} sababsiz
                      </span>
                    ` : ''}
                  </div>
                </div>

                <!-- Ushbu sinfdagi o'quvchilar ro'yxati -->
                <div class="grid grid-cols-1 gap-2 pt-1">
                  ${grp.students.map((item, idx) => {
                    const s = item.student;
                    const fullName = s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim();

                    return `
                      <div class="p-2.5 sm:p-3 rounded-2xl border ${
                        item.isAbsent 
                          ? (item.isExcused ? 'bg-amber-50/50 border-amber-200' : 'bg-red-50/50 border-red-200') 
                          : 'bg-slate-50 border-slate-200'
                      } flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all">
                        
                        <div class="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                          <span class="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center font-bold text-[11px] shrink-0 font-mono">
                            ${idx + 1}
                          </span>
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 flex-wrap">
                              <h4 class="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                ${escapeHtml(fullName)}
                              </h4>
                              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                                item.isAbsent 
                                  ? (item.isExcused ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-red-100 text-red-800 border border-red-300')
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }">
                                ${item.isAbsent ? (item.isExcused ? '⚠️ Sababli' : '🚫 Sababsiz') : '🟢 Darsda'}
                              </span>
                            </div>

                            <!-- Sababi -->
                            ${!archiveIsEditMode ? `
                              ${item.isAbsent ? `
                                <div class="text-[11px] text-slate-600 mt-1">
                                  <span class="font-semibold text-slate-700">Sababi:</span>
                                  <span class="italic text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                    "${escapeHtml(item.reason)}"
                                  </span>
                                </div>
                              ` : ''}
                            ` : `
                              <!-- Tahrirlash maydonlari -->
                              <div class="mt-2 space-y-1.5">
                                <input 
                                  type="text" 
                                  class="archive-edit-reason-input w-full p-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                  value="${escapeHtml(item.reason || '')}"
                                  placeholder="Sababini kiriting..."
                                  data-student-id="${s.id}"
                                />
                              </div>
                            `}
                          </div>
                        </div>

                        <!-- Tahrirlash tugmalari (Edit mode) -->
                        ${archiveIsEditMode ? `
                          <div class="flex items-center gap-1 self-end sm:self-auto shrink-0">
                            <button 
                              type="button" 
                              class="btn-set-archive-student-status px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                !item.isAbsent ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                              }"
                              data-student-id="${s.id}"
                              data-class-id="${grp.cls.id}"
                              data-status="present"
                            >
                              🟢 Darsda
                            </button>
                            <button 
                              type="button" 
                              class="btn-set-archive-student-status px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                item.isAbsent && item.isExcused ? 'bg-amber-600 text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                              }"
                              data-student-id="${s.id}"
                              data-class-id="${grp.cls.id}"
                              data-status="absent_excused"
                            >
                              ⚠️ Sababli
                            </button>
                            <button 
                              type="button" 
                              class="btn-set-archive-student-status px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                item.isAbsent && !item.isExcused ? 'bg-rose-600 text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                              }"
                              data-student-id="${s.id}"
                              data-class-id="${grp.cls.id}"
                              data-status="absent_unexcused"
                            >
                              🚫 Sababsiz
                            </button>
                          </div>
                        ` : ''}

                      </div>
                    `;
                  }).join('')}
                </div>

              </div>
            `).join('')}
          </div>

        </div>
      `;
    }

    // 2. Agar biror kun tanlanmagan bo'lsa -> MAKSIMAL 30 KUNLIK RO'YXAT VA BITTA-BITTA O'CHIRISH
    // DIQQAT TALABI: Arxivlar bo'limiga o'tib ketgan kunlarni bitta bitta o'chirish iloji bo'lsin.
    // Bu yerga maksimal 30 ta kunni sig'dirish mumkin, uni kamaytirish mumkin lekin ko'paytirish mumkin emas.
    const deletedDatesSet = new Set((state.deletedArchiveDates && state.deletedArchiveDates[schoolId]) || []);

    const pastDays = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      if (deletedDatesSet.has(iso)) {
        continue; // O'chirilgan kunlar ro'yxatdan butunlay chiqariladi va soni kamayadi
      }
      const att = getAttendanceForDate(iso);
      pastDays.push({
        date: iso,
        dateObj: d,
        stats: att
      });
    }

    return `
      <div class="space-y-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs text-slate-800">
        
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
          <div>
            <h2 class="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📅 4-Bo'lim: Davomat Arxivi (Eski 1 oylik ma'lumotlar)</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Maksimal 30 kunlik davomat natijalari (jami: <strong>${pastDays.length} kun</strong>). Kunlarni alohida bitta-bitta o'chirish yoki tozalash mumkin.
            </p>
          </div>

          <!-- Barcha arxivni tozalash tugmasi -->
          <button 
            type="button" 
            id="btn-clear-all-archive" 
            class="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Barcha eski davomat arxivini tozalash"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            <span>Barcha arxivni tozalash</span>
          </button>
        </div>

        <!-- Oxirgi kunlik ro'yxat (Maksimal 30 kun, bitta-bitta o'chirish tugmasi bilan) -->
        <div class="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          ${pastDays.length === 0 ? `
            <div class="p-8 text-center text-slate-400 text-xs">
              Arxivda saqlangan kunlar yo'q
            </div>
          ` : pastDays.map(item => `
            <div 
              class="archive-day-row p-3 sm:p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
              data-date="${item.date}"
              title="Kelmagan o'quvchilarni alohida sahifada ko'rish uchun bosing"
            >
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold font-mono shrink-0">
                  ${item.date.split('-')[2]}
                </span>
                <div class="min-w-0">
                  <h4 class="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    ${formatReadableDate(item.date)}
                  </h4>
                  <p class="text-[11px] text-slate-500 font-mono">
                    Kelgan: ${item.stats.presentCount} nafar • Darsda yo'q: <strong class="${item.stats.totalAbsent > 0 ? 'text-rose-600' : 'text-slate-500'} font-bold">${item.stats.totalAbsent} nafar</strong>
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 text-right shrink-0">
                <span class="text-sm sm:text-base font-black font-mono ${item.stats.rate >= 95 ? 'text-emerald-600' : (item.stats.rate >= 85 ? 'text-amber-600' : 'text-red-600')}">
                  ${item.stats.rate}%
                </span>
                <span class="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px] hidden sm:inline">
                  Ko'rish &rarr;
                </span>
                <button 
                  type="button" 
                  class="btn-delete-single-archive p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer active:scale-90" 
                  data-date="${item.date}"
                  title="Ushbu kunni arxivdan o'chirish"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  }

  // =========================================================================
  // BO'LIM 5: HAFTALIK NAVBATCHILIK JADVALI VA KETMA-KETLIK ROTATSIYASI
  // =========================================================================
  function renderSection5DutyRoster() {
    if (!selectedRosterShiftId && schoolShifts.length > 0) {
      selectedRosterShiftId = schoolShifts[0].id;
    }
    const currentShift = schoolShifts.find(s => s.id === selectedRosterShiftId) || schoolShifts[0];
    const shiftId = currentShift?.id || '';

    // Maktab navbatchilik jadvallari
    let rosters = (state.dutyRosters || []).filter(r => r.schoolId === schoolId && r.shiftId === shiftId);
    if (rosters.length === 0 && schoolClasses.length > 0 && schoolShifts.length > 0) {
      const generated = generateOrderlyDutyRosters(schoolId, schoolShifts, schoolClasses);
      if (generated.length > 0) {
        if (!state.dutyRosters) state.dutyRosters = [];
        generated.forEach(g => {
          if (!state.dutyRosters.some(r => r.id === g.id)) {
            state.dutyRosters.push(g);
            saveDutyRosterToFirestore(g).catch(() => {});
          }
        });
        saveData(state);
        rosters = state.dutyRosters.filter(r => r.schoolId === schoolId && r.shiftId === shiftId);
      }
    }

    // Ushbu smenadagi sinflar va o'qituvchilar navbat zanjiri
    const assignedClassIds = new Set(currentShift?.classIds || []);
    let shiftClasses = schoolClasses.filter(c => assignedClassIds.has(c.id) && Boolean(c.teacherName && c.teacherName.trim()));
    if (shiftClasses.length === 0) {
      shiftClasses = schoolClasses.filter(c => Boolean(c.teacherName && c.teacherName.trim()));
    }

    const todayDay = getTodayDayOfWeek();

    return `
      <div class="space-y-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs animate-fade-in">
        
        <!-- Yuqori sarlavha va amallar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 class="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>⭐ 5-Bo'lim: Haftalik Navbatchilik Jadvali va Ketma-ketligi</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Guruhlar (smenalar) bo'yicha qaysi o'qituvchidan keyin qaysi biri navbatchi bo'lishi va zaxiralar
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <!-- Smena tanlagichi -->
            <div class="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80">
              <label for="admin-roster-shift-select" class="text-xs font-semibold text-slate-600 pl-1">Guruh:</label>
              <select 
                id="admin-roster-shift-select" 
                class="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg shadow-2xs focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                ${schoolShifts.map(s => `
                  <option value="${s.id}" ${s.id === selectedRosterShiftId ? 'selected' : ''}>
                    ${escapeHtml(s.name)}
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Avtomatik navbatchi tayinlash tugmasi -->
            <button 
              type="button" 
              id="btn-auto-assign-roster-sec5" 
              class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Barcha sinf rahbarlarini haftaning 6 kuniga adolatli navbat bilan taqsimlash"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              <span>⚡ Avtomatik Navbatchi Tayinlash</span>
            </button>
          </div>
        </div>

        <!-- ======================================================== -->
        <!-- ROTATSIYA ZANJIRI: QAYSI O'QITUVCHIDAN KEYIN QAYSI BIRI KELADI -->
        <!-- ======================================================== -->
        <div class="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-2">
          <div class="flex items-center justify-between text-xs font-bold text-amber-950">
            <span class="flex items-center gap-1.5">
              <span>🔄</span>
              <span>Ushbu guruhdagi o'qituvchilar navbat ketma-ketligi (Zanjir):</span>
            </span>
            <span class="text-[11px] text-amber-800 font-mono font-medium">Jami: ${shiftClasses.length} nafar rahbar</span>
          </div>
          
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar pt-1">
            ${shiftClasses.length === 0 ? `
              <span class="text-xs text-amber-800 italic">Sinf rahbarlari topilmadi</span>
            ` : shiftClasses.map((cls, idx) => {
              const isLast = idx === shiftClasses.length - 1;
              return `
                <div class="inline-flex items-center gap-1.5 shrink-0 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs font-semibold text-slate-800">
                  <span class="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                    ${idx + 1}
                  </span>
                  <span class="font-bold text-slate-900">${escapeHtml(cls.teacherName || '')}</span>
                  <span class="text-[11px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-mono font-bold">${escapeHtml(cls.name)}</span>
                </div>
                ${!isLast ? '<span class="text-amber-500 font-bold shrink-0">&rarr;</span>' : '<span class="text-amber-500 font-bold shrink-0">↺ (qaytariladi)</span>'}
              `;
            }).join('')}
          </div>
          <p class="text-[11px] text-amber-900/90 pt-0.5">
            ℹ️ Navbat tartibi har kuni keyingi o'qituvchiga o'tadi. Asosiy navbatchi kela olmasa, navbat darhol uning ortidan keluvchi zaxiradagi o'qituvchiga topshiriladi.
          </p>
        </div>

        <!-- ======================================================== -->
        <!-- HAFTANING 6 ISH KUNI BO'YICHA NAVBATCHILIK JADVALI       -->
        <!-- ======================================================== -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          ${WEEK_DAYS.map((day) => {
            const roster = rosters.find(r => Number(r.dayOfWeek) === Number(day.id));
            const isToday = Number(day.id) === Number(todayDay);

            return `
              <div class="p-3.5 sm:p-4 rounded-2xl border ${isToday ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-200 shadow-sm' : 'border-slate-200/90 bg-slate-50/50'} space-y-3 flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-black text-slate-900">${day.name}</span>
                      ${isToday ? `
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-2xs">
                          ⭐ BUGUN
                        </span>
                      ` : ''}
                    </div>

                    <button 
                      type="button" 
                      class="btn-edit-duty-day px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-slate-200 hover:border-amber-300 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
                      data-day-id="${day.id}"
                      data-day-name="${day.name}"
                      data-shift-id="${shiftId}"
                    >
                      ✏️ Tahrirlash
                    </button>
                  </div>

                  <!-- Asosiy Navbatchi -->
                  <div class="mt-2.5 p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-1">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                      <span>🟢</span>
                      <span>Asosiy Navbatchi:</span>
                    </span>
                    <strong class="text-xs sm:text-sm font-bold text-slate-900 block truncate">
                      ${escapeHtml(roster?.primaryTeacherName || 'Belgilanmagan')}
                    </strong>
                    <div class="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Sinfi: <strong class="text-slate-700">${escapeHtml(roster?.primaryTeacherClassName || '-')}</strong></span>
                      ${roster?.primaryTeacherPhone ? `
                        <a href="tel:${roster.primaryTeacherPhone.replace(/[^0-9+]/g, '')}" class="text-indigo-600 font-bold hover:underline font-mono">
                          📞 ${escapeHtml(roster.primaryTeacherPhone)}
                        </a>
                      ` : ''}
                    </div>
                  </div>

                  <!-- Zaxira (Dublyor) Navbatchi -->
                  <div class="mt-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                      <span>⚡</span>
                      <span>Zaxira (Dublyor):</span>
                    </span>
                    <strong class="text-xs font-bold text-slate-900 block truncate">
                      ${escapeHtml(roster?.backupTeacherName || 'Belgilanmagan')}
                    </strong>
                    <div class="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Sinfi: <strong class="text-slate-700">${escapeHtml(roster?.backupTeacherClassName || '-')}</strong></span>
                      ${roster?.backupTeacherPhone ? `
                        <a href="tel:${roster.backupTeacherPhone.replace(/[^0-9+]/g, '')}" class="text-amber-800 font-bold hover:underline font-mono">
                          📞 ${escapeHtml(roster.backupTeacherPhone)}
                        </a>
                      ` : ''}
                    </div>
                  </div>
                </div>

                <div class="text-[10.5px] text-slate-400 italic pt-1 border-t border-slate-100 flex items-center justify-between">
                  <span>Navbat: ${Number(day.id)}-kuni</span>
                  <span>1 kunda 1 ta asosiy</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;
  }

  // Navbatchilik kunini tahrirlash modali
  function openDutyDayEditModal(dayId, dayName, shiftId) {
    const modalId = 'admin-duty-day-edit-modal';
    document.getElementById(modalId)?.remove();

    const currentShift = schoolShifts.find(s => s.id === shiftId) || schoolShifts[0];
    const roster = (state.dutyRosters || []).find(r => r.schoolId === schoolId && r.shiftId === shiftId && Number(r.dayOfWeek) === Number(dayId));

    // Faqat ushbu smenaga/guruhga tegishli sinflar (mustasno qilinganlar bu yerda ko'rinmaydi)
    const shiftClassIds = new Set(currentShift?.classIds || []);
    const teachersWithClass = schoolClasses
      .filter(c => shiftClassIds.has(c.id) && Boolean(c.teacherName && c.teacherName.trim()))
      .sort((a, b) => compareClassNames(a.name, b.name));

    const isSaturday = Number(dayId) === 6;

    const div = document.createElement('div');
    div.id = modalId;
    div.className = "fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fade-in";
    div.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-5 sm:p-6 animate-scale-in text-left">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2.5">
            <span class="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl font-bold">
              ⭐
            </span>
            <div>
              <h3 class="text-base font-bold text-slate-900">${escapeHtml(dayName)} Navbatchisi</h3>
              <p class="text-xs text-slate-500">${escapeHtml(currentShift?.name || 'Guruh')}</p>
            </div>
          </div>
          <button id="close-duty-day-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        ${isSaturday ? `
          <div class="mt-3 p-3 bg-amber-50 border border-amber-200/90 rounded-2xl text-amber-950 text-xs flex items-start gap-2.5">
            <span class="text-base shrink-0">⚠️</span>
            <div class="leading-relaxed">
              <strong>Shanba kuni tartibi:</strong> O'zbekistonda Shanba kuni 1-5 boshlang'ich sinflarga dars bo'lmaydi. Shanba kuni faqat 6-11 sinf rahbarlari navbatchi bo'lishi shart.
            </div>
          </div>
        ` : ''}

        <div class="mt-4 space-y-4">
          <!-- Asosiy Navbatchi -->
          <div>
            <label class="block text-xs font-bold text-emerald-800 mb-1">
              🟢 Asosiy Navbatchi Sinf Rahbari:
            </label>
            <select 
              id="select-duty-primary-teacher" 
              class="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Tanlang --</option>
              ${teachersWithClass.map(c => {
                const isSelected = roster?.primaryTeacherClassId === c.id || (roster?.primaryTeacherName && roster.primaryTeacherName === c.teacherName);
                const isLower = isGrade1to5(c.name);
                const labelExtra = (isSaturday && isLower) ? " (1-5 sinf - Shanba kela olmaydi)" : "";
                return `
                  <option value="${c.id}" ${isSelected ? 'selected' : ''} ${isSaturday && isLower ? 'class="text-slate-400"' : ''}>
                    ${escapeHtml(c.teacherName)} (${escapeHtml(c.name)} sinf)${labelExtra}
                  </option>
                `;
              }).join('')}
            </select>
          </div>

          <!-- Zaxira (Dublyor) Navbatchi -->
          <div>
            <label class="block text-xs font-bold text-amber-800 mb-1">
              ⚡ Zaxira (Dublyor) Navbatchi Sinf Rahbari:
            </label>
            <select 
              id="select-duty-backup-teacher" 
              class="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Tanlang --</option>
              ${teachersWithClass.map(c => {
                const isSelected = roster?.backupTeacherClassId === c.id || (roster?.backupTeacherName && roster.backupTeacherName === c.teacherName);
                const isLower = isGrade1to5(c.name);
                const labelExtra = (isSaturday && isLower) ? " (1-5 sinf - Shanba kela olmaydi)" : "";
                return `
                  <option value="${c.id}" ${isSelected ? 'selected' : ''} ${isSaturday && isLower ? 'class="text-slate-400"' : ''}>
                    ${escapeHtml(c.teacherName)} (${escapeHtml(c.name)} sinf)${labelExtra}
                  </option>
                `;
              }).join('')}
            </select>
          </div>
        </div>

        <div class="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button 
            type="button" 
            id="cancel-duty-day-modal" 
            class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Bekor qilish
          </button>
          <button 
            type="button" 
            id="save-duty-day-modal" 
            class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95"
          >
            Saqlash
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    const close = () => div.remove();
    div.querySelector('#close-duty-day-modal')?.addEventListener('click', close);
    div.querySelector('#cancel-duty-day-modal')?.addEventListener('click', close);

    div.querySelector('#save-duty-day-modal')?.addEventListener('click', async () => {
      const primaryClassId = div.querySelector('#select-duty-primary-teacher')?.value;
      const backupClassId = div.querySelector('#select-duty-backup-teacher')?.value;

      const primaryClass = schoolClasses.find(c => c.id === primaryClassId);
      const backupClass = schoolClasses.find(c => c.id === backupClassId);

      const shiftRosters = (state.dutyRosters || []).filter(r => r.schoolId === schoolId && r.shiftId === shiftId);
      const valResult = validateDutyAssignment({
        dayOfWeek: dayId,
        primaryClass,
        backupClass,
        shift: currentShift,
        shiftRosters,
        currentRosterId: roster?.id || ''
      });

      if (!valResult.valid) {
        showToast(valResult.error, 'error');
        return;
      }

      if (!state.dutyRosters) state.dutyRosters = [];
      let targetRoster = (state.dutyRosters || []).find(r => r.schoolId === schoolId && r.shiftId === shiftId && Number(r.dayOfWeek) === Number(dayId));

      if (targetRoster) {
        targetRoster.primaryTeacherName = primaryClass?.teacherName || '';
        targetRoster.primaryTeacherPhone = primaryClass?.teacherPhone || '';
        targetRoster.primaryTeacherClassId = primaryClass?.id || '';
        targetRoster.primaryTeacherClassName = primaryClass?.name || '';
        targetRoster.backupTeacherName = backupClass?.teacherName || '';
        targetRoster.backupTeacherPhone = backupClass?.teacherPhone || '';
        targetRoster.backupTeacherClassId = backupClass?.id || '';
        targetRoster.backupTeacherClassName = backupClass?.name || '';
        targetRoster.updatedAt = new Date().toISOString();
      } else {
        targetRoster = {
          id: `roster_${schoolId}_${shiftId}_day${dayId}`,
          schoolId,
          shiftId,
          dayOfWeek: Number(dayId),
          primaryTeacherName: primaryClass?.teacherName || '',
          primaryTeacherPhone: primaryClass?.teacherPhone || '',
          primaryTeacherClassId: primaryClass?.id || '',
          primaryTeacherClassName: primaryClass?.name || '',
          backupTeacherName: backupClass?.teacherName || '',
          backupTeacherPhone: backupClass?.teacherPhone || '',
          backupTeacherClassId: backupClass?.id || '',
          backupTeacherClassName: backupClass?.name || '',
          notes: `${dayName} uchun qo'lda tayinlangan`,
          updatedAt: new Date().toISOString()
        };
        state.dutyRosters.push(targetRoster);
      }

      saveDutyRosterToFirestore(targetRoster).catch(() => {});
      saveData(state);

      showToast(`${dayName} navbatchilari yangilandi!`, 'success');
      close();
      render();
    });
  }

  // =========================================================================
  // BO'LIM: ALOHIDA BIR SINF DAVOMATI SAHIFASI (MODAL EMAS, DEDICATED VIEW)
  // Grafik ustuniga bosilganda o'sha sinf davomati alohida bitta sahifada ochiladi
  // =========================================================================
  function renderSingleClassAttendancePage() {
    const clsId = selectedClassAttendance.classId;
    const dateStr = selectedClassAttendance.date || selectedDate;
    const cls = classMap.get(clsId) || { id: clsId, name: 'Sinf', teacherName: '-' };

    // Sinf o'quvchilari qat'iy ALIFBO TARTIBIDA (A-Z)
    const classStudents = schoolStudents
      .filter(s => s.classId === clsId)
      .sort((a, b) => {
        const nameA = a.fullName || `${a.lastName || ''} ${a.firstName || ''}`.trim();
        const nameB = b.fullName || `${b.lastName || ''} ${b.firstName || ''}`.trim();
        return nameA.localeCompare(nameB, 'uz', { sensitivity: 'base' });
      });

    const dayData = getAttendanceForDate(dateStr);

    let presentCount = 0;
    let excusedCount = 0;
    let unexcusedCount = 0;

    const studentListWithStatus = classStudents.map((s, idx) => {
      const att = dayData.studentStatusMap.get(s.id) || { status: 'present', isExcused: false, reason: '' };
      const isAbsent = att.status !== 'present' && att.status !== 'late';
      const isExcused = Boolean(att.isExcused || att.status === 'excused' || att.status === 'absent_excused');

      if (!isAbsent) {
        presentCount++;
      } else if (isExcused) {
        excusedCount++;
      } else {
        unexcusedCount++;
      }

      return {
        student: s,
        orderNumber: idx + 1,
        status: isAbsent ? (isExcused ? 'absent_excused' : 'absent_unexcused') : 'present',
        isAbsent,
        isExcused,
        reason: att.reason || ''
      };
    });

    const totalCount = classStudents.length;
    const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 1000) / 10 : 100;
    const rateColor = getAttendanceRateColor(rate);

    // Qidiruv va filtr
    const query = normalizeText(singleClassSearchQuery.trim());
    const filteredList = studentListWithStatus.filter(item => {
      if (singleClassStatusFilter === 'present' && item.isAbsent) return false;
      if (singleClassStatusFilter === 'absent' && !item.isAbsent) return false;
      if (singleClassStatusFilter === 'excused' && (!item.isAbsent || !item.isExcused)) return false;
      if (singleClassStatusFilter === 'unexcused' && (!item.isAbsent || item.isExcused)) return false;

      if (!query) return true;
      const s = item.student;
      const name = s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim();
      const phone = s.phone || s.phoneNumber || s.fatherPhone || s.motherPhone || '';
      return normalizeText(name).includes(query) || normalizeText(phone).includes(query);
    });

    return `
      <div class="space-y-4 pb-28 max-w-5xl mx-auto animate-fade-in text-slate-800">
        
        <!-- Yuqori boshqaruv paneli: Orqaga qaytish va Sana -->
        <div class="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <button 
              type="button" 
              id="btn-back-from-class-attendance" 
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0"
              title="Umumiy davomat sahifasiga qaytish"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              <span>Davomatga qaytish</span>
            </button>

            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-0.5 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-xs">
                  ${escapeHtml(cls.name)}
                </span>
                <h1 class="text-base sm:text-lg font-black text-slate-900 truncate">
                  Sinf Davomati
                </h1>
              </div>
              <p class="text-xs text-slate-500 font-medium truncate mt-0.5">
                Sinf rahbari: <strong class="text-slate-700">${escapeHtml(cls.teacherName || 'Belgilanmagan')}</strong>
              </p>
            </div>
          </div>

          <!-- O'ng tomonda: Sana va Grafik tugmasi -->
          <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <input 
              type="date" 
              id="single-class-att-date" 
              value="${dateStr}" 
              class="px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 cursor-pointer"
              title="Sanani o'zgartirish"
            />
            <button 
              type="button" 
              id="btn-open-graph-from-single" 
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
              title="Boshqa sinflar grafigini ochish"
            >
              <span>📈 Grafik</span>
            </button>
          </div>
        </div>

        <!-- Sinf statistikasi umumiy kartochkasi -->
        <div class="bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden">
          <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/15 text-indigo-100 backdrop-blur-xs border border-white/10">
                  📅 ${formatReadableDate(dateStr)}
                </span>
                <span class="text-xs text-indigo-200 font-medium">
                  ${cls.name} o'quvchilari davomat holati
                </span>
              </div>
              <div class="flex items-baseline gap-3 mt-2">
                <div class="text-4xl sm:text-5xl font-black font-mono tracking-tight" style="color: ${rateColor.top}">
                  ${rate}%
                </div>
                <div class="text-xs text-indigo-100 font-medium">
                  <div>Jami o'quvchilar: <strong>${totalCount} nafar</strong></div>
                  <div>Darsda qatnashmoqda: <strong class="text-emerald-300 font-bold">${presentCount} nafar</strong></div>
                </div>
              </div>
            </div>

            <!-- Tahlil kartalari: Kelgan, Sababli, Sababsiz -->
            <div class="grid grid-cols-3 gap-2 sm:gap-2.5 bg-white/10 p-3 rounded-2xl border border-white/10 backdrop-blur-md shrink-0">
              <div class="text-center p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/20">
                <div class="text-[11px] text-emerald-200 font-bold">🟢 Kelgan</div>
                <div class="text-base sm:text-xl font-black font-mono text-emerald-300 mt-0.5">${presentCount}</div>
              </div>
              <div class="text-center p-2 rounded-xl bg-amber-500/20 border border-amber-400/20">
                <div class="text-[11px] text-amber-200 font-bold">⚠️ Sababli</div>
                <div class="text-base sm:text-xl font-black font-mono text-amber-300 mt-0.5">${excusedCount}</div>
              </div>
              <div class="text-center p-2 rounded-xl bg-red-500/20 border border-red-400/20">
                <div class="text-[11px] text-red-200 font-bold">🚫 Sababsiz</div>
                <div class="text-base sm:text-xl font-black font-mono text-red-300 mt-0.5">${unexcusedCount}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Qidiruv va Filtrlar -->
        <div class="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <!-- Qidiruv -->
            <div class="relative flex-1">
              <input 
                type="text" 
                id="single-class-search-input" 
                value="${escapeHtml(singleClassSearchQuery)}" 
                placeholder="O'quvchi ismi yoki telefon raqami bo'yicha qidirish..." 
                class="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              />
              <svg class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>

            <!-- Filtr tugmalari: Barchasi, Kelgan, Sababli, Sababsiz -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none text-xs font-bold">
              <button 
                type="button" 
                class="single-class-filter-btn px-3 py-1.5 rounded-xl transition-all cursor-pointer ${singleClassStatusFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                data-filter="all"
              >
                Barchasi (${totalCount})
              </button>
              <button 
                type="button" 
                class="single-class-filter-btn px-3 py-1.5 rounded-xl transition-all cursor-pointer ${singleClassStatusFilter === 'present' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                data-filter="present"
              >
                🟢 Kelgan (${presentCount})
              </button>
              <button 
                type="button" 
                class="single-class-filter-btn px-3 py-1.5 rounded-xl transition-all cursor-pointer ${singleClassStatusFilter === 'excused' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                data-filter="excused"
              >
                ⚠️ Sababli (${excusedCount})
              </button>
              <button 
                type="button" 
                class="single-class-filter-btn px-3 py-1.5 rounded-xl transition-all cursor-pointer ${singleClassStatusFilter === 'unexcused' ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                data-filter="unexcused"
              >
                🚫 Sababsiz (${unexcusedCount})
              </button>
            </div>
          </div>
        </div>

        <!-- O'quvchilar ro'yxati (Alifbo tartibida kartalar) -->
        <div class="space-y-2.5">
          ${filteredList.length === 0 ? `
            <div class="text-center py-12 bg-white rounded-3xl border border-slate-200 p-6">
              <span class="text-4xl block mb-2">🔍</span>
              <h4 class="text-sm font-bold text-slate-700">O'quvchilar topilmadi</h4>
              <p class="text-xs text-slate-500 mt-1">Qidiruv so'rovi yoki filtr bo'yicha hech qanday o'quvchi chiqmadi.</p>
            </div>
          ` : filteredList.map(item => {
            const s = item.student;
            const name = s.fullName || `${s.lastName || ''} ${s.firstName || ''} ${s.middleName || ''}`.trim();
            const phone = s.phone || s.phoneNumber || s.fatherPhone || s.motherPhone || '';
            const phoneLabel = s.phone ? "O'zi" : (s.fatherPhone ? "Otasi" : (s.motherPhone ? "Onasi" : "Tel"));

            return `
              <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    ${item.orderNumber}
                  </span>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h4 class="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        ${escapeHtml(name)}
                      </h4>
                      ${s.gender ? `
                        <span class="text-[11px] px-2 py-0.5 rounded-md font-semibold ${s.gender.toLowerCase().includes('qiz') ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'}">
                          ${s.gender.toLowerCase().includes('qiz') ? '👧 Qiz' : '👦 O\'g\'il'}
                        </span>
                      ` : ''}
                    </div>
                    
                    ${phone ? `
                      <div class="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <a href="tel:${cleanPhone(phone)}" class="inline-flex items-center gap-1 text-indigo-600 hover:underline font-mono text-xs font-medium">
                          📞 ${escapeHtml(phone)} <span class="text-slate-400">(${phoneLabel})</span>
                        </a>
                      </div>
                    ` : `
                      <span class="text-[11px] text-slate-400 mt-1 block">Telefon raqami kiritilmagan</span>
                    `}

                    ${item.isAbsent && item.reason ? `
                      <div class="mt-2 text-xs text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200/80 font-medium">
                        <strong>Sabab:</strong> ${escapeHtml(item.reason)}
                      </div>
                    ` : ''}
                  </div>
                </div>

                <!-- Holat nishoni -->
                <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  ${item.status === 'present' ? `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                      <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Darsda (Kelgan)
                    </span>
                  ` : (item.isExcused ? `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs border border-amber-200">
                      <span class="w-2 h-2 rounded-full bg-amber-500"></span> ⚠️ Sababli kelmagan
                    </span>
                  ` : `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-700 font-bold text-xs border border-red-200">
                      <span class="w-2 h-2 rounded-full bg-red-500"></span> 🚫 Sababsiz kelmagan
                    </span>
                  `)}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Pastki orqaga qaytish tugmasi -->
        <div class="pt-4 flex justify-center">
          <button 
            type="button" 
            id="btn-back-bottom-class" 
            class="px-5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            ← Davomat sahifasiga qaytish
          </button>
        </div>

      </div>
    `;
  }

  function attachSingleClassAttendanceListeners() {
    const backFn = () => {
      selectedClassAttendance = null;
      render();
    };

    container.querySelector('#btn-back-from-class-attendance')?.addEventListener('click', backFn);
    container.querySelector('#btn-back-bottom-class')?.addEventListener('click', backFn);

    container.querySelector('#single-class-att-date')?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val && selectedClassAttendance) {
        selectedClassAttendance.date = val;
        render();
      }
    });

    container.querySelector('#btn-open-graph-from-single')?.addEventListener('click', () => {
      openAdminAttendanceGraphModal({
        state,
        currentSchool,
        initialDate: selectedClassAttendance?.date || selectedDate,
        onSelectClass: (classId, date) => {
          selectedClassAttendance = {
            classId,
            date: date || selectedDate
          };
          singleClassStatusFilter = 'all';
          singleClassSearchQuery = '';
          render();
        }
      });
    });

    const searchInput = container.querySelector('#single-class-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        singleClassSearchQuery = e.target.value;
        container.innerHTML = renderSingleClassAttendancePage();
        attachSingleClassAttendanceListeners();
      });
    }

    container.querySelectorAll('.single-class-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        singleClassStatusFilter = btn.getAttribute('data-filter') || 'all';
        container.innerHTML = renderSingleClassAttendancePage();
        attachSingleClassAttendanceListeners();
      });
    });
  }

  // Hodisalarni ulash
  function attachListeners() {
    // Sinflar aro davomat statistikasi grafigi modali
    container.querySelector('#btn-open-class-graph')?.addEventListener('click', () => {
      openAdminAttendanceGraphModal({
        state,
        currentSchool,
        initialDate: selectedDate,
        onSelectClass: (classId, date) => {
          selectedClassAttendance = {
            classId,
            date: date || selectedDate
          };
          singleClassStatusFilter = 'all';
          singleClassSearchQuery = '';
          render();
        }
      });
    });

    // Bo'lim tugmalari (5 ta bo'lim)
    container.querySelector('#nav-section-students')?.addEventListener('click', () => {
      activeSection = 'students';
      render();
    });
    container.querySelector('#nav-section-groups')?.addEventListener('click', () => {
      activeSection = 'groups';
      render();
    });
    container.querySelector('#nav-section-teachers')?.addEventListener('click', () => {
      activeSection = 'teachers';
      render();
    });
    container.querySelector('#nav-section-archive')?.addEventListener('click', () => {
      activeSection = 'archive';
      render();
    });
    container.querySelector('#nav-section-roster')?.addEventListener('click', () => {
      activeSection = 'roster';
      render();
    });

    // Topshirilgan sinf davomatini ko'rish tugmasi
    container.querySelectorAll('.btn-admin-view-submitted-class').forEach(btn => {
      btn.addEventListener('click', () => {
        const clsId = btn.getAttribute('data-class-id');
        if (clsId) {
          selectedClassAttendance = { classId: clsId, date: selectedDate };
          singleClassStatusFilter = 'all';
          singleClassSearchQuery = '';
          render();
        }
      });
    });

    // Yangi xabarnomalarni o'qilgan deb belgilash
    container.querySelector('#btn-mark-all-notifs-read')?.addEventListener('click', () => {
      if (Array.isArray(state.adminNotifications)) {
        state.adminNotifications.forEach(n => {
          if (n.schoolId === schoolId) n.read = true;
        });
        saveData(state);
      }
      showToast("Barcha xabarnomalar o'qildi deb belgilandi", 'info');
      render();
    });

    // 5-Bo'lim: Navbatchilik jadvali hodisalari
    const rosterShiftSelect = container.querySelector('#admin-roster-shift-select');
    if (rosterShiftSelect) {
      rosterShiftSelect.addEventListener('change', (e) => {
        selectedRosterShiftId = e.target.value;
        render();
      });
    }

    container.querySelector('#btn-auto-assign-roster-sec5')?.addEventListener('click', () => {
      const generated = generateOrderlyDutyRosters(schoolId, schoolShifts, schoolClasses);
      if (generated.length > 0) {
        if (!state.dutyRosters) state.dutyRosters = [];
        generated.forEach(newR => {
          const exIdx = state.dutyRosters.findIndex(r => r.schoolId === schoolId && r.shiftId === newR.shiftId && Number(r.dayOfWeek) === Number(newR.dayOfWeek));
          if (exIdx >= 0) {
            state.dutyRosters[exIdx] = newR;
          } else {
            state.dutyRosters.push(newR);
          }
          saveDutyRosterToFirestore(newR).catch(() => {});
        });
        saveData(state);
        showToast("Barcha guruhlar bo'yicha haftalik navbatchilik jadvali avtomatik adolatli taqsimlandi!", 'success');
        render();
      }
    });

    container.querySelectorAll('.btn-edit-duty-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const dayId = btn.getAttribute('data-day-id');
        const dayName = btn.getAttribute('data-day-name') || 'Kun';
        const shiftId = btn.getAttribute('data-shift-id') || selectedRosterShiftId;
        openDutyDayEditModal(dayId, dayName, shiftId);
      });
    });

    // 1-Bo'lim: O'quvchilar filtrlari
    container.querySelectorAll('.student-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        studentAbsenceFilter = btn.getAttribute('data-filter');
        render();
      });
    });

    const studentSearchInput = container.querySelector('#student-att-search');
    if (studentSearchInput) {
      studentSearchInput.addEventListener('input', (e) => {
        studentSearchQuery = e.target.value;
        const listDiv = container.querySelector('#attendance-section-content');
        if (listDiv) {
          const todayData = getAttendanceForDate(selectedDate);
          listDiv.innerHTML = renderSection1Students(todayData);
          attachListeners();
        }
      });
    }

    // Sababini ko'rish / tahrirlash
    container.querySelectorAll('.btn-edit-student-reason').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-student-id');
        const reason = btn.getAttribute('data-reason');
        const isExcused = btn.getAttribute('data-excused') === '1';
        const st = schoolStudents.find(s => s.id === studentId);
        if (!st) return;

        openReasonModal(st, reason, isExcused, (newReason) => {
          // Davomat yozuvini yangilash
          let record = schoolAttendanceRecords.find(r => r.date === selectedDate);
          if (!record) {
            record = {
              id: `att_${schoolId}_shift_${selectedDate}`,
              schoolId,
              date: selectedDate,
              classAttendance: {},
              teacherAttendance: [],
              createdAt: new Date().toISOString()
            };
            if (!state.attendanceRecords) state.attendanceRecords = [];
            state.attendanceRecords.push(record);
          }

          if (!record.classAttendance[st.classId]) {
            record.classAttendance[st.classId] = { classId: st.classId, records: {} };
          }
          if (!record.classAttendance[st.classId].records[st.id]) {
            record.classAttendance[st.classId].records[st.id] = { status: isExcused ? 'excused' : 'absent' };
          }
          record.classAttendance[st.classId].records[st.id].reason = newReason;
          record.classAttendance[st.classId].records[st.id].isExcused = isExcused;

          saveData(state);
          saveAttendanceRecordToFirestore(record).catch(console.warn);
          showToast("O'quvchi sababi muvaffaqiyatli saqlandi", 'success');
          render();
        });
      });
    });

    // SMS yuborish
    container.querySelectorAll('.btn-send-absent-sms').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.getAttribute('data-student-id');
        const className = btn.getAttribute('data-class-name');
        const isExcused = btn.getAttribute('data-excused') === '1';
        const reason = btn.getAttribute('data-reason');
        const st = schoolStudents.find(s => s.id === studentId);
        if (st) {
          handleSendStudentSms(st, className, isExcused, reason);
        }
      });
    });

    // 2-Bo'lim: Guruh qo'shish va kartalar
    container.querySelector('#btn-add-group')?.addEventListener('click', () => {
      openGroupModal(null);
    });

    container.querySelectorAll('.group-card').forEach(card => {
      card.addEventListener('click', () => {
        const shiftId = card.getAttribute('data-shift-id');
        selectedGroupIdForDetail = selectedGroupIdForDetail === shiftId ? null : shiftId;
        render();
      });
    });

    container.querySelectorAll('.btn-edit-shift').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const shiftId = btn.getAttribute('data-shift-id');
        const sh = schoolShifts.find(s => s.id === shiftId);
        if (sh) openGroupModal(sh);
      });
    });

    container.querySelectorAll('.btn-delete-shift').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const shiftId = btn.getAttribute('data-shift-id');
        const sh = schoolShifts.find(s => s.id === shiftId);
        if (sh) handleDeleteGroup(sh);
      });
    });

    container.querySelector('#btn-close-group-detail')?.addEventListener('click', () => {
      selectedGroupIdForDetail = null;
      render();
    });

    // 2-Bo'lim: Sinf rahbarini guruhdan chiqarish (navbatchilikdan mustasno qilish)
    container.querySelectorAll('.btn-admin-exclude-class').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const classId = btn.getAttribute('data-class-id');
        const cls = schoolClasses.find(c => c.id === classId);
        excludeClassFromDutyShifts(classId, schoolId, state);
        showToast(`${cls?.name || 'Sinf'} (${cls?.teacherName || ''}) guruhdan chiqarildi va navbatchilar safidan mustasno qilindi!`, 'info');
        render();
      });
    });

    // 2-Bo'lim: Mustasno qilingan sinf rahbarini guruhga qayta biriktirish
    container.querySelectorAll('.btn-admin-include-class').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const classId = btn.getAttribute('data-class-id');
        const cls = schoolClasses.find(c => c.id === classId);
        if (!cls) return;

        if (schoolShifts.length <= 1) {
          const targetShift = schoolShifts[0];
          if (targetShift) {
            includeClassToDutyShift(classId, targetShift.id, schoolId, state);
            showToast(`${cls.name} (${cls.teacherName}) ${targetShift.name} guruhiga muvaffaqiyatli qo'shildi!`, 'success');
            render();
          }
        } else {
          openChooseShiftModalForClass(cls);
        }
      });
    });

    // 3-Bo'lim: O'qituvchi holatini o'zgartirish
    const teacherSearchInput = container.querySelector('#teacher-att-search');
    if (teacherSearchInput) {
      teacherSearchInput.addEventListener('input', (e) => {
        teacherSearchQuery = e.target.value;
        const listDiv = container.querySelector('#attendance-section-content');
        if (listDiv) {
          const todayData = getAttendanceForDate(selectedDate);
          listDiv.innerHTML = renderSection3Teachers(todayData);
          attachListeners();
        }
      });
    }

    container.querySelectorAll('.btn-toggle-teacher-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const teacherName = btn.getAttribute('data-teacher-name');
        const status = btn.getAttribute('data-status');

        let record = schoolAttendanceRecords.find(r => r.date === selectedDate);
        if (!record) {
          record = {
            id: `att_${schoolId}_shift_${selectedDate}`,
            schoolId,
            date: selectedDate,
            classAttendance: {},
            teacherAttendance: [],
            createdAt: new Date().toISOString()
          };
          if (!state.attendanceRecords) state.attendanceRecords = [];
          state.attendanceRecords.push(record);
        }

        if (!Array.isArray(record.teacherAttendance)) {
          record.teacherAttendance = [];
        }

        let tIdx = record.teacherAttendance.findIndex(t => t.teacherName === teacherName);
        if (tIdx >= 0) {
          record.teacherAttendance[tIdx].status = status;
        } else {
          record.teacherAttendance.push({
            teacherName,
            status,
            reason: status !== 'present' ? 'Admin tomonidan belgilandi' : ''
          });
        }

        saveData(state);
        saveAttendanceRecordToFirestore(record).catch(console.warn);
        showToast(`${teacherName} holati yangilandi`, 'success');
        render();
      });
    });

    // 4-Bo'lim: Arxiv kuni bosilganda -> ALOHIDA SAHIFADA OCHISH
    container.querySelectorAll('.archive-day-row').forEach(row => {
      row.addEventListener('click', () => {
        const d = row.getAttribute('data-date');
        archiveViewingDate = d;
        archiveIsEditMode = false;
        render();
      });
    });

    // Arxivdan orqaga qaytish
    container.querySelector('#btn-back-to-archive-list')?.addEventListener('click', () => {
      archiveViewingDate = null;
      archiveIsEditMode = false;
      render();
    });

    // Arxivni tahrirlash rejimini yoqish/o'chirish
    container.querySelector('#btn-toggle-archive-edit')?.addEventListener('click', () => {
      archiveIsEditMode = !archiveIsEditMode;
      render();
    });

    // Bitta-bitta kunlik arxivni o'chirish
    container.querySelectorAll('.btn-delete-single-archive').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const d = btn.getAttribute('data-date');
        const formatted = formatReadableDate(d);
        if (!confirm(`Haqiqatan ham ${formatted} kungi davomat arxivini o'chirmoqchimisiz?\n(Bu kun arxivdan butunlay olib tashlanadi)`)) {
          return;
        }

        const recIdx = (state.attendanceRecords || []).findIndex(r => r.schoolId === schoolId && r.date === d);
        if (recIdx >= 0) {
          const recId = state.attendanceRecords[recIdx].id;
          state.attendanceRecords.splice(recIdx, 1);
          if (recId) {
            deleteAttendanceRecordFromFirestore(recId).catch(console.warn);
          }
        }

        if (!state.deletedArchiveDates) state.deletedArchiveDates = {};
        if (!state.deletedArchiveDates[schoolId]) state.deletedArchiveDates[schoolId] = [];
        if (!state.deletedArchiveDates[schoolId].includes(d)) {
          state.deletedArchiveDates[schoolId].push(d);
        }

        saveData(state);
        showToast(`${formatted} kungi davomat arxivi o'chirildi!`, 'success');
        render();
      });
    });

    // Ushbu kunlik arxivni tozalash / o'chirish (sahifa ichidan)
    container.querySelector('#btn-delete-day-archive')?.addEventListener('click', async () => {
      if (!archiveViewingDate) return;
      const formatted = formatReadableDate(archiveViewingDate);
      if (!confirm(`Siz rostdan ham ${formatted} kungi barcha davomat arxivini tozalashni tasdiqlaysizmi?`)) {
        return;
      }

      const recIdx = (state.attendanceRecords || []).findIndex(r => r.schoolId === schoolId && r.date === archiveViewingDate);
      if (recIdx >= 0) {
        const recId = state.attendanceRecords[recIdx].id;
        state.attendanceRecords.splice(recIdx, 1);
        try {
          if (recId) await deleteAttendanceRecordFromFirestore(recId);
        } catch (e) {
          console.warn("Firestore delete attendance:", e);
        }
      }

      if (!state.deletedArchiveDates) state.deletedArchiveDates = {};
      if (!state.deletedArchiveDates[schoolId]) state.deletedArchiveDates[schoolId] = [];
      if (!state.deletedArchiveDates[schoolId].includes(archiveViewingDate)) {
        state.deletedArchiveDates[schoolId].push(archiveViewingDate);
      }

      saveData(state);
      showToast(`${formatted} kungi davomat arxivi tozalandi!`, 'success');
      archiveViewingDate = null;
      archiveIsEditMode = false;
      render();
    });

    // Barcha eski arxivlarni tozalash
    container.querySelector('#btn-clear-all-archive')?.addEventListener('click', async () => {
      if (!confirm("Haqiqatan ham maktabning barcha eski davomat arxivlarini tozalashni (o'chirishni) tasdiqlaysizmi?")) {
        return;
      }

      const toDelete = (state.attendanceRecords || []).filter(r => r.schoolId === schoolId);
      state.attendanceRecords = (state.attendanceRecords || []).filter(r => r.schoolId !== schoolId);

      // Oxirgi 30 kunni o'chirilgan deb belgilash
      if (!state.deletedArchiveDates) state.deletedArchiveDates = {};
      if (!state.deletedArchiveDates[schoolId]) state.deletedArchiveDates[schoolId] = [];
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        if (!state.deletedArchiveDates[schoolId].includes(iso)) {
          state.deletedArchiveDates[schoolId].push(iso);
        }
      }

      saveData(state);

      try {
        for (const rec of toDelete) {
          if (rec.id) await deleteAttendanceRecordFromFirestore(rec.id);
        }
      } catch (e) {
        console.warn("Firestore clear all attendance:", e);
      }

      showToast("Barcha eski davomat arxivi muvaffaqiyatli tozalandi!", 'success');
      archiveViewingDate = null;
      archiveIsEditMode = false;
      render();
    });

    // Arxiv tahrirlash: O'quvchi holatini o'zgartirish (Darsda / Sababli / Sababsiz)
    container.querySelectorAll('.btn-set-archive-student-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!archiveViewingDate) return;
        const studentId = btn.getAttribute('data-student-id');
        const classId = btn.getAttribute('data-class-id');
        const newStatus = btn.getAttribute('data-status'); // 'present' | 'absent_excused' | 'absent_unexcused'

        const isExcused = newStatus === 'absent_excused';
        const reasonInput = container.querySelector(`.archive-edit-reason-input[data-student-id="${studentId}"]`);
        const reasonVal = reasonInput ? reasonInput.value.trim() : '';

        // Recordni topish yoki yaratish
        let record = (state.attendanceRecords || []).find(r => r.schoolId === schoolId && r.date === archiveViewingDate);
        if (!record) {
          record = {
            id: `att_${schoolId}_shift_${archiveViewingDate}`,
            schoolId,
            date: archiveViewingDate,
            classAttendance: {},
            teacherAttendance: [],
            createdAt: new Date().toISOString()
          };
          if (!state.attendanceRecords) state.attendanceRecords = [];
          state.attendanceRecords.push(record);
        }

        if (!record.classAttendance) record.classAttendance = {};
        if (!record.classAttendance[classId]) {
          record.classAttendance[classId] = { classId, records: {} };
        }

        record.classAttendance[classId].records[studentId] = {
          status: newStatus === 'present' ? 'present' : (isExcused ? 'excused' : 'absent'),
          isExcused,
          reason: newStatus === 'present' ? '' : (reasonVal || (isExcused ? "Sababli" : "Sababsiz")),
          note: newStatus === 'present' ? '' : reasonVal
        };

        record.updatedAt = new Date().toISOString();
        saveData(state);

        try {
          await saveAttendanceRecordToFirestore(record);
        } catch (e) {
          console.warn("Firestore save attendance:", e);
        }

        showToast("O'quvchi davomat holati muvaffaqiyatli yangilandi", 'success');
        render();
      });
    });

    // Sabab inputi o'zgarganda saqlash
    container.querySelectorAll('.archive-edit-reason-input').forEach(input => {
      input.addEventListener('change', async () => {
        if (!archiveViewingDate) return;
        const studentId = input.getAttribute('data-student-id');
        const reasonVal = input.value.trim();

        let record = (state.attendanceRecords || []).find(r => r.schoolId === schoolId && r.date === archiveViewingDate);
        if (record && record.classAttendance) {
          Object.values(record.classAttendance).forEach(clsAtt => {
            if (clsAtt && clsAtt.records && clsAtt.records[studentId]) {
              clsAtt.records[studentId].reason = reasonVal;
              clsAtt.records[studentId].note = reasonVal;
            }
          });

          record.updatedAt = new Date().toISOString();
          saveData(state);
          try {
            await saveAttendanceRecordToFirestore(record);
          } catch (e) {
            console.warn(e);
          }
        }
      });
    });
  }

  render();
}
