'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Info,
  MessageCircle,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import ThemeToggle from '@/components/ThemeToggle';

const navItems = [
  { href: '/', label: 'About', icon: Info },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/tools', label: 'Tools', icon: Wrench },
  { href: '/reports', label: 'Reports', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { offline, hydrated, toggleOffline } = useOfflineMode();

  return (
    <aside className="w-60 bg-spectre-surface border-r border-spectre-border flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-spectre-border p-6">
        <h1 className="text-2xl font-bold text-spectre-accent">SPECTRE</h1>
        <ThemeToggle />
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

      <div className="p-4 border-t border-spectre-border">
        <button
          type="button"
          onClick={toggleOffline}
          disabled={!hydrated}
          aria-pressed={offline}
          aria-label={`Switch to ${offline ? 'online' : 'offline'} mode`}
          className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
            offline
              ? 'border-spectre-offline/60 bg-spectre-offline/10 text-spectre-muted'
              : 'border-spectre-success/60 bg-spectre-success/10 text-spectre-success'
          }`}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              {offline ? <WifiOff size={17} /> : <Wifi size={17} />}
              {offline ? 'OFFLINE' : 'ONLINE'}
            </span>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                offline ? 'bg-spectre-offline' : 'bg-spectre-success animate-pulse'
              }`}
            />
          </span>
          <span className="mt-1 block text-[11px] text-spectre-muted">
            {offline ? 'Network actions disabled' : 'Network actions enabled'}
          </span>
        </button>
      </div>
    </aside>
  );
}
