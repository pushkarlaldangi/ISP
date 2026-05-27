import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://isp-web-green.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/portfolio/', '/watchlist/', '/settings/', '/sign-in/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
