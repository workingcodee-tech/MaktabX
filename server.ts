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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================================
// RAILWAY 8GB PERSISTENT STORAGE ENGINE (Gibrid Baza: Firestore + Railway)
// ============================================================================
const RAILWAY_DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'railway-data');
const RAILWAY_DB_FILE = path.join(RAILWAY_DATA_DIR, 'maktabx-railway-db.json');
const RAILWAY_TOTAL_CAPACITY_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB (8,192 MB)

interface RailwayDatabaseSchema {
  storageTargetMode: 'railway' | 'firestore' | 'both';
  updatedAt: string;
  collections: {
    schools: Record<string, any>;
    classes: Record<string, any>;
    students: Record<string, any>;
    recoveryRequests: Record<string, any>;
    shifts: Record<string, any>;
    duty_rosters: Record<string, any>;
    attendance_records: Record<string, any>;
    duty_absences: Record<string, any>;
    admin_notifications: Record<string, any>;
    trash: Record<string, any>;
    system: Record<string, any>;
  };
  deletedIds: Record<string, string[]>;
}

const VALID_COLLECTIONS = [
  'schools',
  'classes',
  'students',
  'recoveryRequests',
  'shifts',
  'duty_rosters',
  'attendance_records',
  'duty_absences',
  'admin_notifications',
  'trash',
  'system'
] as const;

function createDefaultRailwayDb(): RailwayDatabaseSchema {
  return {
    storageTargetMode: 'railway', // Standart: eski ma'lumotlar Firestore'dan o'qiladi, yangilari Railway'ga yoziladi
    updatedAt: new Date().toISOString(),
    collections: {
      schools: {},
      classes: {},
      students: {},
      recoveryRequests: {},
      shifts: {},
      duty_rosters: {},
      attendance_records: {},
      duty_absences: {},
      admin_notifications: {},
      trash: {},
      system: {}
    },
    deletedIds: {}
  };
}

let railwayDbMemory: RailwayDatabaseSchema = createDefaultRailwayDb();

function loadRailwayDbFromDisk(): RailwayDatabaseSchema {
  try {
    if (!fs.existsSync(RAILWAY_DATA_DIR)) {
      fs.mkdirSync(RAILWAY_DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(RAILWAY_DB_FILE)) {
      const raw = fs.readFileSync(RAILWAY_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const def = createDefaultRailwayDb();
      railwayDbMemory = {
        storageTargetMode: ['railway', 'firestore', 'both'].includes(parsed?.storageTargetMode)
          ? parsed.storageTargetMode
          : 'railway',
        updatedAt: parsed?.updatedAt || new Date().toISOString(),
        collections: {
          ...def.collections,
          ...(parsed?.collections || {})
        },
        deletedIds: parsed?.deletedIds || {}
      };
    } else {
      saveRailwayDbToDisk();
    }
  } catch (err) {
    console.warn('[Railway DB] Diskdan o\'qishda bildirishnoma, xotira rejimi ishlatilmoqda:', err);
  }
  return railwayDbMemory;
}

function saveRailwayDbToDisk(): boolean {
  try {
    if (!fs.existsSync(RAILWAY_DATA_DIR)) {
      fs.mkdirSync(RAILWAY_DATA_DIR, { recursive: true });
    }
    railwayDbMemory.updatedAt = new Date().toISOString();
    const tmpFile = `${RAILWAY_DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(railwayDbMemory, null, 2), 'utf-8');
    fs.renameSync(tmpFile, RAILWAY_DB_FILE);
    return true;
  } catch (err) {
    console.warn('[Railway DB] Diskka yozishda bildirishnoma:', err);
    return false;
  }
}

// Dastlabki yuklash
loadRailwayDbFromDisk();

// Railway DB holati va barcha ma'lumotlarni olish
app.get('/api/railway-db/state', (req, res) => {
  try {
    const serialized = JSON.stringify(railwayDbMemory.collections);
    const usedBytes = Buffer.byteLength(serialized, 'utf-8');
    const counts: Record<string, number> = {};
    for (const col of VALID_COLLECTIONS) {
      counts[col] = Object.keys(railwayDbMemory.collections[col] || {}).length;
    }
    res.json({
      success: true,
      storageTargetMode: railwayDbMemory.storageTargetMode || 'railway',
      updatedAt: railwayDbMemory.updatedAt,
      capacityBytes: RAILWAY_TOTAL_CAPACITY_BYTES,
      usedBytes,
      counts,
      collections: railwayDbMemory.collections,
      deletedIds: railwayDbMemory.deletedIds || {}
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Railway DB state error' });
  }
});

// Saqlash manbasini o'zgartirish ('railway' | 'firestore' | 'both')
app.post('/api/railway-db/config', (req, res) => {
  try {
    const { storageTargetMode } = req.body || {};
    if (!['railway', 'firestore', 'both'].includes(storageTargetMode)) {
      return res.status(400).json({ success: false, error: "Noto'g'ri saqlash rejimi" });
    }
    railwayDbMemory.storageTargetMode = storageTargetMode;
    saveRailwayDbToDisk();
    res.json({
      success: true,
      storageTargetMode: railwayDbMemory.storageTargetMode,
      updatedAt: railwayDbMemory.updatedAt
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Config update error' });
  }
});

// Bitta hujjatni Railway bazasiga saqlash yoki yangilash
app.post('/api/railway-db/doc', (req, res) => {
  try {
    const { collection: colName, id, data, merge = true } = req.body || {};
    if (!colName || !VALID_COLLECTIONS.includes(colName) || !id || !data) {
      return res.status(400).json({ success: false, error: "Kolleksiya nomi, ID yoki ma'lumot yetarli emas" });
    }
    const colMap = railwayDbMemory.collections[colName as keyof typeof railwayDbMemory.collections] || {};
    const existing = colMap[id] || {};
    const docToSave = merge
      ? { ...existing, ...data, id, _storageSource: 'railway', _savedAt: new Date().toISOString() }
      : { ...data, id, _storageSource: 'railway', _savedAt: new Date().toISOString() };

    colMap[id] = docToSave;
    railwayDbMemory.collections[colName as keyof typeof railwayDbMemory.collections] = colMap;

    // Agar ilgari o'chirilganlar ro'yxatida bo'lsa, undan chiqarish
    if (Array.isArray(railwayDbMemory.deletedIds[colName])) {
      railwayDbMemory.deletedIds[colName] = railwayDbMemory.deletedIds[colName].filter(delId => delId !== id);
    }

    saveRailwayDbToDisk();
    res.json({ success: true, doc: docToSave, updatedAt: railwayDbMemory.updatedAt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Document save error' });
  }
});

// Hujjatni Railway bazasidan o'chirish
app.delete('/api/railway-db/doc/:collection/:id', (req, res) => {
  try {
    const colName = req.params.collection as keyof typeof railwayDbMemory.collections;
    const id = req.params.id;
    if (!colName || !VALID_COLLECTIONS.includes(colName) || !id) {
      return res.status(400).json({ success: false, error: "Kolleksiya yoki ID noto'g'ri" });
    }
    if (railwayDbMemory.collections[colName] && railwayDbMemory.collections[colName][id]) {
      delete railwayDbMemory.collections[colName][id];
    }
    if (!Array.isArray(railwayDbMemory.deletedIds[colName])) {
      railwayDbMemory.deletedIds[colName] = [];
    }
    if (!railwayDbMemory.deletedIds[colName].includes(id)) {
      railwayDbMemory.deletedIds[colName].push(id);
    }
    saveRailwayDbToDisk();
    res.json({ success: true, deletedId: id, updatedAt: railwayDbMemory.updatedAt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Document delete error' });
  }
});

// Firestore'dan yoki zaxira fayldan Railway bazasiga ommaviy nusxalash (0% yo'qotishsiz)
app.post('/api/railway-db/bulk-sync', (req, res) => {
  try {
    const { collections } = req.body || {};
    if (!collections || typeof collections !== 'object') {
      return res.status(400).json({ success: false, error: "Ma'lumotlar obyekti yuborilmadi" });
    }
    let syncedCount = 0;
    for (const colName of VALID_COLLECTIONS) {
      const incoming = collections[colName];
      if (Array.isArray(incoming)) {
        const colMap = railwayDbMemory.collections[colName] || {};
        incoming.forEach((item: any) => {
          if (item && item.id) {
            colMap[item.id] = {
              ...(colMap[item.id] || {}),
              ...item,
              _storageSource: colMap[item.id]?._storageSource || 'railway',
              _syncedAt: new Date().toISOString()
            };
            syncedCount++;
          }
        });
        railwayDbMemory.collections[colName] = colMap;
      } else if (incoming && typeof incoming === 'object') {
        const colMap = railwayDbMemory.collections[colName] || {};
        Object.entries(incoming).forEach(([docId, item]: [string, any]) => {
          if (item && typeof item === 'object') {
            colMap[docId] = {
              ...(colMap[docId] || {}),
              ...item,
              id: docId,
              _storageSource: 'railway',
              _syncedAt: new Date().toISOString()
            };
            syncedCount++;
          }
        });
        railwayDbMemory.collections[colName] = colMap;
      }
    }
    saveRailwayDbToDisk();
    res.json({
      success: true,
      syncedCount,
      updatedAt: railwayDbMemory.updatedAt
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Bulk sync error' });
  }
});

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

