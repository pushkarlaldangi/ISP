'use client';

/**
 * Sticky top strip showing NSE market open/closed status.
 * Updates every minute client-side via a simple interval.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

function isMarketOpen(now: Date): boolean {
  // NSE 09:15–15:30 IST, Mon–Fri
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = ist.getHours() * 60 + ist.getMinutes();
  return minutes >= 9 * 60 + 15 && minutes < 15 * 60 + 30;
}

export function MarketStatusBar() {
  const [open, setOpen] = useState(() => isMarketOpen(new Date()));

  useEffect(() => {
    const id = setInterval(() => setOpen(isMarketOpen(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-1 text-xs font-medium',
        open
          ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300'
          : 'bg-muted text-muted-foreground',
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          open ? 'animate-pulse-live bg-green-500' : 'bg-muted-foreground/40',
        )}
        aria-hidden
      />
      {open
        ? 'NSE Market Open · Live NAV updating every 30s'
        : 'NSE Market Closed · Showing last traded prices'}
    </div>
  );
}
