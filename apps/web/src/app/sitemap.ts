import type { MetadataRoute } from 'next';

import { getDb, schema } from '@isp/db';

export const dynamic = 'force-dynamic';
export const revalidate = 86400; // rebuild daily

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://isp-web-green.vercel.app';
  const now = new Date();

  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/funds`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/disclaimer`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Top 500 funds by recent NAV update (don't include all 14k — too large for Vercel response)
  try {
    const db = getDb();
    const funds = await db
      .select({ schemeCode: schema.funds.schemeCode, updatedAt: schema.funds.updatedAt })
      .from(schema.funds)
      .limit(500);

    const fundRoutes: MetadataRoute.Sitemap = funds.map((f) => ({
      url: `${base}/funds/${f.schemeCode}`,
      lastModified: f.updatedAt ?? now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

    return [...staticRoutes, ...fundRoutes];
  } catch {
    // DB unavailable during build — return static only
    return staticRoutes;
  }
}
