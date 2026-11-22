import React, { useState, useRef } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  Trash2, 
  ShieldCheck, 
  Sparkles, 
  User, 
  Check, 
  Sliders 
} from 'lucide-react';
import { StorageService } from '../services/storage.js';

const ANIME_AVATARS = [
  { name: 'Tanjiro', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80' },
  { name: 'Frieren', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80' },
  { name: 'Luffy', url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=150&auto=format&fit=crop&q=80' },
  { name: 'Gojo', url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=150&auto=format&fit=crop&q=80' },
  { name: 'Jin-woo', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80' },
];

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  userProfile, 
  onUpdateProfile, 
  onToast 
}) {
  const [name, setName] = useState(userProfile?.name || 'Otaku');
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile?.avatar || ANIME_AVATARS[0].url);
  const [settings, setSettings] = useState(() => StorageService.getSettings());

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
    const updated = StorageService.saveProfile({
      name: name.trim() || 'Otaku',
      avatar: selectedAvatar,
    });
    onUpdateProfile?.(updated);
    onToast?.('Perfil salvo com sucesso!', 'success');
  };

  const handleToggleSetting = (key) => {
    const updated = StorageService.saveSettings({ [key]: !settings[key] });
    setSettings(updated);
  };

  const handleExportBackup = () => {
    StorageService.exportBackup();
    onToast?.('Backup JSON gerado e baixado!', 'success');
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const result = StorageService.importBackup(content);
        if (result.ok) {
          onToast?.('Backup restaurado com sucesso! Recarregando...', 'success');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          onToast?.(result.error || 'Falha ao restaurar arquivo', 'error');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (window.confirm('Tem certeza que deseja apagar todo o seu histórico e lista de animes deste dispositivo?')) {
      StorageService.clearAll();
      onToast?.('Dados apagados com sucesso.', 'info');
      setTimeout(() => window.location.reload(), 800);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '620px',
          padding: '28px',
          borderRadius: 'var(--radius-xl)',
          background: 'rgba(18, 21, 32, 0.98)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={22} color="var(--accent)" />
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>
              Configurações & Backup
            </h3>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Seção de Perfil */}
        <div style={{
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px'
        }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} color="var(--accent)" />
            Seu Perfil
          </h4>

          {/* Seleção de Avatares */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
            {ANIME_AVATARS.map((av) => {
              const isSelected = selectedAvatar === av.url;
              return (
                <div
                  key={av.name}
                  onClick={() => setSelectedAvatar(av.url)}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    border: isSelected ? '3px solid var(--accent)' : '2px solid transparent',
                    boxShadow: isSelected ? '0 0 14px var(--accent)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <img
                    src={av.url}
                    alt={av.name}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      background: 'var(--accent)',
                      borderRadius: '50%',
                      padding: '2px',
                      color: '#fff',
                      display: 'flex'
                    }}>
                      <Check size={10} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Nome de Usuário */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu apelido..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-default)',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSaveProfile}
              className="btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.88rem' }}
            >
              Salvar
            </button>
          </div>
        </div>

        {/* Seção de Persistência & Backup (Sem Supabase!) */}
        <div style={{
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <ShieldCheck size={18} color="#10b981" />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
              Persistência Privada & Resiliente
            </h4>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
            Seus dados (favoritos, episódios assistidos e histórico) são salvos com segurança diretamente no seu dispositivo, sem depender de banco de dados externo sujeito a resets ou limites de requisições.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportBackup}
              className="btn-secondary"
              style={{ flex: '1 1 180px', padding: '10px 16px', fontSize: '0.85rem' }}
            >
              <Download size={16} />
              Exportar Backup (.json)
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
              style={{ flex: '1 1 180px', padding: '10px 16px', fontSize: '0.85rem' }}
            >
              <Upload size={16} />
              Importar Backup (.json)
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Preferências do Player */}
        <div style={{
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px'
        }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
            Preferências do Reprodutor
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Próximo episódio automático (Autoplay)</span>
              <input
                type="checkbox"
                checked={settings.autoplay}
                onChange={() => handleToggleSetting('autoplay')}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>Luz ambiente (Ambient Glow)</span>
              <input
                type="checkbox"
                checked={settings.ambientGlow}
                onChange={() => handleToggleSetting('ambientGlow')}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
              />
            </label>
          </div>
        </div>

        {/* Zona de Perigo / Limpeza */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClearData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#f87171',
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)'
            }}
          >
            <Trash2 size={14} />
            Apagar dados locais
          </button>
        </div>

      </div>
    </div>
  );
}
