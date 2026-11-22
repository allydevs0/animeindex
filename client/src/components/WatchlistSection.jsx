import React, { useState } from 'react';
import { Bookmark, Star, Play, Trash2, Heart, CheckCircle2, Clock } from 'lucide-react';
import { StorageService } from '../services/storage.js';

export default function WatchlistSection({ 
  watchlist = [], 
  onSelectAnime, 
  onRefresh, 
  onToast 
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'watching' | 'plan_to_watch' | 'completed' | 'favorite'

  const filteredList = watchlist.filter((item) => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const handleRemove = (e, item) => {
    e.stopPropagation();
    StorageService.setWatchlistStatus(item, 'none');
    onRefresh?.();
    onToast?.('Removido da sua lista', 'info');
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'watching': return { label: 'Assistindo', color: '#3b82f6', icon: Play };
      case 'plan_to_watch': return { label: 'Quero Assistir', color: '#f59e0b', icon: Clock };
      case 'completed': return { label: 'Concluído', color: '#10b981', icon: CheckCircle2 };
      case 'favorite': return { label: 'Favorito', color: 'var(--accent)', icon: Heart };
      default: return { label: 'Salvo', color: 'var(--text-secondary)', icon: Bookmark };
    }
  };

  const tabs = [
    { id: 'all', label: 'Todos' },
    { id: 'watching', label: 'Assistindo' },
    { id: 'plan_to_watch', label: 'Quero Assistir' },
    { id: 'completed', label: 'Concluídos' },
    { id: 'favorite', label: 'Favoritos' },
  ];

  return (
    <div className="content-wrapper" style={{ paddingTop: '30px' }}>
      <div className="section-header" style={{ marginTop: '0' }}>
        <h2 className="section-title">
          <Bookmark size={24} />
          Minha Lista de Animes
        </h2>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {filteredList.length} {filteredList.length === 1 ? 'anime salvo' : 'animes salvos'}
        </span>
      </div>

      {/* Tabs de Filtro */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '28px', paddingBottom: '6px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              background: filter === tab.id ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
              color: filter === tab.id ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filteredList.length === 0 && (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          maxWidth: '500px',
          margin: '40px auto'
        }}>
          <Bookmark size={40} color="var(--text-muted)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '8px' }}>
            Sua lista está vazia
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Você ainda não salvou nenhum anime nesta categoria. Explore os lançamentos ou os animes mais votados e adicione seus favoritos!
          </p>
        </div>
      )}

      {/* Grid de Animes Salvos */}
      <div className="anime-grid">
        {filteredList.map((item) => {
          const statusInfo = getStatusLabel(item.status);
          const StatusIcon = statusInfo.icon;

          return (
            <div
              key={item.animeId}
              onClick={() => onSelectAnime(item)}
              className="anime-card-modern"
            >
              <div className="card-poster-wrapper">
                <img
                  src={item.cover_url}
                  alt={item.title}
                  className="card-poster"
                />

                {/* Status Badge */}
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(4px)',
                  color: statusInfo.color,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}>
                  <StatusIcon size={12} />
                  <span>{statusInfo.label}</span>
                </div>

                {/* Botão Remover */}
                <button
                  onClick={(e) => handleRemove(e, item)}
                  title="Remover da lista"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.65)',
                    color: '#f87171',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="card-info">
                <h4 className="card-title">{item.title}</h4>
                <div className="card-meta">
                  {item.score && (
                    <span className="badge-score">
                      <Star size={10} fill="currentColor" /> {Number(item.score).toFixed(1)}
                    </span>
                  )}
                  <span>{item.episodes_count ? `${item.episodes_count} eps` : 'Anime'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
