import type { NameEntry } from './types';

/**
 * Spelling variants: names that sound the same in French are grouped under a single key so the
 * discovery queue shows one card per family (« Mohamed » rather than « Mohamed », « Mohammed »,
 * « Muhammad »…). The key is a rough French phonetic signature:
 *
 * - accents and case are ignored, « y » counts as « i », « ph » as « f », « ch/sh/kh/qu » as « k »…
 * - a consonant followed by « h » loses the « h », a lone « h » is silent;
 * - double letters are collapsed and a final silent « e » is dropped;
 * - every vowel is a syllable (« Lina » ≠ « Liana »), except « ou » and « au »; the first and the
 *   final vowel sounds are kept exactly (« Lina » ≠ « Lena » ≠ « Luna », « Léa » ≠ « Léo ») while the
 *   vowels in between only keep a broad class (« Ahmed » = « Ahmad », « Mohamed » = « Muhammad »);
 * - the gender is part of the key (« Gabriel » ≠ « Gabrielle »).
 *
 * Compound names are keyed part by part, so « Mohamed-Amine » never merges with « Mohamed ».
 */

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
/** Marks a syllable break inside a vowel run (diaeresis: « Maëlle » = ma-elle). */
const BREAK = '|';

/** « o » and « u » sound alike enough across spellings (« Mohamed » / « Mouhamed » / « Muhammad »). */
function vowelClass(vowel: string): string {
  return vowel === 'u' ? 'o' : vowel;
}

/** Broad class of a vowel that is neither the first sound nor the final one (« Ahmed » / « Ahmad »). */
function innerClass(vowel: string): string {
  if (vowel === 'a' || vowel === 'e') return 'A';
  if (vowel === 'i') return 'I';
  return 'O';
}

/** Lower case ASCII letters only; « ç » and the diaeresis are handled before accents are stripped. */
function toAsciiLetters(part: string): string {
  return part
    .toLowerCase()
    .normalize('NFC')
    .replace(/ç/g, 's')
    .replace(/([ëïüÿ])/g, `${BREAK}$1`)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 's')
    .replace(/[^a-z|]/g, '');
}

/** French-flavoured phonetic rewrite of a single name part. */
function phonetic(part: string): string {
  return (
    toAsciiLetters(part)
      .replace(/y/g, 'i')
      .replace(/ph/g, 'f')
      .replace(/(sch|ch|sh|kh|qu|ck|q)/g, 'k')
      .replace(/gi([aou])/g, 'j$1')
      .replace(/ge([aou])/g, 'j$1')
      .replace(/g([ei])/g, 'j$1')
      .replace(/gu([ei])/g, 'g$1')
      .replace(/c([ei])/g, 's$1')
      .replace(/c/g, 'k')
      .replace(/w/g, 'v')
      // A consonant followed by « h » keeps the consonant (« th », « dh »…); a lone « h » is silent.
      .replace(/([^aeiou|])h/g, '$1')
      .replace(/h/g, '')
      // Vowel digraphs that make a single sound.
      .replace(/eau/g, 'o')
      .replace(/au/g, 'o')
      .replace(/ou/g, 'u')
      // Final silent « e » (« Anne » / « Ann », « Chloé » / « Chloe »), then a final « d » sounds like « t ».
      .replace(/e\|?$/, '')
      .replace(/d$/, 't')
      // Collapse repeated letters (« Anna » → « Ana », « Mathilde » / « Matilde »).
      .replace(/(.)\1+/g, '$1')
      .replace(/\|$/, '')
  );
}

/**
 * Sound signature of a part: consonants and vowels in order, with the first and the final vowel
 * kept exactly and the vowels in between reduced to a broad class.
 */
function signatureOf(sound: string): string {
  const letters: string[] = [];
  const vowelAt: number[] = [];
  let previousVowel = false;
  for (const letter of sound) {
    if (letter === BREAK) {
      previousVowel = false;
    } else if (VOWELS.has(letter)) {
      const vowel = vowelClass(letter);
      // Two different vowels in a row are two syllables (« Léa », « Lia », « Noa »).
      if (!previousVowel || letters[letters.length - 1] !== vowel) {
        vowelAt.push(letters.length);
        letters.push(vowel);
      }
      previousVowel = true;
    } else {
      letters.push(letter);
      previousVowel = false;
    }
  }
  const endsWithVowel = previousVowel;
  vowelAt.forEach((position, index) => {
    if (index === 0) return;
    if (index === vowelAt.length - 1 && endsWithVowel) return;
    letters[position] = innerClass(letters[position]);
  });
  return letters.join('');
}

function partKey(part: string): string {
  const sound = phonetic(part);
  return sound ? signatureOf(sound) : '';
}

/** Phonetic grouping key of a name; names with the same key are spelling variants of each other. */
export function variantKey(name: string, gender: NameEntry['gender']): string {
  const parts = name
    .normalize('NFC')
    .split(/[\s\-'’]+/)
    .map(partKey)
    .filter(Boolean);
  return `${gender}:${parts.join('-')}`;
}

export interface VariantGroups {
  /** Names shown as the representative of their family: the most popular spelling. */
  canonical: NameEntry[];
  /** Every member of a family (representative first), keyed by the representative id. */
  membersOf: Map<string, NameEntry[]>;
  /** Representative id of any name, itself included. */
  canonicalOf: Map<string, string>;
}

/** Groups names by spelling variants; the most popular spelling represents each family. */
export function groupVariants(names: readonly NameEntry[]): VariantGroups {
  const byKey = new Map<string, NameEntry[]>();
  for (const entry of names) {
    const key = variantKey(entry.name, entry.gender);
    const members = byKey.get(key);
    if (members) members.push(entry);
    else byKey.set(key, [entry]);
  }
  const canonical: NameEntry[] = [];
  const membersOf = new Map<string, NameEntry[]>();
  const canonicalOf = new Map<string, string>();
  for (const members of byKey.values()) {
    members.sort(
      (a, b) => a.popularityRank - b.popularityRank || a.name.localeCompare(b.name, 'fr'),
    );
    const representative = members[0];
    canonical.push(representative);
    membersOf.set(representative.id, members);
    for (const member of members) canonicalOf.set(member.id, representative.id);
  }
  return { canonical, membersOf, canonicalOf };
}

/** Other spellings of a name (the name itself excluded), most popular first. */
export function otherSpellings(groups: VariantGroups, id: string): NameEntry[] {
  const representative = groups.canonicalOf.get(id);
  if (!representative) return [];
  return (groups.membersOf.get(representative) ?? []).filter((entry) => entry.id !== id);
}

const SPELLINGS_PREVIEW = 3;

/** « Mohammed, Muhammad, Mohammad et 12 autres » */
export function describeSpellings(spellings: readonly NameEntry[]): string {
  const preview = spellings.slice(0, SPELLINGS_PREVIEW).map((entry) => entry.name);
  const rest = spellings.length - preview.length;
  if (rest === 0) return preview.join(', ');
  return `${preview.join(', ')} et ${rest} autre${rest > 1 ? 's' : ''}`;
}
