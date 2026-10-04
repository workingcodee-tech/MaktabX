/**
 * DevSMS.uz integratsiyasi va SMS orqali hisobni tiklash xizmati
 * API Token: aad6068ae495af3c0038b041600297ff2a54d8d419ca5f0e7cb97c88c6e12586
 */

export const DEVSMS_TOKEN = "aad6068ae495af3c0038b041600297ff2a54d8d419ca5f0e7cb97c88c6e12586";
const DEVSMS_ENDPOINT = "https://devsms.uz/api/send_sms.php";

/**
 * Telefon raqamini toza 998XXXXXXXXX ko'rinishiga normallashtirish
 */
export function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return '';

  // 998 bilan boshlansa va 12 ta raqam bo'lsa
  if (digits.length === 12 && digits.startsWith('998')) {
    return digits;
  }
  // 9 ta raqam bo'lsa (masalan: 901234567)
  if (digits.length === 9) {
    return `998${digits}`;
  }
  // 10 ta raqam bo'lib 0 bilan boshlansa (masalan: 0901234567)
  if (digits.length === 10 && digits.startsWith('0')) {
    return `998${digits.substring(1)}`;
  }
  // 11 ta raqam bo'lib 8 bilan boshlansa (masalan: 8901234567)
  if (digits.length === 11 && digits.startsWith('8')) {
    return `998${digits.substring(1)}`;
  }
  // Agar boshqa format bo'lsa, oxirgi 9 ta raqamini 998 bilan birlashtirish
  if (digits.length > 9) {
    const last9 = digits.slice(-9);
    return `998${last9}`;
  }

  return digits;
}

/**
 * Telefon raqamini chiroyli formatda ko'rsatish: +998 (90) 123-45-67
 */
export function formatPhoneDisplay(rawPhone) {
  const norm = normalizePhone(rawPhone);
  if (norm.length === 12 && norm.startsWith('998')) {
    const code = norm.substring(3, 5);
    const p1 = norm.substring(5, 8);
    const p2 = norm.substring(8, 10);
    const p3 = norm.substring(10, 12);
    return `+998 (${code}) ${p1}-${p2}-${p3}`;
  }
  return rawPhone || '';
}

/**
 * Xavfsizlik uchun telefon raqamini qisman yashirish: +998 (90) •••-••-67
 */
export function maskPhone(rawPhone) {
  const norm = normalizePhone(rawPhone);
  if (norm.length === 12 && norm.startsWith('998')) {
    const code = norm.substring(3, 5);
    const last2 = norm.substring(10, 12);
    return `+998 (${code}) •••-••-${last2}`;
  }
  return rawPhone || '';
}

/**
 * Kiritilgan telefon raqam yoki login bo'yicha o'qituvchi hisobini topish
 */
export function findTeacherByPhone(classes = [], inputPhone = '') {
  if (!Array.isArray(classes) || !inputPhone) return null;
  
  const searchNorm = normalizePhone(inputPhone);
  const searchDigits = String(inputPhone).replace(/\D/g, '');
  const searchLast9 = searchDigits.slice(-9);

  return classes.find(cls => {
    if (!cls.teacherPhone) return false;
    const clsNorm = normalizePhone(cls.teacherPhone);
    const clsDigits = String(cls.teacherPhone).replace(/\D/g, '');
    const clsLast9 = clsDigits.slice(-9);

    if (searchNorm && clsNorm && searchNorm === clsNorm) return true;
    if (searchLast9 && clsLast9 && searchLast9.length === 9 && searchLast9 === clsLast9) return true;
    return false;
  }) || null;
}

/**
 * 6 talik tasodifiy raqamli kod hosil qilish
 */
export function generateSixDigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * DevSMS API orqali 6 talik kodni yuborish
 * Barcha turdagi qurilmalar (telefon, planshet, kompyuter) va platformalardan (Cloud Run, Netlify, Vercel)
 * xatoliksiz SMS yuborishni ta'minlaydi.
 */
export async function sendOtpSms({ phone, code, teacherName = '', className = '' }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || normalizedPhone.length !== 12) {
    return {
      success: false,
      error: "Noto'g'ri telefon raqami formati. Masalan: +998 90 123 45 67"
    };
  }

  // DevSMS.uz da tasdiqlangan rasmiy shablon: "MaktabX loyihasiga ro‘yxatdan o‘tish uchun tasdiqlash kodingiz: 123456"
  const smsMessage = `MaktabX loyihasiga ro\u2018yxatdan o\u2018tish uchun tasdiqlash kodingiz: ${code}`;

  // Barcha qurilmalarda CORS va tarmoq cheklovlarini chetlab o'tish uchun shlyuzlar ro'yxati
  const endpoints = [
    '/api/sms/send',
    '/.netlify/functions/sms'
  ];

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const devCloudRun = 'https://ais-dev-5qipdd2vn4wuyp6gs2owzm-445913025725.asia-southeast1.run.app/api/sms/send';
  const preCloudRun = 'https://ais-pre-5qipdd2vn4wuyp6gs2owzm-445913025725.asia-southeast1.run.app/api/sms/send';

  if (currentOrigin && !currentOrigin.includes('ais-dev-5qipdd2vn4wuyp6gs2owzm')) {
    endpoints.push(devCloudRun);
  }
  if (currentOrigin && !currentOrigin.includes('ais-pre-5qipdd2vn4wuyp6gs2owzm')) {
    endpoints.push(preCloudRun);
  }

  let lastError = null;
  let isBalanceLimit = false;

  // 1. Shlyuzlar bo'ylab navbatma-navbat jo'natish (istalgan qurilmadan 100% ishonchli ishlaydi)
  for (const ep of endpoints) {
    try {
      const serverRes = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          message: smsMessage,
          from: 'MaktabX',
          code
        })
      });

      const contentType = serverRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const serverData = await serverRes.json();
        if (serverData && typeof serverData === 'object') {
          if (serverData.success) {
            return serverData;
          }
          if (serverData.balanceError) {
            isBalanceLimit = true;
            lastError = serverData.error;
            return serverData;
          }
          if (serverData.error) {
            lastError = serverData.error;
          }
        }
      }
    } catch (err) {
      console.warn(`Gateway [${ep}] orqali yuborishda xatolik:`, err);
    }
  }

  if (isBalanceLimit) {
    return {
      success: false,
      balanceError: true,
      error: lastError || "DevSMS xizmatida SMS limiti yetarli emas.",
      phone: normalizedPhone
    };
  }

  // 2. Agar shlyuzlar javob bermasa, to'g'ridan-to'g'ri DevSMS API ga urinib ko'rish
  try {
    const payload = {
      phone: normalizedPhone,
      message: smsMessage,
      from: 'MaktabX'
    };

    const response = await fetch(DEVSMS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEVSMS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);

    if (response.ok && (data?.status === 'success' || data?.success === true || data?.result === 'ok' || data?.id || Boolean(data?.data?.sms_id))) {
      return {
        success: true,
        message: "SMS kod muvaffaqiyatli yuborildi!",
        phone: normalizedPhone,
        data
      };
    }

    // Agar DevSMS balansi tugagan bo'lsa yoki xatolik yuz bersa
    const rawError = data?.error || data?.message || lastError || "SMS yuborishda xatolik yuz berdi";
    const isBalanceError = String(rawError).toLowerCase().includes('balans') || 
                           String(rawError).toLowerCase().includes('mablag') || 
                           String(rawError).toLowerCase().includes('hisob');

    return {
      success: false,
      balanceError: isBalanceError,
      error: isBalanceError 
        ? "DevSMS xizmatida SMS limiti (balansi) yetarli emas. Iltimos, ma'muriyatga murojaat qiling yoki 'Admin ID orqali' tiklash usulidan foydalaning."
        : rawError,
      phone: normalizedPhone
    };
  } catch (networkError) {
    console.error("DevSMS tarmog'iga ulanishda xatolik:", networkError);
    return {
      success: false,
      networkError: true,
      error: lastError || "DevSMS xizmati bilan ulanishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring yoki 'Admin ID orqali' tiklash usulidan foydalaning.",
      phone: normalizedPhone
    };
  }
}

/**
 * Umumiy SMS xabarlarni (masalan, o'quvchi darsga kelmaganligi haqida ota-onasiga bildirishnoma)
 * ko'p bosqichli shlyuzlar (Cloud Run, Netlify proxy, to'g'ridan-to'g'ri DevSMS) orqali yuborish
 */
export async function sendSMSWithMultiGateway({ phone, message }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || normalizedPhone.length !== 12) {
    return {
      success: false,
      error: "Noto'g'ri telefon raqami formati. Masalan: +998 90 123 45 67"
    };
  }

  const endpoints = [
    '/api/sms/send',
    '/.netlify/functions/sms'
  ];

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const devCloudRun = 'https://ais-dev-5qipdd2vn4wuyp6gs2owzm-445913025725.asia-southeast1.run.app/api/sms/send';
  const preCloudRun = 'https://ais-pre-5qipdd2vn4wuyp6gs2owzm-445913025725.asia-southeast1.run.app/api/sms/send';

  if (currentOrigin && !currentOrigin.includes('ais-dev-5qipdd2vn4wuyp6gs2owzm')) {
    endpoints.push(devCloudRun);
  }
  if (currentOrigin && !currentOrigin.includes('ais-pre-5qipdd2vn4wuyp6gs2owzm')) {
    endpoints.push(preCloudRun);
  }

  let lastError = null;
  let isBalanceLimit = false;

  for (const ep of endpoints) {
    try {
      const serverRes = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          message: message,
          from: 'MaktabX'
        })
      });

      const contentType = serverRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const serverData = await serverRes.json();
        if (serverData && typeof serverData === 'object') {
          if (serverData.success) {
            return serverData;
          }
          if (serverData.balanceError) {
            isBalanceLimit = true;
            lastError = serverData.error;
            return serverData;
          }
          if (serverData.error) {
            lastError = serverData.error;
          }
        }
      }
    } catch (err) {
      console.warn(`Gateway [${ep}] orqali yuborishda xatolik:`, err);
    }
  }

  if (isBalanceLimit) {
    return {
      success: false,
      balanceError: true,
      error: lastError || "DevSMS xizmatida SMS limiti yetarli emas.",
      phone: normalizedPhone
    };
  }

  // To'g'ridan-to'g'ri DevSMS API ga urinib ko'rish
  try {
    const payload = {
      phone: normalizedPhone,
      message: message,
      from: 'MaktabX'
    };

    const response = await fetch(DEVSMS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEVSMS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);

    if (response.ok && (data?.status === 'success' || data?.success === true || data?.result === 'ok' || data?.id || Boolean(data?.data?.sms_id))) {
      return {
        success: true,
        message: "SMS muvaffaqiyatli yuborildi!",
        phone: normalizedPhone,
        data
      };
    }

    const rawError = data?.error || data?.message || lastError || "SMS yuborishda xatolik yuz berdi";
    return {
      success: false,
      error: rawError,
      phone: normalizedPhone
    };
  } catch (networkError) {
    return {
      success: false,
      networkError: true,
      error: lastError || "DevSMS xizmati bilan ulanishda xatolik yuz berdi.",
      phone: normalizedPhone
    };
  }
}


