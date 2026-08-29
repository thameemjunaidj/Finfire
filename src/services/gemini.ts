/**
 * gemini.ts — asking a language model, safely.
 *
 * HOW THIS FITS IN
 * The Ask tab answers most questions on the phone, from figures the app has
 * already computed. This file is for the rest: a money question phrased in a
 * way the on-device assistant did not recognise.
 *
 * WHAT LEAVES THE PHONE
 * Two things only: the question, and a short block of numbers the app already
 * worked out. Never a transaction, a merchant, a date or a name. That matters
 * because content sent on Gemini's free tier may be used by Google to improve
 * their products — so what we send is designed to be worthless if it were.
 *
 * WHY IT GOES THROUGH CONVEX
 * The API key cannot live in the app. Anyone can pull a key out of a mobile
 * bundle, and then it is your quota and your bill. Convex holds the key; the
 * phone never sees it.
 *
 * FAILURE IS NORMAL, NOT EXCEPTIONAL
 * No key, no signal, quota spent, Convex asleep — all expected. Every one of
 * them returns null and the caller falls back to the on-device answer. The app
 * must never show an error because a language model was unavailable.
 */

import { SpendingForecast, SpendingPrediction, FinancialSummary } from '../types/finance';

/**
 * Your Convex deployment's HTTP URL, ending in /ask.
 *
 * Left empty on purpose so the app works with no server at all. Fill it after
 * running `npx convex dev` — it looks like
 * https://tidy-hedgehog-123.convex.site/ask
 */
export const ASK_ENDPOINT = 'https://precise-tern-860.eu-west-1.convex.site/ask';

/** A slow answer is a broken answer on a chat screen. */
const TIMEOUT_MS = 6000;

export function isLanguageModelAvailable(): boolean {
  return ASK_ENDPOINT.length > 0;
}

/**
 * The numbers the model is allowed to use.
 *
 * Deliberately a flat list of figures with no identifying detail. Read it
 * aloud and you learn that someone, somewhere, has ₹1,300 — and nothing else.
 */
export function buildFigures(
  summary: FinancialSummary,
  forecast: SpendingForecast,
  prediction: SpendingPrediction,
): string {
  const lines = [
    `Money available now: ${Math.round(summary.disposableBalance)}`,
    `Already promised to bills in the next 7 days: ${Math.round(summary.upcomingPaymentsTotal)}`,
    `Days until money next arrives: ${prediction.horizonDays}`,
    `Chance of running short before then: ${Math.round(prediction.shortfallProbability * 100)}%`,
    `Likely still to spend this month: ${prediction.remainingSpend.p50} (between ${prediction.remainingSpend.p10} and ${prediction.remainingSpend.p90})`,
    `Currently spending per day: ${Math.round(forecast.currentDailyPace)}`,
    `Safe to spend per day: ${Math.round(forecast.safeDailyAllowance)}`,
    `Spent so far this month: ${Math.round(forecast.currentMonthSpending)}`,
    `A normal month for this person: ${Math.round(forecast.baselineMonthlySpending)}`,
    `Expected income this month: ${Math.round(forecast.expectedIncome)}`,
  ];

  const biggest = [...forecast.categories]
    .sort((a, b) => b.projectedMonthEnd - a.projectedMonthEnd)
    .slice(0, 4)
    .map((c) => `${c.category} ${Math.round(c.projectedMonthEnd)} (usual ${Math.round(c.baselineMonth)})`);
  if (biggest.length) lines.push(`Spending by type this month: ${biggest.join(', ')}`);

  const warnings = summary.alerts.slice(0, 3).map((a) => a.title);
  if (warnings.length) lines.push(`Current warnings: ${warnings.join('; ')}`);

  return lines.join('\n');
}

/**
 * Ask the model. Returns null on any problem at all — that is the contract,
 * and it is what lets the caller fall back without special cases.
 */
export async function askLanguageModel(
  question: string,
  figures: string,
): Promise<string | null> {
  if (!isLanguageModelAvailable()) return null;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ASK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, figures }),
      signal: abort.signal,
    });

    if (!response.ok) return null;
    const data = await response.json();
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    return text.length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
