/* GitHub 저장소 읽기·쓰기. 게시는 Git Data API 로 한 번의 커밋에 모두 담는다 —
   글 파일과 새 이미지가 따로따로 커밋되면 빌드가 여러 번 돌고, 중간에 실패하면
   사이트가 반쯤 바뀐 상태로 남는다. 한 커밋이면 전부 바뀌거나 하나도 안 바뀐다. */

export const OWNER = 'jikchaa';
export const REPO = 'yclb';
export const BRANCH = 'main';
export const SITE_PATH = 'src/data/site.json';
export const EVENTS_PATH = 'src/data/events.json';
const K_TOKEN = 'yclb.site.token';

export function token(): string {
  try { return localStorage.getItem(K_TOKEN) || ''; } catch { return ''; }
}
export function setToken(v: string | null) {
  try { v ? localStorage.setItem(K_TOKEN, v) : localStorage.removeItem(K_TOKEN); } catch { /* 저장 못 해도 이번 창에서는 쓴다 */ }
}

async function api(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}) {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (init.auth !== false && token()) headers.Authorization = 'Bearer ' + token();
  if (init.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    method: init.method || 'GET', headers, cache: 'no-store',
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data && (data as any).message) || `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as any;
}

/* 한글이 든 글을 GitHub 이 받는 base64 로. */
export function utf8ToB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64ToUtf8(b64: string): string {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function headCommit(): Promise<string> {
  const ref = await api(`/git/ref/heads/${BRANCH}`);
  return ref.object.sha;
}

export async function readJson(path: string, ref = BRANCH): Promise<{ text: string; sha: string }> {
  const d = await api(`/contents/${path}?ref=${ref}`);
  return { text: b64ToUtf8(d.content), sha: d.sha };
}

const IMG = /\.(webp|jpe?g|png|gif|svg|avif)$/i;

/** public/ 아래의 이미지 전부. 사이트 경로('/posters/a.webp')로 돌려준다. */
export async function listImages(ref = BRANCH): Promise<string[]> {
  const t = await api(`/git/trees/${ref}?recursive=1`);
  return (t.tree || [])
    .filter((n: any) => n.type === 'blob' && n.path.startsWith('public/') && IMG.test(n.path)
      && !n.path.startsWith('public/fonts/'))
    .map((n: any) => n.path.slice('public'.length))
    .sort();
}

export type Change =
  | { path: string; text: string }            // 글 파일
  | { path: string; base64: string }          // 이진 파일 (이미지)
  | { path: string; remove: true };           // 지우기

/** 여러 파일 변경을 커밋 하나로. 성공하면 새 커밋 sha. */
export async function commitChanges(parent: string, changes: Change[], message: string): Promise<string> {
  const base = await api(`/git/commits/${parent}`);
  const entries: any[] = [];
  for (const c of changes) {
    if ('remove' in c) { entries.push({ path: c.path, mode: '100644', type: 'blob', sha: null }); continue; }
    const content = 'text' in c ? utf8ToB64(c.text) : c.base64;
    const blob = await api('/git/blobs', { method: 'POST', body: { content, encoding: 'base64' } });
    entries.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const tree = await api('/git/trees', { method: 'POST', body: { base_tree: base.tree.sha, tree: entries } });
  const commit = await api('/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [parent] } });
  // force 없이 옮긴다. 그 사이 누가 먼저 올렸으면 여기서 거절된다.
  await api(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
  return commit.sha;
}

/** 게시한 커밋의 빌드·배포 상태. 공개 저장소라 토큰 없이 읽는다
    (토큰에 Actions 권한을 따로 줄 필요가 없게). */
export async function deployStatus(sha: string): Promise<{ status: string; conclusion: string | null; url: string } | null> {
  const d = await api(`/actions/runs?head_sha=${sha}&per_page=1`, { auth: false });
  const run = (d.workflow_runs || [])[0];
  return run ? { status: run.status, conclusion: run.conclusion, url: run.html_url } : null;
}
