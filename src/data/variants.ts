import type { NameEntry } from './types';

/**
 * Spelling variants: names that sound the same in French are grouped under a single key so the
 * discovery queue shows one card per family (« Mohamed » rather than « Mohamed », « Mohammed »,
 * « Muhammad »…). The key is a rough French phonetic signature:
 *
 * - accents and case are ignored, « y » counts as « i », « ph » as « f », « ch/sh/kh/qu » as « k »…
 * - a consonant followed by « h » loses the « h », a lone « h » is silent;
 * - « dj » sounds like « j » (« Djibril » / « Jibril »), a final « aux » or « ot » like « o »
 *   (« Margaux » / « Margot ») ;
 * - double letters are collapsed and a final silent « e » is dropped, but a final « é » is a vowel
 *   (« Anaé » ≠ « Anna », « Tomé » ≠ « Tom ») and « Chloe » reads like « Chloé »;
 * - every vowel is a syllable (« Lina » ≠ « Liana »), except « ou » and « au »; the first and the
 *   final vowel sounds are kept exactly (« Lina » ≠ « Lena » ≠ « Luna », « Léa » ≠ « Léo ») while the
 *   vowels in between only keep a broad class (« Ahmed » = « Ahmad », « Mohamed » = « Muhammad »);
 * - the gender is part of the key (« Gabriel » ≠ « Gabrielle »); a mixed name joins the boys' or
 *   the girls' family that sounds and is written alike (« Sasha » with « Sacha »).
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
  return (
    part
      .toLowerCase()
      .normalize('NFC')
      // A final « é » is a vowel of its own, like after a diaeresis (« Noé » reads like « Noë »).
      .replace(/(ée|é|è)$/, `${BREAK}e`)
      .replace(/ç/g, 's')
      .replace(/([ëïüÿ])/g, `${BREAK}$1`)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/æ/g, 'ae')
      .replace(/œ/g, 'oe')
      .replace(/ø/g, 'o')
      .replace(/ß/g, 's')
      .replace(/[^a-z|]/g, '')
  );
}

/** French-flavoured phonetic rewrite of a single name part. */
function phonetic(part: string): string {
  return (
    toAsciiLetters(part)
      .replace(/y/g, 'i')
      .replace(/ph/g, 'f')
      .replace(/dj/g, 'j')
      // Silent endings: « Margaux » / « Margot » (but « Eliot » keeps its « t »).
      .replace(/aux$/, 'o')
      .replace(/([^i])ot$/, '$1o')
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
      // Final silent « e » after a consonant or « i » (« Anne » / « Ann », « Marie » / « Mari »);
      // after « a » or « o » it is heard (« Chloe » / « Chloé »). Then a final « d » sounds like « t ».
      .replace(/([^aoe|])e$/, '$1')
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

/** Phonetic signature of a whole name, compound parts kept in order and apart. */
export function soundKey(name: string): string {
  return name
    .normalize('NFC')
    .split(/[\s\-'’]+/)
    .map(partKey)
    .filter(Boolean)
    .join('-');
}

/** Phonetic grouping key of a name; names with the same key are spelling variants of each other. */
export function variantKey(name: string, gender: NameEntry['gender']): string {
  return `${gender}:${soundKey(name)}`;
}

export interface VariantGroups {
  /** Names shown as the representative of their family: the most popular spelling. */
  canonical: NameEntry[];
  /** Every member of a family (representative first), keyed by the representative id. */
  membersOf: Map<string, NameEntry[]>;
  /** Representative id of any name, itself included. */
  canonicalOf: Map<string, string>;
}

const byPopularity = (a: NameEntry, b: NameEntry) =>
  a.popularityRank - b.popularityRank || a.name.localeCompare(b.name, 'fr');

/** Lower case spelling without accents, used to compare how two names are written. */
function plainSpelling(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Levenshtein distance between two short strings. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length];
}

/** Two mixed and gendered spellings are merged only when they are also written alike. */
const MIXED_MAX_EDITS = 2;

/** Groups names by spelling variants; the most popular spelling represents each family. */
export function groupVariants(names: readonly NameEntry[]): VariantGroups {
  const byKey = new Map<string, NameEntry[]>();
  for (const entry of names) {
    const key = variantKey(entry.name, entry.gender);
    const members = byKey.get(key);
    if (members) members.push(entry);
    else byKey.set(key, [entry]);
  }
  for (const members of byKey.values()) members.sort(byPopularity);

  // A mixed family joins the boys' or the girls' family that sounds the same, when only one of
  // them exists and both are written alike (« Charlie » with « Charly », « Sasha » with « Sacha »;
  // « Camille » stays apart from « Kamil »).
  for (const [key, members] of [...byKey]) {
    if (!key.startsWith('x:')) continue;
    const sound = key.slice(2);
    const boys = byKey.get(`m:${sound}`);
    const girls = byKey.get(`f:${sound}`);
    const target = boys && girls ? undefined : (boys ?? girls);
    if (!target) continue;
    const distance = editDistance(plainSpelling(members[0].name), plainSpelling(target[0].name));
    if (distance > MIXED_MAX_EDITS) continue;
    target.push(...members);
    target.sort(byPopularity);
    byKey.delete(key);
  }

  const canonical: NameEntry[] = [];
  const membersOf = new Map<string, NameEntry[]>();
  const canonicalOf = new Map<string, string>();
  for (const members of byKey.values()) {
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
