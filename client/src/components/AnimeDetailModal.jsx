import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  Star, 
  Calendar, 
  Tv, 
  Film, 
  Bookmark, 
  Check, 
  Layers, 
  Clock, 
  Share2 
} from 'lucide-react';
import { StorageService } from '../services/storage.js';
import { getSafePoster, getSafeBanner, BACKEND_URL } from '../services/api.js';

export default function AnimeDetailModal({ 
  anime, 
  onClose, 
  onPlayEpisode, 
  onToast 
}) {
  const [watchlistStatus, setWatchlistStatus] = useState(null);
  const [episodesCount, setEpisodesCount] = useState(12);
  const [activeTab, setActiveTab] = useState('episodes'); // 'episodes' | 'trailer'
  const [savedProgress, setSavedProgress] = useState(null);

  useEffect(() => {
    if (!anime) return;
    const key = anime.slug || String(anime.id || anime.mal_id);
    const status = StorageService.getWatchlistStatus(key);
    setWatchlistStatus(status);

    const progress = StorageService.getAnimeProgress(key);
    setSavedProgress(progress);

    // Determina contagem de episódios
    const total = anime.episodes || anime.episodes_count || (anime.airing ? 12 : 24);
    setEpisodesCount(Math.max(1, Math.min(total, 100)));
  }, [anime]);

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!anime) return null;

  const handleStatusChange = (newStatus) => {
    StorageService.setWatchlistStatus(anime, newStatus);
    setWatchlistStatus(newStatus);
    onToast?.(
      newStatus === 'none' ? 'Removido da sua lista' : 'Lista atualizada com sucesso!', 
      'success'
    );
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: anime.title,
        text: `Assista ${anime.title} no AnimeIndex!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      onToast?.('Link copiado para a área de transferência!', 'info');
    }
  };

  const banner = getSafeBanner(anime);
  const poster = getSafePoster(anime);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '920px', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}
      >
        {/* Banner de Topo com Botão Fechar */}
        <div style={{
          position: 'relative',
          height: '280px',
          width: '100%',
          overflow: 'hidden',
          background: '#000',
        }}>
          <img
            src={banner}
            alt={anime.title}
            onError={(e) => {
              const slug = anime.slug || anime.id || anime.mal_id;
              const fallback = slug ? `${BACKEND_URL}/api/cover/${slug}` : 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/default.jpg';
              if (e.target.src !== fallback) {
                e.target.src = fallback;
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.65) saturate(1.1)',
            }}
          />

          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, var(--bg-surface) 0%, rgba(18, 21, 32, 0.4) 60%, rgba(0,0,0,0.6) 100%)',
          }} />

          {/* Botões de Ação Superiores */}
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            gap: '10px',
            zIndex: 10,
          }}>
            <button
              onClick={handleShare}
              className="btn-icon"
              title="Compartilhar"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            >
              <Share2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="btn-icon"
              title="Fechar (Esc)"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Tag de Status Flutuante */}
          {anime.airing && (
            <div style={{ position: 'absolute', bottom: '16px', left: '230px', zIndex: 10 }}>
              <span className="badge-airing">
                <span className="pulse-dot" /> Em Exibição
              </span>
            </div>
          )}
        </div>

        {/* Corpo do Modal */}
        <div style={{ padding: '0 32px 32px', position: 'relative', marginTop: '-90px' }}>
          
          {/* Header com Poster e Informações Principais */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }} className="detail-header-flex">
            
            {/* Poster Flutuante */}
            <div style={{
              width: '180px',
              flexShrink: 0,
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
              border: '2px solid rgba(255,255,255,0.15)',
              background: '#000',
              aspectRatio: '2 / 3',
            }}>
              <img
                src={poster}
                alt={anime.title}
                onError={(e) => {
                  const slug = anime.slug || anime.id || anime.mal_id;
                  const fallback = slug ? `${BACKEND_URL}/api/cover/${slug}` : 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/default.jpg';
                  if (e.target.src !== fallback) {
                    e.target.src = fallback;
                  }
                }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Informações de Título e Metadados */}
            <div style={{ flex: 1, paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {anime.score && (
                  <span className="badge-score">
                    <Star size={12} fill="currentColor" /> {Number(anime.score).toFixed(2)}
                  </span>
                )}
                {anime.year && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {anime.year}
                  </span>
                )}
                {anime.rating && (
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'var(--text-secondary)'
                  }}>
                    {anime.rating}
                  </span>
                )}
              </div>

              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.2,
                marginBottom: '8px'
              }}>
                {anime.title}
              </h2>

              {anime.title_japanese && (
                <div style={{ fontSize: '0.88rem', color: 'var(--accent)', marginBottom: '14px', fontWeight: 500 }}>
                  {anime.title_japanese}
                </div>
              )}

              {/* Botões de Ação: Assistir + Dropdown Minha Lista */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
                <button
                  onClick={() => onPlayEpisode(anime, savedProgress?.currentEpisode || 1)}
                  className="btn-primary"
                  style={{ padding: '10px 22px' }}
                >
                  <Play size={18} fill="currentColor" />
                  {savedProgress ? `Continuar Ep. ${savedProgress.currentEpisode}` : 'Assistir Episódio 1'}
                </button>

                {/* Seletor de Status da Lista */}
                <select
                  value={watchlistStatus || 'none'}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: watchlistStatus ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.08)',
                    color: watchlistStatus ? 'var(--accent)' : 'var(--text-main)',
                    border: watchlistStatus ? '1px solid var(--border-accent)' : '1px solid var(--border-default)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="none" style={{ background: 'var(--bg-surface)', color: '#fff' }}>+ Adicionar à Lista</option>
                  <option value="watching" style={{ background: 'var(--bg-surface)', color: '#fff' }}>Assistindo</option>
                  <option value="plan_to_watch" style={{ background: 'var(--bg-surface)', color: '#fff' }}>Quero Assistir</option>
                  <option value="completed" style={{ background: 'var(--bg-surface)', color: '#fff' }}>Concluído</option>
                  <option value="favorite" style={{ background: 'var(--bg-surface)', color: '#fff' }}>Favorito ⭐</option>
                </select>
              </div>
            </div>
          </div>

          {/* Gêneros */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '24px 0 16px' }}>
            {(anime.genres || []).map((g, i) => (
              <span key={i} className="genre-pill">
                {typeof g === 'string' ? g : g.name}
              </span>
            ))}
          </div>

          {/* Sinopse */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
              Sinopse
            </h4>
            <p style={{ color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: 1.6, opacity: 0.9 }}>
              {anime.synopsis}
            </p>
          </div>

          {/* Tabs: Episódios vs Trailer */}
          <div style={{
            display: 'flex',
            gap: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '20px',
            paddingBottom: '12px'
          }}>
            <button
              onClick={() => setActiveTab('episodes')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '1rem',
                fontWeight: 700,
                color: activeTab === 'episodes' ? 'var(--accent)' : 'var(--text-muted)',
                position: 'relative',
              }}
            >
              <Tv size={18} />
              Episódios ({episodesCount})
            </button>

            {anime.trailer?.embed_url && (
              <button
                onClick={() => setActiveTab('trailer')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: activeTab === 'trailer' ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <Film size={18} />
                Trailer Oficial
              </button>
            )}
          </div>

          {/* Conteúdo da Tab */}
          {activeTab === 'episodes' && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '10px',
                maxHeight: '340px',
                overflowY: 'auto',
                paddingRight: '6px'
              }}>
                {Array.from({ length: episodesCount }, (_, i) => i + 1).map((ep) => {
                  const isCurrent = savedProgress?.currentEpisode === ep;
                  const isDone = savedProgress?.completed && savedProgress?.currentEpisode >= ep;

                  return (
                    <button
                      key={ep}
                      onClick={() => onPlayEpisode(anime, ep)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: isCurrent ? 'var(--accent-subtle)' : 'var(--bg-card)',
                        border: isCurrent ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
                        color: isCurrent ? 'var(--accent)' : 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontWeight: 600,
                        fontSize: '0.86rem',
                        transition: 'all 0.2s',
                        textAlign: 'left'
                      }}
                      className="episode-btn"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Play size={13} fill={isCurrent ? 'currentColor' : 'none'} />
                        <span>Ep. {ep}</span>
                      </div>
                      {isDone && <Check size={14} color="#10b981" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'trailer' && anime.trailer?.embed_url && (
            <div style={{
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: '#000',
            }}>
              <iframe
                src={anime.trailer.embed_url}
                title="Trailer"
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

        </div>
      </div>

      <style>{`
        @media (max-width: 680px) {
          .detail-header-flex {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
          }
          .detail-header-flex > div {
            padding-top: 0 !important;
          }
        }
        .episode-btn:hover {
          background: var(--bg-card-hover) !important;
          border-color: rgba(255,255,255,0.2) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
