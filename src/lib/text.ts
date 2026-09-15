/* 관리자 화면에서 들어오는 글을 화면에 올릴 때 쓰는 두 가지.

   글을 쓰는 사람에게 HTML 을 요구할 수는 없으므로, 줄바꿈과 굵게만 받는다.
   원문은 이 저장소 안에 있고 관리자 화면은 토큰을 가진 사람만 저장할 수 있으니
   바깥에서 들어온 글이 아니다 — 그래도 태그가 섞여 들어와 화면이 깨지는 일은
   막아야 하므로, 굵게로 바꾸기 전에 <, >, & 를 먼저 중화한다. */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `**굵게**` 만 해석한다. 나머지는 글자 그대로 나간다. */
export function rich(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** 줄바꿈을 <br> 로. 제목처럼 줄을 직접 끊고 싶은 곳에 쓴다. */
export function lines(s: string): string {
  return escapeHtml(s).replace(/\n/g, '<br />');
}

/** {since} · {month} 같은 자리를 실제 값으로 채운다. */
export function fill(s: string, values: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m));
}
