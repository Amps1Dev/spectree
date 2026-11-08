'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Home,
  MessageCircle,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import ThemeToggle from '@/components/ThemeToggle';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/tools', label: 'Tools', icon: Wrench },
  { href: '/reports', label: 'Reports', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { offline, hydrated, toggleOffline } = useOfflineMode();

  return (
    <aside className="grid w-full shrink-0 grid-cols-[minmax(0,1fr)_auto] border-b border-spectre-border bg-spectre-surface md:flex md:w-60 md:flex-col md:border-b-0 md:border-r">
      <div className="flex items-center justify-between gap-3 p-3 md:border-b md:border-spectre-border md:p-6">
        <Link href="/" className="text-2xl font-bold text-spectre-accent">SPECTRE</Link>
        <ThemeToggle />
      </div>

      <nav aria-label="Main navigation" className="order-last col-span-2 grid grid-cols-4 gap-1 p-2 md:order-none md:block md:flex-1 md:space-y-2 md:p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined}>
              <div
                className={`flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs transition-colors md:justify-start md:gap-3 md:px-4 md:py-3 md:text-base ${
                  isActive
                    ? 'bg-spectre-accent/10 border-l-2 border-spectre-accent text-spectre-accent'
                    : 'text-spectre-muted hover:bg-spectre-border/50'
                }`}
              >
                <Icon size={20} className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center p-3 md:block md:border-t md:border-spectre-border md:p-4">
        <button
          type="button"
          onClick={toggleOffline}
          disabled={!hydrated}
          aria-pressed={offline}
          aria-label={`Switch to ${offline ? 'online' : 'offline'} mode`}
          title={`${offline ? 'Offline' : 'Online'} mode. Click to switch.`}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-left transition-colors md:block md:h-auto md:w-full md:px-3 md:py-3 ${
            offline
              ? 'border-spectre-offline/60 bg-spectre-offline/10 text-spectre-muted'
              : 'border-spectre-success/60 bg-spectre-success/10 text-spectre-success'
          }`}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              {offline ? <WifiOff size={17} /> : <Wifi size={17} />}
              <span className="hidden md:inline">{offline ? 'OFFLINE' : 'ONLINE'}</span>
            </span>
            <span
              className={`hidden h-2.5 w-2.5 rounded-full md:block ${
                offline ? 'bg-spectre-offline' : 'bg-spectre-success animate-pulse'
              }`}
            />
          </span>
          <span className="mt-1 hidden text-[11px] text-spectre-muted md:block">
            {offline ? 'Network actions disabled' : 'Network actions enabled'}
          </span>
        </button>
      </div>
    </aside>
  );
}
