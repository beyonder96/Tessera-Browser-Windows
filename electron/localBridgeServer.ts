import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import type { LocalBridgeStatus } from '../src/shared/types';

function detectLocalLanIp(): string {
  const nets = os.networkInterfaces();
  const candidates: string[] = [];

  for (const [name, entries] of Object.entries(nets)) {
    if (!entries) continue;
    const lowerName = name.toLowerCase();
    // Skip WSL/Hyper-V/VirtualBox virtual adapters if real Wi-Fi/Ethernet exists
    const isVirtual =
      lowerName.includes('vethernet') ||
      lowerName.includes('wsl') ||
      lowerName.includes('virtual') ||
      lowerName.includes('vmware') ||
      lowerName.includes('loopback');

    for (const net of entries) {
      if (net.family === 'IPv4' && !net.internal) {
        if (!isVirtual) {
          return net.address;
        }
        candidates.push(net.address);
      }
    }
  }

  return candidates[0] || '127.0.0.1';
}

export interface LocalBridgeCallbacks {
  getActivePageInfo: () => { url: string; title: string };
  getBackupJson: () => string;
  onReceiveUrlFromPhone: (url: string) => void;
  onReceiveBackupFromPhone: (rawJson: string) => { importedBookmarks: number; importedHistory: number; importedSpaces: number };
  onStatusChanged: (status: LocalBridgeStatus) => void;
}

/**
 * Ponte Wi-Fi Local Android <-> Windows via QR Code
 * Permite enviar/receber abas e importar/exportar tessera_backup_*.json direto pelo navegador do celular sem cabos.
 */
export class LocalBridgeServer {
  private server: http.Server | null = null;
  private token: string | null = null;
  private port: number | null = null;
  private url: string | null = null;
  private connectedClients = 0;
  private lastReceivedMessage: string | null = null;
  private callbacks: LocalBridgeCallbacks;

  constructor(callbacks: LocalBridgeCallbacks) {
    this.callbacks = callbacks;
  }

  getStatus(): LocalBridgeStatus {
    return {
      running: Boolean(this.server),
      url: this.url,
      token: this.token,
      port: this.port,
      connectedClients: this.connectedClients,
      lastReceivedMessage: this.lastReceivedMessage
    };
  }

  async start(): Promise<LocalBridgeStatus> {
    if (this.server) {
      return this.getStatus();
    }

    this.token = crypto.randomBytes(12).toString('hex');
    this.connectedClients = 0;
    this.lastReceivedMessage = null;

    this.server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url || '/', 'http://localhost');
        const reqToken = parsedUrl.searchParams.get('token');

        if (!this.token || reqToken !== this.token) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Acesso negado: token inválido ou sessão expirada.');
          return;
        }

        if (req.method === 'GET' && parsedUrl.pathname === '/') {
          this.connectedClients += 1;
          this.callbacks.onStatusChanged(this.getStatus());
          const active = this.callbacks.getActivePageInfo();
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.renderMobileBridgeHtml(this.token, active.url, active.title));
          return;
        }

        if (req.method === 'GET' && parsedUrl.pathname === '/download-pc-backup') {
          const backupJson = this.callbacks.getBackupJson();
          const fileName = `tessera_backup_windows_${Date.now()}.json`;
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${fileName}"`
          });
          res.end(backupJson);
          return;
        }

        if (req.method === 'POST' && parsedUrl.pathname === '/send-url') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 32_000) req.destroy();
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body) as { url?: string };
              if (payload.url && payload.url.trim()) {
                this.lastReceivedMessage = `Aba recebida do Android: ${payload.url.trim()}`;
                this.callbacks.onReceiveUrlFromPhone(payload.url.trim());
                this.callbacks.onStatusChanged(this.getStatus());
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true }));
                return;
              }
            } catch {
              // Fallthrough
            }
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'URL inválida' }));
          });
          return;
        }

        if (req.method === 'POST' && parsedUrl.pathname === '/upload-backup') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 15_000_000) req.destroy();
          });
          req.on('end', () => {
            try {
              const stats = this.callbacks.onReceiveBackupFromPhone(body);
              this.lastReceivedMessage = `Backup Android sincronizado! (${stats.importedBookmarks} favoritos, ${stats.importedHistory} itens de histórico)`;
              this.callbacks.onStatusChanged(this.getStatus());
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: true, ...stats }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Arquivo inválido' }));
            }
          });
          return;
        }

        res.writeHead(404);
        res.end('Not Found');
      } catch {
        res.writeHead(500);
        res.end('Internal Error');
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '0.0.0.0', () => resolve());
    });

    const addr = this.server.address();
    this.port = typeof addr === 'object' && addr ? addr.port : null;
    const ip = detectLocalLanIp();
    this.url = `http://${ip}:${this.port}/?token=${this.token}`;

    const status = this.getStatus();
    this.callbacks.onStatusChanged(status);
    return status;
  }

  stop(): LocalBridgeStatus {
    if (this.server) {
      try {
        this.server.close();
      } catch {
        // Ignore
      }
      this.server = null;
    }
    this.token = null;
    this.port = null;
    this.url = null;
    const status = this.getStatus();
    this.callbacks.onStatusChanged(status);
    return status;
  }

  private renderMobileBridgeHtml(token: string, pcUrl: string, pcTitle: string): string {
    const safeUrl = pcUrl.replace(/"/g, '&quot;');
    const safeTitle = pcTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>Ponte Tessera — Android ↔ Windows</title>
  <style>
    body { background:#000; color:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; margin:0; padding:24px 18px; }
    .card { background:#141416; border:1px solid #2C2C32; border-radius:22px; padding:18px; margin-bottom:16px; }
    h1 { font-size:20px; margin:0 0 6px; letter-spacing:0.5px; }
    p { font-size:13.5px; color:rgba(235,235,245,0.75); margin:0 0 14px; line-height:1.45; }
    .btn { display:block; width:100%; background:#0A84FF; color:#fff; border:none; border-radius:999px; padding:13px 16px; font-size:14.5px; font-weight:600; text-align:center; text-decoration:none; box-sizing:border-box; cursor:pointer; }
    .btn-sec { background:#1E1E22; border:1px solid #2C2C32; margin-top:10px; }
    input[type="text"] { width:100%; background:#1E1E22; border:1px solid #2C2C32; color:#fff; border-radius:14px; padding:12px; font-size:14px; box-sizing:border-box; margin-bottom:10px; }
    .toast { margin-top:10px; font-size:13px; color:#34C759; min-height:18px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>TESSERA BRIDGE</h1>
    <p>Conectado via Wi-Fi local ao <b>Tessera Browser for Windows</b>.</p>
    ${
      pcUrl && pcUrl.startsWith('http')
        ? `<a class="btn" href="${safeUrl}">Abrir aba atual do PC: ${safeTitle || 'Abrir Link'}</a>`
        : ''
    }
  </div>

  <div class="card">
    <h1>Enviar Link para o PC</h1>
    <p>Cole um link para abrir uma nova guia imediatamente no Windows:</p>
    <input id="urlInput" type="text" placeholder="https://..." />
    <button class="btn" onclick="sendUrl()">Abrir no Tessera Windows</button>
    <div id="urlStatus" class="toast"></div>
  </div>

  <div class="card">
    <h1>Sincronizar Backup JSON</h1>
    <p>Importe seu arquivo <code>tessera_backup_*.json</code> exportado do Tessera Android ou baixe o backup do PC:</p>
    <input id="fileInput" type="file" accept=".json,application/json" style="display:none" onchange="uploadBackup(this)" />
    <button class="btn" onclick="document.getElementById('fileInput').click()">Enviar Backup do Celular para o PC</button>
    <a class="btn btn-sec" href="/download-pc-backup?token=${token}">Baixar Backup do PC no Celular</a>
    <div id="backupStatus" class="toast"></div>
  </div>

  <script>
    async function sendUrl() {
      const val = document.getElementById('urlInput').value.trim();
      if (!val) return;
      const res = await fetch('/send-url?token=${token}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: val })
      });
      const json = await res.json();
      document.getElementById('urlStatus').textContent = json.ok ? '✓ Aba aberta no Windows!' : ('Erro: ' + json.error);
      if (json.ok) document.getElementById('urlInput').value = '';
    }
    async function uploadBackup(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const text = await file.text();
      const res = await fetch('/upload-backup?token=${token}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text
      });
      const json = await res.json();
      document.getElementById('backupStatus').textContent = json.ok
        ? ('✓ Backup sincronizado! (' + json.importedBookmarks + ' favoritos, ' + json.importedHistory + ' históricos)')
        : ('Erro: ' + json.error);
    }
  </script>
</body>
</html>`;
  }
}
