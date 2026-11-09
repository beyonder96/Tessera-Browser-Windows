import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  session,
  shell,
  webContents
} from 'electron';
import {
  mergeAndroidCompatibleBackup,
  serializeToAndroidCompatibleBackup,
  StorageService
} from './storageService';
import { getStandardChromiumUserAgent, PrivacyShieldController } from './privacyEngine';
import { configureGuestWebContents, type GuestContentsDeps } from './guestContents';
import { TesseraAiService } from './aiService';
import { DownloadController } from './downloadManager';
import { LocalBridgeServer } from './localBridgeServer';
import { TesseraSyncService } from './sync/tesseraSyncService';
import { UpdateService } from './updateService';
import { BrowserImportService } from './browserImportService';
import { PinCrypto } from './security/pinCrypto';
import type { HistoryEntry, PersistedAppState, SiteSettings, SpeedDialItem } from '../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable FedCM (which lacks native UI in Electron webviews) and native Windows WebAuthn modal
app.commandLine.appendSwitch('disable-features', 'FedCm,WebAuthenticationUseNativeWinApi');

// Ensure global Chromium Reduced User-Agent (without "Electron/" or app wrapper tokens)
// is applied before any session, worker, popup BrowserWindow, or <webview> is created.
app.userAgentFallback = getStandardChromiumUserAgent();

let mainWindow: BrowserWindow | null = null;
let latestStateCache: PersistedAppState | null = null;
let activeBridgePageInfo = { url: 'https://www.google.com', title: 'Tessera Browser' };

function extractHttpUrlFromArgv(argv: string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (/^https?:\/\//i.test(arg)) {
      return arg;
    }
  }
  return null;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    const externalUrl = extractHttpUrlFromArgv(commandLine);
    if (externalUrl) {
      mainWindow.webContents.send('tessera:open-external-url', externalUrl);
    }
  }
});

app.whenReady().then(async () => {
  const userDataDir = app.getPath('userData');
  const storageService = new StorageService(userDataDir);
  const aiService = new TesseraAiService(userDataDir);
  const privacyController = new PrivacyShieldController(() => mainWindow, userDataDir);
  const downloadController = new DownloadController(() => mainWindow);
  const updateController = new UpdateService(() => mainWindow);
  const syncService = new TesseraSyncService({
    sqliteDb: storageService.getSqliteDatabase(),
    getCurrentTabs: () => latestStateCache?.tabs.filter((t) => !t.isIncognito) || [],
    onOpenReceivedUrl: (url) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tessera:open-external-url', url);
      }
    },
    onDeviceConnected: (name) => {
      console.log('[TesseraSync] Dispositivo conectado via Wi-Fi:', name);
    },
    onMergeSyncPayload: async (rawJson) => {
      const result = await storageService.mergeBackup(rawJson);
      latestStateCache = result.nextState;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tessera:bridge-state-imported', result);
      }
      return result;
    }
  });

  latestStateCache = await storageService.loadState();
  void syncService.start().catch((err) => console.warn('[TesseraSync] Could not start sync service:', err));
  nativeTheme.themeSource =
    latestStateCache.settings.isDarkMode || latestStateCache.settings.forceDarkPages
      ? 'dark'
      : 'light';
  privacyController.updateConfig(latestStateCache.settings.adBlockEnabled, latestStateCache.siteSettings);

  // Pre-configure default space partitions (awaiting MV3 Chrome compatibility extension & cookie hygiene)
  await Promise.all([
    ...latestStateCache.spaces.map((sp) =>
      privacyController.ensurePartitionConfigured(`persist:${sp.id}`, (ses) =>
        downloadController.attachToSession(ses)
      )
    ),
    privacyController.ensurePartitionConfigured('incognito_session', (ses) =>
      downloadController.attachToSession(ses)
    ),
    privacyController.ensurePartitionConfigured('default', (ses) =>
      downloadController.attachToSession(ses)
    )
  ]);

  // Guarantee defaultSession uses standard Chromium UA and grants media (microphone / audio) for main window UI
  session.defaultSession.setUserAgent(getStandardChromiumUserAgent());
  session.defaultSession.setPermissionRequestHandler(
    (_wc: Electron.WebContents, _permission: string, callback: (grant: boolean) => void) => {
      callback(true);
    }
  );
  session.defaultSession.setPermissionCheckHandler(() => true);

  const localBridge = new LocalBridgeServer({
    getActivePageInfo: () => activeBridgePageInfo,
    getBackupJson: () => {
      const st = latestStateCache || storageService.getCachedState();
      return JSON.stringify(serializeToAndroidCompatibleBackup(st), null, 2);
    },
    onReceiveUrlFromPhone: (url) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tessera:open-external-url', url);
      }
    },
    onReceiveBackupFromPhone: async (rawJson) => {
      const result = await storageService.mergeBackup(rawJson);
      latestStateCache = result.nextState;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tessera:bridge-state-imported', result);
      }
      return {
        importedBookmarks: result.importedBookmarks,
        importedHistory: result.importedHistory,
        importedSpaces: result.importedSpaces
      };
    },
    onStatusChanged: (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tessera:bridge-status-changed', status);
      }
    }
  });

  const registeredShortcutWebContents = new Set<number>();
  let lastDispatchedShortcut = { action: '', time: 0 };

  function dispatchShortcut(action: string) {
    const now = Date.now();
    if (lastDispatchedShortcut.action === action && now - lastDispatchedShortcut.time < 300) {
      return;
    }
    lastDispatchedShortcut = { action, time: now };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tessera:shortcut', action);
    }
  }

  function registerShortcutInterceptor(wc: Electron.WebContents) {
    if (registeredShortcutWebContents.has(wc.id)) return;
    registeredShortcutWebContents.add(wc.id);
    wc.once('destroyed', () => registeredShortcutWebContents.delete(wc.id));

    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.isAutoRepeat || !mainWindow || mainWindow.isDestroyed()) return;
      const isCtrl = input.control || input.meta;
      const key = input.key.toLowerCase();

      if (isCtrl && !input.shift && !input.alt && key === 't') {
        event.preventDefault();
        dispatchShortcut('new-tab');
      } else if (isCtrl && input.shift && !input.alt && key === 't') {
        event.preventDefault();
        dispatchShortcut('reopen-tab');
      } else if (isCtrl && !input.shift && !input.alt && key === 'w') {
        event.preventDefault();
        dispatchShortcut('close-tab');
      } else if ((isCtrl && !input.shift && key === 'l') || (input.alt && key === 'd')) {
        event.preventDefault();
        dispatchShortcut('focus-address-bar');
      } else if (isCtrl && !input.shift && key === 'f') {
        event.preventDefault();
        dispatchShortcut('find-in-page');
      } else if (isCtrl && key === 'tab') {
        event.preventDefault();
        dispatchShortcut(input.shift ? 'prev-tab' : 'next-tab');
      } else if (isCtrl && !input.shift && !input.alt && /^[1-9]$/.test(key)) {
        event.preventDefault();
        dispatchShortcut(`switch-tab-${key}`);
      } else if ((isCtrl && key === 'r') || input.key === 'F5') {
        event.preventDefault();
        dispatchShortcut('reload');
      } else if (input.key === 'F12' || (isCtrl && input.shift && key === 'i')) {
        event.preventDefault();
        dispatchShortcut('devtools');
      } else if (input.alt && key === 'r') {
        event.preventDefault();
        dispatchShortcut('reader-mode');
      } else if (input.alt && key === 'a') {
        event.preventDefault();
        dispatchShortcut('ai-assistant');
      } else if (isCtrl && !input.shift && key === 'h') {
        event.preventDefault();
        dispatchShortcut('history');
      } else if (isCtrl && !input.shift && key === 'j') {
        event.preventDefault();
        dispatchShortcut('downloads');
      } else if (isCtrl && !input.shift && key === 'd') {
        event.preventDefault();
        dispatchShortcut('bookmark');
      } else if (isCtrl && input.shift && (key === 'n' || key === 'p')) {
        event.preventDefault();
        dispatchShortcut('new-incognito-tab');
      } else if (isCtrl && input.shift && key === 'x') {
        event.preventDefault();
        dispatchShortcut('pip-toggle');
      } else if (isCtrl && !input.shift && (key === '=' || key === '+')) {
        event.preventDefault();
        dispatchShortcut('zoom-in');
      } else if (isCtrl && !input.shift && key === '-') {
        event.preventDefault();
        dispatchShortcut('zoom-out');
      } else if (isCtrl && !input.shift && key === '0') {
        event.preventDefault();
        dispatchShortcut('zoom-reset');
      } else if (isCtrl && !input.shift && key === 'p') {
        event.preventDefault();
        dispatchShortcut('print');
      } else if (input.alt && !isCtrl && (key === 'arrowleft' || input.key === 'Left')) {
        event.preventDefault();
        dispatchShortcut('go-back');
      } else if (input.alt && !isCtrl && (key === 'arrowright' || input.key === 'Right')) {
        event.preventDefault();
        dispatchShortcut('go-forward');
      } else if (input.key === 'F11') {
        event.preventDefault();
        const nextFs = !mainWindow.isFullScreen();
        mainWindow.setFullScreen(nextFs);
        dispatchShortcut('toggle-fullscreen');
      } else if ((isCtrl && input.alt && key === 'v') || (input.alt && key === 'm')) {
        event.preventDefault();
        dispatchShortcut('voice-activate');
      }
    });
  }

  const preloadPath = path.join(__dirname, 'preload.cjs');
  const rawWebviewPreload = path.join(__dirname, 'webview-preload.cjs');
  const unpackedWebviewPreload = rawWebviewPreload.replace('app.asar', 'app.asar.unpacked');
  const webviewPreloadPath = fs.existsSync(unpackedWebviewPreload)
    ? unpackedWebviewPreload
    : rawWebviewPreload;
  const iconCandidate = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'dist', 'assets', 'icon.png')
    : path.join(process.cwd(), 'public', 'assets', 'icon.png');

  const guestDeps: GuestContentsDeps = {
    getPreloadPath: () => webviewPreloadPath,
    registerShortcuts: (contents) => registerShortcutInterceptor(contents),
    openAsTab: (url) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tessera:open-external-url', url);
      }
    },
    openExternal: (url) => {
      void shell.openExternal(url).catch(() => {});
    }
  };

  // Intercept popups & auxiliary windows (window.open / target="_blank") inside <webview> guests.
  // NOTE: the User-Agent is never changed per navigation (see electron/guestContents.ts) to avoid
  // Chromium reload loops on pages embedding accounts.google.com iframes (x.com, Gemini, YouTube).
  app.on('web-contents-created', (_ev, contents) => {
    if (contents.getType() === 'webview' || contents.getType() === 'window') {
      configureGuestWebContents(contents, guestDeps);
    }
  });

  // Handle any secondary popup BrowserWindows created via setWindowOpenHandler
  app.on('browser-window-created', (_ev, win) => {
    if (win !== mainWindow) {
      registerShortcutInterceptor(win.webContents);
      const iconPath = fs.existsSync(iconCandidate) ? iconCandidate : undefined;
      if (iconPath) {
        try { win.setIcon(iconPath); } catch {}
      }
      try {
        win.setMenuBarVisibility(false);
        win.setAutoHideMenuBar(true);
      } catch {}

      const bringToFront = () => {
        if (!win.isDestroyed()) {
          try {
            win.show();
            win.focus();
            win.moveTop();
          } catch {}
        }
      };

      win.once('ready-to-show', bringToFront);
      win.webContents.on('did-finish-load', bringToFront);
      setTimeout(bringToFront, 100);
      setTimeout(bringToFront, 400);

      win.webContents.on('page-title-updated', (_e, title) => {
        if (!win.isDestroyed() && title) {
          try { win.setTitle(title); } catch {}
        }
      });
    }
  });

  // Support local intranet, private IP printers, ERP servers & self-signed corporate tools
  app.on('certificate-error', (event, _webContents, url, _error, _cert, callback) => {
    try {
      const u = new URL(url);
      const isPrivateOrLocal =
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        /^192\.168\./.test(u.hostname) ||
        /^10\./.test(u.hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(u.hostname) ||
        u.hostname.endsWith('.local');

      if (isPrivateOrLocal) {
        event.preventDefault();
        callback(true); // Allow local intranet tools without ERR_CERT_AUTHORITY_INVALID
        return;
      }
    } catch {}
    callback(false);
  });

  mainWindow = new BrowserWindow({
    width: 1340,
    height: 860,
    minWidth: 820,
    minHeight: 580,
    frame: false,
    backgroundColor: latestStateCache.settings.isDarkMode ? '#000000' : '#F7F4EB',
    icon: fs.existsSync(iconCandidate) ? iconCandidate : undefined,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: true
    }
  });

  registerShortcutInterceptor(mainWindow.webContents);

  // Enforce safe <webview> guest preferences and physical preload script path + enable PDF Viewer plugins
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences) => {
    webPreferences.preload = webviewPreloadPath;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = true;
    webPreferences.contextIsolation = true;
    webPreferences.plugins = true; // Enables Chromium's native PDF Viewer plugin!
  });

  mainWindow.webContents.on('did-attach-webview', (_event, guestWebContents) => {
    configureGuestWebContents(guestWebContents, guestDeps);
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[Tessera] Page failed to load: ${code} - ${desc} (${url})`);
  });

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[Tessera] Render process gone:', details);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    const startupUrl = extractHttpUrlFromArgv(process.argv);
    if (startupUrl) {
      setTimeout(() => {
        mainWindow?.webContents.send('tessera:open-external-url', startupUrl);
      }, 600);
    }
  });

  // Safety fallback in case ready-to-show is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 2500);

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Check for auto-updates silently in background
  updateController.checkForUpdatesSilently();

  // ==========================================
  // IPC HANDLERS
  // ==========================================
  ipcMain.handle('tessera:get-webview-preload-path', () => {
    return pathToFileURL(webviewPreloadPath).href;
  });

  ipcMain.handle('tessera:get-system-info', () => {
    return {
      appVersion: app.getVersion(),
      chromeVersion: process.versions.chrome || '156.0.8078.75',
      electronVersion: process.versions.electron || '45.2.1',
      nodeVersion: process.versions.node || process.version,
      arch: process.arch === 'x64' ? 'Windows x64' : `Windows ${process.arch}`,
      isPackaged: app.isPackaged
    };
  });

  ipcMain.on('tessera:window-minimize', () => mainWindow?.minimize());
  ipcMain.handle('tessera:window-toggle-maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }
    mainWindow.maximize();
    return true;
  });
  ipcMain.handle('tessera:window-is-maximized', () => mainWindow?.isMaximized() ?? false);
  ipcMain.on('tessera:window-close', () => mainWindow?.close());

  ipcMain.handle('tessera:load-state', async () => {
    latestStateCache = await storageService.loadState();
    return latestStateCache;
  });

  ipcMain.handle('tessera:save-state', async (_e, nextState: PersistedAppState) => {
    latestStateCache = nextState;
    await storageService.saveState(nextState);
    nativeTheme.themeSource =
      nextState.settings.isDarkMode || nextState.settings.forceDarkPages ? 'dark' : 'light';
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor(nextState.settings.isDarkMode ? '#000000' : '#F7F4EB');
    }
  });

  ipcMain.handle('tessera:search-omnibar', async (_e, query: string, limit?: number) => {
    return await storageService.searchOmnibar(query, limit);
  });

  ipcMain.handle('tessera:record-history-visit', async (_e, entry: HistoryEntry) => {
    await storageService.recordHistoryVisit(entry);
  });

  ipcMain.handle('tessera:ensure-partition', async (_e, partitionName: string) => {
    await privacyController.ensurePartitionConfigured(partitionName, (ses) =>
      downloadController.attachToSession(ses)
    );
  });

  ipcMain.handle('tessera:clear-incognito-partition', async (_e, partitionName: string) => {
    await privacyController.clearIncognitoPartition(partitionName);
  });

  ipcMain.handle(
    'tessera:update-privacy-config',
    (_e, adBlockEnabled: boolean, siteSettings: Record<string, SiteSettings>) => {
      privacyController.updateConfig(adBlockEnabled, siteSettings);
    }
  );

  // Native prefers-color-scheme synchronization via Electron nativeTheme (avoids attaching CDP wc.debugger,
  // which triggers Google Sign-In "This browser or app may not be secure" remote-debugging blocks!)
  ipcMain.handle('tessera:set-force-dark', async (_e, wcId: number, enabled: boolean) => {
    const wc = webContents.fromId(wcId);
    if (wc && !wc.isDestroyed() && wc.debugger.isAttached()) {
      try {
        wc.debugger.detach();
      } catch {
        // Ignore detach errors
      }
    }
    const preferDark = enabled || Boolean(latestStateCache?.settings.isDarkMode);
    nativeTheme.themeSource = preferDark ? 'dark' : 'light';
  });

  ipcMain.handle('tessera:export-pdf', async (_e, wcId: number, suggestedTitle: string) => {
    const wc = webContents.fromId(wcId);
    if (!wc || wc.isDestroyed() || !mainWindow) return null;
    const cleanName = (suggestedTitle || 'Artigo_Tessera').replace(/[<>:"/\\|?*]+/g, '_').slice(0, 70);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Página como PDF',
      defaultPath: path.join(app.getPath('documents'), `${cleanName}.pdf`),
      filters: [{ name: 'Documento PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return null;
    const pdfBuffer = await wc.printToPDF({ printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(filePath, pdfBuffer);
    shell.showItemInFolder(filePath);
    return filePath;
  });

  ipcMain.handle('tessera:open-devtools', (_e, wcId: number) => {
    const wc = webContents.fromId(wcId);
    if (wc && !wc.isDestroyed()) {
      wc.openDevTools({ mode: 'detach' });
    }
  });

  ipcMain.handle('tessera:set-default-browser', () => {
    const okHttp = app.setAsDefaultProtocolClient('http');
    const okHttps = app.setAsDefaultProtocolClient('https');
    // Also open Windows Default Apps settings so Windows 10/11 user can confirm one-click association
    if (process.platform === 'win32') {
      void shell.openExternal('ms-settings:defaultapps');
    }
    return okHttp && okHttps;
  });

  ipcMain.handle('tessera:is-default-browser', () => {
    return app.isDefaultProtocolClient('https') && app.isDefaultProtocolClient('http');
  });

  ipcMain.handle('tessera:pick-wallpaper', async () => {
    if (!mainWindow) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Escolher Papel de Parede Personalizado',
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    });
    if (canceled || !filePaths[0]) return null;
    const ext = path.extname(filePaths[0]).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const base64 = fs.readFileSync(filePaths[0]).toString('base64');
    return `data:${mime};base64,${base64}`;
  });

  ipcMain.handle('tessera:export-backup', async (_e, state: PersistedAppState) => {
    if (!mainWindow) return null;
    const backup = serializeToAndroidCompatibleBackup(state);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Backup Geral (Compatível com Tessera Android)',
      defaultPath: path.join(app.getPath('downloads'), `tessera_backup_${Date.now()}.json`),
      filters: [{ name: 'Backup Tessera JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf-8');
    shell.showItemInFolder(filePath);
    return filePath;
  });

  ipcMain.handle('tessera:import-backup', async (_e, currentState: PersistedAppState) => {
    if (!mainWindow) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar Backup do Tessera Browser (Android ou Windows)',
      properties: ['openFile'],
      filters: [{ name: 'Backup Tessera JSON', extensions: ['json'] }]
    });
    if (canceled || !filePaths[0]) return null;
    const raw = fs.readFileSync(filePaths[0], 'utf-8');
    const result = mergeAndroidCompatibleBackup(currentState, raw);
    latestStateCache = result.nextState;
    await storageService.saveState(result.nextState);
    return result;
  });

  ipcMain.on('tessera:open-downloaded-file', (_e, savePath: string) => {
    downloadController.openDownloadedFile(savePath);
  });
  ipcMain.on('tessera:show-downloaded-folder', (_e, savePath: string) => {
    downloadController.showDownloadedInFolder(savePath);
  });

  // AI Service
  ipcMain.handle('tessera:ai-key-status', () => aiService.getKeyStatus());
  ipcMain.handle('tessera:ai-set-key', (_e, provider, key) => aiService.setApiKey(provider, key));
  ipcMain.handle('tessera:ai-summary', (_e, params) => aiService.generateSummary(params));
  ipcMain.handle('tessera:ai-ask', (_e, params) => aiService.askQuestion(params));
  ipcMain.handle(
    'tessera:ai-transcribe-audio',
    async (_e, base64Audio: string, mimeType: string, isWakeWordCheck?: boolean) => {
      const buffer = Buffer.from(base64Audio, 'base64');
      return aiService.transcribeAudio(buffer, mimeType, Boolean(isWakeWordCheck));
    }
  );

  // Local Wi-Fi Bridge & Tessera Sync v2
  ipcMain.handle('tessera:bridge-start', () => localBridge.start());
  ipcMain.handle('tessera:bridge-stop', () => localBridge.stop());
  ipcMain.handle('tessera:bridge-status', () => localBridge.getStatus());
  ipcMain.handle('tessera:sync-info', () => syncService.getServerInfo());
  ipcMain.handle('tessera:sync-start', () => syncService.start());
  ipcMain.handle('tessera:sync-stop', () => syncService.stop());
  ipcMain.handle('tessera:sync-send-tab-to-mobile', (_e, url: string, title?: string) => {
    return syncService.enqueueTabForMobile(url, title);
  });
  ipcMain.handle('tessera:sync-connected-mobile', () => {
    return syncService.getConnectedMobileDevice();
  });
  ipcMain.handle('tessera:pin-hash', (_e, pin: string) => {
    return PinCrypto.hashPin(pin);
  });
  ipcMain.handle('tessera:pin-verify', (_e, candidatePin: string, storedHash: string) => {
    return PinCrypto.verifyPin(candidatePin, storedHash);
  });
  ipcMain.handle('tessera:clear-browsing-data', async () => {
    try {
      const sessionsToClear = [session.defaultSession];
      const spaces = latestStateCache?.spaces || [];
      for (const sp of spaces) {
        sessionsToClear.push(session.fromPartition(`persist:${sp.id}`));
      }
      sessionsToClear.push(session.fromPartition('incognito_session'));

      await Promise.all(
        sessionsToClear.map(async (s) => {
          try {
            await s.clearCache();
            await s.clearStorageData();
          } catch {}
        })
      );
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle('tessera:check-onboarding-needed', async () => {
    return !(await storageService.getSqliteDatabase().getOnboardingStatus());
  });

  ipcMain.handle('tessera:complete-onboarding', async () => {
    await storageService.getSqliteDatabase().setOnboardingCompleted(true);
    return true;
  });

  ipcMain.handle('tessera:get-installed-browsers', () => {
    return BrowserImportService.getInstalledBrowsers();
  });

  ipcMain.handle('tessera:translate-texts', async (_e, texts: string[], targetLang = 'pt') => {
    if (!Array.isArray(texts) || texts.length === 0) return [];
    const results: string[] = [];
    for (const text of texts.slice(0, 100)) {
      if (!text || text.trim().length <= 1) {
        results.push(text);
        continue;
      }
      try {
        const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
          targetLang
        )}&dt=t&q=${encodeURIComponent(text.trim())}`;
        const res = await fetch(endpoint, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data) && Array.isArray(data[0])) {
            const translatedPart = data[0].map((part: any) => part[0]).join('');
            results.push(translatedPart || text);
            continue;
          }
        }
        results.push(text);
      } catch {
        results.push(text);
      }
    }
    return results;
  });

  ipcMain.handle('tessera:import-browser-bookmarks', async (_e, browserId: 'chrome' | 'edge') => {
    const localAppData = process.env.LOCALAPPDATA || '';
    const dir =
      browserId === 'edge'
        ? path.join(localAppData, 'Microsoft', 'Edge', 'User Data')
        : path.join(localAppData, 'Google', 'Chrome', 'User Data');

    const bookmarks = BrowserImportService.extractChromeBookmarks(dir);
    if (bookmarks.length === 0) return { count: 0 };

    const spaceId = latestStateCache?.activeSpaceId || 'space_general';
    const newItems: SpeedDialItem[] = [];
    for (const bm of bookmarks) {
      const item: SpeedDialItem = {
        id: `bm_imported_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: bm.title,
        url: bm.url,
        spaceId,
        badgeColorHex: '#4285F4',
        badgeColor: 0xff4285f4
      };
      await storageService.getSqliteDatabase().insertBookmark(item);
      newItems.push(item);
    }

    if (latestStateCache) {
      const existingUrls = new Set(latestStateCache.speedDialItems.map((b) => b.url.toLowerCase()));
      for (const item of newItems) {
        if (!existingUrls.has(item.url.toLowerCase())) {
          existingUrls.add(item.url.toLowerCase());
          latestStateCache.speedDialItems.push(item);
        }
      }
    }

    return { count: bookmarks.length };
  });

  ipcMain.handle('tessera:get-google-account-status', async () => {
    const spacesToCheck = latestStateCache?.spaces || [];
    for (const sp of spacesToCheck) {
      const res = await BrowserImportService.checkGoogleSession(session.fromPartition(`persist:${sp.id}`));
      if (res.isAuthenticated) return res;
    }
    return BrowserImportService.checkGoogleSession(session.defaultSession);
  });

  ipcMain.handle('tessera:clear-google-auth-cookies', async (_e, partitionName?: string) => {
    if (partitionName && partitionName !== 'default') {
      await privacyController.sanitizeUnauthenticatedGoogleRejectionCookies(
        session.fromPartition(partitionName)
      );
    } else {
      const spacesToSanitize = latestStateCache?.spaces || [];
      await Promise.all([
        privacyController.sanitizeUnauthenticatedGoogleRejectionCookies(session.defaultSession),
        ...spacesToSanitize.map((sp) =>
          privacyController.sanitizeUnauthenticatedGoogleRejectionCookies(
            session.fromPartition(`persist:${sp.id}`)
          )
        )
      ]);
    }
    return { success: true };
  });

  ipcMain.handle('tessera:open-external-url', async (_e, targetUrl: string) => {
    if (typeof targetUrl === 'string' && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
      await shell.openExternal(targetUrl);
    }
  });
  ipcMain.on('tessera:bridge-context', (_e, info: { url: string; title: string }) => {
    activeBridgePageInfo = info;
  });

  app.on('before-quit', () => {
    localBridge.stop();
    syncService.stop();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
