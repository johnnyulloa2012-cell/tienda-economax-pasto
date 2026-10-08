const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      let html = '';
      res.on('data', c => html += c);
      res.on('end', () => resolve(html));
    }).on('error', reject);
  });
}

async function test() {
  const html = await get('https://www.bing.com/images/search?q=chocorramo+ramo+original+empaque');
  // Bing embeds original image URLs in m="{...murl:"https://..."...}"
  const matches = [...html.matchAll(/murl&quot;:&quot;(https?:[^&]+)&quot;/g)];
  console.log('Found matches in Bing:', matches.length);
  if (matches.length > 0) {
    console.log('Real Image 1:', matches[0][1]);
    console.log('Real Image 2:', matches[1][1]);
  }
}

test();
