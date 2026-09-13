import type { ReactNode } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { LETTERS } from '../../data/filters';
import { POPULARITY_BUCKETS, formatCount } from '../../data/popularity';
import {
  countSwipeFilters,
  toggleSwipeBucket,
  toggleSwipeLetter,
  type SwipeFilters,
} from './swipeFilters';

interface SwipeFilterSheetProps {
  open: boolean;
  filters: SwipeFilters;
  /** Names left in the queue with these filters. */
  resultCount: number;
  onChange(next: SwipeFilters): void;
  onClose(): void;
}

/** Filters of the discovery queue: first letter and popularity. */
export function SwipeFilterSheet({
  open,
  filters,
  resultCount,
  onChange,
  onClose,
}: SwipeFilterSheetProps) {
  const activeCount = countSwipeFilters(filters);
  return (
    <BottomSheet
      open={open}
      title="Filtres de découverte"
      onClose={onClose}
      closeLabel="Fermer les filtres"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={activeCount === 0}
            onClick={() =>
              onChange({ letters: [], popularity: POPULARITY_BUCKETS.map((bucket) => bucket.id) })
            }
          >
            Tout afficher
          </Button>
          <Button onClick={onClose}>
            Voir {formatCount(resultCount)} prénom{resultCount > 1 ? 's' : ''}
          </Button>
        </div>
      }
    >
      <Section title="Première lettre" grid>
        {LETTERS.map((letter) => (
          <Chip
            key={letter}
            selected={filters.letters.includes(letter)}
            className="min-h-11 px-0"
            aria-label={`Lettre ${letter}`}
            onClick={() => onChange(toggleSwipeLetter(filters, letter))}
          >
            {letter}
          </Chip>
        ))}
      </Section>

      <Section
        title="Popularité"
        hint="Les orthographes proches sont déjà regroupées sur une seule carte"
      >
        {POPULARITY_BUCKETS.map((bucket) => (
          <Chip
            key={bucket.id}
            selected={filters.popularity.includes(bucket.id)}
            onClick={() => onChange(toggleSwipeBucket(filters, bucket.id))}
          >
            {bucket.label}
            <span className="ml-1 text-xs opacity-75">({bucket.hint})</span>
          </Chip>
        ))}
      </Section>
    </BottomSheet>
  );
}

function Section({
  title,
  hint,
  grid = false,
  children,
}: {
  title: string;
  hint?: string;
  grid?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-stone-700">{title}</legend>
      {hint ? <p className="-mt-1 text-xs text-stone-500">{hint}</p> : null}
      <div className={grid ? 'grid grid-cols-7 gap-1.5 sm:grid-cols-9' : 'flex flex-wrap gap-2'}>
        {children}
      </div>
    </fieldset>
  );
}
