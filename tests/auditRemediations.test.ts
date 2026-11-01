import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AssetStore } from '../electron/database/assetStore';
import { SqliteDatabase } from '../electron/database/sqliteDatabase';
import { PinCrypto } from '../electron/security/pinCrypto';
import { createDefaultPersistedState } from '../electron/storageService';

describe('Auditoria Completa — Validação de Remediações (Frentes 1 a 5)', () => {
  let tempDir: string;
  let assetStore: AssetStore;
  let sqliteDb: SqliteDatabase;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tessera-audit-test-'));
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

  describe('Frente 1: Persistência SQLite & AssetStore', () => {
    it('insere favorito com colunas reais sem quebrar e faz busca FTS5 com pontuação', async () => {
      await sqliteDb.init();
      await sqliteDb.insertBookmark({
        id: 'bm-test-1',
        title: 'GitHub Repositório',
        url: 'https://github.com/beyonder96/tessera',
        badgeColorHex: '#4285F4',
        badgeColor: 0xff4285f4,
        spaceId: 'space_general'
      });

      // Busca com pontuação que antes quebrava o FTS5
      const searchRes = await sqliteDb.searchOmnibar('https://github.com/beyonder96', 5);
      expect(searchRes.bookmarks.length).toBeGreaterThanOrEqual(1);
      expect(searchRes.bookmarks[0].title).toBe('GitHub Repositório');
      expect(searchRes.bookmarks[0].url).toBe('https://github.com/beyonder96/tessera');
    });

    it('persiste e re-hidrata readerHighlights e customWallpaperDataUrl', async () => {
      await sqliteDb.init();
      const state = createDefaultPersistedState();

      // Salva wallpaper customizado
      const fakePng = 'data:image/png;base64,' + Buffer.from('png-bytes').toString('base64');
      state.settings.customWallpaperDataUrl = fakePng;

      // Adiciona highlights no Reader Mode
      state.readerHighlights = {
        'page-123': {
          0: '#FFE600',
          2: '#00FF66'
        }
      };

      await sqliteDb.saveFullState(state);

      const loaded = await sqliteDb.loadFullState();
      expect(loaded).not.toBeNull();
      // O wallpaper deve ter sido re-hidratado de volta para data URL
      expect(loaded?.settings.customWallpaperDataUrl).toContain('data:image/');

      // As marcações de leitura devem ter sido preservadas
      expect(loaded?.readerHighlights?.['page-123']).toBeDefined();
      expect(loaded?.readerHighlights?.['page-123'][0]).toBe('#FFE600');
      expect(loaded?.readerHighlights?.['page-123'][2]).toBe('#00FF66');
    });

    it('executa deleções atômicas de histórico, downloads e favoritos', async () => {
      await sqliteDb.init();
      const baseState = createDefaultPersistedState();
      await sqliteDb.saveFullState(baseState);

      await sqliteDb.recordHistoryVisit({
        id: 'h-del-1',
        title: 'Página Temporária',
        url: 'https://exemplo.com/temp',
        timestamp: Date.now(),
        spaceId: 'space_general'
      });

      let results = await sqliteDb.searchOmnibar('exemplo', 5);
      expect(results.history.length).toBe(1);

      await sqliteDb.deleteHistoryItem('h-del-1');
      results = await sqliteDb.searchOmnibar('exemplo', 5);
      expect(results.history.length).toBe(0);

      await sqliteDb.clearHistory();
      const loaded = await sqliteDb.loadFullState();
      expect(loaded?.history.length).toBe(0);
    });

    it('bloqueia tentativas de path traversal em miniaturas e papéis de parede', () => {
      const maliciousPath = '../../../../Windows/System32/drivers/etc/hosts';
      const thumb = assetStore.getThumbnailDataUrl(maliciousPath);
      expect(thumb).toBeNull();

      const wallpaper = assetStore.getCustomWallpaperDataUrl(maliciousPath);
      expect(wallpaper).toBeNull();
    });
  });

  describe('Frente 4: Sync & Criptografia de PIN', () => {
    it('salva e recupera dispositivos pareados no SQLite', async () => {
      await sqliteDb.init();
      await sqliteDb.savePairedDevice({
        deviceId: 'android_s24_ultra',
        deviceName: 'Galaxy S24 Ultra',
        platform: 'android',
        sharedSecret: 'secret_abc123',
        lastSeenAt: Date.now()
      });

      const devices = await sqliteDb.getPairedDevices();
      expect(devices.length).toBe(1);
      expect(devices[0].deviceId).toBe('android_s24_ultra');
      expect(devices[0].deviceName).toBe('Galaxy S24 Ultra');
      expect(devices[0].sharedSecret).toBe('secret_abc123');
    });

    it('gera e valida hash scrypt com salt seguro no PinCrypto', () => {
      const pin = '9876';
      const hash = PinCrypto.hashPin(pin);

      expect(hash).toContain(':');
      expect(PinCrypto.verifyPin('9876', hash)).toBe(true);
      expect(PinCrypto.verifyPin('0000', hash)).toBe(false);
      expect(PinCrypto.verifyPin('1234', hash)).toBe(false);

      // Compatibilidade retroativa com base64
      const legacyBase64 = Buffer.from('4321').toString('base64');
      expect(PinCrypto.verifyPin('4321', legacyBase64)).toBe(true);
      expect(PinCrypto.verifyPin('9999', legacyBase64)).toBe(false);
    });
  });
});
