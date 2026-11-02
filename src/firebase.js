import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  setLogLevel,
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  collection, 
  onSnapshot, 
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Suppress internal transient network retry logs from flooding console
setLogLevel('silent');

// Initialize Firestore with robust forced long polling for proxy/iframe compatibility
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
}, firebaseConfig.firestoreDatabaseId || undefined);

// Initialize Firebase Auth
export const auth = getAuth(app);

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

// ============================================================================
// GIBRID BAZA BOSHQARUVI: CLOUD FIRESTORE (1 GB) + RAILWAY SERVER (8 GB)
// ============================================================================
// Talabga binoan:
// 1) Shu vaqtgacha Firestore'da saqlangan barcha ma'lumotlar o'z joyida daxlsiz qoladi va doim o'qiladi.
// 2) Endi kiritiladigan yangi ma'lumotlar standart holatda Railway (8 GB) serveriga saqlanadi ('railway').
// 3) Dasturchi o'z sahifasidan ma'lumotlarni qayerga saqlashni ('railway', 'firestore', yoki 'both') belgilashi mumkin.
// ============================================================================

const STORAGE_MODE_KEY = 'maktabx_storage_target_mode';
const RAILWAY_MIRROR_KEY = 'maktabx_railway_mirror_v1';

const COLLECTION_KEYS = [
  'schools',
  'classes',
  'students',
  'recoveryRequests',
  'shifts',
  'duty_rosters',
  'attendance_records',
  'duty_absences',
  'admin_notifications',
  'trash',
  'system'
];

// Lokal kesh va server holati
let activeStorageMode = loadSavedStorageMode();
let railwayServerOnline = true;
let railwayLastUpdatedAt = null;
let railwayUsedBytes = 0;

let railwayCache = loadRailwayMirrorFromLocal();
let firestoreCache = {
  schools: [],
  classes: [],
  students: [],
  recoveryRequests: [],
  shifts: [],
  duty_rosters: [],
  attendance_records: [],
  duty_absences: [],
  admin_notifications: [],
  trash: [],
  system: null
};

let activeSubscriptionCallbacks = null;

function loadSavedStorageMode() {
  try {
    const saved = localStorage.getItem(STORAGE_MODE_KEY);
    if (saved && ['railway', 'firestore', 'both'].includes(saved)) {
      return saved;
    }
  } catch (_) {}
  return 'railway'; // Standart: yangi ma'lumotlar Railway (8 GB) serverga saqlanadi
}

function loadRailwayMirrorFromLocal() {
  const empty = {
    collections: {
      schools: {},
      classes: {},
      students: {},
      recoveryRequests: {},
      shifts: {},
      duty_rosters: {},
      attendance_records: {},
      duty_absences: {},
      admin_notifications: {},
      trash: {},
      system: {}
    },
    deletedIds: {}
  };
  try {
    const raw = localStorage.getItem(RAILWAY_MIRROR_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      collections: { ...empty.collections, ...(parsed?.collections || {}) },
      deletedIds: parsed?.deletedIds || {}
    };
  } catch (_) {
    return empty;
  }
}

function saveRailwayMirrorToLocal() {
  try {
    localStorage.setItem(RAILWAY_MIRROR_KEY, JSON.stringify(railwayCache));
  } catch (_) {}
}

export function getStorageTargetMode() {
  return activeStorageMode || 'railway';
}

export async function setStorageTargetMode(newMode) {
  if (!['railway', 'firestore', 'both'].includes(newMode)) {
    return activeStorageMode;
  }
  activeStorageMode = newMode;
  try {
    localStorage.setItem(STORAGE_MODE_KEY, newMode);
  } catch (_) {}

  // 1. Railway serveriga saqlash rejimini yuborish
  try {
    await fetch('/api/railway-db/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storageTargetMode: newMode })
    });
  } catch (err) {
    console.warn('Railway config saqlash bildirishnomasi:', err);
  }

  // 2. Barcha qurilmalar bilishi uchun Firestore system/main ga ham rejim nomini yozib qo'yish
  try {
    await setDoc(doc(db, 'system', 'main'), {
      storageTargetMode: newMode,
      storageModeUpdatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (_) {}

  return activeStorageMode;
}

export function getHybridStorageStatus() {
  const countRailwayDocs = (col) => Object.keys(railwayCache.collections?.[col] || {}).length;
  const countFirestoreDocs = (col) => (firestoreCache[col] || []).length;

  const railwayCounts = {
    schools: countRailwayDocs('schools'),
    classes: countRailwayDocs('classes'),
    students: countRailwayDocs('students'),
    recoveryRequests: countRailwayDocs('recoveryRequests'),
    shifts: countRailwayDocs('shifts'),
    dutyRosters: countRailwayDocs('duty_rosters'),
    attendanceRecords: countRailwayDocs('attendance_records'),
    trash: countRailwayDocs('trash')
  };

  const firestoreCounts = {
    schools: countFirestoreDocs('schools'),
    classes: countFirestoreDocs('classes'),
    students: countFirestoreDocs('students'),
    recoveryRequests: countFirestoreDocs('recoveryRequests'),
    shifts: countFirestoreDocs('shifts'),
    dutyRosters: countFirestoreDocs('duty_rosters'),
    attendanceRecords: countFirestoreDocs('attendance_records'),
    trash: countFirestoreDocs('trash')
  };

  const totalRailwayRecords = Object.values(railwayCounts).reduce((a, b) => a + b, 0);
  const totalFirestoreRecords = Object.values(firestoreCounts).reduce((a, b) => a + b, 0);

  let measuredRailwayBytes = railwayUsedBytes;
  if (!measuredRailwayBytes) {
    try {
      measuredRailwayBytes = new Blob([JSON.stringify(railwayCache.collections || {})]).size;
    } catch (_) {
      measuredRailwayBytes = 0;
    }
  }

  return {
    mode: activeStorageMode,
    railwayServerOnline,
    railwayLastUpdatedAt,
    railwayCapacityBytes: 8 * 1024 * 1024 * 1024, // 8 GB
    railwayUsedBytes: measuredRailwayBytes,
    firestoreCapacityBytes: 1024 * 1024 * 1024, // 1 GB
    railwayCounts,
    firestoreCounts,
    totalRailwayRecords,
    totalFirestoreRecords
  };
}

// Railway serveridan joriy holatni olish
async function fetchRailwayState() {
  try {
    const res = await withTimeout(fetch('/api/railway-db/state'), 4500);
    if (!res || !res.ok) throw new Error(`HTTP ${res?.status}`);
    const data = await res.json();
    if (data && data.success && data.collections) {
      railwayServerOnline = true;
      railwayLastUpdatedAt = data.updatedAt || new Date().toISOString();
      railwayUsedBytes = data.usedBytes || 0;

      // Lokal kesh bilan serverdagi ma'lumotlarni birlashtirish
      for (const col of COLLECTION_KEYS) {
        railwayCache.collections[col] = {
          ...(railwayCache.collections[col] || {}),
          ...(data.collections[col] || {})
        };
      }
      railwayCache.deletedIds = data.deletedIds || railwayCache.deletedIds || {};

      // Agar localStorage da hali tanlanmagan bo'lsa, serverdagi rejimni olish
      if (!localStorage.getItem(STORAGE_MODE_KEY) && data.storageTargetMode) {
        activeStorageMode = data.storageTargetMode;
        try { localStorage.setItem(STORAGE_MODE_KEY, activeStorageMode); } catch (_) {}
      }

      saveRailwayMirrorToLocal();
      return data;
    }
  } catch (err) {
    // Offline yoki statik xostingda localStorage mirror ishlaydi
    railwayServerOnline = false;
  }
  return null;
}

// Hujjatni Railway bazasiga saqlash
async function saveDocToRailway(colName, id, data, merge = true) {
  if (!colName || !id || !data) return;
  if (!railwayCache.collections[colName]) {
    railwayCache.collections[colName] = {};
  }
  const existing = railwayCache.collections[colName][id] || {};
  const docWithMeta = merge
    ? { ...existing, ...data, id, _storageSource: 'railway', _savedAt: new Date().toISOString() }
    : { ...data, id, _storageSource: 'railway', _savedAt: new Date().toISOString() };

  railwayCache.collections[colName][id] = docWithMeta;
  if (Array.isArray(railwayCache.deletedIds?.[colName])) {
    railwayCache.deletedIds[colName] = railwayCache.deletedIds[colName].filter(delId => delId !== id);
  }
  saveRailwayMirrorToLocal();

  try {
    const res = await fetch('/api/railway-db/doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: colName, id, data: docWithMeta, merge })
    });
    if (res.ok) {
      railwayServerOnline = true;
      railwayLastUpdatedAt = new Date().toISOString();
    }
  } catch (err) {
    console.warn(`Railway serverga saqlashda kesh rejimi ishladi (${colName}/${id}):`, err);
  }
}

// Hujjatni Railway bazasidan o'chirish
async function deleteDocFromRailway(colName, id) {
  if (!colName || !id) return;
  if (railwayCache.collections[colName] && railwayCache.collections[colName][id]) {
    delete railwayCache.collections[colName][id];
  }
  if (!railwayCache.deletedIds) railwayCache.deletedIds = {};
  if (!Array.isArray(railwayCache.deletedIds[colName])) {
    railwayCache.deletedIds[colName] = [];
  }
  if (!railwayCache.deletedIds[colName].includes(id)) {
    railwayCache.deletedIds[colName].push(id);
  }
  saveRailwayMirrorToLocal();

  try {
    await fetch(`/api/railway-db/doc/${encodeURIComponent(colName)}/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  } catch (_) {}
}

// Firestore kolleksiyasini Railway kolleksiyasi bilan zararsiz birlashtirish (Merge)
function mergeCollectionWithRailway(colName, firestoreDocs = []) {
  const safeFirestoreDocs = Array.isArray(firestoreDocs) ? firestoreDocs : [];
  firestoreCache[colName] = safeFirestoreDocs;

  const railwayMap = railwayCache.collections?.[colName] || {};
  const deletedSet = new Set(railwayCache.deletedIds?.[colName] || []);
  const mergedMap = new Map();

  // 1. Avval Firestore'dagi barcha mavjud ma'lumotlarni qo'yamiz
  safeFirestoreDocs.forEach(item => {
    if (item && item.id && !deletedSet.has(item.id)) {
      mergedMap.set(item.id, {
        ...item,
        _storageSource: railwayMap[item.id] ? 'both' : 'firestore'
      });
    }
  });

  // 2. Ustidan Railway'dagi yangi yoki yangilangan ma'lumotlarni qo'shamiz
  Object.values(railwayMap).forEach(rwItem => {
    if (rwItem && rwItem.id && !deletedSet.has(rwItem.id)) {
      const existing = mergedMap.get(rwItem.id);
      if (existing) {
        // Agar ikkalasida ham bo'lsa, yangilangan maydonlarni birlashtiramiz
        mergedMap.set(rwItem.id, {
          ...existing,
          ...rwItem,
          _storageSource: 'both'
        });
      } else {
        mergedMap.set(rwItem.id, {
          ...rwItem,
          _storageSource: 'railway'
        });
      }
    }
  });

  return Array.from(mergedMap.values());
}

// Firestore'dan Railway'ga 1-tugma bilan to'liq nusxalash (Firestore'dagi ma'lumotlar o'chmaydi!)
export async function syncAllDataToRailway(currentDbState) {
  const payload = {
    schools: currentDbState?.schools || firestoreCache.schools || [],
    classes: currentDbState?.classes || firestoreCache.classes || [],
    students: currentDbState?.students || firestoreCache.students || [],
    recoveryRequests: currentDbState?.recoveryRequests || firestoreCache.recoveryRequests || [],
    shifts: currentDbState?.shifts || firestoreCache.shifts || [],
    duty_rosters: currentDbState?.dutyRosters || firestoreCache.duty_rosters || [],
    attendance_records: currentDbState?.attendanceRecords || firestoreCache.attendance_records || [],
    duty_absences: currentDbState?.dutyAbsences || firestoreCache.duty_absences || [],
    admin_notifications: currentDbState?.adminNotifications || firestoreCache.admin_notifications || [],
    trash: currentDbState?.trash || firestoreCache.trash || [],
    system: {
      main: {
        id: 'main',
        developer: currentDbState?.developer || null,
        siteInfo: currentDbState?.siteInfo || null,
        storageTargetMode: activeStorageMode
      }
    }
  };

  // Lokal Railway keshni ham to'ldirish
  Object.entries(payload).forEach(([colName, listOrObj]) => {
    if (!railwayCache.collections[colName]) railwayCache.collections[colName] = {};
    if (Array.isArray(listOrObj)) {
      listOrObj.forEach(item => {
        if (item && item.id) {
          railwayCache.collections[colName][item.id] = {
            ...item,
            _storageSource: 'both',
            _syncedAt: new Date().toISOString()
          };
        }
      });
    } else if (listOrObj && typeof listOrObj === 'object') {
      Object.entries(listOrObj).forEach(([k, v]) => {
        railwayCache.collections[colName][k] = v;
      });
    }
  });
  saveRailwayMirrorToLocal();

  const res = await fetch('/api/railway-db/bulk-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collections: payload })
  });
  const data = await res.json();
  await fetchRailwayState();
  return data;
}

// Barcha ma'lumotlarni .JSON zaxira (Backup) fayli sifatida yuklab olish
export function downloadFullDatabaseBackup(currentDbState) {
  const backupObj = {
    backupVersion: '2.0',
    exportedAt: new Date().toISOString(),
    storageTargetMode: activeStorageMode,
    summary: {
      schools: (currentDbState?.schools || []).length,
      classes: (currentDbState?.classes || []).length,
      students: (currentDbState?.students || []).length,
      shifts: (currentDbState?.shifts || []).length,
      dutyRosters: (currentDbState?.dutyRosters || []).length,
      attendanceRecords: (currentDbState?.attendanceRecords || []).length
    },
    data: {
      schools: currentDbState?.schools || [],
      classes: currentDbState?.classes || [],
      students: currentDbState?.students || [],
      recoveryRequests: currentDbState?.recoveryRequests || [],
      shifts: currentDbState?.shifts || [],
      dutyRosters: currentDbState?.dutyRosters || [],
      attendanceRecords: currentDbState?.attendanceRecords || [],
      dutyAbsences: currentDbState?.dutyAbsences || [],
      adminNotifications: currentDbState?.adminNotifications || [],
      trash: currentDbState?.trash || [],
      developer: currentDbState?.developer || null,
      siteInfo: currentDbState?.siteInfo || null
    }
  };

  const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `MaktabX_Full_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Qaysi bazaga yozish kerakligini tekshirish
function shouldWriteToRailway() {
  return activeStorageMode === 'railway' || activeStorageMode === 'both';
}

function shouldWriteToFirestore() {
  return activeStorageMode === 'firestore' || activeStorageMode === 'both';
}

// Required error handler conforming to skill specification
export function handleFirestoreError(error, operationType, path) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isPermissionDenied = errMsg.includes('insufficient permissions') || 
                             errMsg.includes('Missing or insufficient') || 
                             error?.code === 'permission-denied';

  if (!isPermissionDenied) {
    if (error?.code === 'unavailable' || errMsg.includes('offline') || errMsg.includes('Could not reach Cloud Firestore')) {
      return;
    }
    console.warn(`Firestore network notice on ${path} (${operationType}):`, errMsg);
    return;
  }

  const errInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to add timeout to any promise
function withTimeout(promise, ms = 4000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// Test connection on startup per Firebase skill guideline
export async function testConnection() {
  try {
    const [mainDoc] = await Promise.all([
      withTimeout(getDoc(doc(db, 'system', 'main')), 3000).catch(() => null),
      fetchRailwayState().catch(() => null)
    ]);
    if (mainDoc && mainDoc.exists()) {
      console.log('Firebase Firestore + Railway Hybrid connection verified successfully.');
    }
    return true;
  } catch (error) {
    return false;
  }
}

// Fetch all database state (Merges Firestore existing data + Railway new data seamlessly)
export async function fetchAllData(timeoutMs = 12000, retries = 2) {
  // Parallel ravishda Railway server holatini ham yangilab olamiz
  await fetchRailwayState().catch(() => null);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const [schoolsSnap, classesSnap, studentsSnap, requestsSnap, shiftsSnap, rostersSnap, attendanceSnap, absencesSnap, notificationsSnap, systemDoc] = await withTimeout(
        Promise.all([
          getDocs(collection(db, 'schools')).catch(err => { handleFirestoreError(err, OperationType.LIST, 'schools'); return null; }),
          getDocs(collection(db, 'classes')).catch(err => { handleFirestoreError(err, OperationType.LIST, 'classes'); return null; }),
          getDocs(collection(db, 'students')).catch(err => { handleFirestoreError(err, OperationType.LIST, 'students'); return null; }),
          getDocs(collection(db, 'recoveryRequests')).catch(err => { handleFirestoreError(err, OperationType.LIST, 'recoveryRequests'); return null; }),
          getDocs(collection(db, 'shifts')).catch(err => { handleFirestoreError(err, OperationType.LIST, 'shifts'); return null; }),
          getDocs(collection(db, 'duty_rosters')).catch(err => { handleFirestoreError(err, OperationType.LIST, 'duty_rosters'); return null; }),
          getDocs(collection(db, 'attendance_records')).catch(err => { handleFirestoreError(err, OperationType.LIST, 'attendance_records'); return null; }),
          getDocs(collection(db, 'duty_absences')).catch(err => { handleFirestoreError(err, OperationType.LIST, 'duty_absences'); return null; }),
          getDocs(collection(db, 'admin_notifications')).catch(err => { handleFirestoreError(err, OperationType.LIST, 'admin_notifications'); return null; }),
          getDoc(doc(db, 'system', 'main')).catch(err => { handleFirestoreError(err, OperationType.GET, 'system/main'); return null; })
        ]),
        timeoutMs
      );

      const hasAnySnapshot = schoolsSnap || classesSnap || studentsSnap || attendanceSnap || systemDoc;
      if (!hasAnySnapshot && attempt < retries) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }

      const fsSchools = schoolsSnap && schoolsSnap.docs ? schoolsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const fsClasses = classesSnap && classesSnap.docs ? classesSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const fsStudents = studentsSnap && studentsSnap.docs ? studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const fsRequests = requestsSnap && requestsSnap.docs ? requestsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const fsShifts = shiftsSnap && shiftsSnap.docs ? shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const fsRosters = rostersSnap && rostersSnap.docs ? rostersSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const fsAttendance = attendanceSnap && attendanceSnap.docs ? attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const fsAbsences = absencesSnap && absencesSnap.docs ? absencesSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const fsNotifications = notificationsSnap && notificationsSnap.docs ? notificationsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];

      // Firestore'dagi barcha ma'lumotlarni Railway'dagi yangi ma'lumotlar bilan birlashtiramiz
      const schools = mergeCollectionWithRailway('schools', fsSchools);
      const classes = mergeCollectionWithRailway('classes', fsClasses);
      const students = mergeCollectionWithRailway('students', fsStudents);
      const recoveryRequests = mergeCollectionWithRailway('recoveryRequests', fsRequests);
      const shifts = mergeCollectionWithRailway('shifts', fsShifts);
      const dutyRosters = mergeCollectionWithRailway('duty_rosters', fsRosters);
      const attendanceRecords = mergeCollectionWithRailway('attendance_records', fsAttendance);
      const dutyAbsences = mergeCollectionWithRailway('duty_absences', fsAbsences);
      const adminNotifications = mergeCollectionWithRailway('admin_notifications', fsNotifications);

      let developer = null;
      let siteInfo = null;
      if (systemDoc && typeof systemDoc.exists === 'function' && systemDoc.exists()) {
        const data = systemDoc.data();
        developer = data?.developer || null;
        siteInfo = data?.siteInfo || null;
        if (data?.storageTargetMode && !localStorage.getItem(STORAGE_MODE_KEY)) {
          activeStorageMode = data.storageTargetMode;
        }
      }

      // Railway system/main ustunligi (agar Railway'da yangilangan bo'lsa)
      const rwSystemMain = railwayCache.collections?.system?.main;
      if (rwSystemMain) {
        if (rwSystemMain.developer) developer = { ...(developer || {}), ...rwSystemMain.developer };
        if (rwSystemMain.siteInfo) siteInfo = { ...(siteInfo || {}), ...rwSystemMain.siteInfo };
      }

      return {
        schools,
        classes,
        students,
        recoveryRequests,
        shifts,
        dutyRosters,
        attendanceRecords,
        dutyAbsences,
        adminNotifications,
        developer,
        siteInfo
      };
    } catch (error) {
      console.warn(`Fetch all data attempt ${attempt} notice:`, error);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 700));
      }
    }
  }

  // Agar Firestore oflayn bo'lsa ham Railway'dagi ma'lumotlarni qaytarish
  return {
    schools: mergeCollectionWithRailway('schools', firestoreCache.schools),
    classes: mergeCollectionWithRailway('classes', firestoreCache.classes),
    students: mergeCollectionWithRailway('students', firestoreCache.students),
    recoveryRequests: mergeCollectionWithRailway('recoveryRequests', firestoreCache.recoveryRequests),
    shifts: mergeCollectionWithRailway('shifts', firestoreCache.shifts),
    dutyRosters: mergeCollectionWithRailway('duty_rosters', firestoreCache.duty_rosters),
    attendanceRecords: mergeCollectionWithRailway('attendance_records', firestoreCache.attendance_records),
    dutyAbsences: mergeCollectionWithRailway('duty_absences', firestoreCache.duty_absences),
    adminNotifications: mergeCollectionWithRailway('admin_notifications', firestoreCache.admin_notifications),
    developer: railwayCache.collections?.system?.main?.developer || null,
    siteInfo: railwayCache.collections?.system?.main?.siteInfo || null
  };
}

// Real-time synchronization listeners across devices (Firestore + Railway Hybrid)
export function subscribeToDatabase(callbacks) {
  activeSubscriptionCallbacks = callbacks;
  const unsubscribers = [];

  // Schools listener
  const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
    const fsSchools = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = mergeCollectionWithRailway('schools', fsSchools);
    if (callbacks.onSchoolsUpdate) callbacks.onSchoolsUpdate(merged);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'schools');
  });
  unsubscribers.push(unsubSchools);

  // Classes listener
  const unsubClasses = onSnapshot(collection(db, 'classes'), (snapshot) => {
    const fsClasses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = mergeCollectionWithRailway('classes', fsClasses);
    if (callbacks.onClassesUpdate) callbacks.onClassesUpdate(merged);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'classes');
  });
  unsubscribers.push(unsubClasses);

  // Students listener
  const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
    const fsStudents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = mergeCollectionWithRailway('students', fsStudents);
    if (callbacks.onStudentsUpdate) callbacks.onStudentsUpdate(merged);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'students');
  });
  unsubscribers.push(unsubStudents);

  // Recovery Requests listener
  const unsubRequests = onSnapshot(collection(db, 'recoveryRequests'), (snapshot) => {
    const fsRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = mergeCollectionWithRailway('recoveryRequests', fsRequests);
    if (callbacks.onRecoveryRequestsUpdate) callbacks.onRecoveryRequestsUpdate(merged);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'recoveryRequests');
  });
  unsubscribers.push(unsubRequests);

  // Shifts listener
  const unsubShifts = onSnapshot(collection(db, 'shifts'), (snapshot) => {
    const fsShifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = mergeCollectionWithRailway('shifts', fsShifts);
    if (callbacks.onShiftsUpdate) callbacks.onShiftsUpdate(merged);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'shifts');
  });
  unsubscribers.push(unsubShifts);

  // Duty Rosters listener
  const unsubRosters = onSnapshot(collection(db, 'duty_rosters'), (snapshot) => {
    const fsRosters = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = mergeCollectionWithRailway('duty_rosters', fsRosters);
    if (callbacks.onDutyRostersUpdate) callbacks.onDutyRostersUpdate(merged);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'duty_rosters');
  });
  unsubscribers.push(unsubRosters);

  // Attendance Records listener
  const unsubAttendance = onSnapshot(collection(db, 'attendance_records'), (snapshot) => {
    const fsRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = mergeCollectionWithRailway('attendance_records', fsRecords);
    if (callbacks.onAttendanceRecordsUpdate) callbacks.onAttendanceRecordsUpdate(merged);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'attendance_records');
  });
  unsubscribers.push(unsubAttendance);

  // Duty Absences listener
  const unsubAbsences = onSnapshot(collection(db, 'duty_absences'), (snapshot) => {
    const fsAbsences = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = mergeCollectionWithRailway('duty_absences', fsAbsences);
    if (callbacks.onDutyAbsencesUpdate) callbacks.onDutyAbsencesUpdate(merged);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'duty_absences');
  });
  unsubscribers.push(unsubAbsences);

  // Admin Notifications listener
  const unsubNotifications = onSnapshot(collection(db, 'admin_notifications'), (snapshot) => {
    const fsNotifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = mergeCollectionWithRailway('admin_notifications', fsNotifications);
    if (callbacks.onAdminNotificationsUpdate) callbacks.onAdminNotificationsUpdate(merged);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'admin_notifications');
  });
  unsubscribers.push(unsubNotifications);

  // System/Developer config listener
  const unsubSystem = onSnapshot(doc(db, 'system', 'main'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const rwMain = railwayCache.collections?.system?.main || {};
      const mergedSys = {
        ...data,
        developer: rwMain.developer ? { ...(data?.developer || {}), ...rwMain.developer } : data?.developer,
        siteInfo: rwMain.siteInfo ? { ...(data?.siteInfo || {}), ...rwMain.siteInfo } : data?.siteInfo
      };
      if (callbacks.onSystemUpdate) callbacks.onSystemUpdate(mergedSys);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'system/main');
  });
  unsubscribers.push(unsubSystem);

  // Railway Server sync interval (har 15 soniyada Railway'dagi haqiqiy yangilanishlarni tekshirish)
  const railwayInterval = setInterval(async () => {
    try {
      if (!railwayLastUpdatedAt) {
        await fetchRailwayState();
        return;
      }
      const prevUpdatedAt = railwayLastUpdatedAt;
      const rwData = await fetchRailwayState();
      if (rwData && rwData.updatedAt && prevUpdatedAt && rwData.updatedAt !== prevUpdatedAt) {
        if (callbacks.onSchoolsUpdate) callbacks.onSchoolsUpdate(mergeCollectionWithRailway('schools', firestoreCache.schools));
        if (callbacks.onClassesUpdate) callbacks.onClassesUpdate(mergeCollectionWithRailway('classes', firestoreCache.classes));
        if (callbacks.onStudentsUpdate) callbacks.onStudentsUpdate(mergeCollectionWithRailway('students', firestoreCache.students));
        if (callbacks.onRecoveryRequestsUpdate) callbacks.onRecoveryRequestsUpdate(mergeCollectionWithRailway('recoveryRequests', firestoreCache.recoveryRequests));
        if (callbacks.onShiftsUpdate) callbacks.onShiftsUpdate(mergeCollectionWithRailway('shifts', firestoreCache.shifts));
        if (callbacks.onDutyRostersUpdate) callbacks.onDutyRostersUpdate(mergeCollectionWithRailway('duty_rosters', firestoreCache.duty_rosters));
        if (callbacks.onAttendanceRecordsUpdate) callbacks.onAttendanceRecordsUpdate(mergeCollectionWithRailway('attendance_records', firestoreCache.attendance_records));
        if (callbacks.onDutyAbsencesUpdate) callbacks.onDutyAbsencesUpdate(mergeCollectionWithRailway('duty_absences', firestoreCache.duty_absences));
        if (callbacks.onAdminNotificationsUpdate) callbacks.onAdminNotificationsUpdate(mergeCollectionWithRailway('admin_notifications', firestoreCache.admin_notifications));
      }
    } catch (_) {}
  }, 15000);

  return () => {
    clearInterval(railwayInterval);
    unsubscribers.forEach(unsub => {
      try { unsub(); } catch (_) {}
    });
  };
}

// School operations
export async function saveSchoolToFirestore(school) {
  if (!school || !school.id) return;
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('schools', school.id, school, true));
  }
  if (shouldWriteToFirestore()) {
    const path = `schools/${school.id}`;
    tasks.push(
      setDoc(doc(db, 'schools', school.id), school, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}

export async function deleteSchoolFromFirestore(schoolId) {
  if (!schoolId) return;
  const tasks = [deleteDocFromRailway('schools', schoolId)];
  if (shouldWriteToFirestore()) {
    const path = `schools/${schoolId}`;
    tasks.push(
      deleteDoc(doc(db, 'schools', schoolId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, path);
      })
    );
  }
  await Promise.all(tasks);
}

// Class operations
export async function saveClassToFirestore(classItem) {
  if (!classItem || !classItem.id) return;
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('classes', classItem.id, classItem, true));
  }
  if (shouldWriteToFirestore()) {
    const path = `classes/${classItem.id}`;
    tasks.push(
      setDoc(doc(db, 'classes', classItem.id), classItem, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}

export async function deleteClassFromFirestore(classId) {
  if (!classId) return;
  const tasks = [deleteDocFromRailway('classes', classId)];
  if (shouldWriteToFirestore()) {
    const path = `classes/${classId}`;
    tasks.push(
      deleteDoc(doc(db, 'classes', classId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, path);
      })
    );
  }
  await Promise.all(tasks);
}

// Student operations
export async function saveStudentToFirestore(student) {
  if (!student || !student.id) return;
  const studentToSave = { ...student };
  if ('photo' in studentToSave) {
    studentToSave.photo = '';
  }

  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('students', student.id, studentToSave, true));
  }
  if (shouldWriteToFirestore()) {
    const path = `students/${student.id}`;
    tasks.push(
      setDoc(doc(db, 'students', student.id), studentToSave, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}

// Barcha mavjud o'quvchilar hujjatlaridan xotirani band qiluvchi rasmlarni tozalash (Cloud Firestore bo'yicha)
export async function purgeStudentPhotosFromFirestore() {
  try {
    const snap = await getDocs(collection(db, 'students'));
    if (!snap || snap.empty) return;
    const batch = writeBatch(db);
    let changedCount = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      if (data && data.photo) {
        batch.update(doc(db, 'students', d.id), { photo: '' });
        changedCount++;
      }
    });
    if (changedCount > 0) {
      await batch.commit();
      console.log(`Firestore'dan ${changedCount} ta o'quvchi rasmi muvaffaqiyatli tozalandi.`);
    }
  } catch (err) {
    console.warn("Firestore o'quvchilar rasmini tozalashda bildirishnoma:", err);
  }
}

export async function deleteStudentFromFirestore(studentId) {
  if (!studentId) return;
  const tasks = [deleteDocFromRailway('students', studentId)];
  if (shouldWriteToFirestore()) {
    const path = `students/${studentId}`;
    tasks.push(
      deleteDoc(doc(db, 'students', studentId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, path);
      })
    );
  }
  await Promise.all(tasks);
}

// Recovery Requests operations
export async function saveRecoveryRequestToFirestore(request) {
  if (!request || !request.id) return;
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('recoveryRequests', request.id, request, true));
  }
  if (shouldWriteToFirestore()) {
    const path = `recoveryRequests/${request.id}`;
    tasks.push(
      setDoc(doc(db, 'recoveryRequests', request.id), request, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}

export async function updateRecoveryRequestStatusInFirestore(requestId, status) {
  if (!requestId) return;
  const updatePayload = { status, updatedAt: new Date().toISOString() };
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('recoveryRequests', requestId, updatePayload, true));
  }
  if (shouldWriteToFirestore()) {
    const path = `recoveryRequests/${requestId}`;
    tasks.push(
      setDoc(doc(db, 'recoveryRequests', requestId), updatePayload, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}

export async function deleteRecoveryRequestFromFirestore(requestId) {
  if (!requestId) return;
  const tasks = [deleteDocFromRailway('recoveryRequests', requestId)];
  if (shouldWriteToFirestore()) {
    const path = `recoveryRequests/${requestId}`;
    tasks.push(
      deleteDoc(doc(db, 'recoveryRequests', requestId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, path);
      })
    );
  }
  await Promise.all(tasks);
}

export function subscribeToSingleRecoveryRequest(requestId, onUpdate) {
  const unsub = onSnapshot(doc(db, 'recoveryRequests', requestId), (docSnap) => {
    if (docSnap.exists()) {
      const fsData = { id: docSnap.id, ...docSnap.data() };
      const rwData = railwayCache.collections?.recoveryRequests?.[requestId] || {};
      onUpdate({ ...fsData, ...rwData });
    } else if (railwayCache.collections?.recoveryRequests?.[requestId]) {
      onUpdate(railwayCache.collections.recoveryRequests[requestId]);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, `recoveryRequests/${requestId}`);
  });

  const pollTimer = setInterval(async () => {
    await fetchRailwayState();
    const rwReq = railwayCache.collections?.recoveryRequests?.[requestId];
    if (rwReq) {
      onUpdate(rwReq);
    }
  }, 3000);

  return () => {
    clearInterval(pollTimer);
    try { unsub(); } catch (_) {}
  };
}

// System / Developer credentials save
export async function saveSystemConfigToFirestore(config) {
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('system', 'main', config, true));
  }
  if (shouldWriteToFirestore()) {
    const path = 'system/main';
    tasks.push(
      setDoc(doc(db, 'system', 'main'), config, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
  return true;
}

// Migrate local data into Firestore if Firestore is currently empty
export async function syncLocalDataToFirestoreIfEmpty(initialData) {
  try {
    const sysDoc = await getDoc(doc(db, 'system', 'main'));
    if (!sysDoc.exists()) {
      await setDoc(doc(db, 'system', 'main'), {
        developer: initialData.developer,
        siteInfo: initialData.siteInfo || null,
        storageTargetMode: activeStorageMode,
        initializedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn('Initial migration skipped or already done:', err);
  }
}

// -------------------------------------------------------------
// ARXIV / CHIQINDILAR QUTISI (TRASH) - 1 HAFTA SAQLANADIGAN MA'LUMOTLAR
// -------------------------------------------------------------
export async function saveTrashToFirestore(trashItem) {
  if (!trashItem || !trashItem.id) return;
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('trash', trashItem.id, trashItem, false));
  }
  if (shouldWriteToFirestore()) {
    const path = `trash/${trashItem.id}`;
    tasks.push(
      setDoc(doc(db, 'trash', trashItem.id), trashItem).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}

export async function deleteTrashFromFirestore(trashId) {
  if (!trashId) return;
  const tasks = [deleteDocFromRailway('trash', trashId)];
  if (shouldWriteToFirestore()) {
    const path = `trash/${trashId}`;
    tasks.push(
      deleteDoc(doc(db, 'trash', trashId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, path);
      })
    );
  }
  await Promise.all(tasks);
}

export async function fetchTrashFromFirestore() {
  const path = 'trash';
  await fetchRailwayState().catch(() => null);
  try {
    const snap = await getDocs(collection(db, 'trash'));
    const items = [];
    snap.forEach((d) => {
      items.push({ id: d.id, ...d.data() });
    });
    return mergeCollectionWithRailway('trash', items);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return mergeCollectionWithRailway('trash', []);
  }
}

// -------------------------------------------------------------
// SMENALAR (SHIFTS) - 1-SMENA, 2-SMENA VA SINFLAR
// -------------------------------------------------------------
export async function saveShiftToFirestore(shift) {
  if (!shift || !shift.id) return;
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('shifts', shift.id, shift, true));
  }
  if (shouldWriteToFirestore()) {
    const path = `shifts/${shift.id}`;
    tasks.push(
      setDoc(doc(db, 'shifts', shift.id), shift, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}

export async function deleteShiftFromFirestore(shiftId) {
  if (!shiftId) return;
  const tasks = [deleteDocFromRailway('shifts', shiftId)];
  if (shouldWriteToFirestore()) {
    const path = `shifts/${shiftId}`;
    tasks.push(
      deleteDoc(doc(db, 'shifts', shiftId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, path);
      })
    );
  }
  await Promise.all(tasks);
}

// -------------------------------------------------------------
// NAVBATCHILIK JADVALI (DUTY ROSTER)
// -------------------------------------------------------------
export async function saveDutyRosterToFirestore(roster) {
  if (!roster || !roster.id) return;
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('duty_rosters', roster.id, roster, true));
  }
  if (shouldWriteToFirestore()) {
    const path = `duty_rosters/${roster.id}`;
    tasks.push(
      setDoc(doc(db, 'duty_rosters', roster.id), roster, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}

export async function deleteDutyRosterFromFirestore(rosterId) {
  if (!rosterId) return;
  const tasks = [deleteDocFromRailway('duty_rosters', rosterId)];
  if (shouldWriteToFirestore()) {
    const path = `duty_rosters/${rosterId}`;
    tasks.push(
      deleteDoc(doc(db, 'duty_rosters', rosterId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, path);
      })
    );
  }
  await Promise.all(tasks);
}

// -------------------------------------------------------------
// KUNLIK DAVOMAT QAYDLARI (ATTENDANCE RECORDS)
// -------------------------------------------------------------
export async function saveAttendanceRecordToFirestore(record) {
  if (!record || !record.id) return;
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('attendance_records', record.id, record, true));
  }
  if (shouldWriteToFirestore()) {
    const path = `attendance_records/${record.id}`;
    tasks.push(
      setDoc(doc(db, 'attendance_records', record.id), record, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}

export async function deleteAttendanceRecordFromFirestore(recordId) {
  if (!recordId) return;
  const tasks = [deleteDocFromRailway('attendance_records', recordId)];
  if (shouldWriteToFirestore()) {
    const path = `attendance_records/${recordId}`;
    tasks.push(
      deleteDoc(doc(db, 'attendance_records', recordId)).catch(error => {
        handleFirestoreError(error, OperationType.DELETE, path);
      })
    );
  }
  await Promise.all(tasks);
}

// -------------------------------------------------------------
// NAVBATCHILIK KELOLMASLIK SABABLARI (DUTY ABSENCES)
// -------------------------------------------------------------
export async function saveDutyAbsenceToFirestore(absence) {
  if (!absence || !absence.id) return;
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('duty_absences', absence.id, absence, true));
  }
  if (shouldWriteToFirestore()) {
    const path = `duty_absences/${absence.id}`;
    tasks.push(
      setDoc(doc(db, 'duty_absences', absence.id), absence, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}

// -------------------------------------------------------------
// ADMIN XABARNOMALARI (ADMIN NOTIFICATIONS)
// -------------------------------------------------------------
export async function saveAdminNotificationToFirestore(notification) {
  if (!notification || !notification.id) return;
  const tasks = [];
  if (shouldWriteToRailway()) {
    tasks.push(saveDocToRailway('admin_notifications', notification.id, notification, true));
  }
  if (shouldWriteToFirestore()) {
    const path = `admin_notifications/${notification.id}`;
    tasks.push(
      setDoc(doc(db, 'admin_notifications', notification.id), notification, { merge: true }).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, path);
      })
    );
  }
  await Promise.all(tasks);
}
