import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// CORS headers for all incoming requests (supports any mobile or external device)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DEVSMS_TOKEN = process.env.DEVSMS_API_TOKEN || "aad6068ae495af3c0038b041600297ff2a54d8d419ca5f0e7cb97c88c6e12586";
const DEVSMS_ENDPOINT = "https://devsms.uz/api/send_sms.php";

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve /favicon.ico directly as MaktabX logo PNG for Google Search Favicon crawler
app.get('/favicon.ico', (req, res) => {
  const logoPath = path.join(process.cwd(), 'public', 'maktabx-logo.png');
  if (fs.existsSync(logoPath)) {
    res.type('image/png').sendFile(logoPath);
  } else {
    res.status(404).end();
  }
});

// Dynamic robots.txt for Google Search Console & Crawlers
app.get('/robots.txt', (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'ais-pre-gs4rr5pquvbx4k23icdb23-697446284775.asia-southeast1.run.app';
  const baseUrl = process.env.APP_URL || `${proto}://${host}`;
  res.type('text/plain').send(
`User-agent: *
Allow: /
Allow: /maktabx-logo.png
Allow: /maktabx-logo.jpg
Allow: /working-code-logo.svg

Sitemap: ${baseUrl.replace(/\/$/, '')}/sitemap.xml
`
  );
});

// Dynamic sitemap.xml with Image Sitemap for MaktabX Logo in Google Search
app.get('/sitemap.xml', (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'ais-pre-gs4rr5pquvbx4k23icdb23-697446284775.asia-southeast1.run.app';
  const baseUrl = (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, '');
  const today = new Date().toISOString().split('T')[0];
  res.type('application/xml').send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${baseUrl}/maktabx-logo.png</image:loc>
      <image:title>MaktabX - Ta'lim va O'quvchilar Boshqaruv Tizimi Rasmiy Logotipi</image:title>
      <image:caption>MaktabX rasmiy logotipi (WORKING CODE)</image:caption>
    </image:image>
  </url>
</urlset>`
  );
});

// DevSMS Gateway GET test endpoint
app.get('/api/sms/send', (req, res) => {
  res.json({ status: 'ok', service: 'DevSMS Gateway', timestamp: new Date().toISOString() });
});

// DevSMS Gateway - Node.js proxy to bypass browser CORS completely
app.post('/api/sms/send', async (req, res) => {
  try {
    const { phone, message, code, from } = req.body || {};
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

    // DevSMS tasdiqlangan rasmiy shabloni
    const smsMessage = `MaktabX loyihasiga ro\u2018yxatdan o\u2018tish uchun tasdiqlash kodingiz: ${cleanCode}`;

    console.log(`[DevSMS Server] Sending SMS to ${cleanPhone}...`);

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
    console.log(`[DevSMS Server] Response:`, data);

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
  } catch (err: any) {
    console.error(`[DevSMS Server] Error:`, err);
    return res.status(500).json({
      success: false,
      error: "DevSMS serveriga ulanishda server xatosi yuz berdi: " + (err?.message || 'Tarmoq uzilishi')
    });
  }
});

async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === "production";

  // Vite middleware for development
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MaktabX Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

