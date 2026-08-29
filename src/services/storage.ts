import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistedFinanceState } from '../types/finance';

const STORAGE_KEY = '@finfire/state/v1';

export async function loadFinanceState(): Promise<PersistedFinanceState | null> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as PersistedFinanceState : null;
  } catch {
    return null;
  }
}

export async function saveFinanceState(state: PersistedFinanceState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearFinanceState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
