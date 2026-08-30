/**
 * DatePickerField — pick a date from a calendar instead of typing one.
 *
 * WHY THIS IS HAND-BUILT
 * The obvious move is @react-native-community/datetimepicker. This is a
 * calendar written from scratch instead, for three reasons: it adds no package
 * to install, it looks like the rest of the app rather than like Android, and
 * it can grey out the future — which matters here, because a payment you have
 * already made cannot have happened tomorrow.
 *
 * Typing dates was the actual problem. "18/08/2026" and "2026-08-18" and
 * "18-8-26" are the same day to a person and three different failures to a
 * text field, and getting it wrong silently files a payment in the wrong month.
 */

import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme/colors';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** '2026-08-18' → 'Tue 18 Aug 2026' */
export function describeDate(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return 'Pick a date';
  const date = new Date(year, month - 1, day);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  return `${weekday} ${day} ${MONTHS[month - 1].slice(0, 3)} ${year}`;
}

/** Monday-first grid, with leading blanks so the columns line up. */
function buildGrid(year: number, month: number): Array<number | null> {
  const first = new Date(year, month, 1);
  // getDay() is Sunday-first; shift so Monday starts the week, as in India.
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<number | null> = new Array(leading).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface Props {
  label: string;
  /** 'YYYY-MM-DD' */
  value: string;
  onChange: (value: string) => void;
  /** Nothing after this can be chosen. Defaults to today, because a payment
   *  already made cannot have happened tomorrow. */
  latest?: string;
  /** Nothing before this can be chosen. Used for dates that must be ahead —
   *  when your next money arrives cannot be last week. */
  earliest?: string;
}

export function DatePickerField({ label, value, onChange, latest, earliest }: Props) {
  const [open, setOpen] = useState(false);

  const selected = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : toKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const [viewYear, setViewYear] = useState(Number(selected.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(selected.slice(5, 7)) - 1);

  const today = new Date();
  const maximum = latest ?? toKey(today.getFullYear(), today.getMonth(), today.getDate());
  const minimum = earliest ?? '0000-01-01';

  const step = (by: number) => {
    const next = new Date(viewYear, viewMonth + by, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const choose = (day: number) => {
    const key = toKey(viewYear, viewMonth, day);
    if (key > maximum || key < minimum) return;
    onChange(key);
    setOpen(false);
  };

  const cells = buildGrid(viewYear, viewMonth);
  // Do not page into months where every day is unselectable, in either direction.
  const canGoForward = `${viewYear}-${pad(viewMonth + 1)}` < maximum.slice(0, 7);
  const canGoBack = `${viewYear}-${pad(viewMonth + 1)}` > minimum.slice(0, 7);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. Currently ${describeDate(selected)}. Opens a calendar.`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={styles.triggerText}>{describeDate(selected)}</Text>
        <Feather name="calendar" size={16} color={colors.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                disabled={!canGoBack}
                onPress={() => step(-1)}
                style={[styles.stepper, !canGoBack && styles.stepperOff]}
              >
                <Feather name="chevron-left" size={18} color={canGoBack ? colors.text : colors.textMuted} />
              </Pressable>

              <Text style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                disabled={!canGoForward}
                onPress={() => step(1)}
                style={[styles.stepper, !canGoForward && styles.stepperOff]}
              >
                <Feather name="chevron-right" size={18} color={canGoForward ? colors.text : colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.weekdays}>
              {WEEKDAYS.map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, index) => {
                if (day === null) return <View key={`blank-${index}`} style={styles.cell} />;

                const key = toKey(viewYear, viewMonth, day);
                const isSelected = key === selected;
                const isFuture = key > maximum || key < minimum;

                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={describeDate(key)}
                    accessibilityState={{ selected: isSelected, disabled: isFuture }}
                    disabled={isFuture}
                    onPress={() => choose(day)}
                    style={[styles.cell, isSelected && styles.cellSelected]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        isSelected && styles.cellTextSelected,
                        isFuture && styles.cellTextOff,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());
                const within = todayKey > maximum ? maximum : todayKey < minimum ? minimum : todayKey;
                onChange(within);
                setOpen(false);
              }}
              style={styles.todayRow}
            >
              <Text style={styles.todayText}>Today</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },

  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingVertical: 13, paddingHorizontal: spacing.lg,
  },
  triggerText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pressed: { borderColor: colors.primary },

  backdrop: { flex: 1, backgroundColor: '#000000C0', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheet: {
    width: '100%', maxWidth: 360,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md,
  },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  stepperOff: { opacity: 0.4 },
  monthLabel: { color: colors.text, fontSize: 15, fontWeight: '900' },

  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 11, fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center', borderRadius: radii.md,
  },
  cellSelected: { backgroundColor: colors.primary },
  cellText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cellTextSelected: { color: colors.black, fontWeight: '900' },
  cellTextOff: { color: colors.textMuted, opacity: 0.45 },

  todayRow: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: spacing.xl, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  todayText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
});
