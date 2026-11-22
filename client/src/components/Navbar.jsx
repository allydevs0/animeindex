import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Search, 
  Bookmark, 
  Calendar, 
  Flame, 
  Settings, 
  Menu, 
  X,
  Tv,
  Sparkles
} from 'lucide-react';

export default function Navbar({ 
  currentTab, 
  setCurrentTab, 
  onOpenSearch, 
  onOpenSettings,
  userProfile 
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'home', label: 'Início', icon: Play },
    { id: 'airing', label: 'Em Exibição', icon: Tv },
    { id: 'popular', label: 'Mais Votados', icon: Flame },
    { id: 'watchlist', label: 'Minha Lista', icon: Bookmark },
    { id: 'schedule', label: 'Calendário', icon: Calendar },
  ];

  return (
    <nav className={`glass-nav ${scrolled ? 'glass-nav-scrolled' : ''}`}>
      <div className="content-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>
        
        {/* Logo */}
        <div 
          onClick={() => { setCurrentTab('home'); setMobileMenuOpen(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent) 0%, #be123c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(244, 63, 94, 0.45)',
          }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              Anime<span style={{ color: 'var(--accent)' }}>Index</span>
            </span>
          </div>
        </div>

        {/* Links Desktop */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="desktop-nav-links">
          {navLinks.map(({ id, label, icon: Icon }) => {
            const active = currentTab === id;
            return (
              <button
                key={id}
                onClick={() => setCurrentTab(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.9rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  background: active ? 'rgba(244, 63, 94, 0.15)' : 'transparent',
                  border: active ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={16} color={active ? 'var(--accent)' : 'currentColor'} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Ações da Direita */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* Botão de Pesquisa com atalho Ctrl+K */}
          <button
            onClick={onOpenSearch}
            className="search-trigger-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              fontSize: '0.86rem',
              transition: 'all 0.2s',
            }}
          >
            <Search size={16} />
            <span className="search-text-desktop">Buscar animes...</span>
            <kbd style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontFamily: 'monospace'
            }}>⌘K</kbd>
          </button>

          {/* Botão de Perfil / Configurações / Backup */}
          <button
            onClick={onOpenSettings}
            title="Configurações e Backup de Dados"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 8px 4px 4px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              transition: 'all 0.2s',
            }}
          >
            <img
              src={userProfile?.avatar || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=80&auto=format&fit=crop&q=80'}
              alt="Avatar"
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <Settings size={16} color="var(--text-secondary)" style={{ marginRight: '4px' }} />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ color: 'var(--text-main)', padding: '6px' }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Menu Mobile Dropdown */}
      {mobileMenuOpen && (
        <div style={{
          background: 'rgba(11, 13, 20, 0.98)',
          borderBottom: '1px solid var(--border-default)',
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {navLinks.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setCurrentTab(id); setMobileMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                color: currentTab === id ? 'var(--accent)' : 'var(--text-main)',
                background: currentTab === id ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
                fontWeight: 600,
                fontSize: '1rem',
                textAlign: 'left'
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 820px) {
          .desktop-nav-links { display: none !important; }
          .search-text-desktop { display: none; }
          .mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 821px) {
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
