import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  SkipForward, 
  SkipBack, 
  Settings, 
  Maximize, 
  Volume2, 
  VolumeX, 
  Server, 
  Sparkles, 
  List, 
  Check 
} from 'lucide-react';
import { StorageService } from '../services/storage.js';
import { AnimeApi } from '../services/api.js';

export default function VideoPlayerView({ 
  anime, 
  initialEpisode = 1, 
  onBack, 
  onToast 
}) {
  const [episode, setEpisode] = useState(initialEpisode);
  const [videoSource, setVideoSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  const [ambientLight, setAmbientLight] = useState(true);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const lastSaveTime = useRef(0);

  const totalEpisodes = anime.episodes || anime.episodes_count || 12;

  // Carrega fonte de vídeo para o episódio atual
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    async function loadStream() {
      try {
        const source = await AnimeApi.getVideoSource(anime, episode);
        if (isCancelled) return;
        setVideoSource(source);
      } catch (err) {
        if (isCancelled) return;
        console.error('[Player] Erro ao carregar stream:', err);
        setError(err.message || 'Não foi possível carregar o vídeo para este episódio.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadStream();

    return () => {
      isCancelled = true;
    };
  }, [anime, episode]);

  // Configuração do reprodutor HLS / MP4
  useEffect(() => {
    if (!videoSource || videoSource.type === 'iframe') return;

    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const src = videoSource.url;
    const isHls = src.includes('.m3u8') || videoSource.type === 'hls';

    // Recupera progresso salvo para retomar de onde parou
    const saved = StorageService.getAnimeProgress(anime.slug || anime.mal_id);
    const resumeTime = (saved && saved.currentEpisode === episode) ? saved.currentTime : 0;

    if (isHls) {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(videoEl);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (resumeTime > 0) videoEl.currentTime = resumeTime;
            videoEl.play().catch(() => {});
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              console.warn('[Player HLS Error]:', data);
            }
          });
        } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
          videoEl.src = src;
          videoEl.addEventListener('loadedmetadata', () => {
            if (resumeTime > 0) videoEl.currentTime = resumeTime;
            videoEl.play().catch(() => {});
          });
        }
      });
    } else {
      videoEl.src = src;
      videoEl.addEventListener('loadedmetadata', () => {
        if (resumeTime > 0) videoEl.currentTime = resumeTime;
        videoEl.play().catch(() => {});
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoSource, episode, anime]);

  // Atualização de progresso e persistência automática a cada 5s
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    const now = Date.now();
    if (now - lastSaveTime.current > 5000) {
      lastSaveTime.current = now;
      StorageService.saveProgress(anime, episode, video.currentTime, video.duration);
    }
  }, [anime, episode]);

  // Término do episódio -> Avança para o próximo se disponível
  const handleEnded = () => {
    StorageService.saveProgress(anime, episode, videoRef.current?.duration || 0, videoRef.current?.duration || 0);
    if (episode < totalEpisodes) {
      onToast?.(`Episódio ${episode} concluído! Avançando para o episódio ${episode + 1}...`, 'info');
      setEpisode(prev => prev + 1);
    } else {
      onToast?.('Você concluiu todos os episódios disponíveis deste anime!', 'success');
    }
  };

  // Atalhos de teclado (Espaço, Setas, F, M, N)
  useEffect(() => {
    const handleKey = (e) => {
      // Ignora se estiver digitando em input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const video = videoRef.current;
      if (!video) return;

      if (e.code === 'Space') {
        e.preventDefault();
        video.paused ? video.play() : video.pause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          video.requestFullscreen().catch(() => {});
        }
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        video.muted = !video.muted;
      } else if (e.code === 'KeyN' && episode < totalEpisodes) {
        e.preventDefault();
        setEpisode(prev => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [episode, totalEpisodes]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', paddingBottom: '60px' }}>
      
      {/* Barra de Controle Superior do Player */}
      <div style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(7, 8, 12, 0.9)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backdropFilter: 'blur(16px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            className="btn-secondary"
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-full)' }}
          >
            <ArrowLeft size={18} />
            Voltar
          </button>

          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              {anime.title}
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>
              Episódio {episode} de {totalEpisodes}
            </span>
          </div>
        </div>

        {/* Controles de Navegação de Episódio e Ambient Light */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            disabled={episode <= 1}
            onClick={() => setEpisode(prev => Math.max(1, prev - 1))}
            className="btn-icon"
            title="Episódio Anterior"
            style={{ opacity: episode <= 1 ? 0.4 : 1 }}
          >
            <SkipBack size={18} />
          </button>

          <button
            disabled={episode >= totalEpisodes}
            onClick={() => setEpisode(prev => Math.min(totalEpisodes, prev + 1))}
            className="btn-icon"
            title="Próximo Episódio (N)"
            style={{ opacity: episode >= totalEpisodes ? 0.4 : 1 }}
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={() => setShowEpisodeList(!showEpisodeList)}
            className="btn-secondary"
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}
          >
            <List size={16} />
            Lista de Episódios
          </button>
        </div>
      </div>

      {/* Área Central do Reprodutor de Vídeo */}
      <div className="content-wrapper" style={{ marginTop: '24px' }}>
        <div style={{ position: 'relative' }}>
          
          {/* Efeito Ambient Glow Suave */}
          {ambientLight && (
            <div 
              className="ambient-glow"
              style={{
                background: `radial-gradient(circle, var(--accent) 0%, #3b82f6 50%, transparent 80%)`,
              }}
            />
          )}

          {/* Container do Vídeo */}
          <div className="video-player-container" style={{ aspectRatio: '16 / 9', width: '100%' }}>
            
            {loading && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                background: '#000',
                zIndex: 20
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.1)',
                  borderTopColor: 'var(--accent)',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Carregando transmissão...
                </span>
              </div>
            )}

            {error && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                background: '#0a0a0f',
                color: '#f43f5e',
                zIndex: 20,
                padding: '20px',
                textAlign: 'center'
              }}>
                <p style={{ fontWeight: 600 }}>{error}</p>
                <button 
                  onClick={() => setEpisode(episode)} 
                  className="btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  Tentar Novamente
                </button>
              </div>
            )}

            {videoSource?.type === 'iframe' ? (
              <iframe
                src={videoSource.url}
                title="Player de Vídeo"
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                controls
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}
          </div>
        </div>

        {/* Informações e Seletor Abaixo do Player */}
        <div style={{ marginTop: '28px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          
          <div style={{ flex: '1 1 500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>
                  {anime.title} — Episódio {episode}
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {anime.status} • {anime.studios?.join(', ') || 'Estúdio oficial'}
                </span>
              </div>

              {/* Tag de Servidor Ativo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontSize: '0.78rem',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)'
                }}>
                  Servidor: {videoSource?.server || 'Auto Stream'}
                </span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              {anime.synopsis}
            </p>

            {/* Dica de Atalhos de Teclado */}
            <div style={{
              marginTop: '20px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}>
              <span><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '4px' }}>Espaço</kbd> Play/Pause</span>
              <span><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '4px' }}>← / →</kbd> Voltar/Avançar 10s</span>
              <span><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '4px' }}>F</kbd> Tela Cheia</span>
              <span><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '4px' }}>M</kbd> Mutar</span>
              <span><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '4px' }}>N</kbd> Próximo Episódio</span>
            </div>
          </div>

          {/* Lista Lateral de Episódios */}
          <div style={{
            flex: '0 0 320px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
            maxHeight: '440px',
            overflowY: 'auto'
          }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '14px', color: '#fff' }}>
              Todos os Episódios ({totalEpisodes})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((epNum) => {
                const isSelected = epNum === episode;
                return (
                  <button
                    key={epNum}
                    onClick={() => setEpisode(epNum)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid var(--border-accent)' : '1px solid transparent',
                      color: isSelected ? 'var(--accent)' : 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>Episódio {epNum}</span>
                    {isSelected && <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Assistindo</span>}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
