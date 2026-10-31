import { type BrowserWindow, ipcMain } from 'electron';
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;

export interface UpdateStatusPayload {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseNotes?: string;
  error?: string;
}

export class UpdateService {
  private getMainWindow: () => BrowserWindow | null;
  private currentStatus: UpdateStatusPayload = { status: 'idle' };

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
    this.init();
  }

  private init() {
    // Disable auto-downloading if you want explicit consent, or keep true for seamless Antigravity style
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.sendStatus({ status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      this.sendStatus({
        status: 'available',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.sendStatus({ status: 'idle' });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.sendStatus({
        status: 'downloading',
        version: autoUpdater.currentVersion.version
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.sendStatus({
        status: 'downloaded',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
      });
    });

    autoUpdater.on('error', (err) => {
      console.warn('[UpdateService] Update check notice:', err?.message || err);
      this.sendStatus({
        status: 'error',
        error: err?.message || 'Erro ao verificar atualizações'
      });
    });

    // Register IPC handlers
    ipcMain.handle('tessera:check-for-updates', async () => {
      try {
        await autoUpdater.checkForUpdates();
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e?.message };
      }
    });

    ipcMain.handle('tessera:quit-and-install-update', () => {
      autoUpdater.quitAndInstall();
    });

    ipcMain.handle('tessera:get-update-status', () => {
      return this.currentStatus;
    });
  }

  public checkForUpdatesSilently() {
    setTimeout(() => {
      try {
        void autoUpdater.checkForUpdates();
      } catch (err) {
        console.warn('[UpdateService] Silent check error:', err);
      }
    }, 3000);
  }

  private sendStatus(payload: UpdateStatusPayload) {
    this.currentStatus = payload;
    const win = this.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('tessera:update-status', payload);
    }
  }
}
