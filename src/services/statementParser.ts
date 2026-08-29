/**
 * statementParser.ts — reading a bank statement whatever shape it arrives in.
 *
 * THE ACTUAL PROBLEM
 * "Only CSV" was never the limitation. The limitation was that the old parser
 * demanded columns named exactly `date`, `merchant`, `amount` — and no bank on
 * earth exports that. HDFC writes "Narration" and splits money into
 * "Withdrawal Amt." and "Deposit Amt."; SBI writes "Description" and "Debit";
 * ICICI writes "Transaction Remarks" and "Withdrawal Amount (INR)". Every one
 * of them puts three or four lines of account preamble above the header row.
 *
 * So this file does not ask the person to reformat their statement. It reads
 * the file, works out which column is which, and says what it decided so they
 * can correct it.
 *
 * It handles:
 *   - commas, semicolons or tabs as separators
 *   - a header row buried under preamble lines
 *   - one signed amount column, OR separate debit and credit columns
 *   - a Dr/Cr indicator column
 *   - dd/mm/yyyy, dd-mm-yy, dd-MMM-yy, yyyy-mm-dd
 *   - ₹ signs, thousands commas, and (1,234.00) for negatives
 *
 * Everything happens on the phone. A bank statement is the most private file
 * most people own.
 */

import { Transaction } from '../types/finance';

export interface ColumnMapping {
  date: number;
  description: number;
  /** A single column holding a signed or unsigned amount. */
  amount: number;
  /** Separate columns, when the bank splits money out and money in. */
  debit: number;
  credit: number;
  /** A column containing "DR"/"CR". */
  indicator: number;
}

export interface StatementReadResult {
  transactions: Transaction[];
  /** Which column became what, so the person can check our guesses. */
  mapping: Record<string, string>;
  /** Rows we could not read, with the reason. */
  problems: string[];
  /** The header row as the bank wrote it. */
  headers: string[];
  rowsRead: number;
}

/* ------------------------------------------------------------------ */
/* Splitting the file                                                  */
/* ------------------------------------------------------------------ */

/** Whichever separator appears most consistently across the first few lines. */
function detectSeparator(lines: string[]): string {
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestScore = 0;

  for (const separator of candidates) {
    const counts = lines.slice(0, 12).map((line) => line.split(separator).length - 1);
    const populated = counts.filter((count) => count > 0);
    if (populated.length < 2) continue;
    // Consistency matters more than volume: a narration full of commas can
    // out-count the real separator on any single line.
    const most = Math.max(...populated);
    const agreeing = populated.filter((count) => count === most).length;
    const score = agreeing * most;
    if (score > bestScore) { bestScore = score; best = separator; }
  }
  return best;
}

/** Split one line, respecting "quoted, fields". */
function splitLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    if (character === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === separator && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

/* ------------------------------------------------------------------ */
/* Working out which column is which                                   */
/* ------------------------------------------------------------------ */

const HEADER_WORDS: Record<keyof ColumnMapping, RegExp> = {
  date: /^(txn|transaction|value|posting|book)?\s*(date|dt)\b/i,
  description: /(narration|description|particular|remark|details|merchant|transaction\s*remarks|payee)/i,
  amount: /^(amount|amt|transaction\s*amount)/i,
  debit: /(withdraw|debit|dr\b|paid\s*out|money\s*out)/i,
  credit: /(deposit|credit|cr\b|paid\s*in|money\s*in)/i,
  indicator: /(dr\s*[\/|-]\s*cr|cr\s*[\/|-]\s*dr|debit\s*\/\s*credit|type|indicator)/i,
};

/**
 * Find the header row.
 *
 * Bank exports open with the account holder's name, account number, branch and
 * statement period before the table starts, so row 1 is almost never the
 * header. We take the first row that names both a date and something
 * money-shaped.
 */
function findHeaderRow(rows: string[][]): number {
  for (let index = 0; index < Math.min(rows.length, 25); index += 1) {
    const cells = rows[index];
    if (cells.length < 3) continue;
    const hasDate = cells.some((cell) => HEADER_WORDS.date.test(cell));
    const hasMoney = cells.some((cell) => (
      HEADER_WORDS.amount.test(cell) || HEADER_WORDS.debit.test(cell) || HEADER_WORDS.credit.test(cell)
    ));
    if (hasDate && hasMoney) return index;
  }
  return -1;
}

function mapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { date: -1, description: -1, amount: -1, debit: -1, credit: -1, indicator: -1 };

  headers.forEach((header, index) => {
    const cell = header.trim();
    if (!cell) return;
    /**
     * Order matters twice over.
     *
     * "Dr/Cr" must be recognised as an INDICATOR before the debit rule sees
     * the "dr" in it — otherwise it is treated as a money-out column, and
     * every credit row in the file gets imported as spending. That turned
     * ₹600 of income into ₹600 of expenditure in testing.
     *
     * And "Withdrawal Amount" must be read as debit before the amount rule
     * claims it.
     */
    if (mapping.indicator < 0 && HEADER_WORDS.indicator.test(cell)) { mapping.indicator = index; return; }
    if (mapping.debit < 0 && HEADER_WORDS.debit.test(cell)) { mapping.debit = index; return; }
    if (mapping.credit < 0 && HEADER_WORDS.credit.test(cell)) { mapping.credit = index; return; }
    if (mapping.date < 0 && HEADER_WORDS.date.test(cell)) { mapping.date = index; return; }
    if (mapping.description < 0 && HEADER_WORDS.description.test(cell)) { mapping.description = index; return; }
    if (mapping.amount < 0 && HEADER_WORDS.amount.test(cell)) { mapping.amount = index; }
  });

  return mapping;
}

/* ------------------------------------------------------------------ */
/* Reading the values                                                  */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function readDate(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  // Already the way we store them.
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 21-Aug-2026 / 21 Aug 26
  const named = text.match(/^(\d{1,2})[-/\s]([a-z]{3})[a-z]*[-/\s](\d{2,4})/i);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month) {
      const year = named[3].length === 2 ? 2000 + Number(named[3]) : Number(named[3]);
      return `${year}-${pad(month)}-${pad(Number(named[1]))}`;
    }
  }

  // 21/08/2026 — day first. Indian banks do not use month-first, and guessing
  // wrong would silently move every transaction before the 13th.
  const numeric = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (month > 12) return null;
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  return null;
}

/** "₹1,234.50", "1234.50 Dr", "(1,234.50)" → 1234.5 */
export function readMoney(raw: string): number | null {
  if (!raw) return null;
  const bracketed = /\(.*\)/.test(raw);
  const cleaned = raw.replace(/[₹$,\s]/g, '').replace(/[()]/g, '').replace(/(dr|cr)$/i, '');
  if (!cleaned || cleaned === '-') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return bracketed ? -Math.abs(value) : value;
}

/** A merchant name out of a bank narration line. */
function tidyDescription(raw: string): string {
  /**
   * Bank narrations are machine strings, not sentences:
   * "UPI-SWIGGY-swiggy@ybl-REF402944". Splitting on spaces alone leaves
   * "-swiggy-swiggy -ref". Hyphens and slashes are separators here.
   */
  const cleaned = raw
    .replace(/@[a-z]+/gi, ' ')          // strip UPI handles: swiggy@ybl
    .replace(/[-/|*]+/g, ' ')           // the real separators
    .replace(/[^a-z0-9 &']/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const noise = /^(upi|imps|neft|rtgs|pos|atm|ach|mmt|ref|txn|by|to|from|no|nos|d|dr|cr|inr)$/i;
  const words = cleaned
    .split(' ')
    .filter((word) => word.length > 1)
    .filter((word) => !noise.test(word))
    .filter((word) => !/^\d+$/.test(word))      // reference numbers
    .slice(0, 3);
  if (!words.length) return raw.slice(0, 24).trim() || 'Unknown';
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/* ------------------------------------------------------------------ */
/* Reading the whole thing                                             */
/* ------------------------------------------------------------------ */

export function readStatement(text: string): StatementReadResult {
  const empty: StatementReadResult = {
    transactions: [], mapping: {}, problems: [], headers: [], rowsRead: 0,
  };

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { ...empty, problems: ['That file has no rows in it.'] };
  }

  const separator = detectSeparator(lines);
  const rows = lines.map((line) => splitLine(line, separator));

  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) {
    return {
      ...empty,
      problems: ['I could not find a header row with a date and an amount. If this is a PDF, export it as CSV or Excel from your bank first.'],
    };
  }

  const headers = rows[headerIndex];
  const columns = mapColumns(headers);

  if (columns.date < 0) return { ...empty, headers, problems: ['No date column found.'] };
  if (columns.amount < 0 && columns.debit < 0 && columns.credit < 0) {
    return { ...empty, headers, problems: ['No amount column found.'] };
  }

  const mapping: Record<string, string> = {};
  if (columns.date >= 0) mapping[headers[columns.date]] = 'date';
  if (columns.description >= 0) mapping[headers[columns.description]] = 'who it was paid to';
  if (columns.amount >= 0) mapping[headers[columns.amount]] = 'amount';
  if (columns.debit >= 0) mapping[headers[columns.debit]] = 'money out';
  if (columns.credit >= 0) mapping[headers[columns.credit]] = 'money in';
  if (columns.indicator >= 0) mapping[headers[columns.indicator]] = 'money in or out';

  const transactions: Transaction[] = [];
  const problems: string[] = [];

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const cells = rows[index];
    const cell = (position: number) => (position >= 0 && position < cells.length ? cells[position] : '');

    const date = readDate(cell(columns.date));
    if (!date) continue; // Totals, footers and blank rows — skip quietly.

    let amount: number | null = null;
    let direction: 'debit' | 'credit' = 'debit';

    if (columns.debit >= 0 || columns.credit >= 0) {
      // Split columns: whichever one has a number wins.
      const out = readMoney(cell(columns.debit));
      const inward = readMoney(cell(columns.credit));
      if (out && out !== 0) { amount = Math.abs(out); direction = 'debit'; }
      else if (inward && inward !== 0) { amount = Math.abs(inward); direction = 'credit'; }
    }

    if (amount === null && columns.amount >= 0) {
      const value = readMoney(cell(columns.amount));
      if (value !== null && value !== 0) {
        amount = Math.abs(value);
        // A minus sign means money out; a Dr/Cr column overrules it.
        direction = value < 0 ? 'debit' : 'credit';
        const indicator = cell(columns.indicator).toUpperCase();
        if (indicator.includes('DR')) direction = 'debit';
        else if (indicator.includes('CR')) direction = 'credit';
        else if (value > 0 && columns.indicator < 0) direction = 'debit';
      }
    }

    if (amount === null) {
      problems.push(`Row ${index + 1}: could not read an amount.`);
      continue;
    }

    const description = cell(columns.description) || 'Unknown';

    transactions.push({
      // Built from the row's own contents, so importing the same file twice
      // produces the same ids and the duplicate check can catch it.
      id: `stmt-${date}-${Math.round(amount)}-${index}`,
      date,
      merchant: tidyDescription(description),
      amount: Math.abs(amount),
      direction,
      category: 'other',   // categoriser.ts decides this afterwards
      essential: false,
      source: 'csv',
    });
  }

  if (!transactions.length && !problems.length) {
    problems.push('I found the columns but no rows I could read.');
  }

  return {
    transactions,
    mapping,
    problems: problems.slice(0, 8),
    headers,
    rowsRead: rows.length - headerIndex - 1,
  };
}
