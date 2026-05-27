import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Help & FAQ',
  description: 'Frequently asked questions about ISP — Indian Mutual Fund Tracker.',
};

function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="not-prose border-b py-5 last:border-0">
      <h3 className="mb-2 font-semibold">{q}</h3>
      <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <>
      <h1>Help &amp; FAQ</h1>
      <p className="lead">
        Answers to the most common questions about ISP. Can&apos;t find what you need?{' '}
        <a href="mailto:PUshkarlaldangi96@gmail.com">Email us</a>.
      </p>

      <h2>Getting started</h2>

      <Q q="What is ISP?">
        <p>
          ISP is a free mutual fund portfolio <strong>tracker</strong> for Indian investors. It lets
          you record your fund transactions, compute live P&amp;L and XIRR, and see a directional
          estimate of your portfolio&apos;s intraday value — something most AMC apps don&apos;t
          offer during market hours.
        </p>
      </Q>

      <Q q="Is it free?">
        <p>
          Yes, completely free. ISP is built entirely on free-tier infrastructure (Vercel, Supabase,
          AMFI public APIs, Yahoo Finance). There is no paid plan.
        </p>
      </Q>

      <Q q="How do I add my portfolio?">
        <p>
          Sign in, go to <Link href="/portfolio">Portfolio</Link>, create a portfolio, then add
          transactions manually — pick the fund, enter units and NAV on the date you invested. You
          can add as many transactions as you like, including backdated ones.
        </p>
      </Q>

      <Q q="What funds are supported?">
        <p>
          All ~14,000 AMFI-registered schemes in India — equity, debt, hybrid, ETFs, Fund of Funds.
          Browse them at <Link href="/funds">Funds</Link>.
        </p>
      </Q>

      <h2>Live NAV estimates</h2>

      <Q q="What is the Live Estimated NAV?">
        <p>
          Official NAV is published once per day at ~9 PM IST by AMCs. During market hours, ISP
          estimates the current NAV by taking each fund&apos;s last-disclosed equity holdings and
          multiplying each stock&apos;s intraday return by its portfolio weight:
        </p>
        <pre className="bg-muted rounded p-3 text-xs">
          Est. NAV ≈ Official NAV × (1 + Σ weight_i × stock_return_i)
        </pre>
        <p>
          This is a directional estimate — not the official NAV. It can differ from the actual NAV
          at end of day.
        </p>
      </Q>

      <Q q="Why does it say 'Low confidence'?">
        <p>
          Confidence reflects how much of the fund&apos;s portfolio is covered by live stock prices:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>High</strong> — &gt;80% equity weight covered by live quotes
          </li>
          <li>
            <strong>Medium</strong> — 40–80% covered
          </li>
          <li>
            <strong>Low</strong> — &lt;40% covered (typical for debt funds, or funds whose holdings
            we haven&apos;t imported yet)
          </li>
        </ul>
        <p>The official NAV is always shown alongside — use it for actual investment decisions.</p>
      </Q>

      <Q q="How old are the holdings?">
        <p>
          AMCs disclose their portfolio holdings monthly (typically within 10 days of month-end).
          Holdings in ISP may be up to ~30 days old. The &quot;as of&quot; date is shown on every
          fund detail page.
        </p>
      </Q>

      <Q q="Does ISP support debt/hybrid/liquid funds?">
        <p>
          Yes — all fund types are in the catalog with official NAV and history. Live estimated NAV
          is only meaningful for equity-heavy funds; debt and liquid funds will show &quot;Low
          confidence&quot; because their returns come from interest accrual rather than stock price
          movements.
        </p>
      </Q>

      <h2>Portfolio tracking</h2>

      <Q q="What is XIRR?">
        <p>
          XIRR (Extended Internal Rate of Return) is the annualised return on your portfolio,
          accounting for the exact dates and amounts of every transaction. It&apos;s more accurate
          than simple return % when you&apos;ve made multiple investments over time (SIPs, top-ups,
          etc.).
        </p>
        <p>A positive XIRR means your investment has grown; negative means it has shrunk.</p>
      </Q>

      <Q q="How is P&L calculated?">
        <p>
          <strong>Unrealised P&amp;L</strong> = Current Value − Total Invested
          <br />
          <strong>Current Value</strong> = Total Units × Live Estimated NAV
          <br />
          <strong>Day&apos;s Change</strong> = Total Units × (Live NAV − Previous Official NAV)
        </p>
        <p>All figures update automatically during market hours.</p>
      </Q>

      <Q q="Can I track multiple portfolios?">
        <p>
          Yes — create as many named portfolios as you like (e.g., &quot;Retirement&quot;,
          &quot;Children&apos;s Education&quot;, &quot;Short Term&quot;). Each has its own P&amp;L,
          XIRR and allocation view.
        </p>
      </Q>

      <Q q="Is ISP investment advice?">
        <p>
          <strong>No.</strong> ISP is a portfolio <em>tracking</em> tool only. We are not a SEBI
          Registered Investment Advisor. Nothing on this platform is a recommendation to buy, sell,
          or hold any fund. See our <Link href="/disclaimer">full disclaimer</Link>.
        </p>
      </Q>

      <h2>Data &amp; privacy</h2>

      <Q q="Where does fund data come from?">
        <ul className="list-disc pl-5">
          <li>
            <strong>NAV (daily):</strong>{' '}
            <a href="https://www.amfiindia.com" target="_blank" rel="noopener noreferrer">
              AMFI NAVAll.txt
            </a>{' '}
            — official, updated ~9 PM IST every business day
          </li>
          <li>
            <strong>Historical NAV:</strong> MFAPI.in (free, unofficial aggregator)
          </li>
          <li>
            <strong>Holdings:</strong> AMC monthly portfolio disclosures
          </li>
          <li>
            <strong>Live stock prices:</strong> NSE public API + Yahoo Finance (fallback)
          </li>
        </ul>
      </Q>

      <Q q="Is my portfolio data private?">
        <p>
          Yes. Your portfolio data is protected by row-level security — it is only accessible to
          your authenticated session. Your email address is encrypted at the application layer
          before being stored. See our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </Q>

      <Q q="Can I export or delete my data?">
        <p>
          Yes, any time. Go to <Link href="/settings">Settings</Link> → Export my data (JSON) to
          download everything. To delete your account and all associated data, use Settings → Danger
          Zone → Delete Account (7-day grace period).
        </p>
      </Q>

      <h2>Technical</h2>

      <Q q="How often does live NAV update?">
        <p>
          The live NAV widget on fund detail pages refreshes every 30 seconds during NSE market
          hours (09:15–15:30 IST, Monday–Friday). Outside market hours it shows the last official
          NAV.
        </p>
      </Q>

      <Q q="Why is the NAV chart empty for some funds?">
        <p>
          NAV history is backfilled progressively for the most popular funds. If a fund you searched
          shows an empty chart, its history hasn&apos;t been imported yet. Check back in a day or
          two — or use{' '}
          <a href="https://www.amfiindia.com" target="_blank" rel="noopener noreferrer">
            AMFI
          </a>{' '}
          or{' '}
          <a href="https://mfapi.in" target="_blank" rel="noopener noreferrer">
            MFAPI.in
          </a>{' '}
          for historical data in the meantime.
        </p>
      </Q>

      <Q q="The app feels slow / shows an error">
        <p>
          ISP runs on Vercel Hobby free tier — serverless functions may have a cold-start delay of
          1–2 seconds on the first request. If you see an error, try refreshing. Persistent issues?{' '}
          <a href="mailto:PUshkarlaldangi96@gmail.com">Let us know</a>.
        </p>
      </Q>
    </>
  );
}
