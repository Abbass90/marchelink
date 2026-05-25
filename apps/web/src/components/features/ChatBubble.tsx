interface Props {
  body: string;
  sentAt: string;
  isMine: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatBubble({ body, sentAt, isMine }: Props) {
  return (
    <div
      className={`bubble-wrap ${isMine ? 'bubble-wrap--mine' : 'bubble-wrap--theirs'}`}
      data-testid="chat-bubble"
    >
      <div
        className={`bubble ${isMine ? 'bubble--mine' : 'bubble--theirs'}`}
        data-testid={isMine ? 'bubble-mine' : 'bubble-theirs'}
      >
        {body}
      </div>
      <span className="bubble-time">{formatTime(sentAt)}</span>
    </div>
  );
}
