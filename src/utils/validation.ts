import { parseLocalDate, toIsoDate } from './dates';

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseLocalDate(value);
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value;
}

export function isDateOnOrAfter(value: string, minimum: string): boolean {
  return isValidIsoDate(value) && isValidIsoDate(minimum) && value >= minimum;
}

export function parsePositiveMoney(value: string): number | null {
  const normalized = value.replace(/[₹,\s]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function parseNonNegativeMoney(value: string): number | null {
  const normalized = value.replace(/[₹,\s]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
