import { CheckCircle2, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { sendMagicLink } from '../actions';

export function SignInForm({
  redirectTo,
  error,
  sent,
}: {
  redirectTo: string;
  error: string | null;
  sent: boolean;
}) {
  if (sent) {
    return (
      <div className="space-y-3 text-sm">
        <div className="text-gain flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <p className="font-medium">Check your inbox.</p>
        </div>
        <p className="text-muted-foreground">
          We sent a sign-in link. Open it on this device — it expires in 1 hour.
        </p>
      </div>
    );
  }
  return (
    <form action={sendMagicLink} className="space-y-3">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <label className="space-y-1.5">
        <span className="block text-sm font-medium">Email address</span>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </label>
      <Button type="submit" className="w-full">
        <Mail className="mr-1 h-4 w-4" aria-hidden /> Send magic link
      </Button>
      {error && <p className="text-loss text-sm">{decodeURIComponent(error)}</p>}
      <p className="text-muted-foreground pt-1 text-xs">
        By continuing you agree this is a portfolio tracking tool only, not investment advice, and
        not a SEBI-Registered Investment Advisor.
      </p>
    </form>
  );
}
