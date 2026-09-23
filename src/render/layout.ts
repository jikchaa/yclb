/* 페이지 전체: <head> 안쪽, 머리글, 섹션들, 바닥글, 필요한 스크립트. */

import { esc, lines, linkAttrs, fill } from './text';
import { themeCss, toneFor, toneStyle } from './theme';
import { fontLinks } from './fonts';
import { makeContext, type Ctx, type EventRec } from './context';
import { renderSection } from './sections';

export type RenderOptions = {
  base: string;
  origin: string;
  indexable: boolean;
  images?: Record<string, string>;
};

function headerHtml(ctx: Ctx): string {
  const h = ctx.site.header || {};
  const tone = toneFor(h.background === 'surface' ? 'surface' : h.background === 'band' ? 'band' : 'default', ctx.theme);
  const home = ctx.link('page:home');
  const brand = h.logo
    ? `<img src="${esc(ctx.img(h.logo))}" alt="${esc(ctx.site.settings?.siteName || '')}" style="height:${Number(h.logoHeight) || 22}px"${h.logoInvert ? ' class="invert"' : ''} />`
    : `<span class="brand-text">${lines(h.logoText || ctx.site.settings?.siteName || '')}</span>`;

  const items = (ctx.site.menu || []).filter((m: any) => m.show !== false).map((m: any) => {
    const l = ctx.link(m.href);
    if (!l.href || !String(m.label || '').trim()) return '';
    const current = l.pageId && l.pageId === ctx.pageId ? ' aria-current="page"' : '';
    const cls = m.style === 'button' ? ' class="btn btn-sm"' : '';
    return `<a${cls} ${linkAttrs(l)}${current}>${lines(m.label)}</a>`;
  }).join('');

  const cls = ['site-head', `hl-${h.layout || 'left'}`, `hh-${h.height || 'normal'}`,
    h.sticky !== false ? 'sticky' : '', h.border !== false ? 'bordered' : '',
    `menu-${h.menuStyle || 'caps'}`].filter(Boolean).join(' ');

  return `<header class="${cls}" style="${toneStyle(tone)}"><div class="head-in">` +
    `<a class="brand" ${linkAttrs(home)} aria-label="${esc(ctx.site.settings?.siteName || '')} 홈">${brand}</a>` +
    (items ? `<nav class="menu" aria-label="주요 메뉴">${items}</nav>` : '') +
    `</div></header>`;
}

function footerHtml(ctx: Ctx): string {
  const f = ctx.site.footer || {};
  const bg = f.background || 'surface';
  const tone = toneFor(bg, ctx.theme, f.bgColor);
  const links = (f.links || []).map((x: any) => {
    const l = ctx.link(x.href);
    return l.href && String(x.label || '').trim() ? `<a ${linkAttrs(l)}>${lines(x.label)}</a>` : '';
  }).join('');
  return `<footer class="site-foot" style="${toneStyle(tone)}"><div class="foot-in">` +
    (String(f.title || '').trim() ? `<p class="foot-title">${lines(ctx.t(f.title))}</p>` : '') +
    (String(f.tagline || '').trim() ? `<p class="foot-tag">${lines(ctx.t(f.tagline))}</p>` : '') +
    (links ? `<nav class="foot-links" aria-label="바닥글 메뉴">${links}</nav>` : '') +
    (String(f.copyright || '').trim() ? `<p class="foot-fine">${lines(ctx.t(f.copyright))}</p>` : '') +
    `</div></footer>`;
}

/* 이벤트 필터. 자바스크립트가 없으면 모두 보이고, 있으면 탭이 나타난다. */
const FILTER_JS = `<script>(function(){document.querySelectorAll('.ev-filter').forEach(function(bar){var sec=document.querySelector('[data-sec="'+bar.dataset.for+'"]');if(!sec)return;bar.hidden=false;bar.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var want=b.dataset.f;bar.querySelectorAll('button').forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});sec.querySelectorAll('.card').forEach(function(c){c.hidden=!!want&&c.dataset.program!==want;});sec.querySelectorAll('.year').forEach(function(y){y.hidden=!y.querySelector('.card:not([hidden])');});});});})();</script>`;

export function renderPage(site: any, events: EventRec[], pageId: string, opt: RenderOptions) {
  const ctx = makeContext({ site, events, base: opt.base, origin: opt.origin, pageId, images: opt.images });
  const page = (site.pages || []).find((p: any) => p.id === pageId);
  if (!page) throw new Error(`페이지 없음: ${pageId}`);

  const st = site.settings || {};
  const seo = page.seo || {};
  const pageTitle = ctx.t(seo.title || page.label || '');
  const title = pageId === 'home' || !String(st.titleTemplate || '').includes('{page}')
    ? (pageTitle || st.siteName)
    : fill(st.titleTemplate, { page: pageTitle, site: st.siteName });
  const description = ctx.t(seo.description || st.description || '');
  const noindex = !!seo.noindex || !opt.indexable;
  const path = page.slug && pageId !== 'notfound' ? page.slug + '/' : '';
  const canonical = ctx.abs(path);
  const og = st.ogImage ? ctx.abs(st.ogImage) : '';

  const t = ctx.theme;
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    noindex ? '<meta name="robots" content="noindex, nofollow" />' : '',
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(st.siteName || '')}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    og ? `<meta property="og:image" content="${esc(og)}" />` : '',
    og ? '<meta name="twitter:card" content="summary_large_image" />' : '',
    st.favicon ? `<link rel="icon" href="${esc(ctx.img(st.favicon))}" />` : '',
    st.appleIcon ? `<link rel="apple-touch-icon" href="${esc(ctx.img(st.appleIcon))}" />` : '',
    fontLinks([t.font, t.headingFont === 'same' ? t.font : t.headingFont], ctx.url),
    `<style id="theme-vars">${themeCss(t)}</style>`,
  ].filter(Boolean).join('\n');

  let firstHero = true;
  const sections = (page.sections || []).map((s: any) => {
    const isFirstHero = s.type === 'hero' && firstHero && s.visible !== false;
    if (isFirstHero) firstHero = false;
    return renderSection(ctx, s, isFirstHero);
  }).join('\n');

  const needsFilter = (page.sections || []).some((s: any) => s.type === 'events' && s.showFilter && s.visible !== false);

  const skip = String(st.skipText || '').trim();
  const body = (skip ? `<a class="skip" href="#main">${esc(skip)}</a>\n` : '') + `${headerHtml(ctx)}\n<main id="main">${sections}</main>\n${footerHtml(ctx)}` +
    (needsFilter ? '\n' + FILTER_JS : '');

  return { head, body, title, noindex, ctx };
}
