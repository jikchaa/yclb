/* 섹션 종류와 각 종류가 받는 칸. 관리자 화면은 이 표를 보고 입력칸을 그리고,
   렌더러는 빠진 칸을 이 표의 기본값으로 채운다. 한 표를 둘이 같이 보므로
   "관리자에 있는 칸인데 사이트에 안 나온다" 가 생기지 않는다. */

export type Field = {
  key: string;
  label: string;
  kind: 'text' | 'area' | 'rich' | 'links' | 'image' | 'select' | 'toggle' | 'number'
      | 'items' | 'blocks' | 'tags' | 'program' | 'link' | 'color';
  help?: string;
  options?: { value: string; label: string }[];
  min?: number; max?: number; step?: number;
  ratio?: string;              // 이미지 칸의 권장 자르기 비율
  itemFields?: Field[];        // items 의 한 줄에 들어가는 칸
  itemLabel?: string;
  showIf?: (s: any) => boolean;
};

export type SectionType = {
  type: string;
  label: string;
  desc: string;
  fields: Field[];
  defaults: Record<string, any>;
};

const RATIOS = [
  { value: '16:9', label: '16:9 가로' }, { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1 정사각' }, { value: '4:5', label: '4:5 세로' },
  { value: '3:4', label: '3:4 세로' }, { value: '21:9', label: '21:9 와이드' },
];

const HEAD: Field[] = [
  { key: 'kicker', label: '작은 라벨', kind: 'text', help: '제목 위 작은 글씨. 비우면 안 나옵니다.' },
  { key: 'title', label: '제목', kind: 'area', help: '줄을 바꾸면 화면에서도 줄이 바뀝니다.' },
  { key: 'text', label: '설명', kind: 'rich' },
];

const BUTTONS: Field = { key: 'buttons', label: '버튼', kind: 'links' };

export const SECTION_TYPES: SectionType[] = [
  {
    type: 'hero', label: '큰 제목 (히어로)', desc: '페이지 맨 위의 큰 제목 구역',
    fields: [
      ...HEAD.slice(0, 2),
      { key: 'subtitle', label: '부제', kind: 'text' },
      HEAD[2],
      BUTTONS,
      { key: 'size', label: '높이', kind: 'select', options: [
        { value: 'compact', label: '낮게' }, { value: 'normal', label: '보통' },
        { value: 'tall', label: '높게' }, { value: 'full', label: '화면 가득' }] },
      { key: 'showLogo', label: '제목 위에 로고 크게 보이기', kind: 'toggle' },
      { key: 'logoHeight', label: '로고 높이(px)', kind: 'number', min: 24, max: 240, step: 4,
        showIf: (s) => s.showLogo },
    ],
    defaults: { kicker: '', title: '새 제목', subtitle: '', text: '', buttons: [],
      size: 'normal', showLogo: false, logoHeight: 64 },
  },
  {
    type: 'text', label: '글 (문단·인용·목록)', desc: '긴 글. 문단, 소제목, 인용, 목록, 강조, 안내 상자를 쌓습니다.',
    fields: [...HEAD.slice(0, 2),
      { key: 'blocks', label: '본문', kind: 'blocks' }, BUTTONS],
    defaults: { kicker: '', title: '', blocks: [{ type: 'p', text: '' }], buttons: [] },
  },
  {
    type: 'features', label: '특징 카드', desc: '제목·설명이 있는 카드 여러 개',
    fields: [...HEAD,
      { key: 'items', label: '카드', kind: 'items', itemLabel: '카드', itemFields: [
        { key: 'title', label: '제목', kind: 'text' },
        { key: 'text', label: '설명', kind: 'rich' },
        { key: 'image', label: '이미지 (선택)', kind: 'image', ratio: '16:9' }] },
      { key: 'columns', label: '한 줄에', kind: 'select', options: [
        { value: '2', label: '2개' }, { value: '3', label: '3개' }, { value: '4', label: '4개' }] },
      { key: 'cardStyle', label: '모양', kind: 'select', options: [
        { value: 'line', label: '윗선' }, { value: 'card', label: '상자' }, { value: 'plain', label: '선 없음' }] },
      BUTTONS],
    defaults: { kicker: '', title: '', text: '', items: [{ title: '', text: '', image: '' }],
      columns: 3, cardStyle: 'line', buttons: [] },
  },
  {
    type: 'stats', label: '숫자', desc: '숫자 칸과 태그. {eventCount} 같은 자리표시는 자동으로 계산됩니다.',
    fields: [...HEAD,
      { key: 'items', label: '숫자 칸', kind: 'items', itemLabel: '칸', itemFields: [
        { key: 'label', label: '이름', kind: 'text' },
        { key: 'value', label: '값', kind: 'text', help: '{eventCount} {placeCount} {programCount} {since} 를 쓰면 자동 계산' },
        { key: 'unit', label: '단위', kind: 'text' }] },
      { key: 'tags', label: '태그 (한 줄에 하나)', kind: 'tags' },
      BUTTONS],
    defaults: { kicker: '', title: '', text: '', items: [], tags: [], buttons: [] },
  },
  {
    type: 'events', label: '이벤트 목록', desc: '이벤트 기록을 카드로. 최근 몇 건만 또는 전체.',
    fields: [...HEAD,
      { key: 'mode', label: '무엇을', kind: 'select', options: [
        { value: 'recent', label: '최근 순' }, { value: 'all', label: '전체' },
        { value: 'upcoming', label: '다가오는 것만 (게시 시점 기준)' }, { value: 'past', label: '지난 것만' }] },
      { key: 'limit', label: '최대 개수 (0 = 전부)', kind: 'number', min: 0, max: 200, step: 1 },
      { key: 'program', label: '프로그램 한정', kind: 'program' },
      { key: 'groupByYear', label: '연도별로 묶기', kind: 'toggle' },
      { key: 'showFilter', label: '프로그램 필터 탭 보이기', kind: 'toggle' },
      { key: 'filterAllLabel', label: '필터 "전체" 글자', kind: 'text', showIf: (s) => s.showFilter },
      { key: 'ratio', label: '이미지 비율', kind: 'select', options: RATIOS },
      { key: 'columns', label: '한 줄에', kind: 'select', options: [
        { value: '2', label: '2개' }, { value: '3', label: '3개' }, { value: '4', label: '4개' }] },
      { key: 'showDate', label: '날짜 보이기', kind: 'toggle' },
      { key: 'showPlace', label: '장소 보이기', kind: 'toggle' },
      { key: 'emptyText', label: '기록이 없을 때 문구', kind: 'text' },
      BUTTONS],
    defaults: { kicker: '', title: '', text: '', mode: 'recent', limit: 6, program: '',
      groupByYear: false, showFilter: false, filterAllLabel: '전체', ratio: '16:9', columns: '3',
      showDate: true, showPlace: true, emptyText: '아직 기록이 없습니다.', buttons: [] },
  },
  {
    type: 'programs', label: '프로그램', desc: '[프로그램] 탭의 목록을 보여 줍니다.',
    fields: [...HEAD,
      { key: 'layout', label: '모양', kind: 'select', options: [
        { value: 'list', label: '줄 목록 (간단)' }, { value: 'cards', label: '카드' },
        { value: 'detailed', label: '자세히 (이미지 + 최근 기록)' }] },
      { key: 'showCount', label: '개최 횟수 보이기', kind: 'toggle' },
      { key: 'countText', label: '횟수 문구', kind: 'rich', help: '{count} 가 횟수로 바뀝니다.', showIf: (s) => s.showCount },
      { key: 'showRecent', label: '최근 기록 보이기', kind: 'toggle', showIf: (s) => s.layout === 'detailed' },
      { key: 'recentLimit', label: '최근 기록 개수', kind: 'number', min: 1, max: 10, step: 1,
        showIf: (s) => s.layout === 'detailed' && s.showRecent },
      BUTTONS],
    defaults: { kicker: '', title: '', text: '', layout: 'list', showCount: false,
      countText: '지금까지 **{count}**회 열렸습니다.', showRecent: false, recentLimit: 4, buttons: [] },
  },
  {
    type: 'names', label: '이름 목록', desc: '셰프·연사처럼 이름과 한 줄 설명',
    fields: [...HEAD,
      { key: 'items', label: '이름', kind: 'items', itemLabel: '이름', itemFields: [
        { key: 'name', label: '이름', kind: 'text' }, { key: 'sub', label: '한 줄 설명', kind: 'text' }] },
      BUTTONS],
    defaults: { kicker: '', title: '', text: '', items: [{ name: '', sub: '' }], buttons: [] },
  },
  {
    type: 'steps', label: '단계', desc: '1·2·3 처럼 순서가 있는 절차',
    fields: [...HEAD,
      { key: 'items', label: '단계', kind: 'items', itemLabel: '단계', itemFields: [
        { key: 'title', label: '단계 이름', kind: 'text' }, { key: 'text', label: '설명', kind: 'rich' }] },
      { key: 'numbered', label: '번호 붙이기', kind: 'toggle' },
      BUTTONS],
    defaults: { kicker: '', title: '', text: '', items: [{ title: '', text: '' }], numbered: true, buttons: [] },
  },
  {
    type: 'apply', label: '신청 상자', desc: '왼쪽에 절차, 오른쪽에 신청 버튼 상자',
    fields: [...HEAD,
      { key: 'stepsTitle', label: '절차 제목', kind: 'text' },
      { key: 'steps', label: '절차', kind: 'items', itemLabel: '단계', itemFields: [
        { key: 'title', label: '단계 이름', kind: 'text' }, { key: 'text', label: '설명', kind: 'rich' }] },
      { key: 'note', label: '절차 아래 안내', kind: 'rich' },
      { key: 'boxTitle', label: '상자 문구', kind: 'text' },
      { key: 'buttonLabel', label: '버튼 글자', kind: 'text' },
      { key: 'buttonHref', label: '버튼 연결', kind: 'link' },
      { key: 'emptyText', label: '연결 주소가 비었을 때 문구', kind: 'rich' }],
    defaults: { kicker: '', title: '', text: '', stepsTitle: '절차', steps: [], note: '',
      boxTitle: '', buttonLabel: '신청하기', buttonHref: 'join-form', emptyText: '' },
  },
  {
    type: 'cta', label: '행동 유도 띠', desc: '짧은 문구와 버튼',
    fields: [...HEAD, BUTTONS],
    defaults: { kicker: '', title: '', text: '', buttons: [] },
  },
  {
    type: 'image', label: '이미지 한 장', desc: '사진이나 포스터 한 장과 설명',
    fields: [
      { key: 'image', label: '이미지', kind: 'image', ratio: '16:9' },
      { key: 'ratio', label: '비율', kind: 'select', options: [{ value: 'original', label: '원본 그대로' }, ...RATIOS] },
      { key: 'caption', label: '설명 (선택)', kind: 'rich' },
      { key: 'link', label: '누르면 이동 (선택)', kind: 'link' }],
    defaults: { image: '', ratio: 'original', caption: '', link: '' },
  },
  {
    type: 'gallery', label: '갤러리', desc: '이미지 여러 장을 격자로',
    fields: [...HEAD.slice(0, 2),
      { key: 'items', label: '이미지', kind: 'items', itemLabel: '이미지', itemFields: [
        { key: 'image', label: '이미지', kind: 'image', ratio: '1:1' },
        { key: 'caption', label: '설명 (선택)', kind: 'text' }] },
      { key: 'columns', label: '한 줄에', kind: 'select', options: [
        { value: '2', label: '2개' }, { value: '3', label: '3개' }, { value: '4', label: '4개' }] },
      { key: 'ratio', label: '비율', kind: 'select', options: RATIOS }],
    defaults: { kicker: '', title: '', items: [], columns: '3', ratio: '1:1' },
  },
  {
    type: 'chips', label: '태그 목록', desc: '장소·키워드를 작은 조각으로',
    fields: [...HEAD, { key: 'items', label: '태그 (한 줄에 하나)', kind: 'tags' }],
    defaults: { kicker: '', title: '', text: '', items: [] },
  },
  {
    type: 'divider', label: '구분선 · 여백', desc: '구역 사이 선이나 빈 공간',
    fields: [{ key: 'line', label: '선 보이기', kind: 'toggle' }],
    defaults: { line: true },
  },
];

export const TYPE_BY_ID: Record<string, SectionType> =
  Object.fromEntries(SECTION_TYPES.map((t) => [t.type, t]));

/* 모든 섹션이 공통으로 받는 모양 칸. */
export const STYLE_FIELDS: Field[] = [
  { key: 'background', label: '배경', kind: 'select', options: [
    { value: 'default', label: '기본 배경' }, { value: 'surface', label: '면 (살짝 다른 톤)' },
    { value: 'band', label: '띠 (강조 배경)' }, { value: 'accent', label: '포인트 색' },
    { value: 'custom', label: '직접 고르기' }] },
  { key: 'bgColor', label: '배경색', kind: 'color', showIf: (st) => st.background === 'custom' },
  { key: 'bgImage', label: '배경 사진 (선택)', kind: 'image', ratio: '16:9' },
  { key: 'overlay', label: '사진 어둡게 (%)', kind: 'number', min: 0, max: 90, step: 5, showIf: (st) => !!st.bgImage },
  { key: 'paddingTop', label: '위 여백', kind: 'select', options: SPACE() },
  { key: 'paddingBottom', label: '아래 여백', kind: 'select', options: SPACE() },
  { key: 'align', label: '정렬', kind: 'select', options: [
    { value: 'left', label: '왼쪽' }, { value: 'center', label: '가운데' }] },
  { key: 'width', label: '내용 폭', kind: 'select', options: [
    { value: 'narrow', label: '좁게 (글 읽기용)' }, { value: 'normal', label: '보통' }, { value: 'wide', label: '넓게' }] },
  { key: 'anchor', label: '앵커 이름 (선택)', kind: 'text', help: '#앵커 로 이 구역에 바로 연결할 수 있습니다. 영문·숫자·- 만.' },
];

function SPACE() {
  return [{ value: 'none', label: '없음' }, { value: 'small', label: '작게' },
    { value: 'normal', label: '보통' }, { value: 'large', label: '크게' }];
}

export const DEFAULT_STYLE = {
  background: 'default', bgColor: '', bgImage: '', overlay: 50,
  paddingTop: 'normal', paddingBottom: 'normal', align: 'left', width: 'normal', anchor: '',
};

export const BLOCK_TYPES = [
  { value: 'p', label: '문단' }, { value: 'h', label: '소제목' }, { value: 'quote', label: '인용' },
  { value: 'list', label: '목록 (한 줄에 한 항목)' }, { value: 'lead', label: '강조 맺음말' },
  { value: 'note', label: '안내 상자' },
];

export const BUTTON_STYLES = [
  { value: 'primary', label: '채운 버튼' }, { value: 'secondary', label: '테두리 버튼' },
  { value: 'text', label: '글자 링크' },
];

/** 빠진 칸을 기본값으로 채운다. 예전 데이터나 새 칸이 생겨도 깨지지 않게. */
export function withDefaults<T extends Record<string, any>>(sec: T): T {
  const def = TYPE_BY_ID[sec.type]?.defaults || {};
  return { ...def, ...sec, style: { ...DEFAULT_STYLE, ...(sec.style || {}) } } as T;
}

export function newSection(type: string): Record<string, any> {
  const def = TYPE_BY_ID[type];
  return {
    id: type + '-' + Math.random().toString(36).slice(2, 8),
    type, visible: true,
    style: { ...DEFAULT_STYLE },
    ...JSON.parse(JSON.stringify(def?.defaults || {})),
  };
}

/* 자리표시 설명. 관리자 도움말에 쓴다. */
export const TOKENS = [
  ['{eventCount}', '공개된 이벤트 수'], ['{placeCount}', '다녀온 장소 수'],
  ['{programCount}', '프로그램 수'], ['{since}', '첫 모임 연도'],
  ['{sinceMonth}', '첫 모임 달'], ['{latestYear}', '최근 모임 연도'], ['{year}', '올해'],
];
