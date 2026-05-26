import { cookies } from 'next/headers';
import Link from 'next/link';
import { Settings } from 'lucide-react';

import { getCurrentUser } from '@isp/auth';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

const nav = [
  { href: '/funds', label: 'Funds' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/watchlist', label: 'Watchlist' },
];

export async function SiteHeader() {
  let signedIn = false;
  try {
    const cookieStore = await cookies();
    const me = await getCurrentUser(cookieStore);
    signedIn = !!me;
  } catch {
    // Auth misconfig / DB unreachable shouldn't break the shell — pages
    // still render anonymously and any authed route will redirect to /sign-in.
    signedIn = false;
  }

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

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {signedIn ? (
            <Button asChild variant="ghost" size="icon" aria-label="Settings">
              <Link href="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
