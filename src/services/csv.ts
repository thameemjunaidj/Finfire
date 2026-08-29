import { Transaction, TransactionCategory, TRANSACTION_CATEGORIES } from '../types/finance';

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
  const normalized = value.toLowerCase().trim().replace(/\s+/g, '_') as TransactionCategory;
  return TRANSACTION_CATEGORIES.includes(normalized) ? normalized : 'other';
}

export function parseTransactionsCsv(csv: string): CsvImportResult {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { transactions: [], errors: ['The CSV is empty or missing data rows.'] };
  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const required = ['date', 'merchant', 'amount'];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) return { transactions: [], errors: [`Missing columns: ${missing.join(', ')}`] };

  const transactions: Transaction[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = splitCsvLine(line);
    const read = (name: string) => cells[headers.indexOf(name)] ?? '';
    const date = read('date');
    const merchant = read('merchant');
    const rawAmount = Number(read('amount').replace(/[₹,\s]/g, ''));
    const rawDirection = read('direction').toLowerCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !merchant || !Number.isFinite(rawAmount) || rawAmount === 0) {
      errors.push(`Row ${index + 2} is invalid.`);
      return;
    }
    const direction = rawDirection === 'credit' || rawAmount < 0 ? 'credit' : 'debit';
    const essentialValue = read('essential').toLowerCase();
    transactions.push({
      id: `csv-${Date.now()}-${index}`,
      date,
      merchant,
      amount: Math.abs(rawAmount),
      direction,
      category: normalizeCategory(read('category')),
      essential: ['true', 'yes', '1'].includes(essentialValue),
      recurringGroupId: read('recurringgroupid') || undefined,
      source: 'csv',
    });
  });
  return { transactions, errors };
}
