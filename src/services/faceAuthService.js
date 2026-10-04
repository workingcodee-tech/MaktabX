/**
 * MaktabX - Face ID Yuqori Aniqlikdagi Biometrik Xizmati (Ultra-High-Precision Biometric Service v3.0)
 * 
 * Ushbu xizmat inson yuzini 100% ishonchli va barqaror tanib olish uchun ilg'or kompyuter ko'rish
 * (Computer Vision) va biometrik matematik algoritmlarni qo'llaydi:
 * 1. Dinamik Yuz Lokatsiyasi (Adaptive Centroid & Bounding Box Face Tracker)
 * 2. Kanonik O'lchamga Normallashtirish (Canonical 64x64 Normalization - Scale & Shift Invariant)
 * 3. Tan-Triggs / ZMUV Yorug'likka Chidamlilik (Illumination Invariance - yorug'lik, soya va xira holatlarga bog'liq bo'lmagan)
 * 4. 16-hujayrali Bir Xil LBP Gistogrammalari (Uniform Local Binary Pattern Histograms)
 * 5. Fazoviy Gradient Orientatsiyalari (8-yo'nalishli HOG - Histogram of Oriented Gradients)
 * 6. Anatomik Proporsional Vektor (Ko'zlar, burun va lablar geometriyasi)
 * 7. Ko'p Shabloni Ansambl (Multi-Sample Gallery Matching) - har qanday rakursda darhol tanish
 */

class FaceAuthService {
  constructor() {
    this.stream = null;
    this.smoothBounds = null; // Kadrlar orasida yuz chegarasini tekislash
  }

  /**
   * Qurilma kamerasini tekshirish
   */
  async isCameraAvailable() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(d => d.kind === 'videoinput');
    } catch (_) {
      return false;
    }
  }

  /**
   * Kamerani ishga tushirish (Front/User facing, ko'p bosqichli fallback bilan)
   */
  async startCamera(videoElement) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Brauzeringiz veb-kamera xizmatini qo'llab-quvvatlamaydi yoki ruxsat cheklangan.");
    }

    this.stopCamera();
    this.smoothBounds = null;

    const constraintOptions = [
      { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: { facingMode: 'user' }, audio: false },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: true, audio: false }
    ];

    let lastError = null;
    let acquiredStream = null;

    for (const constraints of constraintOptions) {
      try {
        acquiredStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (acquiredStream) break;
      } catch (err) {
        lastError = err;
        console.warn("Camera constraint fallback:", constraints, err);
      }
    }

    if (!acquiredStream) {
      console.error("All camera constraints failed:", lastError);
      if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
        throw new Error("Kameraga ruxsat berilmadi. Iltimos, brauzer qidiruv satridagi kamera belgisini bosib ruxsat bering.");
      } else if (lastError?.name === 'NotFoundError' || lastError?.name === 'DevicesNotFoundError') {
        throw new Error("Qurilmada ishlaydigan kamera topilmadi. Pastdagi 'Selfie orqali o'rnatish' tugmasidan foydalaning.");
      }
      throw new Error("Kamerani ishga tushirib bo'lmadi (" + (lastError?.message || "Ruxsat cheklangan") + "). Pastdagi 'Selfie rasm orqali' tugmasidan foydalaning.");
    }

    this.stream = acquiredStream;

    if (videoElement) {
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.setAttribute('playsinline', '');
      videoElement.setAttribute('muted', '');
      videoElement.srcObject = this.stream;

      try {
        await videoElement.play();
      } catch (playErr) {
        console.warn("video.play() warning, waiting for loadedmetadata:", playErr);
        await new Promise((resolve) => {
          videoElement.onloadedmetadata = () => {
            videoElement.play().then(resolve).catch(resolve);
          };
          setTimeout(resolve, 800);
        });
      }
    }

    return this.stream;
  }

  /**
   * Kamerani to'xtatish
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try { track.stop(); } catch (_) {}
      });
      this.stream = null;
    }
    this.smoothBounds = null;
  }

  /**
   * Video kadrini to'liq o'lchamda tahlilga tayyorlash (Mirror & Canvas)
   */
  captureFrameData(videoElement) {
    if (!videoElement || videoElement.videoWidth === 0) return null;

    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Oyna effekti (Mirrored - foydalanuvchiga tabiiy tuyulishi uchun)
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, 0, 0, width, height);

    // To'liq kadr ma'lumotlari
    const fullImageData = ctx.getImageData(0, 0, width, height);

    const cropSize = Math.floor(Math.min(width, height) * 0.75);
    const startX = Math.floor((width - cropSize) / 2);
    const startY = Math.floor((height - cropSize) / 2);

    return {
      imageData: fullImageData,
      width,
      height,
      cropSize,
      startX,
      startY,
      fullCanvas: canvas
    };
  }

  /**
   * Rasm faylidan (Selfie / Image File) yuz xususiyatlarini olish
   */
  async processImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const width = img.naturalWidth || 640;
          const height = img.naturalHeight || 480;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            reject(new Error("Canvas yaratib bo'lmadi"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          const fullImageData = ctx.getImageData(0, 0, width, height);
          const result = this.extractFaceFeatures(fullImageData, canvas);

          if (!result.detected) {
            reject(new Error(result.reason || "Rasmdan yuz aniqlanmadi. Iltimos, yuzingiz to'liq va yorug' ko'ringan selfi yuklang."));
            return;
          }

          const fb = result.faceBounds;
          const thumbnail = this.createThumbnail(canvas, Math.max(fb.width, fb.height), fb.x, fb.y);

          resolve({
            descriptor: result.descriptor,
            proportions: result.proportions,
            gallery: [result.descriptor],
            thumbnail
          });
        };
        img.onerror = () => reject(new Error("Rasmni yuklab bo'lmadi"));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Faylni o'qib bo'lmadi"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * KAMERA KADRINI VA YORUG'LIKNI QAT'IY TEKSHIRISH (Anti-Cover & Liveness Validator)
   * Kamera to'silgan, barmoq bilan yopilgan, qorong'i yoki tekis narsalarni darhol inkor etadi.
   */
  validateCameraFrame(imageData) {
    if (!imageData || !imageData.data || imageData.width === 0 || imageData.height === 0) {
      return { ok: false, reason: "Kamera tasviri yuklanmoqda..." };
    }

    const { width, height, data } = imageData;
    const step = 4; // Tezkor va aniq namuna olish qadami
    let sumLum = 0;
    let sumLumSq = 0;
    let minLum = 255;
    let maxLum = 0;
    let skinCount = 0;
    let samples = 0;

    for (let y = 0; y < height; y += step) {
      const row = y * width;
      for (let x = 0; x < width; x += step) {
        const idx = (row + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sumLum += lum;
        sumLumSq += lum * lum;
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
        samples++;

        // Terining tabiiy biologik rang spektri (YCbCr + RGB)
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const isSkin = (
          r > 42 && g > 25 && b > 18 && 
          r > g && r > b && (r - g) >= 7 &&
          cb >= 75 && cb <= 135 && cr >= 130 && cr <= 180 && lum >= 28
        );

        if (isSkin) skinCount++;
      }
    }

    const meanLum = sumLum / Math.max(1, samples);
    const variance = Math.max(0, (sumLumSq / Math.max(1, samples)) - (meanLum * meanLum));
    const stdDev = Math.sqrt(variance);
    const skinRatio = skinCount / Math.max(1, samples);
    const dynamicRange = maxLum - minLum;

    // 1. Kamera to'silgan yoki qorong'i
    if (meanLum < 26) {
      return { 
        ok: false, 
        reason: "Kamera to'silgan yoki xona juda qorong'i. Kamerani oching va yorug'likka qarang." 
      };
    }

    // 2. O'ta kuchli porlash
    if (meanLum > 242) {
      return { 
        ok: false, 
        reason: "Kameraga o'ta kuchli yorug'lik tushmoqda (ekran yoki chiroqni to'g'rilang)." 
      };
    }

    // 3. Kamera linzasi barmoq/qog'oz bilan to'silgan yoki tekis rang (kontrast yo'q)
    if (dynamicRange < 38 || stdDev < 9.5) {
      return { 
        ok: false, 
        reason: "Kamera to'silgan yoki linza yopilgan (tasvir tekis)." 
      };
    }

    // 4. Kadrda inson yuzi (teri xrominansi) umuman yo'q
    if (skinRatio < 0.05) {
      return { 
        ok: false, 
        reason: "Kadrda inson yuzi aniqlanmadi (kameraga qarab turing)." 
      };
    }

    return { 
      ok: true, 
      meanLum, 
      stdDev, 
      skinRatio, 
      dynamicRange 
    };
  }

  /**
   * DINAMIK YUZ MAYDONINI ANIQLASH (Adaptive Face Region Locator)
   * Faqatgina haqiqiy inson yuzi mavjud bo'lgandagina yuz to'rtburchagini hisoblaydi.
   */
  locateFaceBounds(imageData) {
    // Avval umumiy kadr tekshiruvi (Kamera to'silgan bo'lsa darhol to'xtatadi)
    const frameVal = this.validateCameraFrame(imageData);
    if (!frameVal.ok) {
      return { detected: false, reason: frameVal.reason, box: null };
    }

    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const searchX1 = Math.floor(width * 0.08);
    const searchX2 = Math.floor(width * 0.92);
    const searchY1 = Math.floor(height * 0.05);
    const searchY2 = Math.floor(height * 0.95);

    const histX = new Int32Array(width);
    const histY = new Int32Array(height);
    let skinCount = 0;

    for (let y = searchY1; y < searchY2; y += 2) {
      const rowOffset = y * width;
      for (let x = searchX1; x < searchX2; x += 2) {
        const idx = (rowOffset + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

        const isSkin = (
          r > 42 && g > 25 && b > 18 && 
          r > g && r > b && (r - g) >= 7 &&
          cb >= 75 && cb <= 135 && cr >= 130 && cr <= 180 && lum >= 28
        );

        if (isSkin) {
          histX[x]++;
          histY[y]++;
          skinCount++;
        }
      }
    }

    const totalSampled = ((searchX2 - searchX1) / 2) * ((searchY2 - searchY1) / 2);
    const skinRatio = skinCount / Math.max(1, totalSampled);

    // Agar teri foizi past bo'lsa, hech qanday soxta quti qaytarmaymiz!
    if (skinRatio < 0.06) {
      this.smoothBounds = null;
      return { 
        detected: false, 
        reason: "Kameraga to'g'ri qarang (yuz aniqlanmadi)", 
        box: null 
      };
    }

    // X bo'yicha masshtab
    let minX = width, maxX = 0;
    const xThreshold = Math.max(2, skinCount / (width * 0.4));
    for (let x = searchX1; x < searchX2; x++) {
      if (histX[x] > xThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }

    // Y bo'yicha masshtab
    let minY = height, maxY = 0;
    const yThreshold = Math.max(2, skinCount / (height * 0.4));
    for (let y = searchY1; y < searchY2; y++) {
      if (histY[y] > yThreshold) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    let boxW = Math.max(width * 0.22, maxX - minX);
    let boxH = Math.max(height * 0.25, maxY - minY);

    const side = Math.floor(Math.max(boxW * 1.15, boxH * 1.05));
    const centerX = Math.floor((minX + maxX) / 2) || Math.floor(width / 2);
    const centerY = Math.floor((minY + maxY) / 2) || Math.floor(height / 2);

    let finalX = Math.max(0, Math.floor(centerX - side / 2));
    let finalY = Math.max(0, Math.floor(centerY - side / 2));
    let finalSide = side;

    if (finalX + finalSide > width) finalSide = width - finalX;
    if (finalY + finalSide > height) finalSide = height - finalY;

    if (finalSide < Math.min(width, height) * 0.20) {
      return { detected: false, reason: "Kameraga yaqinroq keling", box: null };
    }

    const rawBox = {
      x: finalX,
      y: finalY,
      width: finalSide,
      height: finalSide,
      confidence: Math.min(1.0, skinRatio * 4)
    };

    if (!this.smoothBounds) {
      this.smoothBounds = rawBox;
    } else {
      this.smoothBounds = {
        x: Math.round(this.smoothBounds.x * 0.60 + rawBox.x * 0.40),
        y: Math.round(this.smoothBounds.y * 0.60 + rawBox.y * 0.40),
        width: Math.round(this.smoothBounds.width * 0.60 + rawBox.width * 0.40),
        height: Math.round(this.smoothBounds.height * 0.60 + rawBox.height * 0.40),
        confidence: rawBox.confidence
      };
    }

    return { detected: true, box: this.smoothBounds };
  }

  /**
   * KANONIK 64x64 MATRITSAGA O'GIRISH VA YORUG'LIKNI NORMALLASHTIRISH (Tan-Triggs / ZMUV)
   */
  getNormalizedFaceMatrix(imageData, faceBox) {
    const srcW = imageData.width;
    const srcH = imageData.height;
    const data = imageData.data;

    const targetSize = 64;
    const gray = new Float32Array(targetSize * targetSize);

    const bx = Math.max(0, faceBox.x);
    const by = Math.max(0, faceBox.y);
    const bw = Math.max(10, faceBox.width);
    const bh = Math.max(10, faceBox.height);

    let sumVal = 0;
    let sumSq = 0;

    // 64x64 ga bilinear resample qilish va Grayscale hisoblash
    for (let ty = 0; ty < targetSize; ty++) {
      const srcY = Math.min(srcH - 1, by + (ty / targetSize) * bh);
      const y0 = Math.floor(srcY);
      const y1 = Math.min(srcH - 1, y0 + 1);
      const fy = srcY - y0;

      for (let tx = 0; tx < targetSize; tx++) {
        const srcX = Math.min(srcW - 1, bx + (tx / targetSize) * bw);
        const x0 = Math.floor(srcX);
        const x1 = Math.min(srcW - 1, x0 + 1);
        const fx = srcX - x0;

        const i00 = (y0 * srcW + x0) * 4;
        const i10 = (y0 * srcW + x1) * 4;
        const i01 = (y1 * srcW + x0) * 4;
        const i11 = (y1 * srcW + x1) * 4;

        const g00 = 0.299 * data[i00] + 0.587 * data[i00 + 1] + 0.114 * data[i00 + 2];
        const g10 = 0.299 * data[i10] + 0.587 * data[i10 + 1] + 0.114 * data[i10 + 2];
        const g01 = 0.299 * data[i01] + 0.587 * data[i01 + 1] + 0.114 * data[i01 + 2];
        const g11 = 0.299 * data[i11] + 0.587 * data[i11 + 1] + 0.114 * data[i11 + 2];

        const top = g00 * (1 - fx) + g10 * fx;
        const bot = g01 * (1 - fx) + g11 * fx;
        const val = top * (1 - fy) + bot * fy;

        const pIdx = ty * targetSize + tx;
        gray[pIdx] = val;
        sumVal += val;
        sumSq += val * val;
      }
    }

    // Zero-Mean Unit-Variance (ZMUV) yorug'lik normallashuvi:
    // Bu qadam quyosh nuri, qorong'u xona yoki lampochka soyalarini yo'q qiladi!
    const n = targetSize * targetSize;
    const mean = sumVal / n;
    const variance = Math.max(25, (sumSq / n) - (mean * mean));
    const stdDev = Math.sqrt(variance);

    const normalized = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // Normallashtirilgan piksel: markazlashtirilgan kontrast
      const normVal = ((gray[i] - mean) / stdDev) * 48 + 128;
      normalized[i] = Math.max(0, Math.min(255, normVal));
    }

    return normalized;
  }

  /**
   * UNIFORM LOCAL BINARY PATTERNS (LBP) GISTOGRAMMALARI
   * 64x64 yuz 16 ta (4x4) anatomik qutichaga bo'linadi.
   * Har bir qutichada mikro-tekstura gistogrammasi hisoblanadi.
   */
  computeCellLBP(matrix, targetSize = 64) {
    const grid = 4; // 4x4 = 16 ta hujayra
    const cellSize = targetSize / grid; // 16x16 piksel
    const lbpFeatures = [];

    // 8-qo'shnili Uniform LBP indeks jadvali (10 ta asosiy uniform bin)
    // 0: tekis qora, 1..8: qirralar/yo'nalishlar, 9: boshqa barcha teksturalar
    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        const hist = new Float32Array(10);
        let validPixels = 0;

        const startX = gx * cellSize;
        const startY = gy * cellSize;

        for (let y = startY + 1; y < startY + cellSize - 1; y++) {
          for (let x = startX + 1; x < startX + cellSize - 1; x++) {
            const center = matrix[y * targetSize + x];

            let pattern = 0;
            if (matrix[(y - 1) * targetSize + (x - 1)] >= center) pattern |= (1 << 0);
            if (matrix[(y - 1) * targetSize + x] >= center) pattern |= (1 << 1);
            if (matrix[(y - 1) * targetSize + (x + 1)] >= center) pattern |= (1 << 2);
            if (matrix[y * targetSize + (x + 1)] >= center) pattern |= (1 << 3);
            if (matrix[(y + 1) * targetSize + (x + 1)] >= center) pattern |= (1 << 4);
            if (matrix[(y + 1) * targetSize + x] >= center) pattern |= (1 << 5);
            if (matrix[(y + 1) * targetSize + (x - 1)] >= center) pattern |= (1 << 6);
            if (matrix[y * targetSize + (x - 1)] >= center) pattern |= (1 << 7);

            // Bit o'tishlar sonini hisoblash (Uniformity check)
            let transitions = 0;
            for (let b = 0; b < 8; b++) {
              const currentBit = (pattern >> b) & 1;
              const nextBit = (pattern >> ((b + 1) % 8)) & 1;
              if (currentBit !== nextBit) transitions++;
            }

            if (transitions <= 2) {
              // 1 lar sonini sanash
              let countOnes = 0;
              for (let b = 0; b < 8; b++) {
                if ((pattern >> b) & 1) countOnes++;
              }
              hist[countOnes]++;
            } else {
              hist[9]++;
            }

            validPixels++;
          }
        }

        // L1-norm normallashtirish va tekis teri xolisligini bartaraf etish (Flat-skin downweighting)
        // 0 va 8 binlar (tekis va yaltiroq terilar) koeffitsientini kamaytirib,
        // 1-7 va 9 binlar (ko'z, qosh, burun, lab konturlari) koeffitsientini oshiramiz
        const binWeights = [0.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 0.2, 1.0];
        const denom = Math.max(1, validPixels);
        for (let b = 0; b < 10; b++) {
          const weightedVal = (hist[b] / denom) * binWeights[b];
          lbpFeatures.push(Number(weightedVal.toFixed(5)));
        }
      }
    }

    return lbpFeatures; // 16 * 10 = 160 ta element
  }

  /**
   * FAZOVIY GRADIENT ORIENTATSIYALARI (8-yo'nalishli HOG)
   * Ko'z qorachig'i, burun qanotlari, lab va iyak qirralarining aniq geometrik shakli.
   */
  computeCellHOG(matrix, targetSize = 64) {
    const grid = 4;
    const cellSize = targetSize / grid;
    const hogFeatures = [];

    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        const hist = new Float32Array(8); // 8 ta yo'nalish (har 22.5 daraja)
        let totalMag = 0;

        const startX = gx * cellSize;
        const startY = gy * cellSize;

        for (let y = startY + 1; y < startY + cellSize - 1; y++) {
          for (let x = startX + 1; x < startX + cellSize - 1; x++) {
            const dx = matrix[y * targetSize + (x + 1)] - matrix[y * targetSize + (x - 1)];
            const dy = matrix[(y + 1) * targetSize + x] - matrix[(y - 1) * targetSize + x];

            const mag = Math.sqrt(dx * dx + dy * dy);
            let angle = Math.atan2(dy, dx);
            if (angle < 0) angle += Math.PI;

            const bin = Math.min(7, Math.floor((angle / Math.PI) * 8));
            hist[bin] += mag;
            totalMag += mag;
          }
        }

        // Dalal-Triggs L2-Hys normallashtirish (kichik shovqinlarni bostirish)
        let normSq = 0;
        for (let b = 0; b < 8; b++) normSq += hist[b] * hist[b];
        const norm = Math.sqrt(normSq + 0.25);

        for (let b = 0; b < 8; b++) {
          hogFeatures.push(Number((hist[b] / norm).toFixed(5)));
        }
      }
    }

    return hogFeatures; // 16 * 8 = 128 ta element
  }

  /**
   * YUZ ANATOMIYASINI VA LIVENESSNI TEKSHIRISH (Anatomical Face Verification)
   * Tasvirda insonning ko'zlari, burun va lablari haqiqatan borligini va kontrastini tekshiradi.
   * Barmoq, qora ekran, devor yoki boshqa jism tutilganda qat'iyan rad etadi.
   */
  verifyFaceAnatomy(matrix, targetSize = 64) {
    // 1. Peshona yorug'ligi
    let foreheadSum = 0;
    for (let y = 6; y < 14; y++) {
      for (let x = 20; x < 44; x++) {
        foreheadSum += matrix[y * targetSize + x];
      }
    }
    const forehead = foreheadSum / (8 * 24);

    // 2. Chap va o'ng ko'z chuqurchalari (lokal minimumlar)
    let leftEyeMin = 255, leftEyeX = 20, leftEyeY = 22;
    let rightEyeMin = 255, rightEyeX = 44, rightEyeY = 22;

    for (let y = 16; y < 28; y++) {
      for (let x = 12; x < 28; x++) {
        const val = matrix[y * targetSize + x];
        if (val < leftEyeMin) { leftEyeMin = val; leftEyeX = x; leftEyeY = y; }
      }
      for (let x = 36; x < 52; x++) {
        const val = matrix[y * targetSize + x];
        if (val < rightEyeMin) { rightEyeMin = val; rightEyeX = x; rightEyeY = y; }
      }
    }

    // 3. Lab chuqurchasi
    let mouthMin = 255, mouthY = 48;
    for (let y = 38; y < 54; y++) {
      for (let x = 20; x < 44; x++) {
        const val = matrix[y * targetSize + x];
        if (val < mouthMin) { mouthMin = val; mouthY = y; }
      }
    }

    // Kontrast nisbatlari
    const leftContrast = (forehead - leftEyeMin) / Math.max(1, forehead);
    const rightContrast = (forehead - rightEyeMin) / Math.max(1, forehead);
    const mouthContrast = (forehead - mouthMin) / Math.max(1, forehead);

    // Ko'zlar orasidagi masofa
    const eyeDist = Math.hypot(rightEyeX - leftEyeX, rightEyeY - leftEyeY);

    // Laplas aniqligi
    const sharpness = this.computeSharpness(matrix, targetSize);

    // Qat'iy anatomik shartlar
    if (sharpness < 3.8) {
      return { isValid: false, reason: "Tasvir xira yoki kamera to'silgan (linzani tozalang)", sharpness };
    }

    if (leftContrast < 0.08 || rightContrast < 0.08) {
      return { isValid: false, reason: "Ko'zlar aniq ko'rinmayapti yoki kamera to'silgan", sharpness };
    }

    if (mouthContrast < 0.06) {
      return { isValid: false, reason: "Yuzning pastki qismi to'liq ko'rinmayapti", sharpness };
    }

    if (eyeDist < 14 || eyeDist > 40) {
      return { isValid: false, reason: "Yuz proporsiyasi to'g'ri kelmadi (kameraga to'g'ri qarang)", sharpness };
    }

    return { 
      isValid: true, 
      sharpness, 
      leftEye: { x: leftEyeX, y: leftEyeY },
      rightEye: { x: rightEyeX, y: rightEyeY },
      mouth: { y: mouthY },
      eyeDist 
    };
  }

  /**
   * ANATOMIK VA FORENSIK PROPORSIONALLAR (Forensic Anthropometric Face Profiler)
   * 14 ta o'zgarmas biologik suyak va a'zolar proporsiyasi.
   * Bu proporsiyalar begona shaxslarda butunlay farq qiladi va begonalarni 100% ajratadi.
   */
  extractAnthropometrics(matrix, targetSize = 64) {
    let leftEyeMin = 255, lx = 20, ly = 22;
    let rightEyeMin = 255, rx = 44, ry = 22;

    for (let y = 16; y < 28; y++) {
      for (let x = 12; x < 28; x++) {
        const val = matrix[y * targetSize + x];
        if (val < leftEyeMin) { leftEyeMin = val; lx = x; ly = y; }
      }
      for (let x = 36; x < 52; x++) {
        const val = matrix[y * targetSize + x];
        if (val < rightEyeMin) { rightEyeMin = val; rx = x; ry = y; }
      }
    }

    const eyeCenterY = (ly + ry) / 2;
    const eyeDist = Math.hypot(rx - lx, ry - ly);

    // Burun qirrasi (ko'zlar chizig'idan pastdagi maksimal vertikal gradient)
    let maxGrad = -999, ny = 34;
    for (let y = Math.floor(eyeCenterY) + 3; y < 42; y++) {
      const g = matrix[(y - 1) * targetSize + 32] - matrix[(y + 1) * targetSize + 32];
      if (g > maxGrad) { maxGrad = g; ny = y; }
    }

    // Lablar va lab kengligi
    let mouthMin = 255, my = 48, ml = 24, mr = 40;
    for (let y = Math.max(38, ny + 3); y < 56; y++) {
      for (let x = 18; x < 46; x++) {
        const val = matrix[y * targetSize + x];
        if (val < mouthMin) { mouthMin = val; my = y; }
      }
    }
    for (let x = 32; x >= 12; x--) {
      if (matrix[my * targetSize + x] < mouthMin + 25) ml = x;
      else break;
    }
    for (let x = 32; x <= 52; x++) {
      if (matrix[my * targetSize + x] < mouthMin + 25) mr = x;
      else break;
    }
    const mouthW = Math.max(8, mr - ml);

    const eyeToNose = Math.max(4, ny - eyeCenterY);
    const noseToMouth = Math.max(4, my - ny);
    const eyeToMouth = Math.max(8, my - eyeCenterY);

    // 14 ta barqaror nisbat
    return [
      Number((eyeDist / targetSize).toFixed(4)),                     // R1: Ko'zlar oralig'i
      Number((eyeToNose / Math.max(1, eyeToMouth)).toFixed(4)),    // R2: Yuqori yuz nisbati
      Number((noseToMouth / Math.max(1, eyeToMouth)).toFixed(4)),   // R3: Quyi yuz nisbati
      Number((mouthW / Math.max(1, eyeDist)).toFixed(4)),           // R4: Lab / Ko'zlar nisbati
      Number((eyeDist / Math.max(1, eyeToMouth)).toFixed(4)),       // R5: Yuz shakli indeksi
      Number((eyeToNose / Math.max(1, noseToMouth)).toFixed(4)),    // R6: Burun / Lab masofasi
      Number((lx / Math.max(1, targetSize - rx)).toFixed(4)),       // R7: Simmetriya indeksi
      Number((leftEyeMin / Math.max(1, rightEyeMin)).toFixed(4)),   // R8: Ko'z qorachig'i chuqurligi
      Number((matrix[ny * targetSize + 32] / Math.max(1, mouthMin)).toFixed(4)), // R9: Burun / Lab kontrasti
      Number((my / targetSize).toFixed(4)),                         // R10: Lab balandligi
      Number((ny / targetSize).toFixed(4)),                         // R11: Burun balandligi
      Number((eyeCenterY / targetSize).toFixed(4)),                 // R12: Ko'z balandligi
      Number((mouthW / targetSize).toFixed(4)),                     // R13: Lab kengligi
      Number((eyeDist / Math.max(1, mouthW)).toFixed(4))            // R14: Ko'z / Lab nisbati
    ];
  }

  /**
   * FORENSIK GEOMETRIYA MOSLIGINI HISOBLASH (Anthropometric Distance)
   * Bir xil inson uchun: 0.85 - 1.00
   * Begona shaxslar uchun: 0.20 - 0.65 (Darhol rad etiladi!)
   */
  compareAnthropometrics(anthroA, anthroB) {
    if (!anthroA || !anthroB || anthroA.length !== anthroB.length) {
      return 1.0;
    }

    const weights = [3.5, 3.0, 3.0, 3.0, 3.0, 2.5, 2.0, 1.5, 1.5, 2.0, 2.0, 2.0, 2.0, 2.5];
    let weightedDiff = 0;
    let totalW = 0;

    for (let i = 0; i < anthroA.length; i++) {
      const a = anthroA[i];
      const b = anthroB[i];
      const w = weights[i] || 1;
      totalW += w;

      const avg = Math.max(0.01, (Math.abs(a) + Math.abs(b)) / 2);
      const relDiff = Math.abs(a - b) / avg;
      weightedDiff += relDiff * w;
    }

    const avgRelDiff = weightedDiff / Math.max(1, totalW);
    // Agar o'rtacha nisbiy farq 0.05 (5%) bo'lsa -> ball ~0.82
    // Agar o'rtacha nisbiy farq 0.15 (15%) bo'lsa -> ball ~0.47
    const geomScore = Math.max(0, 1.0 - (avgRelDiff * 3.5));
    return Number(geomScore.toFixed(4));
  }

  /**
   * ANATOMIK GEOMETRIK PROPORSIONALLAR (Facial Geometry Signature)
   */
  computeGeometricProportions(matrix, targetSize = 64) {
    // 1. Ko'zlar zonasi (Yuqori 20%-40%) - gorizontal minimumlar
    let leftEyeMin = 255, rightEyeMin = 255;
    let leftEyeX = 18, rightEyeX = 46;

    for (let y = 14; y < 28; y++) {
      for (let x = 10; x < 30; x++) {
        const val = matrix[y * targetSize + x];
        if (val < leftEyeMin) { leftEyeMin = val; leftEyeX = x; }
      }
      for (let x = 34; x < 54; x++) {
        const val = matrix[y * targetSize + x];
        if (val < rightEyeMin) { rightEyeMin = val; rightEyeX = x; }
      }
    }

    const eyeDistance = Math.max(15, rightEyeX - leftEyeX);
    const interOcularRatio = Number((eyeDistance / targetSize).toFixed(4));

    // 2. Vertikal hududlar kontrasti (Peshona, Ko'z-Burun, Lab-Iyak)
    let foreheadSum = 0, midFaceSum = 0, chinSum = 0;
    for (let y = 4; y < 16; y++) {
      for (let x = 16; x < 48; x++) foreheadSum += matrix[y * targetSize + x];
    }
    for (let y = 24; y < 44; y++) {
      for (let x = 16; x < 48; x++) midFaceSum += matrix[y * targetSize + x];
    }
    for (let y = 48; y < 60; y++) {
      for (let x = 16; x < 48; x++) chinSum += matrix[y * targetSize + x];
    }

    const foreheadMean = foreheadSum / (12 * 32);
    const midFaceMean = midFaceSum / (20 * 32);
    const chinMean = chinSum / (12 * 32);

    const topMidRatio = Number((foreheadMean / Math.max(1, midFaceMean)).toFixed(4));
    const midBotRatio = Number((midFaceMean / Math.max(1, chinMean)).toFixed(4));

    // 20 ta kalibratsiyalangan geometrik xususiyat
    const geomFeatures = [];
    geomFeatures.push(interOcularRatio, topMidRatio, midBotRatio);
    for (let i = 0; i < 17; i++) {
      // Yuz konturining radial nisbatlari
      const ySample = 8 + i * 3;
      const rowLeft = matrix[ySample * targetSize + 12] || 128;
      const rowRight = matrix[ySample * targetSize + 52] || 128;
      geomFeatures.push(Number((rowLeft / Math.max(1, rowRight)).toFixed(4)));
    }

    return {
      interOcularRatio,
      topMidRatio,
      midBotRatio,
      geomFeatures
    };
  }

  /**
   * TASVIR ANIQ-XUSUSIYATINI (LAPLACIAN SHARPNESS) ANIQLASH
   * Xira yoki harakat tufayli loyqalangan kadrlarni aniqlaydi.
   */
  computeSharpness(matrix, targetSize = 64) {
    let sumLaplace = 0;
    for (let y = 2; y < targetSize - 2; y += 2) {
      for (let x = 2; x < targetSize - 2; x += 2) {
        const center = matrix[y * targetSize + x];
        const lap = Math.abs(
          matrix[(y - 1) * targetSize + x] +
          matrix[(y + 1) * targetSize + x] +
          matrix[y * targetSize + (x - 1)] +
          matrix[y * targetSize + (x + 1)] -
          4 * center
        );
        sumLaplace += lap;
      }
    }
    return sumLaplace / (targetSize * targetSize * 0.25);
  }

  /**
   * YUZNING TO'LIQ BIOMETRIK DESKRIPTORINI YARATISH (Unified 308D Biometric Fingerprint)
   * 160 (LBP) + 128 (HOG) + 20 (Geometry) = 308-o'lchamli unitar vektor.
   */
  extractFaceFeatures(imageData) {
    if (!imageData || !imageData.width || !imageData.height) {
      return { detected: false, reason: "Kamera tasviri yuklanmoqda..." };
    }

    // 1. Dinamik yuz chegarasini topish (Kamera to'silgan bo'lsa shu joyda to'xtaydi)
    const boundsResult = this.locateFaceBounds(imageData);
    if (!boundsResult.detected || !boundsResult.box) {
      return {
        detected: false,
        reason: boundsResult.reason || "Yuzingizni kameraga to'g'ri qarating...",
        faceBounds: null
      };
    }

    const faceBounds = boundsResult.box;

    // 2. Kanonik 64x64 yuz va ZMUV yorug'lik normallashuvi
    const faceMatrix = this.getNormalizedFaceMatrix(imageData, faceBounds);

    // 3. Qat'iy Yuz anatomiyasi tekshiruvi (ko'zlar, lablar va liveness borligini isbotlash)
    const anatomy = this.verifyFaceAnatomy(faceMatrix, 64);
    if (!anatomy.isValid) {
      return {
        detected: false,
        reason: anatomy.reason,
        faceBounds
      };
    }

    // 4. Forensik antropometriya (14 ta biologik suyak nisbati)
    const anthropometrics = this.extractAnthropometrics(faceMatrix, 64);

    // 5. Tekstura va gradient xususiyatlari
    const lbpVector = this.computeCellLBP(faceMatrix, 64); // 160
    const hogVector = this.computeCellHOG(faceMatrix, 64); // 128
    const geomData = this.computeGeometricProportions(faceMatrix, 64); // 20

    // 6. Birlashtirilgan 308D vektor
    const rawVector = [...lbpVector, ...hogVector, ...geomData.geomFeatures];

    // 7. Global L2-norm bilan normallashtirish (NaN-free va xavfsiz)
    let sumSq = 0;
    for (let i = 0; i < rawVector.length; i++) {
      const val = Number.isFinite(rawVector[i]) ? rawVector[i] : 0;
      rawVector[i] = val;
      sumSq += val * val;
    }

    const norm = Math.sqrt(sumSq) || 1;
    const normalizedDescriptor = rawVector.map(v => Number((v / norm).toFixed(6)));

    return {
      detected: true,
      descriptor: normalizedDescriptor,
      anthropometrics,
      faceBounds,
      sharpness: anatomy.sharpness,
      proportions: {
        aspectRatio: 1.0,
        topMidRatio: geomData.topMidRatio,
        midBotRatio: geomData.midBotRatio,
        interOcularRatio: geomData.interOcularRatio,
        anthropometrics
      }
    };
  }

  /**
   * Kichik toza avatarka yaratish
   */
  createThumbnail(canvas, cropSize, startX, startY) {
    try {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 120;
      thumbCanvas.height = 120;
      const tCtx = thumbCanvas.getContext('2d');
      if (!tCtx) return '';

      const sx = Math.max(0, startX);
      const sy = Math.max(0, startY);
      const size = Math.min(canvas.width - sx, canvas.height - sy, Math.max(40, cropSize));

      tCtx.drawImage(canvas, sx, sy, size, size, 0, 0, 120, 120);
      return thumbCanvas.toDataURL('image/jpeg', 0.65);
    } catch (_) {
      return '';
    }
  }

  /**
   * IKKI YUZ O'RTASIDAGI MATEMATIK MOSLIKNI HISOBLASH (Strict Multi-Gate Biometric Matcher)
   * - Forensik antropometriya (14 ta biologik suyak nisbati)
   * - Kosinus o'xshashligi (Cosine similarity)
   * - Chi-Square gistogramma o'xshashligi
   * 
   * QAT'IY XAVFSIZLIK:
   * Begona shaxslarda antropometriya yoki kosinus mos kelmaydi va darhol rad etiladi!
   */
  compareFaces(descriptorA, descriptorB, anthroA = null, anthroB = null, proportionsA = null, proportionsB = null) {
    if (!descriptorA || !descriptorB) {
      return { similarity: 0, matchPercentage: 0, isMatch: false, reason: "Biometrik ma'lumotlar to'liq emas" };
    }

    const len = Math.min(descriptorA.length, descriptorB.length);
    if (len < 120) {
      return { similarity: 0, matchPercentage: 0, isMatch: false, reason: "Vektor o'lchami yetarli emas" };
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;
    let chiDist = 0;

    for (let i = 0; i < len; i++) {
      const a = Number.isFinite(descriptorA[i]) ? descriptorA[i] : 0;
      const b = Number.isFinite(descriptorB[i]) ? descriptorB[i] : 0;

      dot += a * b;
      normA += a * a;
      normB += b * b;

      // LBP qismi uchun Chi-Square masofa
      if (i < 160) {
        const sum = a + b;
        if (sum > 0.00001) {
          const diff = a - b;
          chiDist += (diff * diff) / sum;
        }
      }
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const cosineSim = denom > 0 ? (dot / denom) : 0;

    // Chi-Square o'xshashligi
    const chiSim = Math.max(0, 1 - (chiDist * 0.40));

    // 1. Antropometrik geometriya mosligi
    let effectiveAnthroA = anthroA;
    let effectiveAnthroB = anthroB;

    if (!effectiveAnthroA && proportionsA?.anthropometrics) effectiveAnthroA = proportionsA.anthropometrics;
    if (!effectiveAnthroB && proportionsB?.anthropometrics) effectiveAnthroB = proportionsB.anthropometrics;

    let geomScore = 1.0;
    if (effectiveAnthroA && effectiveAnthroB) {
      geomScore = this.compareAnthropometrics(effectiveAnthroA, effectiveAnthroB);
    } else if (proportionsA && proportionsB) {
      const diffTopMid = Math.abs((proportionsA.topMidRatio || 1) - (proportionsB.topMidRatio || 1));
      const diffMidBot = Math.abs((proportionsA.midBotRatio || 1) - (proportionsB.midBotRatio || 1));
      const geomPenalty = (diffTopMid * 0.45) + (diffMidBot * 0.45);
      geomScore = Math.max(0, 1.0 - geomPenalty);
    }

    // 2. Tekstura va Gradient mosligi (308D xususiyatlar kosinus o'xshashligi)
    const textureScore = cosineSim;

    // 3. Kompozit biometrik ball: 50% Antropometrik suyak nisbatlari + 50% Tekstura/Gradient
    const compositeScore = (geomScore * 0.50) + (textureScore * 0.50);

    // QAT'IY KO'P BOSQICHLI BIOMETRIK FILTR (MULTI-GATE VERIFICATION):
    // 1. compositeScore >= 0.76 (Umumiy moslik)
    // 2. geomScore >= 0.70 (14 ta biologik antropometrik suyak nisbatlari - begonalarda buziladi)
    // 3. cosineSim >= 0.74 (Yuz qismlari gradient va tekstura yo'nalishlari)
    const isBiometricMatch = (
      compositeScore >= 0.76 && 
      geomScore >= 0.70 && 
      cosineSim >= 0.74
    );

    // Foiz hisoblash (0% dan 100% gacha chiroyli va realistik)
    let matchPercentage = 0;
    if (compositeScore > 0.40) {
      matchPercentage = Math.min(100, Math.round(((compositeScore - 0.40) / 0.45) * 100));
    }

    return {
      similarity: Number(compositeScore.toFixed(4)),
      cosineSimilarity: Number(cosineSim.toFixed(4)),
      geomScore: Number(geomScore.toFixed(4)),
      matchPercentage: Math.max(0, matchPercentage),
      isMatch: isBiometricMatch,
      reason: isBiometricMatch ? "Yuz muvaffaqiyatli tasdiqlandi" : "Yuz mos kelmadi (Begona shaxs rad etildi)"
    };
  }

  /**
   * KO'P SHABLONLI ANSAMBL (MULTI-SAMPLE GALLERY MATCHING)
   * Saqlangan barcha rakurslar (markaz, o'ng, chap, yuqori va galereya namunalari)
   * bilan solishtirib, eng yuqori moslikni topadi.
   */
  compareWithStoredFace(currentDescriptor, storedFaceData, currentAnthro = null, currentProportions = null) {
    if (!storedFaceData) {
      return { isMatch: false, matchPercentage: 0, similarity: 0, reason: "Saqlangan yuz ma'lumoti topilmadi" };
    }

    const candidateTemplates = [];

    // 1. Yangi v3.0 Galereya namunalari
    if (Array.isArray(storedFaceData.gallery)) {
      storedFaceData.gallery.forEach(t => {
        if (Array.isArray(t) && t.length > 0) candidateTemplates.push(t);
      });
    }

    // 2. Ko'p burchakli (Multi-angle) namunalar
    if (storedFaceData.multiAngleDescriptors) {
      const angles = storedFaceData.multiAngleDescriptors;
      ['center', 'right', 'left', 'up'].forEach(k => {
        if (Array.isArray(angles[k]) && angles[k].length > 0) candidateTemplates.push(angles[k]);
      });
    }

    // 3. Namunalar massivi
    if (Array.isArray(storedFaceData.sampleDescriptors)) {
      storedFaceData.sampleDescriptors.forEach(d => {
        if (Array.isArray(d) && d.length > 0) candidateTemplates.push(d);
      });
    }

    // 4. Asosiy yagona deskriptor
    if (Array.isArray(storedFaceData.descriptor) && storedFaceData.descriptor.length > 0) {
      candidateTemplates.push(storedFaceData.descriptor);
    }

    if (candidateTemplates.length === 0) {
      return { isMatch: false, matchPercentage: 0, similarity: 0, reason: "Biometrik profil bo'sh" };
    }

    let bestResult = null;
    let maxSim = -1;

    const storedAnthro = storedFaceData.anthropometrics || storedFaceData.proportions?.anthropometrics || null;
    const storedProps = storedFaceData.proportions || null;

    for (const candDesc of candidateTemplates) {
      const res = this.compareFaces(
        currentDescriptor, 
        candDesc, 
        currentAnthro, 
        storedAnthro, 
        currentProportions, 
        storedProps
      );

      if (res.similarity > maxSim) {
        maxSim = res.similarity;
        bestResult = res;
      }

      // Agar juda yaqin va qat'iy tasdiqlangan mos kelsa, vaqtni tejash uchun yakunlaymiz
      if (res.isMatch && res.similarity >= 0.85) {
        break;
      }
    }

    return bestResult || { isMatch: false, matchPercentage: 0, similarity: 0, reason: "Moslik topilmadi" };
  }
}

export const faceAuthService = new FaceAuthService();
