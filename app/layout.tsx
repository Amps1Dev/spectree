import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/sidebar';
import { LLMProvider } from '@/components/llm-context';

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
    <html lang="en" className="dark">
      <body className="font-inter bg-spectre-bg text-spectre-text">
        <LLMProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </LLMProvider>
      </body>
    </html>
  );
}
