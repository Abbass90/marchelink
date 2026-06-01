import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import NotFound from '../NotFound.js';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NotFound />
    </MemoryRouter>,
  );
}

describe('NotFound (404)', () => {
  it('affiche le code 404 et un message lisible', () => {
    renderAt('/route-inexistante');
    expect(screen.getByTestId('notfound-page')).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page introuvable')).toBeInTheDocument();
  });

  it('propose un lien de retour vers l\'accueil', () => {
    renderAt('/n-importe-quoi');
    const link = screen.getByTestId('notfound-home-link');
    expect(link).toHaveAttribute('href', '/');
  });
});
