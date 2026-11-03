import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { GenderPreference } from '../data/types';
import {
  createId,
  describeStorageError,
  getStorageAdapter,
  nowIso,
  type Couple,
  type Profile,
  type StorageAdapter,
  type StorageKind,
  type Vote,
  type VoteValue,
} from '../storage';
import { readDeviceSession, writeDeviceSession, type DeviceSession } from './deviceSession';

export type SessionStatus = 'loading' | 'needs-code' | 'needs-profile' | 'ready';

export interface SessionState {
  status: SessionStatus;
  storageKind: StorageKind | null;
  couple: Couple | null;
  profiles: Profile[];
  profile: Profile | null;
  partner: Profile | null;
  votes: Vote[];
  error: string | null;
}

export interface SessionActions {
  joinCouple(code: string): Promise<void>;
  selectProfile(profileId: string): Promise<void>;
  createProfile(displayName: string, genderPreference: GenderPreference): Promise<void>;
  updatePreference(genderPreference: GenderPreference): Promise<void>;
  vote(nameId: string, value: VoteValue, note?: string | null): Promise<void>;
  removeVote(nameId: string): Promise<void>;
  setNote(nameId: string, note: string | null): Promise<void>;
  saveMatchOrder(nameIds: string[]): Promise<void>;
  /** Forget the profile on this device but keep the couple code. */
  switchProfile(): void;
  /** Forget everything on this device. */
  leaveCouple(): void;
  refresh(): Promise<void>;
}

export type SessionContextValue = SessionState & SessionActions;

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
  /** Injected in tests; defaults to the adapter picked from the environment. */
  adapter?: StorageAdapter;
  initialSession?: DeviceSession;
}

export function SessionProvider({
  children,
  adapter: injected,
  initialSession,
}: SessionProviderProps) {
  const [adapter, setAdapter] = useState<StorageAdapter | null>(injected ?? null);
  const [device, setDevice] = useState<DeviceSession>(() => initialSession ?? readDeviceSession());
  const [couple, setCouple] = useState<Couple | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const deviceRef = useRef(device);
  deviceRef.current = device;

  useEffect(() => {
    if (injected) return;
    let cancelled = false;
    getStorageAdapter().then((resolved) => {
      if (!cancelled) setAdapter(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [injected]);

  useEffect(() => {
    writeDeviceSession(device);
  }, [device]);

  const loadCouple = useCallback(
    async (code: string) => {
      if (!adapter) return;
      const [ensured, profileList, voteList] = await Promise.all([
        adapter.ensureCouple(code),
        adapter.listProfiles(code),
        adapter.listVotes(code),
      ]);
      setCouple(ensured);
      setProfiles(profileList);
      setVotes(voteList);
    },
    [adapter],
  );

  // Initial load and realtime subscription for the current couple.
  useEffect(() => {
    if (!adapter) return;
    const code = device.coupleCode;
    if (!code) {
      setCouple(null);
      setProfiles([]);
      setVotes([]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    loadCouple(code)
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeStorageError(cause));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    const unsubscribe = adapter.subscribe(code, () => {
      loadCouple(code).catch(() => undefined);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [adapter, device.coupleCode, loadCouple]);

  const profile = useMemo(
    () => profiles.find((item) => item.id === device.profileId) ?? null,
    [profiles, device.profileId],
  );
  const partner = useMemo(
    () => (profile ? (profiles.find((item) => item.id !== profile.id) ?? null) : null),
    [profiles, profile],
  );

  const status: SessionStatus =
    !adapter || !loaded
      ? 'loading'
      : !device.coupleCode
        ? 'needs-code'
        : !profile
          ? 'needs-profile'
          : 'ready';

  const requireContext = useCallback(() => {
    const code = deviceRef.current.coupleCode;
    if (!adapter || !code) throw new Error('Aucun couple sélectionné');
    return { adapter, code };
  }, [adapter]);

  const actions: SessionActions = useMemo(
    () => ({
      async joinCouple(code) {
        setError(null);
        setDevice({ coupleCode: code, profileId: null });
      },
      async selectProfile(profileId) {
        setDevice((current) => ({ ...current, profileId }));
      },
      async createProfile(displayName, genderPreference) {
        const { adapter: store, code } = requireContext();
        const created: Profile = {
          id: createId(),
          coupleCode: code,
          displayName: displayName.trim(),
          genderPreference,
          createdAt: nowIso(),
        };
        await store.upsertProfile(created);
        setProfiles((current) => [...current, created]);
        setDevice((current) => ({ ...current, profileId: created.id }));
      },
      async updatePreference(genderPreference) {
        const { adapter: store } = requireContext();
        const current = profiles.find((item) => item.id === deviceRef.current.profileId);
        if (!current) return;
        const updated = { ...current, genderPreference };
        setProfiles((list) => list.map((item) => (item.id === updated.id ? updated : item)));
        await store.upsertProfile(updated);
      },
      async vote(nameId, value, note) {
        const { adapter: store, code } = requireContext();
        const profileId = deviceRef.current.profileId;
        if (!profileId) return;
        const existing = votes.find(
          (item) => item.profileId === profileId && item.nameId === nameId,
        );
        const next: Vote = {
          profileId,
          nameId,
          value,
          note: note === undefined ? (existing?.note ?? null) : note,
          updatedAt: nowIso(),
        };
        setVotes((current) => [
          ...current.filter((item) => !(item.profileId === profileId && item.nameId === nameId)),
          next,
        ]);
        await store.saveVote(code, next);
      },
      async removeVote(nameId) {
        const { adapter: store, code } = requireContext();
        const profileId = deviceRef.current.profileId;
        if (!profileId) return;
        setVotes((current) =>
          current.filter((item) => !(item.profileId === profileId && item.nameId === nameId)),
        );
        await store.deleteVote(code, profileId, nameId);
      },
      async setNote(nameId, note) {
        const profileId = deviceRef.current.profileId;
        const existing = votes.find(
          (item) => item.profileId === profileId && item.nameId === nameId,
        );
        if (!existing) return;
        await actions.vote(nameId, existing.value, note);
      },
      async saveMatchOrder(nameIds) {
        const { adapter: store, code } = requireContext();
        setCouple((current) => (current ? { ...current, matchOrder: nameIds } : current));
        await store.saveMatchOrder(code, nameIds);
      },
      switchProfile() {
        setDevice((current) => ({ ...current, profileId: null }));
      },
      leaveCouple() {
        setError(null);
        setDevice({ coupleCode: null, profileId: null });
      },
      async refresh() {
        const code = deviceRef.current.coupleCode;
        if (!code) return;
        setError(null);
        try {
          await loadCouple(code);
        } catch (cause) {
          setError(describeStorageError(cause));
        }
      },
    }),
    [requireContext, profiles, votes, loadCouple],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      storageKind: adapter?.kind ?? null,
      couple,
      profiles,
      profile,
      partner,
      votes,
      error,
      ...actions,
    }),
    [status, adapter, couple, profiles, profile, partner, votes, error, actions],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook and provider share one module on purpose
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
