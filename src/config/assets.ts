import { Capacitor } from '@capacitor/core';

// Using jsDelivr CDN for faster global downloads with edge caching
const GITHUB_RAW_URL = 'https://cdn.jsdelivr.net/gh/Armagdy/mushafy@master/public/assets';

// Base URL for fetching JSON data assets (reciters.json, quran-meta-data.json, etc.)
// These are always bundled inside the app (native or web).
export const ASSETS_BASE_URL = Capacitor.isNativePlatform()
  ? '/assets'
  : import.meta.env.PROD
    ? GITHUB_RAW_URL
    : '/assets';

// Base URL for mushaf page images.
// Images are NOT bundled on native (too large) — they are downloaded to phone storage.
// Always use the remote GitHub URL so downloads succeed on native and web prod.
// In local dev, use local assets.
export const IMAGES_BASE_URL = (Capacitor.isNativePlatform() || import.meta.env.PROD)
  ? GITHUB_RAW_URL
  : '/assets';
