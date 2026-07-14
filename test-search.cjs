const https = require('https');
const http = require('http');

async function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

async function searchAnimeFire(query) {
  const q = encodeURIComponent(query.toLowerCase());
  const html = await fetchHtml(`https://animefire.plus/pesquisar/${q}`);
  
  // Try to find the first anime link in search results
  // <a href="https://animefire.plus/animes/one-piece-todos-os-episodios">
  const match = html.match(/href="(https:\/\/animefire\.plus\/animes\/[^"]+todos-os-episodios)"/i);
  if (match) {
    return match[1];
  }
  return null;
}

searchAnimeFire('One Piece').then(console.log).catch(console.error);
