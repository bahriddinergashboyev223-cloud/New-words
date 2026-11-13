import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportVocabularyToCsv,
  filterVocabulary,
  generateQuizQuestion,
  getAccuracyPercent,
  moveWordOrder,
  orderMemorizeWords,
  parseBulkVocabulary,
  parseImportedFile,
} from './vocabulary';
import { normalizeFontText } from './fontNormalizer';
import { parseDocxXmlToLines, parseRtfToText } from './fileParser';
import type { WordEntry } from '../types/vocabulary';

const SAMPLE_WORDS: WordEntry[] = [
  {
    id: 'w1',
    english: 'apple',
    uzbek: 'olma',
    category: 'Kundalik',
    correctCount: 3,
    attemptCount: 3,
    createdAt: 1,
    toMemorize: false,
    studyOrder: 1,
  },
  {
    id: 'w2',
    english: 'book',
    uzbek: 'kitob',
    category: "Ta'lim",
    correctCount: 1,
    attemptCount: 2,
    createdAt: 2,
    toMemorize: true,
    studyOrder: 2,
  },
  {
    id: 'w3',
    english: 'river',
    uzbek: 'daryo',
    category: 'Tabiat',
    correctCount: 0,
    attemptCount: 0,
    createdAt: 3,
    toMemorize: true,
    studyOrder: 3,
  },
  {
    id: 'w4',
    english: 'mountain',
    uzbek: "tog'",
    category: 'Tabiat',
    correctCount: 4,
    attemptCount: 4,
    createdAt: 4,
    toMemorize: false,
    studyOrder: 4,
  },
  {
    id: 'w5',
    english: 'knowledge',
    uzbek: 'bilim',
    category: "Ta'lim",
    correctCount: 0,
    attemptCount: 3,
    createdAt: 5,
    toMemorize: true,
    studyOrder: 5,
  },
];

test('generateQuizQuestion returns 1 word and 4 unique options with exactly 1 correct', () => {
  const question = generateQuizQuestion(SAMPLE_WORDS, 'en-to-uz', {
    rng: () => 0.2,
  });

  assert.ok(question !== null);
  assert.equal(question.promptLanguage, 'en');
  assert.equal(question.answerLanguage, 'uz');
  assert.equal(question.options.length, 4);

  const correctOptions = question.options.filter((o) => o.isCorrect);
  assert.equal(correctOptions.length, 1);
  assert.equal(correctOptions[0].text, question.correctAnswer);

  const uniqueTexts = new Set(question.options.map((o) => o.text.toLowerCase()));
  assert.equal(uniqueTexts.size, 4);
});

test('generateQuizQuestion respects study scope', () => {
  const question = generateQuizQuestion(SAMPLE_WORDS, 'en-to-uz', {
    scope: 'study',
    rng: () => 0.1,
  });

  assert.ok(question !== null);
  const studyIds = new Set(['w2', 'w3', 'w5']);
  assert.ok(studyIds.has(question.wordId));
  assert.equal(question.options.length, 4);
});

test('generateQuizQuestion respects uz-to-en direction', () => {
  const question = generateQuizQuestion(SAMPLE_WORDS, 'uz-to-en', {
    rng: () => 0.1,
  });

  assert.ok(question !== null);
  assert.equal(question.promptLanguage, 'uz');
  assert.equal(question.answerLanguage, 'en');
  assert.equal(question.options.length, 4);
  assert.equal(question.options.filter((o) => o.isCorrect).length, 1);
});

test('generateQuizQuestion returns null when fewer than 4 distinct words exist', () => {
  const tinyPool = SAMPLE_WORDS.slice(0, 3);
  const question = generateQuizQuestion(tinyPool, 'en-to-uz');
  assert.equal(question, null);
});

test('generateQuizQuestion avoids repeating lastWordId when pool > 1', () => {
  const question = generateQuizQuestion(SAMPLE_WORDS, 'en-to-uz', {
    lastWordId: 'w1',
    rng: () => 0,
  });
  assert.ok(question !== null);
  assert.notEqual(question.wordId, 'w1');
});

test('normalizeFontText normalizes stylized Unicode fonts, ligatures, apostrophes, and preserves Cyrillic', () => {
  assert.equal(normalizeFontText('𝐚𝐩𝐩𝐥𝐞 — 𝐨𝐥𝐦𝐚'), 'apple - olma');
  assert.equal(normalizeFontText('ﬁre – o‘rmon'), "fire - o'rmon");
  assert.equal(normalizeFontText('ａｐｐｌｅ'), 'apple');
  assert.equal(normalizeFontText('китоб - ўқиш'), 'китоб - ўқиш');
});

test('parseBulkVocabulary parses stylized fonts, numbered lists, dash, colon, tab, and comma formats', () => {
  const raw = `
    1. 𝐚𝐩𝐩𝐥𝐞 - olma
    2) well-known — mashhur
    book : kitob
    water\tsuv
    sun, quyosh
    invalid line without separator
    apple - olma
  `;
  const result = parseBulkVocabulary(raw, 'Kundalik');
  assert.equal(result.valid.length, 5);
  assert.deepEqual(result.valid[0], {
    english: 'apple',
    uzbek: 'olma',
    category: 'Kundalik',
  });
  assert.deepEqual(result.valid[1], {
    english: 'well-known',
    uzbek: 'mashhur',
    category: 'Kundalik',
  });
  assert.equal(result.skippedLines.length, 2);
});

test('parseDocxXmlToLines extracts Word paragraphs and table rows regardless of font', () => {
  const mockXml = `
    <w:document><w:body>
      <w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/></w:rPr><w:t>freedom - erkinlik</w:t></w:r></w:p>
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>ocean</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>okean</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    </w:body></w:document>
  `;
  const lines = parseDocxXmlToLines(mockXml);
  const parsed = parseBulkVocabulary(lines);
  assert.equal(parsed.valid.length, 2);
  assert.equal(parsed.valid[0].english, 'freedom');
  assert.equal(parsed.valid[0].uzbek, 'erkinlik');
  assert.equal(parsed.valid[1].english, 'ocean');
  assert.equal(parsed.valid[1].uzbek, 'okean');
});

test('parseRtfToText extracts clean text lines and strips font table', () => {
  const rtf = `{\\rtf1\\ansi{\\fonttbl{\\f0 Times New Roman;}{\\f1 Arial;}}\\f0\\fs24 apple - olma\\par\\f1 book - \\u1082?\\u1080?\\u1090?\\u1086?\\u1073?\\par}`;
  const text = parseRtfToText(rtf);
  const parsed = parseBulkVocabulary(text);
  assert.equal(parsed.valid.length, 2);
  assert.equal(parsed.valid[0].english, 'apple');
  assert.equal(parsed.valid[1].uzbek, 'китоб');
});

test('orderMemorizeWords and moveWordOrder manage custom memorization order', () => {
  const alpha = orderMemorizeWords(SAMPLE_WORDS, 'alphabetical');
  assert.deepEqual(
    alpha.map((w) => w.english),
    ['book', 'knowledge', 'river'],
  );

  const hardest = orderMemorizeWords(SAMPLE_WORDS, 'hardest');
  assert.equal(hardest[0].english, 'knowledge'); // 0/3 attempts

  const moved = moveWordOrder(SAMPLE_WORDS, 'w3', 'up');
  const manualAfter = orderMemorizeWords(moved, 'manual');
  assert.deepEqual(
    manualAfter.map((w) => w.id),
    ['w3', 'w2', 'w5'],
  );
});

test('filterVocabulary filters by query, category, and mastery/study state', () => {
  assert.equal(filterVocabulary(SAMPLE_WORDS, { query: 'daryo' }).length, 1);
  assert.equal(filterVocabulary(SAMPLE_WORDS, { category: 'Tabiat' }).length, 2);
  assert.equal(filterVocabulary(SAMPLE_WORDS, { mastery: 'mastered' }).length, 2);
  assert.equal(filterVocabulary(SAMPLE_WORDS, { mastery: 'learning' }).length, 3);
  assert.equal(filterVocabulary(SAMPLE_WORDS, { mastery: 'study' }).length, 3);
});

test('exportVocabularyToCsv and parseImportedFile roundtrip cleanly', () => {
  const csv = exportVocabularyToCsv(SAMPLE_WORDS);
  const parsed = parseImportedFile(csv, 'lugat.csv', 'Boshqa');
  assert.equal(parsed.valid.length, SAMPLE_WORDS.length);
  assert.equal(parsed.valid[0].english, 'apple');
  assert.equal(parsed.valid[0].uzbek, 'olma');
});

test('getAccuracyPercent computes percentage safely', () => {
  assert.equal(getAccuracyPercent(0, 0), 0);
  assert.equal(getAccuracyPercent(3, 4), 75);
});
