import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

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
  formatNumber = (n) => n.toString()
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
            "absolute top-1/2 -translate-y-1/2 w-6 h-6 md:w-5 md:h-5 bg-[#F2E3BB] rounded-full shadow-lg cursor-grab active:cursor-grabbing",
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
      {hoverTime !== null && (
        <div
          className="absolute -top-24 px-4 py-2 bg-emerald-800/90 text-[#F2E3BB] text-base md:text-lg rounded-lg pointer-events-none whitespace-nowrap flex flex-col items-center"
          style={{ left: `${(hoverTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
        >
          {audioSource === 'everyayah' && getAyahFromTime(hoverTime) !== null && (
            <span>
              آية {formatNumber(getAyahFromTime(hoverTime)!)}
            </span>
          )}
          <span>{formatTime(hoverTime)}</span>
        </div>
      )}
    </div>
  );
}
