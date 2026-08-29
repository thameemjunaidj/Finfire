import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Alert, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import { scheduleRiskNotification } from '../services/notifications';
import { colors, radii, spacing } from '../theme/colors';
import { FinButton } from './FinButton';

export function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { notificationsEnabled, setNotificationsEnabled, resetDemo, eraseLocalData } = useFinance();
  const testNotification = async () => {
    const shown = await scheduleRiskNotification('🔥 FinFire is ready', 'Critical financial warnings will appear here when enabled.');
    Alert.alert(shown ? 'Notification sent' : 'Unavailable in browser', shown ? 'Check your notification centre.' : 'Test this feature on your phone with Expo Go.');
  };
  const erase = () => Alert.alert('Erase local data?', 'This removes imported and manually entered data from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Erase', style: 'destructive', onPress: () => void eraseLocalData().then(onClose) },
  ]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Settings & privacy</Text>
              <Text style={styles.subtitle}>Your prototype data stays on this device.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close}><Feather name="x" size={20} color={colors.text} /></Pressable>
          </View>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Critical notifications</Text>
              <Text style={styles.rowHelper}>Show a local warning after risky simulations.</Text>
            </View>
            <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>
          <View style={styles.privacyCard}>
            <Feather name="shield" size={22} color={colors.safe} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Offline-first by design</Text>
              <Text style={styles.rowHelper}>FinFire never asks for bank passwords, PINs, CVVs, or UPI PINs. Imported CSV data is stored locally.</Text>
            </View>
          </View>
          <FinButton label="Test notification" icon="bell" variant="secondary" onPress={() => void testNotification()} />
          <FinButton label="Restore demo data" icon="refresh-cw" variant="ghost" onPress={() => { resetDemo(); onClose(); }} style={styles.action} />
          <FinButton label="Erase local data" icon="trash-2" variant="danger" onPress={erase} style={styles.action} />
          <Text style={styles.version}>FinFire prototype · Demo and user-imported data only</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000A6', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  panel: { width: '100%', maxWidth: 540, backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  rowHelper: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4 },
  privacyCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.safeSoft, borderColor: `${colors.safe}50`, borderWidth: 1, borderRadius: radii.md, padding: spacing.lg, marginVertical: spacing.lg },
  action: { marginTop: spacing.sm },
  version: { color: colors.textMuted, textAlign: 'center', fontSize: 10, marginTop: spacing.lg },
});
