/**
 * convex/auth.ts — accounts, passwords and sessions.
 *
 * ON HAND-ROLLING THIS
 * The right long-term answer is Convex Auth or Clerk: they handle password
 * reset, email verification, OAuth and rate limiting, and none of that is
 * work worth repeating. This exists because those need setup time this
 * project does not have today.
 *
 * So it is deliberately narrow and does the two things that actually matter:
 *
 *   1. Passwords are never stored. What is stored is a PBKDF2 hash with
 *      100,000 iterations and a random salt per account. Someone who steals
 *      the whole table still cannot sign in as anybody.
 *   2. Sessions are random 32-byte tokens, not the email. The phone keeps the
 *      token; every request proves who it is with that, which is what lets the
 *      backup endpoints stop trusting whatever email they are handed.
 *
 * What it does NOT do, and should before real users: email verification,
 * password reset, rate limiting on sign-in attempts, and OAuth.
 */

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const ITERATIONS = 100_000;

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return [...array].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** PBKDF2-SHA256. Slow on purpose: that is the whole point of it. */
async function hashPassword(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits);
}

/** Compare without leaking, through timing, how much of the hash matched. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export const signUp = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = normalise(args.email);
    if (!email.includes('@')) return { error: 'That does not look like an email address.' };
    if (args.password.length < 8) return { error: 'Use at least 8 characters for your password.' };

    const existing = await ctx.db
      .query('users').withIndex('by_email', (q) => q.eq('email', email)).unique();
    if (existing) return { error: 'There is already an account with that email. Try signing in.' };

    const salt = randomHex(16);
    const hash = await hashPassword(args.password, salt);
    const verifyToken = randomHex(24);
    await ctx.db.insert('users', {
      email, salt, hash, createdAt: Date.now(),
      verified: false, verifyToken, verifySentAt: Date.now(),
    });

    const token = randomHex(32);
    await ctx.db.insert('sessions', { token, email, createdAt: Date.now() });

    // verifyToken goes back to the HTTP layer, which is the only place that
    // can send email — mutations cannot reach the network.
    return { token, email, verifyToken, verified: false };
  },
});

export const signIn = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = normalise(args.email);
    const user = await ctx.db
      .query('users').withIndex('by_email', (q) => q.eq('email', email)).unique();

    // The same message either way, so this cannot be used to discover which
    // email addresses have accounts.
    const wrong = { error: 'Email or password is not right.' };
    if (!user) return wrong;

    const attempt = await hashPassword(args.password, user.salt);
    if (!sameSecret(attempt, user.hash)) return wrong;

    const token = randomHex(32);
    await ctx.db.insert('sessions', { token, email, createdAt: Date.now() });

    /**
     * An unverified account can still sign in.
     *
     * Blocking would be stricter, and would also mean a slow-arriving email
     * locks someone out of an app that works entirely on their own phone. The
     * app shows them a reminder instead, and backup is what waits for
     * verification — that is the part where the address actually matters.
     */
    return { token, email, verified: user.verified === true };
  },
});

/** Who a token belongs to, or null. Used by every endpoint that touches data. */
export const whoIs = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const session = await ctx.db
      .query('sessions').withIndex('by_token', (q) => q.eq('token', args.token)).unique();
    return session ? { email: session.email } : null;
  },
});

/** Sign out on this device only — other phones stay signed in. */
export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions').withIndex('by_token', (q) => q.eq('token', args.token)).unique();
    if (session) await ctx.db.delete(session._id);
    return { done: true };
  },
});


/** Mark an account verified. The token is single-use. */
export const verifyEmail = mutation({
  args: { verifyToken: v.string() },
  handler: async (ctx, args) => {
    if (!args.verifyToken) return { error: 'That link is not valid.' };

    const user = await ctx.db
      .query('users')
      .withIndex('by_verify_token', (q) => q.eq('verifyToken', args.verifyToken))
      .unique();

    if (!user) return { error: 'That link has already been used, or has expired.' };

    await ctx.db.patch(user._id, { verified: true, verifyToken: undefined });
    return { email: user.email };
  },
});

/** Issue a fresh link, for when the first email never arrived. */
export const newVerifyToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions').withIndex('by_token', (q) => q.eq('token', args.token)).unique();
    if (!session) return { error: 'Sign in again.' };

    const user = await ctx.db
      .query('users').withIndex('by_email', (q) => q.eq('email', session.email)).unique();
    if (!user) return { error: 'No such account.' };
    if (user.verified) return { error: 'That address is already verified.' };

    // One a minute is plenty, and stops the endpoint being used to send mail
    // to someone else repeatedly.
    if (user.verifySentAt && Date.now() - user.verifySentAt < 60_000) {
      return { error: 'A link was just sent. Check your inbox, then try again in a minute.' };
    }

    const verifyToken = randomHex(24);
    await ctx.db.patch(user._id, { verifyToken, verifySentAt: Date.now() });
    return { email: user.email, verifyToken };
  },
});

/** Whether this session's address has been verified. */
export const isVerified = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions').withIndex('by_token', (q) => q.eq('token', args.token)).unique();
    if (!session) return null;
    const user = await ctx.db
      .query('users').withIndex('by_email', (q) => q.eq('email', session.email)).unique();
    return { email: session.email, verified: user?.verified === true };
  },
});
