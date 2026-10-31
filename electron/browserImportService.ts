import fs from 'node:fs';
import path from 'node:path';

export interface InstalledBrowserInfo {
  id: 'chrome' | 'edge';
  name: string;
  isInstalled: boolean;
  profileName?: string;
  email?: string;
  avatarUrl?: string;
  bookmarkCount: number;
}

export interface ExtractedBookmark {
  title: string;
  url: string;
  dateAdded?: number;
}

export class BrowserImportService {
  /**
   * Scans local Windows AppData for Google Chrome and Microsoft Edge profiles.
   */
  public static getInstalledBrowsers(): InstalledBrowserInfo[] {
    const results: InstalledBrowserInfo[] = [];

    // 1. Google Chrome
    try {
      const localAppData = process.env.LOCALAPPDATA || '';
      const chromeDefaultDir = path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default');
      if (fs.existsSync(chromeDefaultDir)) {
        let email: string | undefined;
        let profileName: string | undefined;
        let avatarUrl: string | undefined;

        // Try reading Preferences for Google Account info
        const prefPath = path.join(chromeDefaultDir, 'Preferences');
        if (fs.existsSync(prefPath)) {
          try {
            const prefJson = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
            if (Array.isArray(prefJson.account_info) && prefJson.account_info.length > 0) {
              const acc = prefJson.account_info[0];
              email = acc.email;
              profileName = acc.full_name || acc.given_name;
              avatarUrl = acc.picture_url;
            } else if (prefJson.profile?.name) {
              profileName = prefJson.profile.name;
            }
          } catch {
            // ignore JSON parse error
          }
        }

        const bookmarks = this.extractChromeBookmarks(chromeDefaultDir);

        results.push({
          id: 'chrome',
          name: 'Google Chrome',
          isInstalled: true,
          profileName: profileName || 'Perfil Padrão',
          email,
          avatarUrl,
          bookmarkCount: bookmarks.length
        });
      }
    } catch {
      // Ignore
    }

    // 2. Microsoft Edge
    try {
      const localAppData = process.env.LOCALAPPDATA || '';
      const edgeDefaultDir = path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default');
      if (fs.existsSync(edgeDefaultDir)) {
        let profileName: string | undefined;

        const prefPath = path.join(edgeDefaultDir, 'Preferences');
        if (fs.existsSync(prefPath)) {
          try {
            const prefJson = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
            if (prefJson.profile?.name) {
              profileName = prefJson.profile.name;
            }
          } catch {
            // ignore
          }
        }

        const bookmarks = this.extractChromeBookmarks(edgeDefaultDir);

        results.push({
          id: 'edge',
          name: 'Microsoft Edge',
          isInstalled: true,
          profileName: profileName || 'Perfil Padrão',
          bookmarkCount: bookmarks.length
        });
      }
    } catch {
      // Ignore
    }

    return results;
  }

  /**
   * Extracts bookmarks from a Chromium-based User Data directory
   * Supports standard Bookmarks and AccountBookmarks
   */
  public static extractChromeBookmarks(profileDir: string): ExtractedBookmark[] {
    const list: ExtractedBookmark[] = [];

    // Prioritize AccountBookmarks (synced Google Account) if present, then Bookmarks
    const candidates = [
      path.join(profileDir, 'AccountBookmarks'),
      path.join(profileDir, 'Bookmarks')
    ];

    for (const targetFile of candidates) {
      if (fs.existsSync(targetFile)) {
        try {
          const raw = fs.readFileSync(targetFile, 'utf8');
          const data = JSON.parse(raw);
          if (data && typeof data.roots === 'object') {
            for (const rootKey of Object.keys(data.roots)) {
              this.traverseNodes(data.roots[rootKey], list);
            }
          }
        } catch {
          // ignore corrupted or unreadable bookmark files
        }
      }
    }

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    return list.filter((bm) => {
      if (!bm.url || seenUrls.has(bm.url)) return false;
      seenUrls.add(bm.url);
      return true;
    });
  }

  private static traverseNodes(node: any, outList: ExtractedBookmark[]): void {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'url' && typeof node.url === 'string' && node.url.startsWith('http')) {
      outList.push({
        title: typeof node.name === 'string' && node.name.trim() ? node.name.trim() : node.url,
        url: node.url
      });
      return;
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        this.traverseNodes(child, outList);
      }
    }
  }

  /**
   * Reads active Google Account session info from Electron default session cookies
   */
  public static async checkGoogleSession(ses: Electron.Session): Promise<{
    isAuthenticated: boolean;
    email?: string;
  }> {
    try {
      const googleCookies = await ses.cookies.get({ domain: 'google.com' });
      const authCookieNames = new Set(['SID', 'HSID', 'SSID', '__Secure-1PSID', '__Secure-3PSID']);
      const hasSession = googleCookies.some((c) => authCookieNames.has(c.name));
      return { isAuthenticated: hasSession };
    } catch {
      return { isAuthenticated: false };
    }
  }
}
