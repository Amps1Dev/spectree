import { ChatMessage } from '@/lib/types';
import ReactMarkdown from 'react-markdown';

interface ChatBubbleProps {
  message: ChatMessage;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-md p-4 rounded-lg ${
          isUser
            ? 'bg-spectre-accent text-black rounded-br-none'
            : 'bg-spectre-surface-dark border border-spectre-border text-spectre-text rounded-bl-none'
        }`}
      >
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-invert max-w-none">
            <ReactMarkdown
              components={{
                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2" {...props} />,
                code: ({ node, inline, ...props }) =>
                  inline ? (
                    <code className="bg-spectre-accent/20 px-1 rounded text-spectre-accent font-mono" {...props} />
                  ) : (
                    <code className="block bg-spectre-surface p-2 rounded mb-2 font-mono text-xs overflow-x-auto" {...props} />
                  ),
                a: ({ node, ...props }) => <a className="text-spectre-accent hover:underline" {...props} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
