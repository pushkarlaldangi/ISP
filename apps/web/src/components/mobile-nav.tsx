'use client';

/**
 * Mobile bottom tab bar — shown on screens < md breakpoint.
 * Highlights the active route. Only rendered when the user is signed in.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, BookOpen, Eye, Home } from 'lucide-react';

import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/funds', label: 'Funds', icon: BookOpen, exact: false },
  { href: '/portfolio', label: 'Portfolio', icon: BarChart2, exact: false },
  { href: '/watchlist', label: 'Watchlist', icon: Eye, exact: false },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-4">
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
