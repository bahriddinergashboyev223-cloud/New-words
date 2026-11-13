import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { BulkParseResult } from '../types/vocabulary';
import { decodeTextBuffer, normalizeFontText } from './fontNormalizer';
import { parseBulkVocabulary, parseImportedFile } from './vocabulary';

function decodeXmlEntities(xml: string): string {
  return xml
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function extractParagraphRunsText(paragraphXml: string): string {
  // Handle tabs inside Word runs (<w:tab/>) and breaks (<w:br/>)
  const tokenized = paragraphXml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n');

  const parts: string[] = [];
  const textTagRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|\t|\n/g;
  let match: RegExpExecArray | null;
  while ((match = textTagRegex.exec(tokenized)) !== null) {
    if (match[0] === '\t') {
      parts.push('\t');
    } else if (match[0] === '\n') {
      parts.push('\n');
    } else {
      parts.push(decodeXmlEntities(match[1]));
    }
  }
  return parts.join('').trim();
}

/**
 * Extracts text lines from Word document.xml regardless of font formatting
 * (Times New Roman, Arial, Calibri, Symbol, etc.). Preserves Word table rows
 * as tab-separated English - Uzbek pairs.
 */
export function parseDocxXmlToLines(xml: string): string {
  const lines: string[] = [];
  let cursor = 0;

  // Scan top-level tables and paragraphs in document order
  const tableRegex = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
  let tblMatch: RegExpExecArray | null;

  const extractParagraphsFromChunk = (chunk: string) => {
    const pRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(chunk)) !== null) {
      const text = extractParagraphRunsText(pMatch[0]);
      if (text) {
        lines.push(text);
      }
    }
  };

  while ((tblMatch = tableRegex.exec(xml)) !== null) {
    if (tblMatch.index > cursor) {
      extractParagraphsFromChunk(xml.slice(cursor, tblMatch.index));
    }

    const rowRegex = /<w:tr\b[\s\S]*?<\/w:tr>/g;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(tblMatch[0])) !== null) {
      const cellRegex = /<w:tc\b[\s\S]*?<\/w:tc>/g;
      const cellTexts: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowMatch[0])) !== null) {
        const cellParagraphs: string[] = [];
        const pRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
        let pMatch: RegExpExecArray | null;
        while ((pMatch = pRegex.exec(cellMatch[0])) !== null) {
          const t = extractParagraphRunsText(pMatch[0]);
          if (t) cellParagraphs.push(t);
        }
        const joinedCell = cellParagraphs.join(' ').trim();
        if (joinedCell) {
          cellTexts.push(joinedCell);
        }
      }
      if (cellTexts.length >= 2) {
        lines.push(`${cellTexts[0]}\t${cellTexts[1]}`);
      } else if (cellTexts.length === 1) {
        lines.push(cellTexts[0]);
      }
    }

    cursor = tblMatch.index + tblMatch[0].length;
  }

  if (cursor < xml.length) {
    extractParagraphsFromChunk(xml.slice(cursor));
  }

  return normalizeFontText(lines.join('\n'));
}

/**
 * Extracts readable lines from Rich Text Format (.rtf) documents, stripping
 * font tables and RTF control codes while decoding Unicode & Win-1251 escapes.
 */
export function parseRtfToText(rtf: string): string {
  const skipDestinations = new Set([
    'fonttbl',
    'colortbl',
    'stylesheet',
    'info',
    'pict',
    'object',
    'header',
    'footer',
    'headerl',
    'headerr',
    'headerf',
    'footerl',
    'footerr',
    'footerf',
  ]);

  let out = '';
  const stack: Array<{ uc: number; skip: boolean }> = [{ uc: 1, skip: false }];
  let i = 0;

  const decodeWin1251Byte = (byte: number): string => {
    try {
      return new TextDecoder('windows-1251').decode(new Uint8Array([byte]));
    } catch {
      return String.fromCharCode(byte);
    }
  };

  while (i < rtf.length) {
    const ch = rtf[i];
    const current = stack[stack.length - 1];

    if (ch === '{') {
      stack.push({ uc: current.uc, skip: current.skip });
      i += 1;
      continue;
    }

    if (ch === '}') {
      if (stack.length > 1) stack.pop();
      i += 1;
      continue;
    }

    if (ch === '\\') {
      const next = rtf[i + 1];
      if (!next) break;

      if (next === '\\' || next === '{' || next === '}') {
        if (!current.skip) out += next;
        i += 2;
        continue;
      }

      if (next === '*') {
        current.skip = true;
        i += 2;
        continue;
      }

      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          if (!current.skip) {
            out += decodeWin1251Byte(parseInt(hex, 16));
          }
          i += 4;
          continue;
        }
      }

      if (next === '~') {
        if (!current.skip) out += ' ';
        i += 2;
        continue;
      }

      const ctrlMatch = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1));
      if (ctrlMatch) {
        const word = ctrlMatch[1];
        const param = ctrlMatch[2] ? Number(ctrlMatch[2]) : undefined;
        i += 1 + ctrlMatch[0].length;

        if (skipDestinations.has(word)) {
          current.skip = true;
          continue;
        }

        if (word === 'uc' && param !== undefined) {
          current.uc = Math.max(0, param);
          continue;
        }

        if (word === 'u' && param !== undefined) {
          if (!current.skip) {
            const code = param < 0 ? param + 65536 : param;
            out += String.fromCodePoint(code);
          }
          // Skip fallback characters after \uN
          let skipped = 0;
          while (skipped < current.uc && i < rtf.length && rtf[i] !== '{' && rtf[i] !== '}') {
            if (rtf[i] === '\\' && rtf[i + 1] === "'") {
              i += 4;
            } else {
              i += 1;
            }
            skipped += 1;
          }
          continue;
        }

        if (!current.skip) {
          if (word === 'par' || word === 'line' || word === 'row') {
            out += '\n';
          } else if (word === 'tab' || word === 'cell') {
            out += '\t';
          }
        }
        continue;
      }

      i += 2;
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      i += 1;
      continue;
    }

    if (!current.skip) {
      out += ch;
    }
    i += 1;
  }

  return normalizeFontText(out);
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pageLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group text items by vertical Y position so columns on the same line stay paired
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const transform = item.transform;
      const x = Array.isArray(transform) ? Number(transform[4]) : 0;
      const y = Array.isArray(transform) ? Math.round(Number(transform[5]) / 4) * 4 : 0;
      const list = rows.get(y) ?? [];
      list.push({ x, text: item.str.trim() });
      rows.set(y, list);
    }

    const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = rows.get(y)!.sort((a, b) => a.x - b.x);
      if (items.length >= 2) {
        // Check if separated horizontally like columns
        const first = items[0].text;
        const rest = items.slice(1).map((it) => it.text).join(' ');
        if (items[1].x - items[0].x > 30 && !first.includes('-') && !first.includes(':')) {
          pageLines.push(`${first}\t${rest}`);
        } else {
          pageLines.push(items.map((it) => it.text).join(' '));
        }
      } else if (items.length === 1) {
        pageLines.push(items[0].text);
      }
    }
  }

  return normalizeFontText(pageLines.join('\n'));
}

export async function parseDictionaryFile(
  file: File,
  defaultCategory = 'Kundalik',
): Promise<BulkParseResult> {
  const lowerName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (lowerName.endsWith('.docx')) {
    const zip = await JSZip.loadAsync(buffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error("Word fayli ichidan hujjat matni topilmadi.");
    }
    const xml = await docXmlFile.async('string');
    const text = parseDocxXmlToLines(xml);
    return parseBulkVocabulary(text, defaultCategory);
  }

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.ods')) {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 2) continue;
        const col1 = normalizeFontText(String(row[0] ?? '')).trim();
        const col2 = normalizeFontText(String(row[1] ?? '')).trim();
        if (!col1 || !col2) continue;
        lines.push(`${col1}\t${col2}`);
      }
    }
    return parseBulkVocabulary(lines.join('\n'), defaultCategory);
  }

  if (lowerName.endsWith('.pdf')) {
    const text = await extractPdfText(buffer);
    return parseBulkVocabulary(text, defaultCategory);
  }

  if (lowerName.endsWith('.rtf')) {
    const rawText = decodeTextBuffer(buffer);
    const extracted = parseRtfToText(rawText);
    return parseBulkVocabulary(extracted, defaultCategory);
  }

  // Fallback for .txt, .csv, .tsv, .json, .md, etc.
  const decoded = decodeTextBuffer(buffer);
  return parseImportedFile(decoded, file.name, defaultCategory);
}
