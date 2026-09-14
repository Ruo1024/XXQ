import { sites } from '@openai/sites-vite-plugin';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').pop() || 'XXQ';
const base = isGitHubPages ? `/${repositoryName}/` : '/';
const socialImageUrl = isGitHubPages
  ? `https://ruo1024.github.io/${repositoryName}/og.png`
  : 'https://flowframe-motion-gallery.decent-bear-2585.chatgpt.site/og.png';

export default defineConfig({
  base,
  plugins: [
    {
      name: 'flowframe-social-metadata',
      transformIndexHtml: {
        order: 'post',
        handler(html) {
          return html.replaceAll(`content="${base}og.png"`, `content="${socialImageUrl}"`);
        },
      },
    },
    sites(),
  ],
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        sakura: resolve(import.meta.dirname, 'sakura.html'),
      },
    },
  },
});
