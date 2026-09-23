/* 미리보기. 공개 사이트를 짓는 바로 그 렌더러(render/)와 그 CSS 로 그린다.
   그래서 여기 보이는 것이 게시 후 사이트에 나올 것과 같다. */

import siteCss from '../styles/site.css?raw';
import { renderPage } from '../render';

const BASE = import.meta.env.BASE_URL;

/* 미리보기 안에서만 도는 스크립트: 링크를 눌러도 밖으로 나가지 않고,
   페이지 링크는 관리자에게 "그 페이지 보여 줘" 로, 구역을 누르면 "이 구역 고칠래" 로 전한다. */
const PREVIEW_JS = `<script>
window.__init=function(){
  document.querySelectorAll('.ev-filter').forEach(function(bar){
    if(bar.__bound)return;bar.__bound=1;
    var sec=document.querySelector('[data-sec="'+bar.dataset.for+'"]');if(!sec)return;bar.hidden=false;
    bar.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var want=b.dataset.f;
      bar.querySelectorAll('button').forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});
      sec.querySelectorAll('.card').forEach(function(c){c.hidden=!!want&&c.dataset.program!==want;});
      sec.querySelectorAll('.year').forEach(function(y){y.hidden=!y.querySelector('.card:not([hidden])');});});
  });
};
document.addEventListener('click',function(e){
  if(e.target.closest('.ev-filter'))return;
  var a=e.target.closest('a');
  if(a){e.preventDefault();if(a.dataset.page)parent.postMessage({yclb:'nav',page:a.dataset.page},'*');return;}
  var s=e.target.closest('[data-sec]');if(s)parent.postMessage({yclb:'sec',id:s.dataset.sec},'*');
},true);
window.__init();
</script>`;

const PREVIEW_CSS = `[data-sec]{cursor:pointer}[data-sec].__sel{outline:2px dashed #E0A458;outline-offset:-2px}
[data-sec]:hover{box-shadow:inset 0 0 0 1px rgba(224,164,88,.45)}`;

const stripScripts = (s: string) => s.replace(/<script[\s\S]*?<\/script>/g, '');

export class Preview {
  private frame: HTMLIFrameElement;
  private key = '';
  private loaded = false;

  constructor(frame: HTMLIFrameElement) { this.frame = frame; }

  render(site: any, events: any[], pageId: string, images: Record<string, string>, selected?: string | null) {
    let out;
    try {
      out = renderPage(site, events, pageId, { base: BASE, origin: location.origin, indexable: false, images });
    } catch (e: any) {
      this.frame.srcdoc = `<p style="font:14px sans-serif;padding:2rem;color:#b00">미리보기를 그리지 못했습니다: ${String(e.message || e)}</p>`;
      this.key = ''; return;
    }
    const t = site.theme || {};
    const key = [pageId, t.font, t.headingFont].join('|');
    const bodyClass = t.buttonStyle === 'outline' ? 'bs-outline' : '';
    const doc = this.frame.contentDocument;

    if (this.loaded && key === this.key && doc && doc.body) {
      const y = doc.scrollingElement?.scrollTop || 0;
      const vars = doc.getElementById('theme-vars');
      const fresh = /<style id="theme-vars">([\s\S]*?)<\/style>/.exec(out.head);
      if (vars && fresh) vars.textContent = fresh[1];
      doc.title = out.title;
      doc.body.className = bodyClass;
      doc.body.innerHTML = stripScripts(out.body);
      (this.frame.contentWindow as any)?.__init?.();
      this.mark(selected);
      if (doc.scrollingElement) doc.scrollingElement.scrollTop = y;
      return;
    }

    const y = this.key.split('|')[0] === pageId ? doc?.scrollingElement?.scrollTop || 0 : 0;
    this.loaded = false;
    this.key = key;
    this.frame.onload = () => {
      this.loaded = true;
      const d = this.frame.contentDocument;
      if (d?.scrollingElement) d.scrollingElement.scrollTop = y;
      this.mark(selected);
    };
    this.frame.srcdoc = `<!doctype html><html lang="ko"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />${out.head}` +
      `<style>${siteCss}</style><style>${PREVIEW_CSS}</style></head>` +
      `<body class="${bodyClass}">${stripScripts(out.body)}${PREVIEW_JS}</body></html>`;
  }

  mark(id?: string | null) {
    const d = this.frame.contentDocument;
    if (!d) return;
    d.querySelectorAll('.__sel').forEach((x) => x.classList.remove('__sel'));
    if (id) d.querySelector(`[data-sec="${CSS.escape(id)}"]`)?.classList.add('__sel');
  }

  scrollTo(id: string) {
    const d = this.frame.contentDocument;
    const el = d?.querySelector(`[data-sec="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}
