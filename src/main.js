/**
 * Maktab O'quvchilar Boshqaruvi
 * Asosiy kontroller va interfeys boshqaruvi
 * Faqat toza HTML, CSS, JavaScript (React / TSX siz)
 */

import { loadData, saveData, resetData, getClassPlatforms } from './data.js';
import { renderLanding } from './views/landingView.js';
import { renderLogin } from './views/loginView.js';
import { renderDeveloper } from './views/developerView.js';
import { renderAdmin } from './views/adminView.js';
import { renderTeacher } from './views/teacherView.js';
import { renderPlatformsView } from './views/platformsView.js';
import { renderStudentDetail } from './views/studentDetailView.js';
import { renderAdminUserDetail } from './views/adminUserDetailView.js';
import { renderTeacherUserDetail } from './views/teacherUserDetailView.js';
import { showStudentModal } from './views/studentFormModal.js';
import { showAdminModal } from './views/adminFormModal.js';
import { showClassModal } from './views/classFormModal.js';
import { showAboutModal } from './views/aboutModal.js';
import { showChangeCredentialsModal } from './views/changeCredentialsModal.js';
import { showLogoutConfirmModal } from './views/logoutConfirmModal.js';
import { showRecoveryModal, showPinRecoveryModal } from './views/recoveryModal.js';
import { renderPinLockScreen } from './views/pinLockScreen.js';
import { showPinSettingsModal } from './views/pinSettingsModal.js';
import { showFirstLoginPinModal } from './views/firstLoginPinModal.js';
import { showFaceAuthModal } from './views/faceAuthModal.js';
import { renderSystemTerminal } from './views/systemTerminalView.js';
import { renderAttendanceView } from './views/attendanceView.js';
import { renderTeacherSearchView } from './views/teacherSearchView.js';
import { renderTeacherSettingsView } from './views/teacherSettingsView.js';
import { renderTeacherHelpView } from './views/teacherHelpView.js';
import { renderTeacherChangeCredentialsView } from './views/teacherChangeCredentialsView.js';
import { renderTeacherChangePinView } from './views/teacherChangePinView.js';
import { renderTeacherFaceIdView } from './views/teacherFaceIdView.js';
import { renderAdminSearchView } from './views/adminSearchView.js';
import { renderAdminAttendanceView } from './views/adminAttendanceView.js';
import { renderAdminSettingsView } from './views/adminSettingsView.js';
import { getTodayDutyInfoForTeacher } from './data.js';
import { closeModalWithAnimation } from './utils/modalAnimation.js';
import { 
  exportStudentListToExcel, 
  exportStudentListToPDF, 
  exportStudentListToWord,
  exportSingleStudentToPDF, 
  exportSingleStudentToExcel, 
  exportSingleStudentToWord,
  showExportSelectionModal,
  isFemaleStudent
} from './utils/exportUtils.js';
import {
  testConnection,
  fetchAllData,
  subscribeToDatabase,
  saveSchoolToFirestore,
  deleteSchoolFromFirestore,
  saveClassToFirestore,
  deleteClassFromFirestore,
  saveStudentToFirestore,
  deleteStudentFromFirestore,
  saveSystemConfigToFirestore,
  syncLocalDataToFirestoreIfEmpty,
  updateRecoveryRequestStatusInFirestore,
  deleteRecoveryRequestFromFirestore,
  purgeStudentPhotosFromFirestore,
  saveTrashToFirestore,
  deleteTrashFromFirestore,
  fetchTrashFromFirestore,
  saveShiftToFirestore,
  deleteShiftFromFirestore,
  saveDutyRosterToFirestore,
  deleteDutyRosterFromFirestore,
  saveAttendanceRecordToFirestore,
  deleteAttendanceRecordFromFirestore
} from './firebase.js';

// -------------------------------------------------------------
// FOYDALANUVCHI SEANSI (SESSION PERSISTENCE)
// -------------------------------------------------------------
// DIQQAT: Foydalanuvchi talabiga ko'ra, avto-kirish (sessiya) DASTURCHI paneli uchun ISHLAMAYDI!
const AUTH_SESSION_KEY = 'maktabx_auth_session';

function getStoredSession(db) {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.role || session.role === 'developer') {
      // Dasturchi seansi saqlanmaydi!
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    if (session.role === 'admin' && session.id) {
      const school = db.schools?.find(s => s.id === session.id);
      if (school) {
        return { role: 'admin', data: school };
      }
    } else if (session.role === 'teacher' && session.id) {
      const cls = db.classes?.find(c => c.id === session.id);
      if (cls) {
        return { role: 'teacher', data: cls };
      }
    } else if (session.role === 'developer') {
      if (db.developer) {
        return { role: 'developer', data: db.developer };
      }
    }
  } catch (e) {
    console.warn("Sessiyani yuklashda xatolik:", e);
  }
  return null;
}

function saveUserSession(role, data) {
  if (!role) {
    clearUserSession();
    return;
  }
  try {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      role,
      id: role === 'developer' ? 'dev-main' : data?.id,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn("Sessiyani saqlashda xatolik:", e);
  }
}

function clearUserSession() {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
  } catch (e) {
    console.warn("Sessiyani tozalashda xatolik:", e);
  }
}

// O'quvchilar jinsini avtomatik to'g'rilash (ism-sharifida qiz ekanligi aniq ko'rinib turgan, ammo forma sukut bo'yicha "O'g'il" qilib saqlagan o'quvchilarni tuzatish)
function healStudentGenders(db) {
  if (!db || !Array.isArray(db.students)) return false;
  let changed = false;
  db.students.forEach(st => {
    if (st) {
      if (isFemaleStudent(st) && st.gender !== 'Qiz') {
        st.gender = 'Qiz';
        changed = true;
      }
    }
  });
  return changed;
}

const initialDb = loadData();
if (healStudentGenders(initialDb)) {
  saveData(initialDb);
}
const initialSession = getStoredSession(initialDb);

// Global Ilova Holati (State)
let state = {
  db: initialDb,
  currentUser: initialSession, // { role: 'developer' | 'admin' | 'teacher', data: ... } yoki null
  currentView: initialSession ? 'dashboard' : 'landing', // Saytga kirganda to'liq ma'lumot va qo'llanmaga ega Bosh sahifa kutib oladi
  isAppLocked: Boolean(initialSession?.data?.pinCode), // Har safar o'z profiliga kirganda PIN-kod so'raladi
  isSystemTerminalOpen: false, // Tizim boshqaruvi terminali holati
  selectedStudentId: null,
  selectedAdminSchoolId: null,
  selectedTeacherClassId: null,
  previousView: 'dashboard',
  isCloudConnected: true,
  isLoadingStudents: false
};

// Toast xabarlari funksiyasi - To'liq kunduzgi oq dizayn
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const toastThemes = {
    success: 'bg-white text-emerald-900 border-2 border-emerald-500 shadow-xl shadow-emerald-500/10',
    error: 'bg-white text-red-900 border-2 border-red-500 shadow-xl shadow-red-500/10',
    info: 'bg-white text-slate-900 border-2 border-slate-300 shadow-xl shadow-slate-200/50'
  };

  const toastIcons = {
    success: `<svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
    error: `<svg class="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
    info: `<svg class="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
  };

  toast.className = `px-4 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2.5 pointer-events-auto transition-all transform duration-300 translate-y-2 opacity-0 ${toastThemes[type] || toastThemes.info}`;
  toast.innerHTML = `
    ${toastIcons[type] || toastIcons.info}
    <span>${message}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// -------------------------------------------------------------
// O'QUVCHILAR RO'YXATI VA ALOHIDA O'QUVCHI EKSPORT FUNKSIYALARI (PDF / EXCEL)
// -------------------------------------------------------------

function handleExportClassStudents(studentsList = null) {
  const currentClass = state.currentUser?.role === 'teacher' 
    ? state.currentUser.data 
    : (state.db.classes.find(c => c.id === (studentsList && studentsList[0]?.classId)) || { name: 'Sinf' });
  const school = state.db.schools.find(s => s.id === currentClass?.schoolId) || { name: "Umumta'lim Maktabi" };
  const list = studentsList || state.db.students.filter(s => s.classId === currentClass?.id);

  if (!list || list.length === 0) {
    showToast("Eksport qilish uchun o'quvchilar ro'yxati bo'sh", 'error');
    return;
  }

  showExportSelectionModal({
    title: `${currentClass?.name || 'Sinf'} o'quvchilar ro'yxati`,
    subtitle: `${list.length} nafar o'quvchi ma'lumotlari`,
    onExportWord: async () => {
      try {
        await exportStudentListToWord(list, currentClass?.name, school?.name, currentClass?.teacherName);
        showToast("Word (.docx) hujjati muvaffaqiyatli yuklab olindi", 'success');
      } catch (err) {
        showToast("Word faylni yaratishda xatolik yuz berdi", 'error');
      }
    },
    onExportExcel: () => {
      try {
        exportStudentListToExcel(list, currentClass?.name, school?.name);
        showToast("Excel (.xlsx) jadvali muvaffaqiyatli yuklab olindi", 'success');
      } catch (err) {
        showToast("Excel faylni yaratishda xatolik yuz berdi", 'error');
      }
    },
    onExportPDF: () => {
      try {
        exportStudentListToPDF(list, currentClass?.name, school?.name, currentClass?.teacherName);
        showToast("PDF (.pdf) hujjati muvaffaqiyatli yuklab olindi", 'success');
      } catch (err) {
        showToast("PDF faylni yaratishda xatolik yuz berdi", 'error');
      }
    },
    onPrint: () => {
      window.print();
    }
  });
}

function handleExportSingleStudent(studentId) {
  const student = state.db.students.find(s => s.id === studentId);
  if (!student) {
    showToast("O'quvchi ma'lumoti topilmadi", 'error');
    return;
  }
  const studentClass = state.db.classes.find(c => c.id === student.classId);
  const school = state.db.schools.find(s => s.id === (studentClass ? studentClass.schoolId : student.schoolId));

  showExportSelectionModal({
    title: `${student.fullName || 'O\'quvchi'} dosyesi`,
    subtitle: "Shaxsiy ma'lumotlarni yuklab olish formati",
    onExportWord: async () => {
      try {
        await exportSingleStudentToWord(student, school, studentClass);
        showToast("O'quvchi dosyesi Word (.docx) formatida yuklab olindi", 'success');
      } catch (err) {
        showToast("Word faylini yaratishda xatolik yuz berdi", 'error');
      }
    },
    onExportExcel: () => {
      try {
        exportSingleStudentToExcel(student, school, studentClass);
        showToast("O'quvchi ma'lumotlari Excel (.xlsx) da yuklab olindi", 'success');
      } catch (err) {
        showToast("Excel yuklab olishda xatolik yuz berdi", 'error');
      }
    },
    onExportPDF: () => {
      try {
        exportSingleStudentToPDF(student, school, studentClass);
        showToast("O'quvchining rasmiy dosyesi PDF (.pdf) da yuklab olindi", 'success');
      } catch (err) {
        showToast("PDF yaratishda xatolik yuz berdi", 'error');
      }
    },
    onPrint: () => {
      window.print();
    }
  });
}

// O'qituvchi ID orqali tizimga kirganda avtomatik login va parolni yangilash oynasini ochish
function handleTeacherIdAutoLogin(targetClass) {
  const classData = targetClass?.data || targetClass;
  const user = {
    role: 'teacher',
    data: classData
  };
  saveUserSession('teacher', classData);
  state.currentUser = user;
  state.isAppLocked = Boolean(classData.pinCode);
  state.currentView = 'dashboard';
  showToast(`${classData.teacherName || classData.name || 'Sinf kabineti'} hisobiga muvaffaqiyatli kirildi!`, 'success');

  try {
    localStorage.setItem('maktabx_pending_cred_update', classData.id);
  } catch (_) {}

  renderApp();

  // Foydalanuvchi yangi parolni qayerdan qo'yishni izlab yurmmasligi uchun oyna avtomatik ochiladi
  setTimeout(() => {
    openChangeCredentialsModal({
      isFromIdLogin: true,
      reason: "Siz platformaga Tiklash ID orqali kirdingiz. Yangi parolni qayerdan qo'yishni izlamasligingiz uchun ushbu oyna avtomatik ochildi. Yangi login va parolingizni belgilab oling."
    });
  }, 350);
}

// Tizimga kirish logikasi (Dasturchi, Maktab Admini, O'qituvchi)
async function handleLogin(login, password) {
  // 1. Dasturchi tekshiruvi (Login: 1234, Parol: 1234)
  if (login === state.db.developer?.login && password === state.db.developer?.password) {
    saveUserSession('developer', state.db.developer);
    state.currentUser = {
      role: 'developer',
      data: state.db.developer
    };
    state.isAppLocked = Boolean(state.db.developer?.pinCode);
    state.currentView = 'dashboard';
    showToast("Dasturchi sifatida tizimga xush kelibsiz!", 'success');
    renderApp();
    return;
  }

  // 2. Maktab admini tekshiruvi
  let schoolAdmin = state.db.schools.find(s => s.login === login && s.password === password);
  if (schoolAdmin) {
    saveUserSession('admin', schoolAdmin);
    state.currentUser = {
      role: 'admin',
      data: schoolAdmin
    };
    state.isAppLocked = Boolean(schoolAdmin.pinCode);
    state.currentView = 'dashboard';
    showToast(`${schoolAdmin.name} admini sifatida kirdingiz`, 'success');
    renderApp();
    return;
  }

  // 3. Sinf rahbari (O'qituvchi) tekshiruvi
  let teacherClass = state.db.classes.find(c => c.login === login && c.password === password);
  if (teacherClass) {
    saveUserSession('teacher', teacherClass);
    state.currentUser = {
      role: 'teacher',
      data: teacherClass
    };
    state.isAppLocked = Boolean(teacherClass.pinCode);
    state.currentView = 'dashboard';
    showToast(`${teacherClass.name} sinf rahbari: ${teacherClass.teacherName}`, 'success');
    renderApp();
    return;
  }

  // Agar foydalanuvchi login joyiga Tiklash ID sini kiritgan bo'lsa, unga "Parolni unutdingizmi?" so'rovini ochish
  const matchedByIdOnly = state.db.classes?.find(c => {
    const cleanLogin = (login || '').toUpperCase().replace(/\s+/g, '');
    const cleanRecId = (c.recoveryId || '').toUpperCase().replace(/\s+/g, '');
    return cleanRecId && (
      cleanRecId === cleanLogin ||
      cleanRecId === ('REC-' + cleanLogin) ||
      ('REC-' + cleanRecId) === cleanLogin
    );
  });

  if (matchedByIdOnly && !password) {
    showToast("Tiklash ID raqami kiritildi. Adminga ruxsat so'rovi yuborish oynasi ochilmoqda...", 'info');
    showRecoveryModal({
      state: state.db,
      showToast,
      initialId: login,
      onAutoLogin: handleTeacherIdAutoLogin
    });
    return;
  }

  // Agar mahalliy topilmasa, Firestore bulutli bazadan eng yangi ma'lumotlarni tekshirish
  // (Masalan, hisob boshqa kompyuterda yangi yaratilgan bo'lsa)
  try {
    const cloudData = await fetchAllData();
    if (cloudData) {
      if (cloudData.schools) state.db.schools = cloudData.schools;
      if (cloudData.classes) state.db.classes = cloudData.classes;
      if (cloudData.students) state.db.students = cloudData.students;
      if (cloudData.developer) state.db.developer = cloudData.developer;
      saveData(state.db);

      // Qayta tekshirish
      if (login === state.db.developer?.login && password === state.db.developer?.password) {
        saveUserSession('developer', state.db.developer);
        state.currentUser = { role: 'developer', data: state.db.developer };
        state.isAppLocked = Boolean(state.db.developer?.pinCode);
        state.currentView = 'dashboard';
        showToast("Dasturchi sifatida tizimga xush kelibsiz!", 'success');
        renderApp();
        return;
      }

      schoolAdmin = state.db.schools.find(s => s.login === login && s.password === password);
      if (schoolAdmin) {
        saveUserSession('admin', schoolAdmin);
        state.currentUser = { role: 'admin', data: schoolAdmin };
        state.isAppLocked = Boolean(schoolAdmin.pinCode);
        state.currentView = 'dashboard';
        showToast(`${schoolAdmin.name} admini sifatida kirdingiz`, 'success');
        renderApp();
        return;
      }

      teacherClass = state.db.classes.find(c => c.login === login && c.password === password);
      if (teacherClass) {
        saveUserSession('teacher', teacherClass);
        state.currentUser = { role: 'teacher', data: teacherClass };
        state.isAppLocked = Boolean(teacherClass.pinCode);
        state.currentView = 'dashboard';
        showToast(`${teacherClass.name} sinf rahbari: ${teacherClass.teacherName}`, 'success');
        renderApp();
        return;
      }
    }
  } catch (err) {
    console.warn("Bulutli bazadan hisobni tekshirishda xatolik:", err);
  }

  showToast("Login yoki parol noto'g'ri! Parolni unutgan bo'lsangiz, 'Parolni unutdingizmi?' tugmasini bosing.", 'error');
}

// Haqiqiy chiqish jarayoni
function executeLogout() {
  clearUserSession();
  state.currentUser = null;
  state.isAppLocked = false;
  state.currentView = 'landing';
  state.selectedStudentId = null;
  state.selectedAdminSchoolId = null;
  state.selectedTeacherClassId = null;
  showToast("Hisobdan muvaffaqiyatli chiqildi");
  renderApp();
}

// Chiqish tugmasi bosilganda: Avval foydalanuvchidan modal orqali tasdiqlash so'raladi
function handleLogout() {
  if (!state.currentUser) {
    executeLogout();
    return;
  }

  const role = state.currentUser.role;
  let accountName = "Foydalanuvchi hisobi";
  let roleTitle = "Foydalanuvchi";
  let badgeColor = "bg-blue-50 text-blue-700 border-blue-200/80";

  if (role === 'developer') {
    accountName = `${state.db.developer?.name || 'WORKING CODE'} (Dasturchi)`;
    roleTitle = "Tizim Dasturchisi";
    badgeColor = "bg-purple-50 text-purple-700 border-purple-200/80";
  } else if (role === 'admin') {
    accountName = `${state.currentUser.data?.name || 'Maktab'} (Admin: ${state.currentUser.data?.adminName || ''})`;
    roleTitle = "Maktab Administratori";
    badgeColor = "bg-blue-50 text-blue-700 border-blue-200/80";
  } else if (role === 'teacher') {
    accountName = `${state.currentUser.data?.name || 'Sinf'} (Rahbar: ${state.currentUser.data?.teacherName || ''})`;
    roleTitle = "Sinf Rahbari";
    badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
  }

  showLogoutConfirmModal({
    accountName,
    roleTitle,
    badgeColor,
    isDeveloper: role === 'developer',
    onConfirm: executeLogout
  });
}

// Sleek Daytime Bottom Navigation Bar Component (Floating Pill Design)
function renderBottomBar() {
  if (!state.currentUser || state.currentView === 'login') return '';

  // 1. O'quvchining alohida dosye sahifasida: Barcha amallar Bottom Bar da (Rasm kabi suzuvchi kapsula)
  if (state.currentView === 'student-detail') {
    return `
      <nav id="bottom-nav-bar" class="fixed bottom-3 sm:bottom-5 inset-x-0 mx-auto w-fit z-40 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl shadow-slate-200/70 rounded-full px-2.5 sm:px-3.5 py-1.5 flex items-center justify-center gap-1.5 sm:gap-2.5 print-hide animate-fade-in">
        
        <!-- Orqaga -->
        <button 
          id="bottom-bar-back" 
          class="p-2.5 rounded-full text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Sinf ro'yxatiga qaytish"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
        </button>

        <!-- Nusxalash -->
        <button 
          id="bottom-bar-copy" 
          class="p-2.5 rounded-full text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Barcha ma'lumotlarni nusxalash"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
          </svg>
        </button>

        <!-- Eksport (PDF / Excel) -->
        <button 
          id="bottom-bar-export" 
          class="p-2.5 rounded-full text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Dosyeni PDF yoki Excel formatida yuklab olish"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </button>

        <!-- Chop etish -->
        <button 
          id="bottom-bar-print" 
          class="p-2.5 rounded-full text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Chop etish (PDF)"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
        </button>

        <!-- Tahrirlash -->
        <button 
          id="bottom-bar-edit" 
          class="p-2.5 rounded-full text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Tahrirlash"
          aria-label="Tahrirlash"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>

        <!-- O'chirish -->
        <button 
          id="bottom-bar-delete" 
          class="p-2.5 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 transition-all cursor-pointer shrink-0 active:scale-95"
          title="O'quvchini o'chirish"
          aria-label="O'chirish"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>

      </nav>
    `;
  }

  // 2. O'qituvchi (Sinf rahbari) roli - Mobile-First 4-Tab Modern Floating Navigation (Asosiy, Qidirish, Davomat, Sozlamalar)
  if (state.currentUser.role === 'teacher') {
    const isHome = state.currentView === 'dashboard';
    const isSearch = state.currentView === 'teacher-search';
    const isAttendance = state.currentView === 'attendance';
    const isSettings = state.currentView === 'teacher-settings' || 
                       state.currentView === 'teacher-help' || 
                       state.currentView === 'teacher-support' ||
                       state.currentView === 'teacher-change-credentials' ||
                       state.currentView === 'teacher-change-pin' ||
                       state.currentView === 'teacher-face-id';

    // Bugungi navbatchi ekanligini aniqlash (Davomat ustida indikator)
    let isDutyToday = false;
    try {
      const dutyInfo = getTodayDutyInfoForTeacher(state.currentUser.data, state.db);
      isDutyToday = Boolean(dutyInfo?.isDutyToday);
    } catch (_) {}

    return `
      <nav id="bottom-nav-bar" class="fixed bottom-2.5 sm:bottom-4 inset-x-2.5 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 max-w-lg w-[calc(100%-1.25rem)] sm:w-auto z-40 bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-xl shadow-slate-900/10 rounded-3xl p-1.5 flex items-center justify-around sm:justify-center gap-1 sm:gap-2 print-hide animate-fade-in">
        
        <!-- 1. Home (Asosiy sahifa) -->
        <button 
          id="bottom-nav-home" 
          class="flex flex-col items-center justify-center flex-1 sm:flex-initial py-1.5 px-3 sm:px-5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 select-none ${
            isHome 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
          }"
          title="Asosiy sahifa"
          aria-label="Asosiy"
        >
          <svg class="w-5 h-5 sm:w-5 sm:h-5 transition-transform ${isHome ? 'stroke-[2.5] scale-105' : 'stroke-2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <span class="text-[10px] sm:text-[11px] mt-0.5 tracking-tight font-semibold">Asosiy</span>
        </button>

        <!-- 2. Search (Qidirish sahifasi) -->
        <button 
          id="bottom-nav-search" 
          class="flex flex-col items-center justify-center flex-1 sm:flex-initial py-1.5 px-3 sm:px-5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 select-none ${
            isSearch 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
          }"
          title="O'quvchilarni qidirish"
          aria-label="Qidirish"
        >
          <svg class="w-5 h-5 sm:w-5 sm:h-5 transition-transform ${isSearch ? 'stroke-[2.5] scale-105' : 'stroke-2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <span class="text-[10px] sm:text-[11px] mt-0.5 tracking-tight font-semibold">Qidirish</span>
        </button>

        <!-- 3. Davomat -->
        <button 
          id="bottom-nav-attendance" 
          class="relative flex flex-col items-center justify-center flex-1 sm:flex-initial py-1.5 px-3 sm:px-5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 select-none ${
            isAttendance 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
          }"
          title="${
            isDutyToday 
              ? '⭐ Davomat (Bugun siz navbatchisiz)' 
              : 'Davomat va Dars qoldirish'
          }"
          aria-label="Davomat"
        >
          ${isDutyToday ? `
            <span class="absolute top-1 right-2 sm:right-3 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white shadow-xs animate-pulse" title="Bugun navbatchisiz"></span>
          ` : ''}
          <svg class="w-5 h-5 sm:w-5 sm:h-5 transition-transform ${isAttendance ? 'stroke-[2.5] scale-105' : 'stroke-2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
          <span class="text-[10px] sm:text-[11px] mt-0.5 tracking-tight font-semibold flex items-center gap-0.5">
            Davomat
          </span>
        </button>

        <!-- 4. Sozlamalar (Hisob, Parol, PIN, Face ID, Yordam, Qo'llab-quvvatlash, Versiya) -->
        <button 
          id="bottom-nav-settings" 
          class="flex flex-col items-center justify-center flex-1 sm:flex-initial py-1.5 px-3 sm:px-5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 select-none ${
            isSettings 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
          }"
          title="Sozlamalar va Xavfsizlik"
          aria-label="Sozlamalar"
        >
          <svg class="w-5 h-5 sm:w-5 sm:h-5 transition-transform ${isSettings ? 'stroke-[2.5] scale-105' : 'stroke-2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <span class="text-[10px] sm:text-[11px] mt-0.5 tracking-tight font-semibold">Sozlamalar</span>
        </button>

      </nav>
    `;
  }

  // 3. Maktab Admini roli - Nav bar: Bosh sahifa, Qidirish, Davomat, Sozlamalar
  if (state.currentUser.role === 'admin') {
    const isHome = state.currentView === 'dashboard';
    const isSearch = state.currentView === 'admin-search';
    const isAttendance = state.currentView === 'attendance';
    const isSettings = state.currentView === 'admin-settings';

    return `
      <nav id="bottom-nav-bar" class="fixed bottom-2.5 sm:bottom-4 inset-x-2.5 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 max-w-lg w-[calc(100%-1.25rem)] sm:w-auto z-40 bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-xl shadow-slate-900/10 rounded-3xl p-1.5 flex items-center justify-around sm:justify-center gap-1 sm:gap-2 print-hide animate-fade-in">
        
        <!-- 1. Asosiy -->
        <button 
          id="bottom-nav-home" 
          class="flex flex-col items-center justify-center flex-1 sm:flex-initial py-1.5 px-3 sm:px-5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 select-none ${
            isHome 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
          }"
          title="Asosiy"
          aria-label="Asosiy"
        >
          <svg class="w-5 h-5 sm:w-5 sm:h-5 transition-transform ${isHome ? 'stroke-[2.5] scale-105' : 'stroke-2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <span class="text-[10px] sm:text-[11px] mt-0.5 tracking-tight font-semibold">Asosiy</span>
        </button>

        <!-- 2. Qidirish sahifasi -->
        <button 
          id="bottom-nav-search" 
          class="flex flex-col items-center justify-center flex-1 sm:flex-initial py-1.5 px-3 sm:px-5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 select-none ${
            isSearch 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
          }"
          title="Qidirish sahifasi"
          aria-label="Qidirish"
        >
          <svg class="w-5 h-5 sm:w-5 sm:h-5 transition-transform ${isSearch ? 'stroke-[2.5] scale-105' : 'stroke-2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <span class="text-[10px] sm:text-[11px] mt-0.5 tracking-tight font-semibold">Qidirish</span>
        </button>

        <!-- 3. Davomat sahifasi -->
        <button 
          id="bottom-nav-attendance" 
          class="flex flex-col items-center justify-center flex-1 sm:flex-initial py-1.5 px-3 sm:px-5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 select-none ${
            isAttendance 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
          }"
          title="Davomat sahifasi"
          aria-label="Davomat"
        >
          <svg class="w-5 h-5 sm:w-5 sm:h-5 transition-transform ${isAttendance ? 'stroke-[2.5] scale-105' : 'stroke-2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
          <span class="text-[10px] sm:text-[11px] mt-0.5 tracking-tight font-semibold">Davomat</span>
        </button>

        <!-- 4. Sozlamalar sahifasi -->
        <button 
          id="bottom-nav-settings" 
          class="flex flex-col items-center justify-center flex-1 sm:flex-initial py-1.5 px-3 sm:px-5 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 select-none ${
            isSettings 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
          }"
          title="Sozlamalar sahifasi"
          aria-label="Sozlamalar"
        >
          <svg class="w-5 h-5 sm:w-5 sm:h-5 transition-transform ${isSettings ? 'stroke-[2.5] scale-105' : 'stroke-2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <span class="text-[10px] sm:text-[11px] mt-0.5 tracking-tight font-semibold">Sozlamalar</span>
        </button>

      </nav>
    `;
  }

  // 4. Dasturchi roli - Floating Pill Navigation
  if (state.currentUser.role === 'developer') {
    return `
      <nav id="bottom-nav-bar" class="fixed bottom-3 sm:bottom-5 inset-x-0 mx-auto w-fit z-40 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl shadow-slate-200/70 rounded-full px-2.5 sm:px-3.5 py-1.5 flex items-center justify-center gap-1.5 sm:gap-2.5 print-hide animate-fade-in">
        
        <!-- Bosh sahifa: Maktablar -->
        <button 
          id="bottom-nav-home" 
          class="p-2.5 rounded-full bg-[#EBF2FE] text-[#1E40AF] hover:bg-[#DEECFD] transition-all cursor-pointer shrink-0 active:scale-95"
          title="Maktablar ro'yxati"
          aria-label="Maktablar"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
        </button>

        <!-- Qidiruv -->
        <button 
          id="bottom-nav-search" 
          class="p-2.5 rounded-full text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Qidirish"
          aria-label="Qidirish"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </button>

        <!-- Yangi maktab qo'shish -->
        <button 
          id="bottom-nav-add-school" 
          class="p-2.5 rounded-full text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Yangi maktab qo'shish"
          aria-label="Yangi maktab qo'shish"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
        </button>

        <!-- Chiqish -->
        <button 
          id="bottom-nav-logout" 
          class="p-2.5 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Chiqish"
          aria-label="Chiqish"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </button>

      </nav>
    `;
  }

  return '';
}

// Server bilan sinxronlash holati
let isSyncingWithServer = false;

// Server bilan yangilash funksiyasi (Sayt ochilganda/yangilanganda yoki tugma bosilganda server bilan ma'lumot almashiladi)
async function handleSyncWithServer(isSilent = false) {
  if (isSyncingWithServer) return false;
  isSyncingWithServer = true;

  // Headerdagi tugma holatini darhol yangilash
  const refreshBtn = document.getElementById('header-refresh-btn');
  if (refreshBtn && !isSilent) {
    refreshBtn.classList.add('opacity-70', 'pointer-events-none');
    const icon = refreshBtn.querySelector('svg');
    if (icon) icon.classList.add('animate-spin');
    const label = refreshBtn.querySelector('span');
    if (label) label.textContent = 'Yangilanmoqda...';
  }

  const splashStatusText = document.getElementById('splash-status-text');
  if (splashStatusText) {
    splashStatusText.textContent = "Server bilan ma'lumotlar yangilanmoqda...";
  }

  let success = false;
  try {
    const cloudData = await fetchAllData(12000, 2);
    if (cloudData) {
      if (cloudData.schools && Array.isArray(cloudData.schools)) {
        state.db.schools = cloudData.schools;
      }
      if (cloudData.classes && Array.isArray(cloudData.classes)) {
        state.db.classes = cloudData.classes;
      }
      if (cloudData.students && Array.isArray(cloudData.students)) {
        cloudData.students.forEach(st => {
          if (st) {
            if (st.photo) st.photo = '';
            if (isFemaleStudent(st) && st.gender !== 'Qiz') st.gender = 'Qiz';
          }
        });
        state.db.students = cloudData.students;
      }
      if (cloudData.recoveryRequests && Array.isArray(cloudData.recoveryRequests)) {
        state.db.recoveryRequests = cloudData.recoveryRequests;
      }
      if (cloudData.shifts && Array.isArray(cloudData.shifts)) {
        state.db.shifts = cloudData.shifts;
      }
      if (cloudData.dutyRosters && Array.isArray(cloudData.dutyRosters)) {
        state.db.dutyRosters = cloudData.dutyRosters;
      }
      if (cloudData.attendanceRecords && Array.isArray(cloudData.attendanceRecords)) {
        state.db.attendanceRecords = cloudData.attendanceRecords;
      }
      if (cloudData.dutyAbsences && Array.isArray(cloudData.dutyAbsences)) {
        state.db.dutyAbsences = cloudData.dutyAbsences;
      }
      if (cloudData.adminNotifications && Array.isArray(cloudData.adminNotifications)) {
        state.db.adminNotifications = cloudData.adminNotifications;
      }
      if (cloudData.developer) {
        state.db.developer = cloudData.developer;
      }
      if (cloudData.siteInfo) {
        state.db.siteInfo = cloudData.siteInfo;
      }

      healStudentGenders(state.db);
      saveData(state.db);

      // Joriy sessiyani yangilash
      if (state.currentUser) {
        if (state.currentUser.role === 'admin') {
          const fresh = state.db.schools.find(s => s.id === state.currentUser.data.id);
          if (fresh) state.currentUser.data = fresh;
        } else if (state.currentUser.role === 'teacher') {
          const fresh = state.db.classes.find(c => c.id === state.currentUser.data.id);
          if (fresh) state.currentUser.data = fresh;
        } else if (state.currentUser.role === 'developer' && state.db.developer) {
          state.currentUser.data = state.db.developer;
        }
      }

      if (splashStatusText) {
        splashStatusText.textContent = "Server ma'lumotlari yangilandi";
      }

      if (!isSilent) {
        showToast("Server bilan ma'lumotlar muvaffaqiyatli yangilandi!", 'success');
      }
      success = true;
    } else {
      if (splashStatusText) {
        splashStatusText.textContent = "Lokal ma'lumotlar yuklanmoqda...";
      }
      if (!isSilent) {
        showToast("Server bilan bog'lanishda muammo bo'ldi. Internet aloqasini tekshiring.", 'error');
      }
    }
  } catch (err) {
    console.error("Server bilan yangilashda xatolik:", err);
    if (!isSilent) {
      showToast("Server bilan bog'lanishda xatolik yuz berdi", 'error');
    }
  } finally {
    isSyncingWithServer = false;
    renderApp();
  }
  return success;
}

// Navigatsiya va Sarlavha (Header - Admin, O'qituvchi va Dasturchi panellarida Yangilash tugmasi bilan)
function renderHeader() {
  if (!state.currentUser) return '';
  let title = '';
  let roleText = '';

  if (state.currentUser.role === 'teacher') {
    const school = state.db.schools?.find(s => s.id === state.currentUser.data?.schoolId);
    const schoolName = school?.name || 'Maktab';
    const className = state.currentUser.data?.name || '';
    title = `${schoolName}${className ? ` • ${className}` : ''}`;
    roleText = `Sinf rahbari: ${state.currentUser.data?.teacherName || 'Sinf rahbari'}`;
  } else if (state.currentUser.role === 'admin') {
    const schoolName = state.currentUser.data?.name || 'Maktab';
    title = schoolName;
    roleText = `Maktab Admini: ${state.currentUser.data?.adminName || 'Admin'}`;
  } else if (state.currentUser.role === 'developer') {
    title = state.db.siteInfo?.appName || 'MaktabX';
    roleText = 'Dasturchi: WORKING CODE';
  } else {
    title = 'MaktabX';
    roleText = 'Tizim foydalanuvchisi';
  }

  return `
    <header class="h-14 sm:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-3.5 sm:px-6 shrink-0 z-30 shadow-2xs">
      <div class="flex items-center gap-3 min-w-0">
        <img 
          src="/maktabx-logo.png" 
          alt="MaktabX" 
          class="w-9 h-9 object-contain shrink-0 drop-shadow-xs" 
          referrerPolicy="no-referrer"
        />
        <div class="min-w-0">
          <h1 class="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
            ${title}
          </h1>
          <p class="text-[11px] sm:text-xs text-slate-500 truncate font-medium">
            ${roleText}
          </p>
        </div>
      </div>

      <!-- O'ng tomon: Headerdagi Server bilan Yangilash tugmasi -->
      <div class="flex items-center gap-2 shrink-0">
        <button 
          type="button" 
          id="header-refresh-btn" 
          class="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-2xs select-none ${isSyncingWithServer ? 'opacity-70 pointer-events-none' : ''}"
          title="Server bilan ma'lumotlarni yangilash"
          aria-label="Server bilan yangilash"
        >
          <svg class="w-4 h-4 text-indigo-600 ${isSyncingWithServer ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <span class="font-bold">${isSyncingWithServer ? 'Yangilanmoqda...' : 'Yangilash'}</span>
        </button>
      </div>
    </header>
  `;
}

// -------------------------------------------------------------
// MODAL OYNA VA 5 SONIYALIK BEKOR QILISH (UNDO) TIZIMI
// -------------------------------------------------------------
let activeUndoTimer = null;
let currentUndoPayload = null;

function cancelActiveUndo(commitImmediately = true) {
  if (activeUndoTimer) {
    clearInterval(activeUndoTimer);
    activeUndoTimer = null;
  }
  const undoEl = document.getElementById('undo-notification');
  if (undoEl) {
    undoEl.remove();
  }
  if (commitImmediately && currentUndoPayload) {
    saveData(state.db);
    currentUndoPayload = null;
  }
}

function showDeleteConfirmModal({ title, itemName, itemDescription, onConfirm }) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div id="delete-modal-backdrop" class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 backdrop-blur-xs flex justify-center items-center p-3 sm:p-4 md:p-6 modal-backdrop-enter">
      <div class="modal-dialog-box bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-md p-5 sm:p-6 text-center my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain modal-dialog-enter">
        
        <div class="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-100 shadow-inner">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </div>

        <h3 class="text-base sm:text-lg font-bold text-slate-900">${title || "O'chirishni tasdiqlaysizmi?"}</h3>
        <p class="text-xs sm:text-sm text-slate-600 mt-2 mb-5">
          Haqiqatdan ham <strong class="text-slate-900 font-semibold">${itemName}</strong> ${itemDescription || ''}ni o'chirib tashlamoqchimisiz?
          <span class="block text-xs text-amber-700 font-medium mt-3 bg-amber-50 py-2 px-3 rounded-xl border border-amber-200/70">
            O'chirilgach, uni 5 soniya davomida bekor qilish imkoniyatingiz bo'ladi.
          </span>
        </p>

        <div class="flex items-center gap-3">
          <button 
            id="cancel-delete-modal-btn"
            type="button" 
            class="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors text-xs sm:text-sm cursor-pointer"
          >
            Yo'q, bekor qilish
          </button>
          <button 
            id="confirm-delete-modal-btn"
            type="button" 
            class="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-200 transition-colors text-xs sm:text-sm cursor-pointer"
          >
            Ha, o'chirilsin
          </button>
        </div>

      </div>
    </div>
  `;

  const backdrop = document.getElementById('delete-modal-backdrop');

  const closeModal = (callback) => {
    closeModalWithAnimation(backdrop, () => {
      modalContainer.innerHTML = '';
      if (typeof callback === 'function') callback();
    });
  };

  document.getElementById('cancel-delete-modal-btn')?.addEventListener('click', () => closeModal());
  document.getElementById('confirm-delete-modal-btn')?.addEventListener('click', () => {
    closeModal(() => {
      if (onConfirm) onConfirm();
    });
  });
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }
}

function startFiveSecondUndo({ itemName, onUndo, onCommit }) {
  // Avvalgi mavjud bo'lgan o'chirishni yakunlash
  cancelActiveUndo(true);

  let secondsLeft = 5;
  currentUndoPayload = { itemName, onUndo, onCommit };

  let undoContainer = document.getElementById('undo-container');
  if (!undoContainer) {
    undoContainer = document.createElement('div');
    undoContainer.id = 'undo-container';
    document.body.appendChild(undoContainer);
  }

  undoContainer.innerHTML = `
    <div id="undo-notification" class="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 w-[92%] sm:w-auto min-w-[320px] max-w-md bg-white text-slate-900 rounded-2xl p-3.5 shadow-2xl border-2 border-slate-200/90 flex items-center justify-between gap-3 animate-fade-in">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-xs font-bold truncate text-slate-900">${itemName} o'chirildi</div>
          <div class="text-[11px] text-slate-500 font-medium">Bekor qilish: <span id="undo-timer-count" class="font-bold text-amber-600 font-mono">5s</span></div>
        </div>
      </div>
      <button id="undo-action-btn" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-200 cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
        </svg>
        Bekor qilish
      </button>
    </div>
  `;

  document.getElementById('undo-action-btn')?.addEventListener('click', () => {
    cancelActiveUndo(false);
    onUndo();
    showToast(`${itemName} qayta tiklandi`, 'success');
  });

  activeUndoTimer = setInterval(() => {
    secondsLeft -= 1;
    const countEl = document.getElementById('undo-timer-count');
    if (countEl) {
      countEl.textContent = `${secondsLeft}s`;
    }
    if (secondsLeft <= 0) {
      cancelActiveUndo(false);
      if (onCommit) onCommit();
      showToast(`${itemName} butunlay o'chirildi`, 'info');
    }
  }, 1000);
}

// O'quvchini modal orqali va 5s undo bilan o'chirish
function executeDeleteStudent(studentId) {
  const student = state.db.students.find(s => s.id === studentId);
  if (!student) return;

  showDeleteConfirmModal({
    title: "O'quvchini o'chirish",
    itemName: student.fullName,
    itemDescription: "o'quvchisi",
    onConfirm: async () => {
      state.db.students = state.db.students.filter(s => s.id !== studentId);

      if (state.currentView === 'student-detail') {
        state.currentView = 'dashboard';
        state.selectedStudentId = null;
      }
      saveData(state.db);
      renderApp();

      // DIQQAT TALABI: O'chirish shu zahoti server (Firestore) bilan bog'lanib bajariladi!
      try {
        await deleteStudentFromFirestore(studentId);
        showToast("O'quvchi muvaffaqiyatli o'chirildi", 'success');
      } catch (err) {
        console.error("Firestore o'quvchini o'chirishda xatolik:", err);
      }
    }
  });
}

// Sinfni modal orqali darhol server bilan bog'lanib o'chirish
function executeDeleteClass(classId) {
  const cls = state.db.classes.find(c => c.id === classId);
  if (!cls) return;

  showDeleteConfirmModal({
    title: "Sinfni o'chirish",
    itemName: cls.name,
    itemDescription: "sinfi va uning barcha o'quvchilari",
    onConfirm: async () => {
      const deletedStudents = state.db.students.filter(s => s.classId === classId);

      state.db.classes = state.db.classes.filter(c => c.id !== classId);
      state.db.students = state.db.students.filter(s => s.classId !== classId);

      // Smenalardan ham ushbu sinfni olib tashlash
      if (Array.isArray(state.db.shifts)) {
        state.db.shifts.forEach(shift => {
          if (Array.isArray(shift.classIds)) {
            shift.classIds = shift.classIds.filter(id => id !== classId);
            saveShiftToFirestore(shift).catch(console.warn);
          }
        });
      }

      saveData(state.db);
      renderApp();

      // DIQQAT TALABI: O'chirish shu zahoti server (Firestore) bilan bog'lanib bajariladi!
      try {
        await deleteClassFromFirestore(classId);
        for (const s of deletedStudents) {
          await deleteStudentFromFirestore(s.id).catch(console.warn);
        }
        showToast("Sinf va barcha o'quvchilari o'chirildi", 'success');
      } catch (err) {
        console.error("Firestore sinfni o'chirishda xatolik:", err);
      }
    }
  });
}

// Maktab/Adminni modal orqali darhol server bilan bog'lanib o'chirish
function executeDeleteAdmin(schoolId) {
  const school = state.db.schools.find(s => s.id === schoolId);
  if (!school) return;

  showDeleteConfirmModal({
    title: "Maktabni o'chirish",
    itemName: school.name,
    itemDescription: "maktabi va unga tegishli barcha sinflar/o'quvchilar",
    onConfirm: async () => {
      const deletedClasses = state.db.classes.filter(c => c.schoolId === schoolId);
      const deletedStudents = state.db.students.filter(s => s.schoolId === schoolId);

      state.db.schools = state.db.schools.filter(s => s.id !== schoolId);
      state.db.classes = state.db.classes.filter(c => c.schoolId !== schoolId);
      state.db.students = state.db.students.filter(s => s.schoolId !== schoolId);

      saveData(state.db);
      renderApp();

      // DIQQAT TALABI: O'chirish shu zahoti server (Firestore) bilan bog'lanib bajariladi!
      try {
        await deleteSchoolFromFirestore(schoolId);
        for (const c of deletedClasses) {
          await deleteClassFromFirestore(c.id).catch(console.warn);
        }
        for (const s of deletedStudents) {
          await deleteStudentFromFirestore(s.id).catch(console.warn);
        }
        showToast("Maktab va unga tegishli barcha ma'lumotlar o'chirildi", 'success');
      } catch (err) {
        console.error("Firestore maktabni o'chirishda xatolik:", err);
      }
    }
  });
}

// -------------------------------------------------------------
// SAYT VA DASTURCHI HAQIDA MODAL OYNASI
// -------------------------------------------------------------
function openAboutModal() {
  showAboutModal({
    siteInfo: state.db.siteInfo,
    developer: state.db.developer,
    isDeveloper: state.currentUser?.role === 'developer',
    onOpenDeveloperSettings: () => {
      if (state.currentUser?.role === 'developer') {
        state.currentView = 'dashboard';
        renderApp('settings');
      }
    }
  });
}

// -------------------------------------------------------------
// LOGIN VA PAROLNI O'ZGARTIRISH FUNKSIYALARI
// -------------------------------------------------------------
function openChangeCredentialsModal(options = {}) {
  if (!state.currentUser) return;
  const role = state.currentUser.role;
  let targetName = '';
  let currentLogin = '';
  let currentPassword = '';

  if (role === 'developer') {
    targetName = `Dasturchi (${state.db.developer?.name || 'WORKING CODE'})`;
    currentLogin = state.db.developer?.login || '1234';
    currentPassword = state.db.developer?.password || '1234';
  } else if (role === 'admin') {
    const school = state.currentUser.data;
    targetName = `${school.name} (Admin: ${school.adminName})`;
    currentLogin = school.login;
    currentPassword = school.password;
  } else if (role === 'teacher') {
    const classItem = state.currentUser.data;
    targetName = `${classItem.name} sinf (Rahbar: ${classItem.teacherName})`;
    currentLogin = classItem.login;
    currentPassword = classItem.password;
  }

  showChangeCredentialsModal({
    currentUser: state.currentUser,
    userRole: role,
    targetName,
    currentLogin,
    showToast,
    isFromIdLogin: !!options?.isFromIdLogin,
    reason: options?.reason || '',
    onOpenPinSettings: openPinSettingsModal,
    onSave: async ({ newLogin, newPassword }) => {
      if (role === 'developer') {
        state.db.developer.login = newLogin;
        state.db.developer.password = newPassword;
        saveData(state.db);
        saveSystemConfigToFirestore({
          developer: state.db.developer,
          siteInfo: state.db.siteInfo
        }).catch(err => console.error("Cloud save dev creds error:", err));
        showToast("Dasturchi login va paroli muvaffaqiyatli yangilandi", 'success');
      } else if (role === 'admin') {
        const schoolId = state.currentUser.data.id;
        const idx = state.db.schools.findIndex(s => s.id === schoolId);
        if (idx >= 0) {
          state.db.schools[idx].login = newLogin;
          state.db.schools[idx].password = newPassword;
          state.currentUser.data = state.db.schools[idx];
          saveData(state.db);
          saveUserSession('admin', state.currentUser.data);
          saveSchoolToFirestore(state.db.schools[idx]).catch(err => console.error("Cloud save school creds error:", err));
          showToast("Maktab admin login va paroli muvaffaqiyatli yangilandi", 'success');
        }
      } else if (role === 'teacher') {
        const classId = state.currentUser.data.id;
        const idx = state.db.classes.findIndex(c => c.id === classId);
        if (idx >= 0) {
          state.db.classes[idx].login = newLogin;
          state.db.classes[idx].password = newPassword;
          state.currentUser.data = state.db.classes[idx];
          saveData(state.db);
          saveUserSession('teacher', state.currentUser.data);
          try {
            localStorage.removeItem('maktabx_pending_cred_update');
          } catch (_) {}
          saveClassToFirestore(state.db.classes[idx]).catch(err => console.error("Cloud save class creds error:", err));
          showToast("Yangi login va parolingiz muvaffaqiyatli saqlandi!", 'success');
        }
      }
      renderApp();
    }
  });
}

// Dasturchi ma'lumotlarini saqlash
async function handleSaveDeveloperProfile(profileData) {
  try {
    state.db.developer = {
      ...state.db.developer,
      ...profileData
    };
    saveData(state.db);
    renderApp('settings');
    await saveSystemConfigToFirestore({
      developer: state.db.developer,
      siteInfo: state.db.siteInfo
    });
    showToast("Dasturchi shaxsiy ma'lumotlari serverga muvaffaqiyatli saqlandi!", 'success');
  } catch (err) {
    console.error("Bulutli bazaga dasturchi ma'lumotlarini saqlashda xatolik:", err);
    showToast("Serverga saqlashda xatolik yuz berdi", 'error');
  }
}

// Dasturchi login va parolini saqlash
async function handleSaveDeveloperCredentials({ newLogin, newPassword }) {
  try {
    state.db.developer.login = newLogin;
    state.db.developer.password = newPassword;
    saveData(state.db);
    renderApp('settings');
    await saveSystemConfigToFirestore({
      developer: state.db.developer,
      siteInfo: state.db.siteInfo
    });
    showToast("Dasturchi login va paroli serverga muvaffaqiyatli saqlandi!", 'success');
  } catch (err) {
    console.error("Bulutli bazaga login/parolni saqlashda xatolik:", err);
    showToast("Serverga saqlashda xatolik yuz berdi", 'error');
  }
}

// Sayt ma'lumotlarini saqlash
async function handleSaveSiteInfo(siteData) {
  try {
    state.db.siteInfo = {
      ...state.db.siteInfo,
      ...siteData
    };
    if (state.db.siteInfo?.title) {
      document.title = state.db.siteInfo.title;
    }
    saveData(state.db);
    renderApp('settings');
    await saveSystemConfigToFirestore({
      developer: state.db.developer,
      siteInfo: state.db.siteInfo
    });
    showToast("Sayt va tizim ma'lumotlari serverga saqlandi va yangilandi!", 'success');
  } catch (err) {
    console.error("Bulutli bazaga sayt ma'lumotlarini saqlashda xatolik:", err);
    showToast("Serverga saqlashda xatolik: " + (err.message || "Tarmoq xatosi"), 'error');
  }
}

// Parolni tiklash so'rovlarini tasdiqlash, rad etish va o'chirish
async function handleApproveRecoveryRequest(requestId) {
  try {
    if (!state.db.recoveryRequests) state.db.recoveryRequests = [];
    const req = state.db.recoveryRequests.find(r => r.id === requestId);
    if (req) {
      req.status = 'approved';
      req.updatedAt = new Date().toISOString();
      saveData(state.db);
    }
    await updateRecoveryRequestStatusInFirestore(requestId, 'approved');
    showToast("Kirish so'rovi tasdiqlandi. O'qituvchi hisobiga kirishga ruxsat berildi!", 'success');
    renderApp();
  } catch (err) {
    console.error("So'rovni tasdiqlashda xatolik:", err);
    showToast("So'rovni tasdiqlashda xatolik yuz berdi", 'error');
  }
}

async function handleRejectRecoveryRequest(requestId) {
  try {
    if (!state.db.recoveryRequests) state.db.recoveryRequests = [];
    const req = state.db.recoveryRequests.find(r => r.id === requestId);
    if (req) {
      req.status = 'rejected';
      req.updatedAt = new Date().toISOString();
      saveData(state.db);
    }
    await updateRecoveryRequestStatusInFirestore(requestId, 'rejected');
    showToast("Kirish so'rovi rad etildi", 'info');
    renderApp();
  } catch (err) {
    console.error("So'rovni rad etishda xatolik:", err);
    showToast("So'rovni rad etishda xatolik yuz berdi", 'error');
  }
}

async function handleDeleteRecoveryRequest(requestId) {
  try {
    state.db.recoveryRequests = (state.db.recoveryRequests || []).filter(r => r.id !== requestId);
    saveData(state.db);
    await deleteRecoveryRequestFromFirestore(requestId);
    showToast("So'rov ro'yxatdan o'chirildi", 'info');
    renderApp();
  } catch (err) {
    console.error("So'rovni o'chirishda xatolik:", err);
    showToast("So'rovni o'chirishda xatolik yuz berdi", 'error');
  }
}

// -------------------------------------------------------------
// DAVOMAT, SMENALAR VA NAVBATCHILIK BOSHQRUVI HANDLERS
// -------------------------------------------------------------
async function handleSaveShift(shift) {
  try {
    if (!state.db.shifts) state.db.shifts = [];
    const idx = state.db.shifts.findIndex(s => s.id === shift.id);
    if (idx >= 0) {
      state.db.shifts[idx] = shift;
    } else {
      state.db.shifts.push(shift);
    }
    saveData(state.db);
    await saveShiftToFirestore(shift);
  } catch (err) {
    console.error("Smenani saqlashda xatolik:", err);
    showToast("Smenani serverga saqlashda xatolik yuz berdi", 'error');
  }
}

async function handleDeleteShift(shiftId) {
  try {
    state.db.shifts = (state.db.shifts || []).filter(s => s.id !== shiftId);
    saveData(state.db);
    await deleteShiftFromFirestore(shiftId);
  } catch (err) {
    console.error("Smenani o'chirishda xatolik:", err);
    showToast("Smenani o'chirishda xatolik yuz berdi", 'error');
  }
}

async function handleSaveRoster(roster) {
  try {
    if (!state.db.dutyRosters) state.db.dutyRosters = [];
    const idx = state.db.dutyRosters.findIndex(r => r.id === roster.id);
    if (idx >= 0) {
      state.db.dutyRosters[idx] = roster;
    } else {
      state.db.dutyRosters.push(roster);
    }
    saveData(state.db);
    await saveDutyRosterToFirestore(roster);
  } catch (err) {
    console.error("Navbatchilik jadvalini saqlashda xatolik:", err);
    showToast("Navbatchilik jadvalini saqlashda xatolik yuz berdi", 'error');
  }
}

async function handleDeleteRoster(rosterId) {
  try {
    state.db.dutyRosters = (state.db.dutyRosters || []).filter(r => r.id !== rosterId);
    saveData(state.db);
    await deleteDutyRosterFromFirestore(rosterId);
  } catch (err) {
    console.error("Navbatchilik jadvalini o'chirishda xatolik:", err);
  }
}

async function handleSaveAttendanceRecord(record) {
  try {
    if (!state.db.attendanceRecords) state.db.attendanceRecords = [];
    const idx = state.db.attendanceRecords.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      state.db.attendanceRecords[idx] = record;
    } else {
      state.db.attendanceRecords.push(record);
    }
    saveData(state.db);
    await saveAttendanceRecordToFirestore(record);
  } catch (err) {
    console.error("Davomat yozuvini saqlashda xatolik:", err);
    showToast("Davomatni serverga saqlashda xatolik yuz berdi", 'error');
  }
}

// PIN-kod va Face ID sozlamalari oynasini ochish
function openPinSettingsModal() {
  if (!state.currentUser) return;
  showPinSettingsModal({
    currentUser: state.currentUser,
    userRole: state.currentUser.role,
    showToast,
    onSavePin: (newPin) => {
      handleSavePin(newPin);
    },
    onRemovePin: () => {
      handleRemovePin();
    },
    onSaveFaceId: (faceData) => {
      handleSaveFaceId(faceData);
    },
    onRemoveFaceId: () => {
      handleRemoveFaceId();
    },
    onLockNow: () => {
      state.isAppLocked = true;
      showToast("Kabinet qulflandi", "info");
      renderApp();
    }
  });
}

function handleSaveFaceId(faceData) {
  if (!state.currentUser || !state.currentUser.data) return;
  state.currentUser.data.faceIdData = faceData;

  const role = state.currentUser.role;
  const userId = state.currentUser.data.id;

  if (role === 'teacher') {
    const cls = state.db.classes?.find(c => c.id === userId);
    if (cls) {
      cls.faceIdData = faceData;
      saveClassToFirestore(cls).catch(err => console.warn("Firestore sinf Face ID saqlash:", err));
    }
    saveUserSession('teacher', state.currentUser.data);
  } else if (role === 'admin') {
    const school = state.db.schools?.find(s => s.id === userId);
    if (school) {
      school.faceIdData = faceData;
      saveSchoolToFirestore(school).catch(err => console.warn("Firestore maktab Face ID saqlash:", err));
    }
    saveUserSession('admin', state.currentUser.data);
  } else if (role === 'developer') {
    if (state.db.developer) {
      state.db.developer.faceIdData = faceData;
      saveSystemConfigToFirestore({ developer: state.db.developer }).catch(err => console.warn("Firestore dev Face ID saqlash:", err));
    }
    saveUserSession('developer', state.currentUser.data);
  }

  saveData(state.db);
  showToast("Face ID muvaffaqiyatli saqlandi! Endi istalgan qurilmadan yuzingiz bilan tezkor kira olasiz.", "success");
  renderApp();
}

function handleRemoveFaceId() {
  if (!state.currentUser || !state.currentUser.data) return;
  state.currentUser.data.faceIdData = null;

  const role = state.currentUser.role;
  const userId = state.currentUser.data.id;

  if (role === 'teacher') {
    const cls = state.db.classes?.find(c => c.id === userId);
    if (cls) {
      cls.faceIdData = null;
      saveClassToFirestore(cls).catch(err => console.warn("Firestore sinf Face ID o'chirish:", err));
    }
    saveUserSession('teacher', state.currentUser.data);
  } else if (role === 'admin') {
    const school = state.db.schools?.find(s => s.id === userId);
    if (school) {
      school.faceIdData = null;
      saveSchoolToFirestore(school).catch(err => console.warn("Firestore maktab Face ID o'chirish:", err));
    }
    saveUserSession('admin', state.currentUser.data);
  } else if (role === 'developer') {
    if (state.db.developer) {
      state.db.developer.faceIdData = null;
      saveSystemConfigToFirestore({ developer: state.db.developer }).catch(err => console.warn("Firestore dev Face ID o'chirish:", err));
    }
    saveUserSession('developer', state.currentUser.data);
  }

  saveData(state.db);
  showToast("Face ID muvaffaqiyatli o'chirildi.", "info");
  renderApp();
}

// Bosh Login sahifasidan barcha hisoblar uchun Face ID orqali tezkor kirish
function handleFaceIdLogin() {
  const candidateAccounts = [];

  // 1. Barcha sinf rahbarlari (O'qituvchilar)
  (state.db.classes || []).forEach(cls => {
    if (cls.faceIdData?.enabled && cls.faceIdData?.descriptor) {
      candidateAccounts.push({
        role: 'teacher',
        name: cls.teacherName ? `${cls.name} (${cls.teacherName})` : cls.name,
        data: cls,
        faceIdData: cls.faceIdData
      });
    }
  });

  // 2. Maktab adminlari
  (state.db.schools || []).forEach(sch => {
    if (sch.faceIdData?.enabled && sch.faceIdData?.descriptor) {
      candidateAccounts.push({
        role: 'admin',
        name: sch.adminName ? `${sch.name} (${sch.adminName})` : sch.name,
        data: sch,
        faceIdData: sch.faceIdData
      });
    }
  });

  // 3. Dasturchi hisobi
  if (state.db.developer?.faceIdData?.enabled && state.db.developer?.faceIdData?.descriptor) {
    candidateAccounts.push({
      role: 'developer',
      name: 'Bosh Dasturchi',
      data: state.db.developer,
      faceIdData: state.db.developer.faceIdData
    });
  }

  if (candidateAccounts.length === 0) {
    showToast("Hozircha tizimdagi birorta hisobda Face ID o'rnatilmagan. Avval tizimga kirib, sozlamalardan Face ID o'rnating.", "info");
    return;
  }

  showFaceAuthModal({
    mode: 'universal_login',
    candidateAccounts,
    onSuccess: (matchedAcc) => {
      if (matchedAcc.role === 'developer') {
        clearUserSession();
        state.currentUser = {
          role: 'developer',
          data: state.db.developer
        };
        state.isAppLocked = false;
        state.currentView = 'dashboard';
        showToast("Face ID orqali Dasturchi hisobiga muvaffaqiyatli kirildi! Xush kelibsiz!", 'success');
        renderApp();
      } else if (matchedAcc.role === 'admin') {
        saveUserSession('admin', matchedAcc.data);
        state.currentUser = {
          role: 'admin',
          data: matchedAcc.data
        };
        state.isAppLocked = false;
        state.currentView = 'dashboard';
        showToast(`Face ID orqali ${matchedAcc.data.name} admin hisobiga muvaffaqiyatli kirildi!`, 'success');
        renderApp();
      } else if (matchedAcc.role === 'teacher') {
        saveUserSession('teacher', matchedAcc.data);
        state.currentUser = {
          role: 'teacher',
          data: matchedAcc.data
        };
        state.isAppLocked = false;
        state.currentView = 'dashboard';
        showToast(`Face ID orqali ${matchedAcc.data.teacherName || matchedAcc.data.name} kabinetiga muvaffaqiyatli kirildi!`, 'success');
        renderApp();
      }
    },
    showToast
  });
}

// Birinchi marta kirganda Majburiy PIN-kod o'rnatish tekshiruvi
function checkFirstLoginPinRequirement() {
  if (!state.currentUser || state.currentUser.role === 'developer') return false;
  if (state.isAppLocked) return false;

  const userData = state.currentUser.data;
  // Agar PIN-kod yo'q bo'lsa yoki isFirstLogin true bo'lsa
  const needsPin = !userData?.pinCode || userData?.isFirstLogin === true;
  if (needsPin) {
    showFirstLoginPinModal({
      currentUser: state.currentUser,
      onSavePin: (newPin) => {
        handleSaveFirstLoginPin(newPin);
      },
      onCancelLogout: () => {
        executeLogout();
      },
      showToast
    });
    return true;
  }
  return false;
}

function handleSaveFirstLoginPin(newPin) {
  if (!state.currentUser || !state.currentUser.data) return;
  state.currentUser.data.pinCode = newPin;
  state.currentUser.data.isFirstLogin = false;

  const role = state.currentUser.role;
  const userId = state.currentUser.data.id;

  if (role === 'teacher') {
    const cls = state.db.classes?.find(c => c.id === userId);
    if (cls) {
      cls.pinCode = newPin;
      cls.isFirstLogin = false;
      saveClassToFirestore(cls).catch(err => console.warn("Firestore sinf PIN saqlash:", err));
    }
    saveUserSession('teacher', state.currentUser.data);
  } else if (role === 'admin') {
    const school = state.db.schools?.find(s => s.id === userId);
    if (school) {
      school.pinCode = newPin;
      school.isFirstLogin = false;
      saveSchoolToFirestore(school).catch(err => console.warn("Firestore maktab PIN saqlash:", err));
    }
    saveUserSession('admin', state.currentUser.data);
  }

  saveData(state.db);
  state.isAppLocked = false;
  showToast("Kabinet PIN-kodi muvaffaqiyatli tasdiqlandi va o'rnatildi! Xush kelibsiz!", "success");
  renderApp();
}

function handleSavePin(newPin) {
  if (!state.currentUser) return;
  if (!state.currentUser.data) state.currentUser.data = {};
  state.currentUser.data.pinCode = newPin;

  const role = state.currentUser.role;
  if (role === 'teacher') {
    const classId = state.currentUser.data.id;
    const cls = state.db.classes?.find(c => c.id === classId);
    if (cls) {
      cls.pinCode = newPin;
      saveClassToFirestore(cls).catch(err => console.warn("Firestore sinf PIN saqlash:", err));
    }
    saveUserSession('teacher', state.currentUser.data);
  } else if (role === 'admin') {
    const schoolId = state.currentUser.data.id;
    const school = state.db.schools?.find(s => s.id === schoolId);
    if (school) {
      school.pinCode = newPin;
      saveSchoolToFirestore(school).catch(err => console.warn("Firestore maktab PIN saqlash:", err));
    }
    saveUserSession('admin', state.currentUser.data);
  } else if (role === 'developer') {
    if (state.db.developer) {
      state.db.developer.pinCode = newPin;
      saveSystemConfigToFirestore({ developer: state.db.developer }).catch(err => console.warn("Firestore dev PIN saqlash:", err));
    }
  }

  saveData(state.db);
  showToast("Kabinet uchun PIN-kod muvaffaqiyatli o'rnatildi! Endi har gal profilingizga kirganingizda ushbu PIN-kod talab qilinadi.", "success");
  renderApp();
}

function handleRemovePin() {
  if (!state.currentUser) return;
  if (state.currentUser.data) {
    delete state.currentUser.data.pinCode;
  }

  const role = state.currentUser.role;
  if (role === 'teacher') {
    const classId = state.currentUser.data?.id;
    const cls = state.db.classes?.find(c => c.id === classId);
    if (cls) {
      delete cls.pinCode;
      saveClassToFirestore(cls).catch(err => console.warn("Firestore sinf PIN o'chirish:", err));
    }
    saveUserSession('teacher', state.currentUser.data);
  } else if (role === 'admin') {
    const schoolId = state.currentUser.data?.id;
    const school = state.db.schools?.find(s => s.id === schoolId);
    if (school) {
      delete school.pinCode;
      saveSchoolToFirestore(school).catch(err => console.warn("Firestore maktab PIN o'chirish:", err));
    }
    saveUserSession('admin', state.currentUser.data);
  } else if (role === 'developer') {
    if (state.db.developer) {
      delete state.db.developer.pinCode;
      saveSystemConfigToFirestore({ developer: state.db.developer }).catch(err => console.warn("Firestore dev PIN o'chirish:", err));
    }
  }

  state.isAppLocked = false;
  saveData(state.db);
  showToast("Kabinet PIN-kod himoyasi bekor qilindi", "info");
  renderApp();
}

function handleResetClassPin(classId) {
  const cls = state.db.classes?.find(c => c.id === classId);
  if (!cls) return;
  openDeleteConfirmModal({
    title: "O'qituvchi PIN-kodini bekor qilish",
    message: `Haqiqatan ham "${cls.teacherName || cls.name}" hisobining 4 xonali kabinet PIN-kodini bekor qilmoqchimisiz? Foydalanuvchi tizimga kirganida PIN-kod so'ralmaydi va o'zi yangi PIN o'rnata oladi.`,
    confirmText: "PIN-kodni o'chirish",
    danger: true,
    onConfirm: () => {
      delete cls.pinCode;
      saveClassToFirestore(cls).catch(err => console.warn("Firestore sinf PIN o'chirish:", err));
      saveData(state.db);
      showToast("O'qituvchining PIN-kodi muvaffaqiyatli bekor qilindi", "success");
      renderApp();
    }
  });
}

function handleResetSchoolPin(schoolId) {
  const school = state.db.schools?.find(s => s.id === schoolId);
  if (!school) return;
  openDeleteConfirmModal({
    title: "Admin PIN-kodini bekor qilish",
    message: `Haqiqatan ham "${school.name}" maktab admini hisobining 4 xonali kabinet PIN-kodini bekor qilmoqchimisiz?`,
    confirmText: "PIN-kodni o'chirish",
    danger: true,
    onConfirm: () => {
      delete school.pinCode;
      saveSchoolToFirestore(school).catch(err => console.warn("Firestore maktab PIN o'chirish:", err));
      saveData(state.db);
      showToast("Maktab adminining PIN-kodi muvaffaqiyatli bekor qilindi", "success");
      renderApp();
    }
  });
}

// Asosiy ilovani ekranga chizish (Main render loop)
function syncDynamicSeoTags() {
  try {
    const origin = window.location.origin;
    const cleanUrl = origin + window.location.pathname;
    const logoUrl = `${origin}/maktabx-logo.png`;

    const canonicalEl = document.getElementById('canonical-link');
    if (canonicalEl) canonicalEl.setAttribute('href', cleanUrl);

    const ogUrlEl = document.getElementById('og-url-meta');
    if (ogUrlEl) ogUrlEl.setAttribute('content', cleanUrl);

    const ogImgEl = document.getElementById('og-image-meta');
    if (ogImgEl) ogImgEl.setAttribute('content', logoUrl);

    const twImgEl = document.getElementById('twitter-image-meta');
    if (twImgEl) twImgEl.setAttribute('content', logoUrl);

    const jsonLdEl = document.getElementById('maktabx-jsonld');
    if (jsonLdEl && jsonLdEl.textContent) {
      const defaultHost = 'https://ais-pre-gs4rr5pquvbx4k23icdb23-697446284775.asia-southeast1.run.app';
      if (origin && origin !== defaultHost && jsonLdEl.textContent.includes(defaultHost)) {
        jsonLdEl.textContent = jsonLdEl.textContent.split(defaultHost).join(origin);
      }
    }
  } catch (_) {}
}

function renderApp(initialTab = null) {
  syncDynamicSeoTags();
  const app = document.getElementById('app');
  if (!app) return;

  // AGAR MAXFIY TIZIM BOSHQARUVI TERMINALI OCHILGAN BO'LSA:
  if (state.isSystemTerminalOpen) {
    renderSystemTerminal(app, {
      state: state.db,
      onCommitChanges: async (stagedChanges) => {
        // 1. Dasturchi login yoki parolini yangilash
        let devUpdated = false;
        if (stagedChanges.newDevLogin) {
          state.db.developer.login = stagedChanges.newDevLogin;
          devUpdated = true;
        }
        if (stagedChanges.newDevPassword) {
          state.db.developer.password = stagedChanges.newDevPassword;
          devUpdated = true;
        }
        if (devUpdated) {
          saveData(state.db);
          await saveSystemConfigToFirestore({
            developer: state.db.developer,
            updatedAt: new Date().toISOString()
          }).catch(console.error);
        }

        // 2. /refresh orqali 1 haftalik arxivdan tiklangan foydalanuvchilar
        if (stagedChanges.restoredLogins && stagedChanges.restoredLogins.length > 0) {
          for (const item of stagedChanges.restoredLogins) {
            if (item.type === 'school' && item.schoolData) {
              if (!state.db.schools.some(s => s.id === item.schoolData.id)) {
                state.db.schools.push(item.schoolData);
                await saveSchoolToFirestore(item.schoolData).catch(console.error);
              }
              if (item.classes && item.classes.length > 0) {
                for (const cls of item.classes) {
                  if (!state.db.classes.some(c => c.id === cls.id)) {
                    state.db.classes.push(cls);
                    await saveClassToFirestore(cls).catch(console.error);
                  }
                }
              }
              if (item.students && item.students.length > 0) {
                for (const st of item.students) {
                  if (!state.db.students.some(s => s.id === st.id)) {
                    state.db.students.push(st);
                    await saveStudentToFirestore(st).catch(console.error);
                  }
                }
              }
            } else if (item.type === 'class' && item.classData) {
              if (!state.db.classes.some(c => c.id === item.classData.id)) {
                state.db.classes.push(item.classData);
                await saveClassToFirestore(item.classData).catch(console.error);
              }
              if (item.students && item.students.length > 0) {
                for (const st of item.students) {
                  if (!state.db.students.some(s => s.id === st.id)) {
                    state.db.students.push(st);
                    await saveStudentToFirestore(st).catch(console.error);
                  }
                }
              }
            }

            // Arxivdan o'chirish
            state.db.trash = (state.db.trash || []).filter(t => t.id !== item.id);
            await deleteTrashFromFirestore(item.id).catch(console.error);
          }
          saveData(state.db);
        }
      },
      onCloseTerminal: () => {
        state.isSystemTerminalOpen = false;
        renderApp();
      }
    });
    return;
  }

  if (!state.currentUser || state.currentView === 'landing' || state.currentView === 'login') {
    const prevScroll = document.getElementById('main-content')?.scrollTop || 0;
    app.innerHTML = `
      <div class="flex h-screen w-full bg-transparent font-sans overflow-hidden text-slate-800">
        <main id="main-content" class="flex-1 overflow-y-auto">
          <div id="view-container"></div>
        </main>
      </div>
    `;
    const viewContainer = document.getElementById('view-container');
    const mainEl = document.getElementById('main-content');

    if (state.currentView === 'login') {
      renderLogin(viewContainer, {
        siteInfo: state.db.siteInfo,
        developer: state.db.developer,
        onLogin: handleLogin,
        onOpenAbout: openAboutModal,
        onBackToLanding: () => {
          state.currentView = 'landing';
          renderApp();
          const m = document.getElementById('main-content');
          if (m) m.scrollTop = 0;
        },
        onOpenSystemTerminal: () => {
          state.isSystemTerminalOpen = true;
          renderApp();
        },
        onForgotPassword: (initialId = '') => {
          showRecoveryModal({
            state: state.db,
            showToast,
            initialId: typeof initialId === 'string' ? initialId : '',
            onAutoLogin: handleTeacherIdAutoLogin
          });
        }
      });
    } else {
      renderLanding(viewContainer, {
        siteInfo: state.db.siteInfo,
        developer: state.db.developer,
        db: state.db,
        showToast,
        onGoToLogin: () => {
          state.currentView = 'login';
          renderApp();
          const m = document.getElementById('main-content');
          if (m) m.scrollTop = 0;
        },
        onOpenAbout: openAboutModal,
        onForgotPassword: (initialId = '') => {
          showRecoveryModal({
            state: state.db,
            showToast,
            initialId: typeof initialId === 'string' ? initialId : '',
            onAutoLogin: handleTeacherIdAutoLogin
          });
        }
      });
      if (mainEl && prevScroll > 0) {
        mainEl.scrollTop = prevScroll;
      }
    }
    return;
  }

  // AGAR KABINET PIN-KOD BILAN QULFLANGAN BO'LSA:
  // Har doim profilingizga kirganingizda 4 xonali PIN-kod ekrani chiqadi
  if (state.currentUser && state.isAppLocked) {
    app.innerHTML = `<div id="pin-lock-container" class="h-screen w-full overflow-hidden"></div>`;
    const lockContainer = document.getElementById('pin-lock-container');
    renderPinLockScreen(lockContainer, {
      currentUser: state.currentUser,
      getRealExpectedPin: () => {
        if (state.currentUser?.role === 'developer') {
          return String(state.db.developer?.pinCode || '').trim();
        } else if (state.currentUser?.role === 'admin') {
          const school = state.db.schools?.find(s => s.id === state.currentUser.data?.id);
          return String(school?.pinCode || state.currentUser.data?.pinCode || '').trim();
        } else if (state.currentUser?.role === 'teacher') {
          const cls = state.db.classes?.find(c => c.id === state.currentUser.data?.id);
          return String(cls?.pinCode || state.currentUser.data?.pinCode || '').trim();
        }
        return String(state.currentUser?.data?.pinCode || '').trim();
      },
      onUnlock: (enteredPin) => {
        let realPin = '';
        if (state.currentUser?.role === 'developer') {
          realPin = String(state.db.developer?.pinCode || '').trim();
        } else if (state.currentUser?.role === 'admin') {
          const school = state.db.schools?.find(s => s.id === state.currentUser.data?.id);
          realPin = String(school?.pinCode || state.currentUser.data?.pinCode || '').trim();
        } else if (state.currentUser?.role === 'teacher') {
          const cls = state.db.classes?.find(c => c.id === state.currentUser.data?.id);
          realPin = String(cls?.pinCode || state.currentUser.data?.pinCode || '').trim();
        } else {
          realPin = String(state.currentUser?.data?.pinCode || '').trim();
        }

        if (realPin && String(enteredPin).trim() !== realPin) {
          showToast("Xavfsizlik: Noto'g'ri PIN-kod kiritildi!", 'error');
          return false;
        }

        state.isAppLocked = false;
        showToast("Kabinet qulfdan chiqarildi", "success");
        renderApp();
        return true;
      },
      onLogout: handleLogout,
      showToast,
      onSaveFaceId: (faceData) => {
        handleSaveFaceId(faceData);
      },
      onForgotPin: () => {
        showPinRecoveryModal({
          state: state.db,
          currentUser: state.currentUser,
          showToast,
          onUnlockWithFaceId: () => {
            state.isAppLocked = false;
            showToast("Face ID orqali kabinet qulfdan ochildi! Xush kelibsiz!", "success");
            renderApp();
          }
        });
      }
    });
    return;
  }

  // Kirilgan holatda: Zamonaviy Top Header + Asosiy Kontent + Bottom Bar (Navbar o'rnida)
  app.innerHTML = `
    <div class="flex flex-col h-screen w-full bg-transparent font-sans overflow-hidden text-slate-800">
      ${renderHeader()}
      <main id="main-content" class="flex-1 p-3.5 sm:p-6 lg:p-8 overflow-y-auto min-w-0 pb-36 sm:pb-28">
        <div id="view-container" class="animate-fade-in min-h-full pb-10"></div>
      </main>
      ${renderBottomBar()}
    </div>
  `;

  // Birinchi marta kirayotgan foydalanuvchilar (Admin yoki O'qituvchi) uchun majburiy PIN-kod o'rnatish
  checkFirstLoginPinRequirement();

  // Attach Header listeners
  const headerRefreshBtn = document.getElementById('header-refresh-btn');
  if (headerRefreshBtn) headerRefreshBtn.addEventListener('click', handleSyncWithServer);

  const headerLogoutBtn = document.getElementById('header-logout-btn');
  if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', handleLogout);

  const headerAboutBtn = document.getElementById('header-about-btn');
  if (headerAboutBtn) headerAboutBtn.addEventListener('click', openAboutModal);

  const headerCredsBtn = document.getElementById('header-creds-btn');
  if (headerCredsBtn) headerCredsBtn.addEventListener('click', openChangeCredentialsModal);

  const headerPinBtn = document.getElementById('header-pin-btn');
  if (headerPinBtn) headerPinBtn.addEventListener('click', openPinSettingsModal);

  const headerLockNowBtn = document.getElementById('header-lock-now-btn');
  if (headerLockNowBtn) {
    headerLockNowBtn.addEventListener('click', () => {
      state.isAppLocked = true;
      showToast("Kabinet qulflandi", "info");
      renderApp();
    });
  }

  // Attach Bottom bar logout listener
  const bottomLogoutBtn = document.getElementById('bottom-nav-logout');
  if (bottomLogoutBtn) bottomLogoutBtn.addEventListener('click', handleLogout);

  // Attach Bottom bar search listener
  const bottomSearchBtn = document.getElementById('bottom-nav-search');
  if (bottomSearchBtn) {
    bottomSearchBtn.addEventListener('click', () => {
      if (state.currentUser?.role === 'admin') {
        if (state.currentView !== 'admin-search') {
          state.previousView = state.currentView;
          state.currentView = 'admin-search';
          renderApp();
        } else {
          const searchInput = document.getElementById('admin-search-input');
          if (searchInput) searchInput.focus();
        }
      } else if (state.currentUser?.role === 'teacher') {
        if (state.currentView !== 'teacher-search') {
          state.previousView = state.currentView;
          state.currentView = 'teacher-search';
          renderApp();
        } else {
          const searchInput = document.getElementById('teacher-search-input');
          if (searchInput) searchInput.focus();
        }
      } else {
        const studentSearch = document.getElementById('student-search-input');
        const schoolSearch = document.getElementById('school-search-input');
        const classSearch = document.getElementById('class-search-input');
        const targetInput = studentSearch || schoolSearch || classSearch;
        if (targetInput) {
          targetInput.focus();
          targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  // Attach Bottom bar home listener
  const bottomHomeBtn = document.getElementById('bottom-nav-home');
  if (bottomHomeBtn) {
    bottomHomeBtn.addEventListener('click', () => {
      if (state.currentView !== 'dashboard') {
        state.currentView = 'dashboard';
        state.selectedStudentId = null;
        renderApp();
      } else {
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Attach Bottom bar attendance listener
  const bottomAttendanceBtn = document.getElementById('bottom-nav-attendance');
  if (bottomAttendanceBtn) {
    bottomAttendanceBtn.addEventListener('click', () => {
      if (state.currentView !== 'attendance') {
        state.previousView = state.currentView;
        state.currentView = 'attendance';
        renderApp();
      } else {
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Attach Bottom bar settings listener
  const bottomSettingsBtn = document.getElementById('bottom-nav-settings');
  if (bottomSettingsBtn) {
    bottomSettingsBtn.addEventListener('click', () => {
      if (state.currentUser?.role === 'admin') {
        if (state.currentView !== 'admin-settings') {
          state.previousView = state.currentView;
          state.currentView = 'admin-settings';
          renderApp();
        } else {
          const mainContent = document.getElementById('main-content');
          if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else if (state.currentUser?.role === 'teacher') {
        if (state.currentView !== 'teacher-settings') {
          state.previousView = state.currentView;
          state.currentView = 'teacher-settings';
          renderApp();
        } else {
          const mainContent = document.getElementById('main-content');
          if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    });
  }

  const viewContainer = document.getElementById('view-container');

  // 0.005 Maktab Admini Qidiruv Sahifasi (Admin Search View)
  if (state.currentView === 'admin-search' && state.currentUser?.role === 'admin') {
    const currentSchool = state.currentUser.data;
    renderAdminSearchView(viewContainer, {
      state: state.db,
      currentSchool,
      onViewStudent: (studentId) => {
        state.selectedStudentId = studentId;
        state.previousView = 'admin-search';
        state.currentView = 'student-detail';
        renderApp();
      },
      onEditStudent: (studentId) => {
        const st = state.db.students.find(s => s.id === studentId);
        openStudentModal(studentId, st ? st.classId : null, currentSchool.id);
      },
      showToast
    });
    return;
  }

  // 0.006 Maktab Admini Sozlamalar Sahifasi (Admin Settings View)
  if (state.currentView === 'admin-settings' && state.currentUser?.role === 'admin') {
    const currentSchool = state.currentUser.data;
    renderAdminSettingsView(viewContainer, {
      state: state.db,
      currentSchool,
      onChangeCredentials: openChangeCredentialsModal,
      onOpenPinSettings: openPinSettingsModal,
      onOpenFaceIdAuth: () => {
        showFaceAuthModal({
          currentSchool,
          onSaveFaceId: (faceData) => {
            handleSaveFaceId(faceData);
          },
          showToast
        });
      },
      onRemoveFaceId: () => {
        if (currentSchool.faceIdData) {
          delete currentSchool.faceIdData;
          saveData(state.db);
          saveSchoolToFirestore(currentSchool).catch(console.error);
          showToast("Face ID ma'lumotlari o'chirildi", "info");
          renderApp();
        }
      },
      onLogout: handleLogout,
      showToast
    });
    return;
  }

  // 0.01 Sinf Rahbari Qidiruv Sahifasi (Teacher Search View)
  if (state.currentView === 'teacher-search' && state.currentUser?.role === 'teacher') {
    const currentClass = state.currentUser.data;
    renderTeacherSearchView(viewContainer, {
      state: state.db,
      currentClass,
      onViewStudent: (studentId) => {
        state.selectedStudentId = studentId;
        state.previousView = 'teacher-search';
        state.currentView = 'student-detail';
        renderApp();
      },
      onEditStudent: (studentId) => {
        openStudentModal(studentId, currentClass.id, currentClass.schoolId);
      },
      onAddStudent: () => {
        openStudentModal(null, currentClass.id, currentClass.schoolId);
      },
      onBack: () => {
        state.currentView = state.previousView || 'dashboard';
        renderApp();
      },
      showToast
    });
    return;
  }

  // 0.02 Sinf Rahbari Sozlamalar Sahifasi (Teacher Settings View)
  if (state.currentView === 'teacher-settings' && state.currentUser?.role === 'teacher') {
    const currentClass = state.currentUser.data;
    renderTeacherSettingsView(viewContainer, {
      state: state.db,
      currentClass,
      onChangeCredentials: openChangeCredentialsModal,
      onOpenPinSettings: openPinSettingsModal,
      onOpenFaceIdAuth: () => {
        showFaceAuthModal({
          currentClass,
          onSaveFaceId: (faceData) => {
            handleSaveFaceId(faceData);
          },
          showToast
        });
      },
      onRemoveFaceId: () => {
        if (currentClass.faceIdData) {
          delete currentClass.faceIdData;
          saveData(state.db);
          saveClassToFirestore(currentClass).catch(console.error);
          showToast("Face ID ma'lumotlari o'chirildi", "info");
          renderApp();
        }
      },
      onOpenChangeCredentialsPage: () => {
        state.previousView = 'teacher-settings';
        state.currentView = 'teacher-change-credentials';
        renderApp();
      },
      onOpenChangePinPage: () => {
        state.previousView = 'teacher-settings';
        state.currentView = 'teacher-change-pin';
        renderApp();
      },
      onOpenFaceIdPage: () => {
        state.previousView = 'teacher-settings';
        state.currentView = 'teacher-face-id';
        renderApp();
      },
      onOpenHelp: () => {
        state.previousView = 'teacher-settings';
        state.currentView = 'teacher-help';
        renderApp();
      },
      onOpenSupport: () => {
        state.previousView = 'teacher-settings';
        state.currentView = 'teacher-support';
        renderApp();
      },
      onLogout: handleLogout,
      showToast
    });
    return;
  }

  // 0.021 Sinf Rahbari Login va Parolni Yangilash Sahifasi
  if (state.currentView === 'teacher-change-credentials' && state.currentUser?.role === 'teacher') {
    const currentClass = state.currentUser.data;
    renderTeacherChangeCredentialsView(viewContainer, {
      state: state.db,
      currentClass,
      onSaveSuccess: async ({ newLogin, newPassword }) => {
        currentClass.login = newLogin;
        currentClass.password = newPassword;
        currentClass.updatedAt = new Date().toISOString();
        saveData(state.db);
        try {
          await saveClassToFirestore(currentClass);
        } catch (e) {
          console.error("Firestore ga yangi login/parolni saqlashda xatolik:", e);
        }
        showToast("Login va parol muvaffaqiyatli yangilandi!", "success");
        state.currentView = 'teacher-settings';
        renderApp();
      },
      onBack: () => {
        state.currentView = 'teacher-settings';
        renderApp();
      },
      showToast
    });
    return;
  }

  // 0.022 Sinf Rahbari PIN-kodni O'zgartirish Sahifasi
  if (state.currentView === 'teacher-change-pin' && state.currentUser?.role === 'teacher') {
    const currentClass = state.currentUser.data;
    renderTeacherChangePinView(viewContainer, {
      state: state.db,
      currentClass,
      onSavePin: async (newPin) => {
        currentClass.pinCode = newPin;
        currentClass.updatedAt = new Date().toISOString();
        saveData(state.db);
        try {
          await saveClassToFirestore(currentClass);
        } catch (e) {
          console.error("Firestore ga PIN-kod saqlashda xatolik:", e);
        }
        showToast("Yangi 4 xonali PIN-kod muvaffaqiyatli saqlandi!", "success");
        state.currentView = 'teacher-settings';
        renderApp();
      },
      onRemovePin: async () => {
        delete currentClass.pinCode;
        currentClass.updatedAt = new Date().toISOString();
        saveData(state.db);
        try {
          await saveClassToFirestore(currentClass);
        } catch (e) {
          console.error("Firestore ga PIN o'chirishda xatolik:", e);
        }
        showToast("PIN-kod muvaffaqiyatli bekor qilindi (o'chirildi)", "info");
        state.currentView = 'teacher-settings';
        renderApp();
      },
      onBack: () => {
        state.currentView = 'teacher-settings';
        renderApp();
      },
      showToast
    });
    return;
  }

  // 0.023 Sinf Rahbari Face ID Sahifasi
  if (state.currentView === 'teacher-face-id' && state.currentUser?.role === 'teacher') {
    const currentClass = state.currentUser.data;
    renderTeacherFaceIdView(viewContainer, {
      state: state.db,
      currentClass,
      onSaveFaceId: async (faceData) => {
        currentClass.faceIdData = faceData;
        currentClass.updatedAt = new Date().toISOString();
        saveData(state.db);
        try {
          await saveClassToFirestore(currentClass);
        } catch (e) {
          console.error("Firestore ga Face ID saqlashda xatolik:", e);
        }
        showToast("Face ID muvaffaqiyatli saqlandi!", "success");
      },
      onRemoveFaceId: async () => {
        delete currentClass.faceIdData;
        currentClass.updatedAt = new Date().toISOString();
        saveData(state.db);
        try {
          await saveClassToFirestore(currentClass);
        } catch (e) {
          console.error("Firestore ga Face ID o'chirishda xatolik:", e);
        }
        showToast("Face ID ma'lumotlari o'chirildi", "info");
      },
      onBack: () => {
        state.currentView = 'teacher-settings';
        renderApp();
      },
      showToast
    });
    return;
  }

  // 0.03 Sinf Rahbari Yo'riqnoma yoki Qo'llab-quvvatlash Sahifasi (Help / Support View)
  if ((state.currentView === 'teacher-help' || state.currentView === 'teacher-support') && state.currentUser?.role === 'teacher') {
    const currentClass = state.currentUser.data;
    renderTeacherHelpView(viewContainer, {
      state: state.db,
      currentClass,
      initialSection: state.currentView === 'teacher-support' ? 'support' : 'help',
      onBack: () => {
        state.currentView = state.previousView || 'teacher-settings';
        renderApp();
      },
      showToast
    });
    return;
  }

  // 1.05 Ta'lim platformalari boshqaruvi alohida sahifasi
  if (state.currentView === 'platforms') {
    const classId = state.selectedTeacherClassId || (state.currentUser?.role === 'teacher' ? state.currentUser.data.id : state.selectedClassId);
    let cls = state.db.classes.find(c => c.id === classId);
    if (!cls && state.currentUser?.role === 'teacher') {
      cls = state.currentUser.data;
    }
    if (!cls && state.db.classes.length > 0) {
      cls = state.db.classes[0];
    }
    const school = cls ? state.db.schools.find(s => s.id === cls.schoolId) : null;
    const students = cls ? state.db.students.filter(s => s.classId === cls.id) : [];

    renderPlatformsView(viewContainer, {
      currentClass: cls,
      school,
      students,
      state: state.db,
      showToast,
      onBack: () => {
        state.currentView = state.previousView || 'dashboard';
        renderApp();
      },
      onAddPlatform: (newPlatform) => {
        if (!cls) return;
        if (!Array.isArray(cls.platforms)) cls.platforms = [];

        const lowerName = (newPlatform.name || '').toLowerCase().trim();
        const existing = cls.platforms.find(p => 
          p.id === newPlatform.id || 
          (p.name && p.name.toLowerCase().trim() === lowerName) ||
          ((lowerName.includes('kundalik') || lowerName.includes('emaktab')) && 
           (p.name.toLowerCase().includes('kundalik') || p.name.toLowerCase().includes('emaktab') || p.id === 'plat-kundalik'))
        );

        if (existing) {
          showToast(`"${existing.name}" platformasi allaqachon qo'shilgan`, 'info');
          renderApp();
          return;
        }

        cls.platforms.push(newPlatform);
        normalizeAllPlatforms(state.db);
        saveData(state.db);
        saveClassToFirestore(cls).catch(err => console.warn("Firestore sinxronlash:", err));
        showToast(`"${newPlatform.name}" muvaffaqiyatli qo'shildi`, 'success');
        renderApp();
      },
      onUpdatePlatform: (updatedPlatform) => {
        if (!cls || !Array.isArray(cls.platforms)) return;
        const pIdx = cls.platforms.findIndex(p => p.id === updatedPlatform.id);
        if (pIdx >= 0) {
          cls.platforms[pIdx] = updatedPlatform;
          normalizeAllPlatforms(state.db);
          saveData(state.db);
          saveClassToFirestore(cls).catch(err => console.warn("Firestore sinxronlash:", err));
          showToast(`"${updatedPlatform.name}" yangilandi`, 'success');
          renderApp();
        }
      },
      onDeletePlatform: (platformId) => {
        if (!cls || !Array.isArray(cls.platforms)) return;
        const targetPlat = cls.platforms.find(p => p.id === platformId);
        cls.platforms = cls.platforms.filter(p => p.id !== platformId);
        // Ushbu sinf o'quvchilaridan ham platforma login/parollarini tozalash
        if (Array.isArray(state.db.students)) {
          state.db.students.filter(s => s && s.classId === cls.id).forEach(s => {
            if (s.platforms && s.platforms[platformId]) {
              delete s.platforms[platformId];
              saveStudentToFirestore(s).catch(err => console.warn("O'quvchi platforma tozalash:", err));
            }
          });
        }
        normalizeAllPlatforms(state.db);
        saveData(state.db);
        saveClassToFirestore(cls).catch(err => console.warn("Firestore sinxronlash:", err));
        showToast(`"${targetPlat ? targetPlat.name : 'Platforma'}" muvaffaqiyatli o'chirildi`, 'success');
        renderApp();
      },
      onUpdateStudentPlatformCredential: (studentId, platformId, loginArg, passwordArg) => {
        const std = state.db.students.find(s => s.id === studentId);
        if (!std) return;
        if (!std.platforms) std.platforms = {};

        let login = '';
        let password = '';
        if (typeof loginArg === 'object' && loginArg !== null) {
          login = String(loginArg.login || '').trim();
          password = String(loginArg.password || passwordArg || '').trim();
        } else {
          login = String(loginArg || '').trim();
          password = String(passwordArg || '').trim();
        }

        if (login || password) {
          std.platforms[platformId] = { login, password };
        } else {
          delete std.platforms[platformId];
        }

        normalizeAllPlatforms(state.db);
        saveData(state.db);
        saveStudentToFirestore(std).catch(err => console.warn("Firestore sinxronlash:", err));
      },
      onOpenStudentDetail: (studentId) => {
        state.selectedStudentId = studentId;
        state.previousView = 'platforms';
        state.currentView = 'student-detail';
        renderApp();
      }
    });
    return;
  }

  // 0. Davomat va Smenalar sahifasi
  if (state.currentView === 'attendance') {
    if (state.currentUser?.role === 'admin') {
      const currentSchool = state.currentUser.data;
      renderAdminAttendanceView(viewContainer, {
        state: state.db,
        currentSchool,
        onSaveShift: handleSaveShift,
        onDeleteShift: handleDeleteShift,
        onSaveAttendanceRecord: handleSaveAttendanceRecord,
        onRefreshData: () => handleSyncWithServer(false),
        showToast
      });
      return;
    }

    if (state.currentUser?.role === 'teacher') {
      const freshClass = (state.db.classes || []).find(c => c.id === state.currentUser.data?.id) || state.currentUser.data;
      state.currentUser.data = freshClass;
    }

    const currentSchool = state.currentUser?.role === 'teacher'
      ? (state.db.schools.find(s => s.id === state.currentUser.data.schoolId) || state.db.schools[0] || null)
      : (state.db.schools[0] || null);

    renderAttendanceView(viewContainer, {
      currentUser: state.currentUser,
      state: state.db,
      currentSchool,
      initialTab: 'take_attendance',
      showToast,
      onSaveShift: handleSaveShift,
      onDeleteShift: handleDeleteShift,
      onSaveRoster: handleSaveRoster,
      onDeleteRoster: handleDeleteRoster,
      onSaveAttendanceRecord: handleSaveAttendanceRecord,
      onRefreshData: () => handleSyncWithServer(false),
      onBack: () => {
        state.currentView = state.previousView || 'dashboard';
        renderApp();
      }
    });
    return;
  }

  // 1. O'quvchining alohida dosye sahifasi
  if (state.currentView === 'student-detail') {
    const student = state.db.students.find(s => s.id === state.selectedStudentId);
    if (!student) {
      state.currentView = state.previousView || 'dashboard';
      renderApp();
      return;
    }
    const studentClass = state.db.classes.find(c => c.id === student.classId);
    const school = state.db.schools.find(s => s.id === (studentClass ? studentClass.schoolId : student.schoolId));

    const isFromAdmin = state.currentUser?.role === 'admin';
    const isFromDev = state.previousView === 'developer' || 
                      state.previousView === 'developer-admin-detail' || 
                      state.previousView === 'developer-teacher-detail' || 
                      state.currentUser?.role === 'developer';

    const backButtonText = isFromAdmin 
      ? "Maktab boshqaruviga qaytish" 
      : (isFromDev ? "Dasturchi paneliga qaytish" : "Sinf ro'yxatiga qaytish");

    renderStudentDetail(viewContainer, {
      student,
      school,
      studentClass,
      showToast,
      backButtonLabel: backButtonText,
      onBack: () => {
        state.currentView = state.previousView || 'dashboard';
        state.selectedStudentId = null;
        renderApp();
      },
      onEdit: (studentId) => {
        openStudentModal(studentId);
      },
      onDelete: (studentId) => {
        executeDeleteStudent(studentId);
      },
      onExport: (studentId) => {
        handleExportSingleStudent(studentId || student.id);
      },
      onExportWord: async (studentId) => {
        const std = state.db.students.find(s => s.id === (studentId || student.id));
        if (!std) return;
        try {
          await exportSingleStudentToWord(std, school, studentClass);
          showToast("O'quvchi dosyesi Word (.docx) formatida yuklab olindi", 'success');
        } catch (err) {
          showToast("Word faylini yaratishda xatolik yuz berdi", 'error');
        }
      },
      onExportExcel: (studentId) => {
        const std = state.db.students.find(s => s.id === (studentId || student.id));
        if (!std) return;
        try {
          exportSingleStudentToExcel(std, school, studentClass);
          showToast("O'quvchi ma'lumotlari Excel (.xlsx) da yuklab olindi", 'success');
        } catch (err) {
          showToast("Excel yuklab olishda xatolik yuz berdi", 'error');
        }
      },
      onExportPDF: (studentId) => {
        const std = state.db.students.find(s => s.id === (studentId || student.id));
        if (!std) return;
        try {
          exportSingleStudentToPDF(std, school, studentClass);
          showToast("O'quvchining rasmiy dosyesi PDF (.pdf) da yuklab olindi", 'success');
        } catch (err) {
          showToast("PDF yaratishda xatolik yuz berdi", 'error');
        }
      },
      onPrint: () => {
        window.print();
      }
    });
    return;
  }

  // 1.1 Dasturchi uchun Maktab Admini batafsil sahifasi
  if (state.currentView === 'developer-admin-detail') {
    const school = state.db.schools.find(s => s.id === state.selectedAdminSchoolId);
    if (!school) {
      state.currentView = 'dashboard';
      renderApp();
      return;
    }

    renderAdminUserDetail(viewContainer, {
      school,
      state: state.db,
      showToast,
      onResetPin: (schoolId) => {
        handleResetSchoolPin(schoolId);
      },
      onBack: () => {
        state.currentView = 'dashboard';
        state.selectedAdminSchoolId = null;
        renderApp();
      },
      onEditSchool: (schoolId) => {
        openAdminModal(schoolId);
      },
      onDeleteSchool: (schoolId) => {
        executeDeleteAdmin(schoolId);
      },
      onViewTeacher: (classId) => {
        state.selectedTeacherClassId = classId;
        state.previousView = 'developer-admin-detail';
        state.currentView = 'developer-teacher-detail';
        renderApp();
      },
      onViewStudent: (studentId) => {
        state.selectedStudentId = studentId;
        state.previousView = 'developer-admin-detail';
        state.currentView = 'student-detail';
        renderApp();
      }
    });
    return;
  }

  // 1.2 Dasturchi uchun Sinf Rahbari (O'qituvchi) batafsil sahifasi
  if (state.currentView === 'developer-teacher-detail') {
    const classItem = state.db.classes.find(c => c.id === state.selectedTeacherClassId);
    if (!classItem) {
      state.currentView = 'dashboard';
      renderApp();
      return;
    }

    const isFromAdmin = state.currentUser?.role === 'admin';

    renderTeacherUserDetail(viewContainer, {
      classItem,
      state: state.db,
      showToast,
      backButtonLabel: isFromAdmin ? "Maktab boshqaruviga qaytish" : "Dasturchi paneliga qaytish",
      onResetPin: (classId) => {
        handleResetClassPin(classId);
      },
      onBack: () => {
        state.currentView = state.previousView || 'dashboard';
        state.selectedTeacherClassId = null;
        renderApp();
      },
      onEditClass: (classId, schoolId) => {
        openClassModal(classId, schoolId);
      },
      onDeleteClass: (classId) => {
        executeDeleteClass(classId);
      },
      onManagePlatforms: () => {
        state.selectedClassId = classItem.id;
        state.selectedTeacherClassId = classItem.id;
        state.previousView = 'developer-teacher-detail';
        state.currentView = 'platforms';
        renderApp();
      },
      onViewSchool: (schoolId) => {
        if (state.currentUser?.role === 'admin') {
          state.currentView = 'dashboard';
          renderApp();
          return;
        }
        state.selectedAdminSchoolId = schoolId;
        state.previousView = 'developer-teacher-detail';
        state.currentView = 'developer-admin-detail';
        renderApp();
      },
      onViewStudent: (studentId) => {
        state.selectedStudentId = studentId;
        state.previousView = 'developer-teacher-detail';
        state.currentView = 'student-detail';
        renderApp();
      },
      onExportClass: (students) => {
        handleExportClassStudents(students);
      }
    });
    return;
  }

  // 2. Dasturchi ko'rinishi
  if (state.currentUser.role === 'developer') {
    // Bottom bar actions
    const bottomAddSchool = document.getElementById('bottom-nav-add-school');
    if (bottomAddSchool) bottomAddSchool.onclick = () => openAdminModal();

    renderDeveloper(viewContainer, {
      state: state.db,
      isLoading: state.isLoadingStudents,
      onRefreshData: handleSyncWithServer,
      showToast,
      initialTab: initialTab || 'users',
      onAddAdmin: () => openAdminModal(),
      onEditAdmin: (schoolId) => openAdminModal(schoolId),
      onDeleteAdmin: (schoolId) => {
        executeDeleteAdmin(schoolId);
      },
      onViewAdmin: (schoolId) => {
        state.selectedAdminSchoolId = schoolId;
        state.previousView = 'developer';
        state.currentView = 'developer-admin-detail';
        renderApp();
      },
      onViewTeacher: (classId) => {
        state.selectedTeacherClassId = classId;
        state.previousView = 'developer';
        state.currentView = 'developer-teacher-detail';
        renderApp();
      },
      onViewStudent: (studentId) => {
        state.selectedStudentId = studentId;
        state.previousView = 'developer';
        state.currentView = 'student-detail';
        renderApp();
      },
      onSaveDeveloperProfile: handleSaveDeveloperProfile,
      onSaveDeveloperCredentials: handleSaveDeveloperCredentials,
      onSaveSiteInfo: handleSaveSiteInfo,
      onSaveDeveloperPin: (newPin) => {
        handleSavePin(newPin);
      },
      onRemoveDeveloperPin: () => {
        handleRemovePin();
      },
      onApproveRecoveryRequest: handleApproveRecoveryRequest,
      onRejectRecoveryRequest: handleRejectRecoveryRequest,
      onDeleteRecoveryRequest: handleDeleteRecoveryRequest
    });
    return;
  }

  // 3. Maktab Admini ko'rinishi
  if (state.currentUser.role === 'admin') {
    const currentSchool = state.currentUser.data;

    // Bottom bar actions
    const bottomAddClass = document.getElementById('bottom-nav-add-class');
    if (bottomAddClass) bottomAddClass.onclick = () => openClassModal(null, currentSchool.id);

    renderAdmin(viewContainer, {
      state: state.db,
      currentSchool,
      isLoading: state.isLoadingStudents,
      onRefreshData: handleSyncWithServer,
      onChangeCredentials: openChangeCredentialsModal,
      onAddClass: () => openClassModal(null, currentSchool.id),
      onEditClass: (classId) => openClassModal(classId, currentSchool.id),
      onDeleteClass: (classId) => {
        executeDeleteClass(classId);
      },
      onViewTeacher: (classId) => {
        state.selectedTeacherClassId = classId;
        state.previousView = 'dashboard';
        state.currentView = 'developer-teacher-detail';
        renderApp();
      },
      onViewStudent: (studentId) => {
        state.selectedStudentId = studentId;
        state.previousView = 'dashboard';
        state.currentView = 'student-detail';
        renderApp();
      },
      onApproveRecoveryRequest: handleApproveRecoveryRequest,
      onRejectRecoveryRequest: handleRejectRecoveryRequest,
      onDeleteRecoveryRequest: handleDeleteRecoveryRequest,
      onOpenAttendance: () => {
        state.previousView = 'dashboard';
        state.currentView = 'attendance';
        renderApp();
      },
      showToast
    });
    return;
  }

  // 4. O'qituvchi (Sinf Rahbari) ko'rinishi
  if (state.currentUser.role === 'teacher') {
    const freshClass = (state.db.classes || []).find(c => c.id === state.currentUser.data?.id) || state.currentUser.data;
    state.currentUser.data = freshClass;
    const currentClass = freshClass;

    // Bottom bar actions for teacher
    const bottomAddStudent = document.getElementById('bottom-nav-add-student');
    if (bottomAddStudent) {
      bottomAddStudent.onclick = () => openStudentModal(null, currentClass.id, currentClass.schoolId);
    }

    const bottomExportBtn = document.getElementById('bottom-nav-export');
    if (bottomExportBtn) {
      bottomExportBtn.onclick = () => {
        handleExportClassStudents();
      };
    }

    const bottomPlatformsBtn = document.getElementById('bottom-nav-platforms');
    if (bottomPlatformsBtn) {
      bottomPlatformsBtn.onclick = () => {
        state.previousView = 'dashboard';
        state.currentView = 'platforms';
        renderApp();
      };
    }

    renderTeacher(viewContainer, {
      state: state.db,
      currentClass,
      isLoading: state.isLoadingStudents,
      onRefreshData: async () => {
        try {
          const cloudData = await fetchAllData();
          if (cloudData && cloudData.students) {
            state.db.students = cloudData.students;
            saveData(state.db);
          }
          showToast("Ma'lumotlar muvaffaqiyatli yangilandi", 'success');
        } catch (e) {
          console.error("Yangilashda xatolik:", e);
        }
      },
      onChangeCredentials: openChangeCredentialsModal,
      onManagePlatforms: () => {
        state.previousView = 'dashboard';
        state.currentView = 'platforms';
        renderApp();
      },
      onOpenAttendance: () => {
        state.previousView = 'dashboard';
        state.currentView = 'attendance';
        renderApp();
      },
      onAddStudent: () => openStudentModal(null, currentClass.id, currentClass.schoolId),
      onViewStudent: (studentId) => {
        state.selectedStudentId = studentId;
        state.currentView = 'student-detail';
        renderApp();
      },
      onEditStudent: (studentId) => openStudentModal(studentId, currentClass.id, currentClass.schoolId),
      onDeleteStudent: (studentId) => {
        executeDeleteStudent(studentId);
      },
      onExportList: (studentsList) => handleExportClassStudents(studentsList),
      onExportSingleStudent: (studentId) => handleExportSingleStudent(studentId),
      onExportCSV: (studentsList) => handleExportClassStudents(studentsList)
    });
    return;
  }
}

// Modal ochish funksiyalari
function openStudentModal(studentId = null, classId = null, schoolId = null) {
  const student = studentId ? state.db.students.find(s => s.id === studentId) : null;
  const targetClassId = classId || (student ? student.classId : (state.currentUser?.role === 'teacher' ? state.currentUser.data.id : null));
  const targetSchoolId = schoolId || (student ? student.schoolId : (state.currentUser?.role === 'teacher' ? state.currentUser.data.schoolId : null));

  const targetClass = state.db.classes.find(c => c.id === targetClassId);
  const platforms = getClassPlatforms(state.db, targetClassId);

  showStudentModal({
    student,
    currentClassId: targetClassId,
    currentSchoolId: targetSchoolId,
    platforms,
    onQuickAddPlatform: (newPlatform) => {
      if (targetClass) {
        if (!Array.isArray(targetClass.platforms)) targetClass.platforms = [];
        if (!targetClass.platforms.some(p => p.id === newPlatform.id)) {
          targetClass.platforms.push(newPlatform);
          saveData(state.db);
          saveClassToFirestore(targetClass).catch(err => console.warn(err));
          showToast(`"${newPlatform.name}" sinf platformalari ro'yxatiga qo'shildi`, 'success');
        }
      }
    },
    onSave: async (studentData) => {
      const idx = state.db.students.findIndex(s => s.id === studentData.id);
      if (idx >= 0) {
        state.db.students[idx] = studentData;
        showToast("O'quvchi ma'lumotlari yangilandi", 'success');
      } else {
        state.db.students.push(studentData);
        showToast("Yangi o'quvchi muvaffaqiyatli qo'shildi", 'success');
      }
      // Saqlash bosilgandan so'ng qoralamani butunlay tozalash
      try {
        localStorage.removeItem('maktab_student_draft_form');
        sessionStorage.removeItem('maktab_student_draft_modal_open');
      } catch (_) {}

      saveData(state.db);
      renderApp();

      // Cloud Firestore ga shu zahoti saqlash
      try {
        await saveStudentToFirestore(studentData);
      } catch (err) {
        console.error("Firestore'ga o'quvchini saqlashda xatolik:", err);
      }
    }
  });
}

function openAdminModal(schoolId = null) {
  const school = schoolId ? state.db.schools.find(s => s.id === schoolId) : null;
  showAdminModal({
    school,
    onSave: async (schoolData) => {
      const idx = state.db.schools.findIndex(s => s.id === schoolData.id);
      if (idx >= 0) {
        state.db.schools[idx] = schoolData;
        showToast("Maktab va admin ma'lumotlari yangilandi", 'success');
      } else {
        // Yangi yaratilgan maktab admini uchun 1-marta kirganda PIN-kod o'rnatish majburiy
        schoolData.pinCode = '';
        schoolData.isFirstLogin = true;
        state.db.schools.push(schoolData);
        showToast("Yangi maktab va admin yaratildi", 'success');
      }
      saveData(state.db);
      renderApp();

      // Cloud Firestore ga shu zahoti saqlash
      try {
        await saveSchoolToFirestore(schoolData);
      } catch (err) {
        console.error("Firestore'ga maktabni saqlashda xatolik:", err);
      }
    }
  });
}

function openClassModal(classId = null, schoolId = null) {
  const classItem = classId ? state.db.classes.find(c => c.id === classId) : null;
  showClassModal({
    classItem,
    schoolId,
    onSave: async (classData) => {
      const idx = state.db.classes.findIndex(c => c.id === classData.id);
      if (idx >= 0) {
        state.db.classes[idx] = classData;
        showToast("Sinf va rahbar ma'lumotlari yangilandi", 'success');
      } else {
        // Yangi yaratilgan sinf rahbari uchun 1-marta kirganda PIN-kod o'rnatish majburiy
        classData.pinCode = '';
        classData.isFirstLogin = true;
        state.db.classes.push(classData);

        // DIQQAT TALABI: Yangi qo'shilgan sinf avtomatik ravishda 1-smenaga biriktirilib turadi!
        const schoolShifts = (state.db.shifts || []).filter(s => s.schoolId === classData.schoolId);
        if (schoolShifts.length > 0) {
          const shift1 = schoolShifts.find(s => s.name?.includes('1') || s.id?.includes('shift_1')) || schoolShifts[0];
          if (shift1) {
            if (!Array.isArray(shift1.classIds)) shift1.classIds = [];
            if (!shift1.classIds.includes(classData.id)) {
              shift1.classIds.push(classData.id);
              saveShiftToFirestore(shift1).catch(console.warn);
            }
          }
        }

        showToast("Yangi sinf va rahbar yaratildi", 'success');
      }
      saveData(state.db);
      renderApp();

      // Cloud Firestore ga shu zahoti saqlash
      try {
        await saveClassToFirestore(classData);
      } catch (err) {
        console.error("Firestore'ga sinfni saqlashda xatolik:", err);
      }
    }
  });
}

// Ilovani ishga tushirish (Bootstrap)
window.addEventListener('DOMContentLoaded', async () => {
  const splashEl = document.getElementById('initial-splash-loader');
  const splashLogoBox = document.getElementById('splash-logo-box');
  const splashLogoCard = document.getElementById('splash-logo-card');
  const splashLoadingBox = document.getElementById('splash-loading-box');
  const splashWorkingCodeBox = document.getElementById('splash-working-code-box');
  const splashWcBadgeCard = document.getElementById('splash-wc-badge-card');
  const appEl = document.getElementById('app');

  // PowerPoint uslubidagi slayd almashuvi bilan asosiy sahifaga o'tish funksiyasi
  const triggerPptSlideTransition = () => {
    if (!splashEl || splashEl.dataset.transitioned) return;
    splashEl.dataset.transitioned = 'true';

    // PowerPoint "Push" effekti:
    // Splash chapga surilib ketadi, asosiy sahifa esa o'ngdan keladi
    splashEl.classList.add('ppt-slide-out');
    if (appEl) {
      appEl.classList.add('ppt-slide-in');
    }

    // 750ms slayd surilishi tugagach DOM dan tozalash
    setTimeout(() => {
      try {
        splashEl.remove();
      } catch (_) {}
      if (appEl) {
        appEl.classList.remove('ppt-slide-in');
      }
    }, 780);
  };

  // 1. Ketma-ketlik: Saytga yangi kirgan zahoti 400ms dan so'ng logo chiqadi
  setTimeout(() => {
    if (splashLogoBox) {
      splashLogoBox.classList.remove('opacity-0');
      splashLogoBox.classList.add('opacity-100');
    }
    if (splashLogoCard) {
      splashLogoCard.classList.add('animate-logo-special-enter');
      setTimeout(() => {
        splashLogoCard.classList.remove('animate-logo-special-enter');
        splashLogoCard.classList.add('animate-logo-float');
      }, 850);
    }
  }, 400);

  // 2. Ketma-ketlik: 1000ms da Pro darajadagi Aurora loading chizig'i paydo bo'ladi
  setTimeout(() => {
    if (splashLoadingBox) {
      splashLoadingBox.classList.remove('opacity-0');
      splashLoadingBox.classList.add('opacity-100');
    }
  }, 1000);

  // 3. Ketma-ketlik: 1800ms da WORKING CODE brendi chiqadi
  setTimeout(() => {
    if (splashWorkingCodeBox) {
      splashWorkingCodeBox.classList.remove('opacity-0');
      splashWorkingCodeBox.classList.add('opacity-100', 'animate-working-code-enter');
    }
    if (splashWcBadgeCard) {
      setTimeout(() => {
        splashWcBadgeCard.classList.add('animate-working-code-float');
      }, 850);
    }
  }, 1800);

  // 4. Min splash vaqti (Brend va logolar toza ko'rinishi uchun 3.0 soniya)
  const minSplashTimelinePromise = new Promise(resolve => setTimeout(resolve, 3000));

  // 1. Dastlabki tezkor render
  renderApp();

  let renderAppDebounceTimer = null;
  const debouncedSafeRenderApp = () => {
    if (renderAppDebounceTimer) clearTimeout(renderAppDebounceTimer);
    renderAppDebounceTimer = setTimeout(() => {
      // Agar foydalanuvchi hozir input/textarea/select yozayotgan bo'lsa yoki modal ochiq bo'lsa DOMni buzmaymiz
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);
      const isModalOpen = Boolean(document.getElementById('modal-container')?.children.length);

      if (isTyping || isModalOpen) {
        return;
      }
      renderApp();
    }, 280);
  };

  // 2. Saytga yangi kirganda yoki brauzer sahifasi yangilanganda serverdan eng so'nggi ma'lumotlarni qabul qilish
  try {
    // Agar sessiya orqali kirilgan bo'lsa, lokal ma'lumotlar bilan dashboard holatini tiklash
    if (!state.currentUser) {
      const restored = getStoredSession(state.db);
      if (restored) {
        state.currentUser = restored;
        state.currentView = 'dashboard';
        state.isAppLocked = Boolean(restored.data?.pinCode);
        renderApp();
      }
    }

    // DIQQAT TALABI: Saytga yangi kirganda yoki brauzer sahifasi yangilanganda server bilan bog'lanib
    // eng oxirgi ma'lumotlarni kutib olish: foydalanuvchi sayt ochilganda doim yangi ma'lumotlarni ko'radi
    const serverSyncPromise = handleSyncWithServer(true).catch(err => {
      console.warn("Dastlabki server yangilanishi bildirishnomasi:", err);
      return false;
    });

    // Brauzer yangilanishidan oldin o'quvchi qo'shish oynasi ochiq bo'lgan bo'lsa
    const savedModalOpenRaw = sessionStorage.getItem('maktab_student_draft_modal_open');
    if (savedModalOpenRaw && state.currentUser) {
      try {
        const parsed = JSON.parse(savedModalOpenRaw);
        if (state.currentUser.role === 'teacher') {
          openStudentModal(null, state.currentUser.data.id, state.currentUser.data.schoolId);
        } else if (parsed && parsed.classId) {
          openStudentModal(null, parsed.classId, parsed.schoolId);
        }
      } catch (e) {}
    }

    // Ham splash ekrani animatsiyasini, ham serverdan yangi ma'lumotlar kelishini parallel tarzda kutamiz:
    // Splash tugashi bilan foydalanuvchi darhol eng so'nggi ma'lumotlarni ko'radi!
    await Promise.all([serverSyncPromise, minSplashTimelinePromise]);

    // Serverdan yangilangan ma'lumotlar asosida sessiyani yangilash
    if (!state.currentUser) {
      const freshRestored = getStoredSession(state.db);
      if (freshRestored) {
        state.currentUser = freshRestored;
        state.currentView = 'dashboard';
        state.isAppLocked = Boolean(freshRestored.data?.pinCode);
      }
    }
    renderApp();
  } catch (err) {
    console.warn("Boshlang'ich yuklash ma'lumoti:", err);
  } finally {
    // Belgilangan vaqt tartibi tugagach, PowerPoint push slayd o'tishi yuz beradi
    triggerPptSlideTransition();

    // Fondagi uzluksiz Real-time (jonli) sinxronizatsiya ulanishi
    try {
      subscribeToDatabase({
        onSchoolsUpdate: (schools) => {
          if (schools && schools.length > 0) {
            state.db.schools = schools;
            saveData(state.db);
            debouncedSafeRenderApp();
          }
        },
        onClassesUpdate: (classes) => {
          if (classes && classes.length > 0) {
            state.db.classes = classes;
            if (state.currentUser?.role === 'teacher') {
              const fresh = classes.find(c => c.id === state.currentUser.data.id);
              if (fresh) state.currentUser.data = fresh;
            }
            saveData(state.db);
            debouncedSafeRenderApp();
          }
        },
        onStudentsUpdate: (students) => {
          if (students && students.length > 0) {
            students.forEach(st => {
              if (st && isFemaleStudent(st) && st.gender !== 'Qiz') st.gender = 'Qiz';
            });
            state.db.students = students;
            saveData(state.db);
            debouncedSafeRenderApp();
          }
        },
        onRecoveryRequestsUpdate: (requests) => {
          state.db.recoveryRequests = requests || [];
          saveData(state.db);
          debouncedSafeRenderApp();
        },
        onShiftsUpdate: (shifts) => {
          state.db.shifts = shifts || [];
          saveData(state.db);
          debouncedSafeRenderApp();
        },
        onDutyRostersUpdate: (rosters) => {
          state.db.dutyRosters = rosters || [];
          saveData(state.db);
          debouncedSafeRenderApp();
        },
        onAttendanceRecordsUpdate: (records) => {
          state.db.attendanceRecords = records || [];
          saveData(state.db);
          debouncedSafeRenderApp();
        },
        onDutyAbsencesUpdate: (absences) => {
          state.db.dutyAbsences = absences || [];
          saveData(state.db);
          debouncedSafeRenderApp();
        },
        onAdminNotificationsUpdate: (notifications) => {
          state.db.adminNotifications = notifications || [];
          saveData(state.db);
          debouncedSafeRenderApp();
        },
        onSystemUpdate: (sys) => {
          if (sys?.developer) state.db.developer = sys.developer;
          if (sys?.siteInfo) state.db.siteInfo = sys.siteInfo;
          saveData(state.db);
          debouncedSafeRenderApp();
        }
      });
    } catch (subErr) {
      console.warn("Real-time tinglovchi bildirishnomasi:", subErr);
    }

    // Brauzer orqali tabga qaytilsa, internet qayta ulansa yoki yangilanish berilsa server bilan ma'lumotlarni sinxronlash
    window.addEventListener('online', () => {
      handleSyncWithServer(true);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleSyncWithServer(true);
      }
    });

    window.addEventListener('focus', () => {
      handleSyncWithServer(true);
    });

    // URL orqali yoki ID bilan tashrif buyurilgan holatni tekshirish
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlId = urlParams.get('id') || urlParams.get('recoveryId');
      if (urlId) {
        if (!state.currentUser) {
          showRecoveryModal({
            state: state.db,
            showToast,
            initialId: urlId,
            onAutoLogin: handleTeacherIdAutoLogin
          });
        } else if (state.currentUser.role === 'teacher') {
          openChangeCredentialsModal({
            isFromIdLogin: true,
            reason: "Siz platformaga Tiklash ID raqami orqali tashrif buyurdingiz. Yangi login va parolingizni belgilab oling."
          });
        }
        try {
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch (_) {}
      } else if (state.currentUser?.role === 'teacher') {
        const pendingClassId = localStorage.getItem('maktabx_pending_cred_update');
        if (pendingClassId === state.currentUser.data?.id) {
          setTimeout(() => {
            if (!document.getElementById('cred-modal-backdrop')) {
              openChangeCredentialsModal({
                isFromIdLogin: true,
                reason: "Siz hisobingizga Tiklash ID orqali kirgansiz. Yangi parolni qayerdan qo'yishni izlamasligingiz uchun ushbu oyna avtomatik ochildi. Yangi login va parolingizni belgilab oling."
              });
            }
          }, 600);
        }
      }
    } catch (_) {}
  }
});
