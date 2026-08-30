/**
 * smsParser.ts — turning a bank message into a transaction.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM HOW MESSAGES ARRIVE
 * Reading SMS automatically is an Android-only, permission-heavy thing that
 * cannot run inside Expo Go (see the note at the bottom). The *understanding*
 * of a bank message is not. So the reading and the understanding are kept
 * apart: this file takes a string and returns a transaction, and it does not
 * care whether that string was read automatically, pasted in, or shared from
 * the messages app. When automatic reading is added later, nothing here
 * changes.
 *
 * Everything runs on the phone. A bank message is about as private as text
 * gets, and sending one to a server to be "understood" would give away exactly
 * what this app promises to protect.
 */

import { Transaction, TransactionCategory } from '../types/finance';
import { toIsoDate } from '../utils/dates';

export interface ParsedMessage {
  amount: number;
  direction: 'debit' | 'credit';
  merchant: string;
  date: string;
  /** Last digits of the account or card, when the message includes them. */
  account?: string;
  /** Anything we could not make sense of, kept so the user can correct it. */
  raw: string;
  /** 0-1. Low confidence means show it to the user before saving. */
  confidence: number;
}

/* ------------------------------------------------------------------ */
/* Reading the parts                                                   */
/* ------------------------------------------------------------------ */

/** ₹1,234.50 / Rs.1234 / INR 1,234 — Indian banks write it every way. */
const AMOUNT = /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;

const DEBIT_WORDS = /\b(debited|spent|withdrawn|paid|purchase|sent|deducted)\b/i;
const CREDIT_WORDS = /\b(credited|received|refund|deposited|cashback)\b/i;

/** Account or card tail: A/c XX1234, card ending 5678, a/c no. X1234 */
const ACCOUNT = /(?:a\/c|acct|account|card)[^0-9a-z]{0,12}(?:x+|\*+)?\s*([0-9]{3,6})/i;

/**
 * Who the money went to. Banks put it after a handful of prepositions, and
 * whichever appears we take the text that follows up to a natural stop.
 *
 * UPI IDs (swiggy@ybl) get their handle stripped, because "swiggy" is the
 * merchant and "@ybl" is the bank behind it.
 */
const MERCHANT_PATTERNS: RegExp[] = [
  /\b(?:to\s+vpa|vpa)\s+([a-z0-9._-]+)@[a-z]+/i,
  /\btowards?\s+([a-z0-9][a-z0-9 &._'-]{1,40}?)(?:\s+on\b|\s+ref\b|\.|,|$)/i,
  /\bat\s+([a-z0-9][a-z0-9 &._'-]{1,40}?)(?:\s+on\b|\s+ref\b|\.|,|$)/i,
  /\bto\s+([a-z0-9][a-z0-9 &._'-]{1,40}?)(?:\s+on\b|\s+ref\b|\.|,|$)/i,
  /\bfrom\s+([a-z0-9][a-z0-9 &._'-]{1,40}?)(?:\s+on\b|\s+ref\b|\.|,|$)/i,
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Banks use 21-08-26, 21/08/2026 and 21-Aug-26 interchangeably. */
function readDate(text: string, fallback: string): string {
  const named = text.match(/\b([0-3]?[0-9])[-/\s]([a-z]{3})[a-z]*[-/\s]([0-9]{2,4})\b/i);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month) {
      const year = Number(named[3].length === 2 ? `20${named[3]}` : named[3]);
      return `${year}-${pad(month)}-${pad(Number(named[1]))}`;
    }
  }

  const numeric = text.match(/\b([0-3]?[0-9])[-/]([01]?[0-9])[-/]([0-9]{2,4})\b/);
  if (numeric) {
    const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
    // Indian banks write day first. Guessing month-first would silently move
    // transactions into the wrong month for any date before the 13th.
    return `${year}-${pad(Number(numeric[2]))}-${pad(Number(numeric[1]))}`;
  }

  return fallback;
}

/** "SWIGGY*ORDER 12345" → "Swiggy" */
function tidyMerchant(raw: string): string {
  const cleaned = raw
    .replace(/\*.*$/, '')
    .replace(/\b(upi|ref|txn|id|no|pvt|ltd|india|payment|paytm)\b/gi, ' ')
    .replace(/[0-9]{4,}/g, ' ')
    .replace(/[^a-z0-9 &'-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/* ------------------------------------------------------------------ */
/* The parser                                                          */
/* ------------------------------------------------------------------ */

/**
 * Read one bank message. Returns null when it clearly is not one — an OTP, a
 * balance enquiry, a marketing text — rather than guessing.
 */
export function parseBankMessage(message: string, today: string = toIsoDate(new Date())): ParsedMessage | null {
  const text = message.replace(/\s+/g, ' ').trim();
  if (!text) return null;

  // An OTP message contains an amount and looks tempting; it is not a payment.
  if (/\b(otp|one[- ]time password|do not share)\b/i.test(text)) return null;
  // "Available balance is Rs 2,340" is information, not a transaction.
  if (/\b(available|avl|closing)\s+(bal|balance)\b/i.test(text) && !DEBIT_WORDS.test(text) && !CREDIT_WORDS.test(text)) {
    return null;
  }

  const amountMatch = text.match(AMOUNT);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const isCredit = CREDIT_WORDS.test(text) && !DEBIT_WORDS.test(text);
  const isDebit = DEBIT_WORDS.test(text);
  if (!isCredit && !isDebit) return null;

  let merchant = '';
  let matchedPattern = -1;
  for (let i = 0; i < MERCHANT_PATTERNS.length; i += 1) {
    const found = text.match(MERCHANT_PATTERNS[i]);
    if (found && found[1]) {
      merchant = tidyMerchant(found[1]);
      if (merchant) { matchedPattern = i; break; }
    }
  }

  const account = text.match(ACCOUNT)?.[1];
  const date = readDate(text, today);

  /**
   * Confidence, so the app knows when to ask rather than assume. A message
   * with a clear merchant, a date and an account is worth saving quietly; one
   * where we guessed the merchant should be shown to the user first.
   */
  let confidence = 0.4;
  if (merchant) confidence += matchedPattern <= 1 ? 0.3 : 0.2;
  if (date !== today) confidence += 0.15;
  if (account) confidence += 0.15;

  return {
    amount,
    direction: isCredit ? 'credit' : 'debit',
    merchant: merchant || 'Unknown',
    date,
    account,
    raw: text,
    confidence: Math.min(1, confidence),
  };
}

/** Read a whole pasted block — several messages, one per line or paragraph. */
export function parseMessageBatch(block: string, today?: string): ParsedMessage[] {
  return block
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter((line) => line.length > 15)
    .map((line) => parseBankMessage(line, today))
    .filter((parsed): parsed is ParsedMessage => parsed !== null);
}

/** Turn a parsed message into a transaction the rest of the app understands. */
export function toTransaction(
  parsed: ParsedMessage,
  category: TransactionCategory,
  index = 0,
): Transaction {
  // The same message gets the same id every time it is pasted. This lets the
  // import layer recognise a repeat without storing the private raw message.
  let fingerprint = 2166136261;
  for (let position = 0; position < parsed.raw.length; position += 1) {
    fingerprint ^= parsed.raw.charCodeAt(position);
    fingerprint = Math.imul(fingerprint, 16777619);
  }
  return {
    id: `sms-${(fingerprint >>> 0).toString(36)}-${index}`,
    date: parsed.date,
    merchant: parsed.merchant,
    amount: parsed.amount,
    direction: parsed.direction,
    category,
    essential: ['rent', 'utilities', 'health'].includes(category),
    source: 'manual',
  };
}

/* ------------------------------------------------------------------ *
 * A NOTE ON READING MESSAGES AUTOMATICALLY
 *
 * This parser is ready for it. The reading is the hard part, and it is worth
 * being straight about why:
 *
 *   iOS      — impossible. Apps cannot read SMS at all, at any price.
 *   Android  — possible with the READ_SMS permission, but that permission is
 *              restricted on the Play Store: an app generally has to be the
 *              phone's default messaging app to qualify. Expense tracking is
 *              no longer an accepted reason, so an app asking for it is likely
 *              to be rejected at review.
 *   Expo Go  — cannot do it either way; it needs a development build with a
 *              native module.
 *
 * The realistic routes, in order of how easily they ship:
 *   1. The user pastes or shares a message into the app. No permission, works
 *      on both platforms, and uses exactly this parser.
 *   2. Reading payment NOTIFICATIONS on Android instead of SMS. A different
 *      permission with fewer store restrictions, still Android-only, still
 *      needs a development build.
 *   3. Full READ_SMS on Android, accepting the store risk.
 *
 * Whichever is chosen, the message never leaves the device.
 * ------------------------------------------------------------------ */
