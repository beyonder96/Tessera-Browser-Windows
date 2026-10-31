import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  BrowserSpace,
  HistoryEntry,
  PersistedAppState,
  SpeedDialItem,
  TesseraAndroidCompatibleBackup
} from '../src/shared/types';
import {
  argbToHex,
  DEFAULT_SETTINGS,
  DEFAULT_SPACES,
  DEFAULT_SPEED_DIAL,
  hexToArgb
} from '../src/shared/wallpapers';
import { normalizeSearchEngineId } from '../src/shared/searchEngines';

export function createDefaultPersistedState(): PersistedAppState {
  const defaultTabId = 'default-tab';
  return {
    spaces: DEFAULT_SPACES,
    activeSpaceId: 'space_general',
    tabs: [
      {
        id: defaultTabId,
        url: 'https://www.google.com',
        title: 'Início',
        isHomePage: true,
        canGoBack: false,
        canGoForward: false,
        isPinned: false,
        lastAccessedTimestamp: Date.now(),
        groupId: null,
        spaceId: 'space_general'
      }
    ],
    activeTabId: defaultTabId,
    tabGroups: [],
    speedDialItems: DEFAULT_SPEED_DIAL,
    history: [],
    downloads: [],
    savedPages: [],
    siteSettings: {},
    readerHighlights: {},
    privacyStats: {
      totalBlockedCount: 0,
      estimatedBytesSaved: 0,
      estimatedTimeSavedMs: 0,
      byCategory: {
        ADVERTISING: 0,
        ANALYTICS: 0,
        SOCIAL: 0,
        FINGERPRINTING: 0
      }
    },
    settings: { ...DEFAULT_SETTINGS }
  };
}

export function serializeToAndroidCompatibleBackup(state: PersistedAppState): TesseraAndroidCompatibleBackup {
  return {
    version: 1,
    timestamp: Date.now(),
    platform: 'windows',
    bookmarks: state.speedDialItems.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      badgeColor: item.badgeColor ?? hexToArgb(item.badgeColorHex)
    })),
    history: state.history.map((h) => ({
      id: h.id,
      title: h.title,
      url: h.url,
      timestamp: h.timestamp,
      spaceId: h.spaceId ?? ''
    })),
    spaces: state.spaces.map((s) => ({
      id: s.id,
      name: s.name,
      iconEmoji: s.iconEmoji,
      colorArgb: s.colorArgb ?? hexToArgb(s.colorHex),
      isDefault: s.isDefault
    })),
    settings: {
      isDarkMode: state.settings.isDarkMode,
      forceDarkPages: state.settings.forceDarkPages,
      adBlockEnabled: state.settings.adBlockEnabled,
      cookieBlockerEnabled: state.settings.cookieBlockerEnabled,
      searchEngine: state.settings.searchEngine.toUpperCase(),
      selectedWallpaperId: state.settings.selectedWallpaperId,
      showWeatherWidget: state.settings.showWeatherWidget,
      showQuotesWidget: state.settings.showQuotesWidget
    }
  };
}

export function mergeAndroidCompatibleBackup(
  currentState: PersistedAppState,
  rawJson: string
): { nextState: PersistedAppState; importedBookmarks: number; importedHistory: number; importedSpaces: number } {
  const parsed = JSON.parse(rawJson) as Partial<TesseraAndroidCompatibleBackup>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Estrutura JSON de backup inválida.');
  }

  const brandMap: Record<string, string> = {
    'duckduckgo.com': './assets/brands/duckduckgo.svg',
    'google.com': './assets/brands/google.svg',
    'youtube.com': './assets/brands/youtube.svg',
    'wikipedia.org': './assets/brands/wikipedia.svg',
    'github.com': './assets/brands/github.svg',
    'reddit.com': './assets/brands/reddit.svg',
    'x.com': './assets/brands/x_twitter.svg',
    'twitter.com': './assets/brands/x_twitter.svg',
    'bing.com': './assets/brands/bing.svg',
    'brave.com': './assets/brands/brave.svg',
    'ecosia.org': './assets/brands/ecosia.svg'
  };

  const restoredBookmarks: SpeedDialItem[] = [];
  if (Array.isArray(parsed.bookmarks)) {
    for (const b of parsed.bookmarks) {
      if (!b || typeof b.url !== 'string' || !b.url.trim()) continue;
      const argb = typeof b.badgeColor === 'number' ? b.badgeColor : 0xff0288d1;
      const matchedBrand = Object.entries(brandMap).find(([domain]) => b.url.toLowerCase().includes(domain));
      restoredBookmarks.push({
        id: b.id || crypto.randomUUID(),
        title: b.title || b.url,
        url: b.url,
        iconAsset: matchedBrand?.[1],
        badgeColor: argb,
        badgeColorHex: argbToHex(argb)
      });
    }
  }

  const restoredHistory: HistoryEntry[] = [];
  if (Array.isArray(parsed.history)) {
    for (const h of parsed.history) {
      if (!h || typeof h.url !== 'string' || !h.url.trim()) continue;
      restoredHistory.push({
        id: h.id || crypto.randomUUID(),
        title: h.title || '',
        url: h.url,
        timestamp: typeof h.timestamp === 'number' ? h.timestamp : Date.now(),
        spaceId: h.spaceId && h.spaceId.trim() ? h.spaceId : null
      });
    }
  }

  const restoredSpaces: BrowserSpace[] = [];
  if (Array.isArray(parsed.spaces)) {
    for (const s of parsed.spaces) {
      if (!s || typeof s.id !== 'string' || !s.name) continue;
      const argb = typeof s.colorArgb === 'number' ? s.colorArgb : 0xff0288d1;
      restoredSpaces.push({
        id: s.id,
        name: s.name,
        iconEmoji: s.iconEmoji || '🌐',
        colorArgb: argb,
        colorHex: argbToHex(argb),
        isDefault: Boolean(s.isDefault)
      });
    }
  }

  const nextSettings = { ...currentState.settings };
  if (parsed.settings && typeof parsed.settings === 'object') {
    if (typeof parsed.settings.isDarkMode === 'boolean') nextSettings.isDarkMode = parsed.settings.isDarkMode;
    if (typeof parsed.settings.forceDarkPages === 'boolean') nextSettings.forceDarkPages = parsed.settings.forceDarkPages;
    if (typeof parsed.settings.adBlockEnabled === 'boolean') nextSettings.adBlockEnabled = parsed.settings.adBlockEnabled;
    if (typeof parsed.settings.cookieBlockerEnabled === 'boolean') {
      nextSettings.cookieBlockerEnabled = parsed.settings.cookieBlockerEnabled;
    }
    if (typeof parsed.settings.searchEngine === 'string') {
      nextSettings.searchEngine = normalizeSearchEngineId(parsed.settings.searchEngine);
    }
    if (typeof parsed.settings.selectedWallpaperId === 'string') {
      nextSettings.selectedWallpaperId = parsed.settings.selectedWallpaperId;
    }
    if (typeof parsed.settings.showWeatherWidget === 'boolean') {
      nextSettings.showWeatherWidget = parsed.settings.showWeatherWidget;
    }
    if (typeof parsed.settings.showQuotesWidget === 'boolean') {
      nextSettings.showQuotesWidget = parsed.settings.showQuotesWidget;
    }
  }

  const nextState: PersistedAppState = {
    ...currentState,
    speedDialItems: restoredBookmarks.length > 0 ? restoredBookmarks : currentState.speedDialItems,
    history: restoredHistory.length > 0 ? restoredHistory : currentState.history,
    spaces: restoredSpaces.length > 0 ? restoredSpaces : currentState.spaces,
    settings: nextSettings
  };

  return {
    nextState,
    importedBookmarks: restoredBookmarks.length,
    importedHistory: restoredHistory.length,
    importedSpaces: restoredSpaces.length
  };
}

export class StorageService {
  private readonly stateFilePath: string;

  constructor(userDataDir: string) {
    fs.mkdirSync(userDataDir, { recursive: true });
    this.stateFilePath = path.join(userDataDir, 'tessera_state_v1.json');
  }

  loadState(): PersistedAppState {
    const defaults = createDefaultPersistedState();
    if (!fs.existsSync(this.stateFilePath)) {
      return defaults;
    }
    try {
      const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
      return {
        ...defaults,
        ...parsed,
        settings: {
          ...defaults.settings,
          ...(parsed.settings || {})
        },
        privacyStats: {
          ...defaults.privacyStats,
          ...(parsed.privacyStats || {}),
          byCategory: {
            ...defaults.privacyStats.byCategory,
            ...(parsed.privacyStats?.byCategory || {})
          }
        },
        // Never persist ephemeral incognito tabs across cold restarts
        tabs:
          Array.isArray(parsed.tabs) && parsed.tabs.filter((t) => !t.isIncognito).length > 0
            ? parsed.tabs.filter((t) => !t.isIncognito)
            : defaults.tabs
      };
    } catch {
      return defaults;
    }
  }

  saveState(state: PersistedAppState): void {
    const cleanState: PersistedAppState = {
      ...state,
      tabs: state.tabs.filter((t) => !t.isIncognito),
      history: state.history.slice(0, 1000),
      downloads: state.downloads.slice(0, 120)
    };
    const tmpPath = `${this.stateFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(cleanState, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.stateFilePath);
  }
}
