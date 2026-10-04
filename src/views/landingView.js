/**
 * MaktabX - Rasmiy Kutib Olish Sahifasi va To'liq Interaktiv Qo'llanmalar Markazi
 * Yuqori kontrastli, animatsion, barcha qurilmalarda yozuv va menyulari 100% aniq ko'rinadigan dizayn
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let savedGuideTab = 'teacher'; // 'teacher' | 'admin' | 'security' | 'dossier'
let savedFaqIndex = 0;
let savedGuideSearch = '';

export function renderLanding(container, {
  siteInfo,
  developer,
  db,
  onGoToLogin,
  onForgotPassword,
  onOpenAbout,
  showToast
}) {
  const info = siteInfo || {
    title: 'MaktabX',
    subtitle: "Ta'lim va O'quvchilar Boshqaruv Tizimi",
    description: "MaktabX — umumta'lim maktablari ma'muriyati va sinf rahbarlari uchun o'quvchilarning 24 bandli rasmiy dosyesini yuritish, smenalar bo'yicha kunlik davomatni nazorat qilish, ta'lim platformalari login-parollarini saqlash hamda hujjatlarni Word, Excel va PDF formatlarida shakllantirish tizimi.",
    version: '2.4.0',
    releaseYear: '2026'
  };

  const dev = developer || {
    name: 'WORKING CODE',
    brand: 'WORKING CODE',
    phone: '+998 90 000 12 34',
    telegram: '@diyorbek_dev',
    email: 'diyorbek.dev1510@gmail.com',
    bio: "MaktabX axborot tizimi asoschisi va dasturiy ta'minot muallifi — WORKING CODE brendi."
  };

  const tgUser = (dev.telegram || '@diyorbek_dev').replace('@', '');
  const cleanPhone = (dev.phone || '+998900001234').replace(/[^0-9+]/g, '');

  const schoolsCount = Array.isArray(db?.schools) ? db.schools.length : 0;
  const classesCount = Array.isArray(db?.classes) ? db.classes.length : 0;
  const studentsCount = Array.isArray(db?.students) ? db.students.length : 0;

  const GUIDE_TABS = {
    teacher: {
      label: "Sinf Rahbari Qo'llanmasi",
      shortLabel: "Sinf Rahbari",
      title: "Sinf Rahbari (O'qituvchi) Uchun To'liq Yo'riqnoma",
      subtitle: "Sinfga biriktirilgan o'quvchilar, kunlik navbatchilik davomati, platformalar va eksport bo'yicha qadamma-qadam qoidalar",
      accentColor: "indigo",
      steps: [
        {
          num: "01",
          title: "Kabinetga kirish va 4 xonali PIN-kod o'rnatish",
          desc: "Maktab Admini tomonidan berilgan sinf logini (masalan: 9-A) va parol orqali tizimga kiring. Ilk bor kirganingizda xavfsizlik uchun 4 xonali shaxsiy PIN-kod o'rnatish oynasi avtomatik ochiladi.",
          tip: "Keyingi safar saytga kirganingizda login/parol terish shart emas — faqat 4 xonali PIN-kod yoki Face ID orqali 1 soniyada kabinetga kirasiz."
        },
        {
          num: "02",
          title: "O'quvchi qo'shish va 24 bandli dosye yuritish",
          desc: "Asosiy sahifadagi «Yangi o'quvchi» tugmasini bosib, o'quvchining F.I.SH, tug'ilgan sanasi, guvohnoma/pasport seriyasi, 14 xonali JSHSHIR (PINFL), manzili, ota-onasi va to'garaklarini kiritasiz.",
          tip: "Tizim ism-sharifga qarab o'quvchi jinsini avtomatik aniqlaydi va ma'lumot yozilayotganda qoralamani (Auto-Draft) xotirada saqlab boradi."
        },
        {
          num: "03",
          title: "Kunlik davomat olish va Mas'ul Navbatchi qoidasi",
          desc: "Maktab nizomiga binoan, davomatni har kuni smena bo'yicha biriktirilgan Mas'ul Navbatchi sinf rahbari oladi. Navbatchilik kuningizda pastki menyudagi «Davomat» bo'limida barcha sinflar uchun davomat olish oynasi ochiladi.",
          tip: "Siz navbatchi bo'lmagan kunlarda «Davomat» bo'limida bugun kim navbatchi ekanligini va o'z sinfingiz davomat natijasini kuzatasiz."
        },
        {
          num: "04",
          title: "«Sababli» deb belgilash va Ota-onaga SMS yuborish",
          desc: "Darsga kelmagan o'quvchini «Sababli» deb belgilaganda majburiy sabab izohi (Betoblik, Ota-ona arizasi, Oilaviy safar, Olimpiada) tanlanadi yoki yoziladi.",
          tip: "Dars qoldirgan o'quvchining ota-onasiga DevSMS shlyuzi orqali bir bosishda rasmiy ogohlantirish SMS xabarini yuborish mumkin."
        },
        {
          num: "05",
          title: "Navbatchi kela olmay qolganda Avto-Zaxira tizimi",
          desc: "Agar bugun navbatchi bo'lsangiz, ammo uzrli sabab bilan maktabga kela olmasangiz, Davomat bo'limidagi «Kelolmaslikni bildirish» tugmasini bosib sababingizni belgilang.",
          tip: "Tizim avtomatik ravishda navbatchilikni jadvaldagi Zaxira o'qituvchiga o'tkazadi va Maktab Adminiga shoshilinch bildirishnoma yuboradi."
        },
        {
          num: "06",
          title: "eMaktab (Kundalik) parollari va Word / Excel / PDF eksport",
          desc: "«Platformalar» bo'limida har bir o'quvchining Kundalik.com (eMaktab), Khan Academy, Kitob.uz va Edu.uz login-parollarini saqlang. Sinf ro'yxatini yoki alohida o'quvchi dosyesini Word, Excel va PDF formatda yuklab oling.",
          tip: "Har bir o'quvchi dosyesi ichidagi «Chop etish» tugmasi orqali tayyor A4 ma'lumotnomani bevosita printerdan chiqarish mumkin."
        }
      ]
    },
    admin: {
      label: "Maktab Admini Qo'llanmasi",
      shortLabel: "Maktab Admini",
      title: "Maktab Administratori (Ma'muriyat) Qo'llanmasi",
      subtitle: "Maktab bo'yicha sinflar, smenalar, navbatchilik jadvali, davomat tahlili va o'qituvchilar nazorati",
      accentColor: "emerald",
      steps: [
        {
          num: "01",
          title: "Sinflar va sinf rahbarlari hisoblarini ochish",
          desc: "Admin panelidan maktabdagi barcha sinflarni (1-A dan 11-B gacha) yarating, har bir sinfga sinf rahbari F.I.SH, telefon raqami, kirish logini va parolini biriktiring.",
          tip: "Tizim har bir sinf rahbari uchun parolni tiklashda ishlatiladigan 6 xonali noyob Tiklash ID (REC-XXXXXX) raqamini avtomatik yaratadi."
        },
        {
          num: "02",
          title: "1-smena va 2-smena hamda Navbatchilik jadvali",
          desc: "«Davomat» bo'limida o'quv smenalarini shakllantiring va sinflarni smenalarga biriktiring. Haftaning har bir kuni (Dushanba–Shanba) uchun asosiy mas'ul navbatchi va zaxira navbatchi o'qituvchilarni belgilang.",
          tip: "Yangi qo'shilgan sinflar avtomatik ravishda 1-smenaga biriktiriladi va ularni istalgan vaqtda 2-smenaga o'tkazish mumkin."
        },
        {
          num: "03",
          title: "Jonli davomat monitoringi va grafik statistika",
          desc: "Maktab bo'yicha bugungi va o'tgan kunlardagi davomat foizini, sababli va sababsiz dars qoldirgan o'quvchilar ro'yxatini hamda sinflar kesimidagi grafik tahlillarni kuzating.",
          tip: "Admin istalgan smena va sinf uchun bevosita davomat olishi yoki kiritilgan davomatni tahrirlashi mumkin."
        },
        {
          num: "04",
          title: "Navbatchi kelolmasligi bildirishnomalarini nazorat qilish",
          desc: "Navbatchi o'qituvchi maktabga kela olmasligini bildirsa, Admin panelining bildirishnomalar markaziga darhol ogohlantirish kelib tushadi.",
          tip: "Bildirishnomada kim kelolmagani, sababi va tizim kimni zaxira navbatchi etib tayinlagani aniq ko'rsatiladi."
        },
        {
          num: "05",
          title: "O'qituvchilar paroli va PIN-kodini tiklashga ruxsat berish",
          desc: "Parolini unutgan o'qituvchi Tiklash ID orqali so'rov yuborganda, Admin panelida so'rov chiqadi. Admin «Tasdiqlash» tugmasini bosishi bilan o'qituvchi o'z qurilmasida avtomatik tizimga kiradi.",
          tip: "Admin har bir sinf rahbari profiliga kirib, uning unutilgan 4 xonali PIN-kodini ham bir tugma bilan bekor qilishi mumkin."
        },
        {
          num: "06",
          title: "Maktab bo'yicha global qidiruv va 7 kunlik Arxiv",
          desc: "Butun maktab o'quvchilarini F.I.SH, JSHSHIR (PINFL), tug'ilgan sana yoki ota-onasi bo'yicha qidiring va hujjatlarini eksport qiling.",
          tip: "Tasodifan o'chirilgan sinf yoki o'quvchi ma'lumotlari 7 kun davomida Arxivda (Savatda) saqlanadi."
        }
      ]
    },
    security: {
      label: "Xavfsizlik va Parol Tiklash",
      shortLabel: "Xavfsizlik va Tiklash",
      title: "Xavfsizlik, PIN-kod, Face ID va Hisobni Tiklash",
      subtitle: "3 bosqichli himoya tizimi hamda unutilgan login, parol yoki PIN-kodni tiklashning 2 xil usuli",
      accentColor: "amber",
      steps: [
        {
          num: "01",
          title: "4 xonali Kabinet PIN-kodi va Avto-Qulflash",
          desc: "Har bir o'qituvchi va admin kabinetiga 4 xonali PIN-kod o'rnatiladi. Brauzer qayta ochilganda yoki yuqoridagi «Qulflash» tugmasi bosilganda, kabinet PIN-kod bilan himoyalanadi.",
          tip: "PIN-kod begona shaxslar kompyuter yoki telefoningizdan ma'lumotlarni ko'rishining oldini oladi."
        },
        {
          num: "02",
          title: "Sun'iy intellektli Face ID biometrik kirish",
          desc: "Sozlamalar bo'limidan qurilma kamerasi orqali yuzingizni ro'yxatdan o'tkazing (Face ID). Shundan so'ng PIN-kod terish o'rniga yuz biometrik tasdig'i orqali kabinet qulfini ochishingiz mumkin.",
          tip: "Face ID deskriptorlari shifrlangan matematik vektor ko'rinishida xavfsiz saqlanadi."
        },
        {
          num: "03",
          title: "1-usul: SMS kod (DevSMS OTP) orqali parolni tiklash",
          desc: "Login oynasidagi «Parolni unutdingizmi?» tugmasini bosing va «SMS kod orqali» bo'limida telefon raqamingizni kiriting. Telefoningizga 6 xonali tasdiqlash kodi yuboriladi.",
          tip: "SMS kodni kiritib, hech kimning yordamisiz 30 soniya ichida yangi login va parol o'rnatishingiz mumkin."
        },
        {
          num: "04",
          title: "2-usul: Tiklash ID (REC-ID) orqali Admin ruxsati bilan tiklash",
          desc: "Agar telefon yoningizda bo'lmasa, 6 xonali shaxsiy Tiklash ID raqamingizni kiriting. So'rov jonli rejimda Maktab Adminiga boradi.",
          tip: "Admin tasdiqlashi bilan sahifangiz avtomatik ravishda kabinetga kiradi va yangi parol o'rnatish oynasini ochib beradi."
        },
        {
          num: "05",
          title: "Cloud Firestore Real-Time Sinxronizatsiya",
          desc: "Kiritilgan barcha ma'lumotlar Google Cloud Firestore bulutli bazasida saqlanadi hamda telefon, planshet va kompyuterda bir vaqtning o'zida jonli yangilanadi.",
          tip: "Internet vaqtincha past bo'lganda ham kesh xotira tufayli ma'lumotlar yo'qolmaydi."
        },
        {
          num: "06",
          title: "7 kunlik Arxiv (Savat) himoyasi",
          desc: "Tizimdan o'chirilgan maktab, sinf yoki o'quvchi ma'lumotlari darhol yo'q bo'lib ketmaydi — ular 7 kun davomida maxsus Arxivda saqlanadi.",
          tip: "Zarurat tug'ilganda o'chirilgan sinfni barcha o'quvchilari bilan birga qayta tiklash mumkin."
        }
      ]
    },
    dossier: {
      label: "24 Bandli Dosye va Eksport",
      shortLabel: "Dosye va Eksport",
      title: "24 Bandli O'quvchi Dosyesi va Hujjatlar Eksporti",
      subtitle: "Har bir o'quvchi bo'yicha yuritiladigan 4 ta blokdagi rasmiy ma'lumotlar hamda Word, Excel, PDF eksporti",
      accentColor: "blue",
      steps: [
        {
          num: "01",
          title: "1-blok: Shaxsiy va Aloqa Ma'lumotlari (1–8-bandlar)",
          desc: "Familiyasi, Ismi, Otasining ismi (to'liq F.I.SH), Tug'ilgan sanasi, Avtomatik hisoblanuvchi yoshi, Jinsi (O'g'il / Qiz), Tug'ilgan joyi, Shaxsiy telefon raqami, Email va Doimiy yashash manzili.",
          tip: "Tug'ilgan sana kiritilishi bilan o'quvchining yoshi avtomatik hisoblanadi."
        },
        {
          num: "02",
          title: "2-blok: Guvohnoma, Pasport va JSHSHIR (9–14-bandlar)",
          desc: "Tug'ilganlik haqida guvohnoma bergan FHDYO organi, Dalolatnoma raqami, Guvohnoma berilgan sana, Guvohnoma seriyasi va raqami, Pasport/ID-karta seriya va raqami hamda 14 xonali JSHSHIR (PINFL).",
          tip: "Guvohnoma va JSHSHIR ma'lumotlari rasmiy maktab hisobotlari standartiga to'liq mos keladi."
        },
        {
          num: "03",
          title: "3-blok: Ona va Ota haqida Ma'lumotlar (15–20-bandlar)",
          desc: "Onasining F.I.SH, tug'ilgan sanasi va yoshi, pasport seriyasi, JSHSHIR (PINFL), ish joyi va telefon raqami. Otasining F.I.SH, tug'ilgan sanasi va yoshi, pasport seriyasi, JSHSHIR (PINFL), ish joyi va telefon raqami.",
          tip: "O'quvchi kartasidan ota yoki onasiga bir bosishda qo'ng'iroq qilish yoki SMS yuborish mumkin."
        },
        {
          num: "04",
          title: "4-blok: Platformalar va To'garaklar (21–24-bandlar)",
          desc: "O'quvchining eMaktab (Kundalik.com), Khan Academy, Kitob.uz va Edu.uz tizimlaridagi login va parollari hamda o'quvchi qatnashadigan qo'shimcha to'garaklar (nomi, o'quv markazi, ustozi va telefoni).",
          tip: "Bir o'quvchiga bir nechta fan yoki sport to'garaklarini qo'shish imkoniyati mavjud."
        },
        {
          num: "05",
          title: "Word (.DOCX), Excel (.XLSX) va PDF (.PDF) Eksport",
          desc: "Sinf ro'yxati tepasidagi yoki o'quvchi dosyesi pastidagi «Eksport» tugmasi orqali ma'lumotlarni rasmiy Word hujjati, tartiblangan Excel jadvali yoki PDF ma'lumotnoma shaklida yuklab oling.",
          tip: "Eksport qilingan hujjatlarda maktab nomi, sinf rahbari F.I.SH va sana avtomatik aks etadi."
        },
        {
          num: "06",
          title: "A4 Chop Etish (Print) va Tezkor Nusxalash",
          desc: "«Chop etish» tugmasi barcha menyularni yashirib, sahifani A4 qog'oz formatiga moslashtiradi. «Nusxalash» tugmasi esa o'quvchi anketasini matn ko'rinishida buferga oladi.",
          tip: "Nusxalangan matnni Telegram orqali rahbariyatga yoki ota-onaga darhol yuborish juda qulay."
        }
      ]
    }
  };

  const FAQ_ITEMS = [
    {
      q: "Tizimga qanday kiraman? Login va parolni kim beradi?",
      a: "Sinf rahbarlari (o'qituvchilar) uchun login va parol maktab ma'muriyati (Maktab Admini) tomonidan yaratib beriladi. Maktab Admini hisobi esa tizim bosh dasturchisi (WORKING CODE) tomonidan ochiladi. Sahifadagi «Tizimga kirish» tugmasini bosib, login va parolingizni kiritishingiz mumkin."
    },
    {
      q: "Parolimni yoki kabinet PIN-kodimni unutib qo'ysam nima qilaman?",
      a: "Kirish oynasidagi yoki yuqori menyudagi «Parolni tiklash» tugmasini bosing. Sizda 2 ta tezkor yechim bor: 1) Profilingizga biriktirilgan telefon raqamiga 6 xonali SMS kod yuborish orqali darhol yangi parol o'rnatish; 2) O'zingizga berilgan 6 xonali Tiklash ID (REC-ID) raqamini kiritib Maktab Adminiga so'rov yuborish — admin tasdiqlashi bilan tizim sizni avtomatik kabinetga kiritadi."
    },
    {
      q: "Nega «Davomat» bo'limida ba'zi kunlari faqat kuzatish rejimi chiqadi?",
      a: "MaktabX tizimida maktab ichki tartibiga asosan kunlik davomatni faqat o'sha smenaning bugungi Mas'ul Navbatchi o'qituvchisi (yoki Maktab Admini) oladi. Siz navbatchi bo'lgan kunlarda davomat olish oynasi to'liq ochiladi; boshqa kunlarda esa bugungi mas'ul navbatchi kimligini va o'z sinfingiz davomat natijalarini ko'rishingiz mumkin."
    },
    {
      q: "Yangi o'quvchi qo'shayotganimda sahifa yangilanib ketsa, yozganlarim o'chib ketadimi?",
      a: "Yo'q, o'chib ketmaydi. MaktabX aqlli qoralama (Auto-Draft) tizimi bilan jihozlangan: yangi o'quvchi anketasiga kiritayotgan har bir maydoningiz avtomatik ravishda xotirada saqlanib boradi. Sahifa tasodifan yopilib yoki yangilanib ketsa ham, formani qayta ochganingizda barcha yozganlaringiz tiklanadi."
    },
    {
      q: "Navbatchi o'qituvchi betob bo'lib maktabga kela olmasa, davomat qanday olinadi?",
      a: "Navbatchi o'qituvchi o'z kabinetidan «Kelolmaslikni bildirish» tugmasini bosib, sababini belgilaydi. Tizim shu zahoti navbatchilik huquqini jadvaldagi Zaxira o'qituvchiga avtomatik topshiradi va Maktab Adminiga bildirishnoma yuboradi."
    },
    {
      q: "O'quvchilar ma'lumotini Word, Excel yoki PDF formatda qanday yuklab olaman?",
      a: "Sinf rahbari yoki Admin panelida ro'yxat tepasidagi «Eksport» tugmasini bosing (butun sinf uchun) yoki istalgan o'quvchi ustiga bosib uning shaxsiy dosyesiga kiring va pastki suzuvchi paneldagi «Eksport» tugmasini tanlang. Ochilgan oynada Word (.docx), Excel (.xlsx), PDF (.pdf) yoki «Chop etish» formatlaridan birini tanlaysiz."
    }
  ];

  // Collect all steps when searching across manuals
  function getFilteredSteps() {
    const q = savedGuideSearch.trim().toLowerCase();
    if (!q) {
      return GUIDE_TABS[savedGuideTab]?.steps || GUIDE_TABS.teacher.steps;
    }
    const results = [];
    Object.values(GUIDE_TABS).forEach(tabObj => {
      tabObj.steps.forEach(s => {
        if (
          s.title.toLowerCase().includes(q) ||
          s.desc.toLowerCase().includes(q) ||
          (s.tip && s.tip.toLowerCase().includes(q)) ||
          tabObj.label.toLowerCase().includes(q)
        ) {
          results.push({
            ...s,
            categoryLabel: tabObj.shortLabel
          });
        }
      });
    });
    return results;
  }

  function render() {
    const mainScrollEl = document.getElementById('main-content');
    const prevScrollTop = mainScrollEl ? mainScrollEl.scrollTop : 0;
    const activeGuide = GUIDE_TABS[savedGuideTab] || GUIDE_TABS.teacher;
    const displayedSteps = getFilteredSteps();
    const isSearching = savedGuideSearch.trim().length > 0;

    container.innerHTML = `
      <div id="landing-page-root" class="min-h-screen w-full bg-[#F1F5F9] text-slate-900 select-text font-sans">
        
        <!-- ========================================================================= -->
        <!-- TOP BAR (3-ZONE CONTRACT: Brand Wordmark | Nav Links | Primary Action)    -->
        <!-- ========================================================================= -->
        <header class="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
          <div class="max-w-7xl mx-auto h-16 px-4 sm:px-8 lg:px-12 flex items-center justify-between gap-4">
            
            <!-- Zone 1: Single text element wordmark -->
            <a href="#top" id="landing-brand-link" class="text-xl sm:text-2xl font-black tracking-tight text-slate-950 whitespace-nowrap shrink-0">
              ${escapeHtml(info.title || 'MaktabX')}
            </a>

            <!-- Zone 2: 5 high-contrast navigation links -->
            <nav class="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-bold text-slate-700">
              <a href="#imkoniyatlar" class="hover:text-indigo-600 hover:underline underline-offset-8 decoration-2 transition-colors whitespace-nowrap">Imkoniyatlar</a>
              <a href="#qollanmalar" class="hover:text-indigo-600 hover:underline underline-offset-8 decoration-2 transition-colors whitespace-nowrap">Qo'llanmalar</a>
              <a href="#dosye-tarkibi" class="hover:text-indigo-600 hover:underline underline-offset-8 decoration-2 transition-colors whitespace-nowrap">24 Bandli Dosye</a>
              <a href="#savol-javob" class="hover:text-indigo-600 hover:underline underline-offset-8 decoration-2 transition-colors whitespace-nowrap">Savol-javob</a>
              <a href="#muallif-aloqa" class="hover:text-indigo-600 hover:underline underline-offset-8 decoration-2 transition-colors whitespace-nowrap">Muallif va Aloqa</a>
            </nav>

            <!-- Zone 3: 2 clear primary actions -->
            <div class="flex items-center gap-2.5 shrink-0">
              <button 
                type="button" 
                id="header-recovery-btn"
                class="hidden sm:inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-950 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                Parolni tiklash
              </button>
              <button 
                type="button" 
                id="header-login-btn"
                class="relative overflow-hidden inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-black text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 active:scale-[0.98] rounded-xl shadow-md shadow-teal-500/20 transition-all whitespace-nowrap cursor-pointer"
              >
                <span>Tizimga kirish</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                </svg>
              </button>
            </div>

          </div>

          <!-- Mobile Navigation Bar (Mobil qurilmalarda menyular aniq ko'rinishi uchun) -->
          <div class="md:hidden border-t border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2 overflow-x-auto">
            <a href="#imkoniyatlar" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">Imkoniyatlar</a>
            <a href="#qollanmalar" class="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 whitespace-nowrap shrink-0">Qo'llanmalar</a>
            <a href="#dosye-tarkibi" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">24 Bandli Dosye</a>
            <a href="#savol-javob" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">Savol-javob</a>
            <a href="#muallif-aloqa" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">Aloqa</a>
          </div>
        </header>

        <!-- ========================================================================= -->
        <!-- HERO SECTION: High-Contrast Animated Dark Canvas + Clear Role Guide Cards -->
        <!-- ========================================================================= -->
        <section id="top" class="relative overflow-hidden bg-gradient-to-br from-[#06181b] via-[#0b292e] to-[#071d22] text-white py-12 sm:py-18 lg:py-22 px-4 sm:px-8 lg:px-12 border-b border-slate-800">
          
          <!-- Yuqori Sunset To'lqini -->
          <div class="absolute top-0 inset-x-0 h-[260px] pointer-events-none z-0 overflow-hidden opacity-75">
            <svg class="w-full h-full" viewBox="0 0 1440 320" fill="none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="landingTopWave" x1="0%" y1="0%" x2="100%" y2="85%">
                  <stop offset="0%" stop-color="#FF9636" stop-opacity="0.35" />
                  <stop offset="50%" stop-color="#FF4158" stop-opacity="0.22" />
                  <stop offset="100%" stop-color="#06B6D4" stop-opacity="0.08" />
                </linearGradient>
              </defs>
              <path d="M0,0 L1440,0 L1440,95 C1160,80 920,195 620,195 C320,195 150,255 0,280 Z" fill="url(#landingTopWave)" />
            </svg>
          </div>

          <!-- Ambient Glow -->
          <div class="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-teal-500/15 blur-[120px] pointer-events-none"></div>
          <div class="absolute bottom-10 -right-20 w-80 h-80 rounded-full bg-cyan-500/20 blur-[130px] pointer-events-none"></div>

          <div class="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            <!-- Left Column: Brand Lockup, Unmistakable White Headline & Primary Login CTA -->
            <div class="lg:col-span-7 space-y-6 animate-landing-card">
              
              <div class="inline-flex items-center gap-3 p-2 pr-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
                <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm shrink-0 animate-logo-float">
                  <img src="/maktabx-logo.png" alt="MaktabX" class="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>
                <div class="text-xs text-white font-semibold">
                  <span>MaktabX Rasmiy Portali</span>
                  <span class="mx-1.5 text-cyan-300" aria-hidden="true">·</span>
                  <span class="text-cyan-300">v${escapeHtml(info.version || '2.4.0')}</span>
                  <span class="mx-1.5 text-cyan-300" aria-hidden="true">·</span>
                  <span class="text-emerald-300">${escapeHtml(dev.brand || 'WORKING CODE')}</span>
                </div>
              </div>

              <h1 class="text-3xl sm:text-5xl lg:text-[50px] font-black tracking-tight leading-[1.12] text-white max-w-2xl" style="text-wrap: balance;">
                Maktab ma'lumotlari, kunlik davomat va o'quvchilar dosyesi yagona tizimda
              </h1>

              <p class="text-sm sm:text-lg text-slate-200 leading-relaxed max-w-2xl font-normal">
                ${escapeHtml(info.description)} Barcha ma'lumotlar bulutli bazada xavfsiz saqlanadi hamda telefon, planshet va kompyuterda bir vaqtda ishlaydi.
              </p>

              <!-- Primary & Secondary Actions -->
              <div class="pt-2 flex flex-wrap items-center gap-3.5">
                <button 
                  type="button" 
                  id="hero-login-btn"
                  class="relative overflow-hidden inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-base shadow-xl login-btn-glow animate-login-btn-gradient active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                >
                  <span class="login-btn-ray"></span>
                  <span class="relative z-10">Tizimga kirish (Login)</span>
                  <svg class="w-5 h-5 relative z-10" fill="none" stroke="currentColor" stroke-width="2.6" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                  </svg>
                </button>

                <a 
                  href="#qollanmalar"
                  class="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold text-sm sm:text-base transition-all whitespace-nowrap"
                >
                  <svg class="w-5 h-5 text-cyan-300" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                  <span>Qo'llanmani o'qish</span>
                </a>

                <button 
                  type="button"
                  id="hero-recovery-btn"
                  class="inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-cyan-400/40 text-cyan-200 font-bold text-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Parolni unutdingizmi?</span>
                </button>
              </div>

              <!-- Key Quantitative Facts -->
              <div class="pt-6 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-5 text-left">
                <div class="bg-white/[0.06] border border-white/15 rounded-2xl p-3.5">
                  <div class="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums">24 band</div>
                  <div class="text-xs text-slate-300 mt-0.5 font-medium">Rasmiy o'quvchi dosyesi</div>
                </div>
                <div class="bg-white/[0.06] border border-white/15 rounded-2xl p-3.5">
                  <div class="text-2xl sm:text-3xl font-black text-emerald-300 font-mono tabular-nums">3 format</div>
                  <div class="text-xs text-slate-300 mt-0.5 font-medium">Word, Excel va PDF</div>
                </div>
                <div class="bg-white/[0.06] border border-white/15 rounded-2xl p-3.5">
                  <div class="text-2xl sm:text-3xl font-black text-cyan-300 font-mono tabular-nums">3 himoya</div>
                  <div class="text-xs text-slate-300 mt-0.5 font-medium">Parol, PIN va Face ID</div>
                </div>
                <div class="bg-white/[0.06] border border-white/15 rounded-2xl p-3.5">
                  <div class="text-2xl sm:text-3xl font-black text-amber-300 font-mono tabular-nums">24/7</div>
                  <div class="text-xs text-slate-300 mt-0.5 font-medium">Bulutli jonli sinxron</div>
                </div>
              </div>
            </div>

            <!-- Right Column: Interactive Role & Manual Quick Selector Card -->
            <div class="lg:col-span-5 animate-landing-card">
              <div class="bg-slate-900/85 backdrop-blur-2xl border border-white/25 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl">
                <div class="flex items-center justify-between border-b border-white/15 pb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-2xl bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-black text-lg">
                      MX
                    </div>
                    <div>
                      <h2 class="text-base sm:text-lg font-black text-white">Kimga Qanday Qo'llanma Kerak?</h2>
                      <p class="text-xs text-slate-300">Kerakli bo'lim ustiga bosing yoki kabinetga kiring</p>
                    </div>
                  </div>
                </div>

                <!-- Interactive Role Cards that jump to the corresponding guide tab -->
                <div class="space-y-3">
                  <button 
                    type="button"
                    data-quick-guide="teacher"
                    class="quick-guide-card w-full text-left p-4 rounded-2xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 hover:border-emerald-400/60 transition-all cursor-pointer group"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-black text-white group-hover:text-emerald-300 transition-colors">01. Sinf Rahbari (O'qituvchi)</span>
                      <span class="text-xs font-bold text-emerald-300">Qo'llanmani ko'rish &rarr;</span>
                    </div>
                    <p class="text-xs text-slate-200 mt-1.5 leading-relaxed">
                      O'quvchi qo'shish, 24 bandli anketa, navbatchilik kunida davomat olish, eMaktab parollarini saqlash va hujjat yuklab olish.
                    </p>
                  </button>

                  <button 
                    type="button"
                    data-quick-guide="admin"
                    class="quick-guide-card w-full text-left p-4 rounded-2xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 hover:border-cyan-400/60 transition-all cursor-pointer group"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">02. Maktab Administratori</span>
                      <span class="text-xs font-bold text-cyan-300">Qo'llanmani ko'rish &rarr;</span>
                    </div>
                    <p class="text-xs text-slate-200 mt-1.5 leading-relaxed">
                      Sinflar va rahbarlarni qo'shish, 1 va 2-smena navbatchilik jadvalini tuzish, davomat grafigi va parol tiklash ruxsatlari.
                    </p>
                  </button>

                  <button 
                    type="button"
                    data-quick-guide="security"
                    class="quick-guide-card w-full text-left p-4 rounded-2xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 hover:border-amber-400/60 transition-all cursor-pointer group"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-black text-white group-hover:text-amber-300 transition-colors">03. Xavfsizlik, PIN va Parol Tiklash</span>
                      <span class="text-xs font-bold text-amber-300">Qo'llanmani ko'rish &rarr;</span>
                    </div>
                    <p class="text-xs text-slate-200 mt-1.5 leading-relaxed">
                      4 xonali PIN-kod, Face ID biometrik kirish hamda SMS kod yoki Tiklash ID (REC-ID) orqali hisobni tiklash.
                    </p>
                  </button>
                </div>

                <!-- Live DB Status & Direct Login Button -->
                <div class="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-white/15">
                  <div class="text-xs text-slate-300 font-mono tabular-nums">
                    Faol baza: ${schoolsCount} maktab · ${classesCount} sinf · ${studentsCount} o'quvchi
                  </div>
                  <button 
                    type="button" 
                    id="card-login-btn"
                    class="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs transition-all cursor-pointer whitespace-nowrap shadow-md"
                  >
                    Kabinetga kirish &rarr;
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>

        <!-- ========================================================================= -->
        <!-- SECTION 1: INTERAKTIV FOYDALANUVCHI QO'LLANMALARI (MANUALS & SEARCH)      -->
        <!-- ========================================================================= -->
        <section id="qollanmalar" class="py-14 sm:py-20 px-4 sm:px-8 lg:px-12 bg-white border-b border-slate-200">
          <div class="max-w-7xl mx-auto space-y-8">
            
            <!-- Section Header + Search Box -->
            <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div class="max-w-2xl space-y-2">
                <p class="text-xs font-extrabold text-indigo-600">Bosqichma-bosqich yo'riqnomalar markazi</p>
                <h2 class="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight" style="text-wrap: balance;">
                  MaktabX Tizimidan Foydalanish Qo'llanmalari
                </h2>
                <p class="text-sm sm:text-base text-slate-700 leading-relaxed">
                  Pastdagi 4 ta bo'limdan o'zingizga keraklisini tanlang yoki qidiruv maydoniga kalit so'z yozing (masalan: <strong>davomat</strong>, <strong>PIN</strong>, <strong>SMS</strong>, <strong>PDF</strong>).
                </p>
              </div>

              <!-- Instant Search Input for Manuals -->
              <div class="w-full lg:w-80 shrink-0">
                <div class="relative flex items-center">
                  <svg class="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input 
                    type="text"
                    id="guide-search-input"
                    value="${escapeHtml(savedGuideSearch)}"
                    placeholder="Qo'llanmadan qidirish..."
                    class="w-full pl-10 pr-9 py-3 rounded-2xl bg-slate-100 border-2 border-slate-300 focus:border-indigo-600 focus:bg-white text-sm font-semibold text-slate-900 placeholder:text-slate-500 focus:outline-none transition-all"
                  />
                  ${isSearching ? `
                    <button 
                      type="button" 
                      id="guide-search-clear"
                      class="absolute right-3 text-slate-500 hover:text-slate-900 cursor-pointer"
                      title="Tozalash"
                    >
                      ✕
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- High-Contrast Role Selector Buttons (Aniq ko'rinadigan menyu tugmalari) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              ${Object.entries(GUIDE_TABS).map(([key, tab]) => {
                const isActive = !isSearching && savedGuideTab === key;
                return `
                  <button 
                    type="button"
                    data-guide-tab="${key}"
                    class="guide-tab-btn p-4 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between gap-3 border-2 ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/25 scale-[1.01]'
                        : 'bg-slate-50 hover:bg-indigo-50/60 text-slate-900 border-slate-300 hover:border-indigo-400'
                    }"
                  >
                    <div class="min-w-0">
                      <div class="text-xs font-bold ${isActive ? 'text-indigo-200' : 'text-indigo-600'}">
                        6 qadamli yo'riqnoma
                      </div>
                      <div class="text-sm sm:text-base font-black truncate mt-0.5 ${isActive ? 'text-white' : 'text-slate-950'}">
                        ${escapeHtml(tab.label)}
                      </div>
                    </div>
                    <svg class="w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Active Guide Banner -->
            <div class="p-5 sm:p-6 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
              <div class="space-y-1">
                <h3 class="text-lg sm:text-xl font-black text-white">
                  ${isSearching ? `Qidiruv natijalari: "${escapeHtml(savedGuideSearch)}" (${displayedSteps.length} ta qoida topildi)` : escapeHtml(activeGuide.title)}
                </h3>
                <p class="text-xs sm:text-sm text-slate-300">
                  ${isSearching ? "Barcha qo'llanmalar bo'yicha topilgan bandlar" : escapeHtml(activeGuide.subtitle)}
                </p>
              </div>
              <button 
                type="button"
                id="guide-banner-login-btn"
                class="px-5 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs sm:text-sm font-black transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Tizimga kirish &rarr;
              </button>
            </div>

            <!-- Steps Grid -->
            ${displayedSteps.length > 0 ? `
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${displayedSteps.map((step) => `
                  <div class="animate-landing-card landing-hover-lift p-6 rounded-3xl bg-white border-2 border-slate-200 hover:border-indigo-400 shadow-sm flex flex-col justify-between space-y-4">
                    <div class="space-y-3">
                      <div class="flex items-center justify-between gap-2">
                        <span class="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-mono font-black tabular-nums">
                          QADAM ${step.num}
                        </span>
                        ${step.categoryLabel ? `
                          <span class="text-xs font-bold text-indigo-700">${escapeHtml(step.categoryLabel)}</span>
                        ` : `
                          <span class="text-xs font-bold text-slate-500">${escapeHtml(activeGuide.shortLabel)}</span>
                        `}
                      </div>

                      <h4 class="text-base sm:text-lg font-black text-slate-950 leading-snug">
                        ${escapeHtml(step.title)}
                      </h4>

                      <p class="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        ${escapeHtml(step.desc)}
                      </p>
                    </div>

                    ${step.tip ? `
                      <div class="p-3.5 rounded-2xl bg-indigo-50/90 border border-indigo-200 text-xs text-indigo-950 leading-relaxed">
                        <strong class="font-extrabold text-indigo-800">Muhim eslatma:</strong> ${escapeHtml(step.tip)}
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="p-10 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-3">
                <p class="text-base font-bold text-slate-800">"${escapeHtml(savedGuideSearch)}" bo'yicha qo'llanma bandi topilmadi.</p>
                <button type="button" id="reset-guide-search-btn" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">
                  Barcha qo'llanmalarni ko'rsatish
                </button>
              </div>
            `}

          </div>
        </section>

        <!-- ========================================================================= -->
        <!-- SECTION 2: ASOSIY IMKONIYATLAR VA TIZIM ARXITEKTURASI (BENTO GRID)        -->
        <!-- ========================================================================= -->
        <section id="imkoniyatlar" class="py-14 sm:py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <div class="max-w-3xl space-y-2 mb-10">
            <p class="text-xs font-extrabold text-indigo-600">Platforma modullari</p>
            <h2 class="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight" style="text-wrap: balance;">
              MaktabX Asosiy Imkoniyatlari va Afzalliklari
            </h2>
            <p class="text-sm sm:text-base text-slate-700 leading-relaxed">
              Maktab ma'muriyati va sinf rahbarlarining kundalik ishini osonlashtiruvchi 4 ta asosiy texnologik modul:
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <!-- Feature 01 (Span 2) -->
            <div class="md:col-span-2 landing-hover-lift bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div class="space-y-3">
                <div class="text-xs font-bold text-indigo-600">
                  <span>Asosiy modul</span>
                  <span class="mx-1.5" aria-hidden="true">·</span>
                  <span>Avto-qoralama (Draft) va Jinsni avtomatik aniqlash</span>
                </div>
                <h3 class="text-xl sm:text-2xl font-black text-slate-950">
                  01. 24 bandli Rasmiy O'quvchi Dosyesi va Anketasi
                </h3>
                <p class="text-sm sm:text-base text-slate-700 leading-relaxed">
                  Har bir o'quvchi uchun 24 ta rasmiy banddan iborat shaxsiy anketa yuritiladi: F.I.SH, tug'ilgan sanasi va joyi, FHDYO organi va guvohnoma seriyasi, pasport hamda 14 xonali JSHSHIR (PINFL), ota va onasining pasport/ish joyi/telefon ma'lumotlari, yashash manzili va qo'shimcha to'garaklar. Ma'lumot kiritish paytida sahifa yangilanib ketsa ham, qoralama (Draft) tizimi yozilganlarni yo'qotmaydi.
                </p>
              </div>
              <div class="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-700">
                <span>FHDYO va Guvohnoma</span>
                <span aria-hidden="true">·</span>
                <span>14 xonali JSHSHIR (PINFL)</span>
                <span aria-hidden="true">·</span>
                <span>Ota-ona pasporti va ish joyi</span>
                <span aria-hidden="true">·</span>
                <span>To'garaklar hisobi</span>
              </div>
            </div>

            <!-- Feature 02 (Span 1) -->
            <div class="landing-hover-lift bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div class="space-y-3">
                <div class="text-xs font-bold text-emerald-700">
                  <span>Eksport moduli</span>
                  <span class="mx-1.5" aria-hidden="true">·</span>
                  <span>A4 Print tayyor</span>
                </div>
                <h3 class="text-xl font-black text-slate-950">
                  02. Word, Excel va PDF Hujjatlar Generatsiyasi
                </h3>
                <p class="text-sm text-slate-700 leading-relaxed">
                  Sinf o'quvchilari ro'yxatini yoki alohida o'quvchining rasmiy ma'lumotnoma-dosyesini birgina tugma orqali Word (.docx), Excel (.xlsx) yoki PDF (.pdf) formatida yuklab oling hamda qog'ozga chop eting.
                </p>
              </div>
              <div class="pt-4 border-t border-slate-200 text-xs font-bold text-slate-700">
                <span>Rasmiy ma'lumotnoma shabloni · Jadval eksporti</span>
              </div>
            </div>

            <!-- Feature 03 (Span 1) -->
            <div class="landing-hover-lift bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div class="space-y-3">
                <div class="text-xs font-bold text-blue-700">
                  <span>Integratsiya</span>
                  <span class="mx-1.5" aria-hidden="true">·</span>
                  <span>Yagona parollar bazasi</span>
                </div>
                <h3 class="text-xl font-black text-slate-950">
                  03. eMaktab (Kundalik.com) va Ta'lim Platformalari
                </h3>
                <p class="text-sm text-slate-700 leading-relaxed">
                  O'quvchilarning Kundalik.com (eMaktab), Khan Academy, Kitob.uz va Edu.uz tizimlaridagi login hamda parollarini yo'qotib qo'ymaslik uchun sinf kabinetida markazlashgan holda saqlang va bir bosishda nusxalang.
                </p>
              </div>
              <div class="pt-4 border-t border-slate-200 text-xs font-bold text-slate-700">
                <span>Dublikatlarni avto-tozalash · Tezkor nusxalash</span>
              </div>
            </div>

            <!-- Feature 04 (Span 2) -->
            <div class="md:col-span-2 landing-hover-lift bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div class="space-y-3">
                <div class="text-xs font-bold text-amber-700">
                  <span>Intizom va Davomat</span>
                  <span class="mx-1.5" aria-hidden="true">·</span>
                  <span>1-smena va 2-smena navbatchilik tizimi</span>
                </div>
                <h3 class="text-xl sm:text-2xl font-black text-slate-950">
                  04. Mas'ul Navbatchi Davomati, Avto-Zaxira va Ota-onalarga SMS
                </h3>
                <p class="text-sm sm:text-base text-slate-700 leading-relaxed">
                  Maktab ma'muriyati haftalik navbatchilik jadvalini tuzadi. Har kuni davomatni faqat o'sha kungi Mas'ul Navbatchi o'qituvchi oladi. O'quvchini «Sababli» deb belgilaganda majburiy sabab izohi (Betoblik, Ota-ona arizasi, Safar, Olimpiada) kiritiladi. Navbatchi o'qituvchi maktabga kela olmasa, tizim navbatchilikni avtomatik Zaxira o'qituvchiga o'tkazadi va Adminga xabar beradi. Dars qoldirgan o'quvchining ota-onasiga DevSMS orqali SMS yuboriladi.
                </p>
              </div>
              <div class="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-700">
                <span>Smenali jadval</span>
                <span aria-hidden="true">·</span>
                <span>Majburiy sabab izohi</span>
                <span aria-hidden="true">·</span>
                <span>Avtomatik zaxira navbatchi</span>
                <span aria-hidden="true">·</span>
                <span>DevSMS xabarnoma</span>
              </div>
            </div>

          </div>
        </section>

        <!-- ========================================================================= -->
        <!-- SECTION 3: 24 BANDLI O'QUVCHI DOSYESI TUZILMASI (COMPLETE FIELD SPEC)     -->
        <!-- ========================================================================= -->
        <section id="dosye-tarkibi" class="py-14 sm:py-20 px-4 sm:px-8 lg:px-12 bg-white border-y border-slate-200">
          <div class="max-w-7xl mx-auto">
            <div class="max-w-3xl space-y-2 mb-10">
              <p class="text-xs font-extrabold text-indigo-600">Ma'lumotlar standarti</p>
              <h2 class="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight" style="text-wrap: balance;">
                O'quvchining 24 Bandli Rasmiy Dosyesiga Nimalar Kiradi?
              </h2>
              <p class="text-sm sm:text-base text-slate-700 leading-relaxed">
                MaktabX tizimida har bir o'quvchi bo'yicha quyidagi 4 ta asosiy blokdagi 24 ta ma'lumot to'liq shakllantiriladi:
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <!-- Block 1 -->
              <div class="landing-hover-lift bg-slate-50 rounded-3xl p-6 border-2 border-slate-200 space-y-4">
                <div class="border-b-2 border-indigo-500 pb-3">
                  <span class="text-xs font-mono text-indigo-700 font-black tabular-nums">01-BLOK (1–8-bandlar)</span>
                  <h3 class="text-lg font-black text-slate-950 mt-0.5">Shaxsiy Ma'lumotlar</h3>
                </div>
                <ul class="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-800">
                  <li>01. Familiyasi, Ismi, Otasining ismi</li>
                  <li>02. Tug'ilgan sanasi (kun, oy, yil)</li>
                  <li>03. Avtomatik hisoblanuvchi yoshi</li>
                  <li>04. Jinsi (O'g'il / Qiz)</li>
                  <li>05. Tug'ilgan joyi (viloyat, tuman)</li>
                  <li>06. O'quvchi telefon raqami</li>
                  <li>07. Elektron pochta (Email)</li>
                  <li>08. Doimiy yashash manzili (MFY, ko'cha)</li>
                </ul>
              </div>

              <!-- Block 2 -->
              <div class="landing-hover-lift bg-slate-50 rounded-3xl p-6 border-2 border-slate-200 space-y-4">
                <div class="border-b-2 border-emerald-500 pb-3">
                  <span class="text-xs font-mono text-emerald-700 font-black tabular-nums">02-BLOK (9–14-bandlar)</span>
                  <h3 class="text-lg font-black text-slate-950 mt-0.5">Guvohnoma va Pasport</h3>
                </div>
                <ul class="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-800">
                  <li>09. Guvohnoma bergan FHDYO organi</li>
                  <li>10. Dalolatnoma yozuvi raqami</li>
                  <li>11. Guvohnoma berilgan sana</li>
                  <li>12. Guvohnoma seriyasi va raqami</li>
                  <li>13. Pasport / ID-karta seriya va raqami</li>
                  <li>14. 14 xonali JSHSHIR (PINFL) raqami</li>
                </ul>
              </div>

              <!-- Block 3 -->
              <div class="landing-hover-lift bg-slate-50 rounded-3xl p-6 border-2 border-slate-200 space-y-4">
                <div class="border-b-2 border-amber-500 pb-3">
                  <span class="text-xs font-mono text-amber-700 font-black tabular-nums">03-BLOK (15–20-bandlar)</span>
                  <h3 class="text-lg font-black text-slate-950 mt-0.5">Ota-ona Ma'lumotlari</h3>
                </div>
                <ul class="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-800">
                  <li>15. Onasining F.I.SH va tug'ilgan yili</li>
                  <li>16. Onasining pasport seriyasi va JSHSHIR</li>
                  <li>17. Onasining ish joyi va telefon raqami</li>
                  <li>18. Otasining F.I.SH va tug'ilgan yili</li>
                  <li>19. Otasining pasport seriyasi va JSHSHIR</li>
                  <li>20. Otasining ish joyi va telefon raqami</li>
                </ul>
              </div>

              <!-- Block 4 -->
              <div class="landing-hover-lift bg-slate-50 rounded-3xl p-6 border-2 border-slate-200 space-y-4">
                <div class="border-b-2 border-blue-500 pb-3">
                  <span class="text-xs font-mono text-blue-700 font-black tabular-nums">04-BLOK (21–24-bandlar)</span>
                  <h3 class="text-lg font-black text-slate-950 mt-0.5">Platforma va To'garaklar</h3>
                </div>
                <ul class="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-800">
                  <li>21. Kundalik.com (eMaktab) login/paroli</li>
                  <li>22. Khan Academy / Kitob.uz / Edu.uz</li>
                  <li>23. Qo'shimcha fan va sport to'garaklari</li>
                  <li>24. O'quv markazi manzili va ustoz telefoni</li>
                </ul>
              </div>

            </div>
          </div>
        </section>

        <!-- ========================================================================= -->
        <!-- SECTION 4: TEZ-TEZ SO'RALADIGAN SAVOLLAR (HIGH-CONTRAST FAQ)              -->
        <!-- ========================================================================= -->
        <section id="savol-javob" class="py-14 sm:py-20 px-4 sm:px-8 lg:px-12 max-w-5xl mx-auto">
          <div class="space-y-8">
            <div class="space-y-2">
              <p class="text-xs font-extrabold text-indigo-600">Amaliy yordam</p>
              <h2 class="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
                Ko'p So'raladigan Savollar va Yechimlar
              </h2>
              <p class="text-sm sm:text-base text-slate-700">
                Savol ustiga bosib, batafsil yechim va yo'riqnoma bilan tanishing.
              </p>
            </div>

            <div class="space-y-3.5">
              ${FAQ_ITEMS.map((item, idx) => {
                const isOpen = savedFaqIndex === idx;
                return `
                  <div class="rounded-2xl bg-white border-2 transition-all ${isOpen ? 'border-indigo-600 shadow-md' : 'border-slate-200 hover:border-slate-300'}">
                    <button 
                      type="button"
                      data-faq-idx="${idx}"
                      class="faq-toggle-btn w-full flex items-center justify-between gap-4 text-left p-5 cursor-pointer"
                    >
                      <span class="text-sm sm:text-base font-black ${isOpen ? 'text-indigo-700' : 'text-slate-950'}">
                        0${idx + 1}. ${escapeHtml(item.q)}
                      </span>
                      <span class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}">
                        <svg class="w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </span>
                    </button>
                    ${isOpen ? `
                      <div class="px-5 pb-5 pt-1 border-t border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                        ${escapeHtml(item.a)}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </section>

        <!-- ========================================================================= -->
        <!-- SECTION 5: MUALLIF (WORKING CODE), ALOQA VA LOGIN CTA                     -->
        <!-- ========================================================================= -->
        <section id="muallif-aloqa" class="py-12 sm:py-18 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            <!-- Left: Author & Support Info -->
            <div class="lg:col-span-7 bg-gradient-to-br from-slate-950 via-[#091e26] to-slate-900 text-white rounded-3xl p-6 sm:p-10 flex flex-col justify-between space-y-6 border border-slate-800 shadow-xl">
              <div class="space-y-5">
                <div class="flex items-center gap-4">
                  <div class="w-15 h-15 rounded-2xl bg-white flex items-center justify-center p-2 shrink-0 shadow-md animate-working-code-float">
                    <img src="/working-code-logo.svg" alt="WORKING CODE" class="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p class="text-xs text-cyan-300 font-bold">Platforma Muallifi va Bosh Dasturchi</p>
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight text-white">${escapeHtml(dev.brand || 'WORKING CODE')}</h2>
                  </div>
                </div>

                <p class="text-sm sm:text-base text-slate-200 leading-relaxed">
                  ${escapeHtml(dev.bio || "MaktabX axborot tizimi O'zbekiston Respublikasi maktab ta'limi tizimi uchun WORKING CODE brendi tomonidan ishlab chiqilgan va 24/7 rejimda texnik qo'llab-quvvatlanadi.")}
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <a 
                    href="https://t.me/${tgUser}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="px-4 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-sm"
                  >
                    <span>Telegram: @${escapeHtml(tgUser)}</span>
                  </a>
                  <a 
                    href="tel:${cleanPhone}"
                    class="px-4 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-sm"
                  >
                    <span>Tel: ${escapeHtml(dev.phone || '+998 90 000 12 34')}</span>
                  </a>
                  <a 
                    href="mailto:${escapeHtml(dev.email || 'diyorbek.dev1510@gmail.com')}"
                    class="px-4 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>Email yuborish</span>
                  </a>
                </div>
              </div>

              <div class="pt-5 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="text-xs sm:text-sm text-slate-200 font-medium">
                  Shaxsiy kabinetingizga kirishga tayyormisiz?
                </div>
                <button 
                  type="button"
                  id="bottom-cta-login-btn"
                  class="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shadow-lg"
                >
                  Tizimga kirish (Login) &rarr;
                </button>
              </div>
            </div>

            <!-- Right: Quick Support Message Form -->
            <div class="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-5">
              <div>
                <h3 class="text-lg sm:text-xl font-black text-slate-950">Dasturchiga Tezkor Murojaat</h3>
                <p class="text-xs sm:text-sm text-slate-600 mt-1">
                  Savol, taklif yoki maktabingizni tizimga ulash bo'yicha to'g'ridan-to'g'ri xabar qoldiring.
                </p>
              </div>

              <form id="landing-support-form" class="space-y-4">
                <div>
                  <label for="landing-sender-name" class="block text-xs font-extrabold text-slate-800 mb-1.5">
                    Ism-sharifingiz va maktabingiz:
                  </label>
                  <input 
                    type="text"
                    id="landing-sender-name"
                    placeholder="Masalan: 15-maktab, Karimov Sardor"
                    class="w-full px-4 py-3 text-xs sm:text-sm bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-900 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label for="landing-support-topic" class="block text-xs font-extrabold text-slate-800 mb-1.5">
                    Murojaat mavzusi:
                  </label>
                  <select 
                    id="landing-support-topic"
                    class="w-full px-4 py-3 text-xs sm:text-sm bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-900 font-semibold"
                  >
                    <option value="Yangi maktab yoki sinfni tizimga ulash">Yangi maktab yoki sinfni tizimga ulash</option>
                    <option value="Login, parol yoki PIN-kodni tiklash">Login, parol yoki PIN-kodni tiklash</option>
                    <option value="Davomat va navbatchilik bo'yicha savol">Davomat va navbatchilik bo'yicha savol</option>
                    <option value="Taklif va hamkorlik">Taklif va hamkorlik</option>
                  </select>
                </div>

                <div>
                  <label for="landing-support-msg" class="block text-xs font-extrabold text-slate-800 mb-1.5">
                    Xabar matni:
                  </label>
                  <textarea 
                    id="landing-support-msg"
                    rows="3"
                    placeholder="Murojaatingizni qisqacha yozing..."
                    class="w-full px-4 py-3 text-xs sm:text-sm bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-900 font-semibold"
                    required
                  ></textarea>
                </div>

                <button 
                  type="submit"
                  class="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black transition-colors cursor-pointer shadow-md"
                >
                  Telegram orqali yuborish
                </button>
              </form>
            </div>

          </div>
        </section>

        <!-- ========================================================================= -->
        <!-- QUIET FOOTER                                                              -->
        <!-- ========================================================================= -->
        <footer class="bg-white border-t border-slate-200 py-8 px-4 sm:px-8 lg:px-12 text-xs text-slate-600 font-semibold">
          <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-2.5">
              <img src="/maktabx-logo.png" alt="MaktabX" class="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
              <span class="font-black text-slate-950">${escapeHtml(info.title || 'MaktabX')}</span>
              <span aria-hidden="true">·</span>
              <span>© ${escapeHtml(info.releaseYear || '2026')} ${escapeHtml(dev.brand || 'WORKING CODE')}</span>
            </div>
            <div class="flex flex-wrap items-center gap-6">
              <button type="button" id="footer-about-btn" class="hover:text-slate-950 transition-colors cursor-pointer font-bold">Platforma haqida</button>
              <button type="button" id="footer-recovery-btn" class="hover:text-slate-950 transition-colors cursor-pointer font-bold">Parolni tiklash</button>
              <button type="button" id="footer-login-btn" class="font-black text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer">Tizimga kirish &rarr;</button>
            </div>
          </div>
        </footer>

      </div>
    `;

    // Attach Event Listeners
    const loginTriggerIds = [
      'header-login-btn',
      'hero-login-btn',
      'card-login-btn',
      'guide-banner-login-btn',
      'bottom-cta-login-btn',
      'footer-login-btn'
    ];

    loginTriggerIds.forEach(id => {
      const btn = container.querySelector(`#${id}`);
      if (btn && onGoToLogin) {
        btn.addEventListener('click', () => onGoToLogin());
      }
    });

    const recoveryTriggerIds = ['header-recovery-btn', 'hero-recovery-btn', 'footer-recovery-btn'];
    recoveryTriggerIds.forEach(id => {
      const btn = container.querySelector(`#${id}`);
      if (btn && onForgotPassword) {
        btn.addEventListener('click', () => onForgotPassword(''));
      }
    });

    const footerAboutBtn = container.querySelector('#footer-about-btn');
    if (footerAboutBtn && onOpenAbout) {
      footerAboutBtn.addEventListener('click', () => onOpenAbout());
    }

    // Quick guide cards in Hero right panel -> switch tab & scroll to #qollanmalar
    container.querySelectorAll('.quick-guide-card').forEach(card => {
      card.addEventListener('click', () => {
        const targetTab = card.getAttribute('data-quick-guide');
        if (targetTab && GUIDE_TABS[targetTab]) {
          savedGuideTab = targetTab;
          savedGuideSearch = '';
          render();
          const sec = container.querySelector('#qollanmalar');
          if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Guide Tabs
    container.querySelectorAll('.guide-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-guide-tab');
        if (tab && GUIDE_TABS[tab]) {
          savedGuideTab = tab;
          savedGuideSearch = '';
          render();
        }
      });
    });

    // Guide Search Input
    const searchInput = container.querySelector('#guide-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        savedGuideSearch = e.target.value;
        const caretPos = e.target.selectionStart;
        render();
        const nextInput = container.querySelector('#guide-search-input');
        if (nextInput) {
          nextInput.focus();
          try {
            nextInput.setSelectionRange(caretPos, caretPos);
          } catch (_) {}
        }
      });
    }

    const clearSearchBtn = container.querySelector('#guide-search-clear');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        savedGuideSearch = '';
        render();
      });
    }

    const resetSearchBtn = container.querySelector('#reset-guide-search-btn');
    if (resetSearchBtn) {
      resetSearchBtn.addEventListener('click', () => {
        savedGuideSearch = '';
        render();
      });
    }

    // FAQ Toggles
    container.querySelectorAll('.faq-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-faq-idx'));
        savedFaqIndex = savedFaqIndex === idx ? -1 : idx;
        render();
      });
    });

    // Smooth scroll for internal section links
    container.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (!href || href.length < 2) return;
        const targetEl = container.querySelector(href);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    if (mainScrollEl && prevScrollTop > 0) {
      mainScrollEl.scrollTop = prevScrollTop;
    }

    // Support Form
    const supportForm = container.querySelector('#landing-support-form');
    if (supportForm) {
      supportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const sender = (container.querySelector('#landing-sender-name')?.value || '').trim();
        const topic = (container.querySelector('#landing-support-topic')?.value || 'Murojaat').trim();
        const msg = (container.querySelector('#landing-support-msg')?.value || '').trim();
        if (!sender || !msg) {
          if (showToast) showToast("Iltimos, ism-sharifingiz va xabar matnini kiriting!", "error");
          return;
        }
        const text = `Salom, WORKING CODE! MaktabX bosh sahifasidan murojaat:\n👤 Kimdan: ${sender}\n📌 Mavzu: ${topic}\n💬 Xabar: ${msg}`;
        const tgLink = `https://t.me/${tgUser}?text=${encodeURIComponent(text)}`;
        const a = document.createElement('a');
        a.href = tgLink;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (showToast) showToast("Telegram orqali yuborish oynasi ochildi!", "success");
      });
    }
  }

  render();
}
