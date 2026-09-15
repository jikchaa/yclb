import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/* 도메인을 붙이기 전에는 github.io 의 하위 경로로 나간다. DNS 를 옮기고 나면
   배포 워크플로에서 SITE_BASE 를 지우면 그만이다 — 링크는 모두 BASE_URL 을 탄다. */
export default defineConfig({
  site: process.env.SITE_URL || 'https://seoulyouthclub.com',
  base: process.env.SITE_BASE || '/',
  trailingSlash: 'ignore',
  integrations: [sitemap({ filter: (p) => !p.includes('/admin') })],
  build: { format: 'directory' },
});
