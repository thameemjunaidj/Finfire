/**
 * AssistantScreen — asking questions about your own money.
 *
 * Looks like a chat because that is the shape people already understand. It
 * is not a chatbot: every answer is assembled from figures the app worked out,
 * on this phone, and it says plainly when it does not understand rather than
 * inventing something.
 */

import { Feather } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useFinance } from '../context/FinanceContext';
import { answerQuestion, STARTER_QUESTIONS } from '../engine/assistantEngine';
import { askLanguageModel, buildFigures, isLanguageModelAvailable } from '../services/gemini';
import { colors, radii, spacing } from '../theme/colors';

interface Message {
  id: string;
  from: 'you' | 'app';
  text: string;
  /** Shown in the corner of the bubble, the way a messaging app does. */
  time: string;
}

function clockTime(): string {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function AssistantScreen() {
  const { profile, summary, forecast, prediction, learned, transactions } = useFinance();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      from: 'app',
      text: `Hello ${profile.name}. Ask me anything about your money — where it goes, whether it will last, or where to cut.`,
      time: clockTime(),
    },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(STARTER_QUESTIONS);
  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollView>(null);

  const ask = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const reply = answerQuestion(trimmed, {
      profile, summary, forecast, prediction, learned, transactions,
    });

    const answerId = `app-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: `you-${Date.now()}`, from: 'you', text: trimmed, time: clockTime() },
      { id: answerId, from: 'app', text: reply.text, time: clockTime() },
    ]);
    setSuggestions(reply.suggestions);
    setDraft('');
    // Let the new bubbles lay out before scrolling to them.
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);

    /**
     * Known questions are already answered, exactly, from real figures — there
     * is nothing a language model could add. Only when the wording was not
     * recognised is it worth asking, and even then only the question and a
     * block of already-computed numbers leave the phone.
     */
    if (reply.understood || !isLanguageModelAvailable()) return;

    setMessages((current) => current.map((message) => (
      message.id === answerId ? { ...message, text: 'Thinking…' } : message
    )));

    const better = await askLanguageModel(trimmed, buildFigures(summary, forecast, prediction));

    // A null answer is normal — no key, no signal, quota gone. Put the
    // on-device reply back and say nothing about it.
    setMessages((current) => current.map((message) => (
      message.id === answerId ? { ...message, text: better ?? reply.text } : message
    )));
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
  }, [profile, summary, forecast, prediction, learned, transactions]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={12}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Ask</Text>
        <View style={styles.offlineChip}>
          <Feather name="wifi-off" size={11} color={colors.primary} />
          <Text style={styles.offlineText}>
            {isLanguageModelAvailable() ? 'Your numbers stay on this phone' : 'Answers made on this phone'}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scroller}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[styles.bubble, message.from === 'you' ? styles.fromYou : styles.fromApp]}
          >
            <Text style={message.from === 'you' ? styles.textYou : styles.textApp}>
              {message.text}
            </Text>
            <Text style={message.from === 'you' ? styles.timeYou : styles.timeApp}>{message.time}</Text>
          </View>
        ))}
      </ScrollView>

      {suggestions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              onPress={() => { void ask(suggestion); }}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipText}>{suggestion}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about your money"
          placeholderTextColor={colors.textMuted}
          returnKeyType="send"
          onSubmitEditing={() => { void ask(draft); }}
          accessibilityLabel="Ask a question about your money"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          onPress={() => { void ask(draft); }}
          style={({ pressed }) => [styles.send, pressed && { opacity: 0.8 }]}
        >
          <Feather name="arrow-up" size={18} color={colors.black} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  header: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  offlineChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    marginTop: 6, paddingVertical: 4, paddingHorizontal: 9,
    borderRadius: radii.pill, borderWidth: 1, borderColor: colors.primary,
  },
  offlineText: { color: colors.primary, fontSize: 10, fontWeight: '900' },

  thread: { flex: 1 },
  threadContent: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },

  // One squared-off corner on the sender's side, the way messaging apps do it —
  // it tells you who spoke before you read a word.
  bubble: { maxWidth: '88%', borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 9 },
  fromYou: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  fromApp: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  textYou: { color: colors.black, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  textApp: { color: colors.text, fontSize: 14, lineHeight: 21 },
  timeYou: { color: colors.black, fontSize: 9.5, fontWeight: '700', opacity: 0.65, alignSelf: 'flex-end', marginTop: 3 },
  timeApp: { color: colors.textMuted, fontSize: 9.5, alignSelf: 'flex-end', marginTop: 3 },

  chipRow: { maxHeight: 48, flexGrow: 0 },
  chipRowContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  chip: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    borderRadius: radii.pill, paddingVertical: 7, paddingHorizontal: 13,
  },
  chipPressed: { borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },

  composer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 96,
  },
  input: {
    flex: 1, color: colors.text, fontSize: 14,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.pill, paddingVertical: 11, paddingHorizontal: spacing.lg,
  },
  send: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
