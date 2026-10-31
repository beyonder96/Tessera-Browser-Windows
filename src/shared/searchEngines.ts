import type { SearchEngineId } from './types';

export interface SearchEngineDefinition {
  id: SearchEngineId;
  displayName: string;
  searchUrlTemplate: string;
  homeUrl: string;
  suggestUrlTemplate: string;
  iconAsset: string;
  accentColor: string;
}

/**
 * Herdado 1:1 de com.tessera.browser.data.SearchEngine (Android v3.4.1)
 */
export const SEARCH_ENGINES: Record<SearchEngineId, SearchEngineDefinition> = {
  google: {
    id: 'google',
    displayName: 'Google',
    searchUrlTemplate: 'https://www.google.com/search?q=%s',
    homeUrl: 'https://www.google.com',
    suggestUrlTemplate: 'https://suggestqueries.google.com/complete/search?client=chrome&q=%s',
    iconAsset: './assets/brands/google.svg',
    accentColor: '#4285F4'
  },
  duckduckgo: {
    id: 'duckduckgo',
    displayName: 'DuckDuckGo',
    searchUrlTemplate: 'https://duckduckgo.com/?q=%s',
    homeUrl: 'https://duckduckgo.com',
    suggestUrlTemplate: 'https://duckduckgo.com/ac/?q=%s&type=list',
    iconAsset: './assets/brands/duckduckgo.svg',
    accentColor: '#DE5833'
  },
  bing: {
    id: 'bing',
    displayName: 'Bing',
    searchUrlTemplate: 'https://www.bing.com/search?q=%s',
    homeUrl: 'https://www.bing.com',
    suggestUrlTemplate: 'https://api.bing.com/osjson.aspx?query=%s',
    iconAsset: './assets/brands/bing.svg',
    accentColor: '#008394'
  },
  brave: {
    id: 'brave',
    displayName: 'Brave Search',
    searchUrlTemplate: 'https://search.brave.com/search?q=%s',
    homeUrl: 'https://search.brave.com',
    suggestUrlTemplate: 'https://search.brave.com/api/suggest?q=%s',
    iconAsset: './assets/brands/brave.svg',
    accentColor: '#FB542B'
  },
  ecosia: {
    id: 'ecosia',
    displayName: 'Ecosia',
    searchUrlTemplate: 'https://www.ecosia.org/search?q=%s',
    homeUrl: 'https://www.ecosia.org',
    suggestUrlTemplate: 'https://ac.ecosia.org/autocomplete?q=%s&type=list',
    iconAsset: './assets/brands/ecosia.svg',
    accentColor: '#00A562'
  }
};

export function normalizeSearchEngineId(raw?: string | null): SearchEngineId {
  if (!raw) return 'google';
  const lower = raw.toLowerCase().trim();
  if (lower in SEARCH_ENGINES) {
    return lower as SearchEngineId;
  }
  return 'google';
}

export function resolveNavigationInput(rawInput: string, engineId: SearchEngineId = 'google'): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return SEARCH_ENGINES[engineId].homeUrl;

  if (/^(https?:\/\/|file:\/\/|about:|chrome:)/i.test(trimmed)) {
    return trimmed;
  }

  // Localhost or IPv4 with optional port
  if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  // Domain heuristic (contains dot, no spaces)
  const looksLikeDomain = !trimmed.includes(' ') && /^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(trimmed);
  if (looksLikeDomain) {
    return `https://${trimmed}`;
  }

  const engine = SEARCH_ENGINES[engineId] || SEARCH_ENGINES.google;
  return engine.searchUrlTemplate.replace('%s', encodeURIComponent(trimmed));
}

export function extractCleanHost(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || url;
  }
}
