import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ASSETS_BASE_URL } from '@/config/assets';
import { getAudioData } from '@/lib/quran-data-service';
import { surahs } from '@/data/surahs';

interface CurrentAyah {
  surah: number;
  ayah: number;
}

interface Reciter {
  folder: string;
  name: string;
  nameAr: string;
  baseUrl: string;
  reading: string;
  style: string;
  quality: string;
}

interface UseAudioPlayerProps {
  currentPageNum: number;
  currentSurahId: number;
  currentPageAyah: number | null;
  ayahData: any[];
  isAyahNavigation: React.MutableRefObject<boolean>;
}

export const useAudioPlayer = ({
  currentPageNum,
  currentSurahId,
  currentPageAyah,
  ayahData,
  isAyahNavigation
}: UseAudioPlayerProps) => {
  const navigate = useNavigate();
  
  // Audio state
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [preloadAudioElement, setPreloadAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<CurrentAyah | null>(null);
  
  // Wake Lock state to prevent screen sleep during playback
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  
  // Reciter state
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null);
  const [filteredReciters, setFilteredReciters] = useState<Reciter[]>([]);
  const [uniqueReciterNames, setUniqueReciterNames] = useState<{name: string, nameAr: string}[]>([]);
  
  // Filter state
  const [filterReciterName, setFilterReciterName] = useState<string>('all');
  const [filterReading, setFilterReading] = useState<string>('all');
  const [filterStyle, setFilterStyle] = useState<string>('all');
  const [filterQuality, setFilterQuality] = useState<string>('all');
  const [availableReadings, setAvailableReadings] = useState<string[]>([]);
  const [availableStyles, setAvailableStyles] = useState<string[]>([]);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  
  // Repeat state
  const [isRepeatActive, setIsRepeatActive] = useState(false);
  const [repeatPassageCount, setRepeatPassageCount] = useState(0);
  const [repeatAyahCount, setRepeatAyahCount] = useState(0);
  const [repeatStartSurah, setRepeatStartSurah] = useState(1);
  const [repeatStartAyah, setRepeatStartAyah] = useState(0);
  const [repeatEndSurah, setRepeatEndSurah] = useState(1);
  const [repeatEndAyah, setRepeatEndAyah] = useState(0);
  const [currentRepeatPassage, setCurrentRepeatPassage] = useState(0);
  const [currentRepeatAyah, setCurrentRepeatAyah] = useState(0);
  const [currentRepeatSurah, setCurrentRepeatSurah] = useState(0);
  const [currentRepeatAyahCount, setCurrentRepeatAyahCount] = useState(0);
  
  // Helper to extract base reciter name (remove style/quality suffixes)
  const extractBaseName = (name: string, nameAr: string) => {
    const cleanName = name
      .replace(/\s*-?\s*(Mujawwad|Murattal)\s*/gi, '')
      .replace(/\s*\(\d+kbps\)/gi, '')
      .trim();
    const cleanNameAr = nameAr
      .replace(/\s*-\s*(مجود|مرتل)\s*/g, '')
      .trim();
    return { name: cleanName, nameAr: cleanNameAr };
  };
  
  const extractBaseNameAr = (nameAr: string) => {
    return nameAr
      .replace(/\s*-\s*(مجود|مرتل)\s*/g, '')
      .trim();
  };
  
  // Request wake lock to prevent screen sleep during playback
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        // Release any existing wake lock first
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
        }
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Wake lock acquired for audio playback');
        
        // Re-acquire wake lock if visibility changes (user comes back to tab)
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Wake lock released');
        });
      } catch (err) {
        console.log('Wake lock request failed:', err);
      }
    }
  }, []);
  
  // Release wake lock when stopping audio
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake lock released');
      } catch (err) {
        console.log('Wake lock release failed:', err);
      }
    }
  }, []);
  
  // Get previous ayah in sequence
  const getPreviousAyah = useCallback((currentSurah: number, currentAyah: number): CurrentAyah | null => {
    if (currentAyah > 1) {
      return { surah: currentSurah, ayah: currentAyah - 1 };
    } else if (currentSurah > 1) {
      // Get last ayah of previous surah
      const prevSurahData = ayahData.find(s => s.number === currentSurah - 1);
      if (prevSurahData && prevSurahData.verses) {
        return { surah: currentSurah - 1, ayah: prevSurahData.verses.length };
      }
    }
    return null;
  }, [ayahData]);
  
  // Update Media Session API for Android/mobile notification controls
  const updateMediaSession = useCallback((surahNum: number, ayahNum: number, playing: boolean) => {
    if (!('mediaSession' in navigator)) return;
    
    const surah = surahs.find(s => s.id === surahNum);
    const surahName = surah?.name || `سورة ${surahNum}`;
    const surahEnglishName = surah?.englishName || `Surah ${surahNum}`;
    const reciterName = selectedReciter?.nameAr || selectedReciter?.name || 'Reciter';
    
    // Set metadata to keep notification visible
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${surahName} - آية ${ayahNum}`,
      artist: reciterName,
      album: surahEnglishName,
      artwork: [
        { src: `${import.meta.env.BASE_URL}icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${import.meta.env.BASE_URL}icon-512.png`, sizes: '512x512', type: 'image/png' },
      ]
    });
    
    // Set playback state
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [selectedReciter]);
  
  // Get next ayah in sequence
  const getNextAyah = useCallback((currentSurah: number, currentAyah: number): CurrentAyah | null => {
    if (ayahData.length === 0) return null;
    
    const surahData = ayahData.find(s => s.number === currentSurah);
    if (!surahData || !surahData.verses) return null;
    
    const totalAyahs = surahData.verses.length;
    
    if (currentAyah < totalAyahs) {
      return { surah: currentSurah, ayah: currentAyah + 1 };
    } else if (currentSurah < 114) {
      return { surah: currentSurah + 1, ayah: 1 };
    }
    
    return null;
  }, [ayahData]);
  
  // Preload next ayah audio for smooth playback
  const preloadNextAyah = useCallback((currentSurah: number, currentAyah: number) => {
    if (!preloadAudioElement || !selectedReciter) return;
    
    const nextAyah = getNextAyah(currentSurah, currentAyah);
    if (!nextAyah) return;
    
    const surahPadded = nextAyah.surah.toString().padStart(3, '0');
    const ayahPadded = nextAyah.ayah.toString().padStart(3, '0');
    const audioUrl = `${selectedReciter.baseUrl}/${surahPadded}${ayahPadded}.mp3`;
    
    preloadAudioElement.src = audioUrl;
    preloadAudioElement.load();
  }, [preloadAudioElement, selectedReciter, getNextAyah]);
  
  // Play specific ayah
  const playAyah = useCallback((surahNum: number, ayahNum: number) => {
    if (!audioElement || !selectedReciter) return;
    
    // Persist selected reciter
    if (selectedReciter.folder) {
      localStorage.setItem('quran-last-reciter', selectedReciter.folder);
    }
    
    const surahPadded = surahNum.toString().padStart(3, '0');
    const ayahPadded = ayahNum.toString().padStart(3, '0');
    const audioUrl = `${selectedReciter.baseUrl}/${surahPadded}${ayahPadded}.mp3`;
    
    setCurrentPlayingAyah({ surah: surahNum, ayah: ayahNum });
    
    // Keep playing state true to prevent button flashing
    setIsPlaying(true);
    
    // Update Media Session for Android notification
    updateMediaSession(surahNum, ayahNum, true);
    
    // Request wake lock to prevent screen sleep
    requestWakeLock();
    
    // Navigate to the page containing this ayah if not already on it
    const surahData = ayahData.find(s => s.number === surahNum);
    if (surahData && surahData.verses) {
      const verse = surahData.verses.find((v: any) => v.number === ayahNum);
      if (verse && verse.page && verse.page !== currentPageNum) {
        isAyahNavigation.current = true;
        audioElement.src = audioUrl;
        navigate(`/page/${verse.page}#${surahNum}-${ayahNum}`);
        
        setTimeout(() => {
          if (audioElement && audioElement.src === audioUrl) {
            audioElement.play().catch(err => {
              console.error('Failed to play audio:', err);
              setIsPlaying(false);
            });
            preloadNextAyah(surahNum, ayahNum);
          }
          isAyahNavigation.current = false;
        }, 300);
        
        return;
      }
    }
    
    // Same page - play immediately
    audioElement.src = audioUrl;
    audioElement.play().catch(err => {
      console.error('Failed to play audio:', err);
      setIsPlaying(false);
    });
    preloadNextAyah(surahNum, ayahNum);
  }, [audioElement, selectedReciter, ayahData, currentPageNum, navigate, preloadNextAyah, isAyahNavigation, updateMediaSession, requestWakeLock]);
  
  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
      // Update media session to paused
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    } else {
      if (currentPlayingAyah) {
        if (audioElement.src && audioElement.currentTime > 0) {
          setIsPlaying(true);
          // Update media session to playing
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
          audioElement.play()
            .then(() => {
              preloadNextAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
            })
            .catch(err => {
              console.error('Failed to resume audio:', err);
              setIsPlaying(false);
              playAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
            });
        } else {
          playAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
        }
      } else {
        playAyah(currentSurahId, currentPageAyah || 1);
      }
    }
  }, [audioElement, isPlaying, currentPlayingAyah, playAyah, preloadNextAyah, currentSurahId, currentPageAyah]);
  
  // Stop audio
  const stopAudio = useCallback(() => {
    if (!audioElement) return;
    audioElement.pause();
    audioElement.currentTime = 0;
    setIsPlaying(false);
    setIsRepeatActive(false);
    setCurrentRepeatPassage(0);
    setCurrentRepeatAyah(0);
    setCurrentRepeatSurah(0);
    setCurrentRepeatAyahCount(0);
    // Clear media session
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
    // Release wake lock
    releaseWakeLock();
  }, [audioElement, releaseWakeLock]);
  
  // Start repeat mode
  const startRepeat = useCallback(() => {
    const passageCount = repeatPassageCount || 1;
    const ayahCount = repeatAyahCount || 1;
    const startSurah = repeatStartSurah || 1;
    const startAyah = repeatStartAyah || 1;
    
    setIsRepeatActive(true);
    setCurrentRepeatPassage(1);
    setCurrentRepeatSurah(startSurah);
    setCurrentRepeatAyah(startAyah);
    setCurrentRepeatAyahCount(1);
    playAyah(startSurah, startAyah);
  }, [repeatPassageCount, repeatAyahCount, repeatStartSurah, repeatStartAyah, playAyah]);
  
  // Handle audio ended (for continuous playback and repeat)
  const handleAudioEnded = useCallback(() => {
    if (isRepeatActive && currentPlayingAyah) {
      // Handle repeat logic
      if (currentRepeatAyahCount < repeatAyahCount) {
        // Repeat the same ayah
        setCurrentRepeatAyahCount(prev => prev + 1);
        playAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
        return;
      }
      
      // Move to next ayah
      let nextSurah = currentRepeatSurah;
      let nextAyah = currentRepeatAyah + 1;
      
      // Check if we need to move to next surah
      const currentSurahData = ayahData.find(s => s.number === nextSurah);
      if (currentSurahData && nextAyah > currentSurahData.verses.length) {
        nextSurah += 1;
        nextAyah = 1;
      }
      
      // Check if we've reached the end of the repeat range
      const isEndReached = (nextSurah > repeatEndSurah) || 
                          (nextSurah === repeatEndSurah && nextAyah > repeatEndAyah);
      
      if (isEndReached) {
        // Check if we need to repeat the passage
        if (currentRepeatPassage < repeatPassageCount) {
          // Repeat the passage
          setCurrentRepeatPassage(prev => prev + 1);
          setCurrentRepeatSurah(repeatStartSurah);
          setCurrentRepeatAyah(repeatStartAyah);
          setCurrentRepeatAyahCount(1);
          playAyah(repeatStartSurah, repeatStartAyah);
        } else {
          // Repeat finished - stop playback
          setIsPlaying(false);
          setIsRepeatActive(false);
          setCurrentRepeatPassage(0);
          setCurrentRepeatAyah(0);
          setCurrentRepeatSurah(0);
          setCurrentRepeatAyahCount(0);
        }
      } else {
        // Continue with next ayah
        setCurrentRepeatSurah(nextSurah);
        setCurrentRepeatAyah(nextAyah);
        setCurrentRepeatAyahCount(1);
        playAyah(nextSurah, nextAyah);
      }
      return;
    }
    
    if (!currentPlayingAyah || !ayahData.length) {
      setIsPlaying(false);
      return;
    }
    
    // Find current surah data
    const currentSurahData = ayahData.find(s => s.number === currentPlayingAyah.surah);
    if (!currentSurahData || !currentSurahData.verses) {
      setIsPlaying(false);
      return;
    }
    
    const totalAyahs = currentSurahData.verses.length;
    const currentAyahNum = currentPlayingAyah.ayah;
    
    // Check if there's a next ayah in the current surah
    if (currentAyahNum < totalAyahs) {
      // Play next ayah in the same surah
      const nextAyahNum = currentAyahNum + 1;
      playAyah(currentPlayingAyah.surah, nextAyahNum);
    } else {
      // Current surah finished, check if there's a next surah
      if (currentPlayingAyah.surah < 114) {
        // Play first ayah of next surah
        const nextSurahNum = currentPlayingAyah.surah + 1;
        playAyah(nextSurahNum, 1);
      } else {
        // Last ayah of last surah - stop playback
        setIsPlaying(false);
      }
    }
  }, [isRepeatActive, currentPlayingAyah, currentRepeatAyahCount, repeatAyahCount, currentRepeatSurah, currentRepeatAyah, ayahData, currentRepeatPassage, repeatPassageCount, repeatStartSurah, repeatStartAyah, repeatEndSurah, repeatEndAyah, playAyah]);
  
  // Initialize audio elements
  useEffect(() => {
    const audio = new Audio();
    setAudioElement(audio);
    
    const preloadAudio = new Audio();
    setPreloadAudioElement(preloadAudio);
    
    return () => {
      audio.pause();
      audio.remove();
      preloadAudio.pause();
      preloadAudio.remove();
    };
  }, []);
  
  // Set up Media Session action handlers for Android notification controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    
    // Play action
    navigator.mediaSession.setActionHandler('play', () => {
      if (audioElement && currentPlayingAyah) {
        audioElement.play().catch(console.error);
        setIsPlaying(true);
        navigator.mediaSession.playbackState = 'playing';
      }
    });
    
    // Pause action
    navigator.mediaSession.setActionHandler('pause', () => {
      if (audioElement) {
        audioElement.pause();
        setIsPlaying(false);
        navigator.mediaSession.playbackState = 'paused';
      }
    });
    
    // Previous track action - go to previous ayah
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (currentPlayingAyah) {
        const prevAyah = getPreviousAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
        if (prevAyah) {
          playAyah(prevAyah.surah, prevAyah.ayah);
        }
      }
    });
    
    // Next track action - go to next ayah
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (currentPlayingAyah) {
        const nextAyah = getNextAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
        if (nextAyah) {
          playAyah(nextAyah.surah, nextAyah.ayah);
        }
      }
    });
    
    // Cleanup - remove action handlers
    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      } catch (e) {
        // Some browsers might not support removing handlers
      }
    };
  }, [audioElement, currentPlayingAyah, playAyah, getNextAyah, getPreviousAyah]);
  
  // Re-acquire wake lock when page becomes visible (after screen unlock or tab switch)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isPlaying) {
        // Re-acquire wake lock when page becomes visible and audio is playing
        await requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Release wake lock on cleanup
      releaseWakeLock();
    };
  }, [isPlaying, requestWakeLock, releaseWakeLock]);
  
  // Load reciters from audio.json
  useEffect(() => {
    getAudioData()
      .then(data => {
        setReciters(data);
        
        // Extract unique reciter names
        const uniqueNames = new Map();
        data.forEach((reciter: Reciter) => {
          const baseName = extractBaseName(reciter.name, reciter.nameAr);
          if (!uniqueNames.has(baseName.nameAr)) {
            uniqueNames.set(baseName.nameAr, baseName);
          }
        });
        setUniqueReciterNames(Array.from(uniqueNames.values()));
        
        // Load last selected reciter or use default
        const lastReciterFolder = localStorage.getItem('quran-last-reciter');
        let reciterToSet = null;
        
        if (lastReciterFolder) {
          reciterToSet = data.find((r: Reciter) => r.folder === lastReciterFolder);
        }
        
        if (!reciterToSet) {
          reciterToSet = data.find((r: Reciter) => r.folder === 'Minshawy_Murattal_128kbps')
            || data.find((r: Reciter) => r.folder === 'Minshawy_Mujawwad_192kbps')
            || data.find((r: Reciter) => r.folder === 'Abdul_Basit_Murattal_192kbps')
            || data[0];
        }
        
        setSelectedReciter(reciterToSet);
        
        if (reciterToSet) {
          const baseNameAr = extractBaseNameAr(reciterToSet.nameAr);
          setFilterReciterName(baseNameAr);
          setFilterReading(reciterToSet.reading);
          setFilterStyle(reciterToSet.style);
          setFilterQuality(reciterToSet.quality);
        }
      })
      .catch(err => console.error('Failed to load reciters:', err));
  }, []);
  
  // Update audio element event listener when handleAudioEnded changes
  useEffect(() => {
    if (!audioElement) return;
    
    audioElement.removeEventListener('ended', handleAudioEnded);
    audioElement.addEventListener('ended', handleAudioEnded);
    
    return () => {
      audioElement.removeEventListener('ended', handleAudioEnded);
    };
  }, [audioElement, handleAudioEnded]);
  
  // Auto-set default filters and available options when reciter name is selected
  useEffect(() => {
    if (reciters.length === 0) return;
    
    if (filterReciterName === 'all') {
      setAvailableReadings(['hafs', 'warsh']);
      setAvailableStyles(['murattal', 'mujawwad']);
      setAvailableQualities(['192kbps', '128kbps', '64kbps', '48kbps', '40kbps', '32kbps', '16kbps']);
      return;
    }
    
    const reciterVariants = reciters.filter((r: Reciter) => 
      extractBaseNameAr(r.nameAr) === filterReciterName
    );
    
    if (reciterVariants.length > 0) {
      const readings = [...new Set(reciterVariants.map((r: Reciter) => r.reading))];
      const styles = [...new Set(reciterVariants.map((r: Reciter) => r.style))];
      const qualities = [...new Set(reciterVariants.map((r: Reciter) => r.quality))];
      
      setAvailableReadings(readings);
      setAvailableStyles(styles);
      setAvailableQualities(qualities);
      
      const qualityPriority = ['192kbps', '128kbps', '64kbps', '48kbps', '40kbps', '32kbps', '16kbps'];
      const bestQuality = qualityPriority.find(q => qualities.includes(q)) || qualities[0];
      
      setFilterReading(readings[0]);
      setFilterStyle(styles[0]);
      setFilterQuality(bestQuality);
    }
  }, [filterReciterName, reciters]);
  
  // Update available qualities when reading or style changes
  useEffect(() => {
    if (reciters.length === 0 || filterReciterName === 'all') return;
    
    const matchingVariants = reciters.filter((r: Reciter) => {
      const baseNameAr = extractBaseNameAr(r.nameAr);
      const matchesReciterName = baseNameAr === filterReciterName;
      const matchesReading = filterReading === 'all' || r.reading === filterReading;
      const matchesStyle = filterStyle === 'all' || r.style === filterStyle;
      
      return matchesReciterName && matchesReading && matchesStyle;
    });
    
    const qualities = [...new Set(matchingVariants.map((r: Reciter) => r.quality))];
    setAvailableQualities(qualities);
    
    if (!qualities.includes(filterQuality)) {
      const qualityPriority = ['192kbps', '128kbps', '64kbps', '48kbps', '40kbps', '32kbps', '16kbps'];
      const bestQuality = qualityPriority.find(q => qualities.includes(q)) || qualities[0];
      if (bestQuality) {
        setFilterQuality(bestQuality);
      }
    }
  }, [filterReciterName, filterReading, filterStyle, reciters, filterQuality]);
  
  // Filter reciters based on selection
  useEffect(() => {
    if (reciters.length === 0) return;
    
    const filtered = reciters.filter((reciter: Reciter) => {
      const baseNameAr = extractBaseNameAr(reciter.nameAr);
      const matchesReciterName = filterReciterName === 'all' || baseNameAr === filterReciterName;
      const matchesReading = filterReading === 'all' || reciter.reading === filterReading;
      const matchesStyle = filterStyle === 'all' || reciter.style === filterStyle;
      const matchesQuality = filterQuality === 'all' || reciter.quality === filterQuality;
      
      return matchesReciterName && matchesReading && matchesStyle && matchesQuality;
    });
    
    setFilteredReciters(filtered);
    
    // Auto-select reciter when filters result in a single match
    if (filtered.length === 1) {
      setSelectedReciter(filtered[0]);
      if (filtered[0].folder) {
        localStorage.setItem('quran-last-reciter', filtered[0].folder);
      }
    } else if (filtered.length > 0) {
      if (!selectedReciter || !filtered.find((r: Reciter) => r.folder === selectedReciter.folder)) {
        const qualityPriority = ['192kbps', '128kbps', '64kbps', '48kbps', '40kbps', '32kbps', '16kbps'];
        const bestMatch = qualityPriority
          .map(q => filtered.find((r: Reciter) => r.quality === q))
          .find(r => r !== undefined) || filtered[0];
        setSelectedReciter(bestMatch);
        if (bestMatch && bestMatch.folder) {
          localStorage.setItem('quran-last-reciter', bestMatch.folder);
        }
      }
    }
  }, [reciters, filterReciterName, filterReading, filterStyle, filterQuality, selectedReciter]);
  
  return {
    // Audio state
    audioElement,
    isPlaying,
    currentPlayingAyah,
    setCurrentPlayingAyah,
    
    // Reciter state
    reciters,
    selectedReciter,
    setSelectedReciter,
    filteredReciters,
    uniqueReciterNames,
    
    // Filter state
    filterReciterName,
    setFilterReciterName,
    filterReading,
    setFilterReading,
    filterStyle,
    setFilterStyle,
    filterQuality,
    setFilterQuality,
    availableReadings,
    availableStyles,
    availableQualities,
    
    // Repeat state
    isRepeatActive,
    setIsRepeatActive,
    repeatPassageCount,
    setRepeatPassageCount,
    repeatAyahCount,
    setRepeatAyahCount,
    repeatStartSurah,
    setRepeatStartSurah,
    repeatStartAyah,
    setRepeatStartAyah,
    repeatEndSurah,
    setRepeatEndSurah,
    repeatEndAyah,
    setRepeatEndAyah,
    currentRepeatPassage,
    currentRepeatAyah,
    currentRepeatSurah,
    currentRepeatAyahCount,
    
    // Audio control functions
    playAyah,
    togglePlayPause,
    stopAudio,
    startRepeat,
    preloadNextAyah
  };
};

