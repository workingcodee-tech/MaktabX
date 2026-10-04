/**
 * MaktabX - Professional Kirish Ekrani (PRO Glassmorphic Design)
 * - Shafof, nafis shisha effektli (Glassmorphism) modal karta
 * - Standart va qulay paddinglarga ega, keng to'liq inputlar (Username va Parol)
 * - Zamonaviy Sunset & Cyan to'lqinlari bilan uyg'unlashgan orqa fon
 * - "Sayt haqida" va "Parolni unutdingizmi?" tezkor havolalari
 * - Face ID login sahifasidan butunlay olib tashlangan
 */

export function renderLogin(container, { onLogin, onOpenAbout, onForgotPassword, onOpenSystemTerminal, onBackToLanding, siteInfo, developer }) {
  const currentTitle = siteInfo?.title || 'MaktabX';
  const currentSubtitle = siteInfo?.subtitle || "Ta'lim va O'quvchilar Boshqaruv Tizimi";
  const devName = developer?.brand || developer?.name || "WORKING CODE";

  container.innerHTML = `
    <div class="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none bg-gradient-to-br from-[#06181b] via-[#0b292e] to-[#071d22]">
      
      <!-- Bosh sahifaga (Qo'llanmaga) qaytish tugmasi -->
      <div class="w-full max-w-[430px] mb-3 relative z-20 flex items-center justify-between">
        <button 
          type="button" 
          id="login-back-landing-btn"
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          <span>Bosh sahifa va Qo'llanma</span>
        </button>
      </div>
      
      <!-- ========================================================================= -->
      <!-- 1. ORQA FON: TO'LQINLAR VA AMBIENT NUR EFFEKTLARI                        -->
      <!-- ========================================================================= -->
      
      <!-- Yuqori Sunset (Quyosh botishi olovrang-qirmizi) to'lqini -->
      <div class="absolute top-0 inset-x-0 h-[32vh] min-h-[220px] max-h-[320px] pointer-events-none z-0 overflow-hidden opacity-90">
        <svg class="w-full h-full" viewBox="0 0 1440 320" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="proTopAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FF9E66" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#FF4D6D" stop-opacity="0.08" />
            </linearGradient>
            <linearGradient id="proTopMainGrad" x1="0%" y1="0%" x2="100%" y2="85%">
              <stop offset="0%" stop-color="#FF9636" />
              <stop offset="35%" stop-color="#FF6B35" />
              <stop offset="75%" stop-color="#FF4158" />
              <stop offset="100%" stop-color="#E63956" />
            </linearGradient>
          </defs>
          <path d="M0,0 L1440,0 L1440,110 C1180,95 960,220 680,220 C360,220 180,290 0,320 Z" fill="url(#proTopAccentGrad)" />
          <path d="M0,0 L1440,0 L1440,75 C1180,60 920,185 640,185 C340,185 160,250 0,270 Z" fill="url(#proTopMainGrad)" />
        </svg>
      </div>

      <!-- Pastki Cyan & Okean moviy to'lqini -->
      <div class="absolute bottom-0 inset-x-0 h-[32vh] min-h-[220px] max-h-[320px] pointer-events-none z-0 overflow-hidden opacity-90">
        <svg class="w-full h-full" viewBox="0 0 1440 320" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="proBottomAccentGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#00F0FF" stop-opacity="0.28" />
              <stop offset="100%" stop-color="#0088FF" stop-opacity="0.08" />
            </linearGradient>
            <linearGradient id="proBottomMainGrad" x1="10%" y1="100%" x2="90%" y2="10%">
              <stop offset="0%" stop-color="#00F5D4" />
              <stop offset="30%" stop-color="#00BBF9" />
              <stop offset="70%" stop-color="#0077B6" />
              <stop offset="100%" stop-color="#023E8A" />
            </linearGradient>
          </defs>
          <path d="M220,320 C540,290 820,270 1080,200 C1300,140 1390,90 1440,40 L1440,320 Z" fill="url(#proBottomAccentGrad)" />
          <path d="M280,320 C580,300 860,280 1120,210 C1320,155 1400,105 1440,65 L1440,320 Z" fill="url(#proBottomMainGrad)" />
        </svg>
      </div>

      <!-- Mayin orqa fon yorug'lik effektlari (Ambient Glow) -->
      <div class="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-orange-500/15 blur-[120px] pointer-events-none"></div>
      <div class="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full bg-cyan-500/20 blur-[130px] pointer-events-none"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-teal-500/10 blur-[140px] pointer-events-none"></div>

      <!-- ========================================================================= -->
      <!-- 2. ASOSIY SHAFFOF MODAL OYNASI (PRO ULTRA GLASSMORPHIC CARD)              -->
      <!-- ========================================================================= -->
      <div id="login-card" class="w-full max-w-[430px] bg-slate-900/40 backdrop-blur-2xl border border-white/25 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.18)] rounded-[32px] overflow-hidden relative z-10 animate-scale-up my-auto">
        
        <div class="p-6 sm:p-8">
          
          <!-- Brending va Logotip -->
          <div class="flex flex-col items-center text-center">
            
            <!-- Tizim logotipi (4 marta bosilsa va Tizimga kirish bosilsa terminal ochiladi) -->
            <div class="relative group mb-3.5">
              <button 
                type="button" 
                id="login-site-logo-btn" 
                class="w-18 h-18 rounded-[22px] bg-white/10 backdrop-blur-xl border border-white/30 shadow-lg shadow-black/20 flex items-center justify-center p-3.5 transition-all group-hover:scale-105 active:scale-95 duration-200 cursor-pointer focus:outline-none"
                title="${currentTitle}"
              >
                <img 
                  src="${siteInfo?.logo || '/maktabx-logo.png'}" 
                  alt="${currentTitle} Logo" 
                  class="w-full h-full object-contain drop-shadow-md pointer-events-none" 
                  referrerPolicy="no-referrer"
                  onerror="this.src='/maktabx-logo.png'"
                />
              </button>
            </div>

            <!-- Sarlavha -->
            <h1 class="text-2xl sm:text-[26px] font-black text-white tracking-tight drop-shadow-sm">
              ${currentTitle}
            </h1>
            <p class="text-xs text-slate-300 font-medium mt-1 max-w-[290px] leading-relaxed">
              ${currentSubtitle}
            </p>
          </div>

          <!-- Kirish Formasi -->
          <form id="login-form" novalidate class="space-y-4.5 mt-6 sm:mt-7">
            
            <!-- 1. LOGIN INPUT MAYDONI -->
            <div>
              <label for="login-input" class="block text-xs font-bold text-slate-200 mb-1.5 ml-1">
                Foydalanuvchi Logini (ID)
              </label>
              
              <div class="relative flex items-center w-full h-[52px] bg-white/[0.08] hover:bg-white/[0.14] focus-within:bg-white/[0.18] border border-white/25 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-400/25 rounded-2xl transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] overflow-hidden">
                
                <!-- Chapdagi Foydalanuvchi ikonkasi -->
                <div class="absolute left-4 flex items-center pointer-events-none text-slate-300">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </div>
                
                <!-- Haqiqiy to'liq kenglikdagi input (Rounded radius va Shaffof) -->
                <input 
                  type="text" 
                  id="login-input" 
                  placeholder="Masalan: 9-A yoki admin" 
                  autocomplete="username"
                  class="w-full h-full pl-12 pr-12 bg-transparent text-white font-medium text-[15px] placeholder:text-slate-400 placeholder:font-normal focus:outline-none border-none ring-0 rounded-2xl"
                />

                <!-- Checkmark ikonkasi (Login to'ldirilganda) -->
                <div id="login-check-icon" class="absolute right-4 flex items-center pointer-events-none text-emerald-400 transition-all opacity-0 scale-75">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>

              </div>
            </div>

            <!-- 2. PAROL INPUT MAYDONI -->
            <div>
              <label for="password-input" class="block text-xs font-bold text-slate-200 mb-1.5 ml-1">
                Maxfiy Parol
              </label>
              
              <div class="relative flex items-center w-full h-[52px] bg-white/[0.08] hover:bg-white/[0.14] focus-within:bg-white/[0.18] border border-white/25 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-400/25 rounded-2xl transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] overflow-hidden">
                
                <!-- Chapdagi Qulf ikonkasi -->
                <div class="absolute left-4 flex items-center pointer-events-none text-slate-300">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                
                <!-- Parol kiritish maydoni (Rounded radius va Shaffof) -->
                <input 
                  type="password" 
                  id="password-input" 
                  placeholder="Parolingizni kiriting" 
                  autocomplete="current-password"
                  class="w-full h-full pl-12 pr-12 bg-transparent text-white font-medium text-[15px] placeholder:text-slate-400 placeholder:font-normal focus:outline-none border-none ring-0 rounded-2xl tracking-wider"
                />

                <!-- Ko'rsatish/Yashirish tugmasi -->
                <button 
                  type="button" 
                  id="toggle-pwd-btn" 
                  class="absolute right-3.5 w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                  title="Parolni ko'rsatish yoki yashirish"
                  aria-label="Parolni ko'rsatish yoki yashirish"
                >
                  <svg id="eye-icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>

              </div>
            </div>

            <!-- PAROLNI UNUTDINGIZMI VA SAYT HAQIDA HAVOLALARI -->
            <div class="flex items-center justify-between pt-1 pb-0.5 px-1 text-xs">
              <button 
                type="button" 
                id="login-about-btn"
                class="font-bold text-[#FF7A59] hover:text-[#FFA07A] transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Sayt haqida</span>
              </button>

              <button 
                type="button" 
                id="forgot-password-btn" 
                class="font-semibold text-cyan-300 hover:text-cyan-200 transition-colors inline-flex items-center gap-1 cursor-pointer py-1 group"
                title="Vaqtinchalik Tiklash ID orqali parolni yangilash"
              >
                <span>Parolni unutdingizmi?</span>
                <svg class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>

            <!-- ASOSIY KIRISH TUGMASI (O'ZGACHA YORQIN ANIMATSIYA, PULSE GLOW VA SHIMMER RAY) -->
            <button 
              type="submit" 
              id="login-submit-btn"
              class="relative w-full h-[52px] rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:via-teal-300 hover:to-cyan-400 active:scale-[0.98] text-slate-950 font-extrabold text-[15.5px] login-btn-glow animate-login-btn-gradient transition-all flex items-center justify-center gap-2.5 cursor-pointer mt-3 group overflow-hidden border border-white/30"
            >
              <!-- Dinamik oquvchi nur chizig'i animatsiyasi -->
              <span class="login-btn-ray"></span>

              <span class="relative z-10 flex items-center gap-2 tracking-wide font-black">
                <span>Tizimga kirish</span>
                <svg class="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2.6" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                </svg>
              </span>
            </button>

          </form>

        </div>

        <!-- PASTKI FOOTER (DASTURCHI / BREND MA'LUMOTI) -->
        <div class="px-6 sm:px-8 py-3.5 bg-white/[0.04] border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
          <div class="flex items-center gap-2 truncate">
            <div class="w-4 h-4 rounded-full bg-white flex items-center justify-center p-0.5 shrink-0 shadow-xs">
              <img src="/working-code-logo.svg" alt="Working Code" class="w-full h-full object-contain" />
            </div>
            <p class="truncate">
              Platforma muallifi: <span class="font-bold text-white tracking-wide">WORKING CODE</span>
            </p>
          </div>
          <span class="text-slate-400 font-medium shrink-0 ml-2">${currentTitle} • 2026</span>
        </div>

      </div>

    </div>
  `;

  // =========================================================================
  // 3. EVENT LISTENERLAR
  // =========================================================================
  
  // Bosh sahifaga (Landing) qaytish
  const backLandingBtn = container.querySelector('#login-back-landing-btn');
  if (backLandingBtn && onBackToLanding) {
    backLandingBtn.onclick = onBackToLanding;
  }

  // Sayt haqida modali
  const aboutBtn = container.querySelector('#login-about-btn');
  if (aboutBtn && onOpenAbout) {
    aboutBtn.onclick = onOpenAbout;
  }

  // Parolni unutdingizmi?
  const forgotPwdBtn = container.querySelector('#forgot-password-btn');
  if (forgotPwdBtn && onForgotPassword) {
    forgotPwdBtn.onclick = () => {
      const currentLoginVal = container.querySelector('#login-input')?.value.trim() || '';
      onForgotPassword(currentLoginVal);
    };
  }

  // Login kiritilganda checkmark ko'rsatish
  const loginInput = container.querySelector('#login-input');
  const loginCheckIcon = container.querySelector('#login-check-icon');
  if (loginInput && loginCheckIcon) {
    const updateCheckIcon = () => {
      if (loginInput.value.trim().length > 0) {
        loginCheckIcon.classList.remove('opacity-0', 'scale-75');
        loginCheckIcon.classList.add('opacity-100', 'scale-100');
      } else {
        loginCheckIcon.classList.remove('opacity-100', 'scale-100');
        loginCheckIcon.classList.add('opacity-0', 'scale-75');
      }
    };
    loginInput.addEventListener('input', updateCheckIcon);
    updateCheckIcon();
  }

  // Parolni ko'rsatish / yashirish
  const togglePwdBtn = container.querySelector('#toggle-pwd-btn');
  const pwdInput = container.querySelector('#password-input');
  const eyeIcon = container.querySelector('#eye-icon');
  if (togglePwdBtn && pwdInput && eyeIcon) {
    togglePwdBtn.addEventListener('click', () => {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        eyeIcon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>
        `;
      } else {
        pwdInput.type = 'password';
        eyeIcon.innerHTML = `
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        `;
      }
    });
  }

  // Maxfiy Tizim Boshqaruvi Terminali: Logoga 4 marta bosilib, Tizimga kirish bosilsa ochiladi
  let logoClicks = 0;
  let lastLogoClickTime = 0;
  const logoBtn = container.querySelector('#login-site-logo-btn');
  if (logoBtn) {
    logoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      // Bosishlar orasidagi vaqt 15 soniyagacha bo'lishi mumkin
      if (now - lastLogoClickTime > 15000) {
        logoClicks = 0;
      }
      lastLogoClickTime = now;
      logoClicks++;
    });
  }

  // Kirish tugmasi va formasi
  const submitBtn = container.querySelector('#login-submit-btn');
  const form = container.querySelector('#login-form');

  // Tugmani to'g'ridan-to'g'ri bosganda tekshirish
  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      if (logoClicks >= 4) {
        e.preventDefault();
        e.stopPropagation();
        logoClicks = 0;
        if (onOpenSystemTerminal) {
          onOpenSystemTerminal();
        }
        return;
      }
    });
  }

  // Kirish formasi submit (Enter bosilganda yoki tugma bosilganda)
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Agar logotipga 4 marta yoki undan ko'p bosilgan bo'lsa -> Tizim Boshqaruvi Terminalini ochish!
      if (logoClicks >= 4) {
        logoClicks = 0;
        if (onOpenSystemTerminal) {
          onOpenSystemTerminal();
          return;
        }
      }

      const login = container.querySelector('#login-input')?.value.trim() || '';
      const pass = container.querySelector('#password-input')?.value.trim() || '';
      
      if (!login) {
        container.querySelector('#login-input')?.focus();
        return;
      }
      if (!pass) {
        container.querySelector('#password-input')?.focus();
        return;
      }

      onLogin(login, pass);
    });
  }
}

