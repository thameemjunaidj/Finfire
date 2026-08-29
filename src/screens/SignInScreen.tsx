/**
 * SignInScreen — the first thing a new user sees.
 *
 * NOTE ON WHAT THIS DOES TODAY
 * There is no account server yet, so signing in records the identifier on this
 * phone and lets the person through. It is a real screen with real validation,
 * not a picture of one, and when Convex is wired in only the middle of
 * `submit` changes — everything around it stays.
 *
 * It deliberately does NOT ask for a password. A one-time code sent to the
 * phone or email is both easier for a student and safer for us: there is no
 * password to store, leak, or reset.
 */

import React, { useState } from 'react';
import {
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

import { APP_NAME } from '../theme/brand';
import { colors, radii, spacing } from '../theme/colors';

/** Enough to catch a typo, not so strict that it rejects a real address. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Indian mobile numbers, with or without +91 and spaces. */
function looksLikePhone(value: string): boolean {
  const digits = value.replace(/[^0-9]/g, '');
  return /^(91)?[6-9][0-9]{9}$/.test(digits);
}

export function SignInScreen({ onSignedIn }: { onSignedIn: (identifier: string) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (mode: 'in' | 'up') => {
    const value = identifier.trim();

    if (!value) {
      setError('Enter your email address or phone number to continue.');
      return;
    }
    if (!looksLikeEmail(value) && !looksLikePhone(value)) {
      setError('That does not look like an email address or a mobile number.');
      return;
    }

    setError(null);
    // When Convex is added, this is where the account call goes. Everything
    // else on this screen stays exactly as it is.
    onSignedIn(value);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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

        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={(text) => { setIdentifier(text); if (error) setError(null); }}
          placeholder="Email address or phone number"
          placeholderTextColor="#8A8A8A"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="go"
          onSubmitEditing={() => submit('in')}
          accessibilityLabel="Email address or phone number"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => submit('in')}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Sign In</Text>
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.rule} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.rule} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => submit('up')}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Sign Up</Text>
        </Pressable>

        <Text style={styles.footnote}>
          Your spending stays on this phone. Signing in only saves your place.
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
    paddingVertical: spacing.xxxl,
    gap: spacing.lg,
  },

  brand: { alignItems: 'center', marginBottom: spacing.xl, gap: spacing.lg },
  logo: { width: 150, height: 150 },
  namePill: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: spacing.xl,
  },
  nameText: { color: colors.black, fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },

  input: {
    backgroundColor: '#FAF6F4',
    color: '#141414',
    fontSize: 14,
    borderRadius: radii.pill,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
  },
  error: { color: colors.primary, fontSize: 12, fontWeight: '700', paddingHorizontal: spacing.md },

  primary: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { color: colors.black, fontSize: 15, fontWeight: '900' },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },

  secondary: {
    backgroundColor: '#F2EFED',
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryText: { color: '#141414', fontSize: 15, fontWeight: '900' },

  pressed: { opacity: 0.85 },

  footnote: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 16,
  },
});
