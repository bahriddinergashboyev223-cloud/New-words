const LIGATURE_MAP: Record<string, string> = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'st',
  '\uFB06': 'st',
};

const APOSTROPHE_CHARS = /[\u2018\u2019\u02BB\u02BC\u02B9\u0060\u00B4\u2032]/g;
const HYPHEN_CHARS = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;
const SPACE_CHARS = /[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g;

const SPECIAL_MATH_EXCEPTIONS: Record<number, string> = {
  0x2102: 'C',
  0x210a: 'g',
  0x210b: 'H',
  0x210c: 'H',
  0x210d: 'H',
  0x210e: 'h',
  0x210f: 'h',
  0x2110: 'I',
  0x2111: 'I',
  0x2112: 'L',
  0x2113: 'l',
  0x2115: 'N',
  0x2119: 'P',
  0x211a: 'Q',
  0x211b: 'R',
  0x211c: 'R',
  0x211d: 'R',
  0x2124: 'Z',
  0x2128: 'Z',
  0x212c: 'B',
  0x212d: 'C',
  0x212f: 'e',
  0x2130: 'E',
  0x2131: 'F',
  0x2133: 'M',
  0x2134: 'o',
};

/**
 * Normalizes stylized Unicode "fancy fonts" (Math Bold, Italic, Script,
 * Fraktur, Sans-serif, Monospace, Fullwidth), typographic ligatures,
 * non-breaking spaces, and Uzbek/English apostrophe & dash variants
 * into clean standard characters. Preserves Latin & Cyrillic letters.
 */
export function normalizeFontText(input: string): string {
  if (!input) return '';

  let result = '';
  for (const ch of input) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;

    if (LIGATURE_MAP[ch]) {
      result += LIGATURE_MAP[ch];
      continue;
    }

    if (SPECIAL_MATH_EXCEPTIONS[cp]) {
      result += SPECIAL_MATH_EXCEPTIONS[cp];
      continue;
    }

    // Mathematical Alphanumeric Symbols (U+1D400 - U+1D7FF)
    if (cp >= 0x1d400 && cp <= 0x1d6a3) {
      const offset = cp - 0x1d400;
      const letterIndex = offset % 52;
      if (letterIndex < 26) {
        result += String.fromCharCode(65 + letterIndex);
      } else {
        result += String.fromCharCode(97 + (letterIndex - 26));
      }
      continue;
    }

    // Mathematical Bold / Double-struck / Sans / Monospace Digits (U+1D7CE - U+1D7FF)
    if (cp >= 0x1d7ce && cp <= 0x1d7ff) {
      const digit = (cp - 0x1d7ce) % 10;
      result += String.fromCharCode(48 + digit);
      continue;
    }

    // Fullwidth ASCII variants (U+FF01 - U+FF5E)
    if (cp >= 0xff01 && cp <= 0xff5e) {
      result += String.fromCharCode(cp - 0xfee0);
      continue;
    }

    result += ch;
  }

  return result
    .normalize('NFC')
    .replace(SPACE_CHARS, ' ')
    .replace(APOSTROPHE_CHARS, "'")
    .replace(HYPHEN_CHARS, '-');
}

/**
 * Decodes an ArrayBuffer of text supporting UTF-8, UTF-16LE/BE BOMs,
 * and automatic Windows-1251 fallback for Cyrillic dictionaries.
 */
export function decodeTextBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder('windows-1251').decode(bytes);
    } catch {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
}
