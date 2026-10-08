const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PRODUCTS = [
  { key: 'dessini_pan', q: 'sarten dessini italy original doble cara mercadolibre' },
  { key: 'swiss_home', q: 'bateria ollas swiss home 12 piezas acero quirurgico' },
  { key: 'chocorramo', q: 'chocorramo ramo original paquete colombia' },
  { key: 'papas_margarita', q: 'papas margarita pollo frito lay colombia' },
  { key: 'takis_fuego', q: 'takis fuego morado snack paquete' },
  { key: 'galletas_ducales', q: 'galletas ducales noel colombia' },
  { key: 'leche_grande', q: 'leche entera colanta bolsa 1 litro' },
  { key: 'leche_mediana', q: 'leche entera alquería bolsa colombia' },
  { key: 'huevos_frescos', q: 'huevos frescos tipo aa cubeta panal' },
  { key: 'mac_pollo', q: 'mac pollo trozos fresco campesino' },
  { key: 'salchicha_mac_pollo', q: 'salchicha manguera mac pollo' },
  { key: 'yogourth_colacteos', q: 'yogurt colacteos pasto nariño' },
  { key: 'pan_dulce_sal', q: 'pan rollo panaderia colombiana artesanal' },
  { key: 'panela_cuadro', q: 'panela en cuadro pastusa colombia' },
  { key: 'azucar_blanca', q: 'azucar blanca incauca 1000g bolsa' },
  { key: 'arrocillo', q: 'arroz blanco seleccionado grano colombia' },
  { key: 'harina_narino', q: 'harina de trigo nariño colombia' },
  { key: 'lenteja', q: 'lenteja seleccionada grano bolsa' },
  { key: 'maiz_amarillo', q: 'maiz amarillo seco grano colombia' },
  { key: 'pasta_comarrico', q: 'pasta comarrico caracol bolsa' },
  { key: 'avena_bary', q: 'avena en hojuelas bary' },
  { key: 'sal_refisal', q: 'sal refisal alta pureza 1000g' },
  { key: 'sal_cristal', q: 'sal cristal marina bolsa' },
  { key: 'aceite_premier', q: 'aceite premier 900ml vegetal botella' },
  { key: 'mayonesa_fruco', q: 'mayonesa fruco doypack colombia' },
  { key: 'colcafe', q: 'colcafe clasico instantaneo' },
  { key: 'cafe_sello_rojo', q: 'cafe sello rojo 250g tradicional' },
  { key: 'vinagre', q: 'vinagre blanco de cocina botella' },
  { key: 'canela_astilla', q: 'canela en astilla aromatica' },
  { key: 'ponque_ramo', q: 'ponque tradicional ramo tajada' },
  { key: 'bimbo_vainilla', q: 'ponque bimbo casero vainilla' },
  { key: 'submarino_arequipe', q: 'submarino marinela arequipe' },
  { key: 'tostada_integral', q: 'tostadas integrales susy guadalupe' },
  { key: 'detodito_bbq', q: 'de todito bbq frito lay' },
  { key: 'detodito_mix', q: 'de todito mix tradicional frito lay' },
  { key: 'papas_margarita_tomate', q: 'papas margarita tomate y pollo frito lay' },
  { key: 'tostacos_guacamole', q: 'tostacos queso y guacamole' },
  { key: 'tostacos_carnitas', q: 'tostacos sabor a carnitas' },
  { key: 'cheese_tris', q: 'cheese tris trissitos frito lay' },
  { key: 'choclitos_limon', q: 'choclitos frito lay limon' },
  { key: 'galletas_festival', q: 'galletas festival noel' },
  { key: 'galletas_oreo', q: 'galletas oreo paquete original' },
  { key: 'zucaritas', q: 'cereal zucaritas kelloggs' },
  { key: 'trident_verde', q: 'chicles trident verde menta' },
  { key: 'sparkies', q: 'caramelos sparkies colombia' },
  { key: 'speed_max', q: 'bebida energizante speed max botella' },
  { key: 'jugo_del_valle', q: 'jugo del valle botella nectar' },
  { key: 'jugo_tutti_frutti', q: 'jugo tutti frutti cajita con pitillo' },
  { key: 'agua_cristal', q: 'agua cristal botella pequeña' },
  { key: 'colgate_grande', q: 'crema dental colgate triple accion tubo' },
  { key: 'papel_familia', q: 'papel higienico familia acolchado rollo' },
  { key: 'toallas_higienicas', q: 'toallas higienicas nosotras con alas' },
  { key: 'jabon_dove', q: 'jabon dove blanco barra humectante' },
  { key: 'jabon_coco', q: 'jabon de coco barra varela' },
  { key: 'gel_ego', q: 'gel ego black fijador para hombre' },
  { key: 'jabon_3d', q: 'jabon liquido 3d multiusos botella' },
  { key: 'fab_polvo', q: 'detergente fab en polvo ropa' },
  { key: 'aromatel', q: 'suavizante aromatel doypack' },
  { key: 'bombillo_led', q: 'bombillo led 12w luz blanca e27' },
  { key: 'pegante_instantaneo', q: 'pegante instantaneo super bonder 3g' },
  { key: 'cinta_aislante', q: 'cinta aislante negra electrica rollo' },
  { key: 'cable_tipo_c', q: 'cable usb tipo c carga rapida celular' },
  { key: 'ropa_surtida', q: 'ropa casual surtida doblada camisetas jeans' },
  { key: 'blusas_camisetas', q: 'blusas y camisetas frescas casuales dama' },
  { key: 'pantalones_bermudas', q: 'pantalones jeans bermudas casuales' },
  { key: 'ropa_infantil', q: 'ropa infantil para niños conjuntos algodon' },
  { key: 'medias_tobilleras', q: 'medias tobilleras paquete x 3 algodon' }
];

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CO,es;q=0.9'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHTML(res.headers.location).then(resolve).catch(reject);
      }
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => resolve(html));
    }).on('error', reject);
  });
}

function downloadFile(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = fileUrl.startsWith('https') ? https : http;
    const req = protocol.get(fileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bing.com/'
      },
      timeout: 10000
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('Status ' + res.statusCode));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(true));
      });
      file.on('error', err => {
        fs.unlink(destPath, () => reject(err));
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('Timeout'));
    });
    req.on('error', reject);
  });
}

async function start() {
  const dir = path.join(__dirname, 'images');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  console.log(`Iniciando descarga de ${PRODUCTS.length} imágenes reales de productos...`);
  let successCount = 0;

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    const targetFile = path.join(dir, `${p.key}.jpg`);

    console.log(`[${i + 1}/${PRODUCTS.length}] Buscando foto real de: ${p.key}...`);
    try {
      const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(p.q)}&form=HDRSC2`;
      const html = await fetchHTML(searchUrl);
      const matches = [...html.matchAll(/murl&quot;:&quot;(https?:[^&]+)&quot;/g)];

      let downloaded = false;
      for (let j = 0; j < Math.min(5, matches.length); j++) {
        let imgUrl = matches[j][1];
        // Validar que no sea SVG ni extensión extraña
        if (imgUrl.includes('.svg') || imgUrl.includes('.webp')) continue;

        try {
          await downloadFile(imgUrl, targetFile);
          const stats = fs.statSync(targetFile);
          if (stats.size > 2000) { // archivo válido mayor a 2KB
            console.log(`   ✓ Descargada (${Math.round(stats.size / 1024)} KB): ${imgUrl.substring(0, 60)}...`);
            downloaded = true;
            successCount++;
            break;
          }
        } catch (e) {
          // Intentar siguiente imagen
        }
      }

      if (!downloaded) {
        console.log(`   ⚠ No se pudo descargar imagen para ${p.key}`);
      }
    } catch (err) {
      console.error(`   ✗ Error en búsqueda de ${p.key}:`, err.message);
    }

    // Pequeña pausa de 200ms para cortesía de red
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`=============================================`);
  console.log(`Proceso completado. ${successCount} imágenes reales descargadas.`);
  console.log(`=============================================`);
}

start();
