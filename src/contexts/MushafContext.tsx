import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { IMAGES_BASE_URL } from '@/config/assets';

export type MushafType = 'mwdoa' | 'tashel' | 'madinah' | 'tarteel' | 'tajweed';

interface MushafContextType {
  mushafType: MushafType;
  setMushafType: (type: MushafType) => void;
  getMushafPath: () => string;
}

const MushafContext = createContext<MushafContextType | undefined>(undefined);

export const MushafProvider = ({ children }: { children: ReactNode }) => {
  const [mushafType, setMushafType] = useState<MushafType>(() => {
    const saved = localStorage.getItem('quran-app-mushaf');
    return (saved as MushafType) || 'tarteel';
  });

  useEffect(() => {
    localStorage.setItem('quran-app-mushaf', mushafType);
  }, [mushafType]);

  const getMushafPath = (): string => {
    // Tarteel and Tajweed are text-based, don't use images
    if (mushafType === 'tarteel' || mushafType === 'tajweed') return '';
    
    const folder = mushafType === 'mwdoa' 
      ? 'mushuf_mwdoa_images' 
      : mushafType === 'tashel'
      ? 'mushaf_tashel_pages'
      : 'mushaf_madinah_images';
    return `${IMAGES_BASE_URL}/${folder}`;
  };

  return (
    <MushafContext.Provider value={{ mushafType, setMushafType, getMushafPath }}>
      {children}
    </MushafContext.Provider>
  );
};

export const useMushaf = () => {
  const context = useContext(MushafContext);
  if (!context) {
    throw new Error('useMushaf must be used within a MushafProvider');
  }
  return context;
};
