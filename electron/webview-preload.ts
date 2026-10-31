import { ipcRenderer } from 'electron';

// Guest preload injected into <webview> pages with contextIsolation enabled.
// Forwards scroll direction (for AirBar auto-hide), Alt+Click (for Peek Preview),
// and text highlight coordinates (for Tessera AI inline prompt) via ipcRenderer.sendToHost.

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
