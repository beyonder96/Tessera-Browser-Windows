import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  shell,
  webContents
} from 'electron';
import {
  mergeAndroidCompatibleBackup,
  serializeToAndroidCompatibleBackup,
  StorageService
} from './storageService';
import { PrivacyShieldController } from './privacyEngine';
import { TesseraAiService } from './aiService';
import { DownloadController } from './downloadManager';
import { LocalBridgeServer } from './localBridgeServer';
import { UpdateService } from './updateService';
import type { PersistedAppState, SiteSettings } from '../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData');
  const storageService = new StorageService(userDataDir);
  const aiService = new TesseraAiService(userDataDir);
  const privacyController = new PrivacyShieldController(() => mainWindow);
  const downloadController = new DownloadController(() => mainWindow);
  const updateController = new UpdateService(() => mainWindow);

  latestStateCache = storageService.loadState();
  privacyController.updateConfig(latestStateCache.settings.adBlockEnabled, latestStateCache.siteSettings);

  // Pre-configure default space partitions
  for (const sp of latestStateCache.spaces) {
    privacyController.ensurePartitionConfigured(`persist:${sp.id}`, (ses) =>
      downloadController.attachToSession(ses)
    );
  }
  privacyController.ensurePartitionConfigured('incognito_session', (ses) =>
    downloadController.attachToSession(ses)
  );

  // Guarantee defaultSession grants media (microphone / audio) for main window UI
  session.defaultSession.setPermissionRequestHandler(
    (_wc: Electron.WebContents, _permission: string, callback: (grant: boolean) => void) => {
      callback(true);
    }
  );
  session.defaultSession.setPermissionCheckHandler(() => true);

  const localBridge = new LocalBridgeServer({
    getActivePageInfo: () => activeBridgePageInfo,
    getBackupJson: () => {
      const st = latestStateCache || storageService.loadState();
      return JSON.stringify(serializeToAndroidCompatibleBackup(st), null, 2);
    },
    onReceiveUrlFromPhone: (url) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tessera:open-external-url', url);
      }
    },
    onReceiveBackupFromPhone: (rawJson) => {
      const current = latestStateCache || storageService.loadState();
      const result = mergeAndroidCompatibleBackup(current, rawJson);
      latestStateCache = result.nextState;
      storageService.saveState(result.nextState);
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
      } else if ((isCtrl && input.shift && key === 'v') || (input.alt && key === 'v')) {
        event.preventDefault();
        dispatchShortcut('voice-activate');
      }
    });
  }

  // Intercept popups & auxiliary windows (window.open / target="_blank") inside <webview> guests
  app.on('web-contents-created', (_ev, contents) => {
    registerShortcutInterceptor(contents);
    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler((details) => {
        const url = details.url;
        // Check if this is a popup window test, OAuth popup, or auxiliary window with dimensions
        const isPopupTestOrAuxiliary =
          url === 'about:blank' ||
          !url ||
          !!details.features ||
          details.disposition === 'new-window';

        if (isPopupTestOrAuxiliary) {
          // Allow popup creation so window.open returns a real WindowProxy object!
          // Solves ERP/CalcGraf "A janela pop-up foi bloqueada automaticamente!"
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              parent: mainWindow ?? undefined,
              modal: false,
              autoHideMenuBar: true,
              width: 900,
              height: 650,
              webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: webviewPreloadPath,
                plugins: true
              }
            }
          };
        }

        // Standard link navigation (target="_blank") opens cleanly as a Tessera tab
        if (/^https?:\/\//i.test(url) && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tessera:open-external-url', url);
        } else if (/^(mailto|tel|whatsapp|tg):/i.test(url)) {
          void shell.openExternal(url);
        }
        return { action: 'deny' };
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

  const preloadPath = path.join(__dirname, 'preload.cjs');
  const rawWebviewPreload = path.join(__dirname, 'webview-preload.cjs');
  const unpackedWebviewPreload = rawWebviewPreload.replace('app.asar', 'app.asar.unpacked');
  const webviewPreloadPath = fs.existsSync(unpackedWebviewPreload)
    ? unpackedWebviewPreload
    : rawWebviewPreload;
  const iconCandidate = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'dist', 'assets', 'icon.png')
    : path.join(process.cwd(), 'public', 'assets', 'icon.png');

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
    webPreferences.contextIsolation = true;
    webPreferences.plugins = true; // Enables Chromium's native PDF Viewer plugin!
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

  ipcMain.handle('tessera:load-state', () => {
    latestStateCache = storageService.loadState();
    return latestStateCache;
  });

  ipcMain.handle('tessera:save-state', (_e, nextState: PersistedAppState) => {
    latestStateCache = nextState;
    storageService.saveState(nextState);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor(nextState.settings.isDarkMode ? '#000000' : '#F7F4EB');
    }
  });

  ipcMain.handle('tessera:ensure-partition', (_e, partitionName: string) => {
    privacyController.ensurePartitionConfigured(partitionName, (ses) =>
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

  // Authentic Blink AlgorithmicDarkening via Chromium DevTools Protocol (matches Android WebSettingsCompat.FORCE_DARK_ON)
  ipcMain.handle('tessera:set-force-dark', async (_e, wcId: number, enabled: boolean) => {
    const wc = webContents.fromId(wcId);
    if (!wc || wc.isDestroyed()) return;
    try {
      if (!wc.debugger.isAttached()) {
        wc.debugger.attach('1.3');
      }
      await wc.debugger.sendCommand('Emulation.setEmulatedMedia', {
        media: 'screen',
        features: [{ name: 'prefers-color-scheme', value: enabled ? 'dark' : 'light' }]
      });
      await wc.debugger.sendCommand('Emulation.setAutoDarkModeOverride', { enabled });
    } catch {
      // Ignore if debugger busy
    }
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
    storageService.saveState(result.nextState);
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
  ipcMain.handle('tessera:ai-transcribe-audio', async (_e, base64Audio: string, mimeType: string) => {
    const buffer = Buffer.from(base64Audio, 'base64');
    return aiService.transcribeAudio(buffer, mimeType);
  });

  // Local Wi-Fi Bridge
  ipcMain.handle('tessera:bridge-start', () => localBridge.start());
  ipcMain.handle('tessera:bridge-stop', () => localBridge.stop());
  ipcMain.handle('tessera:bridge-status', () => localBridge.getStatus());
  ipcMain.handle('tessera:clear-browsing-data', async () => {
    try {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData();
      return true;
    } catch {
      return false;
    }
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
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
