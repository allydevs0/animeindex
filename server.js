/**
 * server.js — AnimeKaiKai! Backend
 * Node.js HTTP server sem Express:
 *  - API REST para o frontend React
 *  - Arquivos estáticos do build Vite (dist/)
 * Port: 5000
 */

import http from 'http';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from 'util';
import {
  loadIndex,
  loadAnimeFile,
  loadReleases,
  loadUsers,
  saveUsers,
  addAnimeToDb,
  getVideoSource,
  syncAiringAnimes,
  bulkImportGoyabu,
  bulkImportAnimeFire,
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
  const cookies = parseCookies(req);
  const token = cookies.session;
  return token ? sessions.get(token) : null;
}

function createSession(username) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessions.set(token, username);
  return token;
}

/* ==========================================
   HELPERS
========================================== */
function respond(res, status, data, contentType = 'application/json', req = null) {
  const body = contentType === 'application/json' ? JSON.stringify(data) : data;
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin':  req ? (req.headers.origin || '*') : '*',
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
  if (!filePath.startsWith(DIST_DIR)) return respond(res, 403, { error: 'Forbidden' }, 'application/json', req);
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

  if (!checkRateLimit(ip)) return respond(res, 429, { error: 'Too many requests' }, 'application/json', req);

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end();
    return;
  }

  if (!pathname.startsWith('/api/')) {
    if (fs.existsSync(DIST_DIR)) {
      try { serveStatic(req, res, pathname); } catch (err) { respond(res, 500, { error: err.message }, 'application/json', req); }
    } else {
      respond(res, 200, { message: 'AnimeKaiKai! API — rode npm run dev para o frontend.' });
    }
    return;
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
    res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; HttpOnly; Path=/; Expires=${expires}`);
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
    users[username].history[slug] = { ep: String(ep), time: time || 0, duration: duration || 0, title: title || slug, cover_url: cover_url || '', last_watched: Date.now() };
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
      try {
        const afRes = await bulkImportAnimeFire(progress => broadcastBulk({ type: 'progress', source: 'AnimeFire', ...progress }));
        const gyRes = await bulkImportGoyabu(progress => broadcastBulk({ type: 'progress', source: 'Goyabu', ...progress }));
        broadcastBulk({ type: 'done', message: `Importação de todas as fontes concluída! AF: ${afRes.imported}, GY: ${gyRes.imported}` });
      } catch (err) {
        broadcastBulk({ type: 'error', message: err.message });
      } finally {
        bulkRunning = false;
      }
    } else {
      const importFn = source === 'animefire' ? bulkImportAnimeFire : bulkImportGoyabu;
      importFn(progress => broadcastBulk({ type: 'progress', ...progress }))
        .then(result => {
          broadcastBulk({ type: 'done', ...result });
          bulkRunning = false;
        })
        .catch(err => {
          broadcastBulk({ type: 'error', message: err.message });
          bulkRunning = false;
        });
    }

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

  return respond(res, 404, { error: 'Rota não encontrada' });
});

/* ==========================================
   BACKGROUND JOBS
========================================== */
server.listen(PORT, () => {
  console.log(`\n🎌 AnimeKaiKai! API em http://localhost:${PORT}`);
  console.log('   Endpoints: /api/animes, /api/index, /api/bulk, /api/sync, /api/calendar\n');

  // Sync automático a cada 1 hora
  setTimeout(() => {
    syncAiringAnimes().catch(console.warn);
    setInterval(() => syncAiringAnimes().catch(console.warn), 60 * 60 * 1000);
  }, 10_000);
});

export default server;
