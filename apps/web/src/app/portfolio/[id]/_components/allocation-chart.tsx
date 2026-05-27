'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { formatInr } from '@/lib/utils';

const CHART_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
  '#64748b',
];

interface Props {
  data: { name: string; value: number }[];
}

export function AllocationChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={2}
          dataKey="value"
          aria-label="Portfolio allocation by category"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [formatInr(value), 'Value']}
          contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
        />
        <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
