/* YCLB 사이트 관리.
   공개 사이트의 모든 것 — 페이지, 섹션, 메뉴, 디자인, 프로그램, 이벤트, 이미지 — 를
   site.json · events.json · public/ 이미지로 고치고, [게시] 한 번에 한 커밋으로 올린다. */

import './admin.css';
import {
  SECTION_TYPES, TYPE_BY_ID, STYLE_FIELDS, newSection, withDefaults, TOKENS,
  PRESETS, FONTS, contrast,
} from '../render';
import * as gh from './gh';
import { h, modal, ask, toast, clone } from './ui';
import { fieldEl, listEditor, textInput, textArea, selectEl, toggleEl, colorEl, linkPicker, imageField, type App } from './form';
import { cropDialog, pickFile, fileToDataUrl, type Staged } from './images';
import { Preview } from './preview';

const BASE = import.meta.env.BASE_URL;
const DRAFT_KEY = 'yclb.draft.v2';
const RESERVED = ['admin', 'posters', 'uploads', 'fonts', '_astro', '404', 'sitemap-index.xml', 'robots.txt'];

type Tab = 'pages' | 'menu' | 'design' | 'programs' | 'events' | 'images' | 'settings';

const state = {
  site: null as any,
  events: [] as any[],
  baseSite: '', baseEvents: '', baseCommit: '',
  images: [] as string[],
  staged: {} as Record<string, Staged>,
  deletes: new Set<string>(),
  tab: 'pages' as Tab,
  pageId: 'home',
  openSection: null as string | null,
  openEvent: null as string | null,
  eventQuery: '',
  device: 'desktop' as 'desktop' | 'mobile',
  deploy: null as null | { sha: string; text: string; kind: 'wait' | 'ok' | 'bad'; url?: string },
};

const $ = (id: string) => document.getElementById(id)!;
const editor = () => $('editor');
const preview = new Preview($('frame') as HTMLIFrameElement);

/* ---------------- 상태 계산 ---------------- */

const siteText = () => JSON.stringify(state.site, null, 2) + '\n';
const eventsText = () => JSON.stringify({ events: state.events }, null, 2) + '\n';
const isDirty = () => !!state.site && (siteText() !== state.baseSite || eventsText() !== state.baseEvents
  || Object.keys(state.staged).length > 0 || state.deletes.size > 0);

function imgUrl(p: string): string {
  if (!p) return '';
  if (state.staged[p]) return state.staged[p].dataUrl;
  if (/^(https?:|data:)/.test(p)) return p;
  return (BASE + p.replace(/^\/+/, '')).replace(/\/{2,}/g, '/');
}

function usage(path: string): number {
  const hay = siteText() + eventsText();
  return hay.split(JSON.stringify(path).slice(1, -1)).length - 1;
}

/* ---------------- 앱 서비스 (입력칸들이 부르는 것) ---------------- */

let previewTimer = 0, draftTimer = 0;
const app: App = {
  changed(structural = false) {
    if (structural) renderEditor();
    renderBar();
    clearTimeout(previewTimer);
    previewTimer = window.setTimeout(renderPreview, 160);
    clearTimeout(draftTimer);
    draftTimer = window.setTimeout(saveDraft, 700);
  },
  pages: () => (state.site?.pages || []).filter((p: any) => p.id !== 'notfound').map((p: any) => ({ id: p.id, label: p.label || p.id })),
  programs: () => (state.site?.programs || []).map((p: any) => ({ id: p.id, label: p.label || p.id })),
  imgUrl,
  chooseImage: (o) => chooseImage(o),
  uploadImage: async (o) => {
    const f = await pickFile();
    if (!f) return null;
    return stageFromSrc(await fileToDataUrl(f), f.name, o);
  },
  recropImage: async (path, o) => stageFromSrc(imgUrl(path), path.split('/').pop() || 'image', o),
};

async function stageFromSrc(src: string, name: string, o: { ratio?: string; purpose?: any }) {
  const res = await cropDialog(src, { name, ratio: o.ratio, purpose: o.purpose });
  if (!res) return null;
  state.staged[res.path] = res.file;
  if (!state.images.includes(res.path)) state.images.push(res.path);
  toast(`이미지를 준비했습니다 (${Math.round(res.file.bytes / 1024)}KB). 게시하면 올라갑니다.`, 'ok');
  return res.path;
}

/* ---------------- 이미지 고르기 창 ---------------- */

function chooseImage(o: { ratio?: string; purpose?: any; current?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    let q = '';
    const grid = h('div', { class: 'lib' });
    const draw = () => {
      grid.innerHTML = '';
      libraryList().filter((p) => p.toLowerCase().includes(q)).forEach((p) => {
        grid.appendChild(h('button', {
          type: 'button', class: 'lib-item' + (p === o.current ? ' on' : ''),
          onclick: () => { m.close(); resolve(p); },
        }, h('img', { src: imgUrl(p), alt: '', loading: 'lazy' }), h('span', {}, p.split('/').pop()!),
          state.staged[p] ? h('em', {}, '대기') : null));
      });
    };
    const search = textInput('', (v) => { q = v.toLowerCase(); draw(); }, { placeholder: '파일 이름으로 찾기' });
    const m = modal({
      title: '이미지 고르기', wide: true,
      body: [h('div', { class: 'lib-bar' }, search,
        h('button', { type: 'button', class: 'btn', onclick: async () => {
          const p = await app.uploadImage(o);
          if (p) { m.close(); resolve(p); }
        } }, '+ 새로 올리기')), grid],
      onClose: () => resolve(null),
    });
    draw();
  });
}

const libraryList = () => [...new Set([...state.images])].filter((p) => !state.deletes.has(p))
  .sort((a, b) => (state.staged[b] ? 1 : 0) - (state.staged[a] ? 1 : 0) || a.localeCompare(b));

/* ---------------- 탭: 페이지 ---------------- */

const currentPage = () => state.site.pages.find((p: any) => p.id === state.pageId) || state.site.pages[0];

function sectionSummary(s: any): string {
  const pick = s.title || s.kicker || s.subtitle || s.text || s.caption
    || (s.blocks && s.blocks[0]?.text) || (s.items && (s.items[0]?.title || s.items[0]?.name)) || '';
  return String(pick).replace(/\s+/g, ' ').replace(/\*\*/g, '').slice(0, 48);
}

function renderPages() {
  const ed = editor();
  const page = currentPage();
  state.pageId = page.id;

  const pageOpts = state.site.pages.map((p: any) => ({ value: p.id, label: `${p.label || p.id}  —  /${p.slug}` }));
  ed.appendChild(h('div', { class: 'toolbar' },
    selectEl(page.id, pageOpts, (v) => { state.pageId = v; state.openSection = null; renderEditor(); renderPreview(); }),
    h('button', { type: 'button', class: 'btn', onclick: addPage }, '+ 페이지')));

  /* 페이지 설정 */
  const seo = (page.seo ||= { title: '', description: '', noindex: false });
  const fixed = page.id === 'home' || page.id === 'notfound';
  ed.appendChild(h('details', { class: 'card' },
    h('summary', {}, '페이지 설정', h('span', { class: 'sub' }, ` 주소 /${page.slug}  ·  ${seo.noindex ? '검색 제외' : '검색 노출'}`)),
    h('div', { class: 'card-body' },
      h('div', { class: 'f' }, h('label', {}, '이름 (관리용·메뉴 선택지에 표시)'), textInput(page.label, (v) => { page.label = v; app.changed(); })),
      h('div', { class: 'f' }, h('label', {}, '주소'),
        fixed ? h('p', { class: 'help' }, page.id === 'home' ? '홈은 항상 / 입니다.' : '404 페이지 주소는 고정입니다.')
          : textInput(page.slug, (v) => { page.slug = v.trim().toLowerCase(); app.changed(); }, { placeholder: '영문 소문자·숫자·- 만' }),
        h('p', { class: 'help' }, '예: about → 사이트주소/about/')),
      h('div', { class: 'f' }, h('label', {}, '검색·공유 제목'), textInput(seo.title, (v) => { seo.title = v; app.changed(); })),
      h('div', { class: 'f' }, h('label', {}, '검색·공유 설명'), textArea(seo.description, (v) => { seo.description = v; app.changed(); }, 2),
        h('p', { class: 'help' }, '비우면 [기본 설정]의 사이트 설명을 씁니다.')),
      h('div', { class: 'f' }, toggleEl('검색 결과에서 빼기 (noindex)', seo.noindex, (v) => { seo.noindex = v; app.changed(true); })),
      fixed ? null : h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => duplicatePage(page) }, '페이지 복제'),
        h('button', { type: 'button', class: 'btn danger', onclick: () => deletePage(page) }, '페이지 삭제')))));

  /* 섹션들 */
  ed.appendChild(h('h3', { class: 'group' }, `섹션 ${page.sections.length}개`,
    h('span', { class: 'sub' }, ' — 미리보기에서 구역을 눌러도 여기가 열립니다')));
  page.sections.forEach((raw: any, i: number) => {
    const s = raw;
    const type = TYPE_BY_ID[s.type];
    const open = state.openSection === s.id;
    const tools = h('span', { class: 'row-tools' },
      h('button', { type: 'button', class: 'icon' + (s.visible === false ? ' off' : ''), title: s.visible === false ? '보이기' : '숨기기',
        onclick: (e: Event) => { e.stopPropagation(); s.visible = s.visible === false; app.changed(true); } }, s.visible === false ? '◌' : '●'),
      h('button', { type: 'button', class: 'icon', title: '위로', onclick: (e: Event) => { e.stopPropagation(); moveSec(i, -1); } }, '↑'),
      h('button', { type: 'button', class: 'icon', title: '아래로', onclick: (e: Event) => { e.stopPropagation(); moveSec(i, 1); } }, '↓'),
      h('button', { type: 'button', class: 'icon', title: '복제', onclick: (e: Event) => {
        e.stopPropagation(); const c = clone(s); c.id = s.type + '-' + Math.random().toString(36).slice(2, 8);
        page.sections.splice(i + 1, 0, c); state.openSection = c.id; app.changed(true); } }, '⧉'),
      h('button', { type: 'button', class: 'icon danger', title: '삭제', onclick: async (e: Event) => {
        e.stopPropagation();
        if (await ask(`'${type?.label || s.type}' 섹션을 지울까요?`, '지우기', true)) { page.sections.splice(i, 1); app.changed(true); }
      } }, '×'));

    const card = h('div', { class: 'sec-card' + (open ? ' open' : '') + (s.visible === false ? ' hidden-sec' : ''), 'data-id': s.id });
    const head = h('div', { class: 'sec-head', onclick: () => {
      state.openSection = open ? null : s.id; renderEditor();
      if (!open) { preview.mark(s.id); preview.scrollTo(s.id); }
    } },
      h('span', { class: 'sec-type' }, type?.label || s.type),
      h('span', { class: 'sec-sum' }, sectionSummary(s) || '(내용 없음)'), tools);
    card.appendChild(head);

    if (open && type) {
      const full = withDefaults(s);
      Object.assign(s, { ...full, ...s, style: full.style }); // 빠진 칸을 채워 둔다
      const body = h('div', { class: 'sec-body' });
      type.fields.forEach((f) => { const el = fieldEl(f, s, app); if (el) body.appendChild(el); });
      const style = h('details', { class: 'style' }, h('summary', {}, '모양 — 배경·여백·정렬·폭'));
      STYLE_FIELDS.forEach((f) => { const el = fieldEl(f, s.style, app); if (el) style.appendChild(el); });
      body.appendChild(style);
      card.appendChild(body);
    }
    ed.appendChild(card);
  });

  ed.appendChild(h('button', { type: 'button', class: 'btn add-sec', onclick: () => addSection(page) }, '+ 섹션 추가'));
}

function moveSec(i: number, d: number) {
  const secs = currentPage().sections;
  const j = i + d;
  if (j < 0 || j >= secs.length) return;
  [secs[i], secs[j]] = [secs[j], secs[i]];
  app.changed(true);
}

function addSection(page: any) {
  const m = modal({
    title: '섹션 추가', wide: true,
    body: h('div', { class: 'types' }, SECTION_TYPES.map((t) => h('button', {
      type: 'button', class: 'type', onclick: () => {
        const s = newSection(t.type);
        const at = state.openSection ? page.sections.findIndex((x: any) => x.id === state.openSection) + 1 : page.sections.length;
        page.sections.splice(at > 0 ? at : page.sections.length, 0, s);
        state.openSection = s.id;
        m.close(); app.changed(true);
        setTimeout(() => preview.scrollTo(s.id), 400);
      },
    }, h('b', {}, t.label), h('span', {}, t.desc)))),
  });
}

function addPage() {
  const name = textInput('', () => {}, { placeholder: '예: 파트너십' });
  const slug = textInput('', () => {}, { placeholder: '예: partners' });
  const m = modal({
    title: '새 페이지',
    body: [h('div', { class: 'f' }, h('label', {}, '이름'), name),
      h('div', { class: 'f' }, h('label', {}, '주소 (영문 소문자·숫자·-)'), slug),
      h('p', { class: 'help' }, '만든 뒤 [메뉴·바닥글] 탭에서 메뉴에 넣으면 사람들이 찾아갈 수 있습니다.')],
    actions: [{ label: '취소', onClick: () => m.close() }, { label: '만들기', primary: true, onClick: () => {
      const label = (name as HTMLInputElement).value.trim();
      const sl = (slug as HTMLInputElement).value.trim().toLowerCase();
      const err = slugError(sl, null);
      if (!label) return toast('이름을 넣어 주세요.', 'bad');
      if (err) return toast(err, 'bad');
      const id = 'p-' + Math.random().toString(36).slice(2, 8);
      const hero = newSection('hero'); hero.title = label; hero.style.background = 'band';
      const nf = state.site.pages.findIndex((p: any) => p.id === 'notfound');
      state.site.pages.splice(nf >= 0 ? nf : state.site.pages.length, 0,
        { id, slug: sl, label, seo: { title: label, description: '', noindex: false }, sections: [hero, newSection('text')] });
      state.pageId = id; state.openSection = hero.id;
      m.close(); app.changed(true); renderPreview();
      toast('페이지를 만들었습니다. 메뉴에 넣으려면 [메뉴·바닥글] 탭으로.', 'ok');
    } }],
  });
}

function slugError(sl: string, selfId: string | null): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(sl)) return '주소는 영문 소문자·숫자·- 로만, 첫 글자는 영문이나 숫자로.';
  if (RESERVED.includes(sl)) return `'${sl}' 는 사이트가 이미 쓰는 이름이라 쓸 수 없습니다.`;
  if (state.site.pages.some((p: any) => p.slug === sl && p.id !== selfId)) return `'${sl}' 주소를 쓰는 페이지가 이미 있습니다.`;
  return '';
}

function duplicatePage(page: any) {
  const c = clone(page);
  c.id = 'p-' + Math.random().toString(36).slice(2, 8);
  let n = 2; while (state.site.pages.some((p: any) => p.slug === `${page.slug}-${n}`)) n++;
  c.slug = `${page.slug}-${n}`; c.label = `${page.label} (복사본)`;
  c.sections.forEach((s: any) => { s.id = s.type + '-' + Math.random().toString(36).slice(2, 8); });
  state.site.pages.splice(state.site.pages.indexOf(page) + 1, 0, c);
  state.pageId = c.id; app.changed(true); renderPreview();
}

async function deletePage(page: any) {
  const ref = `page:${page.id}`;
  const refs = (siteText().split(`"${ref}"`).length - 1);
  if (!await ask(`'${page.label}' 페이지를 지울까요?` + (refs ? `\n이 페이지로 가는 링크 ${refs}곳(메뉴·버튼)도 함께 정리합니다.` : ''), '지우기', true)) return;
  const st = state.site;
  st.pages = st.pages.filter((p: any) => p !== page);
  st.menu = (st.menu || []).filter((m: any) => m.href !== ref);
  st.footer.links = (st.footer.links || []).filter((m: any) => m.href !== ref);
  st.pages.forEach((p: any) => p.sections.forEach((s: any) => {
    if (Array.isArray(s.buttons)) s.buttons = s.buttons.filter((b: any) => b.href !== ref);
  }));
  state.pageId = 'home'; state.openSection = null;
  app.changed(true); renderPreview();
}

/* ---------------- 탭: 메뉴·바닥글 ---------------- */

function renderMenu() {
  const ed = editor(), st = state.site;
  ed.appendChild(h('h3', { class: 'group' }, '머리글 메뉴'));
  ed.appendChild(listEditor({
    items: st.menu, app, addLabel: '메뉴 추가',
    title: (m: any) => (m.show === false ? '(숨김) ' : '') + (m.label || '(이름 없음)') + (m.href ? '' : '  — 연결을 고르면 나타납니다'),
    make: () => ({ label: '새 메뉴', href: '', show: true, style: 'link' }),
    body: (m: any) => [
      h('div', { class: 'f' }, h('label', {}, '글자'), textInput(m.label, (v) => { m.label = v; app.changed(); })),
      h('div', { class: 'f' }, h('label', {}, '연결'), linkPicker(m.href, app, (v) => { m.href = v; app.changed(); })),
      h('div', { class: 'f' }, h('label', {}, '모양'), selectEl(m.style || 'link', [
        { value: 'link', label: '글자' }, { value: 'button', label: '버튼 (예: 가입 신청)' }], (v) => { m.style = v; app.changed(); })),
      h('div', { class: 'f' }, toggleEl('보이기', m.show !== false, (v) => { m.show = v; app.changed(true); })),
    ],
  }));

  const f = st.footer;
  ed.appendChild(h('h3', { class: 'group' }, '바닥글'));
  ed.appendChild(h('div', { class: 'card-body' },
    h('div', { class: 'f' }, h('label', {}, '제목'), textInput(f.title, (v) => { f.title = v; app.changed(); })),
    h('div', { class: 'f' }, h('label', {}, '한 줄 소개'), textInput(f.tagline, (v) => { f.tagline = v; app.changed(); })),
    h('div', { class: 'f' }, h('label', {}, '저작권 문구'), textInput(f.copyright, (v) => { f.copyright = v; app.changed(); }),
      h('p', { class: 'help' }, '{year} 는 올해 연도로 바뀝니다.')),
    h('div', { class: 'f' }, h('label', {}, '배경'), selectEl(f.background || 'surface', [
      { value: 'default', label: '기본 배경' }, { value: 'surface', label: '면' }, { value: 'band', label: '띠' }],
      (v) => { f.background = v; app.changed(); }))));
  ed.appendChild(h('div', { class: 'f' }, h('label', {}, '바닥글 링크'), listEditor({
    items: f.links, app, addLabel: '링크 추가', compact: true,
    title: (m: any) => m.label || '(이름 없음)',
    make: () => ({ label: '새 링크', href: '' }),
    body: (m: any) => [
      h('div', { class: 'f' }, h('label', {}, '글자'), textInput(m.label, (v) => { m.label = v; app.changed(); })),
      h('div', { class: 'f' }, h('label', {}, '연결'), linkPicker(m.href, app, (v) => { m.href = v; app.changed(); })),
    ],
  })));
}

/* ---------------- 탭: 디자인 ---------------- */

const COLOR_FIELDS: [string, string, string][] = [
  ['bg', '기본 배경', '페이지 바탕'], ['surface', '면', '번갈아 쓰는 조금 다른 톤의 배경'],
  ['band', '띠', '강조 구역 배경 (가입 안내 등)'], ['accent', '포인트', '라벨·버튼·링크'],
  ['accentText', '포인트 위 글자', '버튼 글자색'], ['text', '글자', '제목·본문'],
  ['muted', '보조 글자', '설명문'], ['faint', '흐린 글자', '날짜·장소 같은 작은 글씨'],
  ['line', '선', '테두리·구분선'],
];

function contrastNote(c: any): HTMLElement {
  const checks: [string, number, number][] = [
    ['글자 / 배경', contrast(c.text, c.bg), 4.5], ['보조 글자 / 배경', contrast(c.muted, c.bg), 4.5],
    ['흐린 글자 / 배경', contrast(c.faint, c.bg), 3], ['포인트 / 배경', contrast(c.accent, c.bg), 3],
    ['버튼 글자 / 포인트', contrast(c.accentText, c.accent), 4.5],
  ];
  return h('ul', { class: 'contrast' }, checks.map(([n, v, need]) =>
    h('li', { class: v >= need ? 'ok' : 'bad' }, `${v >= need ? '✓' : '⚠'} ${n}  ${v.toFixed(1)} : 1`,
      v >= need ? null : h('span', {}, `  — ${need} 이상이어야 잘 읽힙니다`))));
}

function renderDesign() {
  const ed = editor(), t = state.site.theme, hd = state.site.header;

  ed.appendChild(h('h3', { class: 'group' }, '색 조합'));
  ed.appendChild(h('div', { class: 'presets' }, Object.entries(PRESETS).map(([key, p]) =>
    h('button', { type: 'button', class: 'preset' + (t.preset === key ? ' on' : ''), onclick: async () => {
      if (t.preset !== key && !await ask(`'${p.label}' 조합으로 바꿉니다. 직접 바꾼 색은 덮어씁니다.`, '바꾸기')) return;
      t.preset = key; t.colors = { ...p.colors }; app.changed(true);
    } },
    h('span', { class: 'sw' }, ['bg', 'surface', 'band', 'accent', 'text'].map((k) =>
      h('i', { style: `background:${(p.colors as any)[k]}` }))), h('span', {}, p.label)))));

  ed.appendChild(h('h3', { class: 'group' }, '색 하나씩'));
  const colors = h('div', { class: 'colors' });
  COLOR_FIELDS.forEach(([k, label, help]) => colors.appendChild(h('div', { class: 'f' },
    h('label', {}, label), colorEl(t.colors[k], (v) => { t.colors[k] = v; t.preset = 'custom'; app.changed(); refreshContrast(); }),
    h('p', { class: 'help' }, help))));
  ed.appendChild(colors);
  const cn = h('div', { id: 'contrast' }, contrastNote(t.colors));
  ed.appendChild(cn);
  function refreshContrast() { cn.innerHTML = ''; cn.appendChild(contrastNote(t.colors)); }

  const fontOpts = Object.entries(FONTS).map(([v, f]) => ({ value: v, label: f.label }));
  ed.appendChild(h('h3', { class: 'group' }, '글꼴·크기'));
  ed.appendChild(h('div', { class: 'card-body' },
    h('div', { class: 'f' }, h('label', {}, '본문 글꼴'), selectEl(t.font, fontOpts, (v) => { t.font = v; app.changed(); })),
    h('div', { class: 'f' }, h('label', {}, '제목 글꼴'), selectEl(t.headingFont || 'same', [{ value: 'same', label: '본문과 같게' }, ...fontOpts], (v) => { t.headingFont = v; app.changed(); }),
      h('p', { class: 'help' }, '제목만 명조로 바꾸면 격식 있는 인상이 됩니다. Pretendard 외 글꼴은 Google Fonts 에서 불러옵니다.')),
    num('본문 크기 (px)', t, 'baseSize', 14, 20, 1),
    num('제목 크기 배율', t, 'headingScale', 0.8, 1.4, 0.05),
    h('div', { class: 'f' }, h('label', {}, '제목 굵기'), selectEl(String(t.headingWeight), [
      { value: '500', label: '보통 (500)' }, { value: '600', label: '조금 굵게 (600)' }, { value: '700', label: '굵게 (700)' },
      { value: '800', label: '더 굵게 (800)' }, { value: '900', label: '가장 굵게 (900)' }], (v) => { t.headingWeight = Number(v); app.changed(); })),
    num('줄 간격', t, 'lineHeight', 1.4, 2.1, 0.05)));

  ed.appendChild(h('h3', { class: 'group' }, '모양'));
  ed.appendChild(h('div', { class: 'card-body' },
    num('모서리 둥글기 (px)', t, 'radius', 0, 24, 1),
    num('내용 최대 폭 (px)', t, 'contentWidth', 880, 1440, 20),
    h('div', { class: 'f' }, h('label', {}, '버튼'), selectEl(t.buttonStyle, [
      { value: 'solid', label: '채운 네모' }, { value: 'outline', label: '테두리만' }, { value: 'pill', label: '둥근 알약' }], (v) => { t.buttonStyle = v; app.changed(); })),
    h('div', { class: 'f' }, h('label', {}, '작은 라벨'), selectEl(t.kickerStyle, [
      { value: 'caps', label: '대문자 + 넓은 자간' }, { value: 'normal', label: '그대로' }], (v) => { t.kickerStyle = v; app.changed(); }))));

  ed.appendChild(h('h3', { class: 'group' }, '로고·머리글'));
  ed.appendChild(h('div', { class: 'card-body' },
    h('div', { class: 'f' }, h('label', {}, '로고 이미지'), imageField(hd.logo, app, { ratio: 'free', purpose: 'logo' }, (v) => { hd.logo = v; app.changed(true); }),
      h('p', { class: 'help' }, '비우면 아래 "로고 글자"가 대신 나옵니다. 투명 배경 PNG 가 가장 좋습니다.')),
    h('div', { class: 'f' }, h('label', {}, '로고 글자 (이미지가 없을 때)'), textInput(hd.logoText, (v) => { hd.logoText = v; app.changed(); })),
    num('로고 높이 (px)', hd, 'logoHeight', 14, 80, 1),
    h('div', { class: 'f' }, toggleEl('로고 색 뒤집기 (흰 로고를 밝은 배경에서 검게)', hd.logoInvert, (v) => { hd.logoInvert = v; app.changed(); })),
    h('div', { class: 'f' }, h('label', {}, '로고 위치'), h('div', { class: 'seg' }, [['left', '왼쪽'], ['center', '가운데 (메뉴는 아래)'], ['right', '오른쪽']].map(([v, l]) =>
      h('button', { type: 'button', class: hd.layout === v ? 'on' : '', onclick: () => { hd.layout = v; app.changed(true); } }, l)))),
    h('div', { class: 'f' }, h('label', {}, '머리글 배경'), selectEl(hd.background || 'bg', [
      { value: 'bg', label: '기본 배경' }, { value: 'surface', label: '면' }, { value: 'band', label: '띠' }], (v) => { hd.background = v; app.changed(); })),
    h('div', { class: 'f' }, h('label', {}, '머리글 높이'), selectEl(hd.height || 'normal', [
      { value: 'compact', label: '낮게' }, { value: 'normal', label: '보통' }, { value: 'tall', label: '높게' }], (v) => { hd.height = v; app.changed(); })),
    h('div', { class: 'f' }, h('label', {}, '메뉴 글자'), selectEl(hd.menuStyle || 'caps', [
      { value: 'caps', label: '대문자 + 넓은 자간' }, { value: 'normal', label: '그대로' }], (v) => { hd.menuStyle = v; app.changed(); })),
    h('div', { class: 'f' }, toggleEl('스크롤해도 위에 붙어 있기', hd.sticky !== false, (v) => { hd.sticky = v; app.changed(); })),
    h('div', { class: 'f' }, toggleEl('아래 구분선', hd.border !== false, (v) => { hd.border = v; app.changed(); }))));
}

function num(label: string, obj: any, key: string, min: number, max: number, step: number) {
  return fieldEl({ key, label, kind: 'number', min, max, step }, obj, app)!;
}

/* ---------------- 탭: 프로그램 ---------------- */

function renderPrograms() {
  const ed = editor();
  ed.appendChild(h('p', { class: 'intro' }, '여기 목록이 사이트의 [프로그램] 섹션과 이벤트 필터 탭이 됩니다.'));
  ed.appendChild(listEditor({
    items: state.site.programs, app, addLabel: '프로그램 추가',
    title: (p: any) => `${p.label || '(이름 없음)'}  ·  이벤트 ${state.events.filter((e) => e.program === p.id).length}건`,
    make: () => ({ id: 'program-' + Math.random().toString(36).slice(2, 6), label: '새 프로그램', kicker: '', blurb: '', image: '' }),
    body: (p: any) => [
      h('div', { class: 'f' }, h('label', {}, '이름'), textInput(p.label, (v) => { p.label = v; app.changed(); })),
      h('div', { class: 'f' }, h('label', {}, '작은 라벨'), textInput(p.kicker, (v) => { p.kicker = v; app.changed(); })),
      h('div', { class: 'f' }, h('label', {}, '설명'), textArea(p.blurb, (v) => { p.blurb = v; app.changed(); }, 3)),
      h('div', { class: 'f' }, h('label', {}, '대표 이미지'), imageField(p.image, app, { ratio: '16:9' }, (v) => { p.image = v; app.changed(true); })),
      h('div', { class: 'f' }, h('label', {}, '분류 코드'), textInput(p.id, (v) => {
        const nv = v.trim(); const old = p.id;
        if (!nv) return;
        state.events.forEach((e) => { if (e.program === old) e.program = nv; });
        state.site.pages.forEach((pg: any) => pg.sections.forEach((s: any) => { if (s.program === old) s.program = nv; }));
        p.id = nv; app.changed();
      }), h('p', { class: 'help' }, '이벤트를 이 프로그램에 묶는 값. 바꾸면 연결된 이벤트도 같이 바뀝니다.')),
    ],
  }));
}

/* ---------------- 탭: 이벤트 ---------------- */

function renderEvents() {
  const ed = editor();
  const pub = state.events.filter((e) => !e.hidden && e.date).length;
  ed.appendChild(h('div', { class: 'toolbar' },
    textInput(state.eventQuery, (v) => { state.eventQuery = v; drawList(); }, { placeholder: '제목·장소로 찾기' }),
    h('button', { type: 'button', class: 'btn', onclick: () => {
      const id = 'ev-' + Math.random().toString(36).slice(2, 8);
      state.events.unshift({ id, title: '새 이벤트', date: '', place: '', program: state.site.programs[0]?.id || '', image: '', hidden: true });
      state.openEvent = id; state.eventQuery = ''; app.changed(true);
    } }, '+ 이벤트')));
  ed.appendChild(h('p', { class: 'intro' }, `전체 ${state.events.length}건 · 공개 ${pub}건 · 숨김 ${state.events.length - pub}건. 날짜가 없거나 '숨김'이면 사이트에 나오지 않습니다.`));

  const list = h('div', { class: 'events' });
  ed.appendChild(list);
  const progs = app.programs().map((p) => ({ value: p.id, label: p.label }));

  function drawList() {
    list.innerHTML = '';
    const q = state.eventQuery.toLowerCase();
    state.events.slice()
      .sort((a, b) => (b.date || '9999').localeCompare(a.date || '9999'))
      .filter((e) => !q || (e.title + ' ' + (e.place || '')).toLowerCase().includes(q))
      .forEach((e) => {
        const open = state.openEvent === e.id;
        const off = e.hidden || !e.date;
        const row = h('div', { class: 'ev' + (open ? ' open' : '') + (off ? ' off' : '') });
        row.appendChild(h('div', { class: 'ev-head', onclick: () => { state.openEvent = open ? null : e.id; renderEditor(); } },
          e.image ? h('img', { src: imgUrl(e.image), alt: '', loading: 'lazy' }) : h('span', { class: 'noimg' }),
          h('span', { class: 'ev-t' }, e.title || '(제목 없음)', h('small', {}, `${e.date || '날짜 없음'} · ${e.place || ''}`)),
          off ? h('em', {}, e.date ? '숨김' : '날짜 없음') : null));
        if (open) {
          row.appendChild(h('div', { class: 'ev-body' },
            h('div', { class: 'f' }, h('label', {}, '제목'), textInput(e.title, (v) => { e.title = v; app.changed(); })),
            h('div', { class: 'grid2' },
              h('div', { class: 'f' }, h('label', {}, '날짜'), (() => {
                const d = h('input', { type: 'date', value: e.date || '' }) as HTMLInputElement;
                d.addEventListener('change', () => { e.date = d.value; app.changed(); });
                return d;
              })()),
              h('div', { class: 'f' }, h('label', {}, '프로그램'), selectEl(e.program, progs, (v) => { e.program = v; app.changed(); }))),
            h('div', { class: 'f' }, h('label', {}, '장소'), textInput(e.place, (v) => { e.place = v; app.changed(); })),
            h('div', { class: 'f' }, h('label', {}, '이미지 (카드에는 16:9 로 보입니다)'),
              imageField(e.image, app, { ratio: '16:9' }, (v) => { e.image = v; app.changed(true); })),
            h('div', { class: 'f' }, toggleEl('숨김 (사이트에 안 보이게)', e.hidden, (v) => { e.hidden = v; app.changed(true); })),
            h('div', { class: 'row-actions' }, h('button', { type: 'button', class: 'btn danger', onclick: async () => {
              if (!await ask(`'${e.title}' 기록을 지울까요?`, '지우기', true)) return;
              state.events = state.events.filter((x) => x !== e); app.changed(true);
            } }, '이 기록 지우기'))));
        }
        list.appendChild(row);
      });
  }
  drawList();
}

/* ---------------- 탭: 이미지 ---------------- */

function renderImages() {
  const ed = editor();
  ed.appendChild(h('div', { class: 'toolbar' },
    h('p', { class: 'intro' }, `이미지 ${libraryList().length}장. 올린 이미지는 [게시] 때 함께 올라갑니다.`),
    h('button', { type: 'button', class: 'btn', onclick: async () => { if (await app.uploadImage({ ratio: 'free' })) app.changed(true); } }, '+ 올리기')));
  const grid = h('div', { class: 'lib big' });
  libraryList().forEach((p) => {
    const n = usage(p);
    grid.appendChild(h('button', { type: 'button', class: 'lib-item', onclick: () => imageActions(p) },
      h('img', { src: imgUrl(p), alt: '', loading: 'lazy' }), h('span', {}, p.split('/').pop()!),
      state.staged[p] ? h('em', {}, '대기') : null, n ? h('i', {}, `사용 ${n}`) : null));
  });
  ed.appendChild(grid);
}

function imageActions(p: string) {
  const n = usage(p);
  const m = modal({
    title: p.split('/').pop()!, wide: true,
    body: [h('img', { src: imgUrl(p), alt: '', class: 'big-img' }),
      h('p', { class: 'help' }, `경로: ${p} · ${n ? `${n}곳에서 사용 중` : '사용하는 곳 없음'}` +
        (state.staged[p] ? ` · 게시 대기 (${Math.round(state.staged[p].bytes / 1024)}KB)` : ''))],
    actions: [
      { label: '경로 복사', onClick: () => { navigator.clipboard?.writeText(p); toast('복사했습니다.', 'ok'); } },
      { label: '잘라서 새로 만들기', onClick: async () => { m.close(); if (await app.recropImage(p, { ratio: 'free' })) app.changed(true); } },
      { label: '지우기', danger: true, onClick: async () => {
        if (n && !await ask(`${n}곳에서 쓰고 있습니다. 지우면 그 자리는 이미지 없이 나옵니다. 계속할까요?`, '지우기', true)) return;
        m.close();
        if (state.staged[p]) { delete state.staged[p]; state.images = state.images.filter((x) => x !== p); }
        else state.deletes.add(p);
        app.changed(true);
      } },
    ],
  });
}

/* ---------------- 탭: 기본 설정 ---------------- */

function renderSettings() {
  const ed = editor(), s = state.site.settings;
  ed.appendChild(h('div', { class: 'card-body' },
    h('div', { class: 'f' }, h('label', {}, '사이트 이름'), textInput(s.siteName, (v) => { s.siteName = v; app.changed(); })),
    h('div', { class: 'f' }, h('label', {}, '브라우저 탭 제목 형식'), textInput(s.titleTemplate, (v) => { s.titleTemplate = v; app.changed(); }),
      h('p', { class: 'help' }, '{page} 는 페이지 제목, {site} 는 사이트 이름. 홈은 페이지 설정의 제목을 그대로 씁니다.')),
    h('div', { class: 'f' }, h('label', {}, '사이트 설명 (검색·공유 기본값)'), textArea(s.description, (v) => { s.description = v; app.changed(); }, 3)),
    h('div', { class: 'f' }, h('label', {}, '가입 신청 폼 주소'), textInput(s.joinFormUrl, (v) => { s.joinFormUrl = v.trim(); app.changed(); }, { placeholder: 'https://docs.google.com/forms/…' }),
      h('p', { class: 'help' }, "버튼 연결에서 '가입 신청 폼'을 고르면 이 주소로 갑니다. 비우면 신청 상자가 '준비 중' 문구로 바뀝니다.")),
    h('div', { class: 'f' }, h('label', {}, '건너뛰기 링크 글자'), textInput(s.skipText, (v) => { s.skipText = v; app.changed(); }),
      h('p', { class: 'help' }, '키보드로 사이트를 쓰는 사람이 Tab 을 누르면 맨 먼저 보이는 "본문으로 바로 가기" 링크.')),
    h('div', { class: 'f' }, h('label', {}, '공유 미리보기 이미지 (카톡·인스타)'), imageField(s.ogImage, app, { ratio: 'og', purpose: 'og' }, (v) => { s.ogImage = v; app.changed(true); })),
    h('div', { class: 'f' }, h('label', {}, '브라우저 탭 아이콘'), imageField(s.favicon, app, { ratio: '1:1', purpose: 'icon' }, (v) => { s.favicon = v; app.changed(true); })),
    h('div', { class: 'f' }, h('label', {}, '휴대폰 홈 화면 아이콘'), imageField(s.appleIcon, app, { ratio: '1:1', purpose: 'icon' }, (v) => { s.appleIcon = v; app.changed(true); }))));

  ed.appendChild(h('h3', { class: 'group' }, '글에 쓸 수 있는 자리표시'));
  ed.appendChild(h('ul', { class: 'tokens' }, TOKENS.map(([k, d]) => h('li', {}, h('code', {}, k), ' ', d))));
  ed.appendChild(h('p', { class: 'help' }, '어느 글에든 넣으면 게시할 때 실제 값으로 바뀝니다. 예: "{eventCount}회의 기록"'));
}

/* ---------------- 그리기 ---------------- */

const TABS: [Tab, string][] = [['pages', '페이지'], ['menu', '메뉴·바닥글'], ['design', '디자인'],
  ['programs', '프로그램'], ['events', '이벤트'], ['images', '이미지'], ['settings', '기본 설정']];

function renderTabs() {
  const nav = $('tabs'); nav.innerHTML = '';
  TABS.forEach(([k, l]) => nav.appendChild(h('button', {
    type: 'button', class: state.tab === k ? 'on' : '', onclick: () => { state.tab = k; renderTabs(); renderEditor(); },
  }, l)));
}

function renderEditor() {
  const ed = editor();
  const y = ed.scrollTop;
  ed.innerHTML = '';
  if (!state.site) return;
  ({ pages: renderPages, menu: renderMenu, design: renderDesign, programs: renderPrograms,
    events: renderEvents, images: renderImages, settings: renderSettings } as Record<Tab, () => void>)[state.tab]();
  ed.scrollTop = y;
}

function renderPreview() {
  if (!state.site) return;
  const images: Record<string, string> = {};
  for (const [p, f] of Object.entries(state.staged)) images[p] = f.dataUrl;
  preview.render(state.site, state.events, state.pageId, images, state.openSection);
  const sel = $('pv-page') as HTMLSelectElement;
  sel.innerHTML = '';
  state.site.pages.forEach((p: any) => sel.appendChild(h('option', { value: p.id }, p.label || p.id)));
  sel.value = state.pageId;
}

function renderBar() {
  const dirty = isDirty();
  const n = Object.keys(state.staged).length, d = state.deletes.size;
  const label = $('state');
  label.textContent = !state.site ? '불러오는 중…'
    : dirty ? `게시하지 않은 변경이 있습니다${n ? ` · 새 이미지 ${n}` : ''}${d ? ` · 지울 이미지 ${d}` : ''}`
    : '사이트와 같은 상태입니다';
  label.className = dirty ? 'dirty' : '';
  ($('publish') as HTMLButtonElement).disabled = !dirty;
  ($('revert') as HTMLButtonElement).disabled = !dirty;
  $('tokenState').textContent = gh.token() ? '토큰 ✓' : '토큰 없음';
  $('tokenState').className = gh.token() ? '' : 'warn';
  const dep = $('deploy');
  if (state.deploy) {
    dep.hidden = false; dep.className = state.deploy.kind;
    dep.innerHTML = '';
    dep.append(state.deploy.text);
    if (state.deploy.url) dep.append(' ', h('a', { href: state.deploy.url, target: '_blank', rel: 'noopener' }, '자세히'));
    if (state.deploy.kind === 'ok') dep.append(' ', h('a', { href: BASE, target: '_blank', rel: 'noopener' }, '사이트 보기'));
  } else dep.hidden = true;
}

/* ---------------- 불러오기 · 초안 · 게시 ---------------- */

async function load() {
  $('state').textContent = '불러오는 중…';
  try {
    const [commit, site, events, images] = await Promise.all([
      gh.headCommit(), gh.readJson(gh.SITE_PATH), gh.readJson(gh.EVENTS_PATH), gh.listImages()]);
    state.baseCommit = commit;
    state.site = JSON.parse(site.text);
    state.events = JSON.parse(events.text).events || [];
    state.baseSite = siteText(); state.baseEvents = eventsText();
    state.images = images; state.staged = {}; state.deletes = new Set();
    if (!state.site.pages.some((p: any) => p.id === state.pageId)) state.pageId = 'home';
    offerDraft();
  } catch (e: any) {
    $('state').textContent = '불러오지 못했습니다';
    toast(`저장소를 읽지 못했습니다 — ${e.message}` + (e.status === 403 ? ' (GitHub 요청 한도. 토큰을 넣으면 풀립니다)' : ''), 'bad');
    return;
  }
  renderTabs(); renderEditor(); renderPreview(); renderBar();
}

function saveDraft() {
  if (!state.site) return;
  try {
    if (siteText() === state.baseSite && eventsText() === state.baseEvents) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify({ site: state.site, events: state.events, at: Date.now(), base: state.baseCommit }));
  } catch { /* 저장 공간이 없으면 조용히 넘긴다 */ }
}

function offerDraft() {
  let d: any = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { d = null; }
  if (!d) return;
  const same = JSON.stringify(d.site, null, 2) + '\n' === state.baseSite
    && JSON.stringify({ events: d.events }, null, 2) + '\n' === state.baseEvents;
  if (same) { localStorage.removeItem(DRAFT_KEY); return; }
  const when = new Date(d.at).toLocaleString('ko-KR');
  const m = modal({
    title: '게시하지 않은 편집본이 있습니다',
    body: h('p', { class: 'ask' }, `${when} 에 이 브라우저에서 고치다 만 내용이 남아 있습니다.` +
      (d.base !== state.baseCommit ? '\n그 뒤로 사이트가 한 번 이상 게시됐습니다. 복원하면 그 게시 내용을 덮어쓸 수 있으니 확인하고 게시하세요.' : '') +
      '\n(올리려던 이미지는 보관되지 않습니다.)'),
    actions: [
      { label: '버리기', danger: true, onClick: () => { localStorage.removeItem(DRAFT_KEY); m.close(); } },
      { label: '복원하기', primary: true, onClick: () => {
        state.site = d.site; state.events = d.events; m.close();
        renderEditor(); renderPreview(); renderBar();
        toast('편집본을 복원했습니다. 확인 후 게시하세요.', 'ok');
      } },
    ],
  });
}

function validate(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const st = state.site;
  const ids = new Set<string>();
  st.pages.forEach((p: any) => {
    if (ids.has(p.id)) errors.push(`페이지 id 중복: ${p.id}`);
    ids.add(p.id);
    if (p.id === 'home' || p.id === 'notfound') return;
    const e = slugError(p.slug, p.id);
    if (e) errors.push(`'${p.label}' 페이지 — ${e}`);
  });
  const progIds = new Set<string>();
  st.programs.forEach((p: any) => {
    if (!p.id) errors.push(`프로그램 '${p.label}' 의 분류 코드가 비었습니다.`);
    if (progIds.has(p.id)) errors.push(`프로그램 분류 코드 중복: ${p.id}`);
    progIds.add(p.id);
  });
  const text = siteText();
  (text.match(/"page:([^"]+)"/g) || []).forEach((m) => {
    const id = m.slice(6, -1);
    if (!ids.has(id)) warnings.push(`없는 페이지로 가는 링크가 있습니다 (${id}). 그 버튼·메뉴는 사이트에 나오지 않습니다.`);
  });
  const noLink = (st.menu || []).filter((m: any) => m.show !== false && !m.href).length
    + (st.footer?.links || []).filter((m: any) => !m.href).length
    + st.pages.reduce((n: number, p: any) => n + p.sections.reduce((k: number, s: any) =>
      k + (s.buttons || []).filter((b: any) => !b.href).length, 0), 0);
  if (noLink) warnings.push(`연결을 고르지 않은 메뉴·버튼 ${noLink}개는 사이트에 나오지 않습니다.`);
  const ju = String(st.settings.joinFormUrl || '');
  if (ju && !/^https?:\/\//.test(ju)) errors.push('가입 신청 폼 주소는 https:// 로 시작해야 합니다.');
  const missing = new Set<string>();
  (text + eventsText()).match(/"\/(?:uploads|posters)\/[^"]+"/g)?.forEach((m) => {
    const p = m.slice(1, -1);
    if (!state.images.includes(p) || state.deletes.has(p)) missing.add(p);
  });
  if (missing.size) warnings.push(`없는 이미지를 가리키는 곳이 ${missing.size}곳 있습니다: ${[...missing].slice(0, 3).join(', ')}`);
  return { errors, warnings: [...new Set(warnings)] };
}

async function publish() {
  if (!gh.token()) { openToken(); return; }
  const { errors, warnings } = validate();
  if (errors.length) {
    const m = modal({ title: '게시할 수 없습니다', body: h('ul', { class: 'issues' }, errors.map((e) => h('li', {}, e))),
      actions: [{ label: '닫기', onClick: () => m.close() }] });
    return;
  }
  if (warnings.length && !await ask('확인해 주세요:\n\n' + warnings.join('\n') + '\n\n그래도 게시할까요?', '게시')) return;

  const btn = $('publish') as HTMLButtonElement;
  btn.disabled = true; btn.textContent = '게시 중…';
  try {
    // 그 사이 다른 곳(다른 브라우저, 저장소 직접 수정)에서 글을 바꿨으면 덮어쓰지 않는다.
    const head = await gh.headCommit();
    if (head !== state.baseCommit) {
      const [s, e] = await Promise.all([gh.readJson(gh.SITE_PATH, head), gh.readJson(gh.EVENTS_PATH, head)]);
      if (s.text !== state.baseSite || e.text !== state.baseEvents) {
        saveDraft();
        throw new Error('그 사이 다른 곳에서 먼저 게시했습니다. 덮어쓰지 않았습니다. 지금 편집본은 이 브라우저에 보관했으니 [불러오기] 뒤 복원해 확인하고 다시 게시하세요.');
      }
    }
    const changes: gh.Change[] = [];
    const parts: string[] = [];
    if (siteText() !== state.baseSite) { changes.push({ path: gh.SITE_PATH, text: siteText() }); parts.push('site copy and layout'); }
    if (eventsText() !== state.baseEvents) { changes.push({ path: gh.EVENTS_PATH, text: eventsText() }); parts.push('event records'); }
    const added = Object.entries(state.staged);
    added.forEach(([p, f]) => changes.push({ path: 'public' + p, base64: f.base64 }));
    state.deletes.forEach((p) => changes.push({ path: 'public' + p, remove: true }));
    if (added.length) parts.push(`${added.length} new image${added.length > 1 ? 's' : ''}`);
    if (state.deletes.size) parts.push(`${state.deletes.size} removed image${state.deletes.size > 1 ? 's' : ''}`);

    const sha = await gh.commitChanges(head, changes, `Update ${parts.join(', ')} from the admin page`);
    state.baseCommit = sha;
    state.baseSite = siteText(); state.baseEvents = eventsText();
    state.staged = {}; state.deletes.forEach((p) => { state.images = state.images.filter((x) => x !== p); });
    state.deletes = new Set();
    localStorage.removeItem(DRAFT_KEY);
    toast('게시했습니다. 사이트가 다시 지어지는 동안 기다려 주세요.', 'ok');
    watchDeploy(sha);
  } catch (e: any) {
    toast(e.message || String(e), 'bad');
  } finally {
    btn.textContent = '게시';
    renderBar();
  }
}

async function watchDeploy(sha: string) {
  state.deploy = { sha, text: '빌드 대기 중…', kind: 'wait' }; renderBar();
  const started = Date.now();
  const tick = async () => {
    if (state.deploy?.sha !== sha) return;
    try {
      const r = await gh.deployStatus(sha);
      if (r && r.status === 'completed') {
        state.deploy = r.conclusion === 'success'
          ? { sha, text: '✓ 사이트에 반영됐습니다.', kind: 'ok', url: r.url }
          : { sha, text: '✗ 빌드가 실패했습니다. 사이트는 이전 상태 그대로입니다.', kind: 'bad', url: r.url };
        renderBar(); return;
      }
      if (r) state.deploy = { sha, text: '사이트를 짓는 중… (보통 1~2분)', kind: 'wait', url: r.url };
    } catch { /* 요청 한도 등 — 다음 번에 다시 */ }
    renderBar();
    if (Date.now() - started < 8 * 60_000) setTimeout(tick, 7000);
    else { state.deploy = { sha, text: '빌드 상태를 확인하지 못했습니다. 저장소의 Actions 탭을 보세요.', kind: 'bad' }; renderBar(); }
  };
  setTimeout(tick, 4000);
}

function openToken() {
  const input = h('input', { type: 'password', value: gh.token(), placeholder: 'github_pat_…', autocomplete: 'off' }) as HTMLInputElement;
  const m = modal({
    title: 'GitHub 토큰',
    body: [h('ol', { class: 'steps-help' },
      h('li', {}, 'github.com/settings/personal-access-tokens 에서 Fine-grained token 만들기'),
      h('li', {}, `Repository access → Only select repositories → ${gh.OWNER}/${gh.REPO}`),
      h('li', {}, 'Repository permissions → Contents: Read and write'),
      h('li', {}, '만든 토큰을 아래에 붙여넣기')),
      h('div', { class: 'f' }, h('label', {}, '토큰'), input),
      h('p', { class: 'help' }, '이 브라우저에만 저장됩니다. 저장소에 올라가지 않습니다.')],
    actions: [
      { label: '지우기', danger: true, onClick: () => { gh.setToken(null); m.close(); renderBar(); } },
      { label: '저장', primary: true, onClick: () => { gh.setToken(input.value.trim() || null); m.close(); renderBar(); toast('토큰을 저장했습니다.', 'ok'); } },
    ],
  });
}

/* ---------------- 붙이기 ---------------- */

$('publish').addEventListener('click', publish);
$('revert').addEventListener('click', async () => {
  if (!await ask('게시하지 않은 변경을 모두 버리고 사이트 상태로 되돌립니다.', '되돌리기', true)) return;
  state.site = JSON.parse(state.baseSite); state.events = JSON.parse(state.baseEvents).events;
  state.images = state.images.filter((p) => !state.staged[p]);
  state.staged = {}; state.deletes = new Set();
  localStorage.removeItem(DRAFT_KEY);
  renderEditor(); renderPreview(); renderBar();
});
$('reload').addEventListener('click', async () => {
  if (isDirty() && !await ask('저장소에서 다시 불러옵니다. 지금 편집본은 이 브라우저에 보관되어 다시 복원할 수 있습니다.', '불러오기')) return;
  saveDraft(); load();
});
$('token').addEventListener('click', openToken);
$('viewSite').setAttribute('href', BASE);
$('pv-page').addEventListener('change', (e) => {
  state.pageId = (e.target as HTMLSelectElement).value; state.openSection = null;
  if (state.tab === 'pages') renderEditor();
  renderPreview();
});
document.querySelectorAll<HTMLButtonElement>('[data-device]').forEach((b) => b.addEventListener('click', () => {
  state.device = b.dataset.device as any;
  document.querySelectorAll('[data-device]').forEach((x) => x.classList.toggle('on', x === b));
  $('frame-wrap').className = state.device;
}));
$('pv-toggle').addEventListener('click', () => document.body.classList.toggle('show-preview'));

window.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.yclb === 'nav' && state.site?.pages.some((p: any) => p.id === d.page)) {
    state.pageId = d.page; state.openSection = null;
    if (state.tab === 'pages') renderEditor();
    renderPreview();
  }
  if (d.yclb === 'sec') {
    state.tab = 'pages'; state.openSection = d.id;
    renderTabs(); renderEditor(); preview.mark(d.id);
    document.body.classList.remove('show-preview');
    requestAnimationFrame(() => editor().querySelector(`[data-id="${CSS.escape(d.id)}"]`)?.scrollIntoView({ block: 'start' }));
  }
});

window.addEventListener('beforeunload', (e) => {
  if (Object.keys(state.staged).length) { e.preventDefault(); e.returnValue = ''; }
});

renderTabs();
renderBar();
load();
