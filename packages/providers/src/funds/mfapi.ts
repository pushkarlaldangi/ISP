/**
 * MFAPI.in — free unofficial Indian mutual fund API.
 * - https://api.mfapi.in/mf            → list of all schemes
 * - https://api.mfapi.in/mf/{code}     → scheme details + full history
 *
 * Used for HISTORICAL NAV (which AMFI's NAVAll.txt does not provide).
 */

import { parse } from 'date-fns';
import { z } from 'zod';

import { TransientProviderError } from '../types.js';

const BASE_URL = 'https://api.mfapi.in/mf';

const HistoryResponseSchema = z.object({
  meta: z
    .object({
      scheme_code: z.union([z.number(), z.string()]),
      scheme_name: z.string(),
      fund_house: z.string().optional(),
    })
    .optional(),
  data: z.array(
    z.object({
      date: z.string(),
      nav: z.string(),
    }),
  ),
  status: z.string().optional(),
});

export interface MfApiHistoryPoint {
  date: Date;
  nav: number;
}

export class MfApiClient {
  readonly name = 'mfapi';

  async fetchHistory(schemeCode: string): Promise<MfApiHistoryPoint[]> {
    let json: unknown;
    try {
      const res = await fetch(`${BASE_URL}/${encodeURIComponent(schemeCode)}`, {
        headers: { 'User-Agent': 'isp-mutual-fund-tracker/0.0.1' },
      });
      if (!res.ok) {
        throw new TransientProviderError(
          this.name,
          `mfapi returned ${res.status} ${res.statusText}`,
        );
      }
      json = await res.json();
    } catch (e) {
      if (e instanceof TransientProviderError) throw e;
      throw new TransientProviderError(this.name, 'failed to fetch mfapi history', e);
    }

    const parsed = HistoryResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new TransientProviderError(this.name, `mfapi schema mismatch: ${parsed.error.message}`);
    }

    const out: MfApiHistoryPoint[] = [];
    for (const row of parsed.data.data) {
      const nav = Number.parseFloat(row.nav);
      if (!Number.isFinite(nav)) continue;
      const date = parse(row.date, 'dd-MM-yyyy', new Date());
      if (Number.isNaN(date.getTime())) continue;
      out.push({ date, nav });
    }
    // mfapi returns newest first; sort ascending for downstream callers.
    out.sort((a, b) => a.date.getTime() - b.date.getTime());
    return out;
  }
}
