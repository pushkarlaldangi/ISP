'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface FundOption {
  schemeCode: string;
  schemeName: string;
  latestNav: string | number | null;
  latestNavDate: string | null;
}

interface Props {
  portfolioId: string;
  onSuccess: () => void;
  label?: string;
}

const TXN_TYPES = ['BUY', 'SELL', 'SIP', 'DIVIDEND', 'SWITCH_IN', 'SWITCH_OUT'] as const;
type TxnType = (typeof TXN_TYPES)[number];

export function AddTransactionDialog({ portfolioId, onSuccess, label = 'Add Transaction' }: Props) {
  const [open, setOpen] = useState(false);
  const [txnType, setTxnType] = useState<TxnType>('BUY');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fundQuery, setFundQuery] = useState('');
  const [fundOptions, setFundOptions] = useState<FundOption[]>([]);
  const [selectedFund, setSelectedFund] = useState<FundOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [units, setUnits] = useState('');
  const [nav, setNav] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced fund search
  const searchFunds = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setFundOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/funds?q=${encodeURIComponent(q)}&limit=8`);
        if (res.ok) {
          const data = (await res.json()) as FundOption[];
          setFundOptions(data);
          setShowDropdown(true);
        }
      } catch {
        /* silent */
      }
    }, 250);
  }, []);

  useEffect(() => {
    searchFunds(fundQuery);
  }, [fundQuery, searchFunds]);

  // Auto-fill NAV from history when date changes
  useEffect(() => {
    if (!selectedFund) return;
    void (async () => {
      try {
        const res = await fetch(`/api/funds/${selectedFund.schemeCode}?date=${date}`);
        if (res.ok) {
          const data = (await res.json()) as { navOnDate?: number; latestNav?: number };
          const navValue = data.navOnDate ?? data.latestNav;
          if (navValue) setNav(String(navValue));
        }
      } catch {
        /* use manually entered nav */
      }
    })();
  }, [selectedFund, date]);

  function selectFund(f: FundOption) {
    setSelectedFund(f);
    setFundQuery(f.schemeName);
    setShowDropdown(false);
    if (f.latestNav) setNav(String(f.latestNav));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFund || !units || !nav) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeCode: selectedFund.schemeCode,
          txnType,
          txnDate: date,
          units: parseFloat(units),
          navAtTxn: parseFloat(nav),
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error((j['error'] as string) ?? 'Failed to add transaction');
      }
      // Reset form
      setSelectedFund(null);
      setFundQuery('');
      setUnits('');
      setNav('');
      setNote('');
      setTxnType('BUY');
      setDate(new Date().toISOString().slice(0, 10));
      setOpen(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  const amount = units && nav ? (parseFloat(units) * parseFloat(nav)).toFixed(2) : null;

  if (!open) {
    return <Button onClick={() => setOpen(true)}>{label}</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background w-full max-w-lg rounded-xl p-6 shadow-xl">
        <h2 className="mb-5 text-lg font-semibold">Add Transaction</h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Transaction Type */}
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <div className="flex flex-wrap gap-2">
              {TXN_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTxnType(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    txnType === t
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Fund Search */}
          <div className="relative">
            <label className="mb-1 block text-sm font-medium">
              Fund <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={fundQuery}
              onChange={(e) => {
                setFundQuery(e.target.value);
                setSelectedFund(null);
              }}
              onFocus={() => fundOptions.length > 0 && setShowDropdown(true)}
              placeholder="Search fund name or AMC…"
              className="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
            {showDropdown && fundOptions.length > 0 && (
              <ul className="bg-background absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-md border shadow-lg">
                {fundOptions.map((f) => (
                  <li key={f.schemeCode}>
                    <button
                      type="button"
                      className="hover:bg-muted w-full px-3 py-2 text-left text-sm"
                      onClick={() => selectFund(f)}
                    >
                      <span className="block font-medium leading-tight">{f.schemeName}</span>
                      <span className="text-muted-foreground text-xs">
                        {f.schemeCode} · NAV ₹{f.latestNav ?? '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedFund && (
              <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">
                ✓ {selectedFund.schemeCode}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Date <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* Units + NAV */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Units <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="e.g. 10.234"
                min="0.000001"
                step="any"
                className="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                NAV at transaction <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                value={nav}
                onChange={(e) => setNav(e.target.value)}
                placeholder="e.g. 125.4567"
                min="0.0001"
                step="any"
                className="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2"
              />
            </div>
          </div>

          {/* Computed amount */}
          {amount && (
            <p className="bg-muted rounded-lg px-3 py-2 text-sm">
              Amount: <span className="font-mono font-semibold">₹{amount}</span>
            </p>
          )}

          {/* Note */}
          <div>
            <label className="text-muted-foreground mb-1 block text-sm font-medium">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. SIP via Zerodha"
              maxLength={500}
              className="bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              disabled={loading || !selectedFund || !units || !nav}
              className="flex-1"
            >
              {loading ? 'Saving…' : 'Save Transaction'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setError('');
              }}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
