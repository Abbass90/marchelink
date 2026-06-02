import { useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import {
  listChatOrgs, listConversations, createConversation,
  getMessages, sendChatMessage, markConversationRead, authMe,
} from '../api/client.js';
import type { ConversationWithMeta, ChatMessage, ChatOrg } from '../api/client.js';
import ConversationList from '../components/features/ConversationList.js';
import ChatBubble from '../components/features/ChatBubble.js';
import '../components/primitives/chat.css';

export default function BuyerChat() {
  const [convs, setConvs] = useState<ConversationWithMeta[]>([]);
  const [orgs, setOrgs] = useState<ChatOrg[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'msgs'>('list');
  const [myId, setMyId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadConvs() {
    try {
      const [cs, me, os] = await Promise.all([listConversations(), authMe(), listChatOrgs()]);
      setConvs(cs); setMyId(me.id); setOrgs(os);
    } catch { setError('Impossible de charger les messages'); }
    finally { setLoading(false); }
  }

  async function loadMessages(convId: string) {
    try {
      const res = await getMessages(convId);
      setMessages(res.data);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      await markConversationRead(convId).catch(() => {});
    } catch { /* ignore */ }
  }

  async function handleSelect(conv: ConversationWithMeta) {
    setSelectedId(conv.id); setMobileView('msgs');
    await loadMessages(conv.id);
    setConvs((prev) => prev.map((c) => c.id === conv.id ? { ...c, unread_count: '0' } : c));
  }

  async function handleSend() {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const msg = await sendChatMessage(selectedId, input.trim());
      setMessages((prev) => [...prev, msg]);
      setInput('');
      setConvs((prev) => prev.map((c) =>
        c.id === selectedId ? { ...c, last_message_body: msg.body, last_message_at: msg.created_at } : c,
      ));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  async function handleNewConv(orgId: string) {
    if (!orgId) return;
    try {
      const conv = await createConversation(orgId);
      await loadConvs();
      setSelectedId(conv.id); setMobileView('msgs');
      setMessages([]);
    } catch { /* ignore */ }
  }

  useEffect(() => { void loadConvs(); }, []);

  // Polling messages toutes les 10s
  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(() => void loadMessages(selectedId), 10_000);
    return () => clearInterval(t);
  }, [selectedId]);

  if (loading && !convs.length) return <div className="chat-loading" data-testid="chat-loading">Chargement…</div>;
  if (error) return (
    <div className="chat-error" data-testid="chat-error">
      <p>{error}</p>
      <button className="chat-retry-btn" onClick={() => { setLoading(true); setError(null); void loadConvs(); }}>
        Réessayer
      </button>
    </div>
  );

  const selectedConv = convs.find((c) => c.id === selectedId);

  return (
    <div className="chat-page" data-testid="buyer-chat">
      <div className="chat-layout">
        {/* Sidebar — conversations */}
        <aside className={`chat-sidebar ${mobileView === 'msgs' ? 'chat-sidebar--hidden' : ''}`}>
          <div className="chat-sidebar-header">
            <h1 className="chat-sidebar-title">Messages</h1>
            <select
              className="chat-new-select"
              defaultValue=""
              onChange={(e) => { void handleNewConv(e.target.value); e.target.value = ''; }}
              data-testid="chat-new-conv-select"
            >
              <option value="" disabled>+ Nouvelle conversation…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="chat-conv-list">
            <ConversationList
              conversations={convs} selectedId={selectedId}
              onSelect={(c) => void handleSelect(c)} labelKey="org_name"
            />
          </div>
        </aside>

        {/* Thread — messages */}
        <div className={`chat-main ${mobileView === 'list' ? 'chat-main--hidden' : ''}`}>
          {selectedConv ? (
            <>
              <div className="chat-thread-header">
                <button className="chat-back-btn" onClick={() => setMobileView('list')}>←</button>
                {selectedConv.org_name}
              </div>
              <div className="chat-messages" data-testid="chat-messages">
                {messages.length === 0 && (
                  <div className="chat-messages-empty">Envoyez le premier message !</div>
                )}
                {messages.map((m) => (
                  <ChatBubble key={m.id} body={m.body} sentAt={m.created_at} isMine={m.sender_user_id === myId} />
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="chat-input-row">
                <input
                  className="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  placeholder="Écrire un message…"
                  data-testid="chat-input"
                />
                <button className="chat-send-btn" onClick={() => void handleSend()} disabled={sending || !input.trim()} data-testid="chat-send">
                  Envoyer
                </button>
              </div>
            </>
          ) : (
            <div className="chat-no-conv" data-testid="chat-no-selection">
              <div className="chat-no-conv-icon"><MessageCircle size={40} /></div>
              <p>Sélectionnez une conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
