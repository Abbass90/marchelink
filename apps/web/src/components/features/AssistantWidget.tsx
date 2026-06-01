import { useState, useRef, useEffect, useCallback } from 'react';
import { sendAssistantMessage, type AssistantTurn } from '../../api/client.js';
import '../primitives/assistant.css';

const WELCOME =
  "Bonjour, je suis l'assistant MarchéLink. Je peux vous aider à trouver des produits, suivre vos commandes ou en passer une. Que cherchez-vous ?";

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [messages, sending]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const history = messages.slice(-20);
      const next: AssistantTurn[] = [...messages, { role: 'user', content: trimmed }];
      setMessages(next);
      setInput('');
      setSending(true);
      setError(null);

      try {
        const { reply } = await sendAssistantMessage(trimmed, history);
        setMessages((m) => [...m, { role: 'assistant', content: reply }]);
      } catch {
        setError("Désolé, l'assistant est momentanément indisponible. Réessayez.");
      } finally {
        setSending(false);
      }
    },
    [messages, sending],
  );

  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    // On retire le dernier message acheteur puis on le renvoie.
    setMessages((m) => {
      const idx = m.map((x) => x.role).lastIndexOf('user');
      return idx >= 0 ? m.slice(0, idx) : m;
    });
    void send(lastUser.content);
  }, [messages, send]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void send(input);
    },
    [input, send],
  );

  return (
    <>
      <button
        className="assistant-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        data-testid="assistant-fab"
      >
        {open ? '✕' : '🤖'}
      </button>

      {open && (
        <section className="assistant-panel" data-testid="assistant-panel">
          <header className="assistant-header">
            <div className="assistant-header-title">Assistant MarchéLink</div>
            <div className="assistant-header-sub">Propulsé par l'IA</div>
          </header>

          <div className="assistant-messages" ref={scrollRef} data-testid="assistant-messages">
            <div className="assistant-msg assistant-msg--bot" data-testid="assistant-welcome">
              {WELCOME}
            </div>

            {messages.map((m, i) => (
              <div
                key={i}
                className={`assistant-msg ${m.role === 'user' ? 'assistant-msg--user' : 'assistant-msg--bot'}`}
                data-testid={m.role === 'user' ? 'assistant-msg-user' : 'assistant-msg-bot'}
              >
                {m.content}
              </div>
            ))}

            {sending && (
              <div className="assistant-msg assistant-msg--bot assistant-typing" data-testid="assistant-typing">
                <span className="assistant-dot" />
                <span className="assistant-dot" />
                <span className="assistant-dot" />
              </div>
            )}

            {error && (
              <div className="assistant-error" data-testid="assistant-error">
                <span>{error}</span>
                <button className="assistant-retry" onClick={retry} data-testid="assistant-retry">
                  Réessayer
                </button>
              </div>
            )}
          </div>

          <form className="assistant-form" onSubmit={onSubmit}>
            <input
              className="assistant-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question…"
              disabled={sending}
              data-testid="assistant-input"
            />
            <button
              className="assistant-send"
              type="submit"
              disabled={sending || input.trim() === ''}
              data-testid="assistant-send"
            >
              Envoyer
            </button>
          </form>
        </section>
      )}
    </>
  );
}
