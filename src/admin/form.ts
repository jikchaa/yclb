/* 입력칸 만들기. 스키마(render/schema.ts)의 칸 정의를 받아 알맞은 입력을 그린다.
   글자 입력은 제자리에서 값만 바꾸고(커서가 튀지 않게), 목록 추가·삭제나
   선택 변경처럼 모양이 바뀌는 조작만 편집 화면을 다시 그린다. */

import type { Field } from '../render/schema';
import { BLOCK_TYPES, BUTTON_STYLES } from '../render/schema';
import { h, move, clone, ask } from './ui';

export interface App {
  changed(structural?: boolean): void;
  pages(): { id: string; label: string }[];
  programs(): { id: string; label: string }[];
  imgUrl(path: string): string;
  chooseImage(o: { ratio?: string; purpose?: 'photo' | 'logo' | 'og' | 'icon'; current?: string; name?: string }): Promise<string | null>;
  uploadImage(o: { ratio?: string; purpose?: 'photo' | 'logo' | 'og' | 'icon' }): Promise<string | null>;
  recropImage(path: string, o: { ratio?: string; purpose?: 'photo' | 'logo' | 'og' | 'icon' }): Promise<string | null>;
}

const RICH_HINT = '**굵게** · [글자](page:about) 링크 · 줄바꿈은 그대로';

function wrapField(f: { label: string; help?: string }, control: HTMLElement, extra?: HTMLElement | null) {
  return h('div', { class: 'f' },
    h('label', {}, f.label),
    control,
    extra || null,
    f.help ? h('p', { class: 'help' }, f.help) : null);
}

function autoGrow(t: HTMLTextAreaElement) {
  const fit = () => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 420) + 'px'; };
  t.addEventListener('input', fit);
  requestAnimationFrame(fit);
}

export function textInput(value: string, onInput: (v: string) => void, attrs: Record<string, any> = {}) {
  const i = h('input', { type: 'text', value: value ?? '', ...attrs }) as HTMLInputElement;
  i.addEventListener('input', () => onInput(i.value));
  return i;
}

export function textArea(value: string, onInput: (v: string) => void, rows = 2) {
  const t = h('textarea', { rows }) as HTMLTextAreaElement;
  t.value = value ?? '';
  t.addEventListener('input', () => onInput(t.value));
  autoGrow(t);
  return t;
}

export function selectEl(value: string, options: { value: string; label: string }[], onChange: (v: string) => void) {
  const s = h('select', {}, options.map((o) => h('option', { value: o.value }, o.label))) as HTMLSelectElement;
  s.value = value ?? '';
  if (s.value !== (value ?? '') && options.length) s.value = options[0].value;
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

export function toggleEl(label: string, checked: boolean, onChange: (v: boolean) => void) {
  const c = h('input', { type: 'checkbox' }) as HTMLInputElement;
  c.checked = !!checked;
  c.addEventListener('change', () => onChange(c.checked));
  return h('label', { class: 'toggle' }, c, h('span', {}, label));
}

export function colorEl(value: string, onChange: (v: string) => void) {
  const pick = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000' }) as HTMLInputElement;
  const text = h('input', { type: 'text', value: value || '', class: 'hex', maxlength: 7, spellcheck: false }) as HTMLInputElement;
  pick.addEventListener('input', () => { text.value = pick.value.toUpperCase(); onChange(text.value); });
  text.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(text.value)) { pick.value = text.value; onChange(text.value.toUpperCase()); }
  });
  return h('div', { class: 'color' }, pick, text);
}

/* ---------- 링크 고르기 ---------- */

export function linkPicker(value: string, app: App, onChange: (v: string) => void) {
  const pages = app.pages();
  const isPage = /^page:/.test(value || '');
  const known = !value || value === 'join-form' || (isPage && pages.some((p) => 'page:' + p.id === value));
  const opts = [
    { value: '', label: '— 연결 없음 —' },
    ...pages.map((p) => ({ value: 'page:' + p.id, label: '페이지: ' + p.label })),
    { value: 'join-form', label: '가입 신청 폼 (기본 설정의 주소)' },
    { value: '__custom', label: '직접 입력 (https://… 또는 #앵커)' },
  ];
  const custom = textInput(known ? '' : value, (v) => onChange(v.trim()), { placeholder: 'https://… 또는 #앵커' });
  custom.hidden = known;
  const sel = selectEl(known ? value || '' : '__custom', opts, (v) => {
    if (v === '__custom') { custom.hidden = false; custom.focus(); onChange(custom.value.trim()); }
    else { custom.hidden = true; onChange(v); }
  });
  return h('div', { class: 'link' }, sel, custom);
}

/* ---------- 이미지 칸 ---------- */

export function imageField(value: string, app: App, o: { ratio?: string; purpose?: any; label?: string },
  onChange: (v: string) => void) {
  const thumb = h('div', { class: 'thumb' + (value ? '' : ' empty') },
    value ? h('img', { src: app.imgUrl(value), alt: '' }) : h('span', {}, '이미지 없음'));
  const set = (v: string | null) => { if (v !== null) onChange(v); };
  const bar = h('div', { class: 'thumb-actions' },
    h('button', { type: 'button', class: 'btn-sm', onclick: async () => set(await app.chooseImage({ ...o, current: value })) }, '고르기'),
    h('button', { type: 'button', class: 'btn-sm', onclick: async () => set(await app.uploadImage(o)) }, '올리기'),
    value ? h('button', { type: 'button', class: 'btn-sm', onclick: async () => set(await app.recropImage(value, o)) }, '자르기') : null,
    value ? h('button', { type: 'button', class: 'btn-sm quiet', onclick: () => onChange('') }, '비우기') : null);
  return h('div', { class: 'img-field' }, thumb, h('div', {},
    bar, value ? h('p', { class: 'path' }, value) : null));
}

/* ---------- 목록 편집 공통 ---------- */

export function listEditor<T>(o: {
  items: T[]; app: App; addLabel: string; title?: (it: T, i: number) => string;
  body: (it: T, i: number) => HTMLElement | HTMLElement[]; make: () => T; compact?: boolean;
}) {
  const box = h('div', { class: 'list' + (o.compact ? ' compact' : '') });
  o.items.forEach((it, i) => {
    const head = h('div', { class: 'row-head' },
      h('span', { class: 'row-n' }, String(i + 1).padStart(2, '0')),
      o.title ? h('span', { class: 'row-t' }, o.title(it, i)) : null,
      h('span', { class: 'row-tools' },
        h('button', { type: 'button', class: 'icon', title: '위로', onclick: () => { if (move(o.items, i, -1)) o.app.changed(true); } }, '↑'),
        h('button', { type: 'button', class: 'icon', title: '아래로', onclick: () => { if (move(o.items, i, 1)) o.app.changed(true); } }, '↓'),
        h('button', { type: 'button', class: 'icon', title: '복제', onclick: () => { o.items.splice(i + 1, 0, clone(it)); o.app.changed(true); } }, '⧉'),
        h('button', { type: 'button', class: 'icon danger', title: '삭제', onclick: async () => {
          if (await ask('이 항목을 지울까요?', '지우기', true)) { o.items.splice(i, 1); o.app.changed(true); }
        } }, '×')));
    box.appendChild(h('div', { class: 'row' }, head, h('div', { class: 'row-body' }, o.body(it, i))));
  });
  box.appendChild(h('button', { type: 'button', class: 'btn-sm add', onclick: () => { o.items.push(o.make()); o.app.changed(true); } }, '+ ' + o.addLabel));
  return box;
}

/* ---------- 스키마 칸 하나 ---------- */

export function fieldEl(f: Field, obj: any, app: App): HTMLElement | null {
  if (f.showIf && !f.showIf(obj)) return null;
  const set = (v: any, structural = false) => { obj[f.key] = v; app.changed(structural); };
  const v = obj[f.key];

  switch (f.kind) {
    case 'text':
      return wrapField(f, textInput(v, (x) => set(x)));
    case 'area':
      return wrapField(f, textArea(v, (x) => set(x), 2));
    case 'rich':
      return wrapField({ ...f, help: f.help ? f.help + ' · ' + RICH_HINT : RICH_HINT }, textArea(v, (x) => set(x), 2));
    case 'number': {
      const n = h('input', { type: 'number', value: v ?? '', min: f.min, max: f.max, step: f.step || 1 }) as HTMLInputElement;
      const r = h('input', { type: 'range', value: v ?? 0, min: f.min ?? 0, max: f.max ?? 100, step: f.step || 1 }) as HTMLInputElement;
      n.addEventListener('input', () => { r.value = n.value; set(Number(n.value)); });
      r.addEventListener('input', () => { n.value = r.value; set(Number(r.value)); });
      return wrapField(f, h('div', { class: 'num' }, r, n));
    }
    case 'toggle':
      return h('div', { class: 'f' }, toggleEl(f.label, !!v, (x) => set(x, true)),
        f.help ? h('p', { class: 'help' }, f.help) : null);
    case 'select':
      return wrapField(f, selectEl(String(v ?? ''), f.options || [], (x) => set(x, true)));
    case 'color':
      return wrapField(f, colorEl(v, (x) => set(x)));
    case 'program':
      return wrapField(f, selectEl(v || '', [{ value: '', label: '전체' },
        ...app.programs().map((p) => ({ value: p.id, label: p.label }))], (x) => set(x, true)));
    case 'link':
      return wrapField(f, linkPicker(v || '', app, (x) => set(x)));
    case 'image':
      return wrapField(f, imageField(v || '', app, { ratio: f.ratio }, (x) => set(x, true)));
    case 'tags': {
      const t = textArea((v || []).join('\n'), (x) => set(x.split('\n').map((s) => s.trim()).filter(Boolean)), 3);
      return wrapField({ ...f, help: f.help || '한 줄에 하나씩' }, t);
    }
    case 'links': {
      if (!Array.isArray(obj[f.key])) obj[f.key] = [];
      return wrapField(f, listEditor({
        items: obj[f.key], app, addLabel: '버튼 추가', compact: true,
        title: (b: any) => (b.label || '(글자 없음)') + (b.href ? '' : '  — 연결을 고르면 나타납니다'),
        make: () => ({ label: '새 버튼', href: '', style: 'primary' }),
        body: (b: any) => [
          h('div', { class: 'f' }, h('label', {}, '글자'), textInput(b.label, (x) => { b.label = x; app.changed(); })),
          h('div', { class: 'f' }, h('label', {}, '연결'), linkPicker(b.href, app, (x) => { b.href = x; app.changed(); })),
          h('div', { class: 'f' }, h('label', {}, '모양'), selectEl(b.style || 'primary', BUTTON_STYLES, (x) => { b.style = x; app.changed(); })),
        ],
      }));
    }
    case 'items': {
      if (!Array.isArray(obj[f.key])) obj[f.key] = [];
      const firstText = f.itemFields?.find((x) => x.kind === 'text')?.key;
      return wrapField(f, listEditor({
        items: obj[f.key], app, addLabel: (f.itemLabel || '항목') + ' 추가',
        title: (it: any) => (firstText && it[firstText]) || '',
        make: () => Object.fromEntries((f.itemFields || []).map((x) => [x.key, x.kind === 'toggle' ? false : ''])),
        body: (it: any) => (f.itemFields || []).map((x) => fieldEl(x, it, app)).filter(Boolean) as HTMLElement[],
      }));
    }
    case 'blocks': {
      if (!Array.isArray(obj[f.key])) obj[f.key] = [];
      return wrapField({ ...f, help: RICH_HINT + ' · 목록은 한 줄에 한 항목' }, listEditor({
        items: obj[f.key], app, addLabel: '본문 조각 추가',
        title: (b: any) => (BLOCK_TYPES.find((t) => t.value === b.type)?.label || '') + ' — ' + String(b.text || '').slice(0, 28),
        make: () => ({ type: 'p', text: '' }),
        body: (b: any) => [
          h('div', { class: 'f' }, h('label', {}, '종류'), selectEl(b.type || 'p', BLOCK_TYPES, (x) => { b.type = x; app.changed(true); })),
          h('div', { class: 'f' }, h('label', {}, '내용'), textArea(b.text, (x) => { b.text = x; app.changed(); }, 3)),
        ],
      }));
    }
  }
  return null;
}
