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
  frameName?: string;
  features?: string;
  disposition?: string;
}

const OAUTH_HOST_RE =
  /^https:\/\/([^/]+\.)?(accounts\.google\.com|appleid\.apple\.com|login\.microsoftonline\.com|login\.live\.com|www\.facebook\.com\/(v[\d.]+\/)?dialog\/oauth|facebook\.com\/(v[\d.]+\/)?dialog\/oauth|github\.com\/login\/oauth|api\.twitter\.com\/oauth|x\.com\/i\/oauth2|discord\.com\/oauth2|id\.twitch\.tv\/oauth2|auth\.notion\.so|auth0\.com|accounts\.spotify\.com|id\.atlassian\.com)/i;

const OAUTH_PATH_QUERY_RE =
  /([?&](client_id|response_type|redirect_uri|scope|authuser)=|\/(oauth|oauth2|authorize|signin|authenticate|auth\/google|auth\/apple|auth\/github)(\/|\?|$))/i;

export function isOAuthPopupUrl(url: string): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  return OAUTH_HOST_RE.test(url) || OAUTH_PATH_QUERY_RE.test(url);
}

/** Window features that indicate the page explicitly asked for a popup window (not a tab). */
export function hasPopupFeatures(features: string | undefined): boolean {
  if (!features || typeof features !== 'string') return false;
  const f = features.trim().toLowerCase();
  if (!f) return false;
  // If it's solely "noopener" or "noreferrer", that's standard modern tab navigation, not a popup
  if (/^(noopener|noreferrer|noopener\s*,\s*noreferrer|noreferrer\s*,\s*noopener)$/i.test(f)) {
    return false;
  }
  // Any dimension, positioning, or standard popup window feature
  if (
    /(^|[,;\s])(width|height|innerwidth|innerheight|left|top|screenx|screeny)\s*=/i.test(f) ||
    /(^|[,;\s])popup\s*(=\s*(1|yes|true)\s*)?(,|;|\s|$)/i.test(f) ||
    /(^|[,;\s])(toolbar|location|menubar|status|scrollbars|resizable)\s*=/i.test(f)
  ) {
    return true;
  }
  return false;
}

const EXTERNAL_SCHEME_RE =
  /^(mailto|tel|sms|whatsapp|tg|slack|zoommtg|ms-teams|spotify):/i;

export function classifyWindowOpen(details: WindowOpenDetailsLike): WindowOpenKind {
  const url = (details.url || '').trim();

  if (EXTERNAL_SCHEME_RE.test(url)) return 'external';
  if (/^(javascript|file|chrome|devtools|view-source):/i.test(url)) return 'deny';

  // Auth providers need window.opener + same session -> real popup window.
  if (isOAuthPopupUrl(url)) return 'oauth-popup';

  // Scripted popups (about:blank later written to by the opener, sized windows, popup=1).
  if (!url || url === 'about:blank' || url.startsWith('about:blank')) return 'aux-popup';

  // Check explicit features or disposition from window.open
  if (details.disposition === 'new-window' || hasPopupFeatures(details.features)) {
    return /^(https?|blob|data):/i.test(url) ? 'aux-popup' : 'deny';
  }

  // If an explicit named frame is provided by JS (e.g. window.open(url, 'google_login') or 'login_popup')
  // and it's not a generic target like _blank / _self / _parent / _top, treat as an auxiliary window
  if (
    details.frameName &&
    details.frameName !== '_blank' &&
    details.frameName !== '_self' &&
    details.frameName !== '_parent' &&
    details.frameName !== '_top'
  ) {
    return /^(https?|blob|data):/i.test(url) ? 'aux-popup' : 'deny';
  }

  // Regular target="_blank" links without features -> open as a Tessera tab.
  if (/^https?:\/\//i.test(url)) return 'tab';
  return 'deny';
}

function parseFeatureDimension(features: string | undefined, key: string, fallback: number): number {
  if (!features) return fallback;
  const match = new RegExp(`(^|[,;\\s])${key}\\s*=\\s*(\\d+)`, 'i').exec(features);
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
  const width = parseFeatureDimension(details.features, 'width', isOAuth ? 520 : 800);
  const height = parseFeatureDimension(details.features, 'height', isOAuth ? 640 : 600);
  return {
    modal: false,
    frame: true, // Native title bar with minimize/maximize/close controls
    autoHideMenuBar: true,
    center: true,
    show: true,
    width,
    height,
    minWidth: 380,
    minHeight: 460,
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
