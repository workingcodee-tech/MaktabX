/**
 * MaktabX - Sinflar aro davomat statistikasi grafigi
 * 
 * Talablar:
 * 1. Scroll bo'lsa ham ko'rishga juda qulay, keng va chiroyli ustunli grafik
 * 2. Barcha ustunlarning dizayni bir xil, lekin davomat foiziga qarab rangi dinamik o'zgaradi:
 *    - 90% - 100%: Yashil (A'lo)
 *    - 75% - 89.9%: Ko'k / Indigo (Yaxshi)
 *    - 60% - 74.9%: Sariq / Amber (O'rtacha)
 *    - 0% - 59.9%: Qizil (Past)
 * 3. Biror bir ustun (sinf) ustiga bosilganda modal yopiladi va o'sha sinf davomati
 *    alohida bitta sahifada ochiladi (modal oyna emas).
 */

import { compareClassNames, formatReadableDate, getTodayISODate } from '../data.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Davomat foiziga qarab rangni hisoblash (barcha ustunlar bir xil uyg'un uslubda)
export function getAttendanceRateColor(rate) {
  if (rate >= 90) {
    return {
      main: '#10B981',       // Emerald
      top: '#34D399',
      bottom: '#059669',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      statusText: "A'lo"
    };
  }
  if (rate >= 75) {
    return {
      main: '#6366F1',       // Indigo
      top: '#818CF8',
      bottom: '#4338CA',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      statusText: 'Yaxshi'
    };
  }
  if (rate >= 60) {
    return {
      main: '#F59E0B',       // Amber
      top: '#FBBF24',
      bottom: '#D97706',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      statusText: "O'rtacha"
    };
  }
  return {
    main: '#EF4444',         // Red
    top: '#F87171',
    bottom: '#B91C1C',
    badgeBg: 'bg-red-50 text-red-700 border-red-200',
    statusText: 'Past'
  };
}

export function openAdminAttendanceGraphModal({
  state,
  currentSchool,
  initialDate = null,
  onSelectClass = null
}) {
  const modalId = 'admin-attendance-graph-modal';
  document.getElementById(modalId)?.remove();

  const schoolId = currentSchool.id;
  let selectedDate = initialDate || getTodayISODate();

  // Maktab sinflari (1-A dan 11-D gacha qat'iy tartibda)
  const schoolClasses = (state.classes || [])
    .filter(c => c.schoolId === schoolId)
    .sort((a, b) => compareClassNames(a.name, b.name));

  const classMap = new Map();
  schoolClasses.forEach(c => classMap.set(c.id, c));

  const schoolStudents = (state.students || []).filter(s => {
    if (s.schoolId === schoolId) return true;
    return Boolean(classMap.get(s.classId));
  });

  const schoolAttendanceRecords = (state.attendanceRecords || []).filter(r => r.schoolId === schoolId);

  // Tanlangan sana uchun sinflar statistikasini hisoblash
  function computeStats(dateStr) {
    const records = schoolAttendanceRecords.filter(r => r.date === dateStr);

    const studentStatusMap = new Map();
    records.forEach(rec => {
      if (rec.classAttendance) {
        Object.values(rec.classAttendance).forEach(clsAtt => {
          if (clsAtt && clsAtt.records) {
            Object.entries(clsAtt.records).forEach(([sId, sData]) => {
              studentStatusMap.set(sId, {
                status: sData.status || 'present',
                isExcused: Boolean(sData.isExcused || sData.status === 'excused' || sData.status === 'absent_excused')
              });
            });
          }
        });
      }
    });

    let totalSchoolStudents = schoolStudents.length;
    let totalPresent = 0;

    const classStats = schoolClasses.map((cls) => {
      const clsStudents = schoolStudents.filter(s => s.classId === cls.id);
      const total = clsStudents.length;
      let present = 0;
      let absent = 0;

      clsStudents.forEach(st => {
        const att = studentStatusMap.get(st.id);
        if (!att || att.status === 'present' || att.status === 'late') {
          present++;
        } else {
          absent++;
        }
      });

      totalPresent += present;
      const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 100;
      const colorInfo = getAttendanceRateColor(rate);

      return {
        cls,
        total,
        present,
        absent,
        rate,
        colorInfo
      };
    });

    const schoolRate = totalSchoolStudents > 0 ? Math.round((totalPresent / totalSchoolStudents) * 1000) / 10 : 100;

    return {
      date: dateStr,
      classStats,
      totalSchoolStudents,
      totalPresent,
      schoolRate
    };
  }

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = "fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-center items-center p-2.5 sm:p-4 animate-fade-in";

  function renderModal() {
    const data = computeStats(selectedDate);
    const list = data.classStats;
    const overallColor = getAttendanceRateColor(data.schoolRate);

    // Keng, qulay va ko'rishga oson SVG parametrlari (Gorizontal scroll bilan)
    const colWidth = 66; // Har bir sinf uchun qulay kenglik
    const marginX = 40;
    const chartHeight = 280;
    const chartTop = 38;
    const chartBottom = 230;
    const usableHeight = chartBottom - chartTop;

    const svgWidth = Math.max(list.length * colWidth + marginX * 2, 700);
    const barWidth = 26; // Qulay, ko'rinarli ustun

    const avgY = chartBottom - ((data.schoolRate / 100) * usableHeight);

    modal.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-4xl flex flex-col max-h-[92dvh] overflow-hidden animate-scale-in">
        
        <!-- Sarlavha va sana tanlash -->
        <div class="px-4 py-3.5 sm:px-6 sm:py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold shrink-0">
              📊
            </span>
            <div class="min-w-0">
              <h2 class="text-sm sm:text-base font-black text-slate-900 truncate leading-tight">
                Sinflar aro davomat statistikasi
              </h2>
              <div class="flex items-center gap-2 text-xs text-slate-500 font-medium truncate mt-0.5">
                <span>${escapeHtml(currentSchool.name)}</span>
                <span>•</span>
                <span class="font-bold font-mono" style="color: ${overallColor.main}">
                  O'rtacha: ${data.schoolRate}% (${overallColor.statusText})
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- Sana tanlash -->
            <input 
              type="date" 
              id="graph-date-picker" 
              value="${selectedDate}" 
              class="px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 cursor-pointer"
              title="Sanani o'zgartirish"
            />

            <!-- Yopish tugmasi -->
            <button 
              type="button" 
              id="close-graph-modal" 
              class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              aria-label="Yopish"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Foydalanuvchiga qulay ko'rsatma banner -->
        <div class="bg-indigo-50/60 border-b border-indigo-100/60 px-4 py-2 sm:px-6 flex items-center justify-between gap-2 text-xs text-indigo-900 font-medium shrink-0">
          <div class="flex items-center gap-1.5 truncate">
            <span>👆</span>
            <span class="truncate font-semibold">Ixtiyoriy sinf ustuniga bosing — uning to'liq davomati alohida sahifada ochiladi!</span>
          </div>
          <span class="text-[11px] text-indigo-500 shrink-0 hidden sm:inline">Gorizontal siljitish (Scroll) mumkin ↔</span>
        </div>

        <!-- ======================================================== -->
        <!-- QULAY, KENG VA GORIZONTAL SCROLL BO'LADIGAN GRAFIK        -->
        <!-- ======================================================== -->
        <div class="flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-5 bg-gradient-to-b from-slate-50/40 to-white select-none scrollbar-thin">
          
          <div class="min-w-fit">
            <svg 
              width="${svgWidth}" 
              height="${chartHeight}" 
              viewBox="0 0 ${svgWidth} ${chartHeight}" 
              class="block mx-auto"
            >
              <defs>
                ${list.map((cs, idx) => `
                  <linearGradient id="rateGrad_${idx}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${cs.colorInfo.top}" stop-opacity="1" />
                    <stop offset="100%" stop-color="${cs.colorInfo.bottom}" stop-opacity="0.9" />
                  </linearGradient>
                `).join('')}
              </defs>

              <!-- Gorizontal to'r chiziqlari (100%, 75%, 50%, 25%) -->
              <line x1="${marginX}" y1="${chartTop}" x2="${svgWidth - marginX}" y2="${chartTop}" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="1"/>
              <text x="${marginX - 6}" y="${chartTop + 3}" fill="#94a3b8" font-size="10" font-family="monospace" text-anchor="end">100%</text>

              <line x1="${marginX}" y1="${chartTop + usableHeight * 0.25}" x2="${svgWidth - marginX}" y2="${chartTop + usableHeight * 0.25}" stroke="#f1f5f9" stroke-dasharray="3,3" stroke-width="1"/>
              <text x="${marginX - 6}" y="${chartTop + usableHeight * 0.25 + 3}" fill="#94a3b8" font-size="10" font-family="monospace" text-anchor="end">75%</text>

              <line x1="${marginX}" y1="${chartTop + usableHeight * 0.5}" x2="${svgWidth - marginX}" y2="${chartTop + usableHeight * 0.5}" stroke="#f1f5f9" stroke-dasharray="3,3" stroke-width="1"/>
              <text x="${marginX - 6}" y="${chartTop + usableHeight * 0.5 + 3}" fill="#94a3b8" font-size="10" font-family="monospace" text-anchor="end">50%</text>

              <!-- Maktab o'rtacha davomat chizig'i -->
              <line x1="${marginX}" y1="${avgY}" x2="${svgWidth - marginX}" y2="${avgY}" stroke="#6366f1" stroke-dasharray="4,4" stroke-width="1.5"/>
              <text x="${svgWidth - marginX + 4}" y="${avgY + 3}" fill="#6366f1" font-size="10" font-weight="bold" font-family="monospace">
                O'rtacha ${data.schoolRate}%
              </text>

              <!-- Asosiy pastki chiziq (0%) -->
              <line x1="${marginX}" y1="${chartBottom}" x2="${svgWidth - marginX}" y2="${chartBottom}" stroke="#cbd5e1" stroke-width="1.5"/>

              <!-- Har bir sinf uchun qulay, chiroyli va bosiladigan ustun -->
              ${list.map((cs, idx) => {
                const centerX = marginX + (idx + 0.5) * colWidth;
                const x = centerX - (barWidth / 2);
                const barH = Math.max((cs.rate / 100) * usableHeight, 6);
                const y = chartBottom - barH;

                return `
                  <g class="cursor-pointer class-bar-item group" data-class-id="${escapeHtml(cs.cls.id)}" data-idx="${idx}">
                    
                    <!-- Bosish oson bo'lishi uchun ko'rinmas kengroq sensor fon -->
                    <rect 
                      x="${centerX - colWidth / 2}" 
                      y="${chartTop - 10}" 
                      width="${colWidth}" 
                      height="${chartHeight - chartTop + 10}" 
                      fill="transparent" 
                      class="hover:fill-indigo-50/40 transition-colors"
                    />

                    <!-- Ustun ustidagi foiz matni -->
                    <text 
                      x="${centerX}" 
                      y="${Math.max(y - 6, chartTop - 4)}" 
                      text-anchor="middle" 
                      font-size="11" 
                      font-weight="bold" 
                      fill="${cs.colorInfo.main}" 
                      font-family="monospace"
                      class="transition-transform group-hover:scale-110"
                    >
                      ${cs.rate}%
                    </text>

                    <!-- Ustun (Chiroyli yumaloq ustun) -->
                    <rect 
                      x="${x}" 
                      y="${y}" 
                      width="${barWidth}" 
                      height="${barH}" 
                      rx="7" 
                      fill="url(#rateGrad_${idx})" 
                      class="transition-all opacity-95 group-hover:opacity-100 group-hover:filter group-hover:drop-shadow-md"
                    />

                    <!-- Pastdagi sinf nomi (1-A, 1-B, 11-D...) -->
                    <text 
                      x="${centerX}" 
                      y="${chartBottom + 18}" 
                      text-anchor="middle" 
                      font-size="12" 
                      font-weight="bold" 
                      fill="#0f172a"
                      class="group-hover:fill-indigo-600 transition-colors"
                    >
                      ${escapeHtml(cs.cls.name)}
                    </text>

                    <!-- Kelgan/Jami ko'rsatkichi -->
                    <text 
                      x="${centerX}" 
                      y="${chartBottom + 32}" 
                      text-anchor="middle" 
                      font-size="9" 
                      font-weight="medium" 
                      fill="#64748b"
                      font-family="monospace"
                    >
                      ${cs.present}/${cs.total}
                    </text>
                  </g>
                `;
              }).join('')}

            </svg>
          </div>

        </div>

        <!-- Ranglar izohi (Legend) va Yopish -->
        <div class="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <!-- Ranglar shkalasi -->
          <div class="flex items-center gap-3 text-xs font-semibold flex-wrap">
            <span class="text-slate-500 font-medium">Ranglar ma'nosi:</span>
            <span class="inline-flex items-center gap-1.5 text-emerald-700">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 90-100% (A'lo)
            </span>
            <span class="inline-flex items-center gap-1.5 text-indigo-700">
              <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> 75-89% (Yaxshi)
            </span>
            <span class="inline-flex items-center gap-1.5 text-amber-700">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> 60-74% (O'rtacha)
            </span>
            <span class="inline-flex items-center gap-1.5 text-red-700">
              <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span> &lt; 60% (Past)
            </span>
          </div>

          <button 
            type="button" 
            id="btn-close-graph-bottom" 
            class="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer transition-all active:scale-95"
          >
            Yopish
          </button>
        </div>

      </div>
    `;

    const close = () => modal.remove();
    modal.querySelector('#close-graph-modal')?.addEventListener('click', close);
    modal.querySelector('#btn-close-graph-bottom')?.addEventListener('click', close);

    // Sana o'zgarganda
    modal.querySelector('#graph-date-picker')?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        selectedDate = val;
        renderModal();
      }
    });

    // Ustun ustiga (sinfga) bosilganda:
    // Modal oynani yopib, o'sha sinf davomatini ALOHIDA SAHIFADA ochish!
    modal.querySelectorAll('.class-bar-item').forEach(el => {
      el.addEventListener('click', () => {
        const classId = el.getAttribute('data-class-id');
        if (classId) {
          modal.remove();
          if (typeof onSelectClass === 'function') {
            onSelectClass(classId, selectedDate);
          }
        }
      });
    });
  }

  document.body.appendChild(modal);
  renderModal();
}
