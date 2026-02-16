import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuranData } from '@/hooks/useQuranData';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TestSettingsDialog, TestRange, TestMode } from '@/components/quran/TestSettingsDialog';
import { surahs } from '@/data/surahs';
import { Settings, Eye, ArrowRight, ArrowLeft, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AyahData {
  text: string;
  numberInSurah: number;
  surahId: number;
}

interface Question {
  questionAyah: AyahData;
  partialText: string;
  followingAyahs: AyahData[];
  surahId: number;
  questionType?: 'normal' | 'middle' | 'end' | 'cross-surah';
  juz?: number;
}

interface TikrarOccurrence {
  surahId: number;
  ayahNumber: number;
  fullText: string;
}

interface TikrarQuestion {
  phrase: string;
  occurrences: TikrarOccurrence[];
  questionType?: 'normal' | 'similar-ending';
}

export default function Test() {
  const { t, isRTL, language } = useLanguage();
  const { ayahData, isAyahDataLoading } = useQuranData();
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testRange, setTestRange] = useState<TestRange | null>(null);
  const [testMode, setTestMode] = useState<TestMode>('hifz');
  const [difficult, setDifficult] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentTikrar, setCurrentTikrar] = useState<TikrarQuestion | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [usedHifzKeys, setUsedHifzKeys] = useState<Set<string>>(new Set());
  const [usedTikrarPhrases, setUsedTikrarPhrases] = useState<Set<string>>(new Set());
  const [usedTikrarAyahs, setUsedTikrarAyahs] = useState<Set<string>>(new Set());
  const [allTestsCompleted, setAllTestsCompleted] = useState(false);

  // Format number based on language
  const formatNumber = (num: number): string => {
    if (language === 'ar') {
      return num.toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
    }
    return num.toString();
  };

  // Helper to extract text from verse based on current language
  const getVerseText = (text: string | { ar: string; en: string }): string => {
    if (typeof text === 'string') return text;
    return text.ar; // Always show Arabic text for Quran verses
  };

  // Normalize Arabic text by removing diacritics and normalizing character variations
  const normalizeArabic = (text: string) => {
    const normalized = text
      .replace(/ٰ/g, 'ا') // Normalize superscript alif to regular alif
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '') // Remove diacritics
      .replace(/[ٱأإآٲٳٵ]/g, 'ا') // Normalize alef variations
      .replace(/[ىي]/g, 'ي') // Normalize yaa
      .replace(/ة/g, 'ه') // Normalize taa marboota
      .replace(/ؤ/g, 'و') // Normalize waw with hamza
      .replace(/ئ/g, 'ي') // Normalize yaa with hamza
      .toLowerCase();
    
    return normalized;
  };

  // Highlight matching phrase in text (for tikrar mode)
  const highlightText = (text: string, searchPhrase: string) => {
    if (!searchPhrase || !text) return text;
    
    const normalizedSearch = normalizeArabic(searchPhrase);
    const normalizedText = normalizeArabic(text);
    
    // Find the position of the exact match in normalized text
    const matchIndex = normalizedText.indexOf(normalizedSearch);
    
    if (matchIndex === -1) {
      return text; // No match found
    }
    
    // Calculate the actual position in the original text
    let charCount = 0;
    let actualStartIndex = 0;
    let actualEndIndex = text.length;
    
    // Find start position
    for (let i = 0; i < text.length && charCount < matchIndex; i++) {
      const normalized = normalizeArabic(text[i]);
      if (normalized) charCount += normalized.length;
      actualStartIndex = i + 1;
    }
    
    // Find end position
    charCount = 0;
    for (let i = actualStartIndex; i < text.length && charCount < normalizedSearch.length; i++) {
      const normalized = normalizeArabic(text[i]);
      if (normalized) charCount += normalized.length;
      actualEndIndex = i + 1;
    }
    
    // Split text into before, match, and after
    const before = text.substring(0, actualStartIndex);
    const match = text.substring(actualStartIndex, actualEndIndex);
    const after = text.substring(actualEndIndex);
    
    return (
      <>
        {before}
        <span className="bg-yellow-200 dark:bg-yellow-600 font-semibold rounded px-0.5">
          {match}
        </span>
        {after}
      </>
    );
  };

  // Get surahs in the range based on juz
  const getSurahsInJuzRange = useCallback((startJuz: number, endJuz: number): number[] => {
    const surahsInRange: Set<number> = new Set();
    
    ayahData.forEach((surah) => {
      const hasJuzInRange = surah.verses.some(verse => 
        verse.juz >= startJuz && verse.juz <= endJuz
      );
      if (hasJuzInRange) {
        surahsInRange.add(surah.number);
      }
    });

    return Array.from(surahsInRange).sort((a, b) => a - b);
  }, [ayahData]);

  // Generate a new question
  const generateQuestion = useCallback(() => {
    if (!testRange || ayahData.length === 0) return;

    let surahIds: number[] = [];

    if (testRange.type === 'surah') {
      // Get all surah IDs in range
      surahIds = Array.from(
        { length: testRange.end - testRange.start + 1 },
        (_, i) => testRange.start + i
      );
    } else {
      // Get surahs that appear in the juz range
      surahIds = getSurahsInJuzRange(testRange.start, testRange.end);
    }

    if (surahIds.length === 0) {
      console.error('No surahs found in range');
      return;
    }

    // Collect ALL verses in range with metadata for difficult mode filtering
    type VerseWithMeta = {
      surahId: number;
      index: number;
      verse: typeof ayahData[0]['verses'][0];
      isPageStart: boolean;
      isPageEnd: boolean;
      isJuzStart: boolean;
      isNearSurahEnd: boolean;
      isRepeatedPhrase: boolean;
    };

    const allVersesFlat: { surahId: number; verse: typeof ayahData[0]['verses'][0]; index: number }[] = [];
    for (const sid of surahIds) {
      const sd = ayahData.find(s => s.number === sid);
      if (!sd?.verses) continue;
      sd.verses.forEach((v, i) => allVersesFlat.push({ surahId: sid, verse: v, index: i }));
    }

    let candidatePool: VerseWithMeta[] = [];

    if (difficult) {
      // Build all verse texts for repeated-phrase detection
      const allTexts = allVersesFlat.map(v => ({
        surahId: v.surahId,
        ayahNum: v.verse.numberInSurah ?? v.verse.number,
        text: getVerseText(v.verse.text),
      }));

      // Build a set of ayah keys that contain a repeated starting phrase (2-3 words)
      const startPhraseMap = new Map<string, Set<string>>();
      for (const t of allTexts) {
        const words = t.text.split(/\s+/);
        for (let len = 2; len <= Math.min(3, words.length); len++) {
          const phrase = words.slice(0, len).join(' ');
          if (!startPhraseMap.has(phrase)) startPhraseMap.set(phrase, new Set());
          startPhraseMap.get(phrase)!.add(`${t.surahId}:${t.ayahNum}`);
        }
      }
      const repeatedKeys = new Set<string>();
      startPhraseMap.forEach((keys) => {
        if (keys.size >= 2) {
          keys.forEach(k => repeatedKeys.add(k));
        }
      });

      // Annotate each verse
      for (const entry of allVersesFlat) {
        const sd = ayahData.find(s => s.number === entry.surahId);
        if (!sd) continue;
        const verses = sd.verses;
        const v = entry.verse;
        const ayahNum = v.numberInSurah ?? v.number;
        const key = `${entry.surahId}:${ayahNum}`;

        // Page start: first ayah on a new page
        const isPageStart = entry.index === 0 ||
          v.page !== verses[entry.index - 1]?.page;

        // Page end: last ayah on a page (next ayah is on different page or it's last in surah)
        const isPageEnd = entry.index === verses.length - 1 ||
          v.page !== verses[entry.index + 1]?.page;

        // Juz start: first ayah in a new juz
        const isJuzStart = entry.index === 0 ||
          v.juz !== verses[entry.index - 1]?.juz;

        // Near surah end: last 3 ayahs of a surah
        const isNearSurahEnd = entry.index >= verses.length - 3;

        // Repeated phrase: this ayah starts with a phrase shared by another ayah
        const isRepeatedPhrase = repeatedKeys.has(key);

        const meta: VerseWithMeta = {
          surahId: entry.surahId,
          index: entry.index,
          verse: v,
          isPageStart,
          isPageEnd,
          isJuzStart,
          isNearSurahEnd,
          isRepeatedPhrase,
        };

        if (isPageStart || isPageEnd || isJuzStart || isNearSurahEnd || isRepeatedPhrase) {
          candidatePool.push(meta);
        }
      }

      // Filter out already-used
      candidatePool = candidatePool.filter(c => {
        const k = `${c.surahId}:${c.verse.numberInSurah ?? c.verse.number}`;
        return !usedHifzKeys.has(k);
      });

      // If all difficult candidates exhausted, fall back to normal pool
      if (candidatePool.length === 0) {
        candidatePool = [];
      }
    }

    let selectedSurahId: number;
    let selectedVerseIndex: number;
    let selectedSurahVerses: typeof ayahData[0]['verses'];

    if (difficult && candidatePool.length > 0) {
      // Pick randomly from the difficult pool
      const pick = candidatePool[Math.floor(Math.random() * candidatePool.length)];
      selectedSurahId = pick.surahId;
      selectedVerseIndex = pick.index;
      const sd = ayahData.find(s => s.number === selectedSurahId)!;
      selectedSurahVerses = sd.verses;
    } else {
      // Normal mode: pick random surah then random ayah
      const randomSurahId = surahIds[Math.floor(Math.random() * surahIds.length)];
      const surah = surahs.find(s => s.id === randomSurahId);
      if (!surah) return;

      const surahData = ayahData.find(s => s.number === randomSurahId);
      if (!surahData || !surahData.verses) return;

      selectedSurahVerses = surahData.verses;
      selectedSurahId = randomSurahId;

      // Pick a random ayah (avoid repeats)
      const availableIndices = selectedSurahVerses
        .map((_, i) => i)
        .filter(i => {
          const v = selectedSurahVerses[i];
          const key = `${selectedSurahId}:${v.numberInSurah ?? v.number}`;
          return !usedHifzKeys.has(key);
        });

      if (availableIndices.length === 0) {
        let found = false;
        for (const sid of surahIds) {
          const sd = ayahData.find(s => s.number === sid);
          if (!sd?.verses) continue;
          const hasUnused = sd.verses.some(v => !usedHifzKeys.has(`${sid}:${v.numberInSurah ?? v.number}`));
          if (hasUnused) { found = true; break; }
        }
        if (!found) setUsedHifzKeys(new Set());
        return;
      }

      selectedVerseIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    }

    const questionVerse = selectedSurahVerses[selectedVerseIndex];
    
    const fullText = getVerseText(questionVerse.text);
    const questionAyah: AyahData = {
      text: fullText,
      numberInSurah: questionVerse.numberInSurah ?? questionVerse.number,
      surahId: selectedSurahId,
    };

    // Collect all other ayah texts in the test range for uniqueness check
    const allOtherTexts: string[] = [];
    for (const sid of surahIds) {
      const sd = ayahData.find(s => s.number === sid);
      if (!sd?.verses) continue;
      for (const v of sd.verses) {
        if (sid === selectedSurahId && (v.numberInSurah ?? v.number) === questionAyah.numberInSurah) continue;
        allOtherTexts.push(getVerseText(v.text));
      }
    }

    // Determine excerpt type based on difficult mode
    let partialText = '';
    let questionType: 'normal' | 'middle' | 'end' | 'cross-surah' = 'normal';
    const words = fullText.split(/\s+/);
    
    if (difficult && words.length > 5) {
      // Randomly choose between: normal start (40%), middle (30%), end (30%)
      // For last ayah of surah, also consider cross-surah continuation
      const isLastAyahOfSurah = selectedVerseIndex === selectedSurahVerses.length - 1;
      const rand = Math.random();
      
      if (isLastAyahOfSurah && rand < 0.25) {
        // Cross-surah continuation: show last ayah and ask what comes next
        partialText = fullText; // Show full ayah for cross-surah
        questionType = 'cross-surah';
      } else if (rand < 0.55) {
        // Middle-of-ayah excerpt (30% chance, or 55% if not last ayah)
        const startPos = Math.floor(words.length * 0.3);
        const endPos = Math.min(startPos + Math.ceil(words.length * 0.4), words.length);
        partialText = '... ' + words.slice(startPos, endPos).join(' ') + ' ...';
        questionType = 'middle';
      } else if (rand < 0.85) {
        // End-of-ayah excerpt (30% chance)
        const showCount = Math.max(3, Math.ceil(words.length * 0.3));
        partialText = '... ' + words.slice(-showCount).join(' ');
        questionType = 'end';
      } else {
        // Normal start excerpt (15% chance in difficult, or 40% if last ayah gets cross-surah)
        let showCount = Math.max(2, Math.ceil(words.length * 0.4));
        while (showCount < words.length) {
          const candidate = words.slice(0, showCount).join(' ');
          const isUnique = !allOtherTexts.some(t => t.startsWith(candidate));
          if (isUnique) break;
          showCount++;
        }
        partialText = showCount < words.length
          ? words.slice(0, showCount).join(' ') + ' ...'
          : fullText;
        questionType = 'normal';
      }
    } else {
      // Normal mode: Start with ~40% of words, keep adding words until unique in the range
      let showCount = Math.max(2, Math.ceil(words.length * 0.4));
      while (showCount < words.length) {
        const candidate = words.slice(0, showCount).join(' ');
        const isUnique = !allOtherTexts.some(t => t.startsWith(candidate));
        if (isUnique) break;
        showCount++;
      }
      partialText = showCount < words.length
        ? words.slice(0, showCount).join(' ') + ' ...'
        : fullText;
      questionType = 'normal';
    }

    // Get up to 3 following ayahs for the answer
    let followingAyahs: AyahData[] = [];
    
    // Check if this is the last ayah of the surah (cross-surah case)
    const isLastAyahOfSurah = selectedVerseIndex === selectedSurahVerses.length - 1;
    
    if (isLastAyahOfSurah && difficult && selectedSurahId < 114) {
      // Cross-surah: get first ayahs from next surah
      const nextSurahData = ayahData.find(s => s.number === selectedSurahId + 1);
      if (nextSurahData?.verses) {
        const nextSurahVerses = nextSurahData.verses.slice(0, 3);
        followingAyahs = nextSurahVerses.map(a => ({
          text: getVerseText(a.text),
          numberInSurah: a.numberInSurah ?? a.number,
          surahId: selectedSurahId + 1,
        }));
      }
    } else {
      // Normal case: get following ayahs from same surah
      const followingVerses = selectedSurahVerses.slice(selectedVerseIndex + 1, selectedVerseIndex + 4);
      followingAyahs = followingVerses.map(a => ({
        text: getVerseText(a.text),
        numberInSurah: a.numberInSurah ?? a.number,
        surahId: selectedSurahId,
      }));
    }

    setCurrentQuestion({
      questionAyah,
      partialText,
      followingAyahs,
      surahId: selectedSurahId,
      questionType,
      juz: questionVerse.juz,
    });

    setUsedHifzKeys(prev => new Set(prev).add(`${selectedSurahId}:${questionAyah.numberInSurah}`));
    setShowAnswer(false);
    setQuestionsCount(prev => prev + 1);
  }, [testRange, ayahData, getSurahsInJuzRange, difficult]);

  // Collect all verses in the selected range
  const getVersesInRange = useCallback(() => {
    if (!testRange || ayahData.length === 0) return [];

    let surahIds: number[] = [];
    if (testRange.type === 'surah') {
      surahIds = Array.from(
        { length: testRange.end - testRange.start + 1 },
        (_, i) => testRange.start + i
      );
    } else {
      surahIds = getSurahsInJuzRange(testRange.start, testRange.end);
    }

    const allVerses: { surahId: number; ayahNumber: number; text: string }[] = [];
    for (const sid of surahIds) {
      const sd = ayahData.find(s => s.number === sid);
      if (!sd?.verses) continue;
      for (const v of sd.verses) {
        allVerses.push({
          surahId: sid,
          ayahNumber: v.numberInSurah ?? v.number,
          text: getVerseText(v.text),
        });
      }
    }
    return allVerses;
  }, [testRange, ayahData, getSurahsInJuzRange]);

  // Find similar endings (الفواصل المتشابهة) - 2-word endings that repeat
  const findSimilarEndings = (verses: { surahId: number; ayahNumber: number; text: string }[]) => {
    const endingMap = new Map<string, TikrarOccurrence[]>();
    
    for (const verse of verses) {
      const words = verse.text.split(/\s+/).filter(w => w.length > 0);
      if (words.length < 2) continue;
      
      // Get last 2-3 words as ending
      for (let len = 2; len <= Math.min(3, words.length); len++) {
        const ending = words.slice(-len).join(' ');
        
        if (!endingMap.has(ending)) {
          endingMap.set(ending, []);
        }
        endingMap.get(ending)!.push({
          surahId: verse.surahId,
          ayahNumber: verse.ayahNumber,
          fullText: verse.text,
        });
      }
    }
    
    // Filter to endings that appear in multiple different ayahs (2+)
    const similarEndings: { phrase: string; occurrences: TikrarOccurrence[] }[] = [];
    endingMap.forEach((occs, ending) => {
      const unique = new Map<string, TikrarOccurrence>();
      for (const o of occs) {
        const key = `${o.surahId}:${o.ayahNumber}`;
        if (!unique.has(key)) unique.set(key, o);
      }
      const uniqueOccs = Array.from(unique.values());
      if (uniqueOccs.length >= 2) {
        similarEndings.push({ phrase: ending, occurrences: uniqueOccs });
      }
    });
    
    return similarEndings;
  };

  // Helper function to check if a phrase overlaps with any used phrases
  const isPhraseOverlapping = useCallback((phrase: string, usedPhrases: Set<string>): boolean => {
    for (const used of usedPhrases) {
      // Check if new phrase is substring of used phrase OR used phrase is substring of new phrase
      if (phrase.includes(used) || used.includes(phrase)) {
        return true;
      }
    }
    return false;
  }, []);

  // Generate a tikrar (repetition) question
  const generateTikrarQuestion = useCallback(() => {
    if (!testRange || ayahData.length === 0) return;

    const allVerses = getVersesInRange();
    if (allVerses.length === 0) return;

    // DIFFICULT MODE: 70% chance to use similar endings (الفواصل المتشابهة)
    const useDifficultMode = difficult && Math.random() < 0.7;
    
    if (useDifficultMode) {
      // الفواصل المتشابهة - Find similar endings (2-3 word endings that repeat)
      const similarEndings = findSimilarEndings(allVerses);
      if (similarEndings.length > 0) {
        // Filter to phrases not yet used and not overlapping with used phrases
        let available = similarEndings.filter(e => 
          !usedTikrarPhrases.has(e.phrase) && !isPhraseOverlapping(e.phrase, usedTikrarPhrases)
        );
        
        // Further filter to only include phrases with unseen ayahs
        available = available.map(e => ({
          ...e,
          occurrences: e.occurrences.filter(occ => !usedTikrarAyahs.has(`${occ.surahId}:${occ.ayahNumber}`))
        })).filter(e => e.occurrences.length >= 2); // Need at least 2 unseen ayahs
        
        if (available.length === 0) {
          // All questions exhausted
          setAllTestsCompleted(true);
          setCurrentTikrar(null);
          setCurrentQuestion(null);
          return;
        }
        
        const pick = available[Math.floor(Math.random() * available.length)];
        setCurrentTikrar({
          phrase: pick.phrase,
          occurrences: pick.occurrences,
          questionType: 'similar-ending',
        });
        setCurrentQuestion(null);
        setUsedTikrarPhrases(prev => new Set(prev).add(pick.phrase));
        // Mark ayahs as used when answer is shown (in handleShowAnswer)
        setShowAnswer(false);
        setQuestionsCount(prev => prev + 1);
        return;
      }
    }

    // NORMAL MODE or fallback if difficult mode didn't find anything
    // Build a map of multi-word phrases
    // Default: 4 words (at least 4 words)
    // Difficult: 2-3 words (at most 3 words)
    const phraseMap = new Map<string, TikrarOccurrence[]>();
    const minWords = difficult ? 2 : 4;
    const maxWords = difficult ? 3 : 4;

    for (const verse of allVerses) {
      const words = verse.text.split(/\s+/);
      const seenPhrases = new Set<string>(); // avoid counting same phrase twice in same ayah
      for (let len = minWords; len <= Math.min(maxWords, words.length); len++) {
        for (let i = 0; i <= words.length - len; i++) {
          const phrase = words.slice(i, i + len).join(' ');
          if (seenPhrases.has(phrase)) continue;
          seenPhrases.add(phrase);

          if (!phraseMap.has(phrase)) {
            phraseMap.set(phrase, []);
          }
          phraseMap.get(phrase)!.push({
            surahId: verse.surahId,
            ayahNumber: verse.ayahNumber,
            fullText: verse.text,
          });
        }
      }
    }

    // Filter to phrases that appear in multiple DIFFERENT ayahs (different surah or different ayah number)
    const repeatedPhrases: { phrase: string; occurrences: TikrarOccurrence[] }[] = [];
    phraseMap.forEach((occs, phrase) => {
      // Deduplicate by surahId+ayahNumber
      const unique = new Map<string, TikrarOccurrence>();
      for (const o of occs) {
        const key = `${o.surahId}:${o.ayahNumber}`;
        if (!unique.has(key)) unique.set(key, o);
      }
      const uniqueOccs = Array.from(unique.values());
      if (uniqueOccs.length >= 2) {
        repeatedPhrases.push({ phrase, occurrences: uniqueOccs });
      }
    });

    if (repeatedPhrases.length === 0) {
      // Fallback: no repeated phrases found
      setAllTestsCompleted(true);
      setCurrentTikrar(null);
      return;
    }

    // Filter out already-used phrases and overlapping phrases
    let available = repeatedPhrases.filter(p => 
      !usedTikrarPhrases.has(p.phrase) && !isPhraseOverlapping(p.phrase, usedTikrarPhrases)
    );
    
    // Further filter to only include phrases with unseen ayahs
    available = available.map(p => ({
      ...p,
      occurrences: p.occurrences.filter(occ => !usedTikrarAyahs.has(`${occ.surahId}:${occ.ayahNumber}`))
    })).filter(p => p.occurrences.length >= 2); // Need at least 2 unseen ayahs
    
    if (available.length === 0) {
      // All phrases exhausted
      setAllTestsCompleted(true);
      setCurrentTikrar(null);
      return;
    }

    // Pick a random repeated phrase
    const pick = available[Math.floor(Math.random() * available.length)];
    setCurrentTikrar({
      phrase: pick.phrase,
      occurrences: pick.occurrences,
      questionType: 'normal',
    });
    setCurrentQuestion(null);
    setUsedTikrarPhrases(prev => new Set(prev).add(pick.phrase));
    setShowAnswer(false);
    setQuestionsCount(prev => prev + 1);
  }, [testRange, ayahData, getVersesInRange, difficult, usedTikrarPhrases, usedTikrarAyahs, isPhraseOverlapping, findSimilarEndings]);

  const handleStartTest = (range: TestRange) => {
    setTestRange(range);
    setTestMode(range.testMode);
    setDifficult(range.difficult);
    setQuestionsCount(0);
    setCurrentQuestion(null);
    setCurrentTikrar(null);
    setUsedHifzKeys(new Set());
    setUsedTikrarPhrases(new Set());
    setUsedTikrarAyahs(new Set());
    setAllTestsCompleted(false);
  };

  const handleNextQuestion = () => {
    setHintLevel(0);
    if (testMode === 'tikrar') {
      generateTikrarQuestion();
    } else {
      generateQuestion();
    }
  };

  const handleShowHint = () => {
    const maxHints = currentQuestion?.questionType === 'normal' ? 3 : 4;
    if (hintLevel < maxHints) {
      setHintLevel(prev => prev + 1);
    }
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    setHintLevel(0);
    
    // Mark tikrar ayahs as used when answer is shown
    if (testMode === 'tikrar' && currentTikrar) {
      const newUsedAyahs = new Set(usedTikrarAyahs);
      currentTikrar.occurrences.forEach(occ => {
        newUsedAyahs.add(`${occ.surahId}:${occ.ayahNumber}`);
      });
      setUsedTikrarAyahs(newUsedAyahs);
    }
  };

  // Auto-generate first question when test range is set and ayah data is loaded
  useEffect(() => {
    if (testRange && ayahData.length > 0 && !currentQuestion && !currentTikrar) {
      if (testMode === 'tikrar') {
        generateTikrarQuestion();
      } else {
        generateQuestion();
      }
    }
  }, [testRange, ayahData, currentQuestion, currentTikrar, testMode, generateQuestion, generateTikrarQuestion]);

  const getSurahName = (surahId: number) => {
    const surah = surahs.find(s => s.id === surahId);
    return language === 'ar' ? surah?.name : surah?.englishName;
  };

  return (
    <div className={cn(
      "min-h-screen bg-[#FBF9F4]",
      "dark:from-gray-900 dark:via-gray-800 dark:to-gray-900",
      isRTL ? "rtl" : "ltr"
    )}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
            {t('testFeature')}
          </h1>
          <Button
            onClick={() => setSettingsOpen(true)}
            className="bg-emerald-700 hover:bg-emerald-800 rounded-lg border border-emerald-600 shadow-md text-[#F2E3BB] w-10 h-10 p-0 flex items-center justify-center"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Test Content */}
        {!testRange ? (
          <Card className="p-8 text-center space-y-4 bg-white dark:bg-gray-800 border-0 shadow-md">
            <Button
              onClick={() => setSettingsOpen(true)}
              className="bg-emerald-700 hover:bg-emerald-800 text-[#F2E3BB] text-base md:text-xl rounded-lg border border-emerald-600 shadow-md"
            >
              <Settings className={cn("w-5 h-5", isRTL ? "ml-2" : "mr-2")} />
              {t('testSettings')}
            </Button>
          </Card>
        ) : (currentQuestion || currentTikrar) ? (
          <div className="flex flex-col h-[calc(100vh-12rem)] md:h-auto md:space-y-6">
            {/* Question Counter */}
            <div className="text-center flex-shrink-0">
              <p className="text-base md:text-xl text-emerald-600 dark:text-emerald-400 font-medium">
                {t('currentQuestion')}: {formatNumber(questionsCount)}
              </p>
            </div>

            {/* Hifz Mode */}
            {testMode === 'hifz' && currentQuestion && (
              <>
                {/* Question Section - Fixed at Top */}
                <Card className="p-6 md:p-8 border-0 bg-white dark:bg-gray-800 shadow-md flex-shrink-0">
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-emerald-800 dark:text-emerald-400 text-center">
                      {t('identifyAyah')}
                    </h2>
                    {currentQuestion.questionType && currentQuestion.questionType !== 'normal' && (
                      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                        {t('difficultMode')}
                      </span>
                    )}
                  </div>
                  
                  {/* Partial Ayah (Question) */}
                  <div className={cn(
                    "p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800",
                    "text-right"
                  )}>
                    <p
                      className="text-2xl md:text-3xl leading-relaxed font-amiri text-gray-800 dark:text-gray-200"
                      style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif" }}
                    >
                      {currentQuestion.partialText}
                    </p>
                  </div>

                  {/* Hints */}
                  {!showAnswer && hintLevel > 0 && (
                    <div className="mt-4 space-y-2">
                      {/* For difficult questions: show type as first hint */}
                      {hintLevel >= 1 && currentQuestion.questionType && currentQuestion.questionType !== 'normal' && (
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                          <p className="text-base md:text-lg font-semibold text-blue-700 dark:text-blue-300">
                            {language === 'ar' ? 'تلميح' : 'Hint'} {formatNumber(1)}: {t('questionType')} - 
                            {currentQuestion.questionType === 'middle' && (language === 'ar' ? ' مقطع من وسط الآية' : ' Middle-of-ayah excerpt')}
                            {currentQuestion.questionType === 'end' && (language === 'ar' ? ' مقطع من نهاية الآية' : ' End-of-ayah excerpt')}
                            {currentQuestion.questionType === 'cross-surah' && (language === 'ar' ? ' وصل بين السور' : ' Cross-surah continuation')}
                          </p>
                        </div>
                      )}
                      {/* Juz hint - show at level 2 for difficult, level 1 for normal */}
                      {((currentQuestion.questionType !== 'normal' && hintLevel >= 2) || (currentQuestion.questionType === 'normal' && hintLevel >= 1)) && currentQuestion.juz && (
                        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                          <p className="text-base md:text-lg font-semibold text-purple-700 dark:text-purple-300">
                            {language === 'ar' ? 'تلميح' : 'Hint'} {formatNumber(currentQuestion.questionType === 'normal' ? 1 : 2)}: {t('juz')} {formatNumber(currentQuestion.juz)}
                          </p>
                        </div>
                      )}
                      {/* Surah hint - show at level 3 for difficult, level 2 for normal */}
                      {((currentQuestion.questionType !== 'normal' && hintLevel >= 3) || (currentQuestion.questionType === 'normal' && hintLevel >= 2)) && (
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                          <p className="text-base md:text-lg font-semibold text-green-700 dark:text-green-300">
                            {language === 'ar' ? 'تلميح' : 'Hint'} {formatNumber(currentQuestion.questionType === 'normal' ? 2 : 3)}: {t('surahName')}: {getSurahName(currentQuestion.surahId)}
                          </p>
                        </div>
                      )}
                      {/* Full Ayah hint - show at level 4 for difficult, level 3 for normal */}
                      {((currentQuestion.questionType !== 'normal' && hintLevel >= 4) || (currentQuestion.questionType === 'normal' && hintLevel >= 3)) && (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                          <p className="text-base md:text-lg font-semibold text-amber-700 dark:text-amber-300 mb-2">
                            {language === 'ar' ? 'تلميح' : 'Hint'} {formatNumber(currentQuestion.questionType === 'normal' ? 3 : 4)}: {t('fullAyah')}
                          </p>
                          <p
                            className="text-xl md:text-2xl leading-relaxed font-amiri text-gray-800 dark:text-gray-200 text-right"
                            style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif" }}
                          >
                            {currentQuestion.questionAyah.text}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* Answer Section - Scrollable */}
                {showAnswer && (
                  <div className="mt-4 flex-1 overflow-y-auto md:max-h-[60vh] md:flex-none">
                    {/* Full Ayah + Following Ayahs */}
                    <div className={cn(
                      "p-6 rounded-lg bg-emerald-50 dark:bg-gray-700 border border-emerald-200 dark:border-emerald-800",
                      "text-right"
                    )}>
                      {/* Surah Name - Ayah Number Header */}
                      <div className="mb-4 pb-3 border-b border-emerald-300 dark:border-emerald-600">
                        <p className="text-lg md:text-xl font-bold text-emerald-800 dark:text-emerald-300 text-center">
                          {getSurahName(currentQuestion.surahId)} - {t('ayahNumber')} {formatNumber(currentQuestion.questionAyah.numberInSurah)}
                        </p>
                        {currentQuestion.followingAyahs.length > 0 && 
                         currentQuestion.followingAyahs[0].surahId !== currentQuestion.surahId && (
                          <p className="text-base text-blue-700 dark:text-blue-300 mt-1 font-semibold text-center">
                            {t('nextSurah')}: {getSurahName(currentQuestion.followingAyahs[0].surahId)}
                          </p>
                        )}
                      </div>

                      <div className="text-2xl md:text-3xl font-amiri text-gray-800 dark:text-gray-200"
                           style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif", lineHeight: "2.5" }}>
                        {/* Question Ayah */}
                        <span>{currentQuestion.questionAyah.text}</span>
                        <span 
                          className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 mx-2 my-1 align-middle bg-center bg-no-repeat bg-contain"
                          style={{ 
                            backgroundImage: 'url(/assets/ayah.svg)',
                            filter: 'invert(38%) sepia(55%) saturate(654%) hue-rotate(116deg) brightness(80%) contrast(130%) drop-shadow(0 0 0.5px currentColor)'
                          }}
                        >
                          <span className="text-emerald-800 dark:text-emerald-200 text-base md:text-lg font-bold mt-0.5">
                            {formatNumber(currentQuestion.questionAyah.numberInSurah)}
                          </span>
                        </span>
                        
                        {/* Following Ayahs */}
                        {currentQuestion.followingAyahs.map((ayah, index) => (
                          <span key={index}>
                            {index === 0 && ayah.surahId !== currentQuestion.surahId && (
                              <span className="block text-sm font-bold text-blue-600 dark:text-blue-400 my-4">
                                {getSurahName(ayah.surahId)}
                              </span>
                            )}
                            <span>{ayah.text}</span>
                            <span 
                              className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 mx-2 my-1 align-middle bg-center bg-no-repeat bg-contain"
                              style={{ 
                                backgroundImage: 'url(/assets/ayah.svg)',
                                filter: 'invert(38%) sepia(55%) saturate(654%) hue-rotate(116deg) brightness(80%) contrast(130%) drop-shadow(0 0 0.5px currentColor)'
                              }}
                            >
                              <span className="text-emerald-800 dark:text-emerald-200 text-base md:text-lg font-bold mt-0.5">
                                {formatNumber(ayah.numberInSurah)}
                              </span>
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Tikrar Mode */}
            {testMode === 'tikrar' && currentTikrar && (
              <>
                {/* Question Section - Fixed at Top */}
                <Card className="p-6 md:p-8 border-0 bg-white dark:bg-gray-800 shadow-md flex-shrink-0">
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-blue-800 dark:text-blue-400 text-center">
                      {currentTikrar.questionType === 'similar-ending' 
                        ? (language === 'ar' ? 'في أي آيات وردت هذه الخاتمة؟' : 'Which ayahs use this ending?')
                        : t('tikrarQuestion')}
                    </h2>
                    {currentTikrar.questionType === 'similar-ending' && (
                      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                        {language === 'ar' ? 'فواصل' : 'Endings'}
                      </span>
                    )}
                  </div>
                  
                  {/* Repeated Phrase or Similar Ending */}
                  <div className={cn(
                    "p-6 rounded-lg bg-blue-50 dark:bg-gray-700",
                    "text-right"
                  )}>
                    <p
                      className="text-2xl md:text-3xl leading-relaxed font-amiri text-gray-800 dark:text-gray-200 text-center"
                      style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif" }}
                    >
                      {currentTikrar.phrase}
                    </p>
                    {currentTikrar.questionType === 'similar-ending' && (
                      <p className="text-xs text-blue-500 dark:text-blue-400 text-center mt-2">
                        {language === 'ar' ? '(خاتمة الآية)' : '(Ayah Ending)'}
                      </p>
                    )}
                    <p className="text-sm text-blue-600 dark:text-blue-400 text-center mt-3">
                      {t('appearsIn')} {formatNumber(currentTikrar.occurrences.length)} {t('occurrences')}
                    </p>
                  </div>

                  {/* Hint Section - Show Surahs */}
                  {!showAnswer && hintLevel >= 1 && (
                    <div className="mt-6 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                      <p className="text-base md:text-lg font-semibold text-purple-700 dark:text-purple-300 mb-3">
                        {language === 'ar' ? 'تلميح' : 'Hint'}: {t('surahNames')}
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {Array.from(new Set(currentTikrar.occurrences.map(o => o.surahId)))
                          .sort((a, b) => a - b)
                          .map((surahId) => (
                            <span
                              key={surahId}
                              className="px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-800/40 text-purple-800 dark:text-purple-200 font-medium text-base md:text-lg"
                            >
                              {getSurahName(surahId)}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </Card>

                {/* Answer Section - Scrollable */}
                {showAnswer && (
                  <div className="mt-4 flex-1 overflow-y-auto space-y-3 px-1 md:max-h-[60vh] md:flex-none">
                    {currentTikrar.occurrences.map((occ, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg bg-emerald-50 dark:bg-gray-700 border border-emerald-200 dark:border-emerald-800 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base md:text-lg font-bold text-emerald-700 dark:text-emerald-300">
                            {getSurahName(occ.surahId)} - {t('ayahNumber')} {formatNumber(occ.ayahNumber)}
                          </span>
                          <span className="text-xs text-gray-500 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                            {formatNumber(index + 1)}
                          </span>
                        </div>
                        <p
                          className="text-xl md:text-2xl leading-relaxed font-amiri text-gray-800 dark:text-gray-200 text-right"
                          style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif" }}
                        >
                          {highlightText(occ.fullText, currentTikrar.phrase)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center flex-wrap mt-4 flex-shrink-0">
              {!showAnswer ? (
                <>
                  {/* Show hint button for hifz mode or tikrar mode */}
                  {(testMode === 'hifz' && ((currentQuestion?.questionType !== 'normal' && hintLevel < 4) || (currentQuestion?.questionType === 'normal' && hintLevel < 3))) || 
                   (testMode === 'tikrar' && hintLevel < 1) ? (
                    <Button
                      onClick={handleShowHint}
                      size="lg"
                      className="bg-emerald-700 hover:bg-emerald-800 text-[#F2E3BB] text-base md:text-xl rounded-lg border border-emerald-600 shadow-md"
                    >
                      <Lightbulb className={cn("w-5 h-5", isRTL ? "ml-2" : "mr-2")} />
                      {t('hint')}
                    </Button>
                  ) : null}
                  <Button
                    onClick={handleShowAnswer}
                    size="lg"
                    className="bg-emerald-700 hover:bg-emerald-800 text-[#F2E3BB] text-base md:text-xl rounded-lg border border-emerald-600 shadow-md"
                  >
                    <Eye className={cn("w-5 h-5", isRTL ? "ml-2" : "mr-2")} />
                    {t('showAnswer')}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleNextQuestion}
                  size="lg"
                  className="bg-emerald-700 hover:bg-emerald-800 text-[#F2E3BB] text-base md:text-xl rounded-lg border border-emerald-600 shadow-md"
                >
                  {t('nextQuestion')}
                  {isRTL ? (
                    <ArrowLeft className="w-5 h-5 ml-2" />
                  ) : (
                    <ArrowRight className="w-5 h-5 mr-2" />
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : allTestsCompleted && testRange ? (
          <Card className="p-8 text-center border-0 bg-white dark:bg-gray-800 shadow-md space-y-4">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-800 dark:text-emerald-300">
              {language === 'ar' ? 'أحسنت!' : 'Excellent!'}
            </h2>
            <p className="text-lg md:text-xl text-emerald-700 dark:text-emerald-400">
              {language === 'ar' ? 'لقد أكملت جميع الأسئلة!' : 'Test Completed!'}
            </p>
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-400">
              {language === 'ar' ? 'لقد أجبت على جميع الأسئلة المتاحة في هذا النطاق' : 'You have answered all available questions in this range'}
            </p>
            <Button
              onClick={() => {
                setUsedTikrarPhrases(new Set());
                setUsedTikrarAyahs(new Set());
                setUsedHifzKeys(new Set());
                setAllTestsCompleted(false);
                setQuestionsCount(0);
                if (testMode === 'tikrar') {
                  generateTikrarQuestion();
                } else {
                  generateQuestion();
                }
              }}
              size="lg"
              className="bg-emerald-700 hover:bg-emerald-800 text-[#F2E3BB] text-base md:text-xl rounded-lg border border-emerald-600 shadow-md mt-4"
            >
              {language === 'ar' ? 'ابدأ من جديد' : 'Start Over'}
            </Button>
          </Card>
        ) : isAyahDataLoading ? (
          <Card className="p-8 text-center border-0 bg-white dark:bg-gray-800 shadow-md">
            <p className="text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('loadingTafseer')}...
            </p>
          </Card>
        ) : (
          <Card className="p-8 text-center border-0 bg-white dark:bg-gray-800 shadow-md">
            <p className="text-base md:text-xl text-emerald-800 dark:text-emerald-300">
              {t('configure')} {t('testSettings')}
            </p>
          </Card>
        )}
      </div>

      {/* Settings Dialog */}
      <TestSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onStart={handleStartTest}
      />
    </div>
  );
}
