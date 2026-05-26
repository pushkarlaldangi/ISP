import Link from 'next/link';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

const nav = [
  { href: '/funds', label: 'Funds' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/watchlist', label: 'Watchlist' },
];

export function SiteHeader() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="container mx-auto flex h-14 max-w-6xl items-center px-4">
        <Link href="/" className="mr-8 flex items-center gap-2 text-sm font-semibold">
          <span className="bg-primary inline-block size-2 rounded-full" aria-hidden />
          ISP
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {nav.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
