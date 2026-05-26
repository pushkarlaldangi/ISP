/**
 * Generate the list of SIP installment dates between a start and end date.
 *
 * The "SIP date" is the day-of-month chosen by the user (1-28 to avoid
 * month-end edge cases). If a SIP date falls on a weekend or holiday,
 * the caller is responsible for the next-business-day adjustment via the
 * `adjustDate` callback — this keeps the scheduler pure and free of any
 * holiday calendar dependency.
 */

import { addMonths, setDate, startOfDay } from 'date-fns';

export interface SipScheduleInput {
  startDate: Date;
  endDate: Date;
  dayOfMonth: number; // 1-28
  adjustDate?: (d: Date) => Date;
}

export function generateSipDates({
  startDate,
  endDate,
  dayOfMonth,
  adjustDate,
}: SipScheduleInput): Date[] {
  if (dayOfMonth < 1 || dayOfMonth > 28) {
    throw new Error('dayOfMonth must be between 1 and 28');
  }
  if (endDate < startDate) {
    return [];
  }

  const dates: Date[] = [];
  let cursor = startOfDay(setDate(startDate, dayOfMonth));
  // If the day-of-month in the start month is before the start date, move on by one month.
  if (cursor < startOfDay(startDate)) {
    cursor = addMonths(cursor, 1);
  }
  const end = startOfDay(endDate);

  while (cursor <= end) {
    const adjusted = adjustDate ? adjustDate(cursor) : cursor;
    dates.push(adjusted);
    cursor = addMonths(cursor, 1);
  }
  return dates;
}
