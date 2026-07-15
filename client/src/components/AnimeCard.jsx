import React from 'react';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export default function AnimeCard({ anime, onClick }) {
  const hasNewEp = anime.lastEpisodeAddedAt &&
    (Date.now() - new Date(anime.lastEpisodeAddedAt).getTime()) < TWENTY_FOUR_HOURS;

  return (
    <div className="anime-card" onClick={() => onClick(anime)} id={`anime-card-${anime.slug}`}>
      <div className="anime-card-cover">
        <img
          src={anime.cover_url}
          alt={anime.title}
          loading="lazy"
          onError={(e) => {
            e.target.src = `https://via.placeholder.com/160x240/12121a/9090b0?text=${encodeURIComponent(anime.title?.slice(0, 10) || '?')}`;
          }}
        />
        <div className="anime-card-overlay">
          <div className="anime-card-play">▶</div>
        </div>

        {/* Badges (top-left) */}
        <div className="anime-card-badges">
          {anime.airing && (
            <span className="badge badge-airing">
              <span className="dot" />
              On air
            </span>
          )}
          {anime.lazy && !anime.airing && (
            <span className="badge badge-lazy">Lazy</span>
          )}
        </div>

        {/* NEW episode badge (bottom-right, pulsing) */}
        {hasNewEp && (
          <span className="badge-new--card">NOVO</span>
        )}
      </div>

      <div className="anime-card-info">
        <div className="anime-card-title">{anime.title}</div>
        {anime.episodes_count != null && (
          <div className="anime-card-eps">
            {anime.episodes_count} ep{anime.episodes_count !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
