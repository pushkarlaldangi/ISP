import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SEBI Disclaimer',
  description: 'Regulatory disclaimer for ISP — Indian Mutual Fund Tracker.',
};

export default function DisclaimerPage() {
  return (
    <>
      <h1>Regulatory Disclaimer</h1>

      <div
        className="not-prose rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30"
        role="note"
        aria-label="Important regulatory notice"
      >
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          ⚠ Important — Please read before using ISP
        </p>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-400">
          ISP is a portfolio <strong>tracking</strong> tool, not an investment advisory service. We
          are <strong>NOT registered with SEBI as an Investment Advisor</strong> under the SEBI
          (Investment Advisers) Regulations, 2013.
        </p>
      </div>

      <h2>What ISP is</h2>
      <ul>
        <li>A tool to record and monitor mutual fund transactions you have already placed</li>
        <li>A calculator for portfolio P&amp;L, XIRR, and asset allocation</li>
        <li>A display of publicly available NAV data from AMFI</li>
        <li>An estimator of intraday NAV movement based on disclosed holdings and live prices</li>
      </ul>

      <h2>What ISP is NOT</h2>
      <ul>
        <li>
          <strong>Not investment advice.</strong> Nothing on ISP constitutes a recommendation to
          buy, sell, switch, or hold any mutual fund or security.
        </li>
        <li>
          <strong>Not a research service.</strong> Fund ratings, categories, and data are
          informational only and do not reflect our views on fund quality.
        </li>
        <li>
          <strong>Not a broker or distributor.</strong> ISP cannot execute transactions on your
          behalf.
        </li>
        <li>
          <strong>Not authoritative for NAV.</strong> The &ldquo;Live Estimated NAV&rdquo; is a
          directional approximation and is not the official NAV published by AMCs or AMFI. Official
          NAVs are published daily at{' '}
          <a href="https://www.amfiindia.com" target="_blank" rel="noopener noreferrer">
            amfiindia.com
          </a>
          .
        </li>
      </ul>

      <h2>Data limitations</h2>
      <p>
        Fund holdings data is sourced from monthly AMC portfolio disclosures and may be up to 30
        days old. Live price quotes are sourced from NSE/Yahoo Finance and may be delayed. Estimates
        for debt-heavy or hybrid funds are less reliable than for equity funds. Always verify with
        your AMC or broker before acting on any data shown here.
      </p>

      <h2>Consult a professional</h2>
      <p>
        Before making any investment decision, consult a SEBI Registered Investment Advisor (RIA).
        You can find a registered advisor on the{' '}
        <a
          href="https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=13"
          target="_blank"
          rel="noopener noreferrer"
        >
          SEBI website
        </a>
        .
      </p>

      <h2>Mutual fund risk disclosure</h2>
      <p>
        <em>
          Mutual fund investments are subject to market risks. Please read all scheme-related
          documents carefully before investing. Past performance is not indicative of future
          returns.
        </em>
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this disclaimer?{' '}
        <a href="mailto:PUshkarlaldangi96@gmail.com">PUshkarlaldangi96@gmail.com</a>
      </p>
    </>
  );
}
