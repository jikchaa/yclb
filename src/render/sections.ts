/* 섹션 종류별 HTML. 입력은 섹션 데이터와 Ctx, 출력은 문자열. 부작용 없음.
   이 파일이 사이트의 모든 구역을 그린다 — 관리자 미리보기도 이 파일을 쓴다. */

import { esc, lines, rich, linkAttrs } from './text';
import { toneFor, toneStyle } from './theme';
import { withDefaults } from './schema';
import type { Ctx, EventRec } from './context';

type Sec = Record<string, any>;

const RATIO: Record<string, string> = {
  '16:9': '16 / 9', '4:3': '4 / 3', '1:1': '1 / 1', '4:5': '4 / 5', '3:4': '3 / 4', '21:9': '21 / 9',
};
const DIMS: Record<string, [number, number]> = {
  '16:9': [1600, 900], '4:3': [1600, 1200], '1:1': [1200, 1200], '4:5': [1200, 1500],
  '3:4': [1200, 1600], '21:9': [2100, 900],
};

/* ---------- 조각 ---------- */

const r = (ctx: Ctx, s: unknown) => rich(ctx.t(s), ctx.link);
const ln = (ctx: Ctx, s: unknown) => lines(ctx.t(s));
const has = (s: unknown) => String(s ?? '').trim().length > 0;

function head(ctx: Ctx, s: Sec, level: 'h1' | 'h2' = 'h2'): string {
  const out: string[] = [];
  if (has(s.kicker)) out.push(`<p class="kicker">${ln(ctx, s.kicker)}</p>`);
  if (has(s.title)) out.push(`<${level} class="title">${ln(ctx, s.title)}</${level}>`);
  if (has(s.subtitle)) out.push(`<p class="subtitle">${ln(ctx, s.subtitle)}</p>`);
  if (has(s.text)) out.push(`<div class="lede">${r(ctx, s.text)}</div>`);
  return out.length ? `<header class="sec-head">${out.join('')}</header>` : '';
}

export function buttons(ctx: Ctx, list: any[] | undefined): string {
  const items = (list || []).map((b) => {
    const l = ctx.link(b.href);
    if (!has(b.label) || !l.href) return '';
    const cls = b.style === 'primary' ? 'btn' : b.style === 'secondary' ? 'btn btn-line' : 'btn-text';
    return `<a class="${cls}" ${linkAttrs(l)}>${ln(ctx, b.label)}</a>`;
  }).filter(Boolean);
  return items.length ? `<div class="actions">${items.join('')}</div>` : '';
}

function image(ctx: Ctx, path: string, alt: string, ratio: string, eager = false): string {
  if (!path) return '';
  const [w, h] = DIMS[ratio] || [1600, 900];
  const style = RATIO[ratio] ? ` style="aspect-ratio:${RATIO[ratio]}"` : '';
  return `<img src="${esc(ctx.img(path))}" alt="${esc(alt)}"${RATIO[ratio] ? ` width="${w}" height="${h}"` : ''}` +
    `${style} loading="${eager ? 'eager' : 'lazy'}" decoding="async" />`;
}

function fmtMonth(date: string): string {
  return date ? `${date.slice(0, 4)}. ${date.slice(5, 7)}` : '';
}

/* ---------- 감싸기 ---------- */

function wrap(ctx: Ctx, s: Sec, inner: string): string {
  const st = s.style;
  const hasImg = has(st.bgImage);
  const tone = toneFor(st.background, ctx.theme, st.bgColor, hasImg);
  const cls = ['sec', `sec-${s.type}`, `pt-${st.paddingTop}`, `pb-${st.paddingBottom}`,
    `al-${st.align}`, `w-${st.width}`, hasImg ? 'has-bgimg' : ''].filter(Boolean).join(' ');
  const anchor = /^[a-z0-9-]+$/i.test(st.anchor || '') ? ` id="${st.anchor}"` : ` id="${esc(s.id)}"`;
  const bg = hasImg
    ? `<div class="sec-bg" aria-hidden="true"><img src="${esc(ctx.img(st.bgImage))}" alt="" loading="lazy" decoding="async" />` +
      `<span style="opacity:${Math.min(90, Math.max(0, Number(st.overlay) || 0)) / 100}"></span></div>`
    : '';
  return `<section class="${cls}"${anchor} data-sec="${esc(s.id)}" style="${toneStyle(tone)}">${bg}` +
    `<div class="sec-in">${inner}</div></section>`;
}

/* ---------- 종류별 ---------- */

function hero(ctx: Ctx, s: Sec, first: boolean): string {
  const h = ctx.site.header || {};
  const logo = s.showLogo && h.logo
    ? `<img class="hero-logo${h.logoInvert ? ' invert' : ''}" src="${esc(ctx.img(h.logo))}" alt="${esc(ctx.site.settings?.siteName || '')}" style="height:${Number(s.logoHeight) || 64}px" />`
    : '';
  return `<div class="hero hero-${esc(s.size)}">${logo}${head(ctx, s, first ? 'h1' : 'h2')}${buttons(ctx, s.buttons)}</div>`;
}

function text(ctx: Ctx, s: Sec): string {
  const body = (s.blocks || []).map((b: any) => {
    if (!has(b.text)) return '';
    switch (b.type) {
      case 'h': return `<h3>${ln(ctx, b.text)}</h3>`;
      case 'quote': return `<blockquote>${r(ctx, b.text)}</blockquote>`;
      case 'list': return `<ul>${String(ctx.t(b.text)).split(/\r?\n/).filter(has)
        .map((li) => `<li>${rich(li, ctx.link)}</li>`).join('')}</ul>`;
      case 'lead': return `<p class="lead">${r(ctx, b.text)}</p>`;
      case 'note': return `<div class="note">${r(ctx, b.text)}</div>`;
      default: return `<p>${r(ctx, b.text)}</p>`;
    }
  }).join('');
  return `${head(ctx, s)}<div class="prose">${body}</div>${buttons(ctx, s.buttons)}`;
}

function features(ctx: Ctx, s: Sec): string {
  const items = (s.items || []).map((it: any) => `<li>` +
    (it.image ? `<div class="fig">${image(ctx, it.image, it.title || '', '16:9')}</div>` : '') +
    (has(it.title) ? `<h3>${ln(ctx, it.title)}</h3>` : '') +
    (has(it.text) ? `<p>${r(ctx, it.text)}</p>` : '') + `</li>`).join('');
  return `${head(ctx, s)}<ul class="features cols-${esc(s.columns)} card-${esc(s.cardStyle)}">${items}</ul>${buttons(ctx, s.buttons)}`;
}

function stats(ctx: Ctx, s: Sec): string {
  const items = (s.items || []).map((it: any) =>
    `<div><dt>${ln(ctx, it.label)}</dt><dd>${esc(ctx.t(it.value))}${has(it.unit) ? `<span>${ln(ctx, it.unit)}</span>` : ''}</dd></div>`).join('');
  const tags = (s.tags || []).filter(has).map((t: string) => `<li>${ln(ctx, t)}</li>`).join('');
  return head(ctx, s) + (items ? `<dl class="stats">${items}</dl>` : '') +
    (tags ? `<ul class="chips">${tags}</ul>` : '') + buttons(ctx, s.buttons);
}

function pickEvents(ctx: Ctx, s: Sec): EventRec[] {
  let list = ctx.events.slice();
  if (s.program) list = list.filter((e) => e.program === s.program);
  if (s.mode === 'upcoming') list = list.filter((e) => e.date >= ctx.today).reverse();
  if (s.mode === 'past') list = list.filter((e) => e.date < ctx.today);
  const n = Number(s.limit) || 0;
  return n > 0 ? list.slice(0, n) : list;
}

function eventCard(ctx: Ctx, s: Sec, e: EventRec, eager: boolean): string {
  return `<article class="card" data-program="${esc(e.program)}">` +
    `<div class="fig">${image(ctx, e.image, e.title, s.ratio, eager)}</div>` +
    `<div class="card-meta">` +
    (s.showDate && e.date ? `<p class="when"><time datetime="${esc(e.date)}">${fmtMonth(e.date)}</time></p>` : '') +
    `<h3>${ln(ctx, e.title)}</h3>` +
    (s.showPlace && has(e.place) ? `<p class="where">${ln(ctx, e.place)}</p>` : '') +
    `</div></article>`;
}

function events(ctx: Ctx, s: Sec): string {
  const list = pickEvents(ctx, s);
  if (!list.length) return head(ctx, s) + `<p class="empty">${r(ctx, s.emptyText)}</p>` + buttons(ctx, s.buttons);

  const programs: any[] = ctx.site.programs || [];
  let filter = '';
  if (s.showFilter) {
    const present = new Set(list.map((e) => e.program));
    const tabs = programs.filter((p) => present.has(p.id))
      .map((p) => `<button type="button" data-f="${esc(p.id)}" aria-pressed="false">${ln(ctx, p.label)}</button>`).join('');
    filter = `<div class="ev-filter" data-for="${esc(s.id)}" hidden>` +
      `<button type="button" class="on" data-f="" aria-pressed="true">${ln(ctx, s.filterAllLabel)}</button>${tabs}</div>`;
  }

  const grid = (items: EventRec[], eagerN: number) =>
    `<div class="grid cols-${esc(s.columns)}">${items.map((e, i) => eventCard(ctx, s, e, i < eagerN)).join('')}</div>`;

  let body: string;
  if (s.groupByYear) {
    const years = [...new Set(list.map((e) => e.date.slice(0, 4)))];
    body = years.map((y, yi) => `<div class="year" data-year="${y}"><h3 class="year-h">${y}</h3>` +
      grid(list.filter((e) => e.date.startsWith(y)), yi === 0 ? 3 : 0) + `</div>`).join('');
  } else {
    body = grid(list, 3);
  }
  return head(ctx, s) + filter + `<div class="ev-list">${body}</div>` + buttons(ctx, s.buttons);
}

function programs(ctx: Ctx, s: Sec): string {
  const progs: any[] = ctx.site.programs || [];
  const count = (id: string) => ctx.events.filter((e) => e.program === id).length;
  const countLine = (p: any) => s.showCount
    ? `<p class="count">${rich(String(ctx.t(s.countText)).replace(/\{count\}/g, String(count(p.id))), ctx.link)}</p>` : '';

  let body = '';
  if (s.layout === 'detailed') {
    body = progs.map((p, i) => {
      const recent = s.showRecent
        ? ctx.events.filter((e) => e.program === p.id).slice(0, Number(s.recentLimit) || 4)
          .map((e) => `<li><span class="d">${fmtMonth(e.date)}</span>${ln(ctx, e.title)}</li>`).join('')
        : '';
      return `<article class="prog-d${i % 2 ? ' flip' : ''}">` +
        `<div class="fig">${image(ctx, p.image, p.label, '16:9', i < 2)}</div>` +
        `<div class="txt">${has(p.kicker) ? `<p class="kicker">${ln(ctx, p.kicker)}</p>` : ''}` +
        `<h3>${ln(ctx, p.label)}</h3>${has(p.blurb) ? `<p class="blurb">${r(ctx, p.blurb)}</p>` : ''}` +
        countLine(p) + (recent ? `<ul class="recent">${recent}</ul>` : '') + `</div></article>`;
    }).join('');
    body = `<div class="progs-d">${body}</div>`;
  } else if (s.layout === 'cards') {
    body = `<ul class="progs-c">${progs.map((p) => `<li>` +
      `<div class="fig">${image(ctx, p.image, p.label, '16:9')}</div>` +
      `<div class="txt">${has(p.kicker) ? `<p class="kicker">${ln(ctx, p.kicker)}</p>` : ''}` +
      `<h3>${ln(ctx, p.label)}</h3>${has(p.blurb) ? `<p>${r(ctx, p.blurb)}</p>` : ''}${countLine(p)}</div></li>`).join('')}</ul>`;
  } else {
    body = `<ul class="progs-l">${progs.map((p) => `<li><div class="ph"><h3>${ln(ctx, p.label)}</h3>` +
      (has(p.kicker) ? `<p class="kicker">${ln(ctx, p.kicker)}</p>` : '') + `</div>` +
      `<div class="pb">${has(p.blurb) ? `<p>${r(ctx, p.blurb)}</p>` : ''}${countLine(p)}</div></li>`).join('')}</ul>`;
  }
  return head(ctx, s) + body + buttons(ctx, s.buttons);
}

function names(ctx: Ctx, s: Sec): string {
  const items = (s.items || []).filter((x: any) => has(x.name))
    .map((x: any) => `<li><b>${ln(ctx, x.name)}</b>${has(x.sub) ? `<span>${ln(ctx, x.sub)}</span>` : ''}</li>`).join('');
  return head(ctx, s) + (items ? `<ul class="names">${items}</ul>` : '') + buttons(ctx, s.buttons);
}

function stepsList(ctx: Ctx, items: any[], numbered: boolean): string {
  return `<ol class="steps${numbered ? '' : ' plain'}">${(items || []).map((x, i) =>
    `<li>${numbered ? `<span class="n">${String(i + 1).padStart(2, '0')}</span>` : ''}` +
    `<b>${ln(ctx, x.title)}</b>${has(x.text) ? `<span class="t">${r(ctx, x.text)}</span>` : ''}</li>`).join('')}</ol>`;
}

function steps(ctx: Ctx, s: Sec): string {
  return head(ctx, s) + stepsList(ctx, s.items, s.numbered) + buttons(ctx, s.buttons);
}

function apply(ctx: Ctx, s: Sec): string {
  const l = ctx.link(s.buttonHref);
  const box = l.href
    ? (has(s.boxTitle) ? `<p class="box-t">${ln(ctx, s.boxTitle)}</p>` : '') +
      `<a class="btn" ${linkAttrs(l)}>${ln(ctx, s.buttonLabel)}</a>`
    : `<div class="box-empty">${r(ctx, s.emptyText)}</div>`;
  return head(ctx, s) + `<div class="apply">` +
    `<div class="apply-how">${has(s.stepsTitle) ? `<p class="kicker">${ln(ctx, s.stepsTitle)}</p>` : ''}` +
    stepsList(ctx, s.steps, false) +
    (has(s.note) ? `<p class="fine">${r(ctx, s.note)}</p>` : '') + `</div>` +
    `<div class="apply-box">${box}</div></div>`;
}

function cta(ctx: Ctx, s: Sec): string {
  return `<div class="cta">${head(ctx, s)}${buttons(ctx, s.buttons)}</div>`;
}

function imageSec(ctx: Ctx, s: Sec): string {
  if (!s.image) return '';
  const pic = image(ctx, s.image, String(ctx.t(s.caption)).replace(/\*\*|\[|\]\([^)]*\)/g, ''), s.ratio);
  const l = ctx.link(s.link);
  const inner = l.href ? `<a ${linkAttrs(l)}>${pic}</a>` : pic;
  return `<figure class="figure">${inner}${has(s.caption) ? `<figcaption>${r(ctx, s.caption)}</figcaption>` : ''}</figure>`;
}

function gallery(ctx: Ctx, s: Sec): string {
  const items = (s.items || []).filter((x: any) => x.image).map((x: any) =>
    `<figure>${image(ctx, x.image, x.caption || '', s.ratio)}${has(x.caption) ? `<figcaption>${ln(ctx, x.caption)}</figcaption>` : ''}</figure>`).join('');
  return head(ctx, s) + `<div class="gallery cols-${esc(s.columns)}">${items}</div>`;
}

function chips(ctx: Ctx, s: Sec): string {
  const items = (s.items || []).filter(has).map((t: string) => `<li>${ln(ctx, t)}</li>`).join('');
  return head(ctx, s) + (items ? `<ul class="chips">${items}</ul>` : '');
}

function divider(_ctx: Ctx, s: Sec): string {
  return s.line ? '<hr class="rule" />' : '';
}

const RENDER: Record<string, (ctx: Ctx, s: Sec, first: boolean) => string> = {
  hero, text, features, stats, events, programs, names, steps, apply, cta,
  image: imageSec, gallery, chips, divider,
};

export function renderSection(ctx: Ctx, raw: Sec, first = false): string {
  const s = withDefaults(raw);
  if (s.visible === false) return '';
  const fn = RENDER[s.type];
  if (!fn) return '';
  return wrap(ctx, s, fn(ctx, s, first));
}
