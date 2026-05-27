'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  schemeCode: string;
  /** Pass true if the current user already has this fund on their watchlist */
  initialWatched: boolean;
  /** If null the user is not signed in — button links to sign-in instead */
  signedIn: boolean;
}

export function WatchlistButton({ schemeCode, initialWatched, signedIn }: Props) {
  const [watched, setWatched] = useState(initialWatched);
  const [loading, setLoading] = useState(false);

  if (!signedIn) {
    return (
      <Button asChild variant="outline" size="sm">
        <a href="/sign-in">
          <Eye className="mr-1.5 h-4 w-4" aria-hidden />
          Watch
        </a>
      </Button>
    );
  }

  async function toggle() {
    setLoading(true);
    try {
      if (watched) {
        await fetch(`/api/watchlist/${schemeCode}`, { method: 'DELETE' });
        setWatched(false);
      } else {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schemeCode }),
        });
        setWatched(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={watched ? 'default' : 'outline'}
      size="sm"
      onClick={() => void toggle()}
      disabled={loading}
      aria-pressed={watched}
      aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      {watched ? (
        <>
          <EyeOff className="mr-1.5 h-4 w-4" aria-hidden />
          Watching
        </>
      ) : (
        <>
          <Eye className="mr-1.5 h-4 w-4" aria-hidden />
          Watch
        </>
      )}
    </Button>
  );
}
