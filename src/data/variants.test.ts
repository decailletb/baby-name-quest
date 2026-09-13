import { describe, expect, it } from 'vitest';
import type { NameEntry } from './types';
import { describeSpellings, groupVariants, otherSpellings, variantKey } from './variants';

function entry(name: string, gender: NameEntry['gender'], popularityRank: number): NameEntry {
  return {
    id: `${name.toLowerCase()}-${gender}`,
    name,
    gender,
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

function sameKey(names: string[], gender: NameEntry['gender'] = 'f') {
  const keys = new Set(names.map((name) => variantKey(name, gender)));
  expect([...keys], names.join(' / ')).toHaveLength(1);
}

function distinctKeys(names: string[], gender: NameEntry['gender'] = 'f') {
  const keys = names.map((name) => variantKey(name, gender));
  expect(new Set(keys).size, names.join(' / ')).toBe(names.length);
}

describe('variantKey', () => {
  it('ignores case, accents and doubled letters', () => {
    sameKey(['Léa', 'Lea', 'LEA', 'Leah']);
    sameKey(['Anna', 'Ana', 'Hanna', 'Hannah']);
    sameKey(['Emma', 'Ema']);
    sameKey(['Lina', 'Lyna', 'Linna']);
  });

  it('groups the usual French spellings of a sound', () => {
    sameKey(['Chloé', 'Chloe', 'Cloé', 'Khloé', 'Chloë']);
    sameKey(['Zoé', 'Zoe', 'Zoë']);
    sameKey(['Théo', 'Theo', 'Teo'], 'm');
    sameKey(['Raphaël', 'Rafael', 'Raphael'], 'm');
    sameKey(['Mathis', 'Mathys', 'Matis', 'Mattis'], 'm');
    sameKey(['Maya', 'Maïa', 'Maia']);
    sameKey(['Aïcha', 'Aisha', 'Aicha']);
    sameKey(['Julia', 'Giulia']);
    sameKey(['Hugo', 'Ugo'], 'm');
    sameKey(['Noah', 'Noa'], 'm');
    sameKey(['Yanis', 'Yannis', 'Ianis'], 'm');
  });

  it('groups spellings that only differ by their inner vowels', () => {
    sameKey(['Mohamed', 'Mohammed', 'Muhammad', 'Mouhamed', 'Mohamad'], 'm');
    sameKey(['Ahmed', 'Ahmad', 'Ahmet'], 'm');
    sameKey(['Adam', 'Adem'], 'm');
  });

  it('keeps the first and the final vowel sounds apart', () => {
    distinctKeys(['Lina', 'Léna', 'Luna', 'Lana', 'Liana']);
    distinctKeys(['Léa', 'Léo', 'Lia']);
    distinctKeys(['Elena', 'Elina', 'Eliana']);
    distinctKeys(['Noé', 'Noa'], 'm');
    distinctKeys(['Ryan', 'Rayan'], 'm');
  });

  it('keeps clearly different names apart', () => {
    distinctKeys(['Sara', 'Zara']);
    distinctKeys(['Alya', 'Ayla']);
    distinctKeys(['Ahmed', 'Ahmadou', 'Amédée'], 'm');
    distinctKeys(['Emma', 'Emmy', 'Emna']);
  });

  it('separates genders and keeps compound names on their own', () => {
    expect(variantKey('Gabriel', 'm')).not.toBe(variantKey('Gabrielle', 'f'));
    expect(variantKey('Louis', 'm')).not.toBe(variantKey('Louise', 'f'));
    distinctKeys(['Mohamed', 'Mohamed-Amine'], 'm');
    sameKey(['Jean-Pierre', 'Jean Pierre', "Jean'Pierre"], 'm');
  });
});

describe('groupVariants', () => {
  const names = [
    entry('Mohammed', 'm', 559),
    entry('Mohamed', 'm', 63),
    entry('Muhammad', 'm', 764),
    entry('Emma', 'f', 3),
    entry('Ema', 'f', 503),
    entry('Louis', 'm', 5),
    entry('Louise', 'f', 12),
  ];
  const groups = groupVariants(names);

  it('represents each family by its most popular spelling', () => {
    expect(groups.canonical.map((item) => item.name).sort()).toEqual([
      'Emma',
      'Louis',
      'Louise',
      'Mohamed',
    ]);
  });

  it('lists the members of a family most popular first', () => {
    expect(groups.membersOf.get('mohamed-m')?.map((item) => item.name)).toEqual([
      'Mohamed',
      'Mohammed',
      'Muhammad',
    ]);
    expect(groups.membersOf.get('louis-m')?.map((item) => item.name)).toEqual(['Louis']);
    expect(groups.membersOf.has('mohammed-m')).toBe(false);
  });

  it('maps every name to its representative', () => {
    expect(groups.canonicalOf.get('muhammad-m')).toBe('mohamed-m');
    expect(groups.canonicalOf.get('mohamed-m')).toBe('mohamed-m');
    expect(groups.canonicalOf.get('ema-f')).toBe('emma-f');
    expect(groups.canonicalOf.get('louise-f')).toBe('louise-f');
  });

  it('gives the other spellings of a name, itself excluded', () => {
    expect(otherSpellings(groups, 'mohamed-m').map((item) => item.name)).toEqual([
      'Mohammed',
      'Muhammad',
    ]);
    expect(otherSpellings(groups, 'mohammed-m').map((item) => item.name)).toEqual([
      'Mohamed',
      'Muhammad',
    ]);
    expect(otherSpellings(groups, 'louis-m')).toEqual([]);
    expect(otherSpellings(groups, 'unknown')).toEqual([]);
  });

  it('does not mutate the input', () => {
    const copy = [...names];
    groupVariants(names);
    expect(names).toEqual(copy);
  });
});

describe('describeSpellings', () => {
  const spellings = ['Mohammed', 'Muhammad', 'Mohammad', 'Muhammed', 'Mouhamed'].map((name) =>
    entry(name, 'm', 1),
  );

  it('previews three spellings and counts the rest', () => {
    expect(describeSpellings(spellings.slice(0, 2))).toBe('Mohammed, Muhammad');
    expect(describeSpellings(spellings.slice(0, 4))).toBe(
      'Mohammed, Muhammad, Mohammad et 1 autre',
    );
    expect(describeSpellings(spellings)).toBe('Mohammed, Muhammad, Mohammad et 2 autres');
  });
});
