import { Badge } from '@/components/ui/badge';

const labels: Record<string, string> = {
  EQUITY: 'Equity',
  DEBT: 'Debt',
  HYBRID: 'Hybrid',
  ETF: 'ETF',
  SOLUTION: 'Solution',
  OTHER: 'Other',
};

export function FundCategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {labels[category] ?? category}
    </Badge>
  );
}
