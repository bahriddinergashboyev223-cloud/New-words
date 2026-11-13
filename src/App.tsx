import { useCallback, useEffect, useMemo, useState } from 'react';
import { AddWordsView } from './components/AddWordsView';
import { DatabaseView } from './components/DatabaseView';
import { Header } from './components/Header';
import { OfflineIndicator } from './components/OfflineIndicator';
import { QuizStage } from './components/QuizStage';
import { StudyListView } from './components/StudyListView';
import { SEED_VOCABULARY } from './data/seedVocabulary';
import type { AppView, QuizDirection, QuizScope, WordEntry } from './types/vocabulary';
import {
  createWordId,
  loadQuizDirection,
  loadTheme,
  loadVocabulary,
  saveQuizDirection,
  saveTheme,
  saveVocabulary,
} from './utils/storage';
import type { ThemeMode } from './utils/storage';
import { isWordInStudyList, moveWordOrder, normalizeWordKey } from './utils/vocabulary';

export default function App() {
  const [words, setWords] = useState<WordEntry[]>(() => loadVocabulary());
  const [direction, setDirection] = useState<QuizDirection>(() => loadQuizDirection());
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [quizScope, setQuizScope] = useState<QuizScope>('all');
  const [activeView, setActiveView] = useState<AppView>('quiz');

  useEffect(() => {
    saveVocabulary(words);
  }, [words]);

  useEffect(() => {
    saveQuizDirection(direction);
  }, [direction]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#020617' : '#f8fafc');
    }
    saveTheme(theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const studyCount = useMemo(() => words.filter(isWordInStudyList).length, [words]);

  const handleRecordAnswer = useCallback((wordId: string, isCorrect: boolean) => {
    const now = Date.now();
    setWords((prev) =>
      prev.map((w) => {
        if (w.id !== wordId) return w;
        const nextCorrect = w.correctCount + (isCorrect ? 1 : 0);
        return {
          ...w,
          attemptCount: w.attemptCount + 1,
          correctCount: nextCorrect,
          lastReviewedAt: now,
        };
      }),
    );
  }, []);

  const handleAddSingleWord = useCallback(
    (entry: {
      english: string;
      uzbek: string;
      category: string;
      note?: string;
      toMemorize?: boolean;
    }) => {
      const targetKey = normalizeWordKey(entry.english, entry.uzbek);
      const duplicate = words.some((w) => normalizeWordKey(w.english, w.uzbek) === targetKey);
      if (duplicate) {
        return {
          added: false,
          reason: `"${entry.english} — ${entry.uzbek}" bazada allaqachon mavjud.`,
        };
      }

      const maxOrder = words.reduce((max, w) => Math.max(max, w.studyOrder ?? 0), 0);
      const newWord: WordEntry = {
        id: createWordId(),
        english: entry.english.trim(),
        uzbek: entry.uzbek.trim(),
        category: entry.category.trim() || 'Kundalik',
        note: entry.note?.trim() || undefined,
        correctCount: 0,
        attemptCount: 0,
        createdAt: Date.now(),
        toMemorize: entry.toMemorize ?? true,
        studyOrder: maxOrder + 1,
      };

      setWords((prev) => [newWord, ...prev]);
      return { added: true };
    },
    [words],
  );

  const handleAddBulkWords = useCallback(
    (
      entries: Array<{ english: string; uzbek: string; category: string; note?: string }>,
      toMemorize = true,
    ) => {
      const existingKeys = new Set(words.map((w) => normalizeWordKey(w.english, w.uzbek)));
      const now = Date.now();
      let nextOrder = words.reduce((max, w) => Math.max(max, w.studyOrder ?? 0), 0) + 1;
      const toAdd: WordEntry[] = [];
      let skippedDuplicates = 0;

      entries.forEach((entry, idx) => {
        const key = normalizeWordKey(entry.english, entry.uzbek);
        if (existingKeys.has(key)) {
          skippedDuplicates += 1;
          return;
        }
        existingKeys.add(key);
        toAdd.push({
          id: createWordId(),
          english: entry.english.trim(),
          uzbek: entry.uzbek.trim(),
          category: entry.category.trim() || 'Kundalik',
          note: entry.note?.trim() || undefined,
          correctCount: 0,
          attemptCount: 0,
          createdAt: now + idx,
          toMemorize,
          studyOrder: nextOrder,
        });
        nextOrder += 1;
      });

      if (toAdd.length > 0) {
        setWords((prev) => [...toAdd, ...prev]);
      }

      return { addedCount: toAdd.length, skippedDuplicates };
    },
    [words],
  );

  const handleUpdateWord = useCallback(
    (
      id: string,
      updates: { english: string; uzbek: string; category: string; note?: string },
    ) => {
      setWords((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                english: updates.english,
                uzbek: updates.uzbek,
                category: updates.category,
                note: updates.note,
              }
            : w,
        ),
      );
    },
    [],
  );

  const handleToggleMemorize = useCallback((id: string, toMemorize: boolean) => {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, toMemorize } : w)));
  }, []);

  const handleMoveStudyWord = useCallback((wordId: string, dir: 'up' | 'down') => {
    setWords((prev) => moveWordOrder(prev, wordId, dir));
  }, []);

  const handleDeleteWord = useCallback((id: string) => {
    setWords((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleRestoreDeletedWord = useCallback((word: WordEntry) => {
    setWords((prev) => {
      if (prev.some((w) => w.id === word.id)) return prev;
      return [word, ...prev];
    });
  }, []);

  const handleRestoreSeedWords = useCallback(() => {
    const existingKeys = new Set(words.map((w) => normalizeWordKey(w.english, w.uzbek)));
    let nextOrder = words.reduce((max, w) => Math.max(max, w.studyOrder ?? 0), 0) + 1;
    const missing = SEED_VOCABULARY.filter(
      (seed) => !existingKeys.has(normalizeWordKey(seed.english, seed.uzbek)),
    ).map((seed) => ({
      ...seed,
      toMemorize: true,
      studyOrder: nextOrder++,
    }));
    if (missing.length > 0) {
      setWords((prev) => [...prev, ...missing]);
    }
    return missing.length;
  }, [words]);

  const handleClearAllWords = useCallback(() => {
    setWords([]);
  }, []);

  const handleStartStudyQuiz = useCallback(() => {
    setQuizScope('study');
    setActiveView('quiz');
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-150">
      <Header
        activeView={activeView}
        onNavigate={setActiveView}
        totalWords={words.length}
        studyCount={studyCount}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeView === 'quiz' && (
          <QuizStage
            words={words}
            direction={direction}
            scope={quizScope}
            onChangeDirection={setDirection}
            onChangeScope={setQuizScope}
            onRecordAnswer={handleRecordAnswer}
            onNavigate={setActiveView}
          />
        )}

        {activeView === 'study' && (
          <StudyListView
            words={words}
            onMoveWord={handleMoveStudyWord}
            onToggleMemorize={handleToggleMemorize}
            onUpdateWord={handleUpdateWord}
            onStartStudyQuiz={handleStartStudyQuiz}
            onNavigate={setActiveView}
          />
        )}

        {activeView === 'database' && (
          <DatabaseView
            words={words}
            onAddQuickWord={handleAddSingleWord}
            onUpdateWord={handleUpdateWord}
            onToggleMemorize={handleToggleMemorize}
            onDeleteWord={handleDeleteWord}
            onRestoreDeletedWord={handleRestoreDeletedWord}
            onRestoreSeedWords={handleRestoreSeedWords}
            onClearAllWords={handleClearAllWords}
            onNavigate={setActiveView}
          />
        )}

        {activeView === 'add' && (
          <AddWordsView
            existingWords={words}
            onAddSingleWord={handleAddSingleWord}
            onAddBulkWords={handleAddBulkWords}
            onNavigate={setActiveView}
          />
        )}
      </main>
      <OfflineIndicator />
    </div>
  );
}
