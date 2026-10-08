const https = require('https');
const fs = require('fs');

https.get('https://www.google.com/search?q=chocorramo+ramo&tbm=isch', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9'
  }
}, res => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    fs.writeFileSync('sample_google.html', html);
    console.log('Saved sample_google.html, size:', html.length);
  });
});
