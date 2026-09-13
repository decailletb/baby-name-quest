import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { useNames } from '../../data/useNames';
import type { NameEntry } from '../../data/types';
import { groupVariants, otherSpellings } from '../../data/variants';
import type { VoteValue } from '../../storage';
import { useSession } from '../../store/SessionContext';
import { useVotes } from '../../store/useVotes';
import { EXIT_DURATION, GhostCard, SwipeCard } from './SwipeCard';
import { SwipeActions } from './SwipeActions';
import { SwipeFilterSheet } from './SwipeFilterSheet';
import { SwipeProgress } from './SwipeProgress';
import { SpellingsSheet } from './SpellingsSheet';
import {
  applySwipeFilters,
  countSwipeFilters,
  readSwipeFilters,
  writeSwipeFilters,
  type SwipeFilters,
} from './swipeFilters';
import {
  ORDER_LABELS,
  QUEUE_ORDERS,
  buildPool,
  buildQueue,
  computeProgress,
  orderPool,
  pickCurrent,
  readOrder,
  readShuffleSeed,
  writeOrder,
  type QueueOrder,
} from './swipeQueue';
import { usePrefersReducedMotion, type SwipeDirection } from './useSwipeGesture';

interface Ghost {
  key: number;
  entry: NameEntry;
  spellings: NameEntry[];
  direction: SwipeDirection;
  fromDx: number;
}

type Sheet = 'filters' | 'spellings' | null;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function SwipePage() {
  const { names, loading, error } = useNames();
  const { profile, partner, vote, removeVote } = useSession();
  const { mine, theirs } = useVotes();
  const reducedMotion = usePrefersReducedMotion();

  const [order, setOrder] = useState<QueueOrder>(() => readOrder());
  const [seed, setSeed] = useState<string>(() =>
    readOrder() === 'shuffle' ? readShuffleSeed() : '',
  );
  const [filters, setFilters] = useState<SwipeFilters>(() => readSwipeFilters());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    writeSwipeFilters(filters);
  }, [filters]);

  const preference = profile?.genderPreference ?? 'both';
  // One card per family of spellings: the most popular spelling stands for the others.
  const groups = useMemo(() => groupVariants(names), [names]);
  const pool = useMemo(
    () => applySwipeFilters(buildPool(groups.canonical, preference), filters),
    [groups, preference, filters],
  );
  const orderedPool = useMemo(() => orderPool(pool, order, seed), [pool, order, seed]);
  const queue = useMemo(() => buildQueue(orderedPool, mine), [orderedPool, mine]);
  const progress = useMemo(() => computeProgress(pool, mine), [pool, mine]);
  const current = useMemo(() => pickCurrent(queue, pinnedId), [queue, pinnedId]);
  const spellings = useMemo(
    () => (current ? otherSpellings(groups, current.id) : []),
    [groups, current],
  );
  const activeFilterCount = countSwipeFilters(filters);

  const likedByPartner =
    current && partner && theirs.get(current.id)?.value === 'like' ? partner.displayName : null;

  const changeOrder = (next: QueueOrder) => {
    if (next === order) return;
    if (next === 'shuffle') setSeed(readShuffleSeed());
    setOrder(next);
    writeOrder(next);
    setPinnedId(null);
  };

  const changeFilters = (next: SwipeFilters) => {
    setFilters(next);
    setPinnedId(null);
  };

  const closeSheet = useCallback(() => setSheet(null), []);

  const decide = useCallback(
    (value: VoteValue, fromDx = 0) => {
      if (!current) return;
      const trimmed = note.trim();
      void vote(current.id, value, value === 'like' ? trimmed || null : undefined);
      setHistory((items) => [...items, current.id]);
      setPinnedId(null);
      setNote('');
      setNoteOpen(false);
      if (!reducedMotion) {
        setGhost({
          key: Date.now(),
          entry: current,
          spellings,
          direction: value === 'like' ? 'right' : 'left',
          fromDx,
        });
      }
    },
    [current, note, reducedMotion, spellings, vote],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;
    void removeVote(last);
    setHistory((items) => items.slice(0, -1));
    setPinnedId(last);
    setGhost(null);
  }, [history, removeVote]);

  const likeSpelling = useCallback((id: string) => void vote(id, 'like', null), [vote]);
  const unlikeSpelling = useCallback((id: string) => void removeVote(id), [removeVote]);

  // Remove the flying ghost once its animation is over.
  useEffect(() => {
    if (!ghost) return;
    const timer = window.setTimeout(() => {
      setGhost((active) => (active?.key === ghost.key ? null : active));
    }, EXIT_DURATION + 40);
    return () => window.clearTimeout(timer);
  }, [ghost]);

  // Keyboard shortcuts: ← passer, → aimer, retour arrière / ↓ / z annuler. Paused while a sheet is open.
  useEffect(() => {
    if (sheet) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          decide('skip');
          break;
        case 'ArrowRight':
          event.preventDefault();
          decide('like');
          break;
        case 'Backspace':
        case 'ArrowDown':
        case 'z':
        case 'Z':
          event.preventDefault();
          undo();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [decide, sheet, undo]);

  if (loading) return <Spinner label="Chargement des prénoms…" />;
  if (error) {
    return (
      <EmptyState
        icon="😕"
        title="Impossible de charger les prénoms"
        description={`${error} Vérifiez votre connexion puis rechargez la page.`}
      />
    );
  }

  const filtersButton = (
    <Chip
      selected={activeFilterCount > 0}
      aria-pressed={undefined}
      aria-haspopup="dialog"
      aria-expanded={sheet === 'filters'}
      onClick={() => setSheet('filters')}
      className="min-h-9 px-3 text-xs"
    >
      <span aria-hidden="true">⚙️ </span>
      Filtres{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
    </Chip>
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2 px-4 pt-2 pb-28">
      <h1 className="sr-only">Découvrir des prénoms</h1>
      <div className="flex items-center justify-between gap-3">
        <div role="group" aria-label="Ordre des prénoms" className="flex flex-wrap gap-1.5">
          {QUEUE_ORDERS.map((option) => (
            <Chip
              key={option}
              selected={order === option}
              onClick={() => changeOrder(option)}
              className="min-h-9 px-3 text-xs"
            >
              {ORDER_LABELS[option]}
            </Chip>
          ))}
          {filtersButton}
        </div>
        <p className="hidden text-xs text-stone-400 sm:block" aria-hidden="true">
          ← passer · → aimer · ↓ annuler
        </p>
      </div>
      <SwipeProgress progress={progress} />

      {current ? (
        <>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={noteOpen}
              aria-controls="swipe-note"
              onClick={() => setNoteOpen((open) => !open)}
              className="min-h-10 self-center rounded-full px-3 text-xs font-semibold text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
            >
              <span aria-hidden="true">📝 </span>
              {noteOpen ? 'Masquer la note' : 'Ajouter une note'}
            </button>
            {noteOpen ? (
              <label htmlFor="swipe-note" className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-stone-500">
                  Note enregistrée avec le prénom si vous l'aimez
                </span>
                <textarea
                  id="swipe-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  maxLength={280}
                  placeholder="Par exemple : le prénom de ma grand-mère"
                  className="w-full rounded-xl bg-white px-3 py-2 text-sm text-stone-800 ring-1 ring-stone-200 focus:ring-2 focus:ring-rose-400 focus:outline-none"
                />
              </label>
            ) : null}
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <SwipeCard
              key={current.id}
              entry={current}
              likedByPartner={likedByPartner}
              spellings={spellings}
              onShowSpellings={spellings.length > 0 ? () => setSheet('spellings') : undefined}
              reducedMotion={reducedMotion}
              onDecide={decide}
            />
            {ghost ? (
              <GhostCard
                key={ghost.key}
                entry={ghost.entry}
                spellings={ghost.spellings}
                direction={ghost.direction}
                fromDx={ghost.fromDx}
              />
            ) : null}
          </div>

          <div className="fixed inset-x-0 bottom-16 z-10 bg-gradient-to-t from-stone-50 via-stone-50/95 to-stone-50/0 px-4 pt-3 pb-2">
            <SwipeActions
              onSkip={() => decide('skip')}
              onLike={() => decide('like')}
              onUndo={undo}
              canUndo={history.length > 0}
            />
          </div>

          <SpellingsSheet
            open={sheet === 'spellings'}
            entry={current}
            spellings={spellings}
            mine={mine}
            theirs={theirs}
            partnerName={partner?.displayName ?? null}
            onLike={likeSpelling}
            onUnlike={unlikeSpelling}
            onClose={closeSheet}
          />
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-center">
          <EmptyState
            icon="🎉"
            title={
              pool.length === 0 && activeFilterCount > 0 ? 'Aucun prénom' : 'Vous avez tout vu !'
            }
            description={
              pool.length === 0
                ? activeFilterCount > 0
                  ? 'Aucun prénom ne correspond à vos filtres. Élargissez-les pour continuer.'
                  : 'Aucun prénom ne correspond à votre préférence pour le moment.'
                : activeFilterCount > 0
                  ? 'Il ne reste plus aucun prénom à découvrir avec ces filtres. Élargissez-les, ou passez en revue votre liste ou vos matchs.'
                  : 'Il ne reste plus aucun prénom à découvrir pour cette préférence. Passez en revue votre liste ou vos matchs.'
            }
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSheet('filters')}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                  >
                    Modifier les filtres
                  </button>
                ) : null}
                <LinkButton to="/liste" variant={activeFilterCount > 0 ? 'secondary' : 'primary'}>
                  Voir la liste
                </LinkButton>
                <LinkButton to="/matchs" variant="secondary">
                  Nos matchs
                </LinkButton>
                {history.length > 0 ? (
                  <button
                    type="button"
                    onClick={undo}
                    className="min-h-11 rounded-xl px-4 text-sm font-semibold text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                  >
                    Annuler la dernière décision
                  </button>
                ) : null}
              </div>
            }
          />
        </div>
      )}

      <SwipeFilterSheet
        open={sheet === 'filters'}
        filters={filters}
        resultCount={queue.length}
        onChange={changeFilters}
        onClose={closeSheet}
      />
    </section>
  );
}

function LinkButton({
  to,
  variant,
  children,
}: {
  to: string;
  variant: 'primary' | 'secondary';
  children: ReactNode;
}) {
  const look =
    variant === 'primary'
      ? 'bg-rose-600 text-white shadow-sm hover:bg-rose-700'
      : 'bg-white text-stone-800 ring-1 ring-stone-200 shadow-sm hover:bg-stone-50';
  return (
    <Link
      to={to}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${look}`}
    >
      {children}
    </Link>
  );
}
