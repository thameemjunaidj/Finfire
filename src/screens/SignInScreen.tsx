/**
 * SignInScreen — sign in, create an account, confirm your email.
 *
 * Three states in one screen, because they are three steps of one job and
 * bouncing between screens for it feels like being passed around:
 *
 *   in     — email and password
 *   up     — email, password, confirm password
 *   sent   — "check your inbox", with a way to send it again
 *
 * Validation happens here, before anything is sent, so nobody waits on a
 * round trip to be told their passwords do not match.
 *
 * There is no "Continue with Google". OAuth needs a redirect back into the
 * app, which needs a development build and a registered client — a button
 * here today would do nothing, and a dead control in a demo is worse than an
 * absent one.
 */

import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
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
  refreshVerification,
  resendVerification,
  signInToAccount,
} from '../services/auth';
import { APP_NAME } from '../theme/brand';
import { colors, radii, spacing } from '../theme/colors';

type Stage = 'in' | 'up' | 'sent';

export function SignInScreen({ onSignedIn }: { onSignedIn: (account: Account) => void }) {
  const [stage, setStage] = useState<Stage>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /** Held back until they either confirm or choose to carry on. */
  const [pending, setPending] = useState<Account | null>(null);
  const [emailWentOut, setEmailWentOut] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  useEffect(() => {
    if (stage !== 'sent' || !pending || pending.verified) return undefined;

    let mounted = true;
    let checking = false;

    const checkNow = async () => {
      if (checking) return;
      checking = true;
      if (mounted) setCheckingVerification(true);
      const result = await refreshVerification(pending.token);
      checking = false;
      if (!mounted) return;
      setCheckingVerification(false);
      if (result.verified) {
        setNote('Email confirmed. Opening FinFire…');
        onSignedIn({ ...pending, verified: true });
      }
    };

    // Check immediately, whenever the browser hands control back to the app,
    // and occasionally while this screen remains visible (important on web,
    // where opening the link in another tab may not change AppState).
    void checkNow();
    const appState = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void checkNow();
    });
    const timer = setInterval(() => { void checkNow(); }, 5000);

    return () => {
      mounted = false;
      appState.remove();
      clearInterval(timer);
    };
  }, [onSignedIn, pending, stage]);

  const clearError = () => { if (error) setError(null); };

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
      const result = await createAccount(address, password);
      setBusy(false);
      if (result.error || !result.account) {
        setError(result.error ?? 'Something went wrong.');
        return;
      }
      setPending(result.account);
      setEmailWentOut(result.verificationSent === true);
      setStage('sent');
      return;
    }

    const result = await signInToAccount(address, password);
    setBusy(false);
    if (result.error || !result.account) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }

    onSignedIn(result.account);
  };

  const sendAgain = async () => {
    if (!pending) return;
    setBusy(true);
    setNote(null);
    const result = await resendVerification(pending.token);
    setBusy(false);
    setNote(result.sent ? 'Sent. Check your inbox.' : (result.error ?? 'Could not send it just now.'));
  };

  const switchTo = (next: Stage) => {
    setStage(next);
    setError(null);
    setNote(null);
    setConfirm('');
  };

  /* ---- "Check your inbox" ---- */
  if (stage === 'sent' && pending) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={[styles.tick, !emailWentOut && styles.tickMuted]}>
              <Feather name={emailWentOut ? 'mail' : 'alert-circle'} size={30} color={colors.black} />
            </View>
          </View>

          <Text style={styles.heading}>
            {emailWentOut ? 'Check your inbox' : 'Account created'}
          </Text>

          <Text style={styles.explain}>
            {emailWentOut
              ? `We sent a confirmation link to ${pending.email}. Tap it to finish setting up backup.`
              : `Your account is ready, but we could not send the confirmation email. You can use everything except backup, and confirm later.`}
          </Text>

          {note ? <Text style={styles.note}>{note}</Text> : null}

          {checkingVerification ? (
            <View style={styles.checkingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.checkingText}>Checking for confirmation…</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => onSignedIn(pending)}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Continue to the app</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => { void sendAgain(); }}
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
          >
            {busy
              ? <ActivityIndicator color={colors.text} size="small" />
              : <Text style={styles.ghostText}>Send the link again</Text>}
          </Pressable>

          <Text style={styles.footnote}>
            You can start using the app straight away. Confirming only unlocks backup.
          </Text>
        </ScrollView>
      </View>
    );
  }

  /* ---- Sign in / sign up ---- */

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => { void submit(); }}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}
        >
          {busy
            ? <ActivityIndicator color={colors.black} />
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
            ? 'Your spending stays on this phone. Your account only saves your place and lets you back up.'
            : 'Accounts are not switched on in this build.'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
  tickMuted: { backgroundColor: colors.textMuted },

  heading: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  explain: {
    color: colors.textSecondary, fontSize: 13.5, lineHeight: 20,
    textAlign: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  note: { color: colors.primary, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  checkingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  checkingText: { color: colors.textSecondary, fontSize: 12 },

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

  rule: { color: colors.textMuted, fontSize: 11, paddingHorizontal: spacing.md },
  error: { color: colors.primary, fontSize: 12.5, fontWeight: '700', paddingHorizontal: spacing.md },

  primary: {
    backgroundColor: colors.primary, borderRadius: radii.pill,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50,
  },
  primaryText: { color: colors.black, fontSize: 15, fontWeight: '900' },

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
