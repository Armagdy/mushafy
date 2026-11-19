/**
 * Arabic Quran text search utilities (Uthmani-script aware).
 *
 * The Quran text is stored in Uthmani script with full tashkeel. Hamza words
 * like أُوْلَـٰٓئِكَ use alef variants, superscript alef (ٰ U+0670), tatweel
 * (ـ U+0640) and combining hamza marks, while users type the plain (imlaai)
 * spelling اولئك. A normalize-then-substring approach fails for such words
 * because the two spellings do not map 1:1 (the Uthmani script inserts alefs
 * the plain spelling lacks, and vice versa). It also breaks highlighting,
 * which tries to map normalized indices back to the original text.
 *
 * Instead we build a tolerant regex directly from the search query and run
 * it against the ORIGINAL text:
 *   - diacritics / tatweel / Quranic annotation marks are skipped between letters
 *   - all alef forms (ا أ إ آ ٱ ٰ ...) are interchangeable; alefs that only
 *     exist on one side of the spelling difference are optional
 *   - hamza seats (ئ ؤ ء) are optional and interchangeable with their base letters
 * The regex match then maps exactly onto the original text, so highlighting
 * is always positioned correctly and covers the full Uthmani word form.
 */

// All forms of alef, including superscript alef (U+0670) and alef wasla (U+0671)
const ALEF_CHARS = '\u0622\u0623\u0625\u0627\u0670\u0671\u0672\u0673\u0675\u0676';

// Diacritics, tatweel and Quranic annotation marks - allowed between letters
// U+0610-U+061A (Quranic marks), U+0640 (tatweel), U+064B-U+065F (harakat,
// incl. combining hamza U+0654/U+0655 and maddah U+0653), U+06D6-U+06ED
// (small waqf/annotation signs)
const SKIP_CHARS = '\u0610-\u061A\u0640\u064B-\u065F\u06D6-\u06ED';

const SKIP = `[${SKIP_CHARS}]*`;
// Glue between two query letters: optional diacritics, then an optional
// extra alef (Uthmani inserts alefs the plain spelling lacks), then more
// optional diacritics
const INTER = `${SKIP}(?:[${ALEF_CHARS}])?${SKIP}`;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A query alef matches either alef characters in the text (e.g. ا أ ٱ ٰ,
// possibly several in a row like ءَأَنذَرۡتَمْ) or a seat-less combining hamza
// mark on tatweel (U+0654/U+0655), which Uthmani script uses instead of an
// alef in words like يَسۡـَٔلُونَكَ for typed يسالونك/يسألونك
const ALEF_FRAGMENT = `(?:[${ALEF_CHARS}]+|\\u0640*[\u0654\u0655])`;

/** Regex fragment matching one query character against Uthmani text. '' = ignore */
function letterFragment(ch: string): string | null {
  switch (ch) {
    // Alef family (incl. hamza-carrying alefs typed in the query)
    case '\u0622': // آ
    case '\u0623': // أ
    case '\u0625': // إ
    case '\u0627': // ا
    case '\u0670': // ٰ superscript alef
    case '\u0671': // ٱ alef wasla
    case '\u0672': // ٲ
    case '\u0673': // ٳ
    case '\u0675': // ٵ
    case '\u0676': // ٶ
      return ALEF_FRAGMENT;

    // Hamza seats are optional: Uthmani sometimes drops the seat and uses a
    // combining hamza mark instead (e.g. سَيِّـَٔاتِ vs typed سيئات)
    case '\u0626': // ئ
      return `(?:[\u0626\u064A\u0649])?`;
    case '\u0624': // ؤ
      return `(?:[\u0624\u0648])?`;
    case '\u0621': // ء
      return `(?:\u0621)?`;

    // Base letters also match their hamza-carrying counterparts in the text
    case '\u064A': // ي
    case '\u0649': // ى
      return `[\u0626\u064A\u0649]`;
    case '\u0648': // و
      return `[\u0624\u0648]`;
    case '\u0629': // ة
    case '\u0647': // ه
      return `[\u0629\u0647]`;

    // Spaces in the query match whitespace runs in the text
    case ' ':
    case '\u00A0':
      return `\\s+`;

    default: {
      // Diacritics / tatweel typed in the query are simply ignored
      if (new RegExp(`^[${SKIP_CHARS}]$`).test(ch)) return '';
      // Any other character (incl. non-Arabic) matches literally
      return escapeRegExp(ch);
    }
  }
}

export interface ArabicSearchOptions {
  /** Match the query as a whole word instead of a substring */
  wholeWord?: boolean;
}

/**
 * Build a tolerant regex for searching Uthmani-script text.
 * Returns null when the query contains nothing searchable.
 */
export function buildArabicSearchRegex(
  query: string,
  options: ArabicSearchOptions = {}
): RegExp | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  let pattern = '';
  for (const ch of trimmed) {
    const fragment = letterFragment(ch);
    if (fragment === null) return null;
    if (fragment === '') continue;
    pattern += (pattern ? INTER : '') + fragment;
  }
  if (!pattern) return null;

  // Trailing glue so the match includes the last letter's diacritics and an
  // optional trailing superscript alef (e.g. عَلَىٰ for query على)
  pattern += INTER;

  if (options.wholeWord) {
    pattern = `(?:^|\\s)${pattern}(?=\\s|$)`;
  }

  return new RegExp(pattern);
}

/** Check whether Uthmani-script Arabic text matches the search query */
export function arabicTextMatches(
  text: string,
  query: string,
  options: ArabicSearchOptions = {}
): boolean {
  if (!text || !query.trim()) return false;
  const regex = buildArabicSearchRegex(query, options);
  if (!regex) return false;
  return regex.test(text);
}

export interface ArabicMatchRange {
  start: number;
  end: number;
}

/**
 * Find the first occurrence of the query in Uthmani-script text.
 * The returned range maps exactly onto the original text, so it can be
 * used directly for highlighting.
 */
export function findArabicMatch(
  text: string,
  query: string,
  options: ArabicSearchOptions = {}
): ArabicMatchRange | null {
  if (!text || !query.trim()) return null;
  const regex = buildArabicSearchRegex(query, options);
  if (!regex) return null;

  const match = regex.exec(text);
  if (!match) return null;

  let start = match.index;
  // For whole-word searches the pattern includes the leading space; keep the
  // highlight on the word itself
  if (options.wholeWord && start > 0 && /\s/.test(text[start])) {
    start += 1;
  }
  return { start, end: match.index + match[0].length };
}
