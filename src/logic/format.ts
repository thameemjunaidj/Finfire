/**
 * format.ts — turning numbers into something a human reads without effort.
 */

/**
 * Format rupees the Indian way: 1,23,456 rather than 123,456.
 *
 * We do the grouping by hand instead of using Intl.NumberFormat because
 * Intl support varies across React Native engines and a demo is a bad place
 * to discover that. This is a few lines and always behaves.
 */
export function formatRupees(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const digits = String(rounded);

  // The last three digits stay together; everything before is grouped in twos.
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}` : lastThree;

  return `${value < 0 ? '-' : ''}₹${grouped}`;
}

/** '2026-08-29' -> '29 Aug' */
export function formatShortDate(key: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${months[m - 1]}`;
}

/** 1 -> 'tomorrow', 0 -> 'today', 5 -> 'in 5 days' */
export function formatWhen(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
