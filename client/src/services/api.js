/**
 * api.js — Conector com a API do Backend do AnimeIndex
 * 
 * - Integração direta com os endpoints do backend:
 *   • GET /api/animes (catálogo completo de animes indexados)
 *   • GET /api/releases (últimos episódios lançados)
 *   • GET /api/airing (animes em exibição)
 *   • GET /api/genres (gêneros disponíveis)
 *   • GET /api/anime/:slug (detalhes do anime e episódios)
 *   • GET /api/anime/:slug/related (temporadas relacionadas)
 *   • GET /api/source/:slug/:ep (extração do stream de vídeo)
 * 
 * - Fallbacks inteligentes caso o banco de dados ainda esteja sendo restaurado
 */

export const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL || 
  (import.meta.env.DEV ? '' : 'https://animeindex-28ua.onrender.com')
).replace(/\/$/, '');

const JIKAN_BASE = 'https://api.jikan.moe/v4';

// Cache em memória para catálogo do backend e requisições
let backendAnimesCache = null;
let backendReleasesCache = null;
const memoryCache = new Map();

/**
 * Função utilitária para chamar endpoints do backend com header de autenticação e retentativas automáticas
 */
export async function backendFetch(endpoint, options = {}, retries = 2) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = cleanEndpoint.startsWith('http') ? cleanEndpoint : `${BACKEND_URL}${cleanEndpoint}`;
  
  const user = localStorage.getItem('animekaikai_last_user') || 'admin';
  const headers = {
    'Accept': 'application/json',
    'x-user': user,
    ...(options.headers || {})
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const err = new Error(errorData.error || `Erro HTTP ${res.status}: ${res.statusText}`);
        err.status = res.status;
        err.data = errorData;
        throw err;
      }

      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        // Aguarda 1.5s antes de retentar (absorve cold-start do Render sem travar a interface)
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Normaliza objetos de animes vindos do backend ou do Jikan para formato unificado
 */
export function normalizeAnime(raw, defaultSlug = '') {
  if (!raw) return null;

  const slug = raw.slug || defaultSlug || (raw.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const cover = raw.cover_url || raw.images?.jpg?.large_image_url || raw.images?.jpg?.image_url || '';
  const banner = raw.banner_url || cover;
  
  // Trata contagem de episódios
  let totalEpisodes = raw.episodes_count || raw.episodes;
  if (!totalEpisodes && raw.episodes && typeof raw.episodes === 'object') {
    totalEpisodes = Object.keys(raw.episodes).length;
  }
  if (!totalEpisodes) totalEpisodes = raw.airing ? 12 : 24;

  // Trata gêneros
  const genres = Array.isArray(raw.genres)
    ? raw.genres.map(g => typeof g === 'string' ? g : g.name)
    : [];

  return {
    id: raw.id || raw.mal_id || slug,
    mal_id: raw.mal_id || null,
    slug: slug,
    title: raw.title || raw.title_english || 'Sem título',
    title_japanese: raw.title_japanese || raw.title_jp || '',
    title_english: raw.title_english || raw.title || '',
    cover_url: cover,
    banner_url: banner,
    score: raw.score || null,
    episodes_count: totalEpisodes,
    episodes: totalEpisodes,
    episodesData: raw.episodes || null,
    airing: Boolean(raw.airing),
    status: raw.status || (raw.airing ? 'Em exibição' : 'Completo'),
    year: raw.year || (raw.lastEpisodeAddedAt ? new Date(raw.lastEpisodeAddedAt).getFullYear() : null),
    synopsis: raw.synopsis || 'Sinopse disponível no catálogo.',
    genres: genres.length > 0 ? genres : ['Anime'],
    source_url: raw.source_url || '',
    lastEpisodeAddedAt: raw.lastEpisodeAddedAt || null,
    trailer: raw.trailer || null,
  };
}

// Animes em destaque para fallback enquanto o banco está restaurando
export const FALLBACK_FEATURED = [
  {
    slug: 'solo-leveling',
    title: 'Solo Leveling',
    title_japanese: '俺だけレベルアップな件',
    score: 8.42,
    episodes_count: 12,
    cover_url: 'https://cdn.myanimelist.net/images/anime/1069/140850l.jpg',
    banner_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&auto=format&fit=crop&q=80',
    genres: ['Ação', 'Fantasia', 'Aventura'],
    synopsis: 'Sung Jin-woo é conhecido como o caçador mais fraco do mundo, até que uma masmorra dupla misteriosa desperta um sistema único que só ele pode ver.',
  },
  {
    slug: 'sousou-no-frieren',
    title: 'Sousou no Frieren',
    title_japanese: '葬送のフリーレン',
    score: 9.32,
    episodes_count: 28,
    cover_url: 'https://cdn.myanimelist.net/images/anime/1015/138006l.jpg',
    banner_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80',
    genres: ['Aventura', 'Drama', 'Fantasia'],
    synopsis: 'A maga elfa Frieren relembra sua jornada de uma década com o grupo de heróis após a derrota do Rei Demônio, enquanto reflete sobre a vida de seus antigos companheiros.',
  },
  {
    slug: 'jujutsu-kaisen-2nd-season',
    title: 'Jujutsu Kaisen 2nd Season',
    title_japanese: '呪術廻戦',
    score: 8.81,
    episodes_count: 23,
    cover_url: 'https://cdn.myanimelist.net/images/anime/1792/138042l.jpg',
    banner_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&auto=format&fit=crop&q=80',
    genres: ['Ação', 'Sobrenatural'],
    synopsis: 'O passado de Satoru Gojo e o catastrófico Incidente de Shibuya que redefine o mundo dos feiticeiros.',
  }
];

export const AnimeApi = {
  /**
   * 1. GET /api/animes — Catálogo Completo do Backend (3.700+ animes)
   */
  async getAnimes() {
    if (backendAnimesCache && backendAnimesCache.length > 0) {
      return backendAnimesCache;
    }

    try {
      const data = await backendFetch('/api/animes');
      if (data && typeof data === 'object') {
        const list = Object.entries(data).map(([slug, anime]) => 
          normalizeAnime(anime, slug)
        ).filter(a => a && a.title);

        if (list.length > 0) {
          backendAnimesCache = list;
          return list;
        }
      }
    } catch (err) {
      console.warn('[AnimeApi] Aviso ao carregar /api/animes do backend:', err.message);
    }

    return FALLBACK_FEATURED;
  },

  /**
   * 2. GET /api/releases — Lançamentos Recentes do Backend
   */
  async getReleases() {
    if (backendReleasesCache && backendReleasesCache.length > 0) {
      return backendReleasesCache;
    }

    try {
      const data = await backendFetch('/api/releases');
      if (Array.isArray(data) && data.length > 0) {
        backendReleasesCache = data.map(r => ({
          ...r,
          episodes_count: Number(r.ep || r.episode || 1),
          cover_url: r.cover_url || '',
        }));
        return backendReleasesCache;
      }
    } catch (err) {
      console.warn('[AnimeApi] Falha ao carregar /api/releases do backend:', err.message);
    }

    return [];
  },

  /**
   * 3. GET /api/airing — Animes em Exibição do Backend
   */
  async getAiring() {
    try {
      const data = await backendFetch('/api/airing');
      if (Array.isArray(data) && data.length > 0) {
        return data.map(a => normalizeAnime(a));
      }
    } catch (err) {
      console.warn('[AnimeApi] /api/airing do backend vazio ou indisponível:', err.message);
    }

    // Se o backend ainda não restaurou a tabela de airing, usa os releases recentes ou Jikan
    const releases = await this.getReleases();
    if (releases.length > 0) {
      // Agrupa releases únicos
      const seen = new Set();
      const uniqueFromReleases = [];
      for (const r of releases) {
        if (!seen.has(r.slug)) {
          seen.add(r.slug);
          uniqueFromReleases.push(normalizeAnime({
            ...r,
            airing: true,
          }));
        }
        if (uniqueFromReleases.length >= 24) break;
      }
      if (uniqueFromReleases.length > 0) return uniqueFromReleases;
    }

    // Fallback Jikan API
    try {
      const res = await fetch(`${JIKAN_BASE}/seasons/now?limit=20`);
      if (res.ok) {
        const jikanData = await res.json();
        if (jikanData.data) {
          return jikanData.data.map(a => normalizeAnime(a));
        }
      }
    } catch (e) {}

    return FALLBACK_FEATURED;
  },

  /**
   * 4. GET /api/genres — Gêneros do Backend
   */
  async getGenres() {
    try {
      const data = await backendFetch('/api/genres');
      if (data && typeof data === 'object') {
        return data;
      }
    } catch (err) {
      console.warn('[AnimeApi] Falha ao carregar /api/genres:', err.message);
    }
    return {};
  },

  /**
   * 5. GET /api/anime/:slug — Detalhes Completos do Anime pelo Backend
   */
  async getDetails(slug) {
    if (!slug) return null;

    try {
      const data = await backendFetch(`/api/anime/${slug}`);
      if (data && data.title) {
        return normalizeAnime(data, slug);
      }
    } catch (err) {
      console.warn(`[AnimeApi] /api/anime/${slug} retornou erro (possível restauração pendente):`, err.message);
    }

    // Se não encontrou no arquivo individual, busca no cache local de animes do backend
    if (backendAnimesCache) {
      const found = backendAnimesCache.find(a => a.slug === slug);
      if (found) return found;
    }

    // Fallback: Busca via Jikan MAL
    try {
      const q = encodeURIComponent(slug.replace(/-/g, ' '));
      const res = await fetch(`${JIKAN_BASE}/anime?q=${q}&limit=1`);
      if (res.ok) {
        const jikan = await res.json();
        if (jikan.data && jikan.data[0]) {
          return normalizeAnime(jikan.data[0], slug);
        }
      }
    } catch (e) {}

    return FALLBACK_FEATURED[0];
  },

  /**
   * 6. GET /api/anime/:slug/related — Temporadas Relacionadas
   */
  async getRelatedSeasons(slug) {
    try {
      const data = await backendFetch(`/api/anime/${slug}/related`);
      if (Array.isArray(data)) {
        return data;
      }
    } catch (err) {
      console.warn('[AnimeApi] Falha ao buscar temporadas relacionadas:', err.message);
    }
    return [];
  },

  /**
   * 7. GET /api/source/:slug/:ep — Extração de Vídeo pelo Backend
   */
  async getVideoSource(anime, episodeNumber = 1) {
    const slug = anime.slug || String(anime.id || anime.mal_id);

    // Chama o endpoint oficial de extração de vídeo do backend
    try {
      const data = await backendFetch(`/api/source/${slug}/${episodeNumber}`);
      if (data && (data.url || data.videoSrc)) {
        const streamUrl = data.url || data.videoSrc;
        const isHls = streamUrl.includes('.m3u8') || data.type === 'hls';
        return {
          type: isHls ? 'hls' : (data.type || 'direct'),
          url: streamUrl,
          hd: data.hd || streamUrl,
          sd: data.sd || null,
          server: data.server || 'AnimeIndex Player',
        };
      }
      if (data && data.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      console.warn(`[AnimeApi] Extração no backend para ${slug}/${episodeNumber} falhou:`, err.message);
      throw err;
    }

    throw new Error(`Nenhuma fonte de vídeo encontrada para o episódio ${episodeNumber}`);
  },

  /**
   * 8. Busca Dinâmica e Instantânea no Catálogo
   */
  async search(query = '', genre = null) {
    const all = await this.getAnimes();
    const q = (query || '').toLowerCase().trim();

    return all.filter(anime => {
      const matchesQuery = !q || (
        (anime.title || '').toLowerCase().includes(q) ||
        (anime.title_japanese || '').toLowerCase().includes(q) ||
        (anime.slug || '').toLowerCase().includes(q)
      );

      const matchesGenre = !genre || genre === 'Todos' || (
        (anime.genres || []).some(g => (typeof g === 'string' ? g : g.name).toLowerCase() === genre.toLowerCase())
      );

      return matchesQuery && matchesGenre;
    }).slice(0, 48);
  },

  /**
   * 9. Calendário Semanal (Jikan Schedule)
   */
  async getSchedules(day = '') {
    try {
      const url = day ? `${JIKAN_BASE}/schedules?filter=${day}&limit=20` : `${JIKAN_BASE}/schedules?limit=25`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          return json.data.map(a => normalizeAnime(a));
        }
      }
    } catch (err) {
      console.warn('[AnimeApi] Erro ao carregar calendário:', err.message);
    }
    return FALLBACK_FEATURED;
  }
};
