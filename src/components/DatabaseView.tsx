import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Bookmark,
  Check,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/seedVocabulary';
import type { AppView, MasteryFilter, WordEntry } from '../types/vocabulary';
import {
  exportVocabularyToCsv,
  exportVocabularyToText,
  filterVocabulary,
  isWordInStudyList,
  isWordMastered,
} from '../utils/vocabulary';

interface DatabaseViewProps {
  words: WordEntry[];
  onAddQuickWord: (entry: {
    english: string;
    uzbek: string;
    category: string;
    toMemorize?: boolean;
  }) => { added: boolean; reason?: string };
  onUpdateWord: (
    id: string,
    updates: { english: string; uzbek: string; category: string; note?: string },
  ) => void;
  onToggleMemorize: (id: string, toMemorize: boolean) => void;
  onDeleteWord: (id: string) => void;
  onRestoreDeletedWord: (word: WordEntry) => void;
  onRestoreSeedWords: () => number;
  onClearAllWords: () => void;
  onNavigate: (view: AppView) => void;
}

export function DatabaseView({
  words,
  onAddQuickWord,
  onUpdateWord,
  onToggleMemorize,
  onDeleteWord,
  onRestoreDeletedWord,
  onRestoreSeedWords,
  onClearAllWords,
  onNavigate,
}: DatabaseViewProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>('all');

  // Quick inline add form
  const [quickEnglish, setQuickEnglish] = useState('');
  const [quickUzbek, setQuickUzbek] = useState('');
  const [quickCategory, setQuickCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEnglish, setEditEnglish] = useState('');
  const [editUzbek, setEditUzbek] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [lastDeleted, setLastDeleted] = useState<WordEntry | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    for (const w of words) {
      if (w.category.trim()) set.add(w.category.trim());
    }
    return Array.from(set);
  }, [words]);

  const filteredWords = useMemo(
    () =>
      filterVocabulary(words, {
        query,
        category: categoryFilter,
        mastery: masteryFilter,
      }),
    [words, query, categoryFilter, masteryFilter],
  );

  const masteredCount = useMemo(() => words.filter(isWordMastered).length, [words]);
  const studyCount = useMemo(() => words.filter(isWordInStudyList).length, [words]);

  const handleQuickSubmit = (e: FormEvent) => {
    e.preventDefault();
    setQuickError(null);
    const en = quickEnglish.trim();
    const uz = quickUzbek.trim();
    if (!en || !uz) {
      setQuickError("Inglizcha so'z va o'zbekcha tarjimani kiriting.");
      return;
    }
    const res = onAddQuickWord({
      english: en,
      uzbek: uz,
      category: quickCategory,
      toMemorize: true,
    });
    if (!res.added) {
      setQuickError(res.reason ?? "Bu so'z allaqachon mavjud.");
      return;
    }
    setQuickEnglish('');
    setQuickUzbek('');
    setStatusNotice(`"${en} — ${uz}" bazaga va yodlash ro'yxatiga qo'shildi.`);
  };

  const startEditing = (word: WordEntry) => {
    setEditingId(word.id);
    setEditEnglish(word.english);
    setEditUzbek(word.uzbek);
    setEditCategory(word.category);
    setEditNote(word.note ?? '');
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
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

  const handleDelete = (word: WordEntry) => {
    onDeleteWord(word.id);
    setLastDeleted(word);
    setStatusNotice(null);
  };

  const handleUndoDelete = () => {
    if (!lastDeleted) return;
    onRestoreDeletedWord(lastDeleted);
    setLastDeleted(null);
  };

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

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleExportTxt = () => {
    triggerDownload(exportVocabularyToText(words), 'lugat-baza.txt', 'text/plain;charset=utf-8');
  };

  const handleExportCsv = () => {
    triggerDownload(exportVocabularyToCsv(words), 'lugat-baza.csv', 'text/csv;charset=utf-8');
  };

  const handleRestoreSeeds = () => {
    const added = onRestoreSeedWords();
    setStatusNotice(
      added > 0
        ? `Boshlang'ich lug'atdan ${added} ta yangi so'z qo'shildi.`
        : "Boshlang'ich lug'atdagi barcha so'zlar bazada allaqachon mavjud.",
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Lug'at bazasi
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 tabular-nums">
            Jami {words.length} ta so'z · {studyCount} tasi yodlash ro'yxatida · {masteredCount} tasi
            yodlangan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportTxt}
            disabled={words.length === 0}
            className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>TXT yuklash</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={words.length === 0}
            className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>CSV yuklash</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('add')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Fayldan yuklash
          </button>
        </div>
      </div>

      {/* Quick Inline Add Bar */}
      <form
        onSubmit={handleQuickSubmit}
        noValidate
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-2.5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-4">
            <label
              htmlFor="db-quick-en"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Tezkor qo'shish (Inglizcha)
            </label>
            <input
              id="db-quick-en"
              type="text"
              value={quickEnglish}
              onChange={(e) => setQuickEnglish(e.target.value)}
              placeholder="Masalan: horizon"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="sm:col-span-4">
            <label
              htmlFor="db-quick-uz"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              O'zbekcha tarjimasi
            </label>
            <input
              id="db-quick-uz"
              type="text"
              value={quickUzbek}
              onChange={(e) => setQuickUzbek(e.target.value)}
              placeholder="Masalan: ufq"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="db-quick-cat"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Bo'lim
            </label>
            <select
              id="db-quick-cat"
              value={quickCategory}
              onChange={(e) => setQuickCategory(e.target.value)}
              className="w-full px-2.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full py-2 px-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Qo'shish</span>
            </button>
          </div>
        </div>
        {quickError && (
          <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-400">
            {quickError}
          </p>
        )}
      </form>

      {/* Undo / Status Notices */}
      {lastDeleted && (
        <div
          role="status"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
        >
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {lastDeleted.english}
            </span>{' '}
            — {lastDeleted.uzbek} o'chirildi.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUndoDelete}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Qaytarish</span>
            </button>
            <button
              type="button"
              onClick={() => setLastDeleted(null)}
              aria-label="Xabarni yopish"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {statusNotice && (
        <div
          role="status"
          className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-sm text-blue-900 dark:text-blue-100"
        >
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            aria-label="Xabarni yopish"
            className="p-1 text-blue-600 dark:text-blue-300 hover:text-blue-900 dark:hover:text-white rounded"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="db-search-input" className="sr-only">
            Lug'atdan qidirish
          </label>
          <input
            id="db-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Inglizcha, o'zbekcha yoki izoh bo'yicha qidirish..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="db-category-filter" className="sr-only">
            Bo'lim bo'yicha saralash
          </label>
          <select
            id="db-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">Barcha bo'limlar</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div
            role="group"
            aria-label="Holat bo'yicha saralash"
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto"
          >
            {(
              [
                { id: 'all', label: 'Hammasi' },
                { id: 'study', label: 'Yodlashda' },
                { id: 'learning', label: "O'rganilmoqda" },
                { id: 'mastered', label: 'Yodlangan' },
              ] as const
            ).map((item) => {
              const active = masteryFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMasteryFilter(item.id)}
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
        </div>
      </div>

      {/* Dictionary Table / List */}
      {filteredWords.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            {words.length === 0
              ? "Lug'at bazangiz hozircha bo'sh"
              : "Qidiruv bo'yicha so'z topilmadi"}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            {words.length === 0
              ? "Yuqoridagi tezkor qatordan yoki fayl yuklash orqali o'z lug'atingizni kiriting."
              : "Boshqa kalit so'z kiriting yoki filtrlarni tozalab ko'ring."}
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {words.length === 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('add')}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
                >
                  Fayldan yoki ro'yxatdan qo'shish
                </button>
                <button
                  type="button"
                  onClick={handleRestoreSeeds}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Boshlang'ich lug'atni yuklash
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategoryFilter('all');
                  setMasteryFilter('all');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Filtrlarni tozalash
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table data-testid="vocabulary-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th scope="col" className="py-3 pl-4 pr-2 w-12 tabular-nums">
                    #
                  </th>
                  <th scope="col" className="py-3 px-3">
                    Inglizcha
                  </th>
                  <th scope="col" className="py-3 px-3">
                    O'zbekcha
                  </th>
                  <th scope="col" className="py-3 px-3 hidden sm:table-cell">
                    Bo'lim
                  </th>
                  <th scope="col" className="py-3 px-3 hidden md:table-cell">
                    Yodlash
                  </th>
                  <th scope="col" className="py-3 pl-3 pr-4 text-right">
                    Amallar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredWords.map((word, index) => {
                  const isEditing = editingId === word.id;
                  const mastered = isWordMastered(word);
                  const inStudy = isWordInStudyList(word);

                  if (isEditing) {
                    return (
                      <tr key={word.id} className="bg-blue-50/40 dark:bg-blue-950/30">
                        <td className="py-3 pl-4 pr-2 font-mono text-xs text-slate-400 tabular-nums align-top pt-4">
                          {index + 1}
                        </td>
                        <td className="py-3 px-3 align-top" colSpan={4}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                                Inglizcha
                              </label>
                              <input
                                type="text"
                                value={editEnglish}
                                onChange={(e) => setEditEnglish(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                                className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                                Bo'lim
                              </label>
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                                Izoh (ixtiyoriy)
                              </label>
                              <input
                                type="text"
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                          </div>
                          {editError && (
                            <p
                              role="alert"
                              className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-400"
                            >
                              {editError}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pl-3 pr-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 pt-4">
                            <button
                              type="button"
                              onClick={() => saveEdit(word.id)}
                              aria-label={`Saqlash: ${word.english}`}
                              className="p-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                            >
                              <Check className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              aria-label="Bekor qilish"
                              className="p-2 text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={word.id}
                      onDoubleClick={() => startEditing(word)}
                      title="Tezkor tahrirlash uchun ikki marta bosing"
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 pl-4 pr-2 font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums align-top">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-3 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {word.english}
                          </span>
                          <button
                            type="button"
                            onClick={() => speakWord(word.english)}
                            aria-label={`Talaffuz: ${word.english}`}
                            className="p-1 text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 rounded transition-colors"
                          >
                            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        {word.note && (
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {word.note}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-800 dark:text-slate-200 font-medium align-top">
                        {word.uzbek}
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:hidden">
                          {word.category}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300 hidden sm:table-cell align-top">
                        {word.category}
                      </td>
                      <td className="py-3.5 px-3 hidden md:table-cell align-top">
                        <button
                          type="button"
                          onClick={() => onToggleMemorize(word.id, !inStudy)}
                          aria-label={
                            inStudy
                              ? `Yodlash ro'yxatidan olish: ${word.english}`
                              : `Yodlash ro'yxatiga qo'shish: ${word.english}`
                          }
                          className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                            inStudy
                              ? 'text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300'
                              : mastered
                                ? 'text-emerald-700 dark:text-emerald-400 hover:text-slate-900 dark:hover:text-white'
                                : 'text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400'
                          }`}
                        >
                          <Bookmark
                            className={`w-3.5 h-3.5 ${
                              inStudy ? 'fill-blue-600 dark:fill-blue-400 text-blue-600 dark:text-blue-400' : ''
                            }`}
                            aria-hidden="true"
                          />
                          <span>
                            {inStudy ? "Ro'yxatda" : mastered ? 'Yodlangan' : "Qo'shish"}
                          </span>
                        </button>
                      </td>
                      <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap align-top">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditing(word)}
                            aria-label={`Tahrirlash: ${word.english}`}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(word)}
                            aria-label={`O'chirish: ${word.english}`}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Database Maintenance Footer */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={handleRestoreSeeds}
          className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline underline-offset-4"
        >
          Boshlang'ich lug'at namunasini qo'shish
        </button>

        {words.length > 0 && (
          <div>
            {!confirmClearAll ? (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="text-rose-700 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 underline underline-offset-4"
              >
                Barcha so'zlarni tozalash (o'z lug'atimni boshlash)
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-lg">
                <span className="text-rose-900 dark:text-rose-200 font-medium">
                  Haqiqatan ham barchasini o'chirasizmi?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClearAllWords();
                    setConfirmClearAll(false);
                    setLastDeleted(null);
                  }}
                  className="px-2.5 py-1 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded"
                >
                  Ha, tozalash
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2 py-1 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
                >
                  Bekor
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
