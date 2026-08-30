/**
 * BackupCard — back up, restore, or delete everything held on the server.
 *
 * Two design decisions worth keeping:
 *
 *   1. Restore is two taps, not one. The first fetches the copy and reports
 *      what is in it — how many payments, how old — and only then offers to
 *      replace what is on the phone. Silently overwriting a month of work with
 *      a three-payment backup is the kind of bug people never forgive.
 *
 *   2. Delete is confirmed and says exactly what goes. "Delete my data" has to
 *      mean the row is gone from the database, not hidden, and the wording
 *      should not be vague about it.
 */

import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFinance } from '../context/FinanceContext';
import {
  BackupInfo,
  deleteBackup,
  describeWhen,
  fetchBackup,
  isBackupAvailable,
  saveBackup,
} from '../services/backup';
import { colors, radii, spacing } from '../theme/colors';
import { PersistedFinanceState } from '../types/finance';

type Busy = 'none' | 'saving' | 'loading' | 'deleting';

export function BackupCard() {
  const { signedInAs, sessionToken, snapshot, restoreState, transactions } = useFinance();

  const [busy, setBusy] = useState<Busy>('none');
  const [lastSaved, setLastSaved] = useState<number>(0);
  const [found, setFound] = useState<{ state: PersistedFinanceState; info: BackupInfo } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isBackupAvailable()) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Backup</Text>
        <Text style={styles.body}>
          Backup is not switched on for this build. Everything you enter stays on this phone,
          and will be lost if the app is removed.
        </Text>
      </View>
    );
  }

  const owner = signedInAs ?? '';
  const token = sessionToken ?? '';

  const backUpNow = async () => {
    setBusy('saving');
    setMessage(null);
    const at = await saveBackup(token, snapshot());
    setBusy('none');
    if (at) {
      setLastSaved(at);
      setMessage(`Backed up ${transactions.length} payments.`);
    } else {
      setMessage('Could not reach the backup service. Your data is safe on this phone.');
    }
  };

  const checkForBackup = async () => {
    setBusy('loading');
    setMessage(null);
    const result = await fetchBackup(token);
    setBusy('none');
    if (!result) {
      setFound(null);
      setMessage('No backup found for this account.');
      return;
    }
    setFound(result);
  };

  const applyRestore = () => {
    if (!found) return;
    Alert.alert(
      'Replace what is on this phone?',
      `The backup has ${found.info.transactionCount} payments from ${describeWhen(found.info.updatedAt)}. `
      + `This phone has ${transactions.length}. Everything here will be replaced.`,
      [
        { text: 'Keep what I have', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            restoreState(found.state);
            setFound(null);
            setMessage('Restored.');
          },
        },
      ],
    );
  };

  const removeEverything = () => {
    Alert.alert(
      'Delete your backup?',
      'This removes the copy stored for your account. It cannot be undone, and it does not touch what is on this phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy('deleting');
            const gone = await deleteBackup(token);
            setBusy('none');
            setLastSaved(0);
            setFound(null);
            setMessage(gone ? 'Your backup has been deleted.' : 'Could not reach the backup service.');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Backup</Text>
      <Text style={styles.body}>
        Optional. Keeps a copy against your account so you can get your history back if you
        change phone or reinstall. Everything still works with this switched off.
      </Text>
      <Text style={styles.account}>{owner || 'Not signed in'}</Text>

      <Pressable
        accessibilityRole="button"
        disabled={busy !== 'none'}
        onPress={backUpNow}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy !== 'none' && styles.disabled]}
      >
        {busy === 'saving'
          ? <ActivityIndicator color={colors.black} size="small" />
          : <Text style={styles.primaryText}>Back up now</Text>}
      </Pressable>
      {lastSaved > 0 ? <Text style={styles.hint}>Last backed up {describeWhen(lastSaved)}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={busy !== 'none'}
        onPress={checkForBackup}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      >
        {busy === 'loading'
          ? <ActivityIndicator color={colors.text} size="small" />
          : <Text style={styles.secondaryText}>Find my backup</Text>}
      </Pressable>

      {found ? (
        <View style={styles.foundBox}>
          <Text style={styles.foundText}>
            Found {found.info.transactionCount} payments, saved {describeWhen(found.info.updatedAt)}.
            This phone has {transactions.length}.
          </Text>
          <Pressable accessibilityRole="button" onPress={applyRestore} style={styles.restore}>
            <Text style={styles.restoreText}>Restore it</Text>
          </Pressable>
        </View>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={busy !== 'none'}
        onPress={removeEverything}
        style={({ pressed }) => [styles.danger, pressed && styles.pressed]}
      >
        <Feather name="trash-2" size={14} color={colors.primary} />
        <Text style={styles.dangerText}>Delete everything stored for me</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  body: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
  account: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: spacing.xs },

  primary: {
    backgroundColor: colors.primary, borderRadius: radii.pill,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44,
  },
  primaryText: { color: colors.black, fontSize: 14, fontWeight: '900' },

  secondary: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44,
  },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },

  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },

  hint: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  message: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },

  foundBox: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radii.md,
    padding: spacing.md, gap: spacing.sm, backgroundColor: colors.primarySoft,
  },
  foundText: { color: colors.text, fontSize: 12.5, lineHeight: 18 },
  restore: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 8, paddingHorizontal: spacing.lg },
  restoreText: { color: colors.black, fontSize: 12.5, fontWeight: '900' },

  danger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.primary, borderRadius: radii.pill,
    paddingVertical: 11, marginTop: spacing.xs,
  },
  dangerText: { color: colors.primary, fontSize: 12.5, fontWeight: '900' },
});
