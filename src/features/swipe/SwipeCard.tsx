import { useEffect, useState, type CSSProperties } from 'react';
import { GenderBadge, NameMeaning, NameStats, TrendBadge } from '../../components/NameBadges';
import { Badge } from '../../components/ui/Badge';
import type { NameEntry } from '../../data/types';
import { describeSpellings } from '../../data/variants';
import type { VoteValue } from '../../storage';
import { useSwipeGesture, type SwipeDirection } from './useSwipeGesture';

export const SWIPE_THRESHOLD = 80;
/** Duration (ms) of the fly-out animation of a decided card. */
export const EXIT_DURATION = 260;

export interface CardFaceProps {
  entry: NameEntry;
  /** Display name of the partner when they already liked this name. */
  likedByPartner?: string | null;
  /** Overlay label to preview the decision while dragging. */
  overlay?: { direction: SwipeDirection; opacity: number } | null;
  /** Other spellings of the name, most popular first. */
  spellings?: NameEntry[];
  /** Opens the list of spellings; without it the spellings are only mentioned. */
  onShowSpellings?: () => void;
  style?: CSSProperties;
  className?: string;
}

/** Visual content of a card, shared by the live card and the animated ghost. */
export function CardFace({
  entry,
  likedByPartner = null,
  overlay = null,
  spellings = [],
  onShowSpellings,
  style,
  className = '',
}: CardFaceProps) {
  const spellingsText = spellings.length > 0 ? `Aussi écrit ${describeSpellings(spellings)}` : null;
  return (
    <div
      style={style}
      className={`relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-3xl bg-white p-5 shadow-lg ring-1 ring-stone-200 ${className}`}
    >
      {overlay ? (
        <span
          aria-hidden="true"
          style={{ opacity: overlay.opacity }}
          className={`absolute top-6 rounded-xl border-4 px-3 py-1 text-2xl font-extrabold uppercase tracking-wider ${
            overlay.direction === 'right'
              ? 'left-6 -rotate-12 border-emerald-500 text-emerald-600'
              : 'right-6 rotate-12 border-red-500 text-red-600'
          }`}
        >
          {overlay.direction === 'right' ? "J'aime" : 'Je passe'}
        </span>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <GenderBadge gender={entry.gender} />
        <TrendBadge trend={entry.trend} />
        {entry.origin ? <Badge tone="stone">Origine {entry.origin}</Badge> : null}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2 text-center">
        <h2 className="max-w-full text-4xl leading-tight font-extrabold break-words text-stone-800 sm:text-6xl">
          {entry.name}
        </h2>
        <NameMeaning entry={entry} className="max-w-prose text-base sm:text-lg" />
        {spellingsText && onShowSpellings ? (
          <button
            type="button"
            onClick={onShowSpellings}
            aria-label={`${spellingsText}. Voir les autres orthographes`}
            className="max-w-full rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
          >
            <span aria-hidden="true">✍️ </span>
            {spellingsText}
            <span aria-hidden="true"> ›</span>
          </button>
        ) : spellingsText ? (
          <p className="max-w-full rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-600">
            <span aria-hidden="true">✍️ </span>
            {spellingsText}
          </p>
        ) : null}
        {likedByPartner ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
            <span aria-hidden="true">❤️</span>
            Aimé aussi par {likedByPartner}
          </p>
        ) : null}
      </div>

      <NameStats entry={entry} />
    </div>
  );
}

export interface SwipeCardProps {
  entry: NameEntry;
  likedByPartner?: string | null;
  spellings?: NameEntry[];
  onShowSpellings?: () => void;
  reducedMotion: boolean;
  onDecide: (value: VoteValue, fromDx: number) => void;
}

/** The card on top of the stack: draggable horizontally, announces the decision preview. */
export function SwipeCard({
  entry,
  likedByPartner,
  spellings,
  onShowSpellings,
  reducedMotion,
  onDecide,
}: SwipeCardProps) {
  const gesture = useSwipeGesture({
    threshold: SWIPE_THRESHOLD,
    reducedMotion,
    onSwipe: (direction, fromDx) => onDecide(direction === 'right' ? 'like' : 'skip', fromDx),
  });
  const previewDirection: SwipeDirection | null =
    gesture.dx === 0 ? null : gesture.dx > 0 ? 'right' : 'left';

  return (
    <article
      aria-label={`Prénom ${entry.name}`}
      data-testid="swipe-card"
      {...gesture.handlers}
      className="flex flex-1 touch-pan-y flex-col select-none"
    >
      <CardFace
        entry={entry}
        likedByPartner={likedByPartner}
        spellings={spellings}
        onShowSpellings={onShowSpellings}
        style={gesture.style}
        overlay={
          previewDirection ? { direction: previewDirection, opacity: gesture.progress } : null
        }
        className={gesture.dragging ? 'cursor-grabbing' : 'cursor-grab'}
      />
    </article>
  );
}

export interface GhostCardProps {
  entry: NameEntry;
  spellings?: NameEntry[];
  direction: SwipeDirection;
  fromDx: number;
}

/** Non-interactive copy of a decided card flying off the screen. */
export function GhostCard({ entry, spellings, direction, fromDx }: GhostCardProps) {
  const [flying, setFlying] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFlying(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const distance = typeof window === 'undefined' ? 600 : window.innerWidth * 1.2;
  const targetX = direction === 'right' ? distance : -distance;
  const x = flying ? targetX : fromDx;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col">
      <CardFace
        entry={entry}
        spellings={spellings}
        overlay={{ direction, opacity: 1 }}
        style={{
          transform: `translateX(${x}px) rotate(${x * 0.05}deg)`,
          opacity: flying ? 0 : 1,
          transition: `transform ${EXIT_DURATION}ms ease-in, opacity ${EXIT_DURATION}ms ease-in`,
        }}
      />
    </div>
  );
}
