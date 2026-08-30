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

const plainLabels: Record<string, string> = {
  all: 'All',
  debit: 'Money out',
  credit: 'Money in',
  flexible: 'Optional',
  essential: 'Essential',
  critical: 'Urgent',
  high: 'Important',
  watch: 'Watch',
  utilities: 'Bills',
  subscription: 'Subscriptions',
  csv: 'Imported',
  manual: 'Added by you',
};

export function plainLabel(value: string): string {
  return plainLabels[value] ?? titleCase(value);
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

/* ------------------------------------------------------------------ */
/* Money health — the same finding, said the way round people read it   */
/* ------------------------------------------------------------------ */

/**
 * The engines work in RISK: 0 is fine, 100 is trouble. That is the right way
 * to compute it — every detector adds danger to a pile — but it is the wrong
 * way to show it. A screen reading "0 / 100" under the word "Safe" looks like
 * a failing grade, and people read a bar that is nearly empty as bad news no
 * matter what the label above it says.
 *
 * So the number on screen is HEALTH: risk turned inside out. Nothing in the
 * engine changes — this is a translation at the last possible moment, which is
 * also why every threshold, test and alert still speaks in risk.
 */
export function healthFromRisk(riskScore: number): number {
  if (!Number.isFinite(riskScore)) return 0;
  return Math.max(0, Math.min(100, Math.round(100 - riskScore)));
}

/** h 0-360, s and l as 0-1, out as '#rrggbb'. */
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;

  const [r, g, b] =
    hue < 60 ? [chroma, second, 0] :
    hue < 120 ? [second, chroma, 0] :
    hue < 180 ? [0, chroma, second] :
    hue < 240 ? [0, second, chroma] :
    hue < 300 ? [second, 0, chroma] :
    [chroma, 0, second];

  const channel = (value: number) =>
    Math.round((value + match) * 255).toString(16).padStart(2, '0');

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * Green at full health, sliding through amber to red as it falls.
 *
 * Continuous rather than four fixed colours, because the whole point of the
 * gauge is that it MOVES: spending a little too much should visibly warm the
 * dial, not leave it identical until it crosses an invisible line and jumps.
 * Hue 0 is red and hue 140 is green, so health maps straight onto it.
 */
export function healthColor(health: number): string {
  const clamped = Math.max(0, Math.min(100, health));
  return hslToHex((clamped / 100) * 140, 0.72, 0.52);
}

/** The band, worded as health rather than as risk. */
export function healthLabel(band: RiskBand): string {
  if (band === 'Critical') return 'Critical';
  if (band === 'High Risk') return 'Poor';
  if (band === 'Caution') return 'Fair';
  return 'Healthy';
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


/**
 * Show a number only when it means something.
 *
 * A computed zero and an unknown look identical once they reach the screen,
 * and the difference matters: "0 days" is a warning, "—" is an admission. Use
 * this anywhere a figure depends on data the person may not have entered yet.
 */
export function formatWhenKnown(known: boolean, value: string): string {
  return known ? value : '—';
}
