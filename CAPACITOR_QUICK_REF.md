# Capacitor Quick Reference

## 🚀 Common Commands

### Development
```bash
# Start web dev server (PWA mode)
npm run dev

# Build web assets
npm run build
```

### Capacitor Android

```bash
# Sync web build to Android (after npm run build)
npm run cap:sync

# Build and run on Android device/emulator
npm run cap:run

# Open Android project in Android Studio
npm run cap:open

# Update Capacitor dependencies
npm run cap:update
```

## 📦 Storage API Usage

### Import
```typescript
import { NativeStorage, isNativePlatform } from '@/lib/native-storage';
```

### Basic Usage
```typescript
// Create storage instance
const storage = new NativeStorage('my-app');

// Initialize (required before first use)
await storage.init();

// Check platform
if (isNativePlatform()) {
  console.log('Running on native Android/iOS');
} else {
  console.log('Running on web browser');
}

// Store data
await storage.setItem('key', blob, { 
  custom: 'metadata' 
});

// Retrieve data
const result = await storage.getItem('key');
if (result) {
  const blob = result.data;
  const metadata = result.metadata;
}

// Delete data
await storage.removeItem('key');

// Get all keys
const keys = await storage.keys();

// Clear all
await storage.clear();

// Get storage info
const { used, available } = await storage.getStorageInfo();
```

## 🎵 Audio Cache Example

```typescript
import { cacheAudio, getCachedAudio } from '@/lib/audio-cache';

// Cache audio (automatically uses native storage on Android)
await cacheAudio('Alafasy_128kbps', 1, audioBlob, timestamps);

// Retrieve cached audio
const cached = await getCachedAudio('Alafasy_128kbps', 1);
if (cached) {
  const { blobData, timestamps } = cached;
  // Use audio
}
```

## 🔧 Configuration

### Change App Name/ID
Edit `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  appId: 'com.yourcompany.app',
  appName: 'Your App Name',
  webDir: 'dist',
};
```

### Android Icon
Place icons in: `android/app/src/main/res/mipmap-*/ic_launcher.png`

## 📱 Testing

### Debug on Device
1. Enable USB debugging on Android device
2. Connect via USB
3. Run: `npm run cap:run`

### View Logs
```bash
# Capacitor logs
npx cap run android

# OR use adb
adb logcat | grep Capacitor
```

### Chrome DevTools
1. Open `chrome://inspect#devices`
2. Find your device
3. Click "Inspect"

## 📦 APK Optimization

### Mushaf Images (On-Demand Loading)
**Mushaf images are NOT bundled in the APK** to keep size small (~100+ MB saved).

**How it works:**
- **Build-time exclusion:** Vite automatically excludes mushaf images during production builds
- Images fetch from GitHub on-demand when users view pages
- Cached in native storage after first load
- Offline-capable after initial download

**Configuration:**
- Vite exclusion plugin: [vite.config.ts](vite.config.ts) `excludeMushafImagesPlugin`
- No manual cleanup needed - handled automatically during `npm run build`

**Excluded directories:**
- `mushaf_madinah_images/`
- `mushaf_tashel_pages/`
- `mushuf_mwdoa_images/`

## 🏗️ Building Release APK

### Quick Build
```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### Signing (Production)
1. Generate keystore:
```bash
keytool -genkey -v -keystore release.keystore -alias myapp -keyalg RSA -keysize 2048 -validity 10000
```

2. Add to `android/app/build.gradle`:
```gradle
android {
    signingConfigs {
        release {
            storeFile file('../../release.keystore')
            storePassword 'your-password'
            keyAlias 'myapp'
            keyPassword 'your-password'
        }
    }
}
```

3. Build:
```bash
cd android && ./gradlew assembleRelease
```

## 🐛 Troubleshooting

### App not updating
```bash
# Clean and rebuild
npm run build
npm run cap:sync
```

### Android build fails
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Reset Android
```bash
rm -rf android/
npm run build
npx cap add android
npx cap sync
```

### Update Capacitor
```bash
npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest @capacitor/filesystem@latest
npx cap sync
```

## 📚 Resources

- [Full Setup Guide](./CAPACITOR_SETUP.md)
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Filesystem Plugin](https://capacitorjs.com/docs/apis/filesystem)
- [Android Studio](https://developer.android.com/studio)

## ⚡ Pro Tips

1. **Always build web first**: `npm run build` before `cap sync`
2. **Use `cap:sync` script**: Builds and syncs in one command
3. **Keep keystore safe**: You need it to update your app on Play Store
4. **Test on real device**: Emulators can be unreliable
5. **Check native logs**: Use `adb logcat` for debugging
6. **Version control**: Commit `android/` folder (except build artifacts)

---

**Need more details?** See [CAPACITOR_SETUP.md](./CAPACITOR_SETUP.md)
