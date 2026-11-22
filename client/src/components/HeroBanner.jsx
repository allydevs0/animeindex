import React, { useState, useEffect } from 'react';
import { Play, Info, Bookmark, Star, Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { StorageService } from '../services/storage.js';
import { getSafeBanner } from '../services/api.js';

export default function HeroBanner({ 
  featuredAnimes = [], 
  onPlay, 
  onSelectAnime,
  onToast 
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inWatchlist, setInWatchlist] = useState(false);

  const currentAnime = featuredAnimes[currentIndex] || featuredAnimes[0];

  useEffect(() => {
    if (!currentAnime) return;
    const status = StorageService.getWatchlistStatus(currentAnime.slug || currentAnime.mal_id);
    setInWatchlist(!!status);
  }, [currentAnime]);

  // Rotação automática suave a cada 9 segundos
  useEffect(() => {
    if (featuredAnimes.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredAnimes.length);
    }, 9000);
    return () => clearInterval(interval);
  }, [featuredAnimes.length]);

  if (!currentAnime) return null;

  const toggleWatchlist = () => {
    const key = currentAnime.slug || currentAnime.mal_id;
    if (inWatchlist) {
      StorageService.setWatchlistStatus(currentAnime, 'none');
      setInWatchlist(false);
      onToast?.('Removido da sua lista', 'info');
    } else {
      StorageService.setWatchlistStatus(currentAnime, 'plan_to_watch');
      setInWatchlist(true);
      onToast?.('Adicionado à sua lista!', 'success');
    }
  };

  const bannerImg = getSafeBanner(currentAnime);

  return (
    <div style={{
      position: 'relative',
      minHeight: '520px',
      maxHeight: '640px',
      height: '65vh',
      width: '100%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
    }}>
      {/* Imagem de Fundo com Fade Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${bannerImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 25%',
        filter: 'brightness(0.65) saturate(1.2)',
        transform: 'scale(1.03)',
        transition: 'all 0.75s ease-in-out',
      }} />

      {/* Gradientes de escurecimento para leitura perfeita */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          linear-gradient(to top, var(--bg-deep) 0%, rgba(7, 8, 12, 0.6) 40%, transparent 100%),
          linear-gradient(to right, var(--bg-deep) 0%, rgba(7, 8, 12, 0.85) 45%, transparent 100%)
        `,
      }} />

      {/* Conteúdo do Hero */}
      <div className="content-wrapper" style={{ position: 'relative', zIndex: 10, width: '100%' }}>
        <div style={{ maxWidth: '680px' }}>
          
          {/* Badges superiores */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            {currentAnime.title_japanese && (
              <span style={{ 
                fontFamily: 'serif', 
                color: 'var(--accent)', 
                fontSize: '0.95rem',
                letterSpacing: '0.1em',
                fontWeight: 600
              }}>
                {currentAnime.title_japanese}
              </span>
            )}
            {currentAnime.score && (
              <span className="badge-score">
                <Star size={12} fill="currentColor" /> {Number(currentAnime.score).toFixed(1)} MAL
              </span>
            )}
            {currentAnime.year && (
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                fontSize: '0.8rem', 
                color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.08)',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                <Calendar size={12} /> {currentAnime.year}
              </span>
            )}
            {currentAnime.status === 'Currently Airing' && (
              <span className="badge-airing">
                <span className="pulse-dot" /> Lançamento
              </span>
            )}
          </div>

          {/* Título */}
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.4rem)',
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: '16px',
            color: '#ffffff',
            textShadow: '0 4px 20px rgba(0,0,0,0.8)'
          }}>
            {currentAnime.title}
          </h1>

          {/* Gêneros */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {(currentAnime.genres || []).slice(0, 4).map((g, i) => (
              <span key={i} className="genre-pill">
                {typeof g === 'string' ? g : g.name}
              </span>
            ))}
          </div>

          {/* Sinopse resumida */}
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            marginBottom: '28px',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '600px',
            textShadow: '0 2px 10px rgba(0,0,0,0.8)'
          }}>
            {currentAnime.synopsis}
          </p>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onPlay(currentAnime, 1)}
              className="btn-primary"
              style={{ padding: '12px 28px', fontSize: '1rem' }}
            >
              <Play size={20} fill="currentColor" />
              Assistir Episódio 1
            </button>

            <button
              onClick={() => onSelectAnime(currentAnime)}
              className="btn-secondary"
              style={{ padding: '12px 24px', fontSize: '1rem' }}
            >
              <Info size={18} />
              Mais Detalhes
            </button>

            <button
              onClick={toggleWatchlist}
              className="btn-icon"
              title={inWatchlist ? "Salvo na sua lista" : "Salvar na lista"}
              style={{
                width: '46px',
                height: '46px',
                background: inWatchlist ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255,255,255,0.08)',
                color: inWatchlist ? 'var(--accent)' : 'var(--text-main)',
                borderColor: inWatchlist ? 'var(--border-accent)' : 'var(--border-default)',
              }}
            >
              {inWatchlist ? <Check size={20} /> : <Bookmark size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Controles de Navegação do Carrossel (Setas) */}
      {featuredAnimes.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + featuredAnimes.length) % featuredAnimes.length)}
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 20,
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s',
            }}
          >
            <ChevronLeft size={24} />
          </button>

          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % featuredAnimes.length)}
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 20,
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s',
            }}
          >
            <ChevronRight size={24} />
          </button>

          {/* Indicadores de bolinha na parte inferior */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            right: '40px',
            zIndex: 20,
            display: 'flex',
            gap: '8px'
          }}>
            {featuredAnimes.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                style={{
                  width: currentIndex === idx ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: currentIndex === idx ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: currentIndex === idx ? '0 0 10px var(--accent)' : 'none',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
