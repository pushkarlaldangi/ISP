/**
 * NSE/BSE regular session: Mon-Fri, 09:15-15:30 IST.
 * Public holidays are not included — for production we'd pull the NSE
 * holiday calendar, but for free-tier launch we accept that the "LIVE"
 * badge may flash on a holiday and our data layer will gracefully serve
 * yesterday's quotes.
 */

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const IST = 'Asia/Kolkata';
const OPEN_HOUR = 9;
const OPEN_MINUTE = 15;
const CLOSE_HOUR = 15;
const CLOSE_MINUTE = 30;

export interface MarketStatus {
  isOpen: boolean;
  istNow: Date;
  nextOpen: Date | null;
  nextClose: Date | null;
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const ist = toZonedTime(now, IST);
  const day = ist.getDay(); // 0 Sun .. 6 Sat
  const minutes = ist.getHours() * 60 + ist.getMinutes();
  const openMin = OPEN_HOUR * 60 + OPEN_MINUTE;
  const closeMin = CLOSE_HOUR * 60 + CLOSE_MINUTE;
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && minutes >= openMin && minutes < closeMin;
  return {
    isOpen,
    istNow: ist,
    nextOpen: null,
    nextClose: null,
  };
}

export function formatIst(d: Date, fmt = 'd MMM yyyy, HH:mm'): string {
  return formatInTimeZone(d, IST, fmt);
}
