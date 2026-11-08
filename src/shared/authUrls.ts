/**
 * Strictly detects Google's embedded-browser rejection page
 * (e.g. https://accounts.google.com/v3/signin/rejected?...).
 * Only the URL path is inspected so legitimate `continue=` / `followup=` parameters
 * that happen to contain "rejected" never trigger a cookie wipe mid-login.
 */
export function isGoogleRejectionUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' || u.hostname.toLowerCase() !== 'accounts.google.com') return false;
    return /^\/(v3\/)?signin\/rejected(\/|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}
