import type { APIRoute } from 'astro';
import { indexable } from '../lib/env';

/* 도메인을 붙이고 SITE_INDEX=1 로 배포하면 색인을 허용한다. 그때도 관리자 화면은
   막는다. 그 전에는 미리보기 주소이므로 전부 막는다. */
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const lines = indexable
    ? ['User-agent: *', 'Allow: /', `Disallow: ${base}admin/`, '',
       `Sitemap: ${new URL(base + 'sitemap-index.xml', site).href}`]
    : ['User-agent: *', 'Disallow: /'];
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
