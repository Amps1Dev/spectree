'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageCircle, Wrench, FileText } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/tools', label: 'Tools', icon: Wrench },
  { href: '/reports', label: 'Reports', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-spectre-surface border-r border-spectre-border flex flex-col">
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

      <div className="p-4 border-t border-spectre-border">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-spectre-accent rounded-full animate-pulse" />
          <span className="text-spectre-text">GROQ CONNECTED</span>
        </div>
      </div>
    </aside>
  );
}
