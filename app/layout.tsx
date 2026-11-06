import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/sidebar';
import ChatProvider from '@/components/ChatProvider';

const themeBootScript = `
  (function () {
    try {
      var stored = localStorage.getItem('spectre-theme');
      var theme = stored === 'light' || stored === 'dark' || stored === 'system'
        ? stored
        : 'system';
      var resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.colorScheme = resolved;
    } catch (error) {
      document.documentElement.setAttribute('data-theme', 'system');
    }
  })();
`;

export const metadata: Metadata = {
  title: 'SPECTRE - Penetration Testing Dashboard',
  description: 'Professional LLM-powered penetration testing platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="bg-spectre-bg text-spectre-text">
        <ChatProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </ChatProvider>
      </body>
    </html>
  );
}
