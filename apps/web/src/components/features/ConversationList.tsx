import type { ConversationWithMeta } from '../../api/client.js';

interface Props {
  conversations: ConversationWithMeta[];
  selectedId: string | null;
  onSelect: (conv: ConversationWithMeta) => void;
  /** Label affiché pour chaque conversation (org_name pour buyer, buyer_name pour grossiste) */
  labelKey: 'org_name' | 'buyer_name';
}

export default function ConversationList({ conversations, selectedId, onSelect, labelKey }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="conv-empty" data-testid="conv-empty">
        Aucune conversation pour l&apos;instant.
      </div>
    );
  }

  return (
    <div data-testid="conv-list">
      {conversations.map((conv) => {
        const unread = Number(conv.unread_count);
        const label = conv[labelKey];
        const initials = label.slice(0, 2).toUpperCase();
        return (
          <div
            key={conv.id}
            className={`conv-item ${selectedId === conv.id ? 'conv-item--active' : ''}`}
            onClick={() => onSelect(conv)}
            data-testid="conv-item"
            aria-current={selectedId === conv.id ? 'true' : undefined}
          >
            <div className="conv-avatar">{initials}</div>
            <div className="conv-info">
              <div className="conv-name">{label}</div>
              {conv.last_message_body && (
                <div className="conv-preview">{conv.last_message_body}</div>
              )}
            </div>
            {unread > 0 && (
              <span className="conv-unread-badge" data-testid="conv-unread-badge">
                {unread}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
