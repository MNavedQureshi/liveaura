// Orbital Console — design tokens with cream-premium light + rich dark

const LIGHT = {
  // Warm cream palette — paper, ivory, champagne
  bg:        '#F7F3EA',       // warm cream canvas
  surface:   '#FDFBF5',       // ivory panels (slightly warmer than white)
  surfaceAlt:'#EFE9DA',       // soft champagne rows/hover
  surfaceHi: '#FAF6EC',

  border:    '#E4DBC5',
  borderSoft:'#EDE5D0',
  borderHi:  '#CEC2A4',

  ink:       '#2A231A',        // espresso
  ink2:      '#554937',        // warm graphite
  ink3:      '#8C7F64',        // muted bronze
  ink4:      '#B5A98B',

  primary:   '#3F3A8C',        // deep indigo — richer, premium
  primaryHi: '#332E75',
  primaryInk:'#FDFBF5',
  primarySoft:'#E5E0F5',
  primarySoftInk:'#2C2773',

  accent:    '#B08D57',        // champagne gold
  accentSoft:'#F1E4CB',

  green:     '#4F7A4A',
  greenSoft: '#DFEBD8',
  greenInk:  '#2F4A2C',

  amber:     '#B87D1F',
  amberSoft: '#F3E2C0',
  amberInk:  '#7A4F0E',

  red:       '#B64242',
  redSoft:   '#F3D9D4',
  redInk:    '#842828',

  blue:      '#3C5C80',
  blueSoft:  '#DBE3ED',
  blueInk:   '#243B54',

  shadow1:   '0 1px 2px rgba(74,56,24,0.06)',
  shadow2:   '0 1px 3px rgba(74,56,24,0.08), 0 1px 2px rgba(74,56,24,0.05)',
  shadowMd:  '0 4px 10px -2px rgba(74,56,24,0.12), 0 2px 4px -1px rgba(74,56,24,0.06)',
  shadowLg:  '0 14px 36px -8px rgba(74,56,24,0.20), 0 4px 10px -2px rgba(74,56,24,0.10)',
  shadowModal:'0 28px 56px -12px rgba(40,28,8,0.32)',
};

const DARK = {
  // Warm obsidian — espresso night with champagne accents
  bg:        '#141009',
  surface:   '#1E1810',
  surfaceAlt:'#28211A',
  surfaceHi: '#221C14',

  border:    '#34291E',
  borderSoft:'#2A2218',
  borderHi:  '#4A3A28',

  ink:       '#F5EFE1',
  ink2:      '#D4C9B4',
  ink3:      '#9A8D73',
  ink4:      '#6E6451',

  primary:   '#9E8BFF',         // lifted indigo for contrast
  primaryHi: '#B6A7FF',
  primaryInk:'#14100A',
  primarySoft:'#2B2550',
  primarySoftInk:'#D4CCFF',

  accent:    '#D4A766',         // warm gold accent
  accentSoft:'#3A2E1B',

  green:     '#8CC97F',
  greenSoft: '#1F2D1B',
  greenInk:  '#B8E3AB',

  amber:     '#E2B36A',
  amberSoft: '#352710',
  amberInk:  '#F3D39F',

  red:       '#E38A8A',
  redSoft:   '#3A1F1F',
  redInk:    '#F0B3B3',

  blue:      '#8CB4E0',
  blueSoft:  '#182637',
  blueInk:   '#B8D2EC',

  shadow1:   '0 1px 2px rgba(0,0,0,0.35)',
  shadow2:   '0 1px 3px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.30)',
  shadowMd:  '0 4px 10px -2px rgba(0,0,0,0.50), 0 2px 4px -1px rgba(0,0,0,0.35)',
  shadowLg:  '0 14px 36px -8px rgba(0,0,0,0.60), 0 4px 10px -2px rgba(0,0,0,0.40)',
  shadowModal:'0 28px 56px -12px rgba(0,0,0,0.75)',
};

const FONTS_AND_RADII = {
  sans:      "'Inter', -apple-system, system-ui, sans-serif",
  serif:     "'Fraunces', 'Instrument Serif', Georgia, serif",
  mono:      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  sentimentPos: '#4F7A4A', sentimentNeu: '#8C7F64', sentimentNeg: '#B64242',
  r1: 4, r2: 6, r3: 8, r4: 10, r5: 12, r6: 16, r7: 20, rPill: 999,
};

window.__LightTokens = { ...LIGHT, ...FONTS_AND_RADII };
window.__DarkTokens  = { ...DARK,  ...FONTS_AND_RADII };

const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('console-theme')) || 'light';
window.ConsoleTokens = saved === 'dark' ? window.__DarkTokens : window.__LightTokens;
window.__consoleTheme = saved;

window.setConsoleTheme = function(mode) {
  window.__consoleTheme = mode;
  window.ConsoleTokens = mode === 'dark' ? window.__DarkTokens : window.__LightTokens;
  try { localStorage.setItem('console-theme', mode); } catch (e) {}
  document.body.style.background = window.ConsoleTokens.bg;
  window.dispatchEvent(new CustomEvent('consoletheme', { detail: mode }));
};
