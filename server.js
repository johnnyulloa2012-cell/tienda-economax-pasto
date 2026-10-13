/**
 * Servidor Backend & API REST para Tienda ECONOMAX
 * Sincronización en tiempo real entre Computadora, Celulares y Clientes
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

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
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Subir fotos a red CDN permanente (Catbox) para que nunca expiren ni se borren por inactividad
async function uploadToCloudCDN(base64Data, filename) {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    formData.append('fileToUpload', blob, filename || 'producto.jpg');

    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const url = await res.text();
      if (url && url.startsWith('http')) {
        console.log(`[CDN] Foto alojada permanentemente en la nube: ${url.trim()}`);
        return url.trim();
      }
    }
  } catch (e) {
    console.warn('[CDN] Aviso subiendo a CDN permanente:', e.message);
  }
  return null;
}

// Sincronizar catálogo y ajustes al Gist para persistencia indestructible
async function syncBackupToGist(productsData, settingsData) {
  if (!GIST_BACKUP_ID || !GITHUB_TOKEN) return;
  try {
    const files = {};
    if (productsData) files['products.json'] = { content: JSON.stringify(productsData, null, 2) };
    if (settingsData) files['settings.json'] = { content: JSON.stringify(settingsData, null, 2) };
    files['status.json'] = { content: JSON.stringify({ lastSync: new Date().toISOString() }) };

    await fetch(`https://api.github.com/gists/${GIST_BACKUP_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Tienda-Economax-Sync'
      },
      body: JSON.stringify({ files })
    });
    console.log('[Gist] Copia de seguridad permanente sincronizada exitosamente.');
  } catch (e) {
    console.warn('[Gist] Aviso sincronizando backup en Gist:', e.message);
  }
}

// Inicializar datos locales desde Gist si el disco efímero de Render se reinició
async function initServerDataFromBackup() {
  const localProducts = readJsonFile('products.json', null);
  if (!localProducts || !Array.isArray(localProducts) || localProducts.length === 0) {
    try {
      console.log('[Gist] Restaurando catálogo desde backup permanente...');
      const res = await fetch(`https://gist.githubusercontent.com/johnnyulloa2012-cell/${GIST_BACKUP_ID}/raw/products.json?t=${Date.now()}`);
      if (res.ok) {
        const backupProducts = await res.json();
        if (Array.isArray(backupProducts) && backupProducts.length > 0) {
          writeJsonFile('products.json', backupProducts);
          console.log(`[Gist] Restaurados ${backupProducts.length} productos desde backup permanente.`);
        }
      }
    } catch (e) {
      console.warn('[Gist] Aviso leyendo backup en arranque:', e.message);
    }
  }
}
initServerDataFromBackup();

const server = http.createServer(async (req, res) => {
  // Configurar CORS completo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // =================== API ENDPOINTS ===================

  // 1. /api/products
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

  // 1.5. /api/upload - Subida de fotos desde Celular o PC a CDN Permanente
  if (pathname === '/api/upload') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        if (body && body.image) {
          // Extraer base64 y tipo de imagen
          const matches = body.image.match(/^data:image\/([a-zA-Z0-9\+\-\.]+);base64,(.+)$/);
          let ext = '.jpg';
          let base64Data = body.image;

          if (matches) {
            const rawExt = matches[1].toLowerCase();
            ext = rawExt === 'jpeg' ? '.jpg' : `.${rawExt}`;
            base64Data = matches[2];
          }

          const filename = `upload-${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`;

          // 1. Guardar copia local en images/
          const imagesDir = path.join(__dirname, 'images');
          if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
          }
          const savePath = path.join(imagesDir, filename);
          fs.writeFileSync(savePath, Buffer.from(base64Data, 'base64'));
          const localUrl = `images/${filename}`;

          // 2. Subir a red CDN permanente (Catbox) para que nunca se borre si Render duerme o se reinicia
          const cloudUrl = await uploadToCloudCDN(base64Data, filename);
          const finalUrl = cloudUrl || localUrl;

          console.log(`[API] Foto guardada permanentemente: ${finalUrl}`);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, url: finalUrl }));
          return;
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No se envió imagen en el payload' }));
          return;
        }
      } catch (e) {
        console.error('Error subiendo imagen:', e);
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  // 2. /api/settings
  if (pathname === '/api/settings') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (req.method === 'GET' || req.method === 'HEAD') {
      const settings = readJsonFile('settings.json', {});
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? null : JSON.stringify(settings));
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
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

  // 3. /api/orders
  if (pathname === '/api/orders') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (req.method === 'GET' || req.method === 'HEAD') {
      const orders = readJsonFile('orders.json', []);
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? null : JSON.stringify(orders));
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        if (Array.isArray(body)) {
          writeJsonFile('orders.json', body);
        } else if (body && body.id) {
          const current = readJsonFile('orders.json', []);
          const existingIdx = current.findIndex(o => o.id === body.id);
          if (existingIdx >= 0) {
            current[existingIdx] = body;
          } else {
            current.unshift(body);
          }
          writeJsonFile('orders.json', current);
        }
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

  // =================== ARCHIVOS ESTÁTICOS ===================
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

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
  console.log('====================================================');
});
