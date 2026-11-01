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
   * Validates that the target path does not escape the base directory (prevents path traversal).
   */
  private isSafePath(resolvedPath: string, allowedDir: string): boolean {
    const rel = path.relative(allowedDir, resolvedPath);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  }

  /**
   * Detects MIME type from buffer magic bytes or file extension.
   */
  private detectMimeType(buffer: Buffer, filename?: string): string {
    if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    if (buffer.length >= 12 && buffer.toString('utf8', 0, 4) === 'RIFF' && buffer.toString('utf8', 8, 12) === 'WEBP') {
      return 'image/webp';
    }
    if (filename?.endsWith('.png')) return 'image/png';
    if (filename?.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
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
          // It's not a data URL, could already be a relative path or empty
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
      if (!this.isSafePath(fullPath, this.thumbnailsDir)) {
        console.warn('[AssetStore] Blocked path traversal attempt in thumbnail:', relPath);
        return null;
      }
      if (!fs.existsSync(fullPath)) return null;
      const buffer = fs.readFileSync(fullPath);
      const mime = this.detectMimeType(buffer, relPath);
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /**
   * Saves custom wallpaper data to disk, cleans up older custom wallpapers, and returns the relative path.
   */
  saveCustomWallpaper(dataUrlOrBuffer: string | Buffer): string | null {
    try {
      let buffer: Buffer;
      let extension = 'jpg';

      if (typeof dataUrlOrBuffer === 'string') {
        if (!dataUrlOrBuffer.startsWith('data:image')) {
          return dataUrlOrBuffer;
        }
        if (dataUrlOrBuffer.startsWith('data:image/png')) {
          extension = 'png';
        } else if (dataUrlOrBuffer.startsWith('data:image/webp')) {
          extension = 'webp';
        }
        const commaIdx = dataUrlOrBuffer.indexOf(',');
        if (commaIdx === -1) return null;
        buffer = Buffer.from(dataUrlOrBuffer.slice(commaIdx + 1), 'base64');
      } else {
        buffer = dataUrlOrBuffer;
      }

      // Check magic bytes for accurate extension
      const detectedMime = this.detectMimeType(buffer);
      if (detectedMime === 'image/png') extension = 'png';
      else if (detectedMime === 'image/webp') extension = 'webp';
      else extension = 'jpg';

      // Clean previous custom wallpaper files to avoid unbounded disk bloat
      try {
        const existingWallpapers = fs.readdirSync(this.wallpapersDir);
        for (const file of existingWallpapers) {
          if (file.startsWith('custom_wallpaper_')) {
            try {
              fs.unlinkSync(path.join(this.wallpapersDir, file));
            } catch {
              // ignore deletion error of busy file
            }
          }
        }
      } catch {
        // ignore read error
      }

      const filename = `custom_wallpaper_${Date.now()}.${extension}`;
      const fullPath = path.join(this.wallpapersDir, filename);

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
      if (!this.isSafePath(fullPath, this.wallpapersDir)) {
        console.warn('[AssetStore] Blocked path traversal attempt in wallpaper:', relPath);
        return null;
      }
      if (!fs.existsSync(fullPath)) return null;
      const buffer = fs.readFileSync(fullPath);
      const mime = this.detectMimeType(buffer, relPath);
      return `data:${mime};base64,${buffer.toString('base64')}`;
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
