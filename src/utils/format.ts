import { AlertSeverity, RiskBand, TransactionCategory } from '../types/finance';
import { colors } from '../theme/colors';

export function formatCurrency(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '₹0';
  if (compact && Math.abs(value) >= 100_000) {
    return `₹${(value / 100_000).toFixed(1)}L`;
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `₹${(value / 1_000).toFixed(1)}K`;
  }
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export function formatDate(value: string, withYear = false): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function severityColor(severity: AlertSeverity): string {
  if (severity === 'critical') return colors.critical;
  if (severity === 'high') return colors.high;
  return colors.watch;
}

export function severityBackground(severity: AlertSeverity): string {
  if (severity === 'critical') return colors.criticalSoft;
  if (severity === 'high') return colors.highSoft;
  return colors.watchSoft;
}

export function riskColor(band: RiskBand): string {
  if (band === 'Critical') return colors.critical;
  if (band === 'High Risk') return colors.high;
  if (band === 'Caution') return colors.watch;
  return colors.safe;
}

export function categoryIcon(category: TransactionCategory): string {
  const icons: Record<TransactionCategory, string> = {
    income: 'arrow-down-circle',
    rent: 'home',
    utilities: 'zap',
    food: 'coffee',
    transport: 'navigation',
    shopping: 'shopping-bag',
    entertainment: 'film',
    health: 'heart',
    subscription: 'repeat',
    other: 'more-horizontal',
  };
  return icons[category];
}
