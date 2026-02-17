/**
 * Android Splash Screen Generator
 * 
 * Generates splash screens from mushafy.png with transparent backgrounds.
 * Creates multiple densities for portrait and landscape orientations.
 * 
 * Usage: node scripts/generate-splash-screens.js
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Splash screen sizes for different orientations and densities
const SPLASH_SIZES = {
  'port-mdpi': { width: 320, height: 480 },
  'port-hdpi': { width: 480, height: 800 },
  'port-xhdpi': { width: 720, height: 1280 },
  'port-xxhdpi': { width: 1080, height: 1920 },
  'port-xxxhdpi': { width: 1440, height: 2560 },
  'land-mdpi': { width: 480, height: 320 },
  'land-hdpi': { width: 800, height: 480 },
  'land-xhdpi': { width: 1280, height: 720 },
  'land-xxhdpi': { width: 1920, height: 1080 },
  'land-xxxhdpi': { width: 2560, height: 1440 }
};

const SOURCE_IMAGE = path.join(__dirname, '..', 'public', 'mushafy.png');
const ANDROID_RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

async function generateSplash(width, height, outputPath) {
  try {
    // Calculate logo size (40% of smallest dimension)
    const logoSize = Math.floor(Math.min(width, height) * 0.4);
    
    // Create transparent background with centered logo
    await sharp(SOURCE_IMAGE)
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .extend({
        top: Math.floor((height - logoSize) / 2),
        bottom: Math.ceil((height - logoSize) / 2),
        left: Math.floor((width - logoSize) / 2),
        right: Math.ceil((width - logoSize) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated ${width}x${height} splash: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`✗ Failed to generate ${width}x${height} splash:`, error.message);
  }
}

async function main() {
  console.log('🎨 Generating Android splash screens from mushafy.png...\n');
  
  // Check if source image exists
  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.error('❌ Source image not found:', SOURCE_IMAGE);
    process.exit(1);
  }
  
  console.log('📖 Source image:', SOURCE_IMAGE);
  console.log('📁 Output directory:', ANDROID_RES);
  console.log('');
  
  // Generate splash screens for all densities and orientations
  for (const [density, size] of Object.entries(SPLASH_SIZES)) {
    const drawableDir = path.join(ANDROID_RES, `drawable-${density}`);
    const splashPath = path.join(drawableDir, 'splash.png');
    
    await generateSplash(size.width, size.height, splashPath);
  }
  
  // Generate default splash (hdpi portrait)
  const defaultSplashPath = path.join(ANDROID_RES, 'drawable', 'splash.png');
  await generateSplash(480, 800, defaultSplashPath);
  
  console.log('');
  console.log('✨ Splash screen generation complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run: npm run cap:sync');
  console.log('2. Rebuild the app in Android Studio');
  console.log('3. The dark green splash screen will appear!');
}

main().catch(console.error);
