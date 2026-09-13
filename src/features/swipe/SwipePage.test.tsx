import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NameEntry } from '../../data/types';
import { LocalStorageAdapter } from '../../storage/localStorageAdapter';
import type { Profile } from '../../storage/types';
import { SessionProvider } from '../../store/SessionContext';
import { SwipePage } from './SwipePage';

const COUPLE = 'TEST-2026';

// jsdom has no PointerEvent: a minimal one lets the swipe gesture receive coordinates.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventPolyfill, writable: true });
}

function entry(id: string, name: string, gender: NameEntry['gender'], rank: number): NameEntry {
  return {
    id,
    name,
    gender,
    countFR: 12345,
    countCH: 678,
    recentFR: 1200,
    recentCH: 60,
    popularityRank: rank,
    trend: rank === 1 ? 'up' : 'stable',
    firstLetter: name.charAt(0).toUpperCase(),
    length: name.length,
    origin: rank === 1 ? 'hébraïque' : undefined,
    meaning: rank === 1 ? 'universelle, entière' : undefined,
  };
}

const NAMES: NameEntry[] = [
  entry('louis', 'Louis', 'm', 2),
  entry('emma', 'Emma', 'f', 1),
  entry('camille', 'Camille', 'x', 3),
];

/** The fixtures above plus a spelling of « Emma » and a rare name, both hidden from the queue. */
const NAMES_WITH_EXTRAS: NameEntry[] = [
  ...NAMES,
  entry('ema', 'Ema', 'f', 503),
  entry('zoe', 'Zoé', 'f', 2500),
];

const namesState = { names: NAMES, loading: false, error: null as string | null };

vi.mock('../../data/useNames', () => ({
  useNames: () => ({ ...namesState, byId: new Map(namesState.names.map((n) => [n.id, n])) }),
}));

function profile(id: string, displayName: string, genderPreference: Profile['genderPreference']) {
  return {
    id,
    coupleCode: COUPLE,
    displayName,
    genderPreference,
    createdAt: '2026-01-01T00:00:00.000Z',
  } satisfies Profile;
}

async function seedAdapter(preference: Profile['genderPreference'] = 'both') {
  const adapter = new LocalStorageAdapter();
  await adapter.ensureCouple(COUPLE);
  await adapter.upsertProfile(profile('p1', 'Camille', preference));
  await adapter.upsertProfile(profile('p2', 'Alex', 'both'));
  await adapter.saveVote(COUPLE, {
    profileId: 'p2',
    nameId: 'louis',
    value: 'like',
    note: null,
    updatedAt: '2026-01-02T00:00:00.000Z',
  });
  return adapter;
}

function renderPage(adapter: LocalStorageAdapter) {
  return render(
    <MemoryRouter initialEntries={['/swipe']}>
      <SessionProvider adapter={adapter} initialSession={{ coupleCode: COUPLE, profileId: 'p1' }}>
        <SwipePage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

async function myVotes(adapter: LocalStorageAdapter) {
  return (await adapter.listVotes(COUPLE)).filter((vote) => vote.profileId === 'p1');
}

describe('SwipePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    namesState.names = NAMES;
    namesState.loading = false;
    namesState.error = null;
  });

  it('shows the most popular name first with its badges and stats', async () => {
    renderPage(await seedAdapter());
    expect(await screen.findByRole('heading', { name: 'Emma' })).toBeInTheDocument();
    expect(screen.getByText('Fille')).toBeInTheDocument();
    expect(screen.getAllByText('En hausse').length).toBeGreaterThan(0);
    expect(screen.getByText('Origine hébraïque')).toBeInTheDocument();
    expect(screen.getByText('universelle, entière')).toBeInTheDocument();
    expect(screen.getByText('Naissances en France')).toBeInTheDocument();
    expect(screen.getByText('0 / 3 prénoms vus')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progression' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });

  it('stores a like, moves to the next card and shows the partner hint', async () => {
    const user = userEvent.setup();
    const adapter = await seedAdapter();
    renderPage(adapter);
    await screen.findByRole('heading', { name: 'Emma' });

    await user.click(screen.getByRole('button', { name: "J'aime" }));

    expect(await screen.findByRole('heading', { name: 'Louis' })).toBeInTheDocument();
    expect(screen.getByText('Aimé aussi par Alex')).toBeInTheDocument();
    expect(screen.getByText('1 / 3 prénoms vus')).toBeInTheDocument();
    await waitFor(async () => {
      expect(await myVotes(adapter)).toEqual([
        expect.objectContaining({ nameId: 'emma', value: 'like', note: null }),
      ]);
    });
  });

  it('skips with the button and restores the card with « Annuler »', async () => {
    const user = userEvent.setup();
    const adapter = await seedAdapter();
    renderPage(adapter);
    await screen.findByRole('heading', { name: 'Emma' });
    const undo = screen.getByRole('button', { name: 'Annuler la dernière décision' });
    expect(undo).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Je passe' }));
    expect(await screen.findByRole('heading', { name: 'Louis' })).toBeInTheDocument();
    await waitFor(async () => {
      expect(await myVotes(adapter)).toEqual([
        expect.objectContaining({ nameId: 'emma', value: 'skip' }),
      ]);
    });

    await user.click(undo);
    expect(await screen.findByRole('heading', { name: 'Emma' })).toBeInTheDocument();
    expect(undo).toBeDisabled();
    await waitFor(async () => {
      expect(await myVotes(adapter)).toEqual([]);
    });
  });

  it('supports the keyboard shortcuts', async () => {
    const adapter = await seedAdapter();
    renderPage(adapter);
    await screen.findByRole('heading', { name: 'Emma' });

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(await screen.findByRole('heading', { name: 'Louis' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(await screen.findByRole('heading', { name: 'Camille' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(await screen.findByRole('heading', { name: 'Louis' })).toBeInTheDocument();

    await waitFor(async () => {
      expect(await myVotes(adapter)).toEqual([
        expect.objectContaining({ nameId: 'emma', value: 'skip' }),
      ]);
    });
  });

  it('ignores shortcuts typed inside the note field and saves the note with the like', async () => {
    const user = userEvent.setup();
    const adapter = await seedAdapter();
    renderPage(adapter);
    await screen.findByRole('heading', { name: 'Emma' });

    await user.click(screen.getByRole('button', { name: 'Ajouter une note' }));
    const field = screen.getByRole('textbox');
    await user.type(field, 'Prénom de ma grand-mère{ArrowLeft}');
    expect(screen.getByRole('heading', { name: 'Emma' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "J'aime" }));
    expect(await screen.findByRole('heading', { name: 'Louis' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(async () => {
      expect(await myVotes(adapter)).toEqual([
        expect.objectContaining({ nameId: 'emma', value: 'like', note: 'Prénom de ma grand-mère' }),
      ]);
    });
  });

  it('likes on a long drag to the right and snaps back on a short one', async () => {
    const adapter = await seedAdapter();
    renderPage(adapter);
    await screen.findByRole('heading', { name: 'Emma' });
    const card = screen.getByTestId('swipe-card');

    fireEvent.pointerDown(card, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 130, clientY: 102 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 130, clientY: 102 });
    expect(screen.getByRole('heading', { name: 'Emma' })).toBeInTheDocument();

    fireEvent.pointerDown(card, { pointerId: 2, clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(card, { pointerId: 2, clientX: 160, clientY: 100 });
    fireEvent.pointerMove(card, { pointerId: 2, clientX: 260, clientY: 104 });
    fireEvent.pointerUp(card, { pointerId: 2, clientX: 260, clientY: 104 });

    expect(await screen.findByRole('heading', { name: 'Louis' })).toBeInTheDocument();
    await waitFor(async () => {
      expect(await myVotes(adapter)).toEqual([
        expect.objectContaining({ nameId: 'emma', value: 'like' }),
      ]);
    });
  });

  it('applies the gender preference and ends with the empty state', async () => {
    const user = userEvent.setup();
    renderPage(await seedAdapter('m'));
    expect(await screen.findByRole('heading', { name: 'Louis' })).toBeInTheDocument();
    expect(screen.getByText('0 / 2 prénoms vus')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "J'aime" }));
    expect(await screen.findByRole('heading', { name: 'Camille' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Je passe' }));

    expect(await screen.findByText('Vous avez tout vu !')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir la liste' })).toHaveAttribute('href', '/liste');
    expect(screen.getByRole('link', { name: 'Nos matchs' })).toHaveAttribute('href', '/matchs');
    expect(screen.getByText('2 / 2 prénoms vus')).toBeInTheDocument();
  });

  it('keeps a stable shuffled order across reloads', async () => {
    const user = userEvent.setup();
    const adapter = await seedAdapter();
    const first = renderPage(adapter);
    await screen.findByRole('heading', { name: 'Emma' });
    await user.click(screen.getByRole('button', { name: 'Mélanger' }));
    expect(screen.getByRole('button', { name: 'Mélanger' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const shuffledFirst = screen.getByRole('heading', { level: 2 }).textContent;
    expect(window.localStorage.getItem('bnq.swipe.shuffleSeed')).toBeTruthy();
    first.unmount();

    renderPage(adapter);
    await screen.findByRole('heading', { level: 2 });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(shuffledFirst ?? '');
    expect(screen.getByRole('button', { name: 'Mélanger' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('offers an alphabetical order that survives a reload', async () => {
    const user = userEvent.setup();
    const adapter = await seedAdapter();
    const first = renderPage(adapter);
    await screen.findByRole('heading', { name: 'Emma' });
    await user.click(screen.getByRole('button', { name: 'Alphabétique' }));
    expect(screen.getByRole('button', { name: 'Alphabétique' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByRole('heading', { name: 'Camille' })).toBeInTheDocument();
    expect(window.localStorage.getItem('bnq.swipe.order')).toBe('alpha');

    await user.click(screen.getByRole('button', { name: 'Je passe' }));
    expect(await screen.findByRole('heading', { name: 'Emma' })).toBeInTheDocument();
    first.unmount();

    renderPage(adapter);
    expect(await screen.findByRole('heading', { name: 'Emma' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alphabétique' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Popularité' }));
    expect(await screen.findByRole('heading', { name: 'Emma' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "J'aime" }));
    expect(await screen.findByRole('heading', { name: 'Louis' })).toBeInTheDocument();
  });

  it('shows a spinner while loading and a message on error', async () => {
    namesState.loading = true;
    const adapter = await seedAdapter();
    const view = renderPage(adapter);
    expect(await screen.findByRole('status')).toHaveTextContent('Chargement des prénoms…');
    view.unmount();

    namesState.loading = false;
    namesState.error = 'Impossible de charger les prénoms (500).';
    await act(async () => {
      renderPage(adapter);
    });
    expect(await screen.findByText('Impossible de charger les prénoms')).toBeInTheDocument();
  });

  it('shows one card per family of spellings and lets me like another spelling', async () => {
    const user = userEvent.setup();
    namesState.names = NAMES_WITH_EXTRAS;
    const adapter = await seedAdapter();
    renderPage(adapter);
    await screen.findByRole('heading', { name: 'Emma' });
    expect(screen.getByText('0 / 3 prénoms vus')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Aussi écrit Ema/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Autres orthographes de Emma' });
    expect(dialog).toHaveTextContent('Ema');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { name: 'Emma' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aimer Ema' }));
    expect(
      await screen.findByRole('button', { name: 'Retirer Ema de mes favoris' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await waitFor(async () => {
      expect(await myVotes(adapter)).toEqual([
        expect.objectContaining({ nameId: 'ema', value: 'like' }),
      ]);
    });
    expect(screen.getByRole('heading', { name: 'Emma' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fermer les orthographes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "J'aime" }));
    expect(await screen.findByRole('heading', { name: 'Louis' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aussi écrit/ })).not.toBeInTheDocument();
  });

  it('hides the rare names by default and offers filters that survive a reload', async () => {
    const user = userEvent.setup();
    namesState.names = NAMES_WITH_EXTRAS;
    const adapter = await seedAdapter();
    const first = renderPage(adapter);
    await screen.findByRole('heading', { name: 'Emma' });
    expect(screen.getByRole('button', { name: /Filtres · 1/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Filtres · 1/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Filtres de découverte' });
    expect(dialog).toHaveTextContent('Voir 3 prénoms');
    await user.click(screen.getByRole('button', { name: /Rares/ }));
    expect(dialog).toHaveTextContent('Voir 4 prénoms');
    await user.click(screen.getByRole('button', { name: 'Lettre Z' }));
    expect(dialog).toHaveTextContent('Voir 1 prénom');
    await user.click(screen.getByRole('button', { name: 'Voir 1 prénom' }));

    expect(await screen.findByRole('heading', { name: 'Zoé' })).toBeInTheDocument();
    expect(screen.getByText('0 / 1 prénoms vus')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filtres · 1/ })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('bnq.swipe.filters') ?? '{}')).toEqual({
      letters: ['Z'],
      popularity: ['classic', 'common', 'original', 'rare'],
    });
    first.unmount();

    renderPage(adapter);
    expect(await screen.findByRole('heading', { name: 'Zoé' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Je passe' }));
    expect(
      await screen.findByText(
        'Il ne reste plus aucun prénom à découvrir avec ces filtres. Élargissez-les, ou passez en revue votre liste ou vos matchs.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Modifier les filtres' }));
    await user.click(await screen.findByRole('button', { name: 'Tout afficher' }));
    await user.click(screen.getByRole('button', { name: 'Voir 3 prénoms' }));
    expect(await screen.findByRole('heading', { name: 'Emma' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtres' })).toBeInTheDocument();
  });
});
