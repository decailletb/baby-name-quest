import { beforeEach, describe, expect, it } from 'vitest';
import type { NameEntry } from '../../data/types';
import {
  DEFAULT_SWIPE_FILTERS,
  SWIPE_FILTERS_KEY,
  applySwipeFilters,
  countSwipeFilters,
  readSwipeFilters,
  sanitizeSwipeFilters,
  toggleSwipeBucket,
  toggleSwipeLetter,
  writeSwipeFilters,
} from './swipeFilters';

function entry(name: string, popularityRank: number): NameEntry {
  return {
    id: name.toLowerCase(),
    name,
    gender: 'f',
    countFR: 1000,
    countCH: 100,
    recentFR: 100,
    recentCH: 10,
    popularityRank,
    trend: 'stable',
    firstLetter: name.charAt(0).toUpperCase(),
    length: name.length,
  };
}

const NAMES = [entry('Emma', 1), entry('Elsa', 300), entry('Enora', 1500), entry('Zoé', 2500)];

describe('applySwipeFilters', () => {
  it('drops the rare names by default', () => {
    expect(applySwipeFilters(NAMES, DEFAULT_SWIPE_FILTERS).map((item) => item.name)).toEqual([
      'Emma',
      'Elsa',
      'Enora',
    ]);
  });

  it('combines the first letter and the popularity', () => {
    const filters = { letters: ['Z'], popularity: ['rare' as const] };
    expect(applySwipeFilters(NAMES, filters).map((item) => item.name)).toEqual(['Zoé']);
    const all = ['classic', 'common', 'original', 'rare'] as const;
    expect(applySwipeFilters(NAMES, { letters: ['E'], popularity: [...all] })).toHaveLength(3);
  });
});

describe('toggles', () => {
  it('adds and removes letters', () => {
    const withE = toggleSwipeLetter(DEFAULT_SWIPE_FILTERS, 'E');
    expect(withE.letters).toEqual(['E']);
    expect(toggleSwipeLetter(withE, 'E').letters).toEqual([]);
  });

  it('keeps the buckets in their natural order and never empties them', () => {
    const withRare = toggleSwipeBucket(DEFAULT_SWIPE_FILTERS, 'rare');
    expect(withRare.popularity).toEqual(['classic', 'common', 'original', 'rare']);
    const onlyClassic = { letters: [], popularity: ['classic' as const] };
    expect(toggleSwipeBucket(onlyClassic, 'classic')).toEqual(onlyClassic);
    expect(toggleSwipeBucket(onlyClassic, 'original').popularity).toEqual(['classic', 'original']);
  });

  it('counts the active restrictions', () => {
    expect(countSwipeFilters({ letters: [], popularity: [] })).toBe(0);
    expect(countSwipeFilters(DEFAULT_SWIPE_FILTERS)).toBe(1);
    expect(countSwipeFilters({ letters: ['A'], popularity: ['classic'] })).toBe(2);
  });
});

describe('persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('falls back to the defaults when nothing usable is stored', () => {
    expect(readSwipeFilters()).toEqual(DEFAULT_SWIPE_FILTERS);
    window.localStorage.setItem(SWIPE_FILTERS_KEY, '{not json');
    expect(readSwipeFilters()).toEqual(DEFAULT_SWIPE_FILTERS);
    expect(readSwipeFilters(null)).toEqual(DEFAULT_SWIPE_FILTERS);
  });

  it('round-trips the filters and drops unknown values', () => {
    writeSwipeFilters({ letters: ['A', 'Z'], popularity: ['rare'] });
    expect(readSwipeFilters()).toEqual({ letters: ['A', 'Z'], popularity: ['rare'] });
    expect(
      sanitizeSwipeFilters({ letters: ['a', 'B', 'B', 3], popularity: ['classic', 'nope'] }),
    ).toEqual({ letters: ['B'], popularity: ['classic'] });
    expect(sanitizeSwipeFilters({ popularity: [] }).popularity).toEqual(
      DEFAULT_SWIPE_FILTERS.popularity,
    );
    expect(sanitizeSwipeFilters('junk')).toEqual(DEFAULT_SWIPE_FILTERS);
  });

  it('survives an unavailable storage', () => {
    expect(() => writeSwipeFilters(DEFAULT_SWIPE_FILTERS, null)).not.toThrow();
  });
});
