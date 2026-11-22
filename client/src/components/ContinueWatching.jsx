import React from 'react';
import { Play, X, Clock } from 'lucide-react';
import { StorageService } from '../services/storage.js';
import { getSafeBanner, BACKEND_URL } from '../services/api.js';

export default function ContinueWatching({ 
  history = [], 
  onResume, 
  onRefreshHistory 
}) {
  if (!history || history.length === 0) return null;

  const handleRemove = (e, animeId) => {
    e.stopPropagation();
    StorageService.removeHistoryItem(animeId);
    onRefreshHistory?.();
  };

  return (
    <section style={{ margin: '30px 0 10px' }}>
      <div className="section-header" style={{ marginTop: '10px' }}>
        <h2 className="section-title">
          <Clock size={22} />
          Continuar Assistindo
        </h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {history.length} {history.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="scroll-row-container">
        <div className="scroll-row">
          {history.map((item) => (
            <div
              key={item.animeId}
              onClick={() => onResume(item)}
              style={{
                width: '280px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
              }}
              className="continue-card"
            >
              {/* Thumbnail com Barra de Progresso */}
              <div style={{ position: 'relative', width: '100%', height: '145px', overflow: 'hidden', background: '#000' }}>
                <img
                  src={getSafeBanner(item)}
                  alt={item.title}
                  onError={(e) => {
                    const slug = item.slug || item.animeId;
                    const fallback = slug ? `${BACKEND_URL}/api/cover/${slug}` : 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/default.jpg';
                    if (e.target.src !== fallback) {
                      e.target.src = fallback;
                    }
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                />

                {/* Botão de Excluir do Histórico */}
                <button
                  onClick={(e) => handleRemove(e, item.animeId)}
                  title="Remover do histórico"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.65)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <X size={14} />
                </button>

                {/* Ícone de Play centralizado */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.3)',
                }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 15px rgba(244, 63, 94, 0.5)',
                  }}>
                    <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />
                  </div>
                </div>

                {/* Barra de Progresso na base da imagem */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'rgba(255,255,255,0.2)',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(5, item.progressPercent || 0))}%`,
                    background: 'linear-gradient(90deg, var(--accent) 0%, #fb7185 100%)',
                    boxShadow: '0 0 8px var(--accent)',
                  }} />
                </div>
              </div>

              {/* Informações */}
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {item.title}
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)'
                }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    Episódio {item.currentEpisode || 1}
                  </span>
                  <span>
                    {item.progressPercent ? `${item.progressPercent}% assistido` : 'Iniciar'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .continue-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.2) !important;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
      `}</style>
    </section>
  );
}
