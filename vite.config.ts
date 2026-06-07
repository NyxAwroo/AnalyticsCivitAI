import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import manifest from './manifest.json';

const extensionManifest = manifest as ManifestV3Export;

export default defineConfig({
  base: './',
  plugins: [react(), crx({ manifest: extensionManifest })],
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    chunkSizeWarningLimit: 650
  }
});
