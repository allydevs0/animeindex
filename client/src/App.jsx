import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import HeroBanner from './components/HeroBanner.jsx';
import ContinueWatching from './components/ContinueWatching.jsx';
import AnimeCard from './components/AnimeCard.jsx';
import AnimeDetailModal from './components/AnimeDetailModal.jsx';
import VideoPlayerView from './components/VideoPlayerView.jsx';
import SearchModal from './components/SearchModal.jsx';
import WatchlistSection from './components/WatchlistSection.jsx';
import ScheduleSection from './components/ScheduleSection.jsx';
import SettingsModal from './components/SettingsModal.jsx';

import { AnimeApi, FALLBACK_FEATURED } from './services/api.js';
import { StorageService } from './services/storage.js';
import { Flame, Tv, Compass, Sparkles, Clock } from 'lucide-react';

const GENRE_FILTERS = [
  'Todos',
  'Ação',
  'Aventura',
  'Comédia',
  'Drama',
  'Fantasia',
  'Romance',
  'Sci-Fi',
  'Sobrenatural',
  'Suspense'
];

export default function App() {
  // ── Navegação & Visualizações ──
  const [currentTab, setCurrentTab] = useState('home'); // 'home' | 'airing' | 'popular' | 'watchlist' | 'schedule'
  const [playerState, setPlayerState] = useState({ active: false, anime: null, episode: 1 });
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Dados do Backend ──
  const [featuredList, setFeaturedList] = useState(FALLBACK_FEATURED);
  const [catalogList, setCatalogList] = useState([]);
  const [airingList, setAiringList] = useState([]);
  const [releasesList, setReleasesList] = useState([]);
  const [activeGenre, setActiveGenre] = useState('Todos');
  const [loading, setLoading] = useState(true);

  // ── Dados Locais Persistentes ──
  const [history, setHistory] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [userProfile, setUserProfile] = useState(() => StorageService.getProfile());

  // ── Notificações Toast ──
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  // Recarrega dados salvos no storage local
  const reloadStorageData = useCallback(() => {
    setHistory(StorageService.getHistory());
    setWatchlist(StorageService.getWatchlist());
    setUserProfile(StorageService.getProfile());
  }, []);

  // Inicialização e Carga dos Dados diretamente do Backend
  useEffect(() => {
    reloadStorageData();

    async function loadBackendData() {
      setLoading(true);
      try {
        const [animes, airing, releases] = await Promise.all([
          AnimeApi.getAnimes(),
          AnimeApi.getAiring(),
          AnimeApi.getReleases(),
        ]);

        setCatalogList(animes);
        setAiringList(airing);
        setReleasesList(releases);

        // Seleciona animes com capa de qualidade para o hero carrossel
        const heroCandidates = animes.filter(a => a.cover_url && a.title).slice(0, 8);
        if (heroCandidates.length > 0) {
          setFeaturedList(heroCandidates);
        }
      } catch (err) {
        console.error('[App] Erro ao carregar dados do backend:', err);
      } finally {
        setLoading(false);
      }
    }

    loadBackendData();
  }, [reloadStorageData]);

  // Atalho global Cmd+K / Ctrl+K para abrir busca
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers de Ação
  const handlePlayAnime = (anime, episode = 1) => {
    setSelectedAnime(null);
    setPlayerState({ active: true, anime, episode });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResumeHistory = (historyItem) => {
    const anime = {
      id: historyItem.animeId,
      slug: historyItem.slug,
      title: historyItem.title,
      cover_url: historyItem.cover_url,
      banner_url: historyItem.banner_url,
      episodes_count: historyItem.totalEpisodes,
    };
    handlePlayAnime(anime, historyItem.currentEpisode || 1);
  };

  // Filtra catálogo do backend por gênero selecionado
  const filteredCatalog = catalogList.filter((anime) => {
    if (activeGenre === 'Todos') return true;
    return (anime.genres || []).some(
      (g) => (typeof g === 'string' ? g : g.name).toLowerCase().includes(activeGenre.toLowerCase())
    );
  });

  // Se o player estiver ativo, exibe a tela do reprodutor
  if (playerState.active && playerState.anime) {
    return (
      <div className="app-container">
        <VideoPlayerView
          anime={playerState.anime}
          initialEpisode={playerState.episode}
          onBack={() => {
            setPlayerState({ active: false, anime: null, episode: 1 });
            reloadStorageData();
          }}
          onToast={addToast}
        />
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className="toast-item">
              <Sparkles size={16} color="var(--accent)" />
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Barra de Navegação */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        userProfile={userProfile}
      />

      <main className="main-content">
        {/* ── ABA: INÍCIO ── */}
        {currentTab === 'home' && (
          <>
            {/* Banner Hero Rotativo */}
            <HeroBanner
              featuredAnimes={featuredList}
              onPlay={handlePlayAnime}
              onSelectAnime={setSelectedAnime}
              onToast={addToast}
            />

            <div className="content-wrapper">
              {/* Continuar Assistindo (se houver histórico) */}
              <ContinueWatching
                history={history}
                onResume={handleResumeHistory}
                onRefreshHistory={reloadStorageData}
              />

              {/* Seção: Últimos Episódios Lançados (Direto do Backend) */}
              {releasesList.length > 0 && (
                <section style={{ margin: '40px 0 20px' }}>
                  <div className="section-header">
                    <h2 className="section-title">
                      <Flame size={22} />
                      Últimos Lançamentos
                    </h2>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {releasesList.length} episódios recentes no backend
                    </span>
                  </div>

                  <div className="scroll-row-container">
                    <div className="scroll-row">
                      {releasesList.slice(0, 24).map((rel, i) => (
                        <div key={`${rel.slug}-${rel.episode || rel.ep}-${i}`} style={{ width: '180px' }}>
                          <AnimeCard
                            anime={{
                              title: rel.title,
                              slug: rel.slug,
                              cover_url: rel.cover_url,
                              episodes_count: Number(rel.episode || rel.ep || 1),
                              airing: true,
                            }}
                            onClick={setSelectedAnime}
                            onQuickPlay={(a) => handlePlayAnime(a, Number(rel.episode || rel.ep || 1))}
                            onToast={addToast}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Seção: Em Exibição / Airing */}
              {airingList.length > 0 && (
                <section style={{ margin: '40px 0 20px' }}>
                  <div className="section-header">
                    <h2 className="section-title">
                      <Tv size={22} />
                      Em Exibição
                    </h2>
                    <button
                      onClick={() => setCurrentTab('airing')}
                      style={{ fontSize: '0.88rem', color: 'var(--accent)', fontWeight: 600 }}
                    >
                      Ver todos →
                    </button>
                  </div>

                  <div className="scroll-row-container">
                    <div className="scroll-row">
                      {airingList.map((anime) => (
                        <div key={anime.mal_id || anime.slug} style={{ width: '180px' }}>
                          <AnimeCard
                            anime={anime}
                            onClick={setSelectedAnime}
                            onQuickPlay={handlePlayAnime}
                            onToast={addToast}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Seção: Explorar Catálogo Completo (3.700+ Animes do Backend) */}
              <section style={{ margin: '44px 0 20px' }}>
                <div className="section-header">
                  <h2 className="section-title">
                    <Compass size={22} />
                    Catálogo de Animes ({catalogList.length > 0 ? `${catalogList.length} títulos` : 'Carregando...'})
                  </h2>
                </div>

                {/* Filtros de Gênero */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '14px',
                  marginBottom: '20px'
                }}>
                  {GENRE_FILTERS.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => setActiveGenre(genre)}
                      className={`genre-pill ${activeGenre === genre ? 'active' : ''}`}
                      style={{ cursor: 'pointer', padding: '8px 18px', fontSize: '0.85rem' }}
                    >
                      {genre}
                    </button>
                  ))}
                </div>

                {/* Grid de Animes */}
                <div className="anime-grid">
                  {(filteredCatalog.length > 0 ? filteredCatalog : catalogList).slice(0, 60).map((anime) => (
                    <AnimeCard
                      key={anime.slug || anime.id}
                      anime={anime}
                      onClick={setSelectedAnime}
                      onQuickPlay={handlePlayAnime}
                      onToast={addToast}
                    />
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        {/* ── ABA: EM EXIBIÇÃO ── */}
        {currentTab === 'airing' && (
          <div className="content-wrapper" style={{ paddingTop: '30px' }}>
            <div className="section-header" style={{ marginTop: '0' }}>
              <h2 className="section-title">
                <Tv size={24} />
                Animes em Lançamento
              </h2>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                {airingList.length} animes encontrados
              </span>
            </div>

            <div className="anime-grid">
              {airingList.map((anime) => (
                <AnimeCard
                  key={anime.mal_id || anime.slug}
                  anime={anime}
                  onClick={setSelectedAnime}
                  onQuickPlay={handlePlayAnime}
                  onToast={addToast}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── ABA: MAIS POPULARES ── */}
        {currentTab === 'popular' && (
          <div className="content-wrapper" style={{ paddingTop: '30px' }}>
            <div className="section-header" style={{ marginTop: '0' }}>
              <h2 className="section-title">
                <Flame size={24} />
                Catálogo Completo do Backend
              </h2>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                {catalogList.length} animes disponíveis
              </span>
            </div>

            <div className="anime-grid">
              {catalogList.slice(0, 80).map((anime) => (
                <AnimeCard
                  key={anime.slug || anime.id}
                  anime={anime}
                  onClick={setSelectedAnime}
                  onQuickPlay={handlePlayAnime}
                  onToast={addToast}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── ABA: MINHA LISTA ── */}
        {currentTab === 'watchlist' && (
          <WatchlistSection
            watchlist={watchlist}
            onSelectAnime={setSelectedAnime}
            onRefresh={reloadStorageData}
            onToast={addToast}
          />
        )}

        {/* ── ABA: CALENDÁRIO ── */}
        {currentTab === 'schedule' && (
          <ScheduleSection
            onSelectAnime={setSelectedAnime}
            onQuickPlay={handlePlayAnime}
          />
        )}
      </main>

      {/* ── Modais Flutuantes ── */}
      {selectedAnime && (
        <AnimeDetailModal
          anime={selectedAnime}
          onClose={() => setSelectedAnime(null)}
          onPlayEpisode={handlePlayAnime}
          onToast={addToast}
        />
      )}

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectAnime={setSelectedAnime}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userProfile={userProfile}
        onUpdateProfile={(up) => {
          setUserProfile(up);
          reloadStorageData();
        }}
        onToast={addToast}
      />

      {/* ── Pilha de Notificações Toast ── */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="toast-item">
            <Sparkles size={16} color="var(--accent)" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
