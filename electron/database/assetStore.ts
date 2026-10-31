import fs from 'node:fs';
import path from 'node:path';

export class AssetStore {
  private readonly baseDir: string;
  private readonly thumbnailsDir: string;
  private readonly wallpapersDir: string;
  private readonly articlesDir: string;

  constructor(userDataDir: string) {
    this.baseDir = path.join(userDataDir, 'assets');
    this.thumbnailsDir = path.join(this.baseDir, 'thumbnails');
    this.wallpapersDir = path.join(this.baseDir, 'wallpapers');
    this.articlesDir = path.join(this.baseDir, 'articles');

    fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    fs.mkdirSync(this.wallpapersDir, { recursive: true });
    fs.mkdirSync(this.articlesDir, { recursive: true });
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Saves a thumbnail data URL or raw buffer to disk and returns the relative path.
   */
  saveThumbnail(tabId: string, dataUrlOrBuffer: string | Buffer): string | null {
    try {
      const sanitizedId = tabId.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `tab_${sanitizedId}.jpg`;
      const fullPath = path.join(this.thumbnailsDir, filename);

      let buffer: Buffer;
      if (typeof dataUrlOrBuffer === 'string') {
        if (!dataUrlOrBuffer.startsWith('data:image')) {
          // It's not a data URL, could already be a path or empty
          return dataUrlOrBuffer;
        }
        const commaIdx = dataUrlOrBuffer.indexOf(',');
        if (commaIdx === -1) return null;
        buffer = Buffer.from(dataUrlOrBuffer.slice(commaIdx + 1), 'base64');
      } else {
        buffer = dataUrlOrBuffer;
      }

      fs.writeFileSync(fullPath, buffer);
      return path.join('assets', 'thumbnails', filename).replace(/\\/g, '/');
    } catch (err) {
      console.error('[AssetStore] Failed to save thumbnail for tab:', tabId, err);
      return null;
    }
  }

  /**
   * Reads a thumbnail from disk and returns a data URL.
   */
  getThumbnailDataUrl(relPath: string | null | undefined): string | null {
    if (!relPath) return null;
    if (relPath.startsWith('data:image')) return relPath;
    try {
      const fullPath = path.resolve(this.baseDir, '..', relPath);
      if (!fs.existsSync(fullPath)) return null;
      const buffer = fs.readFileSync(fullPath);
      const isPng = relPath.endsWith('.png');
      const mime = isPng ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /**
   * Saves custom wallpaper data to disk and returns the relative path.
   */
  saveCustomWallpaper(dataUrlOrBuffer: string | Buffer): string | null {
    try {
      const filename = `custom_wallpaper_${Date.now()}.jpg`;
      const fullPath = path.join(this.wallpapersDir, filename);

      let buffer: Buffer;
      if (typeof dataUrlOrBuffer === 'string') {
        if (!dataUrlOrBuffer.startsWith('data:image')) {
          return dataUrlOrBuffer;
        }
        const commaIdx = dataUrlOrBuffer.indexOf(',');
        if (commaIdx === -1) return null;
        buffer = Buffer.from(dataUrlOrBuffer.slice(commaIdx + 1), 'base64');
      } else {
        buffer = dataUrlOrBuffer;
      }

      fs.writeFileSync(fullPath, buffer);
      return path.join('assets', 'wallpapers', filename).replace(/\\/g, '/');
    } catch (err) {
      console.error('[AssetStore] Failed to save custom wallpaper:', err);
      return null;
    }
  }

  /**
   * Reads custom wallpaper from disk and returns a data URL.
   */
  getCustomWallpaperDataUrl(relPath: string | null | undefined): string | null {
    if (!relPath) return null;
    if (relPath.startsWith('data:image')) return relPath;
    try {
      const fullPath = path.resolve(this.baseDir, '..', relPath);
      if (!fs.existsSync(fullPath)) return null;
      const buffer = fs.readFileSync(fullPath);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /**
   * Cleans thumbnail files for tabs that are no longer open.
   */
  cleanOrphanThumbnails(activeTabIds: string[]): void {
    try {
      const activeFilenames = new Set(
        activeTabIds.map((id) => `tab_${id.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`)
      );
      const existingFiles = fs.readdirSync(this.thumbnailsDir);
      for (const file of existingFiles) {
        if (!activeFilenames.has(file)) {
          try {
            fs.unlinkSync(path.join(this.thumbnailsDir, file));
          } catch {
            // ignore unlink errors
          }
        }
      }
    } catch (err) {
      console.error('[AssetStore] Failed to clean orphan thumbnails:', err);
    }
  }
}
