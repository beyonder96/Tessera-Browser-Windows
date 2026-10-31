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
      onOpenNewTab
    },
    ref
  ) => {
    const webviewRefs = useRef<Record<string, ElectronWebviewElement | null>>({});
    const initializedUrls = useRef<Record<string, string>>({});
    const darkCssKeys = useRef<Record<string, string>>({});
    const [failedTabs, setFailedTabs] = useState<
      Record<string, { code: number; desc: string; url: string }>
    >({});
    const [selectionPopup, setSelectionPopup] = useState<{
      text: string;
      x: number;
      y: number;
    } | null>(null);

    const getActiveWebview = (): ElectronWebviewElement | null => {
      return webviewRefs.current[activeTabId] || null;
    };

    const applyForceDarkToWebview = async (tabId: string, wv: ElectronWebviewElement, enabled: boolean) => {
      try {
        const wcId = wv.getWebContentsId();
        void window.tesseraApi.setForceDarkForWebContents(wcId, enabled);
        if (enabled) {
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
        initializedUrls.current[activeTabId] = url;
        const wv = getActiveWebview();
        setFailedTabs((prev) => {
          const copy = { ...prev };
          delete copy[activeTabId];
          return copy;
        });
        if (wv) {
          void wv.loadURL(url).catch(() => {});
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
        await wv.executeJavaScript(INLINE_DOM_TRANSLATE_SCRIPT, true).catch(() => {});
      },
      revertTranslateActivePage: async () => {
        const wv = getActiveWebview();
        if (!wv) return;
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
          onUpdateTab(targetId, { isPlayingMedia: isPlayingNow });
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
          onUpdateTab(targetId, { isMuted: nextMuted });
        } catch {}
      },
      triggerPictureInPicture: async (tabId?: string) => {
        const targetId = tabId || activeTabId;
        const wv = webviewRefs.current[targetId];
        if (!wv) return false;
        try {
          return await wv.executeJavaScript<boolean>(
            `(() => {
              try {
                if (document.pictureInPictureElement) {
                  document.exitPictureInPicture().catch(() => {});
                  return false;
                }
                const videos = Array.from(document.querySelectorAll('video'));
                if (!videos.length) return false;
                const target = videos.find(v => !v.paused && v.readyState >= 1) || videos[0];
                if (target && target.requestPictureInPicture) {
                  target.requestPictureInPicture().catch((e) => {
                    console.warn('[Tessera] PiP request failed:', e);
                  });
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
      if (prev === el || !el) {
        webviewRefs.current[tab.id] = el;
        return;
      }
      webviewRefs.current[tab.id] = el;

      el.addEventListener('did-start-loading', () => {
        onUpdateTab(tab.id, { isLoading: true, progress: 0.28 });
      });

      el.addEventListener('did-stop-loading', () => {
        onUpdateTab(tab.id, {
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
                onUpdateTab(tab.id, { thumbnailDataUrl: thumb });
              }
            }
          } catch {
            // tab may have navigated away
          }
        }, 850);
      });

      el.addEventListener('new-window', (e: Event) => {
        const newWinEv = e as unknown as { url?: string };
        if (newWinEv.url && !newWinEv.url.startsWith('about:blank')) {
          onOpenNewTab?.(newWinEv.url, tab.isIncognito);
        }
      });

      el.addEventListener('media-started-playing', () => {
        onUpdateTab(tab.id, { isPlayingMedia: true });
      });

      el.addEventListener('media-paused', () => {
        onUpdateTab(tab.id, { isPlayingMedia: false });
      });

      el.addEventListener('did-navigate', (e: Event) => {
        const navEv = e as unknown as { url: string };
        initializedUrls.current[tab.id] = navEv.url;
        setSelectionPopup(null);
        onUpdateTab(tab.id, {
          url: navEv.url,
          canGoBack: el.canGoBack(),
          canGoForward: el.canGoForward(),
          progress: 0.65
        });
      });

      el.addEventListener('did-navigate-in-page', (e: Event) => {
        const navEv = e as unknown as { url: string; isMainFrame?: boolean };
        if (navEv.isMainFrame === false) return;
        initializedUrls.current[tab.id] = navEv.url;
        onUpdateTab(tab.id, {
          url: navEv.url,
          canGoBack: el.canGoBack(),
          canGoForward: el.canGoForward()
        });
      });

      el.addEventListener('page-title-updated', (e: Event) => {
        const titleEv = e as unknown as { title: string };
        const currentUrl = el.getURL() || tab.url;
        onUpdateTab(tab.id, { title: titleEv.title || extractCleanHost(currentUrl) });
        onRecordHistory(titleEv.title, currentUrl, tab.spaceId, tab.isIncognito);
      });

      el.addEventListener('page-favicon-updated', (e: Event) => {
        const favEv = e as unknown as { favicons?: string[] };
        if (favEv.favicons && favEv.favicons[0]) {
          onUpdateTab(tab.id, { favicon: favEv.favicons[0] });
        }
      });

      el.addEventListener('dom-ready', () => {
        try {
          if (tab.isMuted) {
            el.setAudioMuted(true);
          }
          if (settings.forceDarkPages) {
            void applyForceDarkToWebview(tab.id, el, true);
          }

          const host = extractCleanHost(el.getURL());
          const whitelisted = siteSettings[host]?.adBlockWhitelisted;
          if (settings.adBlockEnabled && !whitelisted) {
            void el.executeJavaScript(COSMETIC_ADBLOCK_SCRIPT).catch(() => {});
          }
          if (settings.cookieBlockerEnabled) {
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
              if (tab.id === activeTabId) {
                onReaderAvailabilityChanged(meta.readerAvailable);
                if (meta.lang && !meta.lang.startsWith('pt')) {
                  onForeignLanguageDetected(meta.lang);
                }
              }
              if (meta.themeColor) {
                onUpdateTab(tab.id, { themeColor: meta.themeColor });
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
          onFindMatchesUpdated(
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
            onScrollDirection(false);
          } else if (payload.deltaY > 18) {
            onScrollDirection(true);
          } else if (payload.deltaY < -14) {
            onScrollDirection(false);
          }
        } else if (ipcEv.channel === 'tessera-guest:peek-link') {
          const payload = ipcEv.args?.[0] as { url: string; title: string } | undefined;
          if (payload?.url) {
            onPeekLink(payload.url, payload.title);
          }
        } else if (ipcEv.channel === 'tessera-guest:text-selected') {
          if (!settings.tesseraAiEnabled || !settings.aiTextHighlightPrompts) return;
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
    };

    const webTabs = tabs.filter((t) => !t.isHomePage);

    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {webTabs.map((tab) => {
          const isCurrent = tab.id === activeTabId;
          const partition = tab.isIncognito ? 'incognito_session' : `persist:${tab.spaceId}`;
          const initialSrc = tab.url || initializedUrls.current[tab.id] || 'about:blank';
          initializedUrls.current[tab.id] = initialSrc;
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
                  useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.225 Safari/537.36"
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
                onAskAiWithSelection(selectionPopup.text, 'explain');
                setSelectionPopup(null);
              }}
              style={selChipStyle}
            >
              <Sparkles size={13} style={{ color: 'var(--accent-primary)' }} />
              <span>Explicar IA</span>
            </button>
            <button
              onClick={() => {
                onAskAiWithSelection(selectionPopup.text, 'summarize');
                setSelectionPopup(null);
              }}
              style={selChipStyle}
            >
              <span>Resumir</span>
            </button>
            <button
              onClick={() => {
                onListenSelection(selectionPopup.text);
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
