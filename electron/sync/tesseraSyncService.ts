import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import type { BrowserTab, PersistedAppState } from '../../src/shared/types';
import type { SqliteDatabase } from '../database/sqliteDatabase';
import { LanDiscoveryBeacon } from './lanDiscovery';

export interface TesseraSyncOptions {
  sqliteDb: SqliteDatabase;
  getCurrentTabs: () => BrowserTab[];
  onOpenReceivedUrl: (url: string, title?: string) => void;
  onDeviceConnected?: (deviceName: string) => void;
}

export interface PairedDeviceRecord {
  deviceId: string;
  deviceName: string;
  platform: string;
  sharedSecret: string;
  lastSeenAt: number;
}

export class TesseraSyncService {
  private server: http.Server | null = null;
  private beacon: LanDiscoveryBeacon | null = null;
  private readonly sqliteDb: SqliteDatabase;
  private readonly options: TesseraSyncOptions;
  private readonly serverDeviceId: string;
  private readonly pairingSecret: string;
  private port = 41828;
  private isRunning = false;

  constructor(options: TesseraSyncOptions) {
    this.options = options;
    this.sqliteDb = options.sqliteDb;
    this.serverDeviceId = `win_${os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    // Ephemeral pairing PIN/secret generated per session or until paired
    this.pairingSecret = crypto.randomBytes(16).toString('hex');
  }

  getServerInfo() {
    return {
      deviceId: this.serverDeviceId,
      deviceName: `${os.hostname()} (Tessera Windows)`,
      port: this.port,
      pairingSecret: this.pairingSecret,
      isRunning: this.isRunning
    };
  }

  async start(preferredPort = 41828): Promise<{ port: number; pairingSecret: string }> {
    if (this.isRunning && this.server) {
      return { port: this.port, pairingSecret: this.pairingSecret };
    }

    this.port = preferredPort;

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // CORS Headers for local LAN requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tessera-Device-Id');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        try {
          const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
          const pathname = url.pathname;

          // 1. Discovery / Info
          if (pathname === '/api/v2/info' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                status: 'ok',
                deviceId: this.serverDeviceId,
                deviceName: `${os.hostname()} (Tessera Windows)`,
                platform: 'windows',
                version: '2.0.0'
              })
            );
            return;
          }

          // 2. Initial Pairing
          if (pathname === '/api/v2/pair' && req.method === 'POST') {
            const body = await this.readRequestBody(req);
            const payload = JSON.parse(body) as {
              deviceId?: string;
              deviceName?: string;
              platform?: string;
              pairingSecret?: string;
            };

            if (payload.pairingSecret !== this.pairingSecret) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'Chave de pareamento incorreta.' }));
              return;
            }

            const deviceId = payload.deviceId || `android_${Date.now()}`;
            const deviceName = payload.deviceName || 'Tessera Android';
            const sharedSecret = crypto.randomBytes(32).toString('hex');

            // Persist paired device in SQLite
            await this.sqliteDb.init();
            await this.options.onDeviceConnected?.(deviceName);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                ok: true,
                serverDeviceId: this.serverDeviceId,
                serverDeviceName: `${os.hostname()} (Tessera Windows)`,
                sharedSecret
              })
            );
            return;
          }

          // 3. Send Tab to PC
          if (pathname === '/api/v2/send-tab' && req.method === 'POST') {
            const body = await this.readRequestBody(req);
            const payload = JSON.parse(body) as { url?: string; title?: string };

            if (!payload.url || !payload.url.startsWith('http')) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'URL inválida.' }));
              return;
            }

            this.options.onOpenReceivedUrl(payload.url, payload.title);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, message: 'Aba aberta no Windows com sucesso.' }));
            return;
          }

          // 4. Open Tabs Snapshot (consulta as abas ativas do PC)
          if (pathname === '/api/v2/tabs' && req.method === 'GET') {
            const tabs = this.options.getCurrentTabs().map((t) => ({
              id: t.id,
              title: t.title,
              url: t.url,
              spaceId: t.spaceId,
              isPinned: t.isPinned
            }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, tabs }));
            return;
          }

          // 5. Delta Sync
          if (pathname === '/api/v2/sync/delta' && req.method === 'POST') {
            const body = await this.readRequestBody(req);
            const deltaPayload = JSON.parse(body);

            // Se vier backup completo ou deltas parciais:
            const currentState = await this.sqliteDb.loadFullState();
            if (currentState && deltaPayload) {
              const mergeResult = await this.sqliteDb.mergeAndroidCompatibleBackup(deltaPayload, currentState);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  ok: true,
                  serverTimestamp: Date.now(),
                  importedBookmarks: mergeResult.importedBookmarks,
                  importedHistory: mergeResult.importedHistory,
                  importedSpaces: mergeResult.importedSpaces,
                  latestState: {
                    bookmarks: mergeResult.nextState.speedDialItems,
                    spaces: mergeResult.nextState.spaces
                  }
                })
              );
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, serverTimestamp: Date.now() }));
            return;
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Endpoint não encontrado.' }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro interno no servidor de sync.' }));
        }
      });

      this.server.on('error', (err) => {
        console.warn('[TesseraSyncService] Server error, trying fallback port:', err);
        if ((err as any).code === 'EADDRINUSE') {
          this.port++;
          this.server?.listen(this.port);
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        this.isRunning = true;
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        // Start UDP LAN beacon
        this.beacon = new LanDiscoveryBeacon(this.port, this.serverDeviceId);
        this.beacon.start();
        resolve({ port: this.port, pairingSecret: this.pairingSecret });
      });
    });
  }

  stop(): void {
    if (this.beacon) {
      this.beacon.stop();
      this.beacon = null;
    }
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = null;
    }
    this.isRunning = false;
  }

  private readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 20_000_000) {
          req.destroy();
          reject(new Error('Payload muito grande.'));
        }
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }
}
