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
import { SqliteDatabase } from './database/sqliteDatabase';
import { AssetStore } from './database/assetStore';
import { LegacyMigrator } from './database/legacyMigrator';

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

  // 1. Non-destructive merge of Bookmarks (match by normalized URL)
  let importedBookmarksCount = 0;
  const existingBookmarkUrls = new Set(currentState.speedDialItems.map((b) => b.url.toLowerCase()));
  const mergedBookmarks = [...currentState.speedDialItems];

  if (Array.isArray(parsed.bookmarks)) {
    for (const b of parsed.bookmarks) {
      if (!b || typeof b.url !== 'string' || !b.url.trim()) continue;
      const normUrl = b.url.toLowerCase();
      if (!existingBookmarkUrls.has(normUrl)) {
        existingBookmarkUrls.add(normUrl);
        const argb = typeof b.badgeColor === 'number' ? b.badgeColor : 0xff0288d1;
        const matchedBrand = Object.entries(brandMap).find(([domain]) => normUrl.includes(domain));
        mergedBookmarks.push({
          id: b.id || crypto.randomUUID(),
          title: b.title || b.url,
          url: b.url,
          iconAsset: matchedBrand?.[1],
          badgeColor: argb,
          badgeColorHex: argbToHex(argb)
        });
        importedBookmarksCount++;
      }
    }
  }

  // 2. Non-destructive merge of History (match by normalized URL)
  let importedHistoryCount = 0;
  const existingHistoryUrls = new Set(currentState.history.map((h) => h.url.toLowerCase()));
  const mergedHistory = [...currentState.history];

  if (Array.isArray(parsed.history)) {
    for (const h of parsed.history) {
      if (!h || typeof h.url !== 'string' || !h.url.trim()) continue;
      const normUrl = h.url.toLowerCase();
      if (!existingHistoryUrls.has(normUrl)) {
        existingHistoryUrls.add(normUrl);
        mergedHistory.push({
          id: h.id || crypto.randomUUID(),
          title: h.title || '',
          url: h.url,
          timestamp: typeof h.timestamp === 'number' ? h.timestamp : Date.now(),
          spaceId: h.spaceId && h.spaceId.trim() ? h.spaceId : null
        });
        importedHistoryCount++;
      }
    }
  }

  // 3. Restore Spaces (Android backup defines configured spaces)
  const restoredSpaces: BrowserSpace[] = [];
  if (Array.isArray(parsed.spaces) && parsed.spaces.length > 0) {
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

  // 4. Settings merge (only if present in backup)
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
    speedDialItems: mergedBookmarks,
    history: mergedHistory,
    spaces: restoredSpaces.length > 0 ? restoredSpaces : currentState.spaces,
    settings: nextSettings
  };

  return {
    nextState,
    importedBookmarks: importedBookmarksCount,
    importedHistory: importedHistoryCount,
    importedSpaces: restoredSpaces.length
  };
}

export class StorageService {
  private readonly assetStore: AssetStore;
  private readonly sqliteDb: SqliteDatabase;
  private readonly migrator: LegacyMigrator;
  private cachedState: PersistedAppState | null = null;

  constructor(userDataDir: string) {
    fs.mkdirSync(userDataDir, { recursive: true });
    this.assetStore = new AssetStore(userDataDir);
    this.sqliteDb = new SqliteDatabase(userDataDir, this.assetStore);
    this.migrator = new LegacyMigrator(userDataDir, this.sqliteDb, this.assetStore);
  }

  getAssetStore(): AssetStore {
    return this.assetStore;
  }

  getSqliteDatabase(): SqliteDatabase {
    return this.sqliteDb;
  }

  async loadState(): Promise<PersistedAppState> {
    if (this.cachedState) {
      return this.cachedState;
    }
    const state = await this.migrator.migrateIfNeeded(createDefaultPersistedState);
    this.cachedState = state;
    return state;
  }

  getCachedState(): PersistedAppState {
    return this.cachedState || createDefaultPersistedState();
  }

  async saveState(state: PersistedAppState): Promise<void> {
    this.cachedState = state;
    await this.sqliteDb.saveFullState(state);
  }

  async recordHistoryVisit(entry: HistoryEntry): Promise<void> {
    await this.sqliteDb.recordHistoryVisit(entry);
    if (this.cachedState) {
      const idx = this.cachedState.history.findIndex((h) => h.url === entry.url);
      if (idx !== -1) {
        this.cachedState.history[idx] = entry;
      } else {
        this.cachedState.history.unshift(entry);
      }
    }
  }

  async searchOmnibar(query: string, limit = 8): Promise<{ history: HistoryEntry[]; bookmarks: SpeedDialItem[] }> {
    return this.sqliteDb.searchOmnibar(query, limit);
  }

  async mergeBackup(rawJson: string): Promise<{
    nextState: PersistedAppState;
    importedBookmarks: number;
    importedHistory: number;
    importedSpaces: number;
  }> {
    const currentState = await this.loadState();
    const result = mergeAndroidCompatibleBackup(currentState, rawJson);
    this.cachedState = result.nextState;
    await this.sqliteDb.saveFullState(result.nextState);
    return result;
  }
}
