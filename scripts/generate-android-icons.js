/**
 * Android App Icon Generator
 * 
 * Generates Android launcher icons from the mushafy.png logo.
 * Creates multiple densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi).
 * 
 * Usage: node scripts/generate-android-icons.js
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes for different Android densities
const ICON_SIZES = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

// Foreground icon sizes for adaptive icons (Android 8.0+)
const ADAPTIVE_SIZES = {
  'mdpi': 108,
  'hdpi': 162,
  'xhdpi': 216,
  'xxhdpi': 324,
  'xxxhdpi': 432
};

const SOURCE_IMAGE = path.join(__dirname, '..', 'public', 'mushafy.png');
const ANDROID_RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

async function generateIcon(size, outputPath) {
  try {
    await sharp(SOURCE_IMAGE)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 5, g: 150, b: 105, alpha: 1 } // emerald-600 (#059669)
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated ${size}x${size} icon: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`✗ Failed to generate ${size}x${size} icon:`, error.message);
  }
}

async function generateAdaptiveIcon(size, outputPath) {
  try {
    // Adaptive icons need more padding (108dp vs 72dp safe area)
    await sharp(SOURCE_IMAGE)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // transparent for foreground
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated ${size}x${size} adaptive icon: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`✗ Failed to generate ${size}x${size} adaptive icon:`, error.message);
  }
}

async function main() {
  console.log('🎨 Generating Android app icons from mushafy.png...\n');
  
  // Check if source image exists
  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.error('❌ Source image not found:', SOURCE_IMAGE);
    process.exit(1);
  }
  
  console.log('📖 Source image:', SOURCE_IMAGE);
  console.log('📁 Output directory:', ANDROID_RES);
  console.log('');
  
  // Generate standard launcher icons
  console.log('Generating standard launcher icons...');
  for (const [density, size] of Object.entries(ICON_SIZES)) {
    const mipmapDir = path.join(ANDROID_RES, `mipmap-${density}`);
    const iconPath = path.join(mipmapDir, 'ic_launcher.png');
    const roundIconPath = path.join(mipmapDir, 'ic_launcher_round.png');
    
    await generateIcon(size, iconPath);
    await generateIcon(size, roundIconPath); // Same image for round variant
  }
  
  console.log('');
  console.log('Generating adaptive icon foregrounds...');
  
  // Generate adaptive icon foregrounds (Android 8.0+)
  for (const [density, size] of Object.entries(ADAPTIVE_SIZES)) {
    const mipmapDir = path.join(ANDROID_RES, `mipmap-${density}`);
    const foregroundPath = path.join(mipmapDir, 'ic_launcher_foreground.png');
    
    await generateAdaptiveIcon(size, foregroundPath);
  }
  
  console.log('');
  console.log('✨ Icon generation complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run: npm run cap:sync');
  console.log('2. Rebuild the app in Android Studio or run: npm run cap:run');
  console.log('3. The new icon will appear on your device!');
}

main().catch(console.error);
