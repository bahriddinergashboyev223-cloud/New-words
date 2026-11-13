import { Moon, Sun } from 'lucide-react';
import type { AppView } from '../types/vocabulary';
import type { ThemeMode } from '../utils/storage';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  totalWords: number;
  studyCount: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export function Header({
  activeView,
  onNavigate,
  totalWords,
  studyCount,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2.5 sm:gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('quiz')}
          className="font-display text-base sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded"
        >
          Lug'atLab
        </button>

        {/* Zone 2: Concise single-line nav links */}
        <nav aria-label="Asosiy bo'limlar" className="flex items-center gap-3 sm:gap-6">
          <button
            type="button"
            onClick={() => onNavigate('quiz')}
            aria-current={activeView === 'quiz' ? 'page' : undefined}
            className={`relative py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded ${
              activeView === 'quiz'
                ? 'text-blue-700 dark:text-blue-400 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Mashq
            {activeView === 'quiz' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('study')}
            aria-current={activeView === 'study' ? 'page' : undefined}
            className={`relative py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded ${
              activeView === 'study'
                ? 'text-blue-700 dark:text-blue-400 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Yodlash ({studyCount})</span>
            {activeView === 'study' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('database')}
            aria-current={activeView === 'database' ? 'page' : undefined}
            className={`relative py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded ${
              activeView === 'database'
                ? 'text-blue-700 dark:text-blue-400 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="sm:hidden">Baza ({totalWords})</span>
            <span className="hidden sm:inline">Lug'at bazasi ({totalWords})</span>
            {activeView === 'database' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('add')}
            aria-current={activeView === 'add' ? 'page' : undefined}
            className={`relative py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded ${
              activeView === 'add'
                ? 'text-blue-700 dark:text-blue-400 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="sm:hidden">Qo'shish</span>
            <span className="hidden sm:inline">So'z qo'shish</span>
            {activeView === 'add' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
              />
            )}
          </button>
        </nav>

        {/* Zone 3: Install + Theme switch + 1 primary CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? "Kunduzgi rejimga o'tish" : "Tungi rejimga o'tish"}
            title={isDark ? 'Kunduzgi rejim' : 'Tungi rejim'}
            data-testid="theme-toggle"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate(activeView === 'add' ? 'quiz' : 'add')}
            className="hidden md:inline-flex px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {activeView === 'add' ? 'Testni boshlash' : "Yangi so'z"}
          </button>
        </div>
      </div>
    </header>
  );
}
