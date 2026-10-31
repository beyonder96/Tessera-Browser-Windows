import { session, type BrowserWindow } from 'electron';
import {
  BYTES_PER_BLOCKED_REQUEST,
  identifyTracker,
  isAdOrTracker,
  TIME_SAVED_PER_BLOCKED_MS
} from '../src/shared/privacyRules';
import type { SiteSettings, TrackerCategory } from '../src/shared/types';

const AUTH_PROTECTED_HOSTS: ReadonlySet<string> = new Set([
  'accounts.google.com',
  'accounts.youtube.com',
  'gds.google.com',
  'myaccount.google.com',
  'oauth2.googleapis.com',
  'apis.google.com',
  'ssl.gstatic.com',
  'www.gstatic.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com'
]);

export function isAuthProtectedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h) return false;
  if (AUTH_PROTECTED_HOSTS.has(h)) return true;
  return h.endsWith('.accounts.google.com') || h.endsWith('.gstatic.com');
}

export function getStandardChromiumUserAgent(): string {
  const chromeMajor = (process.versions.chrome || '132.0.0.0').split('.')[0];
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;
}

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

  private async sanitizeUnauthenticatedGoogleRejectionCookies(ses: Electron.Session): Promise<void> {
    try {
      const googleCookies = await ses.cookies.get({ domain: 'google.com' });
      const authCookieNames = new Set([
        'SID',
        'HSID',
        'SSID',
        '__Secure-1PSID',
        '__Secure-3PSID'
      ]);
      const hasActiveGoogleSession = googleCookies.some((c) => authCookieNames.has(c.name));
      if (hasActiveGoogleSession) {
        return;
      }

      const accountCookies = await ses.cookies.get({ domain: 'accounts.google.com' });
      for (const cookie of accountCookies) {
        const cleanDomain = (cookie.domain || 'accounts.google.com').replace(/^\./, '');
        const cookieUrl = `https://${cleanDomain}${cookie.path || '/'}`;
        await ses.cookies.remove(cookieUrl, cookie.name).catch(() => {});
      }
    } catch {
      // Ignore cookie inspection errors
    }
  }

  ensurePartitionConfigured(partitionName: string, onDownloadAttach?: (ses: Electron.Session) => void): void {
    if (this.configuredPartitions.has(partitionName)) return;
    this.configuredPartitions.add(partitionName);

    const ses = partitionName === 'default' ? session.defaultSession : session.fromPartition(partitionName);

    // Standard Chromium Reduced User-Agent aligned 1:1 with compiled Chromium major version (Client Hints / navigator.userAgentData)
    // Eliminates "Electron" / "Tessera" wrapper tokens and version mismatches so Google Sign-In, WhatsApp Web & banks work 100%
    const standardChromeUa = getStandardChromiumUserAgent();
    ses.setUserAgent(standardChromeUa);
    void this.sanitizeUnauthenticatedGoogleRejectionCookies(ses);

    // Web Permissions Protocol Handler (Camera, Mic, Geo, Notifications, Clipboard, Storage Access / OAuth)
    ses.setPermissionRequestHandler((wc, permission, callback, details) => {
      try {
        const win = this.getMainWindow();
        const requestingUrl = (details && (details as { requestingUrl?: string }).requestingUrl) || '';
        const currentUrl = wc.getURL() || requestingUrl;

        // The Tessera Browser UI itself (Start page, AirBar, Voice Assistant, internal tools)
        // must ALWAYS have microphone & media permissions granted!
        const isAppWindow =
          (win && !win.isDestroyed() && wc.id === win.webContents.id) ||
          !currentUrl ||
          currentUrl.startsWith('file:') ||
          currentUrl.startsWith('http://localhost') ||
          requestingUrl.startsWith('file:') ||
          requestingUrl.startsWith('http://localhost');

        if (isAppWindow) {
          callback(true);
          return;
        }

        let origin = '';
        try {
          origin = new URL(requestingUrl || currentUrl).hostname.replace(/^www\./, '');
        } catch {}

        const siteCfg = origin ? this.siteSettingsMap[origin] : undefined;

        switch (permission) {
          case 'media':
            // Default to allowed so Google Meet, WhatsApp Web, mic & video work smoothly,
            // unless user has explicitly configured this host to block microphone and camera.
            if (siteCfg && siteCfg.microphoneAllowed === false && siteCfg.cameraAllowed === false) {
              callback(false);
            } else {
              callback(true);
            }
            return;
          case 'geolocation':
            callback(!!siteCfg?.geolocationAllowed);
            return;
          case 'notifications':
            callback(!!siteCfg?.notificationsAllowed);
            return;
          case 'clipboard-read':
          case 'clipboard-sanitized-write':
          case 'fullscreen':
          case 'pointerLock':
          case 'openExternal':
          case 'storage-access':
          case 'top-level-storage-access':
          case 'window-management':
            callback(true);
            return;
          default:
            callback(true);
            return;
        }
      } catch {
        callback(false);
      }
    });

    ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
      let origin = '';
      try {
        origin = new URL(requestingOrigin).hostname.replace(/^www\./, '');
      } catch {}
      const siteCfg = origin ? this.siteSettingsMap[origin] : undefined;

      if (
        permission === 'clipboard-read' ||
        permission === 'clipboard-sanitized-write' ||
        permission === 'fullscreen' ||
        permission === 'pointerLock' ||
        permission === 'storage-access' ||
        permission === 'top-level-storage-access'
      ) {
        return true;
      }
      if (permission === 'media') {
        if (siteCfg && siteCfg.microphoneAllowed === false && siteCfg.cameraAllowed === false) {
          return false;
        }
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

        const host = reqUrl.hostname;
        const initiatorUrl = details.referrer || (details as { initiator?: string }).initiator || '';
        let pageOrigin = '';
        let rawInitiatorHost = '';
        if (initiatorUrl) {
          try {
            rawInitiatorHost = new URL(initiatorUrl).hostname.toLowerCase();
            pageOrigin = rawInitiatorHost.replace(/^www\./, '');
          } catch {
            pageOrigin = '';
          }
        }

        // Never interfere with Google / OAuth / SSO authentication endpoints or their subresources
        if (isAuthProtectedHostname(host) || isAuthProtectedHostname(rawInitiatorHost)) {
          callback({ cancel: false });
          return;
        }

        // Respect per-site whitelist from SiteSettingsModal
        if (pageOrigin && this.siteSettingsMap[pageOrigin]?.adBlockWhitelisted) {
          callback({ cancel: false });
          return;
        }

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
