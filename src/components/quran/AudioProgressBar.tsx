import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface RepeatTimestamp {
  surah: number;
  ayah: number;
  repetition: number;
  passage: number;
  startTime: number;
}

interface AudioProgressBarProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  audioSource?: 'everyayah' | 'mp3quran';
  ayahTimestamps?: number[];
  concatenatedSurah?: number | null;
  formatNumber?: (num: number | string) => string;
  // Repeat mode props
  isRepeatActive?: boolean;
  isRepeatConcatenatedMode?: boolean;
  repeatAyahTimestamps?: RepeatTimestamp[];
  repeatAyahCount?: number;
  repeatPassageCount?: number;
  currentRepeatPassage?: number;
  currentRepeatAyahCount?: number;
  surahNames?: { [key: number]: string };
  // Localization props
  isRTL?: boolean;
  ayahRepeatLabel?: string;
  sectionRepeatLabel?: string;
  ayahLabel?: string;
}

export function AudioProgressBar({ 
  currentTime, 
  duration, 
  isPlaying,
  onSeek,
  onDragStart,
  onDragEnd,
  audioSource = 'everyayah',
  ayahTimestamps = [],
  concatenatedSurah = null,
  formatNumber = (n) => n.toString(),
  isRepeatActive = false,
  isRepeatConcatenatedMode = false,
  repeatAyahTimestamps = [],
  repeatAyahCount = 1,
  repeatPassageCount = 1,
  currentRepeatPassage = 0,
  currentRepeatAyahCount = 0,
  surahNames = {},
  isRTL = true,
  ayahRepeatLabel = 'تكرار الآية',
  sectionRepeatLabel = 'تكرار المقطع',
  ayahLabel = 'آية'
}: AudioProgressBarProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const [wasPlayingBeforeDrag, setWasPlayingBeforeDrag] = useState(false);
  const dragEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate progress percentage - use drag progress during dragging for instant feedback
  // Keep using dragProgress briefly after drag ends to prevent visual jump
  const progress = dragProgress !== null
    ? dragProgress 
    : (duration > 0 ? (currentTime / duration) * 100 : 0);

  // Handle seeking
  const handleSeek = (clientX: number) => {
    if (!progressBarRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickPosition = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (clickPosition / rect.width) * 100));
    const newTime = (percentage / 100) * duration;
    
    // Update drag progress immediately for visual feedback
    if (isDragging) {
      setDragProgress(percentage);
    }
    
    onSeek(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Clear any pending dragProgress timeout
    if (dragEndTimeoutRef.current) {
      clearTimeout(dragEndTimeoutRef.current);
      dragEndTimeoutRef.current = null;
    }
    
    setWasPlayingBeforeDrag(isPlaying);
    setIsDragging(true);
    onDragStart?.();
    handleSeek(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    
    // Clear any pending dragProgress timeout
    if (dragEndTimeoutRef.current) {
      clearTimeout(dragEndTimeoutRef.current);
      dragEndTimeoutRef.current = null;
    }
    
    setWasPlayingBeforeDrag(isPlaying);
    setIsDragging(true);
    onDragStart?.();
    if (e.touches.length > 0) {
      handleSeek(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!progressBarRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const position = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (position / rect.width) * 100));
    const time = (percentage / 100) * duration;
    setHoverTime(time);

    if (isDragging) {
      handleSeek(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!progressBarRef.current) return;
    
    if (e.touches.length > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const position = e.touches[0].clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (position / rect.width) * 100));
      const time = (percentage / 100) * duration;
      setHoverTime(time);

      if (isDragging) {
        handleSeek(e.touches[0].clientX);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setHoverTime(null);
    
    // Clear dragProgress after a delay to prevent visual jump
    if (dragEndTimeoutRef.current) {
      clearTimeout(dragEndTimeoutRef.current);
    }
    dragEndTimeoutRef.current = setTimeout(() => {
      setDragProgress(null);
    }, 300);
    
    if (wasPlayingBeforeDrag) {
      onDragEnd?.();
    }
    setWasPlayingBeforeDrag(false);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      
      // Clear dragProgress after a delay to prevent visual jump
      if (dragEndTimeoutRef.current) {
        clearTimeout(dragEndTimeoutRef.current);
      }
      dragEndTimeoutRef.current = setTimeout(() => {
        setDragProgress(null);
      }, 300);
      
      if (wasPlayingBeforeDrag) {
        onDragEnd?.();
      }
      setWasPlayingBeforeDrag(false);
    };
    const handleTouchEndGlobal = () => {
      setIsDragging(false);
      
      // Clear dragProgress after a delay to prevent visual jump
      if (dragEndTimeoutRef.current) {
        clearTimeout(dragEndTimeoutRef.current);
      }
      dragEndTimeoutRef.current = setTimeout(() => {
        setDragProgress(null);
      }, 300);
      
      if (wasPlayingBeforeDrag) {
        onDragEnd?.();
      }
      setWasPlayingBeforeDrag(false);
    };
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleSeek(e.clientX);
      }
    };
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        e.preventDefault();
        handleSeek(e.touches[0].clientX);
      }
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('touchend', handleTouchEndGlobal);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    }

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('touchend', handleTouchEndGlobal);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
    };
  }, [isDragging]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dragEndTimeoutRef.current) {
        clearTimeout(dragEndTimeoutRef.current);
      }
    };
  }, []);

  // Format time in mm:ss
  const formatTime = (time: number): string => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get ayah number from time (for EveryAyah mode)
  const getAyahFromTime = (time: number): number | null => {
    if (audioSource !== 'everyayah' || !concatenatedSurah || ayahTimestamps.length === 0) {
      return null;
    }

    let ayahNum = 1;
    for (let i = 0; i < ayahTimestamps.length; i++) {
      if (time >= ayahTimestamps[i]) {
        ayahNum = i + 1;
      } else {
        break;
      }
    }
    return ayahNum;
  };

  // Get repeat segment info from time (for repeat concatenated mode)
  const getRepeatSegmentFromTime = (time: number): RepeatTimestamp | null => {
    if (!isRepeatActive || !isRepeatConcatenatedMode || repeatAyahTimestamps.length === 0) {
      return null;
    }

    let segment = repeatAyahTimestamps[0];
    for (let i = 0; i < repeatAyahTimestamps.length; i++) {
      if (time >= repeatAyahTimestamps[i].startTime) {
        segment = repeatAyahTimestamps[i];
      } else {
        break;
      }
    }
    return segment;
  };

  // Get markers for repeat mode (section starts and ayah starts)
  const getRepeatMarkers = () => {
    if (!isRepeatActive || duration <= 0) {
      return { sectionMarkers: [], ayahMarkers: [] };
    }

    const sectionMarkers: number[] = []; // Passage start positions (percentage)
    const ayahMarkers: number[] = []; // Ayah start positions (percentage)

    // For concatenated mode (everyayah), use exact timestamps
    if (isRepeatConcatenatedMode && repeatAyahTimestamps.length > 0) {
      for (let i = 0; i < repeatAyahTimestamps.length; i++) {
        const ts = repeatAyahTimestamps[i];
        const position = (ts.startTime / duration) * 100;

        // Section marker: first ayah of each passage (passage changes or first entry)
        if (ts.repetition === 1 && (i === 0 || repeatAyahTimestamps[i - 1].passage !== ts.passage)) {
          if (position > 0) { // Don't add marker at 0%
            sectionMarkers.push(position);
          }
        }

        // Ayah marker: only show when ayah repeat count > 1
        if (ts.repetition === 1 && repeatAyahCount > 1) {
          ayahMarkers.push(position);
        }
      }
    } else if (repeatPassageCount > 1) {
      // For non-concatenated mode (mp3quran), calculate passage markers evenly
      // Each passage takes equal portion of the total duration
      const passageDuration = 100 / repeatPassageCount;
      for (let i = 1; i < repeatPassageCount; i++) {
        sectionMarkers.push(passageDuration * i);
      }
    }

    // Remove duplicate ayah markers that are also section markers
    const filteredAyahMarkers = ayahMarkers.filter(m => !sectionMarkers.includes(m) && m > 0);

    return { sectionMarkers, ayahMarkers: filteredAyahMarkers };
  };

  const { sectionMarkers, ayahMarkers } = getRepeatMarkers();

  // Get current repeat info from timestamps based on current time
  const getCurrentRepeatInfo = () => {
    if (!isRepeatActive || !isRepeatConcatenatedMode || repeatAyahTimestamps.length === 0) {
      return null;
    }
    const segment = getRepeatSegmentFromTime(currentTime);
    return segment;
  };

  const currentRepeatInfo = getCurrentRepeatInfo();

  return (
    <div className="w-full relative group">
      {/* Progress bar container */}
      <div
        ref={progressBarRef}
        className={cn(
          "relative h-1.5 md:h-1 bg-emerald-900/30 cursor-pointer transition-all touch-none",
          "group-hover:h-2",
          isDragging && "h-2.5 md:h-2"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background track */}
        <div className="absolute inset-0 bg-emerald-950/50" />
        
        {/* Section repeat markers (thicker, more prominent) */}
        {sectionMarkers.map((position, index) => (
          <div
            key={`section-${index}`}
            className="absolute top-0 bottom-0 w-1 bg-amber-400/80 z-10"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          />
        ))}
        
        {/* Ayah markers (thinner, subtle) */}
        {ayahMarkers.map((position, index) => (
          <div
            key={`ayah-${index}`}
            className="absolute top-0 bottom-0 w-0.5 bg-[#F2E3BB]/40"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          />
        ))}
        
        {/* Progress fill */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-amber-400",
            !isDragging && "transition-all duration-100",
            isDragging && "will-change-[width]"
          )}
          style={{ width: `${progress}%` }}
        />
        
        {/* Hover indicator */}
        {hoverTime !== null && !isDragging && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/50"
            style={{ left: `${(hoverTime / duration) * 100}%` }}
          />
        )}
        
        {/* Playhead */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-6 h-6 md:w-5 md:h-5 bg-[#F2E3BB] rounded-full shadow-lg cursor-grab active:cursor-grabbing z-20",
            !isDragging && "transition-all duration-100",
            isDragging && "will-change-[left,transform]",
            (isDragging || isPlaying) && "opacity-100",
            !isDragging && !isPlaying && "opacity-0 group-hover:opacity-100",
            isDragging && "scale-125 shadow-xl"
          )}
          style={{ left: `calc(${progress}% - 12px)` }}
        />
      </div>

      {/* Time display tooltip on hover */}
      {hoverTime !== null && (() => {
        const isRepeatMode = isRepeatActive && isRepeatConcatenatedMode && getRepeatSegmentFromTime(hoverTime) !== null;
        const extraLines = isRepeatMode ? (repeatAyahCount > 1 ? 1 : 0) + (repeatPassageCount > 1 ? 1 : 0) : 0;
        // Adjust top position based on number of lines: higher up so visible above finger on mobile
        const topClass = extraLines === 0 ? "-top-24" : extraLines === 1 ? "-top-32" : "-top-40";
        
        return (
          <div
            className={cn(
              `absolute ${topClass} px-4 py-2 bg-emerald-800/90 text-[#F2E3BB] text-base md:text-lg rounded-lg pointer-events-none whitespace-nowrap flex flex-col items-center`,
              isRTL ? "rtl" : "ltr"
            )}
            style={{ left: `${(hoverTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {isRepeatMode ? (
              // Repeat mode tooltip
              <>
                <span className="font-semibold">
                  {surahNames[getRepeatSegmentFromTime(hoverTime)!.surah] || `Surah ${getRepeatSegmentFromTime(hoverTime)!.surah}`} - {ayahLabel} {formatNumber(getRepeatSegmentFromTime(hoverTime)!.ayah)}
                </span>
                {repeatPassageCount > 1 && (
                  <span>
                    {sectionRepeatLabel}: {formatNumber(getRepeatSegmentFromTime(hoverTime)!.passage)}/{formatNumber(repeatPassageCount)}
                  </span>
                )}
                {repeatAyahCount > 1 && (
                  <span>
                    {ayahRepeatLabel}: {formatNumber(getRepeatSegmentFromTime(hoverTime)!.repetition)}/{formatNumber(repeatAyahCount)}
                  </span>
                )}
                <span>{formatTime(hoverTime)}</span>
              </>
            ) : (
              // Normal mode tooltip
              <>
                {audioSource === 'everyayah' && concatenatedSurah && getAyahFromTime(hoverTime) !== null && (
                  <span className="font-semibold">
                    {surahNames[concatenatedSurah] || `Surah ${concatenatedSurah}`} - {ayahLabel} {formatNumber(getAyahFromTime(hoverTime)!)}
                  </span>
                )}
                <span>{formatTime(hoverTime)}</span>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
