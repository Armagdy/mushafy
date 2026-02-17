import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ASSETS_BASE_URL } from '@/config/assets';
import { getAudioData } from '@/lib/quran-data-service';
import { getMp3QuranReciters, getAyahTiming, getSurahAudioUrl, getCurrentAyahFromTime, seekToAyah, type Mp3QuranReciter, type Mp3QuranMoshaf, type AyahTiming } from '@/lib/mp3quran-service';
import { surahs } from '@/data/surahs';
import { cacheAudio, getCachedAudio, cacheMp3QuranAudio, getCachedMp3QuranAudio } from '@/lib/audio-cache';
import { debugMediaSession } from '@/lib/media-session-debug';
import QuranMediaSession from '@/lib/quran-media-session';
import { Capacitor } from '@capacitor/core';

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

type AudioSource = 'everyayah' | 'mp3quran';

interface UseAudioPlayerProps {
  currentPageNum: number;
  currentSurahId: number;
  currentPageAyah: number | null;
  ayahData: any[];
  isAyahNavigation: React.MutableRefObject<boolean>;
  onSurahUnavailable?: (reason: 'unavailable' | 'completed') => void;
}

export const useAudioPlayer = ({
  currentPageNum,
  currentSurahId,
  currentPageAyah,
  ayahData,
  isAyahNavigation,
  onSurahUnavailable
}: UseAudioPlayerProps) => {
  const navigate = useNavigate();
  
  // Audio state
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [preloadAudioElement, setPreloadAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<CurrentAyah | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Web Audio API for concatenating ayahs
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [concatenatedBlobUrl, setConcatenatedBlobUrl] = useState<string | null>(null);
  const [concatenatedSurah, setConcatenatedSurah] = useState<number | null>(null);
  const [ayahTimestamps, setAyahTimestamps] = useState<number[]>([]);
  const [isPreloadingAyahs, setIsPreloadingAyahs] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  
  // Audio source selection
  const [audioSource, setAudioSource] = useState<AudioSource>(() => {
    return (localStorage.getItem('quran-audio-source') as AudioSource) || 'everyayah';
  });
  
  // MP3Quran state
  const [mp3QuranReciters, setMp3QuranReciters] = useState<Mp3QuranReciter[]>([]);
  const [mp3QuranRecitersAr, setMp3QuranRecitersAr] = useState<Mp3QuranReciter[]>([]);
  const [selectedMp3QuranReciter, setSelectedMp3QuranReciter] = useState<Mp3QuranReciter | null>(null);
  const [selectedMoshaf, setSelectedMoshaf] = useState<Mp3QuranMoshaf | null>(null);
  const [ayahTimings, setAyahTimings] = useState<AyahTiming[]>([]);
  const [currentSurahAudio, setCurrentSurahAudio] = useState<number | null>(null);
  
  // Wake Lock state to prevent screen sleep during playback
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  
  // AbortController to cancel ongoing preloading operations
  const preloadAbortControllerRef = useRef<AbortController | null>(null);
  
  // Track last time we updated native controls position (for throttling)
  const lastPositionUpdateRef = useRef<number>(0);
  
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
  
  // Concatenated repeat audio state
  const [repeatBlobUrl, setRepeatBlobUrl] = useState<string | null>(null);
  const [repeatAyahTimestamps, setRepeatAyahTimestamps] = useState<{surah: number; ayah: number; repetition: number; passage: number; startTime: number}[]>([]);
  const [isRepeatConcatenatedMode, setIsRepeatConcatenatedMode] = useState(false);
  
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
    
    // Clean reciter name by removing style indicators (مرتل, معلم, مجود, Murattal, Mujawwad, etc.)
    const cleanName = (name: string): string => {
      return name
        .replace(/\s*-\s*مرتل\s*/g, '')
        .replace(/\s*-\s*معلم\s*/g, '')
        .replace(/\s*-\s*مجود\s*/g, '')
        .replace(/\s*مرتل\s*/g, '')
        .replace(/\s*معلم\s*/g, '')
        .replace(/\s*مجود\s*/g, '')
        .replace(/\s*-?\s*Murattal\s*/gi, '')
        .replace(/\s*-?\s*Mujawwad\s*/gi, '')
        .replace(/\s*-?\s*Muallim\s*/gi, '')
        .replace(/\s*-?\s*Mo'lim\s*/gi, '')
        .replace(/\s*-?\s*Teacher\s*/gi, '')
        .trim();
    };
    
    const surah = surahs.find(s => s.id === surahNum);
    const surahName = surah?.name || `سورة ${surahNum}`;
    const surahEnglishName = surah?.englishName || `Surah ${surahNum}`;
    
    // For mp3quran: show "Reciter - Surah" since it's one continuous audio for entire surah
    // For everyayah: show "Surah - Ayah X" since ayahs are tracked individually
    let title: string;
    let artist: string;
    
    if (audioSource === 'mp3quran' && selectedMp3QuranReciter) {
      // MP3Quran: Reciter name as title, Surah as artist
      // Show both English and Arabic names: "English name - Arabic name"
      const arabicReciter = mp3QuranRecitersAr.find(r => r.id === selectedMp3QuranReciter.id);
      const englishName = cleanName(selectedMp3QuranReciter.name || 'Reciter');
      const arabicName = cleanName(arabicReciter?.name || '');
      const reciterName = arabicName ? `${englishName} - ${arabicName}` : englishName;
      title = reciterName;
      artist = surahName;
    } else {
      // EveryAyah: Reciter name as title, Surah - Ayah as artist (consistent with mp3quran)
      // Show both English and Arabic names: "English name - Arabic name"
      const englishName = cleanName(selectedReciter?.name || 'Reciter');
      const arabicName = cleanName(selectedReciter?.nameAr || '');
      const reciterName = arabicName ? `${englishName} - ${arabicName}` : englishName;
      title = reciterName;
      artist = `${surahName} - آية ${ayahNum}`;
    }
    
    // Set metadata to keep notification visible
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: artist,
      album: surahEnglishName,
      artwork: [
        { src: `${import.meta.env.BASE_URL}icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${import.meta.env.BASE_URL}icon-512.png`, sizes: '512x512', type: 'image/png' },
      ]
    });
    
    // Set playback state
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    
    // Update position state for progress tracking in notifications
    if ('setPositionState' in navigator.mediaSession && audioElement) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audioElement.duration || 0,
          playbackRate: audioElement.playbackRate || 1.0,
          position: audioElement.currentTime || 0,
        });
      } catch (error) {
        // Ignore errors if position state is not supported
        console.debug('setPositionState not supported:', error);
      }
    }
  }, [selectedReciter, audioSource, selectedMp3QuranReciter, mp3QuranRecitersAr, audioElement]);
  
  // Update native music controls (for Android notification)
  const updateNativeMusicControls = useCallback(async (surahNum: number, ayahNum: number, playing: boolean) => {
    // Only use native controls on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('Skipping native music controls (not on native platform)');
      return;
    }
    
    try {
      console.log('[QuranMediaSession] Updating native music controls...', { surahNum, ayahNum, playing });
      
      // Clean reciter name by removing style indicators
      const cleanName = (name: string): string => {
        return name
          .replace(/\s*-\s*مرتل\s*/g, '')
          .replace(/\s*-\s*معلم\s*/g, '')
          .replace(/\s*-\s*مجود\s*/g, '')
          .replace(/\s*مرتل\s*/g, '')
          .replace(/\s*معلم\s*/g, '')
          .replace(/\s*مجود\s*/g, '')
          .replace(/\s*-?\s*Murattal\s*/gi, '')
          .replace(/\s*-?\s*Mujawwad\s*/gi, '')
          .replace(/\s*-?\s*Muallim\s*/gi, '')
          .replace(/\s*-?\s*Mo'lim\s*/gi, '')
          .replace(/\s*-?\s*Teacher\s*/gi, '')
          .trim();
      };
      
      const surah = surahs.find(s => s.id === surahNum);
      const surahName = surah?.name || `سورة ${surahNum}`;
      const surahEnglishName = surah?.englishName || `Surah ${surahNum}`;
      
      let track: string;
      let artist: string;
      
      if (audioSource === 'mp3quran' && selectedMp3QuranReciter) {
        // MP3Quran: Reciter name as track, Surah as artist
        const arabicReciter = mp3QuranRecitersAr.find(r => r.id === selectedMp3QuranReciter.id);
        const englishName = cleanName(selectedMp3QuranReciter.name || 'Reciter');
        const arabicName = cleanName(arabicReciter?.name || '');
        track = arabicName ? `${englishName} - ${arabicName}` : englishName;
        artist = surahName;
      } else {
        // EveryAyah: Reciter name as track, Surah - Ayah as artist
        const englishName = cleanName(selectedReciter?.name || 'Reciter');
        const arabicName = cleanName(selectedReciter?.nameAr || '');
        track = arabicName ? `${englishName} - ${arabicName}` : englishName;
        artist = `${surahName} - آية ${ayahNum}`;
      }
      
      console.log('[QuranMediaSession] Metadata:', { track, artist, album: surahEnglishName });
      
      // Update metadata
      await QuranMediaSession.updateMetadata({
        track: track || 'Quran Recitation',
        artist: artist || 'Reciter',
        album: surahEnglishName || 'Quran'
      });
      
      // Update playback state
      await QuranMediaSession.updatePlaybackState({
        isPlaying: playing,
        position: audioElement.currentTime || 0,
        duration: audioElement.duration || 0
      });
      
      console.log('✅ [QuranMediaSession] Native music controls updated successfully');
    } catch (error: any) {
      console.error('❌ [QuranMediaSession] Failed to update native music controls:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      // Don't throw - just log and continue
    }
  }, [audioSource, selectedReciter, selectedMp3QuranReciter, mp3QuranRecitersAr]);
  
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
  
  // Preload next ayah audio for smooth playback (for non-concatenated mode)
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
  
  // Convert AudioBuffer to WAV blob
  const audioBufferToWav = useCallback((buffer: AudioBuffer): Blob => {
    // Convert to mono to save memory (especially important on Android WebView)
    const numberOfChannels = 1; // Force mono
    const length = buffer.length * numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    let pos = 0;
    
    // Write WAV header
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };
    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };
    
    // "RIFF" chunk descriptor
    setUint32(0x46464952); // "RIFF"
    setUint32(36 + length); // file length - 8
    setUint32(0x45564157); // "WAVE"
    
    // "fmt " sub-chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // length = 16
    setUint16(1); // PCM
    setUint16(numberOfChannels);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * numberOfChannels * 2); // byte rate
    setUint16(numberOfChannels * 2); // block align
    setUint16(16); // bits per sample
    
    // "data" sub-chunk
    setUint32(0x61746164); // "data"
    setUint32(length);
    
    // Write audio data (convert to mono by averaging channels)
    const originalChannels: Float32Array[] = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      originalChannels.push(buffer.getChannelData(i));
    }
    
    for (let i = 0; i < buffer.length; i++) {
      // Average all channels to create mono
      let sample = 0;
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        sample += originalChannels[ch][i];
      }
      sample /= buffer.numberOfChannels;
      
      // Clamp and write
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      pos += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }, []);
  
  // Get MP3 duration without decoding (lightweight)
  const getMp3Duration = useCallback((blob: Blob): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration;
        URL.revokeObjectURL(url);
        audio.src = '';
        resolve(duration);
      }, { once: true });
      
      audio.addEventListener('error', (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load audio metadata'));
      }, { once: true });
      
      audio.src = url;
    });
  }, []);
  
  // Concatenate all ayahs in a surah into a single MP3 file
  const concatenateAllSurahAyahs = useCallback(async (surahNum: number): Promise<{ blobUrl: string; timestamps: number[] } | null> => {
    if (!selectedReciter || audioSource !== 'everyayah') return null;
    
    const surahData = ayahData.find(s => s.number === surahNum);
    if (!surahData || !surahData.verses) return null;
    
    const totalAyahs = surahData.verses.length;
    
    // Check cache first
    const cachedData = await getCachedAudio(selectedReciter.folder, surahNum);
    if (cachedData) {
      console.log(`✅ Using cached audio for ${selectedReciter.folder} surah ${surahNum}`);
      const blobUrl = URL.createObjectURL(cachedData.blobData);
      
      // Revoke old blob URL if exists
      if (concatenatedBlobUrl) {
        URL.revokeObjectURL(concatenatedBlobUrl);
      }
      
      setConcatenatedBlobUrl(blobUrl);
      setConcatenatedSurah(surahNum);
      setAyahTimestamps(cachedData.timestamps);
      
      return { blobUrl, timestamps: cachedData.timestamps };
    }
    
    // Not in cache - download and concatenate MP3s directly
    console.log(`⬇️ Downloading and caching audio for ${selectedReciter.folder} surah ${surahNum}`);
    
    // Create new AbortController for this operation
    preloadAbortControllerRef.current = new AbortController();
    const signal = preloadAbortControllerRef.current.signal;
    
    setIsPreloadingAyahs(true);
    setPreloadProgress({ current: 0, total: totalAyahs });
    
    const surahPadded = surahNum.toString().padStart(3, '0');
    
    try {
      // Download all ayah MP3 blobs
      const mp3Blobs: Blob[] = [];
      const timestamps: number[] = [0]; // Start time of each ayah
      let currentTime = 0;
      
      for (let ayahNum = 1; ayahNum <= totalAyahs; ayahNum++) {
        const ayahPadded = ayahNum.toString().padStart(3, '0');
        const audioUrl = `${selectedReciter.baseUrl}/${surahPadded}${ayahPadded}.mp3`;
        
        try {
          // Check if aborted before fetch
          if (signal.aborted) {
            console.log('⛔ Preload aborted before fetch');
            setIsPreloadingAyahs(false);
            setPreloadProgress({ current: 0, total: 0 });
            return null;
          }
          
          // Fetch MP3 file with abort signal
          const response = await fetch(audioUrl, { signal });
          if (!response.ok) throw new Error(`Failed to fetch: ${audioUrl}`);
          
          const mp3Blob = await response.blob();
          mp3Blobs.push(mp3Blob);
          
          // Get duration using lightweight metadata loading (no full decode)
          const duration = await getMp3Duration(mp3Blob);
          currentTime += duration;
          
          // Calculate timestamp for next ayah
          if (ayahNum < totalAyahs) {
            timestamps.push(currentTime);
          }
          
          setPreloadProgress({ current: ayahNum, total: totalAyahs });
        } catch (error) {
          // Check if this was an abort
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('⛔ Preload aborted during fetch');
            setIsPreloadingAyahs(false);
            setPreloadProgress({ current: 0, total: 0 });
            return null;
          }
          console.error(`Failed to load ayah ${surahNum}:${ayahNum}:`, error);
          setIsPreloadingAyahs(false);
          setPreloadProgress({ current: 0, total: 0 });
          return null;
        }
      }
      
      // Check if aborted before concatenation
      if (signal.aborted) {
        console.log('⛔ Preload aborted before concatenation');
        setIsPreloadingAyahs(false);
        setPreloadProgress({ current: 0, total: 0 });
        return null;
      }
      
      console.log(`🎵 Concatenating ${mp3Blobs.length} MP3 files (total: ${currentTime.toFixed(1)}s)`);
      
      // Concatenate MP3 blobs directly (simple and fast!)
      const concatenatedMp3 = new Blob(mp3Blobs, { type: 'audio/mpeg' });
      const fileSizeMB = (concatenatedMp3.size / (1024 * 1024)).toFixed(1);
      console.log(`✅ MP3 concatenated: ${fileSizeMB} MB`);
      
      const blobUrl = URL.createObjectURL(concatenatedMp3);
      
      // Cache the concatenated MP3 for future use
      try {
        await cacheAudio(selectedReciter.folder, surahNum, concatenatedMp3, timestamps);
        console.log(`💾 Cached audio for ${selectedReciter.folder} surah ${surahNum}`);
      } catch (cacheError) {
        console.warn('⚠️ Failed to cache audio (storage full?):', cacheError);
        // Continue anyway - we can still use the blob URL
      }
      
      // Revoke old blob URL if exists
      if (concatenatedBlobUrl) {
        URL.revokeObjectURL(concatenatedBlobUrl);
      }
      
      setConcatenatedBlobUrl(blobUrl);
      setConcatenatedSurah(surahNum);
      setAyahTimestamps(timestamps);
      setIsPreloadingAyahs(false);
      setPreloadProgress({ current: 0, total: 0 });
      
      return { blobUrl, timestamps };
    } catch (error) {
      console.error('❌ Error concatenating ayahs:', error);
      
      // Clean up on error
      if (concatenatedBlobUrl) {
        URL.revokeObjectURL(concatenatedBlobUrl);
        setConcatenatedBlobUrl(null);
      }
      
      setIsPreloadingAyahs(false);
      setPreloadProgress({ current: 0, total: 0 });
      setConcatenatedSurah(null);
      setAyahTimestamps([]);
      
      return null;
    }
  }, [selectedReciter, ayahData, audioSource, concatenatedBlobUrl, getMp3Duration]);
  
  // Concatenate repeat section with ayah repeats and passage repeats baked in
  const concatenateRepeatAyahs = useCallback(async (
    startSurah: number,
    startAyah: number,
    endSurah: number,
    endAyah: number,
    ayahRepeatCount: number,
    passageRepeatCount: number
  ): Promise<{ blobUrl: string; timestamps: {surah: number; ayah: number; repetition: number; passage: number; startTime: number}[] } | null> => {
    if (!selectedReciter || audioSource !== 'everyayah') return null;
    if (!audioContext) return null;
    
    // Generate list of all ayahs in the range
    const ayahsInRange: {surah: number; ayah: number}[] = [];
    let currentSurah = startSurah;
    let currentAyah = startAyah;
    
    while (currentSurah < endSurah || (currentSurah === endSurah && currentAyah <= endAyah)) {
      ayahsInRange.push({ surah: currentSurah, ayah: currentAyah });
      
      // Move to next ayah
      const surahData = ayahData.find(s => s.number === currentSurah);
      const totalAyahs = surahData?.verses?.length || 1;
      
      if (currentAyah < totalAyahs) {
        currentAyah++;
      } else {
        currentSurah++;
        currentAyah = 1;
      }
      
      // Safety check to prevent infinite loops
      if (ayahsInRange.length > 6236) break;
    }
    
    if (ayahsInRange.length === 0) return null;
    
    // Calculate total audio segments
    const totalSegments = ayahsInRange.length * ayahRepeatCount * passageRepeatCount;
    
    // Create new AbortController for this operation
    preloadAbortControllerRef.current = new AbortController();
    const signal = preloadAbortControllerRef.current.signal;
    
    setIsPreloadingAyahs(true);
    setPreloadProgress({ current: 0, total: totalSegments });
    
    try {
      // First, download all unique ayahs and cache their buffers
      const audioBufferCache: Map<string, AudioBuffer> = new Map();
      let downloadProgress = 0;
      
      for (const {surah, ayah} of ayahsInRange) {
        const key = `${surah}:${ayah}`;
        if (audioBufferCache.has(key)) continue;
        
        // Check if aborted
        if (signal.aborted) {
          console.log('⛔ Repeat preload aborted');
          setIsPreloadingAyahs(false);
          setPreloadProgress({ current: 0, total: 0 });
          return null;
        }
        
        const surahPadded = surah.toString().padStart(3, '0');
        const ayahPadded = ayah.toString().padStart(3, '0');
        const audioUrl = `${selectedReciter.baseUrl}/${surahPadded}${ayahPadded}.mp3`;
        
        try {
          const response = await fetch(audioUrl, { signal });
          if (!response.ok) throw new Error(`Failed to fetch: ${audioUrl}`);
          
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBufferCache.set(key, audioBuffer);
          
          downloadProgress++;
          setPreloadProgress({ current: downloadProgress, total: totalSegments });
        } catch (error) {
          // Check if this was an abort
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('⛔ Repeat preload aborted during fetch');
            setIsPreloadingAyahs(false);
            setPreloadProgress({ current: 0, total: 0 });
            return null;
          }
          console.error(`Failed to load ayah ${surah}:${ayah}:`, error);
          setIsPreloadingAyahs(false);
          setPreloadProgress({ current: 0, total: 0 });
          return null;
        }
      }
      
      // Check if aborted before building sequence
      if (signal.aborted) {
        console.log('⛔ Repeat preload aborted before building sequence');
        setIsPreloadingAyahs(false);
        setPreloadProgress({ current: 0, total: 0 });
        return null;
      }
      
      // Build the sequence of audio buffers with repeats
      const audioBufferSequence: AudioBuffer[] = [];
      const timestamps: {surah: number; ayah: number; repetition: number; passage: number; startTime: number}[] = [];
      let currentTime = 0;
      let segmentCount = downloadProgress;
      
      for (let passage = 1; passage <= passageRepeatCount; passage++) {
        for (const {surah, ayah} of ayahsInRange) {
          const key = `${surah}:${ayah}`;
          const buffer = audioBufferCache.get(key);
          if (!buffer) continue;
          
          for (let repetition = 1; repetition <= ayahRepeatCount; repetition++) {
            // Record timestamp for this segment
            timestamps.push({
              surah,
              ayah,
              repetition,
              passage,
              startTime: currentTime
            });
            
            audioBufferSequence.push(buffer);
            currentTime += buffer.duration;
            
            segmentCount++;
            setPreloadProgress({ current: segmentCount, total: totalSegments });
          }
        }
      }
      
      if (audioBufferSequence.length === 0) {
        setIsPreloadingAyahs(false);
        setPreloadProgress({ current: 0, total: 0 });
        return null;
      }
      
      // Calculate total duration and create concatenated buffer
      const totalDuration = audioBufferSequence.reduce((sum, buffer) => sum + buffer.duration, 0);
      
      // Keep original sample rate for best audio quality
      // Downsampling to 22050Hz was causing significant quality loss
      const targetSampleRate = audioBufferSequence[0].sampleRate;
      
      // Force mono (1 channel) to save memory while preserving quality
      const numberOfChannels = 1;
      const totalLength = Math.ceil(totalDuration * targetSampleRate);
      
      console.log(`🎵 Creating repeat buffer: ${totalDuration.toFixed(1)}s, ${targetSampleRate}Hz, mono, ${timestamps.length} segments`);
      
      // Check estimated memory usage
      const estimatedBytes = totalLength * numberOfChannels * 4;
      const estimatedMB = estimatedBytes / (1024 * 1024);
      console.log(`💾 Estimated memory: ${estimatedMB.toFixed(1)} MB`);
      
      if (estimatedMB > 100) {
        console.warn('⚠️ Large repeat buffer - may fail on low-memory devices');
      }
      
      let concatenated: AudioBuffer;
      try {
        concatenated = audioContext.createBuffer(
          numberOfChannels,
          totalLength,
          targetSampleRate
        );
      } catch (memError) {
        console.error('❌ Out of memory creating repeat buffer:', memError);
        setIsPreloadingAyahs(false);
        setPreloadProgress({ current: 0, total: 0 });
        throw new Error('Out of memory - repeat too large');
      }
      
      // Copy all buffers into the concatenated buffer (mono conversion, no downsampling)
      const targetData = concatenated.getChannelData(0);
      let offset = 0;
      
      for (let i = 0; i < audioBufferSequence.length; i++) {
        const buffer = audioBufferSequence[i];
        const sourceLength = buffer.length;
        
        // Mix to mono without downsampling - preserves original quality
        for (let j = 0; j < sourceLength && offset + j < totalLength; j++) {
          let sample = 0;
          
          // Average all channels for mono conversion
          for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            sample += buffer.getChannelData(ch)[j];
          }
          sample /= buffer.numberOfChannels;
          
          targetData[offset + j] = sample;
        }
        
        offset += sourceLength;
      }
      
      // Convert buffer to WAV blob and create URL
      let wavBlob: Blob;
      try {
        wavBlob = audioBufferToWav(concatenated);
        console.log(`✅ Repeat WAV blob: ${(wavBlob.size / (1024 * 1024)).toFixed(1)} MB`);
      } catch (convError) {
        console.error('❌ Error converting repeat to WAV:', convError);
        setIsPreloadingAyahs(false);
        setPreloadProgress({ current: 0, total: 0 });
        throw new Error('Failed to convert repeat audio');
      }
      
      const blobUrl = URL.createObjectURL(wavBlob);
      
      // Revoke old repeat blob URL if exists
      if (repeatBlobUrl) {
        URL.revokeObjectURL(repeatBlobUrl);
      }
      
      setRepeatBlobUrl(blobUrl);
      setRepeatAyahTimestamps(timestamps);
      setIsPreloadingAyahs(false);
      setPreloadProgress({ current: 0, total: 0 });
      
      // Force garbage collection hint
      if (typeof (window as any).gc === 'function') {
        (window as any).gc();
      }
      
      console.log(`✅ Created repeat audio: ${ayahsInRange.length} ayahs × ${ayahRepeatCount} repeats × ${passageRepeatCount} passages = ${timestamps.length} segments`);
      
      return { blobUrl, timestamps };
    } catch (error) {
      console.error('❌ Error concatenating repeat ayahs:', error);
      
      // Clean up on error
      if (repeatBlobUrl) {
        URL.revokeObjectURL(repeatBlobUrl);
        setRepeatBlobUrl(null);
      }
      
      setIsPreloadingAyahs(false);
      setPreloadProgress({ current: 0, total: 0 });
      setRepeatAyahTimestamps([]);
      
      // Show user-friendly error
      if (error instanceof Error && (error.message.includes('memory') || error.message.includes('large'))) {
        alert('Repeat range is too large for your device. Please reduce the passage count or ayah count.');
      }
      
      return null;
    }
  }, [selectedReciter, ayahData, audioSource, audioContext, audioBufferToWav, repeatBlobUrl]);
  
  // Concatenate mp3quran surah audio for repeat (passage-level repeat)
  const concatenateMp3QuranRepeat = useCallback(async (
    startSurah: number,
    endSurah: number,
    passageRepeatCount: number
  ): Promise<{ blobUrl: string; timestamps: {surah: number; passage: number; startTime: number}[] } | null> => {
    if (!selectedMoshaf || audioSource !== 'mp3quran') return null;
    if (!audioContext) return null;
    
    // Generate list of all surahs in the range
    const surahsInRange: number[] = [];
    for (let s = startSurah; s <= endSurah; s++) {
      // Check if surah is available in this moshaf
      if (selectedMoshaf.surah_list) {
        const surahList = selectedMoshaf.surah_list.split(',').map(str => parseInt(str.trim(), 10));
        if (surahList.includes(s)) {
          surahsInRange.push(s);
        }
      } else {
        surahsInRange.push(s);
      }
    }
    
    if (surahsInRange.length === 0) return null;
    
    // Calculate total segments
    const totalSegments = surahsInRange.length * passageRepeatCount;
    
    // Create new AbortController for this operation
    preloadAbortControllerRef.current = new AbortController();
    const signal = preloadAbortControllerRef.current.signal;
    
    setIsPreloadingAyahs(true);
    setPreloadProgress({ current: 0, total: totalSegments });
    
    try {
      // Download all unique surah audio files and cache their buffers
      const audioBufferCache: Map<number, AudioBuffer> = new Map();
      let downloadProgress = 0;
      
      for (const surahNum of surahsInRange) {
        if (audioBufferCache.has(surahNum)) continue;
        
        // Check if aborted
        if (signal.aborted) {
          console.log('⛔ MP3Quran repeat preload aborted');
          setIsPreloadingAyahs(false);
          setPreloadProgress({ current: 0, total: 0 });
          return null;
        }
        
        const audioUrl = getSurahAudioUrl(selectedMoshaf.server, surahNum);
        
        try {
          const response = await fetch(audioUrl, { signal });
          if (!response.ok) throw new Error(`Failed to fetch: ${audioUrl}`);
          
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBufferCache.set(surahNum, audioBuffer);
          
          downloadProgress++;
          setPreloadProgress({ current: downloadProgress, total: totalSegments });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('⛔ MP3Quran repeat preload aborted during fetch');
            setIsPreloadingAyahs(false);
            setPreloadProgress({ current: 0, total: 0 });
            return null;
          }
          console.error(`Failed to load surah ${surahNum}:`, error);
          setIsPreloadingAyahs(false);
          setPreloadProgress({ current: 0, total: 0 });
          return null;
        }
      }
      
      // Check if aborted before building sequence
      if (signal.aborted) {
        console.log('⛔ MP3Quran repeat preload aborted before building sequence');
        setIsPreloadingAyahs(false);
        setPreloadProgress({ current: 0, total: 0 });
        return null;
      }
      
      // Build the sequence of audio buffers with passage repeats
      const audioBufferSequence: AudioBuffer[] = [];
      const timestamps: {surah: number; passage: number; startTime: number}[] = [];
      let currentTime = 0;
      let segmentCount = downloadProgress;
      
      for (let passage = 1; passage <= passageRepeatCount; passage++) {
        for (const surahNum of surahsInRange) {
          const buffer = audioBufferCache.get(surahNum);
          if (!buffer) continue;
          
          // Record timestamp for this segment
          timestamps.push({
            surah: surahNum,
            passage,
            startTime: currentTime
          });
          
          audioBufferSequence.push(buffer);
          currentTime += buffer.duration;
          
          segmentCount++;
          setPreloadProgress({ current: segmentCount, total: totalSegments });
        }
      }
      
      if (audioBufferSequence.length === 0) {
        setIsPreloadingAyahs(false);
        setPreloadProgress({ current: 0, total: 0 });
        return null;
      }
      
      // Calculate total duration and create concatenated buffer
      const totalDuration = audioBufferSequence.reduce((sum, buffer) => sum + buffer.duration, 0);
      
      // Keep original sample rate for best audio quality
      // Downsampling to 22050Hz was causing significant quality loss
      const targetSampleRate = audioBufferSequence[0].sampleRate;
      
      // Force mono (1 channel) to save memory while preserving quality
      const numberOfChannels = 1;
      const totalLength = Math.ceil(totalDuration * targetSampleRate);
      
      console.log(`🎵 Creating MP3Quran repeat buffer: ${totalDuration.toFixed(1)}s, ${targetSampleRate}Hz, mono`);
      
      // Check estimated memory usage
      const estimatedBytes = totalLength * numberOfChannels * 4;
      const estimatedMB = estimatedBytes / (1024 * 1024);
      console.log(`💾 Estimated memory: ${estimatedMB.toFixed(1)} MB`);
      
      if (estimatedMB > 100) {
        console.warn('⚠️ Large MP3Quran repeat buffer - may fail on low-memory devices');
      }
      
      let concatenated: AudioBuffer;
      try {
        concatenated = audioContext.createBuffer(
          numberOfChannels,
          totalLength,
          targetSampleRate
        );
      } catch (memError) {
        console.error('❌ Out of memory creating MP3Quran repeat buffer:', memError);
        setIsPreloadingAyahs(false);
        setPreloadProgress({ current: 0, total: 0 });
        throw new Error('Out of memory - MP3Quran repeat too large');
      }
      
      // Copy all buffers into the concatenated buffer (mono conversion, no downsampling)
      const targetData = concatenated.getChannelData(0);
      let offset = 0;
      
      for (let i = 0; i < audioBufferSequence.length; i++) {
        const buffer = audioBufferSequence[i];
        const sourceLength = buffer.length;
        
        // Mix to mono without downsampling - preserves original quality
        for (let j = 0; j < sourceLength && offset + j < totalLength; j++) {
          let sample = 0;
          
          // Average all channels for mono conversion
          for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            sample += buffer.getChannelData(ch)[j];
          }
          sample /= buffer.numberOfChannels;
          
          targetData[offset + j] = sample;
        }
        
        offset += sourceLength;
      }
      
      // Convert buffer to WAV blob and create URL
      let wavBlob: Blob;
      try {
        wavBlob = audioBufferToWav(concatenated);
        console.log(`✅ MP3Quran repeat WAV blob: ${(wavBlob.size / (1024 * 1024)).toFixed(1)} MB`);
      } catch (convError) {
        console.error('❌ Error converting MP3Quran repeat to WAV:', convError);
        setIsPreloadingAyahs(false);
        setPreloadProgress({ current: 0, total: 0 });
        throw new Error('Failed to convert MP3Quran repeat audio');
      }
      
      const blobUrl = URL.createObjectURL(wavBlob);
      
      // Revoke old repeat blob URL if exists
      if (repeatBlobUrl) {
        URL.revokeObjectURL(repeatBlobUrl);
      }
      
      setRepeatBlobUrl(blobUrl);
      setIsPreloadingAyahs(false);
      setPreloadProgress({ current: 0, total: 0 });
      
      // Force garbage collection hint
      if (typeof (window as any).gc === 'function') {
        (window as any).gc();
      }
      
      console.log(`✅ Created MP3Quran repeat audio: ${surahsInRange.length} surahs × ${passageRepeatCount} passages = ${timestamps.length} segments`);
      
      return { blobUrl, timestamps };
    } catch (error) {
      console.error('❌ Error concatenating MP3Quran repeat:', error);
      
      // Clean up on error
      if (repeatBlobUrl) {
        URL.revokeObjectURL(repeatBlobUrl);
        setRepeatBlobUrl(null);
      }
      
      setIsPreloadingAyahs(false);
      setPreloadProgress({ current: 0, total: 0 });
      
      // Show user-friendly error
      if (error instanceof Error && (error.message.includes('memory') || error.message.includes('large'))) {
        alert('MP3Quran repeat range is too large for your device. Please reduce the passage count.');
      }
      
      return null;
    }
  }, [selectedMoshaf, audioSource, audioContext, audioBufferToWav, repeatBlobUrl]);
  
  // Update current ayah based on playback time for concatenated audio (HTML Audio element)
  const updateCurrentAyahFromTime = useCallback((surahNum: number) => {
    if (!audioElement || ayahTimestamps.length === 0) return;
    
    const currentTime = audioElement.currentTime;
    
    // Find which ayah we're currently playing based on time
    let ayahNum = 1;
    for (let i = 0; i < ayahTimestamps.length; i++) {
      if (currentTime >= ayahTimestamps[i]) {
        ayahNum = i + 1;
      } else {
        break;
      }
    }
    
    if (currentPlayingAyah?.surah !== surahNum || currentPlayingAyah?.ayah !== ayahNum) {
      setCurrentPlayingAyah({ surah: surahNum, ayah: ayahNum });
      updateMediaSession(surahNum, ayahNum, true);
      updateNativeMusicControls(surahNum, ayahNum, true).catch(console.error);
      
      // Only navigate if the ayah is on a different page AND we're not in the middle of loading
      // This prevents navigation during initial seeking to the correct timestamp
      const surahData = ayahData.find(s => s.number === surahNum);
      if (surahData && surahData.verses) {
        const verse = surahData.verses.find((v: any) => v.number === ayahNum);
        if (verse && verse.page && verse.page !== currentPageNum && !isAyahNavigation.current) {
          isAyahNavigation.current = true;
          navigate(`/page/${verse.page}#${surahNum}-${ayahNum}`);
          // Reset the flag after navigation
          setTimeout(() => {
            isAyahNavigation.current = false;
          }, 300);
        }
      }
    }
  }, [audioElement, ayahTimestamps, currentPlayingAyah, updateMediaSession, ayahData, currentPageNum, navigate, isAyahNavigation]);
  
  // Play specific ayah
  const playAyah = useCallback(async (surahNum: number, ayahNum: number) => {
    if (!audioElement) return;
    
    setCurrentPlayingAyah({ surah: surahNum, ayah: ayahNum });
    updateMediaSession(surahNum, ayahNum, true);
    updateNativeMusicControls(surahNum, ayahNum, true).catch(console.error);
    requestWakeLock();
    
    // Navigate to the page containing this ayah if not already on it
    const surahData = ayahData.find(s => s.number === surahNum);
    if (surahData && surahData.verses) {
      const verse = surahData.verses.find((v: any) => v.number === ayahNum);
      if (verse && verse.page && verse.page !== currentPageNum) {
        isAyahNavigation.current = true;
        navigate(`/page/${verse.page}#${surahNum}-${ayahNum}`);
      }
    }
    
    if (audioSource === 'mp3quran' && selectedMoshaf) {
      // MP3Quran mode: Continuous surah audio with timing
      setIsPlaying(true);
      
      try {
        // Check if we need to load a new surah or if we're already playing it
        if (currentSurahAudio !== surahNum) {
          // Check cache first
          const cachedData = await getCachedMp3QuranAudio(selectedMoshaf.id, surahNum);
          
          if (cachedData) {
            // Load from cache
            console.log(`✅ Using cached MP3Quran audio for moshaf ${selectedMoshaf.id} surah ${surahNum}`);
            // Show loading spinner while browser loads/parses the audio blob
            setIsPreloadingAyahs(true);
            
            const blobUrl = URL.createObjectURL(cachedData.blobData);
            audioElement.src = blobUrl;
            setAyahTimings(cachedData.timingData);
            setCurrentSurahAudio(surahNum);
            
            // Wait for audio to be ready, then seek to ayah
            audioElement.addEventListener('loadedmetadata', () => {
              if (cachedData.timingData.length > 0) {
                seekToAyah(audioElement, cachedData.timingData, ayahNum);
              }
              audioElement.play().then(() => {
                setIsPreloadingAyahs(false); // Hide spinner once playing
              }).catch(err => {
                console.error('Failed to play audio:', err);
                setIsPlaying(false);
                setIsPreloadingAyahs(false);
              });
            }, { once: true });
            
            audioElement.load();
          } else {
            // Not in cache - stream directly from URL (like YouTube Music)
            console.log(`🎵 Streaming MP3Quran audio for moshaf ${selectedMoshaf.id} surah ${surahNum}`);
            
            // Show loading spinner while buffering
            setIsPreloadingAyahs(true);
            
            const audioUrl = getSurahAudioUrl(selectedMoshaf.server, surahNum);
            
            // Fetch timing data for this surah
            let timings: AyahTiming[] = [];
            try {
              timings = await getAyahTiming(surahNum, selectedMoshaf.id);
            } catch (timingError) {
              console.warn('Could not fetch ayah timing, playing without precise tracking:', timingError);
            }
            
            // Set the remote URL directly - browser will stream it
            audioElement.src = audioUrl;
            setAyahTimings(timings);
            setCurrentSurahAudio(surahNum);
            
            // Handle audio load error
            const handleError = () => {
              console.error('Failed to load audio - surah may not exist for this reciter');
              setIsPlaying(false);
              setCurrentSurahAudio(null);
              if (onSurahUnavailable) {
                onSurahUnavailable('unavailable');
              }
            };
            audioElement.addEventListener('error', handleError, { once: true });
            
            // Seek to ayah position when metadata loads
            audioElement.addEventListener('loadedmetadata', () => {
              if (timings.length > 0) {
                seekToAyah(audioElement, timings, ayahNum);
              }
            }, { once: true });
            
            // Hide spinner when playback actually starts
            const handlePlaying = () => {
              setIsPreloadingAyahs(false);
              audioElement.removeEventListener('playing', handlePlaying);
            };
            audioElement.addEventListener('playing', handlePlaying, { once: true });
            
            // Start playing - this triggers progressive loading
            audioElement.play().then(() => {
              console.log('✅ MP3Quran streaming started');
              audioElement.removeEventListener('error', handleError);
            }).catch(err => {
              console.error('Failed to start streaming:', err);
              setIsPlaying(false);
              setIsPreloadingAyahs(false);
            });
          }
          
          // Persist selected moshaf
          localStorage.setItem('quran-last-mp3quran-moshaf', selectedMoshaf.id.toString());
        } else {
          // Same surah, just seek to the ayah
          if (ayahTimings.length > 0) {
            seekToAyah(audioElement, ayahTimings, ayahNum);
          }
          audioElement.play().catch(err => {
            console.error('Failed to play audio:', err);
            setIsPlaying(false);
          });
        }
      } catch (error) {
        console.error('Error playing MP3Quran audio:', error);
        setIsPlaying(false);
        setIsPreloadingAyahs(false);
        setPreloadProgress({ current: 0, total: 0 });
        setPreloadProgress({ current: 0, total: 0 });
      }
    } else if (audioSource === 'everyayah' && selectedReciter && audioContext) {
      if (selectedReciter.folder) {
        localStorage.setItem('quran-last-reciter', selectedReciter.folder);
      }
      
      const wasPlaying = isPlaying;
      let blobUrl: string;
      let timestamps: number[];
      let needsNewSource = false;
      
      // Check if we need to concatenate the surah or if it's already concatenated
      if (concatenatedSurah !== surahNum || !concatenatedBlobUrl) {
        // Different surah - need to load new audio
        // Pause current playback if playing
        if (wasPlaying) {
          audioElement.pause();
        }
        
        // Don't set isPlaying yet - wait for concatenation to complete
        setIsPlaying(false);
        
        // Show loading spinner immediately (before cache check which can be slow)
        setIsPreloadingAyahs(true);
        
        // Concatenate all ayahs in this surah (checks cache first, then downloads if needed)
        const result = await concatenateAllSurahAyahs(surahNum);
        
        if (!result) {
          console.error('Failed to concatenate ayahs');
          setIsPlaying(false);
          setIsPreloadingAyahs(false);
          releaseWakeLock();
          return;
        }
        
        blobUrl = result.blobUrl;
        timestamps = result.timestamps;
        needsNewSource = true;
      } else {
        // Same surah - already have the blob URL
        blobUrl = concatenatedBlobUrl;
        timestamps = ayahTimestamps;
        needsNewSource = audioElement.src !== blobUrl;
      }
      
      // Calculate start time for the requested ayah
      const startTime = timestamps[ayahNum - 1] || 0;
      
      if (needsNewSource) {
        // New source needed - set it and wait for load
        audioElement.src = blobUrl;
        
        // Set flag to prevent automatic navigation during initial seek
        isAyahNavigation.current = true;
        
        // Wait for the audio to be ready before seeking
        const handleLoadedMetadata = () => {
          audioElement.currentTime = startTime;
          audioElement.play().then(() => {
            setIsPlaying(true);
            setIsPreloadingAyahs(false); // Hide spinner once playing
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
            // Reset flag after successful playback start
            setTimeout(() => {
              isAyahNavigation.current = false;
            }, 500);
          }).catch(err => {
            console.error('Failed to play audio:', err);
            setIsPlaying(false);
            setIsPreloadingAyahs(false);
            releaseWakeLock();
            isAyahNavigation.current = false;
          });
        };
        
        audioElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        audioElement.load();
      } else {
        // Same source, just seek to new position
        // If already playing, this will seamlessly jump to the new ayah
        audioElement.currentTime = startTime;
        
        // Set flag to prevent navigation during seek
        isAyahNavigation.current = true;
        
        if (wasPlaying) {
          // Continue playing from new position
          audioElement.play().then(() => {
            setIsPlaying(true);
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
            setTimeout(() => {
              isAyahNavigation.current = false;
            }, 300);
          }).catch(err => {
            console.error('Failed to play audio:', err);
            setIsPlaying(false);
            releaseWakeLock();
            isAyahNavigation.current = false;
          });
        } else {
          // Start playing from this position
          audioElement.play().then(() => {
            setIsPlaying(true);
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
            setTimeout(() => {
              isAyahNavigation.current = false;
            }, 300);
          }).catch(err => {
            console.error('Failed to play audio:', err);
            setIsPlaying(false);
            releaseWakeLock();
            isAyahNavigation.current = false;
          });
        }
      }
    }
  }, [audioElement, audioSource, selectedReciter, selectedMoshaf, ayahData, currentPageNum, navigate, preloadNextAyah, isAyahNavigation, updateMediaSession, requestWakeLock, currentSurahAudio, ayahTimings, audioContext, concatenatedSurah, concatenatedBlobUrl, concatenateAllSurahAyahs, ayahTimestamps, releaseWakeLock, onSurahUnavailable]);
  
  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!audioElement) return;
    
    if (audioSource === 'everyayah') {
      // EveryAyah mode using HTML Audio element
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      } else {
        // Check if currentPlayingAyah is on the current page
        let shouldPlayCurrentAyah = false;
        if (currentPlayingAyah) {
          const surahData = ayahData.find(s => s.number === currentPlayingAyah.surah);
          if (surahData && surahData.verses) {
            const verse = surahData.verses.find((v: any) => v.number === currentPlayingAyah.ayah);
            if (verse && verse.page === currentPageNum) {
              shouldPlayCurrentAyah = true;
            }
          }
        }
        
        if (shouldPlayCurrentAyah && audioElement.src && audioElement.src !== '' && audioElement.readyState >= 2) {
          // Audio source is loaded and ready to play, and ayah is on current page
          audioElement.play().then(() => {
            setIsPlaying(true);
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
          }).catch(err => {
            console.error('Failed to resume audio:', err);
            setIsPlaying(false);
            // If resume fails, try loading the ayah fresh
            playAyah(currentPlayingAyah!.surah, currentPlayingAyah!.ayah);
          });
        } else if (shouldPlayCurrentAyah) {
          playAyah(currentPlayingAyah!.surah, currentPlayingAyah!.ayah);
        } else {
          // Play first ayah of current page
          playAyah(currentSurahId, currentPageAyah || 1);
        }
      }
    } else {
      // HTML Audio Element mode (mp3quran)
      if (!audioElement) return;
      
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      } else {
        // Check if currentPlayingAyah is on the current page
        let shouldPlayCurrentAyah = false;
        if (currentPlayingAyah) {
          const surahData = ayahData.find(s => s.number === currentPlayingAyah.surah);
          if (surahData && surahData.verses) {
            const verse = surahData.verses.find((v: any) => v.number === currentPlayingAyah.ayah);
            if (verse && verse.page === currentPageNum) {
              shouldPlayCurrentAyah = true;
            }
          }
        }
        
        if (shouldPlayCurrentAyah) {
          if (audioElement.src && audioElement.currentTime > 0) {
            setIsPlaying(true);
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
            audioElement.play()
              .then(() => {
                preloadNextAyah(currentPlayingAyah!.surah, currentPlayingAyah!.ayah);
              })
              .catch(err => {
                console.error('Failed to resume audio:', err);
                setIsPlaying(false);
                playAyah(currentPlayingAyah!.surah, currentPlayingAyah!.ayah);
              });
          } else {
            playAyah(currentPlayingAyah!.surah, currentPlayingAyah!.ayah);
          }
        } else {
          // Play first ayah of current page
          playAyah(currentSurahId, currentPageAyah || 1);
        }
      }
    }
  }, [audioElement, audioContext, audioSource, isPlaying, currentPlayingAyah, playAyah, preloadNextAyah, currentSurahId, currentPageAyah, ayahData, currentPageNum]);
  
  // Stop audio
  const stopAudio = useCallback(() => {
    console.log('=== STOP AUDIO TRIGGERED ===');
    console.log('Audio source:', audioSource);
    console.log('Current playing ayah:', currentPlayingAyah);
    console.log('Is playing:', isPlaying);
    
    // Abort any ongoing preloading operations
    if (preloadAbortControllerRef.current) {
      console.log('⛔ Aborting ongoing preload operation');
      preloadAbortControllerRef.current.abort();
      preloadAbortControllerRef.current = null;
    }
    
    // Reset preloading state
    setIsPreloadingAyahs(false);
    setPreloadProgress({ current: 0, total: 0 });
    
    if (audioElement) {
      // Stop HTML Audio Element
      audioElement.pause();
      audioElement.currentTime = 0;
      // Clear the audio source to fully stop playback
      audioElement.src = '';
      console.log('Audio element stopped and cleared');
    }
    
    setIsPlaying(false);
    setIsRepeatActive(false);
    setIsRepeatConcatenatedMode(false);
    setCurrentRepeatPassage(0);
    setCurrentRepeatAyah(0);
    setCurrentRepeatSurah(0);
    setCurrentRepeatAyahCount(0);
    
    // Clear MP3Quran state
    setCurrentSurahAudio(null);
    setAyahTimings([]);
    
    // Clear concatenated ayah state
    if (concatenatedBlobUrl) {
      URL.revokeObjectURL(concatenatedBlobUrl);
      setConcatenatedBlobUrl(null);
      setConcatenatedSurah(null);
      setAyahTimestamps([]);
    }
    
    // Clear repeat concatenated audio state
    if (repeatBlobUrl) {
      URL.revokeObjectURL(repeatBlobUrl);
      setRepeatBlobUrl(null);
      setRepeatAyahTimestamps([]);
    }
    
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
    
    releaseWakeLock();
    console.log('=== STOP AUDIO COMPLETE ===');
  }, [audioElement, releaseWakeLock, concatenatedBlobUrl, repeatBlobUrl]);
  
  // Seek to a specific time in the audio
  const seekToTime = useCallback((time: number) => {
    if (!audioElement || !duration) return;
    
    console.log('=== SEEKING TO TIME ===');
    console.log('Seeking to:', time, 'seconds');
    console.log('Audio source:', audioSource);
    
    // Prevent navigation during manual seek
    isAyahNavigation.current = true;
    
    // Set the audio time
    audioElement.currentTime = Math.max(0, Math.min(time, duration));
    
    // Update current ayah based on the seeked time
    if (audioSource === 'everyayah' && concatenatedSurah && ayahTimestamps.length > 0) {
      // EveryAyah mode: Find which ayah corresponds to this time
      let ayahNum = 1;
      for (let i = 0; i < ayahTimestamps.length; i++) {
        if (time >= ayahTimestamps[i]) {
          ayahNum = i + 1;
        } else {
          break;
        }
      }
      
      console.log('EveryAyah: Seeked to ayah', ayahNum, 'of surah', concatenatedSurah);
      setCurrentPlayingAyah({ surah: concatenatedSurah, ayah: ayahNum });
      updateMediaSession(concatenatedSurah, ayahNum, isPlaying);
      updateNativeMusicControls(concatenatedSurah, ayahNum, isPlaying).catch(console.error);
      
      // Navigate to page if needed
      const surahData = ayahData.find(s => s.number === concatenatedSurah);
      if (surahData && surahData.verses) {
        const verse = surahData.verses.find((v: any) => v.number === ayahNum);
        if (verse && verse.page && verse.page !== currentPageNum) {
          console.log('Navigating to page:', verse.page);
          navigate(`/page/${verse.page}#${concatenatedSurah}-${ayahNum}`);
        }
      }
    } else if (audioSource === 'mp3quran' && currentSurahAudio && ayahTimings.length > 0) {
      // MP3Quran mode: Find which ayah corresponds to this time
      const ayahNum = getCurrentAyahFromTime(ayahTimings, time);
      
      if (ayahNum !== null && ayahNum > 0) {
        console.log('MP3Quran: Seeked to ayah', ayahNum, 'of surah', currentSurahAudio);
        setCurrentPlayingAyah({ surah: currentSurahAudio, ayah: ayahNum });
        updateMediaSession(currentSurahAudio, ayahNum, isPlaying);
        updateNativeMusicControls(currentSurahAudio, ayahNum, isPlaying).catch(console.error);
        
        // Navigate to page if needed
        const surahData = ayahData.find(s => s.number === currentSurahAudio);
        if (surahData && surahData.verses) {
          const verse = surahData.verses.find((v: any) => v.number === ayahNum);
          if (verse && verse.page && verse.page !== currentPageNum) {
            console.log('Navigating to page:', verse.page);
            navigate(`/page/${verse.page}#${currentSurahAudio}-${ayahNum}`);
          }
        }
      }
    }
    
    // Reset flag after a short delay
    setTimeout(() => {
      isAyahNavigation.current = false;
    }, 500);
  }, [
    audioElement, 
    duration, 
    audioSource, 
    concatenatedSurah, 
    ayahTimestamps, 
    currentSurahAudio, 
    ayahTimings, 
    isPlaying, 
    updateMediaSession, 
    ayahData, 
    currentPageNum, 
    navigate, 
    isAyahNavigation
  ]);
  
  // Start repeat mode
  const startRepeat = useCallback(async () => {
    if (!audioElement) return;
    
    const passageCount = repeatPassageCount || 1;
    const ayahCount = repeatAyahCount || 1;
    const startSurah = repeatStartSurah || 1;
    const startAyah = repeatStartAyah || 1;
    const endSurah = repeatEndSurah || startSurah;
    const endAyah = repeatEndAyah || startAyah;
    
    // For EveryAyah mode, create a single concatenated audio with all repeats baked in
    if (audioSource === 'everyayah' && selectedReciter) {
      // Concatenate all ayahs with repeats
      const result = await concatenateRepeatAyahs(
        startSurah,
        startAyah,
        endSurah,
        endAyah,
        ayahCount,
        passageCount
      );
      
      if (!result) {
        console.error('Failed to concatenate repeat audio');
        return;
      }
      
      // Set up repeat mode
      setIsRepeatActive(true);
      setIsRepeatConcatenatedMode(true);
      setCurrentRepeatPassage(1);
      setCurrentRepeatSurah(startSurah);
      setCurrentRepeatAyah(startAyah);
      setCurrentRepeatAyahCount(1);
      
      // Navigate to the start page
      const startSurahData = ayahData.find(s => s.number === startSurah);
      if (startSurahData && startSurahData.verses) {
        const verse = startSurahData.verses.find((v: any) => v.number === startAyah);
        if (verse && verse.page && verse.page !== currentPageNum) {
          isAyahNavigation.current = true;
          navigate(`/page/${verse.page}#${startSurah}-${startAyah}`);
        }
      }
      
      // Play the concatenated repeat audio
      setCurrentPlayingAyah({ surah: startSurah, ayah: startAyah });
      updateMediaSession(startSurah, startAyah, true);
      updateNativeMusicControls(startSurah, startAyah, true).catch(console.error);
      requestWakeLock();
      
      // Show loading spinner while browser loads the audio blob
      setIsPreloadingAyahs(true);
      
      audioElement.src = result.blobUrl;
      
      const handleLoadedMetadata = () => {
        audioElement.currentTime = 0;
        audioElement.play().then(() => {
          setIsPlaying(true);
          setIsPreloadingAyahs(false); // Hide spinner once playing
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
          setTimeout(() => {
            isAyahNavigation.current = false;
          }, 500);
        }).catch(err => {
          console.error('Failed to play repeat audio:', err);
          setIsPlaying(false);
          setIsPreloadingAyahs(false);
          setIsRepeatActive(false);
          setIsRepeatConcatenatedMode(false);
          releaseWakeLock();
          isAyahNavigation.current = false;
        });
      };
      
      audioElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      audioElement.load();
    } else if (audioSource === 'mp3quran' && selectedMoshaf) {
      // MP3Quran mode: create concatenated audio with surah/passage repeats baked in
      const result = await concatenateMp3QuranRepeat(
        startSurah,
        endSurah,
        passageCount
      );
      
      if (!result) {
        console.error('Failed to concatenate MP3Quran repeat audio');
        return;
      }
      
      // Set up repeat mode
      setIsRepeatActive(true);
      setIsRepeatConcatenatedMode(true);
      setCurrentRepeatPassage(1);
      setCurrentRepeatSurah(startSurah);
      setCurrentRepeatAyah(1);
      setCurrentRepeatAyahCount(1);
      
      // Navigate to the start page
      const startSurahData = ayahData.find(s => s.number === startSurah);
      if (startSurahData && startSurahData.verses && startSurahData.verses.length > 0) {
        const firstVerse = startSurahData.verses[0];
        if (firstVerse && firstVerse.page && firstVerse.page !== currentPageNum) {
          isAyahNavigation.current = true;
          navigate(`/page/${firstVerse.page}#${startSurah}-1`);
        }
      }
      
      // Play the concatenated repeat audio
      setCurrentPlayingAyah({ surah: startSurah, ayah: 1 });
      updateMediaSession(startSurah, 1, true);
      updateNativeMusicControls(startSurah, 1, true).catch(console.error);
      requestWakeLock();
      
      // Show loading spinner while browser loads the audio blob
      setIsPreloadingAyahs(true);
      
      audioElement.src = result.blobUrl;
      
      const handleMp3QuranLoadedMetadata = () => {
        audioElement.currentTime = 0;
        audioElement.play().then(() => {
          setIsPlaying(true);
          setIsPreloadingAyahs(false); // Hide spinner once playing
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
          setTimeout(() => {
            isAyahNavigation.current = false;
          }, 500);
        }).catch(err => {
          console.error('Failed to play MP3Quran repeat audio:', err);
          setIsPlaying(false);
          setIsPreloadingAyahs(false);
          setIsRepeatActive(false);
          setIsRepeatConcatenatedMode(false);
          releaseWakeLock();
          isAyahNavigation.current = false;
        });
      };
      
      audioElement.addEventListener('loadedmetadata', handleMp3QuranLoadedMetadata, { once: true });
      audioElement.load();
    } else {
      // Fallback: use the old sequential playback method
      setIsRepeatActive(true);
      setIsRepeatConcatenatedMode(false);
      setCurrentRepeatPassage(1);
      setCurrentRepeatSurah(startSurah);
      setCurrentRepeatAyah(startAyah);
      setCurrentRepeatAyahCount(1);
      playAyah(startSurah, startAyah);
    }
  }, [repeatPassageCount, repeatAyahCount, repeatStartSurah, repeatStartAyah, repeatEndSurah, repeatEndAyah, audioSource, selectedReciter, selectedMoshaf, audioElement, ayahData, currentPageNum, navigate, isAyahNavigation, updateMediaSession, requestWakeLock, releaseWakeLock, concatenateRepeatAyahs, concatenateMp3QuranRepeat, playAyah]);
  
  // Helper function to check if a surah is available in the current moshaf
  const isSurahAvailableInMoshaf = useCallback((surahNum: number): boolean => {
    if (!selectedMoshaf || !selectedMoshaf.surah_list) return false;
    const surahList = selectedMoshaf.surah_list.split(',').map(s => parseInt(s.trim(), 10));
    return surahList.includes(surahNum);
  }, [selectedMoshaf]);
  
  // Handle audio ended (for continuous playback and repeat)
  const handleAudioEnded = useCallback(() => {
    if (audioSource === 'mp3quran' && currentPlayingAyah) {
      // MP3Quran mode: When surah ends, move to next surah
      const nextSurah = currentPlayingAyah.surah + 1;
      
      if (nextSurah > 114) {
        // Last surah - stop playback
        setIsPlaying(false);
        releaseWakeLock();
        // Notify that Quran is completed
        if (onSurahUnavailable) {
          onSurahUnavailable('completed');
        }
        return;
      }
      
      // Check if the next surah is available for this reciter
      if (isSurahAvailableInMoshaf(nextSurah)) {
        // Navigate to the next surah page and play
        const nextSurahData = ayahData.find(s => s.number === nextSurah);
        if (nextSurahData && nextSurahData.verses && nextSurahData.verses.length > 0) {
          const firstVerse = nextSurahData.verses[0];
          if (firstVerse && firstVerse.page) {
            isAyahNavigation.current = true;
            navigate(`/page/${firstVerse.page}#${nextSurah}-1`);
          }
        }
        playAyah(nextSurah, 1);
        return;
      } else {
        // Next surah not available - stop playback and notify
        setIsPlaying(false);
        releaseWakeLock();
        if (onSurahUnavailable) {
          onSurahUnavailable('unavailable');
        }
        return;
      }
    }
    
    // Concatenated repeat mode: audio has all repeats baked in, so just stop
    if (isRepeatActive && isRepeatConcatenatedMode) {
      console.log('Concatenated repeat audio finished');
      setIsPlaying(false);
      setIsRepeatActive(false);
      setIsRepeatConcatenatedMode(false);
      setCurrentRepeatPassage(0);
      setCurrentRepeatAyah(0);
      setCurrentRepeatSurah(0);
      setCurrentRepeatAyahCount(0);
      // Clean up repeat blob URL
      if (repeatBlobUrl) {
        URL.revokeObjectURL(repeatBlobUrl);
        setRepeatBlobUrl(null);
      }
      setRepeatAyahTimestamps([]);
      releaseWakeLock();
      return;
    }
    
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
  }, [isRepeatActive, isRepeatConcatenatedMode, repeatBlobUrl, releaseWakeLock, currentPlayingAyah, currentRepeatAyahCount, repeatAyahCount, currentRepeatSurah, currentRepeatAyah, ayahData, currentRepeatPassage, repeatPassageCount, repeatStartSurah, repeatStartAyah, repeatEndSurah, repeatEndAyah, playAyah, audioSource, isSurahAvailableInMoshaf, navigate, isAyahNavigation, onSurahUnavailable]);
  
  // Track current ayah based on playback time (for both MP3Quran and EveryAyah)
  useEffect(() => {
    if (!audioElement) return;
    
    if (audioSource === 'everyayah' && ayahTimestamps.length > 0 && concatenatedSurah) {
      // EveryAyah mode - track ayah changes
      const handleTimeUpdate = () => {
        updateCurrentAyahFromTime(concatenatedSurah);
      };
      
      audioElement.addEventListener('timeupdate', handleTimeUpdate);
      
      return () => {
        audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      };
    } else if (audioSource === 'mp3quran' && ayahTimings.length === 0) {
      return;
    } else if (audioSource !== 'mp3quran') {
      return;
    }
    
    const handleTimeUpdate = () => {
      const currentAyah = getCurrentAyahFromTime(ayahTimings, audioElement.currentTime);
      
      if (currentAyah !== null && currentSurahAudio && currentPlayingAyah) {
        // Update current ayah if it changed (but not if it's ayah 0 which is intro/bismillah)
        if (currentAyah > 0 && currentAyah !== currentPlayingAyah.ayah) {
          setCurrentPlayingAyah({ surah: currentSurahAudio, ayah: currentAyah });
          updateMediaSession(currentSurahAudio, currentAyah, true);
          updateNativeMusicControls(currentSurahAudio, currentAyah, true).catch(console.error);
        }
      }
    };
    
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [audioElement, audioSource, ayahTimings, ayahTimestamps, concatenatedSurah, currentSurahAudio, currentPlayingAyah, updateMediaSession, updateCurrentAyahFromTime]);
  
  // Track current ayah during concatenated repeat mode
  useEffect(() => {
    if (!audioElement || !isRepeatActive || !isRepeatConcatenatedMode || repeatAyahTimestamps.length === 0) return;
    
    const handleTimeUpdate = () => {
      const time = audioElement.currentTime;
      
      // Find which segment we're currently in
      let currentSegment = repeatAyahTimestamps[0];
      for (let i = 0; i < repeatAyahTimestamps.length; i++) {
        if (time >= repeatAyahTimestamps[i].startTime) {
          currentSegment = repeatAyahTimestamps[i];
        } else {
          break;
        }
      }
      
      // Update current playing state if changed
      if (currentPlayingAyah?.surah !== currentSegment.surah || currentPlayingAyah?.ayah !== currentSegment.ayah) {
        setCurrentPlayingAyah({ surah: currentSegment.surah, ayah: currentSegment.ayah });
        updateMediaSession(currentSegment.surah, currentSegment.ayah, true);
        updateNativeMusicControls(currentSegment.surah, currentSegment.ayah, true).catch(console.error);
        
        // Navigate to the page containing this ayah
        const surahData = ayahData.find(s => s.number === currentSegment.surah);
        if (surahData && surahData.verses && !isAyahNavigation.current) {
          const verse = surahData.verses.find((v: any) => v.number === currentSegment.ayah);
          if (verse && verse.page && verse.page !== currentPageNum) {
            isAyahNavigation.current = true;
            navigate(`/page/${verse.page}#${currentSegment.surah}-${currentSegment.ayah}`);
            setTimeout(() => {
              isAyahNavigation.current = false;
            }, 300);
          }
        }
      }
      
      // Update repeat tracking state
      setCurrentRepeatSurah(currentSegment.surah);
      setCurrentRepeatAyah(currentSegment.ayah);
      setCurrentRepeatAyahCount(currentSegment.repetition);
      setCurrentRepeatPassage(currentSegment.passage);
    };
    
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [audioElement, isRepeatActive, isRepeatConcatenatedMode, repeatAyahTimestamps, currentPlayingAyah, updateMediaSession, ayahData, currentPageNum, navigate, isAyahNavigation]);
  
  // Initialize audio elements and Web Audio API context
  useEffect(() => {
    const audio = new Audio();
    // For MP3Quran streaming: only preload metadata, not entire file
    audio.preload = 'metadata';
    // Enable background playback for Android
    audio.setAttribute('x-webkit-airplay', 'allow');
    audio.setAttribute('playsinline', 'true');
    
    // CRITICAL FOR ANDROID: Add audio element to DOM for system media controls
    // Without this, Android won't show media notification controls
    audio.style.display = 'none';
    audio.id = 'quran-audio-player';
    document.body.appendChild(audio);
    
    setAudioElement(audio);
    
    const preloadAudio = new Audio();
    preloadAudio.preload = 'metadata';
    setPreloadAudioElement(preloadAudio);
    
    // Initialize Web Audio API context for concatenation
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioContext(context);
    
    // Initialize Media Session IMMEDIATELY to register as media app
    if ('mediaSession' in navigator) {
      console.log('🎵 Initializing Media Session for Android...');
      
      // Set initial metadata
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Mushafy Quran',
        artist: 'Tap to start playing',
        album: 'Quran Audio',
        artwork: [
          { src: `${import.meta.env.BASE_URL}icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${import.meta.env.BASE_URL}icon-512.png`, sizes: '512x512', type: 'image/png' },
        ]
      });
      
      // Set initial playback state
      navigator.mediaSession.playbackState = 'none';
      
      console.log('✅ Media Session initialized');
    }
    
    return () => {
      audio.pause();
      audio.src = '';
      audio.load(); // Reset the audio element
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
      preloadAudio.pause();
      preloadAudio.remove();
      
      if (context) {
        context.close();
      }
      
      // Revoke blob URL on cleanup
      if (concatenatedBlobUrl) {
        URL.revokeObjectURL(concatenatedBlobUrl);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Track current time and duration for progress bar
  useEffect(() => {
    if (!audioElement) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audioElement.currentTime);
      
      // Update Media Session position state for live progress in notifications
      if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && isPlaying) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audioElement.duration || 0,
            playbackRate: audioElement.playbackRate || 1.0,
            position: audioElement.currentTime || 0,
          });
        } catch (error) {
          // Ignore if setPositionState is not supported or throws error
        }
      }
      
      // Update native music controls position (throttled to once per second)
      if (Capacitor.isNativePlatform() && currentPlayingAyah) {
        const now = Date.now();
        if (now - lastPositionUpdateRef.current >= 1000) {
          lastPositionUpdateRef.current = now;
          const positionUpdate = {
            isPlaying: !audioElement.paused, 
            position: audioElement.currentTime,
            duration: audioElement.duration || 0
          };
          console.log('⏱️ [QuranMediaSession] Position update:', JSON.stringify(positionUpdate));
          QuranMediaSession.updatePlaybackState(positionUpdate).catch((error) => {
            console.error('❌ [QuranMediaSession] Position update failed:', error);
          });
        }
      }
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audioElement.duration);
    };
    
    const handleDurationChange = () => {
      setDuration(audioElement.duration);
    };
    
    // CRITICAL FOR ANDROID: Sync Media Session state with actual audio playback
    const handlePlay = () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
        console.log('🎵 Media Session: playing');
      }
      // Update native music controls on play
      if (Capacitor.isNativePlatform() && currentPlayingAyah) {
        QuranMediaSession.updatePlaybackState({ 
          isPlaying: true, 
          position: audioElement.currentTime,
          duration: audioElement.duration || 0
        }).catch(console.error);
      }
    };
    
    const handlePause = () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
        console.log('⏸️ Media Session: paused');
      }
      // Update native music controls on pause
      if (Capacitor.isNativePlatform() && currentPlayingAyah) {
        QuranMediaSession.updatePlaybackState({ 
          isPlaying: false, 
          position: audioElement.currentTime,
          duration: audioElement.duration || 0
        }).catch(console.error);
      }
    };
    
    const handleEnded = () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
        console.log('🎵 Media Session: ended');
      }
      // Update native music controls on end
      if (Capacitor.isNativePlatform() && currentPlayingAyah) {
        QuranMediaSession.updatePlaybackState({ 
          isPlaying: false, 
          position: 0,
          duration: audioElement.duration || 0
        }).catch(console.error);
      }
    };
    
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioElement.addEventListener('durationchange', handleDurationChange);
    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);
    
    return () => {
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.removeEventListener('durationchange', handleDurationChange);
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
    };
  }, [audioElement, isPlaying]);
  
  // Set up Media Session action handlers for Android notification controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    
    // Play action
    navigator.mediaSession.setActionHandler('play', () => {
      if (currentPlayingAyah) {
        if (audioElement) {
          // HTML Audio Element mode
          audioElement.play().catch(console.error);
          setIsPlaying(true);
          navigator.mediaSession.playbackState = 'playing';
        }
      }
    });
    
    // Pause action
    navigator.mediaSession.setActionHandler('pause', () => {
      if (audioElement) {
        // HTML Audio Element mode
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
    
    // Stop action
    navigator.mediaSession.setActionHandler('stop', () => {
      stopAudio();
    });
    
    // Cleanup - remove action handlers
    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('stop', null);
      } catch (e) {
        // Some browsers might not support removing handlers
      }
    };
  }, [audioElement, audioContext, audioSource, currentPlayingAyah, playAyah, getNextAyah, getPreviousAyah, stopAudio]);
  
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
    // Load EveryAyah reciters
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
    
    // Load MP3Quran reciters in both languages
    Promise.all([
      getMp3QuranReciters('en'),
      getMp3QuranReciters('ar')
    ])
      .then(([recitersEn, recitersAr]) => {
        setMp3QuranReciters(recitersEn);
        setMp3QuranRecitersAr(recitersAr);
        
        // Load last selected moshaf or use default
        const lastMoshafId = localStorage.getItem('quran-last-mp3quran-moshaf');
        
        if (lastMoshafId) {
          // Find reciter and moshaf by ID
          for (const reciter of recitersEn) {
            const moshaf = reciter.moshaf.find(m => m.id.toString() === lastMoshafId);
            if (moshaf) {
              setSelectedMp3QuranReciter(reciter);
              setSelectedMoshaf(moshaf);
              return;
            }
          }
        }
        
        // Default: Find Maher Al Muaiqly (id: 102) with Murattal
        const defaultReciter = recitersEn.find(r => r.id === 102);
        if (defaultReciter && defaultReciter.moshaf.length > 0) {
          const defaultMoshaf = defaultReciter.moshaf.find(m => m.moshaf_type === 11) || defaultReciter.moshaf[0];
          setSelectedMp3QuranReciter(defaultReciter);
          setSelectedMoshaf(defaultMoshaf);
        } else if (recitersEn.length > 0 && recitersEn[0].moshaf.length > 0) {
          setSelectedMp3QuranReciter(recitersEn[0]);
          setSelectedMoshaf(recitersEn[0].moshaf[0]);
        }
      })
      .catch(err => console.error('Failed to load MP3Quran reciters:', err));
  }, []);
  
  // Auto-select first moshaf when MP3Quran reciter is selected
  useEffect(() => {
    if (selectedMp3QuranReciter && selectedMp3QuranReciter.moshaf.length > 0) {
      // If no moshaf is selected or the current moshaf doesn't belong to this reciter, select the first one
      if (!selectedMoshaf || !selectedMp3QuranReciter.moshaf.find(m => m.id === selectedMoshaf.id)) {
        setSelectedMoshaf(selectedMp3QuranReciter.moshaf[0]);
      }
    }
  }, [selectedMp3QuranReciter]);
  
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
  
  // Persist audio source selection
  useEffect(() => {
    localStorage.setItem('quran-audio-source', audioSource);
  }, [audioSource]);
  
  // Expose debug function
  const testMediaSession = useCallback(() => {
    console.log('🧪 Testing Media Session...');
    debugMediaSession();
    
    // Also test by forcing an update
    if (currentPlayingAyah && audioElement) {
      console.log('Forcing Media Session update...');
      updateMediaSession(currentPlayingAyah.surah, currentPlayingAyah.ayah, isPlaying);
      updateNativeMusicControls(currentPlayingAyah.surah, currentPlayingAyah.ayah, isPlaying).catch(console.error);
      console.log('Audio element state:', {
        src: audioElement.src,
        paused: audioElement.paused,
        currentTime: audioElement.currentTime,
        duration: audioElement.duration,
      });
    }
  }, [currentPlayingAyah, audioElement, isPlaying, updateMediaSession]);
  
  // Expose to window for easy testing
  useEffect(() => {
    (window as any).testMediaSession = testMediaSession;
    return () => {
      delete (window as any).testMediaSession;
    };
  }, [testMediaSession]);
  
  // Set up native music controls event listeners (Android MediaSession)
  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('[QuranMediaSession] Skipping setup (not on native platform)');
      return;
    }
    
    console.log('[QuranMediaSession] Setting up native music controls listeners...');
    
    const handleMediaSessionEvent = (event: { action: string; data?: { position?: number } }) => {
      try {
        console.log('🎵 [QuranMediaSession] Event received:', JSON.stringify(event));
        
        switch (event.action) {
          case 'play':
            console.log('▶️ [QuranMediaSession] PLAY button pressed');
            if (audioElement && audioElement.paused) {
              audioElement.play();
              setIsPlaying(true);
              if (currentPlayingAyah) {
                updateMediaSession(currentPlayingAyah.surah, currentPlayingAyah.ayah, true);
              }
              console.log('✅ [QuranMediaSession] Play command executed');
            } else {
              console.warn('⚠️ [QuranMediaSession] Cannot play - audioElement missing or already playing');
            }
            break;
            
          case 'pause':
            console.log('⏸️ [QuranMediaSession] PAUSE button pressed');
            if (audioElement && !audioElement.paused) {
              audioElement.pause();
              setIsPlaying(false);
              if (currentPlayingAyah) {
                updateMediaSession(currentPlayingAyah.surah, currentPlayingAyah.ayah, false);
              }
              console.log('✅ [QuranMediaSession] Pause command executed');
            } else {
              console.warn('⚠️ [QuranMediaSession] Cannot pause - audioElement missing or already paused');
            }
            break;
            
          case 'next':
            console.log('⏭️ [QuranMediaSession] NEXT button pressed');
            if (currentPlayingAyah) {
              const nextAyah = getNextAyah(currentPlayingAyah.surah, currentPlayingAyah.ayah);
              if (nextAyah) {
                playAyah(nextAyah.surah, nextAyah.ayah);
              }
            }
            break;
          
          case 'previous':
            console.log('⏮️ [QuranMediaSession] PREVIOUS button pressed');
            if (currentPlayingAyah) {
              // Go to previous ayah
              const prevAyah = currentPlayingAyah.ayah > 1
                ? { surah: currentPlayingAyah.surah, ayah: currentPlayingAyah.ayah - 1 }
                : currentPlayingAyah.surah > 1
                  ? { surah: currentPlayingAyah.surah - 1, ayah: surahs.find(s => s.id === currentPlayingAyah.surah - 1)?.numberOfAyahs || 1 }
                  : null;
                  
              if (prevAyah) {
                playAyah(prevAyah.surah, prevAyah.ayah);
              }
            }
            break;
          
          case 'seek':
            // User dragged the progress bar to seek to a new position
            const seekPosition = event.data?.position;
            console.log('⏩ [QuranMediaSession] SEEK EVENT - position:', seekPosition, 'audioElement exists:', !!audioElement);
            if (audioElement && seekPosition !== undefined) {
              console.log(`⏩ [QuranMediaSession] Seeking from ${audioElement.currentTime}s to ${seekPosition}s`);
              audioElement.currentTime = seekPosition;
              // Update the notification with new position
              QuranMediaSession.updatePlaybackState({ 
                isPlaying: !audioElement.paused, 
                position: seekPosition,
                duration: audioElement.duration || 0
              }).then(() => {
                console.log('✅ [QuranMediaSession] Position updated after seek');
              }).catch((error) => {
                console.error('❌ [QuranMediaSession] Failed to update position after seek:', error);
              });
            } else {
              console.warn('⚠️ [QuranMediaSession] Cannot seek - audioElement or position missing');
            }
            break;
          
          case 'stop':
            console.log('⏹️ [QuranMediaSession] STOP button pressed');
            if (audioElement) {
              audioElement.pause();
              setIsPlaying(false);
              setCurrentPlayingAyah(null);
              QuranMediaSession.destroy().catch(console.error);
            }
            break;
          
          default:
            console.warn('⚠️ [QuranMediaSession] Unhandled event:', event.action, 'Full event:', JSON.stringify(event));
            break;
        }
      } catch (error: any) {
        console.error('❌ [QuranMediaSession] Error handling event:', error);
        console.error('Event that caused error:', event);
      }
    };
    
    // Set up listener
    console.log('🔧 [QuranMediaSession] Setting up listener...');
    
    const listenerPromise = QuranMediaSession.addListener('mediaSessionEvent', handleMediaSessionEvent);
    
    listenerPromise.then((handle) => {
      console.log('✅ [QuranMediaSession] Listener registered successfully');
    }).catch((error) => {
      console.error('❌ [QuranMediaSession] Failed to register listener:', error);
    });
    
    return () => {
      // Clean up listeners
      QuranMediaSession.removeAllListeners().catch(console.error);
      console.log('[QuranMediaSession] Listeners removed');
    };
  }, [audioElement, currentPlayingAyah, updateMediaSession, updateNativeMusicControls, getNextAyah, playAyah]);
  
  return {
    // Audio state
    audioElement,
    isPlaying,
    currentPlayingAyah,
    setCurrentPlayingAyah,
    currentTime,
    duration,
    
    // Preloading state
    isPreloadingAyahs,
    preloadProgress,
    
    // Audio source
    audioSource,
    setAudioSource,
    
    // EveryAyah reciter state
    reciters,
    selectedReciter,
    setSelectedReciter,
    filteredReciters,
    uniqueReciterNames,
    
    // MP3Quran reciter state
    mp3QuranReciters,
    mp3QuranRecitersAr,
    selectedMp3QuranReciter,
    setSelectedMp3QuranReciter,
    selectedMoshaf,
    setSelectedMoshaf,
    
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
    isRepeatConcatenatedMode,
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
    repeatAyahTimestamps,
    
    // Concatenated audio data (for progress bar ayah display)
    ayahTimestamps,
    concatenatedSurah,
    
    // MP3Quran current surah (for tracking which surah is playing)
    currentSurahAudio,
    
    // Audio control functions
    playAyah,
    togglePlayPause,
    stopAudio,
    seekToTime,
    startRepeat,
    preloadNextAyah,
    
    // Debug function
    testMediaSession
  };
};

