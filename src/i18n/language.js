import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from './index';
import { useStore } from '../store/useStore';

const LANGUAGE_KEY = 'saveme_language';
const SUPPORTED = ['fr', 'en', 'es', 'ht'];

export async function changeAppLanguage(code) {
  if (!SUPPORTED.includes(code)) return;
  await i18n.changeLanguage(code);
  useStore.getState().setLanguage(code);
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
}

export async function restoreAppLanguage() {
  const code = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (SUPPORTED.includes(code)) {
    await i18n.changeLanguage(code);
    useStore.getState().setLanguage(code);
  }
}
