import fs from 'node:fs';
import path from 'node:path';
import type { PersistedAppState } from '../../src/shared/types';
import type { SqliteDatabase } from './sqliteDatabase';
import type { AssetStore } from './assetStore';

export class LegacyMigrator {
  private readonly legacyJsonPath: string;
  private readonly backupJsonPath: string;
  private readonly sqliteDb: SqliteDatabase;
  private readonly assetStore: AssetStore;

  constructor(userDataDir: string, sqliteDb: SqliteDatabase, assetStore: AssetStore) {
    this.legacyJsonPath = path.join(userDataDir, 'tessera_state_v1.json');
    this.backupJsonPath = path.join(userDataDir, 'tessera_state_v1.json.migrated.bak');
    this.sqliteDb = sqliteDb;
    this.assetStore = assetStore;
  }

  async migrateIfNeeded(defaultStateFactory: () => PersistedAppState): Promise<PersistedAppState> {
    await this.sqliteDb.init();

    const isDbEmpty = await this.sqliteDb.isDatabaseEmpty();

    // If SQLite already has data, load it directly
    if (!isDbEmpty) {
      const state = await this.sqliteDb.loadFullState();
      if (state) {
        return state;
      }
    }

    // Check if legacy JSON file exists to migrate
    if (fs.existsSync(this.legacyJsonPath)) {
      try {
        console.log('[LegacyMigrator] Found legacy tessera_state_v1.json, starting migration to SQLite...');
        const raw = fs.readFileSync(this.legacyJsonPath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
        const defaults = defaultStateFactory();

        const migratedState: PersistedAppState = {
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
          tabs:
            Array.isArray(parsed.tabs) && parsed.tabs.filter((t) => !t.isIncognito).length > 0
              ? parsed.tabs.filter((t) => !t.isIncognito)
              : defaults.tabs
        };

        // Extract custom wallpaper if base64
        if (migratedState.settings.customWallpaperDataUrl?.startsWith('data:image')) {
          const rel = this.assetStore.saveCustomWallpaper(migratedState.settings.customWallpaperDataUrl);
          if (rel) {
            migratedState.settings.customWallpaperDataUrl = rel;
          }
        }

        // Extract tab thumbnails if base64
        for (const tab of migratedState.tabs) {
          if (tab.thumbnailDataUrl?.startsWith('data:image')) {
            const rel = this.assetStore.saveThumbnail(tab.id, tab.thumbnailDataUrl);
            tab.thumbnailDataUrl = rel;
          }
        }

        // Save to SQLite
        await this.sqliteDb.saveFullState(migratedState);

        // Rename legacy file to avoid re-migrating
        try {
          fs.renameSync(this.legacyJsonPath, this.backupJsonPath);
        } catch (renameErr) {
          console.warn('[LegacyMigrator] Could not rename legacy file:', renameErr);
        }

        console.log('[LegacyMigrator] Migration to SQLite completed successfully!');
        return migratedState;
      } catch (err) {
        console.error('[LegacyMigrator] Migration failed, falling back to defaults:', err);
      }
    }

    // Fresh install or migration failed: initialize SQLite with defaults
    const defaults = defaultStateFactory();
    await this.sqliteDb.saveFullState(defaults);
    return defaults;
  }
}
