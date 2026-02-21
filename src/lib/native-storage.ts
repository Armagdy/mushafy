/**
 * Native Storage Service
 * 
 * Provides hybrid storage that automatically selects the best storage mechanism:
 * - Native filesystem on Android/iOS via Capacitor
 * - IndexedDB fallback for web browsers
 * 
 * This eliminates PWA storage quotas (~50MB-1GB) by using native storage
 * which is only limited by device storage capacity.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface StorageItem {
  data: Blob | string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Check if we're running on a native platform (Android/iOS)
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get platform name for logging/debugging
 */
export const getPlatform = (): string => {
  return Capacitor.getPlatform();
};

/**
 * Convert Blob to base64 string for native storage
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/wav;base64,")
      const base64Data = base64.split(',')[1] || base64;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Convert a Blob chunk to base64 string
 */
const blobChunkToBase64 = (blobChunk: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/wav;base64,")
      const base64Data = base64.split(',')[1] || base64;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blobChunk);
  });
};

/**
 * Convert base64 string back to Blob
 */
const base64ToBlob = (base64: string, mimeType: string = 'application/octet-stream'): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * Native Storage API
 * Automatically uses native filesystem on Android/iOS, falls back to IndexedDB on web
 */
export class NativeStorage {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private directory: Directory = Directory.Data;
  
  /**
   * Get the Directory constant (for external use)
   */
  getDirectory(): Directory {
    return this.directory;
  }

  constructor(dbName: string = 'quran-native-storage') {
    this.dbName = dbName;
  }

  /**
   * Initialize storage (opens IndexedDB if on web)
   */
  async init(): Promise<void> {
    if (!isNativePlatform()) {
      await this.openIndexedDB();
    }
  }

  /**
   * Open IndexedDB connection (web fallback)
   */
  private openIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Store data (Blob or string)
   */
  async setItem(key: string, data: Blob | string, metadata?: Record<string, any>): Promise<void> {
    const item: StorageItem = {
      data,
      timestamp: Date.now(),
      metadata
    };

    if (isNativePlatform()) {
      await this.setItemNative(key, item);
    } else {
      await this.setItemIndexedDB(key, item);
    }
  }

  /**
   * Retrieve data
   */
  async getItem(key: string): Promise<StorageItem | null> {
    if (isNativePlatform()) {
      return await this.getItemNative(key);
    } else {
      return await this.getItemIndexedDB(key);
    }
  }

  /**
   * Delete data
   */
  async removeItem(key: string): Promise<void> {
    if (isNativePlatform()) {
      await this.removeItemNative(key);
    } else {
      await this.removeItemIndexedDB(key);
    }
  }

  /**
   * Check if item exists (lightweight - doesn't load data)
   */
  async hasItem(key: string): Promise<boolean> {
    if (isNativePlatform()) {
      try {
        const sanitizedKey = this.sanitizeKey(key);
        const metadataPath = `${sanitizedKey}.meta.json`;
        await Filesystem.readFile({
          path: metadataPath,
          directory: this.directory,
          encoding: Encoding.UTF8
        });
        return true;
      } catch {
        return false;
      }
    } else {
      const item = await this.getItem(key);
      return item !== null;
    }
  }
  
  /**
   * Get native file URI without loading data into memory (native only)
   * Returns null on web or if file doesn't exist
   */
  async getFileUri(key: string): Promise<string | null> {
    if (!isNativePlatform()) return null;
    
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const blobPath = `${sanitizedKey}.blob`;
      
      // Get the file URI using Capacitor's getUri method
      const result = await Filesystem.getUri({
        path: blobPath,
        directory: this.directory
      });
      
      return result.uri;
    } catch (error) {
      console.error('Error getting file URI:', error);
      return null;
    }
  }
  
  /**
   * Get only metadata without loading blob data (native only)
   * Returns null on web or if file doesn't exist
   */
  async getMetadata(key: string): Promise<Record<string, any> | null> {
    if (!isNativePlatform()) return null;
    
    try {
      const sanitizedKey = this.sanitizeKey(key);
      const metadataPath = `${sanitizedKey}.meta.json`;
      
      const metadataFile = await Filesystem.readFile({
        path: metadataPath,
        directory: this.directory,
        encoding: Encoding.UTF8
      });

      const metadata = JSON.parse(metadataFile.data as string);
      return metadata.metadata || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    if (isNativePlatform()) {
      return await this.keysNative();
    } else {
      return await this.keysIndexedDB();
    }
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    if (isNativePlatform()) {
      await this.clearNative();
    } else {
      await this.clearIndexedDB();
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{ used: number; available?: number }> {
    if (isNativePlatform()) {
      // On native, we have virtually unlimited storage
      // This would require native code to get actual device storage
      return { used: 0, available: undefined };
    } else {
      // On web, use Storage API
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          available: estimate.quota || 0
        };
      }
      return { used: 0 };
    }
  }

  // ============================================================================
  // NATIVE STORAGE METHODS (Android/iOS)
  // ============================================================================

  private async setItemNative(key: string, item: StorageItem): Promise<void> {
    const sanitizedKey = this.sanitizeKey(key);
    
    // Store metadata separately as JSON
    const metadataPath = `${sanitizedKey}.meta.json`;
    await Filesystem.writeFile({
      path: metadataPath,
      data: JSON.stringify({
        timestamp: item.timestamp,
        metadata: item.metadata,
        isBlob: item.data instanceof Blob
      }),
      directory: this.directory,
      encoding: Encoding.UTF8
    });

    // Store data
    if (item.data instanceof Blob) {
      const blobPath = `${sanitizedKey}.blob`;
      const blob = item.data;
      
      // For large blobs (>10MB), write in chunks to avoid OOM
      // The issue: converting entire 125MB blob to base64 (~167MB string) causes OOM
      // Solution: Process blob in 5MB chunks, convert each to base64, write immediately
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB blob chunks
      
      if (blob.size > CHUNK_SIZE) {
        const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
        console.log(`💾 Writing large blob in ${totalChunks} chunks (${(blob.size / (1024 * 1024)).toFixed(1)}MB total)`);
        
        // Process first chunk
        let offset = 0;
        const firstChunk = blob.slice(offset, offset + CHUNK_SIZE);
        const firstBase64 = await blobChunkToBase64(firstChunk);
        
        await Filesystem.writeFile({
          path: blobPath,
          data: firstBase64,
          directory: this.directory
        });
        console.log(`💾 Chunk 1/${totalChunks} written`);
        
        offset += CHUNK_SIZE;
        
        // Process remaining chunks
        let chunkNum = 2;
        while (offset < blob.size) {
          const chunk = blob.slice(offset, Math.min(offset + CHUNK_SIZE, blob.size));
          const chunkBase64 = await blobChunkToBase64(chunk);
          
          await Filesystem.appendFile({
            path: blobPath,
            data: chunkBase64,
            directory: this.directory
          });
          
          console.log(`💾 Chunk ${chunkNum}/${totalChunks} written`);
          offset += CHUNK_SIZE;
          chunkNum++;
        }
        
        console.log(`✅ Large file written successfully in ${totalChunks} chunks`);
      } else {
        // Small blob, write directly
        const base64Data = await blobToBase64(blob);
        await Filesystem.writeFile({
          path: blobPath,
          data: base64Data,
          directory: this.directory
        });
      }
      
      // Verify the file was written successfully
      try {
        const stat = await Filesystem.stat({
          path: blobPath,
          directory: this.directory
        });
        const fileSizeMB = (stat.size / (1024 * 1024)).toFixed(1);
        console.log(`✅ File verified on disk: ${fileSizeMB}MB`);
      } catch (verifyError) {
        console.error('⚠️ File write verification failed:', verifyError);
        throw new Error('Failed to verify file was written');
      }
    } else {
      await Filesystem.writeFile({
        path: `${sanitizedKey}.txt`,
        data: item.data,
        directory: this.directory,
        encoding: Encoding.UTF8
      });
    }
  }

  private async getItemNative(key: string): Promise<StorageItem | null> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      
      // Read metadata
      const metadataPath = `${sanitizedKey}.meta.json`;
      const metadataFile = await Filesystem.readFile({
        path: metadataPath,
        directory: this.directory,
        encoding: Encoding.UTF8
      });

      const metadata = JSON.parse(metadataFile.data as string);

      // Read data
      let data: Blob | string;
      if (metadata.isBlob) {
        const blobFile = await Filesystem.readFile({
          path: `${sanitizedKey}.blob`,
          directory: this.directory
        });
        const base64Data = blobFile.data as string;
        data = base64ToBlob(base64Data, metadata.metadata?.mimeType || 'application/octet-stream');
      } else {
        const txtFile = await Filesystem.readFile({
          path: `${sanitizedKey}.txt`,
          directory: this.directory,
          encoding: Encoding.UTF8
        });
        data = txtFile.data as string;
      }

      return {
        data,
        timestamp: metadata.timestamp,
        metadata: metadata.metadata
      };
    } catch (error) {
      // File not found
      return null;
    }
  }

  private async removeItemNative(key: string): Promise<void> {
    try {
      const sanitizedKey = this.sanitizeKey(key);
      
      // Try to delete both metadata and data files
      const filesToDelete = [
        `${sanitizedKey}.meta.json`,
        `${sanitizedKey}.blob`,
        `${sanitizedKey}.txt`
      ];

      for (const file of filesToDelete) {
        try {
          await Filesystem.deleteFile({
            path: file,
            directory: this.directory
          });
        } catch {
          // Ignore errors if file doesn't exist
        }
      }
    } catch (error) {
      console.error('Error removing native storage item:', error);
    }
  }

  private async keysNative(): Promise<string[]> {
    try {
      const result = await Filesystem.readdir({
        path: '',
        directory: this.directory
      });

      // Extract unique keys from .meta.json files
      const keys = result.files
        .filter(file => file.name.endsWith('.meta.json'))
        .map(file => this.desanitizeKey(file.name.replace('.meta.json', '')));

      return keys;
    } catch (error) {
      return [];
    }
  }

  private async clearNative(): Promise<void> {
    const keys = await this.keysNative();
    for (const key of keys) {
      await this.removeItemNative(key);
    }
  }

  // ============================================================================
  // INDEXEDDB METHODS (Web fallback)
  // ============================================================================

  private async setItemIndexedDB(key: string, item: StorageItem): Promise<void> {
    if (!this.db) await this.openIndexedDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['storage'], 'readwrite');
      const store = transaction.objectStore('storage');
      const request = store.put({ key, ...item });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getItemIndexedDB(key: string): Promise<StorageItem | null> {
    if (!this.db) await this.openIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['storage'], 'readonly');
      const store = transaction.objectStore('storage');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            data: result.data,
            timestamp: result.timestamp,
            metadata: result.metadata
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async removeItemIndexedDB(key: string): Promise<void> {
    if (!this.db) await this.openIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['storage'], 'readwrite');
      const store = transaction.objectStore('storage');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async keysIndexedDB(): Promise<string[]> {
    if (!this.db) await this.openIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['storage'], 'readonly');
      const store = transaction.objectStore('storage');
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async clearIndexedDB(): Promise<void> {
    if (!this.db) await this.openIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['storage'], 'readwrite');
      const store = transaction.objectStore('storage');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Sanitize key for filesystem usage (replace special characters)
   */
  private sanitizeKey(key: string): string {
    return key
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '_');
  }

  /**
   * Reverse sanitization (for display purposes)
   */
  private desanitizeKey(sanitized: string): string {
    return sanitized; // Could implement reverse mapping if needed
  }
}

/**
 * Singleton instance for global usage
 */
export const nativeStorage = new NativeStorage('quran-native-storage');
