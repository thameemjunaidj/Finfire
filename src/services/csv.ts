import { Transaction, TransactionCategory, TRANSACTION_CATEGORIES } from '../types/finance';
import { isValidIsoDate } from '../utils/validation';

export interface CsvImportResult {
  transactions: Transaction[];
  errors: string[];
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function normalizeCategory(value: string): TransactionCategory {
  const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, '_');
  const aliases: Record<string, TransactionCategory> = {
    bills: 'utilities',
    dining: 'food',
    groceries: 'food',
    grocery: 'food',
    medical: 'health',
    salary: 'income',
    travel: 'transport',
  };
  const category = (aliases[normalized] ?? normalized) as TransactionCategory;
  return TRANSACTION_CATEGORIES.includes(category) ? category : 'other';
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').toLowerCase().trim().replace(/[\s_-]+/g, '');
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeDirection(value: string, amount: number, category: TransactionCategory): 'credit' | 'debit' | null {
  const normalized = value.toLowerCase().trim();
  if (!normalized) return category === 'income' ? 'credit' : 'debit';
  if (['credit', 'cr', 'income'].includes(normalized)) return 'credit';
  if (['debit', 'dr', 'expense'].includes(normalized)) return 'debit';
  if (amount < 0 && normalized === '-') return 'debit';
  return null;
}

export function parseTransactionsCsv(csv: string): CsvImportResult {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { transactions: [], errors: ['The CSV is empty or missing data rows.'] };
  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const required = ['date', 'merchant', 'amount'];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) return { transactions: [], errors: [`Missing columns: ${missing.join(', ')}`] };

  const transactions: Transaction[] = [];
  const errors: string[] = [];
  const occurrences = new Map<string, number>();
  const dataLines = lines.slice(1, 5001);
  if (lines.length > 5001) errors.push('Only the first 5,000 data rows were processed.');
  dataLines.forEach((line, index) => {
    const cells = splitCsvLine(line);
    const read = (name: string) => cells[headers.indexOf(normalizeHeader(name))] ?? '';
    const date = read('date');
    const merchant = read('merchant');
    const rawAmount = Number(read('amount').replace(/[₹,\s]/g, ''));
    const category = normalizeCategory(read('category'));
    const direction = normalizeDirection(read('direction'), rawAmount, category);
    if (!isValidIsoDate(date) || !merchant || !Number.isFinite(rawAmount) || rawAmount === 0 || !direction) {
      errors.push(`Row ${index + 2} is invalid.`);
      return;
    }
    const essentialValue = read('essential').toLowerCase();
    const fingerprint = stableHash(cells.map((cell) => cell.trim().toLowerCase()).join('\u001f'));
    const occurrence = occurrences.get(fingerprint) ?? 0;
    occurrences.set(fingerprint, occurrence + 1);
    transactions.push({
      id: `csv-${fingerprint}-${occurrence}`,
      date,
      merchant,
      amount: Math.abs(rawAmount),
      direction,
      category,
      essential: essentialValue
        ? ['true', 'yes', '1'].includes(essentialValue)
        : ['rent', 'utilities', 'health'].includes(category),
      recurringGroupId: read('recurringGroupId') || undefined,
      source: 'csv',
    });
  });
  return { transactions, errors };
}
