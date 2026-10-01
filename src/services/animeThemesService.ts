/**
 * Serviço de Músicas, Temas de Abertura (OP) e Encerramento (ED) via AnimeThemes.moe API (100% Grátis)
 * Permite reproduzir prévias de áudio/vídeo oficiais das músicas lendárias de animes.
 */

import { getAnimeThemes } from './jikanService';

export interface AnimeThemeMedia {
  id: string;
  themeType: 'OP' | 'ED';
  sequence: number; // ex: OP1, OP2, ED1
  songTitle: string;
  artistName: string;
  episodes?: string;
  videoUrl?: string;
  audioUrl?: string;
  resolution?: number; // 720, 1080
}

/**
 * Converte strings brutas de tema do MyAnimeList/Jikan em objetos estruturados de AnimeThemeMedia
 */
function parseJikanThemeString(rawStr: string, type: 'OP' | 'ED', index: number): AnimeThemeMedia {
  const cleaned = rawStr.trim();
  // Padrão: 1: "Song Title" by Artist Name (eps 1-12)
  const regex = /^(?:#?(\d+):\s*)?["“]?([^"”]+)["”]?\s*(?:by\s+([^(\n]+))?(?:\s*\(([^)]+)\))?/i;
  const match = cleaned.match(regex);

  let sequence = index + 1;
  let songTitle = cleaned;
  let artistName = 'Artista Oficial';
  let episodes: string | undefined;

  if (match) {
    if (match[1]) sequence = parseInt(match[1], 10) || sequence;
    if (match[2]) songTitle = match[2].trim();
    if (match[3]) artistName = match[3].trim();
    if (match[4]) episodes = match[4].trim();
  }

  return {
    id: `mal_theme_${type.toLowerCase()}_${sequence}_${index}`,
    themeType: type,
    sequence,
    songTitle,
    artistName,
    episodes,
    resolution: 720,
  };
}

export async function fetchAnimeThemesMedia(animeTitle: string, malId?: number): Promise<AnimeThemeMedia[]> {
  if (!animeTitle && !malId) return [];

  let results: AnimeThemeMedia[] = [];

  // 1. Tenta AnimeThemes.moe para áudio/vídeo direto
  try {
    let cleanTitle = animeTitle
      .replace(/:\s*season\s*\d+/gi, '')
      .replace(/\s*\d+(?:nd|rd|th|st)?\s*season/gi, '')
      .replace(/:\s*part\s*\d+/gi, '')
      .replace(/\s*temporada\s*\d+/gi, '')
      .trim();

    // Query para o endpoint oficial do AnimeThemes
    const url = `https://api.animethemes.moe/anime?filter[has]=resources&filter[name]=${encodeURIComponent(
      cleanTitle
    )}&include=animethemes.animethemeentries.videos,animethemes.song.artists&fields[anime]=name,slug&fields[animetheme]=type,sequence,slug&fields[song]=title&fields[artist]=name&fields[video]=link,resolution`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      const animeList = json?.anime;
      if (Array.isArray(animeList) && animeList.length > 0) {
        const animeObj = animeList[0];
        const themes = animeObj?.animethemes;
        if (Array.isArray(themes) && themes.length > 0) {
          themes.forEach((th: any) => {
            const type = th.type === 'OP' ? 'OP' : 'ED';
            const sequence = th.sequence || 1;
            const songTitle = th.song?.title || `${type} ${sequence}`;
            const artistName = th.song?.artists?.[0]?.name || 'Artista Oficial';
            const entry = th.animethemeentries?.[0];
            const video = entry?.videos?.[0];

            results.push({
              id: `at_${th.slug || `${type}_${sequence}`}`,
              themeType: type,
              sequence,
              songTitle,
              artistName,
              episodes: entry?.episodes || undefined,
              videoUrl: video?.link || undefined,
              audioUrl: video?.audio?.link || undefined,
              resolution: video?.resolution || 720,
            });
          });
        }
      }
    }
  } catch (err) {
    console.warn('AnimeThemes API aviso:', err);
  }

  // 2. Se AnimeThemes.moe não encontrou ou retornou vazio, fallback robusto no Jikan/MAL Themes
  if (results.length === 0 && (malId || animeTitle)) {
    try {
      const jikanThemes = await getAnimeThemes(malId || 0, animeTitle);
      const opList = (jikanThemes.openings || []).map((op, idx) => parseJikanThemeString(op, 'OP', idx));
      const edList = (jikanThemes.endings || []).map((ed, idx) => parseJikanThemeString(ed, 'ED', idx));
      results = [...opList, ...edList];
    } catch (jErr) {
      console.warn('Jikan themes fallback falhou:', jErr);
    }
  }

  return results;
}
