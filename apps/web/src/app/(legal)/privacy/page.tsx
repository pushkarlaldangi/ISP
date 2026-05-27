import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for ISP — Indian Mutual Fund Tracker.',
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        <strong>Effective date:</strong> 27 May 2026
      </p>
      <p>
        This Privacy Policy describes how ISP (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses,
        and protects your personal data in accordance with the{' '}
        <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> and applicable Indian
        law.
      </p>

      <h2>1. Data we collect</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Data</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Account</td>
            <td>Email address, display name</td>
            <td>Authentication, notifications</td>
          </tr>
          <tr>
            <td>Portfolio</td>
            <td>Fund names, transaction dates, units, NAV values you enter</td>
            <td>Portfolio tracking and P&amp;L calculation</td>
          </tr>
          <tr>
            <td>Usage</td>
            <td>Pages visited, features used (PostHog analytics)</td>
            <td>Product improvement</td>
          </tr>
          <tr>
            <td>Logs</td>
            <td>IP address, user-agent, action taken</td>
            <td>Security audit trail (audit_log table)</td>
          </tr>
          <tr>
            <td>Uploaded files</td>
            <td>CAS PDF statements (if you use the import feature)</td>
            <td>Parsing transactions; deleted after import</td>
          </tr>
        </tbody>
      </table>

      <h2>2. How we protect your data</h2>
      <ul>
        <li>
          <strong>Encryption in transit:</strong> All data is transmitted over TLS 1.3.
        </li>
        <li>
          <strong>Encryption at rest:</strong> Your email address and display name are encrypted at
          the application layer using AES-256-GCM before being stored in the database.
        </li>
        <li>
          <strong>Row-level security:</strong> Database rows are protected by Supabase RLS policies
          so your data is never accessible to other users.
        </li>
        <li>
          <strong>Audit log:</strong> Every change to your portfolio data is logged with IP and
          timestamp.
        </li>
      </ul>

      <h2>3. Data sharing</h2>
      <p>We do not sell your personal data. We share data only with:</p>
      <ul>
        <li>
          <strong>Supabase</strong> (database &amp; auth hosting) — Data Processing Agreement in
          place
        </li>
        <li>
          <strong>Vercel</strong> (app hosting) — request logs retained per Vercel policy
        </li>
        <li>
          <strong>Sentry</strong> (error monitoring) — stack traces may include request metadata; no
          PII in error payloads by design
        </li>
        <li>
          <strong>PostHog</strong> (analytics) — anonymized usage events; no PII
        </li>
        <li>
          <strong>Resend</strong> (email) — your email address is shared only to send transactional
          emails you triggered
        </li>
      </ul>

      <h2>4. Your rights under DPDP Act 2023</h2>
      <ul>
        <li>
          <strong>Access &amp; portability:</strong> Download all your data at any time via Settings
          → Export My Data (JSON format).
        </li>
        <li>
          <strong>Correction:</strong> Update your display name in Settings → Profile at any time.
        </li>
        <li>
          <strong>Erasure:</strong> Delete your account and all associated data via Settings →
          Danger Zone → Delete Account. A 7-day grace period applies before hard deletion.
        </li>
        <li>
          <strong>Grievance redressal:</strong> Contact our Data Protection Officer at{' '}
          <a href="mailto:PUshkarlaldangi96@gmail.com">PUshkarlaldangi96@gmail.com</a>. We will
          respond within 30 days.
        </li>
      </ul>

      <h2>5. Data retention</h2>
      <ul>
        <li>Account and portfolio data: retained while your account is active</li>
        <li>Audit log entries: 1 year from creation</li>
        <li>Uploaded CAS PDFs: deleted within 24 hours of successful import</li>
        <li>Analytics events (PostHog): 1 year</li>
        <li>After account deletion: all personal data hard-deleted within 7 days</li>
      </ul>

      <h2>6. Cookies</h2>
      <p>
        We use a single session cookie for authentication (Supabase Auth). We do not use tracking
        cookies. PostHog uses a first-party cookie for session analytics; you may opt out via
        Settings → Privacy.
      </p>

      <h2>7. Children</h2>
      <p>
        The Service is not directed at persons under 18. We do not knowingly collect data from
        minors.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>
        We will notify you by email at least 7 days before material changes take effect. Continued
        use after that date constitutes acceptance.
      </p>

      <h2>9. Contact</h2>
      <p>
        Data Protection Officer: Pushkar Lal Dangi
        <br />
        Email: <a href="mailto:PUshkarlaldangi96@gmail.com">PUshkarlaldangi96@gmail.com</a>
      </p>
    </>
  );
}
