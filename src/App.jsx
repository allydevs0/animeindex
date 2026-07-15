import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AnimeCard from './components/AnimeCard.jsx';
import LatestEpisodes from './components/LatestEpisodes.jsx';
import AiringSection from './components/AiringSection.jsx';
import VideoPlayer from './components/VideoPlayer.jsx';

let BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
if (BACKEND_URL.endsWith('/')) BACKEND_URL = BACKEND_URL.slice(0, -1);
const apiFetch = (url, options = {}) => {
  const user = localStorage.getItem('animekaikai_last_user');
  const headers = { ...options.headers };
  if (user) headers['x-user'] = user;
  
  return fetch(BACKEND_URL + url, {
    ...options,
    headers,
    credentials: 'include'
  });
};

/* =====================
   VIEWS
===================== */
const VIEW_HOME   = 'home';
const VIEW_DETAIL = 'detail';
const VIEW_PLAYER = 'player';
const VIEW_ADMIN  = 'admin';

/* =====================
   HELPERS
===================== */
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'agora';
  if (mins < 60) return `${mins}min`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

function progressPct(h) {
  if (!h || !h.duration || h.duration === 0) return 0;
  return Math.min(100, (h.time / h.duration) * 100);
}

function formatTime(secs) {
  if (!secs) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/* =====================
   APP
===================== */
export default function App() {
  // Auth
  const [users, setUsers]               = useState([]);
  const [currentUser, setCurrentUser]   = useState(() => {
    const last = localStorage.getItem('animekaikai_last_user');
    return last ? { name: last } : null;
  });
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [newUsername, setNewUsername]   = useState('');

  // Data
  const [animes, setAnimes]             = useState([]);
  const [genres, setGenres]             = useState({});
  const [schedule, setSchedule]           = useState([]);
  const [airingAnimes, setAiringAnimes] = useState([]);
  const [history, setHistory]           = useState({});
  const [stats, setStats]               = useState(null);

  // Preferências do usuário
  const [preferences, setPreferences]   = useState({
    theme: 'dark', language: 'pt-BR', videoQuality: 'auto', autoplay: true, notifications: true,
  });

  // Navigation
  const [view, setView]                 = useState(VIEW_HOME);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [animeDetail, setAnimeDetail]   = useState(null);
  const [relatedSeasons, setRelatedSeasons] = useState([]); // temporadas relacionadas
  const [playerSlug, setPlayerSlug]     = useState(null);
  const [playerEp, setPlayerEp]         = useState(null);
  const [videoSrc, setVideoSrc]         = useState(null);
  const [videoType, setVideoType]       = useState('video');

  // Filters
  const [activeGenre, setActiveGenre]   = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');
  const [visibleCount, setVisibleCount] = useState(50);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(50);
  }, [activeGenre, searchQuery]);

  // Loading / status
  const [loading, setLoading]           = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [toasts, setToasts]             = useState([]);


  // Admin state
  const [adminUrl, setAdminUrl]         = useState('');
  const [adminStatus, setAdminStatus]   = useState(null);
  const [bulkSource, setBulkSource]     = useState('goyabu');
  const [bulkRunning, setBulkRunning]   = useState(false);
  const [bulkLog, setBulkLog]           = useState([]);
  const [syncRunning, setSyncRunning]   = useState(false);
  const sseRef = useRef(null);

  /* =====================
     TOAST
  ===================== */
  const toast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  /* =====================
     FETCH DATA
  ===================== */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [animesRes, genresRes, releasesRes, airingRes] = await Promise.all([
        apiFetch('/api/animes'),
        apiFetch('/api/genres'),
        apiFetch('/api/calendar').catch(() => ({ json: () => Promise.resolve([]) })),
        apiFetch('/api/airing').catch(() =>   ({ json: () => Promise.resolve([]) })),
      ]);

      if (!animesRes.ok || !genresRes.ok) throw new Error('Falha ao buscar dados');

      const animesData   = await animesRes.json();
      const genresData   = await genresRes.json();
      const scheduleData = await releasesRes.json().catch(() => []);
      const airingData   = await airingRes.json().catch(() => []);

      setAnimes(Object.values(animesData));
      setGenres(genresData);
      setSchedule(scheduleData);
      setAiringAnimes(Array.isArray(airingData) ? airingData : []);
    } catch (err) {
      toast('Erro ao carregar animes: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/stats');
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await apiFetch('/api/history');
      if (res.ok) setHistory(await res.json() || {});
    } catch {}
  }, [currentUser]);

  /* =====================
     USERS
  ===================== */
  const loginUser = useCallback(async (username, silent = false) => {
    try {
      const res = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        const data = await res.json();
        const user = data.user || { name: username };
        setCurrentUser(user);
        setShowUserSelector(false);
        localStorage.setItem('animekaikai_last_user', user.name);

        // Aplica preferências salvas
        if (user.preferences) {
          setPreferences(user.preferences);
          applyTheme(user.preferences.theme || 'dark');
        }

        if (!silent) {
          toast(
            user.isNew
              ? `Bem-vindo, ${username}! Conta criada 🎉`
              : `Bem-vindo de volta, ${username}! 👋`,
            'success'
          );
        }
      }
    } catch {
      toast('Erro ao fazer login', 'error');
    }
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const usersData = await res.json();
        setUsers(usersData);
        
        // Auto-login se houver usuário salvo no localStorage (silencioso)
        const lastUser = localStorage.getItem('animekaikai_last_user');
        if (lastUser) {
          // Pequeno delay para evitar loop de estado
          setTimeout(() => loginUser(lastUser, true), 100);
        } else {
          setShowUserSelector(true);
        }
      }
    } catch {}
  }, [loginUser]);

  

  /* Aplica o tema no <html> */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /* Salva preferências no servidor e aplica localmente */
  const savePreferences = useCallback(async (updates) => {
    const merged = { ...preferences, ...updates };
    setPreferences(merged);
    if (updates.theme) applyTheme(updates.theme);
    try {
      await apiFetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch {}
  }, [preferences]);


  /* =====================
     INIT
  ===================== */
  useEffect(() => { fetchData(); fetchUsers(); fetchStats(); }, [fetchData, fetchUsers, fetchStats]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  /* =====================
     FILTERED ANIMES
  ===================== */
  const filteredAnimes = useMemo(() => {
    let list = animes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.title?.toLowerCase().includes(q) || a.title_jp?.toLowerCase().includes(q));
    } else if (activeGenre !== 'all') {
      if (activeGenre === 'Dublado') {
        list = list.filter(a => a.slug.endsWith('-dublado'));
      } else {
        const slugs  = genres[activeGenre] || [];
        const slugSet = new Set(slugs);
        list = list.filter(a => slugSet.has(a.slug));
      }
    }
    return list;
  }, [animes, genres, activeGenre, searchQuery]);

  const historyEntries = useMemo(() =>
    Object.entries(history)
      .map(([slug, h]) => ({ slug, ...h }))
      .sort((a, b) => (b.last_watched || 0) - (a.last_watched || 0))
      .slice(0, 15),
  [history]);

  const showHero = activeGenre === 'all' && !searchQuery;

  /* =====================
     NAVIGATION
  ===================== */
  const openDetail = useCallback(async (anime) => {
    setSelectedAnime(anime);
    setView(VIEW_DETAIL);
    setLoadingDetail(true);
    setAnimeDetail(null);
    setRelatedSeasons([]);

    if (!currentUser) { setShowUserSelector(true); return; }

    try {
      const res = await apiFetch(`/api/anime/${anime.slug}`);
      if (res.ok) {
        const detail = await res.json();
        setAnimeDetail(detail);

        // Detectar e buscar temporadas relacionadas
        // Ex: "mushoku-tensei" -> busca "mushoku-tensei-2", "mushoku-tensei-2-parte-2" etc.
        const baseSlug = anime.slug
          .replace(/-dublado$/, '')               // remove -dublado
          .replace(/-\d+$/, '')                   // remove sufixo numérico final
          .replace(/-parte-\d+$/, '')             // remove -parte-X
          .replace(/-season-\d+$/, '')            // remove -season-X
          .replace(/-s\d+$/, '')                  // remove -sX
          .replace(/-2nd-season$/, '')            // remove -2nd-season
          .replace(/-3rd-season$/, '')
          .replace(/-4th-season$/, '');

        const isDub = anime.slug.endsWith('-dublado');
        const sisters = animes.filter(a => {
          if (a.slug === anime.slug) return false;
          const aBase = a.slug
            .replace(/-dublado$/, '')
            .replace(/-\d+$/, '')
            .replace(/-parte-\d+$/, '')
            .replace(/-season-\d+$/, '')
            .replace(/-s\d+$/, '')
            .replace(/-2nd-season$/, '')
            .replace(/-3rd-season$/, '')
            .replace(/-4th-season$/, '');
          const aIsDub = a.slug.endsWith('-dublado');
          return aBase === baseSlug && aIsDub === isDub;
        }).sort((a, b) => a.slug.localeCompare(b.slug));

        if (sisters.length > 0) {
          const seasonDetails = await Promise.all(
            sisters.map(s => apiFetch(`/api/anime/${s.slug}`).then(r => r.ok ? r.json() : null))
          );
          setRelatedSeasons(seasonDetails.filter(Boolean));
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        toast(errData.error || errData.message || 'Erro ao carregar detalhes do anime', 'error');
      }
    } catch {
      toast('Erro de rede', 'error');
    } finally {
      setLoadingDetail(false);
    }
  }, [currentUser, toast, animes]);

  const handleJikanClick = useCallback((jikanAnime) => {
    const slug = jikanAnime.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    openDetail({ slug, title: jikanAnime.title, cover_url: jikanAnime.cover_url });
  }, [openDetail]);

  const openPlayer = useCallback(async (slug, ep) => {
    if (!currentUser) { setShowUserSelector(true); return; }

    setPlayerSlug(slug);
    setPlayerEp(ep);
    setView(VIEW_PLAYER);
    setVideoSrc(null);
    setLoadingVideo(true);

    try {
      const res = await apiFetch(`/api/source/${slug}/${ep}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.error) {
          let finalUrl = data.url;
          if (!finalUrl && (data.hd || data.sd)) {
             finalUrl = preferences.videoQuality === 'sd' ? (data.sd || data.hd) : (data.hd || data.sd);
          }
          setVideoSrc(finalUrl);
          setVideoType(data.type || 'video');
        } else {
          toast(data.error || 'Erro ao extrair o vídeo', 'error');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        toast(errData.error || errData.message || 'Erro ao carregar episódio', 'error');
      }
    } catch {
      toast('Erro de rede ao carregar episódio', 'error');
    } finally {
      setLoadingVideo(false);
    }
  }, [currentUser, toast, preferences.videoQuality]);

  const saveProgress = useCallback(async (time, duration) => {
    if (!currentUser || !playerSlug || !playerEp) return;
    const anime = animes.find(a => a.slug === playerSlug) || animeDetail;
    try {
      await apiFetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: playerSlug, ep: playerEp, time, duration,
          title: anime?.title || playerSlug, cover_url: anime?.cover_url || '',
        }),
      });
    } catch {}
  }, [currentUser, playerSlug, playerEp, animes, animeDetail]);

  const goBack = useCallback(() => {
    if (view === VIEW_PLAYER) { setView(VIEW_DETAIL); setVideoSrc(null); }
    else { setView(VIEW_HOME); setSelectedAnime(null); setAnimeDetail(null); }
  }, [view]);

  /* =====================
     ADMIN — Indexar anime
  ===================== */
  const handleAdminIndex = useCallback(async (e) => {
    e.preventDefault();
    setAdminStatus({ type: 'loading', msg: 'Indexando...' });
    try {
      const res = await apiFetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: adminUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminStatus({ type: 'success', msg: `✅ ${data.title} indexado! (${data.episodes} eps)` });
        setAdminUrl('');
        fetchData(); fetchStats();
      } else {
        setAdminStatus({ type: 'error', msg: `❌ ${data.error || 'Erro desconhecido'}` });
      }
    } catch {
      setAdminStatus({ type: 'error', msg: '❌ Erro de rede' });
    }
  }, [adminUrl, fetchData, fetchStats]);

  /* =====================
     ADMIN — Sync manual
  ===================== */
  const handleSync = useCallback(async () => {
    setSyncRunning(true);
    try {
      const res = await apiFetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      toast(data.message || 'Sync iniciado!', 'success');
    } catch {
      toast('Erro ao iniciar sync', 'error');
    } finally {
      setTimeout(() => setSyncRunning(false), 3000);
    }
  }, [toast]);

  /* =====================
     ADMIN — Bulk Import com SSE
  ===================== */
  const handleBulkImport = useCallback(async () => {
    if (bulkRunning) return;
    setBulkRunning(true);
    setBulkLog([]);

    // Inicia importação
    try {
      await apiFetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: bulkSource }),
      });
    } catch (err) {
      toast('Erro ao iniciar importação: ' + err.message, 'error');
      setBulkRunning(false);
      return;
    }

    // Conecta ao SSE para acompanhar progresso
    if (sseRef.current) sseRef.current.close();
    const sse = new EventSource(BACKEND_URL + '/api/bulk/stream', { withCredentials: true });
    sseRef.current = sse;

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'progress') {
          setBulkLog(l => [
            `🔄 [${data.source || 'Import'}] Página ${data.page}/${data.totalPages} - ${data.totalImported} animes`,
            ...l.slice(0, 49),
          ]);
        } else if (data.type === 'done') {
          setBulkLog(l => [`✅ ${data.message}`, ...l]);
          setBulkRunning(false);
          fetchData(); fetchStats();
          sse.close();
        } else if (data.type === 'error') {
          setBulkLog(l => [`❌ Erro: ${data.message}`, ...l]);
          setBulkRunning(false);
          sse.close();
        }
      } catch {}
    };

    sse.onerror = () => {
      setBulkRunning(false);
      sse.close();
    };
  }, [bulkRunning, bulkSource, fetchData, fetchStats, toast]);

  /* =====================
     RENDER: USER SELECTOR
  ===================== */
  const renderUserSelector = () => (
    <div className="user-selector-overlay" onClick={() => currentUser && setShowUserSelector(false)}>
      <div className="user-selector-modal" onClick={e => e.stopPropagation()}>
        <h2>AnimeKaiKai! 🎌</h2>
        <p>Escolha seu perfil para continuar</p>

        {users.length > 0 && (
          <div className="user-list">
            {users.map(u => (
              <div key={u.name} className="user-card" onClick={() => loginUser(u.name)} id={`user-${u.name}`}>
                <img src={u.avatar} alt={u.name} />
                <span>{u.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="new-user-input">
          <input
            type="text" placeholder="Novo usuário..."
            value={newUsername} onChange={e => setNewUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newUsername.trim() && loginUser(newUsername.trim())}
            id="new-user-input"
          />
          <button className="btn btn-primary" onClick={() => newUsername.trim() && loginUser(newUsername.trim())} id="new-user-btn">
            Entrar
          </button>
        </div>
      </div>
    </div>
  );

  /* =====================
     RENDER: NAVBAR
  ===================== */
  const renderNavbar = () => (
    <nav className="navbar">
      <div className="navbar-logo" onClick={() => { setView(VIEW_HOME); setSearchQuery(''); setActiveGenre('all'); }} style={{ cursor: 'pointer' }}>
        AnimeKaiKai!
      </div>

      <div className="navbar-search">
        <span className="search-icon">🔍</span>
        <input
          type="text" placeholder="Buscar anime..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setView(VIEW_HOME); setActiveGenre('all'); }}
          id="search-input"
        />
      </div>

      <div className="navbar-spacer" />

      <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => setView(VIEW_ADMIN)} id="admin-btn">
        ⚙️ Admin
      </button>

      <div className="navbar-user" onClick={() => setShowUserSelector(true)} id="user-menu">
        {currentUser ? (
          <>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}`} alt={currentUser.name} />
            <span>{currentUser.name}</span>
          </>
        ) : (
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Entrar</span>
        )}
      </div>
    </nav>
  );

  /* =====================
     RENDER: HOME
  ===================== */
  const renderHome = () => (
    <div className="main-content animate-in">
      {showHero && (
        <div className="hero">
          <div className="hero-bg" />
          <div className="hero-particles" />
          <div className="hero-content">
            <div className="hero-tagline">🎌 Seu homelab de animes</div>
            <h1 className="hero-title">Assista <span>animes</span><br />sem limites</h1>
            <p className="hero-desc">
              {animes.length.toLocaleString()} animes disponíveis, com acompanhamento de lançamentos e episódios novos em tempo real.
            </p>
            <button className="btn btn-primary hero-play-btn" onClick={() => {
              if (airingAnimes.length > 0) {
                openDetail(airingAnimes[0]);
              }
            }}>
              <span className="hero-play-icon">▶</span> Assista ao Último Lançamento
            </button>
          </div>
        </div>
      )}

      {showHero && schedule.length > 0 && <LatestEpisodes schedule={schedule} onAnimeClick={handleJikanClick} />}
      {showHero && airingAnimes.length > 0 && <AiringSection animes={airingAnimes} onSelect={openDetail} />}

      {showHero && historyEntries.length > 0 && (
        <section className="history-section">
          <div className="section-header">
            <h2 className="section-title"><span className="section-icon">📖</span>Continuar Assistindo</h2>
          </div>
          <div className="history-row">
            {historyEntries.map(h => (
              <div key={h.slug} className="history-card" onClick={() => openPlayer(h.slug, h.ep)} id={`history-${h.slug}`}>
                <div className="history-card-cover">
                  <img src={h.cover_url} alt={h.title} loading="lazy" onError={e => { e.target.src = 'https://via.placeholder.com/160x240/12121a/9090b0?text=Anime'; }} />
                  <div className="history-card-progress">
                    <div className="history-card-progress-bar" style={{ width: `${progressPct(h)}%` }} />
                  </div>
                </div>
                <div className="history-card-info">
                  <div className="history-card-title">{h.title}</div>
                  <div className="history-card-ep" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>EP {h.ep}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{formatTime(h.time)} / {formatTime(h.duration)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="genre-bar">
        <button className={`genre-pill${activeGenre === 'all' ? ' active' : ''}`} onClick={() => { setActiveGenre('all'); setSearchQuery(''); }} id="genre-all">
          🏠 Todos
        </button>
        <button className={`genre-pill${activeGenre === 'Dublado' ? ' active' : ''}`} onClick={() => { setActiveGenre('Dublado'); setSearchQuery(''); }} id="genre-dublado" style={{ borderColor: 'var(--accent)', color: activeGenre === 'Dublado' ? '#000' : 'var(--accent)' }}>
          🇧🇷 Dublado
        </button>
        {Object.keys(genres).map(g => (
          <button key={g} className={`genre-pill${activeGenre === g ? ' active' : ''}`}
            onClick={() => { setActiveGenre(g); setSearchQuery(''); }}
            id={`genre-${g.replace(/\s+/g, '-').toLowerCase()}`}>
            {g}
          </button>
        ))}
      </div>

      {searchQuery && (
        <div className="section-header" style={{ marginBottom: '16px' }}>
          <h2 className="section-title">🔍 Resultados para "{searchQuery}" <span className="section-badge">{filteredAnimes.length}</span></h2>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : filteredAnimes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="anime-grid" style={{ width: '100%' }}>
            {filteredAnimes.slice(0, visibleCount).map(anime => (
              <AnimeCard key={anime.slug} anime={anime} onClick={openDetail} />
            ))}
          </div>
          {visibleCount < filteredAnimes.length && (
            <button 
              className="btn btn-secondary" 
              style={{ marginTop: '24px', padding: '12px 32px' }}
              onClick={() => setVisibleCount(c => c + 50)}
            >
              Carregar Mais ({filteredAnimes.length - visibleCount} restantes)
            </button>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">😶‍🌫️</div>
          <h3>Nenhum anime encontrado</h3>
          <p>Tente outro termo de busca ou gênero</p>
        </div>
      )}
    </div>
  );

  /* =====================
     RENDER: DETAIL
  ===================== */
  const renderDetail = () => {
    const anime    = animeDetail || selectedAnime;
    const episodes = animeDetail?.episodes
      ? Object.keys(animeDetail.episodes).sort((a, b) => Number(a) - Number(b))
      : [];
    const watchedEps = new Set(
      Object.entries(history).filter(([slug]) => slug === anime?.slug).flatMap(([, h]) => [String(h.ep)])
    );
    const currentEp = history[anime?.slug]?.ep;
    const isDubbed = anime?.slug?.endsWith('-dublado');
    const altSlug = isDubbed ? anime?.slug.replace('-dublado', '') : `${anime?.slug}-dublado`;
    const altAnime = animes.find(a => a.slug === altSlug);
    const episodesHistory = history[anime?.slug]?.episodes || {};

    return (
      <div className="main-content animate-in">
        <div className="detail-view">
          <div className="detail-back" onClick={goBack} id="detail-back">← Voltar</div>

          {loadingDetail ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : anime ? (
            <>
              <div className="detail-hero">
                <div className="detail-cover">
                  <img src={anime.cover_url} alt={anime.title} onError={e => { e.target.src = 'https://via.placeholder.com/220x330/12121a/9090b0?text=Cover'; }} />
                </div>

                <div className="detail-info">
                  <h1 className="detail-title">{anime.title}</h1>

                   <div className="detail-meta">
                    {anime.airing && <span className="status-badge" style={{ background: '#3b82f6', color: '#fff' }}>Em Lançamento</span>}
                    {episodes.length > 0 && (
                      <span className="status-badge">
                        📺 {episodes.length} episódios
                      </span>
                    )}
                    {altAnime && (
                      <button 
                        className="btn-watch" 
                        style={{ padding: '4px 12px', fontSize: '0.8rem', marginLeft: '10px', background: 'var(--accent)', color: 'var(--text)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => openDetail(altAnime)}
                      >
                        {isDubbed ? '🇯🇵 Mudar para Legendado' : '🇧🇷 Mudar para Dublado'}
                      </button>
                    )}
                  </div>

                  {anime.synopsis && <p className="detail-synopsis">{anime.synopsis}</p>}

                  {anime.genres?.length > 0 && (
                    <div className="genre-tags">
                      {anime.genres.map(g => <span key={g} className="genre-tag">{g}</span>)}
                    </div>
                  )}

                  {(() => {
                    // Encontra o anime e episódio mais recente (em qualquer temporada)
                    const allSeasons = [animeDetail, ...relatedSeasons].filter(Boolean);
                    const lastWatched = allSeasons
                      .map(s => ({ slug: s.slug, ...history[s.slug] }))
                      .filter(h => h.ep)
                      .sort((a, b) => (b.last_watched || 0) - (a.last_watched || 0))[0];
                    
                    const firstSeason = animeDetail;
                    const firstEp = firstSeason?.episodes ? Object.keys(firstSeason.episodes).sort((a,b) => Number(a)-Number(b))[0] : null;
                    
                    if (!firstEp && !lastWatched) return null;
                    
                    return (
                      <button className="btn-watch"
                        onClick={() => lastWatched
                          ? openPlayer(lastWatched.slug, lastWatched.ep)
                          : openPlayer(animeDetail.slug, firstEp)
                        }
                        id="btn-watch-first"
                      >
                        ▶ {lastWatched ? `Continuar EP ${lastWatched.ep}` : `Assistir EP ${firstEp}`}
                      </button>
                    );
                  })()}

                  {anime.lazy && episodes.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Carregando lista de episódios...</p>
                  )}
                </div>
              </div>

              {/* Episódios: temporada atual + temporadas relacionadas */}
              {(() => {
                // Monta lista de todas as temporadas ordenadas
                const allSeasons = [animeDetail, ...relatedSeasons].filter(Boolean);
                const totalEps = allSeasons.reduce((n, s) => n + (s.episodes ? Object.keys(s.episodes).length : 0), 0);

                if (totalEps === 0) return null;

                // Número da temporada a que pertence a temporada principal (1 se não tiver sufixo)
                const getSeasonNum = (slug) => {
                  const m = slug?.replace(/-dublado$/, '').match(/-(\d+)$/);
                  return m ? parseInt(m[1]) : 1;
                };

                const sortedSeasons = allSeasons.sort((a, b) => getSeasonNum(a.slug) - getSeasonNum(b.slug));
                const hasMultipleSeasons = sortedSeasons.length > 1;

                return (
                  <section className="episodes-section">
                    <div className="section-header">
                      <h2 className="section-title"><span className="section-icon">📺</span>
                        {hasMultipleSeasons ? `Episódios (${totalEps} no total)` : 'Episódios'}
                      </h2>
                    </div>

                    {sortedSeasons.map((season, si) => {
                      const sEps = season.episodes ? Object.keys(season.episodes).sort((a, b) => Number(a) - Number(b)) : [];
                      if (sEps.length === 0) return null;
                      const sHistory = history[season.slug]?.episodes || {};
                      const sCurrentEp = history[season.slug]?.ep;

                      return (
                        <div key={season.slug} style={{ marginBottom: hasMultipleSeasons ? '24px' : '0' }}>
                          {hasMultipleSeasons && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              margin: '0 0 12px 0', padding: '6px 12px',
                              background: 'rgba(255,255,255,0.04)',
                              borderRadius: 'var(--radius-sm)',
                              borderLeft: '3px solid var(--accent)',
                            }}>
                              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {season.slug === anime?.slug ? '▶' : '◦'} {season.title}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                {sEps.length} eps
                              </span>
                              {season.slug !== anime?.slug && sCurrentEp && (
                                <button
                                  className="btn-watch"
                                  style={{ padding: '2px 10px', fontSize: '0.75rem' }}
                                  onClick={() => openPlayer(season.slug, sCurrentEp)}
                                >
                                  ▶ EP {sCurrentEp}
                                </button>
                              )}
                            </div>
                          )}
                          <div className="episodes-grid">
                            {sEps.map(ep => {
                              const epData = sHistory[ep] || {};
                              const isFinished = epData.finished || (epData.duration && epData.time/epData.duration >= 0.9);
                              const isPartial = !isFinished && epData.time > 0;

                              let cls = 'ep-btn';
                              if (sCurrentEp === ep) cls += ' current';
                              else if (isFinished) cls += ' finished';
                              else if (isPartial) cls += ' watched';

                              return (
                                <button
                                  key={`${season.slug}-${ep}`}
                                  className={cls}
                                  onClick={() => openPlayer(season.slug, ep)}
                                  id={`ep-btn-${season.slug}-${ep}`}
                                >
                                  {ep}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                );
              })()}
            </>
          ) : (
            <div className="empty-state"><div className="empty-icon">😥</div><h3>Anime não encontrado</h3></div>
          )}
        </div>
      </div>
    );
  };

  /* =====================
     RENDER: PLAYER
  ===================== */
  const renderPlayer = () => {
    const anime   = animeDetail || selectedAnime || animes.find(a => a.slug === playerSlug);
    const allEps  = animeDetail?.episodes
      ? Object.keys(animeDetail.episodes).sort((a, b) => Number(a) - Number(b))
      : [];
    const currentIdx = allEps.indexOf(String(playerEp));
    const prevEp = currentIdx > 0 ? allEps[currentIdx - 1] : null;
    const nextEp = currentIdx < allEps.length - 1 ? allEps[currentIdx + 1] : null;

    return (
      <div className="main-content animate-in">
        <div className="player-view">
          <div className="player-back" onClick={goBack} id="player-back">← Voltar para detalhes</div>

          <h1 className="player-title">
            {anime?.title || playerSlug}{' '}<span>— Episódio {playerEp}</span>
          </h1>

          <div className="player-wrapper">
            {loadingVideo ? (
              <div className="player-loading">
                <div className="spinner" />
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>Buscando stream...</p>
              </div>
            ) : videoSrc ? (
              <VideoPlayer src={videoSrc} type={videoType} onProgress={saveProgress} onEnded={() => nextEp && openPlayer(playerSlug, nextEp)} />
            ) : (
              <div className="player-loading">
                <p style={{ color: '#ff4d7f' }}>❌ Não foi possível carregar o episódio</p>
              </div>
            )}
          </div>

          <div className="player-nav">
            <button className="btn btn-ghost" disabled={!prevEp} onClick={() => prevEp && openPlayer(playerSlug, prevEp)} id="btn-prev-ep">
              ← EP {prevEp || '—'}
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', flex: 1, textAlign: 'center' }}>
              Episódio {playerEp} de {allEps.length || '?'}
            </span>
            <button className="btn btn-primary" disabled={!nextEp} onClick={() => nextEp && openPlayer(playerSlug, nextEp)} id="btn-next-ep">
              EP {nextEp || '—'} →
            </button>
          </div>

          {allEps.length > 0 && (
            <div className="player-ep-grid">
              {allEps.map(ep => (
                <button key={ep} className={`ep-btn${String(ep) === String(playerEp) ? ' current' : ''}`}
                  onClick={() => openPlayer(playerSlug, ep)} id={`player-ep-${ep}`}>
                  {ep}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* =====================
     RENDER: ADMIN
  ===================== */
  const renderAdmin = () => (
    <div className="main-content animate-in">
      <div className="admin-panel">
        <div className="detail-back" onClick={() => setView(VIEW_HOME)} id="admin-back">← Voltar</div>
        <h2>⚙️ Painel Admin</h2>

        {/* ── INDEXAR ÚNICO ── */}
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
            🔍 Indexar anime por URL
          </h3>
          <form className="admin-form" onSubmit={handleAdminIndex}>
            <div>
              <label>URL da página do anime (AnimeFire, Goyabu, AnimesDigital, MeusAnimes, AnimesOnline)</label>
              <input
                type="url" placeholder="https://animefire.plus/animes/nome-do-anime"
                value={adminUrl} onChange={e => setAdminUrl(e.target.value)}
                required id="admin-url-input"
              />
            </div>
            {adminStatus && (
              <div className={`admin-status ${adminStatus.type === 'success' ? 'success' : adminStatus.type === 'loading' ? '' : 'error'}`}>
                {adminStatus.msg}
              </div>
            )}
            <button type="submit" className="btn btn-primary" id="admin-submit">
              🔍 Indexar Anime
            </button>
          </form>
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />

        {/* ── BULK IMPORT ── */}
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
            📦 Importar catálogo completo
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
            Importa todos os animes de um provider de uma vez (catálogo lazy — episódios carregam sob demanda).
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
            <select
              value={bulkSource} onChange={e => setBulkSource(e.target.value)}
              style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
              id="bulk-source-select"
            >
              <option value="goyabu">Goyabu (recomendado)</option>
              <option value="animefire">AnimeFire (via API)</option>
              <option value="all">Todas as Fontes (Goyabu + AnimeFire)</option>
            </select>

            <button
              className="btn btn-primary"
              onClick={handleBulkImport}
              disabled={bulkRunning}
              id="bulk-import-btn"
              style={{ opacity: bulkRunning ? 0.6 : 1 }}
            >
              {bulkRunning ? '⏳ Importando...' : '📥 Iniciar Importação'}
            </button>
          </div>

          {bulkLog.length > 0 && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px',
              padding: '12px', maxHeight: '200px', overflowY: 'auto', fontFamily: 'monospace',
              fontSize: '0.78rem', color: 'var(--text-secondary)',
            }}>
              {bulkLog.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          )}
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />

        {/* ── SYNC MANUAL ── */}
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
            🔄 Sincronização de animes em exibição
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
            Rebusca todos os animes marcados como "em exibição" para detectar novos episódios. Também ocorre automaticamente a cada 1 hora.
          </p>
          <button className="btn btn-primary" onClick={handleSync} disabled={syncRunning} id="sync-btn">
            {syncRunning ? '⏳ Sincronizando...' : '🔄 Sincronizar agora'}
          </button>
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />

        {/* ── ESTATÍSTICAS ── */}
        <section>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
            📊 Estatísticas
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Total animes', value: stats?.total ?? animes.length },
              { label: 'Em exibição',  value: stats?.airing ?? airingAnimes.length },
              { label: 'Lazy (catálogo)', value: stats?.lazy ?? '—' },
              { label: 'Gêneros',      value: stats?.genres ?? Object.keys(genres).length },
              { label: 'Hoje (Jikan)', value: schedule.length },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: '16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── PREFERÊNCIAS ── */}
      {currentUser && (
        <div className="admin-panel" style={{ marginTop: '24px' }}>
          <h2>🎛️ Preferências</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Suas configurações ficam salvas e são restauradas a cada login.
          </p>

          <div style={{ display: 'grid', gap: '16px' }}>

            {/* Tema */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>🌓 Tema</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Aparência da interface</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['dark', 'light'].map(t => (
                  <button
                    key={t}
                    id={`theme-${t}`}
                    onClick={() => savePreferences({ theme: t })}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
                      border: '1px solid var(--border)',
                      background: preferences.theme === t ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: preferences.theme === t ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                  </button>
                ))}
              </div>
            </div>

            {/* Qualidade de vídeo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>📺 Qualidade de vídeo</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Preferência de qualidade ao carregar episódio</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['auto', 'hd', 'sd'].map(q => (
                  <button
                    key={q}
                    id={`quality-${q}`}
                    onClick={() => savePreferences({ videoQuality: q })}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
                      border: '1px solid var(--border)',
                      background: preferences.videoQuality === q ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: preferences.videoQuality === q ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {q.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Autoplay */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>▶️ Autoplay</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Avança automaticamente para o próximo episódio</div>
              </div>
              <button
                id="autoplay-toggle"
                onClick={() => savePreferences({ autoplay: !preferences.autoplay })}
                style={{
                  padding: '6px 20px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                  border: 'none',
                  background: preferences.autoplay ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                  color: '#fff', transition: 'background 0.2s',
                }}
              >
                {preferences.autoplay ? 'Ativado' : 'Desativado'}
              </button>
            </div>

          </div>

          {/* Info da sessão do usuário */}
          {currentUser.sessionId && (
            <div style={{
              marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)', borderRadius: '10px',
              fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)',
            }}>
              <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>🔐 Sua sessão</div>
              <div>Session ID: <span style={{ color: 'var(--accent)' }}>{currentUser.sessionId}</span></div>
              {currentUser.createdAt && <div style={{ marginTop: '4px' }}>Conta criada em: {new Date(currentUser.createdAt).toLocaleString('pt-BR')}</div>}
              {currentUser.lastLoginAt && <div style={{ marginTop: '4px' }}>Último login: {new Date(currentUser.lastLoginAt).toLocaleString('pt-BR')}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );



  /* =====================
     MAIN RENDER
  ===================== */
  return (
    <div className="app">
      {!currentUser && !showUserSelector && renderUserSelector()}
      {showUserSelector && renderUserSelector()}
      {renderNavbar()}

      {view === VIEW_HOME   && renderHome()}
      {view === VIEW_DETAIL && renderDetail()}
      {view === VIEW_PLAYER && renderPlayer()}
      {view === VIEW_ADMIN  && renderAdmin()}

      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}
      </div>
    </div>
  );
}
