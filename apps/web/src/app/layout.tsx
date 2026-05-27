import type { Metadata, Viewport } from 'next';

import { MarketStatusBar } from '@/components/market-status-bar';
import { MobileNav } from '@/components/mobile-nav';
import { QueryProvider } from '@/components/query-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';

import './globals.css';

// NOTE: To enable Inter via next/font/google, restore the import below and
// add the `inter.variable` class to <body>. We default to a system font
// stack so builds don't depend on network access to fonts.googleapis.com.
// import { Inter } from 'next/font/google';
// const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'ISP — Indian Mutual Fund Tracker',
    template: '%s · ISP',
  },
  description:
    'Live intraday estimated NAV for Indian mutual funds. Track portfolios, holdings, and P&L in real time.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0d14' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* pb-16 reserves space for the mobile bottom nav bar */}
      <body className="flex min-h-screen flex-col pb-16 font-sans md:pb-0">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <MarketStatusBar />
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <SiteFooter />
            <MobileNav />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
