/**
 * Quran Page Image Optimization Script
 * 
 * Converts all mushaf images to optimized WebP format:
 * - Target resolution: 1200x1600px (maintains aspect ratio)
 * - Quality: 85% WebP
 * - Target file size: 150-250KB per image
 * 
 * Usage: node scripts/optimize-images.js
 * 
 * Options:
 *   --backup    Create backup of original files before converting
 *   --dry-run   Show what would be done without making changes
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  targetWidth: 1200,
  targetHeight: 1600,
  webpQuality: 85,
  inputExtensions: ['.jpg', '.jpeg', '.png'],
  outputExtension: '.webp'
};

// Mushaf folders to process
const MUSHAF_FOLDERS = [
  'mushuf_mwdoa_images',
  'mushaf_tashel_pages',
  'mushaf_madinah_images'
];

const ASSETS_PATH = path.join(__dirname, '..', 'public', 'assets');

// Parse command line arguments
const args = process.argv.slice(2);
const createBackup = args.includes('--backup');
const dryRun = args.includes('--dry-run');

async function getImageInfo(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    const stats = fs.statSync(filePath);
    return {
      width: metadata.width,
      height: metadata.height,
      size: stats.size,
      format: metadata.format
    };
  } catch (error) {
    return null;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function optimizeImage(inputPath, outputPath) {
  const inputInfo = await getImageInfo(inputPath);
  
  if (!inputInfo) {
    console.error(`  ❌ Failed to read: ${path.basename(inputPath)}`);
    return { success: false, inputSize: 0, outputSize: 0 };
  }

  if (dryRun) {
    console.log(`  [DRY-RUN] Would optimize: ${path.basename(inputPath)}`);
    console.log(`    Current: ${inputInfo.width}x${inputInfo.height}, ${formatBytes(inputInfo.size)}`);
    return { success: true, inputSize: inputInfo.size, outputSize: 0, dryRun: true };
  }

  try {
    await sharp(inputPath)
      .resize(CONFIG.targetWidth, CONFIG.targetHeight, {
        fit: 'inside',
        withoutEnlargement: true // Don't upscale smaller images
      })
      .webp({ quality: CONFIG.webpQuality })
      .toFile(outputPath);

    const outputStats = fs.statSync(outputPath);
    const savings = inputInfo.size - outputStats.size;
    const savingsPercent = ((savings / inputInfo.size) * 100).toFixed(1);

    console.log(`  ✅ ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
    console.log(`     ${formatBytes(inputInfo.size)} → ${formatBytes(outputStats.size)} (${savingsPercent}% smaller)`);

    return { success: true, inputSize: inputInfo.size, outputSize: outputStats.size };
  } catch (error) {
    console.error(`  ❌ Failed to optimize ${path.basename(inputPath)}: ${error.message}`);
    return { success: false, inputSize: inputInfo.size, outputSize: 0 };
  }
}

async function backupFolder(folderPath) {
  const backupPath = folderPath + '_backup';
  
  if (fs.existsSync(backupPath)) {
    console.log(`  ⚠️  Backup folder already exists: ${backupPath}`);
    return true;
  }

  console.log(`  📁 Creating backup: ${backupPath}`);
  
  try {
    fs.mkdirSync(backupPath, { recursive: true });
    const files = fs.readdirSync(folderPath);
    
    for (const file of files) {
      const srcPath = path.join(folderPath, file);
      const destPath = path.join(backupPath, file);
      
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    
    console.log(`  ✅ Backup created successfully`);
    return true;
  } catch (error) {
    console.error(`  ❌ Backup failed: ${error.message}`);
    return false;
  }
}

async function processMushafFolder(folderName) {
  const folderPath = path.join(ASSETS_PATH, folderName);
  
  console.log(`\n📖 Processing: ${folderName}`);
  console.log(`   Path: ${folderPath}`);
  
  if (!fs.existsSync(folderPath)) {
    console.log(`  ⚠️  Folder not found, skipping...`);
    return { processed: 0, failed: 0, totalInputSize: 0, totalOutputSize: 0 };
  }

  // Create backup if requested
  if (createBackup && !dryRun) {
    const backupSuccess = await backupFolder(folderPath);
    if (!backupSuccess) {
      console.log(`  ⚠️  Backup failed, skipping this folder for safety`);
      return { processed: 0, failed: 0, totalInputSize: 0, totalOutputSize: 0 };
    }
  }

  const files = fs.readdirSync(folderPath);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return CONFIG.inputExtensions.includes(ext);
  });

  console.log(`   Found ${imageFiles.length} image files\n`);

  let processed = 0;
  let failed = 0;
  let totalInputSize = 0;
  let totalOutputSize = 0;

  for (const file of imageFiles) {
    const inputPath = path.join(folderPath, file);
    const baseName = path.basename(file, path.extname(file));
    const outputPath = path.join(folderPath, baseName + CONFIG.outputExtension);

    const result = await optimizeImage(inputPath, outputPath);
    
    if (result.success) {
      processed++;
      totalInputSize += result.inputSize;
      totalOutputSize += result.outputSize || 0;
      
      // Delete original file after successful conversion (if not dry run)
      if (!dryRun && !result.dryRun) {
        try {
          fs.unlinkSync(inputPath);
        } catch (error) {
          console.log(`     ⚠️  Could not delete original: ${error.message}`);
        }
      }
    } else {
      failed++;
    }
  }

  return { processed, failed, totalInputSize, totalOutputSize };
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       Quran Page Image Optimization Script                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Configuration:`);
  console.log(`  • Target resolution: ${CONFIG.targetWidth}x${CONFIG.targetHeight}px`);
  console.log(`  • WebP quality: ${CONFIG.webpQuality}%`);
  console.log(`  • Backup originals: ${createBackup ? 'Yes' : 'No'}`);
  console.log(`  • Dry run: ${dryRun ? 'Yes' : 'No'}`);

  let totalProcessed = 0;
  let totalFailed = 0;
  let grandTotalInputSize = 0;
  let grandTotalOutputSize = 0;

  for (const folder of MUSHAF_FOLDERS) {
    const result = await processMushafFolder(folder);
    totalProcessed += result.processed;
    totalFailed += result.failed;
    grandTotalInputSize += result.totalInputSize;
    grandTotalOutputSize += result.totalOutputSize;
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                        Summary                              ');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  ✅ Successfully processed: ${totalProcessed} images`);
  if (totalFailed > 0) {
    console.log(`  ❌ Failed: ${totalFailed} images`);
  }
  
  if (!dryRun && grandTotalInputSize > 0) {
    const totalSavings = grandTotalInputSize - grandTotalOutputSize;
    const savingsPercent = ((totalSavings / grandTotalInputSize) * 100).toFixed(1);
    console.log(`  📦 Total size: ${formatBytes(grandTotalInputSize)} → ${formatBytes(grandTotalOutputSize)}`);
    console.log(`  💾 Total saved: ${formatBytes(totalSavings)} (${savingsPercent}%)`);
    console.log(`  📄 Average file size: ${formatBytes(Math.round(grandTotalOutputSize / totalProcessed))}`);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  
  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made. Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Done! Remember to update your code to use .webp extension.');
    console.log('   Update getPageImageFilename() in src/lib/quran-mapping.ts');
  }
}

main().catch(console.error);
