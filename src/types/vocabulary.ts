export type QuizDirection = 'en-to-uz' | 'uz-to-en' | 'mixed';

export type QuizScope = 'all' | 'study' | 'unmastered';

export type AppView = 'quiz' | 'study' | 'database' | 'add';

export type MasteryFilter = 'all' | 'learning' | 'mastered' | 'study';

export type StudySortOrder = 'manual' | 'newest' | 'alphabetical' | 'hardest';

export interface WordEntry {
  id: string;
  english: string;
  uzbek: string;
  category: string;
  note?: string;
  correctCount: number;
  attemptCount: number;
  createdAt: number;
  lastReviewedAt?: number;
  toMemorize?: boolean;
  studyOrder?: number;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  wordId: string;
  prompt: string;
  promptLanguage: 'en' | 'uz';
  answerLanguage: 'en' | 'uz';
  category: string;
  note?: string;
  correctAnswer: string;
  options: QuizOption[];
}

export interface SessionHistoryItem {
  id: string;
  wordId: string;
  prompt: string;
  correctAnswer: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timestamp: number;
}

export interface BulkParseResult {
  valid: Array<{
    english: string;
    uzbek: string;
    category: string;
    note?: string;
  }>;
  skippedLines: Array<{
    lineNumber: number;
    raw: string;
    reason: string;
  }>;
}
