process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
const fs = require('fs');
const path = require('path');

const PRODUCTS_TO_FETCH = [
  { key: 'dessini_pan', query: 'sarten dessini italy original doble cara mercadolibre colombia' },
  { key: 'swiss_home', query: 'bateria ollas swiss home 12 piezas acero quirurgico mercadolibre colombia' },
  { key: 'chocorramo', query: 'chocorramo ramo original paquete colombia' },
  { key: 'papas_margarita', query: 'papas margarita pollo frito lay colombia paquete' },
  { key: 'takis_fuego', query: 'takis fuego morado paquete snack colombia' },
  { key: 'galletas_ducales', query: 'galletas ducales noel paquete colombia' },
  { key: 'leche_colanta', query: 'leche entera colanta bolsa 1 litro colombia' },
  { key: 'huevos_aa', query: 'huevos rojos frescos tipo aa panal colombia' },
  { key: 'mac_pollo', query: 'mac pollo trozos pollo campesino fresco colombia' },
  { key: 'salchicha_mac_pollo', query: 'salchicha mac pollo manguera paquete' },
  { key: 'yogourth_colacteos', query: 'yogurt colacteos vaso nariño pasto' },
  { key: 'pan_dulce_sal', query: 'pan rollo artesanal panaderia colombiana de sal y dulce' },
  { key: 'panela_cuadro', query: 'panela en cuadro pastusa colombia' },
  { key: 'azucar_incauca', query: 'azucar blanca incauca 1000g bolsa' },
  { key: 'arroz_florhuila', query: 'arroz florhuila 1000g bolsa colombia' },
  { key: 'harina_narino', query: 'harina de trigo nariño colombia' },
  { key: 'lenteja', query: 'lenteja seleccionada grano bolsa colombia' },
  { key: 'pasta_comarrico', query: 'pasta comarrico caracol bolsa colombia' },
  { key: 'avena_bary', query: 'avena en hojuelas bary bolsa colombia' },
  { key: 'aceite_premier', query: 'aceite premier 900ml botella colombia' },
  { key: 'colcafe', query: 'colcafe clasico instantaneo frasco colombia' },
  { key: 'cafe_sello_rojo', query: 'cafe sello rojo molido 250g paquete colombia' },
  { key: 'crema_colgate', query: 'crema dental colgate triple accion tubo colombia' },
  { key: 'papel_familia', query: 'papel higienico familia acolchado rollo' },
  { key: 'jabon_dove', query: 'jabon dove blanco barra 90g' },
  { key: 'jabon_coco', query: 'jabon de coco barra varela colombia' },
  { key: 'gel_ego', query: 'gel ego black fijador para hombre colombia' },
  { key: 'detodito', query: 'detodito frito lay paquete colombia' },
  { key: 'tostacos', query: 'tostacos frito lay paquete colombia' },
  { key: 'speed_max', query: 'speed max energizante botella colombia' },
  { key: 'prendas_vestir', query: 'ropa casual surtida camisetas pantalones almacen colombia' }
];

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'es-CO,es;q=0.9'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('Status ' + res.statusCode));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(true));
      });
    }).on('error', reject);
  });
}

async function run() {
  const imagesDir = path.join(__dirname, 'images');
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);

  for (const item of PRODUCTS_TO_FETCH) {
    const dest = path.join(imagesDir, `${item.key}.jpg`);
    console.log(`Buscando imagen real de Google para: ${item.key}...`);
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(item.query)}&udm=2`;
      const html = await fetchHTML(searchUrl);
      const matches = [...html.matchAll(/https:\/\/encrypted-tbn0\.gstatic\.com\/images\?q=[^\"\'&]+/g)];
      
      if (matches.length > 0) {
        // Seleccionamos el primer resultado que tenga buen contenido
        const imgUrl = matches[0][0];
        console.log(`  Descargando desde: ${imgUrl}`);
        await downloadImage(imgUrl, dest);
        console.log(`  ✓ Guardado en images/${item.key}.jpg`);
      } else {
        console.log(`  ✗ No se encontraron imágenes para ${item.key}`);
      }
    } catch (err) {
      console.error(`  Error procesando ${item.key}:`, err.message);
    }
  }
  console.log('¡Descarga de imágenes reales de Google completada!');
}

run();
