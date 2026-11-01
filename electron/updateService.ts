import { type BrowserWindow, app, ipcMain, shell } from 'electron';
import electronUpdater from 'electron-updater';

export interface UpdateStatusPayload {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  isPortable?: boolean;
  error?: string;
}

export interface ManualUpdateCheckResult {
  success: boolean;
  status: 'up-to-date' | 'update-available' | 'error';
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  error?: string;
}

/**
 * Robust semantic version comparison (e.g. "1.0.4" vs "1.0.3").
 * Returns true if remote is strictly greater than current.
 */
export function isNewerVersion(remote: string, current: string): boolean {
  const cleanRemote = (remote || '').trim().replace(/^v/i, '').trim();
  const cleanCurrent = (current || '').trim().replace(/^v/i, '').trim();
  const pRemote = cleanRemote.split('.').map((n) => parseInt(n, 10) || 0);
  const pCurrent = cleanCurrent.split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(pRemote.length, pCurrent.length);
  for (let i = 0; i < maxLen; i++) {
    const r = pRemote[i] ?? 0;
    const c = pCurrent[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

export class UpdateService {
  private getMainWindow: () => BrowserWindow | null;
  private currentStatus: UpdateStatusPayload = { status: 'idle' };
  private autoUpdater: typeof electronUpdater.autoUpdater | null = null;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
    this.init();
  }

  private getUpdaterInstance() {
    if (!this.autoUpdater && typeof app !== 'undefined' && typeof app.getVersion === 'function') {
      this.autoUpdater = electronUpdater.autoUpdater;
    }
    return this.autoUpdater;
  }

  private init() {
    const updater = this.getUpdaterInstance();
    if (updater) {
      updater.autoDownload = true;
      updater.autoInstallOnAppQuit = true;

      updater.on('checking-for-update', () => {
        this.sendStatus({ status: 'checking' });
      });

      updater.on('update-available', (info) => {
        this.sendStatus({
          status: 'available',
          version: info.version,
          releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
        });
      });

      updater.on('update-not-available', () => {
        this.sendStatus({ status: 'idle' });
      });

      updater.on('download-progress', () => {
        this.sendStatus({
          status: 'downloading',
          version: updater.currentVersion.version
        });
      });

      updater.on('update-downloaded', (info) => {
        this.sendStatus({
          status: 'downloaded',
          version: info.version,
          releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
        });
      });

      updater.on('error', (err) => {
        console.warn('[UpdateService] autoUpdater notice:', err?.message || err);
        if (!app.isPackaged) {
          this.sendStatus({ status: 'idle' });
        } else {
          this.sendStatus({
            status: 'error',
            error: err?.message || 'Erro ao verificar atualizações'
          });
        }
      });
    }

    // Register IPC handlers
    ipcMain.handle('tessera:check-for-updates', async (): Promise<ManualUpdateCheckResult> => {
      return await this.performUpdateCheck();
    });

    ipcMain.handle('tessera:quit-and-install-update', () => {
      const updater = this.getUpdaterInstance();
      if (this.currentStatus.status === 'downloaded' && updater) {
        updater.quitAndInstall();
      } else if (this.currentStatus.downloadUrl) {
        void shell.openExternal(this.currentStatus.downloadUrl);
      }
    });

    ipcMain.handle('tessera:get-update-status', () => {
      return this.currentStatus;
    });
  }

  /**
   * Queries GitHub Releases API directly as a reliable fallback when
   * running locally (dev/unpackaged) or as a portable executable.
   */
  public async checkGitHubRelease(): Promise<{
    hasUpdate: boolean;
    remoteVersion: string;
    releaseNotes?: string;
    downloadUrl?: string;
    releaseUrl?: string;
  }> {
    const res = await fetch('https://api.github.com/repos/beyonder96/Tessera-Browser-Windows/releases/latest', {
      headers: {
        'User-Agent': 'Tessera-Browser-Windows',
        Accept: 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) {
      throw new Error(`GitHub Releases API retornou HTTP ${res.status}`);
    }
    const data = (await res.json()) as any;
    const tagName = data.tag_name || '';
    const remoteVersion = tagName.replace(/^v/i, '').trim();
    const currentVersion = app.getVersion();
    const hasUpdate = isNewerVersion(remoteVersion, currentVersion);
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const setupAsset = assets.find(
      (a: any) => typeof a.name === 'string' && a.name.includes('Setup') && a.name.endsWith('.exe')
    );
    const portableAsset = assets.find(
      (a: any) => typeof a.name === 'string' && a.name.includes('Portable') && a.name.endsWith('.exe')
    );
    const downloadUrl =
      setupAsset?.browser_download_url || portableAsset?.browser_download_url || data.html_url;

    return {
      hasUpdate,
      remoteVersion,
      releaseNotes: data.body || data.name,
      downloadUrl,
      releaseUrl: data.html_url
    };
  }

  /**
   * Performs an update check using either autoUpdater (packaged NSIS)
   * or GitHub API fallback (unpackaged / portable).
   */
  public async performUpdateCheck(): Promise<ManualUpdateCheckResult> {
    this.sendStatus({ status: 'checking' });
    const currentVersion = app.getVersion();

    // 1. Packaged NSIS execution: try official autoUpdater
    if (app.isPackaged) {
      try {
        const updater = this.getUpdaterInstance();
        if (updater) {
          const result = await updater.checkForUpdates();
          if (result && result.updateInfo && isNewerVersion(result.updateInfo.version, currentVersion)) {
            return {
              success: true,
              status: 'update-available',
              currentVersion,
              latestVersion: result.updateInfo.version,
              releaseNotes:
                typeof result.updateInfo.releaseNotes === 'string'
                  ? result.updateInfo.releaseNotes
                  : undefined
            };
          }
        }
      } catch (e: any) {
        console.warn('[UpdateService] autoUpdater check exception, checking GitHub API fallback:', e?.message || e);
      }
    }

    // 2. Fallback check against official GitHub Releases API
    try {
      const gh = await this.checkGitHubRelease();
      if (gh.hasUpdate) {
        const payload: UpdateStatusPayload = {
          status: 'available',
          version: gh.remoteVersion,
          releaseNotes: gh.releaseNotes,
          downloadUrl: gh.downloadUrl,
          isPortable: !app.isPackaged
        };
        this.sendStatus(payload);
        return {
          success: true,
          status: 'update-available',
          currentVersion,
          latestVersion: gh.remoteVersion,
          releaseNotes: gh.releaseNotes,
          downloadUrl: gh.downloadUrl
        };
      } else {
        this.sendStatus({ status: 'idle' });
        return {
          success: true,
          status: 'up-to-date',
          currentVersion,
          latestVersion: gh.remoteVersion
        };
      }
    } catch (e: any) {
      console.warn('[UpdateService] GitHub API fallback failed:', e?.message || e);
      this.sendStatus({ status: 'error', error: e?.message });
      return {
        success: false,
        status: 'error',
        currentVersion,
        error: e?.message || 'Não foi possível conectar ao servidor de atualizações do GitHub'
      };
    }
  }

  public checkForUpdatesSilently() {
    setTimeout(async () => {
      try {
        if (app.isPackaged) {
          const updater = this.getUpdaterInstance();
          if (updater) void updater.checkForUpdates();
        } else {
          // Dev / local files check against real GitHub releases
          const gh = await this.checkGitHubRelease();
          if (gh.hasUpdate) {
            this.sendStatus({
              status: 'available',
              version: gh.remoteVersion,
              releaseNotes: gh.releaseNotes,
              downloadUrl: gh.downloadUrl,
              isPortable: true
            });
          }
        }
      } catch (err: any) {
        console.warn('[UpdateService] Silent check notice:', err?.message || err);
      }
    }, 3500);
  }

  private sendStatus(payload: UpdateStatusPayload) {
    this.currentStatus = payload;
    const win = this.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('tessera:update-status', payload);
    }
  }
}
