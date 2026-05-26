import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Styled native <select>. We use the platform widget instead of a Radix
 * combobox here because the category filter has six options, fits on every
 * screen size, and a native dropdown is more accessible by default.
 */
const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'border-input focus-visible:ring-ring flex h-9 w-full appearance-none rounded-md border bg-transparent bg-[length:16px_16px] bg-[right_0.5rem_center] bg-no-repeat px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
      'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27currentColor%27%3E%3Cpath fill-rule=%27evenodd%27 d=%27M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z%27 clip-rule=%27evenodd%27/%3E%3C/svg%3E")]',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };
