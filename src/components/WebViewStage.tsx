import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react';
import { WifiOff, RotateCw, Sparkles, Volume2, Copy } from 'lucide-react';
import type {
  BrowserSettings,
  BrowserTab,
  ReaderArticle,
  SiteSettings
} from '../shared/types';
import type { ElectronWebviewElement } from '../types/global';
import {
  COOKIE_BANNER_BLOCKER_SCRIPT,
  COSMETIC_ADBLOCK_SCRIPT,
  INLINE_DOM_TRANSLATE_SCRIPT,
  PAGE_METADATA_DETECTION_SCRIPT,
  READER_EXTRACTION_SCRIPT,
  REVERT_DOM_TRANSLATE_SCRIPT,
  SMART_FORCE_DARK_CSS,
  SUMMARY_EXTRACTION_SCRIPT
} from '../shared/domScripts';
import { extractCleanHost } from '../shared/searchEngines';
import type { WebContextMenuData } from './WebContextMenu';

export interface WebViewStageHandle {
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  stop: () => void;
  navigateActive: (url: string) => void;
  extractReaderArticle: () => Promise<ReaderArticle | null>;
  extractSummaryPayload: () => Promise<{
    title: string;
    domain: string;
    url: string;
    content: string;
  } | null>;
  findInPage: (query: string, forward?: boolean, findNext?: boolean) => void;
  stopFindInPage: () => void;
  translateActivePage: () => Promise<void>;
  revertTranslateActivePage: () => Promise<void>;
  exportActivePagePdf: () => Promise<string | null>;
  openActiveDevTools: () => Promise<void>;
  captureActiveThumbnail: () => Promise<string | null>;
  toggleMediaPlayPause: (tabId?: string) => Promise<boolean>;
  toggleMediaMute: (tabId?: string) => void;
  triggerPictureInPicture: (tabId?: string) => Promise<boolean>;
  executeEditCommand: (command: 'cut' | 'copy' | 'paste' | 'selectAll', tabId?: string) => void;
  setZoomFactor: (factor: number, tabId?: string) => void;
  getZoomFactor: (tabId?: string) => number;
  printActiveTab: (tabId?: string) => void;
  inspectElement: (x: number, y: number, tabId?: string) => void;
}

interface WebViewStageProps {
  tabs: BrowserTab[];
  activeTabId: string;
  webviewPreloadUrl: string;
  settings: BrowserSettings;
  siteSettings: Record<string, SiteSettings>;
  onUpdateTab: (tabId: string, patch: Partial<BrowserTab>) => void;
  onRecordHistory: (title: string, url: string, spaceId: string, isIncognito?: boolean) => void;
  onScrollDirection: (scrollingDown: boolean) => void;
  onPeekLink: (url: string, title: string) => void;
  onForeignLanguageDetected: (lang: string) => void;
  onReaderAvailabilityChanged: (available: boolean) => void;
  onAskAiWithSelection: (selectedText: string, mode: 'explain' | 'summarize') => void;
  onListenSelection: (selectedText: string) => void;
  onFindMatchesUpdated: (activeMatchOrdinal: number, matches: number) => void;
  onOpenNewTab?: (url: string, isIncognito?: boolean) => void;
  onShowContextMenu?: (data: WebContextMenuData) => void;
  onHtmlFullScreenChange?: (isFullScreen: boolean) => void;
}

function isAuthProtectedUrl(rawUrl: string): boolean {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    return (
      h === 'accounts.google.com' ||
      h === 'accounts.youtube.com' ||
      h === 'gds.google.com' ||
      h.endsWith('.accounts.google.com') ||
      h === 'login.microsoftonline.com' ||
      h === 'login.live.com' ||
      h === 'appleid.apple.com'
    );
  } catch {
    return false;
  }
}

function sanitizeInitialTabUrl(rawUrl: string): string {
  if (/^https:\/\/accounts\.google\.com\/(v3\/)?signin\/rejected/i.test(rawUrl)) {
    void window.tesseraApi?.clearGoogleAuthCookies?.();
    return 'https://accounts.google.com/';
  }
  return rawUrl;
}

export const WebViewStage = forwardRef<WebViewStageHandle, WebViewStageProps>(
  (
    {
      tabs,
      activeTabId,
      webviewPreloadUrl,
      settings,
      siteSettings,
      onUpdateTab,
      onRecordHistory,
      onScrollDirection,
      onPeekLink,
      onForeignLanguageDetected,
      onReaderAvailabilityChanged,
      onAskAiWithSelection,
      onListenSelection,
      onFindMatchesUpdated,
      onOpenNewTab,
      onShowContextMenu,
      onHtmlFullScreenChange
    },
    ref
  ) => {
    const webviewRefs = useRef<Record<string, ElectronWebviewElement | null>>({});
    const tabInitialSrcMap = useRef<Record<string, string>>({});
    const darkCssKeys = useRef<Record<string, string>>({});
    const [failedTabs, setFailedTabs] = useState<
      Record<string, { code: number; desc: string; url: string }>
    >({});
    const [selectionPopup, setSelectionPopup] = useState<{
      text: string;
      x: number;
      y: number;
    } | null>(null);

    // Latest props ref to eliminate stale closures in long-lived webview event listeners
    const latestPropsRef = useRef({
      tabs,
      activeTabId,
      settings,
      siteSettings,
      onUpdateTab,
      onRecordHistory,
      onScrollDirection,
      onPeekLink,
      onForeignLanguageDetected,
      onReaderAvailabilityChanged,
      onAskAiWithSelection,
      onListenSelection,
      onFindMatchesUpdated,
      onOpenNewTab,
      onShowContextMenu,
      onHtmlFullScreenChange
    });

    latestPropsRef.current = {
      tabs,
      activeTabId,
      settings,
      siteSettings,
      onUpdateTab,
      onRecordHistory,
      onScrollDirection,
      onPeekLink,
      onForeignLanguageDetected,
      onReaderAvailabilityChanged,
      onAskAiWithSelection,
      onListenSelection,
      onFindMatchesUpdated,
      onOpenNewTab,
      onShowContextMenu,
      onHtmlFullScreenChange
    };

    const getActiveWebview = (): ElectronWebviewElement | null => {
      return webviewRefs.current[activeTabId] || null;
    };

    const applyForceDarkToWebview = async (tabId: string, wv: ElectronWebviewElement, enabled: boolean) => {
      try {
        const wcId = wv.getWebContentsId();
        void window.tesseraApi.setForceDarkForWebContents(wcId, enabled);
        const currentUrl = wv.getURL() || '';
        const shouldInjectCss = enabled && !isAuthProtectedUrl(currentUrl);
        if (shouldInjectCss) {
          if (!darkCssKeys.current[tabId]) {
            const key = await wv.insertCSS(SMART_FORCE_DARK_CSS);
            darkCssKeys.current[tabId] = key;
          }
        } else {
          const key = darkCssKeys.current[tabId];
          if (key) {
            await wv.removeInsertedCSS(key);
            delete darkCssKeys.current[tabId];
          }
        }
      } catch {
        // webview may be unloading or initializing
      }
    };

    useImperativeHandle(ref, () => ({
      goBack: () => {
        const wv = getActiveWebview();
        if (wv && wv.canGoBack()) wv.goBack();
      },
      goForward: () => {
        const wv = getActiveWebview();
        if (wv && wv.canGoForward()) wv.goForward();
      },
      reload: () => {
        const wv = getActiveWebview();
        if (wv) {
          setFailedTabs((prev) => {
            const copy = { ...prev };
            delete copy[activeTabId];
            return copy;
          });
          wv.reload();
        }
      },
      stop: () => getActiveWebview()?.stop(),
      navigateActive: (url: string) => {
        const wv = getActiveWebview();
        setFailedTabs((prev) => {
          const copy = { ...prev };
          delete copy[activeTabId];
          return copy;
        });
        if (wv) {
          void wv.loadURL(url).catch(() => {});
        } else {
          tabInitialSrcMap.current[activeTabId] = sanitizeInitialTabUrl(url);
        }
      },
      extractReaderArticle: async () => {
        const wv = getActiveWebview();
        if (!wv) return null;
        try {
          const rawJson = await wv.executeJavaScript<string>(READER_EXTRACTION_SCRIPT, true);
          return JSON.parse(rawJson) as ReaderArticle;
        } catch {
          return null;
        }
      },
      extractSummaryPayload: async () => {
        const wv = getActiveWebview();
        if (!wv) return null;
        try {
          const rawJson = await wv.executeJavaScript<string>(SUMMARY_EXTRACTION_SCRIPT, true);
          return JSON.parse(rawJson) as {
            title: string;
            domain: string;
            url: string;
            content: string;
          };
        } catch {
          return null;
        }
      },
      findInPage: (query, forward = true, findNext = false) => {
        const wv = getActiveWebview();
        if (!wv || !query.trim()) return;
        wv.findInPage(query, { forward, findNext });
      },
      stopFindInPage: () => {
        const wv = getActiveWebview();
        if (wv) wv.stopFindInPage('clearSelection');
      },
      translateActivePage: async () => {
        const wv = getActiveWebview();
        if (!wv) return;
        try {
          const rawNodes = await wv.executeJavaScript<string>(
            `(() => {
              try {
                const selectors = 'h1, h2, h3, h4, h5, h6, p, li, article p, section p';
                const els = Array.from(document.querySelectorAll(selectors));
                const items = [];
                for (let i = 0; i < els.length && items.length < 80; i++) {
                  const el = els[i];
                  const text = (el.innerText || '').trim();
                  if (text.length > 3 && !el.hasAttribute('data-tessera-orig')) {
                    el.setAttribute('data-tessera-orig', text);
                    el.setAttribute('data-tessera-idx', String(items.length));
                    items.push(text);
                  }
                }
                return JSON.stringify(items);
              } catch {
                return '[]';
              }
            })()`,
            true
          );

          const texts = JSON.parse(rawNodes) as string[];
          if (texts.length > 0 && window.tesseraApi?.translateTexts) {
            const translated = await window.tesseraApi.translateTexts(texts, 'pt');
            const safePayload = JSON.stringify(translated);
            await wv.executeJavaScript(
              `(() => {
                try {
                  const translations = ${safePayload};
                  document.querySelectorAll('[data-tessera-idx]').forEach(el => {
                    const idx = parseInt(el.getAttribute('data-tessera-idx'), 10);
                    if (!isNaN(idx) && translations[idx]) {
                      el.innerText = translations[idx];
                    }
                  });
                } catch {}
              })()`,
              true
            );
            return;
          }
        } catch (err) {
          console.warn('[Tessera] CSP-resistant DOM translation fallback:', err);
        }
        await wv.executeJavaScript(INLINE_DOM_TRANSLATE_SCRIPT, true).catch(() => {});
      },
      revertTranslateActivePage: async () => {
        const wv = getActiveWebview();
        if (!wv) return;
        try {
          await wv.executeJavaScript(
            `(() => {
              try {
                document.querySelectorAll('[data-tessera-orig]').forEach(el => {
                  const orig = el.getAttribute('data-tessera-orig');
                  if (orig) el.innerText = orig;
                  el.removeAttribute('data-tessera-orig');
                  el.removeAttribute('data-tessera-idx');
                });
              } catch {}
            })()`,
            true
          );
        } catch {}
        await wv.executeJavaScript(REVERT_DOM_TRANSLATE_SCRIPT, true).catch(() => {});
      },
      exportActivePagePdf: async () => {
        const wv = getActiveWebview();
        if (!wv) return null;
        const wcId = wv.getWebContentsId();
        return window.tesseraApi.exportPageToPdf(wcId, wv.getTitle() || 'Tessera_Pagina');
      },
      openActiveDevTools: async () => {
        const wv = getActiveWebview();
        if (!wv) return;
        await window.tesseraApi.openDevToolsForWebContents(wv.getWebContentsId());
      },
      captureActiveThumbnail: async () => {
        const wv = getActiveWebview();
        if (!wv) return null;
        try {
          const img = await wv.capturePage();
          return img.toDataURL();
        } catch {
          return null;
        }
      },
      toggleMediaPlayPause: async (tabId?: string) => {
        const targetId = tabId || activeTabId;
        const wv = webviewRefs.current[targetId];
        if (!wv) return false;
        try {
          const isPlayingNow = await wv.executeJavaScript<boolean>(
            `(() => {
              try {
                const media = Array.from(document.querySelectorAll('video, audio'));
                if (!media.length) return false;
                const anyPlaying = media.some(m => !m.paused);
                media.forEach(m => {
                  if (anyPlaying) {
                    m.pause();
                  } else {
                    m.play().catch(() => {});
                  }
                });
                return !anyPlaying;
              } catch {
                return false;
              }
            })()`,
            true
          );
          latestPropsRef.current.onUpdateTab(targetId, { isPlayingMedia: isPlayingNow });
          return isPlayingNow;
        } catch {
          return false;
        }
      },
      toggleMediaMute: (tabId?: string) => {
        const targetId = tabId || activeTabId;
        const wv = webviewRefs.current[targetId];
        if (!wv) return;
        try {
          const currentMuted = wv.isAudioMuted();
          const nextMuted = !currentMuted;
          wv.setAudioMuted(nextMuted);
          latestPropsRef.current.onUpdateTab(targetId, { isMuted: nextMuted });
        } catch {}
      },
      triggerPictureInPicture: async (tabId?: string) => {
        const targetId = tabId || activeTabId;
        const wv = webviewRefs.current[targetId];
        if (!wv) return false;
        try {
          return await wv.executeJavaScript<boolean>(
            `(async () => {
              try {
                if (document.pictureInPictureElement) {
                  await document.exitPictureInPicture();
                  return false;
                }
                const videos = Array.from(document.querySelectorAll('video'));
                if (!videos.length) return false;
                const target = videos.find(v => !v.paused && v.readyState >= 1) || videos[0];
                if (target && target.requestPictureInPicture) {
                  await target.requestPictureInPicture();
                  return true;
                }
              } catch (e) {
                console.warn('[Tessera] PiP error:', e);
              }
              return false;
            })()`,
            true
          );
        } catch {
          return false;
        }
      },
      executeEditCommand: (command, tabId) => {
        const targetId = tabId || activeTabId;
        const wv = webviewRefs.current[targetId];
        if (!wv) return;
        try {
          if (command === 'cut') wv.cut();
          else if (command === 'copy') wv.copy();
          else if (command === 'paste') wv.paste();
          else if (command === 'selectAll') wv.selectAll();
        } catch {}
      },
      setZoomFactor: (factor, tabId) => {
        const targetId = tabId || activeTabId;
        const wv = webviewRefs.current[targetId];
        if (!wv) return;
        try {
          wv.setZoomFactor(factor);
        } catch {}
      },
      getZoomFactor: (tabId) => {
        const targetId = tabId || activeTabId;
        const wv = webviewRefs.current[targetId];
        if (!wv) return 1.0;
        try {
          return wv.getZoomFactor();
        } catch {
          return 1.0;
        }
      },
      printActiveTab: (tabId) => {
        const targetId = tabId || activeTabId;
        const wv = webviewRefs.current[targetId];
        if (!wv) return;
        try {
          wv.print();
        } catch {}
      },
      inspectElement: (x, y, tabId) => {
        const targetId = tabId || activeTabId;
        const wv = webviewRefs.current[targetId];
        if (!wv) return;
        try {
          wv.inspectElement(x, y);
        } catch {}
      }
    }));

    // Sync Force Dark Pages dynamically whenever toggled in Quick Settings
    useEffect(() => {
      for (const tab of tabs) {
        if (tab.isHomePage) continue;
        const wv = webviewRefs.current[tab.id];
        if (!wv) continue;
        void applyForceDarkToWebview(tab.id, wv, settings.forceDarkPages);
      }
    }, [settings.forceDarkPages, activeTabId]);

    // Clear selection popup on tab switch
    useEffect(() => {
      setSelectionPopup(null);
    }, [activeTabId]);

    const attachWebviewListeners = (tab: BrowserTab, el: ElectronWebviewElement | null) => {
      const prev = webviewRefs.current[tab.id];
      if (!el) {
        if (prev) {
          delete webviewRefs.current[tab.id];
          delete darkCssKeys.current[tab.id];
        }
        return;
      }
      if (prev === el) {
        return;
      }
      webviewRefs.current[tab.id] = el;

      el.addEventListener('did-start-loading', () => {
        latestPropsRef.current.onUpdateTab(tab.id, { isLoading: true, progress: 0.28 });
      });

      el.addEventListener('did-stop-loading', () => {
        latestPropsRef.current.onUpdateTab(tab.id, {
          isLoading: false,
          progress: 1,
          canGoBack: el.canGoBack(),
          canGoForward: el.canGoForward()
        });

        // Automatically capture fresh thumbnail snapshot for tab hover preview & switcher
        setTimeout(async () => {
          try {
            if (el && !el.isLoading()) {
              const img = await el.capturePage();
              const thumb = img.toDataURL();
              if (thumb && thumb.length > 100) {
                latestPropsRef.current.onUpdateTab(tab.id, { thumbnailDataUrl: thumb });
              }
            }
          } catch {
            // tab may have navigated away
          }
        }, 850);
      });

      el.addEventListener('new-window', (e: Event) => {
        const newWinEv = e as unknown as {
          url?: string;
          disposition?: string;
          options?: { width?: number; height?: number };
        };
        const targetUrl = newWinEv.url || '';
        if (!targetUrl || targetUrl.startsWith('about:blank')) {
          // Handled natively by Electron's setWindowOpenHandler
          return;
        }

        const isOAuthUrl =
          /^https:\/\/([^/]+\.)?(accounts\.google\.com|appleid\.apple\.com|login\.microsoftonline\.com|login\.live\.com|github\.com\/login\/oauth)/i.test(
            targetUrl
          ) || /[?&](client_id|response_type|redirect_uri|scope)=/i.test(targetUrl);

        const hasPopupDimensions =
          Boolean(newWinEv.options && (newWinEv.options.width || newWinEv.options.height));
        const isPopupWindow =
          newWinEv.disposition === 'new-window' || hasPopupDimensions || isOAuthUrl;

        // If it's an OAuth popup or auxiliary dialog, let Electron's setWindowOpenHandler
        // spawn the native BrowserWindow child with window.opener intact!
        if (isPopupWindow) {
          return;
        }

        // Standard target="_blank" navigations: prevent default window creation and open cleanly as a tab in Tessera Browser
        (e as unknown as { preventDefault?: () => void }).preventDefault?.();
        latestPropsRef.current.onOpenNewTab?.(targetUrl, tab.isIncognito);
      });

      el.addEventListener('media-started-playing', () => {
        latestPropsRef.current.onUpdateTab(tab.id, { isPlayingMedia: true });
      });

      el.addEventListener('media-paused', () => {
        latestPropsRef.current.onUpdateTab(tab.id, { isPlayingMedia: false });
      });

      el.addEventListener('did-navigate', (e: Event) => {
        const navEv = e as unknown as { url: string };
        delete darkCssKeys.current[tab.id];
        setSelectionPopup(null);

        if (
          navEv.url.includes('accounts.google.com') &&
          (navEv.url.includes('rejected') || navEv.url.includes('7675428'))
        ) {
          const tabPartition = tab.isIncognito ? 'incognito_session' : `persist:${tab.spaceId}`;
          void window.tesseraApi?.clearGoogleAuthCookies?.(tabPartition);
        }

        latestPropsRef.current.onUpdateTab(tab.id, {
          url: navEv.url,
          canGoBack: el.canGoBack(),
          canGoForward: el.canGoForward(),
          progress: 0.65
        });
      });

      el.addEventListener('did-navigate-in-page', (e: Event) => {
        const navEv = e as unknown as { url: string; isMainFrame?: boolean };
        if (navEv.isMainFrame === false) return;
        latestPropsRef.current.onUpdateTab(tab.id, {
          url: navEv.url,
          canGoBack: el.canGoBack(),
          canGoForward: el.canGoForward()
        });
      });

      el.addEventListener('page-title-updated', (e: Event) => {
        const titleEv = e as unknown as { title: string };
        const currentUrl = el.getURL() || tab.url;
        latestPropsRef.current.onUpdateTab(tab.id, { title: titleEv.title || extractCleanHost(currentUrl) });
        latestPropsRef.current.onRecordHistory(titleEv.title, currentUrl, tab.spaceId, tab.isIncognito);
      });

      el.addEventListener('page-favicon-updated', (e: Event) => {
        const favEv = e as unknown as { favicons?: string[] };
        if (favEv.favicons && favEv.favicons[0]) {
          latestPropsRef.current.onUpdateTab(tab.id, { favicon: favEv.favicons[0] });
        }
      });

      el.addEventListener('dom-ready', () => {
        try {
          if (tab.isMuted) {
            el.setAudioMuted(true);
          }

          const currentUrl = el.getURL();
          if (isAuthProtectedUrl(currentUrl)) {
            if (tab.id === latestPropsRef.current.activeTabId) {
              latestPropsRef.current.onReaderAvailabilityChanged(false);
            }
            return;
          }

          if (latestPropsRef.current.settings.forceDarkPages) {
            void applyForceDarkToWebview(tab.id, el, true);
          }

          const host = extractCleanHost(currentUrl);
          const whitelisted = latestPropsRef.current.siteSettings[host]?.adBlockWhitelisted;
          if (latestPropsRef.current.settings.adBlockEnabled && !whitelisted) {
            void el.executeJavaScript(COSMETIC_ADBLOCK_SCRIPT).catch(() => {});
          }
          if (latestPropsRef.current.settings.cookieBlockerEnabled) {
            void el.executeJavaScript(COOKIE_BANNER_BLOCKER_SCRIPT).catch(() => {});
          }

          void el
            .executeJavaScript<string>(PAGE_METADATA_DETECTION_SCRIPT)
            .then((raw) => {
              const meta = JSON.parse(raw) as {
                lang: string;
                themeColor: string;
                readerAvailable: boolean;
              };
              if (tab.id === latestPropsRef.current.activeTabId) {
                latestPropsRef.current.onReaderAvailabilityChanged(meta.readerAvailable);
                if (meta.lang && !meta.lang.startsWith('pt')) {
                  latestPropsRef.current.onForeignLanguageDetected(meta.lang);
                }
              }
              if (meta.themeColor) {
                latestPropsRef.current.onUpdateTab(tab.id, { themeColor: meta.themeColor });
              }
            })
            .catch(() => {});
        } catch {
          // Ignore dom-ready race
        }
      });

      el.addEventListener('did-fail-load', (e: Event) => {
        const failEv = e as unknown as {
          errorCode: number;
          errorDescription: string;
          validatedURL: string;
          isMainFrame?: boolean;
        };
        // -3 is ERR_ABORTED (normal fast redirect)
        if (failEv.errorCode === -3 || failEv.isMainFrame === false) return;
        setFailedTabs((prev) => ({
          ...prev,
          [tab.id]: {
            code: failEv.errorCode,
            desc: failEv.errorDescription || 'Não foi possível conectar ao servidor.',
            url: failEv.validatedURL || tab.url
          }
        }));
      });

      el.addEventListener('found-in-page', (e: Event) => {
        const foundEv = e as unknown as {
          result?: { activeMatchOrdinal?: number; matches?: number };
        };
        if (foundEv.result) {
          latestPropsRef.current.onFindMatchesUpdated(
            foundEv.result.activeMatchOrdinal ?? 0,
            foundEv.result.matches ?? 0
          );
        }
      });

      el.addEventListener('ipc-message', (e: Event) => {
        const ipcEv = e as unknown as { channel: string; args: unknown[] };
        if (ipcEv.channel === 'tessera-guest:scroll') {
          const payload = ipcEv.args?.[0] as { deltaY: number; scrollY: number } | undefined;
          if (!payload) return;
          if (payload.scrollY < 40) {
            latestPropsRef.current.onScrollDirection(false);
          } else if (payload.deltaY > 18) {
            latestPropsRef.current.onScrollDirection(true);
          } else if (payload.deltaY < -14) {
            latestPropsRef.current.onScrollDirection(false);
          }
        } else if (ipcEv.channel === 'tessera-guest:peek-link') {
          const payload = ipcEv.args?.[0] as { url: string; title: string } | undefined;
          if (payload?.url) {
            latestPropsRef.current.onPeekLink(payload.url, payload.title);
          }
        } else if (ipcEv.channel === 'tessera-guest:text-selected') {
          if (!latestPropsRef.current.settings.tesseraAiEnabled || !latestPropsRef.current.settings.aiTextHighlightPrompts) return;
          const payload = ipcEv.args?.[0] as
            | { text: string; clientX: number; clientY: number }
            | undefined;
          if (payload?.text) {
            setSelectionPopup({
              text: payload.text,
              x: Math.min(window.innerWidth - 300, Math.max(20, payload.clientX - 110)),
              y: Math.max(52, payload.clientY - 54)
            });
          }
        } else if (ipcEv.channel === 'tessera-guest:text-cleared') {
          setSelectionPopup(null);
        }
      });

      el.addEventListener('context-menu', (e: Event) => {
        e.preventDefault();
        const p = (e as unknown as { params?: any }).params || {};
        latestPropsRef.current.onShowContextMenu?.({
          x: p.x ?? 0,
          y: p.y ?? 0,
          linkURL: p.linkURL,
          linkText: p.linkText,
          srcURL: p.srcURL,
          mediaType: p.mediaType,
          selectionText: p.selectionText,
          isEditable: p.isEditable,
          dictionarySuggestions: p.dictionarySuggestions || [],
          editFlags: p.editFlags,
          tabId: tab.id,
          pageUrl: el.getURL() || tab.url,
          pageTitle: el.getTitle() || tab.title
        });
      });

      el.addEventListener('enter-html-full-screen', () => {
        latestPropsRef.current.onHtmlFullScreenChange?.(true);
      });

      el.addEventListener('leave-html-full-screen', () => {
        latestPropsRef.current.onHtmlFullScreenChange?.(false);
      });
    };

    // Clean up closed tabs from initial src map
    const activeTabIds = new Set(tabs.map((t) => t.id));
    for (const id of Object.keys(tabInitialSrcMap.current)) {
      if (!activeTabIds.has(id)) {
        delete tabInitialSrcMap.current[id];
      }
    }

    // Keep tabs mounted in webview pool if they have active web content or were already initialized,
    // preventing DOM destruction and loss of navigation history when visiting Home.
    const webTabs = tabs.filter((t) => !t.isHomePage || !!tabInitialSrcMap.current[t.id]);

    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {webTabs.map((tab) => {
          const isCurrent = tab.id === activeTabId;
          const partition = tab.isIncognito ? 'incognito_session' : `persist:${tab.spaceId}`;
          // Freeze initial src permanently per tab mount so React never mutates webview.src on subsequent renders,
          // eliminating duplicate loads, SPA resets on Gemini/X/YouTube and loss of chat state.
          if (!tabInitialSrcMap.current[tab.id]) {
            tabInitialSrcMap.current[tab.id] = sanitizeInitialTabUrl(tab.url || 'about:blank');
          }
          const initialSrc = tabInitialSrcMap.current[tab.id];
          const failure = failedTabs[tab.id];

          return (
            <div
              key={tab.id}
              style={{
                width: '100%',
                height: '100%',
                display: isCurrent ? 'flex' : 'none',
                position: 'relative'
              }}
            >
              {webviewPreloadUrl && (
                <webview
                  ref={(el) => attachWebviewListeners(tab, el as unknown as ElectronWebviewElement | null)}
                  src={initialSrc}
                  partition={partition}
                  preload={webviewPreloadUrl}
                  allowpopups={true}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              )}

              {/* Native Offline / Error View (TesseraOfflineErrorView.kt equivalent) */}
              {failure && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--bg-canvas)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 32,
                    zIndex: 20
                  }}
                >
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 22,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-hairline)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 18,
                      color: '#FF9500'
                    }}
                  >
                    <WifiOff size={30} />
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                    Não foi possível abrir esta página
                  </h2>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: 'var(--text-secondary)',
                      maxWidth: 440,
                      textAlign: 'center',
                      marginBottom: 20,
                      lineHeight: 1.5
                    }}
                  >
                    {failure.desc} ({failure.code}) — <code>{failure.url}</code>
                  </p>
                  <button
                    onClick={() => {
                      setFailedTabs((prev) => {
                        const copy = { ...prev };
                        delete copy[tab.id];
                        return copy;
                      });
                      webviewRefs.current[tab.id]?.reload();
                    }}
                    className="squircle-press"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 20px',
                      borderRadius: 999,
                      background: 'var(--accent-primary)',
                      color: '#FFF',
                      fontSize: 13.5,
                      fontWeight: 600
                    }}
                  >
                    <RotateCw size={15} />
                    <span>Tentar Novamente</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Floating AI Text Highlight Quick Prompt Pill (aiTextHighlightPrompts) */}
        {selectionPopup && (
          <div
            className="modal-animate-in"
            style={{
              position: 'fixed',
              left: selectionPopup.x,
              top: selectionPopup.y,
              zIndex: 120,
              padding: '5px 7px',
              borderRadius: 999,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              boxShadow: 'var(--shadow-floating)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <button
              onClick={() => {
                latestPropsRef.current.onAskAiWithSelection(selectionPopup.text, 'explain');
                setSelectionPopup(null);
              }}
              style={selChipStyle}
            >
              <Sparkles size={13} style={{ color: 'var(--accent-primary)' }} />
              <span>Explicar IA</span>
            </button>
            <button
              onClick={() => {
                latestPropsRef.current.onAskAiWithSelection(selectionPopup.text, 'summarize');
                setSelectionPopup(null);
              }}
              style={selChipStyle}
            >
              <span>Resumir</span>
            </button>
            <button
              onClick={() => {
                latestPropsRef.current.onListenSelection(selectionPopup.text);
                setSelectionPopup(null);
              }}
              title="Ouvir trecho com Podcastify"
              style={selChipStyle}
            >
              <Volume2 size={13} />
            </button>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(selectionPopup.text);
                setSelectionPopup(null);
              }}
              title="Copiar"
              style={selChipStyle}
            >
              <Copy size={12.5} />
            </button>
          </div>
        )}
      </div>
    );
  }
);

const selChipStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 10px',
  borderRadius: 999,
  background: 'var(--bg-elevated)',
  fontSize: 11.5,
  fontWeight: 600
};
