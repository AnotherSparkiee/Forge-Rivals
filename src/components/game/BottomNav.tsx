'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Swords, Trophy, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameState } from '@/app/lib/store';
import { useUser } from '@/firebase';

export function BottomNav() {
  const pathname = usePathname();
  const { language } = useGameState();
  const { user, isUserLoading } = useUser();

  // Hide nav if user is not logged in, on auth pages, or still in setup
  if (isUserLoading || !user || pathname?.startsWith('/auth') || pathname === '/setup') {
    return null;
  }

  const translations = {
    en: { hub: 'Hub', roster: 'Roster', battle: 'Battle', rank: 'Tourneys', profile: 'Profile' },
    ru: { hub: 'Главная', roster: 'Герои', battle: 'Битва', rank: 'Турниры', profile: 'Профиль' }
  };

  const labels = translations[language as keyof typeof translations] || translations.ru;

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: labels.hub },
    { href: '/roster', icon: Users, label: labels.roster },
    { href: '/match', icon: Swords, label: labels.battle },
    { href: '/rankings', icon: Trophy, label: labels.rank },
    { href: '/profile', icon: User, label: labels.profile },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-white/10 px-6 py-3">
      <div className="flex justify-between items-center max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "animate-pulse")} />
              <span className="text-[10px] font-medium uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
