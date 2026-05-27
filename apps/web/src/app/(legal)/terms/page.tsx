import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for ISP — Indian Mutual Fund Tracker.',
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        <strong>Effective date:</strong> 27 May 2026
      </p>

      <h2>1. About ISP</h2>
      <p>
        ISP (&ldquo;the Service&rdquo;) is a mutual fund portfolio <strong>tracking</strong> tool
        operated by Pushkar Lal Dangi (&ldquo;we&rdquo;, &ldquo;us&rdquo;). The Service allows you
        to record and monitor mutual fund transactions you have already made through a licensed
        broker or AMC.
      </p>

      <h2>2. Not investment advice — SEBI disclaimer</h2>
      <p>
        <strong>
          ISP is NOT a SEBI Registered Investment Advisor (RIA) and does not provide investment
          advice.
        </strong>{' '}
        Nothing on this platform — including fund data, live NAV estimates, portfolio P&amp;L
        figures, or any other information — constitutes a recommendation to buy, sell, or hold any
        security or mutual fund unit. All data is provided for informational and tracking purposes
        only.
      </p>
      <p>
        Live NAV estimates are directional approximations computed from publicly available holding
        disclosures and market prices. They are <strong>not</strong> official NAVs published by AMCs
        or AMFI and may differ materially from actual NAVs.
      </p>
      <p>
        Before making any investment decision, please consult a SEBI Registered Investment Advisor
        or other qualified financial professional.
      </p>

      <h2>3. Eligibility</h2>
      <p>
        You must be at least 18 years old and a resident of India to use the Service. By creating an
        account, you confirm you meet these requirements.
      </p>

      <h2>4. Account and security</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials. Notify
        us immediately at{' '}
        <a href="mailto:PUshkarlaldangi96@gmail.com">PUshkarlaldangi96@gmail.com</a> if you suspect
        unauthorized access. We are not liable for losses arising from unauthorized use of your
        account.
      </p>

      <h2>5. Data accuracy</h2>
      <p>
        Fund NAV data is sourced from AMFI (authoritative, daily) and MFAPI.in. Holdings data is
        sourced from AMC monthly portfolio disclosures and may be up to 30 days old. Live price
        quotes are sourced from NSE public APIs and Yahoo Finance with appropriate caching; they may
        be delayed by up to 15 minutes during market hours.
      </p>
      <p>
        We make reasonable efforts to ensure data accuracy but do not guarantee it. You are solely
        responsible for verifying data before relying on it.
      </p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for automated scraping or bulk data extraction</li>
        <li>Attempt to reverse-engineer, hack, or disrupt the Service</li>
        <li>Impersonate another user or submit false information</li>
        <li>Use the Service for any unlawful purpose</li>
      </ul>

      <h2>7. Intellectual property</h2>
      <p>
        All content, design, and code of the Service is owned by us or licensed to us. Fund data
        originates from AMFI, AMCs, NSE, and Yahoo Finance under their respective terms.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for any financial loss, lost
        profits, or indirect damages arising from your use of the Service or reliance on any data
        displayed. Your sole remedy for dissatisfaction is to stop using the Service.
      </p>

      <h2>9. Privacy</h2>
      <p>
        Our collection and use of personal data is described in our{' '}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>10. Changes to these terms</h2>
      <p>
        We may update these Terms at any time. Continued use of the Service after changes are posted
        constitutes acceptance. Material changes will be notified via email.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Disputes shall be subject to the exclusive
        jurisdiction of courts in Bengaluru, Karnataka.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions? Email us at{' '}
        <a href="mailto:PUshkarlaldangi96@gmail.com">PUshkarlaldangi96@gmail.com</a>.
      </p>
    </>
  );
}
