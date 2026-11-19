#!/usr/bin/env node
/**
 * Robustly cleans the dist/ folder before a build.
 *
 * Why: on Windows, `vite build` empties dist/ with a single rmSync call that
 * dies with EPERM ("Permission denied") when ANYTHING holds the folder open —
 * a terminal or Explorer window cd'd into dist, a running `vite preview` /
 * dev server, antivirus/OneDrive scanning it, or two builds racing each
 * other. This script makes cleanup resilient instead:
 *
 *   1. fs.rmSync with built-in retries (handles transient AV/indexer locks)
 *   2. A few extra attempts with backoff for everything else
 *   3. If the folder still can't be removed, print guidance and EXIT 0 —
 *      vite is configured with emptyOutDir:false, so the build continues
 *      into the existing dist instead of crashing.
 */
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanDist() {
  if (!fs.existsSync(distDir)) return;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // maxRetries/retryDelay make fs.rmSync itself retry on the classic
      // Windows lock errors (EPERM, EBUSY, ENOTEMPTY) while deleting
      fs.rmSync(distDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      return;
    } catch (err) {
      if (attempt === 3) {
        // Not fatal: the build proceeds into the existing dist
        // (vite.config has emptyOutDir:false for exactly this case)
        console.warn(`\u26A0 Could not clean dist/ (${err.code || err.message}).`);
        console.warn('  The build will continue with the existing dist folder.');
        console.warn('  To reclaim stale files later: close any terminals / Explorer windows');
        console.warn('  opened inside dist, stop any vite preview or dev server, then rebuild.\n');
        return;
      }
      await delay(500 * attempt);
    }
  }
}

await cleanDist();
