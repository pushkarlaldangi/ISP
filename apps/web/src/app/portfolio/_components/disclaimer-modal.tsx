'use client';

import { useState } from 'react';

interface Props {
  /** Called once accepted so the parent can proceed to create a portfolio */
  onAccepted: () => void;
}

export function DisclaimerModal({ onAccepted }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/me/accept-disclaimer', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to record acceptance');
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-background w-full max-w-lg rounded-xl p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl">⚖️</span>
          <h2 className="text-xl font-bold">Important Disclaimer</h2>
        </div>

        <div className="text-muted-foreground space-y-3 text-sm">
          <p>
            <strong className="text-foreground">ISP is a portfolio tracking tool only.</strong> It
            does not provide investment advice and is <em>not</em> a SEBI Registered Investment
            Advisor (RIA).
          </p>
          <p>
            All information displayed — including live estimated NAV, historical returns, and
            portfolio valuations — is for{' '}
            <strong className="text-foreground">informational and tracking purposes only</strong>.
            It does not constitute a recommendation to buy, sell, or hold any securities or mutual
            fund units.
          </p>
          <p>
            Live NAV estimates are computed from publicly disclosed fund holdings (typically 1–4
            weeks stale) and live market prices. They may differ from the official NAV published by
            the AMC.
          </p>
          <p>
            <strong className="text-foreground">
              Past performance is not indicative of future results.
            </strong>{' '}
            Mutual fund investments are subject to market risks. Please read all scheme-related
            documents carefully before investing.
          </p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            By clicking &ldquo;I Understand &amp; Accept&rdquo;, you confirm that you have read this
            disclaimer and agree to use this tool for tracking purposes only.
          </p>
        </div>

        {error && <p className="text-destructive mt-3 text-sm">{error}</p>}

        <button
          onClick={() => void handleAccept()}
          disabled={loading}
          className="bg-primary text-primary-foreground mt-5 w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Recording…' : 'I Understand & Accept'}
        </button>
      </div>
    </div>
  );
}
