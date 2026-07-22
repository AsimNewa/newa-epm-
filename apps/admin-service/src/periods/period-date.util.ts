export function firstDayOfMonthUTC(year: number, month1based: number): Date {
  return new Date(Date.UTC(year, month1based - 1, 1));
}

export function lastDayOfMonthUTC(year: number, month1based: number): Date {
  return new Date(Date.UTC(year, month1based, 0));
}

export function addMonths(year: number, month1based: number, delta: number): { year: number; month: number } {
  const zeroBasedTotal = month1based - 1 + delta;
  const newYear = year + Math.floor(zeroBasedTotal / 12);
  const newMonth = ((zeroBasedTotal % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function monthName(month1based: number): string {
  return MONTH_NAMES[month1based - 1];
}
