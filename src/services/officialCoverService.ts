/**
 * Serviço de Capas Oficiais em Alta Resolução (Full HD / Ultra HD)
 * 
 * Fontes oficiais:
 * 1. AniList GraphQL (coverImage.extraLarge - 1000px+)
 * 2. Jikan / MyAnimeList (images.webp.large_image_url e images.jpg.large_image_url)
 * 
 * IMPORTANTE:
 * Este serviço é ESTRITAMENTE VISUAL.
 * A escolha de capa preenche exclusivamente a imagem do card/pôster ('coverUrl').
 * NUNCA altera IDs, número de episódios, sinopses, trailers ou a árvore de temporadas.
 */

export interface OfficialCoverItem {
  id: string;
  title: string;
  imageUrl: string;
  year?: number;
  format?: string;
  source: 'AniList HD' | 'MyAnimeList HD';
}

/**
 * Busca capas oficiais em altíssima resolução de todas as mídias da franquia
 * (temporadas, filmes, OVAs, especiais) através das APIs AniList e Jikan.
 */
export async function searchOfficialHighResCovers(
  query: string
): Promise<OfficialCoverItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery || cleanQuery.length < 2) {
    return [];
  }

  const coversMap = new Map<string, OfficialCoverItem>();

  // 1. Busca via AniList GraphQL (extraLarge - máxima resolução)
  const anilistPromise = (async () => {
    try {
      const graphqlQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 25) {
            media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
              id
              title {
                romaji
                english
                native
              }
              format
              seasonYear
              startDate {
                year
              }
              coverImage {
                extraLarge
                large
              }
            }
          }
        }
      `;

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: { search: cleanQuery },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const list = json?.data?.Page?.media || [];

        for (const item of list) {
          const img = item.coverImage?.extraLarge || item.coverImage?.large;
          if (img && !coversMap.has(img)) {
            const title = item.title?.english || item.title?.romaji || item.title?.native || cleanQuery;
            const year = item.seasonYear || item.startDate?.year;
            coversMap.set(img, {
              id: `anilist_${item.id}`,
              title,
              imageUrl: img,
              year: year || undefined,
              format: item.format || 'TV',
              source: 'AniList HD',
            });
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar capas HD na AniList:', err);
    }
  })();

  // 2. Busca via Jikan (MyAnimeList WebP Large)
  const jikanPromise = (async () => {
    try {
      const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanQuery)}&limit=25&sfw=true`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const list = json?.data || [];

        for (const item of list) {
          const img =
            item.images?.webp?.large_image_url ||
            item.images?.jpg?.large_image_url;
          if (img && !coversMap.has(img)) {
            const title = item.title_english || item.title || cleanQuery;
            const year = item.year || item.aired?.prop?.from?.year;
            coversMap.set(img, {
              id: `jikan_${item.mal_id}`,
              title,
              imageUrl: img,
              year: year || undefined,
              format: item.type || 'TV',
              source: 'MyAnimeList HD',
            });
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar capas HD no Jikan:', err);
    }
  })();

  await Promise.allSettled([anilistPromise, jikanPromise]);

  return Array.from(coversMap.values());
}
