/**
 * assistantEngine.ts — answering questions about your own money, offline.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 * This is not a language model. It cannot chat about the weather, and it will
 * say so. What it does is recognise which of a dozen money questions you are
 * asking, then answer it from figures the app has already worked out — your
 * forecast, your warnings, your categories, the model trained on your days.
 *
 * That is a deliberate trade, and the honest one for this app. A language
 * model would need your spending sent to a server, which is the one thing this
 * app promises never to do. And it would be able to invent a number, which is
 * the one mistake a money app cannot afford. Every figure below is looked up,
 * never generated.
 *
 * If a key is ever added in services/ai.ts, the same answers can be reworded
 * by a language model — the numbers would still come from here.
 */

import {
  FinancialSummary,
  LearnedModel,
  RecurringPayment,
  SpendingForecast,
  SpendingPrediction,
  Transaction,
  TransactionCategory,
  UserProfile,
} from '../types/finance';
import { formatCurrency } from '../utils/format';
import { simulatePurchase } from './financeEngine';
import { toIsoDate } from '../utils/dates';

export interface AssistantContext {
  profile: UserProfile;
  summary: FinancialSummary;
  forecast: SpendingForecast;
  prediction: SpendingPrediction;
  learned: LearnedModel;
  transactions: Transaction[];
  recurringPayments: RecurringPayment[];
}

export interface AssistantReply {
  text: string;
  /** Follow-up questions offered as buttons, so nobody has to guess what to type. */
  suggestions: string[];
  /** False when the question was not recognised. The screen uses this to decide
   *  whether it is worth asking a language model — the known questions are
   *  answered better here, with exact figures. */
  understood: boolean;
}

/** The questions the app opens with. */
export const STARTER_QUESTIONS = [
  'Why did my risk increase?',
  'Can I safely spend ₹800 today?',
  'What is hurting my budget most?',
  'How much can I spend per day until my next allowance?',
];

/* ------------------------------------------------------------------ */
/* Working out what was asked                                          */
/* ------------------------------------------------------------------ */

type Intent =
  | 'save' | 'breakdown' | 'lasting' | 'unusual' | 'subscriptions'
  | 'afford' | 'learned' | 'biggest' | 'daily_limit' | 'help' | 'unknown';

const PATTERNS: Array<[Intent, RegExp]> = [
  ['save', /\b(save|saving|cut|reduce|less|spend less|budget|tips?|advice)\b/i],
  ['afford', /\b(afford|should i (buy|get)|can i (buy|spend|get)|worth it)\b/i],
  ['daily_limit', /\b(how much|daily|per day|each day)\b.*\b(spend|allowance|limit|safe)\b|\b(spend|allowance|limit|safe)\b.*\b(per day|each day|daily)\b/i],
  ['lasting', /\b(last|run out|survive|manage|enough|until|payday|end of (the )?month)\b/i],
  ['breakdown', /\b(where|what (did|do) i spend|going|gone|breakdown|categor|most)\b/i],
  ['unusual', /\b(unusual|odd|strange|weird|wrong|suspicious|check|warning|alert|problem|risk|increase)\b/i],
  ['subscriptions', /\b(subscription|netflix|spotify|recurring|bill|recharge|due|upcoming)\b/i],
  ['learned', /\b(learn|notice|pattern|habit|about me|know about)\b/i],
  ['biggest', /\b(biggest|largest|highest|most expensive|top)\b/i],
  ['help', /\b(help|what can you|how do you|who are you|explain yourself)\b/i],
];

function readIntent(question: string): Intent {
  for (const [intent, pattern] of PATTERNS) {
    if (pattern.test(question)) return intent;
  }
  return 'unknown';
}

/** Pull a rupee figure out of "can I afford a ₹1,200 pair of shoes". */
function readAmount(question: string): number | null {
  const match = question.match(/(?:rs\.?|inr|₹)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/* ------------------------------------------------------------------ */
/* The answers                                                         */
/* ------------------------------------------------------------------ */

function spendByCategory(transactions: Transaction[], since: string): Array<[TransactionCategory, number]> {
  const totals = new Map<TransactionCategory, number>();
  transactions
    .filter((t) => t.direction === 'debit' && t.source !== 'simulation' && t.date >= since)
    .forEach((t) => totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount));
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function buildReply(question: string, context: AssistantContext): Omit<AssistantReply, 'understood'> {
  const { summary, forecast, learned, transactions, recurringPayments, profile } = context;
  const intent = readIntent(question);

  // Nothing recorded yet. Answering anything else would be making it up.
  if (transactions.length === 0 && intent !== 'help') {
    return {
      text: 'I have nothing to go on yet. Add your spending on the Spending tab — even a few days is enough for me to start answering properly.',
      suggestions: ['What can you do?'],
    };
  }
  const monthStart = `${(profile.analysisDate ?? '').slice(0, 7)}-01`;

  switch (intent) {
    /* ---- Where can I save? ---- */
    case 'save': {
      if (!forecast.actions.length) {
        return {
          text: `Nothing obvious to cut — every category is inside its normal range for you. Holding your spending near ${formatCurrency(forecast.safeDailyAllowance)} a day keeps it that way.`,
          suggestions: ['Where is my money going?', 'Will my money last?'],
        };
      }
      const lines = forecast.actions
        .filter((action) => action.monthlySaving > 0)
        .slice(0, 2)
        .map((action) => `• ${action.title}\n  ${action.detail}`);

      return {
        text: `The two changes that would help most:\n\n${lines.join('\n\n')}`,
        suggestions: ['Where is my money going?', 'Is anything unusual?', 'What have you noticed about me?'],
      };
    }

    /* ---- Where is my money going? ---- */
    case 'breakdown':
    case 'biggest': {
      const totals = spendByCategory(transactions, monthStart);
      if (!totals.length) {
        return { text: 'There is no spending recorded this month yet.', suggestions: STARTER_QUESTIONS };
      }
      const overall = totals.reduce((sum, [, amount]) => sum + amount, 0);
      const top = totals.slice(0, 4)
        .map(([category, amount]) => `• ${category} — ${formatCurrency(amount)} (${Math.round((amount / overall) * 100)}%)`)
        .join('\n');

      return {
        text: `You have spent ${formatCurrency(overall)} this month:\n\n${top}\n\nMost of it is ${totals[0][0]}.`,
        suggestions: ['Where can I save money?', 'Is anything unusual?'],
      };
    }

    /* ---- Will my money last? ---- */
    case 'lasting': {
      const result = summary.expectedToLastUntilIncome
        ? 'Your money is expected to last until your next income.'
        : summary.expectedToLastUntilIncome === false
          ? `At your current pace, your money may run short ${summary.shortfallDays} ${summary.shortfallDays === 1 ? 'day' : 'days'} early.`
          : 'I need a few days of spending before I can answer honestly.';
      return {
        text: `${result}\n\nYou have ${formatCurrency(summary.disposableBalance)} available, with ${formatCurrency(summary.protectedBalance)} left after essential payments. `
          + `Try to keep optional spending near ${formatCurrency(summary.safeDailySpending)} a day.`,
        suggestions: ['Where can I save money?', 'What bills are coming?'],
      };
    }

    case 'daily_limit':
      return {
        text: `You can spend about ${formatCurrency(summary.safeDailySpending)} a day until your next allowance. That keeps essential payments protected and spreads the remaining money across the next ${summary.daysUntilNextIncome} days.`,
        suggestions: ['Can I safely spend ₹800 today?', 'Why did my risk increase?'],
      };

    /* ---- Is anything unusual? ---- */
    case 'unusual': {
      if (!summary.alerts.length) {
        return { text: 'Nothing looks unusual right now. No sudden spending, no bill out of line, and nothing stacking up.', suggestions: STARTER_QUESTIONS };
      }
      const top = summary.alerts.slice(0, 3)
        .map((alert) => `• ${alert.title}\n  ${alert.message}`)
        .join('\n\n');
      return {
        text: `${summary.alerts.length} ${summary.alerts.length === 1 ? 'thing' : 'things'} caught my eye:\n\n${top}`,
        suggestions: ['Where can I save money?', 'What bills are coming?'],
      };
    }

    /* ---- What is coming out? ---- */
    case 'subscriptions': {
      const rises = summary.alerts.filter((a) => a.type === 'subscription_increase' || a.type === 'bill_anomaly');
      const head = `${summary.upcomingPaymentsCount} ${summary.upcomingPaymentsCount === 1 ? 'payment leaves' : 'payments leave'} your account in the next seven days, totalling ${formatCurrency(summary.upcomingPaymentsTotal)}.`;
      const risen = rises.length
        ? `\n\nOne has gone up: ${rises[0].title.toLowerCase()} — ${rises[0].evidence}.`
        : '';
      return {
        text: head + risen,
        suggestions: ['Will my money last?', 'Where can I save money?'],
      };
    }

    /* ---- Can I afford this? ---- */
    case 'afford': {
      const amount = readAmount(question);
      if (!amount) {
        return {
          text: `Tell me the amount — try "can I afford ₹500" — and I will tell you what it does to the rest of your month. You can also test it properly on the Try It tab.`,
          suggestions: ['Can I afford ₹500?', 'Will my money last?'],
        };
      }
      const simulation = simulatePurchase(
        { profile, transactions, recurringPayments },
        { description: 'Purchase', amount, category: 'shopping', proposedDate: profile.analysisDate ?? toIsoDate(new Date()) },
      );
      const verdict = simulation.decision === 'not_recommended'
        ? `Not recommended. ${simulation.explanation}`
        : simulation.decision === 'caution'
          ? `Be careful. ${simulation.explanation}`
          : `It looks affordable. ${simulation.explanation}`;

      return {
        text: `${formatCurrency(amount)}: ${verdict}`,
        suggestions: ['Will my money last?', 'Where can I save money?'],
      };
    }

    /* ---- What have you noticed? ---- */
    case 'learned': {
      if (!learned.trained || !learned.patterns.length) {
        return {
          text: `Not enough yet. I have ${learned.daysTrainedOn} days to go on, and I need a few weeks before I trust a pattern enough to tell you about it.`,
          suggestions: STARTER_QUESTIONS,
        };
      }
      const found = learned.patterns.map((p) => `• ${p.title}\n  ${p.detail}`).join('\n\n');
      return {
        text: `From your last ${learned.daysTrainedOn} days:\n\n${found}\n\nAll of that was worked out on this phone.`,
        suggestions: ['Where can I save money?', 'Will my money last?'],
      };
    }

    /* ---- What are you? ---- */
    case 'help':
      return {
        text: 'I can answer questions about your own money — where it goes, whether it will last, what is unusual, what is due, and where to cut.\n\n'
          + 'I work entirely on this phone. Nothing you ask, and nothing about your spending, is sent anywhere.',
        suggestions: STARTER_QUESTIONS,
      };

    /* ---- Not understood. Say so. ---- */
    default:
      return {
        text: `I did not follow that one. I only know about your money — I cannot help with anything else.\n\nTry one of these:`,
        suggestions: STARTER_QUESTIONS,
      };
  }
}

/**
 * The function the screen calls.
 *
 * Known money questions are answered here and nowhere else: the figures are
 * exact and the answer is instant. Only when the wording is not recognised is
 * it worth sending the question elsewhere — and even then, only the question
 * and a block of already-computed numbers travel.
 */
export function answerQuestion(question: string, context: AssistantContext): AssistantReply {
  const understood = readIntent(question) !== 'unknown';
  return { ...buildReply(question, context), understood };
}
