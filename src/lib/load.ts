/* 빌드 때 데이터 읽기. SITE_DATA_DIR 로 다른 폴더를 가리킬 수 있게 해 두었다 —
   검증 스크립트가 표지를 단 복사본으로 사이트를 지어 보는 데 쓴다. */
import fs from 'node:fs';
import path from 'node:path';

const dir = () => path.resolve(process.env.SITE_DATA_DIR || 'src/data');

export function loadSite(): any {
  return JSON.parse(fs.readFileSync(path.join(dir(), 'site.json'), 'utf8'));
}
export function loadEvents(): any[] {
  return JSON.parse(fs.readFileSync(path.join(dir(), 'events.json'), 'utf8')).events || [];
}
