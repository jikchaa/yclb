/* 작은 DOM 도구. 관리자 화면은 프레임워크 없이 이 몇 개로 그린다. */

type Child = Node | string | null | undefined | false | Child[];

export function h(tag: string, attrs: Record<string, any> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string') (el as any)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (c: Child) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(add); return; }
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  };
  children.forEach(add);
  return el;
}

export function modal(o: {
  title: string; body: Child; wide?: boolean;
  actions?: { label: string; primary?: boolean; danger?: boolean; onClick: () => void }[];
  onClose?: () => void;
}) {
  const dlg = h('dialog', { class: 'dlg' + (o.wide ? ' wide' : '') }) as HTMLDialogElement;
  let closed = false;
  const close = () => { if (closed) return; closed = true; dlg.close(); dlg.remove(); };
  dlg.appendChild(h('div', { class: 'dlg-head' }, h('h2', {}, o.title),
    h('button', { type: 'button', class: 'x', 'aria-label': '닫기', onclick: () => { close(); o.onClose?.(); } }, '×')));
  dlg.appendChild(h('div', { class: 'dlg-body' }, o.body));
  if (o.actions?.length) {
    dlg.appendChild(h('div', { class: 'dlg-foot' }, o.actions.map((a) =>
      h('button', { type: 'button', class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), onclick: a.onClick }, a.label))));
  }
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); o.onClose?.(); });
  document.body.appendChild(dlg);
  dlg.showModal();
  return { el: dlg, close };
}

export function ask(message: string, ok = '계속', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const m = modal({
      title: '확인', body: h('p', { class: 'ask' }, message),
      actions: [
        { label: '취소', onClick: () => { m.close(); resolve(false); } },
        { label: ok, primary: !danger, danger, onClick: () => { m.close(); resolve(true); } },
      ],
      onClose: () => resolve(false),
    });
  });
}

let toastTimer: number | undefined;
export function toast(message: string, kind: 'ok' | 'bad' | 'info' = 'info') {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(el); }
  el.textContent = message;
  el.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 3600);
}

export function uid(prefix: string) {
  return prefix + '-' + Math.random().toString(36).slice(2, 8);
}

export function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

/** 배열 안에서 한 칸 옮기기. */
export function move<T>(arr: T[], i: number, d: number): boolean {
  const j = i + d;
  if (j < 0 || j >= arr.length) return false;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return true;
}
