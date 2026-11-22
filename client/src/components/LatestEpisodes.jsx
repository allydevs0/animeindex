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

export default function LatestEpisodes({ schedule, onAnimeClick }) {
  if (!schedule || schedule.length === 0) return null;

  return (
    <section className="latest-episodes-section">
      <div className="section-header">
        <h2 className="section-title">
          <i className="fa-solid fa-calendar-day section-icon" style={{ marginRight: '8px', color: 'var(--accent)' }}></i>
          Lançamentos de Hoje (Jikan)
        </h2>
        <span className="section-badge" style={{ background: 'var(--accent)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '12px' }}>{schedule.length}</span>
      </div>

      <div className="latest-episodes-row">
        {schedule.map((anime, i) => (
          <div
            key={`jikan-${anime.mal_id}-${i}`}
            className="latest-ep-card"
            onClick={() => onAnimeClick(anime)}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <div className="latest-ep-cover">
              <img
                src={anime.cover_url}
                alt={anime.title}
                loading="lazy"
                onError={(e) => {
                  e.target.src = `https://via.placeholder.com/160x240/12121a/9090b0?text=${encodeURIComponent(anime.title?.slice(0, 10) || '?')}`;
                }}
              />
              <div className="latest-ep-overlay">
                <div className="latest-ep-play-icon">
                  <i className="fa-solid fa-info" style={{ color: 'white' }}></i>
                </div>
              </div>
            </div>
            <div className="latest-ep-info">
              <div className="latest-ep-anime" style={{ fontWeight: '600' }}>{anime.title}</div>
              <div className="latest-ep-number" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                {anime.episodes ? `${anime.episodes} Episódios` : 'Em Lançamento'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
