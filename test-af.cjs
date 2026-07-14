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

async function extractAnimeFire(pageUrl) {
  const downloadUrl = pageUrl.replace('/animes/', '/download/');
  console.log('Downloading from:', downloadUrl);
  const html = await fetchHtml(downloadUrl);
  console.log('HTML size:', html.length);
  
  const urls = html.match(/https?:\/\/[^\s\"\'<>]+?(?:lightspeedst\.net|mp4_temp)[^\s\"\'<>]*/gi) || [];
  let sd = null, hd = null;
  for (let u of urls) {
    u = decodeURIComponent(u);
    if (u.includes('720p') || u.includes('(HD)') || u.includes('hd_temp')) hd = u;
    else if (u.includes('480p') || u.includes('(SD)') || u.includes('sd_temp')) sd = u;
  }
  if (!hd && urls.length > 0) hd = decodeURIComponent(urls[0]);
  if (!sd && urls.length > 1) sd = decodeURIComponent(urls[1]);

  if (hd || sd) return { type: 'direct', sd, hd };
  return null;
}

extractAnimeFire('https://animefire.plus/animes/tenkou-saki-no-seiso-karen-na-bishoujo-ga-mukashi-danshi-to-omotte-issho-ni-asonda-osananajimi-datta-ken/1')
  .then(console.log)
  .catch(err => console.error(err.message));
