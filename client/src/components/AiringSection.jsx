import React from 'react';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days}d atrás`;
  return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function AiringSection({ animes, onSelect }) {
  if (!animes || animes.length === 0) return null;

  return (
    <section className="airing-section">
      <div className="section-header">
        <h2 className="section-title">
          <span className="section-icon">📡</span>
          Em Lançamento
        </h2>
        <span className="section-badge">{animes.length} animes</span>
      </div>

      <div className="airing-row">
        {animes.map((anime) => {
          const hasNewEp = anime.hasNewEpisode ||
            (anime.lastEpisodeAddedAt &&
              (Date.now() - new Date(anime.lastEpisodeAddedAt).getTime()) < TWENTY_FOUR_HOURS);

          return (
            <div
              key={anime.slug}
              className="airing-card"
              onClick={() => onSelect(anime)}
              id={`airing-card-${anime.slug}`}
            >
              <div className="airing-card-cover">
                <img
                  src={anime.cover_url}
                  alt={anime.title}
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = `https://via.placeholder.com/220x293/12121a/9090b0?text=${encodeURIComponent(anime.title?.slice(0, 10) || '?')}`;
                  }}
                />

                {hasNewEp && (
                  <div className="airing-badge-new">NOVO EP</div>
                )}

                <div className="airing-card-gradient">
                  <div className="airing-card-status">
                    <span className="airing-dot" />
                    Em exibição
                  </div>
                  <div className="airing-card-title">{anime.title}</div>
                  <div className="airing-card-meta">
                    {anime.episodes_count != null && (
                      <div className="airing-card-meta-item">
                        <span>📺</span>
                        <span>{anime.episodes_count} ep{anime.episodes_count !== 1 ? 's' : ''} disponíveis</span>
                      </div>
                    )}
                    {anime.lastEpisodeAddedAt && (
                      <div className="airing-card-meta-item">
                        <span>🕐</span>
                        <span>Atualizado {timeAgo(anime.lastEpisodeAddedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
