import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://models.lmspeed.net',
  output: 'static',
  vite: { build: { assetsInlineLimit: 0 } },
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
