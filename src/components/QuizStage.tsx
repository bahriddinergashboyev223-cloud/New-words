import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, RotateCcw, SkipForward, Volume2, X } from 'lucide-react';
import type {
  AppView,
  QuizDirection,
  QuizOption,
  QuizQuestion,
  QuizScope,
  SessionHistoryItem,
  WordEntry,
} from '../types/vocabulary';
import {
  generateQuizQuestion,
  getAccuracyPercent,
  isWordInStudyList,
  isWordMastered,
} from '../utils/vocabulary';

interface QuizStageProps {
  words: WordEntry[];
  direction: QuizDirection;
  scope: QuizScope;
  onChangeDirection: (dir: QuizDirection) => void;
  onChangeScope: (scope: QuizScope) => void;
  onRecordAnswer: (wordId: string, isCorrect: boolean) => void;
  onNavigate: (view: AppView) => void;
}

const OPTION_KEYS = ['1', '2', '3', '4'] as const;

export function QuizStage({
  words,
  direction,
  scope,
  onChangeDirection,
  onChangeScope,
  onRecordAnswer,
  onNavigate,
}: QuizStageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lastWordId, setLastWordId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuizQuestion | null>(() =>
    generateQuizQuestion(words, direction, { category: 'all', scope }),
  );
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState({
    answered: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
  });
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const w of words) {
      if (w.category.trim()) set.add(w.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [words]);

  const masteredCount = useMemo(() => words.filter(isWordMastered).length, [words]);
  const studyCount = useMemo(() => words.filter(isWordInStudyList).length, [words]);

  const loadNextQuestion = useCallback(
    (overrideDirection?: QuizDirection, overrideCategory?: string, overrideScope?: QuizScope) => {
      const nextQ = generateQuizQuestion(words, overrideDirection ?? direction, {
        lastWordId,
        category: overrideCategory ?? selectedCategory,
        scope: overrideScope ?? scope,
      });
      setQuestion(nextQ);
      setSelectedOptionId(null);
      if (nextQ) {
        setLastWordId(nextQ.wordId);
      }
    },
    [words, direction, lastWordId, selectedCategory, scope],
  );

  useEffect(() => {
    if (words.length < 4) {
      setQuestion(null);
      setSelectedOptionId(null);
      return;
    }

    const currentWordStillExists = question && words.some((w) => w.id === question.wordId);
    if (!question || !currentWordStillExists) {
      const fresh = generateQuizQuestion(words, direction, {
        category: selectedCategory,
        scope,
      });
      setQuestion(fresh);
      setSelectedOptionId(null);
      if (fresh) setLastWordId(fresh.wordId);
    }
  }, [words, question, direction, selectedCategory, scope]);

  const handleSelectOption = useCallback(
    (option: QuizOption) => {
      if (!question || selectedOptionId !== null) return;

      setSelectedOptionId(option.id);
      onRecordAnswer(question.wordId, option.isCorrect);

      setSessionStats((prev) => {
        const nextStreak = option.isCorrect ? prev.streak + 1 : 0;
        return {
          answered: prev.answered + 1,
          correct: prev.correct + (option.isCorrect ? 1 : 0),
          streak: nextStreak,
          bestStreak: Math.max(prev.bestStreak, nextStreak),
        };
      });

      setHistory((prev) => [
        {
          id: `${question.wordId}-${Date.now()}`,
          wordId: question.wordId,
          prompt: question.prompt,
          correctAnswer: question.correctAnswer,
          selectedAnswer: option.text,
          isCorrect: option.isCorrect,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 5),
      ]);
    },
    [question, selectedOptionId, onRecordAnswer],
  );

  const speakEnglishWord = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis not supported
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (!question) return;

      if (selectedOptionId === null) {
        const index = ['1', '2', '3', '4'].indexOf(event.key);
        if (index !== -1 && question.options[index]) {
          event.preventDefault();
          handleSelectOption(question.options[index]);
        }
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        loadNextQuestion();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [question, selectedOptionId, handleSelectOption, loadNextQuestion]);

  const handleDirectionChange = (nextDir: QuizDirection) => {
    onChangeDirection(nextDir);
    loadNextQuestion(nextDir, selectedCategory, scope);
  };

  const handleCategoryChange = (nextCategory: string) => {
    setSelectedCategory(nextCategory);
    loadNextQuestion(direction, nextCategory, scope);
  };

  const handleScopeChange = (nextScope: QuizScope) => {
    onChangeScope(nextScope);
    loadNextQuestion(direction, selectedCategory, nextScope);
  };

  const handleResetSession = () => {
    setSessionStats({ answered: 0, correct: 0, streak: 0, bestStreak: 0 });
    setHistory([]);
    loadNextQuestion();
  };

  const selectedOption = question?.options.find((o) => o.id === selectedOptionId) ?? null;
  const isAnswered = selectedOption !== null;
  const accuracy = getAccuracyPercent(sessionStats.correct, sessionStats.answered);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left / Main Stage: 65% (8 cols) */}
      <section aria-label="Tasodifiy so'z testi" className="lg:col-span-8 space-y-4">
        {/* Quiz Controls Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Test yo'nalishi"
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'en-to-uz', label: 'EN → UZ' },
                { id: 'uz-to-en', label: 'UZ → EN' },
                { id: 'mixed', label: 'Aralash' },
              ] as const
            ).map((item) => {
              const active = direction === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleDirectionChange(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="sr-only" htmlFor="quiz-scope-select">
              Test manbasi
            </label>
            <select
              id="quiz-scope-select"
              value={scope}
              onChange={(e) => handleScopeChange(e.target.value as QuizScope)}
              className="text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <option value="all">Barcha so'zlar ({words.length})</option>
              <option value="study">Yodlash ro'yxati ({studyCount})</option>
              <option value="unmastered">Faqat yodlanmaganlar</option>
            </select>

            <label className="sr-only" htmlFor="quiz-category-select">
              Bo'lim tanlash
            </label>
            <select
              id="quiz-category-select"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <option value="all">Barcha bo'limlar</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Quiz Card or Insufficient Words State */}
        {!question ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-10 text-center space-y-4">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 text-balance">
              4 variantli test uchun kamida 4 ta so'z kerak
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              Hozir bazangizda {words.length} ta so'z bor. Tasodifiy 1 ta so'z va 4 ta variant
              tuzilishi uchun kamida 4 ta har xil lug'at juftligini kiriting.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('add')}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
              >
                Lug'atga so'z qo'shish
              </button>
              <button
                type="button"
                onClick={() => onNavigate('database')}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Bazani ko'rish
              </button>
            </div>
          </div>
        ) : (
          <div
            data-testid="quiz-card"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-7"
          >
            {/* Quiet 1-line metadata */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 min-w-0">
                <span className="whitespace-nowrap">
                  {question.promptLanguage === 'en'
                    ? "Inglizcha → O'zbekcha"
                    : "O'zbekcha → Inglizcha"}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{question.category}</span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden sm:inline text-slate-400 dark:text-slate-500">
                  Times New Roman
                </span>
              </div>

              {!isAnswered && (
                <button
                  type="button"
                  onClick={() => loadNextQuestion()}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 py-1 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Almashtirish</span>
                </button>
              )}
            </div>

            {/* Target Word Display in Times New Roman */}
            <div className="py-3 sm:py-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <h1
                  data-testid="quiz-prompt-word"
                  className="font-study-serif text-4xl sm:text-5xl font-bold text-slate-900 dark:text-slate-100 text-balance break-words leading-tight"
                >
                  {question.prompt}
                </h1>

                {question.promptLanguage === 'en' && (
                  <button
                    type="button"
                    onClick={() => speakEnglishWord(question.prompt)}
                    aria-label={`Talaffuzni tinglash: ${question.prompt}`}
                    className="shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    title="Talaffuzni tinglash"
                  >
                    <Volume2 className="w-5 h-5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Quyidagi 4 ta variantdan to'g'ri tarjimasini tanlang:
              </p>
            </div>

            {/* 4 Options Grid in Times New Roman */}
            <div data-testid="quiz-options" className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {question.options.map((option, index) => {
                const isSelected = selectedOptionId === option.id;
                const showCorrectState = isAnswered && option.isCorrect;
                const showWrongState = isAnswered && isSelected && !option.isCorrect;

                let cardStyle =
                  'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/30';
                if (showCorrectState) {
                  cardStyle =
                    'border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100';
                } else if (showWrongState) {
                  cardStyle =
                    'border-rose-600 dark:border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-950 dark:text-rose-100';
                } else if (isAnswered) {
                  cardStyle =
                    'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 opacity-65';
                }

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(option)}
                    className={`group text-left min-h-[64px] px-4 py-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default ${cardStyle}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 shrink-0 rounded-lg font-mono text-xs font-semibold inline-flex items-center justify-center border ${
                          showCorrectState
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : showWrongState
                              ? 'border-rose-600 bg-rose-600 text-white'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:border-blue-300 dark:group-hover:border-blue-600 group-hover:text-blue-700 dark:group-hover:text-blue-400'
                        }`}
                      >
                        {OPTION_KEYS[index]}
                      </span>
                      <span className="font-study-serif text-lg sm:text-xl font-medium leading-snug break-words">
                        {option.text}
                      </span>
                    </div>

                    {showCorrectState && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <Check className="w-4 h-4" aria-hidden="true" />
                        <span>To'g'ri</span>
                      </span>
                    )}

                    {showWrongState && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                        <X className="w-4 h-4" aria-hidden="true" />
                        <span>Noto'g'ri</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feedback & Next Action Footer */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {isAnswered ? (
                <>
                  <div className="space-y-1">
                    <p
                      data-testid="quiz-feedback"
                      className={`text-sm font-semibold ${
                        selectedOption?.isCorrect
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {selectedOption?.isCorrect ? (
                        "Barakalla! To'g'ri javob berdingiz."
                      ) : (
                        <>
                          Noto'g'ri. To'g'ri javob:{' '}
                          <span className="font-study-serif text-base font-bold">
                            {question.correctAnswer}
                          </span>
                        </>
                      )}
                    </p>
                    {question.note && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-study-serif">
                        Izoh: {question.note}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {question.answerLanguage === 'en' && (
                      <button
                        type="button"
                        onClick={() => speakEnglishWord(question.correctAnswer)}
                        aria-label={`Talaffuzni tinglash: ${question.correctAnswer}`}
                        className="px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Volume2 className="w-4 h-4" aria-hidden="true" />
                        <span>Tinglash</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => loadNextQuestion()}
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Keyingi so'z</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400">
                  <span>Tezkor tanlash uchun klaviaturada 1–4 tugmalarini bosishingiz mumkin.</span>
                  <span className="hidden sm:inline font-mono tabular-nums">
                    Baza: {words.length} ta so'z
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Right Deck: 35% (4 cols) */}
      <aside aria-label="Mashq natijalari" className="lg:col-span-4 space-y-4">
        {/* Session Stats Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Mashq ko'rsatkichlari
            </h2>
            {sessionStats.answered > 0 && (
              <button
                type="button"
                onClick={handleResetSession}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Yangilash</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden divide-x divide-y divide-slate-100 dark:divide-slate-800">
            <div className="p-3.5 bg-slate-50/40 dark:bg-slate-800/40">
              <div className="text-xs text-slate-500 dark:text-slate-400">Javoblar</div>
              <div
                data-testid="stat-answered"
                className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums"
              >
                {sessionStats.answered}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50/40 dark:bg-slate-800/40">
              <div className="text-xs text-slate-500 dark:text-slate-400">Aniqlik</div>
              <div className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {accuracy}%
              </div>
            </div>

            <div className="p-3.5 bg-slate-50/40 dark:bg-slate-800/40">
              <div className="text-xs text-slate-500 dark:text-slate-400">To'g'ri</div>
              <div className="mt-1 font-mono text-xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {sessionStats.correct}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50/40 dark:bg-slate-800/40">
              <div className="text-xs text-slate-500 dark:text-slate-400">Ketma-ketlik</div>
              <div className="mt-1 font-mono text-xl font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                {sessionStats.streak}
              </div>
            </div>
          </div>

          {/* Mastery Progress */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>Yodlangan so'zlar (3+ to'g'ri)</span>
              <span className="font-mono font-medium tabular-nums">
                {masteredCount} / {words.length}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                style={{
                  width: `${words.length > 0 ? Math.round((masteredCount / words.length) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Recent Session History */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Oxirgi javoblar
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('study')}
              className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
            >
              Yodlash ro'yxati
            </button>
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
              Hali javob berilmadi. Chap tomondagi variantlardan birini tanlang.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-study-serif text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {item.prompt}
                    </div>
                    <div className="font-study-serif text-sm text-slate-500 dark:text-slate-400 truncate">
                      {item.correctAnswer}
                      {!item.isCorrect && ` · Sizning javob: ${item.selectedAnswer}`}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      item.isCorrect
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {item.isCorrect ? "To'g'ri" : 'Xato'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
