'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageCircle, Wrench, FileText } from 'lucide-react';
import { useLLM } from '@/components/llm-context';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/tools', label: 'Tools', icon: Wrench },
  { href: '/reports', label: 'Reports', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { provider, setProvider, providers } = useLLM();
  const active = providers.find((p) => p.id === provider);

  return (
    <aside className="w-60 bg-spectre-surface border-r border-spectre-border flex flex-col no-print">
      <div className="p-6 border-b border-spectre-border">
        <h1 className="text-2xl font-bold text-spectre-accent">SPECTRE</h1>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-spectre-accent/10 border-l-2 border-spectre-accent text-spectre-accent'
                    : 'text-spectre-muted hover:bg-spectre-border/50'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-spectre-border space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-spectre-muted">
          Model Provider
        </p>

        {providers.length === 0 ? (
          <p className="text-sm text-spectre-muted">Detecting…</p>
        ) : (
          <div className="space-y-1">
            {providers.map((p) => {
              const isActive = p.id === provider;
              return (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  title={p.available ? `${p.model} — ready` : `${p.model} — unavailable`}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    isActive
                      ? 'bg-spectre-accent/10 border-spectre-accent/50 text-spectre-text'
                      : 'border-transparent text-spectre-muted hover:bg-spectre-border/50'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p.available
                        ? 'bg-spectre-accent animate-pulse'
                        : 'bg-spectre-muted/40'
                    }`}
                  />
                  <span className="font-medium">{p.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {active && (
          <p className="text-[11px] font-mono text-spectre-muted truncate pl-1">
            {active.model}
          </p>
        )}
      </div>
    </aside>
  );
}
