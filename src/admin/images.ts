/* 이미지 고르기 · 올리기 · 자르기.
   올린 이미지는 게시 전까지 이 브라우저에만 있다(미리보기에는 바로 보인다).
   [게시]를 누르면 글 변경과 함께 한 커밋으로 public/uploads/ 에 들어간다. */

import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { h, modal, toast } from './ui';

export type Staged = { base64: string; dataUrl: string; bytes: number };

export const RATIO_CHOICES: { label: string; value: number | null; key: string }[] = [
  { key: 'free', label: '자유', value: null },
  { key: '16:9', label: '16:9', value: 16 / 9 },
  { key: '4:3', label: '4:3', value: 4 / 3 },
  { key: '1:1', label: '1:1', value: 1 },
  { key: '4:5', label: '4:5', value: 4 / 5 },
  { key: '3:4', label: '3:4', value: 3 / 4 },
  { key: '21:9', label: '21:9', value: 21 / 9 },
  { key: 'og', label: '공유용 1.91:1', value: 1200 / 630 },
];

/* 무엇에 쓰는 이미지인가에 따라 저장 형식과 크기가 다르다. */
export type Purpose = 'photo' | 'logo' | 'og' | 'icon';
const OUT: Record<Purpose, { type: string; ext: string; max: number; exact?: [number, number] }> = {
  photo: { type: 'image/webp', ext: 'webp', max: 1920 },
  logo: { type: 'image/png', ext: 'png', max: 1200 },          // 투명 배경을 지키려고 PNG
  og: { type: 'image/jpeg', ext: 'jpg', max: 1200, exact: [1200, 630] }, // 카톡·인스타가 확실히 읽는 형식
  icon: { type: 'image/png', ext: 'png', max: 512, exact: [512, 512] },
};

function slugify(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return base || 'image';
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(b); });
}

function canvasBlob(c: HTMLCanvasElement, type: string, q?: number): Promise<Blob> {
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('이미지를 만들지 못했습니다'))), type, q));
}

/** 자르기 창을 열고, 확인하면 {경로, 파일} 을 돌려준다. 취소하면 null. */
export function cropDialog(src: string, opts: { name: string; ratio?: string; purpose?: Purpose }):
  Promise<{ path: string; file: Staged } | null> {
  const purpose = opts.purpose || 'photo';
  const out = OUT[purpose];
  const initialKey = purpose === 'og' ? 'og' : purpose === 'icon' ? '1:1'
    : (RATIO_CHOICES.find((r) => r.key === opts.ratio)?.key || 'free');

  return new Promise((resolve) => {
    const img = h('img', { src, alt: '', class: 'crop-img', crossorigin: 'anonymous' }) as HTMLImageElement;
    const info = h('p', { class: 'crop-info' }, '');
    const ratioBar = h('div', { class: 'seg' });
    let cropper: Cropper | null = null;
    let current = initialKey;

    const locked = purpose === 'og' || purpose === 'icon';
    RATIO_CHOICES.forEach((r) => {
      if (locked && r.key !== initialKey) return;
      const b = h('button', { type: 'button', class: r.key === current ? 'on' : '' }, r.label);
      b.addEventListener('click', () => {
        current = r.key;
        ratioBar.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        cropper?.setAspectRatio(r.value ?? NaN);
      });
      ratioBar.appendChild(b);
    });

    const tools = h('div', { class: 'crop-tools' },
      btn('↺', '왼쪽으로 돌리기', () => cropper?.rotate(-90)),
      btn('↻', '오른쪽으로 돌리기', () => cropper?.rotate(90)),
      btn('+', '확대', () => cropper?.zoom(0.1)),
      btn('−', '축소', () => cropper?.zoom(-0.1)),
      btn('초기화', '처음 상태로', () => cropper?.reset()));

    const m = modal({
      title: '이미지 자르기',
      wide: true,
      body: [h('div', { class: 'crop-stage' }, img), ratioBar, tools, info,
        h('p', { class: 'help' }, purpose === 'logo'
          ? '로고는 투명 배경을 지키려고 PNG 로 저장합니다.'
          : purpose === 'og' ? '카카오톡·인스타 공유 미리보기용. 1200×630 JPG 로 저장합니다.'
          : purpose === 'icon' ? '브라우저 탭 아이콘. 512×512 PNG 로 저장합니다.'
          : '긴 변 1920px 이하 WebP 로 줄여 저장합니다. 원본보다 훨씬 가볍습니다.')],
      actions: [
        { label: '취소', onClick: () => { m.close(); resolve(null); } },
        { label: '이대로 쓰기', primary: true, onClick: async () => {
          if (!cropper) return;
          try {
            const res = await exportCrop(cropper, out, opts.name);
            m.close();
            resolve(res);
          } catch (e: any) { toast(e.message || String(e), 'bad'); }
        } },
      ],
      onClose: () => resolve(null),
    });

    img.addEventListener('load', () => {
      const v = RATIO_CHOICES.find((r) => r.key === initialKey)?.value ?? NaN;
      cropper = new Cropper(img, {
        viewMode: 1, aspectRatio: v, autoCropArea: 1, background: false, responsive: true,
        crop(e) {
          info.textContent = `선택 영역 ${Math.round(e.detail.width)} × ${Math.round(e.detail.height)} px`;
        },
      });
    }, { once: true });
    img.addEventListener('error', () => { toast('이미지를 불러오지 못했습니다.', 'bad'); m.close(); resolve(null); }, { once: true });
  });
}

function btn(label: string, title: string, fn: () => void) {
  const b = h('button', { type: 'button', title, class: 'btn-sm' }, label);
  b.addEventListener('click', fn);
  return b;
}

async function exportCrop(cropper: Cropper, out: (typeof OUT)[Purpose], name: string) {
  const data = cropper.getData(true);
  let w = data.width, hgt = data.height;
  if (out.exact) { [w, hgt] = out.exact; }
  else {
    const k = Math.min(1, out.max / Math.max(w, hgt));
    w = Math.round(w * k); hgt = Math.round(hgt * k);
  }
  const canvas = cropper.getCroppedCanvas({
    width: w, height: hgt, imageSmoothingEnabled: true, imageSmoothingQuality: 'high',
    fillColor: out.type === 'image/jpeg' ? '#000' : 'transparent',
  });

  // WebP 를 못 만드는 브라우저(구형 사파리)는 PNG 를 내놓는다. 그때는 JPG 로 바꾼다.
  let type = out.type, ext = out.ext, q = 0.86;
  let blob = await canvasBlob(canvas, type, q);
  if (type === 'image/webp' && blob.type !== 'image/webp') {
    type = 'image/jpeg'; ext = 'jpg';
    blob = await canvasBlob(canvas, type, q);
  }
  // 너무 무거우면 품질을 낮춘다. 사진 한 장이 페이지 전체보다 무거울 이유가 없다.
  while (blob.size > 900_000 && q > 0.5 && type !== 'image/png') {
    q -= 0.08;
    blob = await canvasBlob(canvas, type, q);
  }
  const dataUrl = await blobToDataUrl(blob);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const rand = Math.random().toString(36).slice(2, 7);
  return { path: `/uploads/${slugify(name)}-${rand}.${ext}`, file: { base64, dataUrl, bytes: blob.size } };
}

/** 파일 고르기 창. */
export function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept: 'image/*' }) as HTMLInputElement;
    input.addEventListener('change', () => resolve(input.files?.[0] || null), { once: true });
    input.click();
  });
}

export function fileToDataUrl(f: File): Promise<string> { return blobToDataUrl(f); }
