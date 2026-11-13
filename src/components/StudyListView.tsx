import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Pencil,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/seedVocabulary';
import type { AppView, StudySortOrder, WordEntry } from '../types/vocabulary';
import { orderMemorizeWords } from '../utils/vocabulary';

interface StudyListViewProps {
  words: WordEntry[];
  onMoveWord: (wordId: string, direction: 'up' | 'down') => void;
  onToggleMemorize: (wordId: string, toMemorize: boolean) => void;
  onUpdateWord: (
    id: string,
    updates: { english: string; uzbek: string; category: string; note?: string },
  ) => void;
  onStartStudyQuiz: () => void;
  onNavigate: (view: AppView) => void;
}

export function StudyListView({
  words,
  onMoveWord,
  onToggleMemorize,
  onUpdateWord,
  onStartStudyQuiz,
  onNavigate,
}: StudyListViewProps) {
  const [sortOrder, setSortOrder] = useState<StudySortOrder>('manual');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [hideTranslations, setHideTranslations] = useState<boolean>(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [lastMarkedDone, setLastMarkedDone] = useState<WordEntry | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEnglish, setEditEnglish] = useState('');
  const [editUzbek, setEditUzbek] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const orderedStudyWords = useMemo(() => {
    const ordered = orderMemorizeWords(words, sortOrder);
    if (categoryFilter === 'all') return ordered;
    return ordered.filter((w) => w.category === categoryFilter);
  }, [words, sortOrder, categoryFilter]);

  const totalStudyCount = useMemo(
    () => orderMemorizeWords(words, sortOrder).length,
    [words, sortOrder],
  );

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    for (const w of words) {
      if (w.category.trim()) set.add(w.category.trim());
    }
    return Array.from(set);
  }, [words]);

  const speakWord = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore if unsupported
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMarkDone = (word: WordEntry) => {
    onToggleMemorize(word.id, false);
    setLastMarkedDone(word);
  };

  const handleUndoDone = () => {
    if (!lastMarkedDone) return;
    onToggleMemorize(lastMarkedDone.id, true);
    setLastMarkedDone(null);
  };

  const startEditing = (word: WordEntry) => {
    setEditingId(word.id);
    setEditEnglish(word.english);
    setEditUzbek(word.uzbek);
    setEditCategory(word.category);
    setEditNote(word.note ?? '');
    setEditError(null);
  };

  const saveEdit = (id: string) => {
    const en = editEnglish.trim();
    const uz = editUzbek.trim();
    if (!en || !uz) {
      setEditError("Inglizcha so'z ham, o'zbekcha tarjima ham bo'sh bo'lmasligi kerak.");
      return;
    }
    onUpdateWord(id, {
      english: en,
      uzbek: uz,
      category: editCategory.trim() || 'Boshqa',
      note: editNote.trim() || undefined,
    });
    setEditingId(null);
    setEditError(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Yodlash ro'yxati
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 tabular-nums">
            Yodlanishi kerak bo'lgan {totalStudyCount} ta so'z · Shrift: Times New Roman
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('database')}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Bazadan tanlash
          </button>
          <button
            type="button"
            disabled={words.length < 4}
            onClick={onStartStudyQuiz}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Shu ro'yxatdan test boshlash
          </button>
        </div>
      </div>

      {/* Undo Notice */}
      {lastMarkedDone && (
        <div
          role="status"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
        >
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-study-serif font-bold text-slate-900 dark:text-slate-100 text-base">
              {lastMarkedDone.english}
            </span>{' '}
            yodlangan deb belgilandi va ro'yxatdan chiqarildi.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUndoDone}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Qaytarish</span>
            </button>
            <button
              type="button"
              onClick={() => setLastMarkedDone(null)}
              aria-label="Xabarni yopish"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Sort & Study Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="study-sort-select"
              className="text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Tartib:
            </label>
            <select
              id="study-sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as StudySortOrder)}
              className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="manual">Qo'lda tartiblash (↑ ↓)</option>
              <option value="alphabetical">Alifbo bo'yicha (A–Z)</option>
              <option value="hardest">Eng ko'p xato qilinganlar</option>
              <option value="newest">Oxirgi qo'shilganlar</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="study-category-select" className="sr-only">
              Bo'lim
            </label>
            <select
              id="study-category-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
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

        <button
          type="button"
          onClick={() => {
            setHideTranslations((prev) => !prev);
            setRevealedIds({});
          }}
          className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          {hideTranslations ? (
            <>
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tarjimalarni ko'rsatish</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tarjimalarni yashirish (tekshirish)</span>
            </>
          )}
        </button>
      </div>

      {/* Ordered List of Words to Memorize in Times New Roman */}
      {orderedStudyWords.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Yodlash ro'yxatida hozircha so'z yo'q
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Yangi so'z qo'shing yoki Lug'at bazasidan yodlamoqchi bo'lgan so'zlaringizni
            belgilang.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('add')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
            >
              Yangi so'z qo'shish
            </button>
            <button
              type="button"
              onClick={() => onNavigate('database')}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Lug'at bazasini ochish
            </button>
          </div>
        </div>
      ) : (
        <ol
          data-testid="study-word-list"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden"
        >
          {orderedStudyWords.map((word, index) => {
            const isEditing = editingId === word.id;
            const isTranslationVisible = !hideTranslations || Boolean(revealedIds[word.id]);
            const canReorder = sortOrder === 'manual' && categoryFilter === 'all';

            if (isEditing) {
              return (
                <li key={word.id} className="p-4 sm:p-5 bg-blue-50/40 dark:bg-blue-950/30 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                        Inglizcha
                      </label>
                      <input
                        type="text"
                        value={editEnglish}
                        onChange={(e) => setEditEnglish(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                        O'zbekcha
                      </label>
                      <input
                        type="text"
                        value={editUzbek}
                        onChange={(e) => setEditUzbek(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                        Bo'lim
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                        Izoh
                      </label>
                      <input
                        type="text"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                  {editError && (
                    <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-400">
                      {editError}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                      Bekor qilish
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(word.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Saqlash</span>
                    </button>
                  </div>
                </li>
              );
            }

            return (
              <li
                key={word.id}
                className="p-4 sm:px-6 sm:py-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                  <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500 tabular-nums w-7 shrink-0 pt-1 sm:pt-0">
                    {index + 1}.
                  </span>

                  <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-6 items-baseline">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        data-testid={`study-word-en-${word.id}`}
                        className="font-study-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 break-words"
                      >
                        {word.english}
                      </span>
                      <button
                        type="button"
                        onClick={() => speakWord(word.english)}
                        aria-label={`Talaffuz: ${word.english}`}
                        className="p-1 text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 rounded transition-colors shrink-0"
                      >
                        <Volume2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="min-w-0">
                      {isTranslationVisible ? (
                        <span className="font-study-serif text-lg sm:text-xl text-slate-700 dark:text-slate-200 break-words">
                          {word.uzbek}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleReveal(word.id)}
                          className="text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2.5 py-1 rounded-md transition-colors"
                        >
                          Tarjimasini ko'rish
                        </button>
                      )}
                      {word.note && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-study-serif">
                          {word.note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  <span className="text-xs text-slate-400 dark:text-slate-500 mr-2 hidden md:inline">
                    {word.category}
                  </span>

                  {canReorder && (
                    <>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => onMoveWord(word.id, 'up')}
                        aria-label={`Yuqoriga surish: ${word.english}`}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded-lg transition-colors"
                      >
                        <ArrowUp className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={index === orderedStudyWords.length - 1}
                        onClick={() => onMoveWord(word.id, 'down')}
                        aria-label={`Pastga surish: ${word.english}`}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded-lg transition-colors"
                      >
                        <ArrowDown className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => startEditing(word)}
                    aria-label={`Tahrirlash: ${word.english}`}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMarkDone(word)}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Yodladim</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
