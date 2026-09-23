/* 관리자에서 들어온 글을 HTML 로 옮기는 규칙. 사이트와 미리보기가 같이 쓴다.

   쓰는 사람에게 HTML 을 요구하지 않는다. 받는 표시는 셋뿐이다.
     **굵게**          → <strong>
     [글자](주소)      → 링크. 주소는 page:about, join-form, https://… 등
     줄바꿈            → <br>
   그 밖의 꺾쇠·따옴표는 전부 글자로 나간다. 먼저 중화하고 나서 표시를 해석하므로
   글 안에 태그가 섞여 들어와도 화면 구조가 깨지지 않는다. */

export type LinkResolver = (target: string) => { href: string; external: boolean; pageId?: string };

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** {eventCount} 같은 자리를 실제 값으로. 모르는 이름은 그대로 둔다. */
export function fill(s: unknown, tokens: Record<string, string | number>): string {
  return String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? String(tokens[k]) : m));
}

/** 줄바꿈만 살린다. 제목처럼 줄을 직접 끊는 곳에 쓴다. */
export function lines(s: unknown): string {
  return esc(s).replace(/\r?\n/g, '<br />');
}

export function linkAttrs(r: { href: string; external: boolean; pageId?: string }): string {
  return `href="${r.href}"` +
    (r.external ? ' target="_blank" rel="noopener"' : '') +
    (r.pageId ? ` data-page="${esc(r.pageId)}"` : '');
}

/** 굵게·링크·줄바꿈을 해석한다. */
export function rich(s: unknown, link: LinkResolver): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, target) => {
      // 중화된 글에서 되돌려 해석한다. 따옴표는 &quot; 로 남아 속성을 벗어날 수 없다.
      const r = link(target.replace(/&amp;/g, '&'));
      if (!r.href) return label;
      return `<a ${linkAttrs({ ...r, href: esc(r.href) })}>${label}</a>`;
    })
    .replace(/\r?\n/g, '<br />');
}
