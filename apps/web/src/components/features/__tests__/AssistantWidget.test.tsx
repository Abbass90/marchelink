import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Mock du client API (UN SEUL module réseau, CLAUDE.md §31) ── */

vi.mock('../../../api/client.js', () => ({
  sendAssistantMessage: vi.fn(),
}));

import AssistantWidget from '../AssistantWidget.js';
import { sendAssistantMessage } from '../../../api/client.js';

const mockSend = sendAssistantMessage as unknown as ReturnType<typeof vi.fn>;

function renderWidget() {
  return render(
    <MemoryRouter>
      <AssistantWidget />
    </MemoryRouter>,
  );
}

describe('AssistantWidget', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('affiche le bouton flottant, panneau fermé par défaut', () => {
    renderWidget();
    expect(screen.getByTestId('assistant-fab')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
  });

  it('ouvre et ferme le panneau au clic sur le bouton', async () => {
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByTestId('assistant-fab'));
    expect(screen.getByTestId('assistant-panel')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-welcome')).toBeInTheDocument();

    await user.click(screen.getByTestId('assistant-fab'));
    expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
  });

  it('envoie un message et affiche la réponse (success)', async () => {
    mockSend.mockResolvedValue({ reply: 'Voici 3 sacs de riz disponibles.' });
    const user = userEvent.setup();
    renderWidget();

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
    renderWidget();
    await user.click(screen.getByTestId('assistant-fab'));
    expect(screen.getByTestId('assistant-send')).toBeDisabled();
  });

  it('affiche une erreur lisible + bouton Réessayer (error state, §30)', async () => {
    mockSend.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderWidget();

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
    renderWidget();

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

/* ── §J — Round-trip order CTA ───────────────────────────── */

describe('AssistantWidget — §J order CTA', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('affiche le lien CTA quand la réponse contient order_id', async () => {
    mockSend.mockResolvedValue({ reply: 'Commande créée !', order_id: 'ord-xyz-789' });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByTestId('assistant-fab'));
    await user.type(screen.getByTestId('assistant-input'), 'Oui je valide');
    await user.click(screen.getByTestId('assistant-send'));

    await waitFor(() =>
      expect(screen.getByTestId('assistant-order-cta')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('assistant-order-cta')).toHaveAttribute(
      'href',
      '/buyer/order-confirmation/ord-xyz-789',
    );
  });

  it('ne montre pas le CTA quand order_id est absent de la réponse', async () => {
    mockSend.mockResolvedValue({ reply: 'Voici les produits disponibles.' });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByTestId('assistant-fab'));
    await user.type(screen.getByTestId('assistant-input'), 'Montre-moi du riz');
    await user.click(screen.getByTestId('assistant-send'));

    await waitFor(() => expect(screen.getByTestId('assistant-msg-bot')).toBeInTheDocument());
    expect(screen.queryByTestId('assistant-order-cta')).not.toBeInTheDocument();
  });

  it('efface le CTA au message suivant', async () => {
    // 1er message crée une commande
    mockSend.mockResolvedValueOnce({ reply: 'Commande créée !', order_id: 'ord-xyz-789' });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByTestId('assistant-fab'));
    await user.type(screen.getByTestId('assistant-input'), 'Oui je valide');
    await user.click(screen.getByTestId('assistant-send'));
    await waitFor(() => expect(screen.getByTestId('assistant-order-cta')).toBeInTheDocument());

    // 2e message — pas de order_id dans la réponse
    mockSend.mockResolvedValueOnce({ reply: 'Je peux vous aider autrement ?' });
    await user.type(screen.getByTestId('assistant-input'), 'Merci');
    await user.click(screen.getByTestId('assistant-send'));

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('assistant-order-cta')).not.toBeInTheDocument();
  });
});
