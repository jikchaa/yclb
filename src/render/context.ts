/* 렌더에 필요한 주변 사정: 주소 붙이기, 링크 풀기, 이미지 경로, 자리표시 값.
   빌드(Node)와 관리자 미리보기(브라우저)가 같은 함수를 쓴다. */

import { fill, type LinkResolver } from './text';
import { normalizeTheme, type Theme } from './theme';

export type EventRec = {
  id: string; title: string; date: string; place?: string;
  program: string; image: string; hidden?: boolean;
};

export type Ctx = {
  site: any;
  theme: Theme;
  events: EventRec[];           // 공개되는 것만, 최근 순
  url: (p: string) => string;
  abs: (p: string) => string;
  link: LinkResolver;
  img: (p: string) => string;
  t: (s: unknown) => string;
  tokens: Record<string, string | number>;
  today: string;
  pageId: string;
};

export function seoulToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return parts; // YYYY-MM-DD
}

export function makeContext(opts: {
  site: any; events: EventRec[]; base: string; origin: string; pageId: string;
  images?: Record<string, string>;     // 관리자에서 아직 올리지 않은 이미지 → dataURL
}): Ctx {
  const { site, base, origin, pageId } = opts;
  const baseSlash = (base || '/').endsWith('/') ? base || '/' : (base || '') + '/';

  const url = (p: string) => {
    if (!p) return baseSlash;
    if (/^(https?:|mailto:|tel:|data:|blob:|#)/i.test(p)) return p;
    return (baseSlash + p.replace(/^\/+/, '')).replace(/\/{2,}/g, '/');
  };
  const abs = (p: string) => (/^https?:/i.test(p) ? p : origin.replace(/\/$/, '') + url(p));

  const pages: any[] = site.pages || [];
  const pageHref = (id: string) => {
    const pg = pages.find((x) => x.id === id);
    if (!pg) return '';
    return url(pg.slug ? pg.slug + '/' : '');
  };

  const link: LinkResolver = (raw) => {
    const target = String(raw || '').trim();
    if (!target) return { href: '', external: false };
    if (target.startsWith('page:')) {
      const id = target.slice(5);
      const href = pageHref(id);
      return href ? { href, external: false, pageId: id } : { href: '', external: false };
    }
    if (target === 'join-form') {
      const u = String(site.settings?.joinFormUrl || '').trim();
      return /^https?:\/\//i.test(u) ? { href: u, external: true } : { href: '', external: false };
    }
    if (/^https?:\/\//i.test(target)) return { href: target, external: true };
    if (/^(mailto:|tel:)/i.test(target)) return { href: target, external: false };
    if (target.startsWith('#')) return { href: target, external: false };
    if (target.startsWith('/')) return { href: url(target), external: false };
    // javascript: 같은 것은 여기서 걸러진다.
    return { href: '', external: false };
  };

  const images = opts.images || {};
  const img = (p: string) => (p ? images[p] || url(p) : '');

  const events = (opts.events || [])
    .filter((e) => !e.hidden && e.date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const first = events[events.length - 1];
  const latest = events[0];
  const tokens: Record<string, string | number> = {
    eventCount: events.length,
    placeCount: new Set(events.map((e) => (e.place || '').trim()).filter(Boolean)).size,
    programCount: (site.programs || []).length,
    since: first ? first.date.slice(0, 4) : '',
    sinceMonth: first ? Number(first.date.slice(5, 7)) : '',
    latestYear: latest ? latest.date.slice(0, 4) : '',
    year: new Date().getFullYear(),
  };

  return {
    site, theme: normalizeTheme(site.theme), events, url, abs, link, img,
    t: (s) => fill(s, tokens), tokens, today: seoulToday(), pageId,
  };
}
