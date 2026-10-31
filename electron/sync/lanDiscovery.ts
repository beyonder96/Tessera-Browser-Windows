import dgram from 'node:dgram';
import os from 'node:os';

export interface LanBeaconInfo {
  deviceId: string;
  deviceName: string;
  port: number;
  platform: 'windows' | 'android';
  version: string;
}

export class LanDiscoveryBeacon {
  private socket: dgram.Socket | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private readonly port: number;
  private readonly beaconPort = 41820;
  private readonly deviceId: string;
  private readonly deviceName: string;

  constructor(httpPort: number, deviceId?: string) {
    this.port = httpPort;
    this.deviceId = deviceId || `win_${os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    this.deviceName = `${os.hostname()} (Tessera Windows)`;
  }

  getBeaconPayload(): LanBeaconInfo {
    return {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      port: this.port,
      platform: 'windows',
      version: '2.0.0'
    };
  }

  start(): void {
    if (this.socket) return;

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.on('error', (err) => {
        console.warn('[LanDiscovery] UDP socket error:', err.message);
      });

      this.socket.on('message', (msg, rinfo) => {
        try {
          const text = msg.toString('utf-8').trim();
          if (text === 'TESSERA_DISCOVERY_QUERY') {
            const reply = Buffer.from(JSON.stringify(this.getBeaconPayload()));
            this.socket?.send(reply, 0, reply.length, rinfo.port, rinfo.address);
          }
        } catch {
          // Ignore invalid UDP packet
        }
      });

      this.socket.bind(this.beaconPort, () => {
        try {
          this.socket?.setBroadcast(true);
        } catch {}

        // Periodically broadcast presence beacon every 8 seconds
        this.broadcastInterval = setInterval(() => {
          this.broadcastPresence();
        }, 8000);

        // Immediate first broadcast
        this.broadcastPresence();
      });
    } catch (err) {
      console.warn('[LanDiscovery] Could not initialize UDP beacon:', err);
    }
  }

  broadcastPresence(): void {
    if (!this.socket) return;
    try {
      const payload = Buffer.from(JSON.stringify({ type: 'TESSERA_PRESENCE_BEACON', ...this.getBeaconPayload() }));
      this.socket.send(payload, 0, payload.length, this.beaconPort, '255.255.255.255');
    } catch {
      // Ignore broadcast send failure (e.g. offline interface)
    }
  }

  stop(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }
}
