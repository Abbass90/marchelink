import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BuyerChat from '../BuyerChat.js';

/* ── Mocks ───────────────────────────────────────────────── */

const mockListConversations = vi.fn();
const mockListChatOrgs = vi.fn();
const mockGetMessages = vi.fn();
const mockSendChatMessage = vi.fn();
const mockMarkConversationRead = vi.fn();
const mockAuthMe = vi.fn();
const mockCreateConversation = vi.fn();

vi.mock('../../api/client.js', () => ({
  listConversations: (...a: unknown[]) => mockListConversations(...a),
  listChatOrgs: (...a: unknown[]) => mockListChatOrgs(...a),
  getMessages: (...a: unknown[]) => mockGetMessages(...a),
  sendChatMessage: (...a: unknown[]) => mockSendChatMessage(...a),
  markConversationRead: (...a: unknown[]) => mockMarkConversationRead(...a),
  createConversation: (...a: unknown[]) => mockCreateConversation(...a),
  authMe: (...a: unknown[]) => mockAuthMe(...a),
}));

/* ── Fixtures ────────────────────────────────────────────── */

const ME = { id: 'user-buyer-1', email: 'kouadio@test.ci', role: 'buyer', first_name: 'Kouadio', last_name: 'Yao', organization_id: null, phone: null };

const CONV_A = {
  id: 'conv-1', buyer_user_id: 'user-buyer-1', wholesaler_org_id: 'org-a',
  org_name: "Tissus d'Aya", buyer_name: 'Kouadio Yao',
  last_message_body: 'Bonjour', last_message_at: '2026-05-22T10:00:00Z',
  unread_count: '2', created_at: '2026-05-22T09:00:00Z', updated_at: '2026-05-22T10:00:00Z',
};

const CONV_B = {
  id: 'conv-2', buyer_user_id: 'user-buyer-1', wholesaler_org_id: 'org-b',
  org_name: 'Épices Marché', buyer_name: 'Kouadio Yao',
  last_message_body: null, last_message_at: null,
  unread_count: '0', created_at: '2026-05-22T08:00:00Z', updated_at: '2026-05-22T08:00:00Z',
};

const MSG_1 = { id: 'm-1', conversation_id: 'conv-1', sender_user_id: 'user-seller-1', body: 'Bonjour !', read_at: null, created_at: '2026-05-22T09:30:00Z' };
const MSG_2 = { id: 'm-2', conversation_id: 'conv-1', sender_user_id: 'user-buyer-1', body: 'Avez-vous du wax ?', read_at: null, created_at: '2026-05-22T10:00:00Z' };

const ORGS = [{ id: 'org-a', name: "Tissus d'Aya" }, { id: 'org-b', name: 'Épices Marché' }];
const EMPTY_MESSAGES = { data: [], total: 0, page: 1, limit: 20 };
const PAGE_MSGS = { data: [MSG_1, MSG_2], total: 2, page: 1, limit: 20 };

/* ── Helper ──────────────────────────────────────────────── */

function renderChat() {
  return render(
    <MemoryRouter initialEntries={['/buyer/chat']}>
      <BuyerChat />
    </MemoryRouter>,
  );
}

/* ── Setup ───────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  mockMarkConversationRead.mockResolvedValue(undefined);
  mockAuthMe.mockResolvedValue(ME);
  mockListChatOrgs.mockResolvedValue(ORGS);
});

/* ── Tests ───────────────────────────────────────────────── */

describe('BuyerChat — F7', () => {
  describe('États de chargement', () => {
    it('affiche le spinner pendant le chargement initial', () => {
      mockListConversations.mockReturnValue(new Promise(() => {}));
      renderChat();
      expect(screen.getByTestId('chat-loading')).toBeInTheDocument();
    });

    it('affiche l\'erreur avec bouton Réessayer en cas d\'échec', async () => {
      mockListConversations.mockRejectedValueOnce(new Error('Network error'));
      renderChat();
      await waitFor(() => expect(screen.getByTestId('chat-error')).toBeInTheDocument());
      expect(screen.getByText('Réessayer')).toBeInTheDocument();
    });
  });

  describe('Inbox — liste des conversations', () => {
    beforeEach(() => {
      mockListConversations.mockResolvedValue([CONV_A, CONV_B]);
      mockGetMessages.mockResolvedValue(EMPTY_MESSAGES);
    });

    it('affiche la liste des conversations après chargement', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      expect(screen.getAllByTestId('conv-item')).toHaveLength(2);
    });

    it('affiche le nom de l\'org pour chaque conversation', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      // getAllByText car l'org_name apparaît aussi dans le select dropdown
      expect(screen.getAllByText("Tissus d'Aya").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Épices Marché').length).toBeGreaterThanOrEqual(1);
    });

    it('affiche le badge non-lu pour les conversations avec messages non lus', async () => {
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      expect(screen.getByTestId('conv-unread-badge')).toHaveTextContent('2');
    });

    it('affiche l\'état vide si aucune conversation', async () => {
      mockListConversations.mockResolvedValue([]);
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-empty')).toBeInTheDocument());
    });
  });

  describe('Thread — fil de messages', () => {
    beforeEach(() => {
      mockListConversations.mockResolvedValue([CONV_A]);
      mockGetMessages.mockResolvedValue(PAGE_MSGS);
    });

    it('clic sur une conversation charge les messages', async () => {
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      await user.click(screen.getByTestId('conv-item'));
      await waitFor(() => expect(screen.getByTestId('chat-messages')).toBeInTheDocument());
      expect(screen.getAllByTestId('chat-bubble')).toHaveLength(2);
    });

    it('les messages du vendeur sont à gauche (bubble--theirs)', async () => {
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      await user.click(screen.getByTestId('conv-item'));
      await waitFor(() => expect(screen.getAllByTestId('bubble-theirs')).toHaveLength(1));
    });

    it('les messages de l\'acheteur sont à droite (bubble--mine)', async () => {
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      await user.click(screen.getByTestId('conv-item'));
      await waitFor(() => expect(screen.getAllByTestId('bubble-mine')).toHaveLength(1));
    });
  });

  describe('Envoi de message', () => {
    beforeEach(() => {
      mockListConversations.mockResolvedValue([CONV_A]);
      mockGetMessages.mockResolvedValue(EMPTY_MESSAGES);
    });

    it('envoyer un message appelle sendChatMessage avec le bon convId et body', async () => {
      mockSendChatMessage.mockResolvedValue({ id: 'm-new', conversation_id: 'conv-1', sender_user_id: 'user-buyer-1', body: 'Test envoi', read_at: null, created_at: new Date().toISOString() });
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      await user.click(screen.getByTestId('conv-item'));
      await waitFor(() => expect(screen.getByTestId('chat-input')).toBeInTheDocument());
      await user.type(screen.getByTestId('chat-input'), 'Test envoi');
      await user.click(screen.getByTestId('chat-send'));
      await waitFor(() =>
        expect(mockSendChatMessage).toHaveBeenCalledWith('conv-1', 'Test envoi'),
      );
    });

    it('le bouton Envoyer est désactivé si l\'input est vide', async () => {
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('conv-list')).toBeInTheDocument());
      await user.click(screen.getByTestId('conv-item'));
      await waitFor(() => expect(screen.getByTestId('chat-send')).toBeDisabled());
    });
  });

  describe('Nouvelle conversation', () => {
    it('le select "Nouvelle conversation" affiche les orgs disponibles', async () => {
      mockListConversations.mockResolvedValue([]);
      renderChat();
      await waitFor(() => expect(screen.getByTestId('chat-new-conv-select')).toBeInTheDocument());
      expect(screen.getByText("Tissus d'Aya")).toBeInTheDocument();
      expect(screen.getByText('Épices Marché')).toBeInTheDocument();
    });

    it('sélectionner une org crée une conversation', async () => {
      mockListConversations.mockResolvedValueOnce([]).mockResolvedValue([CONV_B]);
      mockCreateConversation.mockResolvedValue(CONV_B);
      mockGetMessages.mockResolvedValue(EMPTY_MESSAGES);
      const user = userEvent.setup();
      renderChat();
      await waitFor(() => expect(screen.getByTestId('chat-new-conv-select')).toBeInTheDocument());
      await user.selectOptions(screen.getByTestId('chat-new-conv-select'), 'org-b');
      await waitFor(() => expect(mockCreateConversation).toHaveBeenCalledWith('org-b'));
    });
  });
});
