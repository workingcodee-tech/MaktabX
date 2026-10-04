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
  getDocFromServer,
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

// Required error handler conforming to skill specification
export function handleFirestoreError(error, operationType, path) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isPermissionDenied = errMsg.includes('insufficient permissions') || 
                             errMsg.includes('Missing or insufficient') || 
                             error?.code === 'permission-denied';

  if (!isPermissionDenied) {
    if (error?.code === 'unavailable' || errMsg.includes('offline') || errMsg.includes('Could not reach Cloud Firestore')) {
      // Offline/cached mode - Firestore will seamlessly sync once connectivity is restored
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
    const mainDoc = await withTimeout(getDoc(doc(db, 'system', 'main')), 3000);
    if (mainDoc && mainDoc.exists()) {
      console.log('Firebase Firestore connection verified successfully.');
    } else {
      console.log('Firebase Firestore connected, database ready.');
    }
    return true;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('offline') || error?.code === 'unavailable' || errMsg.includes('timeout')) {
      console.log('Firestore is currently operating in offline/cached mode.');
    } else {
      console.warn('Firebase connection notice:', errMsg);
    }
    return false;
  }
}

// Fetch all database state in one call with timeout fallback and retry
export async function fetchAllData(timeoutMs = 12000, retries = 2) {
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

      // Kamida bitta to'plamdan ma'lumot qaytganligini tekshirish
      const hasAnySnapshot = schoolsSnap || classesSnap || studentsSnap || attendanceSnap || systemDoc;
      if (!hasAnySnapshot && attempt < retries) {
        console.warn(`Firestore to'plamlari dastlabki urinishda bo'sh qaytdi, qayta urinilmoqda (${attempt}/${retries})...`);
        await new Promise(r => setTimeout(r, 600));
        continue;
      }

      const schools = schoolsSnap && schoolsSnap.docs ? schoolsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const classes = classesSnap && classesSnap.docs ? classesSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const students = studentsSnap && studentsSnap.docs ? studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const recoveryRequests = requestsSnap && requestsSnap.docs ? requestsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const shifts = shiftsSnap && shiftsSnap.docs ? shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const dutyRosters = rostersSnap && rostersSnap.docs ? rostersSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const attendanceRecords = attendanceSnap && attendanceSnap.docs ? attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const dutyAbsences = absencesSnap && absencesSnap.docs ? absencesSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const adminNotifications = notificationsSnap && notificationsSnap.docs ? notificationsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      
      let developer = null;
      let siteInfo = null;
      if (systemDoc && typeof systemDoc.exists === 'function' && systemDoc.exists()) {
        const data = systemDoc.data();
        developer = data?.developer || null;
        siteInfo = data?.siteInfo || null;
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
  return null;
}

// Real-time synchronization listeners across devices
export function subscribeToDatabase(callbacks) {
  const unsubscribers = [];

  // Schools listener
  const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
    const schools = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (callbacks.onSchoolsUpdate) callbacks.onSchoolsUpdate(schools);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'schools');
  });
  unsubscribers.push(unsubSchools);

  // Classes listener
  const unsubClasses = onSnapshot(collection(db, 'classes'), (snapshot) => {
    const classes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (callbacks.onClassesUpdate) callbacks.onClassesUpdate(classes);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'classes');
  });
  unsubscribers.push(unsubClasses);

  // Students listener
  const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
    const students = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (callbacks.onStudentsUpdate) callbacks.onStudentsUpdate(students);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'students');
  });
  unsubscribers.push(unsubStudents);

  // Recovery Requests listener
  const unsubRequests = onSnapshot(collection(db, 'recoveryRequests'), (snapshot) => {
    const requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (callbacks.onRecoveryRequestsUpdate) callbacks.onRecoveryRequestsUpdate(requests);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'recoveryRequests');
  });
  unsubscribers.push(unsubRequests);

  // Shifts listener
  const unsubShifts = onSnapshot(collection(db, 'shifts'), (snapshot) => {
    const shifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (callbacks.onShiftsUpdate) callbacks.onShiftsUpdate(shifts);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'shifts');
  });
  unsubscribers.push(unsubShifts);

  // Duty Rosters listener
  const unsubRosters = onSnapshot(collection(db, 'duty_rosters'), (snapshot) => {
    const rosters = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (callbacks.onDutyRostersUpdate) callbacks.onDutyRostersUpdate(rosters);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'duty_rosters');
  });
  unsubscribers.push(unsubRosters);

  // Attendance Records listener
  const unsubAttendance = onSnapshot(collection(db, 'attendance_records'), (snapshot) => {
    const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (callbacks.onAttendanceRecordsUpdate) callbacks.onAttendanceRecordsUpdate(records);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'attendance_records');
  });
  unsubscribers.push(unsubAttendance);

  // Duty Absences listener
  const unsubAbsences = onSnapshot(collection(db, 'duty_absences'), (snapshot) => {
    const absences = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (callbacks.onDutyAbsencesUpdate) callbacks.onDutyAbsencesUpdate(absences);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'duty_absences');
  });
  unsubscribers.push(unsubAbsences);

  // Admin Notifications listener
  const unsubNotifications = onSnapshot(collection(db, 'admin_notifications'), (snapshot) => {
    const notifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (callbacks.onAdminNotificationsUpdate) callbacks.onAdminNotificationsUpdate(notifications);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'admin_notifications');
  });
  unsubscribers.push(unsubNotifications);

  // System/Developer config listener
  const unsubSystem = onSnapshot(doc(db, 'system', 'main'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (callbacks.onSystemUpdate) callbacks.onSystemUpdate(data);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'system/main');
  });
  unsubscribers.push(unsubSystem);

  return () => {
    unsubscribers.forEach(unsub => {
      try { unsub(); } catch (_) {}
    });
  };
}

// School operations
export async function saveSchoolToFirestore(school) {
  const path = `schools/${school.id}`;
  try {
    await setDoc(doc(db, 'schools', school.id), school, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSchoolFromFirestore(schoolId) {
  const path = `schools/${schoolId}`;
  try {
    await deleteDoc(doc(db, 'schools', schoolId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Class operations
export async function saveClassToFirestore(classItem) {
  const path = `classes/${classItem.id}`;
  try {
    await setDoc(doc(db, 'classes', classItem.id), classItem, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteClassFromFirestore(classId) {
  const path = `classes/${classId}`;
  try {
    await deleteDoc(doc(db, 'classes', classId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Student operations
export async function saveStudentToFirestore(student) {
  const path = `students/${student.id}`;
  try {
    const studentToSave = { ...student };
    if ('photo' in studentToSave) {
      studentToSave.photo = '';
    }
    await setDoc(doc(db, 'students', student.id), studentToSave, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
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
  const path = `students/${studentId}`;
  try {
    await deleteDoc(doc(db, 'students', studentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Recovery Requests operations
export async function saveRecoveryRequestToFirestore(request) {
  const path = `recoveryRequests/${request.id}`;
  try {
    await setDoc(doc(db, 'recoveryRequests', request.id), request, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateRecoveryRequestStatusInFirestore(requestId, status) {
  const path = `recoveryRequests/${requestId}`;
  try {
    await setDoc(doc(db, 'recoveryRequests', requestId), { status, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRecoveryRequestFromFirestore(requestId) {
  const path = `recoveryRequests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'recoveryRequests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToSingleRecoveryRequest(requestId, onUpdate) {
  const unsub = onSnapshot(doc(db, 'recoveryRequests', requestId), (docSnap) => {
    if (docSnap.exists()) {
      onUpdate({ id: docSnap.id, ...docSnap.data() });
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, `recoveryRequests/${requestId}`);
  });
  return unsub;
}

// System / Developer credentials save
export async function saveSystemConfigToFirestore(config) {
  const path = 'system/main';
  try {
    await setDoc(doc(db, 'system', 'main'), config, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Migrate local data into Firestore if Firestore is currently empty
export async function syncLocalDataToFirestoreIfEmpty(initialData) {
  try {
    const sysDoc = await getDoc(doc(db, 'system', 'main'));
    if (!sysDoc.exists()) {
      console.log('Firestore is uninitialized. Uploading initial system data...');
      await setDoc(doc(db, 'system', 'main'), {
        developer: initialData.developer,
        siteInfo: initialData.siteInfo || null,
        initializedAt: new Date().toISOString()
      });

      // If there are existing local schools, migrate them in batch
      if (initialData.schools && initialData.schools.length > 0) {
        const batch = writeBatch(db);
        initialData.schools.forEach(s => {
          batch.set(doc(db, 'schools', s.id), s);
        });
        await batch.commit();
      }

      // Classes
      if (initialData.classes && initialData.classes.length > 0) {
        const batch = writeBatch(db);
        initialData.classes.forEach(c => {
          batch.set(doc(db, 'classes', c.id), c);
        });
        await batch.commit();
      }

      // Students
      if (initialData.students && initialData.students.length > 0) {
        const batch = writeBatch(db);
        initialData.students.forEach(st => {
          batch.set(doc(db, 'students', st.id), st);
        });
        await batch.commit();
      }
      console.log('Initial data migrated to Firestore successfully.');
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
  const path = `trash/${trashItem.id}`;
  try {
    await setDoc(doc(db, 'trash', trashItem.id), trashItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTrashFromFirestore(trashId) {
  if (!trashId) return;
  const path = `trash/${trashId}`;
  try {
    await deleteDoc(doc(db, 'trash', trashId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchTrashFromFirestore() {
  const path = 'trash';
  try {
    const snap = await getDocs(collection(db, 'trash'));
    const items = [];
    snap.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// -------------------------------------------------------------
// SMENALAR (SHIFTS) - 1-SMENA, 2-SMENA VA SINFLAR
// -------------------------------------------------------------
export async function saveShiftToFirestore(shift) {
  if (!shift || !shift.id) return;
  const path = `shifts/${shift.id}`;
  try {
    await setDoc(doc(db, 'shifts', shift.id), shift, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteShiftFromFirestore(shiftId) {
  if (!shiftId) return;
  const path = `shifts/${shiftId}`;
  try {
    await deleteDoc(doc(db, 'shifts', shiftId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// -------------------------------------------------------------
// NAVBATCHILIK JADVALI (DUTY ROSTER)
// -------------------------------------------------------------
export async function saveDutyRosterToFirestore(roster) {
  if (!roster || !roster.id) return;
  const path = `duty_rosters/${roster.id}`;
  try {
    await setDoc(doc(db, 'duty_rosters', roster.id), roster, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDutyRosterFromFirestore(rosterId) {
  if (!rosterId) return;
  const path = `duty_rosters/${rosterId}`;
  try {
    await deleteDoc(doc(db, 'duty_rosters', rosterId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// -------------------------------------------------------------
// KUNLIK DAVOMAT QAYDLARI (ATTENDANCE RECORDS)
// -------------------------------------------------------------
export async function saveAttendanceRecordToFirestore(record) {
  if (!record || !record.id) return;
  const path = `attendance_records/${record.id}`;
  try {
    await setDoc(doc(db, 'attendance_records', record.id), record, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAttendanceRecordFromFirestore(recordId) {
  if (!recordId) return;
  const path = `attendance_records/${recordId}`;
  try {
    await deleteDoc(doc(db, 'attendance_records', recordId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// -------------------------------------------------------------
// NAVBATCHILIK KELOLMASLIK SABABLARI (DUTY ABSENCES)
// -------------------------------------------------------------
export async function saveDutyAbsenceToFirestore(absence) {
  if (!absence || !absence.id) return;
  const path = `duty_absences/${absence.id}`;
  try {
    await setDoc(doc(db, 'duty_absences', absence.id), absence, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// -------------------------------------------------------------
// ADMIN XABARNOMALARI (ADMIN NOTIFICATIONS)
// -------------------------------------------------------------
export async function saveAdminNotificationToFirestore(notification) {
  if (!notification || !notification.id) return;
  const path = `admin_notifications/${notification.id}`;
  try {
    await setDoc(doc(db, 'admin_notifications', notification.id), notification, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}



