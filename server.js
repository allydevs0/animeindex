/**
 * server.js — AnimeKaiKai! Backend
 * Node.js HTTP server sem Express:
 *  - API REST para o frontend React
 *  - Arquivos estáticos do build Vite (dist/)
 * Port: 5000
 */

import 'dotenv/config';
import http from 'http';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from 'util';
import { initMongoDB } from './db.js';
import {
  loadIndex,
  saveIndex,
  loadAnimeFile,
  loadReleases,
  loadUsers,
  saveUsers,
  addAnimeToDb,
  getVideoSource,
  syncAiringAnimes,
  bulkImportGoyabu,
  bulkImportAnimeFire,
  bulkImportAnimesOnline,
  bulkImportMeusAnimes,
  fetchJikanSchedule,
  generateUUID,
  DEFAULT_PREFERENCES,
  loadSessionsLog,
  appendSessionLog,
  slugify,
} from './extractor.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==========================================
// FILE LOGGER
// ==========================================
const LOG_FILE = path.join(__dirname, 'server.log');

function writeLog(level, args) {
  const msg = format(...args);
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(LOG_FILE, `[${timestamp}] [${level}] ${msg}\n`);
  } catch (e) {}
}

const origLog = console.log, origWarn = console.warn, origErr = console.error;
console.log   = function(...args) { origLog.apply(console, args); writeLog('INFO', args); };
console.warn  = function(...args) { origWarn.apply(console, args); writeLog('WARN', args); };
console.error = function(...args) { origErr.apply(console, args); writeLog('ERROR', args); };

const DIST_DIR  = path.join(__dirname, 'dist');
const PORT      = process.env.PORT || 5000;

/* ==========================================
   MIME TYPES
========================================== */
const MIME = {
  '.html': 'text/html', '.js':   'application/javascript',
  '.jsx':  'application/javascript', '.css':  'text/css',
  '.json': 'application/json',       '.svg':  'image/svg+xml',
  '.png':  'image/png',              '.jpg':  'image/jpeg',
  '.webp': 'image/webp',             '.ico':  'image/x-icon',
  '.woff2':'font/woff2',             '.woff': 'font/woff',
};

/* ==========================================
   RATE LIMITING
========================================== */
const rateMap = new Map();
setInterval(() => rateMap.clear(), 60_000);
function checkRateLimit(ip) {
  const c = (rateMap.get(ip) || 0) + 1;
  rateMap.set(ip, c);
  return c <= 300;
}

/* ==========================================
   SESSIONS
========================================== */
const sessions = new Map();

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const result = {};
  for (const part of raw.split(';')) {
    const [k, ...vs] = part.trim().split('=');
    if (k) result[decodeURIComponent(k)] = decodeURIComponent(vs.join('='));
  }
  return result;
}

function getSessionUser(req) {
  // Verificação de API Key via variável de ambiente do Render
  const authHeader = req.headers.authorization || '';
  const xApiKey = req.headers['x-api-key'] || '';
  const apiKey = process.env.API_KEY;
  
  if (apiKey && (authHeader === `Bearer ${apiKey}` || xApiKey === apiKey)) {
    return 'admin';
  }

  // Fallback para Cookies
  const cookies = parseCookies(req);
  const token = cookies.session;
  if (token && sessions.get(token)) return sessions.get(token);

  // Fallback para header customizado (bypassa bloqueio de cookies em PWAs/iOS)
  const xUser = req.headers['x-user'];
  if (xUser) return xUser;

  return null;
}

function createSession(username) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessions.set(token, username);
  return token;
}

/* ==========================================
   HELPERS
========================================== */
function respond(res, status, data, contentType = 'application/json') {
  const body = contentType === 'application/json' ? JSON.stringify(data) : data;
  const origin = res.req?.headers?.origin;
  const allowed = ['https://animeindex-six.vercel.app', 'http://localhost:5173', 'http://localhost:4173', 'https://animeindex-28ua.onrender.com'];
  const allowOrigin = (origin && allowed.includes(origin)) ? origin : allowed[0];
  
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin':  allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user',
    'Access-Control-Allow-Credentials': 'true'
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 100_000) reject(new Error('Body too large')); });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

/* ==========================================
   STATIC FILE SERVER
========================================== */
function serveStatic(req, res, urlPath) {
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(DIST_DIR)) return respond(res, 403, { error: 'Forbidden' });
  if (!fs.existsSync(filePath)) filePath = path.join(DIST_DIR, 'index.html');

  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'text/plain';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
  });
  res.end(content);
}

/* ==========================================
   BULK IMPORT STATE (Server-Sent Events)
========================================== */
const bulkClients = new Set();
let bulkRunning   = false;
let bulkLastLog   = null;

function broadcastBulk(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of bulkClients) {
    try { res.write(msg); } catch {}
  }
  bulkLastLog = data;
}

/* ==========================================
   HTTP SERVER
========================================== */
const server = http.createServer(async (req, res) => {
  const ip       = req.socket.remoteAddress || '';
  const url      = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = url.pathname.replace(/\/+/g, '/');
  const method   = req.method;

  // Debug log para ver de onde vêm as requests
  if (pathname.startsWith('/api/')) {
    console.log(`[DEBUG] ${method} ${pathname} | IP: ${ip} | Origin: ${req.headers.origin || 'Nenhum'} | User-Agent: ${req.headers['user-agent']?.substring(0, 50)}`);
  }

  if (!checkRateLimit(ip)) return respond(res, 429, { error: 'Too many requests' });

  if (method === 'OPTIONS') {
    const origin = req.headers.origin;
    const allowed = ['https://animeindex-six.vercel.app', 'http://localhost:5173', 'http://localhost:4173', 'https://animeindex-28ua.onrender.com'];
    const allowOrigin = (origin && allowed.includes(origin)) ? origin : allowed[0];
    
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  allowOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end();
    return;
  }

  if (!pathname.startsWith('/api/')) {
    if (fs.existsSync(DIST_DIR)) {
      try { serveStatic(req, res, pathname); } catch (err) { respond(res, 500, { error: err.message }); }
    } else {
      respond(res, 200, { message: 'AnimeKaiKai! API — rode npm run dev para o frontend.' });
    }
    return;
  }

  // Security: Block unauthorized origins
  const origin = req.headers.origin;
  const allowedOrigins = ['https://animeindex-six.vercel.app', 'http://localhost:5173', 'http://localhost:4173', 'https://animeindex-28ua.onrender.com'];
  if (origin && !allowedOrigins.includes(origin)) {
    return respond(res, 403, { error: 'Forbidden: Origin not allowed' });
  }

  // =====================
  //  API ROUTES
  // =====================
  const segment = pathname.replace('/api/', '');
  const username = getSessionUser(req);

  // ─── GET /api/ping ─────────────────────────────────────────────────
  if (segment === 'ping' && method === 'GET') {
    return respond(res, 200, { ok: true, time: new Date().toISOString() });
  }

  // ─── GET /api/users ────────────────────────────────────────────────
  if (segment === 'users' && method === 'GET') {
    const users = loadUsers();
    return respond(res, 200, Object.values(users).map(u => ({
      name:   u.name,
      avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`,
    })));
  }


  // ─── POST /api/login ───────────────────────────────────────────────
  if (segment === 'login' && method === 'POST') {
    const body = await parseBody(req);
    const name = (body.username || '').trim().slice(0, 32);
    if (!name) return respond(res, 400, { error: 'Username obrigatório' });

    const users = loadUsers();
    const isNew = !users[name];

    if (isNew) {
      // Novo usuário: gera sessionId permanente (UUID v4)
      users[name] = {
        name,
        sessionId:   generateUUID(),
        avatar:      `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        createdAt:   new Date().toISOString(),
        history:     {},
        preferences: { ...DEFAULT_PREFERENCES },
      };
    } else if (!users[name].sessionId) {
      // Migra usuário antigo: atribui sessionId retroativamente
      users[name].sessionId = generateUUID();
      users[name].createdAt = users[name].createdAt || new Date().toISOString();
      if (!users[name].preferences) users[name].preferences = { ...DEFAULT_PREFERENCES };
    }

    // Registra entrada no log de sessões
    appendSessionLog({
      sessionId:  users[name].sessionId,
      username:   name,
      loginAt:    new Date().toISOString(),
      ip:         ip,
      userAgent:  req.headers['user-agent'] || '',
    });

    users[name].lastLoginAt = new Date().toISOString();
    saveUsers(users);

    const token   = createSession(name);
    const expires = new Date(Date.now() + 30 * 24 * 3600_000).toUTCString();
    res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; HttpOnly; Path=/; Expires=${expires}; SameSite=None; Secure`);
    return respond(res, 200, {
      user: {
        name:        users[name].name,
        sessionId:   users[name].sessionId,
        avatar:      users[name].avatar,
        createdAt:   users[name].createdAt,
        lastLoginAt: users[name].lastLoginAt,
        preferences: users[name].preferences,
        isNew,
      }
    });
  }


  // ─── GET /api/animes ───────────────────────────────────────────────
  if (segment === 'animes' && method === 'GET') {
    const index = loadIndex();
    return respond(res, 200, index.animes);
  }

  // ─── GET /api/genres ───────────────────────────────────────────────
  if (segment === 'genres' && method === 'GET') {
    const index = loadIndex();
    return respond(res, 200, index.genres);
  }

  // ─── GET /api/releases ─────────────────────────────────────────────
  if (segment === 'releases' && method === 'GET') {
    const releases = loadReleases();
    return respond(res, 200, [...releases].sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    ));
  }

  // ─── GET /api/airing ───────────────────────────────────────────────
  if (segment === 'airing' && method === 'GET') {
    const index = loadIndex();
    const TWENTY_FOUR = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const result = Object.values(index.animes)
      .filter(a => a.airing && !a.lazy)
      .map(a => ({
        ...a,
        hasNewEpisode: a.lastEpisodeAddedAt
          ? (now - new Date(a.lastEpisodeAddedAt).getTime()) < TWENTY_FOUR
          : false,
      }))
      .sort((a, b) => {
        if (a.hasNewEpisode !== b.hasNewEpisode) return b.hasNewEpisode ? 1 : -1;
        return (new Date(b.lastEpisodeAddedAt || 0).getTime()) - (new Date(a.lastEpisodeAddedAt || 0).getTime());
      });
    return respond(res, 200, result);
  }

  // ─── GET /api/anime/:slug/related ─────────────────────────────────
  // Retorna todas as temporadas relacionadas a um anime ordenadas cronologicamente
  if (segment.match(/^anime\/(.+)\/related$/) && method === 'GET') {
    const slug = segment.match(/^anime\/(.+)\/related$/)[1];
    const index = loadIndex();
    const allSlugs = Object.keys(index.animes);

    // Detecta se é dublado olhando em qualquer posição do slug ou título
    function checkIsDub(s, entry) {
      return s.includes('-dublado') || (entry?.title || '').toLowerCase().includes('dublado');
    }

    // Normaliza slug removendo sufixos de dublado, temporada, parte, etc.
    function normalizeSlug(s) {
      return s
        .replace(/-dublado/g, '')              // remove "dublado" de qualquer posição
        .replace(/-(todos-os-episodios)$/, '')
        .replace(/-(completo|completa)$/, '')
        .replace(/-(movie|filme|especial|ova|ona)$/, '')
        .replace(/-(cour|part|parte)-?\d+$/i, '')
        .replace(/-(season|temporada)-?\d+$/i, '')
        .replace(/-\d+(nd|rd|th|st)-season$/i, '') // "2nd-season"
        .replace(/-2$|-3$|-4$|-5$|-6$/, '')         // sufixos numéricos simples
        .replace(/-ii$|-iii$|-iv$|-v$/, '')          // algarismos romanos simples
        .replace(/-s\d+$/, '')                       // -s2, -s3
        .replace(/-+$/, '')                          // hífens sobrando no final
        .trim();
    }

    const baseEntry = index.animes[slug];
    const baseNorm = normalizeSlug(slug);
    const isDub = checkIsDub(slug, baseEntry);

    // Encontra todos os slugs com a mesma base normalizada e mesmo tipo (dub/leg)
    const related = allSlugs.filter(s => {
      if (s === slug) return false;
      const sEntry = index.animes[s];
      const sIsDub = checkIsDub(s, sEntry);
      if (sIsDub !== isDub) return false;
      const sNorm = normalizeSlug(s);
      // Aceita se a base normalizada for idêntica, ou se um for prefixo do outro
      return sNorm === baseNorm || sNorm.startsWith(baseNorm) || baseNorm.startsWith(sNorm);
    });

    // Ordenação fallback caso o ano falhe (mesmo que antes)
    function seasonOrder(s) {
      const clean = s.replace(/-dublado/g, '');
      const m = clean.match(/-(\d+)$/) || clean.match(/-(ii|iii|iv|v)$/i);
      if (!m) return 1;
      const roman = { ii:2, iii:3, iv:4, v:5 };
      return roman[m[1]?.toLowerCase()] || parseInt(m[1]) || 99;
    }

    const baseRawTitle = (baseEntry?.title || '').replace(/\s*[–-]?\s*dublado\s*/gi, '').trim();
    const seasonsList = [slug, ...related];
    let updatedIndex = false;

    // Busca preguiçosa do ano de lançamento no Anilist para cada temporada relacionada
    await Promise.all(seasonsList.map(async (s) => {
      const entry = index.animes[s];
      if (entry && !entry.year) {
        try {
          const cleanTitle = (entry.title || s).replace(/\s*[–-]?\s*dublado\s*/gi, '').trim();
          const q = `query($search: String) { Media(search: $search, type: ANIME, sort: SEARCH_MATCH) { startDate { year } } }`;
          const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, variables: { search: cleanTitle } })
          });
          const json = await res.json();
          const yr = json?.data?.Media?.startDate?.year;
          if (yr) {
            entry.year = yr;
            updatedIndex = true;
          } else {
            entry.year = 'Desconhecido';
            updatedIndex = true;
          }
        } catch (e) { }
      }
    }));

    if (updatedIndex) saveIndex(index);

    // Monta resposta com título usando o ANO como cronologia principal
    const seasons = seasonsList.sort((a, b) => {
      const yearA = parseInt(index.animes[a]?.year) || 9999;
      const yearB = parseInt(index.animes[b]?.year) || 9999;
      if (yearA !== yearB) return yearA - yearB;
      return seasonOrder(a) - seasonOrder(b);
    }).map(s => {
      const entry = index.animes[s];
      const rawTitle = entry?.title || s;
      let displayTitle = rawTitle.replace(/\s*[–-]?\s*dublado\s*/gi, '').trim();
      
      // Remove o prefixo comum com o título base para evitar redundância na UI
      function stripPunct(str) { return str.replace(/[^\w\sÀ-ÿ]/g, '').toLowerCase(); }
      const baseWords = baseRawTitle.split(/\s+/);
      const titleWords = displayTitle.split(/\s+/);
      
      let matchCount = 0;
      for (let i = 0; i < baseWords.length && i < titleWords.length; i++) {
        if (stripPunct(baseWords[i]) === stripPunct(titleWords[i])) matchCount++;
        else break;
      }

      let remainder = displayTitle;
      if (matchCount > 0) {
        remainder = titleWords.slice(matchCount).join(' ').replace(/^[:\-]+/, '').trim();
      }
      
      // Se tiver ano, formata como: "2023 - Parte 2" ou "2021"
      const yr = parseInt(entry?.year);
      if (yr) {
         if (!remainder || remainder.toLowerCase() === baseRawTitle.toLowerCase()) displayTitle = `${yr}`;
         else displayTitle = `${yr} - ${remainder}`;
      } else {
         if (!remainder) displayTitle = `Temporada ${seasonOrder(s)}`;
         else displayTitle = remainder;
      }

      return {
        slug: s,
        title: displayTitle,
        raw_title: rawTitle,
        cover_url: entry?.cover_url || '',
        episodes_count: entry?.episodes_count || null,
        year: yr || null,
        season_order: seasonOrder(s),
        is_current: s === slug,
      };
    });

    return respond(res, 200, { slug, seasons });

  }

  // ─── GET /api/anime/:slug ──────────────────────────────────────────
  if (segment.startsWith('anime/') && method === 'GET') {
    const slug = segment.replace('anime/', '');
    let animeData = loadAnimeFile(slug);

    if (!animeData) {
      const index = loadIndex();
      const entry = index.animes[slug];
      if (entry) {
        // Se existe no index mas o arquivo sumiu ou é lazy, tenta baixar na hora
        const targetUrl = entry.lazyUrl || entry.source_url || `https://animefire.plus/animes/${slug}-todos-os-episodios`;
        try {
          animeData = await addAnimeToDb(targetUrl);
        } catch (err) {
          // Se falhou com o título principal e tiver título em JP, tenta raspar usando o japonês
          if (entry.title_jp) {
            const jpSlug = slugify(entry.title_jp);
            const jpUrl = `https://animefire.plus/animes/${jpSlug}-todos-os-episodios`;
            try {
              console.log(`[fallback] Titulo normal falhou. Tentando titulo JP: ${jpUrl}`);
              animeData = await addAnimeToDb(jpUrl);
              
              // Otimização: se o JP deu certo, atualiza o lazyUrl do título original para bater no JP direto na próxima
              const idx = loadIndex();
              if (idx.animes[slug]) {
                idx.animes[slug].lazyUrl = jpUrl;
                saveIndex(idx);
              }
            } catch (err2) {
              return respond(res, 500, { error: `Falha ao extrair detalhes (ambos os titulos falharam)` });
            }
          } else {
            return respond(res, 500, { error: `Falha ao extrair detalhes (lazy/fallback): ${err.message}` });
          }
        }
      } else {
        return respond(res, 404, { error: 'Anime não encontrado no banco de dados' });
      }
    }

    return respond(res, 200, animeData);
  }

  // ─── GET /api/source/:slug/:ep ─────────────────────────────────────
  if (segment.startsWith('source/') && method === 'GET') {
    if (!username) return respond(res, 401, { error: 'Login necessário' });
    const parts = segment.replace('source/', '').split('/');
    const ep    = parts.pop();
    const slug  = parts.join('/');
    try {
      const result = await getVideoSource(slug, ep);
      return respond(res, 200, result);
    } catch (err) {
      return respond(res, 500, { error: err.message });
    }
  }

  // ─── POST /api/history ─────────────────────────────────────────────
  if (segment === 'history' && method === 'POST') {
    if (!username) return respond(res, 401, { error: 'Login necessário' });
    const body = await parseBody(req);
    const { slug, ep, time, duration, title, cover_url } = body;
    if (!slug || !ep) return respond(res, 400, { error: 'slug e ep obrigatórios' });
    const users = loadUsers();
    if (!users[username]) return respond(res, 404, { error: 'Usuário não encontrado' });
    if (!users[username].history) users[username].history = {};
    
    const existing = users[username].history[slug] || { episodes: {} };
    const isFinished = duration > 0 && (time / duration) >= 0.9;

    users[username].history[slug] = { 
      ...existing,
      ep: String(ep), time: time || 0, duration: duration || 0, title: title || slug, cover_url: cover_url || '', last_watched: Date.now(),
      episodes: {
        ...(existing.episodes || {}),
        [String(ep)]: { time: time || 0, duration: duration || 0, finished: isFinished }
      }
    };
    saveUsers(users);
    return respond(res, 200, { ok: true });
  }

  // ─── GET /api/history ──────────────────────────────────────────────
  if (segment === 'history' && method === 'GET') {
    if (!username) return respond(res, 401, { error: 'Login necessário' });
    const users = loadUsers();
    return respond(res, 200, users[username]?.history || {});
  }

  // ─── GET /api/preferences ──────────────────────────────────────────
  if (segment === 'preferences' && method === 'GET') {
    if (!username) return respond(res, 401, { error: 'Login necessário' });
    const users = loadUsers();
    const prefs = users[username]?.preferences || { ...DEFAULT_PREFERENCES };
    return respond(res, 200, prefs);
  }

  // ─── POST /api/preferences ─────────────────────────────────────────
  if (segment === 'preferences' && method === 'POST') {
    if (!username) return respond(res, 401, { error: 'Login necessário' });
    const body = await parseBody(req);
    const users = loadUsers();
    if (!users[username]) return respond(res, 404, { error: 'Usuário não encontrado' });

    // Mescla só campos permitidos (whitelist)
    const allowed = ['theme', 'language', 'videoQuality', 'autoplay', 'notifications'];
    const current = users[username].preferences || { ...DEFAULT_PREFERENCES };
    for (const key of allowed) {
      if (body[key] !== undefined) current[key] = body[key];
    }
    users[username].preferences = current;
    users[username].prefsUpdatedAt = new Date().toISOString();
    saveUsers(users);

    return respond(res, 200, { ok: true, preferences: current });
  }

  // ─── GET /api/sessions-log ─────────────────────────────────────────
  // Apenas admin (primeiro usuário criado) pode ver
  if (segment === 'sessions-log' && method === 'GET') {
    if (!username) return respond(res, 401, { error: 'Login necessário' });
    const users = loadUsers();
    const allUsers = Object.values(users);
    // Primeiro usuário por data de criação é o admin
    const admin = allUsers.sort((a, b) =>
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    )[0];
    if (!admin || admin.name !== username) {
      return respond(res, 403, { error: 'Acesso restrito ao administrador' });
    }
    const log = loadSessionsLog();
    return respond(res, 200, log);
  }

  // ─── POST /api/index — Indexar anime por URL ───────────────────────

  if (segment === 'index' && method === 'POST') {
    if (!username) return respond(res, 401, { error: 'Login necessário' });
    const body = await parseBody(req);
    const { url } = body;
    if (!url) return respond(res, 400, { error: 'URL obrigatória' });
    try {
      const animeData = await addAnimeToDb(url);
      return respond(res, 200, { title: animeData.title, slug: animeData.slug, episodes: Object.keys(animeData.episodes).length });
    } catch (err) {
      return respond(res, 500, { error: err.message });
    }
  }

  // ─── POST /api/sync — Forçar sync manual ───────────────────────────
  if (segment === 'sync' && method === 'POST') {
    if (!username) return respond(res, 401, { error: 'Login necessário' });
    syncAiringAnimes().catch(console.warn);
    return respond(res, 200, { ok: true, message: 'Sync iniciado em background' });
  }

  // ─── POST /api/bulk — Importar catálogo completo ───────────────────
  if (segment === 'bulk' && method === 'POST') {
    if (!username) return respond(res, 401, { error: 'Login necessário' });
    if (bulkRunning) return respond(res, 409, { error: 'Importação já em andamento' });
    const body = await parseBody(req);
    const source = body.source || 'goyabu'; // 'goyabu' | 'animefire' | 'all'

    bulkRunning = true;
    
    if (source === 'all') {
      const afRes = await bulkImportAnimeFire(progress => broadcastBulk({ type: 'progress', source: 'AnimeFire', ...progress }));
      const gyRes = await bulkImportGoyabu(progress => broadcastBulk({ type: 'progress', source: 'Goyabu', ...progress }));
      const aoRes = await bulkImportAnimesOnline(progress => broadcastBulk({ type: 'progress', source: 'AnimesOnline', ...progress }));
      const maRes = await bulkImportMeusAnimes(progress => broadcastBulk({ type: 'progress', source: 'MeusAnimes', ...progress }));
        
      broadcastBulk({ type: 'success', message: `Todas as fontes importadas (AF: ${afRes.totalImported}, GY: ${gyRes.totalImported}, AO: ${aoRes.totalImported}, MA: ${maRes.totalImported}).` });
      bulkRunning = false;
      return respond(res, 200, { success: true, message: 'Todas as fontes importadas!' });
    }

    let importFn;
    if (source === 'animefire') importFn = bulkImportAnimeFire;
    else if (source === 'animesonline') importFn = bulkImportAnimesOnline;
    else if (source === 'meusanimes') importFn = bulkImportMeusAnimes;
    else importFn = bulkImportGoyabu; // default fallback

    importFn(progress => broadcastBulk({ type: 'progress', ...progress }))
      .then(result => {
        broadcastBulk({ type: 'done', ...result });
        bulkRunning = false;
      })
      .catch(err => {
        broadcastBulk({ type: 'error', message: err.message });
          bulkRunning = false;
        });

    return respond(res, 200, { ok: true, message: `Importação de ${source} iniciada. Acompanhe em /api/bulk/stream` });
  }

  // ─── GET /api/bulk/stream — SSE do progresso de bulk ──────────────
  if (segment === 'bulk/stream' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type':                'text/event-stream',
      'Cache-Control':               'no-cache',
      'Connection':                  'keep-alive',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', running: bulkRunning, lastLog: bulkLastLog })}\n\n`);
    bulkClients.add(res);
    req.on('close', () => bulkClients.delete(res));
    return;
  }

  // ─── GET /api/bulk/status ──────────────────────────────────────────
  if (segment === 'bulk/status' && method === 'GET') {
    return respond(res, 200, { running: bulkRunning, lastLog: bulkLastLog });
  }

  // ─── GET /api/calendar ─────────────────────────────────────────────
  if (segment.startsWith('calendar') && method === 'GET') {
    const day = url.searchParams.get('day') || null;
    try {
      const cal = await fetchJikanSchedule(day);
      return respond(res, 200, cal);
    } catch (err) {
      return respond(res, 500, { error: 'Falha ao buscar calendário: ' + err.message });
    }
  }

  // ─── GET /api/stats ────────────────────────────────────────────────
  if (segment === 'stats' && method === 'GET') {
    const index    = loadIndex();
    const releases = loadReleases();
    const total    = Object.keys(index.animes).length;
    const airing   = Object.values(index.animes).filter(a => a.airing).length;
    const lazy     = Object.values(index.animes).filter(a => a.lazy).length;
    const genres   = Object.keys(index.genres).length;
    return respond(res, 200, { total, airing, lazy, genres, releases: releases.length });
  }

  // ⚡ GET /api/debug/mongo ⚡
  if (segment === 'debug/mongo' && method === 'GET') {
    return respond(res, 200, {
      hasGlobalMongoCache: !!global.MONGO_CACHE,
      filesInCache: global.MONGO_CACHE ? Object.keys(global.MONGO_CACHE.files) : [],
      mongoUrlPrefix: process.env.MONGO_URL ? process.env.MONGO_URL.substring(0, 15) + '...' : 'NOT_SET'
    });
  }

  return respond(res, 404, { error: 'Rota não encontrada' });
});



/* ==========================================
   BACKGROUND JOBS
========================================== */
initMongoDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🎌 AnimeKaiKai! API em http://localhost:${PORT}`);
    console.log('   Endpoints: /api/animes, /api/index, /api/bulk, /api/sync, /api/calendar\n');

    // Sync automático a cada 1 hora
    setTimeout(() => {
      syncAiringAnimes().catch(console.warn);
      setInterval(() => syncAiringAnimes().catch(console.warn), 60 * 60 * 1000);
    }, 10_000);
  });
});

export default server;
