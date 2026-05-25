import { useState, useEffect } from 'react';
import { listConversations } from '../api/client.js';

/**
 * Retourne le nombre total de messages non lus dans les conversations
 * de l'utilisateur connecté. Se raffraîchit toutes les 30 secondes.
 * Fail-safe : en cas d'erreur API, retourne 0 (ne bloque pas le layout).
 */
export function useChatUnread(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const convs = await listConversations();
        if (!cancelled) {
          setCount(convs.reduce((sum, c) => sum + Number(c.unread_count), 0));
        }
      } catch {
        /* layout silencieux en cas d'erreur */
      }
    }

    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return count;
}
