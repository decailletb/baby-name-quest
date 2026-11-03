import type { GenderPreference } from '../data/types';

export type VoteValue = 'like' | 'skip';

export interface Couple {
  code: string;
  createdAt: string;
  /** Ordered ids of the names the couple ranked in « Nos matchs ». */
  matchOrder: string[];
}

export interface Profile {
  id: string;
  coupleCode: string;
  displayName: string;
  genderPreference: GenderPreference;
  createdAt: string;
}

export interface Vote {
  profileId: string;
  nameId: string;
  value: VoteValue;
  note: string | null;
  updatedAt: string;
}

export type StorageKind = 'local' | 'supabase';

/**
 * Persistence boundary of the application. Implementations must be safe to
 * call repeatedly and must resolve even when offline (queueing is allowed).
 */
export interface StorageAdapter {
  readonly kind: StorageKind;
  /** Creates the couple if it does not exist and returns it. */
  ensureCouple(code: string): Promise<Couple>;
  listProfiles(coupleCode: string): Promise<Profile[]>;
  upsertProfile(profile: Profile): Promise<Profile>;
  /** Every vote of both profiles of the couple. */
  listVotes(coupleCode: string): Promise<Vote[]>;
  saveVote(coupleCode: string, vote: Vote): Promise<void>;
  deleteVote(coupleCode: string, profileId: string, nameId: string): Promise<void>;
  saveMatchOrder(coupleCode: string, nameIds: string[]): Promise<void>;
  /** Called whenever another device changed the couple's data. Returns an unsubscribe function. */
  subscribe(coupleCode: string, onChange: () => void): () => void;
}

/** Couple codes are shared aloud between two people: keep them short and forgiving. */
export function normalizeCoupleCode(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidCoupleCode(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{2,38}[A-Z0-9]$/.test(code);
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Shown when the synchronisation server cannot be reached at all. */
export const UNREACHABLE_MESSAGE =
  'Impossible de joindre le serveur de synchronisation. Vérifiez votre connexion puis réessayez ; ' +
  'vos favoris ne sont pas perdus.';

const NETWORK_FAILURE = /failed to fetch|networkerror|load failed|network request failed/i;

/** User-facing French message for a storage failure (network errors are reworded). */
export function describeStorageError(cause: unknown, fallback = 'Erreur de chargement'): string {
  const message = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  if (!message) return fallback;
  return NETWORK_FAILURE.test(message) ? UNREACHABLE_MESSAGE : message;
}
