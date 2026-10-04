/**
 * Export Utilities for Maktab O'quvchilar Boshqaruvi
 * Supports Excel (.xlsx) and PDF (.pdf) generation
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { closeModalWithAnimation } from './modalAnimation.js';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  PageOrientation
} from 'docx';

// Sana formatlash yordamchisi
function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

// O'zbek ism-familiyalariga xos qizlar ismlari ro'yxati (Set orqali tezkor qidiruv)
const COMMON_FEMALE_FIRST_NAMES = new Set([
  'madina', 'zilola', 'dilnoza', 'malika', 'fotima', 'fatima', 'zuhra', 'zuhro',
  'shahnoza', 'shaxnoza', 'nargiza', 'dilorom', 'guli', 'gulnoza', 'munisa',
  'feruza', 'rayhon', 'kamola', 'aziza', 'sabina', 'diyora', 'zarina', 'laylo',
  'sevara', 'shahzoda', 'shaxzoda', 'mohira', 'moxira', 'nodira', 'robiya',
  'muslima', 'oysha', 'asal', 'sarvinoz', 'gulchehra', 'nafisa', 'nozima',
  'marjona', 'barno', 'parizoda', 'ruxshona', 'ruhshona', 'shohida', 'shoxida',
  'mubina', 'hadicha', 'xadicha', 'maftuna', 'kumush', 'nilufar', 'umida',
  'farangiz', 'charos', 'sitora', 'lobar', 'jasmina', 'samira', 'gulsanam',
  'gulandom', 'dilfuza', 'gulbahor', 'saida', 'surayyo', 'gulrux', 'shoira',
  'mahliyo', 'oydin', 'yulduz', 'xonzoda', 'shirin', 'gozal', "go'zal", 'guzal',
  'dinora', 'dilafruz', 'dildora', 'gulmira', 'shohsanam', 'muazzam', 'mohichehra',
  'guldasta', 'anora', 'gulhayo', 'mushtariy', 'mohina', 'durdona', 'kamila',
  'amina', 'nodirabegim', 'asalxon', 'jasmin', 'layla', 'amira', 'robiyaxon',
  'parvina', 'dilrabo', 'mohlaroyim', 'roziya', 'munavvar', 'gulshoda', 'marhabo',
  'matluba', 'muxlisa', 'muxabbat', 'muhabbat', 'oqila', 'gulira', 'soliha',
  'bibisora', 'barchin', 'shaxrizoda', 'shahrizoda', 'gulbahor', 'yulduzxon'
]);

// O'g'il bolalar ismlariga xos ro'yxat
const COMMON_MALE_FIRST_NAMES = new Set([
  'ali', 'vali', 'jasur', 'sardor', 'bekzod', 'bobur', 'dilshod', 'javohir',
  'sanjar', 'farrux', 'temur', 'amir', 'rustam', 'otabek', 'ulugbek', "ulug'bek",
  'sherzod', 'akmal', 'aziz', 'shohruh', 'shoxrux', 'davron', 'jamshid', 'islom',
  'alisher', 'mirzo', 'bunyod', 'doniyor', 'diyor', 'diyorbek', 'muhriddin',
  'shahboz', 'shaxboz', 'asadbek', 'jahongir', 'jaxongir', 'bilol', 'ibrohim',
  'muhammad', 'umar', 'usmon', 'abubakr', 'mustafo', 'shahrom', 'eldor',
  'shohjahon', 'shoxjaxon', 'shukur', 'nodir', 'bahrom', 'anvar', 'abror',
  'botir', 'laziz', 'farhod', 'ilhom', 'tohir', 'zokir', 'abbos', 'humoyun',
  'ravshan', 'mansur', 'mirabbos', 'sunnat', 'sobir', 'oybek', 'sherali',
  'umid', 'bekmirza', 'abbosbek', 'asror', 'mirjalol', 'islombek', 'nodirbek'
]);

/**
 * Ism, familiya va otasining ismidan o'quvchi jinsini avtomatik aniqlash (Qiz yoki O'g'il)
 */
export function detectGenderFromName(nameStr = '') {
  if (!nameStr) return null;
  const raw = String(nameStr).toLowerCase().replace(/['`ʻ’]/g, "'").trim();
  if (!raw) return null;

  // 1. Otasining ismi / Patronymic tekshirish (eng kuchli va rasmiy signal)
  // Masalan: "Rustam qizi", "Anvar qizi", "Alisherovna" -> 100% Qiz
  if (/\b\w+[\s-]qizi\b/i.test(raw) || /\bqizi\b/i.test(raw) || /\b\w+ovna\b/i.test(raw) || /\b\w+yevna\b/i.test(raw)) {
    return 'Qiz';
  }
  // Masalan: "Rustam o'g'li", "Anvar o'g'li", "Alisherovich" -> 100% O'g'il
  if (/\b\w+[\s-](?:o'g'li|o'gli|og'li|ogli|ugli)\b/i.test(raw) || /\b(?:o'g'li|o'gli|og'li|ugli)\b/i.test(raw) || /\b\w+ovich\b/i.test(raw) || /\b\w+yevich\b/i.test(raw)) {
    return "O'g'il";
  }

  // 2. Familiya qo'shimchasi: O'zbekistonda -ova, -eva, -yeva faqat qizlar/ayollarda bo'ladi!
  const words = raw.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (/(?:ova|eva|yeva)$/i.test(w) && w.length >= 4) {
      return 'Qiz';
    }
  }

  // 3. Ism qo'shimchalari: -xon, -bonu, -begim, -niso, -bibi
  for (const w of words) {
    if (/(?:xon|bonu|begim|niso|bibi)$/i.test(w) && w.length >= 4) {
      return 'Qiz';
    }
    if (/(?:oy)$/i.test(w) && w.length >= 4 && !/(?:boy|qoy)$/i.test(w)) {
      return 'Qiz';
    }
    const cleanWord = w.replace(/[^a-z]/g, '');
    if (COMMON_FEMALE_FIRST_NAMES.has(cleanWord)) {
      return 'Qiz';
    }
    if (COMMON_MALE_FIRST_NAMES.has(cleanWord)) {
      return "O'g'il";
    }
  }

  // 4. Erkakcha familiya va qo'shimchalar: -ov, -ev, -yev, -bek, -jon, -boy
  for (const w of words) {
    if (/(?:ov|ev|yev)$/i.test(w) && w.length >= 4) {
      return "O'g'il";
    }
    if (/(?:bek|jon|boy|mirza)$/i.test(w) && w.length >= 4) {
      return "O'g'il";
    }
  }

  return null;
}

// O'quvchi jinsini aniq, to'g'ri va ishonchli tekshirish yordamchisi (Qiz yoki O'g'il)
export function isFemaleStudent(studentOrGender, fallbackStudent = null) {
  if (!studentOrGender && !fallbackStudent) return false;

  let genderStr = '';
  let studentObj = null;

  if (typeof studentOrGender === 'object' && studentOrGender !== null) {
    studentObj = studentOrGender;
    genderStr = studentObj.gender || '';
  } else if (typeof studentOrGender === 'string') {
    genderStr = studentOrGender;
    if (typeof fallbackStudent === 'object' && fallbackStudent !== null) {
      studentObj = fallbackStudent;
    }
  }

  // 1. Agar student obyekti mavjud bo'lsa, avvalo uning to'liq ism-sharifini tekshiramiz.
  // Chunki yangi o'quvchi qo'shilganda forma sukut bo'yicha "O'g'il" deb saqlab yuborishi mumkin!
  if (studentObj) {
    const nameToTest = [
      studentObj.fullName,
      studentObj.middleName,
      studentObj.lastName,
      studentObj.firstName
    ].filter(Boolean).join(' ');

    const detectedFromName = detectGenderFromName(nameToTest);
    if (detectedFromName === 'Qiz') return true;
    if (detectedFromName === "O'g'il" && (!genderStr || genderStr === "O'g'il")) return false;
  }

  // 2. Gender matnini to'g'ridan-to'g'ri tekshirish
  const g = String(genderStr).toLowerCase().trim();
  if (g.includes('qiz') || g.includes('fem') || g === 'f' || g.includes('ayol')) {
    return true;
  }
  if (g.includes("o'g'il") || g.includes("o‘g‘il") || g.includes('ogil') || g.includes('erkak') || g.includes('male') || g === 'm') {
    return false;
  }

  // 3. Fallback: agar genderStr o'rniga ism berilgan bo'lsa
  const fallbackDetected = detectGenderFromName(g);
  if (fallbackDetected === 'Qiz') return true;

  return false;
}

export function formatStudentGender(studentOrGender, full = false, fallbackStudent = null) {
  const isFemale = isFemaleStudent(studentOrGender, fallbackStudent);
  if (full) {
    return isFemale ? "Qiz bola" : "O'g'il bola";
  }
  return isFemale ? "Qiz" : "O'g'il";
}

export function getStudentGenderSafe(student) {
  return isFemaleStudent(student) ? "Qiz" : "O'g'il";
}

/**
 * Word (.docx) hujjatini yuklab olish yordamchisi
 */
async function downloadDocxDocument(doc, fileName) {
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * 1. O'QUVCHILAR RO'YXATINI EXCEL (.XLSX) GA EKSPORT QILISH
 */
export function exportStudentListToExcel(studentsList, className = 'Sinf', schoolName = 'Maktab') {
  if (!studentsList || studentsList.length === 0) {
    throw new Error("Eksport qilish uchun o'quvchilar mavjud emas");
  }

  const rows = studentsList.map((s, idx) => ({
    "№": idx + 1,
    "Familyasi": s.lastName || '',
    "Ismi": s.firstName || '',
    "Otasining ismi": s.middleName || '',
    "To'liq F.I.SH": s.fullName || '',
    "Jinsi": formatStudentGender(s, false),
    "Tug'ilgan sana": formatDate(s.birthDate),
    "Yoshi": s.age || '',
    "Telefon raqami": s.phone || '',
    "Email": s.email || '',
    "Tug'ilgan joyi": s.birthPlace || '',
    "FHDYO bo'limi": s.fhdyoOrgan || '',
    "Dalolatnoma raqami": s.dalolatnomaNumber || '',
    "Guvohnoma seriya/raqami": s.guvohnomaSeriaNumber || '',
    "Pasport / ID raqami": s.passportNumber || '',
    "PINFL (JSHSHIR)": s.pinfl ? `'${s.pinfl}` : '',
    "Onasi F.I.SH": s.motherFullName || '',
    "Onasi pasporti": s.motherPassport || '',
    "Onasi JSHSHIR": s.motherPinfl ? `'${s.motherPinfl}` : '',
    "Onasi telefoni": s.motherPhone || '',
    "Onasi emaili": s.motherEmail || '',
    "Onasi tug'ilgan sana": formatDate(s.motherBirthDate),
    "Onasi yoshi": s.motherAge || '',
    "Onasi ish joyi": s.motherJob || '',
    "Otasi F.I.SH": s.fatherFullName || '',
    "Otasi pasporti": s.fatherPassport || '',
    "Otasi JSHSHIR": s.fatherPinfl ? `'${s.fatherPinfl}` : '',
    "Otasi telefoni": s.fatherPhone || '',
    "Otasi emaili": s.fatherEmail || '',
    "Otasi tug'ilgan sana": formatDate(s.fatherBirthDate),
    "Otasi yoshi": s.fatherAge || '',
    "Otasi ish joyi": s.fatherJob || '',
    "Yashash manzili": s.address || '',
    "Qo'shimcha darslar (To'garaklar)": Array.isArray(s.extraCourses) && s.extraCourses.length > 0
      ? s.extraCourses.map(c => {
          const p = [c.courseName || 'Dars'];
          if (c.teacherName) p.push(`O'qituvchi: ${c.teacherName}`);
          if (c.teacherPhone) p.push(`Tel: ${c.teacherPhone}`);
          if (c.centerName) p.push(`Markaz: ${c.centerName}`);
          if (c.centerAddress) p.push(`Manzil: ${c.centerAddress}`);
          return p.join(', ');
        }).join('; ')
      : ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ustun kengliklarini avtomatik moslash
  const colWidths = [
    { wch: 5 },   // №
    { wch: 16 },  // Familyasi
    { wch: 16 },  // Ismi
    { wch: 18 },  // Otasining ismi
    { wch: 28 },  // To'liq F.I.SH
    { wch: 8 },   // Jinsi
    { wch: 14 },  // Tug'ilgan sana
    { wch: 7 },   // Yoshi
    { wch: 18 },  // Telefon
    { wch: 22 },  // Tug'ilgan joyi
    { wch: 24 },  // FHDYO
    { wch: 16 },  // Dalolatnoma
    { wch: 20 },  // Guvohnoma
    { wch: 16 },  // Pasport
    { wch: 18 },  // PINFL
    { wch: 26 },  // Onasi F.I.SH
    { wch: 18 },  // Onasi tel
    { wch: 14 },  // Onasi tug'ilgan
    { wch: 8 },   // Onasi yoshi
    { wch: 24 },  // Onasi ish joyi
    { wch: 26 },  // Otasi F.I.SH
    { wch: 18 },  // Otasi tel
    { wch: 14 },  // Otasi tug'ilgan
    { wch: 8 },   // Otasi yoshi
    { wch: 24 },  // Otasi ish joyi
    { wch: 35 }   // Yashash manzili
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${className} o'quvchilari`);

  const cleanClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${cleanClassName}_oquvchilar_royxati_${dateStr}.xlsx`);
}

/**
 * 2. O'QUVCHILAR RO'YXATINI PDF (.PDF) GA EKSPORT QILISH
 */
export function exportStudentListToPDF(studentsList, className = 'Sinf', schoolName = 'Maktab', teacherName = '') {
  if (!studentsList || studentsList.length === 0) {
    throw new Error("Eksport qilish uchun o'quvchilar mavjud emas");
  }

  // A4 Landscape format (jadval keng bo'lgani uchun qulay)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Rasmiy sarlavha qismi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`${schoolName.toUpperCase()}`, 14, 15);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text(`${className} sinf o'quvchilari ro'yxati`, 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  const dateFormatted = new Date().toLocaleDateString('uz-UZ');
  doc.text(`Sinf rahbari: ${teacherName || "Ko'rsatilmagan"}  |  Jami o'quvchilar: ${studentsList.length} nafar  |  Sana: ${dateFormatted}`, 14, 28);

  // Jadval ustunlari va qatorlari
  const tableHeaders = [
    ["T/r", "F.I.SH", "Jinsi", "Tug'ilgan sana", "Telefon", "PINFL", "Ota-onasi telefoni", "Yashash manzili"]
  ];

  const tableData = studentsList.map((s, idx) => {
    const parentPhone = s.motherPhone || s.fatherPhone || "-";
    const genderText = formatStudentGender(s, false);
    return [
      idx + 1,
      s.fullName || `${s.lastName || ''} ${s.firstName || ''}`,
      genderText,
      formatDate(s.birthDate),
      s.phone || "-",
      s.pinfl || "-",
      parentPhone,
      s.address || "-"
    ];
  });

  autoTable(doc, {
    head: tableHeaders,
    body: tableData,
    startY: 32,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [30, 64, 175], // primary blue #1E40AF
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 55 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 24 },
      4: { cellWidth: 28 },
      5: { cellWidth: 32 },
      6: { cellWidth: 32 },
      7: { cellWidth: 'auto' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50
    },
    margin: { left: 14, right: 14 }
  });

  // Imzo bloki (eng pastda)
  const finalY = (doc).lastAutoTable?.finalY || 150;
  if (finalY < 185) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Sinf rahbari: ____________________ / ${teacherName || "Sinf rahbari"} /`, 14, finalY + 14);
    doc.text(`Maktab ma'muriyati: ____________________`, 190, finalY + 14);
  }

  const cleanClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`${cleanClassName}_oquvchilar_royxati_${dateStr}.pdf`);
}

/**
 * 3. ALOHIDA O'QUVCHINING TO'LIQ DOSYESINI PDF (.PDF) GA EKSPORT QILISH
 */
export function exportSingleStudentToPDF(student, school = null, studentClass = null) {
  if (!student) {
    throw new Error("O'quvchi ma'lumoti topilmadi");
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const schoolName = school?.name || "UMUMTA'LIM MAKTABI";
  const className = studentClass?.name || student?.className || "Sinf";
  const teacherName = studentClass?.teacherName || "";

  // 1. Rasmiy blanka sarlavhasi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(schoolName.toUpperCase(), 105, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(30, 64, 175); // Blue
  doc.text("O'QUVCHINING SHAXSIY RO'YXATGA OLISH VARAQASI (DOSYE)", 105, 23, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Sinf: ${className}  |  Sinf rahbari: ${teacherName || "Mavjud emas"}  |  Sana: ${new Date().toLocaleDateString('uz-UZ')}`, 105, 29, { align: 'center' });

  // Ajratuvchi chiziq
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);

  // 2. ASOSIY MA'LUMOTLAR JADVALI
  const basicInfo = [
    ["To'liq F.I.SH:", student.fullName || `${student.lastName || ''} ${student.firstName || ''} ${student.middleName || ''}`],
    ["Familyasi:", student.lastName || "-"],
    ["Ismi:", student.firstName || "-"],
    ["Otasining ismi:", student.middleName || "-"],
    ["Jinsi:", formatStudentGender(student, true)],
    ["Tug'ilgan sanasi:", formatDate(student.birthDate)],
    ["Yoshi:", student.age ? `${student.age} yosh` : "-"],
    ["Telefon raqami:", student.phone || "-"],
    ["Email:", student.email || "-"],
    ["Tug'ilgan joyi:", student.birthPlace || "-"],
    ["Yashash manzili:", student.address || "-"]
  ];

  autoTable(doc, {
    startY: 36,
    head: [["№", "1. O'quvchining shaxsiy ko'rsatkichlari", "Ma'lumot"]],
    body: basicInfo.map((row, i) => [i + 1, row[0], row[1]]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, lineColor: [226, 232, 240] },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 55, textColor: [51, 65, 85] },
      2: { cellWidth: 'auto', textColor: [15, 23, 42] }
    },
    margin: { left: 14, right: 14 }
  });

  // 3. HUJJATLAR JADVALI
  const docY = (doc).lastAutoTable?.finalY || 100;
  const docInfo = [
    ["FHDYO bo'limi:", student.fhdyoOrgan || "-"],
    ["Dalolatnoma raqami:", student.dalolatnomaNumber || "-"],
    ["Tug'ilganlik guvohnomasi:", student.guvohnomaSeriaNumber || "-"],
    ["Pasport / ID karta:", student.passportNumber || "-"],
    ["PINFL (JSHSHIR):", student.pinfl || "-"]
  ];

  autoTable(doc, {
    startY: docY + 5,
    head: [["№", "2. Davlat hujjatlari va identifikatsiya", "Ma'lumot"]],
    body: docInfo.map((row, i) => [i + 1, row[0], row[1]]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, lineColor: [226, 232, 240] },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 55, textColor: [51, 65, 85] },
      2: { cellWidth: 'auto', textColor: [15, 23, 42] }
    },
    margin: { left: 14, right: 14 }
  });

  // 4. OTA-ONASI HAQIDA JADVAL
  const parentY = (doc).lastAutoTable?.finalY || 150;
  const parentInfo = [
    ["Onasi - F.I.SH:", student.motherFullName || "-"],
    ["Onasi - Pasport / ID:", student.motherPassport || "-"],
    ["Onasi - JSHSHIR (PINFL):", student.motherPinfl || "-"],
    ["Onasi - Telefoni:", student.motherPhone || "-"],
    ["Onasi - Email:", student.motherEmail || "-"],
    ["Onasi - Tug'ilgan sana va yoshi:", `${formatDate(student.motherBirthDate)} ${student.motherAge ? `(${student.motherAge} yosh)` : ''}`],
    ["Onasi - Ish joyi / Kasbi:", student.motherJob || "-"],
    ["Otasi - F.I.SH:", student.fatherFullName || "-"],
    ["Otasi - Pasport / ID:", student.fatherPassport || "-"],
    ["Otasi - JSHSHIR (PINFL):", student.fatherPinfl || "-"],
    ["Otasi - Telefoni:", student.fatherPhone || "-"],
    ["Otasi - Email:", student.fatherEmail || "-"],
    ["Otasi - Tug'ilgan sana va yoshi:", `${formatDate(student.fatherBirthDate)} ${student.fatherAge ? `(${student.fatherAge} yosh)` : ''}`],
    ["Otasi - Ish joyi / Kasbi:", student.fatherJob || "-"]
  ];

  autoTable(doc, {
    startY: parentY + 5,
    head: [["№", "3. Ota-onasi haqida ma'lumotlar", "Ma'lumot"]],
    body: parentInfo.map((row, i) => [i + 1, row[0], row[1]]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, lineColor: [226, 232, 240] },
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 55, textColor: [51, 65, 85] },
      2: { cellWidth: 'auto', textColor: [15, 23, 42] }
    },
    margin: { left: 14, right: 14 }
  });

  // 4b. QO'SHIMCHA DARSLAR JADVALI (AGAR MAVJUD BO'LSA)
  if (Array.isArray(student.extraCourses) && student.extraCourses.length > 0) {
    const courseY = (doc).lastAutoTable?.finalY || 180;
    const coursesBody = student.extraCourses.map((c, i) => [
      i + 1,
      c.courseName || "-",
      c.teacherName || "-",
      c.teacherPhone || "-",
      c.centerName || "-",
      c.centerAddress || "-"
    ]);

    autoTable(doc, {
      startY: courseY + 5,
      head: [["№", "Dars nomi", "O'qituvchi", "O'qituvchi tel", "O'quv markazi", "Markaz manzili"]],
      body: coursesBody,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2, lineColor: [226, 232, 240] },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { fontStyle: 'bold', cellWidth: 32 },
        2: { cellWidth: 32 },
        3: { cellWidth: 30 },
        4: { cellWidth: 35 },
        5: { cellWidth: 'auto' }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // 5. Pastki imzo maydoni
  const endY = (doc).lastAutoTable?.finalY || 240;
  if (endY < 265) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Sinf rahbari: ____________________ / ${teacherName || "Imzo"} /`, 14, endY + 12);
    doc.text(`Maktab direktori: ____________________`, 130, endY + 12);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Ushbu hujjat MaktabX tizimidan elektron tarzda shakllantirilgan va haqiqiy hisoblanadi.", 105, endY + 20, { align: 'center' });
  }

  const cleanName = (student.lastName || 'Oquvchi').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanName}_dosye_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * 4. ALOHIDA O'QUVCHI MA'LUMOTLARINI EXCEL (.XLSX) GA EKSPORT QILISH
 */
export function exportSingleStudentToExcel(student, school = null, studentClass = null) {
  if (!student) {
    throw new Error("O'quvchi ma'lumoti topilmadi");
  }

  const rows = [
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "Familyasi", "Qiymat": student.lastName || '' },
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "Ismi", "Qiymat": student.firstName || '' },
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "Otasining ismi", "Qiymat": student.middleName || '' },
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "To'liq F.I.SH", "Qiymat": student.fullName || '' },
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "Jinsi", "Qiymat": formatStudentGender(student, true) },
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "Tug'ilgan sana", "Qiymat": formatDate(student.birthDate) },
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "Yoshi", "Qiymat": student.age || '' },
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "Telefon", "Qiymat": student.phone || '' },
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "Email", "Qiymat": student.email || '' },
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "Tug'ilgan joyi", "Qiymat": student.birthPlace || '' },
    { "Bo'lim": "ASOSIY", "Ko'rsatkich": "Yashash manzili", "Qiymat": student.address || '' },
    
    { "Bo'lim": "HUJJATLAR", "Ko'rsatkich": "FHDYO bo'limi", "Qiymat": student.fhdyoOrgan || '' },
    { "Bo'lim": "HUJJATLAR", "Ko'rsatkich": "Dalolatnoma raqami", "Qiymat": student.dalolatnomaNumber || '' },
    { "Bo'lim": "HUJJATLAR", "Ko'rsatkich": "Tug'ilganlik guvohnomasi", "Qiymat": student.guvohnomaSeriaNumber || '' },
    { "Bo'lim": "HUJJATLAR", "Ko'rsatkich": "Pasport / ID karta", "Qiymat": student.passportNumber || '' },
    { "Bo'lim": "HUJJATLAR", "Ko'rsatkich": "PINFL (JSHSHIR)", "Qiymat": student.pinfl ? `'${student.pinfl}` : '' },

    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Onasi F.I.SH", "Qiymat": student.motherFullName || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Onasi pasport / ID", "Qiymat": student.motherPassport || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Onasi JSHSHIR", "Qiymat": student.motherPinfl ? `'${student.motherPinfl}` : '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Onasi telefoni", "Qiymat": student.motherPhone || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Onasi emaili", "Qiymat": student.motherEmail || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Onasi tug'ilgan sana", "Qiymat": formatDate(student.motherBirthDate) },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Onasi yoshi", "Qiymat": student.motherAge || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Onasi ish joyi", "Qiymat": student.motherJob || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Otasi F.I.SH", "Qiymat": student.fatherFullName || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Otasi pasport / ID", "Qiymat": student.fatherPassport || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Otasi JSHSHIR", "Qiymat": student.fatherPinfl ? `'${student.fatherPinfl}` : '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Otasi telefoni", "Qiymat": student.fatherPhone || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Otasi emaili", "Qiymat": student.fatherEmail || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Otasi tug'ilgan sana", "Qiymat": formatDate(student.fatherBirthDate) },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Otasi yoshi", "Qiymat": student.fatherAge || '' },
    { "Bo'lim": "OTA-ONASI", "Ko'rsatkich": "Otasi ish joyi", "Qiymat": student.fatherJob || '' },

    { "Bo'lim": "MAKTAB", "Ko'rsatkich": "Maktab", "Qiymat": school?.name || '' },
    { "Bo'lim": "MAKTAB", "Ko'rsatkich": "Sinf", "Qiymat": studentClass?.name || '' },
    { "Bo'lim": "MAKTAB", "Ko'rsatkich": "Sinf rahbari", "Qiymat": studentClass?.teacherName || '' }
  ];

  if (Array.isArray(student.extraCourses) && student.extraCourses.length > 0) {
    student.extraCourses.forEach((c, idx) => {
      rows.push(
        { "Bo'lim": "QO'SHIMCHA DARSLAR", "Ko'rsatkich": `${idx + 1}-dars nomi`, "Qiymat": c.courseName || '' },
        { "Bo'lim": "QO'SHIMCHA DARSLAR", "Ko'rsatkich": `${idx + 1}-dars o'qituvchi ismi`, "Qiymat": c.teacherName || '' },
        { "Bo'lim": "QO'SHIMCHA DARSLAR", "Ko'rsatkich": `${idx + 1}-dars o'qituvchi telefoni`, "Qiymat": c.teacherPhone || '' },
        { "Bo'lim": "QO'SHIMCHA DARSLAR", "Ko'rsatkich": `${idx + 1}-dars o'quv markazi`, "Qiymat": c.centerName || '' },
        { "Bo'lim": "QO'SHIMCHA DARSLAR", "Ko'rsatkich": `${idx + 1}-dars markaz manzili`, "Qiymat": c.centerAddress || '' }
      );
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 40 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "O'quvchi ma'lumotlari");

  const cleanName = (student.lastName || 'Oquvchi').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `${cleanName}_malumotlari_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 5. O'QUVCHILAR RO'YXATINI WORD (.DOCX) GA EKSPORT QILISH
 */
export async function exportStudentListToWord(studentsList, className = 'Sinf', schoolName = 'Maktab', teacherName = '') {
  if (!studentsList || studentsList.length === 0) {
    throw new Error("Eksport qilish uchun o'quvchilar mavjud emas");
  }

  const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  const tableBorders = {
    top: border, bottom: border, left: border, right: border,
    insideHorizontal: border, insideVertical: border
  };

  const headerBg = { fill: '1E40AF', type: ShadingType.CLEAR };
  const altBg = { fill: 'F8FAFC', type: ShadingType.CLEAR };
  const cellMargins = { top: 100, bottom: 100, left: 120, right: 120 };

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 5, type: WidthType.PERCENTAGE },
          shading: headerBg,
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: '№', bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.CENTER })]
        }),
        new TableCell({
          width: { size: 24, type: WidthType.PERCENTAGE },
          shading: headerBg,
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: "F.I.SH (To'liq)", bold: true, color: 'FFFFFF', size: 18 })] })]
        }),
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: headerBg,
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: 'Jinsi', bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.CENTER })]
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: headerBg,
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: "Tug'ilgan sana", bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.CENTER })]
        }),
        new TableCell({
          width: { size: 13, type: WidthType.PERCENTAGE },
          shading: headerBg,
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: 'Telefon', bold: true, color: 'FFFFFF', size: 18 })] })]
        }),
        new TableCell({
          width: { size: 14, type: WidthType.PERCENTAGE },
          shading: headerBg,
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: 'PINFL / Hujjat', bold: true, color: 'FFFFFF', size: 18 })] })]
        }),
        new TableCell({
          width: { size: 24, type: WidthType.PERCENTAGE },
          shading: headerBg,
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: 'Ota-onasi (F.I.SH va Tel)', bold: true, color: 'FFFFFF', size: 18 })] })]
        })
      ]
    })
  ];

  let boysCount = 0;
  let girlsCount = 0;

  studentsList.forEach((s, idx) => {
    if (isFemaleStudent(s)) girlsCount++;
    else boysCount++;

    const isEven = idx % 2 === 1;
    const rowShading = isEven ? altBg : undefined;

    const parentInfo = [];
    if (s.fatherFullName || s.fatherPhone) {
      parentInfo.push(`Otasi: ${s.fatherFullName || ''} ${s.fatherPhone ? `(${s.fatherPhone})` : ''}`.trim());
    }
    if (s.motherFullName || s.motherPhone) {
      parentInfo.push(`Onasi: ${s.motherFullName || ''} ${s.motherPhone ? `(${s.motherPhone})` : ''}`.trim());
    }
    const parentText = parentInfo.join('; ') || '-';

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            margins: cellMargins,
            shading: rowShading,
            children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 18 })], alignment: AlignmentType.CENTER })]
          }),
          new TableCell({
            margins: cellMargins,
            shading: rowShading,
            children: [new Paragraph({ children: [new TextRun({ text: s.fullName || `${s.lastName || ''} ${s.firstName || ''}`.trim() || '-', bold: true, size: 18, color: '0F172A' })] })]
          }),
          new TableCell({
            margins: cellMargins,
            shading: rowShading,
            children: [new Paragraph({ children: [new TextRun({ text: formatStudentGender(s, false), size: 18, color: '334155' })], alignment: AlignmentType.CENTER })]
          }),
          new TableCell({
            margins: cellMargins,
            shading: rowShading,
            children: [new Paragraph({ children: [new TextRun({ text: formatDate(s.birthDate), size: 18, color: '334155' })], alignment: AlignmentType.CENTER })]
          }),
          new TableCell({
            margins: cellMargins,
            shading: rowShading,
            children: [new Paragraph({ children: [new TextRun({ text: s.phone || '-', size: 18, color: '1E293B' })] })]
          }),
          new TableCell({
            margins: cellMargins,
            shading: rowShading,
            children: [new Paragraph({ children: [new TextRun({ text: s.pinfl || s.passportNumber || s.guvohnomaSeriaNumber || '-', size: 18, color: '475569' })] })]
          }),
          new TableCell({
            margins: cellMargins,
            shading: rowShading,
            children: [new Paragraph({ children: [new TextRun({ text: parentText, size: 17, color: '334155' })] })]
          })
        ]
      })
    );
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          orientation: PageOrientation.LANDSCAPE,
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: "O'ZBEKISTON RESPUBLIKASI MAKTABGACHA VA MAKTAB TA'LIMI VAZIRLIGI", size: 18, color: '64748B', bold: true })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: String(schoolName).toUpperCase(), bold: true, size: 26, color: '1E40AF' })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `${className} SINF O'QUVCHILARI RO'YXATI`, bold: true, size: 22, color: '0F172A' })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Sinf rahbari: `, bold: true, size: 18, color: '334155' }),
            new TextRun({ text: `${teacherName || "Mavjud emas"}   |   `, size: 18, color: '0F172A' }),
            new TextRun({ text: `Jami o'quvchilar: `, bold: true, size: 18, color: '334155' }),
            new TextRun({ text: `${studentsList.length} nafar (${boysCount} o'g'il, ${girlsCount} qiz)   |   `, size: 18, color: '0F172A' }),
            new TextRun({ text: `Sana: `, bold: true, size: 18, color: '334155' }),
            new TextRun({ text: `${new Date().toLocaleDateString('uz-UZ')}`, size: 18, color: '0F172A' })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: tableRows
        }),
        new Paragraph({
          spacing: { before: 300 },
          children: [
            new TextRun({ text: `Sinf rahbari: ____________________ / ${teacherName || "Imzo"} /                    Maktab direktori: ____________________`, size: 18, color: '475569' })
          ]
        })
      ]
    }]
  });

  const cleanClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  await downloadDocxDocument(doc, `${cleanClassName}_oquvchilar_royxati_${dateStr}.docx`);
}

/**
 * 6. ALOHIDA O'QUVCHINING TO'LIQ DOSYESINI WORD (.DOCX) GA EKSPORT QILISH
 */
export async function exportSingleStudentToWord(student, school = null, studentClass = null) {
  if (!student) {
    throw new Error("O'quvchi ma'lumoti topilmadi");
  }

  const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  const tableBorders = {
    top: border, bottom: border, left: border, right: border,
    insideHorizontal: border, insideVertical: border
  };

  const cellMargins = { top: 90, bottom: 90, left: 120, right: 120 };
  const labelBg = { fill: 'F1F5F9', type: ShadingType.CLEAR };

  const schoolName = school?.name || "UMUMTA'LIM MAKTABI";
  const className = studentClass?.name || student?.className || "Sinf";
  const teacherName = studentClass?.teacherName || "";

  // 1. Asosiy ma'lumotlar
  const basicInfo = [
    ["To'liq F.I.SH", student.fullName || `${student.lastName || ''} ${student.firstName || ''} ${student.middleName || ''}`.trim() || '-'],
    ["Familyasi", student.lastName || "-"],
    ["Ismi", student.firstName || "-"],
    ["Otasining ismi", student.middleName || "-"],
    ["Jinsi", formatStudentGender(student, true)],
    ["Tug'ilgan sanasi", formatDate(student.birthDate)],
    ["Yoshi", student.age ? `${student.age} yosh` : "-"],
    ["Telefon raqami", student.phone || "-"],
    ["Elektron pochta (Email)", student.email || "-"],
    ["Tug'ilgan joyi", student.birthPlace || "-"],
    ["Yashash manzili", student.address || "-"]
  ];

  const basicTableRows = basicInfo.map(([label, val]) => new TableRow({
    children: [
      new TableCell({
        width: { size: 36, type: WidthType.PERCENTAGE },
        margins: cellMargins,
        shading: labelBg,
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, color: '334155' })] })]
      }),
      new TableCell({
        width: { size: 64, type: WidthType.PERCENTAGE },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: val, size: 18, color: '0F172A' })] })]
      })
    ]
  }));

  // 2. Davlat hujjatlari
  const docInfo = [
    ["FHDYO bo'limi", student.fhdyoOrgan || "-"],
    ["Dalolatnoma raqami", student.dalolatnomaNumber || "-"],
    ["Tug'ilganlik haqida guvohnoma", student.guvohnomaSeriaNumber || "-"],
    ["Pasport / ID-karta", student.passportNumber || "-"],
    ["PINFL (JSHSHIR)", student.pinfl || "-"]
  ];

  const docTableRows = docInfo.map(([label, val]) => new TableRow({
    children: [
      new TableCell({
        width: { size: 36, type: WidthType.PERCENTAGE },
        margins: cellMargins,
        shading: labelBg,
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, color: '334155' })] })]
      }),
      new TableCell({
        width: { size: 64, type: WidthType.PERCENTAGE },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: val, size: 18, color: '0F172A' })] })]
      })
    ]
  }));

  // 3. Ota-onasi haqida
  const parentInfo = [
    ["Onasi - F.I.SH", student.motherFullName || "-"],
    ["Onasi - Pasport / ID", student.motherPassport || "-"],
    ["Onasi - JSHSHIR (PINFL)", student.motherPinfl || "-"],
    ["Onasi - Telefoni", student.motherPhone || "-"],
    ["Onasi - Email", student.motherEmail || "-"],
    ["Onasi - Tug'ilgan sana va yoshi", `${formatDate(student.motherBirthDate)} ${student.motherAge ? `(${student.motherAge} yosh)` : ''}`.trim() || "-"],
    ["Onasi - Ish joyi va kasbi", student.motherJob || "-"],
    ["Otasi - F.I.SH", student.fatherFullName || "-"],
    ["Otasi - Pasport / ID", student.fatherPassport || "-"],
    ["Otasi - JSHSHIR (PINFL)", student.fatherPinfl || "-"],
    ["Otasi - Telefoni", student.fatherPhone || "-"],
    ["Otasi - Email", student.fatherEmail || "-"],
    ["Otasi - Tug'ilgan sana va yoshi", `${formatDate(student.fatherBirthDate)} ${student.fatherAge ? `(${student.fatherAge} yosh)` : ''}`.trim() || "-"],
    ["Otasi - Ish joyi va kasbi", student.fatherJob || "-"]
  ];

  const parentTableRows = parentInfo.map(([label, val]) => new TableRow({
    children: [
      new TableCell({
        width: { size: 36, type: WidthType.PERCENTAGE },
        margins: cellMargins,
        shading: labelBg,
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, color: '334155' })] })]
      }),
      new TableCell({
        width: { size: 64, type: WidthType.PERCENTAGE },
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: val, size: 18, color: '0F172A' })] })]
      })
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          orientation: PageOrientation.PORTRAIT,
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: "O'ZBEKISTON RESPUBLIKASI MAKTABGACHA VA MAKTAB TA'LIMI VAZIRLIGI", size: 18, color: '64748B', bold: true })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: String(schoolName).toUpperCase(), bold: true, size: 24, color: '1E40AF' })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "O'QUVCHINING SHAXSIY RO'YXATGA OLISH VARAQASI (DOSYESI)", bold: true, size: 20, color: '0F172A' })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Sinf: `, bold: true, size: 17, color: '334155' }),
            new TextRun({ text: `${className}   |   `, size: 17, color: '0F172A' }),
            new TextRun({ text: `Sinf rahbari: `, bold: true, size: 17, color: '334155' }),
            new TextRun({ text: `${teacherName || "Ko'rsatilmagan"}   |   `, size: 17, color: '0F172A' }),
            new TextRun({ text: `Sana: `, bold: true, size: 17, color: '334155' }),
            new TextRun({ text: `${new Date().toLocaleDateString('uz-UZ')}`, size: 17, color: '0F172A' })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 }
        }),

        // 1-Bo'lim sarlavhasi
        new Paragraph({
          children: [
            new TextRun({ text: "1. O'quvchining asosiy shaxsiy ma'lumotlari", bold: true, size: 19, color: '1E40AF' })
          ],
          spacing: { before: 100, after: 80 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: basicTableRows
        }),

        // 2-Bo'lim sarlavhasi
        new Paragraph({
          children: [
            new TextRun({ text: "2. Davlat hujjatlari va identifikatsiya ma'lumotlari", bold: true, size: 19, color: '4F46E5' })
          ],
          spacing: { before: 180, after: 80 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: docTableRows
        }),

        // 3-Bo'lim sarlavhasi
        new Paragraph({
          children: [
            new TextRun({ text: "3. Ota-onasi (qonuniy vakillari) haqida ma'lumotlar", bold: true, size: 19, color: '059669' })
          ],
          spacing: { before: 180, after: 80 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: parentTableRows
        }),

        ...(Array.isArray(student.extraCourses) && student.extraCourses.length > 0 ? [
          new Paragraph({
            children: [
              new TextRun({ text: "4. Qo'shimcha darslar va o'quv markazlari (to'garaklar)", bold: true, size: 19, color: '10B981' })
            ],
            spacing: { before: 180, after: 80 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, margins: cellMargins, shading: labelBg, children: [new Paragraph({ children: [new TextRun({ text: '№', bold: true, size: 16 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, margins: cellMargins, shading: labelBg, children: [new Paragraph({ children: [new TextRun({ text: 'Dars nomi', bold: true, size: 16 })] })] }),
                  new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, margins: cellMargins, shading: labelBg, children: [new Paragraph({ children: [new TextRun({ text: "O'qituvchi", bold: true, size: 16 })] })] }),
                  new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, margins: cellMargins, shading: labelBg, children: [new Paragraph({ children: [new TextRun({ text: "O'qituvchi tel", bold: true, size: 16 })] })] }),
                  new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, margins: cellMargins, shading: labelBg, children: [new Paragraph({ children: [new TextRun({ text: "O'quv markazi", bold: true, size: 16 })] })] }),
                  new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, margins: cellMargins, shading: labelBg, children: [new Paragraph({ children: [new TextRun({ text: 'Manzili', bold: true, size: 16 })] })] })
                ]
              }),
              ...student.extraCourses.map((c, i) => new TableRow({
                children: [
                  new TableCell({ margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 16 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: c.courseName || '-', bold: true, size: 16 })] })] }),
                  new TableCell({ margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: c.teacherName || '-', size: 16 })] })] }),
                  new TableCell({ margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: c.teacherPhone || '-', size: 16 })] })] }),
                  new TableCell({ margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: c.centerName || '-', size: 16 })] })] }),
                  new TableCell({ margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: c.centerAddress || '-', size: 16 })] })] })
                ]
              }))
            ]
          })
        ] : []),

        // Imzolar
        new Paragraph({
          spacing: { before: 240 },
          children: [
            new TextRun({ text: `Sinf rahbari: ____________________ / ${teacherName || "Imzo"} /                    Maktab direktori: ____________________`, size: 17, color: '475569' })
          ]
        }),
        new Paragraph({
          spacing: { before: 80 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Ushbu hujjat MaktabX tizimidan elektron tarzda shakllantirilgan va rasmiy hisoblanadi.", size: 15, color: '94A3B8', italic: true })
          ]
        })
      ]
    }]
  });

  const cleanName = (student.lastName || 'Oquvchi').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  await downloadDocxDocument(doc, `${cleanName}_dosye_${dateStr}.docx`);
}

/**
 * 7. ZAMONAVIY KUNDUZGI EKSPORT TANLASH MODAL OYNASI (WORD, EXCEL, PDF, PRINT)
 */
export function showExportSelectionModal({ 
  title = "Ma'lumotlarni eksport qilish", 
  subtitle = "Formatni tanlang", 
  onExportWord = null,
  onExportExcel = null, 
  onExportPDF = null, 
  onPrint = null 
}) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const modal = document.createElement('div');
  modal.id = 'export-selection-modal';
  modal.className = 'fixed inset-0 z-50 overflow-y-auto flex justify-center items-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-xs modal-backdrop-enter';

  modal.innerHTML = `
    <div class="modal-dialog-box bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 max-w-sm w-full my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain shadow-2xl border border-slate-200/90 text-slate-800 modal-dialog-enter">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div>
          <h3 class="text-base font-bold text-slate-900">${title}</h3>
          <p class="text-xs text-slate-500 mt-0.5">${subtitle}</p>
        </div>
        <button id="close-export-modal" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer" title="Yopish">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="space-y-3">
        ${onExportWord ? `
        <!-- Word formati (.docx) -->
        <button id="modal-export-word-btn" class="w-full p-3.5 rounded-2xl border-2 border-blue-100 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 text-left flex items-center gap-3.5 transition-all cursor-pointer group active:scale-98">
          <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-200 shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-bold text-slate-900 group-hover:text-blue-700">Word formatida (.docx)</div>
            <div class="text-[11px] text-slate-500">Tahrirlanadigan rasmiy hujjat shaklida</div>
          </div>
          <svg class="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
        ` : ''}

        ${onExportExcel ? `
        <!-- Excel formati (.xlsx) -->
        <button id="modal-export-excel-btn" class="w-full p-3.5 rounded-2xl border-2 border-emerald-100 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 text-left flex items-center gap-3.5 transition-all cursor-pointer group active:scale-98">
          <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-200 shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-bold text-slate-900 group-hover:text-emerald-700">Excel formatida (.xlsx)</div>
            <div class="text-[11px] text-slate-500">Jadval ko'rinishida to'liq yuklab olish</div>
          </div>
          <svg class="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
        ` : ''}

        ${onExportPDF ? `
        <!-- PDF formati (.pdf) -->
        <button id="modal-export-pdf-btn" class="w-full p-3.5 rounded-2xl border-2 border-rose-100 hover:border-rose-500 bg-rose-50/50 hover:bg-rose-50 text-left flex items-center gap-3.5 transition-all cursor-pointer group active:scale-98">
          <div class="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-rose-200 shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-bold text-slate-900 group-hover:text-rose-700">PDF formatida (.pdf)</div>
            <div class="text-[11px] text-slate-500">Rasmiy varaq / A4 hujjat shaklida</div>
          </div>
          <svg class="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
        ` : ''}

        ${onPrint ? `
        <!-- Chop etish -->
        <button id="modal-export-print-btn" class="w-full p-3 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left flex items-center gap-3.5 transition-all cursor-pointer group">
          <div class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-bold text-slate-800">Chop etish (Printer)</div>
            <div class="text-[10px] text-slate-400">To'g'ridan-to'g'ri chop qilish oynasini ochish</div>
          </div>
        </button>
        ` : ''}
      </div>
    </div>
  `;

  modalContainer.innerHTML = '';
  modalContainer.appendChild(modal);

  const closeModal = (callback) => {
    closeModalWithAnimation(modal, () => {
      modalContainer.innerHTML = '';
      if (typeof callback === 'function') callback();
    });
  };

  document.getElementById('close-export-modal')?.addEventListener('click', () => closeModal());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (onExportWord) {
    document.getElementById('modal-export-word-btn')?.addEventListener('click', () => {
      closeModal(() => onExportWord());
    });
  }

  if (onExportExcel) {
    document.getElementById('modal-export-excel-btn')?.addEventListener('click', () => {
      closeModal(() => onExportExcel());
    });
  }

  if (onExportPDF) {
    document.getElementById('modal-export-pdf-btn')?.addEventListener('click', () => {
      closeModal(() => onExportPDF());
    });
  }

  if (onPrint) {
    document.getElementById('modal-export-print-btn')?.addEventListener('click', () => {
      closeModal(() => onPrint());
    });
  }
}

/**
 * Platformalar, o'quvchilar login va parollarini Excel (.xlsx) formatida yuklab olish
 */
export function exportPlatformCredentialsToExcel(items = [], filename = 'Platformalar_Login_Parollar.xlsx') {
  if (!items || !items.length) return;

  const rows = items.map((it, idx) => ({
    "№": idx + 1,
    "Maktab": it.schoolName || '-',
    "Sinf": it.className || '-',
    "O'quvchi F.I.SH": it.studentName || '-',
    "Platforma": it.platformName || '-',
    "Login": it.login || '',
    "Parol": it.password || '',
    "Holati": it.login && it.password ? "To'liq kiritilgan" : (it.login ? "Faqat login" : "Kiritilmagan")
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ustun kengliklari
  worksheet['!cols'] = [
    { wch: 6 },   // №
    { wch: 26 },  // Maktab
    { wch: 12 },  // Sinf
    { wch: 28 },  // O'quvchi
    { wch: 24 },  // Platforma
    { wch: 22 },  // Login
    { wch: 20 },  // Parol
    { wch: 18 }   // Holati
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Login va Parollar");
  XLSX.writeFile(workbook, filename);
}
