import { SEED_VOCABULARY } from '../data/seedVocabulary';
import type { QuizDirection, WordEntry } from '../types/vocabulary';
import { isWordMastered } from './vocabulary';

const WORDS_STORAGE_KEY = 'lugatlab_words_v1';
const DIRECTION_STORAGE_KEY = 'lugatlab_direction_v1';
const THEME_STORAGE_KEY = 'lugatlab_theme_v1';

export type ThemeMode = 'light' | 'dark';

export function createWordId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `word-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function hydrateWordEntry(item: WordEntry, idx: number): WordEntry {
  return {
    ...item,
    toMemorize: typeof item.toMemorize === 'boolean' ? item.toMemorize : !isWordMastered(item),
    studyOrder: typeof item.studyOrder === 'number' ? item.studyOrder : idx + 1,
  };
}

export function loadVocabulary(): WordEntry[] {
  try {
    const raw = window.localStorage.getItem(WORDS_STORAGE_KEY);
    if (raw === null) {
      const seeded = SEED_VOCABULARY.map((w, idx) => hydrateWordEntry(w, idx));
      window.localStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return SEED_VOCABULARY.map((w, idx) => hydrateWordEntry(w, idx));
    }
    return parsed
      .filter(
        (item): item is WordEntry =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.id === 'string' &&
          typeof item.english === 'string' &&
          typeof item.uzbek === 'string',
      )
      .map((w, idx) => hydrateWordEntry(w, idx));
  } catch {
    return SEED_VOCABULARY.map((w, idx) => hydrateWordEntry(w, idx));
  }
}

export function saveVocabulary(words: WordEntry[]): void {
  try {
    window.localStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(words));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function loadQuizDirection(): QuizDirection {
  try {
    const raw = window.localStorage.getItem(DIRECTION_STORAGE_KEY);
    if (raw === 'en-to-uz' || raw === 'uz-to-en' || raw === 'mixed') {
      return raw;
    }
  } catch {
    // Ignore
  }
  return 'en-to-uz';
}

export function saveQuizDirection(direction: QuizDirection): void {
  try {
    window.localStorage.setItem(DIRECTION_STORAGE_KEY, direction);
  } catch {
    // Ignore
  }
}

export function loadTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  } catch {
    // Ignore
  }
  return 'light';
}

export function saveTheme(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore
  }
}
