/* 테마 → CSS 변수. 관리자가 고른 값은 전부 여기를 거쳐 화면에 닿는다. */

import { contrast, isDark, mix } from './color';
import { fontStack } from './fonts';

export type Colors = {
  bg: string; surface: string; band: string;
  accent: string; accentText: string;
  text: string; muted: string; faint: string; line: string;
};

export type Theme = {
  preset: string;
  colors: Colors;
  font: string; headingFont: string;
  baseSize: number; headingScale: number; headingWeight: number; lineHeight: number;
  radius: number; contentWidth: number;
  buttonStyle: 'solid' | 'outline' | 'pill';
  kickerStyle: 'caps' | 'normal';
};

/* 미리 짜 둔 색 조합. 고른 뒤 한 칸씩 바꿀 수 있다. */
export const PRESETS: Record<string, { label: string; colors: Colors }> = {
  charcoal: {
    label: '차콜 — 다크그레이 (기본)',
    colors: {
      bg: '#17171A', surface: '#1F1F23', band: '#4A1519',
      accent: '#C4454D', accentText: '#FFFFFF',
      text: '#EDEBE7', muted: '#A6A39E', faint: '#85827D', line: '#313136',
    },
  },
  graphite: {
    label: '그래파이트 — 밝은 쪽 다크그레이',
    colors: {
      bg: '#232326', surface: '#2B2B2F', band: '#3A3A40',
      accent: '#D0575E', accentText: '#FFFFFF',
      text: '#F0EEEA', muted: '#B0ADA8', faint: '#8E8B86', line: '#3C3C42',
    },
  },
  midnight: {
    label: '미드나잇 — 짙은 남색',
    colors: {
      bg: '#10141C', surface: '#161C27', band: '#1F2A3D',
      accent: '#C9A45C', accentText: '#10141C',
      text: '#E9ECF1', muted: '#9BA5B4', faint: '#7A8494', line: '#263042',
    },
  },
  wine: {
    label: '와인 — 짙은 버건디',
    colors: {
      bg: '#1A0E10', surface: '#241316', band: '#5A171D',
      accent: '#D9A38F', accentText: '#1A0E10',
      text: '#F3E9E6', muted: '#C1A9A4', faint: '#9A817C', line: '#3A2226',
    },
  },
  paper: {
    label: '페이퍼 — 밝은 종이색',
    colors: {
      bg: '#FAF7F2', surface: '#F2EDE5', band: '#4A0E11',
      accent: '#7D1918', accentText: '#FFFFFF',
      text: '#211719', muted: '#5F5254', faint: '#857779', line: '#E3DACD',
    },
  },
  white: {
    label: '화이트 — 미니멀',
    colors: {
      bg: '#FFFFFF', surface: '#F5F5F6', band: '#18181B',
      accent: '#B3262E', accentText: '#FFFFFF',
      text: '#18181B', muted: '#55555C', faint: '#7A7A82', line: '#E4E4E7',
    },
  },
};

export const DEFAULT_THEME: Theme = {
  preset: 'charcoal',
  colors: { ...PRESETS.charcoal.colors },
  font: 'pretendard', headingFont: 'same',
  baseSize: 16, headingScale: 1, headingWeight: 700, lineHeight: 1.75,
  radius: 4, contentWidth: 1120, buttonStyle: 'solid', kickerStyle: 'caps',
};

export function normalizeTheme(t: Partial<Theme> | undefined): Theme {
  const base = { ...DEFAULT_THEME, ...(t || {}) } as Theme;
  base.colors = { ...DEFAULT_THEME.colors, ...((t && t.colors) || {}) };
  return base;
}

/** :root 에 걸 변수. */
export function themeCss(t: Theme): string {
  const c = t.colors;
  const head = t.headingFont && t.headingFont !== 'same' ? t.headingFont : t.font;
  const v: Record<string, string | number> = {
    '--c-bg': c.bg, '--c-surface': c.surface, '--c-band': c.band,
    '--c-accent': c.accent, '--c-accent-text': c.accentText,
    '--c-accent-hover': mix(c.accent, isDark(c.accent) ? '#FFFFFF' : '#000000', 0.14),
    '--c-text': c.text, '--c-muted': c.muted, '--c-faint': c.faint, '--c-line': c.line,
    '--font-body': fontStack(t.font), '--font-head': fontStack(head),
    '--fs': `${t.baseSize}px`, '--lh': t.lineHeight,
    '--hw': t.headingWeight, '--hs': t.headingScale,
    '--radius': `${t.radius}px`,
    '--btn-radius': t.buttonStyle === 'pill' ? '999px' : `${t.radius}px`,
    '--w': `${t.contentWidth}px`,
    '--kicker-transform': t.kickerStyle === 'caps' ? 'uppercase' : 'none',
    '--kicker-spacing': t.kickerStyle === 'caps' ? '0.16em' : '0.02em',
  };
  return ':root{' + Object.entries(v).map(([k, val]) => `${k}:${val}`).join(';') + '}';
}

/* ---------- 구역마다 글자색 정하기 ----------
   구역 배경이 테마 기본 배경이나 면색이면 테마의 글자색을 그대로 쓴다.
   띠·포인트·직접 고른 색·사진 배경이면 그 밝기를 보고 밝은 글자/어두운 글자
   묶음 중 하나를 고른다. 포인트 색이 배경에 묻히면 글자색으로 대신한다. */

const ON_DARK = { text: '#F6F2F0', muted: 'rgba(246,242,240,0.76)', faint: 'rgba(246,242,240,0.58)', line: 'rgba(255,255,255,0.16)', solid: '#F6F2F0' };
const ON_LIGHT = { text: '#1D1819', muted: 'rgba(29,24,25,0.74)', faint: 'rgba(29,24,25,0.56)', line: 'rgba(0,0,0,0.12)', solid: '#1D1819' };

export type Tone = Record<string, string>;

export function toneFor(background: string, t: Theme, custom?: string, hasImage?: boolean): Tone {
  const c = t.colors;
  let bg = c.bg;
  let themed = true;
  if (background === 'surface') bg = c.surface;
  else if (background === 'band') { bg = c.band; themed = false; }
  else if (background === 'accent') { bg = c.accent; themed = false; }
  else if (background === 'custom' && custom) { bg = custom; themed = false; }

  let text = c.text, muted = c.muted, faint = c.faint, line = c.line, solid = c.text;
  if (!themed || hasImage) {
    const p = hasImage || isDark(bg) ? ON_DARK : ON_LIGHT;
    ({ text, muted, faint, line, solid } = p);
  }
  const accentOk = !hasImage && contrast(c.accent, bg) >= 3;
  const btnOk = !hasImage && contrast(c.accent, bg) >= 1.8;
  return {
    '--s-bg': bg,
    '--s-text': text, '--s-muted': muted, '--s-faint': faint, '--s-line': line,
    '--s-accent': accentOk ? c.accent : solid,
    '--s-btn-bg': btnOk ? c.accent : solid,
    '--s-btn-fg': btnOk ? c.accentText : (hasImage || isDark(bg) ? '#141414' : '#FFFFFF'),
    '--s-btn-hover': btnOk ? 'var(--c-accent-hover)' : solid,
  };
}

export function toneStyle(tone: Tone): string {
  return Object.entries(tone).map(([k, v]) => `${k}:${v}`).join(';');
}
