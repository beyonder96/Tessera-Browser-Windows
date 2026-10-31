import path from 'node:path';
import crypto from 'node:crypto';
import { createClient, type Client } from '@libsql/client';
import type {
  BrowserSpace,
  BrowserTab,
  DownloadItem,
  HistoryEntry,
  PersistedAppState,
  ReaderBlock,
  SavedPageItem,
  SiteSettings,
  SpeedDialItem,
  TabGroup,
  TesseraAndroidCompatibleBackup,
  TrackerCategory
} from '../../src/shared/types';
import { argbToHex, DEFAULT_SETTINGS, DEFAULT_SPACES, DEFAULT_SPEED_DIAL, hexToArgb } from '../../src/shared/wallpapers';
import { normalizeSearchEngineId } from '../../src/shared/searchEngines';
import type { AssetStore } from './assetStore';

export class SqliteDatabase {
  private client: Client;
  private readonly dbPath: string;
  private readonly assetStore: AssetStore;
  private isInitialized = false;

  constructor(userDataDir: string, assetStore: AssetStore) {
    this.assetStore = assetStore;
    this.dbPath = path.join(userDataDir, 'tessera.db');
    // Using file protocol for local SQLite database
    const fileUrl = `file:${this.dbPath.replace(/\\/g, '/')}`;
    this.client = createClient({ url: fileUrl });
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Pragmas
    await this.client.execute('PRAGMA foreign_keys = ON;');

    // Schema Migrations table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);

    // Spaces
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS spaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon_emoji TEXT NOT NULL,
        color_hex TEXT NOT NULL,
        color_argb INTEGER NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
    `);

    // Tab Groups
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS tab_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color_hex TEXT NOT NULL,
        space_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Tabs
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS tabs (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        group_id TEXT,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        favicon TEXT,
        is_home_page INTEGER NOT NULL DEFAULT 0,
        can_go_back INTEGER NOT NULL DEFAULT 0,
        can_go_forward INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_muted INTEGER NOT NULL DEFAULT 0,
        is_playing_media INTEGER NOT NULL DEFAULT 0,
        is_incognito INTEGER NOT NULL DEFAULT 0,
        theme_color TEXT,
        thumbnail_rel_path TEXT,
        last_accessed_timestamp INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_hibernated INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Bookmarks / SpeedDial
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        sync_uuid TEXT UNIQUE,
        folder_id TEXT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        icon_asset TEXT,
        badge_color_hex TEXT NOT NULL,
        badge_color INTEGER NOT NULL,
        is_speed_dial INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
    `);

    // History (with unique URL for visit counting and deduplication)
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        url TEXT UNIQUE NOT NULL,
        timestamp INTEGER NOT NULL,
        space_id TEXT,
        visit_count INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );
    `);

    // Downloads
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        url TEXT NOT NULL,
        save_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        received_bytes INTEGER NOT NULL DEFAULT 0,
        total_bytes INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);

    // Saved Pages (Reading List)
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS saved_pages (
        id TEXT PRIMARY KEY,
        sync_uuid TEXT UNIQUE,
        title TEXT NOT NULL,
        url TEXT UNIQUE NOT NULL,
        domain TEXT NOT NULL,
        saved_at INTEGER NOT NULL,
        article_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Site Settings (per origin)
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS site_settings (
        origin TEXT PRIMARY KEY,
        javascript_enabled INTEGER NOT NULL DEFAULT 1,
        ad_block_whitelisted INTEGER NOT NULL DEFAULT 0,
        camera_allowed INTEGER NOT NULL DEFAULT 0,
        microphone_allowed INTEGER NOT NULL DEFAULT 0,
        geolocation_allowed INTEGER NOT NULL DEFAULT 0,
        notifications_allowed INTEGER NOT NULL DEFAULT 0,
        popups_allowed INTEGER NOT NULL DEFAULT 0,
        legacy_ua_enabled INTEGER NOT NULL DEFAULT 0,
        zoom_factor REAL NOT NULL DEFAULT 1.0,
        updated_at INTEGER NOT NULL
      );
    `);

    // Reader Highlights
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS reader_highlights (
        page_id TEXT NOT NULL,
        block_index INTEGER NOT NULL,
        color TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (page_id, block_index)
      );
    `);

    // Privacy Stats
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS privacy_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total_blocked_count INTEGER NOT NULL DEFAULT 0,
        estimated_bytes_saved INTEGER NOT NULL DEFAULT 0,
        estimated_time_saved_ms INTEGER NOT NULL DEFAULT 0,
        by_category_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // App State / Settings
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        active_space_id TEXT NOT NULL,
        active_tab_id TEXT NOT NULL,
        settings_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Paired Devices for Tessera Sync
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS paired_devices (
        device_id TEXT PRIMARY KEY,
        device_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        shared_secret_enc TEXT NOT NULL,
        last_sync_cursor INTEGER NOT NULL DEFAULT 0,
        last_seen_at INTEGER NOT NULL
      );
    `);

    // Sync Tombstones (to properly propagate deletions across devices)
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS sync_tombstones (
        entity_type TEXT NOT NULL,
        sync_uuid TEXT NOT NULL,
        deleted_at INTEGER NOT NULL,
        PRIMARY KEY (entity_type, sync_uuid)
      );
    `);

    // FTS5 Tables & Triggers
    try {
      await this.client.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
          title,
          url,
          content=history,
          content_rowid=id
        );
      `);

      await this.client.execute(`
        CREATE TRIGGER IF NOT EXISTS history_ai AFTER INSERT ON history BEGIN
          INSERT INTO history_fts(rowid, title, url) VALUES (new.id, new.title, new.url);
        END;
      `);
      await this.client.execute(`
        CREATE TRIGGER IF NOT EXISTS history_ad AFTER DELETE ON history BEGIN
          INSERT INTO history_fts(history_fts, rowid, title, url) VALUES('delete', old.id, old.title, old.url);
        END;
      `);
      await this.client.execute(`
        CREATE TRIGGER IF NOT EXISTS history_au AFTER UPDATE ON history BEGIN
          INSERT INTO history_fts(history_fts, rowid, title, url) VALUES('delete', old.id, old.title, old.url);
          INSERT INTO history_fts(rowid, title, url) VALUES (new.id, new.title, new.url);
        END;
      `);

      await this.client.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
          title,
          url,
          content=bookmarks,
          content_rowid=rowid
        );
      `);

      await this.client.execute(`
        CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
          INSERT INTO bookmarks_fts(rowid, title, url) VALUES (new.rowid, new.title, new.url);
        END;
      `);
      await this.client.execute(`
        CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
          INSERT INTO bookmarks_fts(bookmarks_fts, rowid, title, url) VALUES('delete', old.rowid, old.title, old.url);
        END;
      `);
      await this.client.execute(`
        CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
          INSERT INTO bookmarks_fts(bookmarks_fts, rowid, title, url) VALUES('delete', old.rowid, old.title, old.url);
          INSERT INTO bookmarks_fts(rowid, title, url) VALUES (new.rowid, new.title, new.url);
        END;
      `);
    } catch (ftsErr) {
      console.warn('[SqliteDatabase] FTS5 initialization note:', ftsErr);
    }

    this.isInitialized = true;
  }

  async isDatabaseEmpty(): Promise<boolean> {
    const spacesRes = await this.client.execute('SELECT COUNT(*) as count FROM spaces;');
    const spacesCount = Number(spacesRes.rows[0]?.count ?? 0);
    const historyRes = await this.client.execute('SELECT COUNT(*) as count FROM history;');
    const historyCount = Number(historyRes.rows[0]?.count ?? 0);
    return spacesCount === 0 && historyCount === 0;
  }

  async loadFullState(): Promise<PersistedAppState | null> {
    await this.init();

    if (await this.isDatabaseEmpty()) {
      return null;
    }

    // Load App State
    const appStateRes = await this.client.execute('SELECT * FROM app_state WHERE id = 1;');
    let activeSpaceId = 'space_general';
    let activeTabId = 'default-tab';
    let settings = { ...DEFAULT_SETTINGS };

    if (appStateRes.rows.length > 0) {
      const row = appStateRes.rows[0];
      activeSpaceId = String(row.active_space_id || 'space_general');
      activeTabId = String(row.active_tab_id || 'default-tab');
      try {
        const parsedSettings = JSON.parse(String(row.settings_json));
        settings = { ...DEFAULT_SETTINGS, ...parsedSettings };
      } catch {
        // use default
      }
    }

    // Load Spaces
    const spacesRes = await this.client.execute('SELECT * FROM spaces ORDER BY sort_order ASC;');
    const spaces: BrowserSpace[] = spacesRes.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      iconEmoji: String(r.icon_emoji),
      colorHex: String(r.color_hex),
      colorArgb: Number(r.color_argb),
      isDefault: Boolean(r.is_default)
    }));

    // Load Tab Groups
    const groupsRes = await this.client.execute('SELECT * FROM tab_groups;');
    const tabGroups: TabGroup[] = groupsRes.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      colorHex: String(r.color_hex),
      spaceId: String(r.space_id)
    }));

    // Load Tabs
    const tabsRes = await this.client.execute('SELECT * FROM tabs ORDER BY sort_order ASC;');
    const tabs: BrowserTab[] = tabsRes.rows
      .filter((r) => !Boolean(r.is_incognito))
      .map((r) => {
        const relThumbnail = r.thumbnail_rel_path ? String(r.thumbnail_rel_path) : null;
        const thumbnailDataUrl = relThumbnail ? this.assetStore.getThumbnailDataUrl(relThumbnail) : null;
        return {
          id: String(r.id),
          spaceId: String(r.space_id),
          groupId: r.group_id ? String(r.group_id) : null,
          url: String(r.url),
          title: String(r.title),
          favicon: r.favicon ? String(r.favicon) : undefined,
          isHomePage: Boolean(r.is_home_page),
          canGoBack: Boolean(r.can_go_back),
          canGoForward: Boolean(r.can_go_forward),
          isPinned: Boolean(r.is_pinned),
          isMuted: Boolean(r.is_muted),
          isPlayingMedia: Boolean(r.is_playing_media),
          isIncognito: false,
          themeColor: r.theme_color ? String(r.theme_color) : null,
          thumbnailDataUrl,
          lastAccessedTimestamp: Number(r.last_accessed_timestamp || Date.now())
        };
      });

    // Load Bookmarks / SpeedDial
    const bookmarksRes = await this.client.execute('SELECT * FROM bookmarks ORDER BY sort_order ASC;');
    const speedDialItems: SpeedDialItem[] = bookmarksRes.rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      url: String(r.url),
      iconAsset: r.icon_asset ? String(r.icon_asset) : undefined,
      badgeColorHex: String(r.badge_color_hex),
      badgeColor: Number(r.badge_color)
    }));

    // Load History (un-truncated, ordered by timestamp desc)
    const historyRes = await this.client.execute('SELECT * FROM history ORDER BY timestamp DESC LIMIT 5000;');
    const history: HistoryEntry[] = historyRes.rows.map((r) => ({
      id: String(r.entry_id),
      title: String(r.title),
      url: String(r.url),
      timestamp: Number(r.timestamp),
      spaceId: r.space_id ? String(r.space_id) : null
    }));

    // Load Downloads
    const downloadsRes = await this.client.execute('SELECT * FROM downloads ORDER BY timestamp DESC LIMIT 300;');
    const downloads: DownloadItem[] = downloadsRes.rows.map((r) => ({
      id: String(r.id),
      fileName: String(r.file_name),
      url: String(r.url),
      savePath: String(r.save_path),
      mimeType: String(r.mime_type),
      receivedBytes: Number(r.received_bytes),
      totalBytes: Number(r.total_bytes),
      status: String(r.status) as DownloadItem['status'],
      timestamp: Number(r.timestamp)
    }));

    // Load Saved Pages
    const savedPagesRes = await this.client.execute('SELECT * FROM saved_pages ORDER BY saved_at DESC;');
    const savedPages: SavedPageItem[] = savedPagesRes.rows.map((r) => {
      let article = {
        title: String(r.title),
        domain: String(r.domain),
        readingTimeMinutes: 1,
        blocks: [] as ReaderBlock[],
        plainText: ''
      };
      try {
        article = JSON.parse(String(r.article_json));
      } catch {
        // fallback
      }
      return {
        id: String(r.id),
        title: String(r.title),
        url: String(r.url),
        domain: String(r.domain),
        savedAt: Number(r.saved_at),
        article
      };
    });

    // Load Site Settings
    const siteSettingsRes = await this.client.execute('SELECT * FROM site_settings;');
    const siteSettings: Record<string, SiteSettings> = {};
    for (const r of siteSettingsRes.rows) {
      siteSettings[String(r.origin)] = {
        origin: String(r.origin),
        javascriptEnabled: Boolean(r.javascript_enabled),
        adBlockWhitelisted: Boolean(r.ad_block_whitelisted),
        cameraAllowed: Boolean(r.camera_allowed),
        microphoneAllowed: Boolean(r.microphone_allowed),
        geolocationAllowed: Boolean(r.geolocation_allowed),
        notificationsAllowed: Boolean(r.notifications_allowed),
        popupsAllowed: Boolean(r.popups_allowed)
      };
    }

    // Load Reader Highlights
    const highlightsRes = await this.client.execute('SELECT * FROM reader_highlights;');
    const readerHighlights: Record<string, Record<number, string>> = {};
    for (const r of highlightsRes.rows) {
      const pageId = String(r.page_id);
      const blockIdx = Number(r.block_index);
      const color = String(r.color);
      if (!readerHighlights[pageId]) {
        readerHighlights[pageId] = {};
      }
      readerHighlights[pageId][blockIdx] = color;
    }

    // Load Privacy Stats
    const privacyRes = await this.client.execute('SELECT * FROM privacy_stats WHERE id = 1;');
    let privacyStats: PersistedAppState['privacyStats'] = {
      totalBlockedCount: 0,
      estimatedBytesSaved: 0,
      estimatedTimeSavedMs: 0,
      byCategory: {
        ADVERTISING: 0,
        ANALYTICS: 0,
        SOCIAL: 0,
        FINGERPRINTING: 0
      }
    };
    if (privacyRes.rows.length > 0) {
      const r = privacyRes.rows[0];
      let byCategory = privacyStats.byCategory;
      try {
        byCategory = JSON.parse(String(r.by_category_json));
      } catch {
        // fallback
      }
      privacyStats = {
        totalBlockedCount: Number(r.total_blocked_count),
        estimatedBytesSaved: Number(r.estimated_bytes_saved),
        estimatedTimeSavedMs: Number(r.estimated_time_saved_ms),
        byCategory
      };
    }

    return {
      spaces: spaces.length > 0 ? spaces : DEFAULT_SPACES,
      activeSpaceId,
      tabs: tabs.length > 0 ? tabs : [],
      activeTabId,
      tabGroups,
      speedDialItems: speedDialItems.length > 0 ? speedDialItems : DEFAULT_SPEED_DIAL,
      history,
      downloads,
      savedPages,
      siteSettings,
      readerHighlights,
      privacyStats,
      settings
    };
  }

  async saveFullState(state: PersistedAppState): Promise<void> {
    await this.init();
    const now = Date.now();

    // Clean up thumbnails for closed tabs
    const activeTabIds = state.tabs.map((t) => t.id);
    this.assetStore.cleanOrphanThumbnails(activeTabIds);

    // Handle custom wallpaper extraction if it's a data URL
    let settingsToSave = { ...state.settings };
    if (settingsToSave.customWallpaperDataUrl?.startsWith('data:image')) {
      const relPath = this.assetStore.saveCustomWallpaper(settingsToSave.customWallpaperDataUrl);
      if (relPath) {
        settingsToSave.customWallpaperDataUrl = relPath;
      }
    }

    const batchStatements: Array<{ sql: string; args: any[] }> = [];

    // 1. App State
    batchStatements.push({
      sql: `INSERT INTO app_state (id, active_space_id, active_tab_id, settings_json, updated_at)
            VALUES (1, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              active_space_id = excluded.active_space_id,
              active_tab_id = excluded.active_tab_id,
              settings_json = excluded.settings_json,
              updated_at = excluded.updated_at;`,
      args: [state.activeSpaceId, state.activeTabId, JSON.stringify(settingsToSave), now]
    });

    // 2. Spaces (Replace all)
    batchStatements.push({ sql: 'DELETE FROM spaces;', args: [] });
    state.spaces.forEach((s, idx) => {
      batchStatements.push({
        sql: `INSERT INTO spaces (id, name, icon_emoji, color_hex, color_argb, is_default, sort_order, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [s.id, s.name, s.iconEmoji, s.colorHex, s.colorArgb ?? hexToArgb(s.colorHex), s.isDefault ? 1 : 0, idx, now]
      });
    });

    // 3. Tab Groups
    batchStatements.push({ sql: 'DELETE FROM tab_groups;', args: [] });
    state.tabGroups.forEach((g) => {
      batchStatements.push({
        sql: `INSERT INTO tab_groups (id, name, color_hex, space_id, updated_at)
              VALUES (?, ?, ?, ?, ?);`,
        args: [g.id, g.name, g.colorHex, g.spaceId, now]
      });
    });

    // 4. Tabs (excluding incognito)
    batchStatements.push({ sql: 'DELETE FROM tabs;', args: [] });
    state.tabs
      .filter((t) => !t.isIncognito)
      .forEach((t, idx) => {
        let thumbnailRelPath: string | null = null;
        if (t.thumbnailDataUrl) {
          thumbnailRelPath = this.assetStore.saveThumbnail(t.id, t.thumbnailDataUrl);
        }
        batchStatements.push({
          sql: `INSERT INTO tabs (
            id, space_id, group_id, url, title, favicon, is_home_page,
            can_go_back, can_go_forward, is_pinned, is_muted, is_playing_media,
            is_incognito, theme_color, thumbnail_rel_path, last_accessed_timestamp, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?);`,
          args: [
            t.id,
            t.spaceId,
            t.groupId ?? null,
            t.url,
            t.title,
            t.favicon ?? null,
            t.isHomePage ? 1 : 0,
            t.canGoBack ? 1 : 0,
            t.canGoForward ? 1 : 0,
            t.isPinned ? 1 : 0,
            t.isMuted ? 1 : 0,
            t.isPlayingMedia ? 1 : 0,
            t.themeColor ?? null,
            thumbnailRelPath,
            t.lastAccessedTimestamp,
            idx
          ]
        });
      });

    // 5. Bookmarks / SpeedDial
    batchStatements.push({ sql: 'DELETE FROM bookmarks;', args: [] });
    state.speedDialItems.forEach((b, idx) => {
      batchStatements.push({
        sql: `INSERT INTO bookmarks (
          id, sync_uuid, title, url, icon_asset, badge_color_hex, badge_color, is_speed_dial, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
        args: [
          b.id,
          b.id,
          b.title,
          b.url,
          b.iconAsset ?? null,
          b.badgeColorHex,
          b.badgeColor ?? hexToArgb(b.badgeColorHex),
          idx,
          now
        ]
      });
    });

    // 6. History (Upsert to preserve visit_count and prevent truncation)
    for (const h of state.history) {
      batchStatements.push({
        sql: `INSERT INTO history (entry_id, title, url, timestamp, space_id, visit_count, updated_at)
              VALUES (?, ?, ?, ?, ?, 1, ?)
              ON CONFLICT(url) DO UPDATE SET
                title = excluded.title,
                timestamp = excluded.timestamp,
                space_id = excluded.space_id,
                updated_at = excluded.updated_at;`,
        args: [h.id || crypto.randomUUID(), h.title, h.url, h.timestamp, h.spaceId ?? null, now]
      });
    }

    // 7. Downloads (Upsert)
    for (const d of state.downloads) {
      batchStatements.push({
        sql: `INSERT INTO downloads (id, file_name, url, save_path, mime_type, received_bytes, total_bytes, status, timestamp)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                received_bytes = excluded.received_bytes,
                total_bytes = excluded.total_bytes,
                status = excluded.status;`,
        args: [d.id, d.fileName, d.url, d.savePath, d.mimeType, d.receivedBytes, d.totalBytes, d.status, d.timestamp]
      });
    }

    // 8. Saved Pages (Upsert)
    for (const p of state.savedPages) {
      batchStatements.push({
        sql: `INSERT INTO saved_pages (id, sync_uuid, title, url, domain, saved_at, article_json, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(url) DO UPDATE SET
                title = excluded.title,
                domain = excluded.domain,
                article_json = excluded.article_json,
                updated_at = excluded.updated_at;`,
        args: [p.id, p.id, p.title, p.url, p.domain, p.savedAt, JSON.stringify(p.article), now]
      });
    }

    // 9. Site Settings
    batchStatements.push({ sql: 'DELETE FROM site_settings;', args: [] });
    for (const [origin, s] of Object.entries(state.siteSettings)) {
      batchStatements.push({
        sql: `INSERT INTO site_settings (
          origin, javascript_enabled, ad_block_whitelisted, camera_allowed,
          microphone_allowed, geolocation_allowed, notifications_allowed, popups_allowed, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          origin,
          s.javascriptEnabled ? 1 : 0,
          s.adBlockWhitelisted ? 1 : 0,
          s.cameraAllowed ? 1 : 0,
          s.microphoneAllowed ? 1 : 0,
          s.geolocationAllowed ? 1 : 0,
          s.notificationsAllowed ? 1 : 0,
          s.popupsAllowed ? 1 : 0,
          now
        ]
      });
    }

    // 10. Privacy Stats
    batchStatements.push({
      sql: `INSERT INTO privacy_stats (id, total_blocked_count, estimated_bytes_saved, estimated_time_saved_ms, by_category_json, updated_at)
            VALUES (1, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              total_blocked_count = excluded.total_blocked_count,
              estimated_bytes_saved = excluded.estimated_bytes_saved,
              estimated_time_saved_ms = excluded.estimated_time_saved_ms,
              by_category_json = excluded.by_category_json,
              updated_at = excluded.updated_at;`,
      args: [
        state.privacyStats.totalBlockedCount,
        state.privacyStats.estimatedBytesSaved,
        state.privacyStats.estimatedTimeSavedMs,
        JSON.stringify(state.privacyStats.byCategory),
        now
      ]
    });

    // Execute in batch transactions
    const chunkSize = 200;
    for (let i = 0; i < batchStatements.length; i += chunkSize) {
      const chunk = batchStatements.slice(i, i + chunkSize);
      await this.client.batch(chunk, 'write');
    }
  }

  async recordHistoryVisit(entry: HistoryEntry): Promise<void> {
    await this.init();
    const now = Date.now();
    await this.client.execute({
      sql: `INSERT INTO history (entry_id, title, url, timestamp, space_id, visit_count, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(url) DO UPDATE SET
              title = excluded.title,
              timestamp = excluded.timestamp,
              space_id = excluded.space_id,
              visit_count = history.visit_count + 1,
              updated_at = excluded.updated_at;`,
      args: [entry.id || crypto.randomUUID(), entry.title, entry.url, entry.timestamp, entry.spaceId ?? null, now]
    });
  }

  async searchOmnibar(
    query: string,
    limit = 8
  ): Promise<{ history: HistoryEntry[]; bookmarks: SpeedDialItem[] }> {
    await this.init();
    const cleanQuery = query.trim().replace(/['"*\\]/g, '');
    if (!cleanQuery) return { history: [], bookmarks: [] };

    const ftsPattern = `${cleanQuery}*`;

    try {
      const historyRes = await this.client.execute({
        sql: `SELECT h.entry_id, h.title, h.url, h.timestamp, h.space_id, h.visit_count
              FROM history_fts fts
              JOIN history h ON h.id = fts.rowid
              WHERE history_fts MATCH ?
              ORDER BY h.visit_count DESC, h.timestamp DESC
              LIMIT ?;`,
        args: [ftsPattern, limit]
      });

      const bookmarksRes = await this.client.execute({
        sql: `SELECT b.id, b.title, b.url, b.icon_asset, b.badge_color_hex, b.badge_color
              FROM bookmarks_fts fts
              JOIN bookmarks b ON b.rowid = fts.rowid
              WHERE bookmarks_fts MATCH ?
              LIMIT ?;`,
        args: [ftsPattern, limit]
      });

      return {
        history: historyRes.rows.map((r) => ({
          id: String(r.entry_id),
          title: String(r.title),
          url: String(r.url),
          timestamp: Number(r.timestamp),
          spaceId: r.space_id ? String(r.space_id) : null
        })),
        bookmarks: bookmarksRes.rows.map((r) => ({
          id: String(r.id),
          title: String(r.title),
          url: String(r.url),
          iconAsset: r.icon_asset ? String(r.icon_asset) : undefined,
          badgeColorHex: String(r.badge_color_hex),
          badgeColor: Number(r.badge_color)
        }))
      };
    } catch {
      // Fallback to LIKE if FTS query syntax issues arise
      const likePattern = `%${cleanQuery}%`;
      const historyRes = await this.client.execute({
        sql: `SELECT entry_id, title, url, timestamp, space_id, visit_count
              FROM history
              WHERE title LIKE ? OR url LIKE ?
              ORDER BY visit_count DESC, timestamp DESC
              LIMIT ?;`,
        args: [likePattern, likePattern, limit]
      });
      const bookmarksRes = await this.client.execute({
        sql: `SELECT id, title, url, icon_asset, badge_color_hex, badge_color
              FROM bookmarks
              WHERE title LIKE ? OR url LIKE ?
              LIMIT ?;`,
        args: [likePattern, likePattern, limit]
      });

      return {
        history: historyRes.rows.map((r) => ({
          id: String(r.entry_id),
          title: String(r.title),
          url: String(r.url),
          timestamp: Number(r.timestamp),
          spaceId: r.space_id ? String(r.space_id) : null
        })),
        bookmarks: bookmarksRes.rows.map((r) => ({
          id: String(r.id),
          title: String(r.title),
          url: String(r.url),
          iconAsset: r.icon_asset ? String(r.icon_asset) : undefined,
          badgeColorHex: String(r.badge_color_hex),
          badgeColor: Number(r.badge_color)
        }))
      };
    }
  }

  async mergeAndroidCompatibleBackup(
    backup: TesseraAndroidCompatibleBackup,
    currentState: PersistedAppState
  ): Promise<{
    nextState: PersistedAppState;
    importedBookmarks: number;
    importedHistory: number;
    importedSpaces: number;
  }> {
    await this.init();
    const now = Date.now();

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

    if (Array.isArray(backup.bookmarks)) {
      for (const b of backup.bookmarks) {
        if (!b || typeof b.url !== 'string' || !b.url.trim()) continue;
        const normUrl = b.url.toLowerCase();
        if (!existingBookmarkUrls.has(normUrl)) {
          existingBookmarkUrls.add(normUrl);
          const argb = typeof b.badgeColor === 'number' ? b.badgeColor : 0xff0288d1;
          const matchedBrand = Object.entries(brandMap).find(([domain]) => normUrl.includes(domain));
          const newBookmark: SpeedDialItem = {
            id: b.id || crypto.randomUUID(),
            title: b.title || b.url,
            url: b.url,
            iconAsset: matchedBrand?.[1],
            badgeColor: argb,
            badgeColorHex: argbToHex(argb),
            spaceId: b.spaceId || null
          };
          mergedBookmarks.push(newBookmark);
          importedBookmarksCount++;
        }
      }
    }

    // 2. Non-destructive merge of History (match by normalized URL)
    let importedHistoryCount = 0;
    const existingHistoryUrls = new Set(currentState.history.map((h) => h.url.toLowerCase()));
    const mergedHistory = [...currentState.history];

    if (Array.isArray(backup.history)) {
      for (const h of backup.history) {
        if (!h || typeof h.url !== 'string' || !h.url.trim()) continue;
        const normUrl = h.url.toLowerCase();
        if (!existingHistoryUrls.has(normUrl)) {
          existingHistoryUrls.add(normUrl);
          mergedHistory.push({
            id: h.id || crypto.randomUUID(),
            title: h.title || '',
            url: h.url,
            timestamp: typeof h.timestamp === 'number' ? h.timestamp : now,
            spaceId: h.spaceId && h.spaceId.trim() ? h.spaceId : null
          });
          importedHistoryCount++;
        }
      }
    }

    // 3. Non-destructive merge of Spaces (match by ID or Name)
    let importedSpacesCount = 0;
    const existingSpaceIds = new Set(currentState.spaces.map((s) => s.id));
    const existingSpaceNames = new Set(currentState.spaces.map((s) => s.name.toLowerCase()));
    const mergedSpaces = [...currentState.spaces];

    if (Array.isArray(backup.spaces)) {
      for (const s of backup.spaces) {
        if (!s || typeof s.id !== 'string' || !s.name) continue;
        if (!existingSpaceIds.has(s.id) && !existingSpaceNames.has(s.name.toLowerCase())) {
          existingSpaceIds.add(s.id);
          existingSpaceNames.add(s.name.toLowerCase());
          const argb = typeof s.colorArgb === 'number' ? s.colorArgb : 0xff0288d1;
          mergedSpaces.push({
            id: s.id,
            name: s.name,
            iconEmoji: s.iconEmoji || '🌐',
            colorArgb: argb,
            colorHex: argbToHex(argb),
            isDefault: Boolean(s.isDefault)
          });
          importedSpacesCount++;
        }
      }
    }

    // 4. Settings merge (only if present in backup)
    const nextSettings = { ...currentState.settings };
    if (backup.settings && typeof backup.settings === 'object') {
      if (typeof backup.settings.isDarkMode === 'boolean') nextSettings.isDarkMode = backup.settings.isDarkMode;
      if (typeof backup.settings.forceDarkPages === 'boolean') nextSettings.forceDarkPages = backup.settings.forceDarkPages;
      if (typeof backup.settings.adBlockEnabled === 'boolean') nextSettings.adBlockEnabled = backup.settings.adBlockEnabled;
      if (typeof backup.settings.cookieBlockerEnabled === 'boolean') {
        nextSettings.cookieBlockerEnabled = backup.settings.cookieBlockerEnabled;
      }
      if (typeof backup.settings.searchEngine === 'string') {
        nextSettings.searchEngine = normalizeSearchEngineId(backup.settings.searchEngine);
      }
      if (typeof backup.settings.selectedWallpaperId === 'string') {
        nextSettings.selectedWallpaperId = backup.settings.selectedWallpaperId;
      }
      if (typeof backup.settings.showWeatherWidget === 'boolean') {
        nextSettings.showWeatherWidget = backup.settings.showWeatherWidget;
      }
      if (typeof backup.settings.showQuotesWidget === 'boolean') {
        nextSettings.showQuotesWidget = backup.settings.showQuotesWidget;
      }
    }

    const nextState: PersistedAppState = {
      ...currentState,
      speedDialItems: mergedBookmarks,
      history: mergedHistory,
      spaces: mergedSpaces,
      settings: nextSettings
    };

    // Save to SQLite
    await this.saveFullState(nextState);

    return {
      nextState,
      importedBookmarks: importedBookmarksCount,
      importedHistory: importedHistoryCount,
      importedSpaces: importedSpacesCount
    };
  }

  async close(): Promise<void> {
    this.client.close();
  }
}
