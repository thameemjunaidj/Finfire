/**
 * ai.ts — turning a prediction into sentences.
 *
 * TWO LAYERS, ON PURPOSE
 *
 *   predictionEngine.ts  produces the numbers   (runs on the phone, always)
 *   this file            produces the words     (on-device, or a language model)
 *
 * Keeping them apart is the whole design. The model that decides "78% chance
 * of running out" never asks a language model for a number, so the app cannot
 * hallucinate someone's finances. The language model, when it is switched on,
 * only rephrases numbers that were already computed.
 *
 * That also means the demo cannot fail. With no API key and no internet — a
 * hall Wi-Fi on the day, say — `explainPrediction` writes the narrative on the
 * device and the app behaves identically. Turning the language model on
 * changes the wording, never the maths.
 *
 * STATUS: the on-device writer below is complete and is what runs today.
 * `callLanguageModel` is a deliberate stub — see the comment on it for exactly
 * what to add, and why the key must not be committed.
 */

import {
  PredictionNarrative,
  SpendingForecast,
  SpendingPrediction,
  UserProfile,
} from '../types/finance';
import { formatCurrency, formatDate } from '../utils/format';

export interface AiConfig {
  /**
   * Left empty on purpose. This repository is public, so a key committed here
   * would be scraped and billed within hours. When the language-model layer is
   * switched on, this gets filled from an environment variable at build time
   * or typed into Settings on the device — never typed into this file.
   */
  apiKey: string;
  model: string;
  endpoint: string;
}

export const AI_CONFIG: AiConfig = {
  apiKey: '',
  model: 'claude-sonnet-4-5',
  endpoint: 'https://api.anthropic.com/v1/messages',
};

export function isLanguageModelEnabled(): boolean {
  return AI_CONFIG.apiKey.length > 0;
}

/* ------------------------------------------------------------------ */
/* Layer 1 — the on-device writer (always available)                   */
/* ------------------------------------------------------------------ */

function describeChance(probability: number): string {
  if (probability >= 0.85) return 'almost certainly';
  if (probability >= 0.6) return 'more likely than not';
  if (probability >= 0.35) return 'a real chance';
  if (probability >= 0.15) return 'unlikely but possible';
  return 'very unlikely';
}

/**
 * Writes the prediction in plain words.
 *
 * The rule followed here: no jargon, no percentages without a meaning next to
 * them, and never a number on its own. "78%" tells a student nothing; "in
 * about 8 months out of 10 like this one, you run out around the 26th" is the
 * same fact in a form they can act on.
 */
export function explainOnDevice(
  prediction: SpendingPrediction,
  forecast: SpendingForecast,
  profile: UserProfile,
): PredictionNarrative {
  const chancePercent = Math.round(prediction.shortfallProbability * 100);
  const inTenMonths = Math.max(1, Math.round(prediction.shortfallProbability * 10));

  if (prediction.shortfallProbability >= 0.2 && prediction.likelyShortfallDate) {
    return {
      source: 'on-device',
      headline: `You probably run out around ${formatDate(prediction.likelyShortfallDate)}`,
      body:
        `In ${inTenMonths} months out of 10 like this one, the money runs out before your next income. `
        + `You have roughly ${formatCurrency(prediction.remainingSpend.p50)} of spending left.\n\n`
        + `Spending ${formatCurrency(forecast.safeDailyAllowance)} a day instead of ${formatCurrency(forecast.currentDailyPace)} turns it around.`,
    };
  }

  return {
    source: 'on-device',
    headline: 'You should reach your next income comfortably',
    body:
      `Running short is ${describeChance(prediction.shortfallProbability)} — it happened in only ${chancePercent} of 100 simulated months. `
      + `You should finish with about ${formatCurrency(prediction.monthEndBalance.p50)}.\n\n`
      + `${profile.name}, ${formatCurrency(forecast.safeDailyAllowance)} a day keeps it that way.`,
  };
}

/* ------------------------------------------------------------------ */
/* Layer 2 — the language model (optional, not yet switched on)        */
/* ------------------------------------------------------------------ */

/**
 * NOT IMPLEMENTED YET — deliberately.
 *
 * When it is, this is all it does: take the numbers the simulation already
 * produced, and ask a language model to phrase them for this particular
 * person. The prompt hands over computed figures and instructs the model to
 * rephrase only — it is never asked to calculate, estimate or predict
 * anything, because a language model inventing a rupee figure about someone's
 * savings is the one failure this app cannot afford.
 *
 * To switch it on:
 *   1. Put a key in AI_CONFIG.apiKey from an environment variable or Settings.
 *      Not in this file — the repository is public.
 *   2. POST to AI_CONFIG.endpoint with the summary built below.
 *   3. Keep the try/catch in explainPrediction: on any failure the on-device
 *      narrative is used and the user notices nothing.
 */
async function callLanguageModel(summary: string): Promise<string> {
  throw new Error(`Language model not configured. Summary was: ${summary.slice(0, 40)}…`);
}

/** The facts handed to the language model. Numbers only — no raw transactions,
 *  so no merchant list or personal spending detail ever leaves the phone. */
export function buildModelSummary(
  prediction: SpendingPrediction,
  forecast: SpendingForecast,
): string {
  return [
    `Chance of running out before next income: ${Math.round(prediction.shortfallProbability * 100)}%`,
    `Most likely date of running short: ${prediction.likelyShortfallDate ?? 'none'}`,
    `Spending still to come: ${prediction.remainingSpend.p50} (range ${prediction.remainingSpend.p10}–${prediction.remainingSpend.p90})`,
    `Safe daily amount: ${forecast.safeDailyAllowance}`,
    `Current daily pace: ${forecast.currentDailyPace}`,
    `Projected savings: ${forecast.projectedSavings} against a target of ${forecast.savingsTarget}`,
  ].join('\n');
}

/**
 * The function the app calls. Uses the language model when one is configured,
 * and the on-device writer otherwise — including whenever the network fails.
 */
export async function explainPrediction(
  prediction: SpendingPrediction,
  forecast: SpendingForecast,
  profile: UserProfile,
): Promise<PredictionNarrative> {
  const fallback = explainOnDevice(prediction, forecast, profile);
  if (!isLanguageModelEnabled()) return fallback;

  try {
    const body = await callLanguageModel(buildModelSummary(prediction, forecast));
    return { headline: fallback.headline, body, source: 'language-model' };
  } catch {
    // Never surface this. The on-device narrative says the same thing.
    return fallback;
  }
}
