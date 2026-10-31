import { session, type BrowserWindow } from 'electron';
import {
  BYTES_PER_BLOCKED_REQUEST,
  identifyTracker,
  isAdOrTracker,
  TIME_SAVED_PER_BLOCKED_MS
} from '../src/shared/privacyRules';
import type { SiteSettings, TrackerCategory } from '../src/shared/types';

export interface BlockedRequestPayload {
  name: string;
  host: string;
  pageOrigin: string;
  category: TrackerCategory;
  bytesSaved: number;
  timeSavedMs: number;
  timestamp: number;
}

export class PrivacyShieldController {
  private adBlockEnabled = true;
  private siteSettingsMap: Record<string, SiteSettings> = {};
  private configuredPartitions = new Set<string>();
  private getMainWindow: () => BrowserWindow | null;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
  }

  updateConfig(adBlockEnabled: boolean, siteSettings: Record<string, SiteSettings>): void {
    this.adBlockEnabled = adBlockEnabled;
    this.siteSettingsMap = siteSettings || {};
  }

  ensurePartitionConfigured(partitionName: string, onDownloadAttach?: (ses: Electron.Session) => void): void {
    if (this.configuredPartitions.has(partitionName)) return;
    this.configuredPartitions.add(partitionName);

    const ses = session.fromPartition(partitionName);

    // Enterprise Homologated Chrome 120 LTS User-Agent
    // Solves legacy ERP version gatekeepers (ex: CalcGraf requiring Chrome 0 to 120)
    // and eliminates "Electron" / "Tessera" tokens so Google, WhatsApp Web & banks work 100%
    const enterpriseChromeUa =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.225 Safari/537.36';
    ses.setUserAgent(enterpriseChromeUa);

    // Web Permissions Protocol Handler (Camera, Mic, Geo, Notifications, Clipboard)
    ses.setPermissionRequestHandler((wc, permission, callback, details) => {
      let origin = '';
      try {
        origin = new URL(details.requestingUrl || wc.getURL()).hostname.replace(/^www\./, '');
      } catch {}

      const siteCfg = this.siteSettingsMap[origin];

      switch (permission) {
        case 'media':
          // Default to allowed so Google Meet, WhatsApp Web, mic & video work smoothly,
          // unless user has explicitly configured this host to block microphone and camera.
          if (siteCfg?.microphoneAllowed === false && siteCfg?.cameraAllowed === false) {
            callback(false);
          } else {
            callback(true);
          }
          break;
        case 'geolocation':
          callback(!!siteCfg?.geolocationAllowed);
          break;
        case 'notifications':
          callback(!!siteCfg?.notificationsAllowed);
          break;
        case 'clipboard-read':
        case 'clipboard-sanitized-write':
        case 'fullscreen':
        case 'pointerLock':
        case 'openExternal':
          callback(true);
          break;
        default:
          callback(true);
          break;
      }
    });

    ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
      let origin = '';
      try {
        origin = new URL(requestingOrigin).hostname.replace(/^www\./, '');
      } catch {}
      const siteCfg = this.siteSettingsMap[origin];

      if (
        permission === 'clipboard-read' ||
        permission === 'clipboard-sanitized-write' ||
        permission === 'fullscreen' ||
        permission === 'pointerLock'
      ) {
        return true;
      }
      if (permission === 'geolocation') return !!siteCfg?.geolocationAllowed;
      if (permission === 'notifications') return !!siteCfg?.notificationsAllowed;
      return true;
    });

    // Network-level AdBlock & Tracker Shield (equivalent to Android shouldInterceptRequest)
    ses.webRequest.onBeforeRequest((details, callback) => {
      if (!this.adBlockEnabled || details.resourceType === 'mainFrame') {
        callback({ cancel: false });
        return;
      }

      try {
        const reqUrl = new URL(details.url);
        if (reqUrl.protocol !== 'http:' && reqUrl.protocol !== 'https:') {
          callback({ cancel: false });
          return;
        }

        let pageOrigin = '';
        if (details.referrer) {
          try {
            pageOrigin = new URL(details.referrer).hostname.replace(/^www\./, '');
          } catch {
            pageOrigin = '';
          }
        }

        // Respect per-site whitelist from SiteSettingsModal
        if (pageOrigin && this.siteSettingsMap[pageOrigin]?.adBlockWhitelisted) {
          callback({ cancel: false });
          return;
        }

        const host = reqUrl.hostname;
        // Do not block first-party resources from the exact same root domain
        if (pageOrigin && (host === pageOrigin || host.endsWith(`.${pageOrigin}`))) {
          callback({ cancel: false });
          return;
        }

        if (isAdOrTracker(host, details.url)) {
          const info = identifyTracker(host, details.url);
          const payload: BlockedRequestPayload = {
            name: info.name,
            host,
            pageOrigin: pageOrigin || host,
            category: info.category,
            bytesSaved: BYTES_PER_BLOCKED_REQUEST,
            timeSavedMs: TIME_SAVED_PER_BLOCKED_MS,
            timestamp: Date.now()
          };
          const win = this.getMainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send('tessera:tracker-blocked', payload);
          }
          callback({ cancel: true });
          return;
        }
      } catch {
        // Ignore malformed URLs
      }

      callback({ cancel: false });
    });

    // Granular Site Permissions (Camera, Microphone, Geolocation, Notifications)
    ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
      try {
        const win = this.getMainWindow();
        const requestingUrl = (details && (details as any).requestingUrl) || '';
        const currentUrl = webContents.getURL() || requestingUrl;

        // The Tessera Browser UI itself (Start page, AirBar, Voice Assistant, internal tools)
        // must ALWAYS have microphone & media permissions granted!
        const isAppWindow =
          (win && !win.isDestroyed() && webContents.id === win.webContents.id) ||
          !currentUrl ||
          currentUrl.startsWith('file:') ||
          currentUrl.startsWith('http://localhost') ||
          requestingUrl.startsWith('file:') ||
          requestingUrl.startsWith('http://localhost');

        if (isAppWindow) {
          callback(true);
          return;
        }

        const originHost = new URL(currentUrl).hostname.replace(/^www\./, '');
        const cfg = this.siteSettingsMap[originHost];

        if (permission === 'fullscreen' || permission === 'clipboard-sanitized-write') {
          callback(true);
          return;
        }

        if (!cfg) {
          // Secure privacy-first defaults
          if (permission === 'notifications' || permission === 'geolocation' || permission === 'media') {
            callback(false);
            return;
          }
          callback(true);
          return;
        }

        if (permission === 'media') {
          callback(cfg.cameraAllowed || cfg.microphoneAllowed);
          return;
        }
        if (permission === 'geolocation') {
          callback(cfg.geolocationAllowed);
          return;
        }
        if (permission === 'notifications') {
          callback(cfg.notificationsAllowed);
          return;
        }
      } catch {
        callback(false);
        return;
      }

      callback(false);
    });

    if (onDownloadAttach) {
      onDownloadAttach(ses);
    }
  }

  async clearIncognitoPartition(partitionName: string): Promise<void> {
    const ses = session.fromPartition(partitionName);
    await ses.clearStorageData();
    await ses.clearCache();
  }
}
