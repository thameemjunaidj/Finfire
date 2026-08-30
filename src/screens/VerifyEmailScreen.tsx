/**
 * VerifyEmailScreen — the wait between creating an account and using it.
 *
 * WHY IT WAITS
 * The confirmation step used to have a "Continue to the app" button under it,
 * which meant nobody ever confirmed anything: the button was right there, and
 * it worked. An address nobody proves they own is not an address — it cannot
 * receive a password reset, and it cannot be trusted to be the right person's
 * data when they sign in somewhere else. So this screen holds.
 *
 * HOW IT MOVES ON BY ITSELF
 * The link opens in a browser. A browser cannot talk to the phone. Without a
 * development build there is no deep link and no push notification to close
 * that gap, so the phone asks the server every few seconds whether it has
 * happened yet, and asks immediately whenever the app comes back to the
 * foreground — which is exactly the moment someone returns from their mail app
 * after tapping the link. In practice the screen changes before they have
 * finished looking at it.
 *
 * THE ONE WAY PAST IT
 * If the server could not send the email at all — no mail key, a sender the
 * mail provider rejected — holding someone here would be locking them out of
 * an app that otherwise runs entirely on their own phone, over a letter that
 * was never posted. In that case, and only that case, there is a way through.
 */

import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFinance } from '../context/FinanceContext';
import { checkVerification, resendVerification, signOutOfAccount } from '../services/auth';
import { colors, radii, spacing } from '../theme/colors';

/** Matches the server's own limit, so the button is never lying. */
const RESEND_COOLDOWN_SECONDS = 60;
const POLL_EVERY_MS = 4000;

/**
 * How long to wait before admitting the email might never come.
 *
 * The `verificationEmailFailed` flag catches the failures the server can see —
 * no mail key, no sender address. It cannot catch the ones that happen after
 * the mail provider has already said yes: Brevo accepts the API call, queues
 * the message, and only then refuses to send it if the from-address has not
 * been verified in their dashboard. As far as this app is concerned that send
 * SUCCEEDED, and the person sits here forever waiting for a letter that was
 * destroyed on the way out.
 *
 * So after two minutes of nothing, a quiet way through appears. Not a button
 * competing with "send it again" — a line of text, below everything, that has
 * to be looked for. Anyone whose email works will have confirmed long before
 * they ever see it.
 *
 * Set this to 0 to remove the escape entirely once mail delivery is proven.
 */
const ESCAPE_AFTER_SECONDS = 120;

export function VerifyEmailScreen() {
  const {
    signedInAs,
    sessionToken,
    verificationEmailFailed,
    markVerified,
    signOut,
  } = useFinance();

  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  /** Guards against two checks overlapping on a slow connection. */
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (!sessionToken || checking.current) return;
    checking.current = true;
    const { state } = await checkVerification(sessionToken);
    checking.current = false;

    if (state === 'verified') {
      markVerified();
      return;
    }
    // The session is gone — signed out on another phone, or a password reset
    // dropped every device. Back to the sign-in screen rather than sitting
    // here forever waiting for an answer that will never change.
    if (state === 'expired') signOut();
    // 'unknown' is a network blip. Say nothing, try again on the next tick.
  }, [sessionToken, markVerified, signOut]);

  /** The steady drumbeat. */
  useEffect(() => {
    void check();
    const timer = setInterval(() => { void check(); }, POLL_EVERY_MS);
    return () => clearInterval(timer);
  }, [check]);

  /** And an immediate one the moment they come back from their mail app. */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => subscription.remove();
  }, [check]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (ESCAPE_AFTER_SECONDS <= 0) return;
    const timer = setTimeout(() => setWaitedTooLong(true), ESCAPE_AFTER_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, []);

  const sendAgain = async () => {
    if (!sessionToken || cooldown > 0) return;
    setSending(true);
    setNote(null);
    const result = await resendVerification(sessionToken);
    setSending(false);

    if (result.sent) {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNote('Sent. Check your inbox.');
    } else {
      setNote(result.error ?? 'Could not send it just now.');
    }
  };

  const useAnotherAddress = async () => {
    if (sessionToken) await signOutOfAccount(sessionToken);
    signOut();
  };

  const blocked = verificationEmailFailed === true;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.badge, blocked && styles.badgeMuted]}>
          <Feather name={blocked ? 'alert-circle' : 'mail'} size={30} color={colors.black} />
        </View>

        <Text style={styles.heading}>
          {blocked ? 'We could not send the email' : 'Confirm your email'}
        </Text>

        <Text style={styles.explain}>
          {blocked
            ? `Your account is ready, but the confirmation email to ${signedInAs} did not go out. That is our end, not yours — you can carry on and confirm later.`
            : `We sent a link to ${signedInAs}. Tap it and this screen will move on by itself — there is nothing to type back in here.`}
        </Text>

        {!blocked ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.waitingText}>Waiting for you to tap the link…</Text>
          </View>
        ) : null}

        {note ? <Text style={styles.note}>{note}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cooldown > 0 ? `Send again in ${cooldown} seconds` : 'Send the link again'}
          disabled={sending || cooldown > 0}
          onPress={() => { void sendAgain(); }}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed, (sending || cooldown > 0) && styles.disabled]}
        >
          {sending
            ? <ActivityIndicator color={colors.black} />
            : (
              <Text style={styles.primaryText}>
                {cooldown > 0 ? `Send the link again in ${cooldown}s` : 'Send the link again'}
              </Text>
            )}
        </Pressable>

        {blocked ? (
          <Pressable
            accessibilityRole="button"
            onPress={markVerified}
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
          >
            <Text style={styles.ghostText}>Carry on without confirming</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => { void useAnotherAddress(); }}
          style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
        >
          <Text style={styles.ghostText}>Use a different email</Text>
        </Pressable>

        <Text style={styles.footnote}>
          Check your spam folder if it is not there after a minute. Confirming is what keeps
          your spending tied to you and nobody else.
        </Text>

        {/* Deliberately the last, quietest thing on the screen. */}
        {waitedTooLong && !blocked ? (
          <Pressable
            accessibilityRole="button"
            onPress={markVerified}
            style={styles.escape}
          >
            <Text style={styles.escapeText}>Still nothing? Carry on without confirming</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl, gap: spacing.md,
  },

  badge: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    marginBottom: spacing.md,
  },
  badgeMuted: { backgroundColor: colors.textMuted },

  heading: { color: colors.text, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  explain: {
    color: colors.textSecondary, fontSize: 13.5, lineHeight: 20,
    textAlign: 'center', paddingHorizontal: spacing.sm,
  },

  waiting: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg, paddingVertical: spacing.md, marginVertical: spacing.sm,
  },
  waitingText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '700' },

  note: { color: colors.primary, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },

  primary: {
    backgroundColor: colors.primary, borderRadius: radii.pill,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50,
  },
  primaryText: { color: colors.black, fontSize: 15, fontWeight: '900' },

  ghost: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center', minHeight: 46,
  },
  ghostText: { color: colors.text, fontSize: 14, fontWeight: '800' },

  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },

  footnote: {
    color: colors.textMuted, fontSize: 11, textAlign: 'center',
    marginTop: spacing.sm, lineHeight: 16,
  },

  escape: { alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  escapeText: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', textDecorationLine: 'underline' },
});
