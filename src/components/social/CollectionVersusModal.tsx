import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Star,
  Plus,
  Check,
  Sparkles,
  Tv,
  CheckCircle2,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import type { Anime } from '../../types';
import { STATUS_CONFIG } from '../../types';
import type { UserProfile } from '../../services/profileService';
import { calculateCompatibilityScore } from '../../services/communityService';

export interface CollectionVersusModalProps {
  isOpen: boolean;
  onClose: () => void;
  myAnimes: Anime[];
  myProfile?: UserProfile | null;
  myUserName?: string;
  myAvatar?: string;
  friendAnimes?: Anime[];
  friendProfile?: UserProfile | null;
  friendUserName?: string;
  friendAvatar?: string;
  targetAnimes?: Anime[];
  targetProfile?: UserProfile | null;
  onAddAnimeToMyList?: (animeData: Partial<Anime>) => void;
  onAddAnimeFromFriend?: (anime: Anime | Partial<Anime>) => void;
  onOpenAnimeDetail?: (anime: Anime) => void;
}

type TabType = 'mutual' | 'equal' | 'diff' | 'friend_only' | 'my_only' | 'all';

interface VisualComparisonCard {
  id: string;
  title: string;
  japaneseTitle?: string;
  coverUrl?: string | null;
  genres?: string[];
  format?: string | null;
  year?: number | null;
  myAnime?: Anime | null;
  friendAnime?: Anime | null;
  myRating?: number | null;
  friendRating?: number | null;
  isEqual: boolean;
  isDiff: boolean;
  diffAmount: number;
  type: 'mutual' | 'friend_only' | 'my_only';
}

export const CollectionVersusModal: React.FC<CollectionVersusModalProps> = ({
  isOpen,
  onClose,
  myAnimes = [],
  myProfile = null,
  myUserName,
  myAvatar,
  friendAnimes,
  friendProfile,
  friendUserName,
  friendAvatar,
  targetAnimes,
  targetProfile,
  onAddAnimeToMyList,
  onAddAnimeFromFriend,
  onOpenAnimeDetail,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('mutual');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [inspectItem, setInspectItem] = useState<VisualComparisonCard | null>(null);

  const safeMyAnimes = useMemo(() => (Array.isArray(myAnimes) ? myAnimes : []), [myAnimes]);
  const safeFriendAnimes = useMemo(() => {
    if (Array.isArray(friendAnimes) && friendAnimes.length > 0) return friendAnimes;
    if (Array.isArray(targetAnimes) && targetAnimes.length > 0) return targetAnimes;
    return [];
  }, [friendAnimes, targetAnimes]);

  const myName = myUserName || myProfile?.publicUsername || 'Você';
  const myPic = myAvatar || myProfile?.customAvatarUrl || '';

  const friendName = friendUserName || friendProfile?.publicUsername || targetProfile?.publicUsername || 'Amigo';
  const friendPic = friendAvatar || friendProfile?.customAvatarUrl || targetProfile?.customAvatarUrl || '';

  // Afinidade calculada
  const affinity = useMemo(() => {
    return calculateCompatibilityScore(safeMyAnimes, safeFriendAnimes);
  }, [safeMyAnimes, safeFriendAnimes]);

  // Indexação direta de todos os animes para criar a Galeria Visual
  const allCards = useMemo<VisualComparisonCard[]>(() => {
    const map = new Map<string, { my?: Anime; friend?: Anime }>();

    for (const a of safeMyAnimes) {
      const key = (a.title || '').trim().toLowerCase();
      if (key) map.set(key, { my: a });
    }

    for (const a of safeFriendAnimes) {
      const key = (a.title || '').trim().toLowerCase();
      if (!key) continue;
      const exist = map.get(key);
      if (exist) {
        exist.friend = a;
      } else {
        map.set(key, { friend: a });
      }
    }

    const cards: VisualComparisonCard[] = [];

    map.forEach((val) => {
      const base = val.my || val.friend;
      if (!base) return;

      const hasMy = Boolean(val.my);
      const hasFriend = Boolean(val.friend);

      const myRating = val.my?.rating ?? null;
      const friendRating = val.friend?.rating ?? null;

      let isEqual = false;
      let isDiff = false;
      let diffAmount = 0;

      if (hasMy && hasFriend) {
        if (myRating !== null && friendRating !== null) {
          diffAmount = Math.abs(myRating - friendRating);
          if (diffAmount === 0) isEqual = true;
          else isDiff = true;
        }
      }

      let type: 'mutual' | 'friend_only' | 'my_only' = 'mutual';
      if (hasMy && !hasFriend) type = 'my_only';
      else if (!hasMy && hasFriend) type = 'friend_only';

      cards.push({
        id: base.id || base.title,
        title: base.title,
        japaneseTitle: base.japaneseTitle,
        coverUrl: val.my?.coverUrl || val.friend?.coverUrl,
        genres: val.my?.genres || val.friend?.genres,
        format: val.my?.format || val.friend?.format,
        year: val.my?.releaseYear || val.friend?.releaseYear,
        myAnime: val.my || null,
        friendAnime: val.friend || null,
        myRating,
        friendRating,
        isEqual,
        isDiff,
        diffAmount,
        type,
      });
    });

    // Ordena: notas iguais primeiro, depois divergências, depois alfabético
    return cards.sort((a, b) => {
      if (a.isEqual && !b.isEqual) return -1;
      if (!a.isEqual && b.isEqual) return 1;
      if (a.type === 'mutual' && b.type !== 'mutual') return -1;
      if (a.type !== 'mutual' && b.type === 'mutual') return 1;
      return a.title.localeCompare(b.title);
    });
  }, [safeMyAnimes, safeFriendAnimes]);

  // Contadores
  const counts = useMemo(() => {
    let mutual = 0;
    let equal = 0;
    let diff = 0;
    let friendOnly = 0;
    let myOnly = 0;

    for (const c of allCards) {
      if (c.type === 'mutual') {
        mutual++;
        if (c.isEqual) equal++;
        if (c.isDiff) diff++;
      } else if (c.type === 'friend_only') {
        friendOnly++;
      } else if (c.type === 'my_only') {
        myOnly++;
      }
    }

    return {
      all: allCards.length,
      mutual,
      equal,
      diff,
      friendOnly,
      myOnly,
    };
  }, [allCards]);

  // Filtragem
  const displayedCards = useMemo(() => {
    let list = allCards;

    if (activeTab === 'mutual') {
      list = list.filter((c) => c.type === 'mutual');
    } else if (activeTab === 'equal') {
      list = list.filter((c) => c.isEqual);
    } else if (activeTab === 'diff') {
      list = list.filter((c) => c.isDiff);
    } else if (activeTab === 'friend_only') {
      list = list.filter((c) => c.type === 'friend_only');
    } else if (activeTab === 'my_only') {
      list = list.filter((c) => c.type === 'my_only');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.japaneseTitle && c.japaneseTitle.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allCards, activeTab, searchQuery]);

  const handleAddAnime = (card: VisualComparisonCard, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = card.friendAnime;
    if (!target) return;

    setAddedIds((prev) => new Set([...prev, card.id]));

    if (onAddAnimeFromFriend) {
      onAddAnimeFromFriend(target);
    } else if (onAddAnimeToMyList) {
      onAddAnimeToMyList({
        title: target.title,
        originalTitle: target.originalTitle,
        japaneseTitle: target.japaneseTitle,
        coverUrl: target.coverUrl,
        bannerUrl: target.bannerUrl,
        synopsis: target.synopsis,
        genres: target.genres,
        format: target.format,
        studio: target.studio,
        releaseYear: target.releaseYear,
        totalEpisodes: target.totalEpisodes,
        status: 'plan_to_watch',
        currentEpisode: 0,
        season: 1,
        currentSeasonName: 'Temporada 1',
        seasons: target.seasons || [],
        notes: `Adicionado da lista de ${friendName}`,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="collection-versus-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/95 backdrop-blur-2xl animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="collection-versus-modal-card"
        className="relative w-full max-w-5xl h-[92vh] max-h-[880px] bg-[#050508] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =====================================================================
            1. BARRA SUPERIOR SLIM (Zero cabeçalho gigante - apenas 48px)
           ===================================================================== */}
        <header className="h-14 px-3 sm:px-5 bg-black/80 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 z-20">
          {/* Conexão dos Dois Avatares */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center -space-x-2 shrink-0">
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full ring-2 ring-indigo-500 overflow-hidden bg-slate-800"
                title={`Você (${myName})`}
              >
                {myPic ? (
                  <img src={myPic} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-black bg-indigo-950 text-indigo-300">
                    {myName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full ring-2 ring-purple-500 overflow-hidden bg-slate-800"
                title={`Amigo (${friendName})`}
              >
                {friendPic ? (
                  <img src={friendPic} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-black bg-purple-950 text-purple-300">
                    {friendName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-baseline gap-1.5 min-w-0 truncate">
              <span className="text-xs sm:text-sm font-black text-white truncate">{myName}</span>
              <span className="text-xs text-slate-500 font-bold">&</span>
              <span className="text-xs sm:text-sm font-black text-purple-300 truncate">
                {friendName}
              </span>
            </div>

            <div className="hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-black shrink-0">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{affinity.scorePercent}%</span>
            </div>
          </div>

          {/* Busca Rápida + Fechar */}
          <div className="flex items-center gap-2">
            <div className="relative w-32 sm:w-48 md:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar animes..."
                className="w-full pl-8 pr-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* =====================================================================
            2. SEGMENTED FILTER BAR (1 Linha Limpa de Filtro Direto)
           ===================================================================== */}
        <div className="px-3 sm:px-5 py-2 bg-[#09090e] border-b border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('mutual')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'mutual'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            Em Comum ({counts.mutual})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('equal')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
              activeTab === 'equal'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-amber-300'
            }`}
          >
            <Star className="w-3 h-3 fill-current" />
            Notas Iguais ({counts.equal})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diff')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'diff'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-purple-300'
            }`}
          >
            Notas Diferentes ({counts.diff})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('friend_only')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
              activeTab === 'friend_only'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-emerald-300'
            }`}
          >
            <Plus className="w-3 h-3 stroke-[3]" />
            Só Ele Tem ({counts.friendOnly})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my_only')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'my_only'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-sky-300'
            }`}
          >
            Só Você Tem ({counts.myOnly})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            Todos ({counts.all})
          </button>
        </div>

        {/* =====================================================================
            3. GALERIA VISUAL DE PÔSTERES (Cards Ricos, Modernos e Focados na Arte)
           ===================================================================== */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 bg-[#030305]">
          {displayedCards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
              <Tv className="w-12 h-12 opacity-20 text-indigo-400" />
              <h4 className="text-sm font-bold text-white">Nenhum anime encontrado</h4>
              <p className="text-xs text-slate-500 max-w-xs">
                Não há títulos cadastrados nesta categoria ou a busca não encontrou resultados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
              {displayedCards.map((card) => {
                const isAdded = addedIds.has(card.id);

                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      if (onOpenAnimeDetail) {
                        const target = card.myAnime || card.friendAnime;
                        if (target) onOpenAnimeDetail(target);
                      } else {
                        setInspectItem(card);
                      }
                    }}
                    className={`group relative rounded-xl sm:rounded-2xl overflow-hidden bg-[#0d0d14] border transition-all duration-300 flex flex-col cursor-pointer select-none hover:-translate-y-1 hover:shadow-xl ${
                      card.isEqual
                        ? 'border-amber-500/40 hover:border-amber-400 hover:shadow-amber-500/10'
                        : card.isDiff
                        ? 'border-purple-500/30 hover:border-purple-400 hover:shadow-purple-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Imagem do Pôster Vertical */}
                    <div className="relative w-full aspect-[3/4.2] overflow-hidden bg-slate-950">
                      {card.coverUrl ? (
                        <img
                          src={card.coverUrl}
                          alt={card.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-900/60 p-2">
                          <Tv className="w-6 h-6 opacity-40 mb-1" />
                          <span className="text-[9px]">Sem pôster</span>
                        </div>
                      )}

                      {/* Gradiente sutil para legibilidade dos badges */}
                      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

                      {/* Selo Superior de Concordância ou Divergência */}
                      <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1 z-10 pointer-events-none">
                        {card.isEqual ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-500 text-slate-950 shadow-md flex items-center gap-1 uppercase tracking-wider">
                            <Star className="w-2.5 h-2.5 fill-slate-950" />
                            <span>Mesma Nota</span>
                          </span>
                        ) : card.isDiff ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-600/90 text-white backdrop-blur-md shadow-md uppercase tracking-wider">
                            Δ {card.diffAmount.toFixed(1)}★
                          </span>
                        ) : card.type === 'friend_only' ? (
                          <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-emerald-600/90 text-white backdrop-blur-md shadow-md uppercase tracking-wider">
                            Só o Amigo
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-sky-600/90 text-white backdrop-blur-md shadow-md uppercase tracking-wider">
                            Só Você
                          </span>
                        )}

                        {card.format && (
                          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-black/80 text-slate-300 border border-white/10">
                            {card.format}
                          </span>
                        )}
                      </div>

                      {/* Comparação das Duas Notas no Rodapé do Pôster */}
                      <div className="absolute bottom-2 inset-x-2 z-10 flex items-center justify-between gap-1.5 pointer-events-none">
                        {/* Sua Nota */}
                        <div
                          className={`flex-1 px-1.5 py-1 rounded-lg backdrop-blur-md border text-center ${
                            card.myAnime
                              ? 'bg-black/80 border-indigo-500/40 text-indigo-300'
                              : 'bg-black/60 border-white/10 text-slate-500'
                          }`}
                        >
                          <span className="text-[8px] uppercase tracking-wider block font-bold text-slate-400">
                            Você
                          </span>
                          <span className="text-[11px] font-black leading-none block mt-0.5">
                            {card.myRating !== null ? `${card.myRating}★` : card.myAnime ? 'Sem nota' : '—'}
                          </span>
                        </div>

                        {/* Nota do Amigo */}
                        <div
                          className={`flex-1 px-1.5 py-1 rounded-lg backdrop-blur-md border text-center ${
                            card.friendAnime
                              ? 'bg-black/80 border-purple-500/40 text-purple-300'
                              : 'bg-black/60 border-white/10 text-slate-500'
                          }`}
                        >
                          <span className="text-[8px] uppercase tracking-wider block font-bold text-slate-400">
                            Amigo
                          </span>
                          <span className="text-[11px] font-black leading-none block mt-0.5">
                            {card.friendRating !== null
                              ? `${card.friendRating}★`
                              : card.friendAnime
                              ? 'Sem nota'
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rodapé do Card com Título e Ação Rápida */}
                    <div className="p-2 sm:p-2.5 flex flex-col justify-between flex-1 gap-1.5 bg-[#0a0a10]">
                      <h4
                        className="text-xs font-bold text-white line-clamp-1 group-hover:text-indigo-400 transition-colors"
                        title={card.title}
                      >
                        {card.title}
                      </h4>

                      {/* Botão de Adição se você não tiver */}
                      {!card.myAnime && (
                        <div className="pt-1 border-t border-white/5">
                          {isAdded ? (
                            <div className="w-full py-1 text-center text-[10px] font-bold text-emerald-400 flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Na sua lista</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleAddAnime(card, e)}
                              className="w-full py-1 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-[10.5px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                            >
                              <Plus className="w-3 h-3 stroke-[3]" />
                              <span>Adicionar</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* =====================================================================
            4. MINI SHEET DE INSPEÇÃO (Quando clica num anime caso não use detail modal)
           ===================================================================== */}
        {inspectItem && !onOpenAnimeDetail && (
          <div
            className="absolute inset-x-0 bottom-0 bg-black/95 border-t border-white/20 p-4 sm:p-5 z-30 shadow-2xl animate-slideUp flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              {inspectItem.coverUrl && (
                <img
                  src={inspectItem.coverUrl}
                  alt=""
                  className="w-12 h-16 object-cover rounded-lg shrink-0 border border-white/10"
                />
              )}
              <div className="min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-white truncate">
                  {inspectItem.title}
                </h4>
                <div className="flex items-center gap-3 text-xs mt-1 text-slate-300">
                  <span>
                    Sua nota:{' '}
                    <b className="text-indigo-400">
                      {inspectItem.myRating ? `${inspectItem.myRating}★` : '—'}
                    </b>
                  </span>
                  <span>
                    Nota de {friendName}:{' '}
                    <b className="text-purple-400">
                      {inspectItem.friendRating ? `${inspectItem.friendRating}★` : '—'}
                    </b>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {!inspectItem.myAnime && (
                <button
                  type="button"
                  onClick={(e) => handleAddAnime(inspectItem, e)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Adicionar à minha lista</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
