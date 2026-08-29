import AsyncStorage from '@react-native-async-storage/async-storage';
import { sanitizePersistedState } from './financeState';
import { PersistedFinanceState } from '../types/finance';

const STORAGE_KEY = '@finfire/state/v1';

export async function loadFinanceState(): Promise<PersistedFinanceState | null> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value ? sanitizePersistedState(JSON.parse(value)) : null;
  } catch {
    return null;
  }
}

export async function saveFinanceState(state: PersistedFinanceState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A storage failure should not make the in-memory prototype unusable.
  }
}

export async function clearFinanceState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Reset the in-memory experience even if device storage is temporarily unavailable.
  }
}
