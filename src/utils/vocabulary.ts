import type {
  BulkParseResult,
  MasteryFilter,
  QuizDirection,
  QuizOption,
  QuizQuestion,
  QuizScope,
  StudySortOrder,
  WordEntry,
} from '../types/vocabulary';
import { normalizeFontText } from './fontNormalizer';

export const MASTERED_THRESHOLD = 3;

export function normalizeWordKey(english: string, uzbek: string): string {
  const en = normalizeFontText(english).trim().toLowerCase();
  const uz = normalizeFontText(uzbek).trim().toLowerCase();
  return `${en}::${uz}`;
}

export function isWordMastered(word: WordEntry): boolean {
  return word.correctCount >= MASTERED_THRESHOLD;
}

export function isWordInStudyList(word: WordEntry): boolean {
  if (typeof word.toMemorize === 'boolean') {
    return word.toMemorize;
  }
  return !isWordMastered(word);
}

export function getAccuracyPercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

export function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function filterVocabulary(
  words: WordEntry[],
  options: {
    query?: string;
    category?: string;
    mastery?: MasteryFilter;
  } = {},
): WordEntry[] {
  const normalizedQuery = normalizeFontText(options.query ?? '').trim().toLowerCase();
  const category = options.category ?? 'all';
  const mastery = options.mastery ?? 'all';

  return words.filter((word) => {
    if (category !== 'all' && word.category !== category) {
      return false;
    }

    if (mastery === 'mastered' && !isWordMastered(word)) {
      return false;
    }

    if (mastery === 'learning' && isWordMastered(word)) {
      return false;
    }

    if (mastery === 'study' && !isWordInStudyList(word)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (
      normalizeFontText(word.english).toLowerCase().includes(normalizedQuery) ||
      normalizeFontText(word.uzbek).toLowerCase().includes(normalizedQuery) ||
      word.category.toLowerCase().includes(normalizedQuery) ||
      (word.note ? normalizeFontText(word.note).toLowerCase().includes(normalizedQuery) : false)
    );
  });
}

export function orderMemorizeWords(words: WordEntry[], sortOrder: StudySortOrder): WordEntry[] {
  const studyWords = words.filter(isWordInStudyList);
  const copy = [...studyWords];

  switch (sortOrder) {
    case 'alphabetical':
      return copy.sort((a, b) => a.english.localeCompare(b.english));
    case 'hardest':
      return copy.sort((a, b) => {
        const accA = a.attemptCount > 0 ? a.correctCount / a.attemptCount : 0;
        const accB = b.attemptCount > 0 ? b.correctCount / b.attemptCount : 0;
        if (accA !== accB) return accA - accB;
        return b.attemptCount - a.attemptCount;
      });
    case 'newest':
      return copy.sort((a, b) => b.createdAt - a.createdAt);
    case 'manual':
    default:
      return copy.sort((a, b) => {
        const orderA = a.studyOrder ?? a.createdAt;
        const orderB = b.studyOrder ?? b.createdAt;
        return orderA - orderB;
      });
  }
}

export function moveWordOrder(
  words: WordEntry[],
  wordId: string,
  direction: 'up' | 'down',
): WordEntry[] {
  const orderedStudy = orderMemorizeWords(words, 'manual');
  const idx = orderedStudy.findIndex((w) => w.id === wordId);
  if (idx === -1) return words;

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= orderedStudy.length) return words;

  const swapped = [...orderedStudy];
  [swapped[idx], swapped[swapIdx]] = [swapped[swapIdx], swapped[idx]];

  const orderMap = new Map<string, number>();
  swapped.forEach((w, i) => {
    orderMap.set(w.id, i + 1);
  });

  return words.map((w) => (orderMap.has(w.id) ? { ...w, studyOrder: orderMap.get(w.id) } : w));
}

export function generateQuizQuestion(
  allWords: WordEntry[],
  direction: QuizDirection,
  options: {
    lastWordId?: string | null;
    category?: string;
    onlyUnmastered?: boolean;
    scope?: QuizScope;
    rng?: () => number;
  } = {},
): QuizQuestion | null {
  const rng = options.rng ?? Math.random;

  if (allWords.length < 4) {
    return null;
  }

  const effectiveScope: QuizScope =
    options.scope ?? (options.onlyUnmastered ? 'unmastered' : 'all');

  let targetPool = allWords.filter((word) => {
    if (options.category && options.category !== 'all' && word.category !== options.category) {
      return false;
    }
    if (effectiveScope === 'unmastered' && isWordMastered(word)) {
      return false;
    }
    if (effectiveScope === 'study' && !isWordInStudyList(word)) {
      return false;
    }
    return true;
  });

  if (targetPool.length === 0) {
    targetPool = allWords;
  }

  const nonRepeatingPool =
    options.lastWordId && targetPool.length > 1
      ? targetPool.filter((w) => w.id !== options.lastWordId)
      : targetPool;

  const target = nonRepeatingPool[Math.floor(rng() * nonRepeatingPool.length)];

  const resolvedDirection: 'en-to-uz' | 'uz-to-en' =
    direction === 'mixed' ? (rng() < 0.5 ? 'en-to-uz' : 'uz-to-en') : direction;

  const promptLanguage: 'en' | 'uz' = resolvedDirection === 'en-to-uz' ? 'en' : 'uz';
  const answerLanguage: 'en' | 'uz' = resolvedDirection === 'en-to-uz' ? 'uz' : 'en';

  const prompt = promptLanguage === 'en' ? target.english : target.uzbek;
  const correctAnswer = answerLanguage === 'uz' ? target.uzbek : target.english;

  const seenAnswers = new Set<string>([correctAnswer.trim().toLowerCase()]);
  const distractorCandidates = shuffleArray(
    allWords.filter((w) => w.id !== target.id),
    rng,
  );

  const distractors: QuizOption[] = [];
  for (const candidate of distractorCandidates) {
    const candidateAnswer = (answerLanguage === 'uz' ? candidate.uzbek : candidate.english).trim();
    const key = candidateAnswer.toLowerCase();
    if (!candidateAnswer || seenAnswers.has(key)) {
      continue;
    }
    seenAnswers.add(key);
    distractors.push({
      id: `${candidate.id}-opt`,
      text: candidateAnswer,
      isCorrect: false,
    });
    if (distractors.length === 3) {
      break;
    }
  }

  if (distractors.length < 3) {
    return null;
  }

  const quizOptions = shuffleArray<QuizOption>(
    [
      {
        id: `${target.id}-correct`,
        text: correctAnswer,
        isCorrect: true,
      },
      ...distractors,
    ],
    rng,
  );

  return {
    wordId: target.id,
    prompt,
    promptLanguage,
    answerLanguage,
    category: target.category,
    note: target.note,
    correctAnswer,
    options: quizOptions,
  };
}

function splitLineIntoPair(line: string): [string, string] | null {
  // Strip optional leading numbering like "1. apple - olma" or "12) book : kitob"
  const cleanedLine = line.replace(/^\s*\d{1,4}[.)]\s+/, '').trim();
  if (!cleanedLine) return null;

  const spacedSeparators = ['\t', ' — ', ' – ', ' - ', ' = ', ' : ', ' => ', ' -> '];
  for (const sep of spacedSeparators) {
    const idx = cleanedLine.indexOf(sep);
    if (idx > 0) {
      const left = cleanedLine.slice(0, idx).trim();
      const right = cleanedLine.slice(idx + sep.length).trim();
      if (left && right) return [left, right];
    }
  }

  const compactSeparators = ['=', ':', ';', ','];
  for (const sep of compactSeparators) {
    const idx = cleanedLine.indexOf(sep);
    if (idx > 0) {
      const left = cleanedLine.slice(0, idx).trim();
      const right = cleanedLine.slice(idx + sep.length).trim();
      if (left && right) return [left, right];
    }
  }

  const hyphenIdx = cleanedLine.indexOf('-');
  if (hyphenIdx > 0) {
    const left = cleanedLine.slice(0, hyphenIdx).trim();
    const right = cleanedLine.slice(hyphenIdx + 1).trim();
    if (left && right) return [left, right];
  }

  return null;
}

export function parseBulkVocabulary(
  rawText: string,
  defaultCategory = 'Kundalik',
): BulkParseResult {
  const normalizedText = normalizeFontText(rawText);
  const lines = normalizedText.split(/\r?\n/);
  const valid: BulkParseResult['valid'] = [];
  const skippedLines: BulkParseResult['skippedLines'] = [];
  const seen = new Set<string>();

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return;
    }

    const pair = splitLineIntoPair(trimmed);
    if (!pair) {
      skippedLines.push({
        lineNumber,
        raw: trimmed,
        reason: "Ajratuvchi topilmadi (masalan: apple - olma)",
      });
      return;
    }

    const [english, uzbek] = pair;
    // Skip CSV/Excel header rows automatically
    if (
      lineNumber === 1 &&
      (english.toLowerCase() === 'english' || english.toLowerCase() === 'inglizcha') &&
      (uzbek.toLowerCase() === 'uzbek' ||
        uzbek.toLowerCase() === "o'zbekcha" ||
        uzbek.toLowerCase() === 'tarjima')
    ) {
      return;
    }

    const key = normalizeWordKey(english, uzbek);
    if (seen.has(key)) {
      skippedLines.push({
        lineNumber,
        raw: trimmed,
        reason: 'Takrorlangan juftlik',
      });
      return;
    }

    seen.add(key);
    valid.push({
      english,
      uzbek,
      category: defaultCategory,
    });
  });

  return { valid, skippedLines };
}

export function exportVocabularyToCsv(words: WordEntry[]): string {
  const escapeCell = (val: string) => {
    const safe = val.replace(/"/g, '""');
    return `"${safe}"`;
  };

  const header = ['english', 'uzbek', 'category', 'note', 'correctCount', 'attemptCount'].join(',');
  const rows = words.map((w) =>
    [
      escapeCell(w.english),
      escapeCell(w.uzbek),
      escapeCell(w.category),
      escapeCell(w.note ?? ''),
      String(w.correctCount),
      String(w.attemptCount),
    ].join(','),
  );

  return [header, ...rows].join('\n');
}

export function exportVocabularyToText(words: WordEntry[]): string {
  return words.map((w) => `${w.english} - ${w.uzbek}`).join('\n');
}

export function parseImportedFile(
  content: string,
  filename: string,
  defaultCategory = 'Kundalik',
): BulkParseResult {
  const normalizedContent = normalizeFontText(content);
  const lowerName = filename.toLowerCase();
  if (
    lowerName.endsWith('.json') ||
    normalizedContent.trim().startsWith('[') ||
    normalizedContent.trim().startsWith('{')
  ) {
    try {
      const parsed = JSON.parse(normalizedContent);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.words)
          ? parsed.words
          : null;
      if (list) {
        const valid: BulkParseResult['valid'] = [];
        const skippedLines: BulkParseResult['skippedLines'] = [];
        const seen = new Set<string>();

        list.forEach((item: unknown, idx: number) => {
          if (typeof item !== 'object' || item === null) {
            skippedLines.push({
              lineNumber: idx + 1,
              raw: String(item),
              reason: "Noto'g'ri JSON yozuv",
            });
            return;
          }
          const rec = item as Record<string, unknown>;
          const en = typeof rec.english === 'string' ? normalizeFontText(rec.english).trim() : '';
          const uz = typeof rec.uzbek === 'string' ? normalizeFontText(rec.uzbek).trim() : '';
          const cat =
            typeof rec.category === 'string' && rec.category.trim()
              ? rec.category.trim()
              : defaultCategory;
          const note =
            typeof rec.note === 'string' && rec.note.trim()
              ? normalizeFontText(rec.note).trim()
              : undefined;

          if (!en || !uz) {
            skippedLines.push({
              lineNumber: idx + 1,
              raw: JSON.stringify(rec),
              reason: "english yoki uzbek maydoni bo'sh",
            });
            return;
          }
          const key = normalizeWordKey(en, uz);
          if (seen.has(key)) return;
          seen.add(key);
          valid.push({ english: en, uzbek: uz, category: cat, note });
        });

        return { valid, skippedLines };
      }
    } catch {
      // Fall through to line-based parser
    }
  }

  // Handle CSV with quoted cells cleanly
  if (lowerName.endsWith('.csv')) {
    const lines = normalizedContent.split(/\r?\n/);
    const valid: BulkParseResult['valid'] = [];
    const skippedLines: BulkParseResult['skippedLines'] = [];
    const seen = new Set<string>();

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    lines.forEach((rawLine, index) => {
      const trimmed = rawLine.trim();
      if (!trimmed) return;
      const cells = parseCsvLine(trimmed);
      if (cells.length < 2 || !cells[0] || !cells[1]) {
        skippedLines.push({
          lineNumber: index + 1,
          raw: trimmed,
          reason: 'CSV ustunlari yetarli emas',
        });
        return;
      }
      if (
        index === 0 &&
        (cells[0].toLowerCase() === 'english' || cells[0].toLowerCase() === 'inglizcha') &&
        (cells[1].toLowerCase() === 'uzbek' || cells[1].toLowerCase() === "o'zbekcha")
      ) {
        return;
      }
      const key = normalizeWordKey(cells[0], cells[1]);
      if (seen.has(key)) return;
      seen.add(key);
      valid.push({
        english: cells[0],
        uzbek: cells[1],
        category: cells[2] || defaultCategory,
        note: cells[3] || undefined,
      });
    });

    return { valid, skippedLines };
  }

  return parseBulkVocabulary(normalizedContent, defaultCategory);
}
