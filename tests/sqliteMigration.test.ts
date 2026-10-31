import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AssetStore } from '../electron/database/assetStore';
import { SqliteDatabase } from '../electron/database/sqliteDatabase';
import { LegacyMigrator } from '../electron/database/legacyMigrator';
import { createDefaultPersistedState } from '../electron/storageService';
import type { PersistedAppState } from '../src/shared/types';

describe('Fase 1: Motor SQLite & Asset Store em Disco', () => {
  let tempDir: string;
  let assetStore: AssetStore;
  let sqliteDb: SqliteDatabase;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tessera-sqlite-test-'));
    assetStore = new AssetStore(tempDir);
    sqliteDb = new SqliteDatabase(tempDir, assetStore);
  });

  afterEach(async () => {
    await sqliteDb.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('AssetStore', () => {
    it('salva miniatura base64 como arquivo no disco e retorna caminho relativo limpo', () => {
      const fakeBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake-image-bytes').toString('base64');
      const relPath = assetStore.saveThumbnail('tab-123', fakeBase64);

      expect(relPath).toBe('assets/thumbnails/tab_tab_123.jpg');
      const fullPath = path.join(tempDir, relPath!);
      expect(fs.existsSync(fullPath)).toBe(true);
      expect(fs.readFileSync(fullPath).toString()).toBe('fake-image-bytes');

      const dataUrl = assetStore.getThumbnailDataUrl(relPath);
      expect(dataUrl).toContain('data:image/jpeg;base64,');
    });

    it('remove miniaturas órfãs de abas que foram fechadas', () => {
      const fakeBase64 = 'data:image/jpeg;base64,' + Buffer.from('img').toString('base64');
      assetStore.saveThumbnail('tab-active', fakeBase64);
      assetStore.saveThumbnail('tab-closed', fakeBase64);

      // Limpa mantendo apenas tab-active
      assetStore.cleanOrphanThumbnails(['tab-active']);

      const activeFile = path.join(tempDir, 'assets/thumbnails/tab_tab_active.jpg');
      const closedFile = path.join(tempDir, 'assets/thumbnails/tab_tab_closed.jpg');

      expect(fs.existsSync(activeFile)).toBe(true);
      expect(fs.existsSync(closedFile)).toBe(false);
    });

    it('salva wallpaper customizado fora do JSON para evitar inchaço', () => {
      const fakeWallpaper = 'data:image/jpeg;base64,' + Buffer.from('wallpaper-data').toString('base64');
      const relPath = assetStore.saveCustomWallpaper(fakeWallpaper);

      expect(relPath).toContain('assets/wallpapers/custom_wallpaper_');
      const fullPath = path.join(tempDir, relPath!);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });

  describe('SqliteDatabase', () => {
    it('inicializa e persiste o estado completo sem corrupção', async () => {
      await sqliteDb.init();
      const initialState = createDefaultPersistedState();
      initialState.history.push({
        id: 'h-1',
        title: 'Documentação do React',
        url: 'https://react.dev',
        timestamp: Date.now(),
        spaceId: 'space_general'
      });

      await sqliteDb.saveFullState(initialState);
      const loaded = await sqliteDb.loadFullState();

      expect(loaded).not.toBeNull();
      expect(loaded?.spaces.length).toBe(initialState.spaces.length);
      expect(loaded?.history.length).toBe(1);
      expect(loaded?.history[0].url).toBe('https://react.dev');
      expect(loaded?.speedDialItems.length).toBe(initialState.speedDialItems.length);
    });

    it('busca instantaneamente na Omnibar via FTS5 por título ou URL', async () => {
      await sqliteDb.init();
      const state = createDefaultPersistedState();
      state.history = [
        {
          id: 'h-1',
          title: 'Notícias de Tecnologia — G1',
          url: 'https://g1.globo.com/tecnologia',
          timestamp: Date.now(),
          spaceId: null
        },
        {
          id: 'h-2',
          title: 'GitHub — Open Source Platform',
          url: 'https://github.com/beyonder96/tessera',
          timestamp: Date.now(),
          spaceId: null
        }
      ];

      await sqliteDb.saveFullState(state);

      const resultTech = await sqliteDb.searchOmnibar('Tecnologia');
      expect(resultTech.history.length).toBe(1);
      expect(resultTech.history[0].url).toBe('https://g1.globo.com/tecnologia');

      const resultGit = await sqliteDb.searchOmnibar('github');
      expect(resultGit.history.length).toBe(1);
      expect(resultGit.history[0].url).toContain('github.com');
    });

    it('incrementa visit_count ao registrar visitas repetidas no histórico', async () => {
      await sqliteDb.init();

      await sqliteDb.recordHistoryVisit({
        id: 'h-1',
        title: 'Tessera App',
        url: 'https://tessera.app',
        timestamp: 1000,
        spaceId: null
      });

      await sqliteDb.recordHistoryVisit({
        id: 'h-2',
        title: 'Tessera App — Novo Título',
        url: 'https://tessera.app',
        timestamp: 2000,
        spaceId: 'space_work'
      });

      const loaded = await sqliteDb.loadFullState();
      expect(loaded?.history.length).toBe(1);
      expect(loaded?.history[0].title).toBe('Tessera App — Novo Título');
      expect(loaded?.history[0].timestamp).toBe(2000);
      expect(loaded?.history[0].spaceId).toBe('space_work');
    });
  });

  describe('LegacyMigrator', () => {
    it('migra arquivo tessera_state_v1.json legado para o SQLite e cria backup .bak', async () => {
      const legacyJsonPath = path.join(tempDir, 'tessera_state_v1.json');
      const backupJsonPath = path.join(tempDir, 'tessera_state_v1.json.migrated.bak');

      const legacyState: PersistedAppState = createDefaultPersistedState();
      legacyState.history.push({
        id: 'h-legacy',
        title: 'Página Legada',
        url: 'https://legado.com',
        timestamp: Date.now(),
        spaceId: null
      });
      legacyState.tabs[0].thumbnailDataUrl =
        'data:image/jpeg;base64,' + Buffer.from('thumb-legado').toString('base64');
      legacyState.settings.customWallpaperDataUrl =
        'data:image/jpeg;base64,' + Buffer.from('wall-legado').toString('base64');

      fs.writeFileSync(legacyJsonPath, JSON.stringify(legacyState, null, 2), 'utf-8');

      const migrator = new LegacyMigrator(tempDir, sqliteDb, assetStore);
      const migrated = await migrator.migrateIfNeeded(createDefaultPersistedState);

      expect(migrated.history.some((h) => h.url === 'https://legado.com')).toBe(true);
      expect(fs.existsSync(backupJsonPath)).toBe(true);
      expect(fs.existsSync(legacyJsonPath)).toBe(false);

      // Verifica se o thumbnail e wallpaper foram extraídos para arquivos no disco
      const savedTab = migrated.tabs[0];
      expect(savedTab.thumbnailDataUrl).toContain('assets/thumbnails/');
      expect(migrated.settings.customWallpaperDataUrl).toContain('assets/wallpapers/');

      // Testa idempotência: rodar novamente deve carregar do SQLite sem re-migrar
      const secondLoad = await migrator.migrateIfNeeded(createDefaultPersistedState);
      expect(secondLoad.history.length).toBe(migrated.history.length);
    });
  });
});
