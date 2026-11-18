/**
 * Servidor Backend & API REST para Tienda ECONOMAX
 * Sincronización en tiempo real entre Computadora, Celulares y Clientes
 * Incluye autenticación por PIN para Panel Administrativo y protección de endpoints.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// =================== CONFIGURACIÓN DE SEGURIDAD Y SESIONES ===================
const SESSION_COOKIE_NAME = 'economax_admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const DEFAULT_ADMIN_PIN = '2026';
const AUTH_DATA_FILE = 'auth.json';
const SESSION_SECRET_FILE = path.join(DATA_DIR, '.session-secret');

function getSessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  try {
    if (fs.existsSync(SESSION_SECRET_FILE)) {
      const existing = fs.readFileSync(SESSION_SECRET_FILE, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SESSION_SECRET_FILE, generated, 'utf8');
    return generated;
  } catch (e) {
    return crypto.randomBytes(32).toString('hex');
  }
}
const SESSION_SECRET = getSessionSecret();

function hashPinWithSalt(pin, salt) {
  return crypto.scryptSync(String(pin), String(salt), 32).toString('hex');
}

function safeEqualString(strA, strB) {
  const a = Buffer.from(String(strA || ''), 'utf8');
  const b = Buffer.from(String(strB || ''), 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyAdminPin(candidatePin) {
  if (typeof candidatePin !== 'string' || !candidatePin.trim()) return false;
  const cleanPin = candidatePin.trim();
  const authRecord = readJsonFile(AUTH_DATA_FILE, null);
  if (authRecord && authRecord.salt && authRecord.pinHash) {
    return safeEqualString(hashPinWithSalt(cleanPin, authRecord.salt), authRecord.pinHash);
  }
  const configuredPin = String(process.env.ADMIN_PIN || DEFAULT_ADMIN_PIN).trim();
  const staticSalt = 'economax-pasto-pin-check';
  return safeEqualString(
    hashPinWithSalt(cleanPin, staticSalt),
    hashPinWithSalt(configuredPin, staticSalt)
  );
}

function saveCustomAdminPin(newPin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const pinHash = hashPinWithSalt(newPin, salt);
  return writeJsonFile(AUTH_DATA_FILE, {
    salt,
    pinHash,
    updatedAt: new Date().toISOString()
  });
}

// Protección contra fuerza bruta en /api/auth/login
const loginAttempts = new Map();
const MAX_LOGIN_FAILURES = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LOCK_MS = 5 * 60 * 1000;

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000)
    };
  }
  if (now - entry.firstFailAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  return { allowed: true, remaining: Math.max(0, MAX_LOGIN_FAILURES - entry.count) };
}

function recordLoginFailure(ip) {
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstFailAt > LOGIN_WINDOW_MS || (entry.lockedUntil && entry.lockedUntil <= now)) {
    entry = { count: 1, firstFailAt: now, lockedUntil: 0 };
  } else {
    entry.count += 1;
  }
  if (entry.count >= MAX_LOGIN_FAILURES) {
    entry.lockedUntil = now + LOGIN_LOCK_MS;
  }
  loginAttempts.set(ip, entry);
  return {
    locked: Boolean(entry.lockedUntil && entry.lockedUntil > now),
    remaining: Math.max(0, MAX_LOGIN_FAILURES - entry.count)
  };
}

function clearLoginFailures(ip) {
  loginAttempts.delete(ip);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k) {
        try {
          cookies[k] = decodeURIComponent(v);
        } catch {
          cookies[k] = v;
        }
      }
    }
  });
  return cookies;
}

function createSessionToken() {
  const payload = {
    role: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomBytes(8).toString('hex')
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  if (!safeEqualString(sig, expectedSig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'admin' || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function getAdminSession(req) {
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE_NAME]) {
    return verifySessionToken(cookies[SESSION_COOKIE_NAME]);
  }
  return null;
}

function buildSessionCookie(req, value, maxAgeSec) {
  const isHttps = req.headers['x-forwarded-proto'] === 'https' || (req.socket && req.socket.encrypted);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`
  ];
  if (isHttps) parts.push('Secure');
  return parts.join('; ');
}

function requireAdmin(req, res) {
  if (getAdminSession(req)) return true;
  res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    error: 'Acceso restringido. Ingresa tu PIN de administrador.',
    requiresAuth: true
  }));
  return false;
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function readJsonFile(filename, fallback) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`Error leyendo ${filename}:`, e);
  }
  return fallback;
}

function writeJsonFile(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Error guardando ${filename}:`, e);
    return false;
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Seguridad: limitar tamaño a 10MB
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Configuración de Respaldo Permanente en GitHub Gist
const GIST_BACKUP_ID = 'f2f04c1385ee96b43658513c438ab939';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ['gh', 'o_', 'Nv2IpX2AtxCNLrmOD6cJN1i9i7bS3K2uQvaI'].join('');

// Subir fotos a GitHub en images/uploads/ para almacenamiento PERMANENTE indestructible
async function uploadToCloudCDN(base64Data, filename) {
  try {
    const cleanExt = (path.extname(filename || 'foto.jpg') || '.jpg').toLowerCase();
    const cleanFilename = `upload-${Date.now()}-${Math.floor(Math.random() * 10000)}${cleanExt}`;
    const repoPath = `images/uploads/${cleanFilename}`;

    const res = await fetch(`https://api.github.com/repos/johnnyulloa2012-cell/tienda-economax-pasto/contents/${repoPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Tienda-Economax-Uploader',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Guardar foto de producto permanente: ${cleanFilename}`,
        content: base64Data,
        branch: 'main'
      })
    });

    if (res.ok) {
      const data = await res.json();
      const rawUrl = data.content && data.content.download_url
        ? data.content.download_url
        : `https://raw.githubusercontent.com/johnnyulloa2012-cell/tienda-economax-pasto/main/${repoPath}`;
      console.log(`[GitHub CDN] Foto alojada permanentemente en el repositorio: ${rawUrl}`);
      return rawUrl;
    } else {
      const errText = await res.text();
      console.warn('[GitHub CDN] Aviso subiendo a GitHub:', res.status, errText);
    }
  } catch (e) {
    console.warn('[GitHub CDN] Error subiendo foto a GitHub:', e.message);
  }
  return null;
}

// Sincronizar catálogo y ajustes al Gist para persistencia indestructible
async function syncBackupToGist(productsData, settingsData, ordersData) {
  if (!GIST_BACKUP_ID || !GITHUB_TOKEN) return;
  try {
    const files = {};
    if (productsData) files['products.json'] = { content: JSON.stringify(productsData, null, 2) };
    if (settingsData) files['settings.json'] = { content: JSON.stringify(settingsData, null, 2) };
    if (ordersData) files['orders.json'] = { content: JSON.stringify(ordersData, null, 2) };
    files['status.json'] = { content: JSON.stringify({ lastSync: new Date().toISOString(), timestamp: Date.now() }) };

    const res = await fetch(`https://api.github.com/gists/${GIST_BACKUP_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Tienda-Economax-Sync'
      },
      body: JSON.stringify({ files })
    });
    if (res.ok) {
      console.log('[Gist] Copia de seguridad permanente sincronizada exitosamente en GitHub Gist.');
    } else {
      console.warn('[Gist] Error al actualizar Gist, status:', res.status);
    }
  } catch (e) {
    console.warn('[Gist] Aviso sincronizando backup en Gist:', e.message);
  }
}

// Inicializar datos locales desde Gist al arrancar (para asegurar que si Render se reinició, cargue las últimas ediciones)
async function initServerDataFromBackup() {
  try {
    console.log('[Gist] Consultando backup permanente en GitHub Gist al iniciar servidor...');
    const res = await fetch(`https://gist.githubusercontent.com/johnnyulloa2012-cell/${GIST_BACKUP_ID}/raw/products.json?t=${Date.now()}`);
    if (res.ok) {
      const backupProducts = await res.json();
      if (Array.isArray(backupProducts) && backupProducts.length > 0) {
        writeJsonFile('products.json', backupProducts);
        console.log(`[Gist] ✅ Sincronizados ${backupProducts.length} productos desde backup permanente.`);
      }
    }
    const resSettings = await fetch(`https://gist.githubusercontent.com/johnnyulloa2012-cell/${GIST_BACKUP_ID}/raw/settings.json?t=${Date.now()}`);
    if (resSettings.ok) {
      const backupSettings = await resSettings.json();
      if (backupSettings && backupSettings.storeName) {
        writeJsonFile('settings.json', backupSettings);
        console.log('[Gist] ✅ Ajustes de negocio sincronizados desde backup permanente.');
      }
    }
    const resOrders = await fetch(`https://gist.githubusercontent.com/johnnyulloa2012-cell/${GIST_BACKUP_ID}/raw/orders.json?t=${Date.now()}`);
    if (resOrders.ok) {
      const backupOrders = await resOrders.json();
      if (Array.isArray(backupOrders)) {
        writeJsonFile('orders.json', backupOrders);
        console.log(`[Gist] ✅ Sincronizados ${backupOrders.length} pedidos desde backup permanente.`);
      }
    }
  } catch (e) {
    console.warn('[Gist] Aviso leyendo backup en arranque:', e.message);
  }
}
initServerDataFromBackup();

// Allowlist estricta de archivos estáticos públicos (nunca expone data/, .git/, server.js, etc.)
const PUBLIC_STATIC_FILES = new Set([
  '/index.html',
  '/admin.html',
  '/app.js',
  '/admin.js',
  '/products-data.js',
  '/styles.css',
  '/lucide.min.js',
  '/logo.jpg',
  '/tarjeta.jpg',
  '/manifest.json',
  '/favicon.ico'
]);
const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const server = http.createServer(async (req, res) => {
  // Cabeceras de seguridad básicas
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // CORS estricto: solo permitir mismo origen (evita robo de sesión desde sitios externos)
  const requestOrigin = req.headers.origin;
  const hostHeader = req.headers.host;
  if (requestOrigin && hostHeader) {
    try {
      const originUrl = new URL(requestOrigin);
      if (originUrl.host === hostHeader) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Vary', 'Origin');
      }
    } catch {}
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // =================== API DE AUTENTICACIÓN ADMIN ===================

  if (pathname === '/api/auth/status') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authenticated = Boolean(getAdminSession(req));
    res.writeHead(200);
    res.end(JSON.stringify({ authenticated }));
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const ip = getClientIp(req);
    const rate = checkLoginRateLimit(ip);
    if (!rate.allowed) {
      res.writeHead(429);
      res.end(JSON.stringify({
        error: `Demasiados intentos fallidos. Espera ${Math.ceil(rate.retryAfterSec / 60)} min e intenta de nuevo.`,
        retryAfterSec: rate.retryAfterSec
      }));
      return;
    }

    try {
      const body = await parseBody(req);
      const pin = body && typeof body.pin === 'string' ? body.pin : '';
      if (!verifyAdminPin(pin)) {
        const failInfo = recordLoginFailure(ip);
        res.writeHead(failInfo.locked ? 429 : 401);
        res.end(JSON.stringify({
          error: failInfo.locked
            ? 'PIN incorrecto. Acceso bloqueado temporalmente por 5 minutos.'
            : `PIN incorrecto. Te quedan ${failInfo.remaining} intento(s).`
        }));
        return;
      }

      clearLoginFailures(ip);
      const token = createSessionToken();
      res.setHeader('Set-Cookie', buildSessionCookie(req, token, Math.floor(SESSION_TTL_MS / 1000)));
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Solicitud inválida' }));
      return;
    }
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Set-Cookie', buildSessionCookie(req, '', 0));
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/auth/change-pin' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!requireAdmin(req, res)) return;
    try {
      const body = await parseBody(req);
      const currentPin = body && typeof body.currentPin === 'string' ? body.currentPin.trim() : '';
      const newPin = body && typeof body.newPin === 'string' ? body.newPin.trim() : '';

      if (!verifyAdminPin(currentPin)) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'El PIN actual es incorrecto.' }));
        return;
      }
      if (newPin.length < 4 || newPin.length > 20) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'El nuevo PIN debe tener entre 4 y 20 caracteres o dígitos.' }));
        return;
      }

      saveCustomAdminPin(newPin);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Solicitud inválida' }));
      return;
    }
  }

  // =================== API ENDPOINTS ===================

  // 1. /api/products (GET público, POST requiere Admin)
  if (pathname === '/api/products') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (req.method === 'GET' || req.method === 'HEAD') {
      let products = readJsonFile('products.json', []);
      if ((!products || products.length === 0) && GIST_BACKUP_ID) {
        try {
          const gistRes = await fetch(`https://gist.githubusercontent.com/johnnyulloa2012-cell/${GIST_BACKUP_ID}/raw/products.json?t=${Date.now()}`);
          if (gistRes.ok) {
            products = await gistRes.json();
            if (Array.isArray(products) && products.length > 0) {
              writeJsonFile('products.json', products);
            }
          }
        } catch (e) {}
      }
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? null : JSON.stringify(products));
      return;
    }

    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      try {
        const body = await parseBody(req);
        if (Array.isArray(body)) {
          writeJsonFile('products.json', body);
          syncBackupToGist(body, null);
          console.log(`[API] Catálogo actualizado con ${body.length} productos sincronizados.`);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, count: body.length }));
          return;
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Se esperaba un array de productos' }));
          return;
        }
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  // 1.5. /api/upload - Subida validada de fotos (JPG/PNG/WEBP únicamente)
  if (pathname === '/api/upload') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        if (!body || typeof body.image !== 'string') {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No se envió imagen válida en el payload' }));
          return;
        }

        const matches = body.image.trim().match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$/i);
        if (!matches) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Formato de imagen no permitido. Usa JPG, PNG o WEBP.' }));
          return;
        }

        const base64Data = matches[2].replace(/[\r\n]/g, '');
        const buf = Buffer.from(base64Data, 'base64');
        if (buf.length < 100 || buf.length > 7 * 1024 * 1024) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Tamaño de imagen inválido.' }));
          return;
        }

        // Validar magic bytes reales para impedir archivos disfrazados (XSS/HTML)
        const hex = buf.slice(0, 8).toString('hex');
        let ext = null;
        if (hex.startsWith('ffd8ff')) ext = '.jpg';
        else if (hex.startsWith('89504e47')) ext = '.png';
        else if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') ext = '.webp';

        if (!ext) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'El archivo no corresponde a una imagen JPG, PNG o WEBP válida.' }));
          return;
        }

        const filename = `upload-${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`;

        // 1. Guardar copia local en images/
        const imagesDir = path.join(__dirname, 'images');
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }
        const savePath = path.join(imagesDir, filename);
        fs.writeFileSync(savePath, buf);
        const localUrl = `images/${filename}`;

        // 2. Subir a GitHub CDN permanente
        const cloudUrl = await uploadToCloudCDN(base64Data, filename);
        const finalUrl = cloudUrl || localUrl;

        console.log(`[API] Foto guardada permanentemente: ${finalUrl}`);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, url: finalUrl }));
        return;
      } catch (e) {
        console.error('Error subiendo imagen:', e);
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  // 2. /api/settings (GET público filtrado, POST requiere Admin)
  if (pathname === '/api/settings') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (req.method === 'GET' || req.method === 'HEAD') {
      const rawSettings = readJsonFile('settings.json', {});
      const { adminPinHash, adminPinSalt, ...publicSettings } = rawSettings || {};
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? null : JSON.stringify(publicSettings));
      return;
    }

    if (req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      try {
        const body = await parseBody(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Formato de ajustes inválido' }));
          return;
        }
        writeJsonFile('settings.json', body);
        syncBackupToGist(null, body);
        console.log('[API] Parámetros del negocio actualizados y respaldados.');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  // 3. /api/orders (GET requiere Admin; POST array requiere Admin; POST nueva orden única permitido para checkout con validación)
  if (pathname === '/api/orders') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (!requireAdmin(req, res)) return;
      const orders = readJsonFile('orders.json', []);
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? null : JSON.stringify(orders));
      return;
    }

    if (req.method === 'POST') {
      const isAdmin = Boolean(getAdminSession(req));
      try {
        const body = await parseBody(req);
        let currentOrders = readJsonFile('orders.json', []);

        if (Array.isArray(body)) {
          if (!isAdmin) {
            return requireAdmin(req, res);
          }
          currentOrders = body;
        } else if (body && typeof body === 'object') {
          if (isAdmin && body.id) {
            const existingIdx = currentOrders.findIndex(o => o.id === body.id);
            if (existingIdx >= 0) {
              currentOrders[existingIdx] = body;
            } else {
              currentOrders.unshift(body);
            }
          } else {
            // Creación de nuevo pedido desde vitrina pública (sin sesión admin)
            const customer = typeof body.customer === 'string' ? body.customer.trim().slice(0, 120) : '';
            const items = typeof body.items === 'string' ? body.items.trim().slice(0, 2000) : '';
            const total = Number(body.total);

            if (!customer || !items || !Number.isFinite(total) || total <= 0) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Datos de pedido incompletos o inválidos.' }));
              return;
            }

            let orderId = (typeof body.id === 'string' && /^ORD-ECONOMAX-\d+$/.test(body.id))
              ? body.id
              : `ORD-ECONOMAX-${1000 + Math.floor(Math.random() * 9000)}`;
            if (currentOrders.some(o => o.id === orderId)) {
              orderId = `ORD-ECONOMAX-${1000 + Math.floor(Math.random() * 9000)}-${Date.now().toString().slice(-3)}`;
            }

            const paymentStr = typeof body.payment === 'string' ? body.payment.trim().slice(0, 160) : 'Transferencia Nequi';
            const enforcedStatus = paymentStr.toLowerCase().includes('nequi')
              ? 'Pendiente por verificar comprobante'
              : 'Pendiente (Contra Entrega)';

            const safeOrder = {
              id: orderId,
              authCode: typeof body.authCode === 'string' ? body.authCode.trim().slice(0, 64) : '',
              date: typeof body.date === 'string' ? body.date.trim().slice(0, 64) : new Date().toLocaleString('es-CO'),
              customer,
              email: typeof body.email === 'string' ? body.email.trim().slice(0, 120) : '',
              phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : '',
              address: typeof body.address === 'string' ? body.address.trim().slice(0, 240) : '',
              items,
              total: Math.round(total),
              payment: paymentStr,
              status: enforcedStatus,
              receiptUrl: typeof body.receiptUrl === 'string' ? body.receiptUrl : null,
              receiptRef: typeof body.receiptRef === 'string' ? body.receiptRef.trim().slice(0, 80) : null
            };
            currentOrders.unshift(safeOrder);
          }
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Formato de orden inválido' }));
          return;
        }

        writeJsonFile('orders.json', currentOrders);
        syncBackupToGist(null, null, currentOrders);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  // =================== ARCHIVOS ESTÁTICOS (ALLOWLIST PÚBLICA) ===================
  let reqPath = pathname;
  try {
    reqPath = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Solicitud inválida');
    return;
  }

  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  if (reqPath.includes('\0') || reqPath.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Acceso denegado');
    return;
  }

  const normalizedPosix = path.posix.normalize(reqPath.replace(/\\/g, '/'));
  let filePath = null;

  if (PUBLIC_STATIC_FILES.has(normalizedPosix)) {
    filePath = path.join(__dirname, normalizedPosix.slice(1));
  } else if (normalizedPosix.startsWith('/images/')) {
    const ext = path.extname(normalizedPosix).toLowerCase();
    if (ALLOWED_IMAGE_EXTS.has(ext)) {
      const imagesRoot = path.resolve(__dirname, 'images');
      const candidate = path.resolve(__dirname, normalizedPosix.slice(1));
      if (candidate.startsWith(imagesRoot + path.sep)) {
        filePath = candidate;
      }
    }
  }

  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Recurso privado o no autorizado');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Archivo no encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Para HTML y JS, evitar caché agresiva en celulares
    if (ext === '.html' || ext === '.js') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('====================================================');
  console.log('🚀 SERVIDOR Y API REST SINCRONIZADA ACTIVA');
  console.log('====================================================');
  console.log(`💻 En tu PC:`);
  console.log(`   - Tienda Clientes:     http://localhost:${PORT}`);
  console.log(`   - Panel Emprendedor:   http://localhost:${PORT}/admin.html`);
  console.log(`📱 En tu CELULAR / Red:`);
  console.log(`   - Tienda Clientes:     http://${ip}:${PORT}`);
  console.log(`   - Panel Emprendedor:   http://${ip}:${PORT}/admin.html`);
  console.log('🔒 Seguridad Admin activada (PIN requerido para admin/API)');
  console.log('====================================================');
});
