import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/sidebar';
import ChatProvider from '@/components/ChatProvider';

const themeBootScript = `
  (function () {
    try {
      var stored = localStorage.getItem('spectre_theme');
      var theme = stored === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.colorScheme = theme;
    } catch (error) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="bg-spectre-bg text-spectre-text">
        <ChatProvider>
          <div className="flex h-[100dvh] min-h-0 flex-col md:flex-row">
            <Sidebar />
            <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
          </div>
        </ChatProvider>
      </body>
    </html>
  );
}
