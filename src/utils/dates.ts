export function parseLocalDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(value: string, days: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function daysBetween(from: string, to: string): number {
  const milliseconds = parseLocalDate(to).getTime() - parseLocalDate(from).getTime();
  return Math.ceil(milliseconds / 86_400_000);
}

export function monthKey(value: string): string {
  return value.slice(0, 7);
}

export function daysInMonth(value: string): number {
  const date = parseLocalDate(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
}
