import type { TesseraDesktopApi } from '../../electron/preload';

export interface ElectronWebviewElement extends HTMLElement {
  src: string;
  partition: string;
  preload: string;
  useragent: string;
  allowpopups?: boolean | string;
  getURL: () => string;
  getTitle: () => string;
  isLoading: () => boolean;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  stop: () => void;
  loadURL: (url: string) => Promise<void>;
  executeJavaScript: <T = unknown>(code: string, userGesture?: boolean) => Promise<T>;
  findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean }) => number;
  stopFindInPage: (action: 'clearSelection' | 'keepSelection' | 'activateSelection') => void;
  setAudioMuted: (muted: boolean) => void;
  isAudioMuted: () => boolean;
  getWebContentsId: () => number;
  capturePage: () => Promise<{ toDataURL: () => string }>;
  insertCSS: (css: string) => Promise<string>;
  removeInsertedCSS: (key: string) => Promise<void>;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  selectAll: () => void;
  setZoomFactor: (factor: number) => void;
  getZoomFactor: () => number;
  print: () => void;
  inspectElement: (x: number, y: number) => void;
}

declare global {
  interface Window {
    tesseraApi: TesseraDesktopApi;
  }

  interface HTMLWebViewElement extends ElectronWebviewElement {}
}
