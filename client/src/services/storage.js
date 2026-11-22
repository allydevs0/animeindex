/**
 * storage.js — Sistema de persistência local resiliente do AnimeIndex
 * 
 * Substitui completamente bancos de dados externos vulneráveis ou frágeis (como Supabase/MongoDB)
 * para dados de usuário, histórico e favoritos.
 * 
 * Vantagens:
 * - 0 requisições a servidores externos (imune a rate limits ou esgotamento de quota)
 * - 0 risco de reset por reinício de servidor (armazenado permanentemente no cliente)
 * - 0 chaves de API expostas no frontend
 * - Sistema de Backup & Restore com 1 clique (Exportar/Importar JSON)
 */

const KEYS = {
  PROFILE: 'animeindex_profile_v2',
  HISTORY: 'animeindex_history_v2',
  WATCHLIST: 'animeindex_watchlist_v2',
  SETTINGS: 'animeindex_settings_v2',
};

const DEFAULT_PROFILE = {
  name: 'Otaku',
  avatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80',
  joinedAt: new Date().toISOString(),
};

const DEFAULT_SETTINGS = {
  autoplay: true,
  ambientGlow: true,
  autoSkipIntro: false,
  quality: 'auto',
  theme: 'dark',
};

// Safe JSON parser
function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`[Storage] Erro ao ler chave ${key}:`, err);
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[Storage] Erro ao salvar chave ${key}:`, err);
    return false;
  }
}

export const StorageService = {
  // ── Perfil do Usuário ──
  getProfile() {
    return safeGet(KEYS.PROFILE, DEFAULT_PROFILE);
  },

  saveProfile(profile) {
    const current = this.getProfile();
    const updated = { ...current, ...profile };
    safeSet(KEYS.PROFILE, updated);
    return updated;
  },

  // ── Histórico de Reprodução & Progresso ──
  getHistory() {
    const history = safeGet(KEYS.HISTORY, {});
    // Retorna ordenado pelo mais recentemente assistido
    return Object.values(history).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  getAnimeProgress(animeIdOrSlug) {
    const history = safeGet(KEYS.HISTORY, {});
    return history[animeIdOrSlug] || null;
  },

  saveProgress(anime, episodeNumber, currentTime, duration) {
    if (!anime) return;
    const history = safeGet(KEYS.HISTORY, {});
    const key = anime.slug || String(anime.id || anime.mal_id);
    
    const pct = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
    const isCompleted = pct >= 90;

    history[key] = {
      animeId: key,
      title: anime.title || anime.name,
      slug: anime.slug || String(anime.id || anime.mal_id),
      cover_url: anime.cover_url || anime.images?.jpg?.large_image_url || anime.coverImage?.large,
      banner_url: anime.banner_url || anime.images?.jpg?.large_image_url,
      currentEpisode: episodeNumber,
      totalEpisodes: anime.episodes_count || anime.episodes || null,
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
      progressPercent: pct,
      completed: isCompleted,
      updatedAt: new Date().toISOString(),
    };

    safeSet(KEYS.HISTORY, history);
  },

  removeHistoryItem(animeIdOrSlug) {
    const history = safeGet(KEYS.HISTORY, {});
    delete history[animeIdOrSlug];
    safeSet(KEYS.HISTORY, history);
  },

  clearHistory() {
    safeSet(KEYS.HISTORY, {});
  },

  // ── Minha Lista / Watchlist ──
  getWatchlist() {
    const list = safeGet(KEYS.WATCHLIST, {});
    return Object.values(list).sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  },

  getWatchlistStatus(animeIdOrSlug) {
    const list = safeGet(KEYS.WATCHLIST, {});
    return list[animeIdOrSlug]?.status || null;
  },

  setWatchlistStatus(anime, status) {
    if (!anime) return;
    const list = safeGet(KEYS.WATCHLIST, {});
    const key = anime.slug || String(anime.id || anime.mal_id);

    if (!status || status === 'none') {
      delete list[key];
    } else {
      list[key] = {
        animeId: key,
        slug: anime.slug || String(anime.id || anime.mal_id),
        title: anime.title || anime.name,
        cover_url: anime.cover_url || anime.images?.jpg?.large_image_url || anime.coverImage?.large,
        score: anime.score || anime.rating || null,
        status: status, // 'watching' | 'plan_to_watch' | 'completed' | 'favorite'
        genres: anime.genres || [],
        episodes_count: anime.episodes_count || anime.episodes || null,
        addedAt: list[key]?.addedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    safeSet(KEYS.WATCHLIST, list);
    return list[key] || null;
  },

  // ── Configurações ──
  getSettings() {
    return safeGet(KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  saveSettings(settings) {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    safeSet(KEYS.SETTINGS, updated);
    return updated;
  },

  // ── Backup & Restauração ──
  exportBackup() {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      profile: this.getProfile(),
      history: safeGet(KEYS.HISTORY, {}),
      watchlist: safeGet(KEYS.WATCHLIST, {}),
      settings: this.getSettings(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animeindex_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  },

  importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') throw new Error('Formato inválido');

      if (data.profile) safeSet(KEYS.PROFILE, data.profile);
      if (data.history) safeSet(KEYS.HISTORY, data.history);
      if (data.watchlist) safeSet(KEYS.WATCHLIST, data.watchlist);
      if (data.settings) safeSet(KEYS.SETTINGS, data.settings);

      return { ok: true, message: 'Dados restaurados com sucesso!' };
    } catch (err) {
      console.error('[Storage] Falha ao importar backup:', err);
      return { ok: false, error: err.message || 'Arquivo de backup corrompido ou inválido.' };
    }
  },

  // ── Reset Geral de Dados ──
  clearAll() {
    localStorage.removeItem(KEYS.PROFILE);
    localStorage.removeItem(KEYS.HISTORY);
    localStorage.removeItem(KEYS.WATCHLIST);
    localStorage.removeItem(KEYS.SETTINGS);
  }
};
