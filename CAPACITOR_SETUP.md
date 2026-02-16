# Capacitor Native App Setup Guide

## Overview

This project now supports building as a **native Android app** using Capacitor, giving you significant advantages over the PWA version:

### Storage Benefits: Native vs PWA

| Feature | PWA (Web) | Native Android |
|---------|-----------|----------------|
| **Storage Type** | IndexedDB | Native Filesystem |
| **Storage Limit** | ~50MB-1GB (browser quota) | **Device storage capacity** |
| **Persistence** | Can be cleared by browser | **Guaranteed persistence** |
| **Speed** | Good | **Faster (native I/O)** |
| **Offline** | Limited by quota | **Unlimited offline data** |
| **Background** | Limited | **Full background support** |

### Key Improvements

✅ **Unlimited storage** - No more browser quotas  
✅ **Faster caching** - Native file I/O is faster than IndexedDB  
✅ **Better reliability** - Data won't be cleared by browser  
✅ **True offline mode** - Cache entire Quran audio without limits  
✅ **Google Play Store** - Distribute through official channels  

## Architecture

The app uses **hybrid storage** that automatically selects the best storage mechanism:

```typescript
// Automatically detects platform:
- Android/iOS → Native Filesystem (via Capacitor)
- Web Browser → IndexedDB (fallback)
```

### Storage Service: `src/lib/native-storage.ts`

```typescript
import { NativeStorage } from './lib/native-storage';

const storage = new NativeStorage('my-storage');
await storage.init();

// Store audio blob
await storage.setItem('audio-key', audioBlob, {
  surahNum: 1,
  reciterFolder: 'Alafasy_128kbps'
});

// Retrieve audio blob
const result = await storage.getItem('audio-key');
if (result) {
  const audioBlob = result.data; // Blob
  const metadata = result.metadata; // { surahNum, reciterFolder }
}
```

## Installation & Setup

### Prerequisites

1. **Node.js** 18+ and npm
2. **Android Studio** (for Android builds)
3. **JDK 17+** (Android requirement)

### Already Completed ✅

The following setup steps have already been completed in this project:

1. ✅ Capacitor dependencies installed
2. ✅ Android platform added
3. ✅ Configuration files created
4. ✅ Hybrid storage service implemented
5. ✅ Audio cache migrated to hybrid storage

## Project Structure

```
mushafy/
├── android/                    # Native Android project
│   ├── app/
│   │   └── src/main/
│   │       ├── assets/public/  # Web assets (copied from dist/)
│   │       └── java/           # Native Android code
│   ├── build.gradle
│   └── gradle/
├── capacitor.config.ts         # Capacitor configuration
├── src/
│   └── lib/
│       ├── native-storage.ts   # Hybrid storage service ⭐
│       ├── audio-cache.ts      # Updated to use native storage ⭐
│       └── asset-cache.ts      # Image caching
└── dist/                       # Built web assets
```

## Development Workflow

### 1. Web Development (PWA)

```bash
# Develop as normal web app
npm run dev

# Build for web
npm run build
```

### 2. Build Android App

```bash
# Build web assets first
npm run build

# Sync web assets to Android project
npx cap sync android

# Open in Android Studio
npx cap open android
```

### 3. Run on Android Device/Emulator

**Option A: Android Studio**
1. Click "Run" button in Android Studio
2. Select device/emulator
3. App installs and launches

**Option B: Command Line**
```bash
# Run on connected device
npx cap run android

# Run with live reload (changes auto-sync)
npx cap run android --livereload --external
```

## Configuration

### `capacitor.config.ts`

```typescript
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.mushafy.quran',      // Android package name
  appName: 'Mushafy Quran',         // App display name
  webDir: 'dist',                   // Build output directory
  server: {
    androidScheme: 'https'          // Use HTTPS for web content
  }
};

export default config;
```

### Android Customization

Edit `android/app/src/main/res/values/strings.xml`:
```xml
<resources>
    <string name="app_name">Mushafy Quran</string>
    <string name="title_activity_main">Mushafy Quran</string>
    <string name="package_name">com.mushafy.quran</string>
</resources>
```

### App Icon & Splash Screen

Place your assets:
```
android/app/src/main/res/
├── mipmap-hdpi/ic_launcher.png       (72x72)
├── mipmap-mdpi/ic_launcher.png       (48x48)
├── mipmap-xhdpi/ic_launcher.png      (96x96)
├── mipmap-xxhdpi/ic_launcher.png     (144x144)
└── mipmap-xxxhdpi/ic_launcher.png    (192x192)
```

## Storage Migration

### Audio Cache Service

The audio cache now uses hybrid storage automatically:

```typescript
// src/lib/audio-cache.ts

// Store audio (uses native filesystem on Android)
await cacheAudio(reciterFolder, surahNum, audioBlob, timestamps);

// Retrieve audio (from native filesystem on Android)
const cached = await getCachedAudio(reciterFolder, surahNum);
if (cached) {
  const { blobData, timestamps } = cached;
  // Use audio...
}
```

### Platform Detection

```typescript
import { isNativePlatform, getPlatform } from './lib/native-storage';

if (isNativePlatform()) {
  console.log('Running on native app!');
  console.log('Platform:', getPlatform()); // 'android' or 'ios'
} else {
  console.log('Running on web browser');
}
```

## API Reference

### NativeStorage Class

#### Constructor
```typescript
const storage = new NativeStorage(dbName?: string);
```

#### Methods

**`init()`** - Initialize storage (required before first use)
```typescript
await storage.init();
```

**`setItem(key, data, metadata?)`** - Store data
```typescript
await storage.setItem('my-key', blob, { 
  timestamp: Date.now(),
  custom: 'metadata'
});
```

**`getItem(key)`** - Retrieve data
```typescript
const result = await storage.getItem('my-key');
// Returns: { data: Blob, timestamp: number, metadata?: object } | null
```

**`removeItem(key)`** - Delete data
```typescript
await storage.removeItem('my-key');
```

**`hasItem(key)`** - Check if exists
```typescript
const exists = await storage.hasItem('my-key');
```

**`keys()`** - Get all keys
```typescript
const allKeys = await storage.keys();
```

**`clear()`** - Delete all data
```typescript
await storage.clear();
```

**`getStorageInfo()`** - Get usage statistics
```typescript
const { used, available } = await storage.getStorageInfo();
```

## Building for Production

### Debug Build (Development)

```bash
npm run build
npx cap sync android
npx cap open android
# In Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release Build (Production)

1. **Generate signing key:**
```bash
keytool -genkey -v -keystore mushafy-release.keystore -alias mushafy -keyalg RSA -keysize 2048 -validity 10000
```

2. **Configure signing in `android/app/build.gradle`:**
```gradle
android {
    signingConfigs {
        release {
            storeFile file('../../mushafy-release.keystore')
            storePassword 'your-password'
            keyAlias 'mushafy'
            keyPassword 'your-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

3. **Build signed APK/AAB:**
```bash
cd android
./gradlew assembleRelease  # For APK
./gradlew bundleRelease    # For AAB (Google Play)
```

Output:
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## Publishing to Google Play Store

### Prepare App Bundle

1. Build AAB (required for Play Store):
```bash
cd android && ./gradlew bundleRelease
```

2. Test AAB locally:
```bash
bundletool build-apks --bundle=app-release.aab --output=app.apks
bundletool install-apks --apks=app.apks
```

### Submit to Play Store

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app
3. Upload AAB file
4. Fill in store listing:
   - App description
   - Screenshots (phone, tablet)
   - Feature graphic (1024x500)
   - App icon (512x512)
5. Set content rating
6. Set pricing & distribution
7. Submit for review

## Debugging

### Chrome DevTools

```bash
# Enable USB debugging on Android device
# Connect device via USB
# Navigate to:
chrome://inspect#devices

# Click "Inspect" under your app
```

### Logs

```bash
# View native logs
npx cap run android

# Or use adb directly
adb logcat | grep Capacitor
```

### Common Issues

**Issue: App crashes on launch**
- Check `npx cap sync` was run after building
- Verify `dist/` folder contains built assets
- Check Android Studio logcat for errors

**Issue: API calls fail**
- Add network permissions in `AndroidManifest.xml`
- Configure CORS on your API server

**Issue: Storage not working**
- Verify Filesystem plugin is installed: `@capacitor/filesystem`
- Check app has storage permissions

## Performance Tips

### Optimize Native Storage

```typescript
// Cache frequently accessed data
const storage = new NativeStorage('quick-access');
await storage.setItem('settings', JSON.stringify(settings));

// Use meaningful keys for easy debugging
await storage.setItem(`audio-${surahNum}-${reciter}`, blob);

// Clean up old data periodically
const keys = await storage.keys();
for (const key of keys) {
  const item = await storage.getItem(key);
  if (Date.now() - item.timestamp > 30 * 24 * 60 * 60 * 1000) {
    await storage.removeItem(key); // Delete after 30 days
  }
}
```

### Image Optimization

Keep images optimized for mobile:
```bash
npm run optimize-images
```

## Testing Checklist

Before releasing your Android app:

- [ ] Test on multiple Android versions (8.0+)
- [ ] Test on different screen sizes
- [ ] Verify audio playback works offline
- [ ] Check storage doesn't exceed reasonable limits
- [ ] Test deep linking / sharing
- [ ] Verify back button behavior
- [ ] Test screen rotation
- [ ] Check battery usage
- [ ] Verify permissions are requested correctly
- [ ] Test background audio playback
- [ ] Check notification behavior
- [ ] Verify app survives low memory conditions

## Capacitor Plugins Used

| Plugin | Purpose | Documentation |
|--------|---------|---------------|
| `@capacitor/core` | Core runtime | [Docs](https://capacitorjs.com/docs/apis/core) |
| `@capacitor/filesystem` | Native file storage | [Docs](https://capacitorjs.com/docs/apis/filesystem) |

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Studio Guide](https://developer.android.com/studio/intro)
- [Publishing to Play Store](https://developer.android.com/studio/publish)
- [Capacitor Community Plugins](https://github.com/capacitor-community)

## Troubleshooting

### Reset Everything

```bash
# Clean build artifacts
rm -rf android/
rm -rf dist/
rm -rf node_modules/

# Reinstall
npm install
npm run build

# Re-add Android
npx cap add android
npx cap sync android
```

### Update Capacitor

```bash
npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest @capacitor/filesystem@latest
npx cap sync android
```

## Next Steps

1. **Customize app icon** - Replace default launcher icons
2. **Add splash screen** - Improve launch experience
3. **Configure notifications** - For prayer times or bookmarks
4. **Add more plugins** - Share, clipboard, haptics, etc.
5. **Test on real devices** - Essential for performance validation
6. **Submit to Play Store** - Share your app with the world!

---

**Need help?** Check the [Capacitor Community Forums](https://forum.ionicframework.com/c/capacitor) or create an issue in the repository.
