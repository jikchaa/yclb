/* 사이트의 글은 전부 content.json 에 있다. 관리자 화면(/admin/)이 그 파일을
   고치고, 고쳐진 파일이 main 에 올라가면 Actions 가 사이트를 다시 짓는다.
   여기서는 읽어서 이름을 붙여 줄 뿐이다 — 문구를 이 파일에 적지 않는다. */

import content from './content.json';

export const site = {
  ...content.brand,
  joinFormUrl: content.joinFormUrl,
};

export const home = content.home;
export const programs = content.programs;
export const about = content.about;

/* 랜딩과 /join 이 같은 절차 문장을 쓴다. */
export const joinSteps = content.home.membership.steps;

export const nav = [
  { href: '/about', label: 'About' },
  { href: '/programs', label: 'Programs' },
  { href: '/events', label: 'Events' },
  { href: '/join', label: 'Join' },
] as const;
