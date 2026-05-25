import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WholesalerChat from '../WholesalerChat.js';

/* ── Mocks ───────────────────────────────────────────────── */

const mockListConversations = vi.fn();
const mockGetMessages = vi.fn();
const mockSendChatMessage = vi.fn();
const mockMarkConversationRead = vi.fn();
const mockAuthMe = vi.fn();

vi.mock('../../api/client.js', () => ({
  listConversations: (...a: unknown[]) => mockListConversations(...a),
  getMessages: (...a: unknown[]) => mockGetMessages(...a),
  sendChatMessage: (...a: unknown[]) => mockSendChatMessage(...a),
  markConversationRead: (...a: unknown[]) => mockMarkConversationRead(...a),
  authMe: (...a: unknown[]) => mockAuthMe(...a),
}));

/* ── Fixtures ────────────────────────────────────────────── */

const ME = { id: 'user-seller-1', email: 'aya@tissus.ci', role: 'wholesaler_admin', first_name: 'Aya', last_name: 'Koné', organization_id: 'org-a', phone: null };

const CONV = {
  id: 'conv-1', buyer_user_id: 'user-buyer-1', wholesaler_org_id: 'org-a',
  org_name: "Tissus d'Aya", buyer_name: 'Kouadio Yao',
  last_message_body: 'Avez-vous du wax ?', last_message_at: '2026-05-22T10:00:00Z',
  unread_count: '1', created_at: '2026-05-22T09:00:00Z', updated_at: '2026-05-22T10:00:00Z',
};

const MSG_BUYER = { id: 'm-1', conversation_id: 'conv-1', sender_user_id: 'user-buyer-1', body: 'Avez-vous du wax ?', read_at: null, created_at: '2026-05-22T10:00:00Z' };
const MSG_SELLER = { id: 'm-2', conversation_id: 'conv-1', sender_user_id: 'user-seller-1', body: 'Oui, en stock !', read_at: null, created_at: '2026-05-22T10:05:00Z' };

const PAGE_MSGS = { data: [MSG_BUYER, MSG_SELLER], total: 2, page: 1, limit: 20 };
const EMPTY_MESSAGES = { data: [], total: 0, page: 1, limit: 20 };

/* ── Helper ──────────────────────────────────────────────── */

function renderChat() {
  return render(
    <MemoryRouter initialEntries={['/wholesaler/chat']}>
      <WholesalerChat />
    </MemoryRouter>,
  );
}

/* ── Setup ───────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  mockMarkConversationRead.mockResolvedValue(undefined);
  mockAuthMe.mockResolvedValue(ME);
});

/* ── Tests ───────────────────────────────────────────────── */

describe('WholesalerChat — F7', () => {
  describe('États de chargement', () => {
    it('affiche le spinner pendant le chargement', () => {
      mockListConversations.mockReturnValue(new Promise(() => {}));
      renderChat();
      expect(screen.getByTestId('chat-loading')).toBeInTheDocument();
    });

    it('affiche l\'erreur avec bouton Réessayer', async () => {
      mockListConversations.mockRejectedValueOnce(new Error('Err'));
      renderChat();
      await waitFor(() => expect(screen.getByTestId('chat-error')).toBeInTheDocument());
      expect(screen.getByText('Réessayer')).toBeInTheDocument();
    });
  });

  describe('Inbox', () => {
    beforeEach(() => {
      mockListConversations.mockResolvedValue([CONV]);
      mockGetMessages.mockResolvedValue(EMPTY_MESSAGES);
    });

    it('affiche les conversations avec le nom du buyer', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      expect(screen.getByText('Kouadio Yao')).toBeInTheDocument();
    });

    it('affiche le badge non-lu', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-unread-badge')).toBeInTheDocument());
      expect(screen.getByTestId('conv-unread-badge')).toHaveTextContent('1');
    });

    it('affiche l\'état vide si aucune conversation', async () => {
      mockListConversations.mockResolvedValue([]);
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-empty')).toBeInTheDocument());
    });

    it('clic conversation charge les messages', async () => {
      mockGetMessages.mockResolvedValue(PAGE_MSGS);
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      await user.click(screen.getByTestId('conv-item'));
      await waitFor(() => expect(screen.getAllByTestId('chat-bubble')).toHaveLength(2));
    });
  });

  describe('Thread — alignement des bulles', () => {
    beforeEach(() => {
      mockListConversations.mockResolvedValue([CONV]);
      mockGetMessages.mockResolvedValue(PAGE_MSGS);
    });

    it('message du buyer = bulle à gauche (bubble--theirs pour wholesaler)', async () => {
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      await user.click(screen.getByTestId('conv-item'));
      await waitFor(() => expect(screen.getAllByTestId('bubble-theirs')).toHaveLength(1));
    });

    it('message du vendeur = bulle à droite (bubble--mine)', async () => {
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      await user.click(screen.getByTestId('conv-item'));
      await waitFor(() => expect(screen.getAllByTestId('bubble-mine')).toHaveLength(1));
    });
  });

  describe('Réponse', () => {
    beforeEach(() => {
      mockListConversations.mockResolvedValue([CONV]);
      mockGetMessages.mockResolvedValue(EMPTY_MESSAGES);
    });

    it('envoyer une réponse appelle sendChatMessage', async () => {
      mockSendChatMessage.mockResolvedValue({ id: 'm-new', conversation_id: 'conv-1', sender_user_id: 'user-seller-1', body: 'En stock !', read_at: null, created_at: new Date().toISOString() });
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      await user.click(screen.getByTestId('conv-item'));
      await waitFor(() => expect(screen.getByTestId('chat-input')).toBeInTheDocument());
      await user.type(screen.getByTestId('chat-input'), 'En stock !');
      await user.click(screen.getByTestId('chat-send'));
      await waitFor(() =>
        expect(mockSendChatMessage).toHaveBeenCalledWith('conv-1', 'En stock !'),
      );
    });

    it('le bouton Envoyer est désactivé si input vide', async () => {
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      await user.click(screen.getByTestId('conv-item'));
      await waitFor(() => expect(screen.getByTestId('chat-send')).toBeDisabled());
    });
  });
});
