# Swiper Implementation Plan - Mushafy Quran App

## Quick Start Guide

This document provides a step-by-step implementation plan for integrating Swiper.js into the mushafy Quran app, based on the efficient architecture from ozobair's implementation.

---

## Phase 1: Setup & Dependencies (30 minutes)

### Step 1.1: Install Swiper
```bash
cd d:\apps\quran\mushafy
npm install swiper
```

### Step 1.2: Verify Installation
Check that these are added to `package.json`:
```json
{
  "dependencies": {
    "swiper": "^11.0.0"
  }
}
```

---

## Phase 2: Create Swiper Component (2-3 hours)

### Step 2.1: Create Component File
Create: `src/components/quran/SwiperPageDisplay.tsx`

**Basic Structure:**
```typescript
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Virtual, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/virtual';

export function SwiperPageDisplay() {
  // Component code here
}
```

### Step 2.2: Add Props Interface
```typescript
interface SwiperPageDisplayProps {
  initialPage: number;
  viewMode: 'single' | 'double';
  isMobile: boolean;
  onPageChange: (pageNumber: number) => void;
  onAyahSelect?: (surah: number, ayah: number) => void;
  currentPlayingAyah?: { surah: number; ayah: number } | null;
  bookmarks: number[];
  memorizationBookmarks: number[];
  readingBookmarks: number[];
  isFullscreen: boolean;
  onImageClick: () => void;
  audioSource?: 'everyayah' | 'mp3quran';
  hasAyahTimings?: boolean;
}
```

### Step 2.3: Implement Core Swiper
See full implementation in `SWIPER_COMPARISON_AND_RECOMMENDATIONS.md`

---

## Phase 3: Add Styling (1 hour)

### Step 3.1: Add Base Swiper Styles
In `src/index.css`, add:
```css
/* Swiper Core Styles */
@import 'swiper/css';
@import 'swiper/css/navigation';
@import 'swiper/css/virtual';
```

### Step 3.2: Custom Navigation Buttons
```css
/* Custom Swiper Navigation - Match App Theme */
.swiper-button-next,
.swiper-button-prev {
  width: 3.5rem;
  height: 3.5rem;
  background: linear-gradient(to bottom right, #15803d, #047857);
  color: #F2E3BB;
  border-radius: 50%;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(5, 150, 105, 0.3);
  transition: all 0.2s ease;
}

.swiper-button-next:hover,
.swiper-button-prev:hover {
  background: linear-gradient(to bottom right, #166534, #065f46);
  transform: scale(1.1);
}

.swiper-button-next.swiper-button-disabled,
.swiper-button-prev.swiper-button-disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.swiper-button-next::after,
.swiper-button-prev::after {
  font-size: 1.5rem;
  font-weight: bold;
}

/* Hide navigation on mobile */
@media (max-width: 768px) {
  .swiper-button-next,
  .swiper-button-prev {
    display: none;
  }
}

/* Hardware acceleration */
.swiper {
  transform: translate3d(0, 0, 0);
}

/* Smooth slide transitions */
.swiper-slide {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.3s ease;
}
```

### Step 3.3: RTL Support
```css
/* RTL Swiper Adjustments */
.swiper-rtl .swiper-button-next {
  left: 10px;
  right: auto;
}

.swiper-rtl .swiper-button-prev {
  right: 10px;
  left: auto;
}
```

---

## Phase 4: Integration with Surah.tsx (2 hours)

### Step 4.1: Import New Component
```typescript
// src/pages/Surah.tsx
import { SwiperPageDisplay } from '@/components/quran/SwiperPageDisplay';
```

### Step 4.2: Add Feature Flag (Optional - for testing)
```typescript
// Add state for testing both implementations
const [useSwiperMode, setUseSwiperMode] = useState(() => {
  const saved = localStorage.getItem('quran-use-swiper');
  return saved === 'true';
});

// Add toggle in settings (temporary)
<Switch
  checked={useSwiperMode}
  onCheckedChange={(checked) => {
    setUseSwiperMode(checked);
    localStorage.setItem('quran-use-swiper', checked.toString());
  }}
/>
<Label>Use Swiper Mode (Experimental)</Label>
```

### Step 4.3: Replace PageDisplay
```typescript
// Find this section in Surah.tsx render:
{/* Page Display */}
{useSwiperMode ? (
  <SwiperPageDisplay
    initialPage={currentPageNum}
    viewMode={viewMode}
    isMobile={isMobile}
    onPageChange={(pageNum) => {
      navigate(`/page/${pageNum}`, { replace: true });
    }}
    onAyahSelect={handleAyahSelect}
    currentPlayingAyah={currentPlayingAyah}
    bookmarks={bookmarks}
    memorizationBookmarks={memorizationBookmarks}
    readingBookmarks={readingBookmarks}
    isFullscreen={isFullscreen}
    onImageClick={handleFullscreenToggle}
    audioSource={audioSource}
    hasAyahTimings={hasAyahTimings}
  />
) : (
  <PageDisplay
    {/* existing props */}
  />
)}
```

---

## Phase 5: Handle Audio Player Sync (1-2 hours)

### Step 5.1: Add Swiper Ref
```typescript
// In SwiperPageDisplay.tsx
const swiperRef = useRef<SwiperType | null>(null);

<Swiper
  onSwiper={(swiper) => {
    swiperRef.current = swiper;
  }}
  ...
/>
```

### Step 5.2: Expose Navigation Method
```typescript
// Add to component interface
interface SwiperPageDisplayProps {
  ...
  onSwiperReady?: (navigateToPage: (page: number) => void) => void;
}

// In component:
useEffect(() => {
  if (swiperRef.current && onSwiperReady) {
    onSwiperReady((pageNum: number) => {
      swiperRef.current?.slideTo(pageNum - 1, 400);
    });
  }
}, [onSwiperReady]);
```

### Step 5.3: Connect Audio Player
```typescript
// In Surah.tsx - store navigation function
const [navigateToPage, setNavigateToPage] = useState<((page: number) => void) | null>(null);

// Pass to SwiperPageDisplay
<SwiperPageDisplay
  onSwiperReady={(navFunc) => setNavigateToPage(() => navFunc)}
  ...
/>

// Use in audio player effect
useEffect(() => {
  if (currentPlayingAyah && navigateToPage) {
    const targetPage = getAyahPage(currentPlayingAyah);
    navigateToPage(targetPage);
  }
}, [currentPlayingAyah, navigateToPage]);
```

---

## Phase 6: Testing (2-3 hours)

### Step 6.1: Basic Navigation Tests
- [ ] Swipe left/right works
- [ ] Navigation arrows work on desktop
- [ ] Keyboard arrows work
- [ ] URL updates correctly
- [ ] Direct URL navigation works (`/page/123`)
- [ ] Page 1 and 604 boundaries work

### Step 6.2: View Mode Tests
- [ ] Single page mode works
- [ ] Double page mode works
- [ ] Mobile view works
- [ ] Desktop view works
- [ ] RTL mode works
- [ ] LTR mode works

### Step 6.3: Feature Integration Tests
- [ ] Bookmarks display correctly
- [ ] All three bookmark types show
- [ ] Fullscreen mode works
- [ ] Image caching works
- [ ] Tarteel pages work
- [ ] Long-press ayah selection works

### Step 6.4: Audio Player Tests
- [ ] Playing ayah auto-navigates page
- [ ] Swiper doesn't interrupt audio
- [ ] Ayah highlighting updates
- [ ] Repeat mode works during swiping
- [ ] Stop/play during swipe works

### Step 6.5: Performance Tests
- [ ] Memory usage is lower than before
- [ ] No lag during rapid swiping
- [ ] Images load smoothly
- [ ] No memory leaks over time
- [ ] Works on low-end Android devices

---

## Phase 7: Optimization (1-2 hours)

### Step 7.1: Aggressive Memory Cleanup
```typescript
// In SwiperPageDisplay - remove far pages
const handleSlideChange = (swiper: SwiperType) => {
  const currentPage = swiper.realIndex + 1;
  
  setLoadedPages(prev => {
    const newSet = new Set<number>();
    
    // Keep current ± 2 pages
    for (let i = -2; i <= 2; i++) {
      const page = currentPage + i;
      if (page >= 1 && page <= 604) {
        newSet.add(page);
      }
    }
    
    return newSet;
  });
};
```

### Step 7.2: Pre-loading Optimization
```typescript
// Load current + adjacent immediately
// Load ±2 pages with slight delay
useEffect(() => {
  const currentPage = swiperRef.current?.realIndex + 1;
  if (!currentPage) return;
  
  // Immediate load
  preloadPages([currentPage - 1, currentPage, currentPage + 1]);
  
  // Delayed load (200ms)
  const timer = setTimeout(() => {
    preloadPages([currentPage - 2, currentPage + 2]);
  }, 200);
  
  return () => clearTimeout(timer);
}, [swiperRef.current?.realIndex]);
```

### Step 7.3: Virtual Slides Configuration
```typescript
<Swiper
  virtual={{
    enabled: true,
    addSlidesAfter: 1,   // Render 1 slide after
    addSlidesBefore: 1,  // Render 1 slide before
    cache: false,        // Don't cache removed slides
  }}
  ...
/>
```

---

## Phase 8: Cleanup & Documentation (1 hour)

### Step 8.1: Remove Feature Flag (After testing)
Once Swiper is stable, remove the old `PageDisplay` component and feature flag.

```typescript
// Simply use SwiperPageDisplay directly
<SwiperPageDisplay {...props} />
```

### Step 8.2: Update README
Add to `README.md`:
```markdown
## Page Navigation

The app uses Swiper.js v11 for smooth, hardware-accelerated page transitions:
- Swipe gestures on mobile
- Arrow buttons on desktop
- Keyboard navigation (arrow keys)
- Virtual slides for optimal performance (only 2-3 pages in DOM)
```

### Step 8.3: Update Copilot Instructions
Add to `.github/copilot-instructions.md`:
```markdown
### Page Swiping (Swiper.js)
- Uses Swiper React components (`swiper/react`)
- Virtual slides enabled - only 2-3 pages rendered at once
- Component: `SwiperPageDisplay.tsx`
- DO NOT modify Swiper core styles - use custom CSS classes
- ALWAYS test on mobile devices after Swiper changes
```

---

## Rollback Plan

If Swiper causes issues, you can easily rollback:

### Step 1: Disable Feature Flag
```typescript
localStorage.setItem('quran-use-swiper', 'false');
```
Or remove the feature flag and use old `PageDisplay`.

### Step 2: Remove Swiper Package (if needed)
```bash
npm uninstall swiper
```

### Step 3: Restore Old Component
Simply use `PageDisplay` component as before.

---

## Expected Results

### Before (Current)
- Memory: ~50-100MB (5-10 pages in DOM)
- Scroll: Native CSS scroll-snap
- Touch: Basic browser gestures
- Performance: Good, but not optimal

### After (With Swiper)
- Memory: ~20-40MB (2-3 pages in DOM)
- Scroll: Hardware-accelerated transforms
- Touch: Optimized Swiper gestures
- Performance: Excellent, matches native apps

### Improvement Summary
- **50-60% less memory usage**
- **Smoother animations**
- **Better touch response**
- **More professional feel**

---

## Common Issues & Solutions

### Issue 1: Swiper Not Rendering
**Symptoms**: Blank screen, no pages
**Solution**: Check that Swiper CSS is imported:
```typescript
import 'swiper/css';
```

### Issue 2: Navigation Buttons Not Working
**Symptoms**: Clicking arrows does nothing
**Solution**: Ensure Navigation module is imported:
```typescript
import { Navigation } from 'swiper/modules';
modules={[Navigation, ...]}
```

### Issue 3: Virtual Slides Not Rendering
**Symptoms**: Pages not loading
**Solution**: Check `loadedPages` state is being updated in `handleSlideChange`.

### Issue 4: RTL Mode Backwards
**Symptoms**: Swiping right goes left
**Solution**: Set Swiper `dir` prop:
```typescript
<Swiper dir={isRTL ? 'rtl' : 'ltr'} />
```

### Issue 5: Images Not Caching
**Symptoms**: Images reload every time
**Solution**: Ensure `CachedImage` component is working. Check NativeStorage logs.

### Issue 6: Audio Doesn't Navigate
**Symptoms**: Playing ayah doesn't change page
**Solution**: Verify `onSwiperReady` callback is wired up correctly.

---

## Performance Monitoring

### Check Memory Usage

**Chrome DevTools:**
1. Open DevTools (F12)
2. Performance tab → Memory checkbox
3. Record while swiping pages
4. Look for memory spikes

**Before Swiper**: Should see 50-100MB with spikes  
**After Swiper**: Should see 20-40MB, flatter graph

### Check Render Performance

**React DevTools Profiler:**
1. Install React DevTools extension
2. Open Profiler tab
3. Record while swiping
4. Check render times

**Target**: <50ms per page transition

---

## Next Steps

1. **Start with Phase 1**: Install Swiper dependency
2. **Proceed sequentially**: Don't skip phases
3. **Test frequently**: After each phase, test the app
4. **Use feature flag**: Keep old implementation until Swiper is stable
5. **Monitor console**: Watch for errors or warnings
6. **Test on mobile**: Always test on actual Android device

---

## Need Help?

If you encounter issues:
1. Check console for errors
2. Review `SWIPER_COMPARISON_AND_RECOMMENDATIONS.md`
3. Check Swiper docs: https://swiperjs.com/react
4. Test with minimal example first (3 pages only)
5. Ask for help with specific error messages

---

## Timeline Estimate

| Phase | Estimated Time |
|-------|---------------|
| 1. Setup | 30 minutes |
| 2. Create Component | 2-3 hours |
| 3. Styling | 1 hour |
| 4. Integration | 2 hours |
| 5. Audio Sync | 1-2 hours |
| 6. Testing | 2-3 hours |
| 7. Optimization | 1-2 hours |
| 8. Cleanup | 1 hour |
| **Total** | **10-15 hours** |

Can be done over 2-3 days with testing breaks.

---

## Success Criteria

- [ ] All 604 pages swipeable
- [ ] Memory usage reduced by 40%+
- [ ] No visual glitches
- [ ] Smooth 60fps animations
- [ ] All existing features work
- [ ] Works on mobile and desktop
- [ ] Works in RTL and LTR modes
- [ ] Audio player syncs correctly
- [ ] Bookmarks display correctly
- [ ] Can pass to production

---

Good luck with the implementation! 🚀
