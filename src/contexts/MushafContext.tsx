import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type MushafType = 'mwdoa' | 'tashel' | 'madinah';

interface MushafContextType {
  mushafType: MushafType;
  setMushafType: (type: MushafType) => void;
  getMushafPath: () => string;
}

const MushafContext = createContext<MushafContextType | undefined>(undefined);

export const MushafProvider = ({ children }: { children: ReactNode }) => {
  const [mushafType, setMushafType] = useState<MushafType>(() => {
    const saved = localStorage.getItem('quran-app-mushaf');
    return (saved as MushafType) || 'mwdoa';
  });

  useEffect(() => {
    localStorage.setItem('quran-app-mushaf', mushafType);
  }, [mushafType]);

  const getMushafPath = (): string => {
    const baseUrl = 'https://raw.githubusercontent.com/Armagdy/mushafy/main/public/assets';
    return mushafType === 'mwdoa' 
      ? `${baseUrl}/mushuf_mwdoa_images` 
      : mushafType === 'tashel'
      ? `${baseUrl}/mushaf_tashel_pages`
      : `${baseUrl}/mushaf_madinah_images`;
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
