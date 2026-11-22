import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Star, Play } from 'lucide-react';
import { AnimeApi } from '../services/api.js';

const DAYS = [
  { id: 'monday', label: 'Segunda-feira', short: 'Seg' },
  { id: 'tuesday', label: 'Terça-feira', short: 'Ter' },
  { id: 'wednesday', label: 'Quarta-feira', short: 'Qua' },
  { id: 'thursday', label: 'Quinta-feira', short: 'Qui' },
  { id: 'friday', label: 'Sexta-feira', short: 'Sex' },
  { id: 'saturday', label: 'Sábado', short: 'Sáb' },
  { id: 'sunday', label: 'Domingo', short: 'Dom' },
];

export default function ScheduleSection({ 
  onSelectAnime, 
  onQuickPlay 
}) {
  // Detecta o dia atual da semana em inglês para a API do Jikan
  const currentDayIndex = (new Date().getDay() + 6) % 7; // Monday = 0
  const [selectedDay, setSelectedDay] = useState(DAYS[currentDayIndex].id);
  const [scheduleData, setScheduleData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    async function loadSchedule() {
      try {
        const data = await AnimeApi.getSchedules(selectedDay);
        if (!isCancelled) {
          setScheduleData(data);
        }
      } catch (err) {
        console.error('[Schedule] Erro ao carregar calendário:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadSchedule();
    return () => { isCancelled = true; };
  }, [selectedDay]);

  return (
    <div className="content-wrapper" style={{ paddingTop: '30px' }}>
      <div className="section-header" style={{ marginTop: '0' }}>
        <h2 className="section-title">
          <Calendar size={24} />
          Calendário Semanal de Lançamentos
        </h2>
        <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Horários de transmissão no Japão
        </span>
      </div>

      {/* Tabs de Dias da Semana */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '28px', paddingBottom: '6px' }}>
        {DAYS.map((d, idx) => {
          const isToday = idx === currentDayIndex;
          const isSelected = selectedDay === d.id;

          return (
            <button
              key={d.id}
              onClick={() => setSelectedDay(d.id)}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                background: isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                color: isSelected ? '#fff' : 'var(--text-secondary)',
                fontWeight: isSelected ? 700 : 500,
                fontSize: '0.9rem',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{d.label}</span>
              {isToday && (
                <span style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: isSelected ? 'rgba(0,0,0,0.3)' : 'rgba(16, 185, 129, 0.2)',
                  color: isSelected ? '#fff' : '#10b981',
                  fontWeight: 700,
                }}>
                  HOJE
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Estado de Carregamento */}
      {loading && (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Atualizando lançamentos...
        </div>
      )}

      {/* Grid de Animes do Dia */}
      {!loading && (
        <div className="anime-grid">
          {scheduleData.map((anime) => (
            <div
              key={anime.mal_id || anime.slug}
              onClick={() => onSelectAnime(anime)}
              className="anime-card-modern"
            >
              <div className="card-poster-wrapper">
                <img
                  src={anime.cover_url}
                  alt={anime.title}
                  className="card-poster"
                />

                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  zIndex: 5
                }}>
                  <span className="badge-airing">
                    <span className="pulse-dot" /> On Air
                  </span>
                </div>
              </div>

              <div className="card-info">
                <h4 className="card-title">{anime.title}</h4>
                <div className="card-meta">
                  {anime.score && (
                    <span className="badge-score">
                      <Star size={10} fill="currentColor" /> {Number(anime.score).toFixed(1)}
                    </span>
                  )}
                  <span>{anime.broadcast?.time || 'Semanal'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
