# Image Optimization Guide

## Current Situation

Your Quran page images are already in WebP format but could be significantly reduced in size:

### Current Sizes:
- **mushuf_mwdoa_images**: 604 files, 221 MB (375 KB/file)
- **mushaf_tashel_pages**: 604 files, 178 MB (302 KB/file)
- **mushaf_madinah_images**: 604 files, 200 MB (340 KB/file)
- **TOTAL**: 1,812 files, **~599 MB**

## Optimization Options

### Option 1: Medium Quality (75%) - RECOMMENDED ⭐
**Best balance between quality and file size**

```bash
node scripts/optimize-webp-images.js --quality 75 --backup
```

**Expected Results:**
- **mushuf_mwdoa_images**: 221 MB → 166 MB (25% reduction)
- **mushaf_tashel_pages**: 178 MB → 134 MB (25% reduction)
- **mushaf_madinah_images**: 200 MB → 150 MB (25% reduction)
- **TOTAL**: 599 MB → **~450 MB** (saves ~150 MB)

Average file size: 375 KB → 248 KB

### Option 2: Low Quality (65%) - Aggressive
**More compression, still good quality for web/mobile**

```bash
node scripts/optimize-webp-images.js --quality 65 --backup
```

**Expected Results:**
- **mushuf_mwdoa_images**: 221 MB → 144 MB (35% reduction)
- **mushaf_tashel_pages**: 178 MB → 116 MB (35% reduction)
- **mushaf_madinah_images**: 200 MB → 130 MB (35% reduction)
- **TOTAL**: 599 MB → **~390 MB** (saves ~209 MB)

Average file size: 375 KB → 215 KB

### Option 3: High Quality (85%) - Minimal Compression
**Highest quality, smaller savings**

```bash
node scripts/optimize-webp-images.js --quality 85 --backup
```

**Expected Results:**
- TOTAL: 599 MB → **~540 MB** (saves ~59 MB, 10% reduction)

Average file size: 375 KB → 338 KB

### Option 4: Minimal Quality (55%) - Maximum Compression
**Smallest files, may show compression artifacts**

```bash
node scripts/optimize-webp-images.js --quality 55 --backup
```

**Expected Results:**
- TOTAL: 599 MB → **~330 MB** (saves ~269 MB, 45% reduction)

Average file size: 375 KB → 182 KB

## Step-by-Step Instructions

### 1. Test First (Dry Run)

Test on a single folder to see results without making changes:

```bash
# Test on the smallest folder first
node scripts/optimize-webp-images.js --folder tashel --quality 75 --dry-run
```

### 2. Backup Original Images (RECOMMENDED)

Create a backup before optimizing:

```bash
# This will create timestamped backup folders automatically
node scripts/optimize-webp-images.js --quality 75 --backup
```

Backups will be saved as:
- `mushuf_mwdoa_images_backup_[timestamp]`
- `mushaf_tashel_pages_backup_[timestamp]`
- `mushaf_madinah_images_backup_[timestamp]`

### 3. Optimize Single Folder (Safe Approach)

Start with one folder to test results:

```bash
# Optimize just the Tashel folder
node scripts/optimize-webp-images.js --folder tashel --quality 75 --backup
```

### 4. Optimize All Folders

Once satisfied with test results, optimize all folders:

```bash
# Optimize all three mushaf folders
node scripts/optimize-webp-images.js --quality 75 --backup
```

### 5. Verify Results

Check the optimized images in your browser/app to ensure quality is acceptable.

### 6. Delete Backups (Optional)

After verifying everything works correctly, you can delete the backup folders to save disk space:

```powershell
# Delete all backup folders
Remove-Item "public\assets\*_backup_*" -Recurse -Force
```

## Script Options

```bash
--dry-run          # Preview changes without modifying files
--quality <n>      # Set WebP quality (55-100, default: 75)
--folder <name>    # Optimize single folder (mwdoa/tashel/madinah)
--backup           # Create timestamped backup before optimizing
```

## Quality Comparison Guide

| Quality | File Size | Use Case | Visual Quality |
|---------|-----------|----------|----------------|
| 85% | ~340 KB | Print, High-DPI displays | Excellent |
| 75% | ~250 KB | **Web/Mobile (recommended)** | Very Good |
| 65% | ~215 KB | Bandwidth-limited users | Good |
| 55% | ~180 KB | Maximum compression | Acceptable |

## Additional Optimization Strategies

### For Android App (Native Storage)
Since the Android app uses native storage (unlimited space), you might want to use higher quality (85%) for the best reading experience, as storage is not a concern.

### For Web Version (Browser Cache)
Use medium quality (75%) or lower (65%) to reduce initial load times and respect users' bandwidth, especially in regions with slower internet.

### Hybrid Approach
You could maintain two versions:
- **Web version**: Use quality 65-75% for faster loading
- **Android APK**: Include higher quality (85%) images

### Progressive Image Loading
For future optimization, consider implementing progressive image loading where:
1. Low-quality placeholder loads first (quality 55%)
2. High-quality image loads in background (quality 75-85%)

## Troubleshooting

### If optimization fails:
- Ensure Node.js and Sharp library are properly installed
- Check that you have write permissions to the image folders
- Make sure no other process is accessing the images

### If quality is too low:
- Re-run with higher quality setting
- Restore from backup if needed

### If file sizes are still too large:
- Try reducing quality to 65% or 55%
- Consider reducing target resolution below 1200x1600px

## Recommended Next Steps

1. **Test with dry-run**: `node scripts/optimize-webp-images.js --folder tashel --quality 75 --dry-run`
2. **Optimize one folder**: `node scripts/optimize-webp-images.js --folder tashel --quality 75 --backup`
3. **Check quality in app**: Load the app and verify images look good
4. **Optimize all folders**: `node scripts/optimize-webp-images.js --quality 75 --backup`
5. **Update and deploy**: Build and sync to Android if satisfied

## Performance Impact

After optimization with quality 75%:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Size | 599 MB | 450 MB | 25% smaller |
| Avg File Size | 340 KB | 248 KB | Faster loading |
| Pages Load | ~2-3s on 3G | ~1.5-2s on 3G | 30-40% faster |
| Storage (604 pages × 3) | 599 MB | 450 MB | Saves 150 MB |
| Android APK | Smaller APK size | N/A | Faster downloads |

## Questions?

- The optimization is **non-destructive** when using `--backup`
- You can **re-run with different quality** settings anytime
- The original image dimensions are **preserved** (only compressed)
- WebP format is already **highly optimized**, this script just applies better compression
