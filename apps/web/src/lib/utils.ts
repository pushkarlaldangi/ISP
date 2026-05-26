import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const inrFormatterCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('en-IN', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInr(value: number, compact = false): string {
  return (compact ? inrFormatterCompact : inrFormatter).format(value);
}

export function formatPct(value: number): string {
  return percentFormatter.format(value / 100);
}

export function signedColor(value: number): 'gain' | 'loss' | 'neutral' {
  if (value > 0) return 'gain';
  if (value < 0) return 'loss';
  return 'neutral';
}
