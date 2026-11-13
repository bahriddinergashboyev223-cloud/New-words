import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { Check, FileUp, Plus } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/seedVocabulary';
import type { AppView, WordEntry } from '../types/vocabulary';
import { parseDictionaryFile } from '../utils/fileParser';
import { normalizeWordKey, parseBulkVocabulary } from '../utils/vocabulary';

interface AddWordsViewProps {
  existingWords: WordEntry[];
  onAddSingleWord: (entry: {
    english: string;
    uzbek: string;
    category: string;
    note?: string;
    toMemorize?: boolean;
  }) => { added: boolean; reason?: string };
  onAddBulkWords: (
    entries: Array<{ english: string; uzbek: string; category: string; note?: string }>,
    toMemorize?: boolean,
  ) => { addedCount: number; skippedDuplicates: number };
  onNavigate: (view: AppView) => void;
}

export function AddWordsView({
  existingWords,
  onAddSingleWord,
  onAddBulkWords,
  onNavigate,
}: AddWordsViewProps) {
  // Single word state
  const [english, setEnglish] = useState('');
  const [uzbek, setUzbek] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [singleToMemorize, setSingleToMemorize] = useState(true);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleSuccess, setSingleSuccess] = useState<string | null>(null);
  const englishInputRef = useRef<HTMLInputElement | null>(null);

  // Bulk & file import state
  const [bulkText, setBulkText] = useState('');
  const [bulkCategory, setBulkCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [bulkToMemorize, setBulkToMemorize] = useState(true);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const existingKeys = useMemo(
    () => new Set(existingWords.map((w) => normalizeWordKey(w.english, w.uzbek))),
    [existingWords],
  );

  const parsedBulk = useMemo(
    () => parseBulkVocabulary(bulkText, bulkCategory),
    [bulkText, bulkCategory],
  );

  const newBulkCount = useMemo(
    () =>
      parsedBulk.valid.filter(
        (item) => !existingKeys.has(normalizeWordKey(item.english, item.uzbek)),
      ).length,
    [parsedBulk.valid, existingKeys],
  );

  const handleSingleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSingleError(null);
    setSingleSuccess(null);

    const trimmedEn = english.trim();
    const trimmedUz = uzbek.trim();

    if (!trimmedEn || !trimmedUz) {
      setSingleError("Iltimos, inglizcha so'z va o'zbekcha tarjimasini kiriting.");
      return;
    }

    const result = onAddSingleWord({
      english: trimmedEn,
      uzbek: trimmedUz,
      category: category.trim() || 'Kundalik',
      note: note.trim() || undefined,
      toMemorize: singleToMemorize,
    });

    if (!result.added) {
      setSingleError(result.reason ?? "Bu so'z juftligi bazada allaqachon mavjud.");
      return;
    }

    setSingleSuccess(`"${trimmedEn} — ${trimmedUz}" lug'at bazasiga qo'shildi.`);
    setEnglish('');
    setUzbek('');
    setNote('');
    englishInputRef.current?.focus();
  };

  const handleBulkSubmit = () => {
    setBulkError(null);
    setBulkFeedback(null);

    if (!bulkText.trim()) {
      setBulkError("Avval kamida bitta so'z juftligini kiriting.");
      return;
    }

    if (parsedBulk.valid.length === 0) {
      setBulkError(
        "Hech qanday to'g'ri juftlik topilmadi. Format: apple - olma yoki book : kitob",
      );
      return;
    }

    const { addedCount, skippedDuplicates } = onAddBulkWords(parsedBulk.valid, bulkToMemorize);
    setBulkText('');
    setBulkFeedback(
      `${addedCount} ta yangi so'z qo'shildi.${
        skippedDuplicates > 0 ? ` (${skippedDuplicates} ta takroriy so'z o'tkazib yuborildi.)` : ''
      }`,
    );
  };

  const processFile = async (file: File) => {
    setBulkError(null);
    setBulkFeedback(null);
    setIsParsingFile(true);

    try {
      const result = await parseDictionaryFile(file, bulkCategory);
      if (result.valid.length === 0) {
        setBulkError(
          `"${file.name}" faylidan lug'at juftliklari topilmadi. Har bir qatorda "inglizcha - o'zbekcha" ko'rinishida bo'lishi kerak.`,
        );
        return;
      }
      const { addedCount, skippedDuplicates } = onAddBulkWords(result.valid, bulkToMemorize);
      setBulkFeedback(
        `"${file.name}" faylidan ${addedCount} ta yangi so'z o'qib qo'shildi.${
          skippedDuplicates > 0 ? ` (${skippedDuplicates} ta takroriy o'tkazib yuborildi.)` : ''
        }`,
      );
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Faylni o'qishda xatolik yuz berdi.";
      setBulkError(message);
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Lug'atga so'z qo'shish
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            So'zlarni qo'lda kiriting yoki Word, Excel, PDF, RTF, TXT, CSV fayllardan yuklang.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('database')}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Bazani ko'rish ({existingWords.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Single Word Form */}
        <section
          aria-labelledby="single-add-heading"
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5"
        >
          <div>
            <h2
              id="single-add-heading"
              className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Yakka so'z qo'shish
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Inglizcha so'z va uning o'zbekcha tarjimasini yozing.
            </p>
          </div>

          <form onSubmit={handleSingleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="single-english-input"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Inglizcha so'z
              </label>
              <input
                ref={englishInputRef}
                id="single-english-input"
                type="text"
                value={english}
                onChange={(e) => setEnglish(e.target.value)}
                placeholder="Masalan: resilience"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="single-uzbek-input"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                O'zbekcha tarjima
              </label>
              <input
                id="single-uzbek-input"
                type="text"
                value={uzbek}
                onChange={(e) => setUzbek(e.target.value)}
                placeholder="Masalan: chidamlilik"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="single-category-select"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Bo'lim
              </label>
              <select
                id="single-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="single-note-input"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Misol gap yoki izoh (ixtiyoriy)
              </label>
              <input
                id="single-note-input"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Masalan: She showed great resilience."
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={singleToMemorize}
                onChange={(e) => setSingleToMemorize(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-600"
              />
              <span>Yodlash ro'yxatiga ham qo'shish</span>
            </label>

            {singleError && (
              <p
                role="alert"
                className="text-sm font-medium text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2"
              >
                {singleError}
              </p>
            )}

            {singleSuccess && (
              <p
                role="status"
                className="text-sm font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 flex items-center gap-2"
              >
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{singleSuccess}</span>
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Bazaga qo'shish</span>
            </button>
          </form>
        </section>

        {/* Right: Bulk Paste & Multi-Format File Import */}
        <section
          aria-labelledby="bulk-add-heading"
          className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2
                id="bulk-add-heading"
                className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                Fayldan yoki ro'yxatdan yuklash
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Word (.docx), Excel (.xlsx/.csv), PDF, RTF, TXT va JSON fayllarni hamda turli
                shriftlarni taniydi.
              </p>
            </div>
          </div>

          {/* Drag & Drop File Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border border-dashed p-4 transition-colors flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isDragging
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-xs text-slate-600 dark:text-slate-300 text-center sm:text-left">
              <div className="font-semibold text-slate-800 dark:text-slate-100">
                {isParsingFile
                  ? "Fayl o'qilmoqda va tahlil qilinmoqda..."
                  : 'Lug‘at faylini shu yerga tashlang yoki tanlang'}
              </div>
              <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                Qo'llab-quvvatlanadi: DOCX, XLSX, PDF, RTF, CSV, TXT, JSON (Lotin va Kirill)
              </div>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.tsv,.json,.docx,.xlsx,.xls,.rtf,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="bulk-file-upload"
              />
              <button
                type="button"
                disabled={isParsingFile}
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isParsingFile ? 'Yuklanmoqda...' : 'Fayl tanlash'}</span>
              </button>
            </div>
          </div>

          {/* Textarea Bulk Paste */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label
                htmlFor="bulk-textarea"
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Yoki matn ko'rinishida joylang (turli shriftlar avtomatik tozalanadi)
              </label>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="bulk-category-select"
                  className="text-xs text-slate-500 dark:text-slate-400"
                >
                  Bo'lim:
                </label>
                <select
                  id="bulk-category-select"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
                >
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              id="bulk-textarea"
              rows={7}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`apple - olma\n1. freedom — erkinlik\ncloud : bulut\nsuccess = muvaffaqiyat\nhonesty, halollik`}
              className="w-full p-3.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bulkToMemorize}
                onChange={(e) => setBulkToMemorize(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-600"
              />
              <span>Yuklangan so'zlarni yodlash ro'yxatiga ham qo'shish</span>
            </label>
          </div>

          {/* Live Parsed Preview */}
          {bulkText.trim().length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                  Aniqlandi: {parsedBulk.valid.length} ta juftlik · Yangi: {newBulkCount} ta
                </span>
                {parsedBulk.skippedLines.length > 0 && (
                  <span className="text-amber-700 dark:text-amber-400 font-medium tabular-nums">
                    {parsedBulk.skippedLines.length} ta qator o'tkazib yuboriladi
                  </span>
                )}
              </div>

              {parsedBulk.valid.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {parsedBulk.valid.slice(0, 8).map((item, idx) => (
                    <div
                      key={`${item.english}-${idx}`}
                      className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2"
                    >
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.english}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 truncate">
                        {item.uzbek}
                      </span>
                    </div>
                  ))}
                  {parsedBulk.valid.length > 8 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 px-2 py-1">
                      ...va yana {parsedBulk.valid.length - 8} ta juftlik
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {bulkError && (
            <p
              role="alert"
              className="text-sm font-medium text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2"
            >
              {bulkError}
            </p>
          )}

          {bulkFeedback && (
            <p
              role="status"
              className="text-sm font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 flex items-center gap-2"
            >
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{bulkFeedback}</span>
            </p>
          )}

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleBulkSubmit}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>
                Ro'yxatni bazaga qo'shish
                {newBulkCount > 0 ? ` (${newBulkCount})` : ''}
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
