import type { BrowserSettings, BrowserSpace, SpeedDialItem } from './types';

export interface WallpaperTheme {
  id: string;
  name: string;
  imageUrl?: string;
  cssGradient: string;
  accentColor: string;
}

/**
 * Herdado de com.tessera.browser.data.WallpaperTheme + res/drawable
 */
export const AVAILABLE_WALLPAPERS: WallpaperTheme[] = [
  {
    id: 'summer_villa',
    name: 'Villa Mediterrânea',
    imageUrl: './assets/wallpapers/wallpaper_summer_villa.jpg',
    cssGradient: 'linear-gradient(135deg, #64B5F6 0%, #1E88E5 50%, #0D47A1 100%)',
    accentColor: '#0288D1'
  },
  {
    id: 'chocolate_silk',
    name: 'Seda Chocolate',
    imageUrl: './assets/wallpapers/wallpaper_chocolate_silk.png',
    cssGradient: 'linear-gradient(135deg, #2A1610 0%, #4A281D 50%, #1A0D09 100%)',
    accentColor: '#D49A6A'
  },
  {
    id: 'neon_horizon',
    name: 'Neon Horizon',
    cssGradient: 'linear-gradient(135deg, #240046 0%, #3C096C 35%, #5A189A 70%, #7B2CBF 100%)',
    accentColor: '#00E5FF'
  },
  {
    id: 'emerald_forest',
    name: 'Floresta Esmeralda',
    cssGradient: 'linear-gradient(135deg, #0B2E24 0%, #144D3E 45%, #1C6B56 75%, #071F18 100%)',
    accentColor: '#00E676'
  },
  {
    id: 'violet_galaxy',
    name: 'Galáxia Violeta',
    cssGradient: 'linear-gradient(135deg, #180A2E 0%, #2D1254 45%, #4A1E8A 80%, #120524 100%)',
    accentColor: '#B388FF'
  },
  {
    id: 'sunset_dunes',
    name: 'Duna Dourada',
    cssGradient: 'linear-gradient(135deg, #3E1E14 0%, #5D2E1F 50%, #7E3F2B 80%, #2A120B 100%)',
    accentColor: '#FFB74D'
  },
  {
    id: 'deep_ocean',
    name: 'Oceano Profundo',
    cssGradient: 'linear-gradient(135deg, #071E3D 0%, #0B2E5C 45%, #134582 80%, #030E1F 100%)',
    accentColor: '#40C4FF'
  },
  {
    id: 'amoled_black',
    name: 'Black AMOLED',
    cssGradient: 'linear-gradient(180deg, #000000 0%, #0A0A0C 50%, #000000 100%)',
    accentColor: '#0A84FF'
  }
];

export const DEFAULT_SPACES: BrowserSpace[] = [
  {
    id: 'space_general',
    name: 'Geral',
    iconEmoji: '🌐',
    colorHex: '#0288D1',
    colorArgb: 0xff0288d1,
    isDefault: true
  },
  {
    id: 'space_work',
    name: 'Trabalho',
    iconEmoji: '💼',
    colorHex: '#FF7043',
    colorArgb: 0xffff7043,
    isDefault: false
  },
  {
    id: 'space_personal',
    name: 'Pessoal',
    iconEmoji: '🏠',
    colorHex: '#00E676',
    colorArgb: 0xff00e676,
    isDefault: false
  }
];

export const SPACE_PRESET_COLORS: Array<{ hex: string; argb: number }> = [
  { hex: '#0288D1', argb: 0xff0288d1 },
  { hex: '#FF7043', argb: 0xffff7043 },
  { hex: '#00E676', argb: 0xff00e676 },
  { hex: '#AB47BC', argb: 0xffab47bc },
  { hex: '#FF4081', argb: 0xffff4081 },
  { hex: '#FFD600', argb: 0xffffd600 },
  { hex: '#00B0FF', argb: 0xff00b0ff },
  { hex: '#26A69A', argb: 0xff26a69a },
  { hex: '#78909C', argb: 0xff78909c }
];

export const SPACE_PRESET_EMOJIS = [
  '🌐', '💼', '🏠', '📚', '🚀', '🎨', '🎮', '⚡', '🔬', '💡', '🎧', '☕', '📊', '🎯'
];

export const DEFAULT_SPEED_DIAL: SpeedDialItem[] = [
  {
    id: '1',
    title: 'DuckDuckGo',
    url: 'https://duckduckgo.com',
    iconAsset: './assets/brands/duckduckgo.svg',
    badgeColorHex: '#DE5833',
    badgeColor: 0xffde5833
  },
  {
    id: '2',
    title: 'Google',
    url: 'https://www.google.com',
    iconAsset: './assets/brands/google.svg',
    badgeColorHex: '#4285F4',
    badgeColor: 0xff4285f4
  },
  {
    id: '3',
    title: 'YouTube',
    url: 'https://www.youtube.com',
    iconAsset: './assets/brands/youtube.svg',
    badgeColorHex: '#FF0000',
    badgeColor: 0xffff0000
  },
  {
    id: '4',
    title: 'Wikipedia',
    url: 'https://pt.wikipedia.org',
    iconAsset: './assets/brands/wikipedia.svg',
    badgeColorHex: '#2C3238',
    badgeColor: 0xff2c3238
  },
  {
    id: '5',
    title: 'GitHub',
    url: 'https://github.com',
    iconAsset: './assets/brands/github.svg',
    badgeColorHex: '#24292E',
    badgeColor: 0xff24292e
  },
  {
    id: '6',
    title: 'Reddit',
    url: 'https://www.reddit.com',
    iconAsset: './assets/brands/reddit.svg',
    badgeColorHex: '#FF4500',
    badgeColor: 0xffff4500
  }
];

export const TRENDING_TOPICS = [
  'Inteligência Artificial',
  'Notícias do Dia',
  'Clima & Previsão',
  'Lançamentos de Jogos',
  'Cotação do Dólar',
  'Cinema & Séries'
];

export const DEFAULT_SETTINGS: BrowserSettings = {
  isDarkMode: true,
  forceDarkPages: false,
  adBlockEnabled: true,
  cookieBlockerEnabled: true,
  searchEngine: 'google',
  showWallpaper: false,
  selectedWallpaperId: 'summer_villa',
  customWallpaperDataUrl: null,
  showWeatherWidget: true,
  showQuotesWidget: true,
  digitalMinimalismMode: false,
  showFavoritesBar: false,
  showPillTabsBar: true,
  airBarPosition: 'bottom',
  autoHideAirBar: true,
  tesseraAiEnabled: true,
  aiToolbarButton: true,
  aiTextHighlightPrompts: true,
  aiProvider: 'GEMINI',
  incognitoPinLockEnabled: false,
  incognitoPinHash: null,
  readerTheme: 'SEPIA',
  readerFontFamily: 'SERIF',
  readerFontSizePx: 19,
  readerShowImages: true,
  voiceActivationEnabled: false,
  voiceWakeWord: 'tessera',
  windowControlsMode: 'auto-hide'
};

export function argbToHex(argb: number, fallback = '#0288D1'): string {
  if (typeof argb !== 'number' || Number.isNaN(argb)) return fallback;
  const rgb = (argb >>> 0) & 0xffffff;
  return `#${rgb.toString(16).padStart(6, '0').toUpperCase()}`;
}

export function hexToArgb(hex: string): number {
  const clean = hex.replace('#', '').trim();
  const rgb = Number.parseInt(clean.length === 6 ? clean : '0288D1', 16);
  return ((0xff000000 | (rgb & 0xffffff)) >>> 0);
}
