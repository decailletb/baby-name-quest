import { Badge } from '../../components/ui/Badge';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { formatCount, popularityLabel } from '../../data/popularity';
import type { NameEntry } from '../../data/types';
import type { Vote } from '../../storage';

interface SpellingsSheetProps {
  open: boolean;
  /** Name on the card. */
  entry: NameEntry;
  /** Its other spellings, most popular first. */
  spellings: NameEntry[];
  mine: ReadonlyMap<string, Vote>;
  theirs: ReadonlyMap<string, Vote>;
  partnerName: string | null;
  onLike(id: string): void;
  onUnlike(id: string): void;
  onClose(): void;
}

/** Other spellings of the name on the card, each with its own heart. */
export function SpellingsSheet({
  open,
  entry,
  spellings,
  mine,
  theirs,
  partnerName,
  onLike,
  onUnlike,
  onClose,
}: SpellingsSheetProps) {
  return (
    <BottomSheet
      open={open}
      title={`Autres orthographes de ${entry.name}`}
      onClose={onClose}
      closeLabel="Fermer les orthographes"
    >
      <p className="-mt-2 text-sm text-stone-600">
        Ces prénoms se prononcent comme {entry.name}. Ajoutez ceux que vous préférez à vos favoris,
        la carte reste à décider séparément.
      </p>
      <ul className="flex flex-col gap-2">
        {spellings.map((spelling) => {
          const liked = mine.get(spelling.id)?.value === 'like';
          const partnerLiked = theirs.get(spelling.id)?.value === 'like';
          return (
            <li
              key={spelling.id}
              className="flex items-center gap-2 rounded-2xl bg-white py-2 pr-2 pl-4 shadow-sm ring-1 ring-stone-200"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-lg font-semibold text-stone-800">{spelling.name}</span>
                  {liked && partnerLiked ? <Badge tone="rose">Match</Badge> : null}
                  {!liked && partnerLiked ? (
                    <span className="text-xs font-medium text-rose-700">
                      <span aria-hidden="true">💞 </span>
                      Aimé par {partnerName ?? 'votre moitié'}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-stone-500">
                  {popularityLabel(spelling)} · rang {formatCount(spelling.popularityRank)} ·{' '}
                  {formatCount(spelling.recentFR + spelling.recentCH)} naissances sur 5 ans
                </span>
              </div>
              <button
                type="button"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${
                  liked ? 'text-rose-600 hover:bg-rose-50' : 'text-stone-300 hover:bg-stone-100'
                }`}
                aria-pressed={liked}
                aria-label={
                  liked ? `Retirer ${spelling.name} de mes favoris` : `Aimer ${spelling.name}`
                }
                onClick={() => (liked ? onUnlike(spelling.id) : onLike(spelling.id))}
              >
                <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
