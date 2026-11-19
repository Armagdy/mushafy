import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mushafy.quran',
  appName: 'مصحفى',
  webDir: 'dist',
  // Splash background - matches TopBar emerald gradient, avoids white flash on cold start
  backgroundColor: '#065f46',
  server: {
    androidScheme: 'https',
    // Allow CORS for API requests
    allowNavigation: [
      'https://api.quran.com',
      'https://api.alquran.cloud',
      'https://everyayah.com',
      'https://server6.mp3quran.net',
      'https://server11.mp3quran.net'
    ]
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false // Set to true for debugging
  }
};

export default config;
