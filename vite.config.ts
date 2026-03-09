import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// Custom plugin to exclude mushaf images from production builds
function excludeMushafImagesPlugin() {
  return {
    name: 'exclude-mushaf-images',
    apply: 'build' as const,
    closeBundle() {
      // Remove mushaf images from dist after build (for production/Android builds)
      const distAssetsPath = path.resolve(__dirname, 'dist/assets');
      const mushafDirs = [
        'mushaf_madinah_images',
        'mushaf_tashel_pages', 
        'mushuf_mwdoa_images'
      ];
      
      // Remove entire mushaf directories
      mushafDirs.forEach(dir => {
        const dirPath = path.join(distAssetsPath, dir);
        if (fs.existsSync(dirPath)) {
          fs.rmSync(dirPath, { recursive: true, force: true });
          console.log(`✓ Excluded ${dir} from build (will be downloaded on-demand)`);
        }
      });
      
      // Remove font directories (fonts are too large ~604 files each)
      const fontDirs = ['fonts'];
      fontDirs.forEach(dir => {
        const dirPath = path.join(distAssetsPath, dir);
        if (fs.existsSync(dirPath)) {
          fs.rmSync(dirPath, { recursive: true, force: true });
          console.log(`✓ Excluded ${dir} from build (fonts will be downloaded on-demand)`);
        }
      });
      
      // Recursively remove all .webp files and _optimized_temp.webp files from dist/assets
      function removeWebpFiles(directory: string) {
        if (!fs.existsSync(directory)) return;
        
        const files = fs.readdirSync(directory);
        files.forEach(file => {
          const filePath = path.join(directory, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            removeWebpFiles(filePath);
          } else if (file.endsWith('.webp') || file.includes('_optimized_temp.webp')) {
            fs.unlinkSync(filePath);
          }
        });
      }
      
      removeWebpFiles(distAssetsPath);
      console.log('✓ Excluded all .webp and _optimized_temp.webp files from build');
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    headers: {
      // Cache static assets for better performance
      'Cache-Control': 'public, max-age=31536000',
    },
  },
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    excludeMushafImagesPlugin()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Cache busting for assets
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
}));
