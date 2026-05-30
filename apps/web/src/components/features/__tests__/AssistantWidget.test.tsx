import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Mock du client API (UN SEUL module réseau, CLAUDE.md §31) ── */

vi.mock('../../../api/client.js', () => ({
  sendAssistantMessage: vi.fn(),
}));

import AssistantWidget from '../AssistantWidget.js';
import { sendAssistantMessage } from '../../../api/client.js';

const mockSend = sendAssistantMessage as unknown as ReturnType<typeof vi.fn>;

describe('AssistantWidget', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('affiche le bouton flottant, panneau fermé par défaut', () => {
    render(<AssistantWidget />);
    expect(screen.getByTestId('assistant-fab')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
  });

  it('ouvre et ferme le panneau au clic sur le bouton', async () => {
    const user = userEvent.setup();
    render(<AssistantWidget />);

    await user.click(screen.getByTestId('assistant-fab'));
    expect(screen.getByTestId('assistant-panel')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-welcome')).toBeInTheDocument();

    await user.click(screen.getByTestId('assistant-fab'));
    expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
  });

  it('envoie un message et affiche la réponse (success)', async () => {
    mockSend.mockResolvedValue({ reply: 'Voici 3 sacs de riz disponibles.' });
    const user = userEvent.setup();
    render(<AssistantWidget />);

    await user.click(screen.getByTestId('assistant-fab'));
    await user.type(screen.getByTestId('assistant-input'), 'Je cherche du riz');
    await user.click(screen.getByTestId('assistant-send'));

    expect(screen.getByTestId('assistant-msg-user')).toHaveTextContent('Je cherche du riz');
    await waitFor(() =>
      expect(screen.getByTestId('assistant-msg-bot')).toHaveTextContent('Voici 3 sacs de riz'),
    );
    expect(mockSend).toHaveBeenCalledWith('Je cherche du riz', []);
  });

  it('désactive le bouton Envoyer quand le champ est vide', async () => {
    const user = userEvent.setup();
    render(<AssistantWidget />);
    await user.click(screen.getByTestId('assistant-fab'));
    expect(screen.getByTestId('assistant-send')).toBeDisabled();
  });

  it('affiche une erreur lisible + bouton Réessayer (error state, §30)', async () => {
    mockSend.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    render(<AssistantWidget />);

    await user.click(screen.getByTestId('assistant-fab'));
    await user.type(screen.getByTestId('assistant-input'), 'Statut commande ?');
    await user.click(screen.getByTestId('assistant-send'));

    await waitFor(() => expect(screen.getByTestId('assistant-error')).toBeInTheDocument());
    expect(screen.getByTestId('assistant-retry')).toBeInTheDocument();

    // Réessayer relance le dernier message acheteur.
    mockSend.mockResolvedValue({ reply: 'Votre commande est en attente.' });
    await user.click(screen.getByTestId('assistant-retry'));

    await waitFor(() =>
      expect(screen.getByTestId('assistant-msg-bot')).toHaveTextContent('en attente'),
    );
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("transmet l'historique au 2e message", async () => {
    mockSend.mockResolvedValue({ reply: 'Réponse 1' });
    const user = userEvent.setup();
    render(<AssistantWidget />);

    await user.click(screen.getByTestId('assistant-fab'));
    await user.type(screen.getByTestId('assistant-input'), 'Premier');
    await user.click(screen.getByTestId('assistant-send'));
    await waitFor(() => expect(screen.getByTestId('assistant-msg-bot')).toBeInTheDocument());

    mockSend.mockResolvedValue({ reply: 'Réponse 2' });
    await user.type(screen.getByTestId('assistant-input'), 'Deuxième');
    await user.click(screen.getByTestId('assistant-send'));

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(2));
    const secondCall = mockSend.mock.calls[1]!;
    expect(secondCall[0]).toBe('Deuxième');
    // L'historique contient le 1er échange (user + assistant).
    expect(secondCall[1]).toEqual([
      { role: 'user', content: 'Premier' },
      { role: 'assistant', content: 'Réponse 1' },
    ]);
  });
});
