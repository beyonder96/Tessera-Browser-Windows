import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { app, shell, type BrowserWindow, type Session } from 'electron';
import type { DownloadItem } from '../src/shared/types';

export class DownloadController {
  private attachedSessions = new WeakSet<Session>();
  private getMainWindow: () => BrowserWindow | null;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
  }

  attachToSession(ses: Session): void {
    if (this.attachedSessions.has(ses)) return;
    this.attachedSessions.add(ses);

    ses.on('will-download', (_event, item) => {
      const downloadsDir = app.getPath('downloads');
      const rawName = item.getFilename() || `download_${Date.now()}`;
      let targetPath = path.join(downloadsDir, rawName);

      // Avoid overwriting existing file by appending counter
      const ext = path.extname(rawName);
      const base = path.basename(rawName, ext);
      let counter = 1;
      while (fs.existsSync(targetPath)) {
        targetPath = path.join(downloadsDir, `${base} (${counter})${ext}`);
        counter++;
      }

      item.setSavePath(targetPath);

      const id = crypto.randomUUID();
      const buildSnapshot = (status: DownloadItem['status']): DownloadItem => ({
        id,
        fileName: path.basename(targetPath),
        url: item.getURL(),
        savePath: targetPath,
        mimeType: item.getMimeType() || 'application/octet-stream',
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        status,
        timestamp: Date.now()
      });

      this.emitUpdate(buildSnapshot('IN_PROGRESS'));

      item.on('updated', (_ev, state) => {
        if (state === 'interrupted') {
          this.emitUpdate(buildSnapshot('FAILED'));
        } else if (item.isPaused()) {
          this.emitUpdate(buildSnapshot('IN_PROGRESS'));
        } else {
          this.emitUpdate(buildSnapshot('IN_PROGRESS'));
        }
      });

      item.once('done', (_ev, state) => {
        if (state === 'completed') {
          this.emitUpdate(buildSnapshot('COMPLETED'));
        } else if (state === 'cancelled') {
          this.emitUpdate(buildSnapshot('CANCELLED'));
        } else {
          this.emitUpdate(buildSnapshot('FAILED'));
        }
      });
    });
  }

  private emitUpdate(download: DownloadItem): void {
    const win = this.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('tessera:download-updated', download);
    }
  }

  openDownloadedFile(savePath: string): void {
    if (savePath && fs.existsSync(savePath)) {
      void shell.openPath(savePath);
    }
  }

  showDownloadedInFolder(savePath: string): void {
    if (savePath && fs.existsSync(savePath)) {
      shell.showItemInFolder(savePath);
    }
  }
}
