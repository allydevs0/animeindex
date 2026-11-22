import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Star, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { AnimeApi, getSafePoster, BACKEND_URL } from '../services/api.js';

const QUICK_GENRES = [
  'Ação', 'Aventura', 'Comédia', 'Drama', 'Fantasia', 'Romance', 'Sci-Fi', 'Suspense'
];

export default function SearchModal({ 
  isOpen, 
  onClose, 
  onSelectAnime 
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Foco no input ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Busca com debounce de 350ms
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await AnimeApi.search(query);
        setResults(data);
      } catch (err) {
        console.error('[Search] Erro ao buscar animes:', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '80px' }}>
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          borderRadius: 'var(--radius-xl)',
          background: 'rgba(18, 21, 32, 0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
          overflow: 'hidden'
        }}
      >
        {/* Barra de Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <Search size={22} color="var(--accent)" />
          
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite o nome do anime, gênero ou estúdio..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '1.1rem',
              fontWeight: 500,
            }}
          />

          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ color: 'var(--text-muted)', padding: '4px' }}
            >
              <X size={18} />
            </button>
          )}

          <button
            onClick={onClose}
            className="btn-icon"
            style={{ width: '32px', height: '32px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Sugestões de Gênero Rápido */}
        <div style={{ padding: '12px 24px', display: 'flex', gap: '8px', overflowX: 'auto', borderBottom: '1px solid var(--border-subtle)' }}>
          {QUICK_GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => setQuery(genre)}
              style={{
                fontSize: '0.78rem',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                background: query === genre ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                color: query === genre ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                border: '1px solid var(--border-subtle)',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* Resultados da Busca */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '12px' }}>
          {loading && (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Pesquisando no catálogo...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhum anime encontrado para "{query}". Tente outro termo!
            </div>
          )}

          {!loading && !query && (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <Sparkles size={28} color="var(--accent)" style={{ margin: '0 auto 10px' }} />
              <p>Comece a digitar para encontrar milhares de animes instantaneamente.</p>
            </div>
          )}

          {!loading && results.map((anime) => (
            <div
              key={anime.mal_id || anime.slug}
              onClick={() => {
                onSelectAnime(anime);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              className="search-result-item"
            >
              <img
                src={getSafePoster(anime)}
                alt={anime.title}
                onError={(e) => {
                  const slug = anime.slug || anime.id || anime.mal_id;
                  const fallback = slug ? `${BACKEND_URL}/api/cover/${slug}` : 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/default.jpg';
                  if (e.target.src !== fallback) {
                    e.target.src = fallback;
                  }
                }}
                style={{
                  width: '46px',
                  height: '64px',
                  borderRadius: '6px',
                  objectFit: 'cover',
                  background: '#000',
                  flexShrink: 0,
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {anime.title}
                </h4>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {anime.score && (
                    <span className="badge-score" style={{ padding: '1px 6px' }}>
                      <Star size={10} fill="currentColor" /> {Number(anime.score).toFixed(1)}
                    </span>
                  )}
                  {anime.year && <span>{anime.year}</span>}
                  <span>{(anime.genres || []).slice(0, 2).join(', ')}</span>
                </div>
              </div>

              <ArrowRight size={16} color="var(--text-muted)" />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .search-result-item:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }
      `}</style>
    </div>
  );
}
