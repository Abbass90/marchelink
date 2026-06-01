import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from '../ErrorBoundary.js';

/** Composant qui lève systématiquement une exception au rendu. */
function Boom(): never {
  throw new Error('boom');
}

beforeEach(() => {
  // React + componentDidCatch loggent l'erreur capturée : on évite de polluer
  // la sortie des tests (le bruit est attendu, pas un échec).
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('affiche le fallback quand un enfant lève une exception', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/erreur inattendue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recharger la page/ })).toBeInTheDocument();
  });

  it('rend normalement les enfants en l\'absence d\'erreur', () => {
    render(
      <ErrorBoundary>
        <p>Contenu OK</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Contenu OK')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
  });
});
