import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { GENDER_PREFERENCE_LABELS, type GenderPreference } from '../../data/types';
import { describeStorageError, isValidCoupleCode, normalizeCoupleCode } from '../../storage';
import { useSession } from '../../store/SessionContext';

const PREFERENCES: GenderPreference[] = ['f', 'm', 'both'];

export function Onboarding() {
  const session = useSession();
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-10">
      <header className="mb-8 text-center">
        <p className="text-4xl" aria-hidden="true">
          👶
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-rose-600">Baby Name Quest</h1>
        <p className="mt-2 text-stone-600">Des milliers de prénoms, une shortlist à deux.</p>
      </header>
      {session.status === 'needs-code' ? (
        <CoupleCodeStep />
      ) : session.error && !session.couple ? (
        <UnreachableStep />
      ) : (
        <ProfileStep />
      )}
      {session.error ? (
        <p role="alert" className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {session.error}
        </p>
      ) : null}
    </main>
  );
}

/** The couple could not be loaded: offer to retry rather than a profile form that would fail too. */
function UnreachableStep() {
  const { refresh, leaveCouple } = useSession();
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  };
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
      <h2 className="text-lg font-bold text-stone-800">Connexion impossible</h2>
      <Button size="lg" disabled={retrying} onClick={() => void retry()}>
        {retrying ? 'Nouvelle tentative…' : 'Réessayer'}
      </Button>
      <Button variant="ghost" onClick={leaveCouple}>
        Changer de code de couple
      </Button>
    </div>
  );
}

function CoupleCodeStep() {
  const { joinCouple } = useSession();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = normalizeCoupleCode(value);
    if (!isValidCoupleCode(code)) {
      setError('Le code doit contenir entre 4 et 40 caractères (lettres, chiffres, tirets).');
      return;
    }
    setError(null);
    void joinCouple(code);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
    >
      <div>
        <h2 className="text-lg font-bold text-stone-800">Votre code de couple</h2>
        <p className="mt-1 text-sm text-stone-500">
          Choisissez un code secret et partagez-le avec votre moitié : c'est lui qui relie vos deux
          shortlists. Par exemple : <span className="font-mono">DUPONT-2026</span>.
        </p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-stone-700">Code de couple</span>
        <input
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="min-h-12 rounded-xl border border-stone-300 px-4 font-mono text-lg uppercase tracking-wide focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
          placeholder="DUPONT-2026"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'couple-code-error' : undefined}
        />
        {value && normalizeCoupleCode(value) !== value.trim() ? (
          <span className="text-xs text-stone-500">
            Sera enregistré comme <span className="font-mono">{normalizeCoupleCode(value)}</span>
          </span>
        ) : null}
        {error ? (
          <span id="couple-code-error" className="text-sm text-red-600">
            {error}
          </span>
        ) : null}
      </label>
      <Button type="submit" size="lg">
        Continuer
      </Button>
    </form>
  );
}

function ProfileStep() {
  const { couple, profiles, selectProfile, createProfile, leaveCouple } = useSession();
  const [creating, setCreating] = useState(profiles.length === 0);
  const [name, setName] = useState('');
  const [preference, setPreference] = useState<GenderPreference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canCreate = profiles.length < 2;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setError('Indiquez votre prénom.');
      return;
    }
    if (!preference) {
      setError('Choisissez le genre recherché.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createProfile(trimmed, preference);
    } catch (cause) {
      setError(describeStorageError(cause, 'Impossible de créer le profil.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
          Code {couple?.code}
        </p>
        <h2 className="mt-1 text-lg font-bold text-stone-800">Qui êtes-vous ?</h2>
      </div>

      {profiles.length > 0 && !creating ? (
        <ul className="flex flex-col gap-2">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                onClick={() => void selectProfile(profile.id)}
                className="flex min-h-14 w-full items-center justify-between rounded-xl bg-stone-50 px-4 text-left ring-1 ring-stone-200 transition hover:bg-rose-50 hover:ring-rose-300 focus-visible:outline-2 focus-visible:outline-rose-500"
              >
                <span className="font-semibold text-stone-800">{profile.displayName}</span>
                <span className="text-sm text-stone-500">
                  {GENDER_PREFERENCE_LABELS[profile.genderPreference]}
                </span>
              </button>
            </li>
          ))}
          {canCreate ? (
            <li>
              <Button variant="secondary" className="w-full" onClick={() => setCreating(true)}>
                Je ne suis pas dans la liste
              </Button>
            </li>
          ) : null}
        </ul>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-700">Votre prénom</span>
            <input
              autoFocus
              autoComplete="given-name"
              maxLength={40}
              className="min-h-12 rounded-xl border border-stone-300 px-4 text-lg focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
              placeholder="Camille"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-stone-700">
              Vous cherchez un prénom pour…
            </legend>
            <div className="flex flex-wrap gap-2">
              {PREFERENCES.map((option) => (
                <Chip
                  key={option}
                  selected={preference === option}
                  onClick={() => setPreference(option)}
                >
                  {GENDER_PREFERENCE_LABELS[option]}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-stone-500">
              Ce choix filtre tous les prénoms proposés. Modifiable à tout moment.
            </p>
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'Enregistrement…' : "C'est parti !"}
          </Button>
          {profiles.length > 0 ? (
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Retour à la liste des profils
            </Button>
          ) : null}
        </form>
      )}

      <Button variant="ghost" onClick={leaveCouple}>
        Changer de code de couple
      </Button>
    </div>
  );
}
