import fs from 'node:fs';
import path from 'node:path';
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
  'gstatic.com',
  'lh3.googleusercontent.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com'
]);

export const GOOGLE_AUTH_FIREFOX_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0';

export function isGoogleLoginEndpoint(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h) return false;
  return (
    h === 'accounts.google.com' ||
    h.endsWith('.accounts.google.com') ||
    h === 'accounts.youtube.com' ||
    h.endsWith('.accounts.youtube.com') ||
    h === 'myaccount.google.com' ||
    h === 'oauth2.googleapis.com' ||
    h === 'gds.google.com'
  );
}

export function isAuthProtectedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h) return false;
  if (AUTH_PROTECTED_HOSTS.has(h)) return true;
  return h.endsWith('.accounts.google.com') || h.endsWith('.gstatic.com');
}

export function isGoogleAuthHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h) return false;
  return (
    h === 'accounts.google.com' ||
    h.endsWith('.accounts.google.com') ||
    h === 'accounts.youtube.com' ||
    h.endsWith('.accounts.youtube.com') ||
    h === 'myaccount.google.com' ||
    h === 'oauth2.googleapis.com' ||
    h === 'apis.google.com' ||
    h === 'gstatic.com' ||
    h.endsWith('.gstatic.com') ||
    h === 'google.com' ||
    h === 'googleapis.com' ||
    h.endsWith('.googleapis.com') ||
    h === 'google.com' ||
    h.endsWith('.google.com') ||
    h === 'youtube.com' ||
    h.endsWith('.youtube.com')
  );
}

export function getStandardChromiumUserAgent(): string {
  const chromeMajor = (process.versions.chrome || '132.0.0.0').split('.')[0];
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;
}

export function buildChromeMainWorldCompatScript(chromeMajor: string, chromeFull: string): string {
  return `(function() {
    try {
      // On accounts.google.com, we present as genuine Firefox Desktop to prevent BotGuard CEF rejection.
      // Do not inject synthetic window.chrome or monkey-patch NavigatorUAData.
      const host = (typeof window !== 'undefined' && window.location && window.location.hostname)
        ? window.location.hostname.toLowerCase()
        : '';
      if (host === 'accounts.google.com' || host.endsWith('.accounts.google.com') || host === 'accounts.youtube.com') {
        try { Object.defineProperty(window, 'chrome', { value: undefined, configurable: true, writable: true }); } catch (e) {}
        try { Object.defineProperty(window, 'IdentityCredential', { value: undefined, configurable: true, writable: true }); } catch (e) {}
        try { Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true, writable: true }); } catch (e) {}
        return;
      }

      const major = ${JSON.stringify(chromeMajor)};
      const full = ${JSON.stringify(chromeFull)};
      const brandList = [
        { brand: "Not A(Brand", version: "8" },
        { brand: "Chromium", version: major },
        { brand: "Google Chrome", version: major }
      ];
      const fullBrandList = [
        { brand: "Not A(Brand", version: "8.0.0.0" },
        { brand: "Chromium", version: full },
        { brand: "Google Chrome", version: full }
      ];

      if (navigator.userAgentData) {
        const proto = Object.getPrototypeOf(navigator.userAgentData);
        if (proto && proto !== Object.prototype) {
          Object.defineProperty(proto, 'brands', {
            get: function() { return brandList; },
            configurable: true,
            enumerable: true
          });
          Object.defineProperty(proto, 'mobile', {
            get: function() { return false; },
            configurable: true,
            enumerable: true
          });
          Object.defineProperty(proto, 'platform', {
            get: function() { return "Windows"; },
            configurable: true,
            enumerable: true
          });
          proto.getHighEntropyValues = async function(hints) {
            const highEntropy = {
              architecture: "x86",
              bitness: "64",
              brands: brandList,
              formFactors: ["Desktop"],
              fullVersionList: fullBrandList,
              mobile: false,
              model: "",
              platform: "Windows",
              platformVersion: "15.0.0",
              uaFullVersion: full,
              wow64: false
            };
            const out = {};
            if (Array.isArray(hints)) {
              for (let i = 0; i < hints.length; i++) {
                const h = hints[i];
                if (h in highEntropy) out[h] = highEntropy[h];
              }
            }
            return out;
          };
          proto.toJSON = function() {
            return { brands: brandList, mobile: false, platform: "Windows" };
          };
        }
      }

      if (navigator.webdriver) {
        Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
          get: function() { return false; },
          configurable: true,
          enumerable: true
        });
      }

      if (typeof window.chrome !== 'object' || !window.chrome) {
        window.chrome = {};
      }
      if (!window.chrome.app) {
        window.chrome.app = {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
        };
      }
      if (!window.chrome.csi) {
        window.chrome.csi = function() {
          return { startE: Date.now(), onloadT: Date.now(), pageT: performance.now(), tran: 15 };
        };
      }
      if (!window.chrome.loadTimes) {
        window.chrome.loadTimes = function() {
          const nowSec = Date.now() / 1000;
          return {
            requestTime: nowSec,
            startLoadTime: nowSec,
            commitLoadTime: nowSec,
            finishDocumentLoadTime: nowSec,
            finishLoadTime: nowSec,
            firstPaintTime: nowSec,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasFetchedViaSpdy: true,
            wasNpnNegotiated: true,
            npnNegotiatedProtocol: 'h2',
            wasAlternateProtocolAvailable: false,
            connectionInfo: 'h2'
          };
        };
      }

      // Suppress intrusive Windows Security Passkey prompt on conditional mediation
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          window.PublicKeyCredential.isConditionalMediationAvailable = async function() {
            return false;
          };
        } catch (e) {}
      }

      // Intercept navigator.credentials.get for conditional passkeys & FedCM
      if (navigator.credentials && typeof navigator.credentials.get === 'function') {
        try {
          const origCredentialsGet = navigator.credentials.get.bind(navigator.credentials);
          navigator.credentials.get = function(options) {
            if (options && options.mediation === 'conditional') {
              if (options.signal && options.signal.aborted) {
                return Promise.reject(new DOMException('The user canceled the operation or aborted.', 'AbortError'));
              }
              return new Promise(function(resolve, reject) {
                if (options.signal) {
                  options.signal.addEventListener('abort', function() {
                    reject(new DOMException('The user canceled the operation or aborted.', 'AbortError'));
                  });
                }
                // Immediately resolve to null so pages (Gemini, Google, Reddit) know no conditional passkey
                // is present without hanging initialization or triggering watchdog timeouts.
                if (typeof queueMicrotask === 'function') {
                  queueMicrotask(function() { resolve(null); });
                } else {
                  setTimeout(function() { resolve(null); }, 0);
                }
              });
            }
            if (options && options.identity) {
              return Promise.reject(new DOMException('Federated credential mediation is not supported in this environment', 'NotSupportedError'));
            }
            return origCredentialsGet(options);
          };
        } catch (e) {}
      }

      // Disable IdentityCredential so Google Identity Services (GSI) immediately chooses popup flow
      try {
        if ('IdentityCredential' in window) {
          delete window.IdentityCredential;
        }
      } catch (e) {}
    } catch (e) {}
  })();`;
}

export function buildChromeClientHintHeaders(chromeMajor: string, chromeFull: string, includeHighEntropy: boolean): Record<string, string> {
  const base: Record<string, string> = {
    'sec-ch-ua': `"Not A(Brand";v="8", "Chromium";v="${chromeMajor}", "Google Chrome";v="${chromeMajor}"`,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
  };
  if (includeHighEntropy) {
    base['sec-ch-ua-arch'] = '"x86"';
    base['sec-ch-ua-bitness'] = '"64"';
    base['sec-ch-ua-full-version'] = `"${chromeFull}"`;
    base['sec-ch-ua-full-version-list'] = `"Not A(Brand";v="8.0.0.0", "Chromium";v="${chromeFull}", "Google Chrome";v="${chromeFull}"`;
    base['sec-ch-ua-model'] = '""';
    base['sec-ch-ua-wow64'] = '?0';
    base['sec-ch-ua-form-factors'] = '"Desktop"';
    base['sec-ch-ua-platform-version'] = '"15.0.0"';
  }
  return base;
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
  private configuredPartitions = new Map<string, Promise<void>>();
  private getMainWindow: () => BrowserWindow | null;
  private userDataDir?: string;
  private preparedCompatExtDir: string | null = null;

  constructor(getMainWindow: () => BrowserWindow | null, userDataDir?: string) {
    this.getMainWindow = getMainWindow;
    this.userDataDir = userDataDir;
  }

  private ensureChromeCompatExtensionDir(): string | null {
    if (this.preparedCompatExtDir) return this.preparedCompatExtDir;
    if (!this.userDataDir) return null;
    try {
      const chromeMajor = (process.versions.chrome || '132.0.0.0').split('.')[0];
      const chromeFull = process.versions.chrome || `${chromeMajor}.0.0.0`;
      const extDir = path.join(this.userDataDir, 'chrome-compat-ext');
      fs.mkdirSync(extDir, { recursive: true });
      fs.writeFileSync(
        path.join(extDir, 'manifest.json'),
        JSON.stringify(
          {
            manifest_version: 3,
            name: 'Chromium Web Compatibility',
            version: '1.0.6',
            content_scripts: [
              {
                matches: ['<all_urls>'],
                js: ['compat.js'],
                run_at: 'document_start',
                all_frames: true,
                match_about_blank: true,
                world: 'MAIN'
              }
            ]
          },
          null,
          2
        ),
        'utf8'
      );
      fs.writeFileSync(
        path.join(extDir, 'compat.js'),
        buildChromeMainWorldCompatScript(chromeMajor, chromeFull),
        'utf8'
      );
      this.preparedCompatExtDir = extDir;
      return extDir;
    } catch {
      return null;
    }
  }

  updateConfig(adBlockEnabled: boolean, siteSettings: Record<string, SiteSettings>): void {
    this.adBlockEnabled = adBlockEnabled;
    this.siteSettingsMap = siteSettings || {};
  }

  public async sanitizeUnauthenticatedGoogleRejectionCookies(ses: Electron.Session): Promise<void> {
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

      // Clear poisoned origin storage (cookies, localStorage, IndexedDB, ServiceWorkers) on accounts.google.com
      await ses.clearStorageData({ origin: 'https://accounts.google.com' }).catch(() => {});

      // Remove poisoned rejection / tracking cookies (such as GAPS, __Host-GAPS, OTZ, NID, ACCOUNT_CHOOSER)
      for (const cookie of googleCookies) {
        if (
          cookie.name === 'GAPS' ||
          cookie.name.startsWith('__Host-GAPS') ||
          cookie.name === 'OTZ' ||
          cookie.name === 'NID' ||
          cookie.name === 'ACCOUNT_CHOOSER'
        ) {
          const cleanDomain = (cookie.domain || 'google.com').replace(/^\./, '');
          const cookieUrl = `https://${cleanDomain}${cookie.path || '/'}`;
          await ses.cookies.remove(cookieUrl, cookie.name).catch(() => {});
        }
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

  ensurePartitionConfigured(
    partitionName: string,
    onDownloadAttach?: (ses: Electron.Session) => void
  ): Promise<void> {
    const existing = this.configuredPartitions.get(partitionName);
    if (existing) return existing;

    const ses = partitionName === 'default' ? session.defaultSession : session.fromPartition(partitionName);

    // Standard Chromium Reduced User-Agent aligned 1:1 with compiled Chromium major version (Client Hints / navigator.userAgentData)
    // Eliminates "Electron" / "Tessera" wrapper tokens and version mismatches so Google Sign-In, WhatsApp Web & banks work 100%
    const standardChromeUa = getStandardChromiumUserAgent();
    ses.setUserAgent(standardChromeUa);

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
        if (
          isAuthProtectedHostname(host) ||
          isGoogleAuthHost(host) ||
          isAuthProtectedHostname(rawInitiatorHost) ||
          isGoogleAuthHost(rawInitiatorHost)
        ) {
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

    const chromeMajor = (process.versions.chrome || '132.0.0.0').split('.')[0];
    const chromeFull = process.versions.chrome || `${chromeMajor}.0.0.0`;

    // Align Google Client Hints and User-Agent headers:
    // For Google login endpoints (accounts.google.com), send Firefox Desktop UA without sec-ch-ua headers
    // to cleanly bypass closed-source BotGuard embedded-CEF rejection ("Este navegador ou app pode não ser seguro").
    // For all other hosts (x.com, youtube.com, github.com, etc.), send standard Chromium UA and Client Hints.
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      try {
        const reqUrl = new URL(details.url);
        if (reqUrl.protocol === 'https:' || reqUrl.protocol === 'http:') {
          const host = reqUrl.hostname.toLowerCase();
          const isLocal = host === 'localhost' || host === '127.0.0.1';
          if (!isLocal) {
            const headers = details.requestHeaders;

            if (isGoogleLoginEndpoint(host)) {
              for (const key of Object.keys(headers)) {
                const lower = key.toLowerCase();
                if (lower === 'user-agent' || lower.startsWith('sec-ch-ua')) {
                  delete headers[key];
                }
              }
              headers['User-Agent'] = GOOGLE_AUTH_FIREFOX_UA;
              callback({ requestHeaders: headers });
              return;
            }

            const includeHighEntropy = isGoogleAuthHost(host) || isAuthProtectedHostname(host);
            const chHeaders = buildChromeClientHintHeaders(chromeMajor, chromeFull, includeHighEntropy);

            for (const key of Object.keys(headers)) {
              const lower = key.toLowerCase();
              if (lower === 'user-agent' || lower.startsWith('sec-ch-ua')) {
                delete headers[key];
              }
            }

            headers['User-Agent'] = standardChromeUa;
            for (const [hk, hv] of Object.entries(chHeaders)) {
              headers[hk] = hv;
            }

            callback({ requestHeaders: headers });
            return;
          }
        }
      } catch {
        // Fallback on invalid URL
      }
      callback({ requestHeaders: details.requestHeaders });
    });

    // Auto-wipe rejection cookies if Google redirects to the rejection/help page
    ses.webRequest.onResponseStarted((details) => {
      try {
        if (
          details.url.includes('accounts.google.com') &&
          (details.url.includes('rejected') || details.url.includes('7675428'))
        ) {
          void this.sanitizeUnauthenticatedGoogleRejectionCookies(ses);
        }
      } catch {}
    });

    if (onDownloadAttach) {
      onDownloadAttach(ses);
    }

    const isPersistentSession = partitionName === 'default' || partitionName.startsWith('persist:');
    const initPromise = (async () => {
      await this.sanitizeUnauthenticatedGoogleRejectionCookies(ses);
      if (isPersistentSession) {
        const extDir = this.ensureChromeCompatExtensionDir();
        if (extDir && typeof ses.loadExtension === 'function') {
          await ses.loadExtension(extDir, { allowFileAccess: false }).catch(() => {});
        }
      }
    })();

    this.configuredPartitions.set(partitionName, initPromise);
    return initPromise;
  }

  async clearIncognitoPartition(partitionName: string): Promise<void> {
    const ses = session.fromPartition(partitionName);
    await ses.clearStorageData();
    await ses.clearCache();
  }
}
