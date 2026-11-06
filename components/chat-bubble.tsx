import { StoredChatMessage } from '@/lib/chatStore';
import MarkdownText from '@/components/markdown-text';
import TargetTable from '@/components/targets/TargetTable';

interface ChatBubbleProps {
  message: StoredChatMessage;
  chatId: string;
  onGenerateReport?: (engagementId: string) => void;
}

export default function ChatBubble({
  message,
  chatId,
  onGenerateReport,
}: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const hasTargetCard = message.toolOutputs?.some(
    (output) => output.type === 'target-engagement',
  );

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`${hasTargetCard ? 'w-full max-w-4xl' : 'max-w-md'} rounded-lg p-4 ${
          isUser
            ? 'bg-spectre-accent text-spectre-accent-contrast rounded-br-none'
            : 'bg-spectre-surface-dark border border-spectre-border text-spectre-text rounded-bl-none'
        }`}
      >
        {message.content &&
          (isUser ? (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          ) : (
            <MarkdownText content={message.content} className="text-sm" />
          ))}

        {message.toolOutputs?.map((output) => {
          if (output.type === 'target-engagement') {
            return (
              <TargetTable
                key={output.id}
                chatId={chatId}
                messageId={message.id}
                output={output}
                onGenerateReport={onGenerateReport}
              />
            );
          }

          if (output.type === 'engagement-summary') {
            const engagementId =
              typeof output.data?.engagementId === 'string'
                ? output.data.engagementId
                : undefined;
            return engagementId ? (
              <button
                key={output.id}
                type="button"
                onClick={() => onGenerateReport?.(engagementId)}
                className="spectre-btn-secondary mt-3 text-sm"
              >
                Generate report for this engagement
              </button>
            ) : null;
          }

          return null;
        })}
      </div>
    </div>
  );
}
