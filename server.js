/**
 * Servidor Backend & API REST para Tienda ECONOMAX
 * Sincronización en tiempo real entre Computadora, Celulares y Clientes
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
      const products = readJsonFile('products.json', []);
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? null : JSON.stringify(products));
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        if (Array.isArray(body)) {
          writeJsonFile('products.json', body);
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

  // 1.5. /api/upload - Subida de fotos desde Celular (Cámara y Galería) o PC
  if (pathname === '/api/upload') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        if (body && body.image) {
          const imagesDir = path.join(__dirname, 'images');
          if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
          }

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
          const savePath = path.join(imagesDir, filename);
          fs.writeFileSync(savePath, Buffer.from(base64Data, 'base64'));

          const publicPath = `images/${filename}`;
          console.log(`[API] Foto guardada exitosamente: ${publicPath}`);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, url: publicPath }));
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
        console.log('[API] Parámetros del negocio actualizados.');
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
