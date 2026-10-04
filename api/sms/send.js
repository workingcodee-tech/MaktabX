/**
 * Vercel Serverless Function for DevSMS.uz Gateway
 * Enables sending SMS from any device/browser when deployed on Vercel
 */

const DEVSMS_TOKEN = process.env.DEVSMS_API_TOKEN || "aad6068ae495af3c0038b041600297ff2a54d8d419ca5f0e7cb97c88c6e12586";
const DEVSMS_ENDPOINT = "https://devsms.uz/api/send_sms.php";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', message: 'DevSMS Vercel Gateway is active' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { phone, code, message, from } = req.body || {};

    const digits = String(phone || '').replace(/\D/g, '');
    let cleanPhone = digits;
    if (digits.length === 9) {
      cleanPhone = `998${digits}`;
    } else if (digits.length === 10 && digits.startsWith('0')) {
      cleanPhone = `998${digits.substring(1)}`;
    } else if (digits.length === 11 && digits.startsWith('8')) {
      cleanPhone = `998${digits.substring(1)}`;
    } else if (digits.length > 12) {
      cleanPhone = digits.slice(-12);
    }

    const cleanCode = String(code || '').replace(/\D/g, '') || (String(message || '').match(/\d{6}/)?.[0] || '');
    if (!cleanPhone || !cleanCode) {
      return res.status(400).json({
        success: false,
        error: "Telefon raqami yoki tasdiqlash kodi kiritilmagan"
      });
    }

    const smsMessage = `MaktabX loyihasiga ro\u2018yxatdan o\u2018tish uchun tasdiqlash kodingiz: ${cleanCode}`;

    const devSmsResponse = await fetch(DEVSMS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEVSMS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message: smsMessage,
        from: from || 'MaktabX'
      })
    });

    const data = await devSmsResponse.json().catch(() => null);
    const isSuccess = devSmsResponse.ok && (data?.status === 'success' || data?.success === true || data?.result === 'ok' || data?.id || Boolean(data?.data?.sms_id));
    
    let errorMessage = null;
    let isBalanceError = false;

    if (!isSuccess) {
      const rawError = data?.error || data?.message || 'SMS yuborishda xatolik yuz berdi';
      isBalanceError = String(rawError || '').toLowerCase().includes('balans') ||
                       String(rawError || '').toLowerCase().includes('mablag') ||
                       String(rawError || '').toLowerCase().includes('hisob');
      errorMessage = isBalanceError
        ? "DevSMS xizmatida SMS limiti (balansi) yetarli emas. Iltimos, ma'muriyatga murojaat qiling yoki 'Admin ID orqali' tiklash usulidan foydalaning."
        : rawError;
    }

    return res.status(200).json({
      success: Boolean(isSuccess),
      data,
      phone: cleanPhone,
      message: isSuccess ? (data?.message || 'SMS kod muvaffaqiyatli yuborildi') : null,
      error: errorMessage,
      balanceError: isBalanceError
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Vercel serverless xatoligi: " + (err.message || 'Noma\'lum xatolik')
    });
  }
}
