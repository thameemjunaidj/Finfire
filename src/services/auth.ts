/**
 * auth.ts — signing up, signing in, and staying signed in.
 *
 * The phone holds a session token, never a password. The token is what proves
 * who you are to the backup endpoints, which is why those stopped trusting a
 * plain email address.
 *
 * Offline is not an error here. If the server cannot be reached, the app says
 * so and lets the person carry on with what is already on the phone — locking
 * someone out of their own spending because a server is down would be a worse
 * failure than the one being prevented.
 */

import { BACKUP_BASE_URL } from './backup';

export interface Account {
  email: string;
  token: string;
  /** False until they tap the link in their email. */
  verified: boolean;
}

export interface AuthResult {
  account?: Account;
  /** Something to show the person. Never a raw server error. */
  error?: string;
  /** Whether the confirmation email actually went out. */
  verificationSent?: boolean;
}

const TIMEOUT_MS = 15000;

export function isAuthAvailable(): boolean {
  return BACKUP_BASE_URL.length > 0;
}

async function call(path: string, body: unknown): Promise<any | null> {
  if (!isAuthAvailable()) return null;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BACKUP_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Enough to catch a typo without rejecting anyone's real address. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Said in the app before anything is sent, so nobody waits to be told. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[0-9]/.test(password)) return 'Include at least one number.';
  return null;
}

export async function createAccount(email: string, password: string): Promise<AuthResult> {
  const result = await call('/auth/signup', { email, password });
  if (!result) return { error: 'Could not reach the server. Check your connection and try again.' };
  if (result.error) return { error: String(result.error) };
  if (!result.token) return { error: 'Something went wrong creating your account.' };
  return {
    account: { email: String(result.email), token: String(result.token), verified: false },
    verificationSent: result.verificationSent === true,
  };
}

export async function signInToAccount(email: string, password: string): Promise<AuthResult> {
  const result = await call('/auth/signin', { email, password });
  if (!result) return { error: 'Could not reach the server. Check your connection and try again.' };
  if (result.error) return { error: String(result.error) };
  if (!result.token) return { error: 'Email or password is not right.' };
  return {
    account: {
      email: String(result.email),
      token: String(result.token),
      verified: result.verified === true,
    },
  };
}

/** Best effort — the device forgets the token regardless. */
export async function signOutOfAccount(token: string): Promise<void> {
  await call('/auth/signout', { token });
}


/** Ask for another confirmation link. */
export async function resendVerification(token: string): Promise<{ sent: boolean; error?: string }> {
  const result = await call('/auth/resend', { token });
  if (!result) return { sent: false, error: 'Could not reach the server.' };
  if (result.error) return { sent: false, error: String(result.error) };
  return { sent: result.sent === true };
}

/**
 * Has this account been confirmed yet?
 *
 * Asked on a timer while the person is sitting on the "check your inbox"
 * screen. The link opens in a browser, and a browser has no way to tell the
 * phone anything, so the phone has to keep asking.
 *
 * Three answers, all of which matter:
 *   { verified: true  } — done, let them in
 *   { verified: false } — keep waiting
 *   { expired: true }   — the session is gone; send them back to sign in
 *
 * A network failure returns `unknown`, which means "ask again later" and NOT
 * "signed out" — a lift with no signal must not eject anyone from the app.
 */
export async function checkVerification(
  token: string,
): Promise<{ state: 'verified' | 'waiting' | 'expired' | 'unknown' }> {
  const result = await call('/auth/status', { token });
  if (!result || result.error) return { state: 'unknown' };
  if (result.expired) return { state: 'expired' };
  return { state: result.verified === true ? 'verified' : 'waiting' };
}

/**
 * Start a password reset.
 *
 * Always reports success, even for an address with no account. The server
 * deliberately answers the same way in both cases — otherwise this screen
 * becomes a tool for checking whether a given person has an account here.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
  const result = await call('/auth/forgot', { email });
  if (!result) return { ok: false, error: 'Could not reach the server. Check your connection.' };
  if (result.error) return { ok: false, error: String(result.error) };
  return { ok: true };
}
