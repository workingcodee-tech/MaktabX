/**
 * Maktab O'quvchilar Boshqaruvi - Ma'lumotlar bazasi va LocalStorage xizmati
 * Faqat toza JavaScript (React/TSX siz)
 */

const STORAGE_KEY = 'maktab_boshqaruv_clean_v4';

// Boshlang'ich ma'lumotlar - Barcha foydalanuvchilar soni 0 ga teng, faqat Dasturchi qoldirilgan
export const defaultData = {
  // Tizim Dasturchisi (Yagona asosiy hisob - WORKING CODE brendi)
  developer: {
    login: '1234',
    password: '1234',
    brand: 'WORKING CODE',
    firstName: 'WORKING',
    lastName: 'CODE',
    name: 'WORKING CODE',
    phone: '+998 90 000 12 34',
    telegram: '@diyorbek_dev',
    email: 'diyorbek.dev1510@gmail.com',
    bio: "MaktabX axborot tizimi asoschisi va dasturiy ta'minot muallifi - WORKING CODE brendi"
  },

  // Sayt haqida ma'lumotlar (Dasturchi tomonidan boshqariladi)
  siteInfo: {
    title: 'MaktabX',
    subtitle: "Ta'lim va O'quvchilar Boshqaruv Tizimi",
    description: "MaktabX - maktablar, sinflar va o'quvchilarning barcha rasmiy ma'lumotlarini qulay, xavfsiz va markazlashgan holda yuritish, rasmiy dosyelarni chop etish va yuklab olish tizimi. WORKING CODE brendi tomonidan yaratilgan.",
    version: '1.0.0',
    supportPhone: '+998 90 000 12 34',
    supportTelegram: '@diyorbek_dev',
    supportEmail: 'diyorbek.dev1510@gmail.com',
    releaseYear: '2026'
  },
  
  // Maktablar (bo'sh)
  schools: [],

  // Sinflar (bo'sh)
  classes: [],

  // O'quvchilar ro'yxati (bo'sh)
  students: [],

  // O'qituvchilarning hisob tiklash so'rovlari
  recoveryRequests: [],

  // Tavsiya etilgan / umumiy platformalar
  platforms: [],

  // O'chirilgan foydalanuvchilar arxivi (7 kun davomida tiklash mumkin)
  trash: [],

  // Smenalar / Guruhlar (1-smena: 08:00-13:00, 2-smena: 13:00-18:00)
  shifts: [],

  // Navbatchilik jadvallari (Haftalik kunlar va smenalar bo'yicha)
  dutyRosters: [],

  // Kunlik davomat yozuvlari (O'quvchilar va o'qituvchilar davomati)
  attendanceRecords: [],

  // Navbatchi o'qituvchilar kelolmaganda sabab va tizim tomonidan almashtirilganlik qaydlari
  dutyAbsences: [],

  // Maktab Ma'muriyati (Admin) uchun tizimli xabarnomalar
  adminNotifications: []
};

// Standart tavsiya etiladigan ta'lim platformalari shablonlari
export const PRESET_PLATFORMS = [
  {
    id: 'plat-kundalik',
    name: 'Kundalik.com (eMaktab)',
    url: 'https://emaktab.uz',
    description: "Elektron baholash, jurnal va kundalik tizimi",
    color: 'indigo'
  },
  {
    id: 'plat-khan',
    name: 'Khan Academy O\'zbek',
    url: 'https://uz.khanacademy.org',
    description: "Interaktiv onlayn ta'lim va mashqlar platformasi",
    color: 'emerald'
  },
  {
    id: 'plat-kitob',
    name: 'Kitob.uz',
    url: 'https://kitob.uz',
    description: "Respublika bolalar kutubxonasi va elektron darsliklar",
    color: 'amber'
  },
  {
    id: 'plat-edu',
    name: 'Edu.uz (Maktab portali)',
    url: 'https://edu.uz',
    description: "Xalq ta'limi vazirligi rasmiy ta'lim portali",
    color: 'blue'
  }
];

export const DEFAULT_PLATFORMS = PRESET_PLATFORMS;

// Sinf platformalarini xavfsiz olish
export function getClassPlatforms(target, optionalClassId) {
  if (!target) return [];
  if (target.classes && optionalClassId) {
    const found = target.classes.find(c => c.id === optionalClassId);
    return (found && Array.isArray(found.platforms)) ? found.platforms : [];
  }
  if (Array.isArray(target.platforms)) {
    return target.platforms;
  }
  return [];
}

// Barcha platformalar va o'quvchi login/parollarini normalizatsiya qilish va takroriy (dublikat) platformalarni bartaraf etish
export function normalizeAllPlatforms(data) {
  if (!data || !Array.isArray(data.classes)) return false;
  let hasChanged = false;

  data.classes.forEach(cls => {
    if (!cls) return;
    if (!Array.isArray(cls.platforms)) {
      cls.platforms = [];
      return;
    }

    // Dublikatlarni aniqlash va bitta kanonik platformaga birlashtirish
    const canonicalMap = new Map(); // canonicalKey -> platformObject
    const idToCanonicalId = new Map(); // oldId -> canonicalId

    cls.platforms.forEach(plat => {
      if (!plat || !plat.name) return;
      const lowerName = String(plat.name || '').toLowerCase().trim();
      const lowerUrl = String(plat.url || '').toLowerCase().trim();

      let canonicalKey = '';
      if (
        plat.id === 'plat-kundalik' || 
        lowerName.includes('kundalik') || 
        lowerName.includes('emaktab') || 
        lowerUrl.includes('emaktab.uz') || 
        lowerUrl.includes('kundalik.com')
      ) {
        canonicalKey = 'plat-kundalik';
      } else if (plat.id === 'plat-khan' || lowerName.includes('khan academy') || lowerUrl.includes('khanacademy.org')) {
        canonicalKey = 'plat-khan';
      } else if (plat.id === 'plat-kitob' || lowerName.includes('kitob.uz') || lowerUrl.includes('kitob.uz')) {
        canonicalKey = 'plat-kitob';
      } else if (plat.id === 'plat-edu' || lowerName.includes('edu.uz') || lowerUrl.includes('edu.uz')) {
        canonicalKey = 'plat-edu';
      } else {
        canonicalKey = lowerName;
      }

      if (!canonicalMap.has(canonicalKey)) {
        const canonicalId = (canonicalKey.startsWith('plat-')) ? canonicalKey : (plat.id || ('plat-' + Date.now()));
        const standardName = canonicalKey === 'plat-kundalik' ? 'Kundalik.com (eMaktab)' : plat.name;
        const standardUrl = canonicalKey === 'plat-kundalik' ? 'https://emaktab.uz' : (plat.url || '');
        const standardDesc = canonicalKey === 'plat-kundalik' ? "Elektron baholash, jurnal va kundalik tizimi" : (plat.description || '');

        const canonicalPlat = {
          ...plat,
          id: canonicalId,
          name: standardName,
          url: standardUrl,
          description: standardDesc
        };
        canonicalMap.set(canonicalKey, canonicalPlat);
        idToCanonicalId.set(plat.id, canonicalId);
        idToCanonicalId.set(canonicalId, canonicalId);
      } else {
        // Dublikat topildi!
        hasChanged = true;
        const canonicalPlat = canonicalMap.get(canonicalKey);
        idToCanonicalId.set(plat.id, canonicalPlat.id);
      }
    });

    const dedupedPlatforms = Array.from(canonicalMap.values());
    if (dedupedPlatforms.length !== cls.platforms.length) {
      cls.platforms = dedupedPlatforms;
      hasChanged = true;
    }

    // Ushbu sinfdagi barcha o'quvchilar login va parollarini moslashtirish
    if (Array.isArray(data.students)) {
      data.students.filter(s => s && s.classId === cls.id).forEach(student => {
        if (!student.platforms || typeof student.platforms !== 'object') return;

        const newStudentPlatforms = {};
        let studentChanged = false;

        Object.entries(student.platforms).forEach(([pId, rawCred]) => {
          if (!rawCred) return;

          let login = '';
          let password = '';
          if (typeof rawCred === 'object') {
            if (rawCred.login && typeof rawCred.login === 'object') {
              login = String(rawCred.login.login || '').trim();
              password = String(rawCred.login.password || rawCred.password || '').trim();
              studentChanged = true;
            } else {
              login = String(rawCred.login || '').trim();
              password = String(rawCred.password || '').trim();
            }
          }

          // Kanonik platforma ID sini aniqlash
          let targetId = idToCanonicalId.get(pId);
          if (!targetId) {
            // Agar pId oldin alohida kiritilgan bo'lsa (masalan plat-kundalik yoki nomida kundalik bo'lsa)
            if (pId === 'plat-kundalik' || pId.includes('kundalik')) {
              targetId = 'plat-kundalik';
            } else {
              targetId = pId;
            }
          }

          if (targetId !== pId) {
            studentChanged = true;
          }

          if (login || password) {
            if (!newStudentPlatforms[targetId]) {
              newStudentPlatforms[targetId] = { login, password };
            } else {
              // Bo'sh bo'lmagan qiymatlarni birlashtirish
              if (login && !newStudentPlatforms[targetId].login) {
                newStudentPlatforms[targetId].login = login;
                studentChanged = true;
              }
              if (password && !newStudentPlatforms[targetId].password) {
                newStudentPlatforms[targetId].password = password;
                studentChanged = true;
              }
            }
          }
        });

        if (studentChanged || Object.keys(student.platforms).length !== Object.keys(newStudentPlatforms).length) {
          student.platforms = newStudentPlatforms;
          hasChanged = true;
        }
      });
    }
  });

  return hasChanged;
}

// O'quvchining platforma login va parolini xavfsiz olish
export function getStudentPlatformCred(student, platform) {
  if (!student || !platform) return { login: '', password: '' };
  const plats = student.platforms || {};

  const platId = typeof platform === 'string' ? platform : platform.id;
  const platName = typeof platform === 'object' ? (platform.name || '').toLowerCase() : '';

  // 1. To'g'ridan-to'g'ri ID orqali qidirish
  let cred = plats[platId];

  // 2. Agar topilmasa, kanonik nom yoki alias orqali qidirish (ayniqsa Kundalik/eMaktab)
  if (!cred || (!cred.login && !cred.password)) {
    const isKundalik = platId === 'plat-kundalik' || platName.includes('kundalik') || platName.includes('emaktab');
    for (const [key, val] of Object.entries(plats)) {
      if (!val) continue;
      if (isKundalik && (key === 'plat-kundalik' || key.toLowerCase().includes('kundalik') || key.toLowerCase().includes('emaktab'))) {
        cred = val;
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

// Barcha foydalanuvchilarga har xil, faqat raqamlardan iborat noyob Tiklash ID generatsiya qilish (masalan: 742918)
export function generateRecoveryId(existingClasses = []) {
  const usedIds = new Set();
  if (Array.isArray(existingClasses)) {
    existingClasses.forEach(c => {
      if (c && c.recoveryId) {
        const clean = String(c.recoveryId).replace(/\D/g, '');
        if (clean) usedIds.add(clean);
      }
    });
  }

  let newId;
  let attempts = 0;
  do {
    // 6 xonali tasodifiy sof raqam: 100000 - 999999
    newId = String(Math.floor(100000 + Math.random() * 900000));
    attempts++;
  } while (usedIds.has(newId) && attempts < 10000);

  return newId;
}

// Ma'lumotlarni xotiradan olish yoki boshlang'ich ma'lumotlarni yuklash
export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.developer && Array.isArray(parsed.schools) && Array.isArray(parsed.classes) && Array.isArray(parsed.students)) {
        if (!parsed.developer.brand || parsed.developer.name === 'Diyorbek Izzatullayev' || parsed.developer.name === 'Tizim Dasturchisi') {
          parsed.developer.brand = 'WORKING CODE';
          parsed.developer.name = 'WORKING CODE';
          parsed.developer.firstName = 'WORKING';
          parsed.developer.lastName = 'CODE';
          parsed.developer.bio = "MaktabX axborot tizimi asoschisi va dasturiy ta'minot muallifi - WORKING CODE brendi";
        }
        if (!parsed.developer.telegram) parsed.developer.telegram = defaultData.developer.telegram;
        if (!parsed.developer.email) parsed.developer.email = defaultData.developer.email;
        if (!parsed.developer.bio) parsed.developer.bio = defaultData.developer.bio;

        if (!parsed.siteInfo) {
          parsed.siteInfo = { ...defaultData.siteInfo };
        }

        if (!Array.isArray(parsed.recoveryRequests)) {
          parsed.recoveryRequests = [];
        }
        if (!Array.isArray(parsed.shifts)) {
          parsed.shifts = [];
        }
        if (!Array.isArray(parsed.dutyRosters)) {
          parsed.dutyRosters = [];
        }
        if (!Array.isArray(parsed.attendanceRecords)) {
          parsed.attendanceRecords = [];
        }
        if (!Array.isArray(parsed.dutyAbsences)) {
          parsed.dutyAbsences = [];
        }
        if (!Array.isArray(parsed.adminNotifications)) {
          parsed.adminNotifications = [];
        }

        // Barcha foydalanuvchilar (sinf rahbarlari) uchun ID FAQAT RAQAM va BARCHASIGA HAR XIL (takrorlanmas) bo'lishi shart
        let hasUpdatedClasses = false;
        const seenIds = new Set();

        parsed.classes.forEach(c => {
          let cleanId = c.recoveryId ? String(c.recoveryId).replace(/\D/g, '') : '';
          // Agar ID bo'sh bo'lsa, uzunligi 4 tadan kam bo'lsa yoki avval ko'rilgan (takrorlangan) bo'lsa:
          if (!cleanId || cleanId.length < 4 || seenIds.has(cleanId)) {
            cleanId = generateRecoveryId(parsed.classes);
            c.recoveryId = cleanId;
            hasUpdatedClasses = true;
          } else if (c.recoveryId !== cleanId) {
            // Agar harf (masalan REC-) bo'lgan bo'lsa, uni toza sof raqamga o'tkazamiz
            c.recoveryId = cleanId;
            hasUpdatedClasses = true;
          }
          seenIds.add(cleanId);
        });

        // Platformalar va o'quvchi login/parollarini normalizatsiya qilish va tekshirish
        const platformsNormalized = normalizeAllPlatforms(parsed);
        if (platformsNormalized) {
          hasUpdatedClasses = true;
        }

        // Barcha o'quvchilardan xotirani tejash maqsadida rasm ma'lumotlarini butunlay olib tashlash
        if (Array.isArray(parsed.students)) {
          parsed.students.forEach(st => {
            if (st && st.photo) {
              st.photo = '';
              hasUpdatedClasses = true;
            }
          });
        }

        if (hasUpdatedClasses) {
          saveData(parsed);
        }

        return parsed;
      }
    }
  } catch (e) {
    console.error('LocalStorage o\'qishda xatolik:', e);
  }
  saveData(defaultData);
  return JSON.parse(JSON.stringify(defaultData));
}

// Ma'lumotlarni saqlash
export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('LocalStorage yozishda xatolik:', e);
  }
}

// Boshlang'ich holatga qaytarish
export function resetData() {
  saveData(defaultData);
  return JSON.parse(JSON.stringify(defaultData));
}

// Yoshni tug'ilgan sanadan aniq hisoblash
export function calculateAge(birthDateStr) {
  if (!birthDateStr) return '';
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

// Sanani O'zbekcha formatda chiroyli ko'rsatish (DD.MM.YYYY)
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

// Telefon raqamini tozalash (faqat raqamlar qidiruv uchun)
export function cleanPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

// Matnni qidiruv uchun unifikatsiya qilish (o'zbekcha apostroflar: ' ‘ ’ ʻ ʼ `)
export function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[`‘ʻ’ʼ]/g, "'")
    .trim();
}

// Telefon raqami qidiruv so'roviga mos kelishini har tomonlama (formatlangan, mahalliy 9 ta raqam, xalqaro +998, qismlar) tekshirish
export function matchesPhone(rawPhone, rawQuery) {
  if (!rawPhone || !rawQuery) return false;
  const phoneStr = String(rawPhone).trim();
  const queryStr = String(rawQuery).trim();
  if (!phoneStr || !queryStr) return false;

  const phoneLower = phoneStr.toLowerCase();
  const queryLower = queryStr.toLowerCase();

  // 1. To'g'ridan-to'g'ri matn mosligi (masalan "+998 90", "123 45", "(90)")
  if (phoneLower.includes(queryLower)) return true;

  // 2. Raqamlar bo'yicha qidiruv
  const phoneDigits = phoneStr.replace(/\D/g, '');
  const queryDigits = queryStr.replace(/\D/g, '');

  if (!queryDigits) {
    return queryStr === '+' && phoneStr.includes('+');
  }

  // To'g'ridan-to'g'ri raqam ketma-ketligi mos kelishi
  if (phoneDigits.includes(queryDigits)) return true;

  // O'zbekiston/MDH telefon formatlarini normallashtirish
  const toLocal9 = (digits) => {
    if (digits.startsWith('998') && digits.length >= 3) return digits.slice(3);
    if (digits.startsWith('8') && digits.length >= 10) return digits.slice(1);
    return digits;
  };

  const phoneLocal = toLocal9(phoneDigits);
  const queryLocal = toLocal9(queryDigits);

  // Agar so'rov faqat "998" bo'lsa (foydalanuvchi +998 deb yozishni boshlaganda)
  if (queryDigits === '998') {
    if (phoneDigits.startsWith('998') || phoneLocal.length >= 7) return true;
  }

  // Mahalliy 9 raqamli qism bilan solishtirish
  if (queryLocal && queryLocal.length >= 1) {
    if (phoneLocal.includes(queryLocal)) return true;
    if (phoneDigits.includes(queryLocal)) return true;
  }

  // To'g'ridan-to'g'ri kiritilgan raqamlar mahalliy raqam ichida bo'lsa
  if (queryDigits.length >= 1) {
    if (phoneLocal.includes(queryDigits)) return true;
  }

  return false;
}

/**
 * O'quvchi bilan bog'lanish uchun telefon raqamini olish:
 * Agar o'quvchining o'zida telefon raqam bo'lsa - o'zinikini;
 * Bo'lmasa - otasining raqamini;
 * U ham bo'lmasa - onasining raqamini;
 * U ham bo'lmasa - vasiyning raqamini qaytaradi.
 */
export function getStudentContactPhone(student) {
  if (!student) return null;
  const p = (str) => (typeof str === 'string' ? str.trim() : '');

  const selfPhone = p(student.phone) || p(student.phoneNumber);
  if (selfPhone) {
    return {
      number: selfPhone,
      label: "O'zi",
      isParent: false,
      relation: 'self'
    };
  }

  const fatherPhone = p(student.fatherPhone);
  if (fatherPhone) {
    return {
      number: fatherPhone,
      label: 'Otasi',
      isParent: true,
      relation: 'father'
    };
  }

  const motherPhone = p(student.motherPhone);
  if (motherPhone) {
    return {
      number: motherPhone,
      label: 'Onasi',
      isParent: true,
      relation: 'mother'
    };
  }

  const guardianPhone = p(student.guardianPhone);
  if (guardianPhone) {
    return {
      number: guardianPhone,
      label: 'Vasiysi',
      isParent: true,
      relation: 'guardian'
    };
  }

  return null;
}

/**
 * Sinflar nomini sonlarning o'sish tartibida va harflarni alifbo tartibida saralash
 * Masalan: 1-A, 1-B, 2-A, 3-B, 4-A, 4-D, 10-A, 11-B...
 */
export function compareClassNames(nameA, nameB) {
  const strA = String(nameA || '').trim();
  const strB = String(nameB || '').trim();
  if (strA === strB) return 0;
  if (!strA) return 1;
  if (!strB) return -1;

  const parse = (str) => {
    // 1-A, 1 - A, 1A, 1-"A", 1_A, 1 sinf, etc.
    const match = str.match(/^(\d+)[-\s._"'`]*(.*)$/);
    if (match) {
      return {
        num: parseInt(match[1], 10),
        letter: match[2].replace(/["'`\-]/g, '').trim().toUpperCase()
      };
    }
    const numMatch = str.match(/\d+/);
    if (numMatch) {
      return {
        num: parseInt(numMatch[0], 10),
        letter: str.replace(numMatch[0], '').replace(/["'`\-]/g, '').trim().toUpperCase()
      };
    }
    return {
      num: Infinity,
      letter: str.toUpperCase()
    };
  };

  const a = parse(strA);
  const b = parse(strB);

  // 1. Sonlar o'sish tartibida (1, 2, 3, 4 ... 11)
  if (a.num !== b.num) {
    return a.num - b.num;
  }

  // 2. Harflar alifbo tartibida (A, B, D, E...)
  return a.letter.localeCompare(b.letter, 'uz', { sensitivity: 'base', numeric: true });
}

/**
 * Davomat va Smenalar uchun yordamchi funksiyalar
 */
export const WEEK_DAYS = [
  { id: 1, name: 'Dushanba', short: 'Dush' },
  { id: 2, name: 'Seshanba', short: 'Sesh' },
  { id: 3, name: 'Chorshanba', short: 'Chor' },
  { id: 4, name: 'Payshanba', short: 'Pay' },
  { id: 5, name: 'Juma', short: 'Juma' },
  { id: 6, name: 'Shanba', short: 'Shan' },
  { id: 7, name: 'Yakshanba', short: 'Yak' }
];

export function getTodayISODate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDayOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 = Yakshanba, 1 = Dushanba ... 6 = Shanba
  return day === 0 ? 7 : day;
}

export function getDayName(dayNumber) {
  const found = WEEK_DAYS.find(w => w.id === dayNumber);
  return found ? found.name : (dayNumber === 7 ? 'Yakshanba' : `Kun ${dayNumber}`);
}

export function formatReadableDate(isoDateStr) {
  if (!isoDateStr) return '';
  try {
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${parseInt(parts[2], 10)}-${months[mIdx] || parts[1]}, ${parts[0]}`;
    }
  } catch (_) {}
  return isoDateStr;
}

export function isTimePastCutoff(cutoffTimeStr) {
  if (!cutoffTimeStr) return false;
  try {
    const [cutH, cutM] = cutoffTimeStr.split(':').map(Number);
    const now = new Date();
    const curH = now.getHours();
    const curM = now.getMinutes();
    return (curH * 60 + curM) >= (cutH * 60 + cutM);
  } catch (_) {
    return false;
  }
}

export function getClassGradeLevel(className) {
  if (!className) return null;
  const match = String(className).trim().match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0 && num <= 12) {
      return num;
    }
  }
  return null;
}

export function isGrade1to5(className) {
  const grade = getClassGradeLevel(className);
  return grade !== null && grade >= 1 && grade <= 5;
}

/**
 * Navbatchilik tayinlash qoidalarini tekshirish:
 * 1. Shanba kuni 1-5 sinflar (boshlang'ich) navbatchi bo'la olmaydi.
 * 2. Ketma-ket 2 kun bir xil o'qituvchi navbatchi bo'lishi taqiqlanadi.
 * 3. Asosiy va zaxira navbatchi bir xil shaxs bo'la olmaydi.
 */
export function validateDutyAssignment({ dayOfWeek, primaryClass, backupClass, shift, shiftRosters = [], currentRosterId = '' }) {
  const day = Number(dayOfWeek);

  // 0. Smenaga biriktirilmagan (mustasno) sinf rahbarlari navbatchi bo'la olmaydi
  if (shift) {
    const shiftClassIds = new Set(shift.classIds || []);
    if (primaryClass && !shiftClassIds.has(primaryClass.id)) {
      return {
        valid: false,
        error: `Ushbu sinf rahbari (${primaryClass.teacherName}) ${shift.name} guruhiga kiritilmagan! Smenadan mustasno qilingan o'qituvchilar navbatchi etib tayinlanishi mumkin emas.`
      };
    }
    if (backupClass && !shiftClassIds.has(backupClass.id)) {
      return {
        valid: false,
        error: `Zaxira sinf rahbari (${backupClass.teacherName}) ${shift.name} guruhiga kiritilmagan! Smenadan mustasno qilingan o'qituvchilar navbatchi etib tayinlanishi mumkin emas.`
      };
    }
  }

  // 1. Shanba kuni tekshiruvi: 1-5 sinflar Shanba kuni dars bo'lmagani sababli navbatchi bo'lolmaydi
  if (day === 6) {
    if (primaryClass && isGrade1to5(primaryClass.name)) {
      return {
        valid: false,
        error: "1-sinfdan 5-sinfgacha bo'lgan sinf rahbarlari Shanba kuni navbatchi etib tayinlanishi mumkin emas! (Boshlang'ich sinflarda Shanba kuni dars bo'lmaydi)"
      };
    }
    if (backupClass && isGrade1to5(backupClass.name)) {
      return {
        valid: false,
        error: "1-sinfdan 5-sinfgacha bo'lgan sinf rahbarlari Shanba kuni zaxira navbatchi etib tayinlanishi mumkin emas!"
      };
    }
  }

  // 2. Asosiy va zaxira navbatchi bir xil o'qituvchi bo'la olmaydi
  if (primaryClass && backupClass && primaryClass.id === backupClass.id) {
    return {
      valid: false,
      error: "Asosiy va zaxira (dublyor) navbatchi bir xil o'qituvchi bo'lishi mumkin emas!"
    };
  }

  // 3. Ketma-ket 2 kun navbatchilik taqiqlanadi
  if (primaryClass) {
    const prevDay = day === 1 ? 6 : day - 1;
    const nextDay = day === 6 ? 1 : day + 1;

    const prevRoster = shiftRosters.find(r => Number(r.dayOfWeek) === prevDay && r.id !== currentRosterId);
    const nextRoster = shiftRosters.find(r => Number(r.dayOfWeek) === nextDay && r.id !== currentRosterId);

    const isMatch = (r) => {
      if (!r) return false;
      const classMatch = Boolean(r.primaryTeacherClassId && r.primaryTeacherClassId === primaryClass.id);
      const nameMatch = Boolean(
        r.primaryTeacherName && primaryClass.teacherName &&
        r.primaryTeacherName.trim().toLowerCase() === primaryClass.teacherName.trim().toLowerCase()
      );
      return classMatch || nameMatch;
    };

    if (isMatch(prevRoster)) {
      const prevDayName = getDayName(prevDay);
      return {
        valid: false,
        error: `Bitta o'qituvchi 2 kun ketma-ket navbatchi bo'lishi mumkin emas! Ushbu o'qituvchi allaqachon ${prevDayName} kuniga tayinlangan.`
      };
    }

    if (isMatch(nextRoster)) {
      const nextDayName = getDayName(nextDay);
      return {
        valid: false,
        error: `Bitta o'qituvchi 2 kun ketma-ket navbatchi bo'lishi mumkin emas! Ushbu o'qituvchi allaqachon ${nextDayName} kuniga tayinlangan.`
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Guruhlar (smenalar) bo'yicha o'qituvchilarni tartib bilan avtomatik navbatchi qilib tayinlash
 * Qoidalar:
 * - Smenalarga (guruhlarga) kiritilmagan o'qituvchilar umuman navbatchi etib tayinlanmaydi (mustasno).
 * - 1-sinfdan 5-sinfgacha bo'lgan sinf rahbarlari Shanba kuni navbatchi etib tayinlanmaydi (Shanba kuni boshlang'ichga dars yo'q).
 * - Bitta o'qituvchi 2 kun ketma-ket navbatchi bo'lmaydi.
 * - Barcha sinf rahbarlari adolatli, navbat bilan teng taqsimlanadi (hech kim yiroqda qolmaydi).
 */
export function generateOrderlyDutyRosters(schoolId, shifts = [], classes = []) {
  if (!schoolId || !Array.isArray(shifts) || shifts.length === 0) return [];

  // Faqat smenalarga/guruhlarga kiritilgan sinflarning o'qituvchilari (mustasno qilinganlar aralashtirilmaydi!)
  const allAssignedClassIds = new Set();
  shifts.forEach(s => (s.classIds || []).forEach(id => allAssignedClassIds.add(id)));

  const allAssignedTeachers = classes
    .filter(c => allAssignedClassIds.has(c.id) && Boolean(c.teacherName && c.teacherName.trim()))
    .sort((a, b) => compareClassNames(a.name, b.name))
    .map(c => ({
      name: c.teacherName.trim(),
      phone: c.teacherPhone || '',
      classId: c.id,
      className: c.name,
      isLowerGrade: isGrade1to5(c.name)
    }));

  const generatedRosters = [];

  // Barcha guruhlarga kiritilgan 6-11 sinf (Shanba kela oladigan) o'qituvchilari
  const schoolUpperTeachers = allAssignedTeachers.filter(t => !t.isLowerGrade);

  shifts.forEach((shift, shiftIndex) => {
    const assignedClassIds = new Set(shift.classIds || []);
    let shiftTeachers = classes
      .filter(c => assignedClassIds.has(c.id) && Boolean(c.teacherName && c.teacherName.trim()))
      .sort((a, b) => compareClassNames(a.name, b.name))
      .map(c => ({
        name: c.teacherName.trim(),
        phone: c.teacherPhone || '',
        classId: c.id,
        className: c.name,
        isLowerGrade: isGrade1to5(c.name)
      }));

    // Agar ushbu smenaga hali birorta ham sinf kiritilmagan bo'lsa
    if (shiftTeachers.length === 0) {
      shiftTeachers = [
        { name: "Navbatchi belgilanmagan", phone: "", classId: "", className: "", isLowerGrade: false }
      ];
    }

    // Smenadagi Shanba kela oladigan o'qituvchilar (6-11 sinf)
    let shiftUpperTeachers = shiftTeachers.filter(t => !t.isLowerGrade);
    if (shiftUpperTeachers.length === 0) {
      // Agar smena faqat 1-5 sinflardan iborat bo'lsa, faqat boshqa smenalarga kiritilgan 6-11 sinf rahbarlaridan olinadi
      shiftUpperTeachers = schoolUpperTeachers.length > 0 ? schoolUpperTeachers : shiftTeachers;
    }

    // Har bir o'qituvchining necha marta asosiy va zaxira navbatchi bo'lganligini kuzatish (Fair distribution)
    const primaryUsage = new Map();
    const backupUsage = new Map();
    shiftTeachers.forEach(t => {
      const key = t.classId || t.name;
      primaryUsage.set(key, 0);
      backupUsage.set(key, 0);
    });
    shiftUpperTeachers.forEach(t => {
      const key = t.classId || t.name;
      if (!primaryUsage.has(key)) {
        primaryUsage.set(key, 0);
        backupUsage.set(key, 0);
      }
    });

    // 1-bosqich: Shanba (kun 6) - qat'iy ravishda 6-11 sinf o'qituvchilaridan tanlanadi!
    const satPrimaryCandidates = shiftUpperTeachers.slice().sort((a, b) => {
      const uA = primaryUsage.get(a.classId || a.name) || 0;
      const uB = primaryUsage.get(b.classId || b.name) || 0;
      if (uA !== uB) return uA - uB;
      return compareClassNames(a.className, b.className);
    });
    const satPrimary = satPrimaryCandidates[shiftIndex % satPrimaryCandidates.length] || satPrimaryCandidates[0];
    primaryUsage.set(satPrimary.classId || satPrimary.name, (primaryUsage.get(satPrimary.classId || satPrimary.name) || 0) + 1);

    const satBackupCandidates = shiftUpperTeachers
      .filter(t => (t.classId || t.name) !== (satPrimary.classId || satPrimary.name))
      .sort((a, b) => {
        const uA = backupUsage.get(a.classId || a.name) || 0;
        const uB = backupUsage.get(b.classId || b.name) || 0;
        if (uA !== uB) return uA - uB;
        return compareClassNames(a.className, b.className);
      });
    const satBackup = satBackupCandidates.length > 0 ? satBackupCandidates[0] : satPrimary;
    backupUsage.set(satBackup.classId || satBackup.name, (backupUsage.get(satBackup.classId || satBackup.name) || 0) + 1);

    // 2-bosqich: Dushanbadan Jumagacha (kun 1 dan 5 gacha) taqsimlash
    // Ketma-ket 2 kun bir xil bo'lmasligi va barcha o'qituvchilar teng qatnashishi kafolatlanadi
    const weekdayAssignments = [];

    for (let dayId = 1; dayId <= 5; dayId++) {
      const prevDayAssigned = weekdayAssignments[dayId - 2]?.primary;
      const prevKey = prevDayAssigned ? (prevDayAssigned.classId || prevDayAssigned.name) : null;
      
      // Juma (kun 5) bo'lsa, Shanba (satPrimary) bilan ketma-ket bo'lmasligi kerak
      const nextForbiddenKey = (dayId === 5) ? (satPrimary.classId || satPrimary.name) : null;

      let candidates = shiftTeachers.filter(t => {
        const key = t.classId || t.name;
        if (shiftTeachers.length > 1 && key === prevKey) return false;
        if (shiftTeachers.length > 2 && key === nextForbiddenKey) return false;
        return true;
      });

      if (candidates.length === 0) {
        candidates = shiftTeachers.filter(t => {
          const key = t.classId || t.name;
          return shiftTeachers.length > 1 ? key !== prevKey : true;
        });
      }
      if (candidates.length === 0) {
        candidates = shiftTeachers;
      }

      candidates.sort((a, b) => {
        const uA = primaryUsage.get(a.classId || a.name) || 0;
        const uB = primaryUsage.get(b.classId || b.name) || 0;
        if (uA !== uB) return uA - uB;
        // Agar bir xil bo'lsa, 1-5 sinf egalariga hafta ichida ustunlik (chunki Shanba ular uchun yopiq)
        if (a.isLowerGrade && !b.isLowerGrade) return -1;
        if (!a.isLowerGrade && b.isLowerGrade) return 1;
        return compareClassNames(a.className, b.className);
      });

      const chosenPrimary = candidates[0];
      const chosenKey = chosenPrimary.classId || chosenPrimary.name;
      primaryUsage.set(chosenKey, (primaryUsage.get(chosenKey) || 0) + 1);

      // Zaxira o'qituvchini tanlash (Asosiy bilan bir xil bo'lmasin, backupUsage kam bo'lsin)
      let backupCandidates = shiftTeachers.filter(t => (t.classId || t.name) !== chosenKey);
      if (backupCandidates.length === 0) backupCandidates = shiftTeachers;

      backupCandidates.sort((a, b) => {
        const uA = backupUsage.get(a.classId || a.name) || 0;
        const uB = backupUsage.get(b.classId || b.name) || 0;
        if (uA !== uB) return uA - uB;
        return compareClassNames(a.className, b.className);
      });

      const chosenBackup = backupCandidates[0];
      const backupKey = chosenBackup.classId || chosenBackup.name;
      backupUsage.set(backupKey, (backupUsage.get(backupKey) || 0) + 1);

      weekdayAssignments.push({
        dayId,
        primary: chosenPrimary,
        backup: chosenBackup
      });
    }

    // 1-5 kunlarni qo'shish
    weekdayAssignments.forEach(({ dayId, primary, backup }) => {
      generatedRosters.push({
        id: `roster_${schoolId}_${shift.id}_day${dayId}`,
        schoolId,
        shiftId: shift.id,
        dayOfWeek: dayId,
        primaryTeacherName: primary?.name || "Navbatchi o'qituvchi",
        primaryTeacherPhone: primary?.phone || "",
        primaryTeacherClassId: primary?.classId || "",
        primaryTeacherClassName: primary?.className || "",
        backupTeacherName: backup?.name || "Zaxira o'qituvchi",
        backupTeacherPhone: backup?.phone || "",
        backupTeacherClassId: backup?.classId || "",
        backupTeacherClassName: backup?.className || "",
        notes: `Tizim tomonidan adolatli tartibda ${shift.name} uchun tayinlangan`,
        updatedAt: new Date().toISOString()
      });
    });

    // 6-kun: Shanba
    generatedRosters.push({
      id: `roster_${schoolId}_${shift.id}_day6`,
      schoolId,
      shiftId: shift.id,
      dayOfWeek: 6,
      primaryTeacherName: satPrimary?.name || "Navbatchi o'qituvchi",
      primaryTeacherPhone: satPrimary?.phone || "",
      primaryTeacherClassId: satPrimary?.classId || "",
      primaryTeacherClassName: satPrimary?.className || "",
      backupTeacherName: satBackup?.name || "Zaxira o'qituvchi",
      backupTeacherPhone: satBackup?.phone || "",
      backupTeacherClassId: satBackup?.classId || "",
      backupTeacherClassName: satBackup?.className || "",
      notes: "Shanba navbatchisi (Boshlang'ich 1-5 sinflarga dars yo'qligi sababli 6-11 sinf mas'uli)",
      updatedAt: new Date().toISOString()
    });

    // 7-kun: Yakshanba (Dam olish kuni)
    generatedRosters.push({
      id: `roster_${schoolId}_${shift.id}_day7`,
      schoolId,
      shiftId: shift.id,
      dayOfWeek: 7,
      primaryTeacherName: "Dam olish kuni",
      primaryTeacherPhone: "",
      primaryTeacherClassId: "",
      primaryTeacherClassName: "",
      backupTeacherName: "-",
      backupTeacherPhone: "",
      backupTeacherClassId: "",
      backupTeacherClassName: "",
      notes: "Yakshanba — umumiy dam olish kuni",
      updatedAt: new Date().toISOString()
    });
  });

  return generatedRosters;
}

/**
 * Sinf rahbarining bo'lajak navbatchilik grafigini prognoz qilish
 * - Agar o'qituvchi birorta ham smenaga kiritilmagan bo'lsa: isExcluded = true (navbatchilikdan mustasno).
 * - Agar joriy hafta navbatchi bo'lsa: isThisWeek = true, kuni va smenasi ko'rsatiladi.
 * - Agar 1 haftalik joriy jadvalga kiritilmagan bo'lsa ham: kelgusi rotatsiyada qaysi kuni, qaysi sanada navbatchi bo'lishi aniq hisoblab beriladi!
 */
export function getTeacherDutyScheduleProjection(teacherClass, state) {
  if (!teacherClass || !teacherClass.schoolId || !state) {
    return { isExcluded: true, reason: "Ma'lumotlar topilmadi" };
  }

  const schoolId = teacherClass.schoolId;
  const shifts = (state.shifts || []).filter(s => s.schoolId === schoolId);
  const classes = (state.classes || []).filter(c => c.schoolId === schoolId);
  const rosters = (state.dutyRosters || []).filter(r => r.schoolId === schoolId);
  const cleanTeacherName = (teacherClass.teacherName || '').trim().toLowerCase();

  // 1. Ushbu sinf birorta ham smenaga/guruhga biriktirilganmi?
  const shift = shifts.find(s => (s.classIds || []).includes(teacherClass.id));
  if (!shift) {
    return {
      isExcluded: true,
      reason: "Sizning sinfingiz hech qaysi smenaga (guruhga) biriktirilmagan, shu sababli siz navbatchilikdan mustasno qilingansiz.",
      teacherName: teacherClass.teacherName,
      className: teacherClass.name
    };
  }

  // 2. Ushbu smenaga biriktirilgan barcha o'qituvchilar navbati
  const shiftClassIds = new Set(shift.classIds || []);
  const shiftTeachers = classes
    .filter(c => shiftClassIds.has(c.id) && Boolean(c.teacherName && c.teacherName.trim()))
    .sort((a, b) => compareClassNames(a.name, b.name))
    .map(c => ({
      id: c.id,
      name: c.teacherName.trim(),
      className: c.name,
      phone: c.teacherPhone || '',
      isLowerGrade: isGrade1to5(c.name)
    }));

  const myIndex = shiftTeachers.findIndex(t => 
    t.id === teacherClass.id || 
    (cleanTeacherName && t.name.toLowerCase() === cleanTeacherName)
  );

  // 3. Joriy haftalik jadvalda (1-6 kunlar) bormi?
  const shiftRosters = rosters.filter(r => r.shiftId === shift.id && Number(r.dayOfWeek) <= 6);
  
  const myPrimaryRoster = shiftRosters.find(r => 
    (r.primaryTeacherClassId && r.primaryTeacherClassId === teacherClass.id) ||
    (cleanTeacherName && (r.primaryTeacherName || '').trim().toLowerCase() === cleanTeacherName)
  );

  const myBackupRosters = shiftRosters.filter(r => 
    (r.backupTeacherClassId && r.backupTeacherClassId === teacherClass.id) ||
    (cleanTeacherName && (r.backupTeacherName || '').trim().toLowerCase() === cleanTeacherName)
  );

  const todayDay = getTodayDayOfWeek();

  // Barcha guruh o'qituvchilarining navbat zanjiri (Ketma-ketlik va rotatsiya)
  const allGroupTeachersQueue = shiftTeachers.map((t, idx) => {
    let weekNum = Math.floor(idx / 6) + 1;
    let dayNum = (idx % 6) + 1;
    if (t.isLowerGrade && dayNum === 6) {
      dayNum = 1;
      weekNum += 1;
    }
    const dayObj = WEEK_DAYS.find(w => w.id === dayNum);
    return {
      index: idx + 1,
      id: t.id,
      teacherName: t.name,
      className: t.className,
      phone: t.phone,
      isLowerGrade: t.isLowerGrade,
      weekNumber: weekNum,
      weekText: weekNum === 1 ? "1-hafta (Joriy hafta)" : `${weekNum}-hafta`,
      dayOfWeek: dayNum,
      dayName: dayObj?.name || `Kun ${dayNum}`,
      isMe: t.id === teacherClass.id || (cleanTeacherName && t.name.toLowerCase() === cleanTeacherName)
    };
  });

  const isBackupThisWeek = myBackupRosters.length > 0;
  const backupDaysText = myBackupRosters.map(r => {
    const w = WEEK_DAYS.find(d => d.id === Number(r.dayOfWeek));
    return w ? w.name : `Kun ${r.dayOfWeek}`;
  }).join(', ');

  if (myPrimaryRoster) {
    const day = WEEK_DAYS.find(w => w.id === Number(myPrimaryRoster.dayOfWeek));
    return {
      isExcluded: false,
      isThisWeek: true,
      role: 'primary',
      dayOfWeek: Number(myPrimaryRoster.dayOfWeek),
      dayName: day?.name || `Kun ${myPrimaryRoster.dayOfWeek}`,
      isToday: Number(myPrimaryRoster.dayOfWeek) === Number(todayDay),
      shiftId: shift.id,
      shiftName: shift.name,
      shiftHours: `${shift.startTime || '08:00'} - ${shift.endTime || '13:00'}`,
      queuePosition: myIndex >= 0 ? myIndex + 1 : 1,
      totalInGroup: shiftTeachers.length,
      backupRosters: myBackupRosters,
      isBackupThisWeek,
      backupDaysText,
      allGroupTeachersQueue
    };
  }

  // 4. Agar joriy haftada asosiy bo'lmasa, kelgusi haftalarda qachon navbatchi bo'ladi?
  // O'qituvchilar soniga qarab qaysi haftada va qaysi kunda navbati kelishi aniq hisoblanadi:
  const totalTeachers = shiftTeachers.length;
  let projectedWeekNumber = 2; // Kelgusi hafta (2-hafta)
  let projectedDayOfWeek = 1;

  if (totalTeachers > 0 && myIndex >= 0) {
    // 6 kunlik haftada o'rin:
    const cycleWeek = Math.floor(myIndex / 6) + 1;
    projectedWeekNumber = cycleWeek > 1 ? cycleWeek : 2;
    
    let daySlot = (myIndex % 6) + 1;
    // Boshlang'ich 1-5 sinflar Shanba (day 6) ololmaydi, dushanbaga o'tadi
    const isLower = isGrade1to5(teacherClass.name);
    if (isLower && daySlot === 6) {
      daySlot = 1;
      projectedWeekNumber += 1;
    }
    projectedDayOfWeek = daySlot;
  }

  const dayObj = WEEK_DAYS.find(w => w.id === projectedDayOfWeek);

  // Aniq kalendar sanasini hisoblash (Joriy haftaning Dushanbasidan hisoblab)
  const now = new Date();
  const currentDayIndex = now.getDay(); // 0=Yak, 1=Dush...
  const distToMonday = currentDayIndex === 0 ? -6 : 1 - currentDayIndex;
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() + distToMonday);

  const targetDate = new Date(mondayDate);
  targetDate.setDate(mondayDate.getDate() + ((projectedWeekNumber - 1) * 7) + (projectedDayOfWeek - 1));
  
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  const targetISO = `${y}-${m}-${d}`;

  const weekText = projectedWeekNumber === 2 
    ? "Kelgusi hafta (2-hafta)" 
    : `${projectedWeekNumber}-haftada`;

  return {
    isExcluded: false,
    isThisWeek: false,
    isBackupThisWeek,
    backupDaysText,
    role: isBackupThisWeek ? 'backup_only' : 'upcoming',
    backupRosters: myBackupRosters,
    projectedWeekNumber,
    weekText,
    projectedDayOfWeek,
    dayName: dayObj?.name || `Kun ${projectedDayOfWeek}`,
    projectedDateISO: targetISO,
    projectedDateFormatted: formatReadableDate(targetISO),
    shiftId: shift.id,
    shiftName: shift.name,
    shiftHours: `${shift.startTime || '08:00'} - ${shift.endTime || '13:00'}`,
    queuePosition: myIndex >= 0 ? myIndex + 1 : null,
    totalInGroup: totalTeachers,
    allGroupTeachersQueue
  };
}

/**
 * Sinf rahbarini guruhdan (smenadan) chiqarish va navbatchilikdan mustasno qilish
 */
export function excludeClassFromDutyShifts(classId, schoolId, state) {
  if (!classId || !schoolId || !state || !Array.isArray(state.shifts)) return false;
  let modified = false;

  state.shifts.forEach(shift => {
    if (shift.schoolId === schoolId && Array.isArray(shift.classIds) && shift.classIds.includes(classId)) {
      shift.classIds = shift.classIds.filter(id => id !== classId);
      modified = true;
    }
  });

  if (modified) {
    // Agar navbatchilik jadvallarida ushbu o'qituvchi bo'lsa, jadvallarni qayta shakllantirish
    const schoolShifts = state.shifts.filter(s => s.schoolId === schoolId);
    const schoolClasses = (state.classes || []).filter(c => c.schoolId === schoolId);
    state.dutyRosters = generateOrderlyDutyRosters(schoolId, schoolShifts, schoolClasses);
    saveData(state);
  }
  return modified;
}

/**
 * Sinf rahbarini tegishli guruhga (smenaga) qo'shish va navbatchilar safiga kiritish
 */
export function includeClassToDutyShift(classId, shiftId, schoolId, state) {
  if (!classId || !shiftId || !schoolId || !state || !Array.isArray(state.shifts)) return false;
  
  // Boshqa barcha smenalardan olib tashlash (bitta sinf faqat 1 ta smenada bo'ladi)
  state.shifts.forEach(shift => {
    if (shift.schoolId === schoolId && Array.isArray(shift.classIds)) {
      shift.classIds = shift.classIds.filter(id => id !== classId);
    }
  });

  const targetShift = state.shifts.find(s => s.id === shiftId && s.schoolId === schoolId);
  if (!targetShift) return false;

  if (!Array.isArray(targetShift.classIds)) targetShift.classIds = [];
  if (!targetShift.classIds.includes(classId)) {
    targetShift.classIds.push(classId);
  }

  const schoolShifts = state.shifts.filter(s => s.schoolId === schoolId);
  const schoolClasses = (state.classes || []).filter(c => c.schoolId === schoolId);
  state.dutyRosters = generateOrderlyDutyRosters(schoolId, schoolShifts, schoolClasses);
  saveData(state);
  return true;
}

/**
 * Maktab bo'yicha bugungi kungi barcha navbatchi o'qituvchilar ro'yxati (masalan, 2 ta smena = 2 ta navbatchi)
 * Agar navbatchi kelolmaslik sababini qoldirgan bo'lsa, tizim tomonidan almashtirilgan yangi navbatchi aks etadi.
 */
export function getTodayDutyTeachersForSchool(schoolId, state, optionalDateStr = '') {
  if (!schoolId || !state) return [];
  let todayDay = getTodayDayOfWeek();
  let todayISO = getTodayISODate();

  if (optionalDateStr) {
    todayISO = optionalDateStr;
    try {
      const d = new Date(optionalDateStr + 'T00:00:00');
      const day = d.getDay();
      todayDay = day === 0 ? 7 : day;
    } catch (_) {}
  }

  let shifts = (state.shifts || []).filter(s => s.schoolId === schoolId);
  const classes = (state.classes || []).filter(c => c.schoolId === schoolId);

  // Smenalar tartibini 1-smena, 2-smena shaklida saralash
  shifts.sort((a, b) => {
    const aNum = a.name?.includes('1') ? 1 : a.name?.includes('2') ? 2 : 3;
    const bNum = b.name?.includes('1') ? 1 : b.name?.includes('2') ? 2 : 3;
    return aNum - bNum;
  });

  // Agar smenalar hali yaratilmagan bo'lsa, standart 1-smena
  if (shifts.length === 0) {
    shifts = [{
      id: `shift_1_${schoolId}`,
      schoolId,
      name: "1-smena",
      startTime: "08:00",
      endTime: "13:00",
      classIds: classes.map(c => c.id)
    }];
  }

  const allSchoolRosters = (state.dutyRosters || []).filter(r => r.schoolId === schoolId);

  // Bugungi kun uchun ro'yxatni olish
  let rosters = allSchoolRosters.filter(r => Number(r.dayOfWeek) === Number(todayDay));

  // Agar bugungi kunga (masalan, Yakshanba kuni yoki hali belgilanmagan kunda) jadval bo'lmasa,
  // Dushanba (1-kun) yoki mavjud eng birinchi ish kuni jadvalidan foydalanamiz
  if (rosters.length === 0 && allSchoolRosters.length > 0) {
    rosters = allSchoolRosters.filter(r => Number(r.dayOfWeek) === 1);
    if (rosters.length === 0) {
      rosters = allSchoolRosters.filter(r => Number(r.dayOfWeek) === 2);
    }
    if (rosters.length === 0) {
      rosters = allSchoolRosters;
    }
  }

  // Agar umuman navbatchilik jadvali saqlanmagan bo'lsa, tizim avtomatik tartib bilan aniqlaydi
  if (rosters.length === 0 && classes.length > 0) {
    const generated = generateOrderlyDutyRosters(schoolId, shifts, classes);
    rosters = generated.filter(r => Number(r.dayOfWeek) === Number(todayDay));
    if (rosters.length === 0) {
      rosters = generated.filter(r => Number(r.dayOfWeek) === 1);
    }
    if (rosters.length === 0) {
      rosters = generated;
    }
  }

  const absences = (state.dutyAbsences || []).filter(a => a.schoolId === schoolId && a.date === todayISO);

  const list = [];
  shifts.forEach((shift, shiftIndex) => {
    const isShift1 = Boolean(shift.name?.includes('1') || shift.id?.includes('shift_1') || shift.id?.includes('_1_'));
    const isShift2 = Boolean(shift.name?.includes('2') || shift.id?.includes('shift_2') || shift.id?.includes('_2_'));

    // 1. To'g'ridan-to'g'ri ID bo'yicha qidirish
    let roster = rosters.find(r => r.shiftId === shift.id);

    // 2. Agar topilmasa, smena nomi/raqami bo'yicha moslashtirish (masalan: shift_2_... bilan 2-smena)
    if (!roster) {
      if (isShift2) {
        roster = rosters.find(r => r.shiftId?.includes('_2_') || r.shiftId?.includes('shift_2') || r.shiftName?.includes('2') || r.id?.includes('_shift_2_'));
      } else if (isShift1) {
        roster = rosters.find(r => r.shiftId?.includes('_1_') || r.shiftId?.includes('shift_1') || r.shiftName?.includes('1') || r.id?.includes('_shift_1_'));
      }
    }

    // 3. Agar topilmasa, indeks bo'yicha (har bir smena uchun alohida)
    if (!roster && rosters.length > shiftIndex) {
      roster = rosters[shiftIndex];
    }

    // 4. Agar hali ham topilmasa, smena yoki maktab sinf rahbarlaridan biriktirish
    if (!roster) {
      const shiftClasses = classes.filter(c => (shift.classIds || []).includes(c.id) && Boolean(c.teacherName && c.teacherName.trim()));
      const availableTeachers = shiftClasses.length > 0 ? shiftClasses : classes.filter(c => Boolean(c.teacherName && c.teacherName.trim()));
      const t1 = availableTeachers[shiftIndex % Math.max(1, availableTeachers.length)] || availableTeachers[0];
      const t2 = availableTeachers[(shiftIndex + 1) % Math.max(1, availableTeachers.length)] || t1;
      if (t1) {
        roster = {
          primaryTeacherName: t1.teacherName,
          primaryTeacherPhone: t1.teacherPhone || '',
          primaryTeacherClassId: t1.id,
          primaryTeacherClassName: t1.name,
          backupTeacherName: t2?.teacherName || t1.teacherName,
          backupTeacherPhone: t2?.teacherPhone || t1.teacherPhone || '',
          backupTeacherClassId: t2?.id || t1.id,
          backupTeacherClassName: t2?.name || t1.name
        };
      }
    }

    const primaryName = roster?.primaryTeacherName || 'Belgilanmagan';
    const primaryPhone = roster?.primaryTeacherPhone || '';
    const primaryClassId = roster?.primaryTeacherClassId || '';
    const primaryClassName = roster?.primaryTeacherClassName || '';
    const backupName = roster?.backupTeacherName || 'Belgilanmagan';
    const backupPhone = roster?.backupTeacherPhone || '';
    const backupClassId = roster?.backupTeacherClassId || '';
    const backupClassName = roster?.backupTeacherClassName || '';

    const activeAbsence = absences.find(a => 
      a.shiftId === shift.id || 
      (primaryName && a.originalTeacherName === primaryName)
    );

    list.push({
      shift: shift,
      shiftId: shift.id,
      shiftName: shift.name,
      shiftHours: shift.startTime && shift.endTime ? `${shift.startTime} - ${shift.endTime}` : (shift.name?.includes('2') ? '13:00 - 18:00' : '08:00 - 13:00'),
      primaryTeacherName: primaryName,
      primaryTeacherPhone: primaryPhone,
      primaryTeacherClassId: primaryClassId,
      primaryTeacherClassName: primaryClassName,
      backupTeacherName: backupName,
      backupTeacherPhone: backupPhone,
      backupTeacherClassId: backupClassId,
      backupTeacherClassName: backupClassName,
      hasAbsence: Boolean(activeAbsence),
      absenceReason: activeAbsence?.reason || '',
      originalTeacherName: activeAbsence?.originalTeacherName || '',
      originalTeacherPhone: activeAbsence?.originalTeacherPhone || '',
      reportedAt: activeAbsence?.reportedAt || '',
      delegatedTeacherName: activeAbsence?.delegatedTeacherName || '',
      isDelegated: Boolean(activeAbsence)
    });
  });

  // Maktab bo'yicha har doim aniq 2 ta smenaning 2 ta mas'ul navbatchi o'qituvchisi qaytariladi
  return list.slice(0, 2);
}

/**
 * Berilgan sinf rahbari bugun maktab bo'yicha navbatchi (mas'ul) etib tayinlanganmi yoki yo'qligini tekshirish
 * Agar o'qituvchi kelolmaslik sababini qoldirgan bo'lsa, uning navbatchiligi bekor qilinadi.
 * Agar boshqa o'qituvchi kelolmagani uchun tizim bu o'qituvchini tayinlagan bo'lsa, u mas'ul navbatchi hisoblanadi.
 */
export function getTodayDutyInfoForTeacher(teacherClass, state) {
  if (!teacherClass || !teacherClass.schoolId || !state) {
    return { 
      isDutyToday: false, 
      dutyShifts: [], 
      allTodayDutyTeachers: [],
      hasReportedAbsenceToday: false,
      absenceReason: '',
      isDelegatedToday: false
    };
  }

  const schoolId = teacherClass.schoolId;
  const todayISO = getTodayISODate();
  const allTodayDutyTeachers = getTodayDutyTeachersForSchool(schoolId, state);

  const cleanTeacherName = (teacherClass.teacherName || '').trim().toLowerCase();

  // 1. O'qituvchi bugun o'zi kelolmaslik haqida sabab qoldirganmi?
  const absences = (state.dutyAbsences || []).filter(a => a.schoolId === schoolId && a.date === todayISO);
  const myAbsence = absences.find(a => {
    const origName = (a.originalTeacherName || '').trim().toLowerCase();
    const isNameMatch = Boolean(cleanTeacherName && origName && origName === cleanTeacherName);
    const isClassMatch = Boolean(a.originalTeacherClassId && a.originalTeacherClassId === teacherClass.id);
    return isNameMatch || isClassMatch;
  });

  if (myAbsence) {
    return {
      isDutyToday: false,
      hasReportedAbsenceToday: true,
      absenceReason: myAbsence.reason,
      reportedAt: myAbsence.reportedAt,
      delegatedTo: myAbsence.delegatedTeacherName,
      dutyShifts: [],
      allTodayDutyTeachers
    };
  }

  // 2. Ushbu o'qituvchi bugungi 2 ta smenaning birortasida haqiqiy mas'ul navbatchimi?
  // DIQQAT TALABI: Faqat va faqat bugun maktab bo'yicha tayinlangan 2 ta o'qituvchiga isDutyToday = true bo'ladi!
  const myDutyShifts = [];

  allTodayDutyTeachers.forEach(duty => {
    // Agar asl navbatchi kelmagan bo'lsa (hasAbsence = true), navbatchi uning o'rniga tayinlangan o'qituvchi bo'ladi
    const activeDutyClassId = duty.hasAbsence 
      ? (duty.backupTeacherClassId || '') 
      : (duty.primaryTeacherClassId || '');
    const activeDutyTeacherName = (duty.hasAbsence 
      ? (duty.delegatedTeacherName || duty.backupTeacherName || '') 
      : (duty.primaryTeacherName || '')).trim().toLowerCase();

    // 1-tartibda sinf ID bo'yicha aniq moslik
    const isClassMatch = Boolean(teacherClass.id && activeDutyClassId && teacherClass.id === activeDutyClassId);
    
    // 2-tartibda o'qituvchi to'liq F.I.SH bo'yicha aniq moslik (faqat to'liq tenglik, qisqa parcha emas!)
    const isExactNameMatch = Boolean(
      cleanTeacherName && activeDutyTeacherName &&
      (cleanTeacherName === activeDutyTeacherName)
    );

    if (isClassMatch || isExactNameMatch) {
      myDutyShifts.push(duty);
    }
  });

  const isDutyToday = myDutyShifts.length > 0;

  return {
    isDutyToday,
    hasReportedAbsenceToday: false,
    absenceReason: '',
    isDelegatedToday: myDutyShifts.some(d => d.hasAbsence),
    dutyShifts: myDutyShifts,
    allTodayDutyTeachers
  };
}

/**
 * Navbatchi o'qituvchi kela olmaganda sabab qoldirish va tizim tomonidan keyingi o'qituvchini avtomatik tayinlash
 * Maktab Ma'muriyati (Admin)ga zudlik bilan xabarnoma (notification) yuboriladi.
 */
export function recordDutyAbsenceAndDelegate(options, reasonArg, onSaveRosterArg) {
  let schoolId, shiftId, reason, state, onSaveRoster;
  if (typeof options === 'object' && options !== null) {
    ({ schoolId, shiftId, reason, state, onSaveRoster } = options);
  } else {
    shiftId = options;
    reason = reasonArg;
    onSaveRoster = onSaveRosterArg;
  }

  // Fallbacks if state or schoolId not explicitly passed
  if (!state && typeof window !== 'undefined' && window.state?.db) {
    state = window.state.db;
  }
  if (!schoolId && state?.shifts) {
    const matchedShift = state.shifts.find(s => s.id === shiftId);
    if (matchedShift?.schoolId) schoolId = matchedShift.schoolId;
  }
  if (!schoolId && state?.schools?.[0]?.id) {
    schoolId = state.schools[0].id;
  }

  if (!schoolId || !shiftId || !reason || !state) return null;

  const todayDay = getTodayDayOfWeek();
  const todayISO = getTodayISODate();
  const shift = (state.shifts || []).find(s => s.id === shiftId);
  const roster = (state.dutyRosters || []).find(r => r.schoolId === schoolId && r.shiftId === shiftId && Number(r.dayOfWeek) === Number(todayDay));

  if (!roster) return null;

  const originalPrimaryName = roster.primaryTeacherName;
  const originalPrimaryPhone = roster.primaryTeacherPhone;
  const originalPrimaryClassId = roster.primaryTeacherClassId;
  const originalPrimaryClassName = roster.primaryTeacherClassName;

  // Keyingi navbatchi o'qituvchini aniqlash (birinchi navbatda zaxira/dublyor o'qituvchi)
  const schoolClasses = (state.classes || []).filter(c => c.schoolId === schoolId && Boolean(c.teacherName && c.teacherName.trim()));
  
  let newPrimary = null;

  // Agar zaxira o'qituvchi mavjud bo'lsa va u asl navbatchi bilan bir xil bo'lmasa
  if (roster.backupTeacherName && roster.backupTeacherName !== originalPrimaryName) {
    newPrimary = {
      name: roster.backupTeacherName,
      phone: roster.backupTeacherPhone || '',
      classId: roster.backupTeacherClassId || '',
      className: roster.backupTeacherClassName || ''
    };
  } else {
    // Smenadagi yoki maktabdagi boshqa sinf rahbarini topish
    const shiftClassIds = new Set(shift?.classIds || []);
    const candidateClasses = schoolClasses.filter(c => 
      c.id !== originalPrimaryClassId && 
      (c.teacherName || '').trim().toLowerCase() !== (originalPrimaryName || '').trim().toLowerCase()
    );

    // Avval ushbu smenadagi boshqa o'qituvchi
    const shiftCandidate = candidateClasses.find(c => shiftClassIds.has(c.id));
    const targetClass = shiftCandidate || candidateClasses[0];

    if (targetClass) {
      newPrimary = {
        name: targetClass.teacherName.trim(),
        phone: targetClass.teacherPhone || '',
        classId: targetClass.id,
        className: targetClass.name
      };
    } else {
      newPrimary = {
        name: "Zaxira Mas'ul O'qituvchi",
        phone: "",
        classId: "",
        className: ""
      };
    }
  }

  // Yangi zaxira o'qituvchi tanlash
  const remainingCandidates = schoolClasses.filter(c => 
    c.id !== originalPrimaryClassId && 
    c.id !== newPrimary.classId &&
    (c.teacherName || '').trim().toLowerCase() !== (originalPrimaryName || '').trim().toLowerCase() &&
    (c.teacherName || '').trim().toLowerCase() !== (newPrimary.name || '').trim().toLowerCase()
  );
  const newBackupClass = remainingCandidates[0] || null;
  const newBackup = {
    name: newBackupClass ? newBackupClass.teacherName.trim() : (roster.backupTeacherName || "Zaxira o'qituvchi"),
    phone: newBackupClass ? (newBackupClass.teacherPhone || '') : (roster.backupTeacherPhone || ''),
    classId: newBackupClass ? newBackupClass.id : '',
    className: newBackupClass ? newBackupClass.name : ''
  };

  // 1. Kelolmaslik qaydini yaratish
  const absenceRecord = {
    id: `duty_abs_${schoolId}_${todayISO}_${shiftId}_${Date.now()}`,
    schoolId,
    shiftId,
    shiftName: shift?.name || 'Smena',
    date: todayISO,
    originalTeacherName: originalPrimaryName,
    originalTeacherPhone: originalPrimaryPhone,
    originalTeacherClassId: originalPrimaryClassId,
    originalTeacherClassName: originalPrimaryClassName,
    reason: reason.trim(),
    reportedAt: new Date().toISOString(),
    delegatedTeacherName: newPrimary.name,
    delegatedTeacherPhone: newPrimary.phone,
    delegatedTeacherClassId: newPrimary.classId,
    delegatedTeacherClassName: newPrimary.className,
    newBackupTeacherName: newBackup.name,
    newBackupTeacherPhone: newBackup.phone,
    newBackupTeacherClassId: newBackup.classId,
    newBackupTeacherClassName: newBackup.className,
    status: 'delegated'
  };

  if (!state.dutyAbsences) state.dutyAbsences = [];
  state.dutyAbsences.push(absenceRecord);

  // 2. Maktab Admini uchun shoshilinch Xabarnoma (Notification) yaratish
  const adminNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    schoolId,
    type: 'duty_absence',
    title: "⚠️ Navbatchi o'qituvchi kelolmasligini bildirdi",
    message: `${originalPrimaryName} (${shift?.name || 'Smena'}) bugun navbatchilikka kela olmasligini bildirdi. Sababi: "${reason.trim()}". Tizim tomonidan navbatchilik avtomatik ravishda ${newPrimary.name} (${newPrimary.className || 'Sinf rahbari'})ga topshirildi.`,
    createdAt: new Date().toISOString(),
    read: false,
    severity: 'warning',
    absenceId: absenceRecord.id,
    originalTeacherName: originalPrimaryName,
    delegatedTeacherName: newPrimary.name,
    reason: reason.trim(),
    shiftName: shift?.name || 'Smena'
  };

  if (!state.adminNotifications) state.adminNotifications = [];
  state.adminNotifications.unshift(adminNotification);

  // 3. Navbatchilik jadvalini (roster) yangilash
  roster.primaryTeacherName = newPrimary.name;
  roster.primaryTeacherPhone = newPrimary.phone;
  roster.primaryTeacherClassId = newPrimary.classId;
  roster.primaryTeacherClassName = newPrimary.className;
  roster.backupTeacherName = newBackup.name;
  roster.backupTeacherPhone = newBackup.phone;
  roster.backupTeacherClassId = newBackup.classId;
  roster.backupTeacherClassName = newBackup.className;
  roster.notes = `Almashtirildi (${todayISO}): ${originalPrimaryName} kelolmaydi (Sabab: "${reason.trim()}"). Yangi navbatchi: ${newPrimary.name}`;
  roster.updatedAt = new Date().toISOString();

  if (typeof onSaveRoster === 'function') {
    onSaveRoster(roster);
  }

  return {
    absenceRecord,
    dutyAbsence: absenceRecord,
    adminNotification,
    notification: adminNotification,
    newPrimary,
    newBackup
  };
}

/**
 * Sinf davomatini adminga yuborilganda:
 * 1. Sinf davomati obyektiga isSubmittedToAdmin: true va tasdiqlovchi ma'lumotlarni yozadi.
 * 2. Maktab bo'yicha bugungi BARCHA smenalarning attendanceRecords yozuvlariga ushbu sinf davomatini sinxronlashtiradi
 *    (Shunda 2-smena navbatchisi kirganda ham aynan shu sinf davomati olingani va adminga yuborilgani yashil "✓" bilan darhol ko'rinadi).
 * 3. Maktab Admini uchun "class_attendance_submitted" xabarnomasini (adminNotifications) yaratadi.
 * 4. state ni mahalliy saqlaydi (saveData).
 */
export function recordClassAttendanceSubmission(state, schoolId, classObj, clsAtt, submittedBy) {
  if (!clsAtt) return null;
  const todayISO = getTodayISODate();

  clsAtt.isSubmittedToAdmin = true;
  clsAtt.submittedAt = new Date().toISOString();
  clsAtt.submittedBy = submittedBy || "Navbatchi o'qituvchi";

  // 1. Maktabdagi bugungi barcha davomat yozuvlariga (1-smena, 2-smena va h.k.) sinxronlash
  if (!state.attendanceRecords) state.attendanceRecords = [];
  state.attendanceRecords.forEach(rec => {
    if (rec.schoolId === schoolId && rec.date === todayISO) {
      if (!rec.classAttendance) rec.classAttendance = {};
      rec.classAttendance[classObj.id] = JSON.parse(JSON.stringify(clsAtt));
    }
  });

  // 2. Admin uchun yangi xabarnoma (Notification)
  const notif = {
    id: `notif_att_${classObj.id}_${Date.now()}`,
    schoolId,
    type: 'class_attendance_submitted',
    title: `${classObj.name} sinfi davomati qabul qilindi`,
    message: `Navbatchi o'qituvchi ${clsAtt.submittedBy} tomonidan ${classObj.name} sinfining bugungi davomati topshirildi. (Jami: ${clsAtt.totalStudents || 0}, Bor: ${clsAtt.presentCount || 0}, Sababli: ${clsAtt.excusedCount || 0}, Sababsiz: ${clsAtt.unexcusedCount || 0})`,
    createdAt: new Date().toISOString(),
    read: false,
    severity: 'info',
    data: {
      classId: classObj.id,
      className: classObj.name,
      date: todayISO,
      presentCount: clsAtt.presentCount || 0,
      absentCount: (clsAtt.excusedCount || 0) + (clsAtt.unexcusedCount || 0),
      excusedCount: clsAtt.excusedCount || 0,
      unexcusedCount: clsAtt.unexcusedCount || 0,
      submittedBy: clsAtt.submittedBy
    }
  };

  if (!state.adminNotifications) state.adminNotifications = [];
  state.adminNotifications.unshift(notif);

  saveData(state);

  return notif;
}

/**
 * Maktab bo'yicha berilgan sanada topshirilgan barcha sinf davomatlarini olish
 */
export function getSubmittedClassesForDate(schoolId, state, dateStr) {
  const records = (state.attendanceRecords || []).filter(r => r.schoolId === schoolId && r.date === dateStr);
  const schoolClasses = (state.classes || []).filter(c => c.schoolId === schoolId);
  
  const result = [];
  schoolClasses.forEach(cls => {
    for (const rec of records) {
      const clsAtt = rec.classAttendance?.[cls.id];
      if (clsAtt && clsAtt.isSubmittedToAdmin) {
        result.push({
          classObj: cls,
          classId: cls.id,
          className: cls.name,
          teacherName: cls.teacherName || '',
          ...clsAtt
        });
        break;
      }
    }
  });

  return result;
}



