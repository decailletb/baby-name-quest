import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageAdapter } from '../../storage/localStorageAdapter';
import { UNREACHABLE_MESSAGE, describeStorageError } from '../../storage';
import { SessionProvider } from '../../store/SessionContext';
import { Onboarding } from './Onboarding';

describe('describeStorageError', () => {
  it('rewords network failures in French', () => {
    expect(describeStorageError(new Error('TypeError: Failed to fetch'))).toBe(UNREACHABLE_MESSAGE);
    expect(describeStorageError(new TypeError('Load failed'))).toBe(UNREACHABLE_MESSAGE);
    expect(describeStorageError(new Error('Code invalide'))).toBe('Code invalide');
    expect(describeStorageError(null, 'Oups')).toBe('Oups');
  });
});

describe('Onboarding when the server cannot be reached', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('offers to retry instead of a profile form, then recovers', async () => {
    const user = userEvent.setup();
    const adapter = new LocalStorageAdapter();
    const listProfiles = vi
      .spyOn(adapter, 'listProfiles')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(
      <SessionProvider
        adapter={adapter}
        initialSession={{ coupleCode: 'DUPONT-2026', profileId: null }}
      >
        <Onboarding />
      </SessionProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Connexion impossible' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de joindre le serveur');
    expect(screen.queryByLabelText('Votre prénom')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByLabelText('Votre prénom')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(listProfiles).toHaveBeenCalledTimes(2);
  });
});
