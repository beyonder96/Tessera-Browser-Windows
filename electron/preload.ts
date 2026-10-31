import { contextBridge, ipcRenderer } from 'electron';
import type {
  AiChatMessage,
  AiProviderId,
  DownloadItem,
  LocalBridgeStatus,
  PersistedAppState,
  SiteSettings
} from '../src/shared/types';
import type { BlockedRequestPayload } from './privacyEngine';

export interface TesseraDesktopApi {
  getWebviewPreloadPath: () => Promise<string>;
  windowMinimize: () => void;
  windowToggleMaximize: () => Promise<boolean>;
  windowClose: () => void;
  windowIsMaximized: () => Promise<boolean>;
  loadState: () => Promise<PersistedAppState>;
  saveState: (state: PersistedAppState) => Promise<void>;
  ensurePartition: (partitionName: string) => Promise<void>;
  clearIncognitoPartition: (partitionName: string) => Promise<void>;
  updatePrivacyConfig: (adBlockEnabled: boolean, siteSettings: Record<string, SiteSettings>) => Promise<void>;
  setForceDarkForWebContents: (webContentsId: number, enabled: boolean) => Promise<void>;
  exportPageToPdf: (webContentsId: number, suggestedTitle: string) => Promise<string | null>;
  openDevToolsForWebContents: (webContentsId: number) => Promise<void>;
  setDefaultBrowser: () => Promise<boolean>;
  isDefaultBrowser: () => Promise<boolean>;
  pickCustomWallpaper: () => Promise<string | null>;
  exportBackupToFile: (state: PersistedAppState) => Promise<string | null>;
  importBackupFromFile: (currentState: PersistedAppState) => Promise<{
    nextState: PersistedAppState;
    importedBookmarks: number;
    importedHistory: number;
    importedSpaces: number;
  } | null>;
  openDownloadedFile: (savePath: string) => void;
  showDownloadedInFolder: (savePath: string) => void;
  aiGetKeyStatus: () => Promise<{ hasGeminiKey: boolean; hasGroqKey: boolean }>;
  aiSetApiKey: (provider: AiProviderId, key: string) => Promise<{ hasGeminiKey: boolean; hasGroqKey: boolean }>;
  aiGenerateSummary: (params: {
    provider: AiProviderId;
    pageTitle: string;
    pageDomain: string;
    pageContent: string;
  }) => Promise<string>;
  aiAskQuestion: (params: {
    provider: AiProviderId;
    pageTitle: string;
    pageDomain: string;
    pageContent: string;
    conversationHistory: AiChatMessage[];
    userQuestion: string;
  }) => Promise<string>;
  bridgeStart: () => Promise<LocalBridgeStatus>;
  bridgeStop: () => Promise<LocalBridgeStatus>;
  bridgeGetStatus: () => Promise<LocalBridgeStatus>;
  bridgeUpdateContext: (info: { url: string; title: string }) => void;
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
  quitAndInstallUpdate: () => Promise<void>;
  getUpdateStatus: () => Promise<{ status: string; version?: string; releaseNotes?: string; error?: string }>;
  onUpdateStatus: (
    cb: (payload: { status: string; version?: string; releaseNotes?: string; error?: string }) => void
  ) => () => void;
  onTrackerBlocked: (cb: (payload: BlockedRequestPayload) => void) => () => void;
  onDownloadUpdated: (cb: (item: DownloadItem) => void) => () => void;
  onOpenExternalUrl: (cb: (url: string) => void) => () => void;
  onBridgeStatusChanged: (cb: (status: LocalBridgeStatus) => void) => () => void;
  onShortcut: (cb: (action: string) => void) => () => void;
  onBridgeStateImported: (
    cb: (result: {
      nextState: PersistedAppState;
      importedBookmarks: number;
      importedHistory: number;
      importedSpaces: number;
    }) => void
  ) => () => void;
}

const api: TesseraDesktopApi = {
  getWebviewPreloadPath: () => ipcRenderer.invoke('tessera:get-webview-preload-path'),
  windowMinimize: () => ipcRenderer.send('tessera:window-minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('tessera:window-toggle-maximize'),
  windowClose: () => ipcRenderer.send('tessera:window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('tessera:window-is-maximized'),
  loadState: () => ipcRenderer.invoke('tessera:load-state'),
  saveState: (state) => ipcRenderer.invoke('tessera:save-state', state),
  ensurePartition: (partitionName) => ipcRenderer.invoke('tessera:ensure-partition', partitionName),
  clearIncognitoPartition: (partitionName) => ipcRenderer.invoke('tessera:clear-incognito-partition', partitionName),
  updatePrivacyConfig: (adBlockEnabled, siteSettings) =>
    ipcRenderer.invoke('tessera:update-privacy-config', adBlockEnabled, siteSettings),
  setForceDarkForWebContents: (webContentsId, enabled) =>
    ipcRenderer.invoke('tessera:set-force-dark', webContentsId, enabled),
  exportPageToPdf: (webContentsId, suggestedTitle) =>
    ipcRenderer.invoke('tessera:export-pdf', webContentsId, suggestedTitle),
  openDevToolsForWebContents: (webContentsId) => ipcRenderer.invoke('tessera:open-devtools', webContentsId),
  setDefaultBrowser: () => ipcRenderer.invoke('tessera:set-default-browser'),
  isDefaultBrowser: () => ipcRenderer.invoke('tessera:is-default-browser'),
  pickCustomWallpaper: () => ipcRenderer.invoke('tessera:pick-wallpaper'),
  exportBackupToFile: (state) => ipcRenderer.invoke('tessera:export-backup', state),
  importBackupFromFile: (currentState) => ipcRenderer.invoke('tessera:import-backup', currentState),
  openDownloadedFile: (savePath) => ipcRenderer.send('tessera:open-downloaded-file', savePath),
  showDownloadedInFolder: (savePath) => ipcRenderer.send('tessera:show-downloaded-folder', savePath),
  aiGetKeyStatus: () => ipcRenderer.invoke('tessera:ai-key-status'),
  aiSetApiKey: (provider, key) => ipcRenderer.invoke('tessera:ai-set-key', provider, key),
  aiGenerateSummary: (params) => ipcRenderer.invoke('tessera:ai-summary', params),
  aiAskQuestion: (params) => ipcRenderer.invoke('tessera:ai-ask', params),
  bridgeStart: () => ipcRenderer.invoke('tessera:bridge-start'),
  bridgeStop: () => ipcRenderer.invoke('tessera:bridge-stop'),
  bridgeGetStatus: () => ipcRenderer.invoke('tessera:bridge-status'),
  bridgeUpdateContext: (info) => ipcRenderer.send('tessera:bridge-context', info),
  checkForUpdates: () => ipcRenderer.invoke('tessera:check-for-updates'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('tessera:quit-and-install-update'),
  getUpdateStatus: () => ipcRenderer.invoke('tessera:get-update-status'),
  onUpdateStatus: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: any) => cb(payload);
    ipcRenderer.on('tessera:update-status', handler);
    return () => ipcRenderer.removeListener('tessera:update-status', handler);
  },
  onTrackerBlocked: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: BlockedRequestPayload) => cb(payload);
    ipcRenderer.on('tessera:tracker-blocked', handler);
    return () => ipcRenderer.removeListener('tessera:tracker-blocked', handler);
  },
  onDownloadUpdated: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, item: DownloadItem) => cb(item);
    ipcRenderer.on('tessera:download-updated', handler);
    return () => ipcRenderer.removeListener('tessera:download-updated', handler);
  },
  onOpenExternalUrl: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, url: string) => cb(url);
    ipcRenderer.on('tessera:open-external-url', handler);
    return () => ipcRenderer.removeListener('tessera:open-external-url', handler);
  },
  onBridgeStatusChanged: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, status: LocalBridgeStatus) => cb(status);
    ipcRenderer.on('tessera:bridge-status-changed', handler);
    return () => ipcRenderer.removeListener('tessera:bridge-status-changed', handler);
  },
  onShortcut: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, action: string) => cb(action);
    ipcRenderer.on('tessera:shortcut', handler);
    return () => ipcRenderer.removeListener('tessera:shortcut', handler);
  },
  onBridgeStateImported: (cb) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      result: {
        nextState: PersistedAppState;
        importedBookmarks: number;
        importedHistory: number;
        importedSpaces: number;
      }
    ) => cb(result);
    ipcRenderer.on('tessera:bridge-state-imported', handler);
    return () => ipcRenderer.removeListener('tessera:bridge-state-imported', handler);
  }
};

contextBridge.exposeInMainWorld('tesseraApi', api);
