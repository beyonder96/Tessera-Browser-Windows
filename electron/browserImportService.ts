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
   * Discovers all profile directories within a Chromium User Data folder (Default, Profile 1, Profile 2, etc.)
   */
  public static getProfileDirs(userDataDir: string): string[] {
    const profileDirs: string[] = [];
    if (!fs.existsSync(userDataDir)) return profileDirs;

    const defaultDir = path.join(userDataDir, 'Default');
    if (fs.existsSync(defaultDir)) {
      profileDirs.push(defaultDir);
    }

    try {
      const entries = fs.readdirSync(userDataDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('Profile ')) {
          profileDirs.push(path.join(userDataDir, entry.name));
        }
      }
    } catch {
      // ignore readdir error
    }

    return profileDirs;
  }

  /**
   * Scans local Windows AppData for Google Chrome and Microsoft Edge profiles.
   */
  public static getInstalledBrowsers(): InstalledBrowserInfo[] {
    const results: InstalledBrowserInfo[] = [];

    // 1. Google Chrome
    try {
      const localAppData = process.env.LOCALAPPDATA || '';
      const chromeUserDataDir = path.join(localAppData, 'Google', 'Chrome', 'User Data');
      const chromeProfiles = this.getProfileDirs(chromeUserDataDir);

      if (chromeProfiles.length > 0) {
        let email: string | undefined;
        let profileName: string | undefined;
        let avatarUrl: string | undefined;

        // Try reading Preferences from the primary profile for Google Account info
        const primaryDir = chromeProfiles[0];
        const prefPath = path.join(primaryDir, 'Preferences');
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

        const bookmarks = this.extractChromeBookmarks(chromeUserDataDir);

        results.push({
          id: 'chrome',
          name: 'Google Chrome',
          isInstalled: true,
          profileName: profileName || (chromeProfiles.length > 1 ? `${chromeProfiles.length} Perfis` : 'Perfil Padrão'),
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
      const edgeUserDataDir = path.join(localAppData, 'Microsoft', 'Edge', 'User Data');
      const edgeProfiles = this.getProfileDirs(edgeUserDataDir);

      if (edgeProfiles.length > 0) {
        let profileName: string | undefined;
        const primaryDir = edgeProfiles[0];
        const prefPath = path.join(primaryDir, 'Preferences');

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

        const bookmarks = this.extractChromeBookmarks(edgeUserDataDir);

        results.push({
          id: 'edge',
          name: 'Microsoft Edge',
          isInstalled: true,
          profileName: profileName || (edgeProfiles.length > 1 ? `${edgeProfiles.length} Perfis` : 'Perfil Padrão'),
          bookmarkCount: bookmarks.length
        });
      }
    } catch {
      // Ignore
    }

    return results;
  }

  /**
   * Extracts bookmarks from a Chromium-based User Data directory or single profile directory.
   * Supports standard Bookmarks and AccountBookmarks across all profiles.
   */
  public static extractChromeBookmarks(targetPath: string): ExtractedBookmark[] {
    const list: ExtractedBookmark[] = [];
    if (!fs.existsSync(targetPath)) return list;

    // Check if targetPath is a User Data root or a specific profile directory
    let profileDirs: string[] = [];
    if (fs.existsSync(path.join(targetPath, 'Bookmarks')) || fs.existsSync(path.join(targetPath, 'AccountBookmarks'))) {
      profileDirs = [targetPath];
    } else {
      profileDirs = this.getProfileDirs(targetPath);
      if (profileDirs.length === 0) {
        // Fallback to checking targetPath itself
        profileDirs = [targetPath];
      }
    }

    for (const profileDir of profileDirs) {
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
