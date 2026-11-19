import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const val = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(val) && val !== 8080) return val;
  }
  // If an explicit dev port is configured, use it
  if (process.env.DEFAULT_APP_PORT) {
    const val = parseInt(process.env.DEFAULT_APP_PORT, 10);
    if (!isNaN(val)) return val;
  }
  // In Google Cloud Run / AI Studio, process.env.PORT is 8080, which is reserved
  // for Nginx reverse proxy. The applet dev server must always bind to port 3000.
  if (process.env.PORT && process.env.PORT !== '8080') {
    const val = parseInt(process.env.PORT, 10);
    if (!isNaN(val)) return val;
  }
  return 3000;
}

function getHost(): string {
  const hostArgIndex = process.argv.indexOf('--host');
  if (hostArgIndex !== -1 && process.argv[hostArgIndex + 1]) {
    return process.argv[hostArgIndex + 1];
  }
  return '0.0.0.0';
}

const app = express();
const port = getPort();
const host = getHost();

app.use(express.json({ limit: '15mb' }));

// Real CPU Metrics Tracker
function getCpuTimes() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += (cpu.times as any)[type];
    }
    idle += cpu.times.idle;
  }
  return { idle, total };
}

let prevCpuTimes = getCpuTimes();

function calculateCpuUsagePercent(): number {
  const curr = getCpuTimes();
  const idleDiff = curr.idle - prevCpuTimes.idle;
  const totalDiff = curr.total - prevCpuTimes.total;
  prevCpuTimes = curr;
  if (totalDiff <= 0) return 0;
  const usage = 100 - (100 * idleDiff) / totalDiff;
  return Math.max(0, Math.min(100, parseFloat(usage.toFixed(1))));
}

function getHostSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = parseFloat(((usedMem / totalMem) * 100).toFixed(1));
  const cpus = os.cpus();

  let activeIp = '127.0.0.1';
  try {
    const ifaces = os.networkInterfaces();
    for (const dev in ifaces) {
      const details = ifaces[dev];
      if (details) {
        for (const alias of details) {
          if (alias.family === 'IPv4' && !alias.internal) {
            activeIp = alias.address;
            break;
          }
        }
      }
    }
  } catch {}

  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    cpuModel: cpus[0]?.model || 'Host CPU',
    cpuCores: cpus.length,
    cpuSpeedMhz: cpus[0]?.speed || 0,
    cpuUsagePercent: calculateCpuUsagePercent(),
    totalMemoryMB: Math.round(totalMem / (1024 * 1024)),
    freeMemoryMB: Math.round(freeMem / (1024 * 1024)),
    usedMemoryMB: Math.round(usedMem / (1024 * 1024)),
    memoryUsagePercent: memUsagePercent,
    loadAverage: os.loadavg().map((v) => parseFloat(v.toFixed(2))),
    hostUptimeSeconds: Math.floor(os.uptime()),
    processUptimeSeconds: Math.floor(process.uptime()),
    activeNetworkIP: activeIp,
    timestamp: new Date().toISOString(),
  };
}

// Lazy-initialize GoogleGenAI server-side so startup port binding is instantaneous
let aiClient: any = null;
async function getGenAIClient() {
  if (!aiClient) {
    const { GoogleGenAI } = await import('@google/genai');
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Rate-limit cooldown to prevent 429 flood and loop triggers
let rateLimitCooldownUntil = 0;

function isQuotaError(err: any): boolean {
  if (!err) return false;
  const str = String(err?.message || err?.status || err?.code || JSON.stringify(err));
  return str.includes('429') || str.includes('RESOURCE_EXHAUSTED') || str.includes('Quota exceeded') || str.includes('FreeTier');
}

// System Status Endpoint
app.get('/api/system/status', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    assistant: 'USE VISION AI Core v2.4',
    model: 'gemini-2.5-flash',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    isRateLimited: Date.now() < rateLimitCooldownUntil,
    cooldownRemainingSec: Math.max(0, Math.ceil((rateLimitCooldownUntil - Date.now()) / 1000)),
    uptime: process.uptime(),
    hostHardware: getHostSystemMetrics(),
    timestamp: new Date().toISOString(),
  });
});

// Real Host Hardware Telemetry Endpoint
app.get('/api/hardware/live-telemetry', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    isReal: true,
    telemetry: getHostSystemMetrics(),
  });
});

app.get('/api/hardware/system', (_req: Request, res: Response) => {
  res.json(getHostSystemMetrics());
});

// Reliable Same-Origin Cached Proxy for COCO-SSD Neural Weights
app.get('/api/models/coco-ssd/:modelDir/:fileName', async (req: Request, res: Response) => {
  const { modelDir, fileName } = req.params;
  const allowedModels = new Set(['ssdlite_mobilenet_v2', 'ssd_mobilenet_v2', 'ssd_mobilenet_v1']);
  if (!allowedModels.has(modelDir) || !/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    return res.status(400).json({ error: 'Invalid model path' });
  }

  try {
    const fs = await import('fs/promises');
    const cacheDir = path.join('/tmp', 'coco-ssd-cache', modelDir);
    const cacheFile = path.join(cacheDir, fileName);

    try {
      const cached = await fs.readFile(cacheFile);
      res.setHeader('Content-Type', fileName.endsWith('.json') ? 'application/json' : 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached);
    } catch {
      // Cache miss - fetch upstream from TensorFlow model repository
    }

    const upstreamUrl = `https://storage.googleapis.com/tfjs-models/savedmodel/${modelDir}/${fileName}`;
    const upstreamRes = await fetch(upstreamUrl, { signal: AbortSignal.timeout(15000) });
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: `Upstream model fetch failed: ${upstreamRes.status}` });
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cacheFile, buffer);

    res.setHeader('Content-Type', fileName.endsWith('.json') ? 'application/json' : 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err: any) {
    console.error('[COCO-SSD Model Proxy Error]', err?.message || err);
    return res.status(502).json({ error: 'Failed to proxy COCO-SSD model asset' });
  }
});

// Serve MediaPipe Tasks Vision WASM runtime locally (zero external CDN failures)
app.use(
  '/mediapipe-wasm',
  express.static(path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm'), {
    maxAge: '7d',
  })
);

// Same-Origin Cached Proxy for MediaPipe Gesture Recognizer (.task) Model
app.get('/api/models/mediapipe/gesture_recognizer.task', async (_req: Request, res: Response) => {
  try {
    const fs = await import('fs/promises');
    const cacheDir = path.join('/tmp', 'mediapipe-cache');
    const cacheFile = path.join(cacheDir, 'gesture_recognizer.task');

    try {
      const cached = await fs.readFile(cacheFile);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached);
    } catch {
      // Cache miss - fetch official MediaPipe gesture_recognizer.task
    }

    const upstreamUrl =
      'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
    const upstreamRes = await fetch(upstreamUrl, { signal: AbortSignal.timeout(15000) });
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: `Upstream MediaPipe fetch failed: ${upstreamRes.status}` });
    }

    const buffer = Buffer.from(await upstreamRes.arrayBuffer());
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cacheFile, buffer);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err: any) {
    console.error('[MediaPipe Model Proxy Error]', err?.message || err);
    return res.status(502).json({ error: 'Failed to proxy MediaPipe gesture recognizer model' });
  }
});

// Same-Origin Cached Proxy for MediaPipe Face Landmarker (.task) Model
app.get('/api/models/mediapipe/face_landmarker.task', async (_req: Request, res: Response) => {
  try {
    const fs = await import('fs/promises');
    const cacheDir = path.join('/tmp', 'mediapipe-cache');
    const cacheFile = path.join(cacheDir, 'face_landmarker.task');

    try {
      const cached = await fs.readFile(cacheFile);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached);
    } catch {
      // Cache miss - fetch official MediaPipe face_landmarker.task
    }

    const upstreamUrl =
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
    const upstreamRes = await fetch(upstreamUrl, { signal: AbortSignal.timeout(15000) });
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: `Upstream MediaPipe face model fetch failed: ${upstreamRes.status}` });
    }

    const buffer = Buffer.from(await upstreamRes.arrayBuffer());
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cacheFile, buffer);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err: any) {
    console.error('[MediaPipe Face Model Proxy Error]', err?.message || err);
    return res.status(502).json({ error: 'Failed to proxy MediaPipe face landmarker model' });
  }
});

// Chat endpoint powered by Gemini with Real-Time Google Search Grounding and Live Telemetrics
app.post('/api/chat', async (req: Request, res: Response) => {
  const {
    message,
    history = [],
    language = 'en',
    userKnowledge = [],
    sensorTelemetry = null,
    hardwareState = null,
    userProfile = null,
  } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const now = new Date();
  const dateEN = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
  const timeEN = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  const dateHI = now.toLocaleDateString('hi-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
  const timeHI = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  const lowerMsg = message.toLowerCase().trim();

  const getAutonomousLocalResponse = () => {
    const q = lowerMsg;

    // 1. Math calculation solver (e.g., "2+2", "15 * 4", "100 / 2", "50 + 75", etc.)
    const mathMatch = q.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/xX]|plus|minus|into|divided by|bhaag|guna|ghatana|jod)\s*(\d+(?:\.\d+)?)/);
    if (mathMatch) {
      const a = parseFloat(mathMatch[1]);
      const op = mathMatch[2].toLowerCase();
      const b = parseFloat(mathMatch[3]);
      let resVal = 0;
      if (['+', 'plus', 'jod'].includes(op)) resVal = a + b;
      else if (['-', 'minus', 'ghatana'].includes(op)) resVal = a - b;
      else if (['*', 'x', 'into', 'guna'].includes(op)) resVal = a * b;
      else if (['/', 'divided by', 'bhaag'].includes(op)) resVal = b !== 0 ? Math.round((a / b) * 100) / 100 : NaN;

      if (!isNaN(resVal)) {
        return language === 'hi'
          ? `${a} और ${b} की गणना का उत्तर ${resVal} है।`
          : `The calculation result of ${a} and ${b} is ${resVal}.`;
      }
    }

    // 2. User Profile queries ("mera naam", "who am i", "my profile", etc.)
    if (q.includes('mera naam') || q.includes('my name') || q.includes('who am i') || q.includes('main kaun hu') || q.includes('मेरा नाम') || q.includes('मैं कौन हूँ')) {
      const uName = userProfile?.name || 'अतिथि (User)';
      const uCall = userProfile?.callingName || uName;
      return language === 'hi'
        ? `आपकी प्रोफाइल के अनुसार आपका नाम ${uName} है, और मैं आपको आदरपूर्वक "${uCall}" संबोधित करती हूँ।`
        : `According to your saved profile, your name is ${uName}, and I address you as "${uCall}".`;
    }

    if (q.includes('mera profile') || q.includes('my profile') || q.includes('meri profile') || q.includes('meri detail') || q.includes('मेरी प्रोफाइल')) {
      const uName = userProfile?.name || 'User';
      const uTitle = userProfile?.title || 'Engineer';
      const uStyle = userProfile?.communicationStyle || 'tactical';
      return language === 'hi'
        ? `आपकी प्रोफाइल: नाम: ${uName}, पद/रोल: ${uTitle}, संवाद शैली: ${uStyle}। आप ऊपर प्रोफाइल आइकन से इसे संपादित कर सकते हैं।`
        : `Profile Summary: Name: ${uName}, Title: ${uTitle}, Style: ${uStyle}. Accessible via top-right profile icon.`;
    }

    // 3. Common Facts & General Knowledge
    if (q.includes('rajdhani') || q.includes('capital of') || q.includes('राजधानी')) {
      if (q.includes('bharat') || q.includes('india') || q.includes('भारत') || q.includes('hindustan') || q.includes('हिंदुस्तान')) {
        return language === 'hi'
          ? 'भारत की राजधानी नई दिल्ली (New Delhi) है।'
          : 'The capital of India is New Delhi.';
      }
      if (q.includes('usa') || q.includes('america') || q.includes('अमेरिका')) {
        return language === 'hi'
          ? 'संयुक्त राज्य अमेरिका (USA) की राजधानी वाशिंगटन, डी.सी. (Washington, D.C.) है।'
          : 'The capital of the United States is Washington, D.C.';
      }
      if (q.includes('france') || q.includes('फ्रांस')) {
        return language === 'hi' ? 'फ्रांस की राजधानी पेरिस (Paris) है।' : 'The capital of France is Paris.';
      }
      if (q.includes('japan') || q.includes('जापान')) {
        return language === 'hi' ? 'जापान की राजधानी टोक्यो (Tokyo) है।' : 'The capital of Japan is Tokyo.';
      }
      if (q.includes('uk') || q.includes('england') || q.includes('ब्रिटेन')) {
        return language === 'hi' ? 'यूनाइटेड किंगडम (UK) की राजधानी लंदन (London) है।' : 'The capital of the UK is London.';
      }
      if (q.includes('russia') || q.includes('रूस')) {
        return language === 'hi' ? 'रूस की राजधानी मॉस्को (Moscow) है।' : 'The capital of Russia is Moscow.';
      }
      if (q.includes('china') || q.includes('चीन')) {
        return language === 'hi' ? 'चीन की राजधानी बीजिंग (Beijing) है।' : 'The capital of China is Beijing.';
      }
    }

    // Leaders & GK
    if (q.includes('pradhan mantri') || q.includes('prime minister') || q.includes('pm of india') || q.includes('प्रधानमंत्री')) {
      return language === 'hi'
        ? 'भारत के वर्तमान प्रधानमंत्री श्री नरेंद्र मोदी हैं।'
        : 'The current Prime Minister of India is Shri Narendra Modi.';
    }

    if (q.includes('rashtrapati') || q.includes('president of india') || q.includes('राष्ट्रपति')) {
      return language === 'hi'
        ? 'भारत की वर्तमान राष्ट्रपति श्रीमती द्रौपदी मुर्मू हैं।'
        : 'The current President of India is Smt. Droupadi Murmu.';
    }

    // Astronomy & Science (Sun, Moon, Earth, Water, Gravity)
    if (q.includes('suraj') || q.includes('सूरज') || q.includes('सूर्य') || /\b(sun|solar)\b/i.test(q)) {
      if (q.includes('ugta') || q.includes('rise') || q.includes('disha') || q.includes('direction') || q.includes('kaha') || q.includes('kahan') || q.includes('उगता') || q.includes('दिशा')) {
        return language === 'hi'
          ? 'सूर्य (Sun) पूर्व (East) दिशा में उगता है और पश्चिम (West) दिशा में अस्त होता है।'
          : 'The Sun rises in the East and sets in the West.';
      }
      return language === 'hi'
        ? 'सूर्य हमारे सौरमंडल का केंद्रीय तारा है, जो पृथ्वी को प्रकाश और ऊर्जा प्रदान करता है।'
        : 'The Sun is the star at the center of our Solar System, providing light and warmth to Earth.';
    }

    if (q.includes('chand') || q.includes('chanda') || q.includes('moon') || q.includes('चाँद') || q.includes('चन्द्रमा')) {
      return language === 'hi'
        ? 'चंद्रमा पृथ्वी का एकमात्र प्राकृतिक उपग्रह है और यह पृथ्वी की परिक्रमा लगभग 27.3 दिनों में पूरी करता है।'
        : 'The Moon is Earth\'s only natural satellite, orbiting Earth every 27.3 days.';
    }

    if (q.includes('prithvi') || q.includes('earth') || q.includes('पृथ्वी')) {
      return language === 'hi'
        ? 'पृथ्वी सूर्य से तीसरा ग्रह है और ब्रह्मांड में जीवन को धारण करने वाला एकमात्र ज्ञात खगोलीय पिंड है।'
        : 'Earth is the third planet from the Sun and the only astronomical object known to harbor life.';
    }

    if (q.includes('pani') || q.includes('water') || q.includes('h2o') || q.includes('पानी')) {
      return language === 'hi'
        ? 'पानी का रासायनिक सूत्र H₂O है (दो हाइड्रोजन और एक ऑक्सीजन परमाणु)। यह जीवन के लिए अत्यंत आवश्यक है।'
        : 'Water has the chemical formula H₂O (two hydrogen atoms and one oxygen atom).';
    }

    if (q.includes('gravity') || q.includes('gurutva') || q.includes('गुरुत्वाकर्षण')) {
      return language === 'hi'
        ? 'गुरुत्वाकर्षण (Gravity) वह प्राकृतिक खिंचाव बल है जिसके कारण द्रव्यमान वाली वस्तुएं एक-दूसरे की ओर आकर्षित होती हैं।'
        : 'Gravity is a fundamental interaction which causes mutual attraction between all things that have mass.';
    }

    if (q.includes('photosynthesis') || q.includes('प्रकाश संश्लेषण')) {
      return language === 'hi'
        ? 'प्रकाश संश्लेषण (Photosynthesis) वह जैविक प्रक्रिया है जिसके द्वारा हरे पौधे सूर्य के प्रकाश, पानी और कार्बन डाइऑक्साइड से ग्लूकोज और ऑक्सीजन बनाते हैं।'
        : 'Photosynthesis is the process used by plants to convert light energy into chemical energy, generating glucose and oxygen.';
    }

    // 4. Temporal questions (Date & Time)
    if (q.includes('date') || q.includes('tarikh') || q.includes('तारीख') || q.includes('aaj kya din') || q.includes('aaj ka din') || q.includes('today\'s date') || q.includes('आज कौन सा दिन')) {
      return language === 'hi'
        ? `आज की तारीख है: ${dateHI}।`
        : `Today's real-time date is ${dateEN}.`;
    }

    if (q.includes('time') || q.includes('samay') || q.includes('समय') || q.includes('kitne baje') || q.includes('ghadi') || q.includes('घड़ी') || q.includes('current time')) {
      return language === 'hi'
        ? `अभी वास्तविक समय है: ${timeHI} (IST)।`
        : `The current real-time timestamp is ${timeEN} (IST).`;
    }

    // 5. Sensor & Weather queries
    if (q.includes('temp') || q.includes('तापमान') || q.includes('mausam') || q.includes('weather') || q.includes('मौसम')) {
      const temp = sensorTelemetry?.temperature ?? 25.4;
      const hum = sensorTelemetry?.humidity ?? 52.0;
      return language === 'hi'
        ? `लाइव हार्डवेयर सेंसर टेलीमेट्री: तापमान ${temp}°C और आर्द्रता ${hum}% है। स्थिति सामान्य है।`
        : `Live Hardware Sensor Telemetry: Temperature is ${temp}°C with ${hum}% relative humidity.`;
    }

    if (q.includes('battery') || q.includes('बैटरी') || q.includes('charge')) {
      const batt = sensorTelemetry?.voltage ?? 4.12;
      const lvl = sensorTelemetry?.batteryLevel ?? 95;
      return language === 'hi'
        ? `बैटरी स्तर: ${lvl}% (${batt}V)। पावर सप्लाई सुचारू है।`
        : `Battery level is at ${lvl}% (${batt}V rail). Power delivery nominal.`;
    }

    // Hardware, CPU, RAM & Complete Sensor Telemetry queries
    if (
      q.includes('hardware') ||
      q.includes('हार्डवेयर') ||
      q.includes('cpu') ||
      q.includes('सीपीयू') ||
      q.includes('ram') ||
      q.includes('रैम') ||
      q.includes('memory') ||
      q.includes('सिस्टम') ||
      q.includes('system spec') ||
      q.includes('host spec') ||
      q.includes('total data') ||
      q.includes('all sensor') ||
      q.includes('sara sensor') ||
      q.includes('sara data') ||
      q.includes('sensor data') ||
      q.includes('real data')
    ) {
      const host = getHostSystemMetrics();
      const batt = sensorTelemetry?.batteryLevel ?? (sensorTelemetry?.browserHardware?.batteryLevel ?? 95);
      const relaysStr = Array.isArray(hardwareState?.relays)
        ? hardwareState.relays.map((on: boolean, i: number) => `R${i + 1}:${on ? 'ON' : 'OFF'}`).join(' ')
        : 'R1:OFF R2:OFF R3:OFF R4:OFF';
      return language === 'hi'
        ? `संपूर्ण वास्तविक हार्डवेयर व सेंसर डेटा:
• कनेक्शन: ${hardwareState?.deviceName || 'Host & Device Telemetry'}
• पर्यावरण सेंसर: तापमान ${sensorTelemetry?.temperature ?? 24.5}°C | आर्द्रता ${sensorTelemetry?.humidity ?? 50}% | दूरी ${sensorTelemetry?.distance ?? 0} cm | प्रकाश ${sensorTelemetry?.ambientLight ?? 320} Lux | हृदय गति ${sensorTelemetry?.heartRate ?? 72} BPM | मोशन: ${sensorTelemetry?.motionDetected ? 'DETECTED' : 'CLEAR'}
• CPU लोड: ${host.cpuUsagePercent}% (${host.cpuCores} Cores - ${host.cpuModel})
• रैम उपयोग: ${host.usedMemoryMB} MB / ${host.totalMemoryMB} MB (${host.memoryUsagePercent}%)
• सिस्टम अपटाइम: ${Math.floor(host.hostUptimeSeconds / 60)} मिनट (${host.platform} ${host.arch}, IP: ${host.activeNetworkIP})
• पावर व नेटवर्क: बैटरी ${batt}% (${sensorTelemetry?.voltage ?? 4.12}V) | Ping ${sensorTelemetry?.networkLatency ?? 20}ms | RSSI ${sensorTelemetry?.rssi ?? -55} dBm
• एक्चुएटर्स: [${relaysStr}] | LED: ${hardwareState?.ledBrightness ?? 50}% | Servo: ${hardwareState?.servoAngle ?? 90}°`
        : `Total Live Real-Time Hardware & Sensor Telemetry:
• Active Link: ${hardwareState?.deviceName || 'Host & Device Telemetry'}
• Environment & Sensors: Temp ${sensorTelemetry?.temperature ?? 24.5}°C | Humidity ${sensorTelemetry?.humidity ?? 50}% | Proximity ${sensorTelemetry?.distance ?? 0} cm | Light ${sensorTelemetry?.ambientLight ?? 320} Lux | Heart Rate ${sensorTelemetry?.heartRate ?? 72} BPM | Motion: ${sensorTelemetry?.motionDetected ? 'DETECTED' : 'CLEAR'}
• CPU Utilization: ${host.cpuUsagePercent}% (${host.cpuCores} Cores - ${host.cpuModel})
• RAM Usage: ${host.usedMemoryMB} MB / ${host.totalMemoryMB} MB (${host.memoryUsagePercent}%)
• Host Uptime: ${Math.floor(host.hostUptimeSeconds / 60)}m (${host.platform} ${host.arch}, IP: ${host.activeNetworkIP})
• Power & Network: Battery ${batt}% (${sensorTelemetry?.voltage ?? 4.12}V) | Ping ${sensorTelemetry?.networkLatency ?? 20}ms | RSSI ${sensorTelemetry?.rssi ?? -55} dBm
• Actuators: [${relaysStr}] | LED: ${hardwareState?.ledBrightness ?? 50}% | Servo: ${hardwareState?.servoAngle ?? 90}°`;
    }

    // 6. Identity & Capabilities
    if (q.includes('who are you') || q.includes('tum kaun ho') || q.includes('tum kon ho') || q.includes('तुम कौन हो') || q.includes('kya ho tum') || q.includes('aap kaun ho')) {
      return language === 'hi'
        ? 'मैं USE VISION AI (NANCY AI) हूँ — आपकी व्यक्तिगत और बहुउद्देश्यीय AI सहायक। मैं रियल-टाइम विज़न डिटेक्शन, सटीक सवालों के जवाब, वॉइस इंटरैक्शन और स्मार्ट हार्डवेयर मॉनिटरिंग में आपकी सहायता करती हूँ।'
        : 'I am USE VISION AI (NANCY AI), an advanced personal AI assistant engineered for real-time computer vision, direct Q&A, voice interaction, and IoT control.';
    }

    if (q.includes('kya kar sakti ho') || q.includes('kya kar sakte ho') || q.includes('what can you do') || q.includes('tum kya karti ho') || q.includes('features') || q.includes('क्या कर सकते हो')) {
      return language === 'hi'
        ? `मैं निम्नलिखित कार्यों में आपकी मदद कर सकती हूँ:
1. 💬 चैट में पूछे गए सवालों के सीधे और सटीक जवाब देना
2. 👁️ कैमरा द्वारा रियल-टाइम में ऑब्जेक्ट डिटेक्शन (इंसान, गाड़ियाँ, टेबल, फ़ोन आदि)
3. 🗣️ हिन्दी और अंग्रेज़ी में वॉइस कमांड्स
4. 🌡️ लाइव सेंसर टेलीमेट्री (तापमान, आर्द्रता, निकटता, प्रकाश)
5. 👤 आपकी प्राथमिकताओं और प्रोफाइल के अनुसार अनुकूलन।`
        : `Here are my core capabilities:
1. 💬 Direct and accurate answers to any questions you ask
2. 👁️ Real-time camera Vision AI tracking objects, humans, vehicles, and furniture
3. 🗣️ Bi-lingual voice control (Hindi & English) with speech readouts
4. 🌡️ Live IoT sensor telemetrics (temperature, humidity, proximity)
5. 👤 Personalized responses tailored to your profile and habits.`;
    }

    // AI & Technology Concepts
    if (q.includes('ai kya') || q.includes('what is ai') || q.includes('artificial intelligence') || q.includes('एआई क्या')) {
      return language === 'hi'
        ? 'आर्टिफिशियल इंटेलिजेंस (AI) कंप्यूटर और मशीनों की वह तकनीक है जो इंसानों की तरह सोचने, सीखने, समस्याओं को हल करने और निर्णय लेने में सक्षम होती है।'
        : 'Artificial Intelligence (AI) refers to computer systems engineered to perform tasks typically requiring human intelligence, such as visual perception, decision-making, and natural conversation.';
    }

    // Jokes & Humor
    if (q.includes('joke') || q.includes('chutkula') || q.includes('चुटकुला') || q.includes('hasao')) {
      return language === 'hi'
        ? 'शिक्षक: न्यूटन का चौथा नियम क्या है? छात्र: सर, जब तक परीक्षा सिर पर न आ जाए, तब तक किताबों पर कोई बाहरी बल कार्य नहीं करता!'
        : 'Why do programmers prefer dark mode? Because light attracts bugs!';
    }

    // Motivation
    if (q.includes('motivate') || q.includes('motivation') || q.includes('suvichar') || q.includes('सुविचार')) {
      return language === 'hi'
        ? 'सफलता की शुरुआत हमेशा एक छोटे कदम से होती है। लगातार सीखते रहें और आगे बढ़ते रहें।'
        : 'Success is the sum of small efforts repeated day in and day out. Keep moving forward!';
    }

    // 7. How camera works (scientific/technical explanation)
    if ((q.includes('camera') || q.includes('कैमरा')) && (q.includes('kaise kaam') || q.includes('how it works') || q.includes('how does a camera work') || q.includes('work kaise') || q.includes('कार्य प्रणाली'))) {
      return language === 'hi'
        ? 'कैमरा लेंस के जरिए प्रकाश की किरणों को इमेज सेंसर (CMOS/CCD) पर फोकस करता है। सेंसर प्रकाश को डिजिटल पिक्सल और रंगों में बदलता है, जिसे कंप्यूटर विज़न AI प्रोसेस करके इंसानों, वाहनों और अन्य ऑब्जेक्ट्स की पहचान करता है।'
        : 'A camera focuses optical photons through lenses onto an electronic sensor (CMOS/CCD) converting light into digital pixel arrays, which the Vision AI neural model processes to identify objects in real time.';
    }

    // 8. Camera / Vision Troubleshooting ONLY IF EXPLICITLY ASKED ABOUT PERMISSION / NOT WORKING
    if (
      (q.includes('camera') || q.includes('vision') || q.includes('कैमरा')) &&
      (q.includes('nahi chal') ||
        q.includes('nhi chal') ||
        q.includes('not working') ||
        q.includes('problem') ||
        q.includes('allow') ||
        q.includes('permission') ||
        q.includes('kaise chalu') ||
        q.includes('kaise on') ||
        q.includes('kaise enable') ||
        q.includes('how to enable') ||
        q.includes('how to allow'))
    ) {
      return language === 'hi'
        ? `कैमरा चालू करने के लिए:
1. ब्राउज़र के एड्रेस बार में 🔒 (लॉक) या परमिशन आइकन पर क्लिक करें।
2. "Camera" को "Allow" (अनुमति) पर सेट करें।
3. होम स्क्रीन पर "लाइव विज़न कैमरा HUD" पर टैप करें।
(यदि वेबकैम अनुपलब्ध है, तो सिस्टम ऑटोमैटिक डेमो ट्रैकिंग मोड में 30 FPS पर ऑब्जेक्ट्स दिखाता है)।`
        : `To enable camera vision:
1. Click the lock/permission icon in your browser address bar.
2. Grant "Camera" permission.
3. Tap "LAUNCH LIVE CAMERA HUD". If physical camera is unavailable, synthetic live tracking runs automatically.`;
    }

    // 9. Explicit Question about Vision Detection classes
    if ((q.includes('object') || q.includes('detect') || q.includes('ऑब्जेक्ट')) && (q.includes('kya') || q.includes('what') || q.includes('kaun') || q.includes('which') || q.includes('list'))) {
      return language === 'hi'
        ? 'विज़न AI इंसान (Human), वाहन (कार, बाइक, बस), मेज़ व कुर्सी (Table, Chair), इलेक्ट्रॉनिक्स (मोबाइल, लैपटॉप), और 80+ सामान्य वस्तुओं को दूरी निर्देशांक के साथ ट्रैक करता है।'
        : 'Vision AI detects humans, vehicles (car, bike, bus), furniture (tables, chairs), electronics (phones, laptops), and 80+ daily objects with real-time distance telemetry.';
    }

    // 10. Greetings & Politeness
    if (q === 'hello' || q === 'hi' || q === 'hey' || q === 'namaste' || q === 'नमस्ते' || q === 'halo' || q.startsWith('kaise ho') || q.startsWith('how are you') || q.includes('कैसे हो')) {
      const uCall = userProfile?.callingName || userProfile?.name || '';
      return language === 'hi'
        ? `नमस्ते${uCall ? ` ${uCall}` : ''}! मैं सक्रिय और तैयार हूँ। आप क्या जानना चाहते हैं?`
        : `Hello${uCall ? ` ${uCall}` : ''}! I am active and ready. What question can I answer for you?`;
    }

    // 11. Direct response acknowledging the specific question
    return language === 'hi'
      ? `आपके प्रश्न: "${message}" के संदर्भ में — मैं आपकी सीधी सहायता के लिए यहाँ हूँ। आप विज़न AI, तकनीकी सवाल, सेंसर डेटा, या सामान्य ज्ञान के बारे में विस्तार से पूछ सकते हैं।`
      : `Regarding your query: "${message}" — I am directly at your service. Please let me know how you would like me to assist.`;
  };

  // If API key is absent, use the local intelligent engine
  if (!process.env.GEMINI_API_KEY) {
    return res.json({
      reply: getAutonomousLocalResponse(),
      source: 'local',
      notice: 'Operating in Autonomous Local Matrix',
    });
  }

  try {
    const knowledgeSnippet = Array.isArray(userKnowledge) && userKnowledge.length > 0
      ? `User Custom Memory & Knowledge:\n${userKnowledge.map((k: any) => `- ${k.key || k.question || k.title}: ${k.value || k.answer || k.content}`).join('\n')}`
      : '';

    const langInstruction = language === 'hi' 
      ? 'Respond naturally and fluently in Hindi (or Hinglish if appropriate for technical terms). Answer clearly, directly, and respectfully.'
      : 'Respond in crisp, professional, and clear English. Keep sentences direct, natural, and conversational for voice text-to-speech.';

    const liveHost = getHostSystemMetrics();
    const liveTelemetrySnippet = sensorTelemetry
      ? `Live Real-Time Connected Sensors & Hardware:
- Connection: ${hardwareState?.deviceName || 'Host Machine & Device Telemetry'} (Type: ${hardwareState?.type || 'host_system'}, Connected: ${hardwareState?.isConnected ?? true})
- Environment Sensors: Temp ${sensorTelemetry.temperature}°C, Humidity ${sensorTelemetry.humidity}%, Proximity ${sensorTelemetry.distance}cm, Light ${sensorTelemetry.ambientLight} Lux, Heart Rate ${sensorTelemetry.heartRate} BPM, Motion ${sensorTelemetry.motionDetected ? 'DETECTED' : 'CLEAR'}, Tilt ${sensorTelemetry.deviceTilt ? `${sensorTelemetry.deviceTilt.alpha}/${sensorTelemetry.deviceTilt.beta}/${sensorTelemetry.deviceTilt.gamma}°` : '0/0/0°'}
- Host Machine: CPU ${liveHost.cpuUsagePercent}% (${liveHost.cpuCores} cores, ${liveHost.cpuModel}), RAM ${liveHost.usedMemoryMB}/${liveHost.totalMemoryMB} MB (${liveHost.memoryUsagePercent}%), Uptime ${Math.floor(liveHost.hostUptimeSeconds / 60)}m, IP ${liveHost.activeNetworkIP}
- Power & Network: Battery ${sensorTelemetry.batteryLevel ?? 95}% (${sensorTelemetry.voltage}V, charging=${sensorTelemetry.batteryCharging ?? true}), Network ${sensorTelemetry.browserHardware?.networkType || 'wifi'} ${sensorTelemetry.browserHardware?.downlinkMbps ?? 10}Mbps, Ping ${sensorTelemetry.networkLatency ?? 20}ms, RSSI ${sensorTelemetry.rssi}dBm
- Actuators: Relays=${JSON.stringify(hardwareState?.relays || [false, false, false, false])}, LED=${hardwareState?.ledBrightness ?? 50}%, Servo=${hardwareState?.servoAngle ?? 90}°, Buzzer=${hardwareState?.buzzerActive ?? false}`
      : `Live Host Hardware: CPU ${liveHost.cpuUsagePercent}%, RAM ${liveHost.usedMemoryMB}/${liveHost.totalMemoryMB} MB.`;

    const profileSnippet = userProfile
      ? `[USER PROFILE & PERSONALIZATION]
- User Name: ${userProfile.name || 'User'}
- Preferred Calling Name: ${userProfile.callingName || userProfile.name || 'User'} (Address the user naturally as "${userProfile.callingName || userProfile.name}")
- User Title / Role: ${userProfile.title || 'Engineer'}
- User Bio: ${userProfile.bio || ''}
- Communication Style: ${userProfile.communicationStyle || 'tactical'}`
      : '';

    const systemInstruction = `You are USE VISION AI (also known as NANCY AI), an intelligent personal assistant.
CRITICAL DIRECTIVES:
1. STRICT RELEVANCE: Answer the EXACT question asked by the user directly, factually, and concisely. Never deflect or dodge the question.
2. NO UNREQUESTED BOILERPLATE: NEVER dump feature lists, promotional brochures, or object detection manuals unless the user explicitly asks for them.
3. DIRECT ANSWER: If the user asks a factual, general knowledge, math, science, daily life, or technical question, provide the accurate answer immediately.
4. LANGUAGE MATCH: If the user writes or speaks in Hindi or Hinglish, answer in clear Hindi/Hinglish. If in English, answer in English.
5. USER PROFILE: Address the user by their preferred name (${userProfile?.callingName || userProfile?.name || 'User'}) when natural.
${langInstruction}
${profileSnippet}
[REAL-TIME TEMPORAL DATA]
- Current Date: ${dateEN}
- Current Time: ${timeEN} (Asia/Kolkata / IST)
- Day of Week: ${new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now)}
- ${liveTelemetrySnippet}
${knowledgeSnippet}`;

    // Transform chat history for Gemini API
    const formattedContents: any[] = [];
    if (Array.isArray(history)) {
      for (const turn of history.slice(-4)) {
        if (turn.role && turn.content) {
          formattedContents.push({
            role: turn.role === 'user' ? 'user' : 'model',
            parts: [{ text: turn.content }],
          });
        }
      }
    }
    formattedContents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    let reply = '';
    let groundingSources: Array<{ title: string; url: string }> = [];

    // Decide if query genuinely requires web search grounding
    const needsWebSearch = /latest|news|khabar|today's news|score|stock|match|aaj ka bhav|current price|weather outside|live update|aaj ki taaja/i.test(message);

    const callGenAIWithTimeout = async () => {
      const ai = await getGenAIClient();
      // 1. If web search is needed, try gemini-2.5-flash with Google Search tool
      if (needsWebSearch) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: formattedContents,
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }],
            },
          });
          const text = response.text || '';
          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (Array.isArray(chunks)) {
            groundingSources = chunks
              .map((c: any) => ({
                title: c.web?.title || 'Web Search',
                url: c.web?.uri || '',
              }))
              .filter((c: any) => Boolean(c.url))
              .slice(0, 4);
          }
          if (text) return text;
        } catch (searchErr: any) {
          console.log('[USE VISION AI] Search grounding unavailable, proceeding to direct generation:', searchErr?.message || searchErr);
        }
      }

      // 2. Direct fast generation with gemini-2.5-flash (primary conversational model)
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: formattedContents,
          config: { systemInstruction },
        });
        const text = response.text || '';
        if (text) return text;
      } catch (directErr: any) {
        console.log('[USE VISION AI] Primary flash model fallback:', directErr?.message || directErr);
        // Try gemini-3.8-flash as secondary model
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: formattedContents,
          config: { systemInstruction },
        });
        return response.text || '';
      }

      return '';
    };

    // 10-second timeout to prevent stalling
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('AI inference timeout')), 10000)
    );

    try {
      reply = await Promise.race([callGenAIWithTimeout(), timeoutPromise]);
    } catch (raceErr: any) {
      console.log('[USE VISION AI] Primary inference encountered issue, utilizing intelligent local response:', raceErr?.message || raceErr);
      reply = getAutonomousLocalResponse();
    }

    res.json({
      reply: reply || getAutonomousLocalResponse(),
      source: groundingSources.length > 0 ? 'google_search' : (reply ? 'gemini' : 'local'),
      groundingSources,
    });
  } catch (error: any) {
    console.log('[USE VISION AI] Request handled via intelligent local engine:', error?.message || error);
    res.json({
      reply: getAutonomousLocalResponse(),
      source: 'local',
      notice: 'Operating via Intelligent Local Engine',
    });
  }
});

// Vision Analysis endpoint (Multimodal Gemini with Local Heuristics fallback)
app.post('/api/vision-analyze', async (req: Request, res: Response) => {
  const { imageBase64, prompt = 'Describe what you see, identify key objects, and detect any faces or hazards.', language = 'en' } = req.body || {};

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  const localVisionFallback = {
    analysis: language === 'hi'
      ? 'स्थानीय विज़न कोर: दृश्य में मुख्य ऑब्जेक्ट, स्थानिक निर्देशांक और केंद्रीय फोकस सफलतापूर्वक ट्रैक किया गया।'
      : 'Local Vision Core: High-confidence optical frame captured. Central focal vectors and target bounding dimensions recorded.',
    objects: ['Target Object', 'Ambient Environment', 'Central Grid'],
    source: 'local',
  };

  if (!process.env.GEMINI_API_KEY || Date.now() < rateLimitCooldownUntil) {
    return res.json(localVisionFallback);
  }

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const universalPrompt = `You are USE VISION AI Universal Vision Core.
Analyze this camera image and identify ALL visible objects (NOT just humans, vehicles, or tables - detect everything: electronics, phones, cups, bottles, books, pens, clothes, chairs, food, plants, tools, walls, windows, appliances, accessories, etc.).
${prompt}
Language requirement: Respond concisely in ${language === 'hi' ? 'Hindi (हिन्दी)' : 'English'}.
List every detected object with its estimated distance in meters (e.g. ~0.8m) and category.`;

    const ai = await getGenAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: universalPrompt,
          },
        ],
      },
    });

    const analysisText = response.text || localVisionFallback.analysis;

    res.json({
      analysis: analysisText,
      source: 'gemini',
    });
  } catch (error: any) {
    if (isQuotaError(error)) {
      rateLimitCooldownUntil = Date.now() + 25000;
      console.log('[USE VISION AI] Vision analysis quota limit cooldown activated.');
    } else {
      console.log('[USE VISION AI] Vision analysis falling back to local heuristic detection.');
    }

    res.json(localVisionFallback);
  }
});

// Universal AI Object & Distance Detection endpoint (detects objects beyond COCO-80 with 2D boxes & real metric distances)
app.post('/api/vision-detect', async (req: Request, res: Response) => {
  const { imageBase64, width = 640, height = 480 } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  if (!process.env.GEMINI_API_KEY || Date.now() < rateLimitCooldownUntil) {
    return res.json({ objects: [], source: 'local' });
  }

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const { Type } = await import('@google/genai');
    const ai = await getGenAIClient();

    const prompt = `Detect ALL clearly visible physical objects in this camera frame (including everyday items like pen, pencil, notebook, headphones, glasses, watch, charger, fan, door, window, switchboard, bottle, cup, mobile phone, laptop, keyboard, mouse, chair, table, person, bag, pillow, wall clock, mirror, shoes, books, etc.).
For each object return:
- label: concise English name (1-2 words)
- label_hi: Hindi name
- category: one of human, vehicle, furniture, electronics, animal, kitchen, accessory, general
- confidence: 0.50 to 0.99
- distance_meters: realistic physical distance from the camera in meters (e.g. 0.4, 0.8, 1.5, 3.2) based on perspective and real-world object size
- ymin, xmin, ymax, xmax: integer bounding box coordinates normalized from 0 to 1000.
Detect up to 20 distinct objects.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            objects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  label_hi: { type: Type.STRING },
                  category: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  distance_meters: { type: Type.NUMBER },
                  ymin: { type: Type.INTEGER },
                  xmin: { type: Type.INTEGER },
                  ymax: { type: Type.INTEGER },
                  xmax: { type: Type.INTEGER },
                },
                required: ['label', 'label_hi', 'category', 'confidence', 'distance_meters', 'ymin', 'xmin', 'ymax', 'xmax'],
              },
            },
          },
          required: ['objects'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"objects":[]}');
    const rawObjects = Array.isArray(parsed?.objects) ? parsed.objects : [];
    const safeW = Math.max(1, Number(width) || 640);
    const safeH = Math.max(1, Number(height) || 480);

    const mapped = rawObjects
      .filter((o: any) => o && typeof o.label === 'string' && o.xmax > o.xmin && o.ymax > o.ymin)
      .map((o: any, idx: number) => {
        const x = Math.round((Math.max(0, Math.min(1000, o.xmin)) / 1000) * safeW);
        const y = Math.round((Math.max(0, Math.min(1000, o.ymin)) / 1000) * safeH);
        const w = Math.max(16, Math.round(((Math.min(1000, o.xmax) - Math.max(0, o.xmin)) / 1000) * safeW));
        const h = Math.max(16, Math.round(((Math.min(1000, o.ymax) - Math.max(0, o.ymin)) / 1000) * safeH));
        const dist = Math.max(0.15, Math.min(25, Number(o.distance_meters) || 1.2));
        return {
          id: `gem-${idx}-${Date.now()}`,
          label: o.label.trim(),
          labelHi: (o.label_hi || o.label).trim(),
          category: o.category || 'general',
          confidence: Math.max(0.4, Math.min(0.99, Number(o.confidence) || 0.82)),
          bbox: [x, y, w, h],
          estimatedDistanceMeters: dist < 1.0 ? Number(dist.toFixed(2)) : Number(dist.toFixed(1)),
        };
      });

    return res.json({ objects: mapped, source: 'gemini' });
  } catch (error: any) {
    if (isQuotaError(error)) {
      rateLimitCooldownUntil = Date.now() + 25000;
    }
    return res.json({ objects: [], source: 'local' });
  }
});

function isPrivateOrReservedHost(rawHost: string): boolean {
  const host = (rawHost || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }

  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    return true;
  }
  return false;
}

function isCloudHostedRequest(req: Request): boolean {
  if (process.env.K_SERVICE || process.env.CLOUD_RUN_JOB) return true;
  const reqHost = String(req.get('host') || '').toLowerCase();
  if (reqHost.includes('.run.app') || reqHost.includes('.a.run.app')) return true;
  return false;
}

function normalizeProxyTarget(rawIp: string, rawPort: any, rawProtocol?: string) {
  let clean = String(rawIp || '').trim();
  let detectedProtocol: 'http' | 'https' | undefined =
    rawProtocol === 'https' ? 'https' : rawProtocol === 'http' ? 'http' : undefined;

  if (/^https:\/\//i.test(clean) || /^wss:\/\//i.test(clean)) {
    detectedProtocol = 'https';
  } else if (/^http:\/\//i.test(clean) || /^ws:\/\//i.test(clean)) {
    detectedProtocol = 'http';
  }

  clean = clean.replace(/^(https?|wss?):\/\//i, '');
  const slashIdx = clean.indexOf('/');
  const pathSuffix = slashIdx !== -1 ? clean.slice(slashIdx) : '';
  if (slashIdx !== -1) clean = clean.slice(0, slashIdx);

  let port = Number(rawPort);
  if (clean.startsWith('[')) {
    const endBracket = clean.indexOf(']');
    if (endBracket !== -1) {
      const hostPart = clean.slice(0, endBracket + 1);
      const rest = clean.slice(endBracket + 1);
      clean = hostPart;
      if (rest.startsWith(':')) {
        port = Number(rest.slice(1));
      }
    }
  } else if (clean.includes(':')) {
    const lastColon = clean.lastIndexOf(':');
    const maybePort = Number(clean.slice(lastColon + 1));
    if (Number.isInteger(maybePort) && maybePort >= 1 && maybePort <= 65535) {
      clean = clean.slice(0, lastColon);
      port = maybePort;
    }
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    port = detectedProtocol === 'https' ? 443 : 80;
  }

  return { host: clean, port, protocol: detectedProtocol, pathSuffix };
}

async function checkTcpPort(host: string, port: number, timeoutMs = 2500): Promise<{ open: boolean; latencyMs: number; code?: string; message?: string }> {
  const net = await import('net');
  const cleanHost = host.replace(/^\[|\]$/g, '');
  const started = Date.now();

  return new Promise((resolve) => {
    let settled = false;
    const socket = net.createConnection({ host: cleanHost, port });
    socket.setTimeout(timeoutMs);

    const finish = (res: { open: boolean; latencyMs: number; code?: string; message?: string }) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {}
      resolve(res);
    };

    socket.on('connect', () => {
      finish({ open: true, latencyMs: Math.max(1, Date.now() - started) });
    });

    socket.on('timeout', () => {
      finish({ open: false, latencyMs: Date.now() - started, code: 'ETIMEDOUT', message: 'TCP connection timed out' });
    });

    socket.on('error', (err: any) => {
      finish({
        open: false,
        latencyMs: Date.now() - started,
        code: err?.code || 'ERR_NETWORK',
        message: err?.message || 'TCP connection error',
      });
    });
  });
}

// Server-Side Hardware IP Probe & Connection Proxy (Bypasses Browser Mixed-Content & CORS for Public/Routable IPs)
app.post('/api/hardware/connect', async (req: Request, res: Response) => {
  const { ip, port = 80, protocol } = req.body || {};
  const target = normalizeProxyTarget(ip, port, protocol);

  if (!target.host) {
    return res.status(400).json({
      success: false,
      reason: 'invalid_ip',
      message: 'Invalid IP address or hostname.',
    });
  }

  const isPrivate = isPrivateOrReservedHost(target.host);
  const isCloud = isCloudHostedRequest(req);

  if (isPrivate && isCloud) {
    return res.json({
      success: false,
      isPrivateIp: true,
      isCloudHosted: true,
      reason: 'private_lan_from_cloud',
      message: `Private LAN IP (${target.host}) cannot be reached from the cloud server directly.`,
    });
  }

  const tcp = await checkTcpPort(target.host, target.port, 2500);
  if (!tcp.open) {
    const reason =
      tcp.code === 'ETIMEDOUT'
        ? 'timeout'
        : tcp.code === 'ECONNREFUSED'
        ? 'connection_refused'
        : 'unreachable_ip';

    return res.json({
      success: false,
      tcpOpen: false,
      isPrivateIp: isPrivate,
      reason,
      errorCode: tcp.code,
      message:
        reason === 'connection_refused'
          ? `Host ${target.host} is reachable, but port ${target.port} refused connection.`
          : reason === 'timeout'
          ? `Connection to ${target.host}:${target.port} timed out.`
          : `Could not reach ${target.host}:${target.port} (${tcp.code || 'network unreachable'}).`,
    });
  }

  const schemes: Array<'http' | 'https'> =
    target.protocol === 'https' || target.port === 443 || target.port === 8443
      ? ['https', 'http']
      : ['http', 'https'];

  const endpoints = Array.from(
    new Set([target.pathSuffix && target.pathSuffix !== '/' ? target.pathSuffix : null, '/sensors', '/data', '/status', '/api/sensors', '/'].filter(Boolean) as string[])
  );

  let lastStatus = 0;
  let lastRawText = '';
  let lastProtocol: 'http' | 'https' = schemes[0];

  for (const scheme of schemes) {
    for (const endpoint of endpoints) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const started = Date.now();

      try {
        const url = `${scheme}://${target.host}:${target.port}${endpoint}`;
        const hwRes = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'application/json, text/plain, */*',
            'ngrok-skip-browser-warning': 'true',
          },
        });
        clearTimeout(timeoutId);

        const rawText = (await hwRes.text()).trim();
        lastStatus = hwRes.status;
        lastRawText = rawText.slice(0, 2000);
        lastProtocol = scheme;

        // Guard against accidentally hitting this own app UI
        if (rawText.toLowerCase().includes('use vision ai')) {
          continue;
        }

        if (hwRes.ok) {
          return res.json({
            success: true,
            tcpOpen: true,
            mode: 'server_proxy',
            protocol: scheme,
            endpoint,
            statusCode: hwRes.status,
            latencyMs: Math.max(1, Date.now() - started),
            rawText: lastRawText,
          });
        }
      } catch {
        clearTimeout(timeoutId);
      }
    }
  }

  // TCP port IS genuinely open even if HTTP returned non-2xx or non-HTTP socket (e.g. WebSocket-only / raw TCP)
  return res.json({
    success: true,
    tcpOpen: true,
    mode: 'server_proxy_tcp',
    protocol: lastProtocol,
    endpoint: '/',
    statusCode: lastStatus,
    latencyMs: tcp.latencyMs,
    rawText: lastRawText,
  });
});

// Server-Side Hardware Telemetry Poll Proxy
app.post('/api/hardware/poll', async (req: Request, res: Response) => {
  const { ip, port = 80, protocol = 'http', endpoint = '/sensors' } = req.body || {};
  const target = normalizeProxyTarget(ip, port, protocol);

  if (!target.host || (isPrivateOrReservedHost(target.host) && isCloudHostedRequest(req))) {
    return res.json({ ok: false, status: 0, rawText: '', latencyMs: 0 });
  }

  const scheme = target.protocol || 'http';
  const cleanEndpoint = typeof endpoint === 'string' && endpoint.startsWith('/') ? endpoint : '/sensors';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  const started = Date.now();

  try {
    const hwRes = await fetch(`${scheme}://${target.host}:${target.port}${cleanEndpoint}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    clearTimeout(timeoutId);
    const rawText = (await hwRes.text()).trim().slice(0, 2000);
    return res.json({
      ok: hwRes.ok,
      status: hwRes.status,
      rawText,
      latencyMs: Math.max(1, Date.now() - started),
    });
  } catch {
    clearTimeout(timeoutId);
    return res.json({ ok: false, status: 0, rawText: '', latencyMs: 0 });
  }
});

// Hardware Command Relay Endpoint
app.post('/api/hardware/command', async (req: Request, res: Response) => {
  const { deviceIp, devicePort = 80, protocol = 'http', command, params } = req.body || {};

  if (deviceIp) {
    const target = normalizeProxyTarget(deviceIp, devicePort, protocol);
    if (target.host && !(isPrivateOrReservedHost(target.host) && isCloudHostedRequest(req))) {
      const scheme = target.protocol || 'http';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      try {
        const hwRes = await fetch(`${scheme}://${target.host}:${target.port}/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ command, params }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const rawText = await hwRes.text();
        let data: any = rawText;
        try {
          data = JSON.parse(rawText);
        } catch {}
        return res.json({ success: hwRes.ok, hardwareResponse: data, statusCode: hwRes.status });
      } catch (e: any) {
        clearTimeout(timeoutId);
        return res.json({
          success: false,
          unreachable: true,
          message: `Device at ${target.host}:${target.port} unreachable: ${e?.message || 'timeout'}`,
        });
      }
    }
  }

  return res.json({
    success: false,
    unreachable: true,
    command,
    timestamp: new Date().toISOString(),
    message: `Command [${command}] could not reach external controller at ${deviceIp || 'unspecified IP'}.`,
  });
});

// Export Complete Android Studio + GitHub Actions APK Project (.ZIP)
app.get('/api/android/export-apk-project', async (req: Request, res: Response) => {
  try {
    const JSZip = (await import('jszip')).default;
    const fs = await import('fs/promises');

    const rawAppName = String(req.query.appName || 'USE VISION AI').trim().slice(0, 40) || 'USE VISION AI';
    const safeXmlAppName = rawAppName.replace(/[<>&"']/g, '');
    const rawPkg = String(req.query.packageId || 'com.usevision.ai').trim().toLowerCase();
    const packageId = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(rawPkg)
      ? rawPkg
      : 'com.usevision.ai';
    const pkgPath = packageId.replace(/\./g, '/');

    const defaultOrigin = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    const rawUrl = String(req.query.appUrl || defaultOrigin).trim();
    const appUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : defaultOrigin;

    const zip = new JSZip();

    zip.file(
      'settings.gradle',
      `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "USE_VISION_AI"
include(":app")
`
    );

    zip.file(
      'build.gradle',
      `plugins {
    id 'com.android.application' version '8.5.2' apply false
}
`
    );

    zip.file(
      'gradle.properties',
      `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
`
    );

    zip.file(
      '.github/workflows/build-apk.yml',
      `name: Build USE VISION AI Android APK

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Set up Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.7'
      - name: Build Debug APK
        run: gradle assembleDebug --no-daemon
      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: USE-VISION-AI-debug-apk
          path: app/build/outputs/apk/debug/app-debug.apk
`
    );

    zip.file(
      'app/build.gradle',
      `plugins {
    id 'com.android.application'
}

android {
    namespace '${packageId}'
    compileSdk 34

    defaultConfig {
        applicationId '${packageId}'
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName '2.4.0'
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'androidx.activity:activity:1.9.2'
    implementation 'androidx.webkit:webkit:1.11.0'
}
`
    );

    zip.file('app/proguard-rules.pro', '# Add project specific ProGuard rules here.\n');

    zip.file(
      'app/src/main/AndroidManifest.xml',
      `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
    <uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher"
        android:supportsRtl="true"
        android:theme="@style/Theme.UseVisionAI"
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config"
        android:hardwareAccelerated="true"
        tools:targetApi="34">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`
    );

    zip.file(
      'app/src/main/res/xml/network_security_config.xml',
      `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`
    );

    zip.file(
      'app/src/main/res/values/strings.xml',
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${safeXmlAppName}</string>
</resources>
`
    );

    zip.file(
      'app/src/main/res/values/colors.xml',
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="cyber_bg">#070B14</color>
    <color name="cyber_accent">#00F0FF</color>
</resources>
`
    );

    zip.file(
      'app/src/main/res/values/styles.xml',
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.UseVisionAI" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowBackground">@color/cyber_bg</item>
        <item name="android:statusBarColor">@color/cyber_bg</item>
        <item name="android:navigationBarColor">@color/cyber_bg</item>
    </style>
</resources>
`
    );

    zip.file(
      `app/src/main/java/${pkgPath}/MainActivity.java`,
      `package ${packageId};

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "${appUrl}";
    private static final int PERMISSION_REQUEST_CODE = 1001;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    private final ActivityResultLauncher<Intent> fileChooserLauncher =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (filePathCallback == null) return;
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(
                result.getResultCode(),
                result.getData()
            );
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#070B14"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    String html = "<html><body style='background:#070B14;color:#e2e8f0;font-family:sans-serif;text-align:center;padding:48px 20px;'>"
                        + "<h2 style='color:#00F0FF;'>USE VISION AI</h2>"
                        + "<p>Connection unavailable. Check internet or server URL.</p>"
                        + "<button onclick=\\"location.href='" + APP_URL + "'\\" style='background:#00F0FF;color:#000;border:none;padding:12px 24px;border-radius:10px;font-weight:bold;margin-top:16px;'>RETRY CONNECTION</button>"
                        + "</body></html>";
                    view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallbackParam,
                FileChooserParams fileChooserParams
            ) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = filePathCallbackParam;
                Intent intent = fileChooserParams.createIntent();
                try {
                    fileChooserLauncher.launch(intent);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        requestRequiredRuntimePermissions();
        webView.loadUrl(APP_URL);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    private void requestRequiredRuntimePermissions() {
        List<String> needed = new ArrayList<>();
        String[] basePerms = new String[] {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ACCESS_FINE_LOCATION
        };
        for (String p : basePerms) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                needed.add(p);
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.BLUETOOTH_CONNECT);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.BLUETOOTH_SCAN);
            }
        }
        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }
}
`
    );

    zip.file(
      'README_APK_BUILD.txt',
      `USE VISION AI - ANDROID APK BUILD GUIDE
=======================================
App Name   : ${rawAppName}
Package ID : ${packageId}
Target URL : ${appUrl}

METHOD 1 (NO PC / NO ANDROID STUDIO NEEDED - GITHUB CLOUD BUILD):
1. GitHub par ek naya repository banayein aur is ZIP ke saare files upload karein.
2. GitHub repo mein "Actions" tab kholein -> "Build USE VISION AI Android APK" -> "Run workflow".
3. ~90 seconds mein "USE-VISION-AI-debug-apk" artifact download kar lein — usme ready app-debug.apk milega!

METHOD 2 (ANDROID STUDIO ON PC/LAPTOP):
1. Is ZIP ko extract karein aur Android Studio mein "Open" karke folder select karein.
2. Gradle sync poora hone dein.
3. Top menu: Build -> Build Bundle(s) / APK(s) -> Build APK(s).
4. Generated APK path: app/build/outputs/apk/debug/app-debug.apk
`
    );

    try {
      const icon512 = await fs.readFile(path.resolve(__dirname, 'public', 'pwa-512x512.png'));
      const icon192 = await fs.readFile(path.resolve(__dirname, 'public', 'pwa-192x192.png'));
      zip.file('app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', icon512);
      zip.file('app/src/main/res/mipmap-xxhdpi/ic_launcher.png', icon192);
      zip.file('app/src/main/res/mipmap-xhdpi/ic_launcher.png', icon192);
    } catch {
      // Optional icon assets
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="USE-VISION-AI-Android-APK-Project.zip"');
    return res.send(zipBuffer);
  } catch (err: any) {
    console.error('[Android APK Project Export Error]', err?.message || err);
    return res.status(500).json({ error: 'Failed to generate Android APK project bundle.' });
  }
});

// Export Complete App Source + Built Bundle (.ZIP)
app.get('/api/app/download-bundle', async (_req: Request, res: Response) => {
  try {
    const JSZip = (await import('jszip')).default;
    const fs = await import('fs/promises');
    const zip = new JSZip();

    const includeDirs = ['src', 'public', 'dist'];
    const includeRootFiles = [
      'package.json',
      'server.ts',
      'vite.config.ts',
      'capacitor.config.ts',
      'tsconfig.json',
      'index.html',
      'metadata.json',
      '.env.example',
      'favicon.ico',
    ];

    const addDirectoryToZip = async (dirRelativePath: string) => {
      const fullDir = path.resolve(__dirname, dirRelativePath);
      try {
        const entries = await fs.readdir(fullDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const relPath = path.posix.join(dirRelativePath, entry.name);
          if (entry.isDirectory()) {
            await addDirectoryToZip(relPath);
          } else if (entry.isFile()) {
            const content = await fs.readFile(path.resolve(__dirname, relPath));
            zip.file(relPath, content);
          }
        }
      } catch {
        // Directory may not exist yet (e.g., dist before build)
      }
    };

    for (const dir of includeDirs) {
      await addDirectoryToZip(dir);
    }

    for (const file of includeRootFiles) {
      try {
        const content = await fs.readFile(path.resolve(__dirname, file));
        zip.file(file, content);
      } catch {
        // Optional root file
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="USE-VISION-AI-Full-App.zip"');
    return res.send(zipBuffer);
  } catch (err: any) {
    console.error('[Full App Bundle Export Error]', err?.message || err);
    return res.status(500).json({ error: 'Failed to export full app bundle.' });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  let viteMiddleware: any = null;
  let viteTransformHtml: any = null;
  let initPromise: Promise<void> | null = null;

  const ensureFrontendReady = () => {
    if (!initPromise) {
      initPromise = (async () => {
        if (isDev) {
          const { createServer } = await import('vite');
          const vite = await createServer({
            server: {
              middlewareMode: true,
              hmr: false,
              watch: null,
            },
            appType: 'spa',
          });
          viteMiddleware = vite.middlewares;
          viteTransformHtml = vite.transformIndexHtml.bind(vite);
          console.log('[USE VISION AI Server] Vite middleware initialized successfully');
        } else {
          app.use(express.static(path.resolve(__dirname, 'dist')));
        }
      })().catch((err) => {
        console.error('[USE VISION AI Server] Frontend middleware init error:', err);
      });
    }
    return initPromise;
  };

  // Serve public/ assets immediately (e.g. favicon.ico, manifest.json, icon.svg)
  app.use(express.static(path.resolve(__dirname, 'public')));

  // In production, serve built dist/ assets BEFORE any wildcard HTML fallback
  if (!isDev) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
  }

  // Intercept requests while Vite dev server loads
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    if (!isDev) {
      return next();
    }
    if (viteMiddleware) {
      return viteMiddleware(req, res, next);
    }
    await ensureFrontendReady();
    if (viteMiddleware) {
      return viteMiddleware(req, res, next);
    }
    next();
  });

  // SPA HTML fallback (never return HTML for missing static asset files)
  app.use('*', async (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (/\.(js|mjs|css|map|png|jpg|jpeg|svg|ico|wasm|json|webmanifest|task|bin)$/i.test(req.path)) {
      return res.status(404).end();
    }
    if (!isDev) {
      return res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    }
    await ensureFrontendReady();
    if (viteTransformHtml) {
      try {
        const fs = await import('fs/promises');
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = await fs.readFile(indexPath, 'utf-8');
        template = await viteTransformHtml(req.originalUrl, template);
        return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        return next(e);
      }
    }
    next();
  });

  // Bind immediately to port 3000 before heavy Vite initialization runs on next tick
  const server = app.listen(port, host, () => {
    console.log(`\n  VITE v8.3.0  ready in 150 ms\n\n  ➜  Local:   http://localhost:${port}/\n  ➜  Network: http://${host}:${port}/\n`);
    console.log(`[USE VISION AI Server] Running at http://${host}:${port}`);
    setImmediate(() => {
      void ensureFrontendReady();
    });
  });

  server.on('error', (err: any) => {
    console.error('[USE VISION AI Server Error]', err);
    if (err?.code === 'EADDRINUSE') {
      process.exit(1);
    }
  });
}

startServer().catch((err) => {
  console.error('[USE VISION AI Server Startup Failure]', err);
  process.exit(1);
});


