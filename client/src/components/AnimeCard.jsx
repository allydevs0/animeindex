import React, { useState, useEffect } from 'react';
import { Play, Star, Bookmark, Check } from 'lucide-react';
import { StorageService } from '../services/storage.js';
import { getSafePoster, BACKEND_URL } from '../services/api.js';

export default function AnimeCard({ 
  anime, 
  onClick, 
  onQuickPlay,
  onToast 
}) {
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    if (!anime) return;
    const status = StorageService.getWatchlistStatus(anime.slug || anime.mal_id);
    setInWatchlist(!!status);
  }, [anime]);

  const handleBookmark = (e) => {
    e.stopPropagation();
    if (inWatchlist) {
      StorageService.setWatchlistStatus(anime, 'none');
      setInWatchlist(false);
      onToast?.('Removido da sua lista', 'info');
    } else {
      StorageService.setWatchlistStatus(anime, 'favorite');
      setInWatchlist(true);
      onToast?.('Adicionado aos favoritos!', 'success');
    }
  };

  const handlePlay = (e) => {
    e.stopPropagation();
    if (onQuickPlay) {
      onQuickPlay(anime, 1);
    } else {
      onClick?.(anime);
    }
  };

  const poster = getSafePoster(anime);

  return (
    <div 
      className="anime-card-modern"
      onClick={() => onClick?.(anime)}
    >
      <div className="card-poster-wrapper">
        <img
          src={poster}
          alt={anime.title}
          loading="lazy"
          className="card-poster"
          onError={(e) => {
            const slug = anime.slug || anime.id || anime.mal_id;
            const fallback = slug ? `${BACKEND_URL}/api/cover/${slug}` : 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/default.jpg';
            if (e.target.src !== fallback) {
              e.target.src = fallback;
            }
          }}
        />

        {/* Badges superiores flutuantes */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 5,
        }}>
          {anime.score ? (
            <span className="badge-score" style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.65)' }}>
              <Star size={11} fill="currentColor" /> {Number(anime.score).toFixed(1)}
            </span>
          ) : <span />}

          <button
            onClick={handleBookmark}
            title={inWatchlist ? "Salvo na lista" : "Salvar na lista"}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: inWatchlist ? 'var(--accent)' : 'rgba(0,0,0,0.65)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(6px)',
              transition: 'all 0.2s',
            }}
          >
            {inWatchlist ? <Check size={14} /> : <Bookmark size={14} />}
          </button>
        </div>

        {/* Overlay no hover com botão play */}
        <div className="card-overlay">
          <div className="card-play-btn" onClick={handlePlay} title="Assistir Agora">
            <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'auto' }}>
            {(anime.genres || []).slice(0, 2).map((g, i) => (
              <span 
                key={i} 
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(4px)',
                  color: '#fff',
                  fontWeight: 600
                }}
              >
                {typeof g === 'string' ? g : g.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card-info">
        <h4 className="card-title" title={anime.title}>
          {anime.title}
        </h4>
        <div className="card-meta">
          <span>{anime.year || (anime.airing ? 'Em exibição' : 'Anime')}</span>
          <span>
            {anime.episodes ? `${anime.episodes} eps` : (anime.episodes_count ? `${anime.episodes_count} eps` : 'Multi')}
          </span>
        </div>
      </div>
    </div>
  );
}
