import ReactMarkdown from 'react-markdown';

export default function MarkdownText({
  content,
  className = '',
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={`max-w-none text-spectre-text ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="mb-4 mt-7 text-2xl font-bold first:mt-0" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2
              className="mb-3 mt-7 border-b border-spectre-border pb-2 text-xl font-semibold first:mt-0"
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="mb-2 mt-5 text-lg font-semibold" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="mb-3 leading-7 last:mb-0" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="mb-4 list-disc space-y-1 pl-6" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="mb-4 list-decimal space-y-1 pl-6" {...props} />
          ),
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code
                className="rounded bg-spectre-accent/15 px-1.5 py-0.5 font-mono text-sm text-spectre-accent"
                {...props}
              />
            ) : (
              <code
                className="mb-4 block overflow-x-auto rounded border border-spectre-border bg-spectre-surface p-3 font-mono text-xs"
                {...props}
              />
            ),
          a: ({ node, ...props }) => (
            <a className="text-spectre-accent underline-offset-2 hover:underline" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th
              className="border border-spectre-border bg-spectre-surface px-3 py-2 text-left"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-spectre-border px-3 py-2 align-top" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
