/**
 * GET /api/funds
 *
 * Lightweight list endpoint: search + category filter + pagination.
 *
 * Querystring:
 *   q          — case-insensitive substring on schemeName (uses ILIKE)
 *   category   — EQUITY | DEBT | HYBRID | ETF | SOLUTION | OTHER
 *   limit      — 1..100 (default 25)
 *   offset     — pagination offset (default 0)
 *
 * Phase 2 will replace the ILIKE with pg_trgm-backed full-text search; this
 * is intentionally simple to keep Phase 1 reviewable.
 */

import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getDb, schema } from '@isp/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  category: z.enum(['EQUITY', 'DEBT', 'HYBRID', 'ETF', 'SOLUTION', 'OTHER']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_query', details: parsed.error.format() },
      { status: 400 },
    );
  }
  const { q, category, limit, offset } = parsed.data;

  const filters = [
    q ? ilike(schema.funds.schemeName, `%${q}%`) : undefined,
    category ? eq(schema.funds.category, category) : undefined,
  ].filter((f): f is NonNullable<typeof f> => f !== undefined);

  const db = getDb();
  const where = filters.length > 0 ? and(...filters) : undefined;

  const rowsPromise = db
    .select({
      schemeCode: schema.funds.schemeCode,
      schemeName: schema.funds.schemeName,
      amcName: schema.funds.amcName,
      category: schema.funds.category,
      subCategory: schema.funds.subCategory,
      latestNav: schema.funds.latestNav,
      latestNavDate: schema.funds.latestNavDate,
    })
    .from(schema.funds)
    .where(where)
    .orderBy(asc(schema.funds.schemeName))
    .limit(limit)
    .offset(offset);

  const countPromise = db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.funds)
    .where(where);

  const [rows, countRows] = await Promise.all([rowsPromise, countPromise]);

  return NextResponse.json({
    items: rows,
    pagination: { limit, offset, total: countRows[0]?.total ?? 0 },
  });
}
