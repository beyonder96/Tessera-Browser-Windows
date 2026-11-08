import type { BrowserWindowConstructorOptions, Session, WebContents } from 'electron';

/**
 * Guest (<webview> tabs & popup windows) configuration.
 *
 * IMPORTANT INVARIANT: never call `webContents.setUserAgent()` from navigation listeners.
 * Chromium (WebContentsImpl::SetUserAgentOverride) reloads the whole page when the UA override
 * changes while a load is in progress. Since `did-start-navigation` also fires for subframes
 * (e.g. accounts.google.com iframes embedded by x.com / Gemini / YouTube), toggling the UA there
 * creates an infinite reload loop. The UA comes from `app.userAgentFallback` + `session.setUserAgent()`,
 * and Google-login specific headers are rewritten only at the network layer (onBeforeSendHeaders).
 */

export type WindowOpenKind = 'oauth-popup' | 'aux-popup' | 'tab' | 'external' | 'deny';

export interface WindowOpenDetailsLike {
  url: string;
  features?: string;
  disposition?: string;
}

const OAUTH_HOST_RE =
  /^https:\/\/([^/]+\.)?(accounts\.google\.com|appleid\.apple\.com|login\.microsoftonline\.com|login\.live\.com|www\.facebook\.com\/(v[\d.]+\/)?dialog\/oauth|facebook\.com\/(v[\d.]+\/)?dialog\/oauth|github\.com\/login\/oauth|api\.twitter\.com\/oauth|x\.com\/i\/oauth2|discord\.com\/oauth2|id\.twitch\.tv\/oauth2)/i;
const OAUTH_PARAMS_RE = /[?&](client_id|response_type|redirect_uri)=/i;
const EXTERNAL_SCHEME_RE = /^(mailto|tel|sms|whatsapp|tg|skype|msteams|zoommtg|spotify|steam|discord|slack|ms-[a-z-]+):/i;

export function isOAuthPopupUrl(url: string): boolean {
  return OAUTH_HOST_RE.test(url) || (/^https?:\/\//i.test(url) && OAUTH_PARAMS_RE.test(url));
}

/** Window features that indicate the page explicitly asked for a popup window (not a tab). */
export function hasPopupFeatures(features: string | undefined): boolean {
  if (!features) return false;
  return (
    /(^|,)\s*(width|height|innerWidth|innerHeight|left|top|screenX|screenY)\s*=/i.test(features) ||
    /(^|,)\s*popup\s*(=\s*(1|yes|true)\s*)?(,|$)/i.test(features)
  );
}

export function classifyWindowOpen(details: WindowOpenDetailsLike): WindowOpenKind {
  const url = (details.url || '').trim();

  if (EXTERNAL_SCHEME_RE.test(url)) return 'external';
  if (/^(javascript|file|chrome|devtools|view-source):/i.test(url)) return 'deny';

  // Auth providers need window.opener + same session -> real popup window.
  if (isOAuthPopupUrl(url)) return 'oauth-popup';

  // Scripted popups (about:blank later written to by the opener, sized windows, popup=1).
  if (!url || url === 'about:blank' || url.startsWith('about:blank')) return 'aux-popup';
  if (details.disposition === 'new-window' || hasPopupFeatures(details.features)) {
    return /^(https?|blob|data):/i.test(url) ? 'aux-popup' : 'deny';
  }

  // Regular target="_blank" / window.open(url) / noopener links -> open as a Tessera tab.
  if (/^https?:\/\//i.test(url)) return 'tab';
  return 'deny';
}

function parseFeatureDimension(features: string | undefined, key: string, fallback: number): number {
  if (!features) return fallback;
  const match = new RegExp(`(^|[,\\s])${key}\\s*=\\s*(\\d+)`, 'i').exec(features);
  if (match && match[2]) {
    const val = parseInt(match[2], 10);
    if (!isNaN(val) && val >= 240 && val <= 3840) return val;
  }
  return fallback;
}

export function buildPopupWindowOptions(
  kind: 'oauth-popup' | 'aux-popup',
  details: WindowOpenDetailsLike,
  guestSession: Session,
  preloadPath: string
): BrowserWindowConstructorOptions {
  const isOAuth = kind === 'oauth-popup';
  return {
    modal: false,
    frame: true, // Native title bar with minimize/maximize/close controls
    autoHideMenuBar: true,
    center: true,
    show: true,
    width: parseFeatureDimension(details.features, 'width', isOAuth ? 600 : 900),
    height: parseFeatureDimension(details.features, 'height', isOAuth ? 720 : 680),
    webPreferences: {
      session: guestSession,
      preload: preloadPath,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: true,
      contextIsolation: true,
      sandbox: true,
      plugins: true
    }
  };
}

export interface GuestContentsDeps {
  getPreloadPath: () => string;
  registerShortcuts: (contents: WebContents) => void;
  openAsTab: (url: string) => void;
  openExternal: (url: string) => void;
}

const configuredGuests = new WeakSet<object>();

export function configureGuestWebContents(contents: WebContents, deps: GuestContentsDeps): void {
  if (configuredGuests.has(contents)) return;
  configuredGuests.add(contents);

  deps.registerShortcuts(contents);

  contents.setWindowOpenHandler((details) => {
    const kind = classifyWindowOpen(details);
    switch (kind) {
      case 'oauth-popup':
      case 'aux-popup':
        // Share the exact Space session/cookies so OAuth popups (Google, Apple, Microsoft)
        // and ERP window.open flows keep window.opener and login state.
        return {
          action: 'allow',
          overrideBrowserWindowOptions: buildPopupWindowOptions(
            kind,
            details,
            contents.session,
            deps.getPreloadPath()
          )
        };
      case 'tab':
        deps.openAsTab(details.url);
        return { action: 'deny' };
      case 'external':
        deps.openExternal(details.url);
        return { action: 'deny' };
      default:
        return { action: 'deny' };
    }
  });
}
