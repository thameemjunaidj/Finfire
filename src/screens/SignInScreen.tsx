/**
 * SignInScreen — sign in, create an account, recover a forgotten password.
 *
 * FOUR STATES IN ONE SCREEN, because they are four doors into one room and
 * bouncing between screens for them feels like being passed around:
 *
 *   in           — email and password
 *   up           — email, password, confirm password
 *   forgot       — the email address to send a reset link to
 *   forgot-sent  — "check your inbox", with a cooldown before asking again
 *
 * Validation happens here, before anything is sent, so nobody waits on a
 * round trip to be told their passwords do not match.
 *
 * WHAT IS NOT HERE ANY MORE
 * The "check your inbox" step after signing up used to live in this file with
 * a "Continue to the app" button under it, which made confirming optional in
 * practice. It is now its own screen (VerifyEmailScreen) sitting between this
 * one and the app, and it waits.
 *
 * There is still no "Continue with Google". OAuth needs a redirect back into
 * the app, which needs a development build and a registered client — a button
 * here today would do nothing, and a dead control in a demo is worse than an
 * absent one.
 */

import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Account,
  createAccount,
  isAuthAvailable,
  looksLikeEmail,
  passwordProblem,
  requestPasswordReset,
  signInToAccount,
} from '../services/auth';
import { fetchBackup } from '../services/backup';
import { APP_NAME } from '../theme/brand';
import { colors, radii, spacing } from '../theme/colors';
import { PersistedFinanceState } from '../types/finance';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

type Stage = 'in' | 'up' | 'forgot' | 'forgot-sent';

/** Long enough to stop someone hammering it, short enough not to feel punitive. */
const RESEND_COOLDOWN_SECONDS = 60;

interface Props {
  /**
   * `restored` is this account's own data, pulled from the server before the
   * app is handed over. It is the whole reason signing in as somebody else no
   * longer shows the previous person's spending.
   */
  onSignedIn: (
    account: Account,
    restored: PersistedFinanceState | null,
    emailFailed: boolean,
  ) => void;
}

export function SignInScreen({ onSignedIn }: Props) {
  const [stage, setStage] = useState<Stage>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const keyboard = useKeyboardHeight();

  /** One tick a second while a cooldown is running, then it stops itself. */
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const clearError = () => { if (error) setError(null); };

  const switchTo = (next: Stage) => {
    setStage(next);
    setError(null);
    setNote(null);
    setConfirm('');
  };

  /* ---- Sign in / create account ---- */

  const submit = async () => {
    const address = email.trim();

    if (!looksLikeEmail(address)) {
      setError('Enter a valid email address.');
      return;
    }
    const weak = passwordProblem(password);
    if (weak) {
      setError(weak);
      return;
    }
    if (stage === 'up' && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);

    if (stage === 'up') {
      setBusyLabel('Creating your account');
      const result = await createAccount(address, password);
      setBusy(false);
      if (result.error || !result.account) {
        setError(result.error ?? 'Something went wrong.');
        return;
      }
      // A brand-new account has nothing to restore, by definition.
      onSignedIn(result.account, null, result.verificationSent !== true);
      return;
    }

    setBusyLabel('Signing in');
    const result = await signInToAccount(address, password);
    if (result.error || !result.account) {
      setBusy(false);
      setError(result.error ?? 'Something went wrong.');
      return;
    }

    /**
     * Fetch this account's data BEFORE handing the app over.
     *
     * Doing it after would mean a second or two where the app is open,
     * signed in as the new person, still showing whatever was on the phone.
     * On a shared phone that second is the entire bug.
     */
    setBusyLabel('Getting your data');
    const backup = await fetchBackup(result.account.token);
    setBusy(false);

    onSignedIn(result.account, backup?.state ?? null, false);
  };

  /* ---- Forgotten password ---- */

  const sendResetLink = async () => {
    const address = email.trim();
    if (!looksLikeEmail(address)) {
      setError('Enter a valid email address.');
      return;
    }

    setBusy(true);
    setBusyLabel('Sending');
    setError(null);
    const result = await requestPasswordReset(address);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not send it just now.');
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setNote(null);
    setStage('forgot-sent');
  };

  const sendResetAgain = async () => {
    if (cooldown > 0) return;
    setBusy(true);
    setBusyLabel('Sending');
    setNote(null);
    const result = await requestPasswordReset(email.trim());
    setBusy(false);
    if (result.ok) {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNote('Sent again. Check your inbox.');
    } else {
      setNote(result.error ?? 'Could not send it just now.');
    }
  };

  /* ---- "We sent you a reset link" ---- */

  if (stage === 'forgot-sent') {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.tick}>
              <Feather name="mail" size={30} color={colors.black} />
            </View>
          </View>

          <Text style={styles.heading}>Check your inbox</Text>
          <Text style={styles.explain}>
            If there is an account for {email.trim()}, a link to set a new password is on its
            way. It works once, and stops working after an hour.
          </Text>

          {note ? <Text style={styles.note}>{note}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cooldown > 0 ? `Send again in ${cooldown} seconds` : 'Send the link again'}
            disabled={busy || cooldown > 0}
            onPress={() => { void sendResetAgain(); }}
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed, (busy || cooldown > 0) && styles.disabled]}
          >
            {busy
              ? <ActivityIndicator color={colors.text} size="small" />
              : (
                <Text style={styles.ghostText}>
                  {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send the link again'}
                </Text>
              )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => { setCooldown(0); switchTo('in'); }}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Back to sign in</Text>
          </Pressable>

          <Text style={styles.footnote}>
            Set your new password on the page the link opens, then come back here and sign in
            with it.
          </Text>
        </ScrollView>
      </View>
    );
  }

  /* ---- Forgot password: which address? ---- */

  if (stage === 'forgot') {
    return (
      <View style={[styles.screen, { paddingBottom: keyboard }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.tick}>
              <Feather name="key" size={28} color={colors.black} />
            </View>
          </View>

          <Text style={styles.heading}>Forgot your password?</Text>
          <Text style={styles.explain}>
            Type the address you signed up with and we will send you a link to set a new one.
          </Text>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(text) => { setEmail(text); clearError(); }}
            placeholder="Email address"
            placeholderTextColor="#8A8A8A"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel="Email address"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => { void sendResetLink(); }}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}
          >
            {busy
              ? <ActivityIndicator color={colors.black} />
              : <Text style={styles.primaryText}>Send me a link</Text>}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => switchTo('in')}
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
          >
            <Text style={styles.ghostText}>Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  /* ---- Sign in / sign up ---- */

  return (
    // The sign-in fields sit low on the screen and the keyboard covered them
    // outright on Android, where edge-to-edge stops the window being resized.
    // Shrinking the container by the keyboard's own height puts them back.
    <View style={[styles.screen, { paddingBottom: keyboard }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel={`${APP_NAME} logo`}
          />
          <View style={styles.namePill}>
            <Text style={styles.nameText}>{APP_NAME}</Text>
          </View>
        </View>

        <Text style={styles.heading}>
          {stage === 'in' ? 'Welcome back' : 'Create your account'}
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={(text) => { setEmail(text); clearError(); }}
          placeholder="Email address"
          placeholderTextColor="#8A8A8A"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          accessibilityLabel="Email address"
        />

        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={(text) => { setPassword(text); clearError(); }}
            placeholder="Password"
            placeholderTextColor="#8A8A8A"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Password"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword((current) => !current)}
            hitSlop={12}
            style={styles.eye}
          >
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#6B6B6B" />
          </Pressable>
        </View>

        {stage === 'up' ? (
          <>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={(text) => { setConfirm(text); clearError(); }}
              placeholder="Confirm password"
              placeholderTextColor="#8A8A8A"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Confirm password"
            />
            <Text style={styles.rule}>At least 8 characters, including a number.</Text>
          </>
        ) : null}

        {/* Only on the sign-in side. Offering "forgot your password" while
            somebody is inventing one for the first time is just noise. */}
        {stage === 'in' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => switchTo('forgot')}
            style={styles.forgotRow}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => { void submit(); }}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}
        >
          {busy
            ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color={colors.black} />
                {/* Signing in now does two things — checks the password, then
                    downloads the account's data — and the second is slow
                    enough that saying which one is happening stops it looking
                    stuck. */}
                <Text style={styles.busyText}>{busyLabel}</Text>
              </View>
            )
            : <Text style={styles.primaryText}>{stage === 'in' ? 'Sign In' : 'Create account'}</Text>}
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.line} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.line} />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => switchTo(stage === 'in' ? 'up' : 'in')}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>
            {stage === 'in' ? 'Sign Up' : 'I already have an account'}
          </Text>
        </Pressable>

        <Text style={styles.footnote}>
          {isAuthAvailable()
            ? 'Your spending is kept with your account, so it follows you to a new phone and nobody else who uses this one can see it.'
            : 'Accounts are not switched on in this build.'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },

  brand: { alignItems: 'center', marginBottom: spacing.md, gap: spacing.md },
  logo: { width: 130, height: 130 },
  namePill: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.xl,
  },
  nameText: { color: colors.black, fontSize: 14, fontWeight: '900' },

  tick: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  heading: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  explain: {
    color: colors.textSecondary, fontSize: 13.5, lineHeight: 20,
    textAlign: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  note: { color: colors.primary, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },

  input: {
    backgroundColor: '#FAF6F4',
    color: '#141414',
    fontSize: 14,
    borderRadius: radii.pill,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
  },

  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FAF6F4', borderRadius: radii.pill, paddingRight: spacing.lg,
  },
  passwordInput: {
    flex: 1, color: '#141414', fontSize: 14,
    paddingVertical: 15, paddingHorizontal: spacing.xl,
  },
  eye: { padding: 6 },

  forgotRow: { alignSelf: 'flex-end', paddingVertical: 2, paddingHorizontal: spacing.md },
  forgotText: { color: colors.primary, fontSize: 12.5, fontWeight: '800' },

  rule: { color: colors.textMuted, fontSize: 11, paddingHorizontal: spacing.md },
  error: { color: colors.primary, fontSize: 12.5, fontWeight: '700', paddingHorizontal: spacing.md },

  primary: {
    backgroundColor: colors.primary, borderRadius: radii.pill,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50,
  },
  primaryText: { color: colors.black, fontSize: 15, fontWeight: '900' },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  busyText: { color: colors.black, fontSize: 14, fontWeight: '800' },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: {
    color: colors.text, fontSize: 11, fontWeight: '900',
    backgroundColor: colors.surface, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 9,
  },

  secondary: {
    backgroundColor: '#F2EFED', borderRadius: radii.pill,
    paddingVertical: 15, alignItems: 'center',
  },
  secondaryText: { color: '#141414', fontSize: 15, fontWeight: '900' },

  ghost: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center', minHeight: 46,
  },
  ghostText: { color: colors.text, fontSize: 14, fontWeight: '800' },

  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },

  footnote: {
    color: colors.textMuted, fontSize: 11, textAlign: 'center',
    marginTop: spacing.md, lineHeight: 16,
  },
});
