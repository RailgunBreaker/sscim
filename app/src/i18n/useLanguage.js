import { useSyncExternalStore } from 'react';
import { getLanguage, setLanguage, subscribeLanguage } from './locale.js';

export function useLanguage() {
  return [useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en'), setLanguage];
}
