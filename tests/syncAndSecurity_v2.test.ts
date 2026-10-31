import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { PinCrypto } from '../electron/security/pinCrypto';
import { TesseraSyncService } from '../electron/sync/tesseraSyncService';
import { LanDiscoveryBeacon } from '../electron/sync/lanDiscovery';
import { SqliteDatabase } from '../electron/database/sqliteDatabase';
import { AssetStore } from '../electron/database/assetStore';

describe('Fase 3 & 4: Tessera Sync Protocol & Segurança Criptográfica', () => {
  describe('PinCrypto (Blindagem de Autenticação Anônima)', () => {
    it('gera hash seguro com scrypt e salt aleatório', () => {
      const pin = '1234';
      const hash1 = PinCrypto.hashPin(pin);
      const hash2 = PinCrypto.hashPin(pin);

      expect(hash1).toContain(':');
      expect(hash2).toContain(':');
      // Dois hashes do mesmo PIN devem ser diferentes devido ao salt aleatório
      expect(hash1).not.toBe(hash2);

      expect(PinCrypto.verifyPin('1234', hash1)).toBe(true);
      expect(PinCrypto.verifyPin('1234', hash2)).toBe(true);
      expect(PinCrypto.verifyPin('9999', hash1)).toBe(false);
    });

    it('mantém retrocompatibilidade com hashes legados em Base64 (btoa)', () => {
      const legacyHash = Buffer.from('4321').toString('base64');
      expect(PinCrypto.verifyPin('4321', legacyHash)).toBe(true);
      expect(PinCrypto.verifyPin('1111', legacyHash)).toBe(false);
    });
  });

  describe('LanDiscoveryBeacon', () => {
    it('gera payload de beacon compatível com Android', () => {
      const beacon = new LanDiscoveryBeacon(41828, 'win_pc_test');
      const payload = beacon.getBeaconPayload();

      expect(payload.deviceId).toBe('win_pc_test');
      expect(payload.port).toBe(41828);
      expect(payload.platform).toBe('windows');
      expect(payload.version).toBe('2.0.0');
    });
  });

  describe('TesseraSyncService (HTTP/REST)', () => {
    let tempDir: string;
    let sqliteDb: SqliteDatabase;
    let assetStore: AssetStore;
    let syncService: TesseraSyncService;
    let receivedUrl: string | null = null;
    let servicePort = 41850;

    beforeEach(async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tessera-sync-test-'));
      assetStore = new AssetStore(tempDir);
      sqliteDb = new SqliteDatabase(tempDir, assetStore);
      await sqliteDb.init();

      syncService = new TesseraSyncService({
        sqliteDb,
        getCurrentTabs: () => [
          {
            id: 'tab-open-1',
            url: 'https://news.ycombinator.com',
            title: 'Hacker News',
            isHomePage: false,
            canGoBack: true,
            canGoForward: false,
            isPinned: false,
            lastAccessedTimestamp: Date.now(),
            groupId: null,
            spaceId: 'space_general'
          }
        ],
        onOpenReceivedUrl: (url) => {
          receivedUrl = url;
        }
      });

      const res = await syncService.start(0);
      servicePort = res.port;
    });

    afterEach(async () => {
      syncService.stop();
      await sqliteDb.close();
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    });

    const makeRequest = (
      method: string,
      pathname: string,
      body?: any
    ): Promise<{ status: number; data: any }> => {
      return new Promise((resolve, reject) => {
        const payloadStr = body ? JSON.stringify(body) : '';
        const headers: Record<string, string | number> = {
          'Content-Type': 'application/json'
        };
        if (body) {
          headers['Content-Length'] = Buffer.byteLength(payloadStr);
        }

        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: servicePort,
            path: pathname,
            method,
            headers
          },
          (res) => {
            let resBody = '';
            res.on('data', (c) => (resBody += c));
            res.on('end', () => {
              try {
                resolve({ status: res.statusCode || 500, data: JSON.parse(resBody) });
              } catch {
                resolve({ status: res.statusCode || 500, data: resBody });
              }
            });
          }
        );
        req.on('error', reject);
        if (body) req.write(payloadStr);
        req.end();
      });
    };

    it('responde a /api/v2/info com identificação do dispositivo', async () => {
      const res = await makeRequest('GET', '/api/v2/info');
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
      expect(res.data.platform).toBe('windows');
      expect(res.data.version).toBe('2.0.0');
    });

    it('rejeita pareamento com chave incorreta e aceita com chave válida', async () => {
      const info = syncService.getServerInfo();

      // Chave errada
      const failRes = await makeRequest('POST', '/api/v2/pair', {
        pairingSecret: 'chave_errada'
      });
      expect(failRes.status).toBe(401);

      // Chave certa
      const okRes = await makeRequest('POST', '/api/v2/pair', {
        deviceId: 'android_galaxy',
        deviceName: 'Samsung Galaxy S24',
        pairingSecret: info.pairingSecret
      });
      expect(okRes.status).toBe(200);
      expect(okRes.data.ok).toBe(true);
      expect(okRes.data.sharedSecret).toBeDefined();
    });

    it('recebe aba enviada pelo celular via /api/v2/send-tab e abre no PC', async () => {
      const res = await makeRequest('POST', '/api/v2/send-tab', {
        url: 'https://tessera.app/docs',
        title: 'Tessera Docs'
      });

      expect(res.status).toBe(200);
      expect(res.data.ok).toBe(true);
      expect(receivedUrl).toBe('https://tessera.app/docs');
    });

    it('retorna snapshot de abas abertas no PC via /api/v2/tabs', async () => {
      const res = await makeRequest('GET', '/api/v2/tabs');
      expect(res.status).toBe(200);
      expect(res.data.ok).toBe(true);
      expect(res.data.tabs.length).toBe(1);
      expect(res.data.tabs[0].url).toBe('https://news.ycombinator.com');
    });
  });
});
