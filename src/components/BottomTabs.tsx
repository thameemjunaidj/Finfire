import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';

export type AppTab = 'home' | 'forecast' | 'alerts' | 'transactions' | 'simulator';

const tabs: Array<{ id: AppTab; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'forecast', label: 'Forecast', icon: 'trending-up' },
  { id: 'alerts', label: 'Alerts', icon: 'alert-triangle' },
  { id: 'transactions', label: 'Transactions', icon: 'list' },
  { id: 'simulator', label: 'What If?', icon: 'sliders' },
];

export function BottomTabs({ active, onChange, alertCount }: { active: AppTab; onChange: (tab: AppTab) => void; alertCount: number }) {
  return (
    <View style={styles.shell}>
      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              onPress={() => onChange(tab.id)}
              accessibilityRole="tab"
              accessibilityLabel={tab.id === 'alerts' && alertCount > 0 ? `${tab.label}, ${alertCount} active warnings` : tab.label}
              accessibilityState={{ selected }}
              style={styles.tab}
            >
              <View style={[styles.iconWrap, selected && styles.activeIcon]}>
                <Feather name={tab.icon} size={19} color={selected ? colors.primary : colors.textMuted} />
                {tab.id === 'alerts' && alertCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(alertCount, 9)}</Text></View> : null}
              </View>
              <Text style={[styles.label, selected && styles.activeLabel]} numberOfLines={1}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  tabs: { width: '100%', maxWidth: 640, height: 72, borderRadius: radii.xl, backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', paddingHorizontal: spacing.sm, shadowColor: colors.black, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconWrap: { width: 36, height: 30, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  activeIcon: { backgroundColor: colors.primarySoft },
  label: { color: colors.textMuted, fontSize: 9.5, fontWeight: '800' },
  activeLabel: { color: colors.primary },
  badge: { position: 'absolute', top: -3, right: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.critical, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surface },
  badgeText: { color: colors.white, fontSize: 8, fontWeight: '900' },
});
