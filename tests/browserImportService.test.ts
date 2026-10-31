import { describe, it, expect } from 'vitest';
import { BrowserImportService } from '../electron/browserImportService';

describe('BrowserImportService', () => {
  it('detects installed Chromium browsers on Windows', () => {
    const browsers = BrowserImportService.getInstalledBrowsers();
    expect(Array.isArray(browsers)).toBe(true);
    // On Kenned's Windows machine, Chrome is installed with bookmarks
    const chrome = browsers.find((b) => b.id === 'chrome');
    if (chrome) {
      expect(chrome.isInstalled).toBe(true);
      expect(chrome.bookmarkCount).toBeGreaterThanOrEqual(1);
    }
  });
});
