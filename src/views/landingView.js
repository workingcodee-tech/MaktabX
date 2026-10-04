/**
 * MaktabX - Rasmiy Kutib Olish Sahifasi va To'liq Qo'llanmalar Markazi (Landing & Documentation View)
 * Saytga kirgan foydalanuvchini MaktabX haqidagi barcha ma'lumotlar, tizim arxitekturasi,
 * har bir rol uchun qadamma-qadam yo'riqnomalar, 24 bandli dosye tuzilmasi va "Tizimga kirish" tugmasi bilan kutib oladi.
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
      title: "Sinf Rahbari (O'qituvchi) Qo'llanmasi",
      subtitle: "Sinfga biriktirilgan o'quvchilar, kunlik navbatchilik davomati, platformalar va eksport bo'yicha to'liq yo'riqnoma",
      steps: [
        {
          num: "01",
          title: "Kabinetga kirish va birinchi PIN-kodni o'rnatish",
          desc: "Maktab ma'muriyati (Admin) tomonidan berilgan sinf logini (masalan: 9-A) va parol orqali tizimga kiring. Ilk bor kirganingizda xavfsizlik uchun 4 xonali shaxsiy PIN-kod o'rnatish oynasi avtomatik ochiladi. Keyingi safar saytni ochganingizda sessiyangiz saqlanib qoladi va faqatgina 4 xonali PIN-kod yoki Face ID orqali bir soniyada kabinetga kirasiz."
        },
        {
          num: "02",
          title: "O'quvchi qo'shish va 24 bandli dosye yuritish",
          desc: "Asosiy sahifadagi «Yangi o'quvchi» tugmasini bosib, o'quvchining F.I.SH, tug'ilgan sanasi, guvohnoma/pasport seriyasi, 14 xonali JSHSHIR (PINFL), yashash manzili, ota-onasining ma'lumotlari hamda qo'shimcha to'garaklarini kiritasiz. Tizim ism-sharifga qarab o'quvchi jinsini avtomatik aniqlaydi va ma'lumot to'ldirilayotgan vaqtda qoralamani (Draft) xotirada saqlab boradi."
        },
        {
          num: "03",
          title: "Kunlik davomat olish va Mas'ul Navbatchi qoidasi",
          desc: "Maktab tartibiga binoan, davomatni har kuni smena bo'yicha biriktirilgan Mas'ul Navbatchi sinf rahbari oladi. Agar bugun sizning navbatchilik kuningiz bo'lsa, pastki menyudagi «Davomat» bo'limida sariq yulduzcha yonadi va barcha sinflar bo'yicha o'quvchilarni «Kelgan», «Sababli» yoki «Sababsiz» deb belgilash imkoniyati ochiladi. Boshqa kunlari esa bugungi navbatchi kimligini va o'z sinfingiz davomat ko'rsatkichini kuzatishingiz mumkin."
        },
        {
          num: "04",
          title: "O'quvchini «Sababli» deb belgilash va SMS bildirishnoma",
          desc: "Darsga kelmagan o'quvchini «Sababli» deb belgilashda tizim majburiy izoh kiritishni so'raydi. Tayyor shablonlardan birini (Betoblik / Shifoxona, Ota-ona arizasi, Oilaviy safar, Musobaqa / Olimpiada) tanlashingiz yoki o'z izohingizni yozishingiz mumkin. Shuningdek, dars qoldirgan o'quvchining ota-onasiga DevSMS shlyuzi orqali rasmiy SMS xabarnoma yuborish imkoniyati mavjud."
        },
        {
          num: "05",
          title: "Navbatchilik kunida kela olmaslikni bildirish (Avto-Zaxira)",
          desc: "Agar siz bugun navbatchi bo'lsangiz, biroq uzrli sabab bilan maktabga kela olmasangiz, Davomat bo'limidagi «Kelolmaslikni bildirish» tugmasini bosib sababni ko'rsating. Tizim avtomatik ravishda navbatchilik vazifasini jadvaldagi Zaxira o'qituvchiga o'tkazadi va Maktab Adminiga tezkor xabarnoma yuboradi."
        },
        {
          num: "06",
          title: "Ta'lim platformalari (eMaktab / Kundalik) va Hujjat eksporti",
          desc: "«Platformalar» bo'limida har bir o'quvchining Kundalik.com (eMaktab), Khan Academy, Kitob.uz va Edu.uz tizimlaridagi login hamda parollarini yagona jadvalda saqlang. Sinf ro'yxatini yoki alohida o'quvchi anketasini Word (.docx), Excel (.xlsx), PDF (.pdf) formatlarida yuklab oling yoki printerda chop eting."
        }
      ]
    },
    admin: {
      title: "Maktab Administratori (Ma'muriyat) Qo'llanmasi",
      subtitle: "Maktab bo'yicha sinflar, smenalar, navbatchilik jadvali, davomat tahlili va xavfsizlik nazorati",
      steps: [
        {
          num: "01",
          title: "Sinflar va sinf rahbarlari kabinetlarini shakllantirish",
          desc: "Admin panelidan maktabdagi barcha sinflarni (masalan: 1-A dan 11-B gacha) yarating, har bir sinfga sinf rahbari F.I.SH, telefon raqami, kirish logini va parolini biriktiring. Tizim har bir sinf rahbari uchun avtomatik ravishda 6 xonali noyob Tiklash ID (REC-XXXXXX) raqamini generatsiya qiladi."
        },
        {
          num: "02",
          title: "Smenalar (1-smena / 2-smena) va Navbatchilik jadvalini tuzish",
          desc: "«Davomat» bo'limida o'quv smenalarini (masalan, 1-smena 08:00–13:00, 2-smena 13:00–18:00) yarating va sinflarni tegishli smenalarga biriktiring. Haftaning har bir kuni (Dushanbadan Shanbagacha) uchun asosiy mas'ul navbatchi va zaxira navbatchi o'qituvchilarni tayinlang."
        },
        {
          num: "03",
          title: "Jonli davomat monitoringi va grafik statistika",
          desc: "Maktab bo'yicha bugungi va o'tgan kunlardagi davomat foizini, sababli va sababsiz dars qoldirgan o'quvchilar ro'yxatini hamda sinflar kesimidagi dinamik grafik tahlillarni kuzating. Zarur hollarda adminning o'zi ham bevosita davomat olishi yoki tahrirlashi mumkin."
        },
        {
          num: "04",
          title: "Navbatchi o'qituvchilar uzrli sabablarini nazorat qilish",
          desc: "Agar navbatchi o'qituvchi maktabga kela olmasligini bildirsa, Admin panelining bildirishnomalar markaziga darhol ogohlantirish kelib tushadi: kim kelolmagani, sababi va tizim kimni zaxira navbatchi etib tayinlagani aniq ko'rsatiladi."
        },
        {
          num: "05",
          title: "O'qituvchilar parolini tiklash so'rovlarini tasdiqlash",
          desc: "Parolini unutgan o'qituvchi o'z Tiklash ID raqami orqali so'rov yuborganda, Admin panelida yangi so'rov paydo bo'ladi. Admin bitta tugma bilan ruxsat bergach, o'qituvchi o'z qurilmasida avtomatik ravishda tizimga kiradi va yangi parol o'rnatadi. Shuningdek, admin o'qituvchining 4 xonali PIN-kodini ham masofadan bekor qila oladi."
        },
        {
          num: "06",
          title: "Umumiy maktab qidiruvi va 7 kunlik Arxiv (Savat)",
          desc: "Butun maktab o'quvchilarini F.I.SH, JSHSHIR (PINFL), tug'ilgan sana yoki ota-onasi ma'lumotlari bo'yicha bir zumda toping. Tasodifan o'chirilgan sinf yoki o'quvchi ma'lumotlari 7 kun davomida Arxivda saqlanadi va osongina qayta tiklanadi."
        }
      ]
    },
    security: {
      title: "Xavfsizlik, PIN-kod, Face ID va Parolni Tiklash",
      subtitle: "Ko'p bosqichli himoya mexanizmlari va hisobga kirishni tiklashning 2 xil ishonchli usuli",
      steps: [
        {
          num: "01",
          title: "4 xonali Kabinet PIN-kodi va Avto-Qulflash",
          desc: "Har bir o'qituvchi va maktab admini o'z kabinetiga 4 xonali PIN-kod o'rnatadi. Tizimdan chiqmasdan brauzer yopib ochilganda yoki yuqoridagi «Qulflash» tugmasi bosilganda, begona shaxslar ma'lumotlarni ko'ra olmasligi uchun PIN-kod ekrani faollashadi."
        },
        {
          num: "02",
          title: "Sun'iy intellektga asoslangan Face ID biometrik tizimi",
          desc: "Sozlamalar bo'limidan qurilma kamerasi orqali yuzingizni ro'yxatdan o'tkazing (Face ID). Shundan so'ng PIN-kod terish o'rniga yuz biometrik tasdig'i orqali kabinet qulfini 1 soniyada ochishingiz mumkin."
        },
        {
          num: "03",
          title: "1-usul: SMS kod (OTP) orqali parolni mustaqil tiklash",
          desc: "Login sahifasidagi «Parolni unutdingizmi?» tugmasini bosing va «SMS kod orqali» bo'limiga o'ting. Profilingizga biriktirilgan telefon raqamingizni kiriting — DevSMS tizimi orqali telefoningizga 6 xonali tasdiqlash kodi boradi. Kodni kiritib, darhol yangi login va parol o'rnatishingiz mumkin."
        },
        {
          num: "04",
          title: "2-usul: Tiklash ID (REC-ID) orqali Admin ruxsati bilan tiklash",
          desc: "Agar telefon raqamingiz yoningizda bo'lmasa yoki SMS limiti tugagan bo'lsa, 6 xonali shaxsiy Tiklash ID raqamingizni kiriting. So'rov real-vaqtda Maktab Adminiga yuboriladi. Admin tasdiqlashi bilan sahifangiz avtomatik ravishda kabinetga kiradi va yangi parol o'rnatish oynasini ochib beradi."
        },
        {
          num: "05",
          title: "Cloud Firestore Real-Time Sinxronizatsiya va Oflayn Kesh",
          desc: "Kiritilgan barcha ma'lumotlar Google Cloud Firestore bulutli bazasida shifrlangan holda saqlanadi hamda telefon, planshet va kompyuterda bir vaqtning o'zida jonli yangilanadi. Internet vaqtincha uzilganda ham lokal xotira (kesh) tufayli ish jarayoni to'xtab qolmaydi."
        },
        {
          num: "06",
          title: "7 kunlik Arxiv (Trash) va Ma'lumotlar Daxlsizligi",
          desc: "Tizimdan o'chirilgan maktab, sinf yoki o'quvchi ma'lumotlari darhol yo'q bo'lib ketmaydi — ular 7 kun davomida maxsus Arxiv savatida saqlanadi va zarurat tug'ilganda barcha bog'liq o'quvchilari bilan birga to'liq qayta tiklanadi."
        }
      ]
    },
    dossier: {
      title: "24 Bandli O'quvchi Dosyesi va Eksport Tizimi",
      subtitle: "Har bir o'quvchi bo'yicha yuritiladigan rasmiy ma'lumotlar tarkibi hamda Word, Excel, PDF eksport qoidalari",
      steps: [
        {
          num: "01",
          title: "1-blok: Shaxsiy va Aloqa Ma'lumotlari (8 ta maydon)",
          desc: "Familiyasi, Ismi, Otasining ismi (to'liq F.I.SH), Tug'ilgan sanasi, Avtomatik hisoblanuvchi yoshi, Jinsi (O'g'il / Qiz — ism-sharifdan avtomatik aniqlash bilan), Tug'ilgan joyi (viloyat, tuman), Shaxsiy telefon raqami, Elektron pochta manzili va Doimiy yashash manzili."
        },
        {
          num: "02",
          title: "2-blok: Rasmiy Hujjatlar — Guvohnoma, Pasport va JSHSHIR (6 ta maydon)",
          desc: "Tug'ilganlik haqida guvohnoma bergan FHDYO organi nomi, Dalolatnoma yozuvi raqami, Guvohnoma berilgan sana, Guvohnoma seriyasi va raqami (masalan: I-TN 1234567), Pasport yoki ID-karta seriya va raqami (masalan: AD 1234567), 14 xonali JSHSHIR (PINFL) raqami."
        },
        {
          num: "03",
          title: "3-blok: Ona va Ota haqida To'liq Ma'lumotlar (8+ maydon)",
          desc: "Onasining F.I.SH, tug'ilgan sanasi va yoshi, tug'ilgan joyi, pasport seriyasi, JSHSHIR (PINFL), ish joyi va lavozimi, telefon raqami. Otasining F.I.SH, tug'ilgan sanasi va yoshi, tug'ilgan joyi, pasport seriyasi, JSHSHIR (PINFL), ish joyi va lavozimi, telefon raqami."
        },
        {
          num: "04",
          title: "4-blok: Ta'lim Platformalari va Qo'shimcha To'garaklar",
          desc: "O'quvchining eMaktab (Kundalik.com), Khan Academy, Kitob.uz va boshqa ta'lim platformalaridagi shaxsiy login va parollari. Shuningdek, o'quvchi qatnashadigan fan yoki sport to'garaklari nomi, o'quv markazi, ustozi F.I.SH va telefon raqami."
        },
        {
          num: "05",
          title: "Yakka tartibdagi va Guruhli Eksport (.DOCX, .XLSX, .PDF)",
          desc: "Har bir o'quvchi dosyesi ichida yoki sinf ro'yxati ustida «Eksport» tugmasi mavjud. Word (.docx) formatida rasmiy muhr va imzo o'rinlariga ega ma'lumotnoma, Excel (.xlsx) formatida tartiblangan elektron jadval, PDF (.pdf) formatida esa tayyor chop etish hujjati 1 soniyada yuklab olinadi."
        },
        {
          num: "06",
          title: "Bevosita Chop Etish (A4 Print Layout) va Nusxalash",
          desc: "«Chop etish» tugmasi bosilganda barcha ortiqcha menyular avtomatik yashirilib, o'quvchi dosyesi rasmiy A4 qog'oz o'lchamiga moslashtiriladi. «Nusxalash» tugmasi esa o'quvchining barcha 24 bandli ma'lumotlarini Telegram yoki hujjatga yuborish uchun tayyor matn ko'rinishida xotiraga oladi."
        }
      ]
    }
  };

  const FAQ_ITEMS = [
    {
      q: "Tizimga qanday kiraman? Login va parolni kim beradi?",
      a: "Sinf rahbarlari (o'qituvchilar) uchun login va parol maktab ma'muriyati (Maktab Admini) tomonidan yaratib beriladi. Maktab Admini hisobi esa tizim bosh dasturchisi (WORKING CODE) tomonidan ochiladi. Yuqoridagi «Tizimga kirish» tugmasini bosib, o'z login va parolingizni kiritishingiz mumkin."
    },
    {
      q: "Parolimni yoki kabinet PIN-kodimni unutib qo'ysam nima qilaman?",
      a: "Kirish oynasidagi «Parolni unutdingizmi?» tugmasini bosing. Sizda 2 ta tezkor yechim bor: 1) Profilingizga biriktirilgan telefon raqamiga 6 xonali SMS kod yuborish orqali darhol yangi parol o'rnatish; 2) O'zingizga berilgan 6 xonali Tiklash ID (REC-ID) raqamini kiritib Maktab Adminiga so'rov yuborish — admin tasdiqlashi bilan tizim sizni avtomatik kabinetga kiritadi."
    },
    {
      q: "Nega «Davomat» bo'limida ba'zi kunlari faqat kuzatish rejimi chiqadi?",
      a: "MaktabX tizimida maktab ichki nizomiga asosan kunlik davomatni faqat o'sha smenaning bugungi Mas'ul Navbatchi o'qituvchisi (yoki Maktab Admini) oladi. Siz navbatchi bo'lgan kunlarda davomat olish oynasi to'liq ochiladi; boshqa kunlarda esa bugungi mas'ul navbatchi kimligini va o'z sinfingiz davomat natijalarini ko'rishingiz mumkin."
    },
    {
      q: "Yangi o'quvchi qo'shayotganimda sahifa yangilanib ketsa, yozganlarim o'chib ketadimi?",
      a: "Yo'q, o'chib ketmaydi. MaktabX aqlli qoralama (Auto-Draft) tizimi bilan jihozlangan: yangi o'quvchi anketasiga kiritayotgan har bir harfingiz avtomatik ravishda xotirada saqlanib boradi. Sahifa tasodifan yopilib yoki yangilanib ketsa ham, formani qayta ochganingizda barcha yozganlaringiz joyida turadi."
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

  function render() {
    const mainScrollEl = document.getElementById('main-content');
    const prevScrollTop = mainScrollEl ? mainScrollEl.scrollTop : 0;
    const activeGuide = GUIDE_TABS[savedGuideTab] || GUIDE_TABS.teacher;

    container.innerHTML = `
      <div class="min-h-screen w-full bg-[#F8FAFC] text-slate-900 select-text font-sans">
        
        <!-- ========================================================================= -->
        <!-- TOP BAR (3-ZONE CONTRACT: Brand Wordmark | Nav Links | Primary Action)    -->
        <!-- ========================================================================= -->
        <header class="sticky top-0 z-40 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 lg:px-12">
          <div class="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
            
            <!-- Zone 1: Single text element wordmark -->
            <a href="#top" id="landing-brand-link" class="text-xl font-black tracking-tight text-slate-950 whitespace-nowrap shrink-0">
              ${escapeHtml(info.title || 'MaktabX')}
            </a>

            <!-- Zone 2: 5 clean text navigation links -->
            <nav class="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
              <a href="#imkoniyatlar" class="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap">Imkoniyatlar</a>
              <a href="#qollanmalar" class="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap">Qo'llanmalar</a>
              <a href="#dosye-tarkibi" class="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap">24 Bandli Dosye</a>
              <a href="#savol-javob" class="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap">Savol-javob</a>
              <a href="#muallif-aloqa" class="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap">Muallif va Aloqa</a>
            </nav>

            <!-- Zone 3: Primary actions -->
            <div class="flex items-center gap-2.5 shrink-0">
              <button 
                type="button" 
                id="header-recovery-btn"
                class="hidden sm:inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                Parolni tiklash
              </button>
              <button 
                type="button" 
                id="header-login-btn"
                class="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-sm transition-all whitespace-nowrap cursor-pointer"
              >
                <span>Tizimga kirish</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                </svg>
              </button>
            </div>

          </div>
        </header>

        <!-- ========================================================================= -->
        <!-- HERO SECTION: Proposition + Login CTA + Interactive Ecosystem Preview     -->
        <!-- ========================================================================= -->
        <section id="top" class="relative overflow-hidden bg-gradient-to-b from-slate-950 via-[#081e26] to-slate-900 text-white py-14 sm:py-20 lg:py-24 px-4 sm:px-8 lg:px-12 border-b border-slate-800">
          <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            <!-- Left Column: Editorial Headline & Primary CTA -->
            <div class="lg:col-span-7 space-y-6">
              <div class="flex items-center gap-3 text-xs text-cyan-300/90 font-medium">
                <img src="/maktabx-logo.png" alt="MaktabX" class="w-7 h-7 object-contain rounded-lg bg-white/10 p-1" referrerPolicy="no-referrer" />
                <span>Rasmiy Ta'lim va O'quvchilar Boshqaruv Ekotizimi</span>
                <span aria-hidden="true">·</span>
                <span>Versiya ${escapeHtml(info.version || '2.4.0')}</span>
                <span aria-hidden="true">·</span>
                <span>${escapeHtml(dev.brand || 'WORKING CODE')}</span>
              </div>

              <h1 class="text-3xl sm:text-5xl lg:text-[52px] font-black tracking-tight leading-[1.1] text-white max-w-2xl" style="text-wrap: balance;">
                Maktab ma'lumotlari, kunlik davomat va rasmiy dosyelar yagona tizimda.
              </h1>

              <p class="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                ${escapeHtml(info.description)} Har bir sinf rahbari va maktab ma'muriyati uchun xavfsiz bulutli sinxronizatsiya, smenali navbatchilik nazorati hamda tayyor Word, Excel va PDF hujjatlar generatsiyasi.
              </p>

              <!-- Primary & Secondary Actions -->
              <div class="pt-2 flex flex-wrap items-center gap-3.5">
                <button 
                  type="button" 
                  id="hero-login-btn"
                  class="inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Tizimga kirish (Login)</span>
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                  </svg>
                </button>

                <a 
                  href="#qollanmalar"
                  class="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm sm:text-base transition-colors whitespace-nowrap"
                >
                  <span>To'liq qo'llanmani o'qish</span>
                </a>
              </div>

              <!-- Key Quantitative Facts (Tabular Numerals, Unboxed Metadata) -->
              <div class="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-left">
                <div>
                  <div class="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums">24 ta</div>
                  <div class="text-xs text-slate-400 mt-0.5">Rasmiy o'quvchi dosye bandi</div>
                </div>
                <div>
                  <div class="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tabular-nums">3 format</div>
                  <div class="text-xs text-slate-400 mt-0.5">Word (.docx), Excel va PDF</div>
                </div>
                <div>
                  <div class="text-2xl sm:text-3xl font-black text-cyan-400 font-mono tabular-nums">3 bosqich</div>
                  <div class="text-xs text-slate-400 mt-0.5">Parol, 4 xonali PIN va Face ID</div>
                </div>
                <div>
                  <div class="text-2xl sm:text-3xl font-black text-amber-400 font-mono tabular-nums">24/7</div>
                  <div class="text-xs text-slate-400 mt-0.5">Cloud Firestore jonli sinxron</div>
                </div>
              </div>
            </div>

            <!-- Right Column: Interactive System Overview & Quick Role Access -->
            <div class="lg:col-span-5">
              <div class="bg-slate-900/90 border border-white/15 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl">
                <div class="flex items-center justify-between border-b border-white/10 pb-4">
                  <div class="flex items-center gap-3">
                    <img src="/maktabx-logo.png" alt="MaktabX Logo" class="w-10 h-10 object-contain rounded-xl bg-white p-1.5" referrerPolicy="no-referrer" />
                    <div>
                      <h2 class="text-base font-bold text-white">MaktabX Boshqaruv Tizimi</h2>
                      <p class="text-xs text-slate-400">Foydalanuvchi rollari va tezkor kirish</p>
                    </div>
                  </div>
                  <span class="text-xs font-mono text-emerald-400 tabular-nums">Faol tizim</span>
                </div>

                <!-- 3 Roles Summary -->
                <div class="space-y-3 text-xs sm:text-sm">
                  <div class="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div class="flex items-center justify-between font-bold text-white">
                      <span>01. Sinf Rahbari (O'qituvchi)</span>
                      <span class="text-xs font-normal text-emerald-300">Sinf kabineti</span>
                    </div>
                    <p class="text-xs text-slate-300 mt-1 leading-relaxed">
                      Sinf o'quvchilari dosyesi, navbatchilik kunida maktab davomatini olish, eMaktab parollarini saqlash va hujjatlarni yuklab olish.
                    </p>
                  </div>

                  <div class="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div class="flex items-center justify-between font-bold text-white">
                      <span>02. Maktab Administratori</span>
                      <span class="text-xs font-normal text-cyan-300">Ma'muriyat</span>
                    </div>
                    <p class="text-xs text-slate-300 mt-1 leading-relaxed">
                      Sinflar va o'qituvchilarni qo'shish, 1 va 2-smena navbatchilik jadvalini tuzish, kunlik davomat tahlili va parol tiklash ruxsatlari.
                    </p>
                  </div>

                  <div class="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div class="flex items-center justify-between font-bold text-white">
                      <span>03. Tizim Dasturchisi</span>
                      <span class="text-xs font-normal text-amber-300">WORKING CODE</span>
                    </div>
                    <p class="text-xs text-slate-300 mt-1 leading-relaxed">
                      Maktablar bazasini boshqarish, bulutli xotira nazorati, 7 kunlik arxivdan tiklash va texnik qo'llab-quvvatlash.
                    </p>
                  </div>
                </div>

                <!-- Live DB Snapshot & Direct Login Trigger -->
                <div class="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-white/10">
                  <div class="text-xs text-slate-400 font-mono tabular-nums">
                    Baza: ${schoolsCount} maktab · ${classesCount} sinf · ${studentsCount} o'quvchi
                  </div>
                  <button 
                    type="button" 
                    id="card-login-btn"
                    class="px-5 py-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Kabinetga o'tish &rarr;
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>

        <!-- ========================================================================= -->
        <!-- SECTION 1: ASOSIY IMKONIYATLAR VA TIZIM ARXITEKTURASI (BENTO GRID)        -->
        <!-- ========================================================================= -->
        <section id="imkoniyatlar" class="py-16 sm:py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <div class="max-w-3xl space-y-2 mb-10">
            <p class="text-xs font-semibold text-indigo-600">Tizim imkoniyatlari va modullari</p>
            <h2 class="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight" style="text-wrap: balance;">
              MaktabX qanday ishlaydi va qanday vazifalarni bajaradi?
            </h2>
            <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
              Platforma maktab ichki hujjat aylanishi, sinf rahbarlarining kundalik faoliyati va ma'muriyat nazoratini to'liq raqamlashtirish uchun ishlab chiqilgan.
            </p>
          </div>

          <!-- Asymmetric Bento Grid -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            <!-- Feature 01 (Span 2) -->
            <div class="md:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 flex flex-col justify-between space-y-4">
              <div class="space-y-2.5">
                <div class="text-xs text-slate-500 font-medium">
                  <span>Asosiy modul</span>
                  <span aria-hidden="true">·</span>
                  <span>Avto-qoralama (Draft) va Jinsni avtomatik aniqlash</span>
                </div>
                <h3 class="text-lg sm:text-xl font-bold text-slate-950">
                  01. 24 bandli Rasmiy O'quvchi Dosyesi va Anketasi
                </h3>
                <p class="text-sm text-slate-600 leading-relaxed">
                  Har bir o'quvchi uchun 24 ta rasmiy banddan iborat shaxsiy anketa yuritiladi: F.I.SH, tug'ilgan sanasi va joyi, FHDYO organi va guvohnoma seriyasi, pasport hamda 14 xonali JSHSHIR (PINFL), ota va onasining pasport/ish joyi/telefon ma'lumotlari, yashash manzili va qo'shimcha to'garaklar. Ma'lumot kiritish paytida sahifa yangilanib ketsa ham, qoralama (Draft) tizimi yozilganlarni yo'qotmaydi.
                </p>
              </div>
              <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
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
            <div class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 flex flex-col justify-between space-y-4">
              <div class="space-y-2.5">
                <div class="text-xs text-slate-500 font-medium">
                  <span>Eksport moduli</span>
                  <span aria-hidden="true">·</span>
                  <span>A4 Print tayyor</span>
                </div>
                <h3 class="text-lg sm:text-xl font-bold text-slate-950">
                  02. Word, Excel va PDF Hujjatlar Generatsiyasi
                </h3>
                <p class="text-sm text-slate-600 leading-relaxed">
                  Sinf o'quvchilari ro'yxatini yoki alohida o'quvchining rasmiy ma'lumotnoma-dosyesini birgina tugma orqali Word (.docx), Excel (.xlsx) yoki PDF (.pdf) formatida yuklab oling hamda qog'ozga chop eting.
                </p>
              </div>
              <div class="pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span>Rasmiy ma'lumotnoma shabloni · Jadval eksporti</span>
              </div>
            </div>

            <!-- Feature 03 (Span 1) -->
            <div class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 flex flex-col justify-between space-y-4">
              <div class="space-y-2.5">
                <div class="text-xs text-slate-500 font-medium">
                  <span>Integratsiya</span>
                  <span aria-hidden="true">·</span>
                  <span>Yagona parollar bazasi</span>
                </div>
                <h3 class="text-lg sm:text-xl font-bold text-slate-950">
                  03. eMaktab (Kundalik.com) va Ta'lim Platformalari
                </h3>
                <p class="text-sm text-slate-600 leading-relaxed">
                  O'quvchilarning Kundalik.com (eMaktab), Khan Academy, Kitob.uz va Edu.uz tizimlaridagi login hamda parollarini yo'qotib qo'ymaslik uchun sinf kabinetida markazlashgan holda saqlang va bir bosishda nusxalang.
                </p>
              </div>
              <div class="pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span>Dublikatlarni avto-tozalash · Tezkor nusxalash</span>
              </div>
            </div>

            <!-- Feature 04 (Span 2) -->
            <div class="md:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 flex flex-col justify-between space-y-4">
              <div class="space-y-2.5">
                <div class="text-xs text-slate-500 font-medium">
                  <span>Intizom va Davomat</span>
                  <span aria-hidden="true">·</span>
                  <span>1-smena va 2-smena navbatchilik tizimi</span>
                </div>
                <h3 class="text-lg sm:text-xl font-bold text-slate-950">
                  04. Mas'ul Navbatchi Davomati, Avto-Zaxira va Ota-onalarga SMS
                </h3>
                <p class="text-sm text-slate-600 leading-relaxed">
                  Maktab ma'muriyati haftalik navbatchilik jadvalini tuzadi. Har kuni davomatni faqat o'sha kungi Mas'ul Navbatchi o'qituvchi oladi. O'quvchini «Sababli» deb belgilaganda majburiy sabab izohi (Betoblik, Ota-ona arizasi, Safar, Olimpiada) kiritiladi. Navbatchi o'qituvchi maktabga kela olmasa, tizim navbatchilikni avtomatik Zaxira o'qituvchiga o'tkazadi va Adminga xabar beradi. Dars qoldirgan o'quvchining ota-onasiga DevSMS orqali SMS yuboriladi.
                </p>
              </div>
              <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
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
        <!-- SECTION 2: INTERAKTIV FOYDALANUVCHI QO'LLANMALARI (ROLE MANUALS)          -->
        <!-- ========================================================================= -->
        <section id="qollanmalar" class="py-16 sm:py-20 px-4 sm:px-8 lg:px-12 bg-white border-y border-slate-200/80">
          <div class="max-w-7xl mx-auto space-y-8">
            
            <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div class="max-w-2xl space-y-2">
                <p class="text-xs font-semibold text-indigo-600">Bosqichma-bosqich yo'riqnoma</p>
                <h2 class="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight" style="text-wrap: balance;">
                  MaktabX Tizimidan Foydalanish Qo'llanmasi
                </h2>
                <p class="text-sm sm:text-base text-slate-600">
                  O'zingizga tegishli bo'limni tanlang va platformaning barcha qoidalari hamda ishlash tartibi bilan batafsil tanishing.
                </p>
              </div>

              <!-- Interactive Segmented Filter Tabs -->
              <div class="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/70 self-start">
                <button 
                  type="button"
                  data-guide-tab="teacher"
                  class="guide-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    savedGuideTab === 'teacher'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }"
                >
                  Sinf Rahbari
                </button>
                <button 
                  type="button"
                  data-guide-tab="admin"
                  class="guide-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    savedGuideTab === 'admin'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }"
                >
                  Maktab Admini
                </button>
                <button 
                  type="button"
                  data-guide-tab="security"
                  class="guide-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    savedGuideTab === 'security'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }"
                >
                  Xavfsizlik va Tiklash
                </button>
                <button 
                  type="button"
                  data-guide-tab="dossier"
                  class="guide-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    savedGuideTab === 'dossier'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }"
                >
                  Dosye va Eksport
                </button>
              </div>
            </div>

            <!-- Active Guide Header Banner -->
            <div class="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 class="text-lg sm:text-xl font-bold text-slate-950">${escapeHtml(activeGuide.title)}</h3>
                <p class="text-xs sm:text-sm text-slate-600 mt-0.5">${escapeHtml(activeGuide.subtitle)}</p>
              </div>
              <button 
                type="button"
                id="guide-banner-login-btn"
                class="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                Kabinetga kirish &rarr;
              </button>
            </div>

            <!-- 6 Editorial Numbered Steps Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${activeGuide.steps.map(step => `
                <div class="p-6 rounded-3xl bg-[#F8FAFC] border border-slate-200/90 flex flex-col justify-between space-y-3">
                  <div class="space-y-2.5">
                    <span class="text-xs font-mono font-bold text-indigo-600 tabular-nums">Qadam ${step.num}</span>
                    <h4 class="text-base font-bold text-slate-950 leading-snug">
                      ${step.num}. ${escapeHtml(step.title)}
                    </h4>
                    <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      ${escapeHtml(step.desc)}
                    </p>
                  </div>
                </div>
              `).join('')}
            </div>

          </div>
        </section>

        <!-- ========================================================================= -->
        <!-- SECTION 3: 24 BANDLI O'QUVCHI DOSYESI TUZILMASI (COMPLETE FIELD SPEC)     -->
        <!-- ========================================================================= -->
        <section id="dosye-tarkibi" class="py-16 sm:py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <div class="max-w-3xl space-y-2 mb-10">
            <p class="text-xs font-semibold text-indigo-600">Ma'lumotlar standarti</p>
            <h2 class="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight" style="text-wrap: balance;">
              O'quvchining 24 Bandli Rasmiy Dosyesiga Nimalar Kiradi?
            </h2>
            <p class="text-sm sm:text-base text-slate-600 leading-relaxed">
              MaktabX tizimida har bir o'quvchi bo'yicha quyidagi 4 ta asosiy yo'nalishdagi ma'lumotlar to'liq shakllantiriladi va rasmiy blankada chop etiladi:
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            <!-- Block 1 -->
            <div class="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
              <div class="border-b border-slate-100 pb-3">
                <span class="text-xs font-mono text-indigo-600 font-bold tabular-nums">01-BLOK</span>
                <h3 class="text-base font-bold text-slate-950 mt-0.5">Shaxsiy Ma'lumotlar</h3>
              </div>
              <ul class="space-y-2 text-xs sm:text-sm text-slate-600">
                <li>1. Familiyasi, Ismi, Otasining ismi</li>
                <li>2. Tug'ilgan sanasi (kun, oy, yil)</li>
                <li>3. Avtomatik hisoblanuvchi yoshi</li>
                <li>4. Jinsi (O'g'il / Qiz)</li>
                <li>5. Tug'ilgan joyi (viloyat, tuman)</li>
                <li>6. O'quvchi telefon raqami</li>
                <li>7. Elektron pochta (Email)</li>
                <li>8. Doimiy yashash manzili (MFY, ko'cha)</li>
              </ul>
            </div>

            <!-- Block 2 -->
            <div class="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
              <div class="border-b border-slate-100 pb-3">
                <span class="text-xs font-mono text-emerald-600 font-bold tabular-nums">02-BLOK</span>
                <h3 class="text-base font-bold text-slate-950 mt-0.5">Guvohnoma va Pasport</h3>
              </div>
              <ul class="space-y-2 text-xs sm:text-sm text-slate-600">
                <li>9. Guvohnoma bergan FHDYO organi</li>
                <li>10. Dalolatnoma yozuvi raqami</li>
                <li>11. Guvohnoma berilgan sana</li>
                <li>12. Guvohnoma seriyasi va raqami</li>
                <li>13. Pasport / ID-karta seriya va raqami</li>
                <li>14. 14 xonali JSHSHIR (PINFL) raqami</li>
              </ul>
            </div>

            <!-- Block 3 -->
            <div class="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
              <div class="border-b border-slate-100 pb-3">
                <span class="text-xs font-mono text-amber-600 font-bold tabular-nums">03-BLOK</span>
                <h3 class="text-base font-bold text-slate-950 mt-0.5">Ota-ona Ma'lumotlari</h3>
              </div>
              <ul class="space-y-2 text-xs sm:text-sm text-slate-600">
                <li>15. Onasining F.I.SH va tug'ilgan yili</li>
                <li>16. Onasining pasport seriyasi va JSHSHIR</li>
                <li>17. Onasining ish joyi va telefon raqami</li>
                <li>18. Otasining F.I.SH va tug'ilgan yili</li>
                <li>19. Otasining pasport seriyasi va JSHSHIR</li>
                <li>20. Otasining ish joyi va telefon raqami</li>
              </ul>
            </div>

            <!-- Block 4 -->
            <div class="bg-white rounded-3xl p-6 border border-slate-200/90 space-y-4">
              <div class="border-b border-slate-100 pb-3">
                <span class="text-xs font-mono text-blue-600 font-bold tabular-nums">04-BLOK</span>
                <h3 class="text-base font-bold text-slate-950 mt-0.5">Platforma va To'garaklar</h3>
              </div>
              <ul class="space-y-2 text-xs sm:text-sm text-slate-600">
                <li>21. Kundalik.com (eMaktab) login/paroli</li>
                <li>22. Khan Academy / Kitob.uz / Edu.uz</li>
                <li>23. Qo'shimcha fan va sport to'garaklari</li>
                <li>24. O'quv markazi manzili va ustoz telefoni</li>
              </ul>
            </div>

          </div>
        </section>

        <!-- ========================================================================= -->
        <!-- SECTION 4: TEZ-TEZ SO'RALADIGAN SAVOLLAR (INTERACTIVE FAQ)                -->
        <!-- ========================================================================= -->
        <section id="savol-javob" class="py-16 sm:py-20 px-4 sm:px-8 lg:px-12 bg-white border-t border-slate-200/80">
          <div class="max-w-4xl mx-auto space-y-8">
            <div class="space-y-2">
              <p class="text-xs font-semibold text-indigo-600">Amaliy yordam</p>
              <h2 class="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
                Ko'p So'raladigan Savollar va Yechimlar
              </h2>
              <p class="text-sm sm:text-base text-slate-600">
                O'qituvchilar va maktab ma'muriyati tomonidan eng ko'p beriladigan savollarga aniq javoblar.
              </p>
            </div>

            <div class="divide-y divide-slate-200 border-y border-slate-200">
              ${FAQ_ITEMS.map((item, idx) => {
                const isOpen = savedFaqIndex === idx;
                return `
                  <div class="py-4">
                    <button 
                      type="button"
                      data-faq-idx="${idx}"
                      class="faq-toggle-btn w-full flex items-center justify-between gap-4 text-left py-2 cursor-pointer group"
                    >
                      <span class="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        0${idx + 1}. ${escapeHtml(item.q)}
                      </span>
                      <svg class="w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                    ${isOpen ? `
                      <div class="pt-2 pb-1 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
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
        <section id="muallif-aloqa" class="py-16 sm:py-20 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            <!-- Left: Author & Support Info -->
            <div class="lg:col-span-7 bg-slate-950 text-white rounded-3xl p-6 sm:p-10 space-y-6 border border-slate-800">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-2xl bg-white flex items-center justify-center p-2 shrink-0">
                  <img src="/working-code-logo.svg" alt="WORKING CODE" class="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p class="text-xs text-cyan-400 font-medium">Platforma Muallifi va Bosh Dasturchi</p>
                  <h2 class="text-2xl sm:text-3xl font-black tracking-tight text-white">${escapeHtml(dev.brand || 'WORKING CODE')}</h2>
                </div>
              </div>

              <p class="text-sm sm:text-base text-slate-300 leading-relaxed">
                ${escapeHtml(dev.bio || "MaktabX axborot tizimi O'zbekiston Respublikasi maktab ta'limi tizimi uchun WORKING CODE brendi tomonidan ishlab chiqilgan va 24/7 rejimda texnik qo'llab-quvvatlanadi.")}
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <a 
                  href="https://t.me/${tgUser}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <span>Telegram: @${escapeHtml(tgUser)}</span>
                </a>
                <a 
                  href="tel:${cleanPhone}"
                  class="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <span>Tel: ${escapeHtml(dev.phone || '+998 90 000 12 34')}</span>
                </a>
                <a 
                  href="mailto:${escapeHtml(dev.email || 'diyorbek.dev1510@gmail.com')}"
                  class="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <span>Email yuborish</span>
                </a>
              </div>

              <div class="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="text-xs text-slate-400">
                  Shaxsiy kabinetingizga kirishga tayyormisiz?
                </div>
                <button 
                  type="button"
                  id="bottom-cta-login-btn"
                  class="px-6 py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  Tizimga kirish (Login) &rarr;
                </button>
              </div>
            </div>

            <!-- Right: Quick Support Message Form -->
            <div class="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 space-y-5">
              <div>
                <h3 class="text-lg font-bold text-slate-950">Dasturchiga Tezkor Murojaat</h3>
                <p class="text-xs text-slate-500 mt-0.5">
                  Savol, taklif yoki maktabingizni tizimga ulash bo'yicha to'g'ridan-to'g'ri xabar qoldiring.
                </p>
              </div>

              <form id="landing-support-form" class="space-y-3.5">
                <div>
                  <label for="landing-sender-name" class="block text-xs font-bold text-slate-700 mb-1">
                    Ism-sharifingiz va maktabingiz:
                  </label>
                  <input 
                    type="text"
                    id="landing-sender-name"
                    placeholder="Masalan: 15-maktab, Karimov Sardor"
                    class="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    required
                  />
                </div>

                <div>
                  <label for="landing-support-topic" class="block text-xs font-bold text-slate-700 mb-1">
                    Murojaat mavzusi:
                  </label>
                  <select 
                    id="landing-support-topic"
                    class="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="Yangi maktab yoki sinfni tizimga ulash">Yangi maktab yoki sinfni tizimga ulash</option>
                    <option value="Login, parol yoki PIN-kodni tiklash">Login, parol yoki PIN-kodni tiklash</option>
                    <option value="Davomat va navbatchilik bo'yicha savol">Davomat va navbatchilik bo'yicha savol</option>
                    <option value="Taklif va hamkorlik">Taklif va hamkorlik</option>
                  </select>
                </div>

                <div>
                  <label for="landing-support-msg" class="block text-xs font-bold text-slate-700 mb-1">
                    Xabar matni:
                  </label>
                  <textarea 
                    id="landing-support-msg"
                    rows="3"
                    placeholder="Murojaatingizni qisqacha yozing..."
                    class="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    required
                  ></textarea>
                </div>

                <button 
                  type="submit"
                  class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
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
        <footer class="bg-white border-t border-slate-200/80 py-8 px-4 sm:px-8 lg:px-12 text-xs text-slate-500">
          <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-2.5">
              <img src="/maktabx-logo.png" alt="MaktabX" class="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
              <span class="font-bold text-slate-900">${escapeHtml(info.title || 'MaktabX')}</span>
              <span aria-hidden="true">·</span>
              <span>© ${escapeHtml(info.releaseYear || '2026')} ${escapeHtml(dev.brand || 'WORKING CODE')}</span>
            </div>
            <div class="flex flex-wrap items-center gap-5">
              <button type="button" id="footer-about-btn" class="hover:text-slate-900 transition-colors cursor-pointer">Platforma haqida</button>
              <button type="button" id="footer-recovery-btn" class="hover:text-slate-900 transition-colors cursor-pointer">Parolni tiklash</button>
              <button type="button" id="footer-login-btn" class="font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer">Tizimga kirish</button>
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

    const recoveryTriggerIds = ['header-recovery-btn', 'footer-recovery-btn'];
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

    // Guide Tabs
    container.querySelectorAll('.guide-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-guide-tab');
        if (tab && GUIDE_TABS[tab]) {
          savedGuideTab = tab;
          render();
        }
      });
    });

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
