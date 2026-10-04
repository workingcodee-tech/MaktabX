// Skeleton Loader Components - Zamonaviy va chiroyli yuklanish animatsiyalari
// O'quvchilar ro'yxati, statistika va profillar yuklanishida kutish holatini ko'rsatish uchun

/**
 * Stol kompyuterlar (Desktop) jadval ko'rinishidagi o'quvchilar ro'yxati uchun Skeleton Loader
 */
export function renderStudentTableSkeleton(rowCount = 6) {
  return `
    <div class="divide-y divide-slate-100 animate-fade-in select-none">
      ${Array.from({ length: rowCount }).map((_, idx) => `
        <div class="px-6 py-4 flex items-center justify-between gap-4">
          <!-- O'quvchi F.I.SH va Rasm -->
          <div class="flex items-center gap-3.5 min-w-0 flex-1">
            <div class="w-10 h-10 rounded-xl skeleton-shimmer shrink-0 shadow-2xs"></div>
            <div class="space-y-2 flex-1 max-w-xs">
              <div class="h-4 w-3/4 rounded-md skeleton-shimmer"></div>
              <div class="flex items-center gap-2">
                <div class="h-3 w-14 rounded-md skeleton-shimmer"></div>
                <div class="h-3 w-20 rounded-md skeleton-shimmer"></div>
              </div>
            </div>
          </div>

          <!-- PINFL / Hujjat -->
          <div class="hidden lg:block w-32 shrink-0">
            <div class="h-5 w-24 rounded-md skeleton-shimmer mb-1"></div>
            <div class="h-3 w-16 rounded-md skeleton-shimmer"></div>
          </div>

          <!-- Ota-ona / Aloqa -->
          <div class="hidden md:block w-40 shrink-0 space-y-1.5">
            <div class="h-4 w-32 rounded-md skeleton-shimmer"></div>
            <div class="h-3 w-24 rounded-md skeleton-shimmer"></div>
          </div>

          <!-- Telefon raqam -->
          <div class="hidden sm:block w-32 shrink-0">
            <div class="h-6 w-28 rounded-lg skeleton-shimmer"></div>
          </div>

          <!-- Amallar tugmalari -->
          <div class="flex items-center gap-2 shrink-0">
            <div class="w-8 h-8 rounded-lg skeleton-shimmer"></div>
            <div class="w-8 h-8 rounded-lg skeleton-shimmer"></div>
            <div class="w-8 h-8 rounded-lg skeleton-shimmer"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Mobil qurilmalar uchun o'quvchi kartalari Skeleton Loaderi
 */
export function renderStudentMobileCardsSkeleton(cardCount = 5) {
  return `
    <div class="space-y-2.5 animate-fade-in select-none">
      ${Array.from({ length: cardCount }).map(() => `
        <div class="w-full bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-12 h-12 rounded-xl skeleton-shimmer shrink-0"></div>
            <div class="min-w-0 flex-1 space-y-2">
              <div class="h-4 w-3/4 rounded-md skeleton-shimmer"></div>
              <div class="flex items-center gap-2">
                <div class="h-3 w-16 rounded-md skeleton-shimmer"></div>
                <div class="h-3 w-24 rounded-md skeleton-shimmer"></div>
              </div>
            </div>
          </div>
          <div class="w-5 h-5 rounded-full skeleton-shimmer shrink-0"></div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Sinf/Maktab statistik kartalari Skeleton Loaderi
 */
export function renderStatsCardsSkeleton(count = 3) {
  return `
    <div class="grid grid-cols-2 sm:grid-cols-${count} gap-3 sm:gap-4 select-none animate-fade-in">
      ${Array.from({ length: count }).map(() => `
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-xl skeleton-shimmer shrink-0"></div>
          <div class="space-y-2 flex-1">
            <div class="h-6 w-12 rounded-md skeleton-shimmer"></div>
            <div class="h-3.5 w-24 rounded-md skeleton-shimmer"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Maktab admini sahifasidagi o'quvchilar/o'qituvchilar ro'yxati Skeleton Loaderi
 */
export function renderAdminListSkeleton(rowCount = 7) {
  return `
    <div class="divide-y divide-slate-100 select-none animate-fade-in">
      ${Array.from({ length: rowCount }).map((_, idx) => `
        <div class="px-4 py-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-5 h-4 rounded-md skeleton-shimmer hidden sm:block shrink-0"></div>
            <div class="w-14 h-6 rounded-lg skeleton-shimmer shrink-0"></div>
            <div class="space-y-1.5 flex-1 max-w-sm">
              <div class="h-4 w-4/5 rounded-md skeleton-shimmer"></div>
              <div class="h-3 w-1/2 rounded-md skeleton-shimmer"></div>
            </div>
          </div>
          <div class="w-12 h-4 rounded-md skeleton-shimmer shrink-0"></div>
        </div>
      `).join('')}
    </div>
  `;
}

// Universal alias for list skeleton
export const renderListSkeleton = renderAdminListSkeleton;

/**
 * O'quvchining to'liq dosye sahifasi (Student Detail) Skeleton Loaderi
 */
export function renderStudentDetailSkeleton() {
  return `
    <div class="max-w-5xl mx-auto space-y-6 select-none animate-fade-in pb-20">
      <!-- Top header bar skeleton -->
      <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-4 w-full sm:w-auto">
          <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl skeleton-shimmer shrink-0"></div>
          <div class="space-y-2 flex-1">
            <div class="h-6 w-48 sm:w-64 rounded-md skeleton-shimmer"></div>
            <div class="flex items-center gap-2">
              <div class="h-4 w-20 rounded-md skeleton-shimmer"></div>
              <div class="h-4 w-32 rounded-md skeleton-shimmer"></div>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div class="h-10 w-24 rounded-xl skeleton-shimmer"></div>
          <div class="h-10 w-24 rounded-xl skeleton-shimmer"></div>
        </div>
      </div>

      <!-- Detail cards grid skeleton -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div class="h-5 w-36 rounded-md skeleton-shimmer"></div>
          <div class="space-y-3 pt-2">
            <div class="h-4 w-full rounded-md skeleton-shimmer"></div>
            <div class="h-4 w-5/6 rounded-md skeleton-shimmer"></div>
            <div class="h-4 w-4/6 rounded-md skeleton-shimmer"></div>
            <div class="h-4 w-3/4 rounded-md skeleton-shimmer"></div>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div class="h-5 w-40 rounded-md skeleton-shimmer"></div>
          <div class="space-y-3 pt-2">
            <div class="h-4 w-full rounded-md skeleton-shimmer"></div>
            <div class="h-4 w-5/6 rounded-md skeleton-shimmer"></div>
            <div class="h-4 w-4/6 rounded-md skeleton-shimmer"></div>
            <div class="h-4 w-3/4 rounded-md skeleton-shimmer"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}
