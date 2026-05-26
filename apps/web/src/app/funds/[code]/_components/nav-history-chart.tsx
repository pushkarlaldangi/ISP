'use client';

import * as React from 'react';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatInr } from '@/lib/utils';

interface Point {
  date: string;
  nav: number;
}

export function NavHistoryChart({ data }: { data: Point[] }) {
  // Sub-sample if the series is huge — keeps DOM tiny and chart smooth.
  const display = React.useMemo(() => {
    if (data.length <= 200) return data;
    const stride = Math.ceil(data.length / 200);
    const sampled = data.filter((_, i) => i % stride === 0);
    // Always keep the final point so the most recent NAV is shown.
    const last = data[data.length - 1];
    if (last && sampled[sampled.length - 1] !== last) sampled.push(last);
    return sampled;
  }, [data]);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={display} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="navFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => formatInr(v, true)}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.3 }}
            contentStyle={{
              background: 'hsl(var(--popover, var(--card)))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
              color: 'hsl(var(--foreground))',
            }}
            labelClassName="text-muted-foreground"
            formatter={(v: number) => [formatInr(v), 'NAV']}
          />
          <Area
            type="monotone"
            dataKey="nav"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            fill="url(#navFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
