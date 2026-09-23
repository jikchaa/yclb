/* 공개 사이트에 보이는 글자가 전부 데이터(site.json · events.json)에서 오는지 검사한다.

   방법: 원본 데이터로 한 번, 모든 글자를 한 칸씩 민 데이터(가→각, a→b)로 한 번 짓는다.
   두 결과의 글자 조각을 순서대로 짝지었을 때, 데이터를 바꿨는데도 똑같이 남은 글자가
   있으면 그건 코드에 박혀 있는 글자다 — 관리자에서 고칠 수 없는 글자라는 뜻이다.

   보는 곳: 본문 글자 전부, <title>, 검색·공유 설명, 이미지 대체글(alt).
   숫자·기호만 있는 조각(연도, 날짜, 개수)은 계산값이라 뺀다.

   npm run check:editable */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yclb-check-'));

/* 화면에 글자로 나가지 않는 칸. 주소·색·종류·모양 같은 값이다. */
const SKIP = new Set(['id', 'slug', 'type', 'href', 'buttonHref', 'background', 'bgColor', 'bgImage',
  'paddingTop', 'paddingBottom', 'align', 'width', 'anchor', 'image', 'logo', 'program', 'date',
  'preset', 'font', 'headingFont', 'buttonStyle', 'kickerStyle', 'layout', 'menuStyle', 'height',
  'mode', 'ratio', 'columns', 'cardStyle', 'size', 'joinFormUrl', 'ogImage', 'favicon', 'appleIcon',
  '_readme', 'style', 'link', 'colors']);

/* {자리표시} 와 [글자](주소) 의 주소는 건드리지 않고 글자만 민다. */
function shift(s) {
  let out = '', i = 0;
  while (i < s.length) {
    if (s[i] === '{') { const j = s.indexOf('}', i); if (j > 0) { out += s.slice(i, j + 1); i = j + 1; continue; } }
    if (s[i] === ']' && s[i + 1] === '(') { const j = s.indexOf(')', i); if (j > 0) { out += s.slice(i, j + 1); i = j + 1; continue; } }
    const c = s.charCodeAt(i);
    if (c >= 0xac00 && c <= 0xd7a3) out += String.fromCharCode(c === 0xd7a3 ? 0xac00 : c + 1);
    else if (c >= 97 && c <= 122) out += String.fromCharCode(c === 122 ? 97 : c + 1);
    else if (c >= 65 && c <= 90) out += String.fromCharCode(c === 90 ? 65 : c + 1);
    else out += s[i];
    i++;
  }
  return out;
}

function transform(v, key) {
  if (SKIP.has(key)) return v;
  if (typeof v === 'string') return shift(v);
  if (Array.isArray(v)) return v.map((x) => transform(x, null));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, transform(x, k)]));
  return v;
}

function build(dataDir, outDir) {
  execSync(`npx astro build --outDir "${outDir}"`, {
    cwd: ROOT, stdio: 'pipe',
    env: { ...process.env, SITE_DATA_DIR: dataDir, SITE_URL: 'https://example.com', SITE_BASE: '/', SITE_INDEX: '1' },
  });
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', larr: '←', mdash: '—', middot: '·', copy: '©' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);

/* 글자 조각을 문서 순서대로. <script>·<style> 안은 뺀다. */
function pieces(html) {
  const out = [];
  const clean = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  for (const m of clean.matchAll(/<title>([\s\S]*?)<\/title>/g)) out.push(['title', m[1]]);
  for (const m of clean.matchAll(/<meta (?:name|property)="(description|og:title|og:description)" content="([^"]*)"/g)) out.push([m[1], m[2]]);
  for (const m of clean.matchAll(/\balt="([^"]*)"/g)) out.push(['alt', m[1]]);
  const body = clean.slice(clean.indexOf('<body'));
  for (const t of body.split(/<[^>]+>/)) out.push(['text', t]);
  return out.map(([k, v]) => [k, decode(v).replace(/\s+/g, ' ').trim()]).filter(([, v]) => v);
}

const hasLetters = (s) => /[A-Za-zㄱ-ㆎ가-힣]/.test(s);

/* ---- 실행 ---- */
const src = path.join(ROOT, 'src/data');
const alt = path.join(tmp, 'data');
fs.mkdirSync(alt);
for (const f of ['site.json', 'events.json']) {
  fs.writeFileSync(path.join(alt, f), JSON.stringify(transform(JSON.parse(fs.readFileSync(path.join(src, f), 'utf8')), null), null, 2));
}

process.stdout.write('원본 데이터로 짓는 중… ');
build(src, path.join(tmp, 'a'));
process.stdout.write('글자를 민 데이터로 짓는 중… ');
build(alt, path.join(tmp, 'b'));
console.log('비교');

const pagesOf = (d) => fs.readdirSync(d, { recursive: true })
  .filter((f) => f.endsWith('.html') && !f.startsWith('admin')).sort();

let problems = 0, checked = 0;
for (const f of pagesOf(path.join(tmp, 'a'))) {
  const A = pieces(fs.readFileSync(path.join(tmp, 'a', f), 'utf8'));
  const B = pieces(fs.readFileSync(path.join(tmp, 'b', f), 'utf8'));
  if (A.length !== B.length) {
    console.log(`✗ ${f}: 조각 수가 다릅니다 (${A.length} ≠ ${B.length}) — 구조가 데이터 글자에 따라 바뀝니다`);
    problems++; continue;
  }
  const stuck = A.filter(([k, v], i) => hasLetters(v) && v === B[i][1]).map(([k, v]) => `${k}: "${v}"`);
  checked += A.filter(([, v]) => hasLetters(v)).length;
  if (stuck.length) { problems += stuck.length; console.log(`✗ ${f}\n    ` + [...new Set(stuck)].join('\n    ')); }
  else console.log(`✓ ${f}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n글자 조각 ${checked}개 검사 · 코드에 박힌 글자 ${problems}건`);
process.exit(problems ? 1 : 0);
