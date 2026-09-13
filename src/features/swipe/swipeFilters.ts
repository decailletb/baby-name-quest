import { LETTERS } from '../../data/filters';
import { POPULARITY_BUCKETS, popularityBucket, type PopularityBucket } from '../../data/popularity';
import type { NameEntry } from '../../data/types';

/** Filters narrowing the discovery queue; both lists are « any of », an empty list means « all ». */
export interface SwipeFilters {
  /** First letters (without accent) to keep. */
  letters: string[];
  /** Popularity buckets to keep. */
  popularity: PopularityBucket[];
}

const BUCKETS: readonly PopularityBucket[] = POPULARITY_BUCKETS.map((bucket) => bucket.id);

/**
 * Out of the box the queue skips the « rare » names (beyond the 2 000 most popular): thousands of
 * seldom-given spellings would otherwise drown the ones worth a swipe. The chip stays one tap away.
 */
export const DEFAULT_SWIPE_FILTERS: SwipeFilters = {
  letters: [],
  popularity: ['classic', 'common', 'original'],
};

export const SWIPE_FILTERS_KEY = 'bnq.swipe.filters';

export function matchesSwipeFilters(entry: NameEntry, filters: SwipeFilters): boolean {
  if (filters.letters.length > 0 && !filters.letters.includes(entry.firstLetter)) return false;
  if (!filters.popularity.includes(popularityBucket(entry))) return false;
  return true;
}

export function applySwipeFilters(
  entries: readonly NameEntry[],
  filters: SwipeFilters,
): NameEntry[] {
  return entries.filter((entry) => matchesSwipeFilters(entry, filters));
}

/** Number of active restrictions, shown on the « Filtres » button. */
export function countSwipeFilters(filters: SwipeFilters): number {
  let count = 0;
  if (filters.letters.length > 0) count += 1;
  if (filters.popularity.length > 0 && filters.popularity.length < BUCKETS.length) count += 1;
  return count;
}

export function toggleSwipeLetter(filters: SwipeFilters, letter: string): SwipeFilters {
  const letters = filters.letters.includes(letter)
    ? filters.letters.filter((item) => item !== letter)
    : [...filters.letters, letter];
  return { ...filters, letters };
}

/** Adds or removes a bucket, keeping the natural order; the last bucket cannot be removed. */
export function toggleSwipeBucket(filters: SwipeFilters, bucket: PopularityBucket): SwipeFilters {
  if (filters.popularity.includes(bucket)) {
    if (filters.popularity.length === 1) return filters;
    return { ...filters, popularity: filters.popularity.filter((item) => item !== bucket) };
  }
  return {
    ...filters,
    popularity: BUCKETS.filter((item) => item === bucket || filters.popularity.includes(item)),
  };
}

function stringList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const result: T[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.includes(item as T)) continue;
    if (!result.includes(item as T)) result.push(item as T);
  }
  return result;
}

/** Coerces any parsed value into well-formed filters, dropping unknown entries. */
export function sanitizeSwipeFilters(input: unknown): SwipeFilters {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_SWIPE_FILTERS };
  }
  const raw = input as Record<string, unknown>;
  const popularity = stringList(raw.popularity, BUCKETS);
  return {
    letters: stringList(raw.letters, LETTERS),
    popularity: popularity.length > 0 ? popularity : [...DEFAULT_SWIPE_FILTERS.popularity],
  };
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Filters saved on this device, or the defaults when nothing usable is stored. */
export function readSwipeFilters(storage: Storage | null = safeStorage()): SwipeFilters {
  try {
    const raw = storage?.getItem(SWIPE_FILTERS_KEY);
    if (!raw) return { ...DEFAULT_SWIPE_FILTERS };
    return sanitizeSwipeFilters(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SWIPE_FILTERS };
  }
}

export function writeSwipeFilters(
  filters: SwipeFilters,
  storage: Storage | null = safeStorage(),
): void {
  try {
    storage?.setItem(SWIPE_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    // Private mode or full storage: the filters simply will not survive a reload.
  }
}
