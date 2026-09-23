/* 고를 수 있는 글꼴. 모두 한글·영문·숫자·기호를 한 글꼴 안에 갖춘 것만 넣었다.
   한 줄 안에서 한글과 영문이 서로 다른 글꼴로 갈라지면 굵기와 높이가 어긋나
   글자가 깨져 보인다 — 예전 사이트가 그 문제였다. */

export type FontDef = {
  label: string;
  family: string;
  kind: 'sans' | 'serif';
  self?: string;     // 이 사이트가 직접 내보내는 CSS
  google?: string;   // Google Fonts css2 의 family= 값
};

export const FONTS: Record<string, FontDef> = {
  pretendard: {
    label: 'Pretendard — 기본, 화면용 고딕 (추천)',
    family: "'Pretendard Variable', Pretendard",
    kind: 'sans',
    self: '/fonts/pretendard/pretendardvariable-dynamic-subset.css',
  },
  'noto-sans-kr': {
    label: 'Noto Sans KR — 담백한 고딕',
    family: "'Noto Sans KR'",
    kind: 'sans',
    google: 'Noto+Sans+KR:wght@300;400;500;700;900',
  },
  'ibm-plex-sans-kr': {
    label: 'IBM Plex Sans KR — 단정한 고딕',
    family: "'IBM Plex Sans KR'",
    kind: 'sans',
    google: 'IBM+Plex+Sans+KR:wght@300;400;500;600;700',
  },
  'noto-serif-kr': {
    label: 'Noto Serif KR — 명조, 격식 있는 인상',
    family: "'Noto Serif KR'",
    kind: 'serif',
    google: 'Noto+Serif+KR:wght@400;500;600;700;900',
  },
  'gowun-batang': {
    label: '고운바탕 — 부드러운 명조',
    family: "'Gowun Batang'",
    kind: 'serif',
    google: 'Gowun+Batang:wght@400;700',
  },
  'nanum-myeongjo': {
    label: '나눔명조 — 고전적인 명조',
    family: "'Nanum Myeongjo'",
    kind: 'serif',
    google: 'Nanum+Myeongjo:wght@400;700;800',
  },
};

const FALLBACK = {
  sans: "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', system-ui, sans-serif",
  serif: "'AppleMyungjo', 'Batang', 'Noto Serif KR', serif",
};

export function fontStack(id: string): string {
  const f = FONTS[id] || FONTS.pretendard;
  return `${f.family}, ${FALLBACK[f.kind]}`;
}

/** <head> 에 넣을 글꼴 불러오기. 본문·제목 글꼴이 같으면 한 번만. */
export function fontLinks(ids: string[], url: (p: string) => string): string {
  const uniq = [...new Set(ids.filter((id) => FONTS[id]))];
  const out: string[] = [];
  const google = uniq.map((id) => FONTS[id].google).filter(Boolean) as string[];
  for (const id of uniq) {
    const f = FONTS[id];
    if (f.self) out.push(`<link rel="stylesheet" href="${url(f.self)}" />`);
  }
  if (google.length) {
    out.push('<link rel="preconnect" href="https://fonts.googleapis.com" />');
    out.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />');
    out.push(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${google
      .map((g) => 'family=' + g).join('&amp;')}&amp;display=swap" />`);
  }
  return out.join('\n');
}
