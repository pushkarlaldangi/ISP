'use client';

/**
 * NumberTicker — animates smoothly between values whenever `value` changes.
 * Uses a simple rAF lerp so no framer-motion dependency required.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  /** Number of decimal places to display */
  decimals?: number;
  /** CSS class applied to the wrapping span */
  className?: string;
  /** Prefix e.g. "₹" */
  prefix?: string;
  /** Suffix e.g. "%" */
  suffix?: string;
  /** Duration of animation in ms (default 400) */
  duration?: number;
}

export function NumberTicker({
  value,
  decimals = 2,
  className,
  prefix = '',
  suffix = '',
  duration = 400,
}: Props) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startTimeRef.current = null;

    function tick(ts: number) {
      if (startTimeRef.current === null) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {displayed.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
