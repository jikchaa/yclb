import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

/* 도메인을 붙이기 전에는 github.io 의 하위 경로로 나간다. DNS 를 옮기고 나면
   배포 워크플로에서 SITE_BASE 를 지우면 그만이다 — 링크는 모두 BASE_URL 을 탄다. */

/* 검색에서 빼기로 한 페이지는 사이트맵에도 넣지 않는다. */
const dataDir = path.resolve(process.env.SITE_DATA_DIR || 'src/data');
const site = JSON.parse(fs.readFileSync(path.join(dataDir, 'site.json'), 'utf8'));
const hidden = site.pages.filter((p) => p.seo?.noindex).map((p) => `/${p.slug}/`);

export default defineConfig({
  site: process.env.SITE_URL || 'https://seoulyouthclub.com',
  base: process.env.SITE_BASE || '/',
  trailingSlash: 'ignore',
  integrations: [sitemap({
    filter: (u) => !u.includes('/admin') && !hidden.some((h) => u.endsWith(h)),
  })],
  build: { format: 'directory' },
});
