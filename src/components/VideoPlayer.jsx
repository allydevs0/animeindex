import React, { useEffect, useRef, useState } from 'react';

export default function VideoPlayer({ src, onEnded, type = 'video' }) {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);

    if (!src) return;

    // Check if HLS
    const isHls = src.includes('.m3u8');

    if (isHls && videoRef.current) {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setLoading(false);
            videoRef.current?.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              setError(true);
              setLoading(false);
            }
          });
          return () => hls.destroy();
        } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
          videoRef.current.src = src;
          videoRef.current.addEventListener('loadedmetadata', () => setLoading(false));
        }
      });
    } else if (videoRef.current) {
      videoRef.current.src = src;
      videoRef.current.addEventListener('loadeddata', () => setLoading(false));
    }
  }, [src]);

  if (type === 'iframe') {
    return (
      <iframe
        src={src}
        allowFullScreen
        title="Video Player"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    );
  }

  return (
    <>
      {loading && !error && (
        <div className="player-loading">
          <div className="spinner" />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>Carregando vídeo...</p>
        </div>
      )}
      {error && (
        <div className="player-loading">
          <p style={{ color: '#ff4d7f', fontSize: '0.875rem' }}>❌ Erro ao carregar o vídeo</p>
        </div>
      )}
      <video
        ref={videoRef}
        controls
        onEnded={onEnded}
        onPlay={() => setLoading(false)}
        style={{ width: '100%', height: '100%', display: loading && !error ? 'none' : 'block' }}
      />
    </>
  );
}
