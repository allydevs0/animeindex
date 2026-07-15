/**
 * extractor.js — AnimeKaiKai! Scraping Engine
 * Suporte a providers: AnimeFire (af), AnimesDigital (ad), MeusAnimes (ma), Goyabu (gy), AnimesOnline (ao)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import { scheduleMongoSave } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR      = path.join(__dirname, 'data');
const INDEX_PATH    = path.join(DATA_DIR, 'index.json.gz');
const ANIMES_DIR    = path.join(DATA_DIR, 'animes');
const RELEASES_PATH = path.join(DATA_DIR, 'releases.json.gz');
const USERS_PATH    = path.join(DATA_DIR, 'users.json.gz');
const SESSIONS_LOG_PATH = path.join(DATA_DIR, 'sessions_log.json.gz');


const PROXY_URL = 'https://black-scene-6407.allydevs0.workers.dev/?url=';

/* ==========================================
   FILESYSTEM HELPERS
========================================== */
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR))   fs.mkdirSync(DATA_DIR,   { recursive: true });
  if (!fs.existsSync(ANIMES_DIR)) fs.mkdirSync(ANIMES_DIR, { recursive: true });
}

function loadJsonGz(filePath, defaultData) {
  const fileKey = path.basename(filePath);
  if (global.MONGO_CACHE && global.MONGO_CACHE.files[fileKey]) {
    return JSON.parse(JSON.stringify(global.MONGO_CACHE.files[fileKey]));
  }
  
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(filePath)).toString('utf-8'));
      if (global.MONGO_CACHE) global.MONGO_CACHE.files[fileKey] = data; // populate cache
      return data;
    } catch {}
  }
  return defaultData;
}

function saveJsonGz(filePath, data) {
  const fileKey = path.basename(filePath);
  
  // Save to Local FS (for development/fallback)
  fs.writeFileSync(filePath, zlib.gzipSync(Buffer.from(JSON.stringify(data))));
  
  // Schedule sync to MongoDB
  scheduleMongoSave(fileKey, data);
}

function loadIndex() {
  ensureDirs();
  const data = loadJsonGz(INDEX_PATH, null);
  if (!data) {
    const empty = { animes: {}, genres: {} };
    saveJsonGz(INDEX_PATH, empty);
    return empty;
  }
  return data;
}

function saveIndex(data) {
  saveJsonGz(INDEX_PATH, data);
}



function loadAnimeFile(slug) {
  return loadJsonGz(path.join(ANIMES_DIR, `${slug}.json.gz`), null);
}

function saveAnimeFile(slug, data) {
  saveJsonGz(path.join(ANIMES_DIR, `${slug}.json.gz`), data);
}

function loadReleases() {
  return loadJsonGz(RELEASES_PATH, []);
}

function saveReleases(releases) {
  saveJsonGz(RELEASES_PATH, releases.slice(0, 300));
}

function loadUsers() {
  return loadJsonGz(USERS_PATH, {});
}

function saveUsers(data) {
  saveJsonGz(USERS_PATH, data);
}

/* Gera um UUID v4 simples sem dependências */
function generateUUID() {
  let d = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* Preferências padrão para novos usuários */
const DEFAULT_PREFERENCES = {
  theme:        'dark',    // 'dark' | 'light'
  language:     'pt-BR',
  videoQuality: 'auto',    // 'auto' | 'hd' | 'sd'
  autoplay:     true,
  notifications: true,
};

function loadSessionsLog() {
  return loadJsonGz(SESSIONS_LOG_PATH, []);
}

function appendSessionLog(entry) {
  const log = loadSessionsLog();
  log.unshift(entry);
  saveJsonGz(SESSIONS_LOG_PATH, log.slice(0, 500));
}


/* ==========================================
   FETCH / REQUEST HELPERS
========================================== */
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
};

async function fetchHtml(url, { timeout = 15000, direct = false } = {}) {
  const targetUrl = direct ? url : PROXY_URL + encodeURIComponent(url);
  try {
    const res = await fetch(targetUrl, {
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } catch (err) {
    if (!direct) {
      // Tenta direto como fallback
      const resDirect = await fetch(url, {
        headers: DEFAULT_HEADERS,
        signal: AbortSignal.timeout(10000),
      });
      if (!resDirect.ok) throw new Error(`HTTP ${resDirect.status} (direct)`);
      return resDirect.text();
    }
    throw err;
  }
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { headers: DEFAULT_HEADERS, signal: AbortSignal.timeout(15000), ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&oacute;/g, 'ó').replace(/&eacute;/g, 'é').replace(/&aacute;/g, 'á')
    .replace(/&iacute;/g, 'í').replace(/&uacute;/g, 'ú').replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ').replace(/&ccedil;/g, 'ç').replace(/&Oacute;/g, 'Ó')
    .replace(/&Eacute;/g, 'É').replace(/&Aacute;/g, 'Á').replace(/&Atilde;/g, 'Ã')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html) {
  return html ? html.replace(/<[^>]+>/g, '').trim() : '';
}

function cleanGenres(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(g => stripTags(g).trim())
    .filter(g => g && g.length > 1 && !/^letra\s+[a-z]$/i.test(g) && !['Legendado','Dublado','Animes'].includes(g))
    .filter((v, i, s) => s.indexOf(v) === i);
}

/* ==========================================
   PROVIDER DETECTION
========================================== */
function detectProvider(url) {
  if (url.includes('animefire'))    return 'af';
  if (url.includes('animesdigital')) return 'ad';
  if (url.includes('meusanimes'))   return 'ma';
  if (url.includes('goyabu'))       return 'gy';
  if (url.includes('animesonline') || url.includes('animesonlinecc')) return 'ao';
  return null;
}

/* ==========================================
   AIRING STATUS DETECTION
========================================== */
function detectAiringStatus(html) {
  return /em\s*exibi[çc][aã]o|em\s*andamento|airing|lançamento\s*semanal|em\s*lançamento|em\s*lancamento/i.test(html);
}

/* ==========================================
   SCRAPERS — EPISODE LISTS
========================================== */

/** AnimeFire */
async function scrapeAnimeFire(url) {
  // Garante URL de todos os episódios
  if (url.includes('/animes/') && !url.endsWith('-todos-os-episodios')) {
    const parts = url.split('/').filter(Boolean);
    const slug = parts[parts.length - 1];
    url = `https://animefire.plus/animes/${slug}-todos-os-episodios`;
  }

  const html = await fetchHtml(url);

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? decodeHtmlEntities(stripTags(titleMatch[1])) : 'Anime';

  const coverMatch = html.match(/property="og:image"\s+content="([^"]+)"/i)
    || html.match(/<img[^>]*class="[^"]*capa[^"]*"[^>]*src="([^"]+)"/i);
  const cover_url = coverMatch ? coverMatch[1].trim() : '';

  const synopsisMatch = html.match(/<div[^>]*class="[^"]*sinopse[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const synopsis = synopsisMatch ? decodeHtmlEntities(stripTags(synopsisMatch[1])) : '';

  const genres = [];
  const genreRegex = /href="https?:\/\/animefire\.[a-z]+\/genero\/([^"]+)"[^>]*>(.*?)<\/a>/gi;
  let gm;
  while ((gm = genreRegex.exec(html)) !== null) genres.push(gm[2]);

  // Episódios — links como /animes/slug/N
  const slugMatch = url.match(/\/animes\/([^/]+)/);
  const animeSlug = slugMatch ? slugMatch[1].replace(/-todos-os-episodios$/, '') : '';
  const episodes = {};

  if (animeSlug) {
    const epRegex = new RegExp(`href="([^"]*\/animes\/${escapeRegExp(animeSlug)}\/([0-9.]+))"`, 'gi');
    let em;
    while ((em = epRegex.exec(html)) !== null) {
      let epUrl = em[1];
      const epNum = em[2];
      if (!epUrl.startsWith('http')) epUrl = 'https://animefire.plus' + epUrl;
      if (!episodes[epNum]) episodes[epNum] = { af: [epUrl, null] };
    }
  }

  const slug = animeSlug || slugify(title);
  const airing = detectAiringStatus(html);

  return { title, slug, cover_url, synopsis, genres: cleanGenres(genres), source_url: url, airing, episodes };
}

/** AnimesDigital */
async function scrapeAnimesDigital(url) {
  if (url.includes('/video/')) {
    const html = await fetchHtml(url);
    const m = html.match(/href="(https:\/\/animesdigital\.org\/anime\/[^"]+)"/);
    if (!m) throw new Error('Página de anime não encontrada no AnimesDigital');
    url = m[1];
  }

  const html = await fetchHtml(url);

  const titleMatch = html.match(/<h1>(.*?)<\/h1>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : 'Anime';

  const coverMatch = html.match(/<div class="poster">\s*<img[^>]+src="([^"]+)"/i);
  const cover_url = coverMatch ? coverMatch[1].trim() : '';

  const synopsisMatch = html.match(/<div class="sinopse">([\s\S]*?)<\/div>/i);
  const synopsis = synopsisMatch ? decodeHtmlEntities(stripTags(synopsisMatch[1])) : '';

  const genres = [];
  const genreRegex = /href="https:\/\/animesdigital\.org\/genero\/([^"]+)"[^>]*>(.*?)<\/a>/gi;
  let gm;
  while ((gm = genreRegex.exec(html)) !== null) genres.push(gm[2]);

  const episodes = {};
  const epRegex = /href="(https:\/\/animesdigital\.org\/video\/[^"]+)"[^>]*>[\s\S]*?<div class="title_anime">([^<]+)<\/div>/gi;
  let em;
  while ((em = epRegex.exec(html)) !== null) {
    const epUrl = em[1];
    const epTitle = em[2].trim();
    const numMatch = epTitle.match(/(?:Episódio|Ep|Episodio)\s*([0-9.]+)/i);
    const epNum = numMatch ? numMatch[1] : epTitle.split(' ').pop();
    if (epNum && !episodes[epNum]) episodes[epNum] = { ad: [epUrl, null] };
  }

  const slug = url.split('/').filter(Boolean).pop() || slugify(title);
  return { title, slug, cover_url, synopsis, genres: cleanGenres(genres), source_url: url, airing: detectAiringStatus(html), episodes };
}

/** MeusAnimes */
async function scrapeMeusAnimes(url) {
  if (url.includes('/e/')) {
    const html = await fetchHtml(url);
    const m = html.match(/href=['"]( https:\/\/meusanimes\.blog\/a\/[^'"]+)['"]/);
    if (!m) throw new Error('Página de anime não encontrada no MeusAnimes');
    url = m[1].trim();
  }

  const html = await fetchHtml(url);

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? decodeHtmlEntities(stripTags(titleMatch[1])) : 'Anime';

  const coverMatch = html.match(/<div class="poster">\s*<img[^>]+src=['"]([^'"]+)['"]/i);
  const cover_url = coverMatch ? coverMatch[1].trim() : '';

  const synopsisMatch = html.match(/<div itemprop="description"[^>]*>([\s\S]*?)<\/div>/i)
    || html.match(/<div class="wp-content">([\s\S]*?)<\/div>/i);
  const synopsis = synopsisMatch ? decodeHtmlEntities(stripTags(synopsisMatch[1])) : '';

  const genres = [];
  const genreRegex = /href=['"]https:\/\/meusanimes\.blog\/(?:genero|g)\/([^'"\/]+)\/?['"][^>]*>(.*?)<\/a>/gi;
  let gm;
  while ((gm = genreRegex.exec(html)) !== null) genres.push(gm[2]);

  const episodes = {};
  const epRegex = /href=['"]( https:\/\/meusanimes\.blog\/e\/[^'"]+)['"]/gi;
  let em;
  while ((em = epRegex.exec(html)) !== null) {
    const epUrl = em[1].trim();
    const numMatch = epUrl.match(/-([0-9.]+)\/?$/);
    const epNum = numMatch ? numMatch[1] : null;
    if (epNum && !episodes[epNum]) episodes[epNum] = { ma: [epUrl, null] };
  }

  const slug = url.endsWith('/') ? url.split('/').slice(-2, -1)[0] : url.split('/').pop();
  return { title, slug, cover_url, synopsis, genres: cleanGenres(genres), source_url: url, airing: detectAiringStatus(html), episodes };
}

/** Goyabu */
async function scrapeGoyabu(url) {
  if (!url.includes('/anime/')) {
    const html = await fetchHtml(url);
    const m = html.match(/href="(https?:\/\/goyabu\.[a-z]+\/anime\/[^"]+)"/i);
    if (m) url = m[1];
  }

  const html = await fetchHtml(url);

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? decodeHtmlEntities(stripTags(titleMatch[1])) : 'Anime';

  const coverMatch = html.match(/property="og:image"\s+content="([^"]+)"/i)
    || html.match(/<div class="capa-anime">[\s\S]*?<img[^>]+src="([^"]+)"/i);
  const cover_url = coverMatch ? coverMatch[1].trim() : '';

  const synopsisMatch = html.match(/<div class="sinopse-anime">([\s\S]*?)<\/div>/i)
    || html.match(/<div[^>]*class="[^"]*synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const synopsis = synopsisMatch ? decodeHtmlEntities(stripTags(synopsisMatch[1])) : '';

  const genres = [];
  const genreRegex = /href="https?:\/\/goyabu\.[a-z]+\/generos\/([^"\/]+)\/?"/gi;
  let gm;
  while ((gm = genreRegex.exec(html)) !== null) genres.push(decodeHtmlEntities(gm[1]));

  const episodes = {};
  // Tenta JSON embutido (allEpisodes)
  const jsonMatch = html.match(/const\s+allEpisodes\s*=\s*(\[[\s\S]*?\]);/);
  if (jsonMatch) {
    try {
      const list = JSON.parse(jsonMatch[1]);
      for (const ep of list) {
        const epNum = String(ep.episodio || ep.numero || ep.ep || '');
        let link = ep.link || ep.url || '';
        if (link.startsWith('/')) link = 'https://goyabu.io' + link;
        if (epNum && link && !episodes[epNum]) episodes[epNum] = { gy: [link, null] };
      }
    } catch {}
  }

  // Fallback: regex de links
  if (Object.keys(episodes).length === 0) {
    const epRegex = /href="(https?:\/\/goyabu\.[a-z]+\/[^"]+\/([0-9]+)[^"]*)"/gi;
    let em;
    while ((em = epRegex.exec(html)) !== null) {
      const epNum = em[2];
      const epUrl = em[1];
      if (epNum && !episodes[epNum]) episodes[epNum] = { gy: [epUrl, null] };
    }
  }

  const slug = url.endsWith('/') ? url.split('/').slice(-2, -1)[0] : url.split('/').pop();
  return { title, slug, cover_url, synopsis, genres: cleanGenres(genres), source_url: url, airing: detectAiringStatus(html), episodes };
}

/** AnimesOnline */
async function scrapeAnimesOnline(url) {
  if (url.includes('/episodio/')) {
    const html = await fetchHtml(url);
    const m = html.match(/href="(https?:\/\/animesonlinecc\.to\/anime\/[^"]+)"/i);
    if (!m) throw new Error('Página de anime não encontrada no AnimesOnline');
    url = m[1];
  }

  const html = await fetchHtml(url);

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? decodeHtmlEntities(stripTags(titleMatch[1])) : 'Anime';

  const coverMatch = html.match(/<div class="poster">\s*<img[^>]+src="([^"]+)"/i)
    || html.match(/property="og:image"\s+content="([^"]+)"/i);
  const cover_url = coverMatch ? coverMatch[1].trim() : '';

  const synopsisMatch = html.match(/<div itemprop="description"[^>]*>([\s\S]*?)<\/div>/i)
    || html.match(/<div class="wp-content">([\s\S]*?)<\/div>/i);
  const synopsis = synopsisMatch ? decodeHtmlEntities(stripTags(synopsisMatch[1])) : '';

  const genres = [];
  const genreRegex = /href="https?:\/\/animesonlinecc\.to\/genero\/([^"\/]+)\/?"/gi;
  let gm;
  while ((gm = genreRegex.exec(html)) !== null) genres.push(decodeHtmlEntities(gm[1].replace(/-/g, ' ')));

  const episodes = {};
  const epRegex = /href="(https?:\/\/animesonlinecc\.to\/episodio\/([^"]+))"/gi;
  let em;
  while ((em = epRegex.exec(html)) !== null) {
    const epUrl = em[1];
    const slug = em[2];
    const numMatch = slug.match(/(?:episodio|episodios)-([0-9.]+)/i);
    const epNum = numMatch ? numMatch[1] : slug.split('-').pop();
    if (epNum && !episodes[epNum]) episodes[epNum] = { ao: [epUrl, null] };
  }

  const slug = url.endsWith('/') ? url.split('/').slice(-2, -1)[0] : url.split('/').pop();
  return { title, slug, cover_url, synopsis, genres: cleanGenres(genres), source_url: url, airing: detectAiringStatus(html), episodes };
}

/* ==========================================
   VIDEO EXTRACTORS — LINKS DIRETOS
========================================== */

/** AnimeFire — download page → mp4 */
async function extractAnimeFire(pageUrl) {
  const downloadUrl = pageUrl.replace('/animes/', '/download/');
  const html = await fetchHtml(downloadUrl);

  const urls = html.match(/https?:\/\/[^\s"'<>]*?(?:lightspeedst\.net|mp4_temp)[^\s"'<>]*/gi) || [];
  let sd = null, hd = null;
  for (let u of urls) {
    u = decodeURIComponent(u);
    if (u.includes('720p') || u.includes('(HD)') || u.includes('hd_temp') || u.includes('/hd/')) hd = u;
    else if (u.includes('480p') || u.includes('(SD)') || u.includes('sd_temp') || u.includes('/sd/')) sd = u;
  }
  if (!hd && urls.length > 0) hd = decodeURIComponent(urls[0]);
  if (!sd && urls.length > 1) sd = decodeURIComponent(urls[1]);

  if (hd || sd) return { type: 'direct', sd, hd };
  return null;
}

/** AnimesDigital — HLS via anivideo */
async function extractAnimesDigital(pageUrl) {
  const html = await fetchHtml(pageUrl);

  const iframeMatch = html.match(/src="https?:\/\/api\.anivideo\.net\/videohls\.php\?d=([^"&]+)/i);
  if (iframeMatch) return { type: 'hls', url: decodeURIComponent(iframeMatch[1]) };

  const m3u8 = html.match(/https?:\/\/[^\s"'<>]+?\.m3u8[^\s"'<>]*/i);
  if (m3u8) return { type: 'hls', url: decodeURIComponent(m3u8[0]) };

  const ifrSrc = html.match(/<iframe[^>]+src="(https?:\/\/[^"]+)"/i);
  if (ifrSrc) return { type: 'iframe', url: ifrSrc[1] };

  return null;
}

/** MeusAnimes — meusdoramas API ou iframe */
async function extractMeusAnimes(pageUrl) {
  const html = await fetchHtml(pageUrl);

  const iframeMatch = html.match(/iframe[^>]+src="([^"]*meusdoramas\.club\/[^"]+)"/i);
  if (iframeMatch) {
    const mdUrl = iframeMatch[1];
    const pathMatch = mdUrl.match(/video\/(\d+)\/(\d+)\/(\d+)/);
    let tmdb, season, episode;
    if (pathMatch) {
      [, tmdb, season, episode] = pathMatch;
    } else {
      try {
        const urlObj = new URL(mdUrl);
        tmdb    = urlObj.searchParams.get('tmdb');
        season  = urlObj.searchParams.get('season_number') || urlObj.searchParams.get('season');
        episode = urlObj.searchParams.get('episode_number') || urlObj.searchParams.get('episode');
      } catch {}
    }
    if (tmdb && season && episode) {
      try {
        const apiUrl = `https://serv01.meusdoramas.club/posts/get-video.php?episode_number=${episode}&season_number=${season}&tmdb=${tmdb}`;
        const json = await fetchJson(apiUrl);
        if (json.success && json.videoUrl) return { type: 'iframe', url: json.videoUrl };
      } catch {}
    }
    return { type: 'iframe', url: mdUrl };
  }

  const m3u8 = html.match(/https?:\/\/[^\s"'<>]+?\.m3u8[^\s"'<>]*/i);
  if (m3u8) return { type: 'hls', url: m3u8[0] };

  return null;
}

/** Goyabu — playersData ou blogger */
async function extractGoyabu(pageUrl) {
  const html = await fetchHtml(pageUrl);

  const playersMatch = html.match(/var\s+playersData\s*=\s*(\[[\s\S]*?\]);/);
  if (playersMatch) {
    try {
      const players = JSON.parse(playersMatch[1]);
      for (const player of players) {
        if (player.select === 'blogger' && player.url) return { type: 'iframe', url: player.url };
        if (player.url_encrypted) {
          const dec = decryptBlogger(player.url_encrypted);
          if (dec) return { type: 'iframe', url: dec };
        }
      }
    } catch {}
  }

  const btnMatch = html.match(/data-blogger-url-encrypted="([^"]+)"/i);
  if (btnMatch) {
    const dec = decryptBlogger(btnMatch[1]);
    if (dec) return { type: 'iframe', url: dec };
  }

  const m3u8 = html.match(/https?:\/\/[^\s"'<>]+?\.m3u8[^\s"'<>]*/i);
  if (m3u8) return { type: 'hls', url: m3u8[0] };

  return null;
}

/** AnimesOnline — blogger token ou HLS */
async function extractAnimesOnline(pageUrl) {
  const html = await fetchHtml(pageUrl);

  const bloggerMatch = html.match(/src="([^"]*blogger\.com\/video\.g[^"]+)"/i);
  if (bloggerMatch) {
    let u = bloggerMatch[1];
    if (u.startsWith('//')) u = 'https:' + u;
    return { type: 'iframe', url: decodeURIComponent(u) };
  }

  const tokenMatch = html.match(/blogger\.com\/video\.g\?token=([^"&]+)/i);
  if (tokenMatch) return { type: 'iframe', url: `https://www.blogger.com/video.g?token=${tokenMatch[1]}` };

  const m3u8 = html.match(/https?:\/\/[^\s"'<>]+?\.m3u8[^\s"'<>]*/i);
  if (m3u8) return { type: 'hls', url: m3u8[0] };

  return null;
}

function decryptBlogger(enc) {
  try {
    if (!enc) return null;
    const decoded = Buffer.from(enc, 'base64').toString('utf8');
    return decoded.split('').reverse().join('');
  } catch { return null; }
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ==========================================
   ADD ANIME TO DB
========================================== */
async function addAnimeToDb(url) {
  const provider = detectProvider(url);
  if (!provider) throw new Error(`Provider não suportado para: ${url}`);

  let scraped;
  if      (provider === 'af') scraped = await scrapeAnimeFire(url);
  else if (provider === 'ad') scraped = await scrapeAnimesDigital(url);
  else if (provider === 'ma') scraped = await scrapeMeusAnimes(url);
  else if (provider === 'gy') scraped = await scrapeGoyabu(url);
  else if (provider === 'ao') scraped = await scrapeAnimesOnline(url);
  else throw new Error(`Scraper não implementado para provider: ${provider}`);

  const { title, slug, cover_url, synopsis, genres, source_url, airing, episodes } = scraped;

  const index   = loadIndex();
  const existing = loadAnimeFile(slug) || {};

  const prevEpisodeKeys = new Set(Object.keys(existing.episodes || {}));
  const mergedEpisodes  = { ...(existing.episodes || {}), ...episodes };

  // Registrar episódios novos no feed de releases
  const newEpKeys = Object.keys(mergedEpisodes).filter(k => !prevEpisodeKeys.has(k));
  if (newEpKeys.length > 0 && newEpKeys.length < 50) {
    const releases = loadReleases();
    const now = new Date().toISOString();
    const newEntries = newEpKeys.map(ep => ({ slug, title, cover_url, episode: ep, addedAt: now }));
    saveReleases([...newEntries, ...releases]);
  }

  const lastEpisodeAddedAt = newEpKeys.length > 0 ? new Date().toISOString() : (existing.lastEpisodeAddedAt || null);

  const animeData = {
    title,
    slug,
    cover_url,
    synopsis: synopsis || existing.synopsis || '',
    genres:   genres.length > 0 ? genres : (existing.genres || []),
    source_url,
    airing,
    episodes: mergedEpisodes,
    lastEpisodeAddedAt,
    lastSyncedAt: new Date().toISOString(),
  };

  saveAnimeFile(slug, animeData);

  index.animes[slug] = {
    title,
    slug,
    cover_url,
    genres:   animeData.genres,
    synopsis: animeData.synopsis.slice(0, 220),
    episodes_count: Object.keys(mergedEpisodes).length || null,
    airing,
    source_url,
    lastEpisodeAddedAt,
    lastSyncedAt: animeData.lastSyncedAt,
  };

  for (const genre of animeData.genres) {
    if (!index.genres[genre]) index.genres[genre] = [];
    if (!index.genres[genre].includes(slug)) index.genres[genre].push(slug);
  }

  saveIndex(index);
  return animeData;
}

/* ==========================================
   BULK IMPORT — Importa catálogo inteiro do Goyabu
========================================== */
async function bulkImportGoyabu(onProgress = null) {
  console.log('[bulk] Iniciando importação do catálogo Goyabu...');
  const index = loadIndex();
  let totalImported = 0;

  const firstPageUrl = 'https://goyabu.io/wp-json/cronos/v1/animes/filter?page=1';
  let totalPages = 1;

  try {
    const firstRes = await fetchJson(firstPageUrl);
    if (firstRes.success && firstRes.animes) {
      totalPages = firstRes.total_pages || 1;
      processGoyabuCatalogPage(firstRes.animes, index);
      totalImported += firstRes.animes.length;
    }
  } catch (err) {
    console.warn('[bulk] Falha na primeira página:', err.message);
    return { success: false, message: `Falha ao acessar catálogo: ${err.message}` };
  }

  const BATCH = 10;
  for (let i = 2; i <= totalPages; i += BATCH) {
    const promises = [];
    for (let j = 0; j < BATCH && (i + j) <= totalPages; j++) {
      const p = i + j;
      const url = `https://goyabu.io/wp-json/cronos/v1/animes/filter?page=${p}`;
      promises.push(
        fetchJson(url)
          .then(d => d.success && d.animes ? d.animes : [])
          .catch(() => [])
      );
    }

    const results = await Promise.all(promises);
    for (const pageAnimes of results) {
      if (pageAnimes.length > 0) {
        processGoyabuCatalogPage(pageAnimes, index);
        totalImported += pageAnimes.length;
      }
    }

    saveIndex(index);
    if (onProgress) onProgress({ page: i, totalPages, totalImported });
    console.log(`[bulk] Páginas ${i}–${Math.min(totalPages, i + BATCH - 1)} importadas (${totalImported} itens)...`);
    await new Promise(r => setTimeout(r, 400));
  }

  saveIndex(index);
  console.log(`[bulk] Importação concluída: ${totalImported} animes registrados.`);
  return { success: true, message: `Catálogo importado! ${totalImported} animes registrados.`, totalImported };
}

function processGoyabuCatalogPage(animes, index) {
  for (const item of animes) {
    if (!item.url) continue;
    const slug = item.url.split('/').filter(Boolean).pop();
    if (!slug) continue;

    if (!index.animes[slug]) {
      index.animes[slug] = {
        title:      decodeHtmlEntities(item.title || ''),
        slug,
        cover_url:  item.image || '',
        synopsis:   `Ano: ${item.year || 'N/A'} | Nota: ${item.rating || 'N/A'} | Áudio: ${item.audio || 'Legendado'}`,
        genres:     ['Goyabu Catálogo'],
        episodes_count: null,
        airing:     false,
        lazy:       true,
        lazyUrl:    item.url,
        source_url: item.url,
        lastSyncedAt: null,
      };

      if (!index.genres['Goyabu Catálogo']) index.genres['Goyabu Catálogo'] = [];
      if (!index.genres['Goyabu Catálogo'].includes(slug)) index.genres['Goyabu Catálogo'].push(slug);
    }
  }
}

/* ==========================================
   BULK IMPORT — AnimeFire (via API JSON)
========================================== */
async function bulkImportAnimeFire(onProgress = null) {
  console.log('[bulk] Iniciando importação do catálogo AnimeFire...');
  const index = loadIndex();
  let totalImported = 0;
  let page = 1;

  while (true) {
    const url = `https://animefire.plus/api/anime/getAll?page=${page}`;
    let data;
    try {
      data = await fetchJson(url);
    } catch (err) {
      console.warn(`[bulk] AnimeFire page ${page} falhou:`, err.message);
      break;
    }

    const animes = data.data || data.animes || data;
    if (!Array.isArray(animes) || animes.length === 0) break;

    for (const item of animes) {
      const rawUrl = item.url || item.link || '';
      if (!rawUrl) continue;
      const slug = rawUrl.split('/').filter(Boolean).pop()?.replace(/-todos-os-episodios$/, '') || '';
      if (!slug) continue;

      if (!index.animes[slug]) {
        index.animes[slug] = {
          title:      decodeHtmlEntities(item.title || item.name || ''),
          slug,
          cover_url:  item.photo || item.cover || item.image || '',
          synopsis:   '',
          genres:     item.genres || [],
          episodes_count: null,
          airing:     false,
          lazy:       true,
          lazyUrl:    rawUrl,
          source_url: rawUrl,
          lastSyncedAt: null,
        };
        totalImported++;
      }
    }

    saveIndex(index);
    if (onProgress) onProgress({ page, totalImported });
    console.log(`[bulk] AnimeFire página ${page} — ${totalImported} itens...`);
    page++;
    await new Promise(r => setTimeout(r, 300));
  }

  saveIndex(index);
  console.log(`[bulk] AnimeFire concluído: ${totalImported} animes.`);
  return { success: true, message: `AnimeFire importado! ${totalImported} animes.`, totalImported };
}

/* ==========================================
   BULK IMPORT: ANIMES ONLINE
========================================== */
async function bulkImportAnimesOnline(onProgress = null) {
  console.log('[bulk] Iniciando importação AnimesOnline via Sitemap...');
  const index = loadIndex();
  let totalImported = 0;
  
  const sitemaps = [
    'https://animesonlinecc.to/tvshows-sitemap1.xml',
    'https://animesonlinecc.to/tvshows-sitemap2.xml'
  ];

  for (const sitemap of sitemaps) {
    try {
      const text = await fetchHtml(sitemap);
      const locRegex = /<loc>(https:\/\/animesonlinecc\.to\/anime\/([^/]+)\/)<\/loc>/g;
      let match;
      while ((match = locRegex.exec(text)) !== null) {
        const rawUrl = match[1];
        const slug = match[2];
        if (!slug || index.animes[slug]) continue;

        index.animes[slug] = {
          title: slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          slug,
          cover_url: '',
          synopsis: '',
          genres: [],
          episodes_count: null,
          airing: false,
          lazy: true,
          lazyUrl: rawUrl,
          source_url: rawUrl,
          lastSyncedAt: null,
        };
        totalImported++;
      }
      saveIndex(index);
      if (onProgress) onProgress({ page: sitemap.split('-').pop(), totalImported });
      console.log(`[bulk] AnimesOnline ${sitemap} — ${totalImported} itens...`);
    } catch (err) {
      console.warn(`[bulk] AnimesOnline sitemap falhou:`, err.message);
    }
  }

  saveIndex(index);
  console.log(`[bulk] AnimesOnline concluído: ${totalImported} animes.`);
  return { success: true, message: `AnimesOnline importado! ${totalImported} animes.`, totalImported };
}

/* ==========================================
   BULK IMPORT: MEUS ANIMES
========================================== */
async function bulkImportMeusAnimes(onProgress = null) {
  console.log('[bulk] Iniciando importação MeusAnimes via Sitemap...');
  const index = loadIndex();
  let totalImported = 0;
  
  const sitemaps = [
    'https://meusanimes.blog/tvshows-sitemap1.xml',
    'https://meusanimes.blog/tvshows-sitemap2.xml'
  ];

  for (const sitemap of sitemaps) {
    try {
      const text = await fetchHtml(sitemap);
      const locRegex = /<loc>(https:\/\/meusanimes\.blog\/anime\/([^/]+)\/)<\/loc>/g;
      let match;
      while ((match = locRegex.exec(text)) !== null) {
        const rawUrl = match[1];
        const slug = match[2];
        if (!slug || index.animes[slug]) continue;

        index.animes[slug] = {
          title: slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          slug,
          cover_url: '',
          synopsis: '',
          genres: [],
          episodes_count: null,
          airing: false,
          lazy: true,
          lazyUrl: rawUrl,
          source_url: rawUrl,
          lastSyncedAt: null,
        };
        totalImported++;
      }
      saveIndex(index);
      if (onProgress) onProgress({ page: sitemap.split('-').pop(), totalImported });
      console.log(`[bulk] MeusAnimes ${sitemap} — ${totalImported} itens...`);
    } catch (err) {
      console.warn(`[bulk] MeusAnimes sitemap falhou:`, err.message);
    }
  }

  saveIndex(index);
  console.log(`[bulk] MeusAnimes concluído: ${totalImported} animes.`);
  return { success: true, message: `MeusAnimes importado! ${totalImported} animes.`, totalImported };
}

/* ==========================================
   GET VIDEO SOURCE
========================================== */
async function getVideoSource(slug, ep) {
  const anime = loadAnimeFile(slug);
  if (!anime) throw new Error(`Anime ${slug} não encontrado`);

  const epData = anime.episodes?.[String(ep)];
  if (!epData) throw new Error(`Episódio ${ep} não encontrado para ${slug}`);

  const ORDER = ['af', 'gy', 'ao', 'ad', 'ma'];
  const providers = [...new Set([...ORDER.filter(p => epData[p]), ...Object.keys(epData)])];

  for (const prov of providers) {
    if (!epData[prov]) continue;
    const [pageUrl, cachedUrl] = epData[prov];

    // Cache hit (exceto AnimeFire — URLs expiram)
    if (cachedUrl && prov !== 'af') {
      const type = cachedUrl.includes('.m3u8') ? 'hls'
                 : cachedUrl.includes('.mp4') || cachedUrl.includes('lightspeedst') ? 'direct'
                 : 'iframe';
      return { type, url: cachedUrl };
    }

    // Extração
    try {
      let result = null;
      if      (prov === 'af') result = await extractAnimeFire(pageUrl);
      else if (prov === 'ad') result = await extractAnimesDigital(pageUrl);
      else if (prov === 'ma') result = await extractMeusAnimes(pageUrl);
      else if (prov === 'gy') result = await extractGoyabu(pageUrl);
      else if (prov === 'ao') result = await extractAnimesOnline(pageUrl);

      if (result) {
        // Cachear URL para proximos requests
        if (prov !== 'af') {
          const cacheVal = result.url || (result.hd || result.sd || null);
          anime.episodes[String(ep)][prov][1] = cacheVal;
          saveAnimeFile(slug, anime);
        }
        return result;
      }
    } catch (err) {
      console.warn(`[extractor] ${prov} falhou para ${slug} EP${ep}:`, err.message);
    }
  }

  throw new Error(`Não foi possível extrair vídeo para ${slug} EP${ep}`);
}

/* ==========================================
   SYNC AIRING ANIMES
========================================== */
async function syncAiringAnimes() {
  console.log('[sync] Iniciando sincronização de animes em exibição...');
  const index = loadIndex();
  const airingAnimes = Object.values(index.animes).filter(a => a.airing && a.source_url && !a.lazy);

  if (airingAnimes.length === 0) {
    console.log('[sync] Nenhum anime em exibição para sincronizar.');
    return { synced: 0, failed: 0 };
  }

  let synced = 0, failed = 0;
  for (const anime of airingAnimes) {
    try {
      console.log(`[sync] Sincronizando: ${anime.title}...`);
      await addAnimeToDb(anime.source_url);
      synced++;
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.warn(`[sync] Falha em ${anime.slug}:`, err.message);
      failed++;
    }
  }
  console.log(`[sync] Concluído: ${synced} atualizados, ${failed} falhas.`);
  return { synced, failed };
}

/* ==========================================
   JIKAN CALENDAR
========================================== */
const JIKAN_CACHE_PATH = path.join(DATA_DIR, 'jikan_cache.json.gz');

async function fetchJikanSchedule(day = null) {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const target = day || days[new Date().getDay()];
  const url = `https://api.jikan.moe/v4/schedules?filter=${target}&limit=25`;

  let res = null;
  // Tentar até 3 vezes com um pequeno atraso, pois o Jikan costuma dar 504 ou 429 aleatórios
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetchJson(url);
      break;
    } catch (err) {
      console.warn(`[jikan] Tentativa ${attempt} falhou:`, err.message);
      if (attempt === 3) break;
      await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
    }
  }

  // Se todas as tentativas falharem, tenta usar o último cache salvo (se houver)
  if (!res || !res.data) {
    console.warn('[jikan] API indisponível, tentando ler cache local...');
    const cache = loadJsonGz(JIKAN_CACHE_PATH, null);
    if (cache && cache.day === target) {
      console.log('[jikan] Cache recuperado com sucesso.');
      return cache.schedule;
    }
    return [];
  }

  try {
    const index = loadIndex();
    let indexUpdated = false;

    const schedule = (res.data || []).map(a => {
      const slug = a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      // Auto-salva no index local caso não exista
      if (!index.animes[slug]) {
        index.animes[slug] = {
          title: a.title,
          title_jp: a.title_japanese,
          slug: slug,
          cover_url: a.images?.jpg?.image_url || '',
          airing: true,
          lazy: true,
          lazyUrl: `https://animefire.plus/animes/${slug}-todos-os-episodios`,
          episodes_count: a.episodes || null,
          genres: []
        };
        indexUpdated = true;
      }

      return {
        mal_id:    a.mal_id,
        title:     a.title,
        title_jp:  a.title_japanese,
        cover_url: a.images?.jpg?.image_url || '',
        episodes:  a.episodes,
        score:     a.score,
        synopsis:  (a.synopsis || '').slice(0, 200),
        url:       a.url,
        day:       target,
        slug:      slug
      };
    });

    if (indexUpdated) saveIndex(index);
    
    // Salva no cache
    saveJsonGz(JIKAN_CACHE_PATH, { day: target, schedule });

    return schedule;
  } catch (err) {
    console.error('[jikan] Erro ao processar calendário:', err);
    return [];
  }
}

/* ==========================================
   EXPORTS
========================================== */
export {
  // DB helpers
  loadIndex,
  saveIndex,
  loadAnimeFile,
  saveAnimeFile,
  loadReleases,
  saveReleases,
  loadUsers,
  saveUsers,
  generateUUID,
  DEFAULT_PREFERENCES,
  loadSessionsLog,
  appendSessionLog,
  // Core
  addAnimeToDb,
  getVideoSource,
  syncAiringAnimes,
  // Bulk import
  bulkImportGoyabu,
  bulkImportAnimeFire,
  // Calendar
  fetchJikanSchedule,
  slugify,
};
