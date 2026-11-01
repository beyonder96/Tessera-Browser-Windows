import { ipcRenderer, webFrame } from 'electron';

// Emulate genuine Google Chrome client properties (preserving NavigatorUAData prototype & 4-part fullVersionList)
// in both main frames and subframes (such as Google's /_/bscframe) to prevent Botguard embedded-CEF rejection.
try {
  const chromeMajor = (process.versions.chrome || '132.0.0.0').split('.')[0];
  const chromeFull = process.versions.chrome || `${chromeMajor}.0.0.0`;

  const chromePatchScript = `
    (function() {
      try {
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

        // 1. Patch NavigatorUAData.prototype so instanceof NavigatorUAData & Object.prototype.toString remain 100% native
        if (navigator.userAgentData) {
          const proto = Object.getPrototypeOf(navigator.userAgentData);
          if (proto) {
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

        // 2. Hide automation flags if present
        if (navigator.webdriver) {
          Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
            get: function() { return false; },
            configurable: true,
            enumerable: true
          });
        }

        // 3. Emulate standard window.chrome properties (app, csi, loadTimes) expected by Google Auth
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
      } catch (err) {}
    })();
  `;

  webFrame.executeJavaScriptInIsolatedWorld(0, [{ code: chromePatchScript }]).catch(() => {});
} catch {
  // Silent fallback
}

// Guest preload host-bridge listeners run only in the top-level main frame (not in sub-iframes).
if (process.isMainFrame !== false) {
  let lastScrollY = 0;
  let lastSentAt = 0;

  window.addEventListener(
    'scroll',
    () => {
      const now = Date.now();
      if (now - lastSentAt < 65) return;
      lastSentAt = now;
      const currentY = window.scrollY || document.documentElement.scrollTop || 0;
      const deltaY = currentY - lastScrollY;
      lastScrollY = currentY;
      if (Math.abs(deltaY) > 6) {
        ipcRenderer.sendToHost('tessera-guest:scroll', { deltaY, scrollY: currentY });
      }
    },
    { passive: true }
  );

  // Alt + Click on any link opens Peek Preview modal without leaving active tab
  window.addEventListener(
    'click',
    (ev) => {
      if (!ev.altKey) return;
      const target = ev.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (anchor && anchor.href && /^https?:\/\//i.test(anchor.href)) {
        ev.preventDefault();
        ev.stopPropagation();
        ipcRenderer.sendToHost('tessera-guest:peek-link', {
          url: anchor.href,
          title: (anchor.innerText || anchor.title || anchor.href).trim().slice(0, 100)
        });
      }
    },
    true
  );

  // Text Selection detector for Tessera AI Quick Highlight Prompt
  document.addEventListener('mouseup', (ev) => {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (text.length >= 16 && text.length <= 2400) {
        ipcRenderer.sendToHost('tessera-guest:text-selected', {
          text,
          clientX: ev.clientX,
          clientY: ev.clientY
        });
      } else {
        ipcRenderer.sendToHost('tessera-guest:text-cleared');
      }
    }, 30);
  });
}
