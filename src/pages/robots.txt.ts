import type { APIRoute } from 'astro';
import { indexable } from '../lib/env';
import { url } from '../lib/url';

/* 도메인을 붙이고 SITE_INDEX=1 로 배포하면 색인을 허용한다. 그때도 관리자
   화면은 막는다. 그 전에는 미리보기 주소이므로 전부 막는다. */
export const GET: APIRoute = ({ site }) => {
  const lines = indexable
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin/',
        '',
        `Sitemap: ${new URL(url('/sitemap-index.xml'), site).href}`,
      ]
    : ['User-agent: *', 'Disallow: /'];

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
