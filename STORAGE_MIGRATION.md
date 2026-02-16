# Storage Migration Notes

## What Changed?

Your Quran app now uses **hybrid storage** that automatically switches between:
- **Native filesystem** on Android (unlimited storage)
- **IndexedDB** on web browsers (existing behavior)

## Impact on Existing Users

### Web Browser Users (No Change)
✅ Everything works exactly as before  
✅ Existing cached audio remains accessible  
✅ Storage limits remain the same (~50MB-1GB)  

### Android App Users (NEW!)
✅ Unlimited storage capacity  
✅ Faster file I/O performance  
✅ Better offline reliability  
⚠️ **Separate storage** from web version (cached data doesn't transfer)

## Migration Behavior

### Audio Cache
The app will automatically:
1. Check for cached audio in the current platform's storage
2. Download and cache if not found
3. Re-use cached audio on subsequent plays

**Result**: First-time Android app users will need to re-download audio that was previously cached in the browser.

### User Data
Bookmarks, settings, and preferences are stored in `localStorage` and remain separate between:
- Web browser → Browser's localStorage
- Android app → WebView's localStorage

**Note**: Users will need to re-create bookmarks in the Android app.

## Storage Location Reference

### Web Browser (PWA)
```
IndexedDB → Browser's internal database
  ├── quran-audio-cache (audio files)
  └── [Other caches]

localStorage → Browser storage
  ├── quran-bookmarks
  ├── quran-settings
  └── [Other preferences]
```

### Android Native App
```
Native Filesystem → /data/data/com.mushafy.quran/files/
  ├── [reciter]-[surah].blob (audio files)
  ├── [reciter]-[surah].meta.json (metadata)
  └── [Other cached files]

WebView localStorage → /data/data/com.mushafy.quran/app_webview/Local Storage/
  ├── quran-bookmarks
  ├── quran-settings
  └── [Other preferences]
```

## Backward Compatibility

The hybrid storage system is **fully backward compatible**:
- Old IndexedDB code continues to work on web
- No breaking changes to existing APIs
- Same function signatures for all cache operations

## Testing Migration

### Test on Web
```bash
npm run dev
# Test in browser - should work exactly as before
```

### Test on Android
```bash
npm run build
npm run cap:sync
npm run cap:run
# Expected: Audio cache starts empty, downloads on first play
```

## Future Enhancements

### Potential Additions
1. **Export/Import**: Allow users to transfer bookmarks between web/Android
2. **Cloud Sync**: Sync bookmarks and preferences via cloud service
3. **Cache Migration**: Automatically migrate web cache to Android on first launch
4. **Offline Packages**: Pre-bundle popular reciters in the APK

### API Stability
The `NativeStorage` API is designed to remain stable. Future enhancements will:
- Add new methods (backward compatible)
- Never break existing method signatures
- Clearly mark deprecated features

## Troubleshooting

### Audio not playing on Android
1. Clear app cache: Settings → Apps → Mushafy → Storage → Clear Cache
2. Re-download audio from reciter selection

### Storage full error (Android)
- Check device storage in Settings
- Delete unused apps/files to free space
- Native storage uses device filesystem, not artificial quotas

### Data not syncing between web and Android
- This is expected behavior - they use separate storage
- Use export/import features once implemented

## Developer Notes

### Adding New Cached Data Types

```typescript
// Create new storage instance
const myStorage = new NativeStorage('my-feature-cache');
await myStorage.init();

// Store data
await myStorage.setItem('key', dataBlob, { 
  version: 1,
  type: 'my-type'
});

// Retrieve data
const item = await myStorage.getItem('key');
if (item?.metadata?.version === 1) {
  // Handle v1 data
}
```

### Cache Keys Format
Use consistent, descriptive keys:
```typescript
// Good ✅
`${reciterFolder}-${surahNum}` // e.g., "Alafasy_128kbps-1"
`audio-${type}-${id}` // e.g., "audio-surah-114"

// Bad ❌
`data1`, `cache`, `temp` // Too generic, hard to debug
```

### Monitoring Storage Usage

```typescript
import { nativeStorage } from '@/lib/native-storage';

// Get statistics
const keys = await nativeStorage.keys();
const { used, available } = await nativeStorage.getStorageInfo();

console.log(`Cached items: ${keys.length}`);
console.log(`Storage used: ${(used / 1024 / 1024).toFixed(2)} MB`);

if (isNativePlatform()) {
  console.log('Using native filesystem (unlimited)');
} else {
  console.log(`Available: ${(available / 1024 / 1024).toFixed(2)} MB`);
}
```

## Documentation Updates

All documentation has been updated to reflect the new hybrid storage system:
- ✅ [CAPACITOR_SETUP.md](./CAPACITOR_SETUP.md) - Complete native app setup guide
- ✅ [CAPACITOR_QUICK_REF.md](./CAPACITOR_QUICK_REF.md) - Quick command reference
- ✅ [README.md](./README.md) - Updated with Capacitor section
- ✅ [.github/copilot-instructions.md](./.github/copilot-instructions.md) - AI coding guide (if exists)

---

**Questions?** Check [CAPACITOR_SETUP.md](./CAPACITOR_SETUP.md) or create an issue.
